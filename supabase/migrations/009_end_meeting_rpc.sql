BEGIN;

CREATE OR REPLACE FUNCTION public.end_meeting(p_class_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    UPDATE public.meetings
    SET status = 'completed',
        ended_at = NOW()
    WHERE class_id = p_class_id
      AND status = 'active';
END;
$$;

COMMIT;
