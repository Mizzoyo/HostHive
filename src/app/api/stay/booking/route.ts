import { NextRequest, NextResponse } from 'next/server';
import { publicSupabase } from '@/lib/supabase/public';
import { createClient } from '@/lib/supabase/server';
import { sendSmsBulk, buildGuestRequestSms, buildAdminRequestSms, normalizePhone } from '@/lib/sms';
import { fireMakeBookingWebhook } from '@/lib/makeWebhook';
import { evaluateGuestDiscounts } from '@/lib/stay/discounts';
import { resolveRoomTotals } from '@/lib/stay/pricing';

export async function POST(req: NextRequest) {
  console.log('[booking] POST received');
  try {
    const body = await req.json();
    console.log('[booking] body parsed, guest_email:', body.guest_email ?? '(missing)');
    const {
      guest_name, guest_phone, guest_email = '',
      check_in, check_out, nights,
      num_adults = 1, num_children = 0,
      room_details = [],
      special_requests = '',
      user_id = null,
    } = body;

    if (!guest_name?.trim()) return NextResponse.json({ error: 'Guest name is required' }, { status: 400 });
    if (!guest_phone?.trim()) return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    if (!guest_email?.trim()) return NextResponse.json({ error: 'Email address is required' }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest_email.trim())) return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    if (!check_in || !check_out) return NextResponse.json({ error: 'Dates are required' }, { status: 400 });
    if (!room_details?.length) return NextResponse.json({ error: 'Please select at least one room' }, { status: 400 });

    // ── Verified guest identity: prefer the cookie session, then body user_id ─
    let guestUserId: string | null = null;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      guestUserId = user?.id ?? null;
    } catch { /* anonymous booking */ }
    if (!guestUserId) guestUserId = user_id ?? null;

    // ── Server-authoritative pricing + discount evaluation ──────────────────
    // Subtotals and the booking total are recomputed from DB rates (honouring
    // sell_options) so a forged payload can't claim a lower price or inflate
    // the discount base; client-sent amounts and discount fields are ignored.
    const roomIds = [...new Set(
      (room_details as { property_id?: string }[])
        .map(r => r.property_id)
        .filter((id): id is string => Boolean(id)),
    )];
    const { data: propRows } = roomIds.length
      ? await publicSupabase.from('properties').select('id, nightly_rate, bedrooms, max_guests, sell_options').in('id', roomIds)
      : { data: [] };

    const { rooms, roomDetails, totalAmount } = resolveRoomTotals({
      roomDetails: room_details,
      properties: propRows ?? [],
      nights: Number(nights) || 1,
    });

    const { discountTotal, appliedDiscounts } = await evaluateGuestDiscounts({
      rooms,
      checkIn:    check_in,
      userId:     guestUserId,
      guestPhone: guest_phone.trim(),
      guestEmail: guest_email.trim(),
    });

    const basePayload = {
      guest_name: guest_name.trim(),
      guest_phone: guest_phone.trim(),
      guest_email: guest_email.trim(),
      check_in,
      check_out,
      nights,
      num_adults,
      num_children,
      room_details: roomDetails,
      total_amount: totalAmount,
      special_requests: special_requests.trim(),
      host_user_id: process.env.STAY_HOST_USER_ID ?? '',
      ...(guestUserId ? { guest_user_id: guestUserId } : {}),
    };

    // ── Atomic insert via advisory-lock RPC (migration 37) ──────────────────
    // Takes a per-property pg_advisory_xact_lock, re-checks overlap, then
    // inserts in one transaction — concurrent requests for the same room
    // serialize and the loser gets a conflict response instead of double-booking.
    let bookingId = '';
    const { data: rpcData, error: rpcError } = await publicSupabase.rpc('create_booking_request', {
      p_guest_name:       basePayload.guest_name,
      p_guest_phone:      basePayload.guest_phone,
      p_guest_email:      basePayload.guest_email,
      p_check_in:         check_in,
      p_check_out:        check_out,
      p_nights:           Number(nights) || 0,
      p_num_adults:       Number(num_adults) || 1,
      p_num_children:     Number(num_children) || 0,
      p_room_details:     roomDetails,
      p_total_amount:     totalAmount,
      p_special_requests: basePayload.special_requests,
      p_host_user_id:     basePayload.host_user_id,
      p_guest_user_id:    guestUserId,
      p_discount_total:   discountTotal,
      p_applied_discounts: appliedDiscounts,
    });

    if (rpcData?.conflict) {
      return NextResponse.json({ error: rpcData.error, conflict: true }, { status: 409 });
    }

    if (rpcData?.id) {
      bookingId = rpcData.id as string;
    } else {
      // Migration 37 not applied yet (or the function rejected) — legacy insert path
      if (rpcError) console.error('[booking] rpc unavailable, falling back to insert:', rpcError.message);
      let { data, error } = await publicSupabase
        .from('booking_requests')
        .insert({ ...basePayload, discount_total: discountTotal, applied_discounts: appliedDiscounts })
        .select('id')
        .single();

      // If discount columns don't exist yet (migration pending), retry without them
      if (error?.message?.includes('applied_discounts') || error?.message?.includes('discount_total')) {
        ({ data, error } = await publicSupabase
          .from('booking_requests')
          .insert(basePayload)
          .select('id')
          .single());
      }

      if (error) {
        console.error('[booking] Supabase insert error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (!data) return NextResponse.json({ error: 'Booking could not be created.' }, { status: 500 });
      bookingId = data.id;
    }
    console.log('[booking] insert OK, id:', bookingId, '— firing Make.com webhook');

    // ── Make.com webhook — AI-personalised emails (non-blocking) ────────────
    const firstRoom = roomDetails.length > 0 ? roomDetails[0] : null;
    const propertyName = firstRoom?.property_name ?? 'Kogelo Suites';

    fireMakeBookingWebhook({
      id:               bookingId,
      guest_name:       guest_name.trim(),
      guest_email:      guest_email.trim(),
      guest_phone:      guest_phone.trim(),
      check_in,
      check_out,
      nights:           Number(nights),
      room_name:        propertyName,
      room_details:     roomDetails,
      total_amount:     totalAmount,
      discount_total:   discountTotal,
      net_amount:       Math.max(0, totalAmount - discountTotal),
      special_requests: special_requests.trim(),
      admin_email:      process.env.ADMIN_EMAIL ?? '',
    });
    // ────────────────────────────────────────────────────────────────────────

    // ── Automated SMS (non-blocking) ────────────────────────────────────────
    const adminPhone   = normalizePhone(process.env.ADMIN_PHONE ?? '');
    const guestE164    = normalizePhone(guest_phone.trim());

    const smsResults = await sendSmsBulk([
      {
        to:      guestE164,
        message: buildGuestRequestSms({
          guestName:    guest_name.trim(),
          propertyName,
          checkIn:      check_in,
          checkOut:     check_out,
          nights:       Number(nights),
          ref:          bookingId,
        }),
      },
      ...(adminPhone ? [{
        to:      adminPhone,
        message: buildAdminRequestSms({
          guestName:    guest_name.trim(),
          guestPhone:   guest_phone.trim(),
          propertyName,
          checkIn:      check_in,
          checkOut:     check_out,
          nights:       Number(nights),
          total:        totalAmount,
        }),
      }] : []),
    ]).catch(err => { console.error('[SMS booking]', err); return []; });
    // ────────────────────────────────────────────────────────────────────────

    const smsErrors = smsResults.filter(r => !r.ok).map(r => r.error);
    if (smsErrors.length) console.error('[SMS booking errors]', smsErrors);

    return NextResponse.json({
      success: true,
      id: bookingId,
      sms: smsResults,
      total_amount: totalAmount,
      discount_total: discountTotal,
      applied_discounts: appliedDiscounts,
    });
  } catch (err) {
    console.error('[stay/booking]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
