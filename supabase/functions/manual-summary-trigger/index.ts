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

    console.log(`Manual summary trigger requested for group_id: ${group_id}, company_id: ${company_id}`);

    // Get group data
    const { data: grupo, error } = await supabase
      .from('grupo_resumo')
      .select('*')
      .eq('id', group_id)
      .single();

    if (error) {
      const errorMessage = `Error fetching group: ${error.message}`;
      console.error(errorMessage);
      
      // Record the error in the database
      await recordDelivery(group_id, company_id, false, errorMessage);
      
      throw new Error(errorMessage);
    }

    if (!grupo) {
      const errorMessage = `Group with ID ${group_id} not found`;
      console.error(errorMessage);
      
      // Record the error in the database
      await recordDelivery(group_id, company_id, false, errorMessage);
      
      throw new Error(errorMessage);
    }

    if (!grupo.ativo) {
      const errorMessage = `Group with ID ${group_id} is inactive`;
      console.error(errorMessage);
      
      // Record the error in the database
      await recordDelivery(group_id, company_id, false, errorMessage);
      
      throw new Error(errorMessage);
    }

    // Send webhook with just the required fields
    try {
      // Prepare the webhook payload with ONLY the fields needed
      const webhookData = {
        "nome_do_grupo": grupo.nome_grupo,
        "url_do_grupo": grupo.url_grupo
      };
      
      console.log('Sending webhook data:', JSON.stringify(webhookData, null, 2));
      
      // Send the webhook
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookData)
      });
      
      console.log('Webhook response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Webhook error response: ${errorText}`);
        throw new Error(`Failed to send webhook: ${response.status} - ${errorText}`);
      }
      
      // Record successful delivery
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
    } catch (webhookError) {
      const errorMessage = `Error sending webhook: ${webhookError.message}`;
      console.error(errorMessage);
      
      // Record the webhook error in the database
      await recordDelivery(grupo.id, grupo.company_id, false, errorMessage);
      
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error('Error in group summary trigger:', error);
    
    // If we have a group_id in the request, record the failure
    try {
      const { group_id, company_id } = await req.json();
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

// Function to record delivery in the database
async function recordDelivery(grupoId: number, companyId: number, status: boolean, message: string) {
  try {
    console.log(`Recording delivery: group_id=${grupoId}, company_id=${companyId}, status=${status}, message=${message}`);
    
    // Get current date and time in Brasilia timezone (UTC-3)
    const now = new Date();
    const brasiliaTime = new Date(now.getTime() - (3 * 60 * 60 * 1000));
    
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
      console.log('Successfully recorded delivery:', data);
    }
  } catch (error) {
    console.error('Exception recording delivery:', error);
  }
}