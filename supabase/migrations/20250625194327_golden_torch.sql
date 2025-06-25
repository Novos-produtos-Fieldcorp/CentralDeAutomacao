-- Create a cron job to run the process_scheduled_summaries function every minute
DO $$
BEGIN
  -- Check if the pg_cron extension is available
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- If pg_cron is available, create a cron job
    PERFORM cron.schedule(
      'process-scheduled-summaries',
      '* * * * *', -- Run every minute
      $$SELECT public.process_scheduled_summaries()$$
    );
  ELSE
    -- If pg_cron is not available, log a message
    RAISE NOTICE 'pg_cron extension is not available. The cron job could not be created.';
  END IF;
END $$;

-- Create a function to manually trigger the process_scheduled_summaries function
CREATE OR REPLACE FUNCTION public.trigger_process_scheduled_summaries()
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  SELECT string_agg(t, E'\n') INTO result FROM public.process_scheduled_summaries() t;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the purpose of this function
COMMENT ON FUNCTION public.trigger_process_scheduled_summaries() IS 'Manually triggers the process_scheduled_summaries function';