-- ─── Migration 37: Atomic booking-request creation with per-property advisory locks ───
-- Run in Supabase SQL Editor.
--
-- Problem: POST /api/stay/booking previously inserted without checking for
-- overlapping stays, so two guests could request the same room for the same
-- dates at the same time. Because room_details is a JSONB array, a column
-- constraint can't express the overlap rule — this function takes a
-- transaction-scoped advisory lock per requested property (in sorted order to
-- avoid deadlocks), re-checks conflicts, then inserts atomically.

CREATE OR REPLACE FUNCTION create_booking_request(
  p_guest_name       text,
  p_guest_phone      text,
  p_guest_email      text,
  p_check_in         date,
  p_check_out        date,
  p_nights           integer,
  p_num_adults       integer,
  p_num_children     integer,
  p_room_details     jsonb,
  p_total_amount     numeric,
  p_special_requests text,
  p_host_user_id     text,
  p_guest_user_id    uuid    DEFAULT NULL,
  p_discount_total   numeric DEFAULT 0,
  p_applied_discounts jsonb  DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid           uuid;
  v_conflict_name text;
  v_id            uuid;
  -- Checkout day is free: last booked night is checkout - 1
  v_last_night    date := (p_check_out - 1)::date;
BEGIN
  -- 1. Serialize per-property, in sorted order to prevent deadlocks
  FOR v_pid IN
    SELECT DISTINCT (r->>'property_id')::uuid AS pid
    FROM jsonb_array_elements(p_room_details) AS r
    ORDER BY pid
  LOOP
    PERFORM pg_advisory_xact_lock(hashtext(v_pid::text));
  END LOOP;

  -- 2. Conflict check — same overlap rule as /api/stay/properties:
  --    existing conflicts when its check_in <= my last night AND its
  --    check_out > my first night (checkout day is free).
  SELECT p.name INTO v_conflict_name
  FROM bookings b
  JOIN properties p ON p.id = b.property_id
  WHERE b.status IN ('confirmed', 'tentative', 'checked_in', 'blocked')
    AND b.check_in <= v_last_night
    AND b.check_out > p_check_in
    AND b.property_id IN (
      SELECT (r->>'property_id')::uuid
      FROM jsonb_array_elements(p_room_details) AS r
    )
  LIMIT 1;

  IF v_conflict_name IS NULL THEN
    SELECT p.name INTO v_conflict_name
    FROM booking_requests br
    CROSS JOIN LATERAL jsonb_array_elements(br.room_details) AS rr
    JOIN properties p ON p.id = (rr->>'property_id')::uuid
    WHERE br.status IN ('confirmed', 'pending')
      AND br.check_in <= v_last_night
      AND br.check_out > p_check_in
      AND (rr->>'property_id')::uuid IN (
        SELECT (r->>'property_id')::uuid
        FROM jsonb_array_elements(p_room_details) AS r
      )
    LIMIT 1;
  END IF;

  IF v_conflict_name IS NOT NULL THEN
    RETURN jsonb_build_object(
      'conflict', true,
      'error', v_conflict_name || ' was just booked for those dates. Please adjust your selection.'
    );
  END IF;

  -- 3. Insert inside the same transaction — no other request for these rooms
  --    can interleave between our check and our insert.
  INSERT INTO booking_requests (
    guest_name, guest_phone, guest_email,
    check_in, check_out, nights,
    num_adults, num_children,
    room_details, total_amount, special_requests,
    host_user_id, guest_user_id, discount_total, applied_discounts
  ) VALUES (
    p_guest_name, p_guest_phone, p_guest_email,
    p_check_in, p_check_out, p_nights,
    p_num_adults, p_num_children,
    p_room_details, p_total_amount, p_special_requests,
    p_host_user_id, p_guest_user_id, p_discount_total, p_applied_discounts
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id);
END;
$$;

-- The route runs on the service-role key when present, anon otherwise —
-- SECURITY DEFINER bypasses RLS inside the function either way.
GRANT EXECUTE ON FUNCTION create_booking_request(
  text, text, text, date, date, integer, integer, integer,
  jsonb, numeric, text, text, uuid, numeric, jsonb
) TO anon, authenticated, service_role;
