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
  tipo?: string;
  conv_id?: number;
  contact_name?: string;
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
    
    // Deduplicate: for groups (tipo=grupo), skip if same (account_id, inbox_id) already processed
    // For conversa/email, deduplicate by conv_id instead
    const processedInboxes = new Set<string>();
    const processedConvIds = new Set<string>();
    for (const grupo of grupos as GrupoResumo[]) {
      const tipo = grupo.tipo || 'grupo';
      if (tipo === 'conversa' || tipo === 'email') {
        const convKey = `${grupo.account_id ?? 'x'}_${grupo.conv_id ?? 'x'}`;
        if (grupo.conv_id && processedConvIds.has(convKey)) {
          console.log(`[CRON] Pulando ${tipo} ${grupo.id} (${grupo.nome_grupo}) - conv_id ${grupo.conv_id} já processado neste ciclo`);
          continue;
        }
        if (grupo.conv_id) processedConvIds.add(convKey);
      } else {
        const inboxKey = `${grupo.account_id ?? 'x'}_${grupo.inbox_id ?? 'x'}`;
        if (grupo.inbox_id && processedInboxes.has(inboxKey)) {
          console.log(`[CRON] Pulando grupo ${grupo.id} (${grupo.nome_grupo}) - inbox ${grupo.inbox_id} já processado neste ciclo`);
          continue;
        }
        if (grupo.inbox_id) processedInboxes.add(inboxKey);
      }
      await processGroup(grupo, currentTimeUTC);
    }
  } catch (error) {
    console.error('[CRON] Erro no processamento:', error);
  }
}

async function processGroup(grupo: GrupoResumo, currentTimeUTC: string) {
  console.log(`[CRON] Processando grupo: ${grupo.nome_grupo} (ID: ${grupo.id})`);
  
  try {
    // Guard: skip if a successful summary was already sent today for this group (by grupo_id)
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

    // Guard: skip if another group record pointing to the same destination already sent today
    const tipo = grupo.tipo || 'grupo';
    if (tipo === 'conversa' || tipo === 'email') {
      if (grupo.conv_id && grupo.account_id) {
        const { data: sameConvGroups } = await supabase
          .from('grupo_resumo')
          .select('id')
          .eq('conv_id', grupo.conv_id)
          .eq('account_id', grupo.account_id)
          .neq('id', grupo.id);
        if (sameConvGroups && sameConvGroups.length > 0) {
          const sameConvIds = sameConvGroups.map((g: any) => g.id);
          const { data: convLog } = await supabase
            .from('envio_resumo')
            .select('id')
            .in('grupo_id', sameConvIds)
            .eq('data_envio', today)
            .eq('status', true)
            .limit(1)
            .single();
          if (convLog) {
            console.log(`[CRON] Conv_id ${grupo.conv_id} já recebeu resumo hoje (outro registro) — pulando grupo ${grupo.id}`);
            return;
          }
        }
      }
    } else {
      if (grupo.inbox_id && grupo.account_id) {
        // Find all group IDs that share the same inbox+account
        const { data: sameInboxGroups } = await supabase
          .from('grupo_resumo')
          .select('id')
          .eq('inbox_id', grupo.inbox_id)
          .eq('account_id', grupo.account_id)
          .neq('id', grupo.id);
        if (sameInboxGroups && sameInboxGroups.length > 0) {
          const sameInboxIds = sameInboxGroups.map((g: any) => g.id);
          const { data: inboxLog } = await supabase
            .from('envio_resumo')
            .select('id')
            .in('grupo_id', sameInboxIds)
            .eq('data_envio', today)
            .eq('status', true)
            .limit(1)
            .single();
          if (inboxLog) {
            console.log(`[CRON] Inbox ${grupo.inbox_id} já recebeu resumo hoje (outro grupo) — pulando grupo ${grupo.id}`);
            return;
          }
        }
      }
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
    
    const tipoLabel = grupo.tipo || 'grupo';
    console.log(`[CRON] ${tipoLabel} ${grupo.id}: Enviando para IA (account_id: ${accountId})`);
    
    let response;
    if (tipoLabel === 'conversa' || tipoLabel === 'email') {
      response = await axios.post('http://localhost:5000/api/ai/conversation-summary', {
        account_id: accountId,
        api_key: apiKey,
        conv_id: grupo.conv_id,
        conv_name: grupo.contact_name || grupo.nome_grupo,
        tipo: tipoLabel,
        group_id: grupo.id,
        company_id: grupo.company_id
      }, {
        timeout: 120000
      });
    } else {
      response = await axios.post('http://localhost:8000/api/group-summary', {
        nome_do_grupo: grupo.nome_grupo,
        company_id: grupo.company_id,
        group_id: grupo.id,
        account_id: accountId,
        api_key: apiKey,
        inbox_id: grupo.inbox_id
      }, {
        timeout: 120000
      });
    }
    
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
      horario_execucao_utc: horarioUTC,
      tipo: grupo.tipo || 'grupo'
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
