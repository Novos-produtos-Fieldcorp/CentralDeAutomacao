import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';

export interface Tag {
  id: number;
  nome: string;
  cor: string;
  company_id: number;
  created_at: string;
  updated_at: string;
}

export const useTags = () => {
  const { accountId } = useAuth();
  
  return useQuery<Tag[]>({
    queryKey: ['/api/tags', accountId],
    queryFn: () => fetch(`/api/tags?company_id=${accountId}`).then(res => res.json()),
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
};

export const useMotoristasTags = (motoristaId: number) => {
  return useQuery<Tag[]>({
    queryKey: ['/api/motoristas', motoristaId, 'tags'],
    queryFn: () => fetch(`/api/motoristas/${motoristaId}/tags`).then(res => res.json()),
    enabled: !!motoristaId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
};