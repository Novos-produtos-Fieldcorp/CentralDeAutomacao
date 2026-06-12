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

// Item resultante de atrelar contatos/grupos a uma automação + horário de início.
export interface Agendamento {
  id: string;
  automacaoId: string;
  contatoIds: string[];
  grupoIds: string[];
  dataInicio: string; // formato YYYY-MM-DD
  horarioInicio: string; // formato HH:mm
  criadoEm: string; // ISO date
}
