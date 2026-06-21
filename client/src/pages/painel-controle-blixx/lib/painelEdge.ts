// Camada de acesso às rotas do n8n para o módulo "Painel de Controle Blixx".
// As rotas são chamadas exatamente como fornecidas (sem company_id — o n8n
// resolve a empresa internamente).
import type { AgendamentoContato, Automacao, Contato } from './painelTypes';
import { supabase } from '../../../lib/supabase';

const BASE = 'https://n8nqp.wiseapp360.com/webhook';

// Normaliza telefone para apenas dígitos (ignora +55, espaços, parênteses etc.).
export const soDigitos = (s: string) => (s || '').replace(/\D/g, '');

const TABELA_CONTATOS = 'blixx_contato_automacoes';

// Carrega de blixx_contato_automacoes um mapa telefone(dígitos) -> linha completa.
// Usado para snapshotar todos os dados do contato no momento do agendamento.
export async function carregarMapaContatoAutomacao(): Promise<
  Map<string, Record<string, unknown>>
> {
  const mapa = new Map<string, Record<string, unknown>>();
  const { data, error } = await supabase.from(TABELA_CONTATOS).select('*');
  if (error) {
    console.error(`Erro ao carregar ${TABELA_CONTATOS}:`, error);
    return mapa;
  }
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const tel = soDigitos(String(row.phone ?? ''));
    if (tel) mapa.set(tel, row);
  }
  return mapa;
}

// Busca a linha completa de um único contato (pelo telefone) em
// blixx_contato_automacoes. Feita no momento do disparo, garantindo dados atuais.
export async function buscarContatoAutomacao(
  phone: string,
): Promise<Record<string, unknown> | null> {
  const digitos = soDigitos(phone);
  if (!digitos) return null;
  const alvo = digitos.slice(-8);
  const { data, error } = await supabase
    .from(TABELA_CONTATOS)
    .select('*')
    .ilike('phone', `%${alvo}%`);
  if (error) {
    console.error(`Erro ao buscar contato em ${TABELA_CONTATOS}:`, error);
    return null;
  }
  const rows = (data ?? []) as Record<string, unknown>[];
  // Prefere correspondência exata de dígitos; senão, o 1º com contact_id.
  const exato = rows.find(
    (r) => soDigitos(String(r.phone ?? '')) === digitos && r.contact_id,
  );
  const fallback = rows.find((r) => r.contact_id) ?? rows[0];
  return exato ?? fallback ?? null;
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
  // Busca a linha completa fresca; fallback no snapshot gravado no agendamento.
  const row = (await buscarContatoAutomacao(c.phone)) ?? c.dados ?? {};
  const contactId = String((row as any).contact_id ?? c.contactId ?? '');
  if (!contactId) {
    console.warn(
      `Sem contact_id em ${TABELA_CONTATOS} para ${c.name} (${c.phone}).`,
    );
  }
  const res = await fetch(ENDPOINTS.recebeAutomacao, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...row, // todas as colunas de blixx_contato_automacoes (flat)
      id: contactId, // mantém contrato atual (id = contact_id)
      name: c.name,
      phone: c.phone,
      typebot_name: typebotName,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ao disparar automação`);
}
