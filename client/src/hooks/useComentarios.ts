import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import toast from 'react-hot-toast';

interface ComentarioData {
  id: number;
  id_motorista: number;
  id_atendente: number | null;
  comentario: string;
  created_at: string;
  updated_at: string;
  atendente_nome?: string | null;
}

interface CreateComentarioData {
  id_motorista: number;
  id_atendente: number;
  comentario: string;
}

interface MutationContext {
  previousComments: ComentarioData[] | undefined;
  motoristaId: number;
}

export function useComentarios(motoristaId?: number) {
  return useQuery<ComentarioData[]>({
    queryKey: ['comentarios', motoristaId],
    queryFn: async () => {
      if (!motoristaId) return [];

      console.log('Fetching comments for motorista:', motoristaId);

      const response = await apiRequest(`comentarios/${motoristaId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ao buscar comentários: ${response.status}`);
      }

      const data = await response.json();
      return data;
    },
    enabled: !!motoristaId,
    staleTime: 1000 * 30,
  });
}

export function useCreateComentario() {
  const qc = useQueryClient();

  return useMutation<ComentarioData, Error, CreateComentarioData, MutationContext>({
    mutationFn: async (commentData: CreateComentarioData) => {
      console.log('Creating comment:', commentData);

      const response = await apiRequest('comentarios', {
        method: 'POST',
        body: JSON.stringify(commentData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ao criar comentário: ${response.status}`);
      }

      const data = await response.json();
      console.log('Comment created successfully:', data);
      return data;
    },

    onMutate: async (newComment: CreateComentarioData) => {
      await qc.cancelQueries({
        queryKey: ['comentarios', newComment.id_motorista]
      });

      const previousComments = qc.getQueryData<ComentarioData[]>(
        ['comentarios', newComment.id_motorista]
      );

      const optimisticComment: ComentarioData = {
        id: -Date.now(),
        id_motorista: newComment.id_motorista,
        id_atendente: newComment.id_atendente,
        comentario: newComment.comentario.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        atendente_nome: null
      };

      qc.setQueryData<ComentarioData[]>(
        ['comentarios', newComment.id_motorista],
        (old = []) => [optimisticComment, ...old]
      );

      return {
        previousComments,
        motoristaId: newComment.id_motorista
      };
    },

    onError: (error, _newComment, context) => {
      console.error('Error creating comment:', error);
      if (context?.previousComments !== undefined) {
        qc.setQueryData(
          ['comentarios', context.motoristaId],
          context.previousComments
        );
      }
      toast.error(error.message || 'Erro ao criar comentário');
    },

    onSuccess: () => {
      toast.success('Comentário adicionado com sucesso!');
    },

    onSettled: (_data, _error, variables) => {
      qc.invalidateQueries({
        queryKey: ['comentarios', variables.id_motorista]
      });
    },
  });
}

export function useComentariosCount(motoristaId?: number) {
  const { data: comentarios = [] } = useComentarios(motoristaId);
  return comentarios.length;
}
