// Colunas de um lançamento de abastecimento (tabela homedometro_abastecimento_jpd).
// Compartilhado entre a tabela inline (JpdAbastecimentos) e o modal de geração
// automática (JpdGerarLancamento).
import { OPERACOES } from './jpdEnums';

export type AbastCol = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date';
  options?: readonly string[];
};

export const ABAST_COLS: AbastCol[] = [
  { key: 'data_lancamento', label: 'Data do lançamento', type: 'date' },
  { key: 'hodometro', label: 'Hodômetro', type: 'number' },
  { key: 'placa', label: 'Placa', type: 'text' },
  { key: 'motorista_id', label: 'Motorista', type: 'text' },
  { key: 'fornecedor', label: 'Fornecedor', type: 'text' },
  { key: 'cnpj', label: 'CNPJ', type: 'text' },
  { key: 'combustivel', label: 'Combustível', type: 'text' },
  { key: 'litros', label: 'Litros', type: 'number' },
  { key: 'valor_unitario', label: 'Valor Unitário', type: 'number' },
  { key: 'valor_bruto', label: 'Valor Bruto', type: 'number' },
  { key: 'desconto', label: 'Desconto', type: 'number' },
  { key: 'arla', label: 'Arla', type: 'number' },
  { key: 'operacao', label: 'Operação', type: 'select', options: OPERACOES },
];
