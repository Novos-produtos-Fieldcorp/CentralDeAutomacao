// Enums compartilhados do módulo JPD Transportes (evita duplicar as mesmas
// strings em múltiplos componentes de frontend).

// Valores possíveis do campo `situacao_do_bv` (jpd_fretes.situacao_do_bv, coluna text).
export const SITUACAO_BV_OPTIONS = [
  'A Carregar',
  'Em viagem',
  'Descarregado/Pendente faturamento',
  'Faturado',
] as const;

export type SituacaoBv = (typeof SITUACAO_BV_OPTIONS)[number];

// Operações disponíveis para lançamentos de abastecimento (homedometro_abastecimento_jpd.operacao).
export const OPERACOES = [
  'CIF/FOB',
  'GRÃOS',
  'RODO DECIO',
  'INPASA',
  'TRANSPREX',
] as const;

export type Operacao = (typeof OPERACOES)[number];
