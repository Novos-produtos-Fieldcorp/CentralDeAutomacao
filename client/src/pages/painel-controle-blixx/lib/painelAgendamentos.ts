// Acesso à tabela public.blixx_automacoes (Supabase) para os agendamentos do
// módulo "Painel de Controle Blixx". O horário é digitado e armazenado em
// horário de Brasília (UTC-3), exatamente como escolhido pelo usuário; o cron
// de backend compara contra o horário de Brasília atual.
import { supabase } from '../../../lib/supabase';
import type { Agendamento, AgendamentoContato } from './painelTypes';

interface AgendamentoRow {
  id: number;
  company_id: number | null;
  automacao_name: string | null;
  contatos: AgendamentoContato[] | null;
  data_inicio: string | null;
  horario: string | null;
  is_active: boolean | null;
  created_at: string;
}

function fromRow(row: AgendamentoRow): Agendamento {
  return {
    id: String(row.id),
    automacaoName: row.automacao_name ?? '',
    contatos: Array.isArray(row.contatos) ? row.contatos : [],
    dataInicio: row.data_inicio ?? '',
    horario: row.horario ?? '',
    isActive: row.is_active ?? false,
    criadoEm: row.created_at,
  };
}

export async function buscarAgendamentos(
  companyId: number | null,
): Promise<Agendamento[]> {
  if (!companyId) return [];
  const { data, error } = await supabase
    .from('blixx_automacoes')
    .select(
      'id, company_id, automacao_name, contatos, data_inicio, horario, is_active, created_at',
    )
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as AgendamentoRow[]).map(fromRow);
}

export interface NovoAgendamento {
  companyId: number | null;
  automacaoName: string;
  contatos: AgendamentoContato[];
  dataInicio: string; // YYYY-MM-DD (Brasília)
  horario: string; // HH:mm (Brasília)
}

export async function criarAgendamento(a: NovoAgendamento): Promise<Agendamento> {
  if (!a.companyId) throw new Error('company_id ausente');
  const { data, error } = await supabase
    .from('blixx_automacoes')
    .insert({
      company_id: a.companyId,
      automacao_name: a.automacaoName,
      contatos: a.contatos,
      // chatid recebe o phone_number do contato (1º contato do agendamento).
      chatid: a.contatos[0]?.phone ?? '',
      // Gravados em horário de Brasília, exatamente como escolhido.
      data_inicio: a.dataInicio,
      horario: a.horario,
      is_active: true,
    })
    .select(
      'id, company_id, automacao_name, contatos, data_inicio, horario, is_active, created_at',
    )
    .single();
  if (error) throw error;
  return fromRow(data as AgendamentoRow);
}

export async function cancelarAgendamento(id: string): Promise<void> {
  const { error } = await supabase
    .from('blixx_automacoes')
    .update({ is_active: false, disparado_em: new Date().toISOString() })
    .eq('id', Number(id));
  if (error) throw error;
}

export async function removerAgendamento(id: string): Promise<void> {
  const { error } = await supabase
    .from('blixx_automacoes')
    .delete()
    .eq('id', Number(id));
  if (error) throw error;
}
