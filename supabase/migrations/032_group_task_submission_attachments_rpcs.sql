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
