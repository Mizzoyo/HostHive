/**
 * Server-side price resolution for booking requests.
 *
 * The browser computes its own totals — these helpers recompute each room
 * line's subtotal and the overall booking total from database rates so a
 * tampered payload can't claim a lower price or inflate a discount base.
 * Effective rates honour sell_options (a property sold as fewer bedrooms)
 * via findSellOption.
 */

import { findSellOption } from '@/lib/sellOptions';
import type { RoomSubtotal } from './discounts';

export type RoomDetail = {
  property_id?: string;
  property_name?: string;
  nightly_rate?: number;
  qty?: number;
  nights?: number;
  subtotal?: number;
  sold_as_bedrooms?: number | null;
  sold_as_label?: string | null;
  [key: string]: unknown;
};

export type PropertyPricing = {
  id: string;
  nightly_rate?: number | string | null;
  bedrooms?: number | null;
  max_guests?: number | null;
  sell_options?: unknown;
};

export function resolveRoomTotals(opts: {
  roomDetails: RoomDetail[];
  properties: PropertyPricing[];
  nights: number;
}): {
  rooms: RoomSubtotal[];
  roomDetails: RoomDetail[];
  totalAmount: number;
} {
  const byId = new Map(opts.properties.map(p => [p.id, p]));
  const nights = Math.max(1, Number(opts.nights) || 1);

  const roomDetails = opts.roomDetails.map(r => {
    const prop = r.property_id ? byId.get(r.property_id) : undefined;
    if (!prop) return r; // unknown property — keep client values (existing behaviour)

    const option = findSellOption(prop, r.sold_as_bedrooms);
    const qty = Math.max(1, Number(r.qty) || 1);
    const rate = Math.max(0, Number(option.nightly_rate) || 0);
    return {
      ...r,
      nightly_rate: rate,
      sold_as_bedrooms: option.isFull ? null : option.bedrooms,
      sold_as_label: option.isFull ? null : option.label,
      subtotal: rate * qty * nights,
    };
  });

  const rooms = roomDetails.map(r => ({
    propertyId: r.property_id ?? '',
    subtotal: Number(r.subtotal) || 0,
  }));
  const totalAmount = rooms.reduce((s, r) => s + r.subtotal, 0);

  return { rooms, roomDetails, totalAmount };
}
