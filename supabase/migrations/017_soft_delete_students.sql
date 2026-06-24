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
