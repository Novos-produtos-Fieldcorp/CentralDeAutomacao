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
  contactId: string; // contact_id de blixx_contatos_automacao
  dados?: Record<string, unknown>; // snapshot da linha completa (fallback)
}

interface BlixxAutomacao {
  id: number;
  company_id: number | null;
  automacao_name: string | null;
  data_inicio: string | null; // YYYY-MM-DD (Brasília)
  horario: string | null; // HH:mm (Brasília)
  contatos: AgendamentoContato[] | null;
  is_active: boolean | null;
}

// Retorna { date: 'YYYY-MM-DD', time: 'HH:mm' } no fuso de Brasília (America/Sao_Paulo).
function getBrasiliaNow(): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  // hour pode vir "24" à meia-noite em alguns ambientes; normaliza para "00".
  const hour = get('hour') === '24' ? '00' : get('hour');
  return { date, time: `${hour}:${get('minute')}` };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const TABELA_CONTATOS = 'blixx_contato_automacoes';

// Normaliza telefone para apenas dígitos (ignora +55, espaços, parênteses etc.).
const soDigitos = (s: string) => (s || '').replace(/\D/g, '');

// Busca a linha completa de um contato (pelo telefone) em
// blixx_contato_automacoes, no momento do disparo.
async function buscarContato(phone: string): Promise<Record<string, unknown> | null> {
  const digitos = soDigitos(phone);
  if (!digitos) return null;
  const alvo = digitos.slice(-8);
  const { data, error } = await supabase
    .from(TABELA_CONTATOS)
    .select('*')
    .ilike('phone', `%${alvo}%`);
  if (error) {
    console.error(`[BLIXX-CRON] Erro ao buscar contato em ${TABELA_CONTATOS}:`, error);
    return null;
  }
  const rows = (data ?? []) as Record<string, unknown>[];
  const exato = rows.find(
    (r) => soDigitos(String(r.phone ?? '')) === digitos && r.contact_id,
  );
  const fallback = rows.find((r) => r.contact_id) ?? rows[0];
  return exato ?? fallback ?? null;
}

async function processScheduledAutomacoes() {
  const { date: today, time: currentTime } = getBrasiliaNow();

  try {
    const { data: agendamentos, error } = await supabase
      .from('blixx_automacoes')
      .select('id, company_id, automacao_name, data_inicio, horario, contatos, is_active')
      .eq('is_active', true)
      .eq('horario', currentTime)
      .eq('data_inicio', today);

    if (error) {
      console.error('[BLIXX-CRON] Erro ao buscar agendamentos:', error);
      return;
    }

    if (!agendamentos || agendamentos.length === 0) {
      return;
    }

    console.log(`[BLIXX-CRON] ${agendamentos.length} agendamento(s) para disparar às ${currentTime} (Brasília)`);

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
    // Consulta a linha completa em blixx_contato_automacoes pelo telefone;
    // fallback no snapshot gravado no agendamento.
    const row = (await buscarContato(c.phone)) ?? c.dados ?? {};
    const contactId = String((row as any).contact_id ?? c.contactId ?? '');
    if (!contactId) {
      console.warn(
        `[BLIXX-CRON] Sem contact_id em ${TABELA_CONTATOS} para ${c.name} (${c.phone}).`,
      );
    }
    try {
      await axios.post(
        N8N_WEBHOOK_URL,
        {
          ...row, // todas as colunas de blixx_contato_automacoes (flat)
          id: contactId, // mantém contrato atual (id = contact_id)
          name: c.name,
          phone: c.phone,
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
