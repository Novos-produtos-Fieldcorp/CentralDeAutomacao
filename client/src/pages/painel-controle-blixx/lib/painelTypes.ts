// Tipos locais do módulo "Painel de Controle Blixx".
// Por enquanto sem camada de dados/API — estes tipos descrevem o formato
// que os componentes usam em estado local. Quando as rotas forem definidas,
// basta alinhar estes tipos com o retorno real da API.

export interface Contato {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  criadoEm: string; // ISO date
}

// Snapshot de um contato dentro de um grupo (os contatos vêm do WiseApp/Chatwoot,
// sistema externo, então guardamos nome/telefone junto do id).
export interface MembroGrupo {
  id: string;
  nome: string;
  telefone?: string;
}

export interface Grupo {
  id: string;
  nome: string;
  membros: MembroGrupo[];
  criadoEm: string; // ISO date
}

export interface Automacao {
  id: string;
  nome: string;
  descricao?: string;
}

// Snapshot de um contato dentro de um agendamento (nome/telefone guardados
// junto do id para o disparo do webhook não depender de relookup).
export interface AgendamentoContato {
  id: string;
  name: string;
  phone: string;
  // contact_id de blixx_contato_automacoes, resolvido no momento do agendamento.
  // É o valor enviado no campo `id` do payload do webhook recebe-automacao.
  contactId: string;
  // Snapshot da linha completa de blixx_contato_automacoes, capturado no
  // agendamento. Usado como fallback se o lookup fresco falhar no disparo.
  dados?: Record<string, unknown>;
}

// Item resultante de atrelar contatos/grupos a uma automação + horário de início.
// Persistido na tabela public.blixx_automacoes.
export interface Agendamento {
  id: string; // id da linha (serial -> string)
  automacaoName: string; // typebot_name enviado no payload
  contatos: AgendamentoContato[];
  dataInicio: string; // formato YYYY-MM-DD
  horario: string; // formato HH:mm (armazenado em UTC)
  isActive: boolean;
  criadoEm: string; // ISO date
}
