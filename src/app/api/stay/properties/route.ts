import { NextResponse } from 'next/server';
import { publicSupabase } from '@/lib/supabase/public';
import { fetchUniversalStaySettings } from '@/lib/stay/fetchProperties';
import { mergeAmenityLabels } from '@/lib/amenities';
import { sortProperties } from '@/lib/propertySort';

// Row shape differs depending on whether sell_options (migration 36) exists —
// cast after the fallback so the union doesn't leak into downstream uses.
type PropertyRow = {
  id: string;
  name?: string | null;
  cover_photo?: string | null;
  sell_options?: unknown;
  [key: string]: unknown;
};

export async function GET(req: Request) {
  try {
    const hostId = process.env.STAY_HOST_USER_ID;
    const universalSettings = await fetchUniversalStaySettings();
    const { searchParams } = new URL(req.url);
    const checkIn  = searchParams.get('checkIn');
    const checkOut = searchParams.get('checkOut');

    const baseCols = 'id, name, type, description, location, address, city, county, bedrooms, bathrooms, max_guests, nightly_rate, weekend_rate, cover_photo, status, latitude, longitude, check_in_time, check_out_time';
    const runQuery = (cols: string) => {
      let q = publicSupabase
        .from('properties')
        .select(cols)
        .eq('status', 'active')
        .order('name');
      if (hostId) q = q.eq('user_id', hostId);
      return q;
    };

    // Retry without sell_options if migration 36 hasn't been run yet
    let { data: properties, error } = await runQuery(`${baseCols}, sell_options`);
    if (error) ({ data: properties, error } = await runQuery(baseCols));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Exclude properties with overlapping active bookings for the requested dates.
    // Checkout dates are FREE days — a room checking out on Day X can be rebooked from Day X.
    // Overlap rule: existing booking conflicts if its first night <= user's last night
    //               AND its last night >= user's first night.
    // first night = check_in, last night = check_out - 1 day (checkout day is NOT booked).
    const today    = new Date().toISOString().split('T')[0];
    const addDays  = (d: string, n: number) => {
      const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt.toISOString().split('T')[0];
    };
    const rangeStart    = checkIn  || today;               // user's first night
    const rangeEnd      = checkOut || addDays(today, 1);   // user's checkout day (exclusive)
    const lastNight     = addDays(rangeEnd, -1);           // user's last booked night
    const blockedIds: Set<string> = new Set();

    // 1) Check bookings table (dashboard-created or auto-created from accepted requests)
    try {
      let bq = publicSupabase
        .from('bookings')
        .select('property_id')
        .in('status', ['confirmed', 'tentative', 'checked_in', 'blocked'])
        .lte('check_in',  lastNight)    // booking starts on or before user's last night
        .gte('check_out', addDays(rangeStart, 1)); // booking's checkout is after user's first night
                                                   // (checkout = rangeStart means departure that morning → free)
      if (hostId) bq = bq.eq('user_id', hostId);
      const { data: bRows } = await bq;
      (bRows ?? []).forEach((b) => { if (b.property_id) blockedIds.add(b.property_id); });
    } catch { /* RLS or connection issue — continue to booking_requests check */ }

    // 2) Also check booking_requests table — covers cases where the auto-booking
    //    insert into bookings failed but the request is confirmed/pending
    try {
      let rq = publicSupabase
        .from('booking_requests')
        .select('room_details')
        .in('status', ['confirmed', 'pending'])
        .lte('check_in',  lastNight)
        .gte('check_out', addDays(rangeStart, 1));
      if (hostId) rq = rq.eq('host_user_id', hostId);
      const { data: rRows } = await rq;
      (rRows ?? []).forEach((r) => {
        const rooms = Array.isArray(r.room_details) ? r.room_details : [];
        rooms.forEach((room) => { if (room.property_id) blockedIds.add(room.property_id); });
      });
    } catch { /* ignore */ }

    const withPhotos = await Promise.all(
      sortProperties(((properties ?? []) as unknown as PropertyRow[]).filter((p) => !blockedIds.has(p.id))).map(async (p) => {
        const { data: photos } = await publicSupabase
          .from('property_photos')
          .select('url, sort_order')
          .eq('property_id', p.id)
          .order('sort_order')
          .limit(5);
        const { data: amenities } = await publicSupabase
          .from('property_amenities')
          .select('name')
          .eq('property_id', p.id);
        return {
          ...p,
          photos: photos?.map((ph) => ph.url) ?? (p.cover_photo ? [p.cover_photo] : []),
          amenities: mergeAmenityLabels(universalSettings.amenities, amenities?.map((a: { name: string }) => a.name) ?? []),
        };
      })
    );

    return NextResponse.json({ properties: withPhotos });
  } catch (err) {
    console.error('[stay/properties]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
