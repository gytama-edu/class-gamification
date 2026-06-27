-- manual_install_project_group_tasks.sql
-- 1. Modify Tasks assignment scope constraint securely
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_assignment_scope_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_assignment_scope_check 
  CHECK (assignment_scope IN ('all_students', 'selected_students', 'project_groups'));

-- 2. Create task_project_group_assignments table
CREATE TABLE IF NOT EXISTS public.task_project_group_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    project_group_id uuid NOT NULL REFERENCES public.project_groups(id) ON DELETE CASCADE,
    group_name_snapshot text,
    group_color_key_snapshot text,
    member_count_snapshot integer,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'submitted', 'approved', 'returned')),
    submission_text text,
    submitted_at timestamptz,
    submitted_by_student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
    submitted_by_name_snapshot text,
    teacher_feedback text,
    reviewed_at timestamptz,
    reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    reward_points_per_member integer NOT NULL DEFAULT 0,
    approved_member_count integer NOT NULL DEFAULT 0,
    snapshot_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure task submission attachment columns exist (from migration 031)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS allow_submission_text boolean not null default true;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS allow_submission_files boolean not null default false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS require_submission_file boolean not null default false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS allowed_submission_file_categories text[] not null default ARRAY['image','document'];
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS max_submission_files integer not null default 5;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS max_submission_file_size_bytes bigint not null default 10485760;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS max_submission_total_size_bytes bigint not null default 31457280;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tasks_submission_settings_check'
    ) THEN
        ALTER TABLE public.tasks ADD CONSTRAINT tasks_submission_settings_check CHECK (
            (allow_submission_text = true OR allow_submission_files = true) AND
            (require_submission_file = false OR allow_submission_files = true) AND
            (max_submission_files BETWEEN 1 AND 10) AND
            (max_submission_file_size_bytes BETWEEN 1 AND 20971520) AND
            (max_submission_total_size_bytes BETWEEN 1 AND 52428800) AND
            (allowed_submission_file_categories <@ ARRAY['image', 'document'])
        );
    END IF;
END $$;

-- Ensure group submission attachment columns exist (from migration 031)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'task_project_group_assignments' AND column_name = 'attachment_count') THEN
        ALTER TABLE public.task_project_group_assignments ADD COLUMN attachment_count integer NOT NULL DEFAULT 0;
    END IF;
END $$;

-- 3. Modify task_assignments table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'task_assignments' AND column_name = 'project_group_assignment_id'
  ) THEN
    ALTER TABLE public.task_assignments ADD COLUMN project_group_assignment_id uuid;
  END IF;
END $$;

ALTER TABLE public.task_assignments 
  DROP CONSTRAINT IF EXISTS fk_task_assignments_project_group_assignment;

ALTER TABLE public.task_assignments 
  ADD CONSTRAINT fk_task_assignments_project_group_assignment 
  FOREIGN KEY (project_group_assignment_id) 
  REFERENCES public.task_project_group_assignments(id) ON DELETE SET NULL;

-- 4. Validation triggers
CREATE OR REPLACE FUNCTION public.update_task_project_group_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_project_group_assignments_updated_at ON public.task_project_group_assignments;
CREATE TRIGGER trg_task_project_group_assignments_updated_at
BEFORE UPDATE ON public.task_project_group_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_task_project_group_assignments_updated_at();

-- 5. RLS Policies
ALTER TABLE public.task_project_group_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teacher select task_project_group_assignments" ON public.task_project_group_assignments;
CREATE POLICY "Teacher select task_project_group_assignments"
ON public.task_project_group_assignments FOR SELECT TO authenticated
USING (class_id IN (SELECT id FROM public.classes WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Teacher all task_project_group_assignments" ON public.task_project_group_assignments;
CREATE POLICY "Teacher all task_project_group_assignments"
ON public.task_project_group_assignments FOR ALL TO authenticated
USING (class_id IN (SELECT id FROM public.classes WHERE owner_id = auth.uid()));

-- Student RLS policies for Project Groups and Memberships
ALTER TABLE public.project_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students can view their own project groups" ON public.project_groups;
CREATE POLICY "Students can view their own project groups"
    ON public.project_groups FOR SELECT
    TO authenticated
    USING (
        id IN (
            SELECT group_id FROM public.project_group_memberships 
            WHERE student_id IN (
                SELECT id FROM public.students WHERE student_auth_user_id = auth.uid()
            )
            AND removed_at IS NULL
        )
    );

ALTER TABLE public.project_group_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students can view their own group memberships" ON public.project_group_memberships;
CREATE POLICY "Students can view their own group memberships"
    ON public.project_group_memberships FOR SELECT
    TO authenticated
    USING (
        group_id IN (
            SELECT group_id FROM public.project_group_memberships 
            WHERE student_id IN (
                SELECT id FROM public.students WHERE student_auth_user_id = auth.uid()
            )
            AND removed_at IS NULL
        )
    );

DROP POLICY IF EXISTS "Students can view their own task_project_group_assignments" ON public.task_project_group_assignments;
CREATE POLICY "Students can view their own task_project_group_assignments"
ON public.task_project_group_assignments FOR SELECT TO authenticated
USING (
    project_group_id IN (
        SELECT group_id FROM public.project_group_memberships 
        WHERE student_id IN (
            SELECT id FROM public.students WHERE student_auth_user_id = auth.uid()
        )
        AND removed_at IS NULL
    )
);

-- 6. Guarded realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'task_project_group_assignments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.task_project_group_assignments;
    END IF;
END $$;

-- 7. Exact Secure RPCs

-- 7a. create_project_group_task
CREATE OR REPLACE FUNCTION public.create_project_group_task(
    p_class_id uuid,
    p_title text,
    p_instructions text,
    p_due_at timestamptz,
    p_reward_points integer,
    p_project_group_ids uuid[],
    p_publish_immediately boolean
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
        assignment_scope, status, published_at
    )
    VALUES (
        p_class_id, v_teacher_id, p_title, p_instructions, p_due_at, p_reward_points,
        'project_groups', v_status, v_published_at
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
REVOKE ALL ON FUNCTION public.create_project_group_task(uuid,text,text,timestamptz,integer,uuid[],boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_project_group_task(uuid,text,text,timestamptz,integer,uuid[],boolean) TO authenticated;

-- 7b. update_project_group_task
CREATE OR REPLACE FUNCTION public.update_project_group_task(
    p_task_id uuid,
    p_title text,
    p_instructions text,
    p_due_at timestamptz,
    p_reward_points integer,
    p_project_group_ids uuid[]
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
REVOKE ALL ON FUNCTION public.update_project_group_task(uuid,text,text,timestamptz,integer,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_project_group_task(uuid,text,text,timestamptz,integer,uuid[]) TO authenticated;

-- 7c. set_project_group_task_status
CREATE OR REPLACE FUNCTION public.set_project_group_task_status(
    p_task_id uuid,
    p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_task public.tasks%rowtype;
    v_assignment record;
    v_group record;
    v_member record;
    v_member_count integer;
    v_teacher_id uuid := auth.uid();
BEGIN
    SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Task not found.'; END IF;

    IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = v_task.class_id AND owner_id = v_teacher_id) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    IF p_status = 'active' AND v_task.status = 'draft' THEN
        IF NOT EXISTS (SELECT 1 FROM public.task_project_group_assignments WHERE task_id = p_task_id) THEN
            RAISE EXCEPTION 'Cannot publish task without assigned groups.';
        END IF;

        FOR v_assignment IN SELECT * FROM public.task_project_group_assignments WHERE task_id = p_task_id
        LOOP
            SELECT * INTO v_group FROM public.project_groups WHERE id = v_assignment.project_group_id;
            SELECT COUNT(*) INTO v_member_count FROM public.project_group_members WHERE project_group_id = v_group.id AND status = 'active';
            
            IF v_member_count = 0 THEN
                RAISE EXCEPTION 'Group % has no active members', v_group.name;
            END IF;

            UPDATE public.task_project_group_assignments SET
                status = 'assigned',
                group_name_snapshot = v_group.name,
                group_color_key_snapshot = v_group.color_key,
                member_count_snapshot = v_member_count,
                reward_points_per_member = v_task.reward_points,
                snapshot_at = now()
            WHERE id = v_assignment.id;

            FOR v_member IN 
                SELECT pgm.student_id 
                FROM public.project_group_members pgm
                JOIN public.students s ON s.id = pgm.student_id
                WHERE pgm.project_group_id = v_group.id AND pgm.status = 'active' AND s.deleted_at IS NULL
            LOOP
                INSERT INTO public.task_assignments (
                    task_id, class_id, student_id, status, project_group_assignment_id
                )
                VALUES (
                    v_task.id, v_task.class_id, v_member.student_id, 'assigned', v_assignment.id
                );
            END LOOP;
        END LOOP;

        UPDATE public.tasks SET status = 'active', published_at = now(), updated_at = now() WHERE id = p_task_id;

    ELSIF p_status = 'completed' AND v_task.status = 'active' THEN
        UPDATE public.tasks SET status = 'completed', completed_at = now(), updated_at = now() WHERE id = p_task_id;
        
    ELSIF p_status = 'archived' THEN
        UPDATE public.tasks SET status = 'archived', updated_at = now() WHERE id = p_task_id;
        
    ELSE
        RAISE EXCEPTION 'Invalid status transition from % to %', v_task.status, p_status;
    END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_project_group_task_status(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_project_group_task_status(uuid,text) TO authenticated;

-- 7d. get_task_project_group_assignments
CREATE OR REPLACE FUNCTION public.get_task_project_group_assignments(
    p_task_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_task public.tasks%rowtype;
    v_teacher_id uuid := auth.uid();
    v_result jsonb;
BEGIN
    SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Task not found'; END IF;

    IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = v_task.class_id AND owner_id = v_teacher_id) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    SELECT jsonb_agg(
        jsonb_build_object(
            'assignment', row_to_json(tpga),
            'members', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', s.id,
                        'display_name', s.display_name,
                        'assignment_status', ta.status,
                        'points_awarded', ta.points_awarded
                    )
                )
                FROM public.task_assignments ta
                JOIN public.students s ON s.id = ta.student_id
                WHERE ta.project_group_assignment_id = tpga.id
            ), '[]'::jsonb)
        )
    ) INTO v_result
    FROM public.task_project_group_assignments tpga
    WHERE tpga.task_id = p_task_id;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.get_task_project_group_assignments(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_task_project_group_assignments(uuid) TO authenticated;

-- 7e. submit_project_group_task
CREATE OR REPLACE FUNCTION public.submit_project_group_task(
    p_group_assignment_id uuid,
    p_submission_text text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_student_id uuid;
    v_assignment record;
    v_task record;
    v_student record;
BEGIN
    SELECT * INTO v_student FROM public.students 
    WHERE student_auth_user_id = auth.uid()
      AND is_active = true 
      AND access_enabled = true
      AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Not authenticated as an active student';
    END IF;
    v_student_id := v_student.id;

    IF NOT EXISTS (
        SELECT 1 FROM public.task_assignments
        WHERE project_group_assignment_id = p_group_assignment_id
        AND student_id = v_student_id
    ) THEN
        RAISE EXCEPTION 'You are not a member of this project group assignment';
    END IF;

    SELECT * INTO v_assignment FROM public.task_project_group_assignments WHERE id = p_group_assignment_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found'; END IF;

    SELECT * INTO v_task FROM public.tasks WHERE id = v_assignment.task_id;
    IF v_task.status != 'active' THEN
        RAISE EXCEPTION 'Task is not active';
    END IF;

    SELECT * INTO v_student FROM public.students WHERE id = v_student_id;

    UPDATE public.task_project_group_assignments SET
        status = 'submitted',
        submission_text = p_submission_text,
        submitted_at = now(),
        submitted_by_student_id = v_student_id,
        submitted_by_name_snapshot = v_student.display_name,
        updated_at = now()
    WHERE id = p_group_assignment_id;

    UPDATE public.task_assignments SET
        status = 'submitted',
        submission_text = p_submission_text,
        submitted_at = now(),
        updated_at = now()
    WHERE project_group_assignment_id = p_group_assignment_id;

END;
$$;
REVOKE ALL ON FUNCTION public.submit_project_group_task(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_project_group_task(uuid,text) TO authenticated;

-- 7f. review_project_group_task
CREATE OR REPLACE FUNCTION public.review_project_group_task(
    p_group_assignment_id uuid,
    p_action text,
    p_teacher_feedback text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_assignment record;
    v_task public.tasks%rowtype;
    v_member record;
    v_teacher_id uuid := auth.uid();
    v_approved_count integer := 0;
BEGIN
    IF v_teacher_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    IF p_action NOT IN ('approve', 'return') THEN
        RAISE EXCEPTION 'Invalid action. Must be approve or return.';
    END IF;

    SELECT * INTO v_assignment FROM public.task_project_group_assignments WHERE id = p_group_assignment_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found'; END IF;

    SELECT * INTO v_task FROM public.tasks WHERE id = v_assignment.task_id;

    IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = v_task.class_id AND owner_id = v_teacher_id) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    IF p_action = 'return' THEN
        UPDATE public.task_project_group_assignments SET
            status = 'returned',
            teacher_feedback = p_teacher_feedback,
            reviewed_at = now(),
            reviewed_by = v_teacher_id,
            updated_at = now()
        WHERE id = p_group_assignment_id;

        UPDATE public.task_assignments SET
            status = 'returned',
            teacher_feedback = p_teacher_feedback,
            reviewed_at = now(),
            reviewed_by = v_teacher_id,
            updated_at = now()
        WHERE project_group_assignment_id = p_group_assignment_id;

        RETURN jsonb_build_object(
            'status', 'returned',
            'approved_count', 0,
            'total_points_awarded', 0
        );
    END IF;

    IF p_action = 'approve' THEN
        IF v_assignment.status = 'approved' THEN
            RETURN jsonb_build_object(
                'status', 'approved',
                'approved_count', v_assignment.approved_member_count,
                'total_points_awarded', v_assignment.approved_member_count * v_assignment.reward_points_per_member
            );
        END IF;

        UPDATE public.task_project_group_assignments SET
            status = 'approved',
            teacher_feedback = p_teacher_feedback,
            reviewed_at = now(),
            reviewed_by = v_teacher_id,
            updated_at = now()
        WHERE id = p_group_assignment_id;

        FOR v_member IN 
            SELECT ta.id as task_assignment_id, ta.student_id
            FROM public.task_assignments ta
            WHERE ta.project_group_assignment_id = p_group_assignment_id
        LOOP
            UPDATE public.task_assignments SET
                status = 'approved',
                teacher_feedback = p_teacher_feedback,
                reviewed_at = now(),
                reviewed_by = v_teacher_id,
                points_awarded = v_assignment.reward_points_per_member,
                points_awarded_at = now(),
                updated_at = now()
            WHERE id = v_member.task_assignment_id;

            IF v_assignment.reward_points_per_member > 0 THEN
                INSERT INTO public.point_events (
                    student_id, class_id, points, reason, task_assignment_id, created_by
                )
                VALUES (
                    v_member.student_id, v_task.class_id, v_assignment.reward_points_per_member, 
                    'Completed group task: ' || v_task.title,
                    v_member.task_assignment_id, v_teacher_id
                );
            END IF;

            v_approved_count := v_approved_count + 1;
        END LOOP;

        UPDATE public.task_project_group_assignments SET
            approved_member_count = v_approved_count
        WHERE id = p_group_assignment_id;

        RETURN jsonb_build_object(
            'status', 'approved',
            'approved_count', v_approved_count,
            'total_points_awarded', v_approved_count * v_assignment.reward_points_per_member
        );
    END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.review_project_group_task(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_project_group_task(uuid,text,text) TO authenticated;

-- 7g. get_my_project_group_tasks
DROP FUNCTION IF EXISTS public.get_my_project_group_tasks();
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
    member_names_snapshot text[],
    allow_submission_text boolean,
    allow_submission_files boolean,
    require_submission_file boolean,
    allowed_submission_file_categories text[],
    max_submission_files integer,
    max_submission_file_size_bytes bigint,
    max_submission_total_size_bytes bigint,
    attachment_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_student record;
    v_student_id uuid;
BEGIN
    SELECT * INTO v_student FROM public.students 
    WHERE student_auth_user_id = auth.uid()
      AND is_active = true 
      AND access_enabled = true
      AND deleted_at IS NULL;

    IF FOUND THEN
        v_student_id := v_student.id;
        
        RETURN QUERY
        SELECT 
            t.id as task_id,
            ta.id as assignment_id,
            tpga.id as group_assignment_id,
            t.title as task_title,
            t.instructions as instructions,
            t.due_at,
            tpga.reward_points_per_member,
            t.status as task_status,
            tpga.status as group_assignment_status,
            tpga.group_name_snapshot,
            tpga.group_color_key_snapshot,
            tpga.submission_text,
            tpga.submitted_at,
            tpga.submitted_by_name_snapshot,
            tpga.teacher_feedback,
            tpga.reviewed_at,
            COALESCE(ta.points_awarded, 0) as student_awarded_points,
            ARRAY(
                SELECT s2.display_name
                FROM public.task_assignments ta2
                JOIN public.students s2 ON s2.id = ta2.student_id
                WHERE ta2.project_group_assignment_id = tpga.id
            ) as member_names_snapshot,
            COALESCE(t.allow_submission_text, true) as allow_submission_text,
            COALESCE(t.allow_submission_files, false) as allow_submission_files,
            COALESCE(t.require_submission_file, false) as require_submission_file,
            COALESCE(t.allowed_submission_file_categories, ARRAY['image', 'document']) as allowed_submission_file_categories,
            COALESCE(t.max_submission_files, 5) as max_submission_files,
            COALESCE(t.max_submission_file_size_bytes, 10485760) as max_submission_file_size_bytes,
            COALESCE(t.max_submission_total_size_bytes, 31457280) as max_submission_total_size_bytes,
            COALESCE(tpga.attachment_count, 0) as attachment_count
        FROM public.task_assignments ta
        JOIN public.task_project_group_assignments tpga ON tpga.id = ta.project_group_assignment_id
        JOIN public.tasks t ON t.id = tpga.task_id
        WHERE ta.student_id = v_student_id
        AND t.status IN ('active', 'completed');
    END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_project_group_tasks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_project_group_tasks() TO authenticated;

-- 7h. get_my_project_group
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
