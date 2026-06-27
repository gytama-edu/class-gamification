-- 033_project_group_tasks_rpc_update.sql

-- Drop the old functions to recreate with new signatures
DROP FUNCTION IF EXISTS public.create_project_group_task(uuid, text, text, timestamptz, integer, uuid[], boolean);
DROP FUNCTION IF EXISTS public.update_project_group_task(uuid, text, text, timestamptz, integer, uuid[]);

-- 1. create_project_group_task with submission settings
CREATE OR REPLACE FUNCTION public.create_project_group_task(
    p_class_id uuid,
    p_title text,
    p_instructions text,
    p_due_at timestamptz,
    p_reward_points integer,
    p_project_group_ids uuid[],
    p_publish_immediately boolean,
    p_allow_submission_text boolean DEFAULT true,
    p_allow_submission_files boolean DEFAULT false,
    p_require_submission_file boolean DEFAULT false,
    p_allowed_submission_file_categories text[] DEFAULT ARRAY['images', 'documents'],
    p_max_submission_files integer DEFAULT 5,
    p_max_submission_file_size_bytes bigint DEFAULT 10485760,
    p_max_submission_total_size_bytes bigint DEFAULT 31457280
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_task_id uuid;
    v_status text;
    v_group_id uuid;
    v_group record;
    v_member record;
    v_member_count integer;
    v_published_at timestamptz := NULL;
    v_assignment_id uuid;
    v_teacher_id uuid := auth.uid();
BEGIN
    -- Verify ownership securely
    IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = p_class_id AND owner_id = v_teacher_id) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Validation
    IF p_publish_immediately AND (array_length(p_project_group_ids, 1) IS NULL OR array_length(p_project_group_ids, 1) = 0) THEN
        RAISE EXCEPTION 'Must select at least one group to publish immediately';
    END IF;

    IF p_publish_immediately THEN
        v_status := 'active';
        v_published_at := now();
    ELSE
        v_status := 'draft';
    END IF;

    -- Create task
    INSERT INTO public.tasks (
        class_id, created_by, title, instructions, due_at, reward_points,
        assignment_scope, status, published_at,
        allow_submission_text, allow_submission_files, require_submission_file,
        allowed_submission_file_categories, max_submission_files,
        max_submission_file_size_bytes, max_submission_total_size_bytes
    )
    VALUES (
        p_class_id, v_teacher_id, p_title, p_instructions, p_due_at, p_reward_points,
        'project_groups', v_status, v_published_at,
        p_allow_submission_text, p_allow_submission_files, p_require_submission_file,
        p_allowed_submission_file_categories, p_max_submission_files,
        p_max_submission_file_size_bytes, p_max_submission_total_size_bytes
    )
    RETURNING id INTO v_task_id;

    -- Create group assignments
    IF p_project_group_ids IS NOT NULL AND array_length(p_project_group_ids, 1) > 0 THEN
        FOREACH v_group_id IN ARRAY p_project_group_ids
        LOOP
            SELECT * INTO v_group FROM public.project_groups WHERE id = v_group_id AND class_id = p_class_id;
            
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Group % not found in this class', v_group_id;
            END IF;

            IF v_group.status = 'archived' THEN
                RAISE EXCEPTION 'Cannot assign task to archived group %', v_group.name;
            END IF;

            IF p_publish_immediately THEN
                SELECT COUNT(*) INTO v_member_count FROM public.project_group_members WHERE project_group_id = v_group_id AND status = 'active';
                IF v_member_count = 0 THEN
                    RAISE EXCEPTION 'Group % has no active members', v_group.name;
                END IF;

                INSERT INTO public.task_project_group_assignments (
                    task_id, class_id, project_group_id,
                    group_name_snapshot, group_color_key_snapshot, member_count_snapshot,
                    status, snapshot_at, reward_points_per_member
                )
                VALUES (
                    v_task_id, p_class_id, v_group_id,
                    v_group.name, v_group.color_key, v_member_count,
                    'assigned', now(), p_reward_points
                )
                RETURNING id INTO v_assignment_id;

                FOR v_member IN 
                    SELECT pgm.student_id 
                    FROM public.project_group_members pgm
                    JOIN public.students s ON s.id = pgm.student_id
                    WHERE pgm.project_group_id = v_group_id AND pgm.status = 'active' AND s.deleted_at IS NULL
                LOOP
                    INSERT INTO public.task_assignments (
                        task_id, class_id, student_id, status, project_group_assignment_id
                    )
                    VALUES (
                        v_task_id, p_class_id, v_member.student_id, 'assigned', v_assignment_id
                    );
                END LOOP;
            ELSE
                INSERT INTO public.task_project_group_assignments (
                    task_id, class_id, project_group_id, status
                )
                VALUES (
                    v_task_id, p_class_id, v_group_id, 'pending'
                );
            END IF;
        END LOOP;
    END IF;

    RETURN v_task_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_project_group_task FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_project_group_task TO authenticated;

-- 2. update_project_group_task with submission settings
CREATE OR REPLACE FUNCTION public.update_project_group_task(
    p_task_id uuid,
    p_title text,
    p_instructions text,
    p_due_at timestamptz,
    p_reward_points integer,
    p_project_group_ids uuid[],
    p_allow_submission_text boolean DEFAULT true,
    p_allow_submission_files boolean DEFAULT false,
    p_require_submission_file boolean DEFAULT false,
    p_allowed_submission_file_categories text[] DEFAULT ARRAY['images', 'documents'],
    p_max_submission_files integer DEFAULT 5,
    p_max_submission_file_size_bytes bigint DEFAULT 10485760,
    p_max_submission_total_size_bytes bigint DEFAULT 31457280
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_task public.tasks%rowtype;
    v_group_id uuid;
    v_group record;
    v_teacher_id uuid := auth.uid();
BEGIN
    SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task not found';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = v_task.class_id AND owner_id = v_teacher_id) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    IF v_task.status != 'draft' THEN
        RAISE EXCEPTION 'Only draft tasks can be updated';
    END IF;

    UPDATE public.tasks SET
        title = COALESCE(p_title, title),
        instructions = COALESCE(p_instructions, instructions),
        due_at = p_due_at,
        reward_points = COALESCE(p_reward_points, reward_points),
        allow_submission_text = COALESCE(p_allow_submission_text, allow_submission_text),
        allow_submission_files = COALESCE(p_allow_submission_files, allow_submission_files),
        require_submission_file = COALESCE(p_require_submission_file, require_submission_file),
        allowed_submission_file_categories = COALESCE(p_allowed_submission_file_categories, allowed_submission_file_categories),
        max_submission_files = COALESCE(p_max_submission_files, max_submission_files),
        max_submission_file_size_bytes = COALESCE(p_max_submission_file_size_bytes, max_submission_file_size_bytes),
        max_submission_total_size_bytes = COALESCE(p_max_submission_total_size_bytes, max_submission_total_size_bytes),
        updated_at = now()
    WHERE id = p_task_id;

    IF p_project_group_ids IS NOT NULL THEN
        DELETE FROM public.task_project_group_assignments 
        WHERE task_id = p_task_id AND NOT (project_group_id = ANY(p_project_group_ids));
        
        FOREACH v_group_id IN ARRAY p_project_group_ids
        LOOP
            IF NOT EXISTS (SELECT 1 FROM public.task_project_group_assignments WHERE task_id = p_task_id AND project_group_id = v_group_id) THEN
                SELECT * INTO v_group FROM public.project_groups WHERE id = v_group_id AND class_id = v_task.class_id;
                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Group % not found in this class', v_group_id;
                END IF;
                IF v_group.status = 'archived' THEN
                    RAISE EXCEPTION 'Cannot assign task to archived group %', v_group.name;
                END IF;
                INSERT INTO public.task_project_group_assignments (
                    task_id, class_id, project_group_id, status
                ) VALUES (
                    p_task_id, v_task.class_id, v_group_id, 'pending'
                );
            END IF;
        END LOOP;
    END IF;

    RETURN p_task_id;
END;
$$;
REVOKE ALL ON FUNCTION public.update_project_group_task FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_project_group_task TO authenticated;

-- Reload schema cache to ensure the frontend picks it up immediately
NOTIFY pgrst, 'reload schema';
