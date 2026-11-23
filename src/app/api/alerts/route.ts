import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const uid   = session.user.id;
    const today = new Date().toISOString().split('T')[0];
    const in7   = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 1 * 86400000).toISOString().split('T')[0];

    const INACTIVE = 'cancelled,no_show,blocked';

    const [ciRes, coRes, upRes, unpaidRes] = await Promise.all([
      // Today's check-ins
      supabase
        .from('bookings')
        .select('id, check_in, check_out, nights, total_amount, amount_paid, balance_due, payment_status, booking_source, guests(name, phone), properties(name)')
        .eq('user_id', uid)
        .not('status', 'in', `(${INACTIVE})`)
        .eq('check_in', today)
        .order('check_in'),

      // Today's check-outs
      supabase
        .from('bookings')
        .select('id, check_in, check_out, nights, total_amount, amount_paid, balance_due, payment_status, booking_source, guests(name, phone), properties(name)')
        .eq('user_id', uid)
        .not('status', 'in', `(${INACTIVE})`)
        .eq('check_out', today)
        .order('check_out'),

      // Upcoming bookings (tomorrow → 7 days)
      supabase
        .from('bookings')
        .select('id, check_in, check_out, nights, total_amount, balance_due, payment_status, booking_source, guests(name, phone), properties(name)')
        .eq('user_id', uid)
        .eq('status', 'confirmed')
        .gte('check_in', tomorrow)
        .lte('check_in', in7)
        .order('check_in'),

      // Unpaid / partial balances on active bookings (including past check-outs)
      supabase
        .from('bookings')
        .select('id, check_in, check_out, nights, total_amount, amount_paid, balance_due, payment_status, booking_source, guests(name, phone), properties(name)')
        .eq('user_id', uid)
        .not('status', 'in', `(${INACTIVE})`)
        .in('payment_status', ['unpaid', 'partial'])
        .gt('balance_due', 0)
        .order('check_out', { ascending: true }),
    ]);

    return NextResponse.json({
      checkIns:     ciRes.data     ?? [],
      checkOuts:    coRes.data     ?? [],
      upcoming:     upRes.data     ?? [],
      unpaid:       unpaidRes.data ?? [],
    });
  } catch (err: unknown) {
    console.error('[GET /api/alerts]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
