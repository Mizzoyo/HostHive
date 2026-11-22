import type { Metadata } from 'next';
import { DM_Sans, Playfair_Display } from 'next/font/google';

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
});

const BASE_URL = process.env.NEXT_PUBLIC_RESTAURANT_DOMAIN
  ? ('https://' + process.env.NEXT_PUBLIC_RESTAURANT_DOMAIN)
  : 'https://restaurant.kogelosuites.com';

export const metadata: Metadata = {
  title: 'Kogelo Restaurant — Menu & Call to Order',
  description:
    'Browse the Kogelo Restaurant menu — breakfast, main dishes, sharing bites, drinks and sides. Build your order and call 0726 566 795 to confirm.',
  alternates: { canonical: BASE_URL },
  openGraph: {
    title: 'Kogelo Restaurant — Menu & Call to Order',
    description: 'Authentic Kenyan favourites. Browse the menu, then call to confirm your order.',
    url: BASE_URL,
    siteName: 'Kogelo Restaurant',
    type: 'website',
    locale: 'en_KE',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kogelo Restaurant — Menu & Call to Order',
    description: 'Authentic Kenyan favourites. Browse the menu, then call to confirm your order.',
  },
};

export default function RestaurantLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${dmSans.variable} ${playfair.variable}`}>{children}</div>;
}
