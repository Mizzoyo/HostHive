export type Amenity = {
  id: string;
  label: string;
  category?: string;
};

export const AMENITY_CATALOG: Amenity[] = [
  // Internet & Entertainment
  { id: 'wifi', label: 'Wi-Fi', category: 'Internet & Entertainment' },
  { id: 'dstv', label: 'DSTV', category: 'Internet & Entertainment' },
  { id: 'netflix', label: 'Netflix', category: 'Internet & Entertainment' },
  { id: 'smarttv', label: 'Smart TV', category: 'Internet & Entertainment' },
  { id: 'speaker', label: 'Bluetooth Speaker', category: 'Internet & Entertainment' },
  { id: 'workspace', label: 'Workspace', category: 'Internet & Entertainment' },

  // Kitchen
  { id: 'kitchen', label: 'Full Kitchen', category: 'Kitchen' },
  { id: 'coffee', label: 'Coffee Maker', category: 'Kitchen' },
  { id: 'fridge', label: 'Refrigerator', category: 'Kitchen' },
  { id: 'microwave', label: 'Microwave', category: 'Kitchen' },
  { id: 'cooker', label: 'Cooking Gas + Cooker', category: 'Kitchen' },
  { id: 'utensils', label: 'Dishes & Utensils', category: 'Kitchen' },

  // Climate & Comfort
  { id: 'ac', label: 'Air Conditioning', category: 'Climate & Comfort' },
  { id: 'fan', label: 'Ceiling Fan', category: 'Climate & Comfort' },
  { id: 'balcony', label: 'Balcony', category: 'Climate & Comfort' },

  // Safety & Security
  { id: 'smartlock', label: 'Smart Lock', category: 'Safety & Security' },
  { id: 'cctv', label: 'CCTV', category: 'Safety & Security' },
  { id: 'guard', label: '24hr Guard', category: 'Safety & Security' },
  { id: 'security', label: '24/7 Security', category: 'Safety & Security' },
  { id: 'smoke', label: 'Smoke Alarm', category: 'Safety & Security' },
  { id: 'fire', label: 'Fire Extinguisher', category: 'Safety & Security' },
  { id: 'firstaid', label: 'First Aid', category: 'Safety & Security' },
  { id: 'safebox', label: 'Safe Box', category: 'Safety & Security' },

  // Utilities
  { id: 'generator', label: 'Generator', category: 'Utilities' },
  { id: 'water', label: 'Borehole Water', category: 'Utilities' },
  { id: 'solar', label: 'Solar Power', category: 'Utilities' },

  // Parking & Access
  { id: 'parking', label: 'Free Parking', category: 'Parking & Access' },
  { id: 'elevator', label: 'Elevator', category: 'Parking & Access' },
  { id: 'gated', label: 'Gated Entry', category: 'Parking & Access' },

  // Laundry & Bathroom
  { id: 'washer', label: 'Washing Machine', category: 'Laundry & Bathroom' },
  { id: 'dryer', label: 'Dryer', category: 'Laundry & Bathroom' },
  { id: 'hotshower', label: 'Hot Shower', category: 'Laundry & Bathroom' },
  { id: 'bathtub', label: 'Bathtub', category: 'Laundry & Bathroom' },
  { id: 'hottub', label: 'Hot Tub', category: 'Laundry & Bathroom' },
  { id: 'hairdryer', label: 'Hair Dryer', category: 'Laundry & Bathroom' },
  { id: 'toiletries', label: 'Toiletries Provided', category: 'Laundry & Bathroom' },
  { id: 'iron', label: 'Iron & Board', category: 'Laundry & Bathroom' },

  // Building Facilities & Other
  { id: 'pool', label: 'Pool', category: 'Building Facilities' },
  { id: 'gym', label: 'Gym', category: 'Building Facilities' },
  { id: 'garden', label: 'Garden', category: 'Building Facilities' },
  { id: 'poolside', label: 'Pool Side', category: 'Building Facilities' },
  { id: 'next-to-garden', label: 'Next to Garden', category: 'Building Facilities' },
  { id: 'bbq', label: 'BBQ Grill', category: 'Building Facilities' },
  { id: 'child', label: 'Child-Safe Building', category: 'Building Facilities' },
  { id: 'breakfast', label: 'Breakfast', category: 'Dining' },
  { id: 'pets', label: 'Pet Friendly', category: 'Other' },
  { id: 'babycot', label: 'Baby Cot', category: 'Other' },
  { id: 'ev', label: 'EV Charging', category: 'Other' },
  { id: 'concierge', label: 'Concierge', category: 'Other' },
];

const BY_ID = new Map(AMENITY_CATALOG.map(a => [a.id, a]));
const BY_LABEL = new Map(AMENITY_CATALOG.map(a => [a.label.toLowerCase(), a]));

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'amenity';
}

export function amenityLabel(value: string): string {
  const v = (value ?? '').trim();
  if (!v) return v;
  const hit = BY_ID.get(v) ?? BY_ID.get(v.toLowerCase()) ?? BY_LABEL.get(v.toLowerCase());
  return hit?.label ?? v;
}

export function normalizeUniversalAmenities(input: unknown): Amenity[] {
  if (!Array.isArray(input)) return [];
  const out: Amenity[] = [];
  const seen = new Set<string>();

  for (const item of input) {
    let amenity: Amenity | null = null;
    if (typeof item === 'string') {
      const v = item.trim();
      if (!v) continue;
      const hit = BY_ID.get(v) ?? BY_ID.get(v.toLowerCase()) ?? BY_LABEL.get(v.toLowerCase());
      amenity = hit
        ? { id: hit.id, label: hit.label, category: hit.category }
        : { id: `custom-${slugify(v)}`, label: v, category: 'Custom' };
    } else if (item && typeof item === 'object') {
      const raw = item as Record<string, unknown>;
      const idRaw = String(raw.id ?? '').trim();
      const labelRaw = String(raw.label ?? raw.name ?? '').trim();
      const label = labelRaw || (idRaw ? amenityLabel(idRaw) : '');
      if (!label) continue;
      const hit = (idRaw && (BY_ID.get(idRaw) ?? BY_ID.get(idRaw.toLowerCase()))) || BY_LABEL.get(label.toLowerCase());
      const category = raw.category ? String(raw.category) : hit?.category ?? (hit ? undefined : 'Custom');
      amenity = {
        id: hit?.id ?? (idRaw || `custom-${slugify(label)}`),
        label: hit?.label ?? label,
        category,
      };
    }
    if (!amenity) continue;
    const key = amenity.id || amenity.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(amenity);
  }

  return out;
}

export function universalAmenityKeys(amenities: Amenity[] | string[] | unknown): Set<string> {
  const normalized = Array.isArray(amenities) && amenities.every(a => typeof a === 'string')
    ? normalizeUniversalAmenities((amenities as string[]).map(s => ({ id: s, label: amenityLabel(s) })))
    : normalizeUniversalAmenities(amenities);

  const keys = new Set<string>();
  for (const a of normalized) {
    keys.add(a.id.toLowerCase());
    keys.add(a.label.toLowerCase());
  }
  return keys;
}

export function isUniversalAmenity(value: string, universal: Amenity[] | string[] | unknown): boolean {
  const keys = universalAmenityKeys(universal);
  const v = (value ?? '').trim();
  if (!v) return false;
  const label = amenityLabel(v);
  return keys.has(v.toLowerCase()) || keys.has(label.toLowerCase());
}

export function mergeAmenityLabels(universal: Amenity[] | string[] | unknown, roomExtras: string[] | unknown): string[] {
  const universalLabels = normalizeUniversalAmenities(universal).map(a => a.label);
  const roomLabels = (Array.isArray(roomExtras) ? roomExtras : [])
    .map(a => amenityLabel(String(a ?? '')))
    .filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const label of [...universalLabels, ...roomLabels]) {
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}
