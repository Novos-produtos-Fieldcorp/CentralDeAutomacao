import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
// Removed direct API service - now using secure backend routes
import { useAuth } from '@/context/AuthContext';
import { useWiseAppAccess } from '@/context/WiseAppAccessContext';
import { createApiUrl, supabaseApiRequest } from '@/lib/api-config-supabase';

interface SyncResult {
  success: boolean;
  contactId?: number;
  error?: string;
}

interface BulkSyncResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  tagsImportadas?: number;
  tagsExportadas?: number;
  errors: Array<{ motorista_id: number; nome: string; error: string }>;
}

interface WiseAppSyncHookReturn {
  syncMotorista: (motoristaId: number) => Promise<void>;
  syncAllMotoristas: () => Promise<void>;
  validateWiseAppConfig: () => Promise<void>;
  isSyncing: boolean;
  isBulkSyncing: boolean;
  isValidating: boolean;
  configValid: boolean | null;
}

export function useWiseAppSync(): WiseAppSyncHookReturn {
  const [configValid, setConfigValid] = useState<boolean | null>(null);
  const queryClient = useQueryClient();
  const { companyId, accountId } = useAuth();
  const { token: wiseAppToken, companyId: wiseAppCompanyId } = useWiseAppAccess();

  // Individual motorista sync mutation using secure backend
  const syncMotoristaMutation = useMutation({
    mutationFn: async (motoristaId: number) => {
      if (!companyId) throw new Error('Company ID not found');
      
      const response = await fetch(createApiUrl(`wiseapp/sync-motorista/${motoristaId}`), {
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
        // Invalidate motoristas queries to refresh the data
        queryClient.invalidateQueries({ queryKey: ['/api/motoristas'] });
      } else {
        toast.error(data.message || 'Falha na sincronização');
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro na sincronização: ${error.message}`);
    }
  });


// Bulk sync mutation using Supabase Edge Function
const bulkSyncMutation = useMutation({
  mutationFn: async () => {
    if (!companyId) throw new Error('Company ID not found');
    const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obW94c3Z3anZvaG1xcWd4amhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NzI5MDUsImV4cCI6MjA1MjQ0ODkwNX0.AfDIRYUm98kZaYfi70ut0bzyvX995-Xz609Yp_seijQ';    
    // Chamar Supabase Edge Function diretamente
    const supabaseUrl = 'https://ohmoxsvwjvohmqqgxjhb.supabase.co';

    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    const requestUrl = `${supabaseUrl}/functions/v1/api/wiseapp/sync-all-motoristas`;
    const body = { companyId: companyId };

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Bulk sync failed');
    }
    
    return response.json();
  },
    onSuccess: (data) => {
      const result = data.data;
      
      // Calcular totais para notificação mais clara
      const totalProcessados = result.successful;
      const totalNaoProcessados = result.failed;
      const tagsImportadas = result.tagsImportadas || 0;
      const tagsExportadas = result.tagsExportadas || 0;
      
      // Notificação principal com foco em processados vs não processados
      if (totalProcessados > 0) {
        let successMessage = `✅ ${totalProcessados} contatos sincronizados com sucesso!`;
        
        // Detalhes adicionais se houver
        const detalhes = [];
        if (tagsImportadas > 0) {
          detalhes.push(`${tagsImportadas} tags importadas do WiseApp`);
        }
        if (tagsExportadas > 0) {
          detalhes.push(`${tagsExportadas} tags exportadas para o WiseApp`);
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
        toast('ℹ️ Nenhum motorista ativo encontrado para sincronizar');
      }

      if (result.failed > 0) {
        console.warn('Erros na sincronização:', result.errors);
        
        // Check if all or most errors are due to WiseApp service being unavailable
        const serviceUnavailableErrors = result.errors.filter((error: { motorista_id: number; nome: string; error: string }) => 
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
          result.errors.slice(0, 3).forEach((error: { motorista_id: number; nome: string; error: string }) => {
            toast.error(`${error.nome}: ${error.error}`, { duration: 5000 });
          });
          
          if (result.errors.length > 3) {
            toast.error(`E mais ${result.errors.length - 3} erros...`);
          }
        }
      }

      // Invalidate motoristas queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/motoristas'] });
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
      
      const response = await fetch(createApiUrl('wiseapp/validate-config'), {
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

  return {
    syncMotorista: async (motoristaId: number) => {
      await syncMotoristaMutation.mutateAsync(motoristaId);
    },
    syncAllMotoristas: async () => {
      await bulkSyncMutation.mutateAsync();
    },
    validateWiseAppConfig: async () => {
      await validateConfigMutation.mutateAsync();
    },
    isSyncing: syncMotoristaMutation.isPending,
    isBulkSyncing: bulkSyncMutation.isPending,
    isValidating: validateConfigMutation.isPending,
    configValid
  };
}

// Hook for automatic sync when creating/updating motoristas
export function useWiseAppAutoSync() {
  return {
    getSyncHeaders: (enableSync: boolean = true) => ({
      'x-sync-wiseapp': enableSync ? 'true' : 'false'
    })
  };
}