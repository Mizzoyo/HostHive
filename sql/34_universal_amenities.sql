-- HostBooks KE - Add universal building amenities to profiles
-- Run in Supabase SQL Editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS default_amenities JSONB DEFAULT '[]';
