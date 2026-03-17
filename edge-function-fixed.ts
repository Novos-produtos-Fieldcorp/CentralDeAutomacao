import { createClient } from 'npm:@supabase/supabase-js';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// Initialize Supabase client with environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);
// AI Summary Service URL (direct n8n webhook)
const N8N_WEBHOOK_URL = 'https://n8nqp.wiseapp360.com/webhook/resumo-grupo';
Deno.serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    // Get the current Brasilia time from the database
    const { data: dbTimeData, error: dbTimeError } = await supabase.rpc('get_current_brasilia_time_details');
    if (dbTimeError) {
      console.error('Error getting database time:', dbTimeError);
      throw new Error('Failed to get current Brasilia time from database.');
    }
    const currentUtcHour = String(dbTimeData.utc_hour).padStart(2, '0');
    const currentUtcMinute = String(dbTimeData.utc_minute).padStart(2, '0');
    const currentUtcTime = `${currentUtcHour}:${currentUtcMinute}`; // e.g., "10:30"
    const currentBrasiliaTime = dbTimeData.formatted_time; // For logging/debugging
    console.log(`Current UTC Time (from DB): ${currentUtcTime}`);
    console.log(`Current Brasilia Time (from DB): ${currentBrasiliaTime}`);
    // Query for active groups matching the current UTC time
    // IMPORTANT FIX: Use UTC time for comparison since horario is stored in UTC
    const { data: grupos, error: gruposError } = await supabase.from('grupo_resumo').select('*').eq('ativo', true).eq('horario', currentUtcTime);
    if (gruposError) {
      console.error('Error fetching groups:', gruposError);
      throw new Error('Failed to fetch group summaries.');
    }
    if (!grupos || grupos.length === 0) {
      console.log('No active groups found for current time.');
      return new Response('No groups to process.', {
        status: 200,
        headers: corsHeaders
      });
    }
    console.log(`Found ${grupos.length} groups to process.`);
    // Process each matching group
    for (const grupo of grupos){
      try {
        console.log(`Processing group: ${grupo.nome_grupo} (ID: ${grupo.id})`);
        // Apenas envie os dados do grupo diretamente
        await sendWebhook(grupo, currentUtcTime); // Pass current UTC time
        await recordDelivery(grupo, 'success', 'Webhook sent successfully.', currentUtcTime);
        console.log(`Successfully processed group: ${grupo.nome_grupo}`);
      } catch (groupProcessError) {
        console.error(`Error processing group ${grupo.nome_grupo}:`, groupProcessError);
        await recordDelivery(grupo, 'failed', `Failed to send webhook: ${groupProcessError.message}`, currentUtcTime);
      }
    }
    return new Response('Group summary processing complete.', {
      status: 200,
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Edge Function error:', error.message);
    return new Response(`Error: ${error.message}`, {
      status: 500,
      headers: corsHeaders
    });
  }
});
// Certifique-se de que a função get_current_brasilia_time_details no seu banco de dados
// retorna dbTimeData.formatted_time no formato 'YYYY-MM-DD HH:MM:SS' (ou similar, completo)
// para a coluna `data_envio` que é um `timestamp with time zone`.
// A função recordDelivery revisada
async function recordDelivery(grupo, status, message, utcExecutionTime) {
  try {
    // Obtenha os detalhes de tempo do banco de dados novamente para garantir que estamos
    // pegando o timestamp mais atual no momento da gravação.
    // É importante que `dbTimeData.formatted_time` retorne um timestamp completo
    // (ex: '2025-07-08 19:01:25') e não apenas '19:01'.
    const { data: dbTimeData, error: dbTimeError } = await supabase.rpc('get_current_brasilia_time_details');
    if (dbTimeError) {
      console.error('Error getting database time for recordDelivery:', dbTimeError);
      // Não queremos que este erro crítico de log cause uma falha silenciosa
      throw new Error('Failed to get current Brasilia time for recording delivery.');
    }
    const dataEnvio = dbTimeData.formatted_time; // This should be full date like '2025-07-08 19:01:25'
    if (!dataEnvio || dataEnvio.includes(':') && dataEnvio.split(':').length === 2) {
      // If dataEnvio is just time, use current date
      const today = new Date().toISOString().split('T')[0];
      const fullDateTime = `${today} ${dataEnvio || '00:00:00'}`;
      console.log(`Recording delivery for group ${grupo.id}: status=${status}, data_envio=${fullDateTime}, horario_execucao_utc=${utcExecutionTime}`);
      const { error } = await supabase.from('envio_resumo').insert({
        grupo_id: grupo.id,
        data_envio: fullDateTime,
        horario_execucao_utc: utcExecutionTime,
        status: status,
        mensagem: message
      });
    } else {
      console.log(`Recording delivery for group ${grupo.id}: status=${status}, data_envio=${dataEnvio}, horario_execucao_utc=${utcExecutionTime}`);
      const { error } = await supabase.from('envio_resumo').insert({
        grupo_id: grupo.id,
        data_envio: dataEnvio,
        horario_execucao_utc: utcExecutionTime,
        status: status,
        mensagem: message
      });
    }
    if (error) {
      console.error('Error recording delivery:', error);
    } else {
      console.log(`Delivery record for group ${grupo.id} saved successfully.`);
    }
  } catch (err) {
    console.error('Critical error in recordDelivery:', err.message);
  }
}
// Function to send webhook with the specified group data
async function sendWebhook(grupo, currentUtcTime) {
  // Get id_conta_wiseapp from company table
  const { data: companyData, error: companyError } = await supabase
    .from("company")
    .select("id_conta_wiseapp")
    .eq("company_id", grupo.company_id)
    .single();
  
  if (companyError) {
    console.error("Error fetching company data:", companyError);
  }
  
  const accountId = companyData?.id_conta_wiseapp || null;
  console.log(`Found account_id: ${accountId} for company_id: ${grupo.company_id}`);
  
  // Get an active user API key from wiseapp_acesso table for this account
  let userApiKey = null;
  if (accountId) {
    const { data: accessData, error: accessError } = await supabase
      .from("wiseapp_acesso")
      .select("access_token_wiseapp")
      .eq("id_conta_wiseapp", accountId)
      .not("access_token_wiseapp", "is", null)
      .limit(1)
      .single();
    
    if (accessError) {
      console.warn("Could not fetch user API key:", accessError.message);
    } else {
      userApiKey = accessData?.access_token_wiseapp || null;
      console.log(`Found API key for account ${accountId}: ${userApiKey ? 'Yes' : 'No'}`);
    }
  }
  
  // Prepare the AI summary request with required fields
  const summaryData = {
    "nome_do_grupo": grupo.nome_grupo,
    "company_id": grupo.company_id,
    "group_id": grupo.id,
    "account_id": accountId,
    "api_key": userApiKey,
    "inbox_id": grupo.inbox_id
  };
  console.log('Sending AI summary request:', JSON.stringify({ ...summaryData, api_key: userApiKey ? '[REDACTED]' : null }, null, 2));
  const response = await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(summaryData)
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`AI Summary request failed with status ${response.status}: ${errorBody}`);
  }
  const result = await response.json();
  if (result.status !== '200') {
    // If n8n says it was already sent today, treat as success
    if (result.message && result.message.includes('já foi enviado hoje')) {
      console.log('n8n: Summary already sent today - treating as success');
      return { status: '200', message: 'Already sent today' };
    }
    throw new Error(`n8n webhook failed: ${result.message || 'Unknown error'}`);
  }
  console.log('n8n webhook response:', result.status, '-', result.message);
  return result.summary;
}
