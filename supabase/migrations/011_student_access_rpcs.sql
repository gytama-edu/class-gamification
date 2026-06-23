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
    SET access_pin_hash = crypt(v_pin, gen_salt('bf', 8))
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
