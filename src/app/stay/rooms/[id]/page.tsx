import { notFound } from 'next/navigation';
import { publicSupabase } from '@/lib/supabase/public';
import { toRoomSlug, resolveRoomParam } from '@/lib/stay/roomSlug';
import { roomTypeLabel } from '@/lib/stay/roomType';
import { fetchUniversalStaySettings } from '@/lib/stay/fetchProperties';
import { mergeAmenityLabels } from '@/lib/amenities';
import { getSellOptions } from '@/lib/sellOptions';
import RoomPreview, { type PreviewPhoto } from '@/components/stay/room-detail/RoomPreview';
import './room-detail.css';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://kogelosuites.com';

export const revalidate = 3600;

export async function generateStaticParams() {
  const { data } = await publicSupabase
    .from('properties')
    .select('id, name, slug')
    .eq('status', 'active');
  return (data ?? []).map(p => ({ id: toRoomSlug(p.slug, p.name, p.id) }));
}

type PageParams   = Promise<{ id: string }>;
type SearchParams = Promise<{ checkIn?: string; checkOut?: string; guests?: string }>;

export default async function RoomDetailPage({
  params, searchParams,
}: {
  params: PageParams; searchParams: SearchParams;
}) {
  const { id: slug } = await params;
  const sp = await searchParams;
  // Computed inside an async callback so the current date isn't read during render
  const { today, tomorrow } = await Promise.resolve().then(() => {
    const now = new Date();
    return {
      today:    now.toISOString().split('T')[0],
      tomorrow: new Date(now.getTime() + 86400000).toISOString().split('T')[0],
    };
  });

  const { col, value } = resolveRoomParam(slug);
  const { data: property } = await publicSupabase
    .from('properties')
    // '*' so sell_options is included when migration 36 has run, without breaking the page if it hasn't
    .select('*')
    .eq(col, value)
    .eq('status', 'active')
    .single();

  if (!property) notFound();
  const id = property.id;
  const maxGuests = Math.max(1, Number(property.max_guests ?? 2) || 1);

  const initialCheckIn  = sp.checkIn  ?? today;
  const initialCheckOut = sp.checkOut ?? tomorrow;
  const initialGuests   = Math.min(maxGuests, Math.max(1, Number(sp.guests ?? 1) || 1));

  const sellOptions = getSellOptions(property);
  const smallerOptions = sellOptions.filter(o => !o.isFull);
  const alsoAs = smallerOptions.length > 0
    ? `Also bookable as ${smallerOptions.map(o => o.label).join(' or ')}`
    : '';

  const [photosResult, amenitiesResult, universalSettings] = await Promise.all([
    publicSupabase
      .from('property_photos')
      .select('url, sort_order')
      .eq('property_id', id)
      .order('sort_order'),
    publicSupabase
      .from('property_amenities')
      .select('name')
      .eq('property_id', id),
    fetchUniversalStaySettings(),
  ]);

  const typeLabel = roomTypeLabel(property);
  const photoUrls = photosResult.data?.map((p: { url: string }) => p.url)
    ?? (property.cover_photo ? [property.cover_photo] : []);
  const photos: PreviewPhoto[] = photoUrls.map((url: string, index: number) => ({
    src: url,
    alt: `${property.name} ${typeLabel} — photo ${index + 1}`,
  }));
  const amenities = mergeAmenityLabels(
    universalSettings.amenities,
    amenitiesResult.data?.map((a: { name: string }) => a.name) ?? [],
  );

  // All rooms share one compound — location comes from the host's universal
  // settings (Settings → Universal Location Settings), not per-property rows.
  const dedupe = (parts: string[]) => parts.filter((v, i) => parts.indexOf(v) === i);
  const areaParts = dedupe(
    [universalSettings.defaultPropertyLocation, universalSettings.defaultPropertyCity]
      .filter((part): part is string => Boolean(part)),
  );
  const lineParts = dedupe(
    [universalSettings.defaultPropertyLocation, universalSettings.defaultPropertyCity, universalSettings.defaultPropertyCounty]
      .filter((part): part is string => Boolean(part)),
  );
  const areaLabel = areaParts.join(', ') || 'Kisumu';
  const locationLine = [...lineParts, 'Kenya'].join(', ');
  const city = universalSettings.defaultPropertyCity || 'Kisumu';

  const roomJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HotelRoom',
    name: property.name,
    description: property.description || 'A comfortable room at Kogelo Suites, Kogelo, Kenya.',
    url: `${BASE_URL}/stay/rooms/${slug}`,
    image: photoUrls.slice(0, 3),
    occupancy: { '@type': 'QuantitativeValue', maxValue: property.max_guests ?? 2 },
    bed: { '@type': 'BedDetails', numberOfBeds: property.bedrooms ?? 1 },
    containedInPlace: { '@type': 'LodgingBusiness', name: 'Kogelo Suites', url: `${BASE_URL}/stay` },
    offers: property.nightly_rate
      ? {
          '@type': 'Offer',
          price: property.nightly_rate,
          priceCurrency: 'KES',
          availability: 'https://schema.org/InStock',
        }
      : undefined,
  };
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',  item: `${BASE_URL}/stay` },
      { '@type': 'ListItem', position: 2, name: 'Rooms', item: `${BASE_URL}/stay/rooms` },
      { '@type': 'ListItem', position: 3, name: property.name ?? 'Room' },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(roomJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <RoomPreview
      property={{
        id,
        slug: property.slug,
        name: property.name,
        typeLabel,
        nightlyRate: Number(property.nightly_rate ?? 0),
        maxGuests,
        bedrooms: Number(property.bedrooms ?? 1) || 0,
        bathrooms: Number(property.bathrooms ?? 1) || 1,
        areaLabel,
        locationLine,
        city,
        description: property.description ?? '',
        checkInTime: property.check_in_time ?? '14:00',
        checkOutTime: property.check_out_time ?? '11:00',
        cancellationPolicy: property.cancellation_policy ?? 'flexible',
        houseRules: property.house_rules ?? {},
        options: sellOptions,
      }}
      photos={photos}
      amenities={amenities}
      alsoAs={alsoAs}
      initialCheckIn={initialCheckIn}
      initialCheckOut={initialCheckOut}
      initialGuests={initialGuests}
      />
    </>
  );
}
