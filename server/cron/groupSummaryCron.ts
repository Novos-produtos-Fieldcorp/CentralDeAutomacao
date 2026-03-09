import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface GrupoResumo {
  id: number;
  nome_grupo: string;
  horario: string;
  ativo: boolean;
  company_id: number;
  inbox_id?: string;
  account_id?: number;
}

function getCurrentUTCTime(): string {
  const now = new Date();
  const hours = now.getUTCHours().toString().padStart(2, '0');
  const minutes = now.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function getCurrentBrasiliaTime(): string {
  const now = new Date();
  const brasiliaOffset = -3 * 60;
  const brasiliaTime = new Date(now.getTime() + (now.getTimezoneOffset() + brasiliaOffset) * 60000);
  const hours = brasiliaTime.getHours().toString().padStart(2, '0');
  const minutes = brasiliaTime.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function getCurrentBrasiliaDate(): string {
  const now = new Date();
  const brasiliaOffset = -3 * 60;
  const brasiliaTime = new Date(now.getTime() + (now.getTimezoneOffset() + brasiliaOffset) * 60000);
  return brasiliaTime.toISOString().split('T')[0];
}

async function processScheduledSummaries() {
  const currentTimeUTC = getCurrentUTCTime();
  const currentTimeBrasilia = getCurrentBrasiliaTime();
  
  console.log(`[CRON] Verificando resumos agendados - UTC: ${currentTimeUTC} | Brasilia: ${currentTimeBrasilia}`);
  
  try {
    const { data: grupos, error } = await supabase
      .from('grupo_resumo')
      .select('*')
      .eq('ativo', true)
      .eq('horario', currentTimeUTC);
    
    if (error) {
      console.error('[CRON] Erro ao buscar grupos:', error);
      return;
    }
    
    if (!grupos || grupos.length === 0) {
      console.log('[CRON] Nenhum grupo agendado para este horario');
      return;
    }
    
    console.log(`[CRON] Encontrados ${grupos.length} grupo(s) para processar`);
    
    // Deduplicate: skip groups that share the same (inbox_id, account_id) already processed this run
    const processedInboxes = new Set<string>();
    for (const grupo of grupos as GrupoResumo[]) {
      const inboxKey = `${grupo.account_id ?? 'x'}_${grupo.inbox_id ?? 'x'}`;
      if (grupo.inbox_id && processedInboxes.has(inboxKey)) {
        console.log(`[CRON] Pulando grupo ${grupo.id} (${grupo.nome_grupo}) - inbox ${grupo.inbox_id} já processado neste ciclo`);
        continue;
      }
      processedInboxes.add(inboxKey);
      await processGroup(grupo, currentTimeUTC);
    }
  } catch (error) {
    console.error('[CRON] Erro no processamento:', error);
  }
}

async function processGroup(grupo: GrupoResumo, currentTimeUTC: string) {
  console.log(`[CRON] Processando grupo: ${grupo.nome_grupo} (ID: ${grupo.id})`);
  
  try {
    // Guard: skip if a successful summary was already sent today for this group
    const today = getCurrentBrasiliaDate();
    const { data: existingLog } = await supabase
      .from('envio_resumo')
      .select('id')
      .eq('grupo_id', grupo.id)
      .eq('data_envio', today)
      .eq('status', true)
      .limit(1)
      .single();
    
    if (existingLog) {
      console.log(`[CRON] Grupo ${grupo.id} já recebeu resumo com sucesso hoje — pulando`);
      return;
    }

    // Use account_id stored directly on the group if available; otherwise fall back to company default
    let accountId: string | null = grupo.account_id ? String(grupo.account_id) : null;
    
    if (!accountId) {
      const { data: companyData } = await supabase
        .from('company')
        .select('id_conta_wiseapp')
        .eq('company_id', grupo.company_id)
        .single();
      accountId = companyData?.id_conta_wiseapp ? String(companyData.id_conta_wiseapp) : null;
    }
    
    let apiKey = null;
    if (accountId) {
      const { data: accessData } = await supabase
        .from('wiseapp_acesso')
        .select('access_token_wiseapp')
        .eq('id_conta_wiseapp', accountId)
        .not('access_token_wiseapp', 'is', null)
        .limit(1)
        .single();
      
      apiKey = accessData?.access_token_wiseapp || null;
    }
    
    if (!accountId || !apiKey) {
      console.error(`[CRON] Grupo ${grupo.id}: account_id ou api_key nao encontrados`);
      await recordLog(grupo, false, 'account_id ou api_key nao encontrados', currentTimeUTC);
      return;
    }
    
    console.log(`[CRON] Grupo ${grupo.id}: Enviando para IA (account_id: ${accountId})`);
    
    const response = await axios.post('http://localhost:8000/api/group-summary', {
      nome_do_grupo: grupo.nome_grupo,
      company_id: grupo.company_id,
      group_id: grupo.id,
      account_id: accountId,
      api_key: apiKey,
      inbox_id: grupo.inbox_id
    }, {
      timeout: 120000
    });
    
    if (response.data.success) {
      console.log(`[CRON] Grupo ${grupo.id}: Resumo gerado com sucesso!`);
      if (response.data.message_sent) {
        console.log(`[CRON] Grupo ${grupo.id}: Mensagem enviada ao grupo!`);
      }
    } else {
      console.error(`[CRON] Grupo ${grupo.id}: Erro ao gerar resumo:`, response.data.error);
      await recordLog(grupo, false, `Erro IA: ${response.data.error}`, currentTimeUTC);
    }
    
  } catch (error: any) {
    console.error(`[CRON] Grupo ${grupo.id}: Erro:`, error.message);
    await recordLog(grupo, false, `Erro: ${error.message}`, currentTimeUTC);
  }
}

async function recordLog(grupo: GrupoResumo, status: boolean, mensagem: string, horarioUTC: string) {
  try {
    const today = getCurrentBrasiliaDate();
    
    await supabase.from('envio_resumo').insert({
      grupo_id: grupo.id,
      company_id: grupo.company_id,
      data_envio: today,
      status,
      mensagem,
      horario_execucao_utc: horarioUTC
    });
  } catch (error) {
    console.error('[CRON] Erro ao registrar log:', error);
  }
}

export function startGroupSummaryCron() {
  console.log('[CRON] Iniciando cron de resumos de grupo...');
  
  cron.schedule('* * * * *', () => {
    processScheduledSummaries();
  });
  
  console.log('[CRON] Cron ativo - verificando a cada minuto');
}

export { processScheduledSummaries };
