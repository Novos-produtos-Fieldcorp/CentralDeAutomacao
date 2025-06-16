import React from 'react';
import { Edit2, Trash2, FileText, User, CreditCard, Home } from 'lucide-react';
import { formatCPF, formatPhone } from '../../utils/format';
import type { DocumentoAjudante } from '../../types/database';

interface HelperListItemProps {
  helper: DocumentoAjudante;
  onEdit: (helper: DocumentoAjudante) => void;
  onDelete: (helper: DocumentoAjudante) => void;
}

const HelperListItem: React.FC<HelperListItemProps> = ({ helper, onEdit, onDelete }) => {
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-base font-medium text-gray-900 dark:text-white">
              {helper.nome || 'Sem nome'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {helper.cpf ? formatCPF(helper.cpf.toString()) : 'CPF não informado'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(helper)}
            className="p-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            title="Editar ajudante"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => onDelete(helper)}
            className="p-1.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Excluir ajudante"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {helper.genero || 'Gênero não informado'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {helper.telefone ? formatPhone(helper.telefone) : 'Telefone não informado'}
          </span>
        </div>
      </div>

      {/* Document thumbnails with tooltips */}
      <div className="flex items-center gap-3 mt-3">
        {/* CNH Document */}
        {helper.cnh_ajudante && helper.cnh_ajudante[0]?.foto_cnh ? (
          <div className="relative group">
            <div 
              className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center overflow-hidden border border-blue-200 dark:border-blue-800"
              title="CNH"
            >
              <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
              CNH
            </div>
          </div>
        ) : null}

        {/* RG Document */}
        {helper.rg_ajudante && helper.rg_ajudante[0]?.foto_rg ? (
          <div className="relative group">
            <div 
              className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center overflow-hidden border border-purple-200 dark:border-purple-800"
              title="RG"
            >
              <User className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
              RG
            </div>
          </div>
        ) : null}

        {/* Comprovante de Residência */}
        {helper.comprovante_residencia ? (
          <div className="relative group">
            <div 
              className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center overflow-hidden border border-green-200 dark:border-green-800"
              title="Comprovante de Residência"
            >
              <Home className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
              Comprovante de Residência
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default HelperListItem;