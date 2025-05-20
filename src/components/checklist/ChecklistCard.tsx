import React from 'react';
import { Edit2, Trash2, Eye } from 'lucide-react';
import type { Checklist } from '../../types/database';
import { formatCPF } from '../../utils/format';

interface ChecklistCardProps {
  checklist: Checklist;
  onEdit: (checklist: Checklist) => void;
  onDelete: (checklist: Checklist) => void;
  onClick: () => void;
}

const ChecklistCard = ({ checklist, onEdit, onDelete, onClick }: ChecklistCardProps) => {
  const formatDate = (date: string) => {
    // Split the date string (YYYY-MM-DD) and rearrange to DD/MM/YYYY
    const parts = date.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return date; // Return original if format is unexpected
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
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(checklist);
            }}
            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 
                     transition-colors"
            title="Excluir"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </td>
    </tr>
  );
};

export default ChecklistCard;