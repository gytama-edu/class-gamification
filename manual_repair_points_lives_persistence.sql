-- Repair Points and Lives Persistence

-- Add unique constraint if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_meeting_states_meeting_id_student_id_key'
  ) THEN
    ALTER TABLE public.student_meeting_states ADD CONSTRAINT student_meeting_states_meeting_id_student_id_key UNIQUE (meeting_id, student_id);
  END IF;
END $$;

-- 1. start_new_meeting
CREATE OR REPLACE FUNCTION public.start_new_meeting(p_class_id uuid)
RETURNS uuid AS $$
DECLARE
  v_max_lives integer;
  v_meeting_number integer;
  v_new_meeting_id uuid;
  v_class_name text;
  v_level_name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = p_class_id AND teacher_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.meetings
  SET status = 'completed', ended_at = now()
  WHERE class_id = p_class_id AND status = 'active';

  SELECT max_lives, current_meeting_number, name, level_name 
  INTO v_max_lives, v_meeting_number, v_class_name, v_level_name
  FROM public.classes
  WHERE id = p_class_id FOR UPDATE;

  UPDATE public.classes
  SET current_meeting_number = current_meeting_number + 1, updated_at = now()
  WHERE id = p_class_id;

  INSERT INTO public.meetings (class_id, meeting_number, max_lives_snapshot, status, class_name_snapshot, level_name_snapshot)
  VALUES (p_class_id, v_meeting_number + 1, v_max_lives, 'active', v_class_name, v_level_name)
  RETURNING id INTO v_new_meeting_id;

  INSERT INTO public.student_meeting_states (meeting_id, student_id, lives_remaining)
  SELECT v_new_meeting_id, id, v_max_lives
  FROM public.students
  WHERE class_id = p_class_id AND is_active = true AND deleted_at IS NULL
  ON CONFLICT (meeting_id, student_id) DO NOTHING;
  
  RETURN v_new_meeting_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.start_new_meeting(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.start_new_meeting(uuid) TO authenticated;

-- 2. award_points
CREATE OR REPLACE FUNCTION public.award_points(p_class_id uuid, p_student_id uuid, p_points integer, p_reason text)
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
REVOKE ALL ON FUNCTION public.award_points(uuid, uuid, integer, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.award_points(uuid, uuid, integer, text) TO authenticated;

-- 3. remove_points
CREATE OR REPLACE FUNCTION public.remove_points(p_class_id uuid, p_student_id uuid, p_points integer, p_reason text)
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
REVOKE ALL ON FUNCTION public.remove_points(uuid, uuid, integer, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.remove_points(uuid, uuid, integer, text) TO authenticated;

-- 4. remove_life
CREATE OR REPLACE FUNCTION public.remove_life(p_class_id uuid, p_student_id uuid, p_reason text)
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
    -- Missing state repair safely
    INSERT INTO public.student_meeting_states (meeting_id, student_id, lives_remaining)
    VALUES (v_meeting_id, p_student_id, GREATEST(0, v_max_lives_snapshot - 1))
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
REVOKE ALL ON FUNCTION public.remove_life(uuid, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.remove_life(uuid, uuid, text) TO authenticated;

-- 5. restore_life
CREATE OR REPLACE FUNCTION public.restore_life(p_class_id uuid, p_student_id uuid, p_reason text)
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
REVOKE ALL ON FUNCTION public.restore_life(uuid, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.restore_life(uuid, uuid, text) TO authenticated;

-- 6. reset_student_lives
CREATE OR REPLACE FUNCTION public.reset_student_lives(p_class_id uuid, p_student_id uuid)
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
REVOKE ALL ON FUNCTION public.reset_student_lives(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reset_student_lives(uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Verification
-- SELECT routine_name, security_type FROM information_schema.routines WHERE routine_name IN ('award_points', 'remove_life', 'start_new_meeting');
