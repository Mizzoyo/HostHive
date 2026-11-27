import { getSellOptions, findSellOption, minNightlyRate, normalizeSellOptions } from '@/lib/sellOptions';

const house = {
  bedrooms: 4,
  nightly_rate: 20000,
  max_guests: 8,
  sell_options: [
    { bedrooms: 3, nightly_rate: 15000, max_guests: 6 },
    { bedrooms: 2, nightly_rate: 11000, max_guests: 4 },
  ],
};

describe('normalizeSellOptions', () => {
  it('rejects invalid options: >= total bedrooms, bad rates, duplicates', () => {
    const out = normalizeSellOptions([
      { bedrooms: 4, nightly_rate: 1000, max_guests: 8 },   // same as total — invalid
      { bedrooms: 2, nightly_rate: -5, max_guests: 4 },     // negative rate — invalid
      { bedrooms: 2, nightly_rate: 9000, max_guests: 4 },
      { bedrooms: 2, nightly_rate: 8000, max_guests: 4 },   // duplicate — dropped
      { bedrooms: 'x', nightly_rate: 1000, max_guests: 4 }, // NaN — invalid
    ], 4);
    expect(out).toEqual([{ bedrooms: 2, nightly_rate: 9000, max_guests: 4 }]);
  });
});

describe('getSellOptions', () => {
  it('returns the full house first, then options largest-first', () => {
    const opts = getSellOptions(house);
    expect(opts).toHaveLength(3);
    expect(opts[0].isFull).toBe(true);
    expect(opts[0].nightly_rate).toBe(20000);
    expect(opts.map(o => o.bedrooms)).toEqual([4, 3, 2]);
  });

  it('returns only the full house when no options exist', () => {
    const opts = getSellOptions({ bedrooms: 1, nightly_rate: 5000, sell_options: [] });
    expect(opts).toHaveLength(1);
    expect(opts[0].isFull).toBe(true);
  });
});

describe('findSellOption', () => {
  it('resolves a matching option', () => {
    const o = findSellOption(house, 3);
    expect(o.isFull).toBe(false);
    expect(o.nightly_rate).toBe(15000);
    expect(o.max_guests).toBe(6);
  });

  it('falls back to the full house for null, unknown, or the full count', () => {
    expect(findSellOption(house, null).isFull).toBe(true);
    expect(findSellOption(house, 1).isFull).toBe(true);
    expect(findSellOption(house, 4).isFull).toBe(true);
  });
});

describe('minNightlyRate', () => {
  it('returns the cheapest available rate', () => {
    expect(minNightlyRate(house)).toBe(11000);
    expect(minNightlyRate({ bedrooms: 1, nightly_rate: 5000, sell_options: [] })).toBe(5000);
  });
});
