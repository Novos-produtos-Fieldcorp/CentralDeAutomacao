// Dados de exemplo compartilhados entre as abas enquanto não há API.
// Quando as rotas forem definidas, substituir estes arrays pelas chamadas reais.
import type { Automacao, Contato, Grupo } from './painelTypes';

export const CONTATOS_EXEMPLO: Contato[] = [
  { id: 'c1', nome: 'João Silva', telefone: '+55 11 90000-0001', email: 'joao@exemplo.com', criadoEm: '2026-06-01' },
  { id: 'c2', nome: 'Maria Souza', telefone: '+55 11 90000-0002', email: 'maria@exemplo.com', criadoEm: '2026-06-02' },
  { id: 'c3', nome: 'Carlos Lima', telefone: '+55 11 90000-0003', criadoEm: '2026-06-03' },
];

export const GRUPOS_EXEMPLO: Grupo[] = [
  { id: 'g1', nome: 'Equipe SP', contatoIds: ['c1', 'c2'], criadoEm: '2026-06-05' },
];

export const AUTOMACOES_EXEMPLO: Automacao[] = [
  { id: 'a1', nome: 'Boas-vindas', descricao: 'Mensagem automática de boas-vindas para novos contatos.' },
  { id: 'a2', nome: 'Lembrete de pagamento', descricao: 'Envia lembrete de pagamento em horário definido.' },
  { id: 'a3', nome: 'Pesquisa de satisfação', descricao: 'Dispara pesquisa de satisfação após atendimento.' },
];
