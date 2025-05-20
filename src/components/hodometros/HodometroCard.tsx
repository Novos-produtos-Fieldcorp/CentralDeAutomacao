import React from 'react';
import { Edit2, Trash2, Camera } from 'lucide-react';
import type { Hodometro } from '../../types/database';
import { formatCPF } from '../../utils/format';

interface HodometroCardProps {
  hodometro: Hodometro;
  onEdit: (hodometro: Hodometro) => void;
  onDelete: (hodometro: Hodometro) => void;
  onViewPhoto: (photo: string | null) => void;
}

const HodometroCard: React.FC<HodometroCardProps> = ({ 
  hodometro, 
  onEdit, 
  onDelete,
  onViewPhoto
}) => {
  const formatDate = (date: string) => {
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {formatDate(hodometro.data)} às {hodometro.hora}
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {hodometro.motorista?.nome}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onViewPhoto(hodometro.foto_hodometro)}
              className={`text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 
                       transition-colors ${!hodometro.foto_hodometro && 'opacity-50 cursor-not-allowed'}`}
              title={hodometro.foto_hodometro ? "Ver foto do hodômetro" : "Sem foto disponível"}
            >
              <Camera size={18} />
            </button>
            <button
              onClick={() => onEdit(hodometro)}
              className="text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300 
                       transition-colors"
              title="Editar"
            >
              <Edit2 size={18} />
            </button>
            <button
              onClick={() => onDelete(hodometro)}
              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 
                       transition-colors"
              title="Excluir"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
        
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
            <div className="text-xs text-gray-500 dark:text-gray-400">Veículo</div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {hodometro.veiculo?.placa.toUpperCase()}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {hodometro.bateria !== null && hodometro.bateria !== undefined ? 'Bateria' : 'Hodômetro'}
            </div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {hodometro.bateria !== null && hodometro.bateria !== undefined 
                ? `${hodometro.bateria}` 
                : `${hodometro.hod_lido?.toLocaleString('pt-BR')} km`}
            </div>
          </div>
        </div>
        
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
            <div className="text-xs text-gray-500 dark:text-gray-400">Trip</div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {hodometro.trip_lida?.toLocaleString('pt-BR') || 'N/A'}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {hodometro.bateria !== null && hodometro.bateria !== undefined ? 'Autonomia' : 'KM rodado'}
            </div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {hodometro.km_rodado?.toLocaleString('pt-BR')} km
            </div>
          </div>
        </div>
        
        <div className="mt-2 flex justify-between items-center">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {hodometro.cliente?.nome || 'Sem cliente'}
          </div>
          <div className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            hodometro.comparacao_leitura
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
          }`}>
            {hodometro.comparacao_leitura ? 'Leitura OK' : 'Leitura Divergente'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HodometroCard;