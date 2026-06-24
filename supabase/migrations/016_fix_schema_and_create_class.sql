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
