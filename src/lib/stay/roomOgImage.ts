import sharp from 'sharp';
import { publicSupabase } from '@/lib/supabase/public';
import { resolveRoomParam } from '@/lib/stay/roomSlug';

const WIDTH = 1200;
const HEIGHT = 630;

const HEADERS = {
  'Content-Type': 'image/jpeg',
  'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
};

async function fallbackImage(): Promise<Response> {
  const jpeg = await sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 3, background: '#0f766e' },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
  return new Response(new Uint8Array(jpeg), { headers: HEADERS });
}

export async function getRoomOgImage(slug: string): Promise<Response> {
  try {
    const { col, value } = resolveRoomParam(slug);
    const { data: property } = await publicSupabase
      .from('properties')
      .select('id, cover_photo')
      .eq(col, value)
      .eq('status', 'active')
      .single();

    let photoUrl = '';
    if (property?.id) {
      const { data: photos } = await publicSupabase
        .from('property_photos')
        .select('url')
        .eq('property_id', property.id)
        .order('sort_order')
        .limit(1);
      photoUrl = photos?.[0]?.url || '';
    }
    if (!photoUrl) photoUrl = property?.cover_photo || '';
    if (!photoUrl) return fallbackImage();

    const res = await fetch(photoUrl);
    if (!res.ok) return fallbackImage();

    const jpeg = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(WIDTH, HEIGHT, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer();
    return new Response(new Uint8Array(jpeg), { headers: HEADERS });
  } catch {
    return fallbackImage();
  }
}
