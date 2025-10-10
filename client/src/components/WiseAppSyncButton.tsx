import React from 'react';
import { MessageSquare, Users, Loader2, CheckCircle, XCircle, Key } from 'lucide-react';
import { useWiseAppSync } from '../hooks/useWiseAppSync';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

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
    configureTestToken,
    isSyncing, 
    isBulkSyncing 
  } = useWiseAppSync();
  
  const { accountId, companyId } = useAuth();

  // Função para capturar e salvar token do localStorage
  const captureAndSaveToken = async () => {
    try {
      console.log(`[captureAndSaveToken] Tentando capturar token para company_id: ${companyId}, account_id: ${accountId}`);
      
      // Tentar várias formas de encontrar o token no localStorage
      const possibleKeys = [
        'wiseapp_token_cache',
        'authToken',
        'access_token',
        'wiseapp_token',
        'token'
      ];
      
      let foundToken = null;
      let foundKey = null;
      
      for (const key of possibleKeys) {
        const stored = localStorage.getItem(key);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed.token && typeof parsed.token === 'string') {
              foundToken = parsed.token;
              foundKey = key;
              console.log(`[captureAndSaveToken] Token encontrado na chave: ${key}`);
              break;
            }
          } catch {
            // Se não for JSON, pode ser um token direto
            if (typeof stored === 'string' && stored.length > 10) {
              foundToken = stored;
              foundKey = key;
              console.log(`[captureAndSaveToken] Token direto encontrado na chave: ${key}`);
              break;
            }
          }
        }
      }
      
      if (!foundToken) {
        console.log('[captureAndSaveToken] Nenhum token encontrado no localStorage');
        
        // Listar todas as chaves do localStorage para debug
        const allKeys = Object.keys(localStorage);
        console.log('[captureAndSaveToken] Chaves disponíveis no localStorage:', allKeys);
        return false;
      }
      
      if (!companyId || !accountId) {
        console.error('[captureAndSaveToken] company_id ou account_id não definidos:', { companyId, accountId });
        return false;
      }
      
      console.log(`[captureAndSaveToken] Salvando token no banco (key: ${foundKey}, token length: ${foundToken.length})`);
      
      // Salvar token no banco de dados
      const tokenData = {
        company_id: companyId,
        access_token_wiseapp: foundToken,
        nome: 'Token Automático Capturado',
        email: 'auto@sistema.com',
        id_conta_wiseapp: accountId
      };
      
      console.log('[captureAndSaveToken] Dados a serem salvos:', {
        ...tokenData,
        access_token_wiseapp: `${foundToken.substring(0, 10)}...`
      });
      
      const { data, error } = await supabase
        .from('wiseapp_acesso')
        .upsert(tokenData, {
          onConflict: 'company_id'
        })
        .select();
      
      if (error) {
        console.error('[captureAndSaveToken] Erro ao salvar token:', error);
        return false;
      }
      
      console.log('[captureAndSaveToken] ✅ Token salvo com sucesso!', data);
      return true;
      
    } catch (error) {
      console.error('[captureAndSaveToken] Erro inesperado:', error);
      return false;
    }
  };

  const handleSync = async () => {
    console.log(`[handleSync] Iniciando sync ${variant} ${motoristaId ? `para motorista ${motoristaId}` : ''}`);
    
    // Primeiro, tenta capturar e salvar o token automaticamente
    const tokenSaved = await captureAndSaveToken();
    
    if (tokenSaved) {
      console.log('[handleSync] Token capturado e salvo, prosseguindo com sincronização');
    } else {
      console.warn('[handleSync] Não foi possível capturar token, tentando sincronização mesmo assim');
    }
    
    // Depois executa a sincronização
    try {
      if (variant === 'individual' && motoristaId) {
        await syncMotorista(motoristaId);
      } else if (variant === 'bulk') {
        await syncAllMotoristas();
      }
    } catch (error) {
      console.error('[handleSync] Erro durante sincronização:', error);
    }
  };

  const isLoading = variant === 'individual' ? isSyncing : isBulkSyncing;
  
  const buttonText = variant === 'individual' 
    ? 'Sincronizar Contato' 
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
        ? 'Sincronizar contato e foto do WhatsApp deste motorista com o WiseApp'
        : 'Sincronizar contatos e fotos do WhatsApp de todos os motoristas ativos com o WiseApp'
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

  // Botão temporário para configurar token de teste
  const TestTokenButton = () => (
    <button
      onClick={configureTestToken}
      className="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded text-xs"
      title="Configurar token de teste"
    >
      🔧 Token
    </button>
  );

  return (
    <div className="flex items-center gap-2">
      {button}
      <TestTokenButton />
    </div>
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
      title={`Status da sincronização de contato${lastSyncAt ? `\nÚltima sincronização: ${new Date(lastSyncAt).toLocaleString('pt-BR')}` : ''}`}
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
  onTagsSync?: () => void; // Callback para quando tags forem sincronizadas
}

export function WiseAppBulkSyncPanel({ className, onTagsSync }: WiseAppBulkSyncPanelProps) {
  const { 
    syncAllMotoristas, 
    isBulkSyncing
  } = useWiseAppSync();

  return (
    <div className={`fixed top-4 right-4 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 max-w-xs ${className}`}>
      <div className="mb-2">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white">Sync Contatos</h4>
      </div>

      <button
        onClick={async () => {
          await syncAllMotoristas();
          if (onTagsSync) {
            onTagsSync(); // Chamar callback para carregar tags após sync
          }
        }}
        disabled={isBulkSyncing}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full justify-center"
        title="Sincronizar contatos e fotos do WhatsApp de motoristas e agregados com o WiseApp"
      >
        {isBulkSyncing ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Users className="h-3 w-3" />
        )}
        {isBulkSyncing ? 'Sincronizando...' : 'Sincronizar Todos'}
      </button>
    </div>
  );
}