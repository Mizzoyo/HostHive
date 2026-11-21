import { createClient } from '@/lib/supabase/server';
import { normalizeUniversalAmenities } from '@/lib/amenities';
import { NextRequest, NextResponse } from 'next/server';

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

function normalizeHouseRules(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_HOUSE_RULES };
  return { ...DEFAULT_HOUSE_RULES, ...(value as Record<string, boolean>) };
}

async function getSessionUser() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return { supabase, user: session?.user ?? null };
}

export async function GET(_request: NextRequest) {
  try {
    const { supabase, user } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: { message: 'Not authenticated.' } }, { status: 401 });
    }

    const baseSelect = 'default_house_rules, default_check_in_time, default_check_out_time, default_check_in_method, default_check_in_instructions, default_caretaker_name, default_caretaker_phone, default_cancellation_policy, default_additional_rules, default_property_location, default_property_city, default_property_county, business_area, business_address';
    let profileRes = await supabase
      .from('profiles')
      .select(`${baseSelect}, default_amenities`)
      .eq('id', user.id)
      .maybeSingle();

    if (profileRes.error) {
      profileRes = await supabase
        .from('profiles')
        .select(baseSelect)
        .eq('id', user.id)
        .maybeSingle();
    }

    const profile = profileRes.data;
    if (!profile) {
      return NextResponse.json({ error: { message: 'Profile not found.' } }, { status: 404 });
    }

    return NextResponse.json({
      houseRules: normalizeHouseRules(profile.default_house_rules),
      checkInTime: profile.default_check_in_time,
      checkOutTime: profile.default_check_out_time,
      checkInMethod: profile.default_check_in_method,
      checkInInstructions: profile.default_check_in_instructions,
      caretakerName: profile.default_caretaker_name,
      caretakerPhone: profile.default_caretaker_phone,
      cancellationPolicy: profile.default_cancellation_policy,
      additionalRules: profile.default_additional_rules,
      defaultPropertyLocation: profile.default_property_location,
      defaultPropertyCity: profile.default_property_city,
      defaultPropertyCounty: profile.default_property_county,
      businessArea: profile.business_area,
      businessAddress: profile.business_address,
      amenities: normalizeUniversalAmenities(profile.default_amenities),
    });
  } catch (err) {
    console.error('[settings/universal] Error:', err);
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: { message: 'Not authenticated.' } }, { status: 401 });
    }

    const body = await request.json();
    const houseRules = normalizeHouseRules(body.houseRules);
    const checkInTime = body.checkInTime || '14:00';
    const checkOutTime = body.checkOutTime || '11:00';
    const checkInMethod = body.checkInMethod || 'caretaker';
    const checkInInstructions = body.checkInInstructions || '';
    const caretakerName = body.caretakerName || '';
    const caretakerPhone = body.caretakerPhone || '';
    const cancellationPolicy = body.cancellationPolicy || 'moderate';
    const additionalRules = body.additionalRules || '';
    const defaultPropertyLocation = body.defaultPropertyLocation || '';
    const defaultPropertyCity = body.defaultPropertyCity || 'Nairobi';
    const defaultPropertyCounty = body.defaultPropertyCounty || 'Nairobi';
    const businessArea = body.businessArea || '';
    const businessAddress = body.businessAddress || '';
    const amenities = body.amenities === undefined ? undefined : normalizeUniversalAmenities(body.amenities);
    const updatedAt = new Date().toISOString();

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        default_house_rules: houseRules,
        default_check_in_time: checkInTime,
        default_check_out_time: checkOutTime,
        default_check_in_method: checkInMethod,
        default_check_in_instructions: checkInInstructions,
        default_caretaker_name: caretakerName,
        default_caretaker_phone: caretakerPhone,
        default_cancellation_policy: cancellationPolicy,
        default_additional_rules: additionalRules,
        default_property_location: defaultPropertyLocation,
        default_property_city: defaultPropertyCity,
        default_property_county: defaultPropertyCounty,
        business_area: businessArea,
        business_address: businessAddress,
        ...(amenities !== undefined ? { default_amenities: amenities } : {}),
      })
      .eq('id', user.id);

    if (profileError) {
      return NextResponse.json({ error: { message: profileError.message } }, { status: 400 });
    }

    const { error: propertiesError } = await supabase
      .from('properties')
      .update({
        house_rules: houseRules,
        check_in_time: checkInTime,
        check_out_time: checkOutTime,
        check_in_method: checkInMethod,
        check_in_instructions: checkInInstructions,
        caretaker_name: caretakerName,
        caretaker_phone: caretakerPhone,
        cancellation_policy: cancellationPolicy,
        additional_rules: additionalRules,
        location: defaultPropertyLocation,
        address: defaultPropertyLocation,
        city: defaultPropertyCity,
        county: defaultPropertyCounty,
        updated_at: updatedAt,
      })
      .eq('user_id', user.id);

    if (propertiesError) {
      return NextResponse.json({ error: { message: propertiesError.message } }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[settings/universal] Error:', err);
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 });
  }
}
