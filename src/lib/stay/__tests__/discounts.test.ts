jest.mock('@/lib/supabase/public', () => ({
  publicSupabase: { from: jest.fn() },
}));

import { evaluateDiscounts, type Discount } from '@/lib/stay/discounts';

const today = new Date('2026-11-27T12:00:00Z');
const iso = (offsetDays: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const base = (overrides: Partial<Discount>): Discount => ({
  id: 'd1',
  name: 'Test discount',
  discount_type: 'first_timer',
  value_type: 'percentage',
  value: 5,
  early_booking_days: null,
  valid_from: null,
  valid_until: null,
  is_active: true,
  discount_properties: [],
  ...overrides,
});

const rooms = [{ propertyId: 'prop-a', subtotal: 20000 }];
const ctx = { rooms, checkIn: iso(10), isLoggedIn: false, isFirstTimer: null, today };

describe('evaluateDiscounts', () => {
  it('applies a first_timer discount to a verified first-timer', () => {
    const r = evaluateDiscounts({ ...ctx, discounts: [base({})], isFirstTimer: true });
    expect(r.appliedDiscounts).toHaveLength(1);
    expect(r.appliedDiscounts[0].amount).toBe(1000); // 5% of 20000
    expect(r.discountTotal).toBe(1000);
  });

  it('does not apply first_timer to a returning guest, and does not gate it', () => {
    const r = evaluateDiscounts({ ...ctx, discounts: [base({})], isFirstTimer: false });
    expect(r.appliedDiscounts).toHaveLength(0);
    expect(r.gated).toHaveLength(0);
  });

  it('gates first_timer for guests whose identity is unknown', () => {
    const r = evaluateDiscounts({ ...ctx, discounts: [base({})] });
    expect(r.appliedDiscounts).toHaveLength(0);
    expect(r.gated).toHaveLength(1);
  });

  it('gates online_booking for signed-out guests', () => {
    const r = evaluateDiscounts({ ...ctx, discounts: [base({ discount_type: 'online_booking' })] });
    expect(r.appliedDiscounts).toHaveLength(0);
    expect(r.gated).toHaveLength(1);
  });

  it('applies online_booking to signed-in guests', () => {
    const r = evaluateDiscounts({
      ...ctx,
      discounts: [base({ discount_type: 'online_booking' })],
      isLoggedIn: true,
      isFirstTimer: false,
    });
    expect(r.appliedDiscounts).toHaveLength(1);
  });

  it('applies early_booking only when booked far enough ahead', () => {
    const d = base({ discount_type: 'early_booking', early_booking_days: 14, value: 10 });
    const ok = evaluateDiscounts({ ...ctx, discounts: [d], checkIn: iso(20) });
    expect(ok.appliedDiscounts[0].amount).toBe(2000);

    const late = evaluateDiscounts({ ...ctx, discounts: [d], checkIn: iso(5) });
    expect(late.appliedDiscounts).toHaveLength(0);
  });

  it('never auto-applies manual discounts', () => {
    const r = evaluateDiscounts({ ...ctx, discounts: [base({ discount_type: 'manual' })] });
    expect(r.appliedDiscounts).toHaveLength(0);
    expect(r.gated).toHaveLength(0);
  });

  it('scopes discounts to linked properties only', () => {
    const d = base({ discount_properties: [{ property_id: 'prop-b' }] });
    const r = evaluateDiscounts({
      ...ctx,
      discounts: [d],
      rooms: [
        { propertyId: 'prop-a', subtotal: 20000 },
        { propertyId: 'prop-b', subtotal: 5000 },
      ],
      isFirstTimer: true,
    });
    expect(r.appliedDiscounts[0].amount).toBe(250); // 5% of prop-b only
  });

  it('caps a fixed discount at the eligible base', () => {
    const d = base({ value_type: 'fixed', value: 99999 });
    const r = evaluateDiscounts({ ...ctx, discounts: [d], isFirstTimer: true });
    expect(r.appliedDiscounts[0].amount).toBe(20000);
  });

  it('caps stacked discounts at the total subtotal', () => {
    const r = evaluateDiscounts({
      ...ctx,
      discounts: [base({ value: 60 }), base({ id: 'd2', value: 60, discount_type: 'early_booking', early_booking_days: 1 })],
      isFirstTimer: true,
    });
    expect(r.discountTotal).toBe(20000);
    expect(r.appliedDiscounts.reduce((s, a) => s + a.amount, 0)).toBe(20000);
  });

  it('respects valid_from / valid_until windows', () => {
    const future = base({ valid_from: iso(1) });
    const past = base({ id: 'd2', valid_until: iso(-1) });
    const r = evaluateDiscounts({ ...ctx, discounts: [future, past], isFirstTimer: true });
    expect(r.appliedDiscounts).toHaveLength(0);
  });
});
