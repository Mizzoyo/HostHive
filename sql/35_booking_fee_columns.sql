-- HostBooks KE - Persist booking fee/discount components
-- Run in Supabase SQL Editor

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS extra_fees DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0;
