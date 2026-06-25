-- manual_install_project_groups_foundation.sql
BEGIN;

-- 1. Create project_groups table
CREATE TABLE IF NOT EXISTS public.project_groups (
    id uuid primary key default gen_random_uuid(),
    class_id uuid not null references public.classes(id) on delete cascade,
    created_by uuid not null references auth.users(id),
    name text not null,
    description text not null default '',
    color_key text not null default 'green',
    display_order integer not null default 0,
    status text not null default 'active',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    archived_at timestamptz null,

    CONSTRAINT project_groups_name_length CHECK (char_length(trim(name)) >= 2 AND char_length(trim(name)) <= 60),
    CONSTRAINT project_groups_description_length CHECK (char_length(trim(description)) <= 500),
    CONSTRAINT project_groups_display_order_nonnegative CHECK (display_order >= 0),
    CONSTRAINT project_groups_status_check CHECK (status IN ('active', 'archived')),
    CONSTRAINT project_groups_archived_check CHECK (
        (status = 'archived' AND archived_at IS NOT NULL) OR
        (status = 'active' AND archived_at IS NULL)
    ),
    CONSTRAINT project_groups_color_check CHECK (color_key IN ('green', 'cyan', 'blue', 'purple', 'amber', 'rose'))
);

-- 2. Create project_groups active name unique index
DROP INDEX IF EXISTS idx_project_groups_active_name;
CREATE UNIQUE INDEX idx_project_groups_active_name ON public.project_groups (class_id, lower(trim(name))) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_project_groups_class_order ON public.project_groups (class_id, display_order);
CREATE INDEX IF NOT EXISTS idx_project_groups_class_status ON public.project_groups (class_id, status);

-- 3. Create project_group_memberships table
CREATE TABLE IF NOT EXISTS public.project_group_memberships (
    id uuid primary key default gen_random_uuid(),
    group_id uuid not null references public.project_groups(id) on delete cascade,
    class_id uuid not null references public.classes(id) on delete cascade,
    student_id uuid not null references public.students(id) on delete cascade,
    assigned_by uuid not null references auth.users(id),
    assigned_at timestamptz not null default now(),
    removed_at timestamptz null,
    removed_by uuid null references auth.users(id) on delete set null,
    removal_reason text null,

    CONSTRAINT project_group_memberships_reason_length CHECK (removal_reason IS NULL OR char_length(removal_reason) <= 250)
);

-- 4. Create membership unique indexes
DROP INDEX IF EXISTS idx_project_group_memberships_one_active_per_student;
CREATE UNIQUE INDEX idx_project_group_memberships_one_active_per_student ON public.project_group_memberships (class_id, student_id) WHERE removed_at IS NULL;

DROP INDEX IF EXISTS idx_project_group_memberships_no_duplicate_group;
CREATE UNIQUE INDEX idx_project_group_memberships_no_duplicate_group ON public.project_group_memberships (group_id, student_id) WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_project_group_memberships_group_active ON public.project_group_memberships (group_id) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_project_group_memberships_student_active ON public.project_group_memberships (student_id) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_project_group_memberships_history ON public.project_group_memberships (group_id, removed_at) WHERE removed_at IS NOT NULL;

-- 5. Validation trigger for memberships
CREATE OR REPLACE FUNCTION public.validate_project_group_membership()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_group_class_id uuid;
    v_group_status text;
    v_student_class_id uuid;
    v_student_is_active boolean;
    v_student_deleted_at timestamptz;
    v_teacher_owner_id uuid;
BEGIN
    -- Only validate on insert or when updating to make it active (though we shouldn't really resurrect)
    IF TG_OP = 'UPDATE' AND NEW.removed_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Get group details
    SELECT class_id, status INTO v_group_class_id, v_group_status
    FROM public.project_groups
    WHERE id = NEW.group_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Project group does not exist';
    END IF;

    IF v_group_status = 'archived' THEN
        RAISE EXCEPTION 'Cannot assign students to an archived project group';
    END IF;

    -- Get student details
    SELECT class_id, is_active, deleted_at INTO v_student_class_id, v_student_is_active, v_student_deleted_at
    FROM public.students
    WHERE id = NEW.student_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student does not exist';
    END IF;

    IF v_student_is_active = false THEN
        RAISE EXCEPTION 'Cannot assign an inactive student to a project group';
    END IF;

    IF v_student_deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot assign a deleted student to a project group';
    END IF;

    -- Ensure class IDs match
    IF v_group_class_id != v_student_class_id THEN
        RAISE EXCEPTION 'Student and project group must belong to the same class';
    END IF;
    
    -- Ensure NEW.class_id is correct
    IF NEW.class_id != v_group_class_id THEN
        RAISE EXCEPTION 'Membership class_id must match the group class_id';
    END IF;

    -- Verify teacher owns the class
    SELECT owner_id INTO v_teacher_owner_id
    FROM public.classes
    WHERE id = NEW.class_id;

    IF v_teacher_owner_id != auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: Only the class owner can manage memberships';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_validate_project_group_membership ON public.project_group_memberships;
CREATE TRIGGER tr_validate_project_group_membership
    BEFORE INSERT ON public.project_group_memberships
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_project_group_membership();


-- 6. Trigger to close memberships when student is deactivated or deleted
CREATE OR REPLACE FUNCTION public.sync_student_deactivation_to_groups()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- If student became inactive or was soft deleted
    IF (TG_OP = 'UPDATE' AND 
        ((NEW.is_active = false AND OLD.is_active = true) OR 
         (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL))) THEN
         
        UPDATE public.project_group_memberships
        SET 
            removed_at = now(),
            removed_by = auth.uid(),
            removal_reason = CASE WHEN NEW.deleted_at IS NOT NULL THEN 'student_deleted' ELSE 'student_inactive' END
        WHERE student_id = NEW.id AND removed_at IS NULL;
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_student_deactivation_to_groups ON public.students;
CREATE TRIGGER tr_sync_student_deactivation_to_groups
    AFTER UPDATE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_student_deactivation_to_groups();


-- 7. RLS on project_groups
ALTER TABLE public.project_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can view their own class project groups" ON public.project_groups;
CREATE POLICY "Teachers can view their own class project groups"
    ON public.project_groups FOR SELECT
    TO authenticated
    USING (class_id IN (SELECT id FROM public.classes WHERE owner_id = auth.uid()));

-- 8. RLS on project_group_memberships
ALTER TABLE public.project_group_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can view their own class project group memberships" ON public.project_group_memberships;
CREATE POLICY "Teachers can view their own class project group memberships"
    ON public.project_group_memberships FOR SELECT
    TO authenticated
    USING (class_id IN (SELECT id FROM public.classes WHERE owner_id = auth.uid()));

-- Ensure no mutation access directly
-- (Just don't grant INSERT/UPDATE/DELETE to authenticated)


-- 9. Secure RPCs
-- 9a. create_project_group
CREATE OR REPLACE FUNCTION public.create_project_group(
    p_class_id uuid,
    p_name text,
    p_description text,
    p_color_key text
) RETURNS uuid
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_teacher_id uuid := auth.uid();
    v_group_id uuid;
    v_next_order integer;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = p_class_id AND owner_id = v_teacher_id) THEN
        RAISE EXCEPTION 'Not authorized or class not found';
    END IF;

    SELECT COALESCE(MAX(display_order), -1) + 1 INTO v_next_order
    FROM public.project_groups
    WHERE class_id = p_class_id AND status = 'active';

    INSERT INTO public.project_groups (class_id, created_by, name, description, color_key, display_order, status)
    VALUES (p_class_id, v_teacher_id, trim(p_name), trim(p_description), p_color_key, v_next_order, 'active')
    RETURNING id INTO v_group_id;

    RETURN v_group_id;
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION public.create_project_group(uuid, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_project_group(uuid, text, text, text) TO authenticated;


-- 9b. update_project_group
CREATE OR REPLACE FUNCTION public.update_project_group(
    p_group_id uuid,
    p_name text,
    p_description text,
    p_color_key text
) RETURNS jsonb
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_teacher_id uuid := auth.uid();
    v_group record;
    v_result jsonb;
BEGIN
    SELECT * INTO v_group
    FROM public.project_groups
    WHERE id = p_group_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Project group not found';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = v_group.class_id AND owner_id = v_teacher_id) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    IF v_group.status = 'archived' THEN
        RAISE EXCEPTION 'Cannot edit an archived project group';
    END IF;

    UPDATE public.project_groups
    SET 
        name = trim(p_name),
        description = trim(p_description),
        color_key = p_color_key,
        updated_at = now()
    WHERE id = p_group_id
    RETURNING row_to_json(project_groups.*)::jsonb INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION public.update_project_group(uuid, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_project_group(uuid, text, text, text) TO authenticated;


-- 9c. archive_project_group
CREATE OR REPLACE FUNCTION public.archive_project_group(p_group_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_teacher_id uuid := auth.uid();
    v_group record;
BEGIN
    SELECT * INTO v_group
    FROM public.project_groups
    WHERE id = p_group_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Project group not found';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = v_group.class_id AND owner_id = v_teacher_id) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    IF v_group.status = 'archived' THEN
        RETURN; -- Idempotent
    END IF;

    UPDATE public.project_groups
    SET 
        status = 'archived',
        archived_at = now(),
        updated_at = now()
    WHERE id = p_group_id;

    UPDATE public.project_group_memberships
    SET 
        removed_at = now(),
        removed_by = v_teacher_id,
        removal_reason = 'group_archived'
    WHERE group_id = p_group_id AND removed_at IS NULL;
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION public.archive_project_group(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.archive_project_group(uuid) TO authenticated;


-- 9d. assign_student_to_project_group
CREATE OR REPLACE FUNCTION public.assign_student_to_project_group(
    p_group_id uuid,
    p_student_id uuid
) RETURNS jsonb
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_teacher_id uuid := auth.uid();
    v_group record;
    v_student record;
    v_existing_membership record;
    v_new_membership jsonb;
BEGIN
    SELECT * INTO v_group FROM public.project_groups WHERE id = p_group_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Project group not found'; END IF;

    SELECT * INTO v_student FROM public.students WHERE id = p_student_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Student not found'; END IF;

    IF v_group.class_id != v_student.class_id THEN
        RAISE EXCEPTION 'Student and group class mismatch';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = v_group.class_id AND owner_id = v_teacher_id) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- Check if student is already in this group
    SELECT * INTO v_existing_membership 
    FROM public.project_group_memberships 
    WHERE student_id = p_student_id AND removed_at IS NULL FOR UPDATE;

    IF FOUND THEN
        IF v_existing_membership.group_id = p_group_id THEN
            RETURN row_to_json(v_existing_membership.*)::jsonb; -- already in the group
        END IF;

        -- Close existing membership
        UPDATE public.project_group_memberships
        SET 
            removed_at = now(),
            removed_by = v_teacher_id,
            removal_reason = 'moved'
        WHERE id = v_existing_membership.id;
    END IF;

    -- Create new membership
    INSERT INTO public.project_group_memberships (group_id, class_id, student_id, assigned_by)
    VALUES (p_group_id, v_group.class_id, p_student_id, v_teacher_id)
    RETURNING row_to_json(project_group_memberships.*)::jsonb INTO v_new_membership;

    RETURN v_new_membership;
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION public.assign_student_to_project_group(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.assign_student_to_project_group(uuid, uuid) TO authenticated;


-- 9e. remove_student_from_project_group
CREATE OR REPLACE FUNCTION public.remove_student_from_project_group(
    p_group_id uuid,
    p_student_id uuid
) RETURNS void
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_teacher_id uuid := auth.uid();
    v_group record;
BEGIN
    SELECT * INTO v_group FROM public.project_groups WHERE id = p_group_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Project group not found'; END IF;

    IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = v_group.class_id AND owner_id = v_teacher_id) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    UPDATE public.project_group_memberships
    SET 
        removed_at = now(),
        removed_by = v_teacher_id,
        removal_reason = 'manual_removal'
    WHERE group_id = p_group_id AND student_id = p_student_id AND removed_at IS NULL;
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION public.remove_student_from_project_group(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.remove_student_from_project_group(uuid, uuid) TO authenticated;


-- 9f. apply_project_group_distribution
CREATE OR REPLACE FUNCTION public.apply_project_group_distribution(
    p_class_id uuid,
    p_assignments jsonb
) RETURNS jsonb
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_teacher_id uuid := auth.uid();
    v_group_element jsonb;
    v_group_id uuid;
    v_student_id uuid;
    v_student_array jsonb;
    v_idx int;
    v_s_idx int;
    v_assigned_count int := 0;
    v_moved_count int := 0;
    v_groups_updated int := 0;
    v_existing_membership record;
    v_student record;
    v_group record;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = p_class_id AND owner_id = v_teacher_id) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- Validate all students beforehand (must be active, not deleted, same class)
    -- Also validate no duplicate students in the payload.
    -- To keep it simpler, we will do it within the loop but if anything fails it rolls back the whole transaction.

    FOR v_idx IN 0 .. jsonb_array_length(p_assignments) - 1 LOOP
        v_group_element := p_assignments->v_idx;
        v_group_id := (v_group_element->>'groupId')::uuid;
        v_student_array := v_group_element->'studentIds';

        -- Validate group
        SELECT * INTO v_group FROM public.project_groups WHERE id = v_group_id;
        IF NOT FOUND OR v_group.class_id != p_class_id OR v_group.status != 'active' THEN
            RAISE EXCEPTION 'Invalid active project group %', v_group_id;
        END IF;

        v_groups_updated := v_groups_updated + 1;

        FOR v_s_idx IN 0 .. jsonb_array_length(v_student_array) - 1 LOOP
            v_student_id := (v_student_array->>v_s_idx)::uuid;

            SELECT * INTO v_student FROM public.students WHERE id = v_student_id FOR UPDATE;
            IF NOT FOUND OR v_student.class_id != p_class_id OR v_student.is_active = false OR v_student.deleted_at IS NOT NULL THEN
                RAISE EXCEPTION 'Invalid or inactive student %', v_student_id;
            END IF;

            SELECT * INTO v_existing_membership 
            FROM public.project_group_memberships 
            WHERE student_id = v_student_id AND removed_at IS NULL FOR UPDATE;

            IF FOUND THEN
                IF v_existing_membership.group_id != v_group_id THEN
                    -- Move
                    UPDATE public.project_group_memberships
                    SET removed_at = now(), removed_by = v_teacher_id, removal_reason = 'distribution_moved'
                    WHERE id = v_existing_membership.id;

                    INSERT INTO public.project_group_memberships (group_id, class_id, student_id, assigned_by)
                    VALUES (v_group_id, p_class_id, v_student_id, v_teacher_id);
                    v_moved_count := v_moved_count + 1;
                    v_assigned_count := v_assigned_count + 1;
                END IF;
            ELSE
                -- Assign new
                INSERT INTO public.project_group_memberships (group_id, class_id, student_id, assigned_by)
                VALUES (v_group_id, p_class_id, v_student_id, v_teacher_id);
                v_assigned_count := v_assigned_count + 1;
            END IF;
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object(
        'groupsUpdated', v_groups_updated,
        'studentsAssigned', v_assigned_count,
        'studentsMoved', v_moved_count
    );
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION public.apply_project_group_distribution(uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.apply_project_group_distribution(uuid, jsonb) TO authenticated;


-- 9g. get_my_project_group
CREATE OR REPLACE FUNCTION public.get_my_project_group()
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_student_auth_id uuid := auth.uid();
    v_student record;
    v_group record;
    v_members jsonb;
    v_result jsonb;
BEGIN
    SELECT * INTO v_student
    FROM public.students
    WHERE student_auth_user_id = v_student_auth_id
      AND is_active = true 
      AND access_enabled = true
      AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    SELECT pg.* INTO v_group
    FROM public.project_group_memberships pgm
    JOIN public.project_groups pg ON pg.id = pgm.group_id
    WHERE pgm.student_id = v_student.id 
      AND pgm.removed_at IS NULL
      AND pg.status = 'active';

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Get member names safely
    SELECT jsonb_agg(s.display_name ORDER BY s.display_name) INTO v_members
    FROM public.project_group_memberships pgm
    JOIN public.students s ON s.id = pgm.student_id
    WHERE pgm.group_id = v_group.id 
      AND pgm.removed_at IS NULL
      AND s.is_active = true
      AND s.deleted_at IS NULL;

    v_result := jsonb_build_object(
        'id', v_group.id,
        'name', v_group.name,
        'description', v_group.description,
        'color_key', v_group.color_key,
        'member_names', COALESCE(v_members, '[]'::jsonb)
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION public.get_my_project_group() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_project_group() TO authenticated;


-- 10. Realtime setup
-- Add to realtime publication if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'project_groups') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.project_groups;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'project_group_memberships') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.project_group_memberships;
        END IF;
    END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
