import { createClient } from '@/lib/supabase/server';
import { sortProperties } from '@/lib/propertySort';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    let userId = process.env.STAY_HOST_USER_ID ?? '';
    if (!userId) {
      const supabase = await createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      userId = session.user.id;
    }
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()));
    const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth()));

    const from = new Date(year, month, 1).toISOString().split('T')[0];
    const to = new Date(year, month + 1, 0).toISOString().split('T')[0];

    const [{ data: properties }, { data: rawBookings }] = await Promise.all([
      supabase
        .from('properties')
        .select('id, name, unit_number, nightly_rate, cleaning_fee, created_at')
        .eq('user_id', userId)
        .neq('status', 'draft')
        .order('created_at'),
      supabase
        .from('bookings')
        .select('id, guest_id, property_id, check_in, check_out, nights, nightly_rate, cleaning_fee, extra_fees, discount_amount, security_deposit, commission_amount, total_amount, amount_paid, balance_due, payment_status, booking_source, status, notes, guests(name, phone, email)')
        .eq('user_id', userId)
        .neq('status', 'cancelled')
        .lte('check_in', to)
        .gte('check_out', from)
        .order('check_in'),
    ]);

    const bookings = (rawBookings ?? []).map((b) => {
      const raw = b.guests as unknown;
      const g: { name: string; phone?: string; email?: string } | null =
        Array.isArray(raw) ? (raw[0] ?? null) : (raw as { name: string } | null);
      return {
        id: b.id,
        guest_id: b.guest_id,
        property_id: b.property_id,
        check_in: b.check_in,
        check_out: b.check_out,
        nights: b.nights,
        nightly_rate: b.nightly_rate,
        cleaning_fee: b.cleaning_fee,
        extra_fees: b.extra_fees,
        discount_amount: b.discount_amount,
        security_deposit: b.security_deposit,
        commission_amount: b.commission_amount,
        total_amount: b.total_amount,
        amount_paid: b.amount_paid,
        balance_due: b.balance_due,
        payment_status: b.payment_status,
        booking_source: b.booking_source,
        status: b.status,
        notes: b.notes,
        guest_name: g?.name ?? 'Unknown',
        guest_phone: g?.phone ?? '',
        guest_email: g?.email ?? '',
      };
    });

    return NextResponse.json({ bookings, properties: sortProperties(properties ?? []) });
  } catch (err) {
    console.error('[bookings/calendar]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
