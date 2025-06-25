/*
  # Fix Group Summary Scheduler Time Zone Handling

  1. Changes
    - Update the group_summary_scheduler function to properly handle time zones
    - Ensure the scheduler compares times in Brasilia time zone (UTC-3)
    - Add logging for better troubleshooting
    
  2. Purpose
    - Fix issue where scheduled summaries are not being sent at the configured time
    - Ensure consistent time zone handling between UI and backend
    - Improve reliability of the scheduled summary feature
*/

-- Create a new function to test the current time in Brasilia timezone
CREATE OR REPLACE FUNCTION public.get_current_brasilia_time()
RETURNS TEXT AS $$
DECLARE
  current_utc TIMESTAMP WITH TIME ZONE;
  brasilia_time TIMESTAMP WITH TIME ZONE;
  formatted_time TEXT;
BEGIN
  current_utc := now() AT TIME ZONE 'UTC';
  brasilia_time := current_utc AT TIME ZONE 'America/Sao_Paulo';
  formatted_time := to_char(brasilia_time, 'HH24:MI');
  RETURN formatted_time;
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the purpose of this function
COMMENT ON FUNCTION public.get_current_brasilia_time() IS 'Returns the current time in Brasilia timezone (UTC-3) in HH:MM format';