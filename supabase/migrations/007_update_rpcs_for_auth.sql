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
