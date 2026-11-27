import { resolveRoomTotals, type PropertyPricing } from '@/lib/stay/pricing';

const prop = (overrides: Partial<PropertyPricing>): PropertyPricing => ({
  id: 'prop-a',
  nightly_rate: 10000,
  bedrooms: 3,
  max_guests: 6,
  sell_options: [],
  ...overrides,
});

const room = (overrides = {}) => ({
  property_id: 'prop-a',
  property_name: 'Villa',
  nightly_rate: 1, // forged client value — must be ignored
  qty: 1,
  subtotal: 1,     // forged client value — must be ignored
  ...overrides,
});

describe('resolveRoomTotals', () => {
  it('recomputes subtotals and total from DB rates', () => {
    const r = resolveRoomTotals({
      roomDetails: [room()],
      properties: [prop({})],
      nights: 4,
    });
    expect(r.roomDetails[0].nightly_rate).toBe(10000);
    expect(r.roomDetails[0].subtotal).toBe(40000);
    expect(r.totalAmount).toBe(40000);
    expect(r.rooms[0]).toEqual({ propertyId: 'prop-a', subtotal: 40000 });
  });

  it('uses the sell-option rate when sold_as_bedrooms matches an option', () => {
    const r = resolveRoomTotals({
      roomDetails: [room({ sold_as_bedrooms: 2 })],
      properties: [prop({
        sell_options: [{ bedrooms: 2, nightly_rate: 7000, max_guests: 4 }],
      })],
      nights: 2,
    });
    expect(r.roomDetails[0].nightly_rate).toBe(7000);
    expect(r.roomDetails[0].sold_as_bedrooms).toBe(2);
    expect(r.roomDetails[0].sold_as_label).toBe('2 Bedroom');
    expect(r.totalAmount).toBe(14000);
  });

  it('falls back to the full-house rate for an unknown sell option', () => {
    const r = resolveRoomTotals({
      roomDetails: [room({ sold_as_bedrooms: 9 })],
      properties: [prop({
        sell_options: [{ bedrooms: 2, nightly_rate: 7000, max_guests: 4 }],
      })],
      nights: 1,
    });
    expect(r.roomDetails[0].nightly_rate).toBe(10000);
    expect(r.roomDetails[0].sold_as_bedrooms).toBeNull();
    expect(r.totalAmount).toBe(10000);
  });

  it('multiplies by qty', () => {
    const r = resolveRoomTotals({
      roomDetails: [room({ qty: 2 })],
      properties: [prop({})],
      nights: 3,
    });
    expect(r.totalAmount).toBe(60000);
  });

  it('keeps client values for an unknown property', () => {
    const r = resolveRoomTotals({
      roomDetails: [room({ property_id: 'ghost', subtotal: 5000, nightly_rate: 500 })],
      properties: [prop({})],
      nights: 2,
    });
    expect(r.roomDetails[0].subtotal).toBe(5000);
    expect(r.totalAmount).toBe(5000);
  });
});
