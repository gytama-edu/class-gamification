-- 001_initial_schema.sql
-- Create core tables for GYTama EDU Classes Gamification

CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  level_name text NOT NULL,
  max_lives integer NOT NULL,
  current_meeting_number integer NOT NULL DEFAULT 0,
  class_type text NOT NULL DEFAULT 'regular' CHECK (class_type IN ('regular', 'private')),
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
RETURNS integer AS $$
DECLARE
  v_meeting_id uuid;
  v_new_total integer;
BEGIN
  IF p_points <= 0 THEN
    RAISE EXCEPTION 'Points awarded must be positive';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = p_class_id AND teacher_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = p_student_id AND class_id = p_class_id AND is_active = true AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Student not found or inactive';
  END IF;

  SELECT id INTO v_meeting_id FROM public.meetings WHERE class_id = p_class_id AND status = 'active' LIMIT 1;
  IF v_meeting_id IS NULL THEN
    RAISE EXCEPTION 'No active meeting found';
  END IF;

  UPDATE public.students
  SET total_points = total_points + p_points, updated_at = now()
  WHERE id = p_student_id
  RETURNING total_points INTO v_new_total;

  INSERT INTO public.point_events (meeting_id, student_id, points_delta, reason)
  VALUES (v_meeting_id, p_student_id, p_points, p_reason);

  RETURN v_new_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION award_points(uuid, uuid, integer, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION award_points(uuid, uuid, integer, text) TO authenticated;

-- 7. Remove Points
CREATE OR REPLACE FUNCTION remove_points(p_class_id uuid, p_student_id uuid, p_points integer, p_reason text)
RETURNS integer AS $$
DECLARE
  v_meeting_id uuid;
  v_current_total integer;
  v_new_total integer;
  v_deduction integer;
BEGIN
  IF p_points <= 0 THEN
    RAISE EXCEPTION 'Points removed must be positive';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = p_class_id AND teacher_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = p_student_id AND class_id = p_class_id AND is_active = true AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Student not found or inactive';
  END IF;

  SELECT id INTO v_meeting_id FROM public.meetings WHERE class_id = p_class_id AND status = 'active' LIMIT 1;
  IF v_meeting_id IS NULL THEN
    RAISE EXCEPTION 'No active meeting found';
  END IF;

  SELECT total_points INTO v_current_total FROM public.students WHERE id = p_student_id FOR UPDATE;
  
  v_deduction := LEAST(p_points, v_current_total);
  
  IF v_deduction > 0 THEN
    UPDATE public.students
    SET total_points = total_points - v_deduction, updated_at = now()
    WHERE id = p_student_id
    RETURNING total_points INTO v_new_total;

    INSERT INTO public.point_events (meeting_id, student_id, points_delta, reason)
    VALUES (v_meeting_id, p_student_id, -v_deduction, p_reason);
  ELSE
    v_new_total := v_current_total;
  END IF;

  RETURN v_new_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION remove_points(uuid, uuid, integer, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION remove_points(uuid, uuid, integer, text) TO authenticated;

-- 8. Remove Life
CREATE OR REPLACE FUNCTION remove_life(p_class_id uuid, p_student_id uuid, p_reason text)
RETURNS integer AS $$
DECLARE
  v_meeting_id uuid;
  v_max_lives_snapshot integer;
  v_lives_remaining integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = p_class_id AND teacher_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = p_student_id AND class_id = p_class_id AND is_active = true AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Student not found or inactive';
  END IF;

  SELECT id, max_lives_snapshot INTO v_meeting_id, v_max_lives_snapshot 
  FROM public.meetings 
  WHERE class_id = p_class_id AND status = 'active' LIMIT 1;
  
  IF v_meeting_id IS NULL THEN
    RAISE EXCEPTION 'No active meeting found';
  END IF;

  SELECT lives_remaining INTO v_lives_remaining 
  FROM public.student_meeting_states 
  WHERE meeting_id = v_meeting_id AND student_id = p_student_id FOR UPDATE;

  IF v_lives_remaining IS NULL THEN
    INSERT INTO public.student_meeting_states (meeting_id, student_id, lives_remaining)
    VALUES (v_meeting_id, p_student_id, v_max_lives_snapshot - 1)
    ON CONFLICT (meeting_id, student_id) 
    DO UPDATE SET lives_remaining = EXCLUDED.lives_remaining
    RETURNING lives_remaining INTO v_lives_remaining;
    
    INSERT INTO public.life_events (meeting_id, student_id, lives_delta, reason)
    VALUES (v_meeting_id, p_student_id, -1, p_reason);
  ELSE
    IF v_lives_remaining > 0 THEN
      UPDATE public.student_meeting_states
      SET lives_remaining = lives_remaining - 1, updated_at = now()
      WHERE meeting_id = v_meeting_id AND student_id = p_student_id
      RETURNING lives_remaining INTO v_lives_remaining;

      INSERT INTO public.life_events (meeting_id, student_id, lives_delta, reason)
      VALUES (v_meeting_id, p_student_id, -1, p_reason);
    END IF;
  END IF;

  RETURN v_lives_remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION remove_life(uuid, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION remove_life(uuid, uuid, text) TO authenticated;

-- 9. Restore Life
CREATE OR REPLACE FUNCTION restore_life(p_class_id uuid, p_student_id uuid, p_reason text)
RETURNS integer AS $$
DECLARE
  v_meeting_id uuid;
  v_max_lives_snapshot integer;
  v_lives_remaining integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = p_class_id AND teacher_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = p_student_id AND class_id = p_class_id AND is_active = true AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Student not found or inactive';
  END IF;

  SELECT id, max_lives_snapshot INTO v_meeting_id, v_max_lives_snapshot 
  FROM public.meetings 
  WHERE class_id = p_class_id AND status = 'active' LIMIT 1;
  
  IF v_meeting_id IS NULL THEN
    RAISE EXCEPTION 'No active meeting found';
  END IF;

  SELECT lives_remaining INTO v_lives_remaining 
  FROM public.student_meeting_states 
  WHERE meeting_id = v_meeting_id AND student_id = p_student_id FOR UPDATE;

  IF v_lives_remaining IS NULL THEN
    INSERT INTO public.student_meeting_states (meeting_id, student_id, lives_remaining)
    VALUES (v_meeting_id, p_student_id, v_max_lives_snapshot)
    RETURNING lives_remaining INTO v_lives_remaining;
  ELSE
    IF v_lives_remaining < v_max_lives_snapshot THEN
      UPDATE public.student_meeting_states
      SET lives_remaining = lives_remaining + 1, updated_at = now()
      WHERE meeting_id = v_meeting_id AND student_id = p_student_id
      RETURNING lives_remaining INTO v_lives_remaining;

      INSERT INTO public.life_events (meeting_id, student_id, lives_delta, reason)
      VALUES (v_meeting_id, p_student_id, 1, p_reason);
    END IF;
  END IF;

  RETURN v_lives_remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION restore_life(uuid, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION restore_life(uuid, uuid, text) TO authenticated;

-- 10. Reset Student Lives
CREATE OR REPLACE FUNCTION reset_student_lives(p_class_id uuid, p_student_id uuid)
RETURNS integer AS $$
DECLARE
  v_meeting_id uuid;
  v_max_lives_snapshot integer;
  v_lives_remaining integer;
  v_delta integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = p_class_id AND teacher_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = p_student_id AND class_id = p_class_id AND is_active = true AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Student not found or inactive';
  END IF;

  SELECT id, max_lives_snapshot INTO v_meeting_id, v_max_lives_snapshot 
  FROM public.meetings 
  WHERE class_id = p_class_id AND status = 'active' LIMIT 1;
  
  IF v_meeting_id IS NULL THEN
    RAISE EXCEPTION 'No active meeting found';
  END IF;

  SELECT lives_remaining INTO v_lives_remaining 
  FROM public.student_meeting_states 
  WHERE meeting_id = v_meeting_id AND student_id = p_student_id FOR UPDATE;

  IF v_lives_remaining IS NULL THEN
    INSERT INTO public.student_meeting_states (meeting_id, student_id, lives_remaining)
    VALUES (v_meeting_id, p_student_id, v_max_lives_snapshot)
    RETURNING lives_remaining INTO v_lives_remaining;
  ELSE
    v_delta := v_max_lives_snapshot - v_lives_remaining;
    IF v_delta > 0 THEN
      UPDATE public.student_meeting_states
      SET lives_remaining = v_max_lives_snapshot, updated_at = now()
      WHERE meeting_id = v_meeting_id AND student_id = p_student_id
      RETURNING lives_remaining INTO v_lives_remaining;

      INSERT INTO public.life_events (meeting_id, student_id, lives_delta, reason)
      VALUES (v_meeting_id, p_student_id, v_delta, 'Reset lives');
    END IF;
  END IF;

  RETURN v_lives_remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION reset_student_lives(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION reset_student_lives(uuid, uuid) TO authenticated;

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

CREATE OR REPLACE FUNCTION public.update_class(p_class_id UUID, p_name TEXT, p_level_name TEXT, p_max_lives INTEGER, p_class_type TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_type TEXT;
BEGIN
    IF p_class_type IS NOT NULL THEN
        v_type := lower(btrim(p_class_type));
        IF v_type NOT IN ('regular', 'private') THEN
            v_type := 'regular';
        END IF;
    END IF;

    UPDATE public.classes
    SET 
        name = COALESCE(p_name, name),
        level_name = COALESCE(p_level_name, level_name),
        max_lives = COALESCE(p_max_lives, max_lives),
        class_type = COALESCE(v_type, class_type),
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

CREATE OR REPLACE FUNCTION public.create_class(p_name TEXT, p_level_name TEXT, p_max_lives INTEGER, p_class_type TEXT DEFAULT 'regular')
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_class_id UUID;
    v_owner_id UUID;
    v_type TEXT;
BEGIN
    v_owner_id := auth.uid();
    
    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'Must be authenticated to create a class';
    END IF;

    -- Also check if the user is a teacher
    IF NOT EXISTS (SELECT 1 FROM public.teacher_profiles WHERE id = v_owner_id) THEN
        RAISE EXCEPTION 'Must be a registered teacher to create a class';
    END IF;

    v_type := COALESCE(lower(btrim(p_class_type)), 'regular');
    IF v_type NOT IN ('regular', 'private') THEN
        v_type := 'regular';
    END IF;

    INSERT INTO public.classes (name, level_name, max_lives, current_meeting_number, owner_id, class_type)
    VALUES (p_name, p_level_name, p_max_lives, 0, v_owner_id, v_type)
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

-- 024_achievements_foundation.sql
-- manual_install_achievements_foundation.sql

BEGIN;

-- 1. Create achievement_definitions table
CREATE TABLE IF NOT EXISTS public.achievement_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  tier text NOT NULL,
  icon_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_automatic boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create student_achievements table
CREATE TABLE IF NOT EXISTS public.student_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  achievement_definition_id uuid REFERENCES public.achievement_definitions(id) ON DELETE SET NULL,
  achievement_key_snapshot text NOT NULL,
  achievement_name_snapshot text NOT NULL,
  achievement_description_snapshot text NOT NULL,
  category_snapshot text NOT NULL,
  tier_snapshot text NOT NULL,
  icon_key_snapshot text NOT NULL,
  source_type text NOT NULL,
  source_meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL,
  awarded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  earned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Constraints & Indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_achievements_unique_automatic') THEN
        CREATE UNIQUE INDEX student_achievements_unique_automatic ON public.student_achievements (student_id, class_id, achievement_definition_id) WHERE source_type = 'automatic';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS student_achievements_student_id_idx ON public.student_achievements(student_id);
CREATE INDEX IF NOT EXISTS student_achievements_class_id_idx ON public.student_achievements(class_id);
CREATE INDEX IF NOT EXISTS student_achievements_earned_at_idx ON public.student_achievements(earned_at);
CREATE INDEX IF NOT EXISTS achievement_definitions_key_idx ON public.achievement_definitions(key);

-- 4. Enable RLS
ALTER TABLE public.achievement_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_achievements ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Achievement definitions are viewable by authenticated users" ON public.achievement_definitions;
    CREATE POLICY "Achievement definitions are viewable by authenticated users" 
    ON public.achievement_definitions FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Teachers can view student achievements for their classes" ON public.student_achievements;
    CREATE POLICY "Teachers can view student achievements for their classes"
    ON public.student_achievements FOR SELECT TO authenticated
    USING (class_id IN (SELECT id FROM public.classes WHERE owner_id = auth.uid()));

    DROP POLICY IF EXISTS "Students can view their own achievements" ON public.student_achievements;
    CREATE POLICY "Students can view their own achievements"
    ON public.student_achievements FOR SELECT TO authenticated
    USING (student_id IN (SELECT id FROM public.students WHERE student_auth_user_id = auth.uid()));

    -- NO INSERT POLICY for regular clients. Insert is only via SECURITY DEFINER functions.
END $$;

-- Add table to publication for realtime
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE student_achievements;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Seed Achievement Definitions
INSERT INTO public.achievement_definitions (key, name, description, category, tier, icon_key, is_automatic, sort_order) VALUES
('first_point', 'First Signal', 'Earn your first Mission Point.', 'Points', 'Bronze', 'radio', true, 10),
('points_50', 'Momentum Builder', 'Reach 50 Mission Points.', 'Points', 'Silver', 'zap', true, 20),
('points_100', 'Century Operator', 'Reach 100 Mission Points.', 'Points', 'Silver', 'star', true, 30),
('points_250', 'Command Specialist', 'Reach 250 Mission Points.', 'Points', 'Gold', 'award', true, 40),
('points_500', 'Mission Veteran', 'Reach 500 Mission Points.', 'Points', 'Platinum', 'crown', true, 50),

('first_meeting', 'First Deployment', 'Complete your first class meeting.', 'Participation', 'Bronze', 'flag', true, 60),
('meetings_5', 'Reliable Crew', 'Participate in five completed meetings.', 'Participation', 'Silver', 'users', true, 70),
('meetings_10', 'Mission Regular', 'Participate in ten completed meetings.', 'Participation', 'Gold', 'calendar-check', true, 80),
('meetings_25', 'Operations Veteran', 'Participate in twenty-five completed meetings.', 'Participation', 'Platinum', 'shield', true, 90),

('teacher_recognition', 'Teacher Recognition', 'Receive special recognition from your teacher.', 'Special', 'Special', 'star', false, 1000)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  tier = EXCLUDED.tier,
  icon_key = EXCLUDED.icon_key,
  sort_order = EXCLUDED.sort_order;


-- 7. Helper Function First
CREATE OR REPLACE FUNCTION public._check_and_award_achievement(p_student_id uuid, p_class_id uuid, p_key text, p_condition boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_def record;
    v_new_id uuid;
BEGIN
    IF NOT p_condition THEN
        RETURN '[]'::jsonb;
    END IF;

    SELECT * INTO v_def FROM public.achievement_definitions WHERE key = p_key AND is_active = true;
    IF v_def IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.student_achievements
        WHERE student_id = p_student_id AND achievement_definition_id = v_def.id AND source_type = 'automatic'
    ) THEN
        RETURN '[]'::jsonb;
    END IF;

    INSERT INTO public.student_achievements (
        class_id, student_id, achievement_definition_id,
        achievement_key_snapshot, achievement_name_snapshot,
        achievement_description_snapshot, category_snapshot,
        tier_snapshot, icon_key_snapshot, source_type
    ) VALUES (
        p_class_id, p_student_id, v_def.id,
        v_def.key, v_def.name,
        v_def.description, v_def.category,
        v_def.tier, v_def.icon_key, 'automatic'
    ) RETURNING id INTO v_new_id;

    RETURN jsonb_build_array(jsonb_build_object(
        'id', v_new_id,
        'achievement_key_snapshot', v_def.key,
        'achievement_name_snapshot', v_def.name,
        'icon_key_snapshot', v_def.icon_key,
        'tier_snapshot', v_def.tier
    ));
END;
$$;
REVOKE ALL ON FUNCTION public._check_and_award_achievement(uuid, uuid, text, boolean) FROM public, anon;


-- 8. Evaluate all student achievements
CREATE OR REPLACE FUNCTION public.evaluate_student_achievements(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_class_id uuid;
    v_total_points integer;
    v_completed_meetings integer;
    v_new_achievements jsonb := '[]'::jsonb;
    v_student record;
BEGIN
    -- Verify caller owns the class
    SELECT s.class_id, s.total_points, s.display_name INTO v_class_id, v_total_points, v_student.display_name
    FROM public.students s
    JOIN public.classes c ON s.class_id = c.id
    WHERE s.id = p_student_id AND c.owner_id = auth.uid();

    IF v_class_id IS NULL THEN
        RAISE EXCEPTION 'Not authorized or student not found';
    END IF;

    -- Evaluate Points Achievements
    v_new_achievements := v_new_achievements || public._check_and_award_achievement(p_student_id, v_class_id, 'first_point', v_total_points > 0);
    v_new_achievements := v_new_achievements || public._check_and_award_achievement(p_student_id, v_class_id, 'points_50', v_total_points >= 50);
    v_new_achievements := v_new_achievements || public._check_and_award_achievement(p_student_id, v_class_id, 'points_100', v_total_points >= 100);
    v_new_achievements := v_new_achievements || public._check_and_award_achievement(p_student_id, v_class_id, 'points_250', v_total_points >= 250);
    v_new_achievements := v_new_achievements || public._check_and_award_achievement(p_student_id, v_class_id, 'points_500', v_total_points >= 500);

    -- Get Meeting Stats
    SELECT count(*)
    INTO v_completed_meetings
    FROM public.student_meeting_states sms
    JOIN public.meetings m ON sms.meeting_id = m.id
    WHERE sms.student_id = p_student_id AND m.status = 'completed';

    -- Evaluate Participation Achievements
    v_new_achievements := v_new_achievements || public._check_and_award_achievement(p_student_id, v_class_id, 'first_meeting', v_completed_meetings >= 1);
    v_new_achievements := v_new_achievements || public._check_and_award_achievement(p_student_id, v_class_id, 'meetings_5', v_completed_meetings >= 5);
    v_new_achievements := v_new_achievements || public._check_and_award_achievement(p_student_id, v_class_id, 'meetings_10', v_completed_meetings >= 10);
    v_new_achievements := v_new_achievements || public._check_and_award_achievement(p_student_id, v_class_id, 'meetings_25', v_completed_meetings >= 25);

    RETURN v_new_achievements;
END;
$$;
REVOKE ALL ON FUNCTION public.evaluate_student_achievements(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.evaluate_student_achievements(uuid) TO authenticated;


-- 9. Evaluate all students in a class
CREATE OR REPLACE FUNCTION public.evaluate_class_achievements(p_class_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_student record;
    v_results jsonb := '[]'::jsonb;
    v_student_achievements jsonb;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = p_class_id AND owner_id = auth.uid()) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    FOR v_student IN SELECT id FROM public.students WHERE class_id = p_class_id AND is_active = true AND deleted_at IS NULL LOOP
        v_student_achievements := public.evaluate_student_achievements(v_student.id);
        IF jsonb_array_length(v_student_achievements) > 0 THEN
            v_results := v_results || v_student_achievements;
        END IF;
    END LOOP;

    RETURN v_results;
END;
$$;
REVOKE ALL ON FUNCTION public.evaluate_class_achievements(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.evaluate_class_achievements(uuid) TO authenticated;


-- 10. Award teacher recognition
CREATE OR REPLACE FUNCTION public.award_teacher_recognition(
  p_student_id uuid,
  p_title text,
  p_reason text,
  p_icon_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_class_id uuid;
    v_def record;
    v_new_id uuid;
BEGIN
    SELECT s.class_id INTO v_class_id
    FROM public.students s
    JOIN public.classes c ON s.class_id = c.id
    WHERE s.id = p_student_id AND c.owner_id = auth.uid();

    IF v_class_id IS NULL THEN
        RAISE EXCEPTION 'Not authorized or student not found';
    END IF;

    IF length(trim(p_title)) < 3 OR length(trim(p_title)) > 50 THEN
        RAISE EXCEPTION 'Title must be between 3 and 50 characters';
    END IF;
    
    IF p_reason IS NOT NULL AND (length(trim(p_reason)) < 3 OR length(trim(p_reason)) > 200) THEN
        RAISE EXCEPTION 'Reason must be between 3 and 200 characters';
    END IF;

    IF p_icon_key NOT IN ('star', 'award', 'trophy', 'book-open', 'microphone', 'brain', 'target', 'shield', 'users', 'zap') THEN
        RAISE EXCEPTION 'Invalid icon key';
    END IF;

    SELECT * INTO v_def FROM public.achievement_definitions WHERE key = 'teacher_recognition';
    IF v_def IS NULL THEN
        RAISE EXCEPTION 'Definition not found';
    END IF;

    INSERT INTO public.student_achievements (
        class_id, student_id, achievement_definition_id,
        achievement_key_snapshot, achievement_name_snapshot,
        achievement_description_snapshot, category_snapshot,
        tier_snapshot, icon_key_snapshot, source_type,
        awarded_by, reason
    ) VALUES (
        v_class_id, p_student_id, v_def.id,
        v_def.key, trim(p_title),
        v_def.description, v_def.category,
        v_def.tier, p_icon_key, 'manual',
        auth.uid(), trim(p_reason)
    ) RETURNING id INTO v_new_id;

    RETURN jsonb_build_object(
        'id', v_new_id,
        'achievement_name_snapshot', trim(p_title),
        'icon_key_snapshot', p_icon_key,
        'tier_snapshot', v_def.tier
    );
END;
$$;
REVOKE ALL ON FUNCTION public.award_teacher_recognition(uuid, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.award_teacher_recognition(uuid, text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- 026_tasks_foundation.sql
BEGIN;

-- 1. Modify point_events table safely
ALTER TABLE public.point_events ADD COLUMN IF NOT EXISTS task_assignment_id uuid;

-- Tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
    id uuid primary key default gen_random_uuid(),
    class_id uuid not null references public.classes(id) on delete cascade,
    created_by uuid not null references auth.users(id) on delete cascade,
    title text not null check (length(trim(title)) between 3 and 100),
    instructions text not null default '',
    due_at timestamptz null,
    reward_points integer not null default 0 check (reward_points >= 0 and reward_points <= 1000),
    assignment_scope text not null check (assignment_scope in ('all_students', 'selected_students')),
    status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'archived')),
    published_at timestamptz null,
    completed_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (length(instructions) <= 5000)
);

-- Task Assignments table
CREATE TABLE IF NOT EXISTS public.task_assignments (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references public.tasks(id) on delete cascade,
    class_id uuid not null references public.classes(id) on delete cascade,
    student_id uuid not null references public.students(id) on delete cascade,
    status text not null default 'assigned' check (status in ('assigned', 'submitted', 'approved', 'returned')),
    submission_text text null check (submission_text is null or length(submission_text) <= 3000),
    submitted_at timestamptz null,
    teacher_feedback text null check (teacher_feedback is null or length(teacher_feedback) <= 1000),
    reviewed_at timestamptz null,
    reviewed_by uuid null references auth.users(id) on delete set null,
    points_awarded integer not null default 0 check (points_awarded >= 0),
    points_awarded_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(task_id, student_id)
);

-- Add point_events FK safely
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'point_events_task_assignment_id_fkey') THEN
        ALTER TABLE public.point_events
        ADD CONSTRAINT point_events_task_assignment_id_fkey 
        FOREIGN KEY (task_assignment_id) REFERENCES public.task_assignments(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Unique partial index for task rewards to prevent duplicates
DROP INDEX IF EXISTS public.idx_point_events_unique_task_assignment;
CREATE UNIQUE INDEX idx_point_events_unique_task_assignment ON public.point_events(task_assignment_id) WHERE task_assignment_id IS NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_class_status ON public.tasks(class_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_task_assignments_task ON public.task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_student_status ON public.task_assignments(student_id, status);
CREATE INDEX IF NOT EXISTS idx_task_assignments_class ON public.task_assignments(class_id);

-- RLS Enable
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;

-- Revoke direct mutations
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tasks FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.task_assignments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tasks TO authenticated;
GRANT SELECT ON public.task_assignments TO authenticated;

-- Helper functions for RLS
CREATE OR REPLACE FUNCTION public.student_can_read_task(p_task_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.task_assignments ta
        JOIN public.students s ON ta.student_id = s.id
        JOIN public.tasks t ON ta.task_id = t.id
        WHERE t.id = p_task_id
          AND s.student_auth_user_id = auth.uid()
          AND s.is_active = true
          AND s.access_enabled = true
          AND s.deleted_at IS NULL
          AND t.status IN ('active', 'completed')
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.student_can_read_task_assignment(p_assignment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.task_assignments ta
        JOIN public.students s ON ta.student_id = s.id
        JOIN public.tasks t ON ta.task_id = t.id
        WHERE ta.id = p_assignment_id
          AND s.student_auth_user_id = auth.uid()
          AND s.is_active = true
          AND s.access_enabled = true
          AND s.deleted_at IS NULL
          AND t.status IN ('active', 'completed')
    );
END;
$$;

-- Drop existing policies
DROP POLICY IF EXISTS "Teacher tasks policy" ON public.tasks;
DROP POLICY IF EXISTS "Student tasks policy" ON public.tasks;
DROP POLICY IF EXISTS "Teacher assignments policy" ON public.task_assignments;
DROP POLICY IF EXISTS "Student assignments policy" ON public.task_assignments;

-- Policies
CREATE POLICY "Teacher tasks policy" ON public.tasks
    FOR SELECT
    USING (class_id IN (SELECT id FROM public.classes WHERE owner_id = auth.uid()));

CREATE POLICY "Student tasks policy" ON public.tasks
    FOR SELECT
    USING (public.student_can_read_task(id));

CREATE POLICY "Teacher assignments policy" ON public.task_assignments
    FOR SELECT
    USING (class_id IN (SELECT id FROM public.classes WHERE owner_id = auth.uid()));

CREATE POLICY "Student assignments policy" ON public.task_assignments
    FOR SELECT
    USING (public.student_can_read_task_assignment(id));

-- Trigger for database-level class consistency
CREATE OR REPLACE FUNCTION public.validate_task_assignment()
RETURNS trigger AS $$
DECLARE
    v_task_class_id uuid;
    v_student_class_id uuid;
BEGIN
    SELECT class_id INTO v_task_class_id FROM public.tasks WHERE id = NEW.task_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task does not exist.';
    END IF;

    SELECT class_id INTO v_student_class_id FROM public.students WHERE id = NEW.student_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student does not exist.';
    END IF;

    IF v_task_class_id != NEW.class_id OR v_student_class_id != NEW.class_id THEN
        RAISE EXCEPTION 'Class mismatch: Task, Student, and Assignment must all belong to the same class.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_validate_task_assignment ON public.task_assignments;
CREATE TRIGGER trg_validate_task_assignment
    BEFORE INSERT OR UPDATE ON public.task_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_task_assignment();

-- RPCs
-- Clean up old signatures
DROP FUNCTION IF EXISTS public.create_task(uuid, text, text, timestamptz, integer, text, uuid[], boolean);
DROP FUNCTION IF EXISTS public.create_task(uuid, text, text, timestamptz, integer, text, uuid[]);
DROP FUNCTION IF EXISTS public.update_task(uuid, text, text, timestamptz, integer, text, uuid[]);
DROP FUNCTION IF EXISTS public.set_task_status(uuid, text);
DROP FUNCTION IF EXISTS public.submit_task_assignment(uuid, text);
DROP FUNCTION IF EXISTS public.review_task_assignment(uuid, text, text);

-- 1. create_task
CREATE OR REPLACE FUNCTION public.create_task(
    p_class_id uuid,
    p_title text,
    p_instructions text DEFAULT '',
    p_due_at timestamptz DEFAULT NULL,
    p_reward_points integer DEFAULT 0,
    p_assignment_scope text DEFAULT 'all_students',
    p_student_ids uuid[] DEFAULT NULL,
    p_publish_immediately boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_task_id uuid;
    v_teacher_id uuid;
    v_is_owner boolean;
    v_student_id uuid;
    v_status text;
    v_title_clean text;
    v_instructions_clean text;
    v_student_count integer := 0;
    v_student_ids uuid[] := COALESCE(p_student_ids, ARRAY[]::uuid[]);
    v_inserted_count integer := 0;
BEGIN
    v_teacher_id := auth.uid();
    IF v_teacher_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    
    -- Verify ownership
    SELECT EXISTS (
        SELECT 1 FROM public.classes WHERE id = p_class_id AND owner_id = v_teacher_id
    ) INTO v_is_owner;
    
    IF NOT v_is_owner THEN
        RAISE EXCEPTION 'Not authorized to create tasks for this class.';
    END IF;
    
    -- Normalize inputs
    v_title_clean := trim(p_title);
    v_instructions_clean := trim(p_instructions);
    
    IF length(v_title_clean) < 3 OR length(v_title_clean) > 100 THEN RAISE EXCEPTION 'Title must be between 3 and 100 characters.'; END IF;
    IF length(v_instructions_clean) > 5000 THEN RAISE EXCEPTION 'Instructions must not exceed 5000 characters.'; END IF;
    IF p_reward_points < 0 OR p_reward_points > 1000 THEN RAISE EXCEPTION 'Reward points must be between 0 and 1000.'; END IF;
    IF p_assignment_scope NOT IN ('all_students', 'selected_students') THEN RAISE EXCEPTION 'Invalid assignment scope.'; END IF;
    
    IF p_publish_immediately THEN
        v_status := 'active';
    ELSE
        v_status := 'draft';
    END IF;

    -- Pre-validate selected students
    IF p_assignment_scope = 'selected_students' THEN
        FOREACH v_student_id IN ARRAY v_student_ids
        LOOP
            IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = v_student_id AND class_id = p_class_id AND is_active = true AND deleted_at IS NULL) THEN
                RAISE EXCEPTION 'Student % is invalid, deleted, inactive, or belongs to another class.', v_student_id;
            END IF;
            v_student_count := v_student_count + 1;
        END LOOP;
        
        IF p_publish_immediately AND v_student_count = 0 THEN
            RAISE EXCEPTION 'Cannot publish a selected-student task with no valid students.';
        END IF;
    END IF;

    -- Create task
    INSERT INTO public.tasks (
        class_id, created_by, title, instructions, due_at, reward_points, assignment_scope, status, published_at
    ) VALUES (
        p_class_id, v_teacher_id, v_title_clean, v_instructions_clean, p_due_at, p_reward_points, p_assignment_scope, v_status,
        CASE WHEN p_publish_immediately THEN now() ELSE null END
    ) RETURNING id INTO v_task_id;
    
    -- Create assignments if publishing, OR if saving draft with selected students
    IF p_publish_immediately THEN
        IF p_assignment_scope = 'all_students' THEN
            INSERT INTO public.task_assignments (task_id, class_id, student_id)
            SELECT v_task_id, p_class_id, id
            FROM public.students
            WHERE class_id = p_class_id AND is_active = true AND deleted_at IS NULL;
            
            GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
            IF v_inserted_count = 0 THEN
                RAISE EXCEPTION 'Cannot publish task: no eligible active students in class.';
            END IF;
        ELSE
            -- selected students
            FOREACH v_student_id IN ARRAY v_student_ids
            LOOP
                INSERT INTO public.task_assignments (task_id, class_id, student_id)
                VALUES (v_task_id, p_class_id, v_student_id)
                ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;
    ELSE
        -- Saving draft
        IF p_assignment_scope = 'selected_students' AND v_student_count > 0 THEN
            FOREACH v_student_id IN ARRAY v_student_ids
            LOOP
                INSERT INTO public.task_assignments (task_id, class_id, student_id)
                VALUES (v_task_id, p_class_id, v_student_id)
                ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;
    END IF;
    
    RETURN v_task_id;
END;
$$;

-- 2. update_task
CREATE OR REPLACE FUNCTION public.update_task(
    p_task_id uuid,
    p_title text DEFAULT NULL,
    p_instructions text DEFAULT NULL,
    p_due_at timestamptz DEFAULT NULL,
    p_reward_points integer DEFAULT NULL,
    p_assignment_scope text DEFAULT NULL,
    p_student_ids uuid[] DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_task public.tasks%rowtype;
    v_is_owner boolean;
    v_student_id uuid;
    v_title_clean text;
    v_instructions_clean text;
    v_student_ids uuid[];
    v_current_assigned uuid[];
    v_due_at timestamptz;
    v_reward_points integer;
    v_assignment_scope text;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Task not found.'; END IF;
    
    SELECT EXISTS (
        SELECT 1 FROM public.classes WHERE id = v_task.class_id AND owner_id = auth.uid()
    ) INTO v_is_owner;
    IF NOT v_is_owner THEN RAISE EXCEPTION 'Not authorized to update this task.'; END IF;
    
    IF v_task.status = 'archived' THEN RAISE EXCEPTION 'Cannot edit archived tasks.'; END IF;
    
    v_title_clean := trim(COALESCE(p_title, v_task.title));
    v_instructions_clean := trim(COALESCE(p_instructions, v_task.instructions));
    v_due_at := COALESCE(p_due_at, v_task.due_at);
    v_reward_points := COALESCE(p_reward_points, v_task.reward_points);
    v_assignment_scope := COALESCE(p_assignment_scope, v_task.assignment_scope);
    
    -- For student_ids, if it's explicitly passed as empty array, we should probably respect it,
    -- but if it's NULL, we fallback to current assigned students if needed.
    -- Actually, if p_student_ids is NULL, we shouldn't change the assigned students.
    -- Let's fetch current assigned if p_student_ids is NULL.
    IF p_student_ids IS NULL THEN
        SELECT array_agg(student_id) INTO v_student_ids FROM public.task_assignments WHERE task_id = p_task_id;
        v_student_ids := COALESCE(v_student_ids, ARRAY[]::uuid[]);
    ELSE
        v_student_ids := p_student_ids;
    END IF;
    
    IF length(v_title_clean) < 3 OR length(v_title_clean) > 100 THEN RAISE EXCEPTION 'Title must be between 3 and 100 characters.'; END IF;
    IF length(v_instructions_clean) > 5000 THEN RAISE EXCEPTION 'Instructions must not exceed 5000 characters.'; END IF;
    IF v_reward_points < 0 OR v_reward_points > 1000 THEN RAISE EXCEPTION 'Reward points must be between 0 and 1000.'; END IF;
    
    IF v_reward_points != v_task.reward_points THEN
        IF EXISTS (SELECT 1 FROM public.task_assignments WHERE task_id = p_task_id AND status = 'approved') THEN
            RAISE EXCEPTION 'Cannot change reward points after assignments have been approved.';
        END IF;
    END IF;

    -- If completed, ONLY allow harmless metadata updates (title, instructions, due_at, reward_points)
    -- Reject scope changes and student updates.
    IF v_task.status = 'completed' THEN
        IF v_assignment_scope != v_task.assignment_scope THEN
            RAISE EXCEPTION 'Cannot change assignment scope of a completed task.';
        END IF;
        
        UPDATE public.tasks SET
            title = v_title_clean,
            instructions = v_instructions_clean,
            due_at = v_due_at,
            reward_points = v_reward_points,
            updated_at = now()
        WHERE id = p_task_id;
        
        RETURN p_task_id;
    END IF;

    -- For draft and active tasks:
    UPDATE public.tasks SET
        title = v_title_clean,
        instructions = v_instructions_clean,
        due_at = v_due_at,
        reward_points = v_reward_points,
        assignment_scope = v_assignment_scope,
        updated_at = now()
    WHERE id = p_task_id;
    
    -- Sync assignments if not completed
    -- If switching to all_students explicitly
    IF v_assignment_scope = 'all_students' THEN
        -- Only add if it wasn't already all_students AND it's active.
        -- "When changing a draft from selected_students to all_students: do not populate the all-student roster yet"
        -- "When changing active task intentionally to all_students: use current active, non-deleted roster once"
        IF v_task.assignment_scope != 'all_students' AND v_task.status = 'active' THEN
            INSERT INTO public.task_assignments (task_id, class_id, student_id)
            SELECT p_task_id, v_task.class_id, id
            FROM public.students
            WHERE class_id = v_task.class_id AND is_active = true AND deleted_at IS NULL
            ON CONFLICT DO NOTHING;
        END IF;
        -- We do not remove any assignments for all_students scope.
    ELSE
        -- Scope is selected_students
        -- Validate incoming students
        FOREACH v_student_id IN ARRAY v_student_ids
        LOOP
            IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = v_student_id AND class_id = v_task.class_id AND is_active = true AND deleted_at IS NULL) THEN
                RAISE EXCEPTION 'Student % is invalid, deleted, inactive, or belongs to another class.', v_student_id;
            END IF;
        END LOOP;

        IF v_task.status = 'active' AND array_length(v_student_ids, 1) IS NULL THEN
            RAISE EXCEPTION 'Active tasks with selected scope must have at least one student.';
        END IF;

        -- Find assignments to remove (untouched ones that are still 'assigned')
        DELETE FROM public.task_assignments 
        WHERE task_id = p_task_id 
          AND status = 'assigned'
          AND submission_text IS NULL
          AND NOT (student_id = ANY(v_student_ids));
        
        -- Check if any unselected students couldn't be removed
        IF EXISTS (
            SELECT 1 FROM public.task_assignments 
            WHERE task_id = p_task_id 
              AND NOT (student_id = ANY(v_student_ids))
        ) THEN
            RAISE EXCEPTION 'Cannot remove students who have submitted work or been approved.';
        END IF;

        -- Add missing ones
        FOREACH v_student_id IN ARRAY v_student_ids
        LOOP
            INSERT INTO public.task_assignments (task_id, class_id, student_id)
            VALUES (p_task_id, v_task.class_id, v_student_id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    RETURN p_task_id;
END;
$$;

-- 3. set_task_status
CREATE OR REPLACE FUNCTION public.set_task_status(
    p_task_id uuid,
    p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_task public.tasks%rowtype;
    v_is_owner boolean;
    v_inserted_count integer := 0;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Task not found.'; END IF;
    
    SELECT EXISTS (
        SELECT 1 FROM public.classes WHERE id = v_task.class_id AND owner_id = auth.uid()
    ) INTO v_is_owner;
    IF NOT v_is_owner THEN RAISE EXCEPTION 'Not authorized.'; END IF;
    
    IF p_status NOT IN ('draft', 'active', 'completed', 'archived') THEN RAISE EXCEPTION 'Invalid status.'; END IF;
    
    IF v_task.status = 'draft' AND p_status = 'active' THEN
        -- Populate assignments if all_students
        IF v_task.assignment_scope = 'all_students' THEN
            INSERT INTO public.task_assignments (task_id, class_id, student_id)
            SELECT p_task_id, v_task.class_id, id
            FROM public.students
            WHERE class_id = v_task.class_id AND is_active = true AND deleted_at IS NULL
            ON CONFLICT DO NOTHING;
        END IF;
        
        -- Verify at least one assignment exists
        IF NOT EXISTS (SELECT 1 FROM public.task_assignments WHERE task_id = p_task_id) THEN
            RAISE EXCEPTION 'Cannot publish task: no students are assigned.';
        END IF;

        UPDATE public.tasks SET status = 'active', published_at = now(), updated_at = now() WHERE id = p_task_id;
    ELSIF v_task.status = 'active' AND p_status = 'completed' THEN
        UPDATE public.tasks SET status = 'completed', completed_at = now(), updated_at = now() WHERE id = p_task_id;
    ELSIF p_status = 'archived' AND v_task.status IN ('draft', 'active', 'completed') THEN
        UPDATE public.tasks SET status = 'archived', updated_at = now() WHERE id = p_task_id;
    ELSE
        RAISE EXCEPTION 'Invalid status transition from % to %.', v_task.status, p_status;
    END IF;
END;
$$;

-- 4. submit_task_assignment
CREATE OR REPLACE FUNCTION public.submit_task_assignment(
    p_assignment_id uuid,
    p_submission_text text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_assignment public.task_assignments%rowtype;
    v_task public.tasks%rowtype;
    v_is_student boolean;
    v_submission_clean text;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT * INTO v_assignment FROM public.task_assignments WHERE id = p_assignment_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found.'; END IF;
    
    SELECT * INTO v_task FROM public.tasks WHERE id = v_assignment.task_id;
    
    SELECT EXISTS (
        SELECT 1 FROM public.students 
        WHERE id = v_assignment.student_id 
          AND student_auth_user_id = auth.uid()
          AND is_active = true
          AND access_enabled = true
          AND deleted_at IS NULL
    ) INTO v_is_student;
    IF NOT v_is_student THEN RAISE EXCEPTION 'Not authorized. Student must be active and linked.'; END IF;
    
    IF v_task.status != 'active' THEN RAISE EXCEPTION 'Task is not active.'; END IF;
    IF v_assignment.status NOT IN ('assigned', 'returned') THEN RAISE EXCEPTION 'Cannot submit in current state.'; END IF;
    
    v_submission_clean := trim(COALESCE(p_submission_text, ''));
    IF length(v_submission_clean) > 3000 THEN RAISE EXCEPTION 'Submission text exceeds maximum length.'; END IF;
    
    UPDATE public.task_assignments SET
        status = 'submitted',
        submission_text = CASE WHEN length(v_submission_clean) > 0 THEN v_submission_clean ELSE NULL END,
        submitted_at = now(),
        updated_at = now()
    WHERE id = p_assignment_id;
END;
$$;

-- 5. review_task_assignment
CREATE OR REPLACE FUNCTION public.review_task_assignment(
    p_assignment_id uuid,
    p_action text,
    p_feedback text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_assignment public.task_assignments%rowtype;
    v_task public.tasks%rowtype;
    v_student public.students%rowtype;
    v_is_owner boolean;
    v_new_total integer;
    v_feedback_clean text;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT * INTO v_assignment FROM public.task_assignments WHERE id = p_assignment_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found.'; END IF;
    
    SELECT * INTO v_task FROM public.tasks WHERE id = v_assignment.task_id;
    SELECT * INTO v_student FROM public.students WHERE id = v_assignment.student_id;
    
    IF v_task.class_id != v_assignment.class_id OR v_student.class_id != v_assignment.class_id THEN
        RAISE EXCEPTION 'Class mismatch detected.';
    END IF;
    
    SELECT EXISTS (
        SELECT 1 FROM public.classes WHERE id = v_assignment.class_id AND owner_id = auth.uid()
    ) INTO v_is_owner;
    IF NOT v_is_owner THEN RAISE EXCEPTION 'Not authorized.'; END IF;
    
    IF v_task.status IN ('draft', 'archived') THEN
        RAISE EXCEPTION 'Cannot review assignments for draft or archived tasks.';
    END IF;
    
    v_feedback_clean := trim(COALESCE(p_feedback, ''));
    IF length(v_feedback_clean) > 1000 THEN RAISE EXCEPTION 'Feedback exceeds maximum length.'; END IF;
    
    IF p_action = 'approve' THEN
        IF v_assignment.status = 'approved' THEN
            -- Idempotent
            RETURN json_build_object(
                'assignment', row_to_json(v_assignment),
                'points_awarded', 0,
                'student_new_total', v_student.total_points
            );
        END IF;
        
        -- Update student points EXACTLY once ONLY if reward > 0
        IF v_task.reward_points > 0 THEN
            UPDATE public.students 
            SET total_points = total_points + v_task.reward_points 
            WHERE id = v_assignment.student_id
            RETURNING total_points INTO v_new_total;
        ELSE
            v_new_total := v_student.total_points;
        END IF;
        
        -- Mark approved
        UPDATE public.task_assignments SET
            status = 'approved',
            teacher_feedback = CASE WHEN length(v_feedback_clean) > 0 THEN v_feedback_clean ELSE NULL END,
            reviewed_at = now(),
            reviewed_by = auth.uid(),
            points_awarded = v_task.reward_points,
            points_awarded_at = now(),
            updated_at = now()
        WHERE id = p_assignment_id
        RETURNING * INTO v_assignment;
        
        -- Create point event if points > 0
        IF v_task.reward_points > 0 THEN
            INSERT INTO public.point_events (
                class_id, student_id, task_assignment_id, points_delta, reason, created_at, meeting_id
            ) VALUES (
                v_assignment.class_id, v_assignment.student_id, p_assignment_id, v_task.reward_points, 
                'Task reward: ' || v_task.title, now(), null
            );
        END IF;
        
        RETURN json_build_object(
            'assignment', row_to_json(v_assignment),
            'points_awarded', v_task.reward_points,
            'student_new_total', v_new_total
        );
        
    ELSIF p_action = 'return' THEN
        IF v_assignment.status = 'approved' THEN
            RAISE EXCEPTION 'Cannot return an already approved assignment.';
        END IF;
        
        IF v_assignment.status != 'submitted' THEN
            RAISE EXCEPTION 'Cannot return assignment in current state.';
        END IF;
        
        UPDATE public.task_assignments SET
            status = 'returned',
            teacher_feedback = CASE WHEN length(v_feedback_clean) > 0 THEN v_feedback_clean ELSE NULL END,
            reviewed_at = now(),
            reviewed_by = auth.uid(),
            updated_at = now()
        WHERE id = p_assignment_id
        RETURNING * INTO v_assignment;
        
        RETURN json_build_object(
            'assignment', row_to_json(v_assignment),
            'points_awarded', 0,
            'student_new_total', v_student.total_points
        );
    ELSE
        RAISE EXCEPTION 'Invalid review action.';
    END IF;
END;
$$;

-- Security and revocation
REVOKE EXECUTE ON FUNCTION public.student_can_read_task(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.student_can_read_task_assignment(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_task(uuid, text, text, timestamptz, integer, text, uuid[], boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_task(uuid, text, text, timestamptz, integer, text, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_task_status(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_task_assignment(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.review_task_assignment(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_task_assignment() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.student_can_read_task(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_can_read_task_assignment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_task(uuid, text, text, timestamptz, integer, text, uuid[], boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_task(uuid, text, text, timestamptz, integer, text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_task_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_task_assignment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_task_assignment(uuid, text, text) TO authenticated;

-- Realtime publication idempotent
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tasks') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'task_assignments') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.task_assignments;
    END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
