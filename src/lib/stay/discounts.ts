/**
 * Discount evaluation engine — shared by:
 *   GET  /api/stay/applicable-discounts  (guest-facing eligibility preview)
 *   POST /api/stay/booking               (server-authoritative application)
 *
 * Discount types (sql/24_discounts.sql):
 *   first_timer    → guest has 0 prior non-declined/non-cancelled booking requests
 *                    (matched by user id, phone, or email)
 *   early_booking  → booking made >= early_booking_days before check-in
 *   online_booking → guest is signed in
 *   manual         → never auto-applies
 */

import { publicSupabase } from '@/lib/supabase/public';
import { normalizePhone } from '@/lib/sms';

export type DiscountType = 'first_timer' | 'early_booking' | 'online_booking' | 'manual';
export type ValueType = 'percentage' | 'fixed';

export type Discount = {
  id: string;
  name: string;
  description?: string;
  discount_type: DiscountType;
  value_type: ValueType;
  value: number;
  early_booking_days: number | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  discount_properties?: { property_id: string }[] | null;
};

export type RoomSubtotal = { propertyId: string; subtotal: number };

export type AppliedDiscount = {
  id: string;
  name: string;
  discount_type: DiscountType;
  value_type: ValueType;
  value: number;
  /** KSh amount this discount removes from the booking */
  amount: number;
};

export type DiscountEvaluation = {
  /** Auto-applied discounts (all triggers satisfied) */
  applicable: Discount[];
  /** Discounts the guest could unlock by signing in / sharing contact details */
  gated: Discount[];
  /** Applied discounts with computed KSh amounts */
  appliedDiscounts: AppliedDiscount[];
  /** Sum of applied amounts, capped at the booking subtotal */
  discountTotal: number;
  /** null when the guest's identity couldn't be checked (no user/phone/email) */
  isFirstTimer: boolean | null;
  isLoggedIn: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safe(value: string) {
  return value.replace(/[",()\\]/g, '').trim();
}

function subtotalFor(discount: Discount, rooms: RoomSubtotal[]): number {
  const linked = (discount.discount_properties ?? []).map(lp => lp.property_id);
  const eligible = linked.length === 0
    ? rooms
    : rooms.filter(r => linked.includes(r.propertyId));
  return eligible.reduce((s, r) => s + Math.max(0, Number(r.subtotal) || 0), 0);
}

function amountFor(discount: Discount, base: number): number {
  if (base <= 0) return 0;
  if (discount.value_type === 'percentage') return Math.round(base * (Number(discount.value) / 100));
  return Math.min(Math.round(Number(discount.value)), base);
}

/**
 * Count prior booking requests that still "use up" first-timer eligibility —
 * declined and cancelled requests don't count.
 * Returns null when no identity signal was provided at all.
 */
export async function countPriorBookings(identity: {
  userId?: string | null;
  guestPhone?: string | null;
  guestEmail?: string | null;
}): Promise<number | null> {
  const clauses: string[] = [];

  if (identity.userId && UUID_RE.test(identity.userId)) {
    clauses.push(`guest_user_id.eq.${identity.userId}`);
  }
  if (identity.guestPhone?.trim()) {
    const variants = new Set(
      [identity.guestPhone.trim(), normalizePhone(identity.guestPhone.trim())]
        .map(safe)
        .filter(Boolean),
    );
    variants.forEach(p => clauses.push(`guest_phone.eq."${p}"`));
  }
  if (identity.guestEmail?.trim()) {
    clauses.push(`guest_email.ilike."${safe(identity.guestEmail)}"`);
  }

  if (!clauses.length) return null;

  const { count, error } = await publicSupabase
    .from('booking_requests')
    .select('id', { count: 'exact', head: true })
    .or(clauses.join(','))
    .not('status', 'in', '("declined","cancelled")');

  if (error) {
    console.error('[discounts] prior bookings count failed:', error.message);
    return null;
  }
  return count ?? 0;
}

/**
 * Pure evaluation — given candidate discounts, room subtotals and identity
 * flags, decide which discounts apply and how much each removes.
 */
export function evaluateDiscounts(opts: {
  discounts: Discount[];
  rooms: RoomSubtotal[];
  checkIn: string;
  isLoggedIn: boolean;
  isFirstTimer: boolean | null;
  today?: Date;
}): DiscountEvaluation {
  const { discounts, rooms, checkIn, isLoggedIn, isFirstTimer } = opts;
  const today = opts.today ?? new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const checkInDate = new Date(`${checkIn}T12:00:00`);
  const daysUntilCheckIn = Number.isNaN(checkInDate.getTime())
    ? -Infinity
    : Math.ceil((checkInDate.getTime() - today.getTime()) / 86400000);

  const dateValid = discounts.filter(d => {
    if (d.valid_from && todayStr < d.valid_from) return false;
    if (d.valid_until && todayStr > d.valid_until) return false;
    return true;
  });

  const triggerMet = (d: Discount): boolean => {
    switch (d.discount_type) {
      case 'first_timer':    return isFirstTimer === true;
      case 'early_booking':  return daysUntilCheckIn >= (d.early_booking_days ?? 1);
      case 'online_booking': return isLoggedIn;
      case 'manual':         return false;
      default:               return false;
    }
  };

  const applicable = dateValid.filter(d => triggerMet(d));

  // Discounts worth prompting about: within the booking's date/property scope
  // but locked behind sign-in or verifiable contact details.
  const gated = dateValid.filter(d => {
    if (applicable.includes(d)) return false;
    if (subtotalFor(d, rooms) <= 0) return false;
    if (d.discount_type === 'online_booking') return !isLoggedIn;
    if (d.discount_type === 'first_timer')  return !isLoggedIn && isFirstTimer === null;
    return false;
  });

  // Apply largest discounts first; never discount below zero.
  let remaining = rooms.reduce((s, r) => s + Math.max(0, Number(r.subtotal) || 0), 0);
  const appliedDiscounts: AppliedDiscount[] = applicable
    .map(d => ({ discount: d, raw: amountFor(d, subtotalFor(d, rooms)) }))
    .sort((a, b) => b.raw - a.raw)
    .map(({ discount, raw }) => {
      const amount = Math.min(raw, remaining);
      remaining -= amount;
      return {
        id:            discount.id,
        name:          discount.name,
        discount_type: discount.discount_type,
        value_type:    discount.value_type,
        value:         Number(discount.value),
        amount,
      };
    })
    .filter(a => a.amount > 0);

  return {
    applicable,
    gated,
    appliedDiscounts,
    discountTotal: appliedDiscounts.reduce((s, a) => s + a.amount, 0),
    isFirstTimer,
    isLoggedIn,
  };
}

/**
 * Full pipeline — fetch active discounts, resolve the guest's first-timer
 * status from the database, and evaluate.
 */
export async function evaluateGuestDiscounts(opts: {
  rooms: RoomSubtotal[];
  checkIn: string;
  userId?: string | null;
  guestPhone?: string | null;
  guestEmail?: string | null;
  hostId?: string;
}): Promise<DiscountEvaluation> {
  const hostId = opts.hostId ?? process.env.STAY_HOST_USER_ID ?? '';

  const { data, error } = await publicSupabase
    .from('discounts')
    .select('*, discount_properties(property_id)')
    .eq('host_user_id', hostId)
    .eq('is_active', true);

  if (error) console.error('[discounts] fetch failed:', error.message);

  const priorCount = await countPriorBookings({
    userId:     opts.userId,
    guestPhone: opts.guestPhone,
    guestEmail: opts.guestEmail,
  });

  return evaluateDiscounts({
    discounts:   (data ?? []) as Discount[],
    rooms:       opts.rooms,
    checkIn:     opts.checkIn,
    isLoggedIn:  Boolean(opts.userId),
    isFirstTimer: priorCount === null ? null : priorCount === 0,
  });
}
