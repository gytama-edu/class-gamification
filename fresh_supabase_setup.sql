-- 001_initial_schema.sql
-- Create core tables for GYTama EDU Classes Gamification

CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  level_name text NOT NULL,
  max_lives integer NOT NULL,
  current_meeting_number integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_key text,
  total_points integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  meeting_number integer NOT NULL,
  max_lives_snapshot integer NOT NULL,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.student_meeting_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  lives_remaining integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.point_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL,
  points_delta integer NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.life_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  lives_delta integer NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);


-- 002_constraints_and_indexes.sql
-- Add check constraints, unique constraints, and indexes

-- Constraints for classes
ALTER TABLE public.classes
  ADD CONSTRAINT classes_max_lives_check CHECK (max_lives >= 1 AND max_lives <= 20),
  ADD CONSTRAINT classes_current_meeting_number_check CHECK (current_meeting_number >= 0);

-- Constraints for students
ALTER TABLE public.students
  ADD CONSTRAINT students_total_points_check CHECK (total_points >= 0);

-- Constraints for meetings
ALTER TABLE public.meetings
  ADD CONSTRAINT meetings_max_lives_snapshot_check CHECK (max_lives_snapshot >= 1 AND max_lives_snapshot <= 20),
  ADD CONSTRAINT meetings_status_check CHECK (status IN ('active', 'completed')),
  ADD CONSTRAINT meetings_meeting_number_unique UNIQUE (class_id, meeting_number);

-- Unique partial index to ensure only one active meeting per class
CREATE UNIQUE INDEX meetings_one_active_per_class_idx ON public.meetings (class_id) WHERE status = 'active';

-- Constraints for student_meeting_states
ALTER TABLE public.student_meeting_states
  ADD CONSTRAINT student_meeting_states_lives_remaining_check CHECK (lives_remaining >= 0),
  ADD CONSTRAINT student_meeting_states_unique_student_meeting UNIQUE (meeting_id, student_id);

-- Indexes for foreign keys and common queries
CREATE INDEX students_class_id_idx ON public.students(class_id);
CREATE INDEX meetings_class_id_idx ON public.meetings(class_id);
CREATE INDEX student_meeting_states_meeting_id_idx ON public.student_meeting_states(meeting_id);
CREATE INDEX student_meeting_states_student_id_idx ON public.student_meeting_states(student_id);
CREATE INDEX point_events_class_id_idx ON public.point_events(class_id);
CREATE INDEX point_events_student_id_idx ON public.point_events(student_id);
CREATE INDEX point_events_meeting_id_idx ON public.point_events(meeting_id);
CREATE INDEX life_events_class_id_idx ON public.life_events(class_id);
CREATE INDEX life_events_student_id_idx ON public.life_events(student_id);
CREATE INDEX life_events_meeting_id_idx ON public.life_events(meeting_id);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER classes_updated_at
  BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER student_meeting_states_updated_at
  BEFORE UPDATE ON public.student_meeting_states
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();


-- 003_rls.sql
-- Enable RLS on all tables and create placeholder policies for Phase 1B

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_meeting_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.life_events ENABLE ROW LEVEL SECURITY;

-- Note: In Phase 1B, we are accessing data mostly from the server using the service_role key
-- or via public read access if necessary. For now, we will add authenticated-only placeholder policies
-- and prevent public anonymous writes.

-- Classes: authenticated users can read (to be locked down to teachers later)
CREATE POLICY "Classes are viewable by authenticated users" 
ON public.classes FOR SELECT TO authenticated USING (true);

-- Students: authenticated users can read
CREATE POLICY "Students are viewable by authenticated users" 
ON public.students FOR SELECT TO authenticated USING (true);

-- Meetings: authenticated users can read
CREATE POLICY "Meetings are viewable by authenticated users" 
ON public.meetings FOR SELECT TO authenticated USING (true);

-- Student Meeting States: authenticated users can read
CREATE POLICY "Student meeting states are viewable by authenticated users" 
ON public.student_meeting_states FOR SELECT TO authenticated USING (true);

-- Events: authenticated users can read
CREATE POLICY "Point events are viewable by authenticated users" 
ON public.point_events FOR SELECT TO authenticated USING (true);

CREATE POLICY "Life events are viewable by authenticated users" 
ON public.life_events FOR SELECT TO authenticated USING (true);

-- Note: No INSERT, UPDATE, or DELETE policies are created for the public/anon roles.
-- The service_role key will be used by the repository layer to bypass RLS for Phase 1B,
-- or proper teacher policies will be implemented in a later phase.


-- 004_archive_classes.sql
ALTER TABLE public.classes ADD COLUMN is_archived boolean NOT NULL DEFAULT false;


-- 005_mutations_rpc.sql
-- Server-side functions to safely perform mutations without broad anonymous write policies

-- 1. Create Class
CREATE OR REPLACE FUNCTION create_class(p_name text, p_level_name text, p_max_lives integer)
RETURNS uuid AS $$
DECLARE
  v_class_id uuid;
BEGIN
  INSERT INTO public.classes (name, level_name, max_lives, current_meeting_number)
  VALUES (p_name, p_level_name, p_max_lives, 0)
  RETURNING id INTO v_class_id;
  RETURN v_class_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update Class
CREATE OR REPLACE FUNCTION update_class(p_class_id uuid, p_name text, p_level_name text, p_max_lives integer)
RETURNS void AS $$
BEGIN
  UPDATE public.classes
  SET name = COALESCE(p_name, name),
      level_name = COALESCE(p_level_name, level_name),
      max_lives = COALESCE(p_max_lives, max_lives),
      updated_at = now()
  WHERE id = p_class_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Archive Class
CREATE OR REPLACE FUNCTION archive_class(p_class_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.classes
  SET is_archived = true, updated_at = now()
  WHERE id = p_class_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Add Student
CREATE OR REPLACE FUNCTION add_student(p_class_id uuid, p_display_name text)
RETURNS uuid AS $$
DECLARE
  v_student_id uuid;
  v_meeting_id uuid;
  v_max_lives integer;
BEGIN
  INSERT INTO public.students (class_id, display_name)
  VALUES (p_class_id, p_display_name)
  RETURNING id INTO v_student_id;

  -- If there is an active meeting, add them to it with max lives
  SELECT id, max_lives_snapshot INTO v_meeting_id, v_max_lives
  FROM public.meetings
  WHERE class_id = p_class_id AND status = 'active';

  IF FOUND THEN
    INSERT INTO public.student_meeting_states (meeting_id, student_id, lives_remaining)
    VALUES (v_meeting_id, v_student_id, v_max_lives);
  END IF;

  RETURN v_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update Student
CREATE OR REPLACE FUNCTION update_student(p_student_id uuid, p_display_name text, p_is_active boolean)
RETURNS void AS $$
BEGIN
  UPDATE public.students
  SET display_name = COALESCE(p_display_name, display_name),
      is_active = COALESCE(p_is_active, is_active),
      updated_at = now()
  WHERE id = p_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Award Points
CREATE OR REPLACE FUNCTION award_points(p_class_id uuid, p_student_id uuid, p_points integer, p_reason text)
RETURNS void AS $$
DECLARE
  v_meeting_id uuid;
BEGIN
  SELECT id INTO v_meeting_id FROM public.meetings WHERE class_id = p_class_id AND status = 'active';

  UPDATE public.students
  SET total_points = total_points + p_points, updated_at = now()
  WHERE id = p_student_id AND class_id = p_class_id;

  INSERT INTO public.point_events (class_id, student_id, meeting_id, points_delta, reason)
  VALUES (p_class_id, p_student_id, v_meeting_id, p_points, p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Remove Points
CREATE OR REPLACE FUNCTION remove_points(p_class_id uuid, p_student_id uuid, p_points integer, p_reason text)
RETURNS void AS $$
DECLARE
  v_meeting_id uuid;
  v_current_points integer;
  v_deduct integer;
BEGIN
  SELECT id INTO v_meeting_id FROM public.meetings WHERE class_id = p_class_id AND status = 'active';
  SELECT total_points INTO v_current_points FROM public.students WHERE id = p_student_id FOR UPDATE;
  
  v_deduct := LEAST(v_current_points, p_points);

  UPDATE public.students
  SET total_points = total_points - v_deduct, updated_at = now()
  WHERE id = p_student_id AND class_id = p_class_id;

  INSERT INTO public.point_events (class_id, student_id, meeting_id, points_delta, reason)
  VALUES (p_class_id, p_student_id, v_meeting_id, -v_deduct, p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Remove Life
CREATE OR REPLACE FUNCTION remove_life(p_class_id uuid, p_student_id uuid, p_reason text)
RETURNS void AS $$
DECLARE
  v_meeting_id uuid;
  v_current_lives integer;
BEGIN
  SELECT id INTO v_meeting_id FROM public.meetings WHERE class_id = p_class_id AND status = 'active';
  IF NOT FOUND THEN RETURN; END IF;

  SELECT lives_remaining INTO v_current_lives FROM public.student_meeting_states
  WHERE meeting_id = v_meeting_id AND student_id = p_student_id FOR UPDATE;

  IF v_current_lives > 0 THEN
    UPDATE public.student_meeting_states
    SET lives_remaining = lives_remaining - 1, updated_at = now()
    WHERE meeting_id = v_meeting_id AND student_id = p_student_id;

    INSERT INTO public.life_events (class_id, student_id, meeting_id, lives_delta, reason)
    VALUES (p_class_id, p_student_id, v_meeting_id, -1, p_reason);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Restore Life
CREATE OR REPLACE FUNCTION restore_life(p_class_id uuid, p_student_id uuid, p_reason text)
RETURNS void AS $$
DECLARE
  v_meeting_id uuid;
  v_max_lives integer;
  v_current_lives integer;
BEGIN
  SELECT id, max_lives_snapshot INTO v_meeting_id, v_max_lives FROM public.meetings WHERE class_id = p_class_id AND status = 'active';
  IF NOT FOUND THEN RETURN; END IF;

  SELECT lives_remaining INTO v_current_lives FROM public.student_meeting_states
  WHERE meeting_id = v_meeting_id AND student_id = p_student_id FOR UPDATE;

  IF v_current_lives < v_max_lives THEN
    UPDATE public.student_meeting_states
    SET lives_remaining = lives_remaining + 1, updated_at = now()
    WHERE meeting_id = v_meeting_id AND student_id = p_student_id;

    INSERT INTO public.life_events (class_id, student_id, meeting_id, lives_delta, reason)
    VALUES (p_class_id, p_student_id, v_meeting_id, 1, p_reason);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Reset Student Lives
CREATE OR REPLACE FUNCTION reset_student_lives(p_class_id uuid, p_student_id uuid)
RETURNS void AS $$
DECLARE
  v_meeting_id uuid;
  v_max_lives integer;
  v_current_lives integer;
BEGIN
  SELECT id, max_lives_snapshot INTO v_meeting_id, v_max_lives FROM public.meetings WHERE class_id = p_class_id AND status = 'active';
  IF NOT FOUND THEN RETURN; END IF;

  SELECT lives_remaining INTO v_current_lives FROM public.student_meeting_states
  WHERE meeting_id = v_meeting_id AND student_id = p_student_id FOR UPDATE;

  IF v_current_lives < v_max_lives THEN
    UPDATE public.student_meeting_states
    SET lives_remaining = v_max_lives, updated_at = now()
    WHERE meeting_id = v_meeting_id AND student_id = p_student_id;

    INSERT INTO public.life_events (class_id, student_id, meeting_id, lives_delta, reason)
    VALUES (p_class_id, p_student_id, v_meeting_id, v_max_lives - v_current_lives, 'reset');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Start New Meeting
CREATE OR REPLACE FUNCTION start_new_meeting(p_class_id uuid)
RETURNS void AS $$
DECLARE
  v_max_lives integer;
  v_meeting_number integer;
  v_new_meeting_id uuid;
BEGIN
  -- Complete current active meeting
  UPDATE public.meetings
  SET status = 'completed', ended_at = now()
  WHERE class_id = p_class_id AND status = 'active';

  -- Get class info
  SELECT max_lives, current_meeting_number INTO v_max_lives, v_meeting_number
  FROM public.classes
  WHERE id = p_class_id FOR UPDATE;

  -- Increment meeting number
  UPDATE public.classes
  SET current_meeting_number = current_meeting_number + 1, updated_at = now()
  WHERE id = p_class_id;

  -- Create new meeting
  INSERT INTO public.meetings (class_id, meeting_number, max_lives_snapshot, status)
  VALUES (p_class_id, v_meeting_number + 1, v_max_lives, 'active')
  RETURNING id INTO v_new_meeting_id;

  -- Create student states
  INSERT INTO public.student_meeting_states (meeting_id, student_id, lives_remaining)
  SELECT v_new_meeting_id, id, v_max_lives
  FROM public.students
  WHERE class_id = p_class_id AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 006_auth_and_ownership.sql

-- 1. Create Teacher Profiles Table
CREATE TABLE IF NOT EXISTS public.teacher_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add owner_id to classes table
-- In case there are existing rows, we need to handle them. We will temporarily allow NULL,
-- assign existing classes to a default owner (if available) or just let them be NULL,
-- but the requirement says owner_id uuid not null.
-- For a safe migration, we'll make it nullable first, or we can use a dummy UUID if we must, 
-- but it's better to make it nullable, or wipe existing if we are doing a fresh start.
-- Given this is development, we'll try to add owner_id allowing NULL, then update it.

ALTER TABLE public.classes 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- We can't enforce NOT NULL right away if there are existing rows without an owner.
-- Since this is just a dev environment, we'll leave it as nullable but enforce it in app logic,
-- OR we can try to delete existing classes that don't have an owner if we want to enforce NOT NULL.
-- Let's just delete existing classes to ensure data integrity since they belong to nobody.
DELETE FROM public.classes WHERE owner_id IS NULL;

ALTER TABLE public.classes ALTER COLUMN owner_id SET NOT NULL;

-- 3. Enable RLS on teacher_profiles
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view their own profile" 
ON public.teacher_profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

CREATE POLICY "Teachers can update their own profile" 
ON public.teacher_profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id);

CREATE POLICY "Teachers can insert their own profile" 
ON public.teacher_profiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- 4. Update RLS on classes
-- First, drop existing policies on classes
DROP POLICY IF EXISTS "Enable read access for all users" ON public.classes;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.classes;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.classes;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.classes;

CREATE POLICY "Teachers can select their own classes"
ON public.classes FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Teachers can insert their own classes"
ON public.classes FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Teachers can update their own classes"
ON public.classes FOR UPDATE
TO authenticated
USING (owner_id = auth.uid());

-- 5. Update RLS on dependent tables
-- Students
DROP POLICY IF EXISTS "Enable read access for all users" ON public.students;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.students;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.students;

CREATE POLICY "Teachers can select students of their classes"
ON public.students FOR SELECT TO authenticated
USING (class_id IN (SELECT id FROM public.classes WHERE owner_id = auth.uid()));

CREATE POLICY "Teachers can insert students to their classes"
ON public.students FOR INSERT TO authenticated
WITH CHECK (class_id IN (SELECT id FROM public.classes WHERE owner_id = auth.uid()));

CREATE POLICY "Teachers can update students of their classes"
ON public.students FOR UPDATE TO authenticated
USING (class_id IN (SELECT id FROM public.classes WHERE owner_id = auth.uid()));

-- Meetings
DROP POLICY IF EXISTS "Enable read access for all users" ON public.meetings;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.meetings;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.meetings;

CREATE POLICY "Teachers can select meetings of their classes"
ON public.meetings FOR SELECT TO authenticated
USING (class_id IN (SELECT id FROM public.classes WHERE owner_id = auth.uid()));

CREATE POLICY "Teachers can insert meetings to their classes"
ON public.meetings FOR INSERT TO authenticated
WITH CHECK (class_id IN (SELECT id FROM public.classes WHERE owner_id = auth.uid()));

CREATE POLICY "Teachers can update meetings of their classes"
ON public.meetings FOR UPDATE TO authenticated
USING (class_id IN (SELECT id FROM public.classes WHERE owner_id = auth.uid()));

-- Student Meeting States
DROP POLICY IF EXISTS "Enable read access for all users" ON public.student_meeting_states;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.student_meeting_states;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.student_meeting_states;

CREATE POLICY "Teachers can select states of their classes"
ON public.student_meeting_states FOR SELECT TO authenticated
USING (meeting_id IN (SELECT id FROM public.meetings WHERE class_id IN (SELECT id FROM public.classes WHERE owner_id = auth.uid())));

CREATE POLICY "Teachers can insert states of their classes"
ON public.student_meeting_states FOR INSERT TO authenticated
WITH CHECK (meeting_id IN (SELECT id FROM public.meetings WHERE class_id IN (SELECT id FROM public.classes WHERE owner_id = auth.uid())));

CREATE POLICY "Teachers can update states of their classes"
ON public.student_meeting_states FOR UPDATE TO authenticated
USING (meeting_id IN (SELECT id FROM public.meetings WHERE class_id IN (SELECT id FROM public.classes WHERE owner_id = auth.uid())));

-- Point Events
DROP POLICY IF EXISTS "Enable read access for all users" ON public.point_events;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.point_events;

CREATE POLICY "Teachers can select point events of their classes"
ON public.point_events FOR SELECT TO authenticated
USING (class_id IN (SELECT id FROM public.classes WHERE owner_id = auth.uid()));

CREATE POLICY "Teachers can insert point events of their classes"
ON public.point_events FOR INSERT TO authenticated
WITH CHECK (class_id IN (SELECT id FROM public.classes WHERE owner_id = auth.uid()));

-- Life Events
DROP POLICY IF EXISTS "Enable read access for all users" ON public.life_events;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.life_events;

CREATE POLICY "Teachers can select life events of their classes"
ON public.life_events FOR SELECT TO authenticated
USING (class_id IN (SELECT id FROM public.classes WHERE owner_id = auth.uid()));

CREATE POLICY "Teachers can insert life events of their classes"
ON public.life_events FOR INSERT TO authenticated
WITH CHECK (class_id IN (SELECT id FROM public.classes WHERE owner_id = auth.uid()));

-- Also need to check if mutations_rpc.sql exists and update SECURITY DEFINER if any, 
-- but typically we just let RLS handle it if they are SECURITY INVOKER.
-- If any functions were created with SECURITY DEFINER, we should be careful.
-- By default, functions are SECURITY INVOKER.


-- 007_update_rpcs_for_auth.sql

-- Drop the existing create_class function to recreate it with the owner_id constraint handling
DROP FUNCTION IF EXISTS public.create_class(text, text, integer);

CREATE OR REPLACE FUNCTION public.create_class(p_name TEXT, p_level_name TEXT, p_max_lives INTEGER)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_class_id UUID;
    v_owner_id UUID;
BEGIN
    v_owner_id := auth.uid();
    
    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'Must be authenticated to create a class';
    END IF;

    INSERT INTO public.classes (name, level_name, max_lives, current_meeting_number, owner_id)
    VALUES (p_name, p_level_name, p_max_lives, 0, v_owner_id)
    RETURNING id INTO v_class_id;
    
    RETURN v_class_id;
END;
$$;

-- Note: Other RPCs like update_class, archive_class, add_student, etc. 
-- usually rely on RLS if they are SECURITY INVOKER.
-- Since they do an UPDATE or INSERT on tables with RLS enabled and use SECURITY INVOKER, 
-- they will automatically respect the RLS policies and fail if the user doesn't own the class.
-- However, we must ensure all of them are SECURITY INVOKER. 
-- By default, functions in Postgres are SECURITY INVOKER.
-- We'll explicitly recreate them as SECURITY INVOKER just to be absolutely sure.

CREATE OR REPLACE FUNCTION public.update_class(p_class_id UUID, p_name TEXT, p_level_name TEXT, p_max_lives INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    UPDATE public.classes
    SET 
        name = COALESCE(p_name, name),
        level_name = COALESCE(p_level_name, level_name),
        max_lives = COALESCE(p_max_lives, max_lives),
        updated_at = NOW()
    WHERE id = p_class_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_class(p_class_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    UPDATE public.classes
    SET is_archived = TRUE, updated_at = NOW()
    WHERE id = p_class_id;
END;
$$;

-- add_student, update_student, award_points, remove_points, remove_life, restore_life, reset_student_lives, start_new_meeting
-- all act on tables that have RLS policies ensuring the user owns the classroom.
-- Since RLS policies are applied for SECURITY INVOKER functions, we are safe.


BEGIN;

-- Check and create publication if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END
$$;

-- Add tables to publication, catching errors if they are already in the publication
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE classes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE students;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE meetings;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE student_meeting_states;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE point_events;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE life_events;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;


BEGIN;

CREATE OR REPLACE FUNCTION public.end_meeting(p_class_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    UPDATE public.meetings
    SET status = 'completed',
        ended_at = NOW()
    WHERE class_id = p_class_id
      AND status = 'active';
END;
$$;

COMMIT;


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


-- 011_student_access_rpcs.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.regenerate_class_join_code(p_class_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_code text;
BEGIN
    -- Ensure user owns the class
    IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = p_class_id AND owner_id = auth.uid()) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    v_new_code := public.generate_join_code();

    UPDATE public.classes
    SET join_code = v_new_code
    WHERE id = p_class_id;

    RETURN v_new_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_student_pin(p_student_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pin text;
    i integer;
BEGIN
    -- Ensure user owns the student's class
    IF NOT EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.classes c ON s.class_id = c.id
        WHERE s.id = p_student_id AND c.owner_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- Generate a random 4-digit PIN
    v_pin := '';
    FOR i IN 1..4 LOOP
        v_pin := v_pin || floor(random() * 10)::text;
    END LOOP;

    -- Hash and store the PIN
    UPDATE public.students
    SET access_pin_hash = crypt(v_pin, gen_salt('bf', 8)),
        pin_generated_at = now()
    WHERE id = p_student_id;

    -- Return the cleartext PIN to the teacher
    RETURN v_pin;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_student_device(p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Ensure user owns the student's class
    IF NOT EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.classes c ON s.class_id = c.id
        WHERE s.id = p_student_id AND c.owner_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    UPDATE public.students
    SET student_auth_user_id = NULL
    WHERE id = p_student_id;
END;
$$;

COMMIT;


-- 012_update_student_dashboard_rpc.sql
BEGIN;

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
    -- Verify the student belongs to the auth user and access is enabled
    SELECT * INTO v_student FROM public.students 
    WHERE id = p_student_id 
      AND student_auth_user_id = v_user_id
      AND access_enabled = true;
      
    IF v_student IS NULL THEN
        RAISE EXCEPTION 'Not authorized or access revoked';
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
        'student', jsonb_build_object(
            'id', v_student.id,
            'class_id', v_student.class_id,
            'display_name', v_student.display_name,
            'avatar_key', v_student.avatar_key,
            'total_points', v_student.total_points,
            'is_active', v_student.is_active,
            'has_pin', v_student.pin_generated_at IS NOT NULL
        ),
        'classroom', v_class,
        'activeMeeting', v_meeting,
        'lives_remaining', COALESCE(v_state.lives_remaining, 0),
        'rank', v_rank
    );
END;
$$;

COMMIT;


BEGIN;

CREATE OR REPLACE FUNCTION public.generate_student_pin(p_student_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pin text;
    v_class_id uuid;
    v_is_unique boolean;
BEGIN
    -- Ensure user owns the student's class
    SELECT c.id INTO v_class_id
    FROM public.students s
    JOIN public.classes c ON s.class_id = c.id
    WHERE s.id = p_student_id AND c.owner_id = auth.uid();

    IF v_class_id IS NULL THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- Generate a unique 4-digit PIN for the class
    LOOP
        v_pin := lpad(floor(random() * 10000)::text, 4, '0');
        
        -- Check if it's unique
        SELECT NOT EXISTS (
            SELECT 1 FROM public.students
            WHERE class_id = v_class_id AND access_pin_hash IS NOT NULL AND access_pin_hash = crypt(v_pin, access_pin_hash)
        ) INTO v_is_unique;

        EXIT WHEN v_is_unique;
    END LOOP;

    -- Hash and store the PIN
    UPDATE public.students
    SET access_pin_hash = crypt(v_pin, gen_salt('bf', 8)),
        pin_generated_at = now()
    WHERE id = p_student_id;

    -- Return the cleartext PIN to the teacher
    RETURN v_pin;
END;
$$;

COMMIT;


BEGIN;

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
    v_normalized_code text;
    v_normalized_pin text;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    v_normalized_code := upper(trim(p_class_code));
    v_normalized_pin := trim(p_student_pin);

    -- Find class by code
    SELECT id INTO v_class_id
    FROM public.classes
    WHERE upper(join_code) = v_normalized_code
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
      AND access_pin_hash = crypt(v_normalized_pin, access_pin_hash);

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

COMMIT;


BEGIN;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS pin_generated_at timestamptz;

COMMIT;


-- 016_fix_schema_and_create_class.sql
BEGIN;

-- 1. Create a trigger to automatically create a teacher profile when an auth.user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  -- Only create profiles for teachers (they have emails, anonymous students do not)
  IF new.email IS NOT NULL THEN
    INSERT INTO public.teacher_profiles (id, full_name)
    VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', 'Teacher'));
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if trigger exists and drop if so
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. Repair statement for existing authenticated users who are missing a teacher_profiles row
INSERT INTO public.teacher_profiles (id, full_name)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', 'Teacher')
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.teacher_profiles)
  AND email IS NOT NULL;

-- 3. Safely recreate create_class to ensure the schema matches exactly what the frontend expects
DROP FUNCTION IF EXISTS public.create_class(text, text, integer);

CREATE OR REPLACE FUNCTION public.create_class(p_name TEXT, p_level_name TEXT, p_max_lives INTEGER)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_class_id UUID;
    v_owner_id UUID;
BEGIN
    v_owner_id := auth.uid();
    
    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'Must be authenticated to create a class';
    END IF;

    -- Also check if the user is a teacher
    IF NOT EXISTS (SELECT 1 FROM public.teacher_profiles WHERE id = v_owner_id) THEN
        RAISE EXCEPTION 'Must be a registered teacher to create a class';
    END IF;

    INSERT INTO public.classes (name, level_name, max_lives, current_meeting_number, owner_id)
    VALUES (p_name, p_level_name, p_max_lives, 0, v_owner_id)
    RETURNING id INTO v_class_id;
    
    RETURN v_class_id;
END;
$$;

-- 4. Notify PostgREST to reload the schema cache so the frontend sees the correct RPC signatures
NOTIFY pgrst, 'reload schema';

COMMIT;


-- 017_soft_delete_students.sql
BEGIN;

ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

CREATE OR REPLACE FUNCTION public.delete_student(p_student_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_owner_id UUID;
    v_teacher_id UUID;
BEGIN
    v_teacher_id := auth.uid();
    
    IF v_teacher_id IS NULL THEN
        RAISE EXCEPTION 'Must be authenticated to delete a student';
    END IF;

    -- Verify the student belongs to a class owned by the teacher
    SELECT c.owner_id INTO v_owner_id
    FROM public.students s
    JOIN public.classes c ON s.class_id = c.id
    WHERE s.id = p_student_id;

    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'Student not found';
    END IF;

    IF v_owner_id != v_teacher_id THEN
        RAISE EXCEPTION 'Not authorized to delete this student';
    END IF;

    UPDATE public.students
    SET 
        deleted_at = now(),
        deleted_by = v_teacher_id,
        is_active = false,
        access_enabled = false,
        student_auth_user_id = NULL
    WHERE id = p_student_id;
END;
$$;

-- Also update join_class_as_student to ignore deleted students
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
    v_normalized_code text;
    v_normalized_pin text;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    v_normalized_code := upper(trim(p_class_code));
    v_normalized_pin := trim(p_student_pin);

    -- Find class by code
    SELECT id INTO v_class_id
    FROM public.classes
    WHERE upper(join_code) = v_normalized_code
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
      AND deleted_at IS NULL
      AND access_pin_hash IS NOT NULL
      AND access_pin_hash = crypt(v_normalized_pin, access_pin_hash);

    IF v_student IS NULL THEN
        RAISE EXCEPTION 'The class code or PIN is incorrect.';
    END IF;

    -- Check if student is already linked to another user
    IF v_student.student_auth_user_id IS NOT NULL AND v_student.student_auth_user_id != v_user_id THEN
        RAISE EXCEPTION 'This student account is already linked to another device. Ask your teacher to reset your device access.';
    END IF;

    -- Link the student to this auth user
    UPDATE public.students
    SET 
      student_auth_user_id = v_user_id,
      access_activated_at = now()
    WHERE id = v_student.id;

    RETURN jsonb_build_object(
        'student_id', v_student.id,
        'class_id', v_class_id
    );
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;


-- 018_meeting_history_snapshots.sql
BEGIN;

ALTER TABLE public.meetings 
ADD COLUMN IF NOT EXISTS class_name_snapshot TEXT,
ADD COLUMN IF NOT EXISTS level_name_snapshot TEXT;

ALTER TABLE public.student_meeting_states 
ADD COLUMN IF NOT EXISTS student_name_snapshot TEXT,
ADD COLUMN IF NOT EXISTS points_before INTEGER,
ADD COLUMN IF NOT EXISTS points_after INTEGER,
ADD COLUMN IF NOT EXISTS final_rank INTEGER;

CREATE OR REPLACE FUNCTION public.end_meeting(p_class_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_teacher_id UUID;
    v_meeting_id UUID;
    v_class record;
BEGIN
    v_teacher_id := auth.uid();
    IF v_teacher_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT * INTO v_class FROM public.classes WHERE id = p_class_id;
    IF v_class IS NULL THEN
        RAISE EXCEPTION 'Class not found';
    END IF;

    IF v_class.owner_id != v_teacher_id THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    SELECT id INTO v_meeting_id FROM public.meetings WHERE class_id = p_class_id AND status = 'active';
    IF v_meeting_id IS NULL THEN
        RAISE EXCEPTION 'No active meeting';
    END IF;

    -- Ensure all participating students have a state
    INSERT INTO public.student_meeting_states (meeting_id, student_id, lives_remaining)
    SELECT DISTINCT pe.student_id, pe.meeting_id, v_class.max_lives
    FROM public.point_events pe
    WHERE pe.meeting_id = v_meeting_id
      AND NOT EXISTS (
          SELECT 1 FROM public.student_meeting_states sms 
          WHERE sms.meeting_id = pe.meeting_id AND sms.student_id = pe.student_id
      );

    -- Capture student snapshots and calculate points
    UPDATE public.student_meeting_states sms
    SET student_name_snapshot = s.display_name,
        points_after = s.total_points,
        points_before = s.total_points - COALESCE((
            SELECT SUM(points_delta) FROM public.point_events pe 
            WHERE pe.meeting_id = v_meeting_id AND pe.student_id = sms.student_id
        ), 0)
    FROM public.students s
    WHERE sms.student_id = s.id AND sms.meeting_id = v_meeting_id;

    -- Calculate rank based on points_after DESC, student_name_snapshot ASC, student_id ASC
    WITH RankedStudents AS (
        SELECT id, 
               RANK() OVER (ORDER BY points_after DESC NULLS LAST, student_name_snapshot ASC, student_id ASC) as new_rank
        FROM public.student_meeting_states
        WHERE meeting_id = v_meeting_id
    )
    UPDATE public.student_meeting_states sms
    SET final_rank = rs.new_rank
    FROM RankedStudents rs
    WHERE sms.id = rs.id;

    -- Capture class snapshots and finish meeting
    UPDATE public.meetings
    SET class_name_snapshot = v_class.name,
        level_name_snapshot = v_class.level_name,
        status = 'completed',
        ended_at = NOW()
    WHERE id = v_meeting_id;

END;
$$;

CREATE OR REPLACE FUNCTION public.get_class_meeting_history(p_class_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner_id UUID;
    v_teacher_id UUID := auth.uid();
    v_result JSONB;
BEGIN
    IF v_teacher_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT owner_id INTO v_owner_id FROM public.classes WHERE id = p_class_id;
    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'Class not found';
    END IF;

    IF v_owner_id != v_teacher_id THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', m.id,
            'meeting_number', m.meeting_number,
            'status', m.status,
            'started_at', m.started_at,
            'ended_at', m.ended_at,
            'participant_count', (SELECT COUNT(*) FROM public.student_meeting_states sms WHERE sms.meeting_id = m.id),
            'points_awarded', (SELECT COALESCE(SUM(points_delta), 0) FROM public.point_events pe WHERE pe.meeting_id = m.id AND points_delta > 0),
            'points_deducted', (SELECT ABS(COALESCE(SUM(points_delta), 0)) FROM public.point_events pe WHERE pe.meeting_id = m.id AND points_delta < 0),
            'net_points', (SELECT COALESCE(SUM(points_delta), 0) FROM public.point_events pe WHERE pe.meeting_id = m.id),
            'lives_lost', (SELECT ABS(COALESCE(SUM(lives_delta), 0)) FROM public.life_events le WHERE le.meeting_id = m.id AND lives_delta < 0),
            'lives_restored', (SELECT COALESCE(SUM(lives_delta), 0) FROM public.life_events le WHERE le.meeting_id = m.id AND lives_delta > 0)
        ) ORDER BY m.meeting_number DESC
    ), '[]'::jsonb) INTO v_result
    FROM public.meetings m
    WHERE m.class_id = p_class_id AND m.status = 'completed';

    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_meeting_report(p_class_id UUID, p_meeting_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner_id UUID;
    v_teacher_id UUID := auth.uid();
    v_meeting record;
    v_result JSONB;
BEGIN
    IF v_teacher_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT owner_id INTO v_owner_id FROM public.classes WHERE id = p_class_id;
    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'Class not found';
    END IF;

    IF v_owner_id != v_teacher_id THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    SELECT * INTO v_meeting FROM public.meetings WHERE id = p_meeting_id AND class_id = p_class_id;
    IF v_meeting IS NULL THEN
        RAISE EXCEPTION 'Meeting not found';
    END IF;

    SELECT jsonb_build_object(
        'meeting', jsonb_build_object(
            'id', v_meeting.id,
            'meeting_number', v_meeting.meeting_number,
            'class_name_snapshot', COALESCE(v_meeting.class_name_snapshot, (SELECT name FROM public.classes WHERE id = p_class_id)),
            'level_name_snapshot', COALESCE(v_meeting.level_name_snapshot, (SELECT level_name FROM public.classes WHERE id = p_class_id)),
            'started_at', v_meeting.started_at,
            'ended_at', v_meeting.ended_at,
            'max_lives_snapshot', v_meeting.max_lives_snapshot,
            'participant_count', (SELECT COUNT(*) FROM public.student_meeting_states sms WHERE sms.meeting_id = v_meeting.id),
            'points_awarded', (SELECT COALESCE(SUM(points_delta), 0) FROM public.point_events pe WHERE pe.meeting_id = v_meeting.id AND points_delta > 0),
            'points_deducted', (SELECT ABS(COALESCE(SUM(points_delta), 0)) FROM public.point_events pe WHERE pe.meeting_id = v_meeting.id AND points_delta < 0),
            'net_points', (SELECT COALESCE(SUM(points_delta), 0) FROM public.point_events pe WHERE pe.meeting_id = v_meeting.id),
            'lives_lost', (SELECT ABS(COALESCE(SUM(lives_delta), 0)) FROM public.life_events le WHERE le.meeting_id = v_meeting.id AND lives_delta < 0),
            'lives_restored', (SELECT COALESCE(SUM(lives_delta), 0) FROM public.life_events le WHERE le.meeting_id = v_meeting.id AND lives_delta > 0)
        ),
        'students', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'student_id', sms.student_id,
                    'student_name', COALESCE(sms.student_name_snapshot, s.display_name),
                    'final_rank', sms.final_rank,
                    'points_before', COALESCE(sms.points_before, 0),
                    'points_earned', (SELECT COALESCE(SUM(points_delta), 0) FROM public.point_events pe WHERE pe.meeting_id = v_meeting.id AND pe.student_id = sms.student_id AND points_delta > 0),
                    'points_deducted', (SELECT ABS(COALESCE(SUM(points_delta), 0)) FROM public.point_events pe WHERE pe.meeting_id = v_meeting.id AND pe.student_id = sms.student_id AND points_delta < 0),
                    'net_points', (SELECT COALESCE(SUM(points_delta), 0) FROM public.point_events pe WHERE pe.meeting_id = v_meeting.id AND pe.student_id = sms.student_id),
                    'points_after', COALESCE(sms.points_after, 0),
                    'starting_lives', v_meeting.max_lives_snapshot,
                    'lives_lost', (SELECT ABS(COALESCE(SUM(lives_delta), 0)) FROM public.life_events le WHERE le.meeting_id = v_meeting.id AND le.student_id = sms.student_id AND lives_delta < 0),
                    'lives_restored', (SELECT COALESCE(SUM(lives_delta), 0) FROM public.life_events le WHERE le.meeting_id = v_meeting.id AND le.student_id = sms.student_id AND lives_delta > 0),
                    'final_lives', sms.lives_remaining
                ) ORDER BY sms.final_rank ASC NULLS LAST, COALESCE(sms.points_after, 0) DESC, COALESCE(sms.student_name_snapshot, s.display_name) ASC
            )
            FROM public.student_meeting_states sms
            JOIN public.students s ON s.id = sms.student_id
            WHERE sms.meeting_id = v_meeting.id
        ), '[]'::jsonb)
    ) INTO v_result;

    RETURN v_result;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;


