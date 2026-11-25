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
      images: [
        {
          url: `${BASE_URL}/api/og/${slug}.jpg`,
          width: 1200,
          height: 630,
          type: 'image/jpeg',
          alt: `${title} at Kogelo Suites`,
        },
      ],
      type: 'website',
      locale: 'en_KE',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | Kogelo Suites`,
      description,
      images: [`${BASE_URL}/api/og/${slug}.jpg`],
    },
  };
}

// Kept synchronous — any data fetching here would block the loading.tsx
// boundary below and show a blank screen until it resolved. JSON-LD lives in
// page.tsx, which already fetches the same property/photo data.
export default function RoomDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
