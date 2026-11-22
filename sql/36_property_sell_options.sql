-- HostBooks KE - Sell a house as fewer bedrooms (e.g. 3BR also sold as 2BR)
-- Run in Supabase SQL Editor
-- sell_options: [{ "bedrooms": 2, "nightly_rate": 9000, "max_guests": 4 }]
-- The full-house option is implied by properties.bedrooms / nightly_rate / max_guests.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS sell_options JSONB NOT NULL DEFAULT '[]'::jsonb;

-- NULL = sold as the full house
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS sold_as_bedrooms INTEGER;
