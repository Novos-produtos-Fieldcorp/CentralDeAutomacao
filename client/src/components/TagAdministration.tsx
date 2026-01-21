import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Tag as TagIcon, Save, X, AlertTriangle, RefreshCw, Download } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from '@/lib/supabase';
import { getWiseAppLabels } from "@/lib/directApiService";
import { useWiseAppAccess } from "@/context/WiseAppAccessContext";
import { createApiUrl, getSupabaseEdgeFunctionHeaders } from '@/lib/api-config-supabase';
import { AccountSwitcher } from './AccountSwitcher';

interface Tag {
  id: number;
  nome: string;
  cor: string;
  company_id: number;
  limite_max: number | null;
  id_conta_wiseapp: string | null;
  created_at: string;
  updated_at: string;
}

interface TagAdministrationProps {
  companyId: number;
}

export function TagAdministration({ companyId }: TagAdministrationProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSyncConfirmOpen, setIsSyncConfirmOpen] = useState(false);
  const queryClient = useQueryClient();
  // IMPORTANT: Use accountId from WiseAppAccess (associated with authenticated email)
  // instead of AuthContext (which may use accountId from URL)
  const { token: wiseAppToken, accountId } = useWiseAppAccess();

  // Query para buscar todas as tags da empresa filtradas pelo accountId WiseApp
  const { data: tags = [], isLoading } = useQuery<Tag[]>({
    queryKey: ['local-tags', companyId, accountId],
    queryFn: async () => {
      // First, try to query with id_conta_wiseapp filter if the column exists
      // If column doesn't exist yet (migration pending), fall back to company_id only
      try {
        let query = supabase
          .from('tag')
          .select('*')
          .eq('company_id', companyId);
        
        // Filter by id_conta_wiseapp if available to ensure proper data isolation
        if (accountId) {
          query = query.or(`id_conta_wiseapp.eq.${accountId},id_conta_wiseapp.is.null`);
        }
        
        const { data, error } = await query.order('nome');

        if (error) {
          // Check if error is about missing column
          if (error.code === '42703' && error.message?.includes('id_conta_wiseapp')) {
            console.warn('[TagAdministration] Coluna id_conta_wiseapp não existe ainda, usando fallback');
            // Fallback: query without id_conta_wiseapp filter
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('tag')
              .select('*')
              .eq('company_id', companyId)
              .order('nome');
            
            if (fallbackError) throw fallbackError;
            return fallbackData || [];
          }
          throw error;
        }
        return data || [];
      } catch (error) {
        console.error('[TagAdministration] Erro ao buscar tags:', error);
        throw error;
      }
    },
    enabled: !!companyId && accountId !== undefined,
  });

  const createTagMutation = useMutation({
    mutationFn: async (tagData: Omit<Tag, 'id' | 'created_at' | 'updated_at'>) => {
      if (!accountId || !wiseAppToken) {
        throw new Error('Token/conta WiseApp não configurados. Capture o token antes de criar marcadores.');
      }
      await createWiseAppTag({
        id: 0,
        nome: tagData.nome,
        cor: tagData.cor || '#3B82F6',
        limite_max: tagData.limite_max || null,
        company_id: tagData.company_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as Tag);

      // Try to insert with id_conta_wiseapp, fallback if column doesn't exist
      const insertData: Record<string, any> = {
        nome: tagData.nome,
        cor: tagData.cor || '#3B82F6',
        limite_max: tagData.limite_max || null,
        company_id: tagData.company_id,
        id_conta_wiseapp: accountId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      let result = await supabase
        .from('tag')
        .insert(insertData)
        .select();

      // If column doesn't exist, try without id_conta_wiseapp
      if (result.error?.code === '42703' && result.error.message?.includes('id_conta_wiseapp')) {
        console.warn('[TagAdministration] Coluna id_conta_wiseapp não existe, inserindo sem ela');
        delete insertData.id_conta_wiseapp;
        result = await supabase
          .from('tag')
          .insert(insertData)
          .select();
      }

      if (result.error) throw result.error;
      return result.data?.[0];
    },
    onSuccess: async () => {
      // Invalidar todas as queries relacionadas a tags
      await queryClient.invalidateQueries({ queryKey: ['local-tags', companyId] });
      await queryClient.invalidateQueries({ queryKey: ['tags'] });
      await queryClient.invalidateQueries({ queryKey: ['all-tags'] });
      await queryClient.invalidateQueries({ queryKey: ['motorista-tags'] });

      // Forçar refetch das queries
      await queryClient.refetchQueries({ queryKey: ['local-tags', companyId] });

      toast.success("Marcador criado no WiseApp e sincronizado localmente!");
      setIsCreateModalOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao criar marcador no WiseApp");
    },
  });

  // Mutation para atualizar tag
  const updateTagMutation = useMutation({
    mutationFn: async ({ tagId, updates }: { tagId: number; updates: Partial<Tag> }) => {
      const { data, error } = await supabase
        .from('tag')
        .update({
          nome: updates.nome,
          cor: updates.cor,
          limite_max: updates.limite_max,
          updated_at: new Date().toISOString()
        })
        .eq('id', tagId)
        .select();

      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      // Invalidar todas as queries relacionadas a tags
      queryClient.invalidateQueries({ queryKey: ['local-tags', companyId] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['all-tags'] });
      toast.success("Marcador atualizado com sucesso!");
      setIsEditModalOpen(false);
      setEditingTag(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar marcador");
    },
  });

  // Mutation para deletar tag
  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: number) => {
      // Buscar dados da tag antes de deletar
      const { data: tagData } = await supabase
        .from('tag')
        .select('*')
        .eq('id', tagId)
        .single();

      if (!tagData) throw new Error('Tag não encontrada');

      // Primeiro remover todas as associações
      const { error: deleteAssociationsError } = await supabase
        .from('associacao_tags')
        .delete()
        .eq('tag_id', tagId);

      if (deleteAssociationsError) throw deleteAssociationsError;

      // Depois deletar a tag
      const { error: deleteTagError } = await supabase
        .from('tag')
        .delete()
        .eq('id', tagId);

      if (deleteTagError) throw deleteTagError;

      return { success: true, tagData };
    },
    onSuccess: async (result) => {
      // Deletar tag no WiseApp também
      if (accountId && wiseAppToken && result.tagData) {
        try {
          await deleteWiseAppTag(result.tagData);
        } catch (error) {
          console.warn('Erro ao deletar tag no WiseApp (não crítico):', error);
        }
      }

      // Invalidar todas as queries relacionadas a tags
      queryClient.invalidateQueries({ queryKey: ['local-tags', companyId] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['all-tags'] });
      toast.success("Marcador deletado com sucesso!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao deletar marcador");
    },
  });

  // State for sync preview
  const [syncPreview, setSyncPreview] = useState<{
    toAdd: Array<{ nome: string; cor: string }>;
    toRemove: Array<{ id: number; nome: string }>;
    toUpdate: Array<{ id: number; nome: string; oldCor: string; newCor: string }>;
    unchanged: number;
  } | null>(null);

  // Mutation para buscar preview da sincronização (comparar WiseApp vs local)
  const fetchSyncPreviewMutation = useMutation({
    mutationFn: async () => {
      if (!accountId || !wiseAppToken) {
        throw new Error('Token/conta WiseApp não configurados. Capture o token primeiro.');
      }

      // 1. Buscar todas as labels do WiseApp
      const wiseAppLabels = await getWiseAppLabels(accountId, wiseAppToken, companyId);
      
      if (!Array.isArray(wiseAppLabels)) {
        throw new Error('Resposta inválida do WiseApp');
      }

      console.log('[SyncPreview] Labels do WiseApp:', wiseAppLabels);

      // 2. Buscar tags locais existentes
      let localTags: Tag[] = [];
      try {
        let query = supabase
          .from('tag')
          .select('*')
          .eq('company_id', companyId);
        
        if (accountId) {
          query = query.or(`id_conta_wiseapp.eq.${accountId},id_conta_wiseapp.is.null`);
        }
        
        const { data, error: fetchError } = await query;

        if (fetchError) {
          if (fetchError.code === '42703' && fetchError.message?.includes('id_conta_wiseapp')) {
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('tag')
              .select('*')
              .eq('company_id', companyId);
            
            if (fallbackError) throw fallbackError;
            localTags = fallbackData || [];
          } else {
            throw fetchError;
          }
        } else {
          localTags = data || [];
        }
      } catch (error) {
        console.error('[SyncPreview] Erro ao buscar tags locais:', error);
        throw error;
      }

      // 3. Comparar WiseApp vs Local
      const wiseAppNamesMap = new Map<string, { nome: string; cor: string }>();
      wiseAppLabels.forEach((label: any) => {
        const nome = (label.title || label.name || '').toLowerCase().trim();
        wiseAppNamesMap.set(nome, {
          nome: label.title || label.name,
          cor: label.color || '#3B82F6'
        });
      });

      const localNamesMap = new Map<string, Tag>();
      localTags.forEach(tag => {
        const nome = (tag.nome || '').toLowerCase().trim();
        localNamesMap.set(nome, tag);
      });

      // Tags para adicionar (existem no WiseApp mas não localmente)
      const toAdd: Array<{ nome: string; cor: string }> = [];
      wiseAppNamesMap.forEach((wiseAppTag, nomeLower) => {
        if (!localNamesMap.has(nomeLower)) {
          toAdd.push(wiseAppTag);
        }
      });

      // Tags para remover (existem localmente mas não no WiseApp)
      const toRemove: Array<{ id: number; nome: string }> = [];
      localNamesMap.forEach((localTag, nomeLower) => {
        if (!wiseAppNamesMap.has(nomeLower)) {
          toRemove.push({ id: localTag.id, nome: localTag.nome });
        }
      });

      // Tags para atualizar (existem em ambos mas cor diferente)
      const toUpdate: Array<{ id: number; nome: string; oldCor: string; newCor: string }> = [];
      let unchanged = 0;
      localNamesMap.forEach((localTag, nomeLower) => {
        const wiseAppTag = wiseAppNamesMap.get(nomeLower);
        if (wiseAppTag) {
          if (localTag.cor !== wiseAppTag.cor) {
            toUpdate.push({
              id: localTag.id,
              nome: localTag.nome,
              oldCor: localTag.cor,
              newCor: wiseAppTag.cor
            });
          } else {
            unchanged++;
          }
        }
      });

      return { toAdd, toRemove, toUpdate, unchanged };
    },
    onSuccess: (preview) => {
      setSyncPreview(preview);
      setIsSyncConfirmOpen(true);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao comparar com WiseApp");
    },
  });

  // Mutation para sincronização inteligente (comparativa)
  const syncFromWiseAppMutation = useMutation({
    mutationFn: async () => {
      if (!syncPreview) {
        throw new Error('Preview de sincronização não disponível');
      }

      const { toAdd, toRemove, toUpdate } = syncPreview;
      const now = new Date().toISOString();

      // 1. Remover tags que não existem mais no WiseApp
      if (toRemove.length > 0) {
        const tagIdsToRemove = toRemove.map(t => t.id);
        
        // Primeiro deletar associações dessas tags
        await supabase
          .from('associacao_tags')
          .delete()
          .in('tag_id', tagIdsToRemove);

        // Depois deletar as tags
        const { error: deleteError } = await supabase
          .from('tag')
          .delete()
          .in('id', tagIdsToRemove);

        if (deleteError) throw deleteError;
        console.log(`[SmartSync] Removidas ${toRemove.length} tags que não existem mais no WiseApp`);
      }

      // 2. Adicionar novas tags do WiseApp
      if (toAdd.length > 0) {
        const newTags = toAdd.map(tag => ({
          nome: tag.nome,
          cor: tag.cor,
          company_id: companyId,
          id_conta_wiseapp: accountId,
          limite_max: null,
          created_at: now,
          updated_at: now
        }));

        let result = await supabase.from('tag').insert(newTags);

        if (result.error?.code === '42703' && result.error.message?.includes('id_conta_wiseapp')) {
          const tagsWithoutAccountId = newTags.map(({ id_conta_wiseapp, ...rest }) => rest);
          result = await supabase.from('tag').insert(tagsWithoutAccountId);
        }

        if (result.error) throw result.error;
        console.log(`[SmartSync] Adicionadas ${toAdd.length} novas tags do WiseApp`);
      }

      // 3. Atualizar tags com cor diferente
      let updateErrors: string[] = [];
      if (toUpdate.length > 0) {
        for (const tag of toUpdate) {
          const { error: updateError } = await supabase
            .from('tag')
            .update({ cor: tag.newCor, updated_at: now })
            .eq('id', tag.id);

          if (updateError) {
            console.warn(`[SmartSync] Erro ao atualizar tag ${tag.nome}:`, updateError);
            updateErrors.push(tag.nome);
          }
        }
        console.log(`[SmartSync] Atualizadas ${toUpdate.length - updateErrors.length} tags com cores diferentes`);
      }

      // Se houve erros de atualização, reportar mas não falhar completamente
      if (updateErrors.length > 0) {
        console.error(`[SmartSync] Erros ao atualizar ${updateErrors.length} tags:`, updateErrors);
      }

      return {
        added: toAdd.length,
        removed: toRemove.length,
        updated: toUpdate.length - updateErrors.length,
        updateErrors: updateErrors.length
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['local-tags', companyId] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['all-tags'] });
      queryClient.invalidateQueries({ queryKey: ['motorista-tags'] });
      
      const messages: string[] = [];
      if (result.added > 0) messages.push(`${result.added} adicionado(s)`);
      if (result.removed > 0) messages.push(`${result.removed} removido(s)`);
      if (result.updated > 0) messages.push(`${result.updated} atualizado(s)`);
      
      if (messages.length === 0 && !result.updateErrors) {
        toast.success('Sincronização completa! Nenhuma alteração necessária.');
      } else if (result.updateErrors && result.updateErrors > 0) {
        toast.error(`Sincronização parcial! ${messages.join(', ')}. ${result.updateErrors} atualização(ões) falharam.`);
      } else {
        toast.success(`Sincronização completa! ${messages.join(', ')}.`);
      }
      
      setSyncPreview(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao sincronizar com WiseApp");
    },
  });

  const handleCreateTag = (tagData: Omit<Tag, 'id' | 'created_at' | 'updated_at'>) => {
    createTagMutation.mutate(tagData);
  };

  const handleEditTag = (tag: Tag) => {
    setEditingTag(tag);
    setIsEditModalOpen(true);
  };

  const handleUpdateTag = (updates: Partial<Tag>) => {
    if (editingTag) {
      updateTagMutation.mutate({ tagId: editingTag.id, updates });
    }
  };

  const handleDeleteTag = (tag: Tag) => {
    setDeletingTag(tag);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteTag = () => {
    if (deletingTag) {
      deleteTagMutation.mutate(deletingTag.id);
      setIsDeleteModalOpen(false);
      setDeletingTag(null);
    }
  };

  const cancelDeleteTag = () => {
    setIsDeleteModalOpen(false);
    setDeletingTag(null);
  };

  // Função para criar tag no WiseApp usando a rota do backend (estrita)
  const createWiseAppTag = async (tag: Tag) => {
    if (!accountId || !wiseAppToken) {
      throw new Error('Token WiseApp ou Account ID não disponível');
    }

    const labelData = {
      title: tag.nome,
      color: tag.cor,
      description: tag.nome,
      show_on_sidebar: true
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(createApiUrl(`wiseapp/${accountId}/labels`), {
      method: 'POST',
      headers: getSupabaseEdgeFunctionHeaders({
        'wiseapp-token': wiseAppToken,
        'wiseapp-account-id': accountId
      }),
      body: JSON.stringify(labelData),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.text();
      if (response.status === 401) {
        throw new Error('Token WiseApp expirado. Por favor, reconecte sua conta WiseApp.');
      }
      throw new Error(`Erro ao criar tag no WiseApp: ${response.status} - ${errorData}`);
    }

    return response.json();
  };

  // Função para deletar tag no WiseApp usando a rota do backend
  const deleteWiseAppTag = async (tag: Tag) => {
    if (!accountId || !wiseAppToken) return;

    try {
      // Primeiro buscar todas as labels do WiseApp para encontrar o ID correto
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const labelsResponse = await fetch(createApiUrl(`wiseapp/${accountId}/labels`), {
        method: 'GET',
        headers: getSupabaseEdgeFunctionHeaders({
          'wiseapp-token': wiseAppToken,
          'wiseapp-account-id': accountId
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (labelsResponse.ok) {
        const labels = await labelsResponse.json();
        const wiseAppLabel = labels.find((label: any) => label.name === tag.nome);

        if (wiseAppLabel) {
          // Deletar a label no WiseApp
          const deleteController = new AbortController();
          const deleteTimeoutId = setTimeout(() => deleteController.abort(), 10000);

          const deleteResponse = await fetch(createApiUrl(`wiseapp/${accountId}/labels/${wiseAppLabel.id}`), {
            method: 'DELETE',
            headers: getSupabaseEdgeFunctionHeaders({
              'wiseapp-token': wiseAppToken,
              'wiseapp-account-id': accountId
            }),
            signal: deleteController.signal
          });

          clearTimeout(deleteTimeoutId);

          if (deleteResponse.ok) {
            console.log('Tag deletada do WiseApp com sucesso');
          } else {
            const errorData = await deleteResponse.text();
            console.warn(`Erro ao deletar tag do WiseApp: ${deleteResponse.status} - ${errorData}`);
          }
        } else {
          console.log('Tag não encontrada no WiseApp, pode já ter sido deletada');
        }
      } else {
        const errorData = await labelsResponse.text();
        console.warn(`Erro ao buscar labels do WiseApp: ${labelsResponse.status} - ${errorData}`);
      }
    } catch (error) {
      console.warn('Erro ao deletar tag do WiseApp (não crítico):', error);
    }
  };

  if (isLoading) {
    return <div className="text-center py-4 text-gray-600 dark:text-gray-400">Carregando tags...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <TagIcon className="w-5 h-5" />
          Administração de Marcadores
        </h3>
        <div className="flex items-center gap-3 flex-wrap">
          <AccountSwitcher />
          <button
            onClick={() => fetchSyncPreviewMutation.mutate()}
            disabled={syncFromWiseAppMutation.isPending || fetchSyncPreviewMutation.isPending || !wiseAppToken || !accountId}
            className="bg-green-600 dark:bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-700 dark:hover:bg-green-600 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-sync-wiseapp"
            title="Sincroniza marcadores com o WiseApp (adiciona novos, remove deletados, atualiza cores)"
          >
            {(syncFromWiseAppMutation.isPending || fetchSyncPreviewMutation.isPending) ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {fetchSyncPreviewMutation.isPending ? 'Comparando...' : syncFromWiseAppMutation.isPending ? 'Sincronizando...' : 'Sincronizar do WiseApp'}
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 flex items-center gap-2 transition-colors"
            data-testid="button-new-tag"
          >
            <Plus className="w-4 h-4" />
            Novo Marcador
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tags.map((tag) => (
          <div key={tag.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
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
                  onClick={() => handleEditTag(tag)}
                  className="p-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  title="Editar marcador"
                >
                  <Edit className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDeleteTag(tag)}
                  className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title="Deletar marcador"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {tag.limite_max && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Limite: {tag.limite_max} associados
              </div>
            )}

            <div className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              Criada em: {new Date(tag.created_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>

      {tags.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">
            Nenhum marcador encontrado. Clique em "Novo Marcador" para criar o primeiro.
          </p>
        </div>
      )}

      {/* Modal para criar tag */}
      {isCreateModalOpen && (
        <CreateTagModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSave={handleCreateTag}
          isLoading={createTagMutation.isPending}
          companyId={companyId}
        />
      )}

      {/* Modal para editar tag */}
      {isEditModalOpen && editingTag && (
        <EditTagModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingTag(null);
          }}
          tag={editingTag}
          onSave={handleUpdateTag}
          isLoading={updateTagMutation.isPending}
        />
      )}

      {/* Modal para confirmar deleção */}
      {isDeleteModalOpen && deletingTag && (
        <DeleteConfirmationModal
          isOpen={isDeleteModalOpen}
          onClose={cancelDeleteTag}
          onConfirm={confirmDeleteTag}
          tag={deletingTag}
          isLoading={deleteTagMutation.isPending}
        />
      )}

      {/* Modal para confirmar sincronização inteligente */}
      {isSyncConfirmOpen && syncPreview && (
        <SyncConfirmationModal
          isOpen={isSyncConfirmOpen}
          onClose={() => {
            setIsSyncConfirmOpen(false);
            setSyncPreview(null);
          }}
          onConfirm={() => {
            setIsSyncConfirmOpen(false);
            syncFromWiseAppMutation.mutate();
          }}
          syncPreview={syncPreview}
          isLoading={syncFromWiseAppMutation.isPending}
        />
      )}
    </div>
  );
}

// Modal para criar tag
interface CreateTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tagData: Omit<Tag, 'id' | 'created_at' | 'updated_at'>) => void;
  isLoading: boolean;
  companyId: number;
}

function CreateTagModal({ isOpen, onClose, onSave, isLoading, companyId }: CreateTagModalProps) {
  const [formData, setFormData] = useState({
    nome: '',
    cor: '#3B82F6',
    limite_max: ''
  });
  const [nameError, setNameError] = useState<string>('');

  const validateTagName = (name: string): boolean => {
    setNameError('');
    
    if (!name.trim()) {
      setNameError('Nome é obrigatório');
      return false;
    }

    if (name.trim().length < 1) {
      setNameError('Nome deve ter pelo menos 1 caractere');
      return false;
    }

    if (name.trim().length > 40) {
      setNameError('Nome deve ter no máximo 40 caracteres');
      return false;
    }

    // Regras do WiseApp: sem espaços, sem maiúsculas
    if (/\s/.test(name)) {
      setNameError('Nome não pode conter espaços');
      return false;
    }

    if (/[A-Z]/.test(name)) {
      setNameError('Nome deve estar em letras minúsculas');
      return false;
    }

    // Verificar caracteres especiais não permitidos (WiseApp permite letras minúsculas, números, hífen e underscore)
    if (!/^[a-z0-9\-_]+$/.test(name)) {
      setNameError('Use apenas letras minúsculas, números, hífens (-) e underscores (_)');
      return false;
    }

    // Não pode começar ou terminar com hífen ou underscore
    if (/^[\-_]|[\-_]$/.test(name)) {
      setNameError('Não pode começar ou terminar com hífen ou underscore');
      return false;
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateTagName(formData.nome.trim())) {
      return;
    }
    
    console.log('Criando tag com dados:', {
      nome: formData.nome.trim(),
      cor: formData.cor,
      limite_max: formData.limite_max ? parseInt(formData.limite_max.toString()) : null,
      company_id: companyId
    });
    
    onSave({
      nome: formData.nome.trim(),
      cor: formData.cor,
      limite_max: formData.limite_max ? parseInt(formData.limite_max.toString()) : null,
      company_id: companyId,
      id_conta_wiseapp: null
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black dark:bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-md mx-4 border dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Novo Marcador</h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nome do Marcador
            </label>
            <input
              type="text"
              value={formData.nome}
              onChange={(e) => {
                const value = e.target.value;
                setFormData(prev => ({ ...prev, nome: value }));
                // Validar em tempo real
                if (value) {
                  validateTagName(value);
                }
              }}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${
                nameError ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
              }`}
              required
              placeholder="exemplo: vendas-2024"
            />
            {nameError && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{nameError}</p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Use apenas letras minúsculas, números, hífens (-) e underscores (_). Sem espaços.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cor
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData.cor}
                onChange={(e) => setFormData(prev => ({ ...prev, cor: e.target.value }))}
                className="w-12 h-8 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
              />
              <input
                type="text"
                value={formData.cor}
                onChange={(e) => setFormData(prev => ({ ...prev, cor: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="#000000"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Limite Máximo de Associados (opcional)
            </label>
            <input
              type="number"
              min="1"
              value={formData.limite_max}
              onChange={(e) => setFormData(prev => ({ ...prev, limite_max: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Deixe vazio para sem limite"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isLoading ? 'Criando...' : 'Criar Marcador'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal para editar tag
interface EditTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  tag: Tag;
  onSave: (updates: Partial<Tag>) => void;
  isLoading: boolean;
}

function EditTagModal({ isOpen, onClose, tag, onSave, isLoading }: EditTagModalProps) {
  const [formData, setFormData] = useState({
    nome: tag.nome,
    cor: tag.cor,
    limite_max: tag.limite_max || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      nome: formData.nome,
      cor: formData.cor,
      limite_max: formData.limite_max ? parseInt(formData.limite_max.toString()) : null
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black dark:bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-md mx-4 border dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Editar Marcador</h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nome do Marcador
            </label>
            <input
              type="text"
              value={formData.nome}
              onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
              placeholder="Nome do marcador"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cor
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData.cor}
                onChange={(e) => setFormData(prev => ({ ...prev, cor: e.target.value }))}
                className="w-12 h-8 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
              />
              <input
                type="text"
                value={formData.cor}
                onChange={(e) => setFormData(prev => ({ ...prev, cor: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="#000000"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Limite Máximo de Associados (opcional)
            </label>
            <input
              type="number"
              min="1"
              value={formData.limite_max}
              onChange={(e) => setFormData(prev => ({ ...prev, limite_max: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Deixe vazio para sem limite"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isLoading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal para confirmar deleção de tag
interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  tag: Tag;
  isLoading: boolean;
}

function DeleteConfirmationModal({ isOpen, onClose, onConfirm, tag, isLoading }: DeleteConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black dark:bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-md mx-4 border dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 mx-auto bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Confirmar Deleção</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-gray-600 dark:text-gray-300 mb-3">
            Tem certeza que deseja deletar o marcador <strong>"{tag.nome}"</strong>?
          </p>
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600"
              style={{ backgroundColor: tag.cor }}
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Cor: {tag.cor}
            </span>
          </div>
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-md p-3">
            <p className="text-sm text-red-700 dark:text-red-300">
              <strong>Atenção:</strong> Esta ação irá:
            </p>
            <ul className="text-sm text-red-600 dark:text-red-400 mt-1 ml-4 list-disc">
              <li>Deletar o marcador do WiseApp também</li>
              <li>Remover todas as associações com motoristas</li>
            </ul>
            <p className="text-sm text-red-700 dark:text-red-300 mt-2 font-medium">
              Esta ação não pode ser desfeita.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-md hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {isLoading ? "Deletando..." : "Deletar Marcador"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal para confirmar sincronização inteligente
interface SyncConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  syncPreview: {
    toAdd: Array<{ nome: string; cor: string }>;
    toRemove: Array<{ id: number; nome: string }>;
    toUpdate: Array<{ id: number; nome: string; oldCor: string; newCor: string }>;
    unchanged: number;
  };
  isLoading: boolean;
}

function SyncConfirmationModal({ isOpen, onClose, onConfirm, syncPreview, isLoading }: SyncConfirmationModalProps) {
  if (!isOpen) return null;

  const { toAdd, toRemove, toUpdate, unchanged } = syncPreview;
  const hasChanges = toAdd.length > 0 || toRemove.length > 0 || toUpdate.length > 0;

  return (
    <div className="fixed inset-0 bg-black dark:bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-[480px] max-w-lg mx-4 border dark:border-gray-700 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 mx-auto bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Sincronizar do WiseApp</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          {!hasChanges ? (
            <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-md p-4 text-center">
              <p className="text-green-700 dark:text-green-300 font-medium">
                Tudo sincronizado!
              </p>
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                {unchanged} marcador(es) já estão em sincronia com o WiseApp.
              </p>
            </div>
          ) : (
            <>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Comparação realizada. Veja o que será alterado:
              </p>

              {/* Tags a adicionar */}
              {toAdd.length > 0 && (
                <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-md p-3 mb-3">
                  <p className="text-sm text-green-700 dark:text-green-300 font-medium mb-2">
                    <Plus className="w-4 h-4 inline mr-1" />
                    {toAdd.length} marcador(es) novo(s) serão adicionados:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {toAdd.slice(0, 10).map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-white dark:bg-gray-700 border border-green-300 dark:border-green-600"
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.cor }} />
                        {tag.nome}
                      </span>
                    ))}
                    {toAdd.length > 10 && (
                      <span className="text-xs text-green-600 dark:text-green-400">
                        +{toAdd.length - 10} mais
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Tags a remover */}
              {toRemove.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-md p-3 mb-3">
                  <p className="text-sm text-red-700 dark:text-red-300 font-medium mb-2">
                    <Trash2 className="w-4 h-4 inline mr-1" />
                    {toRemove.length} marcador(es) serão removidos (não existem mais no WiseApp):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {toRemove.slice(0, 10).map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-white dark:bg-gray-700 border border-red-300 dark:border-red-600"
                      >
                        {tag.nome}
                      </span>
                    ))}
                    {toRemove.length > 10 && (
                      <span className="text-xs text-red-600 dark:text-red-400">
                        +{toRemove.length - 10} mais
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                    As associações desses marcadores também serão removidas.
                  </p>
                </div>
              )}

              {/* Tags a atualizar */}
              {toUpdate.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-md p-3 mb-3">
                  <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-2">
                    <Edit className="w-4 h-4 inline mr-1" />
                    {toUpdate.length} marcador(es) terão a cor atualizada:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {toUpdate.slice(0, 10).map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-white dark:bg-gray-700 border border-blue-300 dark:border-blue-600"
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.oldCor }} />
                        <span>-&gt;</span>
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.newCor }} />
                        {tag.nome}
                      </span>
                    ))}
                    {toUpdate.length > 10 && (
                      <span className="text-xs text-blue-600 dark:text-blue-400">
                        +{toUpdate.length - 10} mais
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Inalterados */}
              {unchanged > 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {unchanged} marcador(es) já estão em sincronia e não serão alterados.
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors disabled:opacity-50"
          >
            {hasChanges ? 'Cancelar' : 'Fechar'}
          </button>
          {hasChanges && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className="px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-md hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isLoading ? "Sincronizando..." : "Confirmar Sincronização"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}