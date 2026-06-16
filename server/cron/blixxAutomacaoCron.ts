import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const N8N_WEBHOOK_URL = 'https://n8nqp.wiseapp360.com/webhook/recebe-automacao';
const INTERVALO_ENTRE_CONTATOS_MS = 3000;

interface AgendamentoContato {
  id: string;
  name: string;
  phone: string;
}

interface BlixxAutomacao {
  id: number;
  company_id: number | null;
  automacao_name: string | null;
  data_inicio: string | null; // YYYY-MM-DD (UTC)
  horario: string | null; // HH:mm (UTC)
  contatos: AgendamentoContato[] | null;
  is_active: boolean | null;
}

function getCurrentUTCTime(): string {
  const now = new Date();
  const hours = now.getUTCHours().toString().padStart(2, '0');
  const minutes = now.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function getCurrentUTCDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processScheduledAutomacoes() {
  const currentTimeUTC = getCurrentUTCTime();
  const today = getCurrentUTCDate();

  try {
    const { data: agendamentos, error } = await supabase
      .from('blixx_automacoes')
      .select('id, company_id, automacao_name, data_inicio, horario, contatos, is_active')
      .eq('is_active', true)
      .eq('horario', currentTimeUTC)
      .eq('data_inicio', today);

    if (error) {
      console.error('[BLIXX-CRON] Erro ao buscar agendamentos:', error);
      return;
    }

    if (!agendamentos || agendamentos.length === 0) {
      return;
    }

    console.log(`[BLIXX-CRON] ${agendamentos.length} agendamento(s) para disparar às ${currentTimeUTC} UTC`);

    for (const ag of agendamentos as BlixxAutomacao[]) {
      await dispararAgendamento(ag);
    }
  } catch (error) {
    console.error('[BLIXX-CRON] Erro no processamento:', error);
  }
}

async function dispararAgendamento(ag: BlixxAutomacao) {
  const contatos = Array.isArray(ag.contatos) ? ag.contatos : [];
  const typebotName = ag.automacao_name || '';

  console.log(`[BLIXX-CRON] Agendamento ${ag.id}: disparando "${typebotName}" para ${contatos.length} contato(s)`);

  // Marca como inativo antes de disparar para evitar disparo duplicado caso o
  // ciclo do cron se sobreponha (o loop de 3s pode durar mais de 1 minuto).
  await supabase
    .from('blixx_automacoes')
    .update({ is_active: false, disparado_em: new Date().toISOString() })
    .eq('id', ag.id);

  for (let i = 0; i < contatos.length; i++) {
    const c = contatos[i];
    try {
      await axios.post(
        N8N_WEBHOOK_URL,
        {
          name: c.name,
          phone: c.phone,
          id: c.id,
          typebot_name: typebotName,
        },
        { timeout: 120000 },
      );
      console.log(`[BLIXX-CRON] Agendamento ${ag.id}: ${i + 1}/${contatos.length} enviado (${c.name})`);
    } catch (error: any) {
      console.error(`[BLIXX-CRON] Agendamento ${ag.id}: erro ao enviar para ${c.name}:`, error.message);
    }

    if (i < contatos.length - 1) {
      await sleep(INTERVALO_ENTRE_CONTATOS_MS);
    }
  }

  console.log(`[BLIXX-CRON] Agendamento ${ag.id}: concluído`);
}

export function startBlixxAutomacaoCron() {
  console.log('[BLIXX-CRON] Iniciando cron de agendamentos de automação Blixx...');

  cron.schedule('* * * * *', () => {
    processScheduledAutomacoes();
  });

  console.log('[BLIXX-CRON] Cron ativo - verificando a cada minuto');
}

export { processScheduledAutomacoes };
