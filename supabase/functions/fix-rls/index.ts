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

    // Execute SQL to disable RLS and drop policies on envio_resumo table
    const { data, error } = await supabase.rpc('sql', {
      query: `
        -- Disable RLS on envio_resumo table
        ALTER TABLE public.envio_resumo DISABLE ROW LEVEL SECURITY;
        
        -- Drop any existing policies that might be filtering records
        DO $$
        BEGIN
          -- Drop all known policy variations
          PERFORM pg_advisory_lock(12345);
          
          -- Get all policies for envio_resumo table and drop them
          FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'envio_resumo' AND schemaname = 'public' LOOP
            EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.envio_resumo';
          END LOOP;
          
          PERFORM pg_advisory_unlock(12345);
        END $$;
        
        SELECT 'RLS disabled and policies dropped for envio_resumo' as result;
      `
    })

    if (error) {
      console.error('Error executing SQL:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, data }), {
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