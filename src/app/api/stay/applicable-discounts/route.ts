import { NextRequest, NextResponse } from 'next/server';
import { publicSupabase } from '@/lib/supabase/public';
import { createClient } from '@/lib/supabase/server';
import { evaluateGuestDiscounts, RoomSubtotal } from '@/lib/stay/discounts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const checkIn  = searchParams.get('checkIn');
    const userId   = searchParams.get('userId');
    const phone    = searchParams.get('phone');
    const email    = searchParams.get('email');
    const empty    = { discounts: [], appliedDiscounts: [], discountTotal: 0, gated: [] };

    if (!checkIn) {
      return NextResponse.json(empty);
    }

    // Rooms: JSON array of { propertyId, subtotal } — lets the caller pass
    // real subtotals for multi-room carts. Fall back to propertyId(s) only.
    let rooms: RoomSubtotal[] = [];
    const roomsParam = searchParams.get('rooms');
    if (roomsParam) {
      try {
        const parsed = JSON.parse(roomsParam);
        if (Array.isArray(parsed)) {
          rooms = parsed
            .filter(r => r && typeof r.propertyId === 'string')
            .map(r => ({ propertyId: r.propertyId as string, subtotal: Number(r.subtotal) || 0 }));
        }
      } catch { /* ignore malformed param */ }
    }
    if (!rooms.length) {
      const ids = [
        ...(searchParams.get('propertyIds')?.split(',') ?? []),
        ...(searchParams.get('propertyId') ? [searchParams.get('propertyId')!] : []),
      ].map(s => s.trim()).filter(Boolean);
      if (!ids.length) return NextResponse.json(empty);
      rooms = ids.map(propertyId => ({ propertyId, subtotal: 0 }));
    }

    // Resolve slugs → property ids
    const slugs = rooms.map(r => r.propertyId).filter(id => !UUID_RE.test(id));
    if (slugs.length) {
      const { data: props } = await publicSupabase
        .from('properties')
        .select('id, slug')
        .in('slug', slugs);
      const bySlug = new Map((props ?? []).map(p => [p.slug, p.id]));
      rooms = rooms.map(r => ({ ...r, propertyId: bySlug.get(r.propertyId) ?? r.propertyId }));
    }

    // Prefer the server-side session; fall back to the userId param
    let resolvedUserId: string | null = null;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      resolvedUserId = user?.id ?? null;
    } catch { /* no session — stay anonymous */ }
    if (!resolvedUserId && userId && UUID_RE.test(userId)) resolvedUserId = userId;

    const result = await evaluateGuestDiscounts({
      rooms,
      checkIn,
      userId:     resolvedUserId,
      guestPhone: phone,
      guestEmail: email,
    });

    return NextResponse.json({
      discounts:        result.applicable,
      appliedDiscounts: result.appliedDiscounts,
      discountTotal:    result.discountTotal,
      gated:            result.gated,
      isFirstTimer:     result.isFirstTimer,
    });
  } catch (err) {
    console.error('[applicable-discounts]', err);
    return NextResponse.json({ discounts: [], appliedDiscounts: [], discountTotal: 0, gated: [] });
  }
}
