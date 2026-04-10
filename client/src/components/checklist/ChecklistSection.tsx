import React from 'react';
import { MinusCircle } from 'lucide-react';
import { STATUS_MAPPING } from '../../utils/checklistStatus';

const FIELD_LABELS: Record<string, string> = {
  agua_parabrisa: 'Água do Para-brisa',
  agua_radiador: 'Água do Radiador',
  ar_condicionado: 'Ar-condicionado',
  cartao_combustivel: 'Cartão de Combustível',
  carrinho_carga: 'Carrinho de Carga',
  chave_roda: 'Chave de Roda',
  cinto_seguranca: 'Cinto de Segurança',
  documento_veicular: 'Documento Veicular',
  FarolAlto: 'Farol Alto',
  fechadura_porta: 'Fechadura da Porta',
  fluido_freio: 'Fluído de Freio',
  forro_interno: 'Forro Interno',
  freio_estacionamento: 'Freio de Estacionamento',
  lanterna_traseira: 'Lanterna Traseira',
  liq_arrefecimento: 'Líquido de Arrefecimento',
  limpador_parabrisa: 'Limpador do Para-brisa',
  luz_indicador_painel: 'Luz Indicadora do Painel',
  luz_placa: 'Luz da Placa',
  LuzFreio: 'Luz de Freio',
  LuzNeblina: 'Luz de Neblina (Farol de Milha)',
  LuzRe: 'Luz de Ré',
  manual_veiculo: 'Manual do Veículo',
  oleo_hidraulico: 'Óleo Hidráulico',
  oleo_motor: 'Óleo do Motor',
  parabrisa_dianteiro: 'Para-brisa Dianteiro',
  pisca_dianteiro: 'Pisca Dianteiro',
  pisca_traseiro: 'Pisca Traseiro',
  pneu_ruim: 'Pneu com Problema',
  sistema_freio: 'Sistema de Freio',
  tampa_tanque: 'Tampa do Tanque',
  vidros_laterais: 'Vidros Laterais'
};

const getFieldLabel = (key: string) => {
  return FIELD_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const getGridClassName = (gridCols: number) => {
  if (gridCols >= 4) return 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4';
  if (gridCols === 3) return 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3';
  if (gridCols === 2) return 'grid grid-cols-1 md:grid-cols-2';
  return 'space-y-3';
};

const getTextSpanClassName = (gridCols: number) => {
  if (gridCols >= 4) return 'md:col-span-2 xl:col-span-4';
  if (gridCols === 3) return 'md:col-span-2 xl:col-span-3';
  if (gridCols === 2) return 'md:col-span-2';
  return '';
};

type StatusKey = keyof typeof STATUS_MAPPING;

interface ChecklistSectionProps {
  title: string;
  items: Record<string, any>;
  excludeKeys: string[];
  statusItems: { status_id: number; status: string }[];
  filterKeys?: string[];
  gridCols?: number;
  specialTextKey?: string;
  specialTextLabel?: string;
  specialTextKeys?: string[];
}

export const ChecklistSection: React.FC<ChecklistSectionProps> = ({
  title,
  items,
  excludeKeys,
  statusItems,
  filterKeys,
  gridCols = 1,
  specialTextKey,
  specialTextLabel,
  specialTextKeys
}) => {
  const resolvedTextKeys = specialTextKeys ?? (specialTextKey ? [specialTextKey] : []);
  const hasTextValue = (value: unknown) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return String(value).trim().length > 0;
  };
  const getStatusInfo = (status_id: number) => {
    const normalizedStatusId = Number(status_id);
    const statusItem = statusItems.find(item => Number(item.status_id) === normalizedStatusId);
    if (!statusItem) return { icon: MinusCircle, colorClass: 'text-gray-400', label: 'N/A' };

    const mappingKey = statusItem.status as StatusKey;
    const mapping = STATUS_MAPPING[mappingKey];

    if (mapping) {
      return {
        icon: mapping.icon,
        colorClass: mapping.color,
        label: statusItem.status
      };
    }

    return {
      icon: MinusCircle,
      colorClass: 'text-gray-400',
      label: statusItem.status
    };
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 p-5 xl:p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md h-full">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {title}
      </h3>
      <div className={`${getGridClassName(gridCols)} gap-3 xl:gap-4`}>
        {Object.entries(items).map(([key, value]) => {
          if (excludeKeys.includes(key)) return null;
          
          // For filtered views, show only specific fields
          if (filterKeys && !filterKeys.includes(key)) {
            return null;
          }
          const label = getFieldLabel(key);
          
          // Handle special text fields
          if (resolvedTextKeys.includes(key)) {
            if (!hasTextValue(value)) return null;

            return (
              <div key={key} className={getTextSpanClassName(gridCols)}>
                <div className="p-3 bg-white dark:bg-gray-700/50 rounded-xl shadow-sm min-h-[72px]">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {key === specialTextKey ? (specialTextLabel || label) : getFieldLabel(key)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {String(value)}
                  </div>
                </div>
              </div>
            );
          }

          // Handle status fields
          const status = getStatusInfo(Number(value));
          const StatusIcon = status.icon;

          return (
            <div key={key} className="flex items-start gap-3 p-3 bg-white dark:bg-gray-700/50 rounded-xl shadow-sm min-h-[72px]">
              <div className={`p-1 rounded-full mt-0.5 ${status.colorClass}`}>
                <StatusIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white leading-5">
                  {label}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 leading-5">
                  {status.label}
                </div>
              </div>
            </div>
          );
        })}
        

      </div>
    </div>
  );
};