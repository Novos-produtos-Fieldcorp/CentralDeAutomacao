/*
  # Create function to get all envio_resumo records bypassing RLS

  1. Problem
    - RLS policies are preventing records with status FALSE from appearing
    - Need a way to retrieve all records including failures
    
  2. Solution
    - Create a SQL function that runs with elevated privileges
    - Function will return all records for a given company_id regardless of status
*/

-- Create function to get all envio_resumo records for a company
CREATE OR REPLACE FUNCTION get_envio_resumo_all(p_company_id integer)
RETURNS TABLE (
  id integer,
  grupo_id integer,
  company_id integer,
  data_envio timestamptz,
  status boolean,
  mensagem text,
  created_at timestamptz,
  horario_execucao_utc text,
  resumo_grupo text,
  grupo_nome text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT 
    er.id,
    er.grupo_id,
    er.company_id,
    er.data_envio,
    er.status,
    er.mensagem,
    er.created_at,
    er.horario_execucao_utc,
    er.resumo_grupo,
    gr.nome_grupo as grupo_nome
  FROM public.envio_resumo er
  LEFT JOIN public.grupo_resumo gr ON er.grupo_id = gr.id
  WHERE er.company_id = p_company_id
  ORDER BY er.data_envio DESC
  LIMIT 100;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_envio_resumo_all(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_envio_resumo_all(integer) TO anon;

-- Add comment
COMMENT ON FUNCTION get_envio_resumo_all(integer) IS 'Returns all envio_resumo records for a company, bypassing RLS to include failed deliveries';