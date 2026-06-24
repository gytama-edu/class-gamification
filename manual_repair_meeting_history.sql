-- manual_repair_meeting_history.sql
BEGIN;

CREATE OR REPLACE FUNCTION public.end_meeting(p_class_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_teacher_id UUID;
    v_meeting_id UUID;
    v_class record;
BEGIN
    v_teacher_id := auth.uid();
    IF v_teacher_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT * INTO v_class FROM public.classes WHERE id = p_class_id;
    IF v_class IS NULL THEN
        RAISE EXCEPTION 'Class not found';
    END IF;

    IF v_class.owner_id != v_teacher_id THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    SELECT id INTO v_meeting_id FROM public.meetings WHERE class_id = p_class_id AND status = 'active';
    IF v_meeting_id IS NULL THEN
        RAISE EXCEPTION 'No active meeting';
    END IF;

    -- Ensure all participating students have a state.
    -- A student participated if they have points or life events.
    INSERT INTO public.student_meeting_states (meeting_id, student_id, lives_remaining)
    SELECT pe.meeting_id, pe.student_id, v_class.max_lives
    FROM public.point_events pe
    WHERE pe.meeting_id = v_meeting_id
    UNION
    SELECT le.meeting_id, le.student_id, v_class.max_lives
    FROM public.life_events le
    WHERE le.meeting_id = v_meeting_id
    ON CONFLICT (meeting_id, student_id) DO NOTHING;

    -- Capture student snapshots and calculate points
    UPDATE public.student_meeting_states sms
    SET student_name_snapshot = COALESCE(sms.student_name_snapshot, s.display_name),
        points_after = s.total_points,
        points_before = s.total_points - COALESCE((
            SELECT SUM(points_delta) FROM public.point_events pe 
            WHERE pe.meeting_id = v_meeting_id AND pe.student_id = sms.student_id
        ), 0)
    FROM public.students s
    WHERE sms.student_id = s.id AND sms.meeting_id = v_meeting_id;

    -- Calculate rank based on points_after DESC, student_name_snapshot ASC, student_id ASC
    WITH RankedStudents AS (
        SELECT id, 
               RANK() OVER (ORDER BY points_after DESC NULLS LAST, student_name_snapshot ASC, student_id ASC) as new_rank
        FROM public.student_meeting_states
        WHERE meeting_id = v_meeting_id
    )
    UPDATE public.student_meeting_states sms
    SET final_rank = rs.new_rank
    FROM RankedStudents rs
    WHERE sms.id = rs.id;

    -- Capture class snapshots and finish meeting
    UPDATE public.meetings
    SET class_name_snapshot = COALESCE(class_name_snapshot, v_class.name),
        level_name_snapshot = COALESCE(level_name_snapshot, v_class.level_name),
        status = 'completed',
        ended_at = NOW()
    WHERE id = v_meeting_id;

    -- Evaluate achievements for the class (safe failure)
    BEGIN
        PERFORM public.evaluate_class_achievements(p_class_id);
    EXCEPTION WHEN OTHERS THEN
        -- Log or ignore achievement evaluation errors so meeting still ends successfully
    END;
END;
$$;
REVOKE ALL ON FUNCTION public.end_meeting(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.end_meeting(UUID) TO authenticated;

-- get_class_meeting_history
CREATE OR REPLACE FUNCTION public.get_class_meeting_history(p_class_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner_id UUID;
    v_teacher_id UUID := auth.uid();
    v_result JSONB;
BEGIN
    IF v_teacher_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT owner_id INTO v_owner_id FROM public.classes WHERE id = p_class_id;
    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'Class not found';
    END IF;

    IF v_owner_id != v_teacher_id THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', m.id,
            'meeting_number', m.meeting_number,
            'status', m.status,
            'started_at', m.started_at,
            'ended_at', m.ended_at,
            'participant_count', (SELECT COUNT(*) FROM public.student_meeting_states sms WHERE sms.meeting_id = m.id),
            'points_awarded', (SELECT COALESCE(SUM(pe.points_delta), 0) FROM public.point_events pe WHERE pe.meeting_id = m.id AND pe.points_delta > 0),
            'points_deducted', (SELECT ABS(COALESCE(SUM(pe.points_delta), 0)) FROM public.point_events pe WHERE pe.meeting_id = m.id AND pe.points_delta < 0),
            'net_points', (SELECT COALESCE(SUM(pe.points_delta), 0) FROM public.point_events pe WHERE pe.meeting_id = m.id),
            'lives_lost', (SELECT ABS(COALESCE(SUM(le.lives_delta), 0)) FROM public.life_events le WHERE le.meeting_id = m.id AND le.lives_delta < 0),
            'lives_restored', (SELECT COALESCE(SUM(le.lives_delta), 0) FROM public.life_events le WHERE le.meeting_id = m.id AND le.lives_delta > 0)
        ) ORDER BY m.meeting_number DESC
    ), '[]'::jsonb) INTO v_result
    FROM public.meetings m
    WHERE m.class_id = p_class_id AND m.status = 'completed';

    RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_class_meeting_history(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_class_meeting_history(UUID) TO authenticated;

-- get_meeting_report
CREATE OR REPLACE FUNCTION public.get_meeting_report(p_class_id UUID, p_meeting_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner_id UUID;
    v_teacher_id UUID := auth.uid();
    v_meeting record;
    v_result JSONB;
BEGIN
    IF v_teacher_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT owner_id INTO v_owner_id FROM public.classes WHERE id = p_class_id;
    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'Class not found';
    END IF;

    IF v_owner_id != v_teacher_id THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    SELECT * INTO v_meeting FROM public.meetings WHERE id = p_meeting_id AND class_id = p_class_id;
    IF v_meeting IS NULL THEN
        RAISE EXCEPTION 'Meeting not found';
    END IF;

    SELECT jsonb_build_object(
        'meeting', jsonb_build_object(
            'id', v_meeting.id,
            'meeting_number', v_meeting.meeting_number,
            'class_name_snapshot', COALESCE(v_meeting.class_name_snapshot, (SELECT name FROM public.classes WHERE id = p_class_id)),
            'level_name_snapshot', COALESCE(v_meeting.level_name_snapshot, (SELECT level_name FROM public.classes WHERE id = p_class_id)),
            'started_at', v_meeting.started_at,
            'ended_at', v_meeting.ended_at,
            'max_lives_snapshot', v_meeting.max_lives_snapshot,
            'participant_count', (SELECT COUNT(*) FROM public.student_meeting_states sms WHERE sms.meeting_id = v_meeting.id),
            'points_awarded', (SELECT COALESCE(SUM(pe.points_delta), 0) FROM public.point_events pe WHERE pe.meeting_id = v_meeting.id AND pe.points_delta > 0),
            'points_deducted', (SELECT ABS(COALESCE(SUM(pe.points_delta), 0)) FROM public.point_events pe WHERE pe.meeting_id = v_meeting.id AND pe.points_delta < 0),
            'net_points', (SELECT COALESCE(SUM(pe.points_delta), 0) FROM public.point_events pe WHERE pe.meeting_id = v_meeting.id),
            'lives_lost', (SELECT ABS(COALESCE(SUM(le.lives_delta), 0)) FROM public.life_events le WHERE le.meeting_id = v_meeting.id AND le.lives_delta < 0),
            'lives_restored', (SELECT COALESCE(SUM(le.lives_delta), 0) FROM public.life_events le WHERE le.meeting_id = v_meeting.id AND le.lives_delta > 0)
        ),
        'students', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'student_id', sms.student_id,
                    'student_name', COALESCE(sms.student_name_snapshot, s.display_name),
                    'final_rank', sms.final_rank,
                    'points_before', COALESCE(sms.points_before, 0),
                    'points_earned', (SELECT COALESCE(SUM(pe.points_delta), 0) FROM public.point_events pe WHERE pe.meeting_id = v_meeting.id AND pe.student_id = sms.student_id AND pe.points_delta > 0),
                    'points_deducted', (SELECT ABS(COALESCE(SUM(pe.points_delta), 0)) FROM public.point_events pe WHERE pe.meeting_id = v_meeting.id AND pe.student_id = sms.student_id AND pe.points_delta < 0),
                    'net_points', (SELECT COALESCE(SUM(pe.points_delta), 0) FROM public.point_events pe WHERE pe.meeting_id = v_meeting.id AND pe.student_id = sms.student_id),
                    'points_after', COALESCE(sms.points_after, 0),
                    'starting_lives', v_meeting.max_lives_snapshot,
                    'lives_lost', (SELECT ABS(COALESCE(SUM(le.lives_delta), 0)) FROM public.life_events le WHERE le.meeting_id = v_meeting.id AND le.student_id = sms.student_id AND le.lives_delta < 0),
                    'lives_restored', (SELECT COALESCE(SUM(le.lives_delta), 0) FROM public.life_events le WHERE le.meeting_id = v_meeting.id AND le.student_id = sms.student_id AND le.lives_delta > 0),
                    'final_lives', sms.lives_remaining
                ) ORDER BY sms.final_rank ASC NULLS LAST, COALESCE(sms.points_after, 0) DESC, COALESCE(sms.student_name_snapshot, s.display_name) ASC
            )
            FROM public.student_meeting_states sms
            LEFT JOIN public.students s ON s.id = sms.student_id
            WHERE sms.meeting_id = v_meeting.id
        ), '[]'::jsonb)
    ) INTO v_result;

    RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_meeting_report(UUID, UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_meeting_report(UUID, UUID) TO authenticated;

-- Historical repair
UPDATE public.meetings m
SET class_name_snapshot = COALESCE(m.class_name_snapshot, c.name),
    level_name_snapshot = COALESCE(m.level_name_snapshot, c.level_name)
FROM public.classes c
WHERE m.class_id = c.id
  AND m.status = 'completed'
  AND (m.class_name_snapshot IS NULL OR m.level_name_snapshot IS NULL);

UPDATE public.student_meeting_states sms
SET student_name_snapshot = COALESCE(sms.student_name_snapshot, s.display_name)
FROM public.students s
WHERE sms.student_id = s.id
  AND sms.student_name_snapshot IS NULL;

-- Repair points_before, points_after for completed meetings where they are missing
UPDATE public.student_meeting_states sms
SET points_after = s.total_points,
    points_before = s.total_points - COALESCE((
            SELECT SUM(points_delta) FROM public.point_events pe 
            WHERE pe.meeting_id = sms.meeting_id AND pe.student_id = sms.student_id
        ), 0)
FROM public.students s
JOIN public.meetings m ON m.id = sms.meeting_id
WHERE sms.student_id = s.id
  AND m.status = 'completed'
  AND sms.points_after IS NULL;

-- Recalculate rank for completed meetings where rank is missing or we just repaired points
WITH RankedStudents AS (
    SELECT id, 
           RANK() OVER (PARTITION BY meeting_id ORDER BY points_after DESC NULLS LAST, student_name_snapshot ASC, student_id ASC) as new_rank
    FROM public.student_meeting_states
    WHERE meeting_id IN (SELECT id FROM public.meetings WHERE status = 'completed')
)
UPDATE public.student_meeting_states sms
SET final_rank = rs.new_rank
FROM RankedStudents rs
WHERE sms.id = rs.id
  AND sms.final_rank IS DISTINCT FROM rs.new_rank;

-- Run a quick check
SELECT 
    (SELECT count(*) FROM public.meetings WHERE status = 'completed') as total_completed_meetings,
    (SELECT count(*) FROM public.student_meeting_states WHERE final_rank IS NULL AND meeting_id IN (SELECT id FROM public.meetings WHERE status = 'completed')) as missing_ranks;

NOTIFY pgrst, 'reload schema';

COMMIT;
