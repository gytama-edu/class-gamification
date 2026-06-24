BEGIN;

-- Add a computed column to check if a student has a PIN without exposing the hash
CREATE OR REPLACE FUNCTION public.has_pin(s public.students)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT s.access_pin_hash IS NOT NULL;
$$;

COMMIT;
