-- 026_tasks_foundation.sql
BEGIN;

-- 1. Modify point_events table safely
ALTER TABLE public.point_events ADD COLUMN IF NOT EXISTS task_assignment_id uuid;

-- Tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
    id uuid primary key default gen_random_uuid(),
    class_id uuid not null references public.classes(id) on delete cascade,
    created_by uuid not null references auth.users(id) on delete cascade,
    title text not null check (length(trim(title)) between 3 and 100),
    instructions text not null default '',
    due_at timestamptz null,
    reward_points integer not null default 0 check (reward_points >= 0 and reward_points <= 1000),
    assignment_scope text not null check (assignment_scope in ('all_students', 'selected_students')),
    status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'archived')),
    published_at timestamptz null,
    completed_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (length(instructions) <= 5000)
);

-- Task Assignments table
CREATE TABLE IF NOT EXISTS public.task_assignments (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references public.tasks(id) on delete cascade,
    class_id uuid not null references public.classes(id) on delete cascade,
    student_id uuid not null references public.students(id) on delete cascade,
    status text not null default 'assigned' check (status in ('assigned', 'submitted', 'approved', 'returned')),
    submission_text text null check (submission_text is null or length(submission_text) <= 3000),
    submitted_at timestamptz null,
    teacher_feedback text null check (teacher_feedback is null or length(teacher_feedback) <= 1000),
    reviewed_at timestamptz null,
    reviewed_by uuid null references auth.users(id) on delete set null,
    points_awarded integer not null default 0 check (points_awarded >= 0),
    points_awarded_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(task_id, student_id)
);

-- Add point_events FK safely
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'point_events_task_assignment_id_fkey') THEN
        ALTER TABLE public.point_events
        ADD CONSTRAINT point_events_task_assignment_id_fkey 
        FOREIGN KEY (task_assignment_id) REFERENCES public.task_assignments(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Unique partial index for task rewards to prevent duplicates
DROP INDEX IF EXISTS public.idx_point_events_unique_task_assignment;
CREATE UNIQUE INDEX idx_point_events_unique_task_assignment ON public.point_events(task_assignment_id) WHERE task_assignment_id IS NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_class_status ON public.tasks(class_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_task_assignments_task ON public.task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_student_status ON public.task_assignments(student_id, status);
CREATE INDEX IF NOT EXISTS idx_task_assignments_class ON public.task_assignments(class_id);

-- RLS Enable
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;

-- Revoke direct mutations
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tasks FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.task_assignments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tasks TO authenticated;
GRANT SELECT ON public.task_assignments TO authenticated;

-- Helper functions for RLS
CREATE OR REPLACE FUNCTION public.student_can_read_task(p_task_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.task_assignments ta
        JOIN public.students s ON ta.student_id = s.id
        JOIN public.tasks t ON ta.task_id = t.id
        WHERE t.id = p_task_id
          AND s.student_auth_user_id = auth.uid()
          AND s.is_active = true
          AND s.access_enabled = true
          AND s.deleted_at IS NULL
          AND t.status IN ('active', 'completed')
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.student_can_read_task_assignment(p_assignment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.task_assignments ta
        JOIN public.students s ON ta.student_id = s.id
        JOIN public.tasks t ON ta.task_id = t.id
        WHERE ta.id = p_assignment_id
          AND s.student_auth_user_id = auth.uid()
          AND s.is_active = true
          AND s.access_enabled = true
          AND s.deleted_at IS NULL
          AND t.status IN ('active', 'completed')
    );
END;
$$;

-- Drop existing policies
DROP POLICY IF EXISTS "Teacher tasks policy" ON public.tasks;
DROP POLICY IF EXISTS "Student tasks policy" ON public.tasks;
DROP POLICY IF EXISTS "Teacher assignments policy" ON public.task_assignments;
DROP POLICY IF EXISTS "Student assignments policy" ON public.task_assignments;

-- Policies
CREATE POLICY "Teacher tasks policy" ON public.tasks
    FOR SELECT
    USING (class_id IN (SELECT id FROM public.classes WHERE owner_id = auth.uid()));

CREATE POLICY "Student tasks policy" ON public.tasks
    FOR SELECT
    USING (public.student_can_read_task(id));

CREATE POLICY "Teacher assignments policy" ON public.task_assignments
    FOR SELECT
    USING (class_id IN (SELECT id FROM public.classes WHERE owner_id = auth.uid()));

CREATE POLICY "Student assignments policy" ON public.task_assignments
    FOR SELECT
    USING (public.student_can_read_task_assignment(id));

-- Trigger for database-level class consistency
CREATE OR REPLACE FUNCTION public.validate_task_assignment()
RETURNS trigger AS $$
DECLARE
    v_task_class_id uuid;
    v_student_class_id uuid;
BEGIN
    SELECT class_id INTO v_task_class_id FROM public.tasks WHERE id = NEW.task_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task does not exist.';
    END IF;

    SELECT class_id INTO v_student_class_id FROM public.students WHERE id = NEW.student_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student does not exist.';
    END IF;

    IF v_task_class_id != NEW.class_id OR v_student_class_id != NEW.class_id THEN
        RAISE EXCEPTION 'Class mismatch: Task, Student, and Assignment must all belong to the same class.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_validate_task_assignment ON public.task_assignments;
CREATE TRIGGER trg_validate_task_assignment
    BEFORE INSERT OR UPDATE ON public.task_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_task_assignment();

-- RPCs
-- Clean up old signatures
DROP FUNCTION IF EXISTS public.create_task(uuid, text, text, timestamptz, integer, text, uuid[], boolean);
DROP FUNCTION IF EXISTS public.update_task(uuid, text, text, timestamptz, integer, text, uuid[]);
DROP FUNCTION IF EXISTS public.set_task_status(uuid, text);
DROP FUNCTION IF EXISTS public.submit_task_assignment(uuid, text);
DROP FUNCTION IF EXISTS public.review_task_assignment(uuid, text, text);

-- 1. create_task
CREATE OR REPLACE FUNCTION public.create_task(
    p_class_id uuid,
    p_title text,
    p_instructions text,
    p_due_at timestamptz,
    p_reward_points integer,
    p_assignment_scope text,
    p_student_ids uuid[],
    p_publish_immediately boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_task_id uuid;
    v_teacher_id uuid;
    v_is_owner boolean;
    v_student_id uuid;
    v_status text;
    v_title_clean text;
    v_instructions_clean text;
    v_student_count integer := 0;
    v_student_ids uuid[] := COALESCE(p_student_ids, ARRAY[]::uuid[]);
    v_inserted_count integer := 0;
BEGIN
    v_teacher_id := auth.uid();
    IF v_teacher_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    
    -- Verify ownership
    SELECT EXISTS (
        SELECT 1 FROM public.classes WHERE id = p_class_id AND owner_id = v_teacher_id
    ) INTO v_is_owner;
    
    IF NOT v_is_owner THEN
        RAISE EXCEPTION 'Not authorized to create tasks for this class.';
    END IF;
    
    -- Normalize inputs
    v_title_clean := trim(p_title);
    v_instructions_clean := trim(p_instructions);
    
    IF length(v_title_clean) < 3 OR length(v_title_clean) > 100 THEN RAISE EXCEPTION 'Title must be between 3 and 100 characters.'; END IF;
    IF length(v_instructions_clean) > 5000 THEN RAISE EXCEPTION 'Instructions must not exceed 5000 characters.'; END IF;
    IF p_reward_points < 0 OR p_reward_points > 1000 THEN RAISE EXCEPTION 'Reward points must be between 0 and 1000.'; END IF;
    IF p_assignment_scope NOT IN ('all_students', 'selected_students') THEN RAISE EXCEPTION 'Invalid assignment scope.'; END IF;
    
    IF p_publish_immediately THEN
        v_status := 'active';
    ELSE
        v_status := 'draft';
    END IF;

    -- Pre-validate selected students
    IF p_assignment_scope = 'selected_students' THEN
        FOREACH v_student_id IN ARRAY v_student_ids
        LOOP
            IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = v_student_id AND class_id = p_class_id AND is_active = true AND deleted_at IS NULL) THEN
                RAISE EXCEPTION 'Student % is invalid, deleted, inactive, or belongs to another class.', v_student_id;
            END IF;
            v_student_count := v_student_count + 1;
        END LOOP;
        
        IF p_publish_immediately AND v_student_count = 0 THEN
            RAISE EXCEPTION 'Cannot publish a selected-student task with no valid students.';
        END IF;
    END IF;

    -- Create task
    INSERT INTO public.tasks (
        class_id, created_by, title, instructions, due_at, reward_points, assignment_scope, status, published_at
    ) VALUES (
        p_class_id, v_teacher_id, v_title_clean, v_instructions_clean, p_due_at, p_reward_points, p_assignment_scope, v_status,
        CASE WHEN p_publish_immediately THEN now() ELSE null END
    ) RETURNING id INTO v_task_id;
    
    -- Create assignments if publishing, OR if saving draft with selected students
    IF p_publish_immediately THEN
        IF p_assignment_scope = 'all_students' THEN
            INSERT INTO public.task_assignments (task_id, class_id, student_id)
            SELECT v_task_id, p_class_id, id
            FROM public.students
            WHERE class_id = p_class_id AND is_active = true AND deleted_at IS NULL;
            
            GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
            IF v_inserted_count = 0 THEN
                RAISE EXCEPTION 'Cannot publish task: no eligible active students in class.';
            END IF;
        ELSE
            -- selected students
            FOREACH v_student_id IN ARRAY v_student_ids
            LOOP
                INSERT INTO public.task_assignments (task_id, class_id, student_id)
                VALUES (v_task_id, p_class_id, v_student_id)
                ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;
    ELSE
        -- Saving draft
        IF p_assignment_scope = 'selected_students' AND v_student_count > 0 THEN
            FOREACH v_student_id IN ARRAY v_student_ids
            LOOP
                INSERT INTO public.task_assignments (task_id, class_id, student_id)
                VALUES (v_task_id, p_class_id, v_student_id)
                ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;
    END IF;
    
    RETURN v_task_id;
END;
$$;

-- 2. update_task
CREATE OR REPLACE FUNCTION public.update_task(
    p_task_id uuid,
    p_title text,
    p_instructions text,
    p_due_at timestamptz,
    p_reward_points integer,
    p_assignment_scope text,
    p_student_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_task public.tasks%rowtype;
    v_is_owner boolean;
    v_student_id uuid;
    v_title_clean text;
    v_instructions_clean text;
    v_student_ids uuid[] := COALESCE(p_student_ids, ARRAY[]::uuid[]);
    v_current_assigned uuid[];
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Task not found.'; END IF;
    
    SELECT EXISTS (
        SELECT 1 FROM public.classes WHERE id = v_task.class_id AND owner_id = auth.uid()
    ) INTO v_is_owner;
    IF NOT v_is_owner THEN RAISE EXCEPTION 'Not authorized to update this task.'; END IF;
    
    IF v_task.status = 'archived' THEN RAISE EXCEPTION 'Cannot edit archived tasks.'; END IF;
    
    v_title_clean := trim(p_title);
    v_instructions_clean := trim(p_instructions);
    
    IF length(v_title_clean) < 3 OR length(v_title_clean) > 100 THEN RAISE EXCEPTION 'Title must be between 3 and 100 characters.'; END IF;
    IF length(v_instructions_clean) > 5000 THEN RAISE EXCEPTION 'Instructions must not exceed 5000 characters.'; END IF;
    IF p_reward_points < 0 OR p_reward_points > 1000 THEN RAISE EXCEPTION 'Reward points must be between 0 and 1000.'; END IF;
    
    IF p_reward_points != v_task.reward_points THEN
        IF EXISTS (SELECT 1 FROM public.task_assignments WHERE task_id = p_task_id AND status = 'approved') THEN
            RAISE EXCEPTION 'Cannot change reward points after assignments have been approved.';
        END IF;
    END IF;

    -- If completed, ONLY allow harmless metadata updates (title, instructions, due_at, reward_points)
    -- Reject scope changes and student updates.
    IF v_task.status = 'completed' THEN
        IF p_assignment_scope != v_task.assignment_scope THEN
            RAISE EXCEPTION 'Cannot change assignment scope of a completed task.';
        END IF;
        
        UPDATE public.tasks SET
            title = v_title_clean,
            instructions = v_instructions_clean,
            due_at = p_due_at,
            reward_points = p_reward_points,
            updated_at = now()
        WHERE id = p_task_id;
        
        RETURN p_task_id;
    END IF;

    -- For draft and active tasks:
    UPDATE public.tasks SET
        title = v_title_clean,
        instructions = v_instructions_clean,
        due_at = p_due_at,
        reward_points = p_reward_points,
        assignment_scope = p_assignment_scope,
        updated_at = now()
    WHERE id = p_task_id;
    
    -- Sync assignments if not completed
    -- If switching to all_students explicitly
    IF p_assignment_scope = 'all_students' THEN
        -- Only add if it wasn't already all_students AND it's active.
        -- "When changing a draft from selected_students to all_students: do not populate the all-student roster yet"
        -- "When changing active task intentionally to all_students: use current active, non-deleted roster once"
        IF v_task.assignment_scope != 'all_students' AND v_task.status = 'active' THEN
            INSERT INTO public.task_assignments (task_id, class_id, student_id)
            SELECT p_task_id, v_task.class_id, id
            FROM public.students
            WHERE class_id = v_task.class_id AND is_active = true AND deleted_at IS NULL
            ON CONFLICT DO NOTHING;
        END IF;
        -- We do not remove any assignments for all_students scope.
    ELSE
        -- Scope is selected_students
        -- Validate incoming students
        FOREACH v_student_id IN ARRAY v_student_ids
        LOOP
            IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = v_student_id AND class_id = v_task.class_id AND is_active = true AND deleted_at IS NULL) THEN
                RAISE EXCEPTION 'Student % is invalid, deleted, inactive, or belongs to another class.', v_student_id;
            END IF;
        END LOOP;

        IF v_task.status = 'active' AND array_length(v_student_ids, 1) IS NULL THEN
            RAISE EXCEPTION 'Active tasks with selected scope must have at least one student.';
        END IF;

        -- Find assignments to remove (untouched ones that are still 'assigned')
        DELETE FROM public.task_assignments 
        WHERE task_id = p_task_id 
          AND status = 'assigned'
          AND submission_text IS NULL
          AND NOT (student_id = ANY(v_student_ids));
        
        -- Check if any unselected students couldn't be removed
        IF EXISTS (
            SELECT 1 FROM public.task_assignments 
            WHERE task_id = p_task_id 
              AND NOT (student_id = ANY(v_student_ids))
        ) THEN
            RAISE EXCEPTION 'Cannot remove students who have submitted work or been approved.';
        END IF;

        -- Add missing ones
        FOREACH v_student_id IN ARRAY v_student_ids
        LOOP
            INSERT INTO public.task_assignments (task_id, class_id, student_id)
            VALUES (p_task_id, v_task.class_id, v_student_id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    RETURN p_task_id;
END;
$$;

-- 3. set_task_status
CREATE OR REPLACE FUNCTION public.set_task_status(
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
    v_is_owner boolean;
    v_inserted_count integer := 0;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Task not found.'; END IF;
    
    SELECT EXISTS (
        SELECT 1 FROM public.classes WHERE id = v_task.class_id AND owner_id = auth.uid()
    ) INTO v_is_owner;
    IF NOT v_is_owner THEN RAISE EXCEPTION 'Not authorized.'; END IF;
    
    IF p_status NOT IN ('draft', 'active', 'completed', 'archived') THEN RAISE EXCEPTION 'Invalid status.'; END IF;
    
    IF v_task.status = 'draft' AND p_status = 'active' THEN
        -- Populate assignments if all_students
        IF v_task.assignment_scope = 'all_students' THEN
            INSERT INTO public.task_assignments (task_id, class_id, student_id)
            SELECT p_task_id, v_task.class_id, id
            FROM public.students
            WHERE class_id = v_task.class_id AND is_active = true AND deleted_at IS NULL
            ON CONFLICT DO NOTHING;
        END IF;
        
        -- Verify at least one assignment exists
        IF NOT EXISTS (SELECT 1 FROM public.task_assignments WHERE task_id = p_task_id) THEN
            RAISE EXCEPTION 'Cannot publish task: no students are assigned.';
        END IF;

        UPDATE public.tasks SET status = 'active', published_at = now(), updated_at = now() WHERE id = p_task_id;
    ELSIF v_task.status = 'active' AND p_status = 'completed' THEN
        UPDATE public.tasks SET status = 'completed', completed_at = now(), updated_at = now() WHERE id = p_task_id;
    ELSIF p_status = 'archived' AND v_task.status IN ('draft', 'active', 'completed') THEN
        UPDATE public.tasks SET status = 'archived', updated_at = now() WHERE id = p_task_id;
    ELSE
        RAISE EXCEPTION 'Invalid status transition from % to %.', v_task.status, p_status;
    END IF;
END;
$$;

-- 4. submit_task_assignment
CREATE OR REPLACE FUNCTION public.submit_task_assignment(
    p_assignment_id uuid,
    p_submission_text text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_assignment public.task_assignments%rowtype;
    v_task public.tasks%rowtype;
    v_is_student boolean;
    v_submission_clean text;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT * INTO v_assignment FROM public.task_assignments WHERE id = p_assignment_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found.'; END IF;
    
    SELECT * INTO v_task FROM public.tasks WHERE id = v_assignment.task_id;
    
    SELECT EXISTS (
        SELECT 1 FROM public.students 
        WHERE id = v_assignment.student_id 
          AND student_auth_user_id = auth.uid()
          AND is_active = true
          AND access_enabled = true
          AND deleted_at IS NULL
    ) INTO v_is_student;
    IF NOT v_is_student THEN RAISE EXCEPTION 'Not authorized. Student must be active and linked.'; END IF;
    
    IF v_task.status != 'active' THEN RAISE EXCEPTION 'Task is not active.'; END IF;
    IF v_assignment.status NOT IN ('assigned', 'returned') THEN RAISE EXCEPTION 'Cannot submit in current state.'; END IF;
    
    v_submission_clean := trim(COALESCE(p_submission_text, ''));
    IF length(v_submission_clean) > 3000 THEN RAISE EXCEPTION 'Submission text exceeds maximum length.'; END IF;
    
    UPDATE public.task_assignments SET
        status = 'submitted',
        submission_text = CASE WHEN length(v_submission_clean) > 0 THEN v_submission_clean ELSE NULL END,
        submitted_at = now(),
        updated_at = now()
    WHERE id = p_assignment_id;
END;
$$;

-- 5. review_task_assignment
CREATE OR REPLACE FUNCTION public.review_task_assignment(
    p_assignment_id uuid,
    p_action text,
    p_feedback text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_assignment public.task_assignments%rowtype;
    v_task public.tasks%rowtype;
    v_student public.students%rowtype;
    v_is_owner boolean;
    v_new_total integer;
    v_feedback_clean text;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT * INTO v_assignment FROM public.task_assignments WHERE id = p_assignment_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found.'; END IF;
    
    SELECT * INTO v_task FROM public.tasks WHERE id = v_assignment.task_id;
    SELECT * INTO v_student FROM public.students WHERE id = v_assignment.student_id;
    
    IF v_task.class_id != v_assignment.class_id OR v_student.class_id != v_assignment.class_id THEN
        RAISE EXCEPTION 'Class mismatch detected.';
    END IF;
    
    SELECT EXISTS (
        SELECT 1 FROM public.classes WHERE id = v_assignment.class_id AND owner_id = auth.uid()
    ) INTO v_is_owner;
    IF NOT v_is_owner THEN RAISE EXCEPTION 'Not authorized.'; END IF;
    
    IF v_task.status IN ('draft', 'archived') THEN
        RAISE EXCEPTION 'Cannot review assignments for draft or archived tasks.';
    END IF;
    
    v_feedback_clean := trim(COALESCE(p_feedback, ''));
    IF length(v_feedback_clean) > 1000 THEN RAISE EXCEPTION 'Feedback exceeds maximum length.'; END IF;
    
    IF p_action = 'approve' THEN
        IF v_assignment.status = 'approved' THEN
            -- Idempotent
            RETURN json_build_object(
                'assignment', row_to_json(v_assignment),
                'points_awarded', 0,
                'student_new_total', v_student.total_points
            );
        END IF;
        
        -- Update student points EXACTLY once ONLY if reward > 0
        IF v_task.reward_points > 0 THEN
            UPDATE public.students 
            SET total_points = total_points + v_task.reward_points 
            WHERE id = v_assignment.student_id
            RETURNING total_points INTO v_new_total;
        ELSE
            v_new_total := v_student.total_points;
        END IF;
        
        -- Mark approved
        UPDATE public.task_assignments SET
            status = 'approved',
            teacher_feedback = CASE WHEN length(v_feedback_clean) > 0 THEN v_feedback_clean ELSE NULL END,
            reviewed_at = now(),
            reviewed_by = auth.uid(),
            points_awarded = v_task.reward_points,
            points_awarded_at = now(),
            updated_at = now()
        WHERE id = p_assignment_id
        RETURNING * INTO v_assignment;
        
        -- Create point event if points > 0
        IF v_task.reward_points > 0 THEN
            INSERT INTO public.point_events (
                class_id, student_id, task_assignment_id, points_delta, reason, created_at, meeting_id
            ) VALUES (
                v_assignment.class_id, v_assignment.student_id, p_assignment_id, v_task.reward_points, 
                'Task reward: ' || v_task.title, now(), null
            );
        END IF;
        
        RETURN json_build_object(
            'assignment', row_to_json(v_assignment),
            'points_awarded', v_task.reward_points,
            'student_new_total', v_new_total
        );
        
    ELSIF p_action = 'return' THEN
        IF v_assignment.status = 'approved' THEN
            RAISE EXCEPTION 'Cannot return an already approved assignment.';
        END IF;
        
        IF v_assignment.status != 'submitted' THEN
            RAISE EXCEPTION 'Cannot return assignment in current state.';
        END IF;
        
        UPDATE public.task_assignments SET
            status = 'returned',
            teacher_feedback = CASE WHEN length(v_feedback_clean) > 0 THEN v_feedback_clean ELSE NULL END,
            reviewed_at = now(),
            reviewed_by = auth.uid(),
            updated_at = now()
        WHERE id = p_assignment_id
        RETURNING * INTO v_assignment;
        
        RETURN json_build_object(
            'assignment', row_to_json(v_assignment),
            'points_awarded', 0,
            'student_new_total', v_student.total_points
        );
    ELSE
        RAISE EXCEPTION 'Invalid review action.';
    END IF;
END;
$$;

-- Security and revocation
REVOKE EXECUTE ON FUNCTION public.student_can_read_task(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.student_can_read_task_assignment(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_task(uuid, text, text, timestamptz, integer, text, uuid[], boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_task(uuid, text, text, timestamptz, integer, text, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_task_status(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_task_assignment(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.review_task_assignment(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_task_assignment() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.student_can_read_task(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_can_read_task_assignment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_task(uuid, text, text, timestamptz, integer, text, uuid[], boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_task(uuid, text, text, timestamptz, integer, text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_task_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_task_assignment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_task_assignment(uuid, text, text) TO authenticated;

-- Realtime publication idempotent
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tasks') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'task_assignments') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.task_assignments;
    END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
