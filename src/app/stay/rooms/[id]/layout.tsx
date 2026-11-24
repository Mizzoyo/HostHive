import type { Metadata } from 'next';
import { publicSupabase } from '@/lib/supabase/public';
import { resolveRoomParam } from '@/lib/stay/roomSlug';
import { roomTypeLabel } from '@/lib/stay/roomType';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://kogelosuites.com';

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id: slug } = await params;
  const { col, value } = resolveRoomParam(slug);

  const { data: property } = await publicSupabase
    .from('properties')
    .select('id, name, description, nightly_rate, bedrooms, bathrooms, max_guests, type')
    .eq(col, value)
    .eq('status', 'active')
    .single();

  if (!property) {
    return {
      title: 'Room Not Found',
      description: 'This room is not available.',
    };
  }

  const bedLabel = roomTypeLabel(property);
  const title = property.name ?? `${bedLabel} Suite`;
  const description =
    property.description ||
    `${bedLabel} suite at Kogelo Suites, Kogelo, Kenya. Sleeps up to ${property.max_guests ?? 2} guests. ${property.nightly_rate ? `From KES ${property.nightly_rate.toLocaleString()} per night.` : ''}`;

  return {
    title,
    description,
    alternates: {
      canonical: `${BASE_URL}/stay/rooms/${slug}`,
    },
    openGraph: {
      title: `${title} | Kogelo Suites`,
      description,
      url: `${BASE_URL}/stay/rooms/${slug}`,
      siteName: 'Kogelo Suites',
      type: 'website',
      locale: 'en_KE',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | Kogelo Suites`,
      description,
    },
  };
}

export default async function RoomDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id: slug } = await params;
  const { col, value } = resolveRoomParam(slug);

  const { data: property } = await publicSupabase
    .from('properties')
    .select('id, name, description, nightly_rate, bedrooms, bathrooms, max_guests, type')
    .eq(col, value)
    .eq('status', 'active')
    .single();

  const layoutId = property?.id ?? '';
  const [{ data: photos }] = await Promise.all([
    publicSupabase
      .from('property_photos')
      .select('url')
      .eq('property_id', layoutId)
      .order('sort_order')
      .limit(3),
  ]);

  const roomJsonLd = property
    ? {
        '@context': 'https://schema.org',
        '@type': 'HotelRoom',
        name: property.name,
        description:
          property.description ||
          `A comfortable room at Kogelo Suites, Kogelo, Kenya.`,
        url: `${BASE_URL}/stay/rooms/${slug}`,
        image: photos?.map((p) => p.url) ?? [],
        occupancy: {
          '@type': 'QuantitativeValue',
          maxValue: property.max_guests ?? 2,
        },
        bed: {
          '@type': 'BedDetails',
          numberOfBeds: property.bedrooms ?? 1,
        },
        containedInPlace: {
          '@type': 'LodgingBusiness',
          name: 'Kogelo Suites',
          url: `${BASE_URL}/stay`,
        },
        offers: property.nightly_rate
          ? {
              '@type': 'Offer',
              price: property.nightly_rate,
              priceCurrency: 'KES',
              availability: 'https://schema.org/InStock',
            }
          : undefined,
      }
    : null;

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',  item: `${BASE_URL}/stay` },
      { '@type': 'ListItem', position: 2, name: 'Rooms', item: `${BASE_URL}/stay/rooms` },
      { '@type': 'ListItem', position: 3, name: property?.name ?? 'Room' },
    ],
  };

  return (
    <>
      {roomJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(roomJsonLd) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {children}
    </>
  );
}
