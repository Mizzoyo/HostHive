import { createClient } from '@/lib/supabase/server';
import { isUniversalAmenity, normalizeUniversalAmenities } from '@/lib/amenities';
import { normalizeSellOptions } from '@/lib/sellOptions';
import { NextRequest, NextResponse } from 'next/server';

function missingEnv() {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

const DEFAULT_UNIVERSAL_RULES = {
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

type WizardSellOptionInput = { bedrooms?: number; nightly?: string; maxGuests?: string };

type Supabase = Awaited<ReturnType<typeof createClient>>;

type UniversalProfile = {
  default_house_rules?: unknown;
  default_amenities?: unknown;
  default_property_location?: string | null;
  default_property_city?: string | null;
  default_property_county?: string | null;
  default_check_in_time?: string | null;
  default_check_out_time?: string | null;
  default_check_in_method?: string | null;
  default_check_in_instructions?: string | null;
  default_caretaker_name?: string | null;
  default_caretaker_phone?: string | null;
  default_cancellation_policy?: string | null;
  default_additional_rules?: string | null;
} | null;

function toSellOptions(d: { basics?: { bedrooms?: number }; pricing?: { sellOptions?: unknown } }) {
  const bedrooms = Number(d.basics?.bedrooms ?? 1);
  const raw: WizardSellOptionInput[] = Array.isArray(d.pricing?.sellOptions) ? d.pricing.sellOptions : [];
  return normalizeSellOptions(
    raw.map(o => ({ bedrooms: o.bedrooms, nightly_rate: parseFloat(o.nightly ?? ''), max_guests: parseInt(o.maxGuests ?? '') })),
    bedrooms,
  );
}

async function fetchUniversalProfile(supabase: Supabase, userId: string) {
  const baseSelect = 'default_house_rules, default_check_in_time, default_check_out_time, default_check_in_method, default_check_in_instructions, default_caretaker_name, default_caretaker_phone, default_cancellation_policy, default_additional_rules, default_property_location, default_property_city, default_property_county';
  let profileRes = await supabase
    .from('profiles')
    .select(`${baseSelect}, default_amenities`)
    .eq('id', userId)
    .maybeSingle();

  if (profileRes.error) {
    profileRes = await supabase
      .from('profiles')
      .select(baseSelect)
      .eq('id', userId)
      .maybeSingle();
  }
  return profileRes.data;
}

function getUniversalHouseRules(profile: UniversalProfile) {
  if (!profile?.default_house_rules || typeof profile.default_house_rules !== 'object' || Array.isArray(profile.default_house_rules)) {
    return { ...DEFAULT_UNIVERSAL_RULES };
  }
  return { ...DEFAULT_UNIVERSAL_RULES, ...(profile.default_house_rules as Record<string, boolean>) };
}

export async function GET(request: NextRequest) {
  try {
    if (missingEnv()) {
      return NextResponse.json({ error: { message: 'Supabase environment variables are not configured.' } }, { status: 500 });
    }
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: { message: 'Not authenticated.' } }, { status: 401 });
    }
    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: { message: 'Property ID required.' } }, { status: 400 });
    }
    const [propRes, amenRes, photoRes, profile] = await Promise.all([
      supabase.from('properties').select('*').eq('id', id).eq('user_id', session.user.id).single(),
      supabase.from('property_amenities').select('name').eq('property_id', id).order('created_at'),
      supabase.from('property_photos').select('url, sort_order').eq('property_id', id).order('sort_order'),
      fetchUniversalProfile(supabase, session.user.id),
    ]);
    if (propRes.error || !propRes.data) {
      return NextResponse.json({ error: { message: propRes.error?.message || 'Property not found.' } }, { status: 404 });
    }
    const p = propRes.data;
    const photos =
      photoRes.data && photoRes.data.length > 0
        ? photoRes.data.map((ph) => ({ url: ph.url, label: '', isCover: ph.url === p.cover_photo }))
        : p.cover_photo
        ? [{ url: p.cover_photo, label: '', isCover: true }]
        : [];
    const universalAmenities = normalizeUniversalAmenities(profile?.default_amenities);
    const roomAmenities = (amenRes.data?.map((a) => a.name) ?? [])
      .filter((name: string) => !isUniversalAmenity(name, universalAmenities));

    return NextResponse.json({
      property: p,
      amenities: roomAmenities,
      universalAmenities,
      photos,
    });
  } catch (err) {
    console.error('[wizard/GET] Unexpected error:', err);
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (missingEnv()) {
      return NextResponse.json({ error: { message: 'Supabase environment variables are not configured.' } }, { status: 500 });
    }

    const supabase = await createClient();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: { message: 'Not authenticated. Please log in and try again.' } }, { status: 401 });
    }
    const userId = session.user.id;

    const d = await request.json();

    const profile = await fetchUniversalProfile(supabase, userId);
    const universalRules = getUniversalHouseRules(profile);
    const universalAmenities = normalizeUniversalAmenities(profile?.default_amenities);
    const roomAmenities = (Array.isArray(d.amenities) ? d.amenities : [])
      .filter((a) => !isUniversalAmenity(typeof a === 'string' ? a : a?.name, universalAmenities));
    const syncedLocation = profile?.default_property_location || d.location?.neighbourhood || d.location?.address || 'Milimani';
    const syncedCity = profile?.default_property_city || d.location?.city || 'Kisumu';
    const syncedCounty = profile?.default_property_county || d.location?.county || 'Kisumu County';

    const insertRow: Record<string, unknown> = {
      user_id: userId,
      name: d.title || 'Untitled Property',
      title: d.title || 'Untitled Property',
      type: d.propertyType || 'apartment',
      description: d.description || '',
      location: syncedLocation,
      address: syncedLocation,
      city: syncedCity,
      county: syncedCounty,
      country: 'Kenya',
      building_name: d.location?.building || '',
      unit_number: d.location?.unit || '',
      floor_level: d.location?.floor || '',
      bedrooms: d.basics?.bedrooms ?? 1,
      bathrooms: d.basics?.bathrooms ?? 1,
      max_guests: d.basics?.maxGuests ?? 2,
      nightly_rate: parseFloat(d.pricing?.nightly) || 0,
      sell_options: toSellOptions(d),
      weekend_rate: parseFloat(d.pricing?.weekend) || 0,
      monthly_rate: parseFloat(d.pricing?.monthly) || 0,
      cleaning_fee: parseFloat(d.pricing?.cleaning) || 0,
      security_deposit: parseFloat(d.pricing?.deposit) || 0,
      min_stay_nights: parseInt(d.pricing?.minStay) || 1,
      max_stay_nights: parseInt(d.pricing?.maxStay) || 0,
      cover_photo: d.photos?.find((p) => p.isCover)?.url || d.photos?.[0]?.url || '',
      latitude: d.location?.lat || null,
      longitude: d.location?.lng || null,
      check_in_time: profile?.default_check_in_time || '14:00',
      check_out_time: profile?.default_check_out_time || '11:00',
      check_in_method: profile?.default_check_in_method || 'caretaker',
      check_in_instructions: profile?.default_check_in_instructions || '',
      caretaker_name: profile?.default_caretaker_name || '',
      caretaker_phone: profile?.default_caretaker_phone || '',
      cancellation_policy: profile?.default_cancellation_policy || 'moderate',
      house_rules: universalRules,
      additional_rules: profile?.default_additional_rules || '',
      status: d.status || 'active',
    };
    if (d.setup_step != null) insertRow.setup_step = d.setup_step;

    const { data: property, error } = await supabase
      .from('properties')
      .insert(insertRow)
      .select()
      .single();

    if (error) {
      console.error('[wizard/POST] Supabase error:', error);
      return NextResponse.json({ error: { message: error.message } }, { status: 500 });
    }

    const propertyId = property.id;

    if (roomAmenities.length > 0) {
      const amenityRows = roomAmenities.map((a) => ({
        property_id: propertyId,
        user_id: userId,
        name: typeof a === 'string' ? a : a.name,
        icon: typeof a === 'object' ? a.icon || null : null,
        category: typeof a === 'object' ? a.category || null : null,
      }));
      await supabase.from('property_amenities').insert(amenityRows);
    }

    if (Array.isArray(d.photos) && d.photos.length > 0) {
      const photoRows = d.photos.map((p, i: number) => ({
        property_id: propertyId,
        user_id: userId,
        url: p.url,
        thumbnail_url: p.thumbnail_url || null,
        sort_order: i,
      }));
      await supabase.from('property_photos').insert(photoRows);
    }

    return NextResponse.json({ property }, { status: 201 });
  } catch (err) {
    console.error('[wizard/POST] Unexpected error:', err);
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (missingEnv()) {
      return NextResponse.json({ error: { message: 'Supabase environment variables are not configured.' } }, { status: 500 });
    }

    const supabase = await createClient();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: { message: 'Not authenticated. Please log in and try again.' } }, { status: 401 });
    }
    const userId = session.user.id;

    const { id, ...d } = await request.json();
    if (!id) {
      return NextResponse.json({ error: { message: 'Property id is required for updates' } }, { status: 400 });
    }

    const profile = await fetchUniversalProfile(supabase, userId);
    const universalRules = getUniversalHouseRules(profile);
    const universalAmenities = normalizeUniversalAmenities(profile?.default_amenities);
    const roomAmenities = (Array.isArray(d.amenities) ? d.amenities : [])
      .filter((a) => !isUniversalAmenity(typeof a === 'string' ? a : a?.name, universalAmenities));
    const syncedLocation = profile?.default_property_location || d.location?.neighbourhood || d.location?.address || 'Milimani';
    const syncedCity = profile?.default_property_city || d.location?.city || 'Kisumu';
    const syncedCounty = profile?.default_property_county || d.location?.county || 'Kisumu County';

    const { data: property, error } = await supabase
      .from('properties')
      .update({
        name: d.title || 'Untitled Property',
        title: d.title || 'Untitled Property',
        type: d.propertyType || 'apartment',
        description: d.description || '',
        location: syncedLocation,
        address: syncedLocation,
        city: syncedCity,
        county: syncedCounty,
        building_name: d.location?.building || '',
        unit_number: d.location?.unit || '',
        floor_level: d.location?.floor || '',
        bedrooms: d.basics?.bedrooms ?? 1,
        bathrooms: d.basics?.bathrooms ?? 1,
        max_guests: d.basics?.maxGuests ?? 2,
        nightly_rate: parseFloat(d.pricing?.nightly) || 0,
        sell_options: toSellOptions(d),
        weekend_rate: parseFloat(d.pricing?.weekend) || 0,
        monthly_rate: parseFloat(d.pricing?.monthly) || 0,
        cleaning_fee: parseFloat(d.pricing?.cleaning) || 0,
        security_deposit: parseFloat(d.pricing?.deposit) || 0,
        min_stay_nights: parseInt(d.pricing?.minStay) || 1,
        max_stay_nights: parseInt(d.pricing?.maxStay) || 0,
        cover_photo: d.photos?.find((p) => p.isCover)?.url || d.photos?.[0]?.url || '',
        latitude: d.location?.lat || null,
        longitude: d.location?.lng || null,
        check_in_time: profile?.default_check_in_time || '14:00',
        check_out_time: profile?.default_check_out_time || '11:00',
        check_in_method: profile?.default_check_in_method || 'caretaker',
        check_in_instructions: profile?.default_check_in_instructions || '',
        caretaker_name: profile?.default_caretaker_name || '',
        caretaker_phone: profile?.default_caretaker_phone || '',
        cancellation_policy: profile?.default_cancellation_policy || 'moderate',
        house_rules: universalRules,
        additional_rules: profile?.default_additional_rules || '',
        ...(d.status && { status: d.status }),
        ...(d.setup_step != null && { setup_step: d.setup_step }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[wizard/PUT] Supabase error:', error);
      return NextResponse.json({ error: { message: error.message } }, { status: 500 });
    }

    if (Array.isArray(d.amenities)) {
      await supabase.from('property_amenities').delete().eq('property_id', id).eq('user_id', userId);
      if (roomAmenities.length > 0) {
        const amenityRows = roomAmenities.map((a) => ({
          property_id: id,
          user_id: userId,
          name: typeof a === 'string' ? a : a.name,
          icon: typeof a === 'object' ? a.icon || null : null,
          category: typeof a === 'object' ? a.category || null : null,
        }));
        await supabase.from('property_amenities').insert(amenityRows);
      }
    }

    if (Array.isArray(d.photos)) {
      await supabase.from('property_photos').delete().eq('property_id', id).eq('user_id', userId);
      if (d.photos.length > 0) {
        const photoRows = d.photos.map((p, i: number) => ({
          property_id: id,
          user_id: userId,
          url: p.url,
          thumbnail_url: p.thumbnail_url || null,
          sort_order: i,
        }));
        await supabase.from('property_photos').insert(photoRows);
      }
    }

    return NextResponse.json({ property }, { status: 200 });
  } catch (err) {
    console.error('[wizard/PUT] Unexpected error:', err);
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 });
  }
}
