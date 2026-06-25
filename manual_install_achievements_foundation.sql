-- manual_install_achievements_foundation.sql

BEGIN;

-- 1. Create achievement_definitions table
CREATE TABLE IF NOT EXISTS public.achievement_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  tier text NOT NULL,
  icon_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_automatic boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create student_achievements table
CREATE TABLE IF NOT EXISTS public.student_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  achievement_definition_id uuid REFERENCES public.achievement_definitions(id) ON DELETE SET NULL,
  achievement_key_snapshot text NOT NULL,
  achievement_name_snapshot text NOT NULL,
  achievement_description_snapshot text NOT NULL,
  category_snapshot text NOT NULL,
  tier_snapshot text NOT NULL,
  icon_key_snapshot text NOT NULL,
  source_type text NOT NULL,
  source_meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL,
  awarded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  earned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Constraints & Indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_achievements_unique_automatic') THEN
        CREATE UNIQUE INDEX student_achievements_unique_automatic ON public.student_achievements (student_id, class_id, achievement_definition_id) WHERE source_type = 'automatic';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS student_achievements_student_id_idx ON public.student_achievements(student_id);
CREATE INDEX IF NOT EXISTS student_achievements_class_id_idx ON public.student_achievements(class_id);
CREATE INDEX IF NOT EXISTS student_achievements_earned_at_idx ON public.student_achievements(earned_at);
CREATE INDEX IF NOT EXISTS achievement_definitions_key_idx ON public.achievement_definitions(key);

-- 4. Enable RLS
ALTER TABLE public.achievement_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_achievements ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Achievement definitions are viewable by authenticated users" ON public.achievement_definitions;
    CREATE POLICY "Achievement definitions are viewable by authenticated users" 
    ON public.achievement_definitions FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Teachers can view student achievements for their classes" ON public.student_achievements;
    CREATE POLICY "Teachers can view student achievements for their classes"
    ON public.student_achievements FOR SELECT TO authenticated
    USING (class_id IN (SELECT id FROM public.classes WHERE owner_id = auth.uid()));

    DROP POLICY IF EXISTS "Students can view their own achievements" ON public.student_achievements;
    CREATE POLICY "Students can view their own achievements"
    ON public.student_achievements FOR SELECT TO authenticated
    USING (student_id IN (SELECT id FROM public.students WHERE student_auth_user_id = auth.uid()));

    -- NO INSERT POLICY for regular clients. Insert is only via SECURITY DEFINER functions.
END $$;

-- Add table to publication for realtime
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE student_achievements;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Seed Achievement Definitions
INSERT INTO public.achievement_definitions (key, name, description, category, tier, icon_key, is_automatic, sort_order) VALUES
('first_point', 'First Signal', 'Earn your first Mission Point.', 'Points', 'Bronze', 'radio', true, 10),
('points_50', 'Momentum Builder', 'Reach 50 Mission Points.', 'Points', 'Silver', 'zap', true, 20),
('points_100', 'Century Operator', 'Reach 100 Mission Points.', 'Points', 'Silver', 'star', true, 30),
('points_250', 'Command Specialist', 'Reach 250 Mission Points.', 'Points', 'Gold', 'award', true, 40),
('points_500', 'Mission Veteran', 'Reach 500 Mission Points.', 'Points', 'Platinum', 'crown', true, 50),

('first_meeting', 'First Deployment', 'Complete your first class meeting.', 'Participation', 'Bronze', 'flag', true, 60),
('meetings_5', 'Reliable Crew', 'Participate in five completed meetings.', 'Participation', 'Silver', 'users', true, 70),
('meetings_10', 'Mission Regular', 'Participate in ten completed meetings.', 'Participation', 'Gold', 'calendar-check', true, 80),
('meetings_25', 'Operations Veteran', 'Participate in twenty-five completed meetings.', 'Participation', 'Platinum', 'shield', true, 90),

('teacher_recognition', 'Teacher Recognition', 'Receive special recognition from your teacher.', 'Special', 'Special', 'star', false, 1000)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  tier = EXCLUDED.tier,
  icon_key = EXCLUDED.icon_key,
  sort_order = EXCLUDED.sort_order;


-- 7. Helper Function First
CREATE OR REPLACE FUNCTION public._check_and_award_achievement(p_student_id uuid, p_class_id uuid, p_key text, p_condition boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_def record;
    v_new_id uuid;
BEGIN
    IF NOT p_condition THEN
        RETURN '[]'::jsonb;
    END IF;

    SELECT * INTO v_def FROM public.achievement_definitions WHERE key = p_key AND is_active = true;
    IF v_def IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.student_achievements
        WHERE student_id = p_student_id AND achievement_definition_id = v_def.id AND source_type = 'automatic'
    ) THEN
        RETURN '[]'::jsonb;
    END IF;

    INSERT INTO public.student_achievements (
        class_id, student_id, achievement_definition_id,
        achievement_key_snapshot, achievement_name_snapshot,
        achievement_description_snapshot, category_snapshot,
        tier_snapshot, icon_key_snapshot, source_type
    ) VALUES (
        p_class_id, p_student_id, v_def.id,
        v_def.key, v_def.name,
        v_def.description, v_def.category,
        v_def.tier, v_def.icon_key, 'automatic'
    ) RETURNING id INTO v_new_id;

    RETURN jsonb_build_array(jsonb_build_object(
        'id', v_new_id,
        'achievement_key_snapshot', v_def.key,
        'achievement_name_snapshot', v_def.name,
        'icon_key_snapshot', v_def.icon_key,
        'tier_snapshot', v_def.tier
    ));
END;
$$;
REVOKE ALL ON FUNCTION public._check_and_award_achievement(uuid, uuid, text, boolean) FROM public, anon;


-- 8. Evaluate all student achievements
CREATE OR REPLACE FUNCTION public.evaluate_student_achievements(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_class_id uuid;
    v_total_points integer;
    v_completed_meetings integer;
    v_new_achievements jsonb := '[]'::jsonb;
    v_student record;
BEGIN
    -- Verify caller owns the class
    SELECT s.class_id, s.total_points, s.display_name INTO v_class_id, v_total_points, v_student.display_name
    FROM public.students s
    JOIN public.classes c ON s.class_id = c.id
    WHERE s.id = p_student_id AND c.owner_id = auth.uid();

    IF v_class_id IS NULL THEN
        RAISE EXCEPTION 'Not authorized or student not found';
    END IF;

    -- Evaluate Points Achievements
    v_new_achievements := v_new_achievements || public._check_and_award_achievement(p_student_id, v_class_id, 'first_point', v_total_points > 0);
    v_new_achievements := v_new_achievements || public._check_and_award_achievement(p_student_id, v_class_id, 'points_50', v_total_points >= 50);
    v_new_achievements := v_new_achievements || public._check_and_award_achievement(p_student_id, v_class_id, 'points_100', v_total_points >= 100);
    v_new_achievements := v_new_achievements || public._check_and_award_achievement(p_student_id, v_class_id, 'points_250', v_total_points >= 250);
    v_new_achievements := v_new_achievements || public._check_and_award_achievement(p_student_id, v_class_id, 'points_500', v_total_points >= 500);

    -- Get Meeting Stats
    SELECT count(*)
    INTO v_completed_meetings
    FROM public.student_meeting_states sms
    JOIN public.meetings m ON sms.meeting_id = m.id
    WHERE sms.student_id = p_student_id AND m.status = 'completed';

    -- Evaluate Participation Achievements
    v_new_achievements := v_new_achievements || public._check_and_award_achievement(p_student_id, v_class_id, 'first_meeting', v_completed_meetings >= 1);
    v_new_achievements := v_new_achievements || public._check_and_award_achievement(p_student_id, v_class_id, 'meetings_5', v_completed_meetings >= 5);
    v_new_achievements := v_new_achievements || public._check_and_award_achievement(p_student_id, v_class_id, 'meetings_10', v_completed_meetings >= 10);
    v_new_achievements := v_new_achievements || public._check_and_award_achievement(p_student_id, v_class_id, 'meetings_25', v_completed_meetings >= 25);

    RETURN v_new_achievements;
END;
$$;
REVOKE ALL ON FUNCTION public.evaluate_student_achievements(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.evaluate_student_achievements(uuid) TO authenticated;


-- 9. Evaluate all students in a class
CREATE OR REPLACE FUNCTION public.evaluate_class_achievements(p_class_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_student record;
    v_results jsonb := '[]'::jsonb;
    v_student_achievements jsonb;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = p_class_id AND owner_id = auth.uid()) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    FOR v_student IN SELECT id FROM public.students WHERE class_id = p_class_id AND is_active = true AND deleted_at IS NULL LOOP
        v_student_achievements := public.evaluate_student_achievements(v_student.id);
        IF jsonb_array_length(v_student_achievements) > 0 THEN
            v_results := v_results || v_student_achievements;
        END IF;
    END LOOP;

    RETURN v_results;
END;
$$;
REVOKE ALL ON FUNCTION public.evaluate_class_achievements(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.evaluate_class_achievements(uuid) TO authenticated;


-- 10. Award teacher recognition
CREATE OR REPLACE FUNCTION public.award_teacher_recognition(
  p_student_id uuid,
  p_title text,
  p_reason text,
  p_icon_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_class_id uuid;
    v_def record;
    v_new_id uuid;
BEGIN
    SELECT s.class_id INTO v_class_id
    FROM public.students s
    JOIN public.classes c ON s.class_id = c.id
    WHERE s.id = p_student_id AND c.owner_id = auth.uid();

    IF v_class_id IS NULL THEN
        RAISE EXCEPTION 'Not authorized or student not found';
    END IF;

    IF length(trim(p_title)) < 3 OR length(trim(p_title)) > 50 THEN
        RAISE EXCEPTION 'Title must be between 3 and 50 characters';
    END IF;
    
    IF p_reason IS NOT NULL AND (length(trim(p_reason)) < 3 OR length(trim(p_reason)) > 200) THEN
        RAISE EXCEPTION 'Reason must be between 3 and 200 characters';
    END IF;

    IF p_icon_key NOT IN ('star', 'award', 'trophy', 'book-open', 'microphone', 'brain', 'target', 'shield', 'users', 'zap') THEN
        RAISE EXCEPTION 'Invalid icon key';
    END IF;

    SELECT * INTO v_def FROM public.achievement_definitions WHERE key = 'teacher_recognition';
    IF v_def IS NULL THEN
        RAISE EXCEPTION 'Definition not found';
    END IF;

    INSERT INTO public.student_achievements (
        class_id, student_id, achievement_definition_id,
        achievement_key_snapshot, achievement_name_snapshot,
        achievement_description_snapshot, category_snapshot,
        tier_snapshot, icon_key_snapshot, source_type,
        awarded_by, reason
    ) VALUES (
        v_class_id, p_student_id, v_def.id,
        v_def.key, trim(p_title),
        v_def.description, v_def.category,
        v_def.tier, p_icon_key, 'manual',
        auth.uid(), trim(p_reason)
    ) RETURNING id INTO v_new_id;

    RETURN jsonb_build_object(
        'id', v_new_id,
        'achievement_name_snapshot', trim(p_title),
        'icon_key_snapshot', p_icon_key,
        'tier_snapshot', v_def.tier
    );
END;
$$;
REVOKE ALL ON FUNCTION public.award_teacher_recognition(uuid, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.award_teacher_recognition(uuid, text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
