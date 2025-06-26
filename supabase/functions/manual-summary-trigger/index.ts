import { createClient } from 'npm:@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors.ts';

// Initialize Supabase client with environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Webhook URL for sending summaries
const WEBHOOK_URL = 'https://n8nqp.wiseapp360.com/webhook/resumo-grupo';

interface GrupoResumo {
  id: number;
  nome_grupo: string;
  url_grupo: string;
  horario: string;
  ativo: boolean;
  company_id: number;
  icon_name?: string;
  color_name?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // This endpoint allows manual triggering of a summary for a specific group
    const { group_id, company_id } = await req.json();
    
    if (!group_id) {
      throw new Error('Missing required parameter: group_id');
    }

    if (!company_id) {
      throw new Error('Missing required parameter: company_id');
    }

    // Get group data
    const { data: grupo, error } = await supabase
      .from('grupo_resumo')
      .select('*')
      .eq('id', group_id)
      .single();

    if (error) {
      throw new Error(`Error fetching group: ${error.message}`);
    }

    if (!grupo) {
      throw new Error(`Group with ID ${group_id} not found`);
    }

    if (!grupo.ativo) {
      throw new Error(`Group with ID ${group_id} is inactive`);
    }

    // Generate summary data for this group
    const summaryData = await generateSummaryData(grupo);
    
    // Send webhook
    const webhookResult = await sendWebhook(grupo, summaryData);
    
    // Record the delivery in the database - using Brasilia timezone
    const now = new Date();
    const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    
    await recordDelivery(grupo.id, grupo.company_id, true, 'Resumo enviado com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Summary sent successfully for group ${grupo.nome_grupo}`,
        data: {
          group_id: grupo.id,
          group_name: grupo.nome_grupo
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in group summary trigger:', error);
    
    // If we have a group_id in the request, record the failure
    try {
      const { group_id, company_id } = await req.json();
      if (group_id && company_id) {
        // Record the delivery in the database - using Brasilia timezone
        const now = new Date();
        const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
        
        await recordDelivery(group_id, company_id, false, error.message);
      }
    } catch (recordError) {
      console.error('Error recording delivery failure:', recordError);
    }
    
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
async function recordDelivery(grupoId: number, companyId: number, status: boolean, message: string) {
  try {
    // Get current date and time in Brasilia timezone (UTC-3)
    const now = new Date();
    const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    
    const { error } = await supabase
      .from('envio_resumo')
      .insert({
        grupo_id: grupoId,
        company_id: companyId,
        data_envio: brasiliaTime.toISOString(),
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

  // Get today's date in local format - using Brasilia timezone
  const today = new Date();
  const brasiliaTime = new Date(today.getTime() - (3 * 60 * 60 * 1000));
  
  const formattedDate = brasiliaTime.toLocaleDateString('pt-BR', {
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

  // Get today's hodometros count - using Brasilia date
  const todayStr = brasiliaTime.toISOString().split('T')[0];
  const { count: hodometrosCount, error: hodometrosError } = await supabase
    .from('hodometro')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', grupo.company_id)
    .eq('data', todayStr);

  if (hodometrosError) {
    throw new Error(`Error fetching hodometros count: ${hodometrosError.message}`);
  }

  // Get today's checklists count - using Brasilia date
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
  // Prepare the webhook payload with the correct field names
  const webhookData = {
    "nome do grupo": grupo.nome_grupo,
    "URL do grupo": grupo.url_grupo,
    "summary": summaryData
  };

  console.log('Sending webhook data:', JSON.stringify(webhookData, null, 2));

  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(webhookData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send webhook: ${response.status} - ${errorText}`);
  }

  return await response.json();
}