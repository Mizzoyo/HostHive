export type SellOption = { bedrooms: number; nightly_rate: number; max_guests: number };
export type ResolvedSellOption = SellOption & { isFull: boolean; label: string };

type PropertyLike = {
  bedrooms?: number | null;
  nightly_rate?: number | string | null;
  max_guests?: number | null;
  sell_options?: unknown;
};

export function sellOptionLabel(bedrooms: number): string {
  return `${bedrooms} Bedroom`;
}

/** Keep only valid smaller-bedroom options: 1 <= bedrooms < total, rate > 0, unique, largest first. */
export function normalizeSellOptions(raw: unknown, totalBedrooms: number): SellOption[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const out: SellOption[] = [];
  for (const o of raw) {
    const bedrooms = Math.round(Number(o?.bedrooms));
    const nightly_rate = Number(o?.nightly_rate);
    const max_guests = Math.max(1, Math.round(Number(o?.max_guests) || 1));
    if (!Number.isFinite(bedrooms) || bedrooms < 1 || bedrooms >= totalBedrooms) continue;
    if (!Number.isFinite(nightly_rate) || nightly_rate <= 0 || seen.has(bedrooms)) continue;
    seen.add(bedrooms);
    out.push({ bedrooms, nightly_rate, max_guests });
  }
  return out.sort((a, b) => b.bedrooms - a.bedrooms);
}

/** Full house first, then smaller options. */
export function getSellOptions(p: PropertyLike): ResolvedSellOption[] {
  const total = Number(p.bedrooms ?? 1) || 1;
  const full: ResolvedSellOption = {
    bedrooms: total,
    nightly_rate: Number(p.nightly_rate ?? 0),
    max_guests: Number(p.max_guests ?? 2),
    isFull: true,
    label: sellOptionLabel(total),
  };
  return [full, ...normalizeSellOptions(p.sell_options, total).map(o => ({ ...o, isFull: false, label: sellOptionLabel(o.bedrooms) }))];
}

/** Resolve an option by bedroom count; falls back to the full house. */
export function findSellOption(p: PropertyLike, bedrooms?: number | string | null): ResolvedSellOption {
  const opts = getSellOptions(p);
  const n = bedrooms === null || bedrooms === undefined || bedrooms === '' ? NaN : Number(bedrooms);
  return opts.find(o => o.bedrooms === n) ?? opts[0];
}

export function minNightlyRate(p: PropertyLike): number {
  const rates = getSellOptions(p).map(o => o.nightly_rate).filter(r => r > 0);
  return rates.length ? Math.min(...rates) : 0;
}
