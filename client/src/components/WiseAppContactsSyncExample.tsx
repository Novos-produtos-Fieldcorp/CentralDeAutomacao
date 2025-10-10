import React from 'react';
import { WiseAppContactsSyncButton, WiseAppContactsSyncStatus, WiseAppContactsBulkSyncPanel } from './WiseAppContactsSyncButton';

// Exemplo de uso do componente de sincronização de contatos
export function WiseAppContactsSyncExample() {
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        Sincronização de Contatos com WiseApp
      </h2>
      
      {/* Exemplo de botão individual */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Sincronização Individual
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Sincroniza um contato específico com o WiseApp
        </p>
        <WiseAppContactsSyncButton 
          contatoId={123} 
          variant="individual" 
          size="default" 
          showLabel={true}
        />
      </div>

      {/* Exemplo de botão em lote */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Sincronização em Lote
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Sincroniza todos os contatos ativos com o WiseApp
        </p>
        <WiseAppContactsSyncButton 
          variant="bulk" 
          size="lg" 
          showLabel={true}
        />
      </div>

      {/* Exemplo de status de sincronização */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Status de Sincronização
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Mostra o status da última sincronização
        </p>
        <div className="flex gap-4">
          <WiseAppContactsSyncStatus 
            contatoId={123} 
            syncStatus="success" 
            lastSyncAt="2024-01-15T10:30:00Z"
          />
          <WiseAppContactsSyncStatus 
            contatoId={124} 
            syncStatus="failed" 
            lastSyncAt="2024-01-15T10:25:00Z"
          />
          <WiseAppContactsSyncStatus 
            contatoId={125} 
            syncStatus="pending" 
          />
        </div>
      </div>

      {/* Exemplo de painel de sincronização em lote */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Painel de Sincronização
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Painel flutuante para sincronização em lote
        </p>
        <WiseAppContactsBulkSyncPanel 
          onTagsSync={() => console.log('Tags sincronizadas!')}
        />
      </div>

      {/* Informações sobre a lógica de token */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          Como funciona a sincronização:
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• Busca o token WiseApp da tabela <code>wiseapp_acesso</code></li>
          <li>• Valida se o token existe e está válido</li>
          <li>• Busca o account ID da empresa na tabela <code>company</code></li>
          <li>• Para cada contato ativo com telefone:</li>
          <li>  - Busca se já existe no WiseApp</li>
          <li>  - Se existe, atualiza a foto se necessário</li>
          <li>  - Se não existe, cria um novo contato</li>
          <li>• Usa o header <code>api_access_token</code> nas chamadas para WiseApp</li>
        </ul>
      </div>
    </div>
  );
}
