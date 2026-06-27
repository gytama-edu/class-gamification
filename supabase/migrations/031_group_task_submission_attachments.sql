-- Phase 3E - Group Task Submission Attachments

BEGIN;

-- 1. Task submission settings
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS allow_submission_text boolean not null default true;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS allow_submission_files boolean not null default false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS require_submission_file boolean not null default false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS allowed_submission_file_categories text[] not null default ARRAY['image','document'];
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS max_submission_files integer not null default 5;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS max_submission_file_size_bytes bigint not null default 10485760;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS max_submission_total_size_bytes bigint not null default 31457280;

ALTER TABLE public.tasks ALTER COLUMN allowed_submission_file_categories SET DEFAULT ARRAY['images', 'documents']::text[];

UPDATE public.tasks 
SET allowed_submission_file_categories = ARRAY['images', 'documents']::text[] 
WHERE NOT allowed_submission_file_categories <@ ARRAY['images', 'documents']::text[];

ALTER TABLE public.tasks ADD CONSTRAINT tasks_submission_settings_check CHECK (
    (allow_submission_text = true OR allow_submission_files = true) AND
    (require_submission_file = false OR allow_submission_files = true) AND
    (max_submission_files BETWEEN 1 AND 10) AND
    (max_submission_file_size_bytes BETWEEN 1 AND 20971520) AND
    (max_submission_total_size_bytes BETWEEN 1 AND 52428800) AND
    (allowed_submission_file_categories <@ ARRAY['images', 'documents']::text[])
);

-- 2. Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'group-task-submissions', 
    'group-task-submissions', 
    false, 
    10485760, -- 10MB
    ARRAY[
        'images/jpeg', 'images/png', 'images/webp',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'
    ]
)
ON CONFLICT (id) DO UPDATE SET 
    public = false, 
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
        'images/jpeg', 'images/png', 'images/webp',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'
    ];

-- 3. Attempts table
CREATE TABLE IF NOT EXISTS public.task_project_group_submission_attempts (
    id uuid primary key default gen_random_uuid(),
    group_assignment_id uuid not null references public.task_project_group_assignments(id) on delete cascade,
    task_id uuid not null references public.tasks(id) on delete cascade,
    class_id uuid not null references public.classes(id) on delete cascade,
    attempt_number integer not null check (attempt_number > 0),
    status text not null default 'draft' check (status in ('draft', 'submitted', 'returned', 'approved', 'superseded')),
    submission_text text null check (submission_text is null or length(submission_text) <= 3000),
    submitted_at timestamptz null,
    submitted_by_student_id uuid null references public.students(id) on delete set null,
    submitted_by_name_snapshot text null,
    teacher_feedback text null check (teacher_feedback is null or length(teacher_feedback) <= 1000),
    reviewed_at timestamptz null,
    reviewed_by uuid null references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    UNIQUE (group_assignment_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_group_submission_attempts_ga_id ON public.task_project_group_submission_attempts(group_assignment_id);

ALTER TABLE public.task_project_group_submission_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.task_project_group_submission_attempts FROM public, anon;
GRANT SELECT ON public.task_project_group_submission_attempts TO authenticated;

-- RLS: Teacher can view if they own the class
CREATE POLICY "Teacher can view class group attempts" ON public.task_project_group_submission_attempts
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.classes WHERE classes.id = task_project_group_submission_attempts.class_id AND classes.created_by = auth.uid()));

-- RLS: Student can view if they are snapshotted member
CREATE POLICY "Student can view group attempts" ON public.task_project_group_submission_attempts
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.task_assignments ta 
        WHERE ta.project_group_assignment_id = task_project_group_submission_attempts.group_assignment_id 
          AND ta.student_id IN (SELECT id FROM public.students WHERE student_auth_user_id = auth.uid())
    ));


-- 4. Files metadata table
CREATE TABLE IF NOT EXISTS public.task_project_group_submission_files (
    id uuid primary key default gen_random_uuid(),
    submission_attempt_id uuid not null references public.task_project_group_submission_attempts(id) on delete cascade,
    group_assignment_id uuid not null references public.task_project_group_assignments(id) on delete cascade,
    task_id uuid not null references public.tasks(id) on delete cascade,
    class_id uuid not null references public.classes(id) on delete cascade,
    uploaded_by_student_id uuid not null references public.students(id) on delete cascade,
    uploaded_by_name_snapshot text not null,
    original_file_name text not null check (length(original_file_name) <= 255),
    safe_file_name text not null check (length(safe_file_name) <= 255),
    storage_bucket text not null default 'group-task-submissions',
    storage_path text not null unique,
    mime_type text not null,
    file_extension text not null,
    file_size_bytes bigint not null check (file_size_bytes > 0),
    file_category text not null check (file_category in ('image', 'document')),
    upload_status text not null default 'pending' check (upload_status in ('pending', 'ready', 'failed', 'deleted')),
    created_at timestamptz not null default now(),
    ready_at timestamptz null,
    deleted_at timestamptz null,
    deleted_by_student_id uuid null references public.students(id) on delete set null
);

CREATE INDEX IF NOT EXISTS idx_group_submission_files_attempt_id ON public.task_project_group_submission_files(submission_attempt_id);
CREATE INDEX IF NOT EXISTS idx_group_submission_files_ga_id ON public.task_project_group_submission_files(group_assignment_id);
CREATE INDEX IF NOT EXISTS idx_group_submission_files_student_id ON public.task_project_group_submission_files(uploaded_by_student_id);

ALTER TABLE public.task_project_group_submission_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.task_project_group_submission_files FROM public, anon;
GRANT SELECT ON public.task_project_group_submission_files TO authenticated;

-- RLS: Teacher view
CREATE POLICY "Teacher can view class group files" ON public.task_project_group_submission_files
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.classes WHERE classes.id = task_project_group_submission_files.class_id AND classes.created_by = auth.uid()));

-- RLS: Student view
CREATE POLICY "Student can view group files" ON public.task_project_group_submission_files
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.task_assignments ta 
        WHERE ta.project_group_assignment_id = task_project_group_submission_files.group_assignment_id 
          AND ta.student_id IN (SELECT id FROM public.students WHERE student_auth_user_id = auth.uid())
    ));


-- 5. Add columns to group assignments
ALTER TABLE public.task_project_group_assignments ADD COLUMN IF NOT EXISTS current_submission_attempt_id uuid null references public.task_project_group_submission_attempts(id) on delete set null;
ALTER TABLE public.task_project_group_assignments ADD COLUMN IF NOT EXISTS submission_attempt_count integer not null default 0;
ALTER TABLE public.task_project_group_assignments ADD COLUMN IF NOT EXISTS attachment_count integer not null default 0;

-- 6. Backfill existing submissions
DO $$
DECLARE
    r record;
    v_attempt_id uuid;
BEGIN
    FOR r IN (
        SELECT * FROM public.task_project_group_assignments 
        WHERE status IN ('submitted', 'returned', 'approved') 
          AND (submission_text IS NOT NULL OR submitted_at IS NOT NULL)
    ) LOOP
        -- check if an attempt exists
        IF NOT EXISTS (SELECT 1 FROM public.task_project_group_submission_attempts WHERE group_assignment_id = r.id AND attempt_number = 1) THEN
            INSERT INTO public.task_project_group_submission_attempts (
                group_assignment_id, task_id, class_id, attempt_number,
                status, submission_text, submitted_at, submitted_by_student_id,
                submitted_by_name_snapshot, teacher_feedback, reviewed_at, reviewed_by,
                created_at, updated_at
            ) VALUES (
                r.id, r.task_id, r.class_id, 1,
                CASE WHEN r.status = 'submitted' THEN 'submitted' WHEN r.status = 'returned' THEN 'returned' ELSE 'approved' END,
                r.submission_text, r.submitted_at, r.submitted_by_student_id,
                r.submitted_by_name_snapshot, r.teacher_feedback, r.reviewed_at, r.reviewed_by,
                COALESCE(r.submitted_at, r.created_at), COALESCE(r.reviewed_at, r.submitted_at, r.updated_at)
            ) RETURNING id INTO v_attempt_id;

            UPDATE public.task_project_group_assignments
            SET current_submission_attempt_id = v_attempt_id,
                submission_attempt_count = 1
            WHERE id = r.id;
        END IF;
    END LOOP;
END $$;

-- 7. Realtime publications
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_project_group_submission_attempts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_project_group_submission_files;

-- 8. Storage RLS Policies
-- Enable RLS on storage.objects if not already enabled (done globally by default but good to verify)
-- Drop existing policies on group-task-submissions bucket to ensure clean state
DROP POLICY IF EXISTS "Teacher view group-task-submissions" ON storage.objects;
DROP POLICY IF EXISTS "Student view group-task-submissions" ON storage.objects;
DROP POLICY IF EXISTS "Student upload group-task-submissions" ON storage.objects;
DROP POLICY IF EXISTS "Student delete group-task-submissions" ON storage.objects;

-- Read policy: Teacher owns class, or Student is member
CREATE POLICY "Read group-task-submissions" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'group-task-submissions' AND (
        -- Teacher owns class
        EXISTS (
            SELECT 1 FROM public.task_project_group_submission_files f
            JOIN public.classes c ON c.id = f.class_id
            WHERE f.storage_path = storage.objects.name AND c.created_by = auth.uid()
        )
        OR
        -- Student is member
        EXISTS (
            SELECT 1 FROM public.task_project_group_submission_files f
            JOIN public.task_assignments ta ON ta.project_group_assignment_id = f.group_assignment_id
            JOIN public.students s ON s.id = ta.student_id
            WHERE f.storage_path = storage.objects.name AND s.student_auth_user_id = auth.uid()
        )
    )
);

-- Upload policy: Allowed only if metadata exists in pending state for the current user
CREATE POLICY "Upload group-task-submissions" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'group-task-submissions' AND 
    EXISTS (
        SELECT 1 FROM public.task_project_group_submission_files f
        JOIN public.students s ON s.id = f.uploaded_by_student_id
        WHERE f.storage_path = storage.objects.name 
          AND f.upload_status = 'pending' 
          AND s.student_auth_user_id = auth.uid()
    )
);

-- Delete policy: Allowed only if file is draft and user is member
CREATE POLICY "Delete group-task-submissions" ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'group-task-submissions' AND 
    EXISTS (
        SELECT 1 FROM public.task_project_group_submission_files f
        JOIN public.task_project_group_submission_attempts a ON a.id = f.submission_attempt_id
        JOIN public.task_assignments ta ON ta.project_group_assignment_id = f.group_assignment_id
        JOIN public.students s ON s.id = ta.student_id
        WHERE f.storage_path = storage.objects.name 
          AND a.status = 'draft'
          AND s.student_auth_user_id = auth.uid()
    )
);


COMMIT;


-- Phase 3E - Group Task Submission Attachments RPCs

BEGIN;

-- 9. Secure authorization helpers
CREATE OR REPLACE FUNCTION public.can_access_project_group_submission(p_group_assignment_id uuid)
RETURNS boolean AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_class_id uuid;
    v_class_owner uuid;
    v_student_id uuid;
BEGIN
    SELECT class_id INTO v_class_id FROM public.task_project_group_assignments WHERE id = p_group_assignment_id;
    IF v_class_id IS NULL THEN RETURN false; END IF;

    SELECT created_by INTO v_class_owner FROM public.classes WHERE id = v_class_id;
    IF v_class_owner = v_user_id THEN RETURN true; END IF;

    -- Check student
    SELECT id INTO v_student_id FROM public.students 
    WHERE student_auth_user_id = v_user_id AND is_active = true AND deleted_at IS NULL AND access_enabled = true AND class_id = v_class_id;
    
    IF v_student_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.task_assignments 
            WHERE project_group_assignment_id = p_group_assignment_id AND student_id = v_student_id
        ) THEN
            RETURN true;
        END IF;
    END IF;

    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.can_access_project_group_submission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_project_group_submission(uuid) TO authenticated;

-- Helper to get or create draft attempt
CREATE OR REPLACE FUNCTION public.get_or_create_draft_group_attempt(p_group_assignment_id uuid)
RETURNS uuid AS $$
DECLARE
    v_attempt_id uuid;
    v_current_attempt_id uuid;
    v_status text;
    v_count integer;
    v_task_id uuid;
    v_class_id uuid;
BEGIN
    SELECT current_submission_attempt_id, submission_attempt_count, task_id, class_id
    INTO v_current_attempt_id, v_count, v_task_id, v_class_id
    FROM public.task_project_group_assignments
    WHERE id = p_group_assignment_id FOR UPDATE;

    IF v_current_attempt_id IS NOT NULL THEN
        SELECT id, status INTO v_attempt_id, v_status 
        FROM public.task_project_group_submission_attempts 
        WHERE id = v_current_attempt_id;
        
        IF v_status = 'draft' THEN
            RETURN v_attempt_id;
        END IF;
    END IF;

    -- Create new draft attempt
    INSERT INTO public.task_project_group_submission_attempts (
        group_assignment_id, task_id, class_id, attempt_number, status
    ) VALUES (
        p_group_assignment_id, v_task_id, v_class_id, v_count + 1, 'draft'
    ) RETURNING id INTO v_attempt_id;

    UPDATE public.task_project_group_assignments
    SET current_submission_attempt_id = v_attempt_id,
        submission_attempt_count = v_count + 1
    WHERE id = p_group_assignment_id;

    RETURN v_attempt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 10. Upload reservation RPC
CREATE OR REPLACE FUNCTION public.prepare_project_group_submission_upload(
    p_group_assignment_id uuid,
    p_original_filename text,
    p_mime_type text,
    p_file_size_bytes bigint,
    p_file_category text
)
RETURNS jsonb AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_student_id uuid;
    v_student_name text;
    v_task_id uuid;
    v_class_id uuid;
    v_task_status text;
    v_ga_status text;
    v_attempt_id uuid;
    v_settings record;
    v_safe_filename text;
    v_file_ext text;
    v_attachment_id uuid := gen_random_uuid();
    v_storage_path text;
    v_current_files integer;
    v_current_size bigint;
BEGIN
    -- 1,2 authenticate & verify snapshot
    SELECT s.id, s.display_name INTO v_student_id, v_student_name 
    FROM public.students s
    JOIN public.task_assignments ta ON ta.student_id = s.id
    WHERE s.student_auth_user_id = v_user_id 
      AND ta.project_group_assignment_id = p_group_assignment_id
      AND s.is_active = true AND s.deleted_at IS NULL AND s.access_enabled = true;

    IF v_student_id IS NULL THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- 3,4 verify task active & ga assigned/returned
    SELECT pga.task_id, pga.class_id, pga.status, t.status 
    INTO v_task_id, v_class_id, v_ga_status, v_task_status
    FROM public.task_project_group_assignments pga
    JOIN public.tasks t ON t.id = pga.task_id
    WHERE pga.id = p_group_assignment_id;

    IF v_task_status != 'active' THEN RAISE EXCEPTION 'Task is not active'; END IF;
    IF v_ga_status NOT IN ('assigned', 'returned') THEN RAISE EXCEPTION 'Assignment is not in a submittable state'; END IF;

    -- validate settings
    SELECT allow_submission_files, allowed_submission_file_categories, max_submission_files, max_submission_file_size_bytes, max_submission_total_size_bytes
    INTO v_settings
    FROM public.tasks WHERE id = v_task_id;

    IF v_settings.allow_submission_files = false THEN RAISE EXCEPTION 'File submissions are not allowed for this task'; END IF;
    IF p_file_category != ANY(v_settings.allowed_submission_file_categories) THEN RAISE EXCEPTION 'File category not allowed'; END IF;
    IF p_file_size_bytes > v_settings.max_submission_file_size_bytes THEN RAISE EXCEPTION 'File is too large'; END IF;

    -- extract ext
    v_file_ext := lower(substring(p_original_filename from '\.([^\.]+)$'));
    IF v_file_ext IS NULL THEN RAISE EXCEPTION 'File must have an extension'; END IF;

    -- validate mime/ext
    IF p_file_category = 'image' AND v_file_ext NOT IN ('jpg', 'jpeg', 'png', 'webp') THEN RAISE EXCEPTION 'Invalid image extension'; END IF;
    IF p_file_category = 'document' AND v_file_ext NOT IN ('pdf', 'docx', 'pptx', 'xlsx', 'txt') THEN RAISE EXCEPTION 'Invalid document extension'; END IF;

    -- 5 create/reuse attempt
    v_attempt_id := public.get_or_create_draft_group_attempt(p_group_assignment_id);

    -- validate limits
    SELECT count(*), COALESCE(sum(file_size_bytes), 0) INTO v_current_files, v_current_size
    FROM public.task_project_group_submission_files
    WHERE submission_attempt_id = v_attempt_id AND upload_status IN ('pending', 'ready');

    IF v_current_files >= v_settings.max_submission_files THEN RAISE EXCEPTION 'Maximum number of files reached'; END IF;
    IF v_current_size + p_file_size_bytes > v_settings.max_submission_total_size_bytes THEN RAISE EXCEPTION 'Total file size limit exceeded'; END IF;

    -- generate path
    v_safe_filename := v_attachment_id || '.' || v_file_ext;
    v_storage_path := v_class_id || '/' || v_task_id || '/' || p_group_assignment_id || '/' || v_safe_filename;

    -- create metadata
    INSERT INTO public.task_project_group_submission_files (
        id, submission_attempt_id, group_assignment_id, task_id, class_id,
        uploaded_by_student_id, uploaded_by_name_snapshot, original_file_name, safe_file_name,
        storage_path, mime_type, file_extension, file_size_bytes, file_category
    ) VALUES (
        v_attachment_id, v_attempt_id, p_group_assignment_id, v_task_id, v_class_id,
        v_student_id, v_student_name, substring(p_original_filename, 1, 255), v_safe_filename,
        v_storage_path, p_mime_type, v_file_ext, p_file_size_bytes, p_file_category
    );

    RETURN jsonb_build_object(
        'attachment_id', v_attachment_id,
        'storage_bucket', 'group-task-submissions',
        'storage_path', v_storage_path,
        'allowed_size', v_settings.max_submission_file_size_bytes,
        'attempt_id', v_attempt_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.prepare_project_group_submission_upload(uuid, text, text, bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_project_group_submission_upload(uuid, text, text, bigint, text) TO authenticated;

-- 11. Upload finalization RPC
CREATE OR REPLACE FUNCTION public.finalize_project_group_submission_upload(p_attachment_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_file record;
    v_obj_size bigint;
BEGIN
    SELECT f.* INTO v_file
    FROM public.task_project_group_submission_files f
    JOIN public.task_project_group_submission_attempts a ON a.id = f.submission_attempt_id
    JOIN public.students s ON s.id = f.uploaded_by_student_id
    WHERE f.id = p_attachment_id AND s.student_auth_user_id = v_user_id AND a.status = 'draft';

    IF v_file IS NULL THEN RAISE EXCEPTION 'Upload reservation not found or access denied'; END IF;

    -- verify storage object (Storage metadata size might differ slightly, checking exists is enough if bytes mismatch is minor, but we enforce via RLS limits ideally)
    -- In Supabase, we can check storage.objects
    SELECT metadata->>'size' INTO v_obj_size FROM storage.objects 
    WHERE bucket_id = 'group-task-submissions' AND name = v_file.storage_path;

    IF v_obj_size IS NULL THEN 
        UPDATE public.task_project_group_submission_files SET upload_status = 'failed' WHERE id = p_attachment_id;
        RAISE EXCEPTION 'File not found in storage bucket'; 
    END IF;

    UPDATE public.task_project_group_submission_files
    SET upload_status = 'ready',
        file_size_bytes = v_obj_size,
        ready_at = now()
    WHERE id = p_attachment_id;

    UPDATE public.task_project_group_assignments
    SET attachment_count = (
        SELECT count(*) FROM public.task_project_group_submission_files 
        WHERE group_assignment_id = v_file.group_assignment_id AND upload_status = 'ready'
    )
    WHERE id = v_file.group_assignment_id;

    RETURN jsonb_build_object('id', p_attachment_id, 'status', 'ready', 'size', v_obj_size);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.finalize_project_group_submission_upload(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_project_group_submission_upload(uuid) TO authenticated;

-- 12. Remove draft attachment RPC
CREATE OR REPLACE FUNCTION public.remove_project_group_submission_file(p_attachment_id uuid)
RETURNS text AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_file record;
    v_student_id uuid;
BEGIN
    SELECT f.* INTO v_file
    FROM public.task_project_group_submission_files f
    JOIN public.task_project_group_submission_attempts a ON a.id = f.submission_attempt_id
    WHERE f.id = p_attachment_id AND a.status = 'draft';

    IF v_file IS NULL THEN RAISE EXCEPTION 'File not found or not in draft attempt'; END IF;

    SELECT s.id INTO v_student_id
    FROM public.students s
    JOIN public.task_assignments ta ON ta.student_id = s.id
    WHERE s.student_auth_user_id = v_user_id AND ta.project_group_assignment_id = v_file.group_assignment_id;

    IF v_student_id IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;

    UPDATE public.task_project_group_submission_files
    SET upload_status = 'deleted',
        deleted_at = now(),
        deleted_by_student_id = v_student_id
    WHERE id = p_attachment_id;

    UPDATE public.task_project_group_assignments
    SET attachment_count = (
        SELECT count(*) FROM public.task_project_group_submission_files 
        WHERE group_assignment_id = v_file.group_assignment_id AND upload_status = 'ready'
    )
    WHERE id = v_file.group_assignment_id;

    RETURN v_file.storage_path;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.remove_project_group_submission_file(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_project_group_submission_file(uuid) TO authenticated;


-- 15. Update submit_project_group_task RPC
CREATE OR REPLACE FUNCTION public.submit_project_group_task(
    p_group_assignment_id uuid,
    p_submission_text text
) RETURNS void AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_student record;
    v_task record;
    v_ga record;
    v_attempt_id uuid;
    v_ready_count integer;
    v_pending_count integer;
BEGIN
    -- 1. Get student
    SELECT s.* INTO v_student FROM public.students s
    JOIN public.task_assignments ta ON ta.student_id = s.id
    WHERE s.student_auth_user_id = v_user_id AND s.is_active = true AND s.deleted_at IS NULL AND s.access_enabled = true AND ta.project_group_assignment_id = p_group_assignment_id;
    IF v_student IS NULL THEN RAISE EXCEPTION 'Not authorized or student not active'; END IF;

    -- 2. Lock GA
    SELECT * INTO v_ga FROM public.task_project_group_assignments WHERE id = p_group_assignment_id FOR UPDATE;
    IF v_ga.status NOT IN ('assigned', 'returned') THEN RAISE EXCEPTION 'Task cannot be submitted'; END IF;

    SELECT * INTO v_task FROM public.tasks WHERE id = v_ga.task_id;
    IF v_task.status != 'active' THEN RAISE EXCEPTION 'Task is not active'; END IF;

    v_attempt_id := public.get_or_create_draft_group_attempt(p_group_assignment_id);

    -- check files
    SELECT count(*) FILTER (WHERE upload_status = 'ready'), count(*) FILTER (WHERE upload_status = 'pending')
    INTO v_ready_count, v_pending_count
    FROM public.task_project_group_submission_files WHERE submission_attempt_id = v_attempt_id;

    IF v_pending_count > 0 THEN RAISE EXCEPTION 'Cannot submit while files are pending upload'; END IF;
    IF v_task.require_submission_file = true AND COALESCE(v_ready_count, 0) = 0 THEN RAISE EXCEPTION 'At least one file is required'; END IF;
    IF v_task.allow_submission_text = true AND p_submission_text IS NULL AND COALESCE(v_ready_count, 0) = 0 THEN
        RAISE EXCEPTION 'Submission text or file is required';
    END IF;

    -- UPDATE attempt
    UPDATE public.task_project_group_submission_attempts
    SET status = 'submitted',
        submission_text = p_submission_text,
        submitted_at = now(),
        submitted_by_student_id = v_student.id,
        submitted_by_name_snapshot = v_student.display_name,
        updated_at = now()
    WHERE id = v_attempt_id;

    -- UPDATE GA
    UPDATE public.task_project_group_assignments
    SET status = 'submitted',
        submission_text = p_submission_text,
        submitted_at = now(),
        submitted_by_student_id = v_student.id,
        submitted_by_name_snapshot = v_student.display_name,
        attachment_count = COALESCE(v_ready_count, 0)
    WHERE id = p_group_assignment_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 16. Update review_project_group_task RPC
CREATE OR REPLACE FUNCTION public.review_project_group_task(
    p_group_assignment_id uuid,
    p_action text,
    p_teacher_feedback text DEFAULT NULL
) RETURNS json AS $$
DECLARE
    v_teacher_id uuid := auth.uid();
    v_ga record;
    v_task record;
    v_class_owner uuid;
    v_feedback_clean text := btrim(p_teacher_feedback);
    v_now timestamptz := now();
    v_attempt_id uuid;
    v_member record;
    v_member_count integer := 0;
BEGIN
    IF v_teacher_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    IF p_action NOT IN ('approve', 'return') THEN RAISE EXCEPTION 'Invalid review action'; END IF;

    SELECT * INTO v_ga FROM public.task_project_group_assignments WHERE id = p_group_assignment_id FOR UPDATE;
    IF v_ga IS NULL THEN RAISE EXCEPTION 'Group assignment not found'; END IF;

    SELECT * INTO v_task FROM public.tasks WHERE id = v_ga.task_id FOR UPDATE;
    SELECT created_by INTO v_class_owner FROM public.classes WHERE id = v_ga.class_id;
    IF v_class_owner != v_teacher_id THEN RAISE EXCEPTION 'Not authorized'; END IF;

    v_attempt_id := v_ga.current_submission_attempt_id;

    IF p_action = 'return' THEN
        IF v_ga.status != 'submitted' THEN RAISE EXCEPTION 'Only submitted group tasks can be returned'; END IF;

        UPDATE public.task_project_group_submission_attempts
        SET status = 'returned',
            teacher_feedback = v_feedback_clean,
            reviewed_at = v_now,
            reviewed_by = v_teacher_id,
            updated_at = v_now
        WHERE id = v_attempt_id;

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
        IF v_ga.status NOT IN ('assigned', 'submitted', 'returned') THEN RAISE EXCEPTION 'Task cannot be approved'; END IF;

        IF v_attempt_id IS NOT NULL THEN
            UPDATE public.task_project_group_submission_attempts
            SET status = 'approved',
                teacher_feedback = COALESCE(v_feedback_clean, teacher_feedback),
                reviewed_at = v_now,
                reviewed_by = v_teacher_id,
                updated_at = v_now
            WHERE id = v_attempt_id;
        END IF;

        UPDATE public.task_project_group_assignments
        SET status = 'approved',
            teacher_feedback = COALESCE(v_feedback_clean, teacher_feedback),
            reviewed_at = v_now,
            reviewed_by = v_teacher_id,
            reward_points_per_member = v_task.reward_points,
            updated_at = v_now
        WHERE id = p_group_assignment_id;

        FOR v_member IN (SELECT id, status FROM public.task_assignments WHERE project_group_assignment_id = p_group_assignment_id FOR UPDATE) LOOP
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
            END IF;
        END LOOP;

        RETURN json_build_object('status', 'approved', 'id', p_group_assignment_id);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMIT;



-- 17. Update get_my_project_group_tasks RPC to include submission settings
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
) AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_student_id uuid;
BEGIN
    SELECT id INTO v_student_id FROM public.students
    WHERE student_auth_user_id = v_user_id AND is_active = true AND deleted_at IS NULL AND access_enabled = true;

    IF v_student_id IS NULL THEN RETURN; END IF;

    RETURN QUERY
    SELECT 
        t.id AS task_id,
        ta.id AS assignment_id,
        pga.id AS group_assignment_id,
        t.title AS task_title,
        t.instructions AS instructions,
        t.due_at AS due_at,
        pga.reward_points_per_member AS reward_points_per_member,
        t.status AS task_status,
        pga.status AS group_assignment_status,
        pga.group_name_snapshot AS group_name_snapshot,
        pga.group_color_key_snapshot AS group_color_key_snapshot,
        pga.submission_text AS submission_text,
        pga.submitted_at AS submitted_at,
        pga.submitted_by_name_snapshot AS submitted_by_name_snapshot,
        pga.teacher_feedback AS teacher_feedback,
        pga.reviewed_at AS reviewed_at,
        ta.reward_points_awarded AS student_awarded_points,
        (
            SELECT array_agg(s2.display_name ORDER BY s2.display_name)
            FROM public.task_assignments ta2
            JOIN public.students s2 ON ta2.student_id = s2.id
            WHERE ta2.project_group_assignment_id = pga.id
        ) AS member_names_snapshot,
        t.allow_submission_text,
        t.allow_submission_files,
        t.require_submission_file,
        t.allowed_submission_file_categories,
        t.max_submission_files,
        t.max_submission_file_size_bytes,
        t.max_submission_total_size_bytes,
        pga.attachment_count
    FROM public.task_assignments ta
    JOIN public.task_project_group_assignments pga ON ta.project_group_assignment_id = pga.id
    JOIN public.tasks t ON ta.task_id = t.id
    WHERE ta.student_id = v_student_id
    ORDER BY t.due_at ASC NULLS LAST, t.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.get_my_project_group_tasks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_project_group_tasks() TO authenticated;
