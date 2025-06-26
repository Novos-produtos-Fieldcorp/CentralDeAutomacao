import { createClient } from 'npm:@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors.ts';

// Initialize Supabase client with environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get current time in UTC
    const now = new Date();
    
    // Convert to Brasilia timezone (UTC-3)
    const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    const brasiliaHour = brasiliaTime.getUTCHours();
    const brasiliaMinute = brasiliaTime.getUTCMinutes();
    
    // Format Brasilia time as HH:MM for comparison with database
    const currentTime = `${brasiliaHour.toString().padStart(2, '0')}:${brasiliaMinute.toString().padStart(2, '0')}`;
    
    console.log(`Current time check: ${currentTime} (Brasilia time / UTC-3)`);
    console.log(`Current UTC time: ${now.toISOString()}`);
    console.log(`Current Brasilia time: ${brasiliaTime.toISOString()}`);

    // Get the current Brasilia time from the database for verification
    const { data: dbTimeData, error: dbTimeError } = await supabase.rpc('get_current_brasilia_time_details');
    
    if (dbTimeError) {
      console.error('Error getting database time:', dbTimeError);
      throw dbTimeError;
    }
    
    console.log(`Database time details:`, dbTimeData);

    // Get all active groups regardless of time
    const { data: grupos, error: gruposError } = await supabase
      .from('grupo_resumo')
      .select('*')
      .eq('ativo', true);

    if (gruposError) throw gruposError;

    // Check which groups should be triggered now
    const matchingGroups = grupos?.filter(grupo => grupo.horario === currentTime) || [];
    const allGroups = grupos || [];

    // Get recent envios to check if any were sent recently
    const { data: recentEnvios, error: enviosError } = await supabase
      .from('envio_resumo')
      .select('*')
      .order('data_envio', { ascending: false })
      .limit(20);

    if (enviosError) throw enviosError;

    return new Response(
      JSON.stringify({
        success: true,
        debug_info: {
          current_time: {
            utc: now.toISOString(),
            brasilia_time: brasiliaTime.toISOString(),
            formatted_time: currentTime,
            database_time: dbTimeData
          },
          groups: {
            total_active: allGroups.length,
            matching_current_time: matchingGroups.length,
            matching_groups: matchingGroups.map(g => ({
              id: g.id,
              name: g.nome_grupo,
              scheduled_time: g.horario
            })),
            all_active_groups: allGroups.map(g => ({
              id: g.id,
              name: g.nome_grupo,
              scheduled_time: g.horario
            }))
          },
          recent_envios: recentEnvios?.slice(0, 5).map(e => ({
            id: e.id,
            grupo_id: e.grupo_id,
            data_envio: e.data_envio,
            status: e.status,
            mensagem: e.mensagem
          }))
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in debug function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});