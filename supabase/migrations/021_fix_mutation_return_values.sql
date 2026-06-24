-- Migration 021: Fix Mutation Return Values

-- 1. award_points
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

-- 2. remove_points
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

-- 3. remove_life
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
REVOKE ALL ON FUNCTION public.remove_life(uuid, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.remove_life(uuid, uuid, text) TO authenticated;

-- 4. restore_life
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

-- 5. reset_student_lives
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
