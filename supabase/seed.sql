-- seed.sql
-- Seed data for GYTama EDU Classes Gamification Phase 1B

-- Define variables using anonymous DO block or just simple inserts
DO $$
DECLARE
  v_class_id uuid;
  v_meeting_id uuid;
  v_student_1_id uuid;
  v_student_2_id uuid;
  v_student_3_id uuid;
  v_student_4_id uuid;
  v_student_5_id uuid;
  v_student_6_id uuid;
  v_student_7_id uuid;
  v_student_8_id uuid;
BEGIN
  -- Insert Class
  INSERT INTO public.classes (name, level_name, max_lives, current_meeting_number)
  VALUES ('Galaxy Explorers', 'Grade 5', 10, 1)
  RETURNING id INTO v_class_id;

  -- Insert Students
  INSERT INTO public.students (class_id, display_name, total_points) VALUES (v_class_id, 'Luna Starfall', 120) RETURNING id INTO v_student_1_id;
  INSERT INTO public.students (class_id, display_name, total_points) VALUES (v_class_id, 'Orion Blaze', 95) RETURNING id INTO v_student_2_id;
  INSERT INTO public.students (class_id, display_name, total_points) VALUES (v_class_id, 'Zara Comet', 150) RETURNING id INTO v_student_3_id;
  INSERT INTO public.students (class_id, display_name, total_points) VALUES (v_class_id, 'Ethan Galaxy', 110) RETURNING id INTO v_student_4_id;
  INSERT INTO public.students (class_id, display_name, total_points) VALUES (v_class_id, 'Milo Asteroid', 85) RETURNING id INTO v_student_5_id;
  INSERT INTO public.students (class_id, display_name, total_points) VALUES (v_class_id, 'Nova Ray', 135) RETURNING id INTO v_student_6_id;
  INSERT INTO public.students (class_id, display_name, total_points) VALUES (v_class_id, 'Atlas Moon', 200) RETURNING id INTO v_student_7_id;
  INSERT INTO public.students (class_id, display_name, total_points) VALUES (v_class_id, 'Celeste Sky', 105) RETURNING id INTO v_student_8_id;

  -- Insert Active Meeting
  INSERT INTO public.meetings (class_id, meeting_number, max_lives_snapshot, status)
  VALUES (v_class_id, 1, 10, 'active')
  RETURNING id INTO v_meeting_id;

  -- Insert Student Meeting States (lives)
  INSERT INTO public.student_meeting_states (meeting_id, student_id, lives_remaining) VALUES (v_meeting_id, v_student_1_id, 10);
  INSERT INTO public.student_meeting_states (meeting_id, student_id, lives_remaining) VALUES (v_meeting_id, v_student_2_id, 10);
  INSERT INTO public.student_meeting_states (meeting_id, student_id, lives_remaining) VALUES (v_meeting_id, v_student_3_id, 8);
  INSERT INTO public.student_meeting_states (meeting_id, student_id, lives_remaining) VALUES (v_meeting_id, v_student_4_id, 10);
  INSERT INTO public.student_meeting_states (meeting_id, student_id, lives_remaining) VALUES (v_meeting_id, v_student_5_id, 9);
  INSERT INTO public.student_meeting_states (meeting_id, student_id, lives_remaining) VALUES (v_meeting_id, v_student_6_id, 10);
  INSERT INTO public.student_meeting_states (meeting_id, student_id, lives_remaining) VALUES (v_meeting_id, v_student_7_id, 7);
  INSERT INTO public.student_meeting_states (meeting_id, student_id, lives_remaining) VALUES (v_meeting_id, v_student_8_id, 10);

END $$;
