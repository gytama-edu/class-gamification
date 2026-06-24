BEGIN;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS pin_generated_at timestamptz;

COMMIT;
