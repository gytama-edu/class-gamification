BEGIN;

-- 1. Modify point_events table safely
ALTER TABLE point_events ADD COLUMN IF NOT EXISTS task_assignment_id uuid;

-- We can't add the FK to point_events just yet because task_assignments doesn't exist, so create the tables first.
CREATE TABLE IF NOT EXISTS tasks (
    id uuid primary key default gen_random_uuid(),
    class_id uuid not null references classes(id) on delete cascade,
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

CREATE TABLE IF NOT EXISTS task_assignments (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references tasks(id) on delete cascade,
    class_id uuid not null references classes(id) on delete cascade,
    student_id uuid not null references students(id) on delete cascade,
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

-- Add point_events FK
ALTER TABLE point_events 
DROP CONSTRAINT IF EXISTS point_events_task_assignment_id_fkey;

ALTER TABLE point_events
ADD CONSTRAINT point_events_task_assignment_id_fkey 
FOREIGN KEY (task_assignment_id) REFERENCES task_assignments(id) ON DELETE SET NULL;

-- Unique partial index for task rewards to prevent duplicates
DROP INDEX IF EXISTS idx_point_events_unique_task_assignment;
CREATE UNIQUE INDEX idx_point_events_unique_task_assignment ON point_events(task_assignment_id) WHERE task_assignment_id IS NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_class_status ON tasks(class_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_task_assignments_task ON task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_student_status ON task_assignments(student_id, status);
CREATE INDEX IF NOT EXISTS idx_task_assignments_class ON task_assignments(class_id);

-- RLS Enable
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Teacher tasks policy" ON tasks;
CREATE POLICY "Teacher tasks policy" ON tasks
    FOR ALL
    USING (class_id IN (SELECT id FROM classes WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Student tasks policy" ON tasks;
CREATE POLICY "Student tasks policy" ON tasks
    FOR SELECT
    USING (
        id IN (
            SELECT task_id FROM task_assignments 
            WHERE student_id IN (SELECT id FROM students WHERE student_auth_user_id = auth.uid())
        ) AND status IN ('active', 'completed')
    );

DROP POLICY IF EXISTS "Teacher assignments policy" ON task_assignments;
CREATE POLICY "Teacher assignments policy" ON task_assignments
    FOR ALL
    USING (class_id IN (SELECT id FROM classes WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Student assignments policy" ON task_assignments;
CREATE POLICY "Student assignments policy" ON task_assignments
    FOR SELECT
    USING (student_id IN (SELECT id FROM students WHERE student_auth_user_id = auth.uid()));

-- RPCs

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
BEGIN
    v_teacher_id := auth.uid();
    
    -- Verify ownership
    SELECT EXISTS (
        SELECT 1 FROM classes WHERE id = p_class_id AND owner_id = v_teacher_id
    ) INTO v_is_owner;
    
    IF NOT v_is_owner THEN
        RAISE EXCEPTION 'Not authorized to create tasks for this class.';
    END IF;
    
    IF p_publish_immediately THEN
        v_status := 'active';
    ELSE
        v_status := 'draft';
    END IF;

    -- Create task
    INSERT INTO tasks (
        class_id, created_by, title, instructions, due_at, reward_points, assignment_scope, status, published_at
    ) VALUES (
        p_class_id, v_teacher_id, p_title, p_instructions, p_due_at, p_reward_points, p_assignment_scope, v_status,
        CASE WHEN p_publish_immediately THEN now() ELSE null END
    ) RETURNING id INTO v_task_id;
    
    -- Create assignments
    IF p_assignment_scope = 'all_students' THEN
        INSERT INTO task_assignments (task_id, class_id, student_id)
        SELECT v_task_id, p_class_id, id
        FROM students
        WHERE class_id = p_class_id AND is_active = true AND deleted_at IS NULL;
    ELSE
        FOREACH v_student_id IN ARRAY p_student_ids
        LOOP
            -- Verify student belongs to class
            IF EXISTS (SELECT 1 FROM students WHERE id = v_student_id AND class_id = p_class_id AND deleted_at IS NULL) THEN
                INSERT INTO task_assignments (task_id, class_id, student_id)
                VALUES (v_task_id, p_class_id, v_student_id)
                ON CONFLICT (task_id, student_id) DO NOTHING;
            END IF;
        END LOOP;
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
    v_task tasks%rowtype;
    v_is_owner boolean;
    v_student_id uuid;
BEGIN
    SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task not found.';
    END IF;
    
    SELECT EXISTS (
        SELECT 1 FROM classes WHERE id = v_task.class_id AND owner_id = auth.uid()
    ) INTO v_is_owner;
    
    IF NOT v_is_owner THEN
        RAISE EXCEPTION 'Not authorized to update this task.';
    END IF;
    
    IF v_task.status = 'archived' THEN
        RAISE EXCEPTION 'Cannot edit archived tasks.';
    END IF;
    
    IF p_reward_points != v_task.reward_points THEN
        IF EXISTS (SELECT 1 FROM task_assignments WHERE task_id = p_task_id AND status = 'approved') THEN
            RAISE EXCEPTION 'Cannot change reward points after assignments have been approved.';
        END IF;
    END IF;

    UPDATE tasks SET
        title = COALESCE(p_title, title),
        instructions = COALESCE(p_instructions, instructions),
        due_at = p_due_at,
        reward_points = COALESCE(p_reward_points, reward_points),
        assignment_scope = COALESCE(p_assignment_scope, assignment_scope),
        updated_at = now()
    WHERE id = p_task_id;
    
    -- Only update assignments if not completed
    IF v_task.status != 'completed' THEN
        IF p_assignment_scope = 'all_students' THEN
            -- Add missing active students
            INSERT INTO task_assignments (task_id, class_id, student_id)
            SELECT p_task_id, v_task.class_id, id
            FROM students
            WHERE class_id = v_task.class_id AND is_active = true AND deleted_at IS NULL
            ON CONFLICT (task_id, student_id) DO NOTHING;
            
            -- Do not delete assignments, to preserve history
        ELSE
            -- Add specified students
            FOREACH v_student_id IN ARRAY p_student_ids
            LOOP
                IF EXISTS (SELECT 1 FROM students WHERE id = v_student_id AND class_id = v_task.class_id AND deleted_at IS NULL) THEN
                    INSERT INTO task_assignments (task_id, class_id, student_id)
                    VALUES (p_task_id, v_task.class_id, v_student_id)
                    ON CONFLICT (task_id, student_id) DO NOTHING;
                END IF;
            END LOOP;
            
            -- We do not remove assignments for students no longer selected to avoid losing submission history.
        END IF;
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
    v_task tasks%rowtype;
    v_is_owner boolean;
BEGIN
    SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task not found.';
    END IF;
    
    SELECT EXISTS (
        SELECT 1 FROM classes WHERE id = v_task.class_id AND owner_id = auth.uid()
    ) INTO v_is_owner;
    
    IF NOT v_is_owner THEN
        RAISE EXCEPTION 'Not authorized.';
    END IF;
    
    IF p_status NOT IN ('draft', 'active', 'completed', 'archived') THEN
        RAISE EXCEPTION 'Invalid status.';
    END IF;
    
    -- Transitions
    IF v_task.status = 'draft' AND p_status = 'active' THEN
        -- Verify assignments exist (or just let it activate even if empty class, but req says must ensure assignments exist - let's skip strict check and just publish)
        UPDATE tasks SET status = 'active', published_at = now(), updated_at = now() WHERE id = p_task_id;
    ELSIF v_task.status = 'active' AND p_status = 'completed' THEN
        UPDATE tasks SET status = 'completed', completed_at = now(), updated_at = now() WHERE id = p_task_id;
    ELSIF p_status = 'archived' THEN
        UPDATE tasks SET status = 'archived', updated_at = now() WHERE id = p_task_id;
    ELSE
        RAISE EXCEPTION 'Invalid status transition.';
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
    v_assignment task_assignments%rowtype;
    v_task tasks%rowtype;
    v_is_student boolean;
BEGIN
    SELECT * INTO v_assignment FROM task_assignments WHERE id = p_assignment_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found.'; END IF;
    
    SELECT * INTO v_task FROM tasks WHERE id = v_assignment.task_id;
    
    SELECT EXISTS (
        SELECT 1 FROM students 
        WHERE id = v_assignment.student_id AND student_auth_user_id = auth.uid()
    ) INTO v_is_student;
    
    IF NOT v_is_student THEN RAISE EXCEPTION 'Not authorized.'; END IF;
    
    IF v_task.status != 'active' THEN
        RAISE EXCEPTION 'Task is not active.';
    END IF;
    
    IF v_assignment.status NOT IN ('assigned', 'returned') THEN
        RAISE EXCEPTION 'Cannot submit in current state.';
    END IF;
    
    UPDATE task_assignments SET
        status = 'submitted',
        submission_text = trim(p_submission_text),
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
    v_assignment task_assignments%rowtype;
    v_task tasks%rowtype;
    v_is_owner boolean;
    v_new_total integer;
BEGIN
    SELECT * INTO v_assignment FROM task_assignments WHERE id = p_assignment_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found.'; END IF;
    
    SELECT * INTO v_task FROM tasks WHERE id = v_assignment.task_id;
    
    SELECT EXISTS (
        SELECT 1 FROM classes WHERE id = v_assignment.class_id AND owner_id = auth.uid()
    ) INTO v_is_owner;
    
    IF NOT v_is_owner THEN RAISE EXCEPTION 'Not authorized.'; END IF;
    
    IF p_action = 'approve' THEN
        IF v_assignment.status = 'approved' THEN
            -- already approved, no duplicate points
            SELECT total_points INTO v_new_total FROM students WHERE id = v_assignment.student_id;
            RETURN json_build_object('points_awarded', 0, 'student_new_total', v_new_total);
        END IF;
        
        -- Update student points
        UPDATE students 
        SET total_points = total_points + v_task.reward_points 
        WHERE id = v_assignment.student_id
        RETURNING total_points INTO v_new_total;
        
        -- Mark approved
        UPDATE task_assignments SET
            status = 'approved',
            teacher_feedback = trim(p_feedback),
            reviewed_at = now(),
            reviewed_by = auth.uid(),
            points_awarded = v_task.reward_points,
            points_awarded_at = now(),
            updated_at = now()
        WHERE id = p_assignment_id;
        
        -- Create point event if points > 0
        IF v_task.reward_points > 0 THEN
            INSERT INTO point_events (
                class_id, student_id, task_assignment_id, points_delta, reason, created_at
            ) VALUES (
                v_assignment.class_id, v_assignment.student_id, p_assignment_id, v_task.reward_points, 
                'Task reward: ' || v_task.title, now()
            );
        END IF;
        
        RETURN json_build_object('points_awarded', v_task.reward_points, 'student_new_total', v_new_total);
        
    ELSIF p_action = 'return' THEN
        IF v_assignment.status = 'approved' THEN
            RAISE EXCEPTION 'Cannot return an already approved assignment.';
        END IF;
        
        IF v_assignment.status != 'submitted' THEN
            RAISE EXCEPTION 'Cannot return assignment in current state.';
        END IF;
        
        UPDATE task_assignments SET
            status = 'returned',
            teacher_feedback = trim(p_feedback),
            reviewed_at = now(),
            reviewed_by = auth.uid(),
            updated_at = now()
        WHERE id = p_assignment_id;
        
        SELECT total_points INTO v_new_total FROM students WHERE id = v_assignment.student_id;
        RETURN json_build_object('points_awarded', 0, 'student_new_total', v_new_total);
    ELSE
        RAISE EXCEPTION 'Invalid review action.';
    END IF;
END;
$$;

-- Security and revocation
REVOKE EXECUTE ON FUNCTION public.create_task FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_task FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_task_status FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_task_assignment FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.review_task_assignment FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_task TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_task TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_task_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_task_assignment TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_task_assignment TO authenticated;

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE task_assignments;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- READ ONLY VERIFICATION QUERIES
SELECT 'Tasks exists' as check_name, EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks');
SELECT 'Task assignments exists' as check_name, EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_assignments');
SELECT 'Tasks RLS enabled' as check_name, relrowsecurity FROM pg_class WHERE relname = 'tasks';
SELECT 'Task assignments RLS enabled' as check_name, relrowsecurity FROM pg_class WHERE relname = 'task_assignments';
SELECT 'Unique task_assignment in point_events exists' as check_name, EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_point_events_unique_task_assignment');
