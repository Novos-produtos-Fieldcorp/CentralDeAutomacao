import React from 'react';
import { Edit2, Eye, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import type { Checklist } from '../../types/database';
import { formatCPF } from '../../utils/format';

interface ChecklistCardProps {
  checklist: Checklist;
  onEdit: (checklist: Checklist) => void;
  onDelete: (checklist: Checklist) => void;
  onClick: () => void;
  onToggleStatus?: (checklist: Checklist) => void;
  updatingStatus?: number | null;
}

const ChecklistCard = ({ 
  checklist, 
  onEdit, 
  onDelete, 
  onClick,
  onToggleStatus,
  updatingStatus
}: ChecklistCardProps) => {
  const formatDate = (date: string) => {
    // Split the date string (YYYY-MM-DD) and rearrange to DD/MM/YYYY
    const parts = date.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return date; // Return original if format is unexpected
  };

  const handleToggleStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleStatus) {
      onToggleStatus(checklist);
    }
  };

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900 dark:text-white">
          {formatDate(checklist.data)}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {checklist.hora}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900 dark:text-white">
          {checklist.motorista?.nome}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {checklist.motorista?.cpf ? formatCPF(checklist.motorista.cpf) : '-'}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900 dark:text-white">
          <span className="uppercase">{checklist.veiculo?.placa}</span>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {checklist.veiculo?.marca} {checklist.veiculo?.tipo}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900 dark:text-white">
          {checklist.quilometragem?.toLocaleString('pt-BR')} km
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-center">
        {onToggleStatus && (
          <button
            onClick={handleToggleStatus}
            disabled={updatingStatus === checklist.checklist_id}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              checklist.verificacao 
                ? 'bg-green-500 dark:bg-green-600' 
                : 'bg-gray-200 dark:bg-gray-700'
            } ${updatingStatus === checklist.checklist_id ? 'opacity-50 cursor-not-allowed' : ''}`}
            role="switch"
            aria-checked={checklist.verificacao}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                checklist.verificacao ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
            {updatingStatus === checklist.checklist_id && (
              <Loader2 
                className="absolute inset-0 m-auto w-4 h-4 text-white animate-spin" 
              />
            )}
          </button>
        )}
        {!onToggleStatus && (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            checklist.verificacao 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200' 
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
          }`}>
            {checklist.verificacao ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Verificado
              </>
            ) : (
              <>
                <XCircle className="w-3.5 h-3.5 mr-1" />
                Pendente
              </>
            )}
          </span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex items-center justify-end space-x-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 
                     transition-colors"
            title="Visualizar"
          >
            <Eye size={18} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(checklist);
            }}
            className="text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300 
                     transition-colors"
            title="Editar"
          >
            <Edit2 size={18} />
          </button>
        </div>
      </td>
    </tr>
  );
};

export default ChecklistCard;