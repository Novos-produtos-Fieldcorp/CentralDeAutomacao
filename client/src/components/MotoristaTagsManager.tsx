import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Tag as TagIcon, Edit, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { getWiseAppLabels } from "@/lib/directApiService";
import { useAuth } from "@/context/AuthContext";
import { useWiseAppAccess } from "@/context/WiseAppAccessContext";
import { supabase } from '@/lib/supabase';

interface Tag {
  id: number;
  nome: string;
  cor: string;
  company_id: number;
  limite_max: number | null;
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
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const { accountId } = useAuth();
  const { token: wiseAppToken } = useWiseAppAccess();

  // Query para buscar tags do motorista  
  const { data: motoristaTagsData = [], isLoading: isLoadingMotorTags } = useQuery<Tag[]>({
    queryKey: ['motorista-tags', motoristaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('associacao_tags')
        .select(`
          tag:tag_id (
            id,
            nome,
            cor,
            company_id,
            limite_max,
            created_at,
            updated_at
          )
        `)
        .eq('motorista_id', motoristaId);

      if (error) throw error;
      return data?.map((item: any) => item.tag).filter(Boolean) || [];
    },
    enabled: !!motoristaId,
  });

  // Query para buscar todas as tags da empresa do banco local
  const { data: allTags = [], isLoading: isLoadingAllTags } = useQuery<Tag[]>({
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

  // Verificar limite de associados por tag
  const checkTagLimit = async (tagId: number): Promise<{ canAdd: boolean; currentCount: number; limit: number | null }> => {
    try {
      // Buscar informações da tag
      const { data: tagData, error: tagError } = await supabase
        .from('tag')
        .select('limite_max')
        .eq('id', tagId)
        .single();

      if (tagError) throw tagError;

      if (!tagData.limite_max) {
        return { canAdd: true, currentCount: 0, limit: null };
      }

      // Contar associados atuais
      const { count, error: countError } = await supabase
        .from('associacao_tags')
        .select('*', { count: 'exact', head: true })
        .eq('tag_id', tagId);

      if (countError) throw countError;

      const currentCount = count || 0;
      const canAdd = currentCount < tagData.limite_max;

      return { canAdd, currentCount, limit: tagData.limite_max };
    } catch (error) {
      console.error('Erro ao verificar limite do marcador:', error);
      return { canAdd: true, currentCount: 0, limit: null };
    }
  };

  // Mutation para adicionar marcador ao motorista
  const addTagMutation = useMutation({
    mutationFn: async (tagId: number) => {
      try {
        // Verificar se a associação já existe
        const { data: existingAssociation } = await supabase
          .from('associacao_tags')
          .select('id')
          .eq('motorista_id', motoristaId)
          .eq('tag_id', tagId)
          .single();

        if (existingAssociation) {
          throw new Error('Marcador já está associado a este motorista');
        }

        // Buscar dados do motorista e da tag
        const { data: motorista, error: motoristaError } = await supabase
          .from('motorista')
          .select('nome, telefone')
          .eq('motorista_id', motoristaId)
          .single();

        if (motoristaError) throw motoristaError;

        const { data: tag, error: tagError } = await supabase
          .from('tag')
          .select('nome')
          .eq('id', tagId)
          .single();

        if (tagError) throw tagError;

        // Criar a associação local
        const { data, error } = await supabase
          .from('associacao_tags')
          .insert({
            motorista_id: motoristaId,
            tag_id: tagId
          })
          .select();

        if (error) throw error;

        // Sincronizar via backend seguro (usando a mesma lógica do BulkActionsModal)
        if (motorista.telefone && accountId && wiseAppToken) {
          try {
            // Buscar contato no WiseApp primeiro
            const formattedPhone = motorista.telefone.replace(/\D/g, '');
            const searchResponse = await fetch(`https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/search?phone=${formattedPhone}`, {
              method: 'GET',
              headers: {
                'api_access_token': wiseAppToken,
                'Content-Type': 'application/json'
              }
            });

            if (searchResponse.ok) {
              const searchData = await searchResponse.json();
              const contacts = searchData.payload || [];
              
              if (contacts.length > 0) {
                const contact = contacts[0];
                
                // Buscar labels existentes primeiro
                const existingTagsResponse = await fetch(`/api/wiseapp/${companyId}/contacts/${contact.id}/labels`, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'wiseapp-token': wiseAppToken,
                    'wiseapp-account-id': accountId
                  }
                });

                let existingTags: string[] = [];
                if (existingTagsResponse.ok) {
                  const existingTagsData = await existingTagsResponse.json();
                  existingTags = existingTagsData.payload || [];
                }

                // Criar array com todas as tags (existentes + nova)
                const allTags = [...existingTags];
                if (!allTags.some(existingTag => existingTag.toLowerCase() === tag.nome.toLowerCase())) {
                  allTags.push(tag.nome);
                }

                // Enviar array completo
                const tagResponse = await fetch(`/api/wiseapp/${companyId}/contacts/${contact.id}/labels`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'wiseapp-token': wiseAppToken,
                    'wiseapp-account-id': accountId
                  },
                  body: JSON.stringify({ labels: allTags })
                });

                if (tagResponse.ok) {
                  console.log(`✅ Tag "${tag.nome}" sincronizada com sucesso no WiseApp`);
                } else {
                  const errorData = await tagResponse.text();
                  console.warn(`⚠️ Erro na sincronização WiseApp:`, errorData);
                }
              } else {
                console.log(`❌ Nenhum contato encontrado no WiseApp para ${motorista.nome} (${formattedPhone})`);
              }
            } else {
              console.warn(`⚠️ Erro ao buscar contato no WiseApp:`, searchResponse.status);
            }
          } catch (error) {
            console.warn(`⚠️ Erro não crítico na sincronização:`, error);
          }
        }

        return data[0];
      } catch (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['motorista-tags', motoristaId] });
      queryClient.invalidateQueries({ queryKey: ['local-tags', companyId] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['all-tags'] });
      toast.success("Marcador adicionado e sincronizado com sucesso!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao adicionar marcador");
    },
  });

  // Mutation para remover tag do motorista
  const removeTagMutation = useMutation({
    mutationFn: async (tagId: number) => {
      try {
        // Buscar dados do motorista e da tag antes de remover
        const { data: motorista, error: motoristaError } = await supabase
          .from('motorista')
          .select('nome, telefone')
          .eq('motorista_id', motoristaId)
          .single();

        if (motoristaError) throw motoristaError;

        const { data: tag, error: tagError } = await supabase
          .from('tag')
          .select('nome')
          .eq('id', tagId)
          .single();

        if (tagError) throw tagError;

        // Remover a associação local
        const { error } = await supabase
          .from('associacao_tags')
          .delete()
          .eq('motorista_id', motoristaId)
          .eq('tag_id', tagId);

        if (error) throw error;

        // Sincronizar via backend seguro (usando a mesma lógica do BulkActionsModal)
        if (motorista.telefone && accountId && wiseAppToken) {
          try {
            // Buscar contato no WiseApp primeiro
            const formattedPhone = motorista.telefone.replace(/\D/g, '');
            const searchResponse = await fetch(`https://chat.wiseapp360.com/api/v1/accounts/${accountId}/contacts/search?phone=${formattedPhone}`, {
              method: 'GET',
              headers: {
                'api_access_token': wiseAppToken,
                'Content-Type': 'application/json'
              }
            });

            if (searchResponse.ok) {
              const searchData = await searchResponse.json();
              const contacts = searchData.payload || [];
              
              if (contacts.length > 0) {
                const contact = contacts[0];
                
                // Remover tag do contato usando rota que preserva outras tags
                const tagResponse = await fetch(`/api/wiseapp/${companyId}/contacts/${contact.id}/labels/${tagId}`, {
                  method: 'DELETE',
                  headers: {
                    'Content-Type': 'application/json',
                    'wiseapp-token': wiseAppToken,
                    'wiseapp-account-id': accountId
                  }
                });

                if (tagResponse.ok) {
                  console.log(`✅ Tag "${tag.nome}" removida com sucesso no WiseApp`);
                } else {
                  const errorData = await tagResponse.text();
                  console.warn(`⚠️ Erro na remoção WiseApp:`, errorData);
                }
              } else {
                console.log(`❌ Nenhum contato encontrado no WiseApp para ${motorista.nome} (${formattedPhone})`);
              }
            } else {
              console.warn(`⚠️ Erro ao buscar contato no WiseApp:`, searchResponse.status);
            }
          } catch (error) {
            console.warn(`⚠️ Erro não crítico na sincronização:`, error);
          }
        }

        return { success: true };
      } catch (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['motorista-tags', motoristaId] });
      queryClient.invalidateQueries({ queryKey: ['local-tags', companyId] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['all-tags'] });
      toast.success("Marcador removido e sincronizado com sucesso!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao remover marcador");
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
      queryClient.invalidateQueries({ queryKey: ['motorista-tags', motoristaId] });
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

  // Mutation para deletar tag completamente
  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: number) => {
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

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['motorista-tags', motoristaId] });
      queryClient.invalidateQueries({ queryKey: ['local-tags', companyId] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['all-tags'] });
      toast.success("Marcador deletado com sucesso!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao deletar marcador");
    },
  });

  const motoristaTags = motoristaTagsData || [];
  const availableTags = allTags.filter((tag: any) => 
    !motoristaTags.find((motTag: any) => motTag.id === tag.id)
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

  const handleEditTag = (tag: Tag) => {
    setEditingTag(tag);
    setIsEditModalOpen(true);
  };

  const handleDeleteTag = (tagId: number) => {
    if (window.confirm('Tem certeza que deseja deletar esta tag? Esta ação não pode ser desfeita.')) {
      deleteTagMutation.mutate(tagId);
    }
  };

  const handleUpdateTag = (updates: Partial<Tag>) => {
    if (editingTag) {
      updateTagMutation.mutate({ tagId: editingTag.id, updates });
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
          Marcadores do Motorista
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {motoristaTags.map((tag: any) => (
          <div key={tag.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:shadow-md transition-shadow">
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
                  onClick={() => handleEditTag(tag)}
                  className="p-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  title="Editar marcador"
                >
                  <Edit className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleRemoveTag(tag.id)}
                  className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title="Remover do motorista"
                >
                  <X className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDeleteTag(tag.id)}
                  className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-800 dark:hover:text-red-600 transition-colors"
                  title="Deletar marcador permanentemente"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
            {tag.limite_max && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Limite: {tag.limite_max} associados
              </div>
            )}
          </div>
        ))}
      </div>

      {motoristaTags.length === 0 && (
        <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhum marcador atribuído ainda.</p>
      )}

      {availableTags.length === 0 && motoristaTags.length > 0 && (
        <p className="text-gray-500 dark:text-gray-400 text-sm">Todos os marcadores disponíveis já foram atribuídos.</p>
      )}

      {/* Modal para adicionar marcadores */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black dark:bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-80 max-w-sm mx-4 border dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Adicionar Marcador</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1">
              {isLoadingAllTags ? (
                <div className="text-center py-4 text-gray-600 dark:text-gray-400 text-sm">Carregando marcadores...</div>
              ) : availableTags.length === 0 ? (
                <div className="text-center py-3 text-gray-500 dark:text-gray-400 text-sm">
                  Nenhum marcador disponível.
                </div>
              ) : (
                availableTags.map((tag: any) => (
                  <button
                    key={tag.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!addTagMutation.isPending) {
                        handleAddTag(tag.id);
                      }
                    }}
                    disabled={addTagMutation.isPending}
                    className="w-full flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors text-left select-none"
                  >
                    <div
                      className="w-3 h-3 rounded-full border border-gray-300"
                      style={{ backgroundColor: tag.cor }}
                    />
                    <span className="text-sm text-gray-900 dark:text-gray-100 flex-1">
                      {tag.nome}
                    </span>
                    {tag.limite_max && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Limite: {tag.limite_max}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-200 dark:border-gray-600">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para editar marcador */}
      {isEditModalOpen && editingTag && (
        <div className="fixed inset-0 bg-black dark:bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-md mx-4 border dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Editar Marcador</h2>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingTag(null);
                }}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <EditTagForm
              tag={editingTag}
              onSave={handleUpdateTag}
              onCancel={() => {
                setIsEditModalOpen(false);
                setEditingTag(null);
              }}
              isLoading={updateTagMutation.isPending}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Componente para editar marcador
interface EditTagFormProps {
  tag: Tag;
  onSave: (updates: Partial<Tag>) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function EditTagForm({ tag, onSave, onCancel, isLoading }: EditTagFormProps) {
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

  return (
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
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}