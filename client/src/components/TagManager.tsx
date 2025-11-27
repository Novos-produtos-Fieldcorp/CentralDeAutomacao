import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { useWiseAppAccess } from "@/context/WiseAppAccessContext";
import { getWiseAppLabels } from "@/lib/directApiService";
import { supabase } from "@/lib/supabase";
import { TagAdministration } from './TagAdministration';

interface TagManagerProps {
  companyId: number;
}

export function TagManager({ companyId }: TagManagerProps) {
  const [isSyncingWiseApp, setIsSyncingWiseApp] = useState(false);
  const queryClient = useQueryClient();
  // IMPORTANT: Use accountId from WiseAppAccess (associated with authenticated email)
  // instead of AuthContext (which may use accountId from URL)
  const { token: wiseAppToken, accountId } = useWiseAppAccess();

  // Query para buscar tags do banco local filtradas pelo accountId WiseApp
  const { data: localTags, isLoading: isLoadingLocal, error: localError } = useQuery({
    queryKey: ['local-tags', companyId, accountId],
    queryFn: async () => {
      console.log('[TagManager] Buscando tags locais para companyId:', companyId, 'accountId:', accountId);
      
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
            console.warn('[TagManager] Coluna id_conta_wiseapp não existe ainda, usando fallback');
            // Fallback: query without id_conta_wiseapp filter
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('tag')
              .select('*')
              .eq('company_id', companyId)
              .order('nome');
            
            if (fallbackError) throw fallbackError;
            console.log('[TagManager] Tags encontradas (fallback):', fallbackData?.length || 0);
            return fallbackData || [];
          }
          throw error;
        }
        
        console.log('[TagManager] Tags encontradas:', data?.length || 0);
        return data || [];
      } catch (error) {
        console.error('[TagManager] Erro ao buscar tags:', error);
        throw error;
      }
    },
    enabled: !!companyId && accountId !== undefined,
  });

  // Query para buscar tags do WiseApp (apenas quando necessário)
  const { data: tagsResponse, isLoading: isLoadingWiseApp, error: wiseAppError } = useQuery({
    queryKey: ['wiseapp-tags', accountId],
    queryFn: async () => {
      if (!accountId || !wiseAppToken) {
        throw new Error('AccountId ou token não disponível');
      }
      // Fetching WiseApp tags for account
      return getWiseAppLabels(accountId, wiseAppToken);
    },
    enabled: false, // Não carregar automaticamente
    retry: 3,
    retryDelay: 1000,
  });

  const wiseAppTags = tagsResponse?.payload || tagsResponse || [];
  const tags = localTags || [];
  const isLoading = isLoadingLocal;

  const syncWiseAppTags = async () => {
    if (isSyncingWiseApp) return;

    setIsSyncingWiseApp(true);
    
    // Mostrar notificação de início com progresso
    const syncToast = toast.loading('Conectando com WiseApp...');
    
    try {
      if (!accountId) {
        toast.error('ID da conta não encontrado', { id: syncToast });
        return;
      }

      // Verificar se temos token WiseApp
      if (!wiseAppToken) {
        toast.error('Token WiseApp não encontrado. Configure o token primeiro.', { id: syncToast });
        return;
      }

      // Atualizar progresso
      toast.loading('Buscando marcadores do WiseApp...', { id: syncToast });

      // Buscar tags do WiseApp usando função robusta
      // Synchronizing tags with WiseApp
      const wiseAppLabelsResponse = await getWiseAppLabels(accountId || '', wiseAppToken || '', companyId);
      const wiseAppTagsData = wiseAppLabelsResponse.payload || wiseAppLabelsResponse || [];
      // Tags found from WiseApp
      // WiseApp labels retrieved

      if (!wiseAppTagsData || wiseAppTagsData.length === 0) {
        toast('Nenhum marcador encontrado no WiseApp.', {
          id: syncToast,
          icon: 'ℹ️',
          duration: 4000
        });
        return;
      }

      // Atualizar progresso
      toast.loading(`Processando ${wiseAppTagsData.length} marcadores...`, { id: syncToast });

      // Salvar tags no Supabase
      // Saving tags to Supabase

      // Primeiro, buscar tags existentes para evitar duplicatas
      // Try with id_conta_wiseapp filter, fallback if column doesn't exist
      let existingTags: { nome: string }[] = [];
      let columnExists = true;
      
      try {
        let existingQuery = supabase
          .from('tag')
          .select('nome')
          .eq('company_id', companyId);
        
        // Filter by id_conta_wiseapp to ensure proper isolation
        if (accountId) {
          existingQuery = existingQuery.or(`id_conta_wiseapp.eq.${accountId},id_conta_wiseapp.is.null`);
        }
        
        const { data, error: fetchError } = await existingQuery;

        if (fetchError) {
          // Check if error is about missing column
          if (fetchError.code === '42703' && fetchError.message?.includes('id_conta_wiseapp')) {
            console.warn('[TagManager] Coluna id_conta_wiseapp não existe, usando fallback');
            columnExists = false;
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('tag')
              .select('nome')
              .eq('company_id', companyId);
            
            if (fallbackError) throw fallbackError;
            existingTags = fallbackData || [];
          } else {
            throw fetchError;
          }
        } else {
          existingTags = data || [];
        }
      } catch (error) {
        console.error('Erro ao buscar tags existentes:', error);
        throw error;
      }

      const existingTagNames = new Set(existingTags.map(tag => tag.nome.toLowerCase()));

      // Preparar tags para inserção (apenas as que não existem)
      const tagsToInsert = wiseAppTagsData
        .filter((tag: any) => !existingTagNames.has((tag.name || tag.title || 'Tag').toLowerCase()))
        .map((tag: any) => {
          const baseTag: Record<string, any> = {
            nome: tag.name || tag.title || 'Tag',
            cor: tag.color || '#3B82F6',
            company_id: companyId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          // Only add id_conta_wiseapp if column exists
          if (columnExists) {
            baseTag.id_conta_wiseapp = accountId || null;
          }
          return baseTag;
        });

      if (tagsToInsert.length > 0) {
        // Atualizar progresso
        toast.loading(`Salvando ${tagsToInsert.length} novos marcadores...`, { id: syncToast });
        
        let insertResult = await supabase
          .from('tag')
          .insert(tagsToInsert)
          .select();

        // If column doesn't exist on insert, retry without it
        if (insertResult.error?.code === '42703' && insertResult.error.message?.includes('id_conta_wiseapp')) {
          console.warn('[TagManager] Retrying insert without id_conta_wiseapp');
          const tagsWithoutAccountId = tagsToInsert.map((tag: Record<string, any>) => {
            const { id_conta_wiseapp, ...rest } = tag;
            return rest;
          });
          insertResult = await supabase
            .from('tag')
            .insert(tagsWithoutAccountId)
            .select();
        }

        if (insertResult.error) {
          console.error('Erro ao inserir tags no Supabase:', insertResult.error);
          throw insertResult.error;
        }

        toast.success(`${tagsToInsert.length} marcadores sincronizados e salvos!`, {
          id: syncToast,
          duration: 5000
        });
      } else {
        toast.success('Todos os marcadores já estão atualizados.', {
          id: syncToast,
          duration: 4000
        });
      }

      // Invalidar queries para atualizar UI (inclui accountId na key)
      await queryClient.invalidateQueries({ queryKey: ['local-tags', companyId, accountId] });
      await queryClient.invalidateQueries({ queryKey: ['local-tags', companyId] });
      await queryClient.invalidateQueries({ queryKey: ['wiseapp-tags'] });

    } catch (error) {
      console.error('Erro ao sincronizar tags do WiseApp:', error);

      // Enhanced fallback messaging with detailed error analysis
      let errorMessage = 'Erro desconhecido ao sincronizar marcadores do WiseApp';
      
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('failed to fetch') || message.includes('network') || message.includes('timeout')) {
          errorMessage = '🔄 Problema de conectividade detectado. O sistema tentou múltiplas vezes mas não conseguiu conectar com o WiseApp. Tente novamente em alguns minutos.';
        } else if (message.includes('401') || message.includes('unauthorized')) {
          errorMessage = `🔐 Falha na autenticação WiseApp (Account ID: ${accountId}). Verifique se as credenciais estão corretas e atualizadas.`;
        } else if (message.includes('403') || message.includes('forbidden')) {
          errorMessage = '⛔ Acesso negado pelo WiseApp. Verifique as permissões da sua conta.';
        } else if (message.includes('404') || message.includes('not found')) {
          errorMessage = '❓ Conta ou recurso não encontrado no WiseApp. Verifique se o Account ID está correto.';
        } else if (message.includes('500') || message.includes('internal server')) {
          errorMessage = '⚠️ Servidor WiseApp temporariamente indisponível. Tente novamente mais tarde.';
        } else if (message.includes('rate limit') || message.includes('too many requests')) {
          errorMessage = '⏱️ Muitas requisições ao WiseApp. Aguarde um momento e tente novamente.';
        } else {
          errorMessage = `❌ ${error.message}`;
        }
      }

      toast.error(errorMessage, {
        id: syncToast,
        duration: 6000
      });

      // Still show local tags even if WiseApp fails
      // System will continue with local tags only
      
      // Mostrar informação adicional se há tags locais disponíveis
      if (tags.length > 0) {
        setTimeout(() => {
          toast(`ℹ️ Continuando com ${tags.length} marcadores locais disponíveis.`, {
            duration: 4000
          });
        }, 1000);
      }
    } finally {
      setIsSyncingWiseApp(false);
    }
  };

  // Aguardar autenticação WiseApp
  if (accountId === undefined || accountId === null) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400">Aguardando autenticação WiseApp...</p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
          Por favor, faça login com seu e-mail para continuar.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-center py-8 text-gray-600 dark:text-gray-400">Carregando tags...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Administração de Tags */}
      <TagAdministration companyId={companyId} />

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Marcadores</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={syncWiseAppTags}
              disabled={isSyncingWiseApp}
              className="bg-green-600 dark:bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-700 dark:hover:bg-green-600 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              title={isSyncingWiseApp ? 'Sincronização em andamento...' : 'Clique para sincronizar marcadores do WiseApp'}
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingWiseApp ? 'animate-spin' : ''}`} />
              {isSyncingWiseApp ? 'Sincronizando...' : 'Sincronizar com WiseApp'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}