import React, { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface IntegracaoTreinamentoProps {
  motorista_id: number;
  integracao: boolean | null;
  integracao_data: string | null;
  treinamento: boolean | null;
  treinamento_data: string | null;
  onUpdate: () => void;
}

const IntegracaoTreinamento: React.FC<IntegracaoTreinamentoProps> = ({
  motorista_id,
  integracao,
  integracao_data,
  treinamento,
  treinamento_data,
  onUpdate
}) => {
  const [updatingIntegracao, setUpdatingIntegracao] = useState(false);
  const [updatingTreinamento, setUpdatingTreinamento] = useState(false);

  const handleToggleIntegracao = async () => {
    try {
      setUpdatingIntegracao(true);
      
      // Get current date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase
        .from('motorista')
        .update({
          integracao: !integracao,
          integracao_data: !integracao ? today : null
        })
        .eq('motorista_id', motorista_id);
        
      if (error) throw error;
      
      toast.success(`Integração ${!integracao ? 'realizada' : 'removida'} com sucesso`);
      onUpdate();
    } catch (error) {
      console.error('Error updating integracao:', error);
      toast.error('Erro ao atualizar integração');
    } finally {
      setUpdatingIntegracao(false);
    }
  };

  const handleToggleTreinamento = async () => {
    try {
      setUpdatingTreinamento(true);
      
      // Get current date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase
        .from('motorista')
        .update({
          treinamento: !treinamento,
          treinamento_data: !treinamento ? today : null
        })
        .eq('motorista_id', motorista_id);
        
      if (error) throw error;
      
      toast.success(`Treinamento ${!treinamento ? 'realizado' : 'removido'} com sucesso`);
      onUpdate();
    } catch (error) {
      console.error('Error updating treinamento:', error);
      toast.error('Erro ao atualizar treinamento');
    } finally {
      setUpdatingTreinamento(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="flex justify-between">
      <div className="flex flex-col items-center">
        <button
          onClick={handleToggleIntegracao}
          disabled={updatingIntegracao}
          className={`relative w-6 h-6 flex items-center justify-center rounded border ${
            integracao 
              ? 'bg-green-500 border-green-600 text-white' 
              : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'
          } ${updatingIntegracao ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          title={integracao ? 'Remover integração' : 'Marcar como integrado'}
        >
          {updatingIntegracao ? (
            <Loader2 className="w-4 h-4 animate-spin text-gray-500 dark:text-gray-400" />
          ) : integracao ? (
            <Check className="w-4 h-4" />
          ) : null}
        </button>
        {integracao_data && (
          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {formatDate(integracao_data)}
          </span>
        )}
      </div>
      
      <div className="flex flex-col items-center">
        <button
          onClick={handleToggleTreinamento}
          disabled={updatingTreinamento}
          className={`relative w-6 h-6 flex items-center justify-center rounded border ${
            treinamento 
              ? 'bg-green-500 border-green-600 text-white' 
              : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'
          } ${updatingTreinamento ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          title={treinamento ? 'Remover treinamento' : 'Marcar como treinado'}
        >
          {updatingTreinamento ? (
            <Loader2 className="w-4 h-4 animate-spin text-gray-500 dark:text-gray-400" />
          ) : treinamento ? (
            <Check className="w-4 h-4" />
          ) : null}
        </button>
        {treinamento_data && (
          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {formatDate(treinamento_data)}
          </span>
        )}
      </div>
    </div>
  );
};

export default IntegracaoTreinamento;