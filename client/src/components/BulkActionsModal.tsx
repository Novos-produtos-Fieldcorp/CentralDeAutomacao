import React, { useState, useEffect } from 'react';
import { X, Loader2, Users, Building2, Tag } from 'lucide-react';
import { useCompanyData } from '../hooks/useCompanyData';
import toast from 'react-hot-toast';
import type { Cliente } from '../types/database';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useWiseAppAccess } from '../context/WiseAppAccessContext';
import { searchWiseAppContact } from '../lib/directApiService';
import { API_BASE_URL, createApiUrl } from '@/lib/api-config-supabase';

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
  const [availableTagSlots, setAvailableTagSlots] = useState<number>(0);
  
  // Estados para barra de progresso
  const [progress, setProgress] = useState(0);
  const [processedItems, setProcessedItems] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [estimatedTimeLeft, setEstimatedTimeLeft] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Buscar tags quando o modal abrir para ação de tags
  useEffect(() => {
    if (isOpen && actionType === 'tags' && companyId) {
      fetchTags();
    }
    
    // Reset progress states when modal closes
    if (!isOpen) {
      setProgress(0);
      setProcessedItems(0);
      setTotalItems(0);
      setEstimatedTimeLeft(null);
      setStartTime(null);
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
      console.error('Erro ao buscar marcadores:', error);
      toast.error('Erro ao carregar marcadores');
    }
  };

  // Calcular slots disponíveis quando tag for selecionada
  const calculateAvailableSlots = async (tagId: string) => {
    if (!tagId) {
      setAvailableTagSlots(0);
      return;
    }

    try {
      const tag = tags.find(t => t.id.toString() === tagId);
      if (!tag) {
        setAvailableTagSlots(0);
        return;
      }

      // Verificar quantas associações já existem para esta tag
      const { count, error: countError } = await supabase
        .from('associacao_tags')
        .select('*', { count: 'exact', head: true })
        .eq('tag_id', parseInt(tagId));

      if (countError) {
        console.warn('Erro ao contar associações existentes:', countError);
        // Em caso de erro, assumir que pode usar o limite total
        const tagLimit = tag.limite_max || 150;
        setAvailableTagSlots(Math.min(selectedItems.size, tagLimit));
        return;
      }

      const currentCount = count || 0;
      const tagLimit = tag.limite_max || 150;
      const availableSlots = Math.max(0, tagLimit - currentCount);
      
      // O número final é o menor entre: slots disponíveis e itens selecionados
      setAvailableTagSlots(Math.min(selectedItems.size, availableSlots));
    } catch (error) {
      console.error('Erro ao calcular slots disponíveis:', error);
      // Em caso de erro, usar selectedItems.size
      setAvailableTagSlots(selectedItems.size);
    }
  };

  // Executar cálculo quando tag ou selectedItems mudarem
  useEffect(() => {
    if (actionType === 'tags' && selectedTag) {
      calculateAvailableSlots(selectedTag);
    } else {
      setAvailableTagSlots(0);
    }
  }, [selectedTag, selectedItems.size, actionType, tags]);

  // Função para aplicar tag aos contatos no WiseApp (usando serviços existentes)
  const applyTagToWiseAppContacts = async (tagData: any, motoristaIds: number[]) => {
    if (!wiseAppToken || !companyId) {
      console.log('Token WiseApp ou dados não disponíveis para sincronização');
      return;
    }

    // Inicializar barra de progresso
    const total = motoristaIds.length;
    const startedAt = Date.now(); // Usar variável local para cálculos
    setTotalItems(total);
    setProcessedItems(0);
    setProgress(0);
    setStartTime(startedAt);

    // Buscar o id_conta_wiseapp correto para este company_id
    const { data: company, error: companyError } = await supabase
      .from('company')
      .select('id_conta_wiseapp')
      .eq('company_id', companyId)
      .single();

    if (companyError || !company?.id_conta_wiseapp) {
      console.error('Account ID da empresa não encontrado. Configure o id_conta_wiseapp na tabela company.');
      return;
    }

    const wiseAppAccountId = String(company.id_conta_wiseapp);

    try {
      console.log(`Aplicando tag "${tagData.nome}" aos contatos no WiseApp para ${motoristaIds.length} motoristas...`);

      let syncSuccessCount = 0;
      let processedCount = 0;
      console.log(`DEBUG: Processando ${motoristaIds.length} motoristas:`, motoristaIds);

      // Processar em lotes menores para evitar timeout e problemas de URL longa
      const batchSize = 25; // Reduzir tamanho do lote
      const batches = [];
      for (let i = 0; i < motoristaIds.length; i += batchSize) {
        batches.push(motoristaIds.slice(i, i + batchSize));
      }

      console.log(`[BULK] Processando ${batches.length} lotes de até ${batchSize} motoristas cada`);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`[BULK] Processando lote ${batchIndex + 1}/${batches.length} com ${batch.length} motoristas`);

        // Rate limiting entre lotes
        if (batchIndex > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1 segundo entre lotes
        }

        // Processar motoristas do lote em paralelo (mas com delay entre cada um)
        for (let i = 0; i < batch.length; i++) {
          const motoristaId = batch[i];

          // Rate limiting: delay entre requisições para evitar 401
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 200)); // 200ms entre requisições
          }

          try {
          console.log(`[BULK] Processando motorista ${motoristaId} (${i + 1}/${motoristaIds.length})`);

          // Buscar dados do motorista usando abordagem mais confiável (tabelas diretas primeiro)
          let motorista = null;
          let motoristaError = null;

          // 1. Tentar tabela motorista primeiro (mais comum e confiável)
          try {
            const { data: fromMotorista, error } = await supabase
              .from('motorista')
              .select('telefone, nome')
              .eq('motorista_id', motoristaId)
              .single();
            
            if (!error && fromMotorista) {
              motorista = { telefone: fromMotorista.telefone, nome_motorista: fromMotorista.nome };
              console.log(`[BULK] Encontrado na tabela motorista:`, motorista);
            } else if (error.code !== 'PGRST116') {
              motoristaError = error;
            }
          } catch (err: any) {
            if (err.code !== 'PGRST116') {
              console.warn(`Erro ao buscar na tabela motorista:`, err);
            }
          }

          // 2. Se não encontrou, tentar tabela agregado
          if (!motorista) {
            try {
              const { data: fromAgregado, error } = await supabase
                .from('agregado')
                .select('telefone, nome')
                .eq('agregado_id', motoristaId)
                .single();
              
              if (!error && fromAgregado) {
                motorista = { telefone: fromAgregado.telefone, nome_motorista: fromAgregado.nome };
                console.log(`DEBUG: Encontrado na tabela agregado:`, motorista);
              }
            } catch (err: any) {
              if (err.code !== 'PGRST116') {
                console.warn(`Erro ao buscar na tabela agregado:`, err);
              }
            }
          }

          // 3. Fallback: tentar pela coluna id em ambas as tabelas
          if (!motorista) {
            try {
              const { data: fromMotoristaById } = await supabase
                .from('motorista')
                .select('telefone, nome')
                .eq('id', motoristaId)
                .single();
              
              if (fromMotoristaById) {
                motorista = { telefone: fromMotoristaById.telefone, nome_motorista: fromMotoristaById.nome };
                console.log(`DEBUG: Encontrado na tabela motorista por ID:`, motorista);
              }
            } catch (err: any) {
              if (err.code !== 'PGRST116') {
                console.warn(`Erro ao buscar motorista por ID:`, err);
              }
            }
          }

          if (!motorista) {
            try {
              const { data: fromAgregadoById } = await supabase
                .from('agregado')
                .select('telefone, nome')
                .eq('id', motoristaId)
                .single();
              
              if (fromAgregadoById) {
                motorista = { telefone: fromAgregadoById.telefone, nome_motorista: fromAgregadoById.nome };
                console.log(`DEBUG: Encontrado na tabela agregado por ID:`, motorista);
              }
            } catch (err: any) {
              if (err.code !== 'PGRST116') {
                console.warn(`Erro ao buscar agregado por ID:`, err);
              }
            }
          }

          // 4. Último recurso: tentar a view (pode dar 406, mas não vai quebrar)
          if (!motorista) {
            console.log(`DEBUG: Tentando busca na view como último recurso para ${motoristaId}...`);
            try {
              const { data: fromView } = await supabase
                .from('vw_agregados_completo')
                .select('telefone, nome_motorista')
                .eq('motorista_id', motoristaId)
                .limit(1)
                .single();

              if (fromView) {
                motorista = { telefone: fromView.telefone, nome_motorista: fromView.nome_motorista };
                console.log(`DEBUG: Encontrado na view:`, motorista);
              }
            } catch (viewError: any) {
              console.warn(`DEBUG: Erro na view (esperado): ${viewError.message}`);
              // Não quebrar aqui, só log do erro
            }
          }

          // Se ainda não encontrou motorista, pular este ID
          if (!motorista || !motorista.telefone) {
            console.log(`DEBUG: Motorista ${motoristaId} não encontrado em nenhuma fonte, pulando...`);
            continue;
          }

          if (motorista?.telefone) {
            // Usar telefone sem +55 como na versão individual que funciona
            const phoneStr = String(motorista.telefone);
            const formattedPhone = phoneStr.replace(/^\+55/, ''); // Remove +55 se existir

            try {
              // Buscar contato no WiseApp usando o serviço existente
              const searchData = await searchWiseAppContact(wiseAppAccountId, wiseAppToken, formattedPhone);

              // Corrigir estrutura de dados (descoberta: searchData é array direto)
              const contacts = Array.isArray(searchData) ? searchData : (searchData?.payload || []);

              if (contacts.length > 0) {
                const contact = contacts[0];
                
                // Buscar labels existentes primeiro
                const existingTagsResponse = await fetch(createApiUrl(`wiseapp/${companyId}/contacts/${contact.id}/labels`), {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'wiseapp-token': wiseAppToken,
                    'wiseapp-account-id': wiseAppAccountId
                  }
                });

                let existingTags: string[] = [];
                if (existingTagsResponse.ok) {
                  const existingTagsData = await existingTagsResponse.json();
                  existingTags = existingTagsData.payload || [];
                }

                // Criar array com todas as tags (existentes + nova)
                const allTags = [...existingTags];
                if (!allTags.some(tag => tag.toLowerCase() === tagData.nome.toLowerCase())) {
                  allTags.push(tagData.nome);
                }

                // Enviar array completo
                const tagResponse = await fetch(createApiUrl(`wiseapp/${companyId}/contacts/${contact.id}/labels`), {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'wiseapp-token': wiseAppToken,
                    'wiseapp-account-id': wiseAppAccountId
                  },
                  body: JSON.stringify({ labels: allTags })
                });
                
                if (!tagResponse.ok) {
                  // Verificar se é erro de timeout (408) ou outros problemas de rede
                  if (tagResponse.status === 408) {
                    console.warn(`[BULK] Timeout ao aplicar tag para ${motorista.nome_motorista}, continuando...`);
                    // Não falhar a operação em massa por timeout de um item
                    continue;
                  }
                  throw new Error(`Erro ao aplicar tag: ${tagResponse.status}`);
                }

                syncSuccessCount++;
                console.log(`[BULK] ✅ Tag "${tagData.nome}" aplicada ao contato ${motorista.nome_motorista} no WiseApp`);
              } else {
                console.log(`[BULK] ❌ Nenhum contato encontrado no WiseApp para ${motorista.nome_motorista} (${formattedPhone})`);
              }
            } catch (searchError) {
              console.error(`BULK DEBUG: Erro na busca do contato:`, searchError);
            }
          }
          } catch (contactError) {
            console.warn(`Erro ao processar motorista ${motoristaId}:`, contactError);
          } finally {
            // Atualizar progresso
            processedCount++;
            const currentProgress = Math.round((processedCount / total) * 100);
            setProgress(currentProgress);
            setProcessedItems(processedCount);
            
            // Calcular tempo estimado restante usando variável local
            if (processedCount > 0) {
              const elapsed = Date.now() - startedAt;
              const avgTimePerItem = elapsed / processedCount;
              const remainingItems = total - processedCount;
              const estimatedMs = avgTimePerItem * remainingItems;
              setEstimatedTimeLeft(Math.ceil(estimatedMs / 1000)); // em segundos
            }
          }
        }
      }

      if (syncSuccessCount > 0) {
        toast.success(`Marcador "${tagData.nome}" aplicado a ${syncSuccessCount} contato(s) no WiseApp!`);
      } else {
        toast('Marcador adicionado localmente. Nenhum contato correspondente foi encontrado no WiseApp.', {
          icon: 'ℹ️'
        });
      }
    } catch (error) {
      console.warn('Erro ao aplicar tags no WiseApp (não crítico):', error);
      toast('Marcador adicionado localmente. Falha ao sincronizar com WiseApp.', {
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

    // Validar limite máximo de 150 seleções apenas para status e client
    if ((actionType === 'status' || actionType === 'client') && selectedItems.size > 150) {
      toast.error(`Você pode selecionar no máximo 150 itens por vez para ${actionType === 'status' ? 'atualização de status' : 'atualização de cliente'}. Atualmente você tem ${selectedItems.size} itens selecionados.`);
      return;
    }

    if (actionType === 'status' && !selectedStatus) {
      toast.error('Selecione um status');
      return;
    }

    if (actionType === 'tags' && !selectedTag) {
      toast.error('Selecione um marcador');
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
          toast.error('Marcador não encontrado');
          return;
        }

        // Verificar quantas associações já existem para esta tag
        const { count, error: countError } = await supabase
          .from('associacao_tags')
          .select('*', { count: 'exact', head: true })
          .eq('tag_id', tagId);

        if (countError) throw countError;

        const currentCount = count || 0;
        // Se a tag não tem limite, usar 150 como padrão
        const tagLimit = tag.limite_max || 150;
        let availableSlots = tagLimit - currentCount;

        // Se já atingiu o máximo, avisar e sair
        if (availableSlots <= 0) {
          toast.error(`Limite máximo de ${tagLimit} associados já atingido para o marcador "${tag.nome}"`);
          return;
        }

        let addedCount = 0;
        let alreadyHasCount = 0;
        let limitReached = false;
        const motoristasComNovaTag: number[] = [];

        for (const motoristaId of itemIds) {
          // Se já atingimos o limite disponível, parar
          if (addedCount >= availableSlots) {
            limitReached = true;
            break;
          }

          // Verificar se a associação já existe (ignorar erros RLS)
          let existingAssociation = null;
          let shouldCreateAssociation = true;

          try {
            const result = await supabase
              .from('associacao_tags')
              .select('id')
              .eq('motorista_id', motoristaId)
              .eq('tag_id', tagId)
              .single();
            existingAssociation = result.data;
          } catch (error: any) {
            // Ignorar erros de RLS (406) e continuar
            if (error.code === 'PGRST301' || error.status === 406) {
              console.warn(`RLS blocked duplicate check for motorista ${motoristaId}, proceeding with creation`);
            } else if (error.code === 'PGRST116') {
              // Nenhum registro encontrado - OK para criar
              console.log(`No existing association found for motorista ${motoristaId}`);
            } else {
              throw error;
            }
          }

          // Se não existe (ou RLS bloqueou verificação), tentar criar
          if (!existingAssociation) {
            try {
              const { error } = await supabase
                .from('associacao_tags')
                .insert({
                  motorista_id: motoristaId,
                  tag_id: tagId
                });

              if (error) {
                // Ignorar erros de RLS ou duplicata
                if (error.code === 'PGRST301' || error.code === '23505') {
                  console.warn(`Supabase association blocked for motorista ${motoristaId}, but WiseApp will work`);
                  alreadyHasCount++;
                  shouldCreateAssociation = false;
                } else {
                  throw error;
                }
              }

              if (shouldCreateAssociation && !error) {
                addedCount++;
                motoristasComNovaTag.push(motoristaId); // Coletar para sincronização
              }
            } catch (insertError: any) {
              if (insertError.code === 'PGRST301' || insertError.status === 406 || insertError.code === '23505') {
                console.warn(`Insert blocked by RLS for motorista ${motoristaId}`);
                alreadyHasCount++;
              } else {
                throw insertError;
              }
            }
          } else {
            alreadyHasCount++;
          }
        }

        const tagName = tag.nome;

        // Aplicar marcador aos contatos no WiseApp após adicionar marcadores localmente
        if (motoristasComNovaTag.length > 0) {
          await applyTagToWiseAppContacts(tag, motoristasComNovaTag);
        }

        // Mensagens de resultado
        if (limitReached && tag.limite_max) {
          toast.success(`Marcador "${tagName}" adicionado a ${addedCount} motorista${addedCount !== 1 ? 's' : ''}. Limite de ${tag.limite_max} associações atingido - restante não foi processado.`);
        } else if (addedCount > 0) {
          toast.success(`Marcador "${tagName}" adicionado a ${addedCount} item${addedCount !== 1 ? 's' : ''}${alreadyHasCount > 0 ? ` (${alreadyHasCount} já possuíam o marcador)` : ''}`);
        } else if (alreadyHasCount > 0) {
          toast(`Todos os ${itemIds.length} item${itemIds.length !== 1 ? 's' : ''} selecionado${itemIds.length !== 1 ? 's' : ''} já possuem o marcador "${tagName}"`, {
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
                Adicionar Marcador em Massa
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
            (actionType === 'status' || actionType === 'client') && selectedItems.size > 150 
              ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' 
              : 'bg-blue-50 dark:bg-blue-900/20'
          }`}>
            <p className={`text-sm ${
              (actionType === 'status' || actionType === 'client') && selectedItems.size > 150 
                ? 'text-red-700 dark:text-red-300' 
                : 'text-blue-800 dark:text-blue-200'
            }`}>
              Esta ação irá {actionType === 'tags' ? 'adicionar marcadores aos' : 'atualizar'} <strong>{actionType === 'tags' && selectedTag ? availableTagSlots : selectedItems.size}</strong> item{(actionType === 'tags' && selectedTag ? availableTagSlots : selectedItems.size) !== 1 ? 's' : ''} selecionado{(actionType === 'tags' && selectedTag ? availableTagSlots : selectedItems.size) !== 1 ? 's' : ''}.
              {(actionType === 'status' || actionType === 'client') && selectedItems.size > 150 && (
                <span className="block mt-2 font-medium">
                  ⚠️ Limite máximo é de 150 itens por operação
                </span>
              )}
              {actionType === 'tags' && (
                <span className="block mt-2 text-xs text-gray-600 dark:text-gray-400">
                  {selectedTag ? (
                    availableTagSlots === 0 ? (
                      '⚠️ Este marcador já atingiu seu limite máximo'
                    ) : availableTagSlots < selectedItems.size ? (
                      `⚠️ Apenas ${availableTagSlots} itens receberão o marcador devido ao limite configurado`
                    ) : (
                      '✅ Todos os itens selecionados receberão o marcador'
                    )
                  ) : (
                    '💡 Selecione um marcador para ver quantos itens receberão a tag'
                  )}
                </span>
              )}
            </p>
          </div>

          {/* Barra de Progresso */}
          {submitting && actionType === 'tags' && totalItems > 0 && (
            <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-blue-900 dark:text-blue-100">
                  Processando marcadores...
                </span>
                <span className="text-blue-700 dark:text-blue-300">
                  {processedItems} / {totalItems}
                </span>
              </div>
              
              {/* Barra de progresso */}
              <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 transition-all duration-300 ease-out flex items-center justify-end pr-2"
                  style={{ width: `${progress}%` }}
                >
                  <span className="text-xs font-bold text-white drop-shadow-sm">
                    {progress}%
                  </span>
                </div>
              </div>
              
              {/* Tempo estimado */}
              <div className="flex justify-between items-center text-xs text-blue-700 dark:text-blue-300">
                <span>
                  {estimatedTimeLeft !== null && estimatedTimeLeft > 0 ? (
                    <>
                      ⏱️ Tempo estimado: {estimatedTimeLeft < 60 
                        ? `${estimatedTimeLeft}s` 
                        : `${Math.floor(estimatedTimeLeft / 60)}min ${estimatedTimeLeft % 60}s`
                      }
                    </>
                  ) : (
                    '⏱️ Calculando tempo restante...'
                  )}
                </span>
                <span className="font-medium">
                  {progress === 100 ? '✅ Concluído!' : '🔄 Processando...'}
                </span>
              </div>
            </div>
          )}

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
                <option value="">Selecione um marcador</option>
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
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <p>Limite máximo: {selectedTagData.limite_max} associados</p>
                        <p className="mt-1">
                          <span className={availableTagSlots > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                            {availableTagSlots} slots disponíveis
                          </span>
                        </p>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <p>Limite padrão: 150 associados</p>
                        <p className="mt-1">
                          <span className="text-green-600 dark:text-green-400">
                            {availableTagSlots} slots disponíveis
                          </span>
                        </p>
                      </div>
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
                ((actionType === 'status' || actionType === 'client') && selectedItems.size > 150) || (actionType === 'tags' && selectedTag && availableTagSlots === 0)
                  ? 'bg-gray-400 dark:bg-gray-600' 
                  : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 dark:hover:bg-blue-500'
              }`}
              disabled={submitting || ((actionType === 'status' || actionType === 'client') && selectedItems.size > 150) || (actionType === 'status' && !selectedStatus) || (actionType === 'tags' && (!selectedTag || availableTagSlots === 0))}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Atualizando...
                </>
              ) : ((actionType === 'status' || actionType === 'client') && selectedItems.size > 150) ? (
                'Excede limite (150)'
              ) : (actionType === 'tags' && selectedTag && availableTagSlots === 0) ? (
                'Limite atingido'
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