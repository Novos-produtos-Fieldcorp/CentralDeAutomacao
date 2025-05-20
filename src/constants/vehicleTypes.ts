export const VEHICLE_TYPES = [
  { value: 'UTILITÁRIO', label: 'UTILITÁRIO' },
  { value: 'CAMINHÃO LEVE', label: 'CAMINHÃO LEVE' },
  { value: 'CAMINHÃO MÉDIO', label: 'CAMINHÃO MÉDIO' },
  { value: 'CAMINHÃO PESADO', label: 'CAMINHÃO PESADO' },
  { value: 'VAN', label: 'VAN' },
  { value: 'FURGÃO', label: 'FURGÃO' },
  { value: 'PICK-UP', label: 'PICK-UP' },
  { value: 'SUV', label: 'SUV' },
  { value: 'OUTRO', label: 'OUTRO' }
] as const;

export const ALL_VEHICLE_TYPES = [
  { value: '', label: 'Todos os tipos' },
  ...VEHICLE_TYPES
];