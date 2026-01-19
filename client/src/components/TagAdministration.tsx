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

  // Mutation para sincronização autoritativa (WiseApp -> Local)
  const syncFromWiseAppMutation = useMutation({
    mutationFn: async () => {
      if (!accountId || !wiseAppToken) {
        throw new Error('Token/conta WiseApp não configurados. Capture o token primeiro.');
      }

      // 1. Buscar todas as labels do WiseApp
      const wiseAppLabels = await getWiseAppLabels(accountId, wiseAppToken, companyId);
      
      if (!Array.isArray(wiseAppLabels)) {
        throw new Error('Resposta inválida do WiseApp');
      }

      console.log('[SyncFromWiseApp] Labels do WiseApp:', wiseAppLabels);

      // 2. Buscar tags locais existentes SOMENTE desta conta WiseApp (isolamento por accountId)
      let localTags: Tag[] = [];
      try {
        let query = supabase
          .from('tag')
          .select('*')
          .eq('company_id', companyId);
        
        // Filter by id_conta_wiseapp to ensure proper data isolation
        if (accountId) {
          query = query.or(`id_conta_wiseapp.eq.${accountId},id_conta_wiseapp.is.null`);
        }
        
        const { data, error: fetchError } = await query;

        if (fetchError) {
          // Check if error is about missing column
          if (fetchError.code === '42703' && fetchError.message?.includes('id_conta_wiseapp')) {
            console.warn('[SyncFromWiseApp] Coluna id_conta_wiseapp não existe ainda, usando fallback');
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
        console.error('[SyncFromWiseApp] Erro ao buscar tags locais:', error);
        throw error;
      }

      // 3. Deletar tags locais SOMENTE desta conta WiseApp (isolamento)
      if (localTags && localTags.length > 0) {
        // Primeiro deletar associações das tags que vamos remover
        const tagIds = localTags.map(t => t.id);
        await supabase
          .from('associacao_tags')
          .delete()
          .in('tag_id', tagIds);

        // Depois deletar as tags por IDs específicos (não por company_id geral)
        const { error: deleteError } = await supabase
          .from('tag')
          .delete()
          .in('id', tagIds);

        if (deleteError) throw deleteError;
      }

      // 4. Inserir as tags do WiseApp como novas tags locais
      const now = new Date().toISOString();
      const newTags = wiseAppLabels.map((label: any) => ({
        nome: label.title || label.name,
        cor: label.color || '#3B82F6',
        company_id: companyId,
        id_conta_wiseapp: accountId,
        limite_max: null,
        created_at: now,
        updated_at: now
      }));

      if (newTags.length > 0) {
        // Try to insert with id_conta_wiseapp, fallback if column doesn't exist
        let result = await supabase
          .from('tag')
          .insert(newTags);

        // If column doesn't exist, try without id_conta_wiseapp
        if (result.error?.code === '42703' && result.error.message?.includes('id_conta_wiseapp')) {
          console.warn('[SyncFromWiseApp] Coluna id_conta_wiseapp não existe, inserindo sem ela');
          const tagsWithoutAccountId = newTags.map(({ id_conta_wiseapp, ...rest }) => rest);
          result = await supabase
            .from('tag')
            .insert(tagsWithoutAccountId);
        }

        if (result.error) throw result.error;
      }

      return {
        imported: newTags.length,
        deleted: localTags?.length || 0
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['local-tags', companyId] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['all-tags'] });
      toast.success(`Sincronização completa! ${result.imported} marcadores importados do WiseApp.`);
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
      name: tag.nome,
      color: tag.cor,
      description: tag.nome
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
            onClick={() => setIsSyncConfirmOpen(true)}
            disabled={syncFromWiseAppMutation.isPending || !wiseAppToken || !accountId}
            className="bg-green-600 dark:bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-700 dark:hover:bg-green-600 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-sync-wiseapp"
            title="Sincroniza todos os marcadores do WiseApp, substituindo os locais"
          >
            {syncFromWiseAppMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {syncFromWiseAppMutation.isPending ? 'Sincronizando...' : 'Sincronizar do WiseApp'}
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

      {/* Modal para confirmar sincronização autoritativa */}
      {isSyncConfirmOpen && (
        <SyncConfirmationModal
          isOpen={isSyncConfirmOpen}
          onClose={() => setIsSyncConfirmOpen(false)}
          onConfirm={() => {
            setIsSyncConfirmOpen(false);
            syncFromWiseAppMutation.mutate();
          }}
          localTagsCount={tags.length}
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

// Modal para confirmar sincronização autoritativa
interface SyncConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  localTagsCount: number;
  isLoading: boolean;
}

function SyncConfirmationModal({ isOpen, onClose, onConfirm, localTagsCount, isLoading }: SyncConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black dark:bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-md mx-4 border dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 mx-auto bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
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
          <p className="text-gray-600 dark:text-gray-300 mb-3">
            Esta ação irá <strong>substituir completamente</strong> todos os marcadores locais pelos marcadores do WiseApp.
          </p>
          
          {localTagsCount > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 mb-3">
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                <strong>Atenção:</strong> Você tem <strong>{localTagsCount}</strong> marcador(es) local(is) que serão removidos.
              </p>
            </div>
          )}
          
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-md p-3">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>O que vai acontecer:</strong>
            </p>
            <ul className="text-sm text-blue-600 dark:text-blue-400 mt-1 ml-4 list-disc">
              <li>Todas as associações de marcadores serão removidas</li>
              <li>Todos os marcadores locais serão deletados</li>
              <li>Os marcadores do WiseApp serão importados</li>
            </ul>
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
            className="px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-md hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isLoading ? "Sincronizando..." : "Confirmar Sincronização"}
          </button>
        </div>
      </div>
    </div>
  );
}