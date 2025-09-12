import React, { useState } from 'react';
import { RefreshCw, Tag, Users, AlertCircle, CheckCircle, X, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { useCompanyData } from '@/hooks/useCompanyData';
import { API_BASE_URL } from '@/lib/api-config';
import { queryClient } from '@/lib/queryClient';

interface BulkSyncResult {
  success: boolean;
  summary: {
    totalContacts: number;
    processedContacts: number;
    totalLabels: number;
    successfulTags: number;
    failedTags: number;
    newTagsCreated: number;
  };
  errors?: string[];
  syncedTags?: string[];
}

interface BulkContactTagsSyncProps {
  onSyncComplete?: (result: BulkSyncResult) => void;
  className?: string;
}

export function BulkContactTagsSync({ onSyncComplete, className = '' }: BulkContactTagsSyncProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [syncResult, setSyncResult] = useState<BulkSyncResult | null>(null);
  const [progress, setProgress] = useState<string>('');
  
  const { accountId } = useAuth();
  const { companyId } = useCompanyData();

  const startBulkSync = async () => {
    if (!companyId || !accountId) {
      toast.error('Dados da empresa ou conta não encontrados');
      return;
    }

    setIsSyncing(true);
    setShowModal(true);
    setProgress('Iniciando sincronização...');
    setSyncResult(null);

    try {
      setProgress('Conectando com WiseApp...');
      
      const response = await fetch(`${API_BASE_URL}/wiseapp/bulk-sync-contact-tags/${companyId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: accountId
        })
      });

      const result: BulkSyncResult = await response.json();

      if (!response.ok) {
        throw new Error(result.errors?.[0] || 'Erro na sincronização');
      }

      setSyncResult(result);
      
      if (result.success) {
        const { summary } = result;
        const successMessage = `Sincronização concluída! ${summary.successfulTags} tags sincronizadas, ${summary.newTagsCreated} novas tags criadas.`;
        toast.success(successMessage, { duration: 6000 });
        
        // Invalidar queries relacionadas para atualizar a UI
        await queryClient.invalidateQueries({ queryKey: ['local-tags', companyId] });
        await queryClient.invalidateQueries({ queryKey: ['motoristas-tags'] });
        
        onSyncComplete?.(result);
      } else {
        toast.error('Sincronização concluída com erros. Verifique os detalhes.', { duration: 5000 });
      }

    } catch (error) {
      console.error('Erro na sincronização bulk:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro na sincronização: ${errorMessage}`, { duration: 5000 });
      
      setSyncResult({
        success: false,
        summary: {
          totalContacts: 0,
          processedContacts: 0,
          totalLabels: 0,
          successfulTags: 0,
          failedTags: 0,
          newTagsCreated: 0
        },
        errors: [errorMessage]
      });
    } finally {
      setIsSyncing(false);
      setProgress('');
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSyncResult(null);
    setProgress('');
  };

  return (
    <>
      {/* Botão principal */}
      <button
        onClick={startBulkSync}
        disabled={isSyncing}
        className={`bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        data-testid="bulk-contact-tags-sync-btn"
      >
        <Tag className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
        {isSyncing ? 'Sincronizando...' : 'Sincronizar Tags dos Contatos'}
      </button>

      {/* Modal de progresso e resultado */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" data-testid="bulk-sync-modal">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-3">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                  <Tag className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                Sincronização de Tags de Contatos
              </h3>
              {!isSyncing && (
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                  data-testid="close-modal-btn"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="p-6">

            {/* Indicador de progresso */}
            {isSyncing && (
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                  <span className="text-gray-900 dark:text-white font-medium">
                    Sincronizando...
                  </span>
                </div>
                {progress && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 ml-8">
                    {progress}
                  </p>
                )}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-3">
                  <div className="bg-blue-600 h-2 rounded-full animate-pulse w-1/3"></div>
                </div>
              </div>
            )}

            {/* Resultados */}
            {syncResult && (
              <div className="space-y-4">
                {/* Status geral */}
                <div className={`flex items-center gap-3 p-4 rounded-lg ${
                  syncResult.success 
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' 
                    : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                }`}>
                  {syncResult.success ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                  <span className="font-medium">
                    {syncResult.success ? 'Sincronização Concluída com Sucesso!' : 'Sincronização Concluída com Erros'}
                  </span>
                </div>

                {/* Estatísticas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg min-h-[80px] flex flex-col justify-between">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Contatos</span>
                    </div>
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {syncResult.summary.totalContacts}
                    </span>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg min-h-[80px] flex flex-col justify-between">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Tags Sincronizadas</span>
                    </div>
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {syncResult.summary.successfulTags}
                    </span>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg min-h-[80px] flex flex-col justify-between">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-purple-600 flex-shrink-0" />
                      <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Novas Tags</span>
                    </div>
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {syncResult.summary.newTagsCreated}
                    </span>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg min-h-[80px] flex flex-col justify-between">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="w-4 h-4 text-orange-600 flex-shrink-0" />
                      <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Labels WiseApp</span>
                    </div>
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {syncResult.summary.totalLabels}
                    </span>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg min-h-[80px] flex flex-col justify-between">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                      <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Processados</span>
                    </div>
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {syncResult.summary.processedContacts}
                    </span>
                  </div>

                  {syncResult.summary.failedTags > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg min-h-[80px] flex flex-col justify-between">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        <span className="text-sm text-red-600 dark:text-red-400 font-medium">Falhas</span>
                      </div>
                      <span className="text-2xl font-bold text-red-800 dark:text-red-200">
                        {syncResult.summary.failedTags}
                      </span>
                    </div>
                  )}
                </div>

                {/* Tags sincronizadas (amostra) */}
                {syncResult.syncedTags && syncResult.syncedTags.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <Tag className="w-4 h-4 text-green-600" />
                      Tags Sincronizadas (últimas {Math.min(10, syncResult.syncedTags.length)})
                    </h4>
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600">
                      <div className="space-y-2">
                        {syncResult.syncedTags.slice(0, 10).map((tag, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 py-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                            <span>{tag}</span>
                          </div>
                        ))}
                        {syncResult.syncedTags.length > 10 && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 italic pt-2 border-t border-gray-300 dark:border-gray-600">
                            ... e mais {syncResult.syncedTags.length - 10} tags
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Erros */}
                {syncResult.errors && syncResult.errors.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-semibold text-red-800 dark:text-red-200 mb-3 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      Erros Encontrados
                    </h4>
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg max-h-40 overflow-y-auto border border-red-200 dark:border-red-800">
                      <div className="space-y-2">
                        {syncResult.errors.map((error, index) => (
                          <div key={index} className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300 py-1">
                            <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 mt-1"></div>
                            <span>{error}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Botão de fechar */}
                <div className="flex justify-end pt-6 border-t border-gray-200 dark:border-gray-700 mt-6">
                  <button
                    onClick={closeModal}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
                    data-testid="close-results-btn"
                  >
                    <X className="w-4 h-4" />
                    Fechar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </>
  );
}

export default BulkContactTagsSync;