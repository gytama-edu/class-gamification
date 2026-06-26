-- Phase 3D - Project Group Tasks Integration

-- 1. Update assignment_scope
DO $$ 
DECLARE 
    r record;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint 
        WHERE conrelid = 'public.tasks'::regclass 
        AND pg_get_constraintdef(oid) ILIKE '%assignment_scope%'
    ) LOOP
        EXECUTE 'ALTER TABLE public.tasks DROP CONSTRAINT ' || r.conname;
    END LOOP;
END $$;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_assignment_scope_check CHECK (assignment_scope in ('all_students', 'selected_students', 'project_groups'));

-- 2. Create task_project_group_assignments table
CREATE TABLE IF NOT EXISTS public.task_project_group_assignments (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references public.tasks(id) on delete cascade,
    class_id uuid not null references public.classes(id) on delete cascade,
    project_group_id uuid not null references public.project_groups(id) on delete cascade,
    group_name_snapshot text null,
    group_color_key_snapshot text null,
    member_count_snapshot integer null,
    status text not null default 'pending' check (status in ('pending', 'assigned', 'submitted', 'returned', 'approved')),
    submission_text text null,
    submitted_at timestamptz null,
    submitted_by_student_id uuid null references public.students(id) on delete set null,
    submitted_by_name_snapshot text null,
    teacher_feedback text null,
    reviewed_at timestamptz null,
    reviewed_by uuid null references auth.users(id) on delete set null,
    reward_points_per_member integer not null default 0 check (reward_points_per_member >= 0),
    approved_member_count integer not null default 0 check (approved_member_count >= 0),
    snapshot_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (task_id, project_group_id)
);

-- Drop indices to allow re-run
DROP INDEX IF EXISTS idx_tpga_task_id;
DROP INDEX IF EXISTS idx_tpga_class_id;
DROP INDEX IF EXISTS idx_tpga_project_group_id;

CREATE INDEX idx_tpga_task_id ON public.task_project_group_assignments(task_id);
CREATE INDEX idx_tpga_class_id ON public.task_project_group_assignments(class_id);
CREATE INDEX idx_tpga_project_group_id ON public.task_project_group_assignments(project_group_id);

-- 3. Add to task_assignments
DO $$ BEGIN
  ALTER TABLE public.task_assignments ADD COLUMN project_group_assignment_id uuid null references public.task_project_group_assignments(id) on delete cascade;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.task_assignments ADD COLUMN source_project_group_id uuid null references public.project_groups(id) on delete set null;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.task_assignments ADD COLUMN source_group_name_snapshot text null;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.task_assignments ADD COLUMN source_group_color_key_snapshot text null;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DROP INDEX IF EXISTS idx_ta_pga_id;
DROP INDEX IF EXISTS idx_ta_source_pg_id;
CREATE INDEX idx_ta_pga_id ON public.task_assignments(project_group_assignment_id);
CREATE INDEX idx_ta_source_pg_id ON public.task_assignments(source_project_group_id);

-- 4. Triggers
CREATE OR REPLACE FUNCTION public.check_task_project_group_assignment()
RETURNS TRIGGER AS $BODY$
DECLARE
    v_task_class_id uuid;
    v_task_scope text;
    v_group_class_id uuid;
    v_group_status text;
BEGIN
    SELECT class_id, assignment_scope INTO v_task_class_id, v_task_scope
    FROM public.tasks
    WHERE id = NEW.task_id;
    
    IF v_task_class_id IS NULL THEN
        RAISE EXCEPTION 'Task does not exist.';
    END IF;
    
    IF v_task_class_id != NEW.class_id THEN
        RAISE EXCEPTION 'Task belongs to a different class.';
    END IF;
    
    IF v_task_scope != 'project_groups' THEN
        RAISE EXCEPTION 'Task assignment scope must be project_groups.';
    END IF;
    
    SELECT class_id, status INTO v_group_class_id, v_group_status
    FROM public.project_groups
    WHERE id = NEW.project_group_id;
    
    IF v_group_class_id IS NULL THEN
        RAISE EXCEPTION 'Project group does not exist.';
    END IF;
    
    IF v_group_class_id != NEW.class_id THEN
        RAISE EXCEPTION 'Project group belongs to a different class.';
    END IF;

    IF TG_OP = 'INSERT' AND v_group_status = 'archived' THEN
        RAISE EXCEPTION 'Cannot assign task to an archived project group.';
    END IF;
    
    IF NEW.status != 'pending' AND COALESCE(NEW.member_count_snapshot, 0) < 1 THEN
        RAISE EXCEPTION 'Snapshot member count must be positive after publication.';
    END IF;

    NEW.updated_at = now();
    RETURN NEW;
END;
$BODY$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_task_project_group_assignment ON public.task_project_group_assignments;
CREATE TRIGGER tr_check_task_project_group_assignment
BEFORE INSERT OR UPDATE ON public.task_project_group_assignments
FOR EACH ROW EXECUTE FUNCTION public.check_task_project_group_assignment();

CREATE OR REPLACE FUNCTION public.check_task_assignment_group_link()
RETURNS TRIGGER AS $BODY$
DECLARE
    v_group_assignment_task_id uuid;
    v_group_assignment_class_id uuid;
    v_group_assignment_status text;
    v_student_class_id uuid;
BEGIN
    IF NEW.project_group_assignment_id IS NOT NULL THEN
        SELECT task_id, class_id, status 
        INTO v_group_assignment_task_id, v_group_assignment_class_id, v_group_assignment_status
        FROM public.task_project_group_assignments
        WHERE id = NEW.project_group_assignment_id;
        
        IF v_group_assignment_task_id IS NULL THEN
            RAISE EXCEPTION 'Project group assignment does not exist.';
        END IF;
        
        IF v_group_assignment_task_id != NEW.task_id THEN
            RAISE EXCEPTION 'Task ID must match project group assignment task ID.';
        END IF;
        
        IF v_group_assignment_class_id != NEW.class_id THEN
            RAISE EXCEPTION 'Class ID must match project group assignment class ID.';
        END IF;

        SELECT class_id INTO v_student_class_id FROM public.students WHERE id = NEW.student_id;
        IF v_student_class_id != NEW.class_id THEN
            RAISE EXCEPTION 'Student belongs to a different class.';
        END IF;
        
        IF NEW.source_group_name_snapshot IS NULL OR NEW.source_group_color_key_snapshot IS NULL THEN
            RAISE EXCEPTION 'Published group task member assignments must have snapshot fields.';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$BODY$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_task_assignment_group_link ON public.task_assignments;
CREATE TRIGGER tr_check_task_assignment_group_link
BEFORE INSERT OR UPDATE ON public.task_assignments
FOR EACH ROW EXECUTE FUNCTION public.check_task_assignment_group_link();

-- RLS
ALTER TABLE public.task_project_group_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can manage their class project group assignments" ON public.task_project_group_assignments;
CREATE POLICY "Teachers can manage their class project group assignments"
ON public.task_project_group_assignments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.classes
    WHERE classes.id = task_project_group_assignments.class_id
    AND classes.created_by = auth.uid()
  )
);

REVOKE ALL ON public.task_project_group_assignments FROM public, anon;
GRANT SELECT ON public.task_project_group_assignments TO authenticated;

-- Realtime
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_project_group_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_assignments;

-- Create secure RPCs
-- drop overloaded ones if they exist, or just use CREATE OR REPLACE
-- 1. create_project_group_task
CREATE OR REPLACE FUNCTION public.create_project_group_task(
    p_class_id uuid,
    p_title text,
    p_instructions text,
    p_due_at timestamptz,
    p_reward_points integer,
    p_project_group_ids uuid[],
    p_publish_immediately boolean
) RETURNS uuid AS $$
DECLARE
    v_teacher_id uuid := auth.uid();
    v_class_owner uuid;
    v_task_id uuid;
    v_title_clean text := btrim(p_title);
    v_instructions_clean text := btrim(p_instructions);
    v_group_id uuid;
    v_valid_group_ids uuid[];
    v_active_group_count integer := 0;
BEGIN
    IF v_teacher_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    
    SELECT created_by INTO v_class_owner FROM public.classes WHERE id = p_class_id;
    IF v_class_owner IS NULL THEN RAISE EXCEPTION 'Class not found'; END IF;
    IF v_class_owner != v_teacher_id THEN RAISE EXCEPTION 'Not authorized for this class'; END IF;

    IF v_title_clean IS NULL OR length(v_title_clean) < 3 THEN RAISE EXCEPTION 'Task title must be at least 3 characters.'; END IF;
    IF v_instructions_clean IS NULL OR length(v_instructions_clean) < 5 THEN RAISE EXCEPTION 'Instructions must be at least 5 characters.'; END IF;
    IF p_reward_points < 0 THEN RAISE EXCEPTION 'Reward points cannot be negative.'; END IF;

    -- Collect and validate active groups
    SELECT array_agg(DISTINCT id) INTO v_valid_group_ids
    FROM public.project_groups
    WHERE id = ANY(COALESCE(p_project_group_ids, ARRAY[]::uuid[]))
    AND class_id = p_class_id
    AND status = 'active';

    v_active_group_count := COALESCE(array_length(v_valid_group_ids, 1), 0);

    IF p_publish_immediately AND v_active_group_count = 0 THEN
        RAISE EXCEPTION 'Publication requires at least one active selected group.';
    END IF;

    INSERT INTO public.tasks (
        class_id, created_by, title, instructions, due_at, reward_points, assignment_scope, status, published_at
    ) VALUES (
        p_class_id, v_teacher_id, v_title_clean, v_instructions_clean, p_due_at, p_reward_points, 'project_groups', 'draft', NULL
    ) RETURNING id INTO v_task_id;

    -- Insert pending assignments
    IF v_active_group_count > 0 THEN
        INSERT INTO public.task_project_group_assignments (
            task_id, class_id, project_group_id, status
        )
        SELECT v_task_id, p_class_id, g_id, 'pending'
        FROM unnest(v_valid_group_ids) AS g_id;
    END IF;

    IF p_publish_immediately THEN
        PERFORM public.set_project_group_task_status(v_task_id, 'active');
    END IF;

    RETURN v_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. update_project_group_task
CREATE OR REPLACE FUNCTION public.update_project_group_task(
    p_task_id uuid,
    p_title text,
    p_instructions text,
    p_due_at timestamptz,
    p_reward_points integer,
    p_project_group_ids uuid[]
) RETURNS void AS $$
DECLARE
    v_teacher_id uuid := auth.uid();
    v_task record;
    v_title_clean text := btrim(p_title);
    v_instructions_clean text := btrim(p_instructions);
    v_valid_group_ids uuid[];
BEGIN
    IF v_teacher_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT t.* INTO v_task
    FROM public.tasks t
    JOIN public.classes c ON t.class_id = c.id
    WHERE t.id = p_task_id AND c.created_by = v_teacher_id
    FOR UPDATE;

    IF v_task.id IS NULL THEN RAISE EXCEPTION 'Task not found or not authorized'; END IF;
    IF v_task.assignment_scope != 'project_groups' THEN RAISE EXCEPTION 'Task is not a project group task'; END IF;
    
    IF v_task.status IN ('completed', 'archived') THEN
        RAISE EXCEPTION 'Cannot edit completed or archived tasks.';
    END IF;

    IF v_title_clean IS NULL OR length(v_title_clean) < 3 THEN RAISE EXCEPTION 'Task title must be at least 3 characters.'; END IF;
    IF v_instructions_clean IS NULL OR length(v_instructions_clean) < 5 THEN RAISE EXCEPTION 'Instructions must be at least 5 characters.'; END IF;
    IF p_reward_points < 0 THEN RAISE EXCEPTION 'Reward points cannot be negative.'; END IF;

    IF v_task.status = 'draft' THEN
        -- Allowed to change groups and reward
        SELECT array_agg(DISTINCT id) INTO v_valid_group_ids
        FROM public.project_groups
        WHERE id = ANY(COALESCE(p_project_group_ids, ARRAY[]::uuid[]))
        AND class_id = v_task.class_id
        AND status = 'active';

        DELETE FROM public.task_project_group_assignments
        WHERE task_id = p_task_id AND NOT (project_group_id = ANY(COALESCE(v_valid_group_ids, ARRAY[]::uuid[])));

        IF COALESCE(array_length(v_valid_group_ids, 1), 0) > 0 THEN
            INSERT INTO public.task_project_group_assignments (
                task_id, class_id, project_group_id, status
            )
            SELECT p_task_id, v_task.class_id, g_id, 'pending'
            FROM unnest(v_valid_group_ids) AS g_id
            ON CONFLICT (task_id, project_group_id) DO NOTHING;
        END IF;

        UPDATE public.tasks
        SET title = v_title_clean,
            instructions = v_instructions_clean,
            due_at = p_due_at,
            reward_points = p_reward_points,
            updated_at = now()
        WHERE id = p_task_id;
    ELSE
        -- Active task, only safe metadata
        UPDATE public.tasks
        SET title = v_title_clean,
            instructions = v_instructions_clean,
            due_at = p_due_at,
            updated_at = now()
        WHERE id = p_task_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. set_project_group_task_status
CREATE OR REPLACE FUNCTION public.set_project_group_task_status(
    p_task_id uuid,
    p_status text
) RETURNS void AS $$
DECLARE
    v_teacher_id uuid := auth.uid();
    v_task record;
    v_pending_groups record;
    v_has_pending boolean := false;
    v_member record;
    v_assignment_id uuid;
    v_snapshot_time timestamptz := now();
    v_member_count integer;
BEGIN
    IF v_teacher_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    IF p_status NOT IN ('active', 'completed', 'archived') THEN RAISE EXCEPTION 'Invalid target status'; END IF;

    SELECT t.* INTO v_task
    FROM public.tasks t
    JOIN public.classes c ON t.class_id = c.id
    WHERE t.id = p_task_id AND c.created_by = v_teacher_id
    FOR UPDATE;

    IF v_task.id IS NULL THEN RAISE EXCEPTION 'Task not found or not authorized'; END IF;
    IF v_task.assignment_scope != 'project_groups' THEN RAISE EXCEPTION 'Task is not a project group task'; END IF;

    IF v_task.status = p_status THEN RETURN; END IF;

    IF p_status = 'active' AND v_task.status = 'draft' THEN
        -- Publishing
        FOR v_pending_groups IN (
            SELECT pga.id, pga.project_group_id, pg.name, pg.color_key, pg.status as pg_status
            FROM public.task_project_group_assignments pga
            JOIN public.project_groups pg ON pga.project_group_id = pg.id
            WHERE pga.task_id = p_task_id AND pga.status = 'pending'
            FOR UPDATE OF pga
        ) LOOP
            v_has_pending := true;
            IF v_pending_groups.pg_status != 'active' THEN
                RAISE EXCEPTION 'Selected group % is no longer active.', v_pending_groups.name;
            END IF;

            SELECT count(*) INTO v_member_count
            FROM public.project_group_memberships pgm
            JOIN public.students s ON pgm.student_id = s.id
            WHERE pgm.project_group_id = v_pending_groups.project_group_id
            AND pgm.removed_at IS NULL
            AND s.is_active = true AND s.deleted_at IS NULL;

            IF v_member_count = 0 THEN
                RAISE EXCEPTION 'Selected group % has no eligible active members.', v_pending_groups.name;
            END IF;

            UPDATE public.task_project_group_assignments
            SET status = 'assigned',
                group_name_snapshot = v_pending_groups.name,
                group_color_key_snapshot = v_pending_groups.color_key,
                member_count_snapshot = v_member_count,
                snapshot_at = v_snapshot_time,
                updated_at = v_snapshot_time
            WHERE id = v_pending_groups.id;

            -- Create member assignments
            INSERT INTO public.task_assignments (
                task_id, class_id, student_id, status,
                project_group_assignment_id, source_project_group_id,
                source_group_name_snapshot, source_group_color_key_snapshot
            )
            SELECT 
                p_task_id, v_task.class_id, pgm.student_id, 'assigned',
                v_pending_groups.id, v_pending_groups.project_group_id,
                v_pending_groups.name, v_pending_groups.color_key
            FROM public.project_group_memberships pgm
            JOIN public.students s ON pgm.student_id = s.id
            WHERE pgm.project_group_id = v_pending_groups.project_group_id
            AND pgm.removed_at IS NULL
            AND s.is_active = true AND s.deleted_at IS NULL;
        END LOOP;

        IF NOT v_has_pending THEN
            RAISE EXCEPTION 'Cannot publish task without selected project groups.';
        END IF;

        UPDATE public.tasks
        SET status = 'active', published_at = v_snapshot_time, updated_at = v_snapshot_time
        WHERE id = p_task_id;

    ELSIF p_status = 'completed' AND v_task.status = 'active' THEN
        UPDATE public.tasks SET status = 'completed', updated_at = now() WHERE id = p_task_id;
    ELSIF p_status = 'archived' THEN
        UPDATE public.tasks SET status = 'archived', updated_at = now() WHERE id = p_task_id;
    ELSE
        RAISE EXCEPTION 'Invalid status transition from % to %.', v_task.status, p_status;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. submit_project_group_task
CREATE OR REPLACE FUNCTION public.submit_project_group_task(
    p_group_assignment_id uuid,
    p_submission_text text DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_student record;
    v_group_assignment record;
    v_task record;
    v_member_assignment_id uuid;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    -- resolve student
    SELECT id, display_name INTO v_student
    FROM public.students
    WHERE student_auth_user_id = v_user_id AND is_active = true AND deleted_at IS NULL AND access_enabled = true;

    IF v_student.id IS NULL THEN RAISE EXCEPTION 'Student not found or access disabled'; END IF;

    SELECT pga.* INTO v_group_assignment
    FROM public.task_project_group_assignments pga
    WHERE pga.id = p_group_assignment_id
    FOR UPDATE;

    IF v_group_assignment.id IS NULL THEN RAISE EXCEPTION 'Group assignment not found'; END IF;

    SELECT * INTO v_task FROM public.tasks WHERE id = v_group_assignment.task_id;
    IF v_task.status != 'active' THEN RAISE EXCEPTION 'Task is not active'; END IF;

    SELECT id INTO v_member_assignment_id
    FROM public.task_assignments
    WHERE project_group_assignment_id = p_group_assignment_id AND student_id = v_student.id;

    IF v_member_assignment_id IS NULL THEN RAISE EXCEPTION 'You are not a member of this group task'; END IF;

    IF v_group_assignment.status NOT IN ('assigned', 'returned') THEN
        RAISE EXCEPTION 'Group task cannot be submitted in its current state';
    END IF;

    IF p_submission_text IS NOT NULL AND length(p_submission_text) > 3000 THEN
        RAISE EXCEPTION 'Submission text exceeds 3000 characters';
    END IF;

    UPDATE public.task_project_group_assignments
    SET status = 'submitted',
        submission_text = COALESCE(p_submission_text, ''),
        submitted_at = now(),
        submitted_by_student_id = v_student.id,
        submitted_by_name_snapshot = v_student.display_name,
        updated_at = now()
    WHERE id = p_group_assignment_id;

    UPDATE public.task_assignments
    SET status = 'submitted',
        submission_text = COALESCE(p_submission_text, ''),
        submitted_at = now(),
        updated_at = now()
    WHERE project_group_assignment_id = p_group_assignment_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. review_project_group_task
CREATE OR REPLACE FUNCTION public.review_project_group_task(
    p_group_assignment_id uuid,
    p_action text,
    p_teacher_feedback text DEFAULT NULL
) RETURNS json AS $$
DECLARE
    v_teacher_id uuid := auth.uid();
    v_group_assignment record;
    v_task record;
    v_class_owner uuid;
    v_member record;
    v_point_event_id uuid;
    v_points_awarded integer := 0;
    v_feedback_clean text := btrim(p_teacher_feedback);
    v_now timestamptz := now();
    v_results jsonb := '[]'::jsonb;
    v_total_awarded integer := 0;
    v_member_count integer := 0;
BEGIN
    IF v_teacher_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    IF p_action NOT IN ('approve', 'return') THEN RAISE EXCEPTION 'Invalid review action'; END IF;
    IF v_feedback_clean IS NOT NULL AND length(v_feedback_clean) > 1000 THEN
        RAISE EXCEPTION 'Feedback exceeds 1000 characters';
    END IF;

    SELECT pga.* INTO v_group_assignment
    FROM public.task_project_group_assignments pga
    WHERE pga.id = p_group_assignment_id
    FOR UPDATE;

    IF v_group_assignment.id IS NULL THEN RAISE EXCEPTION 'Group assignment not found'; END IF;

    SELECT * INTO v_task FROM public.tasks WHERE id = v_group_assignment.task_id FOR UPDATE;
    SELECT created_by INTO v_class_owner FROM public.classes WHERE id = v_group_assignment.class_id;
    
    IF v_class_owner != v_teacher_id THEN RAISE EXCEPTION 'Not authorized'; END IF;
    IF v_task.status NOT IN ('active', 'completed') THEN RAISE EXCEPTION 'Task is not reviewable'; END IF;

    IF p_action = 'return' THEN
        IF v_group_assignment.status != 'submitted' THEN
            RAISE EXCEPTION 'Only submitted group tasks can be returned';
        END IF;

        UPDATE public.task_project_group_assignments
        SET status = 'returned',
            teacher_feedback = v_feedback_clean,
            reviewed_at = v_now,
            reviewed_by = v_teacher_id,
            updated_at = v_now
        WHERE id = p_group_assignment_id;

        UPDATE public.task_assignments
        SET status = 'returned',
            teacher_feedback = v_feedback_clean,
            reviewed_at = v_now,
            reviewed_by = v_teacher_id,
            updated_at = v_now
        WHERE project_group_assignment_id = p_group_assignment_id;

        RETURN json_build_object('status', 'returned', 'id', p_group_assignment_id);
    END IF;

    IF p_action = 'approve' THEN
        IF v_group_assignment.status NOT IN ('assigned', 'submitted', 'returned') THEN
            RAISE EXCEPTION 'Task cannot be approved from its current state';
        END IF;

        UPDATE public.task_project_group_assignments
        SET status = 'approved',
            teacher_feedback = COALESCE(v_feedback_clean, teacher_feedback),
            reviewed_at = v_now,
            reviewed_by = v_teacher_id,
            reward_points_per_member = v_task.reward_points,
            updated_at = v_now
        WHERE id = p_group_assignment_id;

        -- Process each linked member assignment
        FOR v_member IN (
            SELECT ta.id, ta.student_id, s.display_name, ta.status
            FROM public.task_assignments ta
            JOIN public.students s ON ta.student_id = s.id
            WHERE ta.project_group_assignment_id = p_group_assignment_id
            FOR UPDATE OF ta
        ) LOOP
            v_member_count := v_member_count + 1;
            
            IF v_member.status != 'approved' THEN
                UPDATE public.task_assignments
                SET status = 'approved',
                    reward_points_awarded = v_task.reward_points,
                    teacher_feedback = COALESCE(v_feedback_clean, teacher_feedback),
                    reviewed_at = v_now,
                    reviewed_by = v_teacher_id,
                    updated_at = v_now
                WHERE id = v_member.id;

                v_points_awarded := v_task.reward_points;

                IF v_points_awarded > 0 THEN
                    -- Insert point event
                    INSERT INTO public.point_events (
                        student_id, class_id, points, reason, source_type, task_assignment_id, created_by
                    ) VALUES (
                        v_member.student_id, v_task.class_id, v_points_awarded,
                        'Group Task Approved: ' || v_task.title || ' (' || v_group_assignment.group_name_snapshot || ')',
                        'task', v_member.id, v_teacher_id
                    ) ON CONFLICT (task_assignment_id) DO NOTHING
                    RETURNING id INTO v_point_event_id;

                    IF v_point_event_id IS NOT NULL THEN
                        UPDATE public.students
                        SET total_points = total_points + v_points_awarded, updated_at = v_now
                        WHERE id = v_member.student_id;
                    END IF;
                END IF;
            ELSE
                v_points_awarded := 0; -- Already approved
            END IF;

            v_total_awarded := v_total_awarded + v_points_awarded;

            v_results := v_results || jsonb_build_object(
                'student_id', v_member.student_id,
                'student_name', v_member.display_name,
                'points_awarded', v_points_awarded,
                'new_total', (SELECT total_points FROM public.students WHERE id = v_member.student_id)
            );
        END LOOP;

        UPDATE public.task_project_group_assignments
        SET approved_member_count = v_member_count
        WHERE id = p_group_assignment_id;

        RETURN json_build_object(
            'id', p_group_assignment_id,
            'status', 'approved',
            'points_per_member_awarded', v_task.reward_points,
            'member_count', v_member_count,
            'total_distributed', v_total_awarded,
            'group_name_snapshot', v_group_assignment.group_name_snapshot,
            'reviewed_at', v_now,
            'member_results', v_results
        );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. get_my_project_group_tasks
CREATE OR REPLACE FUNCTION public.get_my_project_group_tasks()
RETURNS TABLE (
    task_id uuid,
    assignment_id uuid,
    group_assignment_id uuid,
    task_title text,
    instructions text,
    due_at timestamptz,
    reward_points_per_member integer,
    task_status text,
    group_assignment_status text,
    group_name_snapshot text,
    group_color_key_snapshot text,
    submission_text text,
    submitted_at timestamptz,
    submitted_by_name_snapshot text,
    teacher_feedback text,
    reviewed_at timestamptz,
    student_awarded_points integer,
    member_names_snapshot text[]
) AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_student_id uuid;
BEGIN
    SELECT id INTO v_student_id FROM public.students WHERE student_auth_user_id = v_user_id AND is_active = true AND deleted_at IS NULL;
    IF v_student_id IS NULL THEN RETURN; END IF;

    RETURN QUERY
    SELECT 
        t.id,
        ta.id,
        pga.id,
        t.title,
        t.instructions,
        t.due_at,
        t.reward_points,
        t.status,
        pga.status,
        pga.group_name_snapshot,
        pga.group_color_key_snapshot,
        pga.submission_text,
        pga.submitted_at,
        pga.submitted_by_name_snapshot,
        pga.teacher_feedback,
        pga.reviewed_at,
        ta.reward_points_awarded,
        ARRAY(
            SELECT s2.display_name
            FROM public.task_assignments ta2
            JOIN public.students s2 ON ta2.student_id = s2.id
            WHERE ta2.project_group_assignment_id = pga.id
            ORDER BY s2.display_name
        ) as member_names_snapshot
    FROM public.task_assignments ta
    JOIN public.task_project_group_assignments pga ON ta.project_group_assignment_id = pga.id
    JOIN public.tasks t ON ta.task_id = t.id
    WHERE ta.student_id = v_student_id
    AND t.assignment_scope = 'project_groups'
    AND t.status != 'draft'
    ORDER BY t.due_at ASC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revoke execute from public
REVOKE EXECUTE ON FUNCTION public.create_project_group_task(uuid, text, text, timestamptz, integer, uuid[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_project_group_task(uuid, text, text, timestamptz, integer, uuid[], boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_project_group_task(uuid, text, text, timestamptz, integer, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_project_group_task(uuid, text, text, timestamptz, integer, uuid[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_project_group_task_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_project_group_task_status(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_project_group_task(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_project_group_task(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.review_project_group_task(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_project_group_task(uuid, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_project_group_tasks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_project_group_tasks() TO authenticated;

NOTIFY pgrst, 'reload schema';
EOF
