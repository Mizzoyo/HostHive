import { NextRequest, NextResponse } from 'next/server';
import { publicSupabase } from '@/lib/supabase/public';
import { fetchUniversalStaySettings } from '@/lib/stay/fetchProperties';
import { mergeAmenityLabels } from '@/lib/amenities';
import { resolveRoomParam } from '@/lib/stay/roomSlug';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: param } = await params;
    const { col, value } = resolveRoomParam(param);

    const propRes = await publicSupabase.from('properties').select('*').eq(col, value).eq('status', 'active').single();
    if (propRes.error || !propRes.data) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }
    const id = propRes.data.id;

    const [photoRes, amenRes, universalSettings] = await Promise.all([
      publicSupabase.from('property_photos').select('url, sort_order').eq('property_id', id).order('sort_order'),
      publicSupabase.from('property_amenities').select('name').eq('property_id', id),
      fetchUniversalStaySettings(),
    ]);

    const p = propRes.data;
    const photos = photoRes.data?.map((ph: { url: string }) => ph.url) ?? (p.cover_photo ? [p.cover_photo] : []);
    const amenities = mergeAmenityLabels(universalSettings.amenities, amenRes.data?.map((a: { name: string }) => a.name) ?? []);

    const { data: bookings } = await publicSupabase
      .from('bookings')
      .select('check_in, check_out')
      .eq('property_id', id)
      .not('status', 'in', '("cancelled","blocked")')
      .gte('check_out', new Date().toISOString().split('T')[0]);

    return NextResponse.json({ property: { ...p, photos, amenities }, bookedDates: bookings ?? [] });
  } catch (err) {
    console.error('[stay/properties/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
