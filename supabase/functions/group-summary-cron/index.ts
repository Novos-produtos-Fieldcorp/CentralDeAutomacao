import { createClient } from 'npm:@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors.ts';

// Initialize Supabase client with environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Webhook URL for sending summaries
const WEBHOOK_URL = 'https://n8nqp.wiseapp360.com/webhook/26254d63-b40d-469a-b1d3-62ef2a624d7e';

interface GrupoResumo {
  id: number;
  nome_grupo: string;
  url_grupo: string;
  horario: string;
  ativo: boolean;
  company_id: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get current time in UTC
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    
    // Format current time as HH:MM for comparison with database
    const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    
    console.log(`Checking for scheduled summaries at ${currentTime} UTC`);

    // Query for active groups with matching schedule time
    const { data: grupos, error } = await supabase
      .from('grupo_resumo')
      .select('*')
      .eq('ativo', true)
      .eq('horario', currentTime);

    if (error) {
      throw new Error(`Error fetching scheduled groups: ${error.message}`);
    }

    console.log(`Found ${grupos?.length || 0} groups scheduled for ${currentTime}`);

    // Process each group
    const results = [];
    if (grupos && grupos.length > 0) {
      for (const grupo of grupos) {
        try {
          // Generate summary data for this group
          const summaryData = await generateSummaryData(grupo);
          
          // Send webhook
          const webhookResult = await sendWebhook(grupo, summaryData);
          
          // Record successful delivery
          await recordDelivery(grupo.id, grupo.company_id, 'success', 'Resumo enviado com sucesso');
          
          results.push({
            group_id: grupo.id,
            group_name: grupo.nome_grupo,
            status: 'success',
            message: 'Summary sent successfully'
          });
        } catch (groupError) {
          console.error(`Error processing group ${grupo.id}:`, groupError);
          
          // Record failed delivery
          await recordDelivery(
            grupo.id, 
            grupo.company_id, 
            'error', 
            groupError instanceof Error ? groupError.message : 'Unknown error'
          );
          
          results.push({
            group_id: grupo.id,
            group_name: grupo.nome_grupo,
            status: 'error',
            message: groupError.message
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${grupos?.length || 0} groups`,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in group summary scheduler:', error);
    
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

// Function to record delivery in the database
async function recordDelivery(grupoId: number, companyId: number, status: 'success' | 'error', message: string) {
  try {
    const { error } = await supabase
      .from('envio_resumo')
      .insert({
        grupo_id: grupoId,
        company_id: companyId,
        status: status,
        mensagem: message
      });
      
    if (error) {
      console.error('Error recording delivery:', error);
    }
  } catch (error) {
    console.error('Exception recording delivery:', error);
  }
}

// Function to generate summary data for a group
async function generateSummaryData(grupo: GrupoResumo) {
  // Get company data
  const { data: company, error: companyError } = await supabase
    .from('company')
    .select('nome_company')
    .eq('company_id', grupo.company_id)
    .single();

  if (companyError) {
    throw new Error(`Error fetching company data: ${companyError.message}`);
  }

  // Get today's date in local format
  const today = new Date();
  const formattedDate = today.toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Get motoristas count
  const { count: motoristasCount, error: motoristasError } = await supabase
    .from('motorista')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', grupo.company_id)
    .eq('funcao', 'Motorista');

  if (motoristasError) {
    throw new Error(`Error fetching motoristas count: ${motoristasError.message}`);
  }

  // Get agregados count
  const { count: agregadosCount, error: agregadosError } = await supabase
    .from('motorista')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', grupo.company_id)
    .eq('funcao', 'Agregado');

  if (agregadosError) {
    throw new Error(`Error fetching agregados count: ${agregadosError.message}`);
  }

  // Get today's hodometros count
  const todayStr = today.toISOString().split('T')[0];
  const { count: hodometrosCount, error: hodometrosError } = await supabase
    .from('hodometro')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', grupo.company_id)
    .eq('data', todayStr);

  if (hodometrosError) {
    throw new Error(`Error fetching hodometros count: ${hodometrosError.message}`);
  }

  // Get today's checklists count
  const { count: checklistsCount, error: checklistsError } = await supabase
    .from('checklist')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', grupo.company_id)
    .eq('data', todayStr);

  if (checklistsError) {
    throw new Error(`Error fetching checklists count: ${checklistsError.message}`);
  }

  // Return formatted summary data
  return {
    company_name: company?.nome_company || 'Empresa',
    date: formattedDate,
    group_name: grupo.nome_grupo,
    stats: {
      motoristas: motoristasCount || 0,
      agregados: agregadosCount || 0,
      hodometros_today: hodometrosCount || 0,
      checklists_today: checklistsCount || 0
    }
  };
}

// Function to send webhook with summary data
async function sendWebhook(grupo: GrupoResumo, summaryData: any) {
  const payload = {
    group_url: grupo.url_grupo,
    group_name: grupo.nome_grupo,
    company_id: grupo.company_id,
    summary: summaryData
  };

  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send webhook: ${response.status} - ${errorText}`);
  }

  return await response.json();
}