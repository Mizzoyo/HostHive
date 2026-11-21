ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(10,2);
