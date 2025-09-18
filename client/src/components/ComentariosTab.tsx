import React, { useState } from 'react';
import { MessageSquare, Send, Loader2, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useWiseAppAccess } from '../context/WiseAppAccessContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useComentarios, useCreateComentario } from '../hooks/useComentarios';

interface ComentariosTabProps {
  motorista_id: number;
  onUpdateSuccess?: () => void;
}

const ComentariosTab: React.FC<ComentariosTabProps> = ({
  motorista_id,
  onUpdateSuccess
}) => {
  const [comentario, setComentario] = useState('');
  const { accountId } = useAuth();
  const { attendantId } = useWiseAppAccess();
  
  // Use React Query hooks
  const { 
    data: comentarios = [], 
    isLoading: loading, 
    error,
    refetch 
  } = useComentarios(motorista_id);
  
  const createComentarioMutation = useCreateComentario();

  // Handle error states in useEffect to avoid render-time side effects
  React.useEffect(() => {
    if (error) {
      toast.error('Erro ao carregar comentários');
    }
  }, [error]);

  // Call onUpdateSuccess when data changes (for parent component updates)
  React.useEffect(() => {
    if (comentarios && onUpdateSuccess) {
      onUpdateSuccess();
    }
  }, [comentarios, onUpdateSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!comentario.trim()) {
      toast.error('O comentário não pode estar vazio');
      return;
    }
    
    // Get attendantId from localStorage if context value is null
    const currentAttendantId = attendantId || parseInt(localStorage.getItem('attendant_id') || '0');
    
    if (!currentAttendantId) {
      toast.error('Erro: ID do atendente não encontrado. Faça login novamente.');
      return;
    }

    // Use the mutation to create the comment
    createComentarioMutation.mutate(
      {
        id_motorista: motorista_id,
        id_atendente: currentAttendantId,
        comentario: comentario.trim()
      },
      {
        onSuccess: () => {
          setComentario('');
          if (onUpdateSuccess) {
            onUpdateSuccess();
          }
        }
      }
    );
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
    } catch (error) {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Comment Form */}
      <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
            Adicionar Novo Comentário
          </h3>
          <form onSubmit={handleSubmit} className="mt-4">
            <div className="mt-1">
              <textarea
                rows={4}
                name="comment"
                id="comment"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                placeholder="Digite seu comentário aqui..."
              />
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={createComentarioMutation.isPending || !comentario.trim()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="submit-comentario-btn"
              >
                {createComentarioMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Salvar
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Comments List */}
      {comentarios.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white flex items-center">
              <MessageSquare className="w-5 h-5 mr-2 text-blue-500" />
              Comentários ({comentarios.length})
            </h3>
          </div>
          
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {comentarios.map((comentario) => (
              <div key={comentario.id} className="px-4 py-5 sm:p-6">
                <div className="flex space-x-3">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      {formatDate(comentario.updated_at || comentario.created_at)}
                      {comentario.atendente_nome && (
                        <span className="ml-2 text-blue-600 dark:text-blue-400 font-medium">
                          {comentario.atendente_nome}
                        </span>
                      )}
                    </p>
                    <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {comentario.comentario}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg overflow-hidden">
          <div className="px-4 py-8 text-center">
            <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              Nenhum comentário
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Adicione um novo comentário para começar.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComentariosTab;