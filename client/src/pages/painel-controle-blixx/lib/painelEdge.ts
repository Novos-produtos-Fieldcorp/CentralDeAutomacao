// Camada de acesso às rotas do n8n para o módulo "Painel de Controle Blixx".
// As rotas são chamadas exatamente como fornecidas (sem company_id — o n8n
// resolve a empresa internamente).
import type { AgendamentoContato, Automacao, Contato } from './painelTypes';
import { supabase } from '../../../lib/supabase';

const BASE = 'https://n8nqp.wiseapp360.com/webhook';

// Normaliza telefone para apenas dígitos (ignora +55, espaços, parênteses etc.).
export const soDigitos = (s: string) => (s || '').replace(/\D/g, '');

const TABELA_CONTATOS = 'blixx_contato_automacoes';

// Carrega de blixx_contato_automacoes um mapa telefone(dígitos) -> contact_id.
// Usado para pré-resolver o contact_id no momento do agendamento (fallback).
export async function carregarMapaContactId(): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const { data, error } = await supabase
    .from(TABELA_CONTATOS)
    .select('contact_id, phone');
  if (error) {
    console.error(`Erro ao carregar ${TABELA_CONTATOS}:`, error);
    return mapa;
  }
  for (const row of data ?? []) {
    const tel = soDigitos((row as { phone?: string }).phone ?? '');
    const cid = (row as { contact_id?: string | null }).contact_id;
    if (tel && cid != null && String(cid).trim() !== '') {
      mapa.set(tel, String(cid));
    }
  }
  return mapa;
}

// Busca o contact_id de um único contato (pelo telefone) em blixx_contato_automacoes.
// Feita no momento do disparo, garantindo o valor mais atual.
export async function buscarContactId(phone: string): Promise<string> {
  const digitos = soDigitos(phone);
  if (!digitos) return '';
  // Usa os últimos dígitos significativos para tolerar variações de formato
  // (+55, DDI, parênteses) entre o telefone do contato e o gravado na tabela.
  const alvo = digitos.slice(-8);
  const { data, error } = await supabase
    .from(TABELA_CONTATOS)
    .select('contact_id, phone')
    .ilike('phone', `%${alvo}%`);
  if (error) {
    console.error(`Erro ao buscar contact_id em ${TABELA_CONTATOS}:`, error);
    return '';
  }
  const rows = (data ?? []) as { contact_id: string | null; phone: string | null }[];
  // Prefere correspondência exata de dígitos; senão, o 1º candidato com contact_id.
  const exato = rows.find((r) => soDigitos(r.phone ?? '') === digitos && r.contact_id);
  const fallback = rows.find((r) => r.contact_id);
  return String((exato ?? fallback)?.contact_id ?? '');
}

const ENDPOINTS = {
  buscaContatos: `${BASE}/busca-contatos`, // GET
  buscarAutomacao: `${BASE}/buscar-automacao`, // GET
  cadastraContatos: `${BASE}/cadastra-contatos`, // POST
  recebeAutomacao: `${BASE}/recebe-automacao`, // POST
};

// Os webhooks podem responder de formas diferentes ({ data: [...] }, [...],
// ou um objeto único). Normaliza tudo para um array.
function toArray(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.payload)) return obj.payload; // formato Chatwoot/WiseApp
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.contatos)) return obj.contatos;
    if (Array.isArray(obj.automacoes)) return obj.automacoes;
    if (Array.isArray(obj.result)) return obj.result;
    return [obj];
  }
  return [];
}

function pick(obj: Record<string, any>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
  }
  return '';
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
  const text = await res.text();
  if (!text) return [];
  try {
    return JSON.parse(text);
  } catch {
    return [];
  }
}

// GET /busca-contatos
// O webhook devolve contatos no formato Chatwoot/WiseApp (chave "payload").
// Itens que são grupos de WhatsApp (additional_attributes.is_group) são descartados.
export async function buscarContatos(): Promise<Contato[]> {
  const data = await getJson(ENDPOINTS.buscaContatos);
  return toArray(data)
    .filter((row) => !row?.additional_attributes?.is_group)
    .map((row, i): Contato => ({
      id: pick(row, 'id', 'Id', 'ID', 'uuid') || `c-${i}`,
      nome: pick(row, 'name', 'Name', 'nome'),
      telefone: pick(row, 'phone_number', 'Phone Number', 'phone', 'telefone'),
      email: pick(row, 'email', 'Email') || undefined,
      criadoEm: pick(row, 'created_at', 'criadoEm', 'createdAt'),
    }));
}

// GET /buscar-automacao
export async function buscarAutomacoes(): Promise<Automacao[]> {
  const data = await getJson(ENDPOINTS.buscarAutomacao);
  return toArray(data).map((row, i): Automacao => ({
    id: pick(row, 'id', 'Id', 'ID', 'uuid') || `a-${i}`,
    nome: pick(row, 'Name', 'name', 'nome', 'automacao', 'titulo'),
    descricao: pick(row, 'description', 'descricao', 'Description') || undefined,
  }));
}

export interface NovoContato {
  nome: string;
  telefone: string;
  email?: string;
}

// POST /cadastra-contatos
export async function cadastrarContato(c: NovoContato): Promise<void> {
  const res = await fetch(ENDPOINTS.cadastraContatos, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Name: c.nome,
      'Phone Number': c.telefone,
      Email: c.email ?? '',
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ao cadastrar contato`);
}

// POST /recebe-automacao
// Dispara a automação para um único contato. Quando há vários contatos, o
// chamador faz um loop com intervalo de 3s entre cada disparo.
// O campo `id` do payload recebe o contact_id: consultado em
// blixx_contato_automacoes pelo telefone no momento do disparo; na falta, usa
// o contactId já gravado no agendamento.
export async function dispararAutomacao(
  c: AgendamentoContato,
  typebotName: string,
): Promise<void> {
  const contactId = (await buscarContactId(c.phone)) || c.contactId || '';
  if (!contactId) {
    console.warn(
      `Sem contact_id em ${TABELA_CONTATOS} para ${c.name} (${c.phone}).`,
    );
  }
  const res = await fetch(ENDPOINTS.recebeAutomacao, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: c.name,
      phone: c.phone,
      id: contactId,
      typebot_name: typebotName,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ao disparar automação`);
}
