import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Tag as TagIcon } from "lucide-react";
import toast from "react-hot-toast";
import { getWiseAppLabels } from "@/lib/directApiService";
import { useAuth } from "@/context/AuthContext";
import { useWiseAppAccess } from "@/context/WiseAppAccessContext";

interface Tag {
  id: number;
  nome: string;
  cor: string;
  company_id: number;
  created_at: string;
  updated_at: string;
}

interface WiseAppTag {
  id: number;
  name: string;
  color: string;
  description?: string;
}

interface MotoristaTagsManagerProps {
  motoristaId: number;
  companyId: number;
}

export function MotoristaTagsManager({ motoristaId, companyId }: MotoristaTagsManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const { accountId } = useAuth();
  const { token: wiseAppToken } = useWiseAppAccess();

  // Query para buscar tags do motorista  
  const { data: motoristaTagsData = [], isLoading: isLoadingMotorTags } = useQuery<Tag[]>({
    queryKey: ['motorista-tags', motoristaId],
    queryFn: async () => {
      const response = await fetch(`/api/motoristas/${motoristaId}/tags`);
      if (!response.ok) throw new Error('Erro ao buscar tags do motorista');
      return response.json();
    },
    enabled: !!motoristaId,
  });

  // Query para buscar todas as tags da empresa
  const { data: tagsResponse, isLoading: isLoadingAllTags } = useQuery({
    queryKey: ['wiseapp-labels', accountId],
    queryFn: () => getWiseAppLabels(accountId || '', wiseAppToken || ''),
    enabled: !!accountId && !!wiseAppToken,
  });
  
  const allTags: WiseAppTag[] = tagsResponse?.payload || [];

  // Mutation para adicionar tag ao motorista
  const addTagMutation = useMutation({
    mutationFn: async (tagId: number) => {
      const response = await fetch(`/api/motoristas/${motoristaId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_id: tagId }),
      });
      if (!response.ok) throw new Error('Erro ao adicionar tag');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['motorista-tags', motoristaId] });
      toast.success("Tag adicionada com sucesso!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao adicionar tag");
    },
  });

  // Mutation para remover tag do motorista
  const removeTagMutation = useMutation({
    mutationFn: async (tagId: number) => {
      const response = await fetch(`/api/motoristas/${motoristaId}/tags/${tagId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Erro ao remover tag');
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['motorista-tags', motoristaId] });
      toast.success("Tag removida com sucesso!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao remover tag");
    },
  });

  const motoristaTags = motoristaTagsData || [];
  const availableTags = allTags.filter((tag: WiseAppTag) => 
    !motoristaTags.find(motTag => motTag.id === tag.id)
  );

  const handleAddTag = (tagId: number) => {
    addTagMutation.mutate(tagId);
    setIsModalOpen(false);
  };

  const handleRemoveTag = (tagId: number) => {
    if (confirm("Tem certeza que deseja remover esta tag?")) {
      removeTagMutation.mutate(tagId);
    }
  };

  if (isLoadingMotorTags) {
    return <div className="text-center text-gray-600 dark:text-gray-400">Carregando tags...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-md font-medium flex items-center gap-2 text-gray-900 dark:text-gray-100">
          <TagIcon className="w-4 h-4" />
          Tags do Motorista
        </h4>
        <button
          onClick={() => setIsModalOpen(true)}
          disabled={availableTags.length === 0}
          className="bg-blue-600 dark:bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-3 h-3" />
          Adicionar
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {motoristaTags.map((tag) => (
          <div key={tag.id} className="flex items-center gap-1">
            <span
              style={{ backgroundColor: tag.cor }}
              className="text-white px-2 py-1 rounded-md text-sm"
            >
              {tag.nome}
            </span>
            <button
              onClick={() => handleRemoveTag(tag.id)}
              className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {motoristaTags.length === 0 && (
        <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhuma tag atribuída ainda.</p>
      )}

      {availableTags.length === 0 && motoristaTags.length > 0 && (
        <p className="text-gray-500 dark:text-gray-400 text-sm">Todas as tags disponíveis já foram atribuídas.</p>
      )}

      {/* Modal para adicionar tags */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black dark:bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-md mx-4 border dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Adicionar Tag</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {isLoadingAllTags ? (
                <div className="text-center py-4 text-gray-600 dark:text-gray-400">Carregando tags...</div>
              ) : availableTags.length === 0 ? (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                  Nenhuma tag disponível para adicionar.
                </div>
              ) : (
                availableTags.map((tag: WiseAppTag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleAddTag(tag.id)}
                    disabled={addTagMutation.isPending}
                    className="w-full flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >
                    <span
                      style={{ backgroundColor: tag.color }}
                      className="text-white px-2 py-1 rounded-md text-sm"
                    >
                      {tag.name}
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}