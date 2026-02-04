-- Corrige a função process_scheduled_summaries para realmente enviar os resumos via pg_net
-- Requer que as extensões pg_cron e pg_net estejam habilitadas no Supabase

-- Primeiro, verifica se pg_net está disponível
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'AVISO: A extensão pg_net não está habilitada. Habilite em Database -> Extensions -> pg_net';
  END IF;
END $$;

-- Atualiza a função para usar pg_net quando disponível
CREATE OR REPLACE FUNCTION public.process_scheduled_summaries()
RETURNS SETOF TEXT AS $$
DECLARE
  current_time_utc TEXT;
  current_time_brasilia TEXT;
  grupo RECORD;
  account_id INTEGER;
  api_key TEXT;
  request_id BIGINT;
  replit_url TEXT := 'https://wiselog-fleet-management-gabrielmauro.replit.app';
BEGIN
  -- Get current time in UTC (HH:MM format) - horario column stores UTC time
  SELECT 
    to_char(now() AT TIME ZONE 'UTC', 'HH24:MI'),
    to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI')
  INTO current_time_utc, current_time_brasilia;
  
  RETURN NEXT 'Horario atual - UTC: ' || current_time_utc || ' | Brasilia: ' || current_time_brasilia;
  
  -- Find active groups scheduled for the current UTC time
  FOR grupo IN 
    SELECT * FROM public.grupo_resumo 
    WHERE ativo = true AND horario = current_time_utc
  LOOP
    RETURN NEXT 'Processando grupo: ' || grupo.nome_grupo || ' (ID: ' || grupo.id || ')';
    
    -- Get id_conta_wiseapp from company
    SELECT c.id_conta_wiseapp INTO account_id
    FROM public.company c
    WHERE c.company_id = grupo.company_id;
    
    -- Get API key from wiseapp_acesso
    api_key := NULL;
    IF account_id IS NOT NULL THEN
      SELECT wa.access_token_wiseapp INTO api_key
      FROM public.wiseapp_acesso wa
      WHERE wa.id_conta_wiseapp = account_id
        AND wa.access_token_wiseapp IS NOT NULL
      LIMIT 1;
    END IF;
    
    RETURN NEXT 'Account ID: ' || COALESCE(account_id::TEXT, 'NULL') || ', API Key: ' || CASE WHEN api_key IS NOT NULL THEN 'Encontrada' ELSE 'Nao encontrada' END;
    
    -- Check if pg_net extension is available
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
      BEGIN
        -- Make HTTP request using pg_net to Replit AI service
        SELECT net.http_post(
          url := replit_url || '/api/ai/group-summary',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := jsonb_build_object(
            'nome_do_grupo', grupo.nome_grupo,
            'company_id', grupo.company_id,
            'group_id', grupo.id,
            'account_id', account_id,
            'api_key', api_key,
            'inbox_id', grupo.inbox_id
          )
        ) INTO request_id;
        
        RETURN NEXT 'Requisicao HTTP enviada, ID: ' || COALESCE(request_id::TEXT, 'NULL');
        
        -- Record success (the AI service will also record its own log)
        INSERT INTO public.envio_resumo (grupo_id, company_id, data_envio, status, mensagem, horario_execucao_utc)
        VALUES (grupo.id, grupo.company_id, CURRENT_DATE, true, 'Requisicao enviada via pg_net', current_time_utc);
        
      EXCEPTION WHEN OTHERS THEN
        RETURN NEXT 'ERRO ao enviar requisicao: ' || SQLERRM;
        INSERT INTO public.envio_resumo (grupo_id, company_id, data_envio, status, mensagem, horario_execucao_utc)
        VALUES (grupo.id, grupo.company_id, CURRENT_DATE, false, 'Erro pg_net: ' || SQLERRM, current_time_utc);
      END;
    ELSE
      -- pg_net not available
      RETURN NEXT 'AVISO: Extensao pg_net nao disponivel. Nao foi possivel enviar requisicao HTTP.';
      RETURN NEXT 'Habilite pg_net em: Supabase Dashboard -> Database -> Extensions -> pg_net';
      
      INSERT INTO public.envio_resumo (grupo_id, company_id, data_envio, status, mensagem, horario_execucao_utc)
      VALUES (grupo.id, grupo.company_id, CURRENT_DATE, false, 'Extensao pg_net nao disponivel', current_time_utc);
    END IF;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.process_scheduled_summaries() IS 'Processa grupos agendados para o horario atual UTC e envia resumos via pg_net';
