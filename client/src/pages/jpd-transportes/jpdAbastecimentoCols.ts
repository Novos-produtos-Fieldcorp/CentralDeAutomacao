// Colunas de um lançamento de abastecimento (tabela homedometro_abastecimento_jpd).
// Compartilhado entre a tabela inline (JpdAbastecimentos) e o modal de geração
// automática (JpdGerarLancamento).
export type AbastCol = { key: string; label: string; type: 'text' | 'number' };

export const ABAST_COLS: AbastCol[] = [
  { key: 'hodometro', label: 'Hodômetro', type: 'number' },
  { key: 'placa', label: 'Placa', type: 'text' },
  { key: 'motorista', label: 'Motorista', type: 'text' },
  { key: 'fornecedor', label: 'Fornecedor', type: 'text' },
  { key: 'combustivel', label: 'Combustível', type: 'text' },
  { key: 'litros', label: 'Litros', type: 'number' },
  { key: 'valor_unitario', label: 'Valor Unitário', type: 'number' },
  { key: 'valor_bruto', label: 'Valor Bruto', type: 'number' },
  { key: 'desconto', label: 'Desconto', type: 'number' },
  { key: 'arla', label: 'Arla', type: 'number' },
];
