-- Phase 4 - Student Login and Session Stabilization

BEGIN;

-- 1. Create Login Attempts Table
CREATE TABLE IF NOT EXISTS public.student_login_attempts (
    auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    attempt_count integer DEFAULT 0,
    window_start timestamptz DEFAULT now(),
    last_attempt timestamptz DEFAULT now(),
    blocked_until timestamptz
);

REVOKE ALL ON public.student_login_attempts FROM public, anon, authenticated;

-- 2. Prevent one anonymous user from being linked to multiple students
-- Safely clear duplicate bindings first
UPDATE public.students s1
SET student_auth_user_id = NULL
WHERE s1.student_auth_user_id IS NOT NULL 
  AND s1.id NOT IN (
    SELECT id
    FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY student_auth_user_id ORDER BY access_activated_at DESC NULLS LAST, updated_at DESC) as rn
      FROM public.students
      WHERE student_auth_user_id IS NOT NULL
    ) ranked
    WHERE ranked.rn = 1
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_student_auth_user_id 
ON public.students(student_auth_user_id) 
WHERE student_auth_user_id IS NOT NULL;

-- 3. Repair generate_student_pin
CREATE OR REPLACE FUNCTION public.generate_student_pin(p_student_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pin text;
    v_class_id uuid;
    v_is_unique boolean;
    v_teacher_id uuid := auth.uid();
BEGIN
    IF v_teacher_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Ensure user owns the student's class and student is not deleted
    SELECT c.id INTO v_class_id
    FROM public.students s
    JOIN public.classes c ON s.class_id = c.id
    WHERE s.id = p_student_id AND c.owner_id = v_teacher_id AND s.deleted_at IS NULL;

    IF v_class_id IS NULL THEN
        RAISE EXCEPTION 'Not authorized or student not found';
    END IF;

    -- Lock the class to prevent concurrent pin generation collisions
    PERFORM 1 FROM public.classes WHERE id = v_class_id FOR UPDATE;

    -- Generate a unique 4-digit PIN for the class
    FOR i IN 1..100 LOOP
        v_pin := lpad(floor(random() * 10000)::text, 4, '0');
        
        -- Check if it's unique among non-deleted students in the class
        SELECT NOT EXISTS (
            SELECT 1 FROM public.students
            WHERE class_id = v_class_id 
              AND deleted_at IS NULL
              AND access_pin_hash IS NOT NULL 
              AND access_pin_hash = crypt(v_pin, access_pin_hash)
        ) INTO v_is_unique;

        EXIT WHEN v_is_unique;
    END LOOP;

    IF NOT v_is_unique THEN
        RAISE EXCEPTION 'Could not generate a unique PIN. Please try again.';
    END IF;

    -- Hash and store the PIN
    UPDATE public.students
    SET access_pin_hash = crypt(v_pin, gen_salt('bf', 8)),
        pin_generated_at = now()
    WHERE id = p_student_id;

    RETURN v_pin;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_student_pin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_student_pin(uuid) TO authenticated;

-- 4. Repair join_class_as_student
CREATE OR REPLACE FUNCTION public.join_class_as_student(
  p_class_code text,
  p_student_pin text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_class record;
    v_student record;
    v_user_id uuid := auth.uid();
    v_normalized_code text;
    v_normalized_pin text;
    v_attempt record;
    v_linked_student_id uuid;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Enforce rate limits
    SELECT * INTO v_attempt FROM public.student_login_attempts WHERE auth_user_id = v_user_id;
    
    IF v_attempt IS NOT NULL THEN
        IF v_attempt.blocked_until IS NOT NULL AND v_attempt.blocked_until > now() THEN
            RAISE EXCEPTION 'RATE_LIMITED';
        END IF;
        
        IF v_attempt.window_start < now() - interval '15 minutes' THEN
            -- Reset window
            UPDATE public.student_login_attempts
            SET attempt_count = 0, window_start = now(), blocked_until = NULL
            WHERE auth_user_id = v_user_id;
        END IF;
    END IF;

    v_normalized_code := upper(trim(p_class_code));
    v_normalized_pin := trim(p_student_pin);

    IF length(v_normalized_code) != 6 OR length(v_normalized_pin) != 4 THEN
        PERFORM public.increment_student_login_attempt(v_user_id);
        RAISE EXCEPTION 'INVALID_CREDENTIALS';
    END IF;

    -- Find class by code
    SELECT * INTO v_class
    FROM public.classes
    WHERE upper(join_code) = v_normalized_code
      AND status = 'active';

    IF v_class IS NULL THEN
        PERFORM public.increment_student_login_attempt(v_user_id);
        RAISE EXCEPTION 'INVALID_CREDENTIALS';
    END IF;

    IF v_class.student_access_enabled = false THEN
        RAISE EXCEPTION 'CLASS_ACCESS_DISABLED';
    END IF;

    -- Find student by PIN hash
    SELECT * INTO v_student
    FROM public.students
    WHERE class_id = v_class.id
      AND deleted_at IS NULL
      AND access_pin_hash IS NOT NULL
      AND access_pin_hash = crypt(v_normalized_pin, access_pin_hash);

    IF v_student IS NULL THEN
        PERFORM public.increment_student_login_attempt(v_user_id);
        RAISE EXCEPTION 'INVALID_CREDENTIALS';
    END IF;

    IF v_student.is_active = false OR v_student.access_enabled = false THEN
        RAISE EXCEPTION 'STUDENT_ACCESS_DISABLED';
    END IF;

    -- Check if student is already linked to another user
    IF v_student.student_auth_user_id IS NOT NULL AND v_student.student_auth_user_id != v_user_id THEN
        RAISE EXCEPTION 'ACCOUNT_LINKED_TO_OTHER_DEVICE';
    END IF;

    -- Check if current anonymous session is linked to another student
    SELECT id INTO v_linked_student_id FROM public.students WHERE student_auth_user_id = v_user_id AND id != v_student.id;
    IF v_linked_student_id IS NOT NULL THEN
        RAISE EXCEPTION 'SESSION_LINKED_TO_OTHER_STUDENT';
    END IF;

    -- Lock the student row
    PERFORM 1 FROM public.students WHERE id = v_student.id FOR UPDATE;

    -- Link the student to this auth user
    UPDATE public.students
    SET 
      student_auth_user_id = v_user_id,
      access_activated_at = now()
    WHERE id = v_student.id;

    -- Reset attempts
    DELETE FROM public.student_login_attempts WHERE auth_user_id = v_user_id;

    RETURN jsonb_build_object(
        'student_id', v_student.id,
        'class_id', v_class.id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.join_class_as_student(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_class_as_student(text, text) TO authenticated;

-- Helper to increment attempt
CREATE OR REPLACE FUNCTION public.increment_student_login_attempt(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_attempt record;
BEGIN
    INSERT INTO public.student_login_attempts (auth_user_id, attempt_count, window_start, last_attempt)
    VALUES (p_user_id, 1, now(), now())
    ON CONFLICT (auth_user_id) DO UPDATE
    SET attempt_count = student_login_attempts.attempt_count + 1,
        last_attempt = now(),
        blocked_until = CASE 
            WHEN student_login_attempts.attempt_count + 1 >= 8 THEN now() + interval '15 minutes'
            ELSE student_login_attempts.blocked_until
        END;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_student_login_attempt(uuid) FROM PUBLIC, anon, authenticated;

-- 5. get_my_student_session
CREATE OR REPLACE FUNCTION public.get_my_student_session()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_student record;
    v_class record;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT * INTO v_student
    FROM public.students
    WHERE student_auth_user_id = v_user_id;

    IF v_student IS NULL THEN
        RETURN NULL;
    END IF;

    IF v_student.deleted_at IS NOT NULL OR v_student.is_active = false OR v_student.access_enabled = false THEN
        RETURN NULL;
    END IF;

    SELECT * INTO v_class
    FROM public.classes
    WHERE id = v_student.class_id;

    IF v_class IS NULL OR v_class.status != 'active' OR v_class.student_access_enabled = false THEN
        RETURN NULL;
    END IF;

    RETURN jsonb_build_object(
        'student_id', v_student.id,
        'class_id', v_class.id,
        'display_name', v_student.display_name,
        'class_name', v_class.name,
        'class_level', v_class.level,
        'class_type', v_class.class_type,
        'access_valid', true
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_student_session() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_student_session() TO authenticated;

-- 6. release_my_student_session
CREATE OR REPLACE FUNCTION public.release_my_student_session()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    UPDATE public.students
    SET student_auth_user_id = NULL,
        access_activated_at = NULL
    WHERE student_auth_user_id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.release_my_student_session() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_my_student_session() TO authenticated;

-- 7. get_my_student_dashboard
CREATE OR REPLACE FUNCTION public.get_my_student_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_student record;
    v_class record;
    v_active_meeting record;
    v_rank integer;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT * INTO v_student
    FROM public.students
    WHERE student_auth_user_id = v_user_id
      AND deleted_at IS NULL
      AND is_active = true
      AND access_enabled = true;

    IF v_student IS NULL THEN
        RAISE EXCEPTION 'Student session not valid';
    END IF;

    SELECT * INTO v_class
    FROM public.classes
    WHERE id = v_student.class_id
      AND status = 'active'
      AND student_access_enabled = true;

    IF v_class IS NULL THEN
        RAISE EXCEPTION 'Class access not valid';
    END IF;

    SELECT * INTO v_active_meeting
    FROM public.meetings
    WHERE class_id = v_class.id
      AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;

    -- Calculate rank among active, non-deleted students
    SELECT COUNT(*) + 1 INTO v_rank
    FROM public.students
    WHERE class_id = v_class.id
      AND is_active = true
      AND deleted_at IS NULL
      AND total_points > v_student.total_points;

    RETURN jsonb_build_object(
        'student', jsonb_build_object(
            'id', v_student.id,
            'class_id', v_student.class_id,
            'display_name', v_student.display_name,
            'avatar_key', v_student.avatar_key,
            'total_points', v_student.total_points,
            'is_active', v_student.is_active
        ),
        'classroom', jsonb_build_object(
            'id', v_class.id,
            'name', v_class.name,
            'level', v_class.level,
            'max_lives', v_class.max_lives,
            'current_meeting_number', v_class.current_meeting_number,
            'class_type', v_class.class_type
        ),
        'current_meeting', CASE WHEN v_active_meeting IS NOT NULL THEN jsonb_build_object(
            'id', v_active_meeting.id,
            'meeting_number', v_active_meeting.meeting_number,
            'status', v_active_meeting.status,
            'start_time', v_active_meeting.start_time,
            'max_lives_snapshot', v_active_meeting.max_lives_snapshot
        ) ELSE NULL END,
        'state', jsonb_build_object(
            'lives_remaining', v_student.lives_remaining,
            'rank', v_rank
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_student_dashboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_student_dashboard() TO authenticated;

-- 8. reset_student_device
CREATE OR REPLACE FUNCTION public.reset_student_device(p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_class_owner uuid;
    v_teacher_id uuid := auth.uid();
BEGIN
    IF v_teacher_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT c.owner_id INTO v_class_owner
    FROM public.students s
    JOIN public.classes c ON s.class_id = c.id
    WHERE s.id = p_student_id;

    IF v_class_owner IS NULL OR v_class_owner != v_teacher_id THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    UPDATE public.students
    SET student_auth_user_id = NULL,
        access_activated_at = NULL
    WHERE id = p_student_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_student_device(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_student_device(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
