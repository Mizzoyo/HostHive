import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://kogelosuites.com';

const DESCRIPTION =
  'Compare studios and suites at Kogelo Suites in Kisumu. Browse room photos, filter room options, and check live rates and availability.';

export const metadata: Metadata = {
  title: { absolute: 'Rooms at Kogelo Suites | Studios & Suites in Kisumu' },
  description: DESCRIPTION,
  alternates: {
    canonical: `${BASE_URL}/stay/rooms`,
  },
  openGraph: {
    title: 'Rooms at Kogelo Suites | Studios & Suites in Kisumu',
    description: DESCRIPTION,
    url: `${BASE_URL}/stay/rooms`,
    siteName: 'Kogelo Suites',
    images: [
      {
        url: '/images/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Kogelo Suites Rooms',
      },
    ],
    type: 'website',
    locale: 'en_KE',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rooms at Kogelo Suites | Studios & Suites in Kisumu',
    description: DESCRIPTION,
    images: ['/images/og-image.jpg'],
  },
};

export default function RoomsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
