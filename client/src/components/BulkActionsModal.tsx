import React, { useState, useEffect } from 'react';
import { X, Loader2, Users, Building2, Tag } from 'lucide-react';
import { useCompanyData } from '../hooks/useCompanyData';
import toast from 'react-hot-toast';
import type { Cliente } from '../types/database';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface BulkActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: Set<number>;
  actionType: 'status' | 'client' | 'tags';
  onSuccess: () => void;
  clientes?: Cliente[];
}

const BulkActionsModal = ({ 
  isOpen, 
  onClose, 
  selectedItems, 
  actionType, 
  onSuccess,
  clientes = []
}: BulkActionsModalProps) => {
  const { query } = useCompanyData();
  const { companyId } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [tags, setTags] = useState<any[]>([]);

  // Buscar tags quando o modal abrir para ação de tags
  useEffect(() => {
    if (isOpen && actionType === 'tags' && companyId) {
      fetchTags();
    }
  }, [isOpen, actionType, companyId]);

  const fetchTags = async () => {
    try {
      const { data, error } = await supabase
        .from('tag')
        .select('*')
        .eq('company_id', companyId)
        .order('nome');

      if (error) throw error;
      setTags(data || []);
    } catch (error) {
      console.error('Erro ao buscar tags:', error);
      toast.error('Erro ao carregar tags');
    }
  };

  if (!isOpen) return null;

  const statusOptions = [
    { value: 'cadastrado', label: 'Cadastrado' },
    { value: 'qualificado', label: 'Qualificado' },
    { value: 'documentacao', label: 'Documentação' },
    { value: 'gr', label: 'GR' },
    { value: 'contrato_enviado', label: 'Contrato Enviado' },
    { value: 'contratado', label: 'Contratado' },
    { value: 'repescagem', label: 'Repescagem' },
    { value: 'rejeitado', label: 'Rejeitado' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (actionType === 'status' && !selectedStatus) {
      toast.error('Selecione um status');
      return;
    }

    if (actionType === 'tags' && !selectedTag) {
      toast.error('Selecione uma tag');
      return;
    }

    try {
      setSubmitting(true);
      
      // Convert selectedItems Set to array
      const itemIds = Array.from(selectedItems);
      
      if (actionType === 'status') {
        // Update status for all selected items
        for (const id of itemIds) {
          const { error } = await query('motorista')
            .update({ st_cadastro: selectedStatus })
            .eq('motorista_id', id);
            
          if (error) throw error;
        }
        
        toast.success(`Status atualizado para ${itemIds.length} item${itemIds.length !== 1 ? 's' : ''}`);
      } else if (actionType === 'client') {
        // Update client for all selected items
        const clienteId = selectedClient ? parseInt(selectedClient) : null;
        
        for (const id of itemIds) {
          const { error } = await query('motorista')
            .update({ cliente_id: clienteId })
            .eq('motorista_id', id);
            
          if (error) throw error;
        }
        
        toast.success(`Cliente atualizado para ${itemIds.length} item${itemIds.length !== 1 ? 's' : ''}`);
      } else if (actionType === 'tags') {
        // Add tag to all selected items
        const tagId = parseInt(selectedTag);
        
        for (const motoristaId of itemIds) {
          // Verificar se a associação já existe
          const { data: existingAssociation } = await supabase
            .from('associacao_tags')
            .select('id')
            .eq('motorista_id', motoristaId)
            .eq('tag_id', tagId)
            .single();
          
          // Se não existe, criar a associação
          if (!existingAssociation) {
            const { error } = await supabase
              .from('associacao_tags')
              .insert({
                motorista_id: motoristaId,
                tag_id: tagId
              });
            
            if (error) throw error;
          }
        }
        
        const tagName = tags.find(t => t.id === tagId)?.nome || '';
        toast.success(`Tag "${tagName}" adicionada a ${itemIds.length} item${itemIds.length !== 1 ? 's' : ''}`);
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating items:', error);
      toast.error('Erro ao atualizar itens');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            {actionType === 'status' ? (
              <>
                <Users className="text-blue-500" size={24} />
                Atualizar Status em Massa
              </>
            ) : actionType === 'client' ? (
              <>
                <Building2 className="text-blue-500" size={24} />
                Atualizar Cliente em Massa
              </>
            ) : (
              <>
                <Tag className="text-green-500" size={24} />
                Adicionar Tag em Massa
              </>
            )}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Esta ação irá atualizar {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selecionado{selectedItems.size !== 1 ? 's' : ''}.
            </p>
          </div>

          {actionType === 'status' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Novo Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 max-h-60"
                required
              >
                <option value="">Selecione um status</option>
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : actionType === 'client' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Novo Cliente
              </label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 max-h-60"
              >
                <option value="">Sem cliente</option>
                {clientes.map(cliente => (
                  <option key={cliente.cliente_id} value={cliente.cliente_id.toString()}>
                    {cliente.nome}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tag para Adicionar
              </label>
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 max-h-60"
                required
              >
                <option value="">Selecione uma tag</option>
                {tags.map(tag => (
                  <option key={tag.id} value={tag.id.toString()}>
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2 flex-shrink-0" 
                        style={{ backgroundColor: tag.cor }}
                      />
                      {tag.nome}
                    </div>
                  </option>
                ))}
              </select>
              {tags.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Nenhuma tag encontrada. Crie tags primeiro na seção de administração.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={submitting || (actionType === 'status' && !selectedStatus) || (actionType === 'tags' && !selectedTag)}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Atualizando...
                </>
              ) : (
                'Atualizar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BulkActionsModal;