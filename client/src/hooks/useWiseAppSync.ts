import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { wiseAppService } from '@/lib/directApiService';
import { useAuth } from '@/context/AuthContext';

interface SyncResult {
  success: boolean;
  contactId?: number;
  error?: string;
}

interface BulkSyncResult {
  totalProcessed: number;
  successful: number;
  failed: number;
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
  const { companyId } = useAuth();

  // Individual motorista sync mutation
  const syncMotoristaMutation = useMutation({
    mutationFn: async (motoristaId: number) => {
      if (!companyId) throw new Error('Company ID not found');
      return wiseAppService.syncMotorista(motoristaId, companyId);
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

  // Bulk sync mutation (implementação simplificada - sync individual para todos)
  const bulkSyncMutation = useMutation({
    mutationFn: async () => {
      // Implementação simplificada - pode ser expandida depois
      throw new Error('Bulk sync não implementado ainda via Supabase direto');
    },
    onSuccess: (data) => {
      const result = data.data as BulkSyncResult;
      
      if (result.successful > 0) {
        toast.success(
          `Sincronização concluída!\n✓ ${result.successful} contatos sincronizados\n${result.failed > 0 ? `✗ ${result.failed} falharam` : ''}`
        );
      }

      if (result.failed > 0) {
        console.warn('Erros na sincronização:', result.errors);
        
        // Show detailed errors for failed syncs
        result.errors.slice(0, 3).forEach(error => {
          toast.error(`${error.nome}: ${error.error}`, { duration: 5000 });
        });
        
        if (result.errors.length > 3) {
          toast.error(`E mais ${result.errors.length - 3} erros...`);
        }
      }

      // Invalidate motoristas queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/motoristas'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro na sincronização em lote: ${error.message}`);
    }
  });

  // Config validation mutation
  const validateConfigMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Company ID not found');
      return wiseAppService.validateConfig(companyId);
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