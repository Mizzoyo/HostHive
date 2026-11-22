import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

type PaymentEntry = {
  amount: number;
  method?: string;
  date_type?: string;
  date?: string | null;
  notes?: string;
  extra?: {
    mpesa_code?: string;
    cash_receipt?: string;
    card_last4?: string;
    bank_confirmation?: string;
    bank_reference?: string;
  };
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;

    const body = await request.json();
    const {
      guest_name,
      guest_phone,
      guest_email,
      property_id,
      check_in,
      check_out,
      nightly_rate,
      cleaning_fee,
      extra_fees,
      discount,
      discount_amount,
      security_deposit,
      booking_source,
      notes,
      status,
      payment_intent,
      payments = [],
      commission_amount,
      preserve_total,
      sold_as_bedrooms,
    } = body;

    const { data: existing, error: fetchErr } = await supabase
      .from('bookings')
      .select('guest_id, property_id, check_in, check_out, nightly_rate, cleaning_fee, extra_fees, discount_amount, nights, total_amount, amount_paid, balance_due, payment_status, status')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    if (fetchErr || !existing) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    const totalAffectingProvided = [check_in, check_out, nightly_rate, cleaning_fee, extra_fees, discount, discount_amount]
      .some(v => v !== undefined);
    const shouldRecalcTotal = totalAffectingProvided && preserve_total !== true;

    const resolvedTotal = shouldRecalcTotal
      ? Math.max(0,
          (nightly_rate !== undefined ? Number(nightly_rate) : Number(existing.nightly_rate)) *
          Math.max(1, Math.round((new Date(check_out ?? existing.check_out).getTime() - new Date(check_in ?? existing.check_in).getTime()) / 86400000)) +
          (cleaning_fee !== undefined ? Number(cleaning_fee) : Number(existing.cleaning_fee ?? 0)) +
          (extra_fees !== undefined ? Number(extra_fees) : Number(existing.extra_fees ?? 0)) -
          (discount_amount !== undefined ? Number(discount_amount) : discount !== undefined ? Number(discount) : Number(existing.discount_amount ?? 0))
        )
      : Number(existing.total_amount);

    const paymentEntries = Array.isArray(payments) ? payments as PaymentEntry[] : [];
    const newPaid = payment_intent !== undefined && payment_intent !== 'none'
      ? paymentEntries.reduce((s, p) => s + (Number(p.amount) || 0), 0)
      : 0;
    const totalPaid = Number(existing.amount_paid ?? 0) + newPaid;
    const balanceDue = Math.max(0, resolvedTotal - totalPaid);
    const paymentStatus = totalPaid > resolvedTotal && resolvedTotal > 0
      ? 'overpaid'
      : totalPaid >= resolvedTotal && resolvedTotal > 0
        ? 'paid'
        : totalPaid > 0
          ? 'partial'
          : 'unpaid';

    const updates: Record<string, unknown> = {
      amount_paid: totalPaid,
      balance_due: balanceDue,
      payment_status: paymentStatus,
    };

    if (shouldRecalcTotal) {
      const ci = check_in ?? existing.check_in;
      const co = check_out ?? existing.check_out;
      updates.check_in = ci;
      updates.check_out = co;
      updates.nights = Math.max(1, Math.round((new Date(co).getTime() - new Date(ci).getTime()) / 86400000));
      updates.nightly_rate = nightly_rate !== undefined ? Number(nightly_rate) : Number(existing.nightly_rate);
      updates.cleaning_fee = cleaning_fee !== undefined ? Number(cleaning_fee) : Number(existing.cleaning_fee ?? 0);
      updates.extra_fees = extra_fees !== undefined ? Number(extra_fees) : Number(existing.extra_fees ?? 0);
      updates.discount_amount = discount_amount !== undefined
        ? Number(discount_amount)
        : discount !== undefined
          ? Number(discount)
          : Number(existing.discount_amount ?? 0);
      updates.total_amount = resolvedTotal;
    }

    if (property_id !== undefined) updates.property_id = property_id;
    if (sold_as_bedrooms !== undefined) updates.sold_as_bedrooms = Number(sold_as_bedrooms) || null;
    if (booking_source !== undefined) updates.booking_source = booking_source;
    if (notes !== undefined) updates.notes = notes;
    if (status !== undefined) updates.status = status;
    if (security_deposit !== undefined) updates.security_deposit = Number(security_deposit) || 0;
    if (commission_amount !== undefined) {
      if (commission_amount === '' || commission_amount === null) {
        updates.commission_amount = null;
      } else {
        const resolvedCommission = Number(commission_amount);
        if (!Number.isFinite(resolvedCommission) || resolvedCommission < 0) {
          return NextResponse.json({ error: 'commission_amount must be a valid non-negative number' }, { status: 400 });
        }
        updates.commission_amount = resolvedCommission;
      }
    }

    if (guest_name !== undefined && existing.guest_id) {
      await supabase
        .from('guests')
        .update({
          name: guest_name,
          ...(guest_phone !== undefined && { phone: guest_phone }),
          ...(guest_email !== undefined && { email: guest_email }),
        })
        .eq('id', existing.guest_id);
    }

    const { data: booking, error: updateErr } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });

    if (booking) {
      const isNowCancelled = ['cancelled', 'no_show'].includes(booking.status ?? '');
      const wasActive = !['cancelled', 'no_show'].includes(existing.status ?? '');

      if (isNowCancelled && wasActive) {
        const { error: delErr } = await supabase.from('blocked_dates').delete().eq('booking_id', id);
        if (delErr) {
          await supabase.from('blocked_dates').delete()
            .eq('property_id', booking.property_id)
            .eq('user_id', userId)
            .eq('start_date', booking.check_in)
            .eq('end_date', booking.check_out);
        }
      } else if (!isNowCancelled) {
        const { error: upErr } = await supabase.from('blocked_dates')
          .update({ start_date: booking.check_in, end_date: booking.check_out, updated_at: new Date().toISOString() })
          .eq('booking_id', id);
        if (upErr) {
          await supabase.from('blocked_dates')
            .update({ start_date: booking.check_in, end_date: booking.check_out, updated_at: new Date().toISOString() })
            .eq('property_id', booking.property_id)
            .eq('user_id', userId)
            .eq('start_date', existing.check_in)
            .eq('end_date', existing.check_out);
        }
      }
    }

    if (booking && payment_intent !== undefined && payment_intent !== 'none' && paymentEntries.length > 0) {
      for (const pmt of paymentEntries) {
        const pmtAmt = Number(pmt.amount) || 0;
        if (pmtAmt <= 0) continue;
        const paidAt = pmt.date_type === 'pick' && pmt.date
          ? new Date(pmt.date).toISOString()
          : new Date().toISOString();
        await supabase.from('payment_logs').insert({
          booking_id: booking.id,
          user_id: userId,
          property_id: booking.property_id,
          amount: pmtAmt,
          currency: 'KES',
          payment_method: pmt.method ?? 'cash',
          paid_at: paidAt,
          mpesa_code: pmt.extra?.mpesa_code || null,
          cash_receipt_number: pmt.extra?.cash_receipt || null,
          card_last_four: pmt.extra?.card_last4 || null,
          bank_reference: pmt.extra?.bank_confirmation || pmt.extra?.bank_reference || null,
          notes: pmt.notes || null,
        });
      }
    }

    return NextResponse.json({ booking });
  } catch (err) {
    console.error('[PATCH /api/bookings/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;

    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/bookings/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
