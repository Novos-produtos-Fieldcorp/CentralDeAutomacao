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

    // Get group data first
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

    // Generate summary data for this group (optimized)
    console.log('Generating summary data...');
    const summaryData = await generateSummaryDataOptimized(grupo);
    console.log('Summary data generated successfully');
    
    // Send webhook with timeout
    console.log('Sending webhook...');
    const webhookResult = await sendWebhookWithTimeout(grupo, summaryData);
    console.log('Webhook sent successfully');
    
    // Record the delivery in the database (async, don't wait)
    recordDelivery(grupo.id, grupo.company_id, true, 'Resumo enviado com sucesso (manual)')
      .catch(err => console.error('Error recording delivery:', err));

    return new Response(
      JSON.stringify({
        success: true,
        message: `Summary sent successfully for group ${grupo.nome_grupo}`,
        data: {
          group_id: grupo.id,
          group_name: grupo.nome_grupo,
          webhook_result: webhookResult
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in group summary trigger:', error);
    
    // Record failure asynchronously
    try {
      const requestBody = await req.json();
      const { group_id, company_id } = requestBody;
      if (group_id && company_id) {
        recordDelivery(group_id, company_id, false, error.message)
          .catch(err => console.error('Error recording delivery failure:', err));
      }
    } catch (recordError) {
      console.error('Error parsing request for failure recording:', recordError);
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
    
    console.log(`Recording delivery: grupoId=${grupoId}, companyId=${companyId}, status=${status}`);
    
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
      console.log('Delivery record created successfully');
    }
  } catch (error) {
    console.error('Exception recording delivery:', error);
  }
}

// Optimized function to generate summary data using a single query
async function generateSummaryDataOptimized(grupo: GrupoResumo) {
  console.log(`Generating summary data for group: ${grupo.nome_grupo}`);
  
  try {
    // Get today's date in Brasilia timezone (UTC-3)
    const today = new Date();
    const brasiliaTime = new Date(today.getTime() - (3 * 60 * 60 * 1000));
    const todayStr = brasiliaTime.toISOString().split('T')[0];
    
    const formattedDate = brasiliaTime.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    console.log(`Processing data for date: ${todayStr}`);

    // Execute all queries in parallel for better performance
    const [
      companyResult,
      motoristasResult,
      agregadosResult,
      hodometrosResult,
      checklistsResult
    ] = await Promise.all([
      // Get company data
      supabase
        .from('company')
        .select('nome_company')
        .eq('company_id', grupo.company_id)
        .single(),
      
      // Get motoristas count
      supabase
        .from('motorista')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', grupo.company_id)
        .eq('funcao', 'Motorista'),
      
      // Get agregados count
      supabase
        .from('motorista')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', grupo.company_id)
        .eq('funcao', 'Agregado'),
      
      // Get today's hodometros count
      supabase
        .from('hodometro')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', grupo.company_id)
        .eq('data', todayStr),
      
      // Get today's checklists count
      supabase
        .from('checklist')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', grupo.company_id)
        .eq('data', todayStr)
    ]);

    // Check for errors
    if (companyResult.error) {
      throw new Error(`Error fetching company data: ${companyResult.error.message}`);
    }
    if (motoristasResult.error) {
      throw new Error(`Error fetching motoristas count: ${motoristasResult.error.message}`);
    }
    if (agregadosResult.error) {
      throw new Error(`Error fetching agregados count: ${agregadosResult.error.message}`);
    }
    if (hodometrosResult.error) {
      throw new Error(`Error fetching hodometros count: ${hodometrosResult.error.message}`);
    }
    if (checklistsResult.error) {
      throw new Error(`Error fetching checklists count: ${checklistsResult.error.message}`);
    }

    // Return formatted summary data
    const summaryData = {
      company_name: companyResult.data?.nome_company || 'Empresa',
      date: formattedDate,
      group_name: grupo.nome_grupo,
      stats: {
        motoristas: motoristasResult.count || 0,
        agregados: agregadosResult.count || 0,
        hodometros_today: hodometrosResult.count || 0,
        checklists_today: checklistsResult.count || 0
      }
    };
    
    console.log('Summary data generated:', JSON.stringify(summaryData, null, 2));
    return summaryData;
  } catch (error) {
    console.error('Error generating summary data:', error);
    throw error;
  }
}

// Function to send webhook with timeout and retry logic
async function sendWebhookWithTimeout(grupo: GrupoResumo, summaryData: any) {
  // Prepare the webhook payload
  const webhookData = {
    "nome do grupo": grupo.nome_grupo,
    "URL do grupo": grupo.url_grupo,
    "summary": summaryData
  };

  console.log('Sending webhook request to:', WEBHOOK_URL);

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookData),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
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
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Webhook request timed out after 8 seconds');
    }
    
    console.error('Webhook error:', error);
    throw error;
  }
}