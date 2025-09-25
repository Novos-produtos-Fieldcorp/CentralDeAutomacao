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
  const { companyId } = useAuth();

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
        const errorData = await response.json();
        // Extract the appropriate error message
        const errorMessage = errorData.message || errorData.error || 'Sync failed';
        throw new Error(errorMessage);
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
      console.error('Individual sync error:', error);
      
      if (error.message.includes('Token WiseApp não configurado') || 
          error.message.includes('Configure um token WiseApp válido')) {
        toast.error(
          'Token WiseApp não configurado. Configure o token de acesso nas configurações da empresa.',
          { duration: 6000 }
        );
      } else {
        toast.error(`Erro na sincronização: ${error.message}`, { duration: 5000 });
      }
    }
  });

  // Get WiseApp access context values (same logic as tags)
  const { token: wiseAppToken, accountId } = useWiseAppAccess();

  // Bulk sync mutation using secure backend
  const bulkSyncMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Company ID not found');
      
      if (!wiseAppToken) {
        throw new Error('NEED_WISEAPP_CONFIG');
      }
      
      if (!accountId) {
        throw new Error('NEED_ACCOUNT_CONFIG');
      }
      
      console.log('🔄 Initiating WiseApp sync:', { 
        companyId, 
        hasToken: !!wiseAppToken,
        hasAccountId: !!accountId 
      });
      
      const response = await fetch('/api/wiseapp/sync-all-motoristas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'wiseapp-token': wiseAppToken,
          'wiseapp-account-id': accountId
        },
        body: JSON.stringify({
          companyId: companyId
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        // Extract the appropriate error message
        const errorMessage = errorData.message || errorData.error || 'Bulk sync failed';
        throw new Error(errorMessage);
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
      console.error('Bulk sync error:', error);
      
      if (error.message === 'NEED_WISEAPP_CONFIG' || error.message === 'NEED_ACCOUNT_CONFIG') {
        // Auto-open WiseApp configuration modal
        const event = new CustomEvent('openWiseAppModal');
        window.dispatchEvent(event);
        return; // Don't show error toast since modal will handle it
      } else if (error.message.includes('Token WiseApp não configurado') || 
          error.message.includes('Configure um token WiseApp válido')) {
        toast.error(
          'Token WiseApp não configurado. Configure o token de acesso antes de sincronizar contatos.',
          { duration: 6000 }
        );
      } else if (error.message.includes('Account ID não configurado')) {
        toast.error(
          'Account ID do WiseApp não configurado. Verifique as configurações.',
          { duration: 6000 }
        );
      } else {
        toast.error(`Erro na sincronização: ${error.message}`, { duration: 5000 });
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