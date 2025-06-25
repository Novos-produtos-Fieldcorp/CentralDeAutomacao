/*
  # Add functions to get current Brasilia time

  1. New Functions
    - Create function to get current time in Brasilia timezone (UTC-3)
    - Create function to get detailed time information for debugging
    
  2. Purpose
    - Help diagnose timezone issues with scheduled summaries
    - Provide tools for verifying correct time handling
    - Support debugging of scheduled tasks
*/

-- Create a function to get the current time in Brasilia timezone (HH:MM format)
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

-- Create a function to get detailed time information for debugging
CREATE OR REPLACE FUNCTION public.get_current_brasilia_time_details()
RETURNS JSON AS $$
DECLARE
  current_utc TIMESTAMP WITH TIME ZONE;
  brasilia_time TIMESTAMP WITH TIME ZONE;
  formatted_time TEXT;
  result JSON;
BEGIN
  current_utc := now() AT TIME ZONE 'UTC';
  brasilia_time := current_utc AT TIME ZONE 'America/Sao_Paulo';
  formatted_time := to_char(brasilia_time, 'HH24:MI');
  
  result := json_build_object(
    'utc_time', current_utc,
    'brasilia_time', brasilia_time,
    'formatted_time', formatted_time,
    'utc_hour', EXTRACT(HOUR FROM current_utc),
    'utc_minute', EXTRACT(MINUTE FROM current_utc),
    'brasilia_hour', EXTRACT(HOUR FROM brasilia_time),
    'brasilia_minute', EXTRACT(MINUTE FROM brasilia_time)
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Add comments explaining the purpose of these functions
COMMENT ON FUNCTION public.get_current_brasilia_time() IS 'Returns the current time in Brasilia timezone (UTC-3) in HH:MM format';
COMMENT ON FUNCTION public.get_current_brasilia_time_details() IS 'Returns detailed information about the current time in both UTC and Brasilia timezone';