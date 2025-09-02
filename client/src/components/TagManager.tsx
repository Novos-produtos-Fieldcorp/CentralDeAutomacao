import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit, X, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { useWiseAppAccess } from "@/context/WiseAppAccessContext";

interface TagFormData {
  nome: string;
  cor: string;
  limite_max?: number;
}

interface Tag {
  id: number;
  nome: string;
  cor: string;
  limite_max?: number;
  company_id: number;
  created_at: string;
  updated_at: string;
}

interface TagManagerProps {
  companyId: number;
}

export function TagManager({ companyId }: TagManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [formData, setFormData] = useState<TagFormData>({
    nome: "",
    cor: "#3B82F6",
    limite_max_associados: undefined,
  });
  const [isSyncingWiseApp, setIsSyncingWiseApp] = useState(false);
  const queryClient = useQueryClient();
  const { accountId } = useAuth();
  const { token: wiseAppToken } = useWiseAppAccess();

  // Query para buscar tags
  const { data: tags = [], isLoading } = useQuery<Tag[]>({
    queryKey: ['/api/tags', companyId],
    queryFn: async () => {
      const response = await fetch(`/api/tags?company_id=${companyId}`);
      if (!response.ok) throw new Error('Erro ao buscar tags');
      return response.json();
    },
  });

  // Mutation para criar tag
  const createTagMutation = useMutation({
    mutationFn: async (data: TagFormData) => {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, company_id: companyId }),
      });
      if (!response.ok) throw new Error('Erro ao criar tag');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tags', companyId] });
      setIsModalOpen(false);
      resetForm();
      toast.success("Tag criada com sucesso!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao criar tag");
    },
  });

  // Mutation para atualizar tag
  const updateTagMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: TagFormData }) => {
      const response = await fetch(`/api/tags/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Erro ao atualizar tag');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tags', companyId] });
      setIsModalOpen(false);
      setEditingTag(null);
      resetForm();
      toast.success("Tag atualizada com sucesso!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar tag");
    },
  });

  // Mutation para deletar tag
  const deleteTagMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/tags/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Erro ao deletar tag');
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tags', companyId] });
      toast.success("Tag deletada com sucesso!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao deletar tag");
    },
  });

  const resetForm = () => {
    setFormData({ nome: "", cor: "#3B82F6", limite_max_associados: undefined });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    
    if (editingTag) {
      updateTagMutation.mutate({ id: editingTag.id, data: formData });
    } else {
      createTagMutation.mutate(formData);
    }
  };

  const handleEdit = (tag: Tag) => {
    setEditingTag(tag);
    setFormData({ 
      nome: tag.nome, 
      cor: tag.cor, 
      limite_max: tag.limite_max || undefined 
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja deletar esta tag?")) {
      deleteTagMutation.mutate(id);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingTag(null);
    resetForm();
  };

  // Sincronizar tags do WiseApp
  const syncWiseAppTags = async () => {
    if (isSyncingWiseApp) return;
    
    setIsSyncingWiseApp(true);
    try {
      if (!accountId) {
        toast.error('ID da conta não encontrado');
        return;
      }

      // Verificar se temos token WiseApp
      if (!wiseAppToken) {
        toast.error('Token WiseApp não encontrado. Configure o token primeiro.');
        return;
      }

      // Buscar tags do WiseApp
      const response = await fetch(`/api/wiseapp/${companyId}/labels`, {
        headers: {
          'wiseapp-token': wiseAppToken,
          'wiseapp-account-id': accountId
        }
      });
      if (!response.ok) {
        throw new Error('Erro ao buscar tags do WiseApp');
      }

      const wiseAppTags = await response.json();
      console.log('WiseApp tags found:', wiseAppTags);
      
      if (!wiseAppTags || wiseAppTags.length === 0) {
        toast('Nenhuma tag encontrada no WiseApp.', {
          icon: 'ℹ️'
        });
        return;
      }

      // Buscar tags existentes
      const existingTagsResponse = await fetch(`/api/tags?company_id=${companyId}`);
      const existingTags = await existingTagsResponse.json();
      const existingTagNames = new Set((existingTags || []).map((tag: Tag) => tag.nome.toLowerCase()));

      // Sincronizar tags locais
      let synced = 0;
      for (const wiseTag of wiseAppTags) {
        try {
          // Verificar se a tag já existe pelo nome (case-insensitive)
          if (!existingTagNames.has(wiseTag.name.toLowerCase())) {
            // Criar nova tag
            const createResponse = await fetch('/api/tags', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                nome: wiseTag.name,
                cor: wiseTag.color || '#3B82F6',
                company_id: companyId,
              }),
            });
            
            if (createResponse.ok) {
              synced++;
              console.log(`Tag sincronizada: ${wiseTag.name}`);
            } else {
              console.error(`Erro ao criar tag ${wiseTag.name}:`, await createResponse.text());
            }
          }
        } catch (error) {
          console.error(`Erro ao sincronizar tag ${wiseTag.name}:`, error);
        }
      }

      if (synced > 0) {
        toast.success(`${synced} tag(s) sincronizada(s) do WiseApp!`);
        queryClient.invalidateQueries({ queryKey: ['/api/tags', companyId] });
      } else {
        toast('Todas as tags já estavam sincronizadas.', {
          icon: 'ℹ️'
        });
      }
    } catch (error) {
      console.error('Erro ao sincronizar tags do WiseApp:', error);
      toast.error('Erro ao sincronizar tags do WiseApp');
    } finally {
      setIsSyncingWiseApp(false);
    }
  };

  if (isLoading) {
    return <div className="text-center">Carregando tags...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Tags</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={syncWiseAppTags}
            disabled={isSyncingWiseApp}
            className="bg-green-600 dark:bg-green-500 text-white px-3 py-1 rounded-md hover:bg-green-700 dark:hover:bg-green-600 flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncingWiseApp ? 'animate-spin' : ''}`} />
            {isSyncingWiseApp ? 'Sincronizando...' : 'Sincronizar com o Wiseapp'}
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 dark:bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Tag
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <div key={tag.id} className="flex items-center gap-1">
            <span
              style={{ backgroundColor: tag.cor }}
              className="text-white px-2 py-1 rounded-md text-sm"
            >
              {tag.nome}
            </span>
            <button
              onClick={() => handleEdit(tag)}
              className="p-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <Edit className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleDelete(tag.id)}
              className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {tags.length === 0 && (
        <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhuma tag criada ainda.</p>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black dark:bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-md mx-4 border dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editingTag ? "Editar Tag" : "Nova Tag"}
              </h2>
              <button
                onClick={handleModalClose}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Digite o nome da tag"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
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
                    onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                    className="w-10 h-10 border border-gray-300 dark:border-gray-600 rounded cursor-pointer bg-white dark:bg-gray-700"
                  />
                  <input
                    type="text"
                    value={formData.cor}
                    onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                    placeholder="#3B82F6"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Limite Máximo de Associados
                </label>
                <input
                  type="number"
                  value={formData.limite_max || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    limite_max: e.target.value ? parseInt(e.target.value) : undefined 
                  })}
                  placeholder="Ex: 10 (deixe vazio para ilimitado)"
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Deixe vazio para permitir associados ilimitados
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createTagMutation.isPending || updateTagMutation.isPending}
                  className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 transition-colors"
                >
                  {editingTag ? "Atualizar" : "Criar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}