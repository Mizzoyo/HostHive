type SortableProperty = {
  id?: string;
  name?: string | null;
  unit_number?: string | null;
  created_at?: string | null;
};

function extractRoomNumber(value?: string | null): number | null {
  const s = (value ?? '').trim();
  if (!s) return null;

  const patterns = [
    /\bR\s*#?\s*(\d{1,4})\b/i,
    /\broom\s*#?\s*(\d{1,4})\b/i,
    /\bunit\s*#?\s*(\d{1,4})\b/i,
    /^\s*#?\s*(\d{1,4})\b/i,
  ];

  for (const pattern of patterns) {
    const match = s.match(pattern);
    if (match) {
      const n = parseInt(match[1], 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

function roomNumber(p: SortableProperty): number | null {
  return extractRoomNumber(p.name) ?? extractRoomNumber(p.unit_number);
}

export function compareProperties(a: SortableProperty, b: SortableProperty): number {
  const an = roomNumber(a);
  const bn = roomNumber(b);

  if (an !== null && bn !== null && an !== bn) return an - bn;
  if (an !== null && bn === null) return -1;
  if (an === null && bn !== null) return 1;

  const nameCompare = (a.name ?? '').localeCompare(b.name ?? '', undefined, { numeric: true, sensitivity: 'base' });
  if (nameCompare !== 0) return nameCompare;

  const createdCompare = (a.created_at ?? '').localeCompare(b.created_at ?? '');
  if (createdCompare !== 0) return createdCompare;

  return (a.id ?? '').localeCompare(b.id ?? '');
}

export function sortProperties<T extends SortableProperty>(items: T[]): T[] {
  return [...items].sort(compareProperties);
}
