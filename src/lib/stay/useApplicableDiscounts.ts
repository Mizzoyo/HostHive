'use client';

import { useEffect, useState } from 'react';
import type { AppliedDiscount, Discount, RoomSubtotal } from './discounts';

export type ApplicableDiscounts = {
  discounts: Discount[];
  appliedDiscounts: AppliedDiscount[];
  discountTotal: number;
  gated: Discount[];
};

const EMPTY: ApplicableDiscounts = {
  discounts: [],
  appliedDiscounts: [],
  discountTotal: 0,
  gated: [],
};

/**
 * Debounced fetch of /api/stay/applicable-discounts for the rooms, dates and
 * identity the guest currently has. Re-fetches when any input changes (e.g.
 * once the guest types a phone number or email on the checkout form).
 */
export function useApplicableDiscounts(opts: {
  rooms: RoomSubtotal[];
  checkIn: string;
  userId?: string | null;
  phone?: string;
  email?: string;
  enabled?: boolean;
}): ApplicableDiscounts {
  const [result, setResult] = useState<ApplicableDiscounts>(EMPTY);
  const { rooms, checkIn, userId, phone, email, enabled = true } = opts;
  const roomsKey = JSON.stringify(rooms);

  useEffect(() => {
    if (!enabled || !checkIn || !rooms.length) {
      const t = setTimeout(() => setResult(EMPTY), 0);
      return () => clearTimeout(t);
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      const qs = new URLSearchParams({ checkIn, rooms: roomsKey });
      if (userId)        qs.set('userId', userId);
      if (phone?.trim()) qs.set('phone', phone.trim());
      if (email?.trim()) qs.set('email', email.trim());
      fetch(`/api/stay/applicable-discounts?${qs.toString()}`, { signal: ctrl.signal })
        .then(r => r.json())
        .then(d => {
          if (ctrl.signal.aborted) return;
          setResult({
            discounts:        d.discounts ?? [],
            appliedDiscounts: d.appliedDiscounts ?? [],
            discountTotal:    Number(d.discountTotal) || 0,
            gated:            d.gated ?? [],
          });
        })
        .catch(err => { if (err?.name !== 'AbortError') setResult(EMPTY); });
    }, 400);
    return () => { clearTimeout(timer); ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, checkIn, userId, phone, email, roomsKey]);

  return result;
}
