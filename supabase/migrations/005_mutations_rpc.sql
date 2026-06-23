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
