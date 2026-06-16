// Camada de acesso às rotas do n8n para o módulo "Painel de Controle Blixx".
// As rotas são chamadas exatamente como fornecidas (sem company_id — o n8n
// resolve a empresa internamente).
import type { Automacao, Contato } from './painelTypes';

const BASE = 'https://n8nqp.wiseapp360.com/webhook';

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
export async function dispararAutomacao(
  c: { id: string; name: string; phone: string },
  typebotName: string,
): Promise<void> {
  const res = await fetch(ENDPOINTS.recebeAutomacao, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: c.name,
      phone: c.phone,
      id: c.id,
      typebot_name: typebotName,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ao disparar automação`);
}
