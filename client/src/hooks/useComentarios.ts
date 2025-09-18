import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';
import toast from 'react-hot-toast';
import type { Comentario } from '@shared/schema';

// Interface for creating a new comment
interface CreateComentarioData {
  id_motorista: number;
  id_atendente: number;
  comentario: string;
}

// Interface for comment with attendant name
interface ComentarioWithAttendant extends Comentario {
  atendente_nome?: string | null;
}

// Hook para buscar comentários de um motorista
export function useComentarios(motoristaId?: number) {
  return useQuery<ComentarioWithAttendant[]>({
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
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Hook para criar um novo comentário com updates otimistas
export function useCreateComentario() {
  return useMutation<ComentarioWithAttendant, Error, CreateComentarioData>({
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
      return data;
    },
    
    // Optimistic updates implementation
    onMutate: async (newComment: CreateComentarioData) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ 
        queryKey: ['comentarios', newComment.id_motorista] 
      });

      // Snapshot the previous value
      const previousComments = queryClient.getQueryData<ComentarioWithAttendant[]>(
        ['comentarios', newComment.id_motorista]
      );

      // Create optimistic comment with temporary ID and current timestamp
      const optimisticComment: ComentarioWithAttendant = {
        id: -Date.now(), // Temporary negative ID
        id_motorista: newComment.id_motorista,
        id_atendente: newComment.id_atendente,
        comentario: newComment.comentario.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        atendente_nome: null // Will be filled by backend response
      };

      // Optimistically update the cache
      queryClient.setQueryData<ComentarioWithAttendant[]>(
        ['comentarios', newComment.id_motorista],
        (old = []) => [optimisticComment, ...old]
      );

      // Return a context with the previous and new comment
      return { 
        previousComments, 
        optimisticComment, 
        motoristaId: newComment.id_motorista 
      };
    },
    
    onError: (error, newComment, context) => {
      console.error('Error creating comment:', error);
      
      // Rollback to the previous state
      if (context?.previousComments) {
        queryClient.setQueryData(
          ['comentarios', context.motoristaId],
          context.previousComments
        );
      }
      
      // Show error message
      toast.error(error.message || 'Erro ao criar comentário');
    },
    
    onSuccess: (data, variables, context) => {
      // Show success message
      toast.success('Comentário adicionado com sucesso!');
      console.log('Comment created successfully:', data);
    },
    
    onSettled: (data, error, variables) => {
      // Always invalidate to ensure we have the latest data from server
      queryClient.invalidateQueries({ 
        queryKey: ['comentarios', variables.id_motorista] 
      });
    },
  });
}

// Hook para contar comentários de um motorista (útil para badges/indicadores)
export function useComentariosCount(motoristaId?: number) {
  const { data: comentarios = [] } = useComentarios(motoristaId);
  return comentarios.length;
}