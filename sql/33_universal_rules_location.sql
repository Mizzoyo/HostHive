-- HostBooks KE - Add universal house rules and location settings to profiles
-- Run in Supabase SQL Editor

-- Add universal house rules and check-in columns
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS default_house_rules JSONB DEFAULT '{"noSmoking": true, "noParties": true, "noPets": true, "quietHours": true, "childrenAllowed": false, "couplesOnly": false, "noAlcohol": false, "adultsOnly": false, "removeShoes": false, "sortRubbish": false}',
  ADD COLUMN IF NOT EXISTS default_check_in_time TEXT DEFAULT '14:00',
  ADD COLUMN IF NOT EXISTS default_check_out_time TEXT DEFAULT '11:00',
  ADD COLUMN IF NOT EXISTS default_check_in_method TEXT DEFAULT 'caretaker',
  ADD COLUMN IF NOT EXISTS default_check_in_instructions TEXT,
  ADD COLUMN IF NOT EXISTS default_caretaker_name TEXT,
  ADD COLUMN IF NOT EXISTS default_caretaker_phone TEXT,
  ADD COLUMN IF NOT EXISTS default_cancellation_policy TEXT DEFAULT 'moderate',
  ADD COLUMN IF NOT EXISTS default_additional_rules TEXT;

-- Add universal location columns
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS default_property_location TEXT,
  ADD COLUMN IF NOT EXISTS default_property_city TEXT DEFAULT 'Nairobi',
  ADD COLUMN IF NOT EXISTS default_property_county TEXT DEFAULT 'Nairobi',
  ADD COLUMN IF NOT EXISTS business_area TEXT,
  ADD COLUMN IF NOT EXISTS business_address TEXT;

NOTIFY pgrst, 'reload schema';
