import React from 'react';
import { MessageSquare, Users, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useWiseAppSync } from '../hooks/useWiseAppSync';

interface WiseAppSyncButtonProps {
  motoristaId?: number;
  variant?: 'individual' | 'bulk';
  size?: 'sm' | 'default' | 'lg';
  showLabel?: boolean;
}

export function WiseAppSyncButton({ 
  motoristaId, 
  variant = 'individual',
  size = 'default',
  showLabel = true
}: WiseAppSyncButtonProps) {
  const { 
    syncMotorista, 
    syncAllMotoristas, 
    isSyncing, 
    isBulkSyncing 
  } = useWiseAppSync();

  const handleSync = async () => {
    if (variant === 'individual' && motoristaId) {
      await syncMotorista(motoristaId);
    } else if (variant === 'bulk') {
      await syncAllMotoristas();
    }
  };

  const isLoading = variant === 'individual' ? isSyncing : isBulkSyncing;
  
  const buttonText = variant === 'individual' 
    ? 'Sincronizar WiseApp' 
    : 'Sincronizar Todos';

  const icon = variant === 'individual' ? MessageSquare : Users;
  const Icon = icon;

  const buttonClass = size === 'sm' 
    ? 'px-2 py-1.5 text-xs' 
    : size === 'lg' 
      ? 'px-6 py-3 text-base'
      : 'px-4 py-2 text-sm';

  return (
    <button
      onClick={handleSync}
      disabled={isLoading || (variant === 'individual' && !motoristaId)}
      className={`inline-flex items-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${buttonClass}`}
      title={variant === 'individual' 
        ? 'Sincronizar este motorista com os contatos do WiseApp'
        : 'Sincronizar todos os motoristas ativos com o WiseApp'
      }
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      {showLabel && (
        <span className="hidden sm:inline">
          {isLoading 
            ? (variant === 'individual' ? 'Sincronizando...' : 'Sincronizando...') 
            : buttonText
          }
        </span>
      )}
    </button>
  );
}

interface WiseAppSyncStatusProps {
  motoristaId: number;
  lastSyncAt?: string;
  syncStatus?: 'success' | 'failed' | 'pending' | null;
}

export function WiseAppSyncStatus({ 
  motoristaId, 
  lastSyncAt, 
  syncStatus 
}: WiseAppSyncStatusProps) {
  if (!syncStatus) return null;

  const statusConfig = {
    success: {
      icon: CheckCircle,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      label: 'Sincronizado'
    },
    failed: {
      icon: XCircle,
      color: 'text-red-600 dark:text-red-400', 
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      label: 'Falha na sincronização'
    },
    pending: {
      icon: Loader2,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      label: 'Aguardando sincronização'
    }
  };

  const config = statusConfig[syncStatus];
  const Icon = config.icon;

  return (
    <div 
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${config.bgColor}`}
      title={`Status da sincronização WiseApp${lastSyncAt ? `\nÚltima sincronização: ${new Date(lastSyncAt).toLocaleString('pt-BR')}` : ''}`}
    >
      <Icon 
        className={`h-3 w-3 ${config.color} ${syncStatus === 'pending' ? 'animate-spin' : ''}`} 
      />
      <span className={config.color}>{config.label}</span>
    </div>
  );
}

interface WiseAppBulkSyncPanelProps {
  className?: string;
}

export function WiseAppBulkSyncPanel({ className }: WiseAppBulkSyncPanelProps) {
  const { 
    syncAllMotoristas, 
    validateWiseAppConfig, 
    isBulkSyncing, 
    isValidating, 
    configValid 
  } = useWiseAppSync();

  return (
    <div className={`border rounded-lg p-4 space-y-4 ${className}`}>
      <div>
        <h3 className="text-lg font-semibold">Sincronização WiseApp</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Sincronize os contatos de motoristas e agregados com o WiseApp
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={validateWiseAppConfig}
          disabled={isValidating}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isValidating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className={`h-4 w-4 ${
              configValid === true ? 'text-green-600' : 
              configValid === false ? 'text-red-600' : 
              'text-gray-600'
            }`} />
          )}
          {isValidating ? 'Validando...' : 'Validar Configuração'}
        </button>

        <button
          onClick={syncAllMotoristas}
          disabled={isBulkSyncing || configValid === false}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isBulkSyncing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Users className="h-4 w-4" />
          )}
          {isBulkSyncing ? 'Sincronizando...' : 'Sincronizar Todos'}
        </button>
      </div>

      {configValid === false && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
          ⚠️ Configuração do WiseApp inválida. Verifique as credenciais.
        </div>
      )}

      {configValid === true && (
        <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
          ✓ Configuração do WiseApp válida e pronta para uso.
        </div>
      )}
    </div>
  );
}