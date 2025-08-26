import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Execute SQL to create function and disable RLS
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Disable RLS on envio_resumo table
        ALTER TABLE public.envio_resumo DISABLE ROW LEVEL SECURITY;
        
        -- Create function to get all envio_resumo records bypassing RLS
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
        
        -- Grant permissions
        GRANT EXECUTE ON FUNCTION get_envio_resumo_all(integer) TO authenticated;
        GRANT EXECUTE ON FUNCTION get_envio_resumo_all(integer) TO anon;
        
        SELECT 'Function created and RLS disabled' as result;
      `
    })

    if (error) {
      console.error('Error executing SQL:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, message: 'RLS fix applied successfully', data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})