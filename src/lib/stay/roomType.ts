const TYPE_LABELS: Record<string, string> = {
  'studio': 'Studio', 'bedsitter': 'Bedsitter',
  '1br': 'One Bedroom', 'one-bedroom': 'One Bedroom', 'one bedroom': 'One Bedroom',
  '2br': 'Two Bedroom', 'two-bedroom': 'Two Bedroom', 'two bedroom': 'Two Bedroom',
  '3br': 'Three Bedroom', 'three-bedroom': 'Three Bedroom', 'three bedroom': 'Three Bedroom',
};

export function normalizeType(t: string): string {
  const key = (t || '').toLowerCase();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) return '';
  return TYPE_LABELS[key] || (t ? t.charAt(0).toUpperCase() + t.slice(1) : '');
}

export function roomTypeLabel(p: { type?: string | null; bedrooms?: number | null }): string {
  const t = normalizeType(p.type || '');
  if (t) return t;
  const beds = p.bedrooms ?? 1;
  return beds === 0 ? 'Studio' : beds === 1 ? '1 Bedroom' : `${beds} Bedrooms`;
}
