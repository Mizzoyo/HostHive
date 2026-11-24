import { getRoomOgImage } from '@/lib/stay/roomOgImage';

export const runtime = 'nodejs';
export const revalidate = 86400;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;
  const slug = file.replace(/\.jpe?g$/i, '');
  if (!slug) return new Response('Not found', { status: 404 });
  return getRoomOgImage(slug);
}
