import type { Metadata } from 'next';
import StayHomeClient from '@/components/stay/home/StayHomeClient';
import './stay.css';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://kogelosuites.com';

export const metadata: Metadata = {
  title: 'Stay at Kogelo Suites | Studios, Suites & Poolside Rooms',
  description:
    'Find a welcoming studio or suite at Kogelo Suites. Explore 17 spaces in a private compound, browse room photos and check live availability.',
  alternates: { canonical: `${BASE_URL}/stay` },
  openGraph: {
    title: 'Stay at Kogelo Suites | Studios, Suites & Poolside Rooms',
    description:
      'Explore welcoming studios and suites in a peaceful private compound. Browse rooms and check live availability at Kogelo Suites.',
    url: `${BASE_URL}/stay`,
    type: 'website',
    siteName: 'Kogelo Suites',
    locale: 'en_KE',
    images: [
      {
        url: '/images/hero.jpg',
        width: 1200,
        height: 630,
        alt: 'Kogelo Suites — studios and suites in Kisumu, Kenya',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stay at Kogelo Suites | Studios, Suites & Poolside Rooms',
    description:
      'Explore welcoming studios and suites in a peaceful private compound. Check live availability at Kogelo Suites.',
    images: ['/images/hero.jpg'],
  },
};

export default function StayHomePage() {
  return <StayHomeClient />;
}
