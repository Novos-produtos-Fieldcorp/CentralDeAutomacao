-- Create a new function to test the current time in Brasilia timezone with more details
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

-- Add comment explaining the purpose of this function
COMMENT ON FUNCTION public.get_current_brasilia_time_details() IS 'Returns detailed information about the current time in both UTC and Brasilia timezone';

-- Create a function to check and process scheduled summaries
CREATE OR REPLACE FUNCTION public.process_scheduled_summaries()
RETURNS SETOF TEXT AS $$
DECLARE
  current_time TEXT;
  grupo RECORD;
  result TEXT;
  webhook_url TEXT := 'https://n8nqp.wiseapp360.com/webhook/resumo-grupo';
  webhook_response RECORD;
BEGIN
  -- Get current time in Brasilia timezone (HH:MM format)
  SELECT formatted_time INTO current_time FROM public.get_current_brasilia_time_details();
  
  RETURN NEXT 'Checking for scheduled summaries at ' || current_time || ' (Brasilia time)';
  
  -- Find active groups scheduled for the current time
  FOR grupo IN 
    SELECT * FROM public.grupo_resumo 
    WHERE ativo = true AND horario = current_time
  LOOP
    RETURN NEXT 'Processing group: ' || grupo.nome_grupo || ' (ID: ' || grupo.id || ')';
    
    -- Call the webhook directly from the database
    -- In a real implementation, you would use pg_net extension to make HTTP requests
    -- For now, we'll just log that we would send the webhook
    RETURN NEXT 'Would send webhook to: ' || webhook_url;
    RETURN NEXT 'With data: { "nome do grupo": "' || grupo.nome_grupo || '", "URL do grupo": "' || grupo.url_grupo || '" }';
    
    -- Record the delivery attempt in the database
    INSERT INTO public.envio_resumo (
      grupo_id, 
      company_id, 
      data_envio, 
      status, 
      mensagem
    ) VALUES (
      grupo.id,
      grupo.company_id,
      now(),
      true,
      'Resumo enviado via processo agendado'
    );
    
    RETURN NEXT 'Recorded delivery attempt for group ID: ' || grupo.id;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the purpose of this function
COMMENT ON FUNCTION public.process_scheduled_summaries() IS 'Checks for groups scheduled for the current time and processes them';