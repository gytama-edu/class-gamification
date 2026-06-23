-- 002_constraints_and_indexes.sql
-- Add check constraints, unique constraints, and indexes

-- Constraints for classes
ALTER TABLE public.classes
  ADD CONSTRAINT classes_max_lives_check CHECK (max_lives >= 1 AND max_lives <= 20),
  ADD CONSTRAINT classes_current_meeting_number_check CHECK (current_meeting_number >= 0);

-- Constraints for students
ALTER TABLE public.students
  ADD CONSTRAINT students_total_points_check CHECK (total_points >= 0);

-- Constraints for meetings
ALTER TABLE public.meetings
  ADD CONSTRAINT meetings_max_lives_snapshot_check CHECK (max_lives_snapshot >= 1 AND max_lives_snapshot <= 20),
  ADD CONSTRAINT meetings_status_check CHECK (status IN ('active', 'completed')),
  ADD CONSTRAINT meetings_meeting_number_unique UNIQUE (class_id, meeting_number);

-- Unique partial index to ensure only one active meeting per class
CREATE UNIQUE INDEX meetings_one_active_per_class_idx ON public.meetings (class_id) WHERE status = 'active';

-- Constraints for student_meeting_states
ALTER TABLE public.student_meeting_states
  ADD CONSTRAINT student_meeting_states_lives_remaining_check CHECK (lives_remaining >= 0),
  ADD CONSTRAINT student_meeting_states_unique_student_meeting UNIQUE (meeting_id, student_id);

-- Indexes for foreign keys and common queries
CREATE INDEX students_class_id_idx ON public.students(class_id);
CREATE INDEX meetings_class_id_idx ON public.meetings(class_id);
CREATE INDEX student_meeting_states_meeting_id_idx ON public.student_meeting_states(meeting_id);
CREATE INDEX student_meeting_states_student_id_idx ON public.student_meeting_states(student_id);
CREATE INDEX point_events_class_id_idx ON public.point_events(class_id);
CREATE INDEX point_events_student_id_idx ON public.point_events(student_id);
CREATE INDEX point_events_meeting_id_idx ON public.point_events(meeting_id);
CREATE INDEX life_events_class_id_idx ON public.life_events(class_id);
CREATE INDEX life_events_student_id_idx ON public.life_events(student_id);
CREATE INDEX life_events_meeting_id_idx ON public.life_events(meeting_id);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER classes_updated_at
  BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER student_meeting_states_updated_at
  BEFORE UPDATE ON public.student_meeting_states
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
