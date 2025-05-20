import React from 'react';
import { AlertTriangle, ExternalLink, RefreshCw, HelpCircle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

const Unauthorized = () => {
  const [searchParams] = useSearchParams();
  const accountId = searchParams.get('account_id');

  const handleRefresh = () => {
    // Just refresh the current window
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg animate-pulse">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Erro de Conexão com WiseApp
            </h1>
          </div>
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            Não foi possível validar o ID da conta WiseApp
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Não foi possível estabelecer uma conexão válida com o WiseApp. Verifique:
            </p>
            
            <ul className="space-y-3 list-disc list-inside text-gray-600 dark:text-gray-400">
              <li>O parâmetro accountId não está presente na URL</li>
              <li>O formato do accountId está incorreto</li>
              <li>O ID da conta não está cadastrado no sistema</li>
              <li>Você não tem permissão de acesso</li>
            </ul>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <HelpCircle className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Detalhes Técnicos
              </h2>
            </div>
            <div className="text-xs font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600">
              <p className="text-gray-600 dark:text-gray-400">account_id:</p>
              <p className="text-gray-800 dark:text-gray-200 break-all">{accountId || 'Não fornecido'}</p>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
            <h2 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
              O que fazer?
            </h2>
            <div className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
              <p>1. Verifique se o parâmetro account_id está presente na URL</p>
              <p>2. Verifique se o account_id está correto</p>
              <p>3. Caso o problema persista, contate o suporte</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              onClick={handleRefresh}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              <RefreshCw className="w-4 h-4" />
              Tentar Novamente
            </button>
            
            <a
              href="https://wiseapp360.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              <ExternalLink className="w-4 h-4" />
              Acessar WiseApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;