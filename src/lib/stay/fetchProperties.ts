import { cache } from 'react';
import { publicSupabase } from '@/lib/supabase/public';
import { mergeAmenityLabels, normalizeUniversalAmenities, type Amenity } from '@/lib/amenities';
import { sortProperties } from '@/lib/propertySort';

const DEFAULT_HOUSE_RULES = {
  noSmoking: true,
  noParties: true,
  noPets: true,
  quietHours: true,
  childrenAllowed: false,
  couplesOnly: false,
  noAlcohol: false,
  adultsOnly: false,
  removeShoes: false,
  sortRubbish: false,
};

export type StayProperty = {
  id: string;
  name: string;
  type: string;
  description: string;
  location: string;
  address: string;
  city: string;
  county: string;
  bedrooms: number;
  bathrooms: number;
  max_guests: number;
  nightly_rate: number;
  weekend_rate: number;
  breakfast_rate: number;
  cover_photo: string;
  status: string;
  latitude: number;
  longitude: number;
  check_in_time: string;
  check_out_time: string;
  cancellation_policy: string;
  house_rules: Record<string, boolean> | null;
  slug: string | null;
  sell_options?: unknown;
  photos: string[];
  amenities: string[];
};

export type UniversalStaySettings = {
  businessName: string;
  houseRules: Record<string, boolean>;
  checkInTime: string;
  checkOutTime: string;
  checkInMethod: string;
  checkInInstructions: string;
  caretakerName: string;
  caretakerPhone: string;
  cancellationPolicy: string;
  additionalRules: string;
  defaultPropertyLocation: string;
  defaultPropertyCity: string;
  defaultPropertyCounty: string;
  businessArea: string;
  businessAddress: string;
  mapQuery: string;
  amenities: Amenity[];
};

function addDays(d: string, n: number): string {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().split('T')[0];
}

function normalizeHouseRules(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_HOUSE_RULES };
  return { ...DEFAULT_HOUSE_RULES, ...(value as Record<string, boolean>) };
}

function buildMapQuery({
  businessAddress,
  businessArea,
  defaultPropertyLocation,
  defaultPropertyCity,
  defaultPropertyCounty,
}: Pick<UniversalStaySettings, 'businessAddress' | 'businessArea' | 'defaultPropertyLocation' | 'defaultPropertyCity' | 'defaultPropertyCounty'>) {
  return [businessAddress, businessArea, defaultPropertyLocation, defaultPropertyCity, defaultPropertyCounty]
    .filter(Boolean)
    .join(', ') || 'Kenya';
}

export const fetchUniversalStaySettings = cache(async function fetchUniversalStaySettings(): Promise<UniversalStaySettings> {
  const defaults: UniversalStaySettings = {
    businessName: 'Kogelo Suites',
    houseRules: { ...DEFAULT_HOUSE_RULES },
    checkInTime: '14:00',
    checkOutTime: '11:00',
    checkInMethod: 'caretaker',
    checkInInstructions: '',
    caretakerName: '',
    caretakerPhone: '',
    cancellationPolicy: 'moderate',
    additionalRules: '',
    defaultPropertyLocation: '',
    defaultPropertyCity: 'Nairobi',
    defaultPropertyCounty: 'Nairobi',
    businessArea: '',
    businessAddress: '',
    mapQuery: 'Kenya',
    amenities: [],
  };

  const hostId = process.env.STAY_HOST_USER_ID;
  if (!hostId) return defaults;

  const baseSelect = 'business_name, default_house_rules, default_check_in_time, default_check_out_time, default_check_in_method, default_check_in_instructions, default_caretaker_name, default_caretaker_phone, default_cancellation_policy, default_additional_rules, default_property_location, default_property_city, default_property_county, business_area, business_address';
  let profileRes = await publicSupabase
    .from('profiles')
    .select(`${baseSelect}, default_amenities`)
    .eq('id', hostId)
    .maybeSingle();

  if (profileRes.error) {
    profileRes = await publicSupabase
      .from('profiles')
      .select(baseSelect)
      .eq('id', hostId)
      .maybeSingle();
  }

  const data = profileRes.data;
  if (!data) {
    console.error('[stay] universal settings fallback:', profileRes.error ?? 'profile not found');
    return defaults;
  }

  const settings: UniversalStaySettings = {
    businessName: data.business_name ?? defaults.businessName,
    houseRules: normalizeHouseRules(data.default_house_rules),
    checkInTime: data.default_check_in_time ?? defaults.checkInTime,
    checkOutTime: data.default_check_out_time ?? defaults.checkOutTime,
    checkInMethod: data.default_check_in_method ?? defaults.checkInMethod,
    checkInInstructions: data.default_check_in_instructions ?? defaults.checkInInstructions,
    caretakerName: data.default_caretaker_name ?? defaults.caretakerName,
    caretakerPhone: data.default_caretaker_phone ?? defaults.caretakerPhone,
    cancellationPolicy: data.default_cancellation_policy ?? defaults.cancellationPolicy,
    additionalRules: data.default_additional_rules ?? defaults.additionalRules,
    defaultPropertyLocation: data.default_property_location ?? defaults.defaultPropertyLocation,
    defaultPropertyCity: data.default_property_city ?? defaults.defaultPropertyCity,
    defaultPropertyCounty: data.default_property_county ?? defaults.defaultPropertyCounty,
    businessArea: data.business_area ?? defaults.businessArea,
    businessAddress: data.business_address ?? defaults.businessAddress,
    mapQuery: 'Kenya',
    amenities: normalizeUniversalAmenities(data.default_amenities),
  };

  settings.mapQuery = buildMapQuery(settings);
  return settings;
});

export async function fetchAvailableProperties(
  checkIn?: string,
  checkOut?: string
): Promise<StayProperty[]> {
  const hostId = process.env.STAY_HOST_USER_ID;
  const universalSettings = await fetchUniversalStaySettings();

  const baseCols = 'id, name, type, description, location, address, city, county, bedrooms, bathrooms, max_guests, nightly_rate, weekend_rate, breakfast_rate, cover_photo, status, latitude, longitude, check_in_time, check_out_time, cancellation_policy, house_rules, slug';
  const runQuery = (cols: string) => {
    let q = publicSupabase.from('properties').select(cols).eq('status', 'active').order('name');
    if (hostId) q = (q as any).eq('user_id', hostId);
    return q;
  };

  // Retry without sell_options if migration 36 hasn't been run yet
  let { data: properties, error } = await runQuery(`${baseCols}, sell_options`);
  if (error) ({ data: properties, error } = await runQuery(baseCols));
  if (error || !properties) return [];

  const today = new Date().toISOString().split('T')[0];
  const rangeStart = checkIn || today;
  const rangeEnd = checkOut || addDays(today, 1);
  const lastNight = addDays(rangeEnd, -1);
  const blockedIds = new Set<string>();

  try {
    let bq = publicSupabase
      .from('bookings')
      .select('property_id')
      .in('status', ['confirmed', 'tentative', 'checked_in', 'blocked'])
      .lte('check_in', lastNight)
      .gte('check_out', addDays(rangeStart, 1));
    if (hostId) bq = (bq as any).eq('user_id', hostId);
    const { data: bRows } = await bq;
    (bRows ?? []).forEach((b: any) => { if (b.property_id) blockedIds.add(b.property_id); });
  } catch { }

  try {
    let rq = publicSupabase
      .from('booking_requests')
      .select('room_details')
      .in('status', ['confirmed', 'pending'])
      .lte('check_in', lastNight)
      .gte('check_out', addDays(rangeStart, 1));
    if (hostId) rq = (rq as any).eq('host_user_id', hostId);
    const { data: rRows } = await rq;
    (rRows ?? []).forEach((r: any) => {
      const rooms = Array.isArray(r.room_details) ? r.room_details : [];
      rooms.forEach((room: any) => { if (room.property_id) blockedIds.add(room.property_id); });
    });
  } catch { }

  const available = sortProperties((properties as any[]).filter((p) => !blockedIds.has(p.id)));
  const ids = available.map((p) => p.id);

  const photosById = new Map<string, string[]>();
  const amenityNamesById = new Map<string, string[]>();

  if (ids.length) {
    const [photosRes, amenitiesRes] = await Promise.all([
      publicSupabase
        .from('property_photos')
        .select('property_id, url, sort_order')
        .in('property_id', ids)
        .order('sort_order'),
      publicSupabase
        .from('property_amenities')
        .select('property_id, name')
        .in('property_id', ids),
    ]);

    (photosRes.data ?? []).forEach((ph) => {
      const list = photosById.get(ph.property_id) ?? [];
      if (list.length < 5) list.push(ph.url);
      photosById.set(ph.property_id, list);
    });
    (amenitiesRes.data ?? []).forEach((a) => {
      const list = amenityNamesById.get(a.property_id) ?? [];
      list.push(a.name);
      amenityNamesById.set(a.property_id, list);
    });
  }

  return available.map((p) => ({
    ...p,
    photos: photosById.get(p.id) ?? (p.cover_photo ? [p.cover_photo] : []),
    amenities: mergeAmenityLabels(universalSettings.amenities, amenityNamesById.get(p.id) ?? []),
  })) as StayProperty[];
}
