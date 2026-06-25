BEGIN;

-- Add class_type to classes table
ALTER TABLE public.classes 
ADD COLUMN IF NOT EXISTS class_type text DEFAULT 'regular';

-- Backfill invalid or null values
UPDATE public.classes 
SET class_type = 'regular' 
WHERE class_type IS NULL OR class_type NOT IN ('regular', 'private');

-- Set NOT NULL constraint
ALTER TABLE public.classes 
ALTER COLUMN class_type SET NOT NULL;

-- Add check constraint safely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'classes_class_type_check' 
        AND table_name = 'classes' 
        AND constraint_schema = 'public'
    ) THEN
        ALTER TABLE public.classes ADD CONSTRAINT classes_class_type_check CHECK (class_type IN ('regular', 'private'));
    END IF;
END $$;

-- Drop old function
DROP FUNCTION IF EXISTS public.create_class(text, text, integer);

-- Create new create_class
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

-- Drop old update_class
DROP FUNCTION IF EXISTS public.update_class(uuid, text, text, integer);

-- Create new update_class
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

NOTIFY pgrst, 'reload schema';

COMMIT;

-- VERIFICATION QUERIES
/*
SELECT column_name, column_default, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_name = 'classes' AND column_name = 'class_type';

SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'classes_class_type_check';

SELECT class_type, COUNT(*) FROM public.classes GROUP BY class_type;

SELECT p.proname, p.prosecdef, pg_get_function_arguments(p.oid) as args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname IN ('create_class', 'update_class', 'end_meeting', 'take_snapshot_student', 'take_snapshot_class');

SELECT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'achievements'
) as achievements_table_exists;
*/
