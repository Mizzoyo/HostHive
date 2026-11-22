type SortableProperty = {
  id?: string;
  name?: string | null;
  unit_number?: string | null;
  created_at?: string | null;
};

type SortKey = { tier: 0 | 1 | 2; prefix: string; num: number };

const R_ROOM = /\b(?:R|room)\s*[-#]?\s*(\d{1,4})\b/i;
const UNIT_CODE = /\b([A-Za-z]{1,3})\s*-?\s*(\d{1,4})\b/;

function sortKey(p: SortableProperty): SortKey {
  const name = (p.name ?? '').trim();
  const r = name.match(R_ROOM);
  if (r) return { tier: 0, prefix: 'R', num: parseInt(r[1], 10) };
  const code = name.match(UNIT_CODE);
  if (code) return { tier: 1, prefix: code[1].toUpperCase(), num: parseInt(code[2], 10) };
  return { tier: 2, prefix: '', num: 0 };
}

export function compareProperties(a: SortableProperty, b: SortableProperty): number {
  const ak = sortKey(a);
  const bk = sortKey(b);

  if (ak.tier !== bk.tier) return ak.tier - bk.tier;
  if (ak.prefix !== bk.prefix) return ak.prefix.localeCompare(bk.prefix);
  if (ak.num !== bk.num) return ak.num - bk.num;

  const nameCompare = (a.name ?? '').localeCompare(b.name ?? '', undefined, { numeric: true, sensitivity: 'base' });
  if (nameCompare !== 0) return nameCompare;

  const createdCompare = (a.created_at ?? '').localeCompare(b.created_at ?? '');
  if (createdCompare !== 0) return createdCompare;

  return (a.id ?? '').localeCompare(b.id ?? '');
}

export function sortProperties<T extends SortableProperty>(items: T[]): T[] {
  return [...items].sort(compareProperties);
}
