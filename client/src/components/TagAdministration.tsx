import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Tag as TagIcon, Save, X, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from '@/lib/supabase';
import { getWiseAppLabels } from "@/lib/directApiService";
import { useAuth } from "@/context/AuthContext";
import { useWiseAppAccess } from "@/context/WiseAppAccessContext";
import { createApiUrl } from '@/lib/api-config';

interface Tag {
  id: number;
  nome: string;
  cor: string;
  company_id: number;
  limite_max: number | null;
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
  const queryClient = useQueryClient();
  const { accountId } = useAuth();
  const { token: wiseAppToken } = useWiseAppAccess();

  // Query para buscar todas as tags da empresa
  const { data: tags = [], isLoading } = useQuery<Tag[]>({
    queryKey: ['local-tags', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tag')
        .select('*')
        .eq('company_id', companyId)
        .order('nome');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  // Mutation para criar tag
  const createTagMutation = useMutation({
    mutationFn: async (tagData: Omit<Tag, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('tag')
        .insert({
          nome: tagData.nome,
          cor: tagData.cor || '#3B82F6',
          limite_max: tagData.limite_max || null,
          company_id: tagData.company_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();
      
      if (error) throw error;
      return data[0];
    },
    onSuccess: async (newTag) => {
      // Criar no WiseApp também
      if (accountId && wiseAppToken) {
        try {
          await createWiseAppTag(newTag);
        } catch (error) {
          console.warn('Erro ao criar tag no WiseApp (não crítico):', error);
        }
      }
      
      // Invalidar todas as queries relacionadas a tags
      await queryClient.invalidateQueries({ queryKey: ['local-tags', companyId] });
      await queryClient.invalidateQueries({ queryKey: ['tags'] });
      await queryClient.invalidateQueries({ queryKey: ['all-tags'] });
      await queryClient.invalidateQueries({ queryKey: ['motorista-tags'] });
      
      // Forçar refetch das queries
      await queryClient.refetchQueries({ queryKey: ['local-tags', companyId] });
      
      toast.success("Tag criada com sucesso!");
      setIsCreateModalOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao criar tag");
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
      toast.success("Tag atualizada com sucesso!");
      setIsEditModalOpen(false);
      setEditingTag(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar tag");
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
      toast.success("Tag deletada com sucesso!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao deletar tag");
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

  // Função para criar tag no WiseApp usando a rota do backend
  const createWiseAppTag = async (tag: Tag) => {
    if (!accountId || !wiseAppToken) return;
    
    try {
      const labelData = {
        name: tag.nome,
        color: tag.cor,
        description: tag.nome
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(createApiUrl(`wiseapp/${tag.company_id}/labels`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'wiseapp-token': wiseAppToken,
          'wiseapp-account-id': accountId
        },
        body: JSON.stringify(labelData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        console.log('Tag criada no WiseApp:', result);
      } else {
        const errorData = await response.text();
        console.warn(`WiseApp API retornou status ${response.status}: ${errorData}`);
      }
    } catch (error) {
      console.warn('Erro ao criar tag no WiseApp (não crítico):', error);
    }
  };

  // Função para deletar tag no WiseApp usando a rota do backend
  const deleteWiseAppTag = async (tag: Tag) => {
    if (!accountId || !wiseAppToken) return;
    
    try {
      // Primeiro buscar todas as labels do WiseApp para encontrar o ID correto
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const labelsResponse = await fetch(createApiUrl(`wiseapp/${tag.company_id}/labels`), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'wiseapp-token': wiseAppToken,
          'wiseapp-account-id': accountId
        },
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

          const deleteResponse = await fetch(createApiUrl(`wiseapp/${tag.company_id}/labels/${wiseAppLabel.id}`), {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'wiseapp-token': wiseAppToken,
              'wiseapp-account-id': accountId
            },
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
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <TagIcon className="w-5 h-5" />
          Administração de Tags
        </h3>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Tag
        </button>
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
                  title="Editar tag"
                >
                  <Edit className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDeleteTag(tag)}
                  className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title="Deletar tag"
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
            Nenhuma tag encontrada. Clique em "Nova Tag" para criar a primeira.
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
    </div>
  );
}

// Modal para criar tag
interface CreateTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tagData: Omit<Tag, 'id' | 'created_at' | 'updated_at'>) => void;
  isLoading: boolean;
}

function CreateTagModal({ isOpen, onClose, onSave, isLoading }: CreateTagModalProps) {
  const [formData, setFormData] = useState({
    nome: '',
    cor: '#3B82F6',
    limite_max: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      nome: formData.nome,
      cor: formData.cor,
      limite_max: formData.limite_max ? parseInt(formData.limite_max.toString()) : null,
      company_id: 1 // Isso deve vir do contexto
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black dark:bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-md mx-4 border dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Nova Tag</h2>
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
              Nome da Tag
            </label>
            <input
              type="text"
              value={formData.nome}
              onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
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
              {isLoading ? 'Criando...' : 'Criar Tag'}
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Editar Tag</h2>
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
              Nome da Tag
            </label>
            <input
              type="text"
              value={formData.nome}
              onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
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
            Tem certeza que deseja deletar a tag <strong>"{tag.nome}"</strong>?
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
              <li>Remover a tag do banco de dados local</li>
              <li>Deletar a tag do WiseApp também</li>
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
            {isLoading ? "Deletando..." : "Deletar Tag"}
          </button>
        </div>
      </div>
    </div>
  );
}
