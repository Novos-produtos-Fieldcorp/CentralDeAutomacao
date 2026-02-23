import React, { useState, useEffect } from 'react';
import { X, Loader2, Users, Building2, Tag, Clock, RefreshCw, CheckCircle2, TrendingUp } from 'lucide-react';
import { useCompanyData } from '../hooks/useCompanyData';
import toast from 'react-hot-toast';
import type { Cliente } from '../types/database';
import { supabase } from '../lib/supabase';
import { useCurrentAccount } from '../hooks/useCurrentAccount';
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
  const { companyId } = useCurrentAccount();
  // IMPORTANT: Use accountId from WiseAppAccess (associated with authenticated email)
  // instead of AuthContext (which may use accountId from URL)
  const { token: wiseAppToken, accountId } = useWiseAppAccess();
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

  const applyTagToWiseAppContacts = async (tagData: any, motoristaIds: number[]) => {
    if (!accountId || !wiseAppToken) {
      console.log('Token WiseApp ou dados não disponíveis para sincronização');
      return;
    }

    const total = motoristaIds.length;
    const startedAt = Date.now();
    setTotalItems(total);
    setProcessedItems(0);
    setProgress(0);
    setStartTime(startedAt);

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

      const { data: motoristasData } = await supabase
        .from('motorista')
        .select('motorista_id, telefone, nome')
        .in('motorista_id', motoristaIds);

      const motoristasMap = new Map<number, { telefone: string; nome: string }>();
      (motoristasData || []).forEach(m => {
        if (m.telefone) motoristasMap.set(m.motorista_id, { telefone: m.telefone, nome: m.nome });
      });

      const missingIds = motoristaIds.filter(id => !motoristasMap.has(id));
      if (missingIds.length > 0) {
        const { data: agregadosData } = await supabase
          .from('agregado')
          .select('agregado_id, telefone, nome')
          .in('agregado_id', missingIds);
        (agregadosData || []).forEach(a => {
          if (a.telefone) motoristasMap.set(a.agregado_id, { telefone: a.telefone, nome: a.nome });
        });
      }

      console.log(`[BULK] Dados carregados: ${motoristasMap.size} motoristas com telefone de ${motoristaIds.length} total`);

      const CONCURRENCY = 5;
      let processedCount = 0;

      const updateProgress = () => {
        processedCount++;
        const currentProgress = Math.round((processedCount / total) * 100);
        setProgress(currentProgress);
        setProcessedItems(processedCount);

        const elapsed = Date.now() - startedAt;
        const avgTimePerItem = elapsed / processedCount;
        const remainingItems = total - processedCount;
        setEstimatedTimeLeft(Math.ceil((avgTimePerItem * remainingItems) / 1000));
      };

      const processMotorista = async (motoristaId: number) => {
        const motorista = motoristasMap.get(motoristaId);
        if (!motorista?.telefone) {
          updateProgress();
          return;
        }

        const phoneStr = String(motorista.telefone).replace(/^\+55/, '');

        try {
          const searchData = await searchWiseAppContact(accountId, wiseAppToken, phoneStr, companyId ?? 2);
          const contacts = Array.isArray(searchData) ? searchData : (searchData?.payload || []);

          if (contacts.length > 0) {
            const contact = contacts[0];
            const tagResponse = await fetch(createApiUrl(`wiseapp/${accountId}/contacts/${contact.id}/labels`), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                'wiseapp-token': wiseAppToken,
                'wiseapp-account-id': accountId
              },
              body: JSON.stringify({ tagName: tagData.nome })
            });

            if (tagResponse.ok) {
              syncSuccessCount++;
              console.log(`[BULK] Tag "${tagData.nome}" aplicada ao contato ${motorista.nome} no WiseApp`);
            } else if (tagResponse.status === 408) {
              console.warn(`[BULK] Timeout ao aplicar tag para ${motorista.nome}, continuando...`);
            }
          } else {
            console.log(`[BULK] Nenhum contato encontrado no WiseApp para ${motorista.nome} (${phoneStr})`);
          }
        } catch (error) {
          console.warn(`Erro ao processar motorista ${motoristaId}:`, error);
        } finally {
          updateProgress();
        }
      };

      const queue = [...motoristaIds];
      const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        while (queue.length > 0) {
          const id = queue.shift()!;
          await processMotorista(id);
        }
      });
      await Promise.all(workers);

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

        const { data: existingAssociations } = await supabase
          .from('associacao_tags')
          .select('motorista_id')
          .eq('tag_id', tagId)
          .in('motorista_id', itemIds);

        const existingMotoristaIds = new Set((existingAssociations || []).map(a => a.motorista_id));
        const newMotoristaIds = itemIds.filter(id => !existingMotoristaIds.has(id));
        alreadyHasCount = existingMotoristaIds.size;

        const idsToInsert = newMotoristaIds.slice(0, availableSlots);
        limitReached = newMotoristaIds.length > availableSlots;

        if (idsToInsert.length > 0) {
          const records = idsToInsert.map(motoristaId => ({
            motorista_id: motoristaId,
            tag_id: tagId
          }));

          for (let i = 0; i < records.length; i += 100) {
            const chunk = records.slice(i, i + 100);
            const { error } = await supabase.from('associacao_tags').insert(chunk);
            if (error && error.code !== '23505') throw error;
          }

          addedCount = idsToInsert.length;
          motoristasComNovaTag.push(...idsToInsert);
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
            <div className="space-y-4 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-xl border border-blue-100 dark:border-blue-900/50 shadow-sm">
              {/* Header com status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {progress === 100 ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 animate-in zoom-in duration-300" />
                  ) : (
                    <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                  )}
                  <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                    {progress === 100 ? 'Processamento concluído' : 'Processando marcadores'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    {processedItems} / {totalItems}
                  </span>
                </div>
              </div>
              
              {/* Barra de progresso moderna */}
              <div className="relative" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${processedItems} de ${totalItems} itens processados`}>
                <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 dark:from-blue-400 dark:via-blue-500 dark:to-indigo-500 transition-all duration-500 ease-out rounded-full relative"
                    style={{ width: `${progress}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                  </div>
                </div>
                {progress > 0 && (
                  <div 
                    className="absolute -top-1 px-2 py-0.5 bg-blue-600 dark:bg-blue-500 text-white text-xs font-bold rounded shadow-lg transition-all duration-500 ease-out whitespace-nowrap"
                    style={{ 
                      left: `${progress}%`,
                      transform: `translateX(${progress < 10 ? '0%' : progress > 90 ? '-100%' : '-50%'})`
                    }}
                  >
                    {progress}%
                  </div>
                )}
              </div>
              
              {/* Tempo estimado com ícone */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {estimatedTimeLeft !== null && estimatedTimeLeft > 0 ? (
                      <span className="font-medium">
                        {estimatedTimeLeft < 60 
                          ? `${estimatedTimeLeft}s restantes` 
                          : `${Math.floor(estimatedTimeLeft / 60)}min ${estimatedTimeLeft % 60}s restantes`
                        }
                      </span>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-500">Calculando...</span>
                    )}
                  </span>
                </div>
                {progress === 100 && (
                  <span className="text-green-600 dark:text-green-400 font-semibold animate-in fade-in slide-in-from-right duration-300">
                    Finalizado
                  </span>
                )}
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