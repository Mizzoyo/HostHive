import { getRoomOgImage } from '@/lib/stay/roomOgImage';

export const runtime = 'nodejs';
export const revalidate = 86400;

export const alt = 'Room at Kogelo Suites';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/jpeg';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return getRoomOgImage(id);
}
