import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, Loader2, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ComentariosTabProps {
  motorista_id: number;
  onUpdateSuccess?: () => void;
}

interface Comentario {
  id: number;
  created_at: string;
  updated_at: string | null;
  id_motorista: number | null;
  id_atendente: number | null;
  comentario: string | null;
}

const ComentariosTab: React.FC<ComentariosTabProps> = ({
  motorista_id,
  onUpdateSuccess
}) => {
  const [comentario, setComentario] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentComentario, setCurrentComentario] = useState<Comentario | null>(null);
  const { companyId } = useAuth();

  useEffect(() => {
    fetchComentario();
  }, [motorista_id]);

  const fetchComentario = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('comentario')
        .select('id, created_at, updated_at, id_motorista, id_atendente, comentario')
        .eq('id_motorista', motorista_id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (error) throw error;
      
      setCurrentComentario(data);
      
      // If onUpdateSuccess is provided, call it to update the comment count in the parent component
      if (onUpdateSuccess) {
        onUpdateSuccess();
      }
    } catch (error) {
      console.error('Error fetching comment:', error);
      toast.error('Erro ao carregar comentário');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!comentario.trim()) {
      toast.error('O comentário não pode estar vazio');
      return;
    }
    
    try {
      setSubmitting(true);
      
      if (currentComentario) {
        // Update existing comment
        const { error } = await supabase
          .from('comentario')
          .update({
            comentario: comentario.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', currentComentario.id);
          
        if (error) throw error;
      } else {
        // Create new comment
        const { error } = await supabase
          .from('comentario')
          .insert({
            id_motorista: motorista_id,
            comentario: comentario.trim()
          });
          
        if (error) throw error;
      }
      
      toast.success('Comentário salvo com sucesso');
      setComentario('');
      await fetchComentario(); // Refresh the comment
      
      if (onUpdateSuccess) {
        onUpdateSuccess();
      }
    } catch (error) {
      console.error('Error saving comment:', error);
      toast.error('Erro ao salvar comentário');
    } finally {
      setSubmitting(false);
    }
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
            {currentComentario ? 'Atualizar Comentário' : 'Adicionar Comentário'}
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
                placeholder={currentComentario ? "Atualizar comentário existente..." : "Digite seu comentário aqui..."}
              />
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={submitting || !comentario.trim()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
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

      {/* Current Comment */}
      {currentComentario && currentComentario.comentario ? (
        <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white flex items-center">
              <MessageSquare className="w-5 h-5 mr-2 text-blue-500" />
              Comentário Atual
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Última atualização: {formatDate(currentComentario.updated_at || currentComentario.created_at)}
            </p>
          </div>
          
          <div className="px-4 py-5 sm:p-6">
            <div className="flex space-x-3">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {currentComentario.comentario}
                </div>
              </div>
            </div>
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