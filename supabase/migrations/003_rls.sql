-- 003_rls.sql
-- Enable RLS on all tables and create placeholder policies for Phase 1B

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_meeting_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.life_events ENABLE ROW LEVEL SECURITY;

-- Note: In Phase 1B, we are accessing data mostly from the server using the service_role key
-- or via public read access if necessary. For now, we will add authenticated-only placeholder policies
-- and prevent public anonymous writes.

-- Classes: authenticated users can read (to be locked down to teachers later)
CREATE POLICY "Classes are viewable by authenticated users" 
ON public.classes FOR SELECT TO authenticated USING (true);

-- Students: authenticated users can read
CREATE POLICY "Students are viewable by authenticated users" 
ON public.students FOR SELECT TO authenticated USING (true);

-- Meetings: authenticated users can read
CREATE POLICY "Meetings are viewable by authenticated users" 
ON public.meetings FOR SELECT TO authenticated USING (true);

-- Student Meeting States: authenticated users can read
CREATE POLICY "Student meeting states are viewable by authenticated users" 
ON public.student_meeting_states FOR SELECT TO authenticated USING (true);

-- Events: authenticated users can read
CREATE POLICY "Point events are viewable by authenticated users" 
ON public.point_events FOR SELECT TO authenticated USING (true);

CREATE POLICY "Life events are viewable by authenticated users" 
ON public.life_events FOR SELECT TO authenticated USING (true);

-- Note: No INSERT, UPDATE, or DELETE policies are created for the public/anon roles.
-- The service_role key will be used by the repository layer to bypass RLS for Phase 1B,
-- or proper teacher policies will be implemented in a later phase.
