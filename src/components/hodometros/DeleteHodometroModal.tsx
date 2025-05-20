import React, { useState } from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';

interface DeleteHodometroModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  hodometroData: {
    data: string;
    hora: string;
    motorista?: { nome: string };
    veiculo?: { placa: string };
  } | null;
}

const DeleteHodometroModal = ({ isOpen, onClose, onConfirm, hodometroData }: DeleteHodometroModalProps) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = () => {
    setIsDeleting(true);
    onConfirm();
  };

  if (!isOpen || !hodometroData) return null;

  const formatDate = (date: string) => {
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full shadow-md border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="text-red-500" size={24} />
            Confirmar Exclusão
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Tem certeza que deseja excluir esta leitura de hodômetro? Esta ação não pode ser desfeita.
          </p>

          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">Data:</span> {formatDate(hodometroData.data)} às {hodometroData.hora}
            </p>
            {hodometroData.motorista && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Motorista:</span> {hodometroData.motorista.nome}
              </p>
            )}
            {hodometroData.veiculo && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Veículo:</span> {hodometroData.veiculo.placa}
              </p>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
            disabled={isDeleting}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Excluindo...
              </>
            ) : (
              'Excluir'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteHodometroModal;