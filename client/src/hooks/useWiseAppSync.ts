import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
// Removed direct API service - now using secure backend routes
import { useAuth } from '@/context/AuthContext';
import { useWiseAppAccess } from '@/context/WiseAppAccessContext';

interface SyncResult {
  success: boolean;
  contactId?: number;
  error?: string;
}

interface BulkSyncResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  created: number;
  photoUpdated: number;
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
      
      const response = await fetch(`/api/wiseapp/sync-motorista/${motoristaId}`, {
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

  // Bulk sync mutation using secure backend - EXATAMENTE IGUAL AO SINCRONIZAR TAGS (USANDO HEADERS)
  const bulkSyncMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Company ID not found');
      
      // EXATAMENTE como o sincronizar tags - usar headers
      if (!wiseAppToken) throw new Error('Configure um token WiseApp válido antes de sincronizar contatos');
      if (!wiseAppCompanyId) throw new Error('Account ID WiseApp não encontrado');
      
      const response = await fetch('/api/wiseapp/sync-all-motoristas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'wiseapp-token': wiseAppToken,          // EXATAMENTE como o sincronizar tags
          'wiseapp-account-id': wiseAppCompanyId.toString()  // EXATAMENTE como o sincronizar tags
        },
        body: JSON.stringify({
          companyId: companyId
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Bulk sync failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      const result = data.data as BulkSyncResult;
      
      // Create summary message with new fields
      let message = `Sincronização concluída! (${result.totalProcessed} processados)\n`;
      
      if (result.successful > 0) {
        message += `✓ ${result.successful} já existentes sincronizados\n`;
      }
      
      if (result.created > 0) {
        message += `🆕 ${result.created} contatos criados no WiseApp\n`;
      }
      
      if (result.photoUpdated > 0) {
        message += `📸 ${result.photoUpdated} fotos atualizadas\n`;
      }
      
      if (result.failed > 0) {
        message += `✗ ${result.failed} falharam`;
      }
      
      // Show success toast if any operation was successful
      if (result.successful > 0 || result.created > 0 || result.photoUpdated > 0) {
        toast.success(message.trim());
      }

      if (result.failed > 0) {
        console.warn('Erros na sincronização:', result.errors);
        
        // Check if all or most errors are due to WiseApp service being unavailable
        const serviceUnavailableErrors = result.errors.filter(error => 
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
          result.errors.slice(0, 3).forEach(error => {
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