-- 010_student_auth_schema.sql

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add student auth fields
ALTER TABLE public.classes 
  ADD COLUMN IF NOT EXISTS join_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS student_access_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS student_auth_user_id uuid,
  ADD COLUMN IF NOT EXISTS access_pin_hash text,
  ADD COLUMN IF NOT EXISTS access_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS access_activated_at timestamptz;

-- Function to generate random string
CREATE OR REPLACE FUNCTION public.generate_join_code() RETURNS text AS $$
DECLARE
    chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Excluded I, O, 1, 0
    result text := '';
    i integer := 0;
BEGIN
    FOR i IN 1..6 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Trigger function to safely ensure join codes on insert
CREATE OR REPLACE FUNCTION public.set_default_join_code() RETURNS trigger AS $$
BEGIN
    IF NEW.join_code IS NULL THEN
        NEW.join_code := public.generate_join_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_join_code ON public.classes;
CREATE TRIGGER ensure_join_code
BEFORE INSERT ON public.classes
FOR EACH ROW
EXECUTE FUNCTION public.set_default_join_code();

-- Set join codes for existing classes
UPDATE public.classes SET join_code = public.generate_join_code() WHERE join_code IS NULL;

-- Secure join function
CREATE OR REPLACE FUNCTION public.join_class_as_student(
  p_class_code text,
  p_student_pin text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_class_id uuid;
    v_student record;
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Find class by code (case insensitive)
    SELECT id INTO v_class_id
    FROM public.classes
    WHERE upper(join_code) = upper(p_class_code)
      AND student_access_enabled = true;

    IF v_class_id IS NULL THEN
        RAISE EXCEPTION 'The class code or PIN is incorrect.';
    END IF;

    -- Find student by PIN hash
    -- We expect the PIN to match exactly one active, access-enabled student in this class
    SELECT * INTO v_student
    FROM public.students
    WHERE class_id = v_class_id
      AND is_active = true
      AND access_enabled = true
      AND access_pin_hash IS NOT NULL
      AND access_pin_hash = crypt(p_student_pin, access_pin_hash);

    IF v_student IS NULL THEN
        RAISE EXCEPTION 'The class code or PIN is incorrect.';
    END IF;

    -- Check if student is already linked to another user
    IF v_student.student_auth_user_id IS NOT NULL AND v_student.student_auth_user_id != v_user_id THEN
        RAISE EXCEPTION 'This student account is already linked to another device.';
    END IF;

    -- Link student
    UPDATE public.students
    SET student_auth_user_id = v_user_id,
        access_activated_at = COALESCE(access_activated_at, now())
    WHERE id = v_student.id;

    RETURN jsonb_build_object(
        'student_id', v_student.id,
        'class_id', v_class_id
    );
END;
$$;

-- RLS policies for students reading their own data
-- We need to ensure students can read their own row, their class, and their meeting states
-- The current policies in 006_auth_and_ownership.sql are mostly for teachers.
-- We will add policies for students here.

-- Allow students to read the class they belong to
CREATE POLICY "Students can read their own class"
ON public.classes
FOR SELECT
USING (
  id IN (
    SELECT class_id FROM public.students WHERE student_auth_user_id = auth.uid()
  )
);

-- Allow students to read their own student record
CREATE POLICY "Students can read their own record"
ON public.students
FOR SELECT
USING (
  student_auth_user_id = auth.uid()
);

-- Allow students to read meetings for their class
CREATE POLICY "Students can read meetings for their class"
ON public.meetings
FOR SELECT
USING (
  class_id IN (
    SELECT class_id FROM public.students WHERE student_auth_user_id = auth.uid()
  )
);

-- Allow students to read their own meeting states
CREATE POLICY "Students can read their own meeting states"
ON public.student_meeting_states
FOR SELECT
USING (
  student_id IN (
    SELECT id FROM public.students WHERE student_auth_user_id = auth.uid()
  )
);

-- Note: We also need to add policies for realtime updates (e.g. students reading other students' ranks).
-- The instructions say: "A student must only be able to access: Their own student record, their own meeting-state record, their class's basic public information, their rank result, the active meeting status. A student must not be able to access: Another student's full profile..."
-- So we need a secure RPC for getting the student's dashboard data which calculates rank without exposing other students.
-- OR they can fetch the whole roster but only basic info? "Do not expose the full roster unless deliberately enabled later."
-- Ok, we will create an RPC for the student dashboard.

CREATE OR REPLACE FUNCTION public.get_student_dashboard_data(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_student record;
    v_class record;
    v_meeting record;
    v_state record;
    v_rank integer;
    v_user_id uuid := auth.uid();
BEGIN
    -- Verify the student belongs to the auth user
    SELECT * INTO v_student FROM public.students WHERE id = p_student_id AND student_auth_user_id = v_user_id;
    IF v_student IS NULL THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- Get class info
    SELECT id, name, level_name, max_lives, current_meeting_number INTO v_class
    FROM public.classes WHERE id = v_student.class_id;

    -- Get active meeting
    SELECT id, meeting_number, status INTO v_meeting
    FROM public.meetings
    WHERE class_id = v_class.id
    ORDER BY meeting_number DESC LIMIT 1;

    -- Get student state
    IF v_meeting IS NOT NULL THEN
        SELECT lives_remaining INTO v_state
        FROM public.student_meeting_states
        WHERE student_id = p_student_id AND meeting_id = v_meeting.id;
    END IF;

    -- Calculate rank
    SELECT rank INTO v_rank FROM (
        SELECT id, RANK() OVER (ORDER BY total_points DESC, display_name ASC) as rank
        FROM public.students
        WHERE class_id = v_class.id AND is_active = true
    ) ranks
    WHERE id = p_student_id;

    RETURN jsonb_build_object(
        'student', v_student,
        'classroom', v_class,
        'activeMeeting', v_meeting,
        'lives_remaining', COALESCE(v_state.lives_remaining, 0),
        'rank', v_rank
    );
END;
$$;

COMMIT;
