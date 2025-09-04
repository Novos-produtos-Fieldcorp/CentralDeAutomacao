import React, { useState, useEffect } from 'react';
import { X, Loader2, Users, Building2, Tag } from 'lucide-react';
import { useCompanyData } from '../hooks/useCompanyData';
import toast from 'react-hot-toast';
import type { Cliente } from '../types/database';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useWiseAppAccess } from '../context/WiseAppAccessContext';
import { searchWiseAppContact, applyWiseAppContactLabels } from '../lib/directApiService';

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
  const { companyId, accountId } = useAuth();
  const { token: wiseAppToken } = useWiseAppAccess();
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

  // Função para aplicar tag aos contatos no WiseApp (usando serviços existentes)
  const applyTagToWiseAppContacts = async (tagData: any, motoristaIds: number[]) => {
    if (!accountId || !wiseAppToken) {
      console.log('Token WiseApp ou dados não disponíveis para sincronização');
      return;
    }

    try {
      console.log(`Aplicando tag "${tagData.nome}" aos contatos no WiseApp para ${motoristaIds.length} motoristas...`);
      
      let syncSuccessCount = 0;
      for (const motoristaId of motoristaIds) {
        try {
          // Buscar dados do motorista via view (para compatibilidade com AgregadosLista)
          const { data: motorista } = await supabase
            .from('vw_agregados_completo')
            .select('telefone, nome_motorista')
            .eq('motorista_id', motoristaId)
            .single();

          if (motorista?.telefone) {
            // Formatar telefone para WiseApp (+55 prefix se não tiver)
            const formattedPhone = motorista.telefone.startsWith('+55') 
              ? motorista.telefone 
              : `+55${motorista.telefone}`;
            
            // Buscar contato no WiseApp usando o serviço existente
            const searchData = await searchWiseAppContact(accountId, wiseAppToken, formattedPhone);
            const contacts = searchData.payload || [];
            
            if (contacts.length > 0) {
              const contact = contacts[0];
              
              // Aplicar tag ao contato usando o serviço existente
              await applyWiseAppContactLabels(accountId, wiseAppToken, contact.id, [tagData.nome], companyId);
              
              syncSuccessCount++;
              console.log(`Tag "${tagData.nome}" aplicada ao contato ${motorista.nome_motorista} no WiseApp`);
            } else {
              console.log(`Contato não encontrado no WiseApp para ${motorista.nome_motorista} (${motorista.telefone})`);
            }
          }
        } catch (contactError) {
          console.warn(`Erro ao processar motorista ${motoristaId}:`, contactError);
        }
      }
      
      if (syncSuccessCount > 0) {
        toast.success(`Tag "${tagData.nome}" aplicada a ${syncSuccessCount} contato(s) no WiseApp!`);
      } else {
        toast('Tag adicionada localmente. Nenhum contato correspondente foi encontrado no WiseApp.', {
          icon: 'ℹ️'
        });
      }
    } catch (error) {
      console.warn('Erro ao aplicar tags no WiseApp (não crítico):', error);
      toast('Tag adicionada localmente. Falha ao sincronizar com WiseApp.', {
        icon: '⚠️'
      });
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
    
    // Validar limite máximo de 150 seleções
    if (selectedItems.size > 150) {
      toast.error(`Você pode selecionar no máximo 150 itens por vez. Atualmente você tem ${selectedItems.size} itens selecionados.`);
      return;
    }
    
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
        // Add tag to selected items, respecting the tag limit
        const tagId = parseInt(selectedTag);
        const tag = tags.find(t => t.id === tagId);
        
        if (!tag) {
          toast.error('Tag não encontrada');
          return;
        }

        // Verificar quantas associações já existem para esta tag
        const { count, error: countError } = await supabase
          .from('associacao_tags')
          .select('*', { count: 'exact', head: true })
          .eq('tag_id', tagId);

        if (countError) throw countError;

        const currentCount = count || 0;
        let availableSlots = tag.limite_max ? tag.limite_max - currentCount : itemIds.length;
        
        // Se a tag tem limite e já atingiu o máximo, avisar e sair
        if (tag.limite_max && availableSlots <= 0) {
          toast.error(`Limite máximo de ${tag.limite_max} associados já atingido para a tag "${tag.nome}"`);
          return;
        }
        
        let addedCount = 0;
        let alreadyHasCount = 0;
        let limitReached = false;
        const motoristasComNovaTag: number[] = [];
        
        for (const motoristaId of itemIds) {
          // Se temos limite e já atingimos, parar
          if (tag.limite_max && addedCount >= availableSlots) {
            limitReached = true;
            break;
          }
          
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
            addedCount++;
            motoristasComNovaTag.push(motoristaId); // Coletar para sincronização
          } else {
            alreadyHasCount++;
          }
        }
        
        const tagName = tag.nome;
        
        // Aplicar tag aos contatos no WiseApp após adicionar tags localmente
        if (motoristasComNovaTag.length > 0) {
          await applyTagToWiseAppContacts(tag, motoristasComNovaTag);
        }
        
        // Mensagens de resultado
        if (limitReached && tag.limite_max) {
          toast.success(`Tag "${tagName}" adicionada a ${addedCount} motorista${addedCount !== 1 ? 's' : ''}. Limite de ${tag.limite_max} associações atingido - restante não foi processado.`);
        } else if (addedCount > 0) {
          toast.success(`Tag "${tagName}" adicionada a ${addedCount} item${addedCount !== 1 ? 's' : ''}${alreadyHasCount > 0 ? ` (${alreadyHasCount} já possuíam a tag)` : ''}`);
        } else if (alreadyHasCount > 0) {
          toast(`Todos os ${itemIds.length} item${itemIds.length !== 1 ? 's' : ''} selecionado${itemIds.length !== 1 ? 's' : ''} já possuem a tag "${tagName}"`, {
            icon: 'ℹ️'
          });
        }
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
          <div className={`p-4 rounded-lg ${
            selectedItems.size > 150 
              ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' 
              : 'bg-blue-50 dark:bg-blue-900/20'
          }`}>
            <p className={`text-sm ${
              selectedItems.size > 150 
                ? 'text-red-700 dark:text-red-300' 
                : 'text-blue-800 dark:text-blue-200'
            }`}>
              Esta ação irá atualizar <strong>{selectedItems.size}</strong> item{selectedItems.size !== 1 ? 's' : ''} selecionado{selectedItems.size !== 1 ? 's' : ''}.
              {selectedItems.size > 150 && (
                <span className="block mt-2 font-medium">
                  ⚠️ Limite máximo é de 150 itens por operação
                </span>
              )}
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
                    {tag.nome} {tag.limite_max ? `(Limite: ${tag.limite_max})` : '(Sem limite)'}
                  </option>
                ))}
              </select>
              {selectedTag && (() => {
                const selectedTagData = tags.find(t => t.id.toString() === selectedTag);
                return selectedTagData ? (
                  <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: selectedTagData.cor || '#3B82F6' }}
                      />
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {selectedTagData.nome}
                      </span>
                    </div>
                    {selectedTagData.limite_max ? (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Limite máximo: {selectedTagData.limite_max} associados
                      </p>
                    ) : (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Sem limite de associados
                      </p>
                    )}
                  </div>
                ) : null;
              })()}
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
              className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                selectedItems.size > 150 
                  ? 'bg-gray-400 dark:bg-gray-600' 
                  : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 dark:hover:bg-blue-500'
              }`}
              disabled={submitting || selectedItems.size > 150 || (actionType === 'status' && !selectedStatus) || (actionType === 'tags' && !selectedTag)}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Atualizando...
                </>
              ) : selectedItems.size > 150 ? (
                'Excede limite (150)'
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