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
    return new Response('ok', { 
      headers: corsHeaders,
      status: 200
    });
  }

  try {
    console.log('Manual summary trigger function called');
    
    // This endpoint allows manual triggering of a summary for a specific group
    const requestBody = await req.json();
    console.log('Request body:', JSON.stringify(requestBody, null, 2));
    
    const { group_id, company_id } = requestBody;
    
    if (!group_id) {
      throw new Error('Missing required parameter: group_id');
    }

    if (!company_id) {
      throw new Error('Missing required parameter: company_id');
    }

    console.log(`Processing manual summary for group_id: ${group_id}, company_id: ${company_id}`);

    // Get the current Brasilia time from the database for verification
    const { data: dbTimeData, error: dbTimeError } = await supabase.rpc('get_current_brasilia_time_details');
    
    if (dbTimeError) {
      console.error('Error getting database time:', dbTimeError);
    } else {
      console.log(`Database time details:`, dbTimeData);
    }

    // Get group data
    const { data: grupo, error } = await supabase
      .from('grupo_resumo')
      .select('*')
      .eq('id', group_id)
      .eq('company_id', company_id)
      .single();

    if (error) {
      console.error('Error fetching group:', error);
      throw new Error(`Error fetching group: ${error.message}`);
    }

    if (!grupo) {
      throw new Error(`Group with ID ${group_id} not found`);
    }

    console.log(`Found group: ${grupo.nome_grupo}, URL: ${grupo.url_grupo}`);

    if (!grupo.ativo) {
      throw new Error(`Group with ID ${group_id} is inactive`);
    }

    // Generate summary data for this group
    console.log('Generating summary data...');
    const summaryData = await generateSummaryData(grupo);
    console.log('Summary data generated:', JSON.stringify(summaryData, null, 2));
    
    // Send webhook
    console.log('Sending webhook...');
    const webhookResult = await sendWebhook(grupo, summaryData);
    console.log('Webhook result:', JSON.stringify(webhookResult, null, 2));
    
    // Record the delivery in the database
    console.log('Recording delivery in database...');
    await recordDelivery(grupo.id, grupo.company_id, true, 'Resumo enviado manualmente');
    console.log('Delivery recorded successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Summary sent successfully for group ${grupo.nome_grupo}`,
        data: {
          group_id: grupo.id,
          group_name: grupo.nome_grupo,
          webhook_result: webhookResult,
          current_time: {
            database: dbTimeData
          }
        }
      }),
      {
        headers: corsHeaders,
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in group summary trigger:', error);
    
    // If we have a group_id in the request, record the failure
    try {
      const requestBody = await req.clone().json();
      const { group_id, company_id } = requestBody;
      if (group_id && company_id) {
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
        headers: corsHeaders,
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
    
    console.log(`Recording delivery: grupoId=${grupoId}, companyId=${companyId}, status=${status}, message=${message}`);
    console.log(`Timestamp: ${brasiliaTime.toISOString()}`);
    
    const { data, error } = await supabase
      .from('envio_resumo')
      .insert({
        grupo_id: grupoId,
        company_id: companyId,
        data_envio: brasiliaTime.toISOString(),
        status: status,
        mensagem: message
      })
      .select();
      
    if (error) {
      console.error('Error recording delivery:', error);
    } else {
      console.log('Delivery record created:', data);
    }
  } catch (error) {
    console.error('Exception recording delivery:', error);
  }
}

// Function to generate summary data for a group
async function generateSummaryData(grupo: GrupoResumo) {
  console.log(`Generating summary data for group: ${grupo.nome_grupo}`);
  
  // Get company data
  const { data: company, error: companyError } = await supabase
    .from('company')
    .select('nome_company')
    .eq('company_id', grupo.company_id)
    .single();

  if (companyError) {
    console.error('Error fetching company data:', companyError);
    throw new Error(`Error fetching company data: ${companyError.message}`);
  }

  console.log(`Company data: ${JSON.stringify(company)}`);

  // Get today's date in local format
  const today = new Date();
  // Adjust for Brasilia timezone (UTC-3)
  const brasiliaTime = new Date(today.getTime() - (3 * 60 * 60 * 1000));
  
  const formattedDate = brasiliaTime.toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  console.log(`Formatted date: ${formattedDate}`);

  // Get motoristas count
  const { count: motoristasCount, error: motoristasError } = await supabase
    .from('motorista')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', grupo.company_id)
    .eq('funcao', 'Motorista');

  if (motoristasError) {
    console.error('Error fetching motoristas count:', motoristasError);
    throw new Error(`Error fetching motoristas count: ${motoristasError.message}`);
  }

  console.log(`Motoristas count: ${motoristasCount}`);

  // Get agregados count
  const { count: agregadosCount, error: agregadosError } = await supabase
    .from('motorista')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', grupo.company_id)
    .eq('funcao', 'Agregado');

  if (agregadosError) {
    console.error('Error fetching agregados count:', agregadosError);
    throw new Error(`Error fetching agregados count: ${agregadosError.message}`);
  }

  console.log(`Agregados count: ${agregadosCount}`);

  // Get today's hodometros count - using Brasilia date
  const todayStr = brasiliaTime.toISOString().split('T')[0];
  console.log(`Today's date (Brasilia): ${todayStr}`);
  
  const { count: hodometrosCount, error: hodometrosError } = await supabase
    .from('hodometro')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', grupo.company_id)
    .eq('data', todayStr);

  if (hodometrosError) {
    console.error('Error fetching hodometros count:', hodometrosError);
    throw new Error(`Error fetching hodometros count: ${hodometrosError.message}`);
  }

  console.log(`Hodometros count: ${hodometrosCount}`);

  // Get today's checklists count - using Brasilia date
  const { count: checklistsCount, error: checklistsError } = await supabase
    .from('checklist')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', grupo.company_id)
    .eq('data', todayStr);

  if (checklistsError) {
    console.error('Error fetching checklists count:', checklistsError);
    throw new Error(`Error fetching checklists count: ${checklistsError.message}`);
  }

  console.log(`Checklists count: ${checklistsCount}`);

  // Return formatted summary data
  const summaryData = {
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
  
  console.log('Final summary data:', JSON.stringify(summaryData, null, 2));
  return summaryData;
}

// Function to send webhook with summary data
async function sendWebhook(grupo: GrupoResumo, summaryData: any) {
  // Prepare the webhook payload with the correct field names
  const webhookData = {
    "nome do grupo": grupo.nome_grupo,
    "URL do grupo": grupo.url_grupo,
    "summary": summaryData
  };

  console.log('Sending webhook request to:', WEBHOOK_URL);
  console.log('Webhook payload:', JSON.stringify(webhookData, null, 2));

  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(webhookData)
  });

  const responseText = await response.text(); // Leia o texto da resposta uma vez
  console.log('Webhook response status:', response.status);
  console.log('Webhook response text:', responseText);

  if (!response.ok) {
    throw new Error(`Failed to send webhook: ${response.status} - ${responseText}`);
  }

  try {
    // Try to parse the response as JSON
    return JSON.parse(responseText);
  } catch (e) {
    // If parsing fails, return the text response
    console.log('Response is not valid JSON, returning text');
    return { text: responseText };
  }
}