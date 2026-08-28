import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useCurrentAccount } from '@/hooks/useCurrentAccount';
import { useWiseAppAccess } from '@/context/WiseAppAccessContext';

interface SyncResult {
  success: boolean;
  contatoId?: number;
  error?: string;
}

interface BulkSyncResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  created: number;
  photoUpdated: number;
  errors: Array<{ contato_id: number; nome: string; error: string }>;
}

interface BulkSyncProgress {
  processed: number;
  total: number;
}

interface WiseAppContactsSyncHookReturn {
  syncContato: (contatoId: number) => Promise<void>;
  syncAllContatos: () => Promise<void>;
  validateWiseAppConfig: () => Promise<void>;
  configureTestToken: () => Promise<void>;
  isSyncing: boolean;
  isBulkSyncing: boolean;
  isValidating: boolean;
  configValid: boolean | null;
  bulkSyncProgress: BulkSyncProgress | null;
}

export function useWiseAppContactsSync(): WiseAppContactsSyncHookReturn {
  const [configValid, setConfigValid] = useState<boolean | null>(null);
  const [bulkSyncProgress, setBulkSyncProgress] = useState<BulkSyncProgress | null>(null);
  const queryClient = useQueryClient();
  const { companyId } = useCurrentAccount();
  // IMPORTANT: Use accountId from WiseAppAccess (associated with authenticated email)
  // instead of AuthContext (which may use accountId from URL)
  const { token: wiseAppToken, companyId: wiseAppCompanyId, accountId } = useWiseAppAccess();

  // Individual contato sync mutation using secure backend
  const syncContatoMutation = useMutation({
    mutationFn: async (contatoId: number) => {
      if (!companyId) throw new Error('Company ID not found');
      
      const response = await fetch(`/api/wiseapp/sync-contato/${contatoId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          companyId: companyId
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Sync failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Contato sincronizado com o WiseApp com sucesso!');
        // Invalidate contatos queries to refresh the data
        queryClient.invalidateQueries({ queryKey: ['/api/contatos'] });
      } else {
        toast.error(data.message || 'Falha na sincronização');
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro na sincronização: ${error.message}`);
    }
  });

  // Bulk sync mutation using Supabase Edge Function (processamento em lotes)
  const bulkSyncMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Company ID not found');
      // Chamar Supabase Edge Function diretamente
      const supabaseUrl = 'https://jnwocajxsgkgiixwyxkl.supabase.co';
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const requestUrl = `${supabaseUrl}/functions/v1/api/wiseapp/sync-all-contacts`;

      const BATCH_SIZE = 25;

      // Acumula os resultados de todos os lotes
      const acc: BulkSyncResult = {
        totalProcessed: 0,
        successful: 0,
        failed: 0,
        created: 0,
        photoUpdated: 0,
        errors: []
      };

      let offset = 0;
      let total = 0;
      setBulkSyncProgress({ processed: 0, total: 0 });

      // Itera lote a lote até o backend indicar que não há mais contatos
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const response = await fetch(requestUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Accept': 'application/json'
          },
          body: JSON.stringify({ companyId, offset, limit: BATCH_SIZE })
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.message || error.error || 'Bulk sync failed');
        }

        const json = await response.json();
        const d = json.data ?? {};

        total = typeof d.total === 'number' ? d.total : total;
        acc.successful += d.successful || 0;
        acc.failed += d.failed || 0;
        acc.created += d.created || 0;
        acc.photoUpdated += d.photoUpdated || 0;
        if (Array.isArray(d.errors)) acc.errors.push(...d.errors);

        const processedSoFar = offset + (d.processedNow || 0);
        setBulkSyncProgress({
          processed: total ? Math.min(processedSoFar, total) : processedSoFar,
          total
        });

        if (!d.hasMore) break;
        offset += BATCH_SIZE;
      }

      acc.totalProcessed = total || acc.successful + acc.failed;
      return { data: acc };
    },
    onSettled: () => {
      // Mantém a barra visível só durante o processo
      setBulkSyncProgress(null);
    },
    onSuccess: (data) => {
      const result = data.data;
      
      // Calcular totais para notificação mais clara
      const totalProcessados = result.successful;
      const totalNaoProcessados = result.failed;
      const totalCriados = result.created || 0;
      const totalFotosAtualizadas = result.photoUpdated || 0;
      
      // Notificação principal com foco em processados vs não processados
      if (totalProcessados > 0) {
        let successMessage = `✅ ${totalProcessados} contatos sincronizados com sucesso!`;
        
        // Detalhes adicionais se houver
        const detalhes = [];
        if (totalCriados > 0) {
          detalhes.push(`${totalCriados} contatos criados no WiseApp`);
        }
        if (totalFotosAtualizadas > 0) {
          detalhes.push(`${totalFotosAtualizadas} fotos atualizadas`);
        }
        
        if (detalhes.length > 0) {
          successMessage += `\n${detalhes.join(', ')}`;
        }
        
        toast.success(successMessage, { duration: 4000 });
      }
      
      // Notificação separada para falhas, se houver
      if (totalNaoProcessados > 0) {
        toast.error(`❌ ${totalNaoProcessados} contatos não foram processados`, { duration: 4000 });
      }
      
      // Se nenhum contato foi processado
      if (result.totalProcessed === 0) {
        toast('ℹ️ Nenhum contato ativo encontrado para sincronizar');
      }

      if (result.failed > 0) {
        console.warn('Erros na sincronização:', result.errors);
        
        // Check if all or most errors are due to WiseApp service being unavailable
        const serviceUnavailableErrors = result.errors.filter((error: { contato_id: number; nome: string; error: string }) => 
          error.error.includes('temporariamente indisponível') ||
          error.error.includes('Erro interno do servidor WiseApp')
        );
        
        // If most errors are service unavailability (80% threshold)
        if (serviceUnavailableErrors.length >= result.errors.length * 0.8) {
          toast.error(
            `Serviço WiseApp está temporariamente indisponível. Tente novamente em alguns minutos.`, 
            { duration: 6000 }
          );
        } else {
          // Show detailed errors for individual contact failures
          result.errors.slice(0, 3).forEach((error: { contato_id: number; nome: string; error: string }) => {
            toast.error(`${error.nome}: ${error.error}`, { duration: 5000 });
          });
          
          if (result.errors.length > 3) {
            toast.error(`E mais ${result.errors.length - 3} erros...`);
          }
        }
      }

      // Invalidate contatos queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/contatos'] });
    },
    onError: (error: Error) => {
      if (error.message.includes('Token WiseApp não configurado')) {
        toast.error('Para usar a sincronização com WiseApp, configure primeiro o token de acesso nas configurações da empresa.');
      } else {
        toast.error(`Erro na sincronização em lote: ${error.message}`);
      }
    }
  });

  // Config validation mutation using secure backend
  const validateConfigMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Company ID not found');
      
      const response = await fetch('/api/wiseapp/validate-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          companyId: companyId
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Config validation failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setConfigValid(data.valid);
      
      if (data.valid) {
        toast.success('Configuração do WiseApp válida!');
      } else {
        toast.error(`Configuração inválida: ${data.error}`);
      }
    },
    onError: (error: Error) => {
      setConfigValid(false);
      toast.error(`Erro na validação: ${error.message}`);
    }
  });

  // Função para verificar token existente
  const configureTestToken = async () => {
    if (!companyId || !accountId) {
      toast.error('Company ID ou Account ID não encontrado');
      return;
    }

    try {
      console.log('🔍 Verificando token WiseApp...', { companyId, accountId });
      
      // Verificar se já existe token configurado
      const { data: existingToken, error: fetchError } = await supabase
        .from('wiseapp_acesso')
        .select('*')
        .eq('company_id', companyId)
        .limit(1);

      if (fetchError) {
        console.error('❌ Erro ao buscar token existente:', fetchError);
        toast.error('Erro ao verificar token existente');
        return;
      }

      console.log('📊 Resultado da busca:', { 
        found: existingToken?.length || 0, 
        data: existingToken 
      });

      if (existingToken && existingToken.length > 0) {
        const token = existingToken[0];
        console.log('✅ Token WiseApp encontrado:', {
          email: token.email,
          nome: token.nome,
          has_token: !!token.access_token_wiseapp,
          token_length: token.access_token_wiseapp?.length || 0,
          token_preview: token.access_token_wiseapp?.substring(0, 10) + '...'
        });
        
        if (token.access_token_wiseapp) {
          toast.success(`✅ Token WiseApp configurado para ${token.email}`);
        } else {
          toast.error(`❌ Token vazio para ${token.email}. Configure o token.`);
        }
      } else {
        console.log('❌ Nenhum token WiseApp encontrado para esta empresa');
        toast.error('❌ Nenhum token WiseApp configurado. Use o sistema de autenticação para configurar.');
      }
    } catch (error) {
      console.error('💥 Erro inesperado:', error);
      toast.error('Erro ao verificar token');
    }
  };

  return {
    syncContato: async (contatoId: number) => {
      await syncContatoMutation.mutateAsync(contatoId);
    },
    syncAllContatos: async () => {
      await bulkSyncMutation.mutateAsync();
    },
    validateWiseAppConfig: async () => {
      await validateConfigMutation.mutateAsync();
    },
    configureTestToken,
    isSyncing: syncContatoMutation.isPending,
    isBulkSyncing: bulkSyncMutation.isPending,
    isValidating: validateConfigMutation.isPending,
    configValid,
    bulkSyncProgress
  };
}

// Hook for automatic sync when creating/updating contatos
export function useWiseAppContactsAutoSync() {
  return {
    getSyncHeaders: (enableSync: boolean = true) => ({
      'x-sync-wiseapp': enableSync ? 'true' : 'false'
    })
  };
}
