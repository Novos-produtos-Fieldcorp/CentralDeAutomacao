import React, { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { RefreshCw, Plus, Edit2, Trash2, Save, X, Palette } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { useWiseAppAccess } from "@/context/WiseAppAccessContext";
import { getWiseAppLabels } from "@/lib/directApiService";

interface TagManagerProps {
  companyId: number;
}

interface Tag {
  id: number;
  nome: string;
  cor: string;
  company_id: number;
  limite_max?: number;
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1"
];

export function TagManager({ companyId }: TagManagerProps) {
  const [isSyncingWiseApp, setIsSyncingWiseApp] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [newTagData, setNewTagData] = useState({ nome: "", cor: DEFAULT_COLORS[0] });
  
  const queryClient = useQueryClient();
  const { accountId } = useAuth();
  const { token: wiseAppToken } = useWiseAppAccess();

  // Query para buscar tags locais
  const { data: localTags = [], isLoading: isLoadingLocal } = useQuery({
    queryKey: ['local-tags', companyId],
    queryFn: async () => {
      const response = await fetch(`/api/tags?company_id=${companyId}`);
      if (!response.ok) {
        throw new Error('Erro ao buscar tags locais');
      }
      return response.json();
    },
    enabled: !!companyId,
  });

  // Query para buscar labels do WiseApp
  const { data: tagsResponse, isLoading: isLoadingWise, error } = useQuery({
    queryKey: ['wiseapp-labels', accountId],
    queryFn: async () => {
      if (!accountId || !wiseAppToken) {
        throw new Error('AccountId ou token não disponível');
      }
      console.log('Buscando labels do WiseApp para account:', accountId);
      return getWiseAppLabels(accountId, wiseAppToken);
    },
    enabled: !!accountId && !!wiseAppToken,
    retry: 3,
    retryDelay: 1000,
  });

  const wiseTags = tagsResponse?.payload || tagsResponse || [];

  // Mutations para CRUD de tags locais
  const createTagMutation = useMutation({
    mutationFn: async (tagData: { nome: string; cor: string }) => {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...tagData, company_id: companyId }),
      });
      if (!response.ok) throw new Error('Erro ao criar tag');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local-tags'] });
      toast.success('Tag criada com sucesso!');
      setIsCreating(false);
      setNewTagData({ nome: "", cor: DEFAULT_COLORS[0] });
    },
    onError: () => toast.error('Erro ao criar tag'),
  });

  const updateTagMutation = useMutation({
    mutationFn: async ({ id, ...tagData }: { id: number; nome: string; cor: string }) => {
      const response = await fetch(`/api/tags/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tagData),
      });
      if (!response.ok) throw new Error('Erro ao atualizar tag');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local-tags'] });
      toast.success('Tag atualizada com sucesso!');
      setEditingTag(null);
    },
    onError: () => toast.error('Erro ao atualizar tag'),
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/tags/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Erro ao deletar tag');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local-tags'] });
      toast.success('Tag deletada com sucesso!');
    },
    onError: () => toast.error('Erro ao deletar tag'),
  });

  const syncWiseAppTags = async () => {
    if (isSyncingWiseApp) return;
    
    setIsSyncingWiseApp(true);
    try {
      if (!accountId) {
        toast.error('ID da conta não encontrado');
        return;
      }

      if (!wiseAppToken) {
        toast.error('Token WiseApp não encontrado. Configure o token primeiro.');
        return;
      }

      console.log('Sincronizando labels - Account ID:', accountId, 'Token disponível:', !!wiseAppToken);
      const wiseAppLabelsResponse = await getWiseAppLabels(accountId || '', wiseAppToken || '');
      const wiseAppTags = wiseAppLabelsResponse.payload || wiseAppLabelsResponse || [];
      
      if (!wiseAppTags || wiseAppTags.length === 0) {
        toast('Nenhuma label encontrada no WiseApp.', {
          icon: 'ℹ️'
        });
        return;
      }
      
      await queryClient.invalidateQueries({ queryKey: ['wiseapp-labels'] });
      toast.success('Labels sincronizadas com sucesso!');
      
    } catch (error) {
      console.error('Erro ao sincronizar labels do WiseApp:', error);
      toast.error('Erro ao sincronizar labels do WiseApp');
    } finally {
      setIsSyncingWiseApp(false);
    }
  };

  const handleCreateTag = () => {
    if (!newTagData.nome.trim()) {
      toast.error('Nome da tag é obrigatório');
      return;
    }
    createTagMutation.mutate(newTagData);
  };

  const handleUpdateTag = () => {
    if (!editingTag || !editingTag.nome.trim()) {
      toast.error('Nome da tag é obrigatório');
      return;
    }
    updateTagMutation.mutate(editingTag);
  };

  if (isLoadingLocal) {
    return <div className="text-center">Carregando tags...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Tags Locais */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Tags Locais</h3>
          <button
            onClick={() => setIsCreating(true)}
            className="bg-blue-600 dark:bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Tag
          </button>
        </div>

        {/* Formulário de criação */}
        {isCreating && (
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-4 mb-3">
              <input
                type="text"
                placeholder="Nome da tag"
                value={newTagData.nome}
                onChange={(e) => setNewTagData(prev => ({ ...prev, nome: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-gray-500" />
                <input
                  type="color"
                  value={newTagData.cor}
                  onChange={(e) => setNewTagData(prev => ({ ...prev, cor: e.target.value }))}
                  className="w-8 h-8 border border-gray-300 dark:border-gray-600 rounded"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCreateTag}
                disabled={createTagMutation.isPending}
                className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Salvar
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewTagData({ nome: "", cor: DEFAULT_COLORS[0] });
                }}
                className="bg-gray-600 text-white px-3 py-1 rounded-md hover:bg-gray-700 flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Lista de tags locais */}
        {localTags && localTags.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {localTags.map((tag: Tag) => (
              <div
                key={tag.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                {editingTag?.id === tag.id ? (
                  // Modo de edição
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingTag.nome}
                        onChange={(e) => setEditingTag(prev => prev ? { ...prev, nome: e.target.value } : null)}
                        className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                      <input
                        type="color"
                        value={editingTag.cor}
                        onChange={(e) => setEditingTag(prev => prev ? { ...prev, cor: e.target.value } : null)}
                        className="w-6 h-6 border border-gray-300 dark:border-gray-600 rounded"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleUpdateTag}
                        disabled={updateTagMutation.isPending}
                        className="bg-green-600 text-white px-2 py-1 rounded text-sm hover:bg-green-700 flex items-center gap-1 disabled:opacity-50"
                      >
                        <Save className="w-3 h-3" />
                        Salvar
                      </button>
                      <button
                        onClick={() => setEditingTag(null)}
                        className="bg-gray-600 text-white px-2 py-1 rounded text-sm hover:bg-gray-700 flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  // Modo de visualização
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600"
                          style={{ backgroundColor: tag.cor }}
                          title={`Cor: ${tag.cor}`}
                        />
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {tag.nome}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingTag(tag)}
                          className="text-blue-600 hover:text-blue-700 p-1"
                          title="Editar tag"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Tem certeza que deseja deletar esta tag?')) {
                              deleteTagMutation.mutate(tag.id);
                            }
                          }}
                          disabled={deleteTagMutation.isPending}
                          className="text-red-600 hover:text-red-700 p-1 disabled:opacity-50"
                          title="Deletar tag"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Local</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              Nenhuma tag local encontrada. Clique em "Nova Tag" para criar.
            </p>
          </div>
        )}
      </div>

      {/* Separador */}
      <hr className="border-gray-200 dark:border-gray-700" />

      {/* Labels WiseApp */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Labels WiseApp</h3>
          <button
            onClick={syncWiseAppTags}
            disabled={isSyncingWiseApp}
            className="bg-green-600 dark:bg-green-500 text-white px-3 py-1 rounded-md hover:bg-green-700 dark:hover:bg-green-600 flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncingWiseApp ? 'animate-spin' : ''}`} />
            {isSyncingWiseApp ? 'Sincronizando...' : 'Sincronizar com o Wiseapp'}
          </button>
        </div>

        {wiseTags && wiseTags.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {wiseTags.map((tag: any) => (
              <div
                key={tag.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600"
                      style={{ backgroundColor: tag.color || '#3B82F6' }}
                      title={`Cor: ${tag.color || '#3B82F6'}`}
                    />
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {tag.title || tag.name || 'Label'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">WiseApp</span>
                </div>
                {tag.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {tag.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              Nenhuma label encontrada. Clique em "Sincronizar com o Wiseapp" para buscar labels.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}