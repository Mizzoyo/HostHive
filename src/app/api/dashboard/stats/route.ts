import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (!from || !to) return NextResponse.json({ error: 'Missing date range' }, { status: 400 });

    const today = new Date().toISOString().split('T')[0];
    const addDaysStr = (date: string, days: number) => {
      const dt = new Date(`${date}T00:00:00Z`);
      dt.setUTCDate(dt.getUTCDate() + days);
      return dt.toISOString().split('T')[0];
    };
    const periodEndExclusive = addDaysStr(to, 1);
    const overlapNights = (checkIn: string, checkOut: string) => {
      const start = checkIn > from ? checkIn : from;
      const end = checkOut < periodEndExclusive ? checkOut : periodEndExclusive;
      if (end <= start) return 0;
      return Math.round((new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86400000);
    };

    // Properties
    const { data: properties, error: propErr } = await supabase
      .from('properties')
      .select('id, name, status')
      .eq('user_id', userId)
      .neq('status', 'draft');
    if (propErr) throw propErr;
    const totalProperties = properties?.length ?? 0;

    // Bookings in period (by check_in date). select('*') so optional fee columns never break the query.
    const { data: bookings, error: bkErr } = await supabase
      .from('bookings')
      .select('*')
      .eq('user_id', userId)
      .gte('check_in', from)
      .lte('check_in', to);
    if (bkErr) throw bkErr;

    const confirmed = (bookings ?? []).filter(b => !['cancelled', 'blocked', 'no_show'].includes(b.status));
    const cancelled = (bookings ?? []).filter(b => b.status === 'cancelled');
    const blockedBookings = (bookings ?? []).filter(b => b.status === 'blocked');

    // Today's check-ins / check-outs (always today, not period-filtered)
    const { data: todayCheckins } = await supabase
      .from('bookings').select('id').eq('user_id', userId)
      .eq('check_in', today).neq('status', 'cancelled');

    const { data: todayCheckouts } = await supabase
      .from('bookings').select('id').eq('user_id', userId)
      .eq('check_out', today).neq('status', 'cancelled');

    // New bookings created today
    const { data: newToday } = await supabase
      .from('bookings').select('id').eq('user_id', userId)
      .gte('created_at', today + 'T00:00:00.000Z')
      .lte('created_at', today + 'T23:59:59.999Z');

    // Tentative / pending
    const { data: tentative } = await supabase
      .from('bookings').select('id').eq('user_id', userId)
      .in('status', ['tentative', 'pending']);

    // Payment logs in period
    const { data: payments, error: payErr } = await supabase
      .from('payment_logs')
      .select('amount, payment_method, paid_at')
      .eq('user_id', userId)
      .gte('paid_at', from + 'T00:00:00.000Z')
      .lte('paid_at', to + 'T23:59:59.999Z');
    if (payErr) throw payErr;

    // Bookings that overlap the selected period for occupancy (not just check-ins inside it)
    const { data: occupancyBookings, error: occErr } = await supabase
      .from('bookings')
      .select('property_id, check_in, check_out, status')
      .eq('user_id', userId)
      .not('status', 'in', '(cancelled,no_show,blocked)')
      .lte('check_in', to)
      .gt('check_out', from);
    if (occErr) throw occErr;

    const totalRevenue = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
    const mpesaRevenue = (payments ?? []).filter(p => p.payment_method === 'mpesa').reduce((s, p) => s + Number(p.amount), 0);
    const cashRevenue = (payments ?? []).filter(p => p.payment_method === 'cash').reduce((s, p) => s + Number(p.amount), 0);

    // Revenue basis matches Financial Reports: booking value by check-in date
    const bookingRevenue = confirmed.reduce((s, b) => s + Number(b.total_amount), 0);
    const collectedRevenue = totalRevenue;
    const outstandingRevenue = confirmed.reduce((s, b) => s + Math.max(0, Number(b.balance_due ?? 0)), 0);

    const stayRevenue = confirmed.reduce((s, b) => s + Number(b.nightly_rate) * Number(b.nights), 0);
    const cleaningRevenue = confirmed.reduce((s, b) => s + Number(b.cleaning_fee ?? 0), 0);
    const feeRevenue = confirmed.reduce((s, b) => s + Number(b.extra_fees ?? 0), 0);
    const discountRevenue = confirmed.reduce((s, b) => s + Number(b.discount_amount ?? 0), 0);
    const extraRevenue = Math.max(0, bookingRevenue - stayRevenue - cleaningRevenue - feeRevenue + discountRevenue);

    // Occupancy uses clipped room-nights for bookings overlapping the period
    const fromDate = new Date(`${from}T00:00:00Z`);
    const periodEndMs = new Date(`${periodEndExclusive}T00:00:00Z`).getTime();
    const periodDays = Math.max(1, Math.round((periodEndMs - fromDate.getTime()) / 86400000));
    const totalNightsAvail = totalProperties * periodDays;
    const totalNightsBooked = (occupancyBookings ?? []).reduce((s, b) => s + overlapNights(b.check_in, b.check_out), 0);
    const occupancyRate = totalNightsAvail > 0 ? Math.round((totalNightsBooked / totalNightsAvail) * 100) : 0;

    // Fetch ALL blocked bookings active today (regardless of period — long-term blocks may predate 'from')
    const { data: blockedTodayRows } = await supabase
      .from('bookings')
      .select('property_id')
      .eq('user_id', userId)
      .eq('status', 'blocked')
      .lte('check_in', today)
      .gt('check_out', today);
    const blockedTodayIds = new Set((blockedTodayRows ?? []).map((b: { property_id: string }) => b.property_id));

    const { data: todayStayRows } = await supabase
      .from('bookings')
      .select('property_id')
      .eq('user_id', userId)
      .in('status', ['confirmed', 'checked_in'])
      .lte('check_in', today)
      .gt('check_out', today);
    const occupiedTodayIds = new Set((todayStayRows ?? []).map((b: { property_id: string }) => b.property_id));

    // Rooms with at least one booking overlapping the selected period
    const occupiedPeriodIds = new Set(
      (occupancyBookings ?? []).filter(b => overlapNights(b.check_in, b.check_out) > 0).map(b => b.property_id)
    );
    const { data: blockedPeriodRows } = await supabase
      .from('bookings')
      .select('property_id')
      .eq('user_id', userId)
      .eq('status', 'blocked')
      .lte('check_in', to)
      .gt('check_out', from);
    const blockedPeriodIds = new Set((blockedPeriodRows ?? []).map((b: { property_id: string }) => b.property_id));

    const occupiedNow = (properties ?? []).filter(p => occupiedPeriodIds.has(p.id)).length;
    const blockedNow = (properties ?? []).filter(p => !occupiedPeriodIds.has(p.id) && blockedPeriodIds.has(p.id)).length;

    // ADR / RevPAR
    const adr = totalNightsBooked > 0 ? Math.round(stayRevenue / totalNightsBooked) : 0;
    const revpar = totalNightsAvail > 0 ? Math.round(stayRevenue / totalNightsAvail) : 0;

    // Projected revenue: confirmed future bookings
    const { data: futureBookings } = await supabase
      .from('bookings')
      .select('total_amount')
      .eq('user_id', userId)
      .gte('check_in', today)
      .not('status', 'in', '(cancelled,no_show,blocked)');
    const projectedRevenue = (futureBookings ?? []).reduce((s, b) => s + Number(b.total_amount), 0);

    // Forecast occupancy: next 7 and 30 days
    const next7 = new Date(today); next7.setDate(next7.getDate() + 7);
    const next30 = new Date(today); next30.setDate(next30.getDate() + 30);

    const { data: f7 } = await supabase.from('bookings').select('nights')
      .eq('user_id', userId).not('status', 'in', '(cancelled,no_show,blocked)')
      .gte('check_in', today).lte('check_in', next7.toISOString().split('T')[0]);
    const { data: f30 } = await supabase.from('bookings').select('nights')
      .eq('user_id', userId).not('status', 'in', '(cancelled,no_show,blocked)')
      .gte('check_in', today).lte('check_in', next30.toISOString().split('T')[0]);

    const f7Nights = (f7 ?? []).reduce((s, b) => s + Number(b.nights), 0);
    const f30Nights = (f30 ?? []).reduce((s, b) => s + Number(b.nights), 0);
    const forecast7Pct = totalProperties > 0 ? Math.round((f7Nights / (totalProperties * 7)) * 100) : 0;
    const forecast30Pct = totalProperties > 0 ? Math.round((f30Nights / (totalProperties * 30)) * 100) : 0;

    // Booking sources
    const sourceCounts: Record<string, number> = {};
    confirmed.forEach(b => {
      const src = (b.booking_source || 'direct').toLowerCase();
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    });

    // Cancellation rate
    const totalInPeriod = (bookings ?? []).length;
    const cancellationRate = totalInPeriod > 0
      ? Math.round((cancelled.length / totalInPeriod) * 1000) / 10
      : 0;

    // Cashflow grouped by date
    const cfMap: Record<string, { mpesa: number; cash: number }> = {};
    (payments ?? []).forEach(p => {
      const day = p.paid_at.split('T')[0];
      if (!cfMap[day]) cfMap[day] = { mpesa: 0, cash: 0 };
      if (p.payment_method === 'mpesa') cfMap[day].mpesa += Number(p.amount);
      else if (p.payment_method === 'cash') cfMap[day].cash += Number(p.amount);
    });
    const cashflow = Object.entries(cfMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, mpesa: v.mpesa, cash: v.cash, total: v.mpesa + v.cash }));

    // Per-property unit performance for the selected period
    const overlapNightsByProperty = new Map<string, number>();
    const overlapCountByProperty = new Map<string, number>();
    (occupancyBookings ?? []).forEach(b => {
      const nights = overlapNights(b.check_in, b.check_out);
      overlapNightsByProperty.set(b.property_id, (overlapNightsByProperty.get(b.property_id) ?? 0) + nights);
      overlapCountByProperty.set(b.property_id, (overlapCountByProperty.get(b.property_id) ?? 0) + 1);
    });

    const unitPerformance = (properties ?? []).map(p => {
      const pb = confirmed.filter(b => b.property_id === p.id);
      const propRevenue = pb.reduce((s, b) => s + Number(b.total_amount), 0);
      const propNights  = overlapNightsByProperty.get(p.id) ?? 0;
      const propBookingCount = overlapCountByProperty.get(p.id) ?? 0;
      const propOccPct  = Math.min(100, Math.round((propNights / periodDays) * 100));
      const propAvgStay = propBookingCount > 0 ? Math.round((propNights / propBookingCount) * 10) / 10 : 0;
      const isOccupied  = occupiedTodayIds.has(p.id);
      const isBlocked = blockedTodayIds.has(p.id);
      return {
        id: p.id,
        name: p.name,
        status: isBlocked ? 'blocked' : isOccupied ? 'occupied' : 'available',
        occupancyPct: propOccPct,
        revenue: propRevenue,
        avgStay: propAvgStay,
        bookings: pb.length,
      };
    }).sort((a, b) => b.revenue - a.revenue);

    const maxUnitRevenue = unitPerformance.reduce((m, u) => Math.max(m, u.revenue), 0);

    // Fetch universal settings
    const { data: profile } = await supabase
      .from('profiles')
      .select('default_check_in_time, default_check_out_time, default_check_in_method, default_property_city, default_property_county, business_area')
      .eq('id', userId)
      .maybeSingle();

    return NextResponse.json({
      occupancy: { rate: occupancyRate, occupied: occupiedNow, available: totalProperties - occupiedNow - blockedNow, blocked: blockedNow },
      properties: properties ?? [],
      unitPerformance,
      maxUnitRevenue,
      revenue: {
        total: bookingRevenue,
        collected: collectedRevenue,
        outstanding: outstandingRevenue,
        stay: stayRevenue,
        cleaning: cleaningRevenue,
        fees: feeRevenue,
        discounts: discountRevenue,
        extra: extraRevenue,
        mpesa: mpesaRevenue,
        cash: cashRevenue,
        adr,
        revpar,
        projected: projectedRevenue,
      },
      bookings: {
        roomsSold: confirmed.length,
        newToday: newToday?.length ?? 0,
        cancellations: cancelled.length,
        cancellationRate,
        checkInsToday: todayCheckins?.length ?? 0,
        checkOutsToday: todayCheckouts?.length ?? 0,
        tentative: tentative?.length ?? 0,
        sources: sourceCounts,
        total: totalInPeriod,
      },
      forecast: { next7: forecast7Pct, next30: forecast30Pct },
      cashflow,
    });
  } catch (err) {
    console.error('[dashboard/stats]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
