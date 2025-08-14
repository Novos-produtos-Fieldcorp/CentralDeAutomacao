import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Clock, CheckCircle } from 'lucide-react';

interface Inbox {
  id: number;
  name: string;
  channel_type: string;
  phone_number?: string;
  website_url?: string;
  working_hours?: any[];
  isOpen?: boolean;
}

interface InboxSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectInbox: (inboxId: number) => void;
  accountId: string;
  companyId: string;
}

// Removed fallback inboxes - system now only uses real ChatWoot API data

const InboxSelector: React.FC<InboxSelectorProps> = ({
  isOpen,
  onClose,
  onSelectInbox,
  accountId,
  companyId
}) => {
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string>('');
  const [emailSubmitted, setEmailSubmitted] = useState<boolean>(false);

  const handleEmailSubmit = async () => {
    if (!email.trim()) {
      setError('Por favor, insira um email válido');
      return;
    }
    
    setEmailSubmitted(true);
    await loadInboxes(email.trim());
  };

  const loadInboxes = async (userEmail: string) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Tentando carregar inboxes para email:', userEmail, 'account:', accountId);
      
      // Usar nova API baseada em email
      const response = await fetch(`/api/chatwoot/inboxes-by-email?email=${encodeURIComponent(userEmail)}&account_id=${accountId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.payload && Array.isArray(data.payload)) {
          console.log('✅ Inboxes carregados da API:', data.payload.length);
          setInboxes(data.payload.map((inbox: any) => ({
            ...inbox,
            isOpen: true
          })));
        } else {
          throw new Error('Dados de inboxes inválidos');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error('Token de autenticação inválido ou expirado para este email');
        } else if (response.status === 404) {
          throw new Error('Token WiseApp não encontrado para este email');
        } else {
          throw new Error(errorData.error || `Erro na API: ${response.status}`);
        }
      }
    } catch (err: any) {
      console.error('Erro ao carregar inboxes:', err);
      setError(err.message || 'Erro ao carregar caixas de entrada');
      setInboxes([]);
    } finally {
      setLoading(false);
    }
  };

  const getChannelIcon = (channelType: string) => {
    if (channelType.includes('Whatsapp')) {
      return <MessageCircle className="h-5 w-5 text-green-500" />;
    }
    return <MessageCircle className="h-5 w-5 text-blue-500" />;
  };

  const getChannelLabel = (channelType: string) => {
    if (channelType.includes('Whatsapp')) return 'WhatsApp';
    if (channelType.includes('WebWidget')) return 'Website';
    if (channelType.includes('Api')) return 'API';
    return 'Chat';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Selecionar Caixa de Entrada
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          {!emailSubmitted ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email para autenticação
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Digite seu email..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleEmailSubmit();
                    }
                  }}
                />
              </div>
              <button
                onClick={handleEmailSubmit}
                disabled={!email.trim() || loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                {loading ? 'Carregando...' : 'Buscar Caixas de Entrada'}
              </button>
              {error && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Autenticado como: <span className="font-medium">{email}</span>
                </p>
                <button
                  onClick={() => {
                    setEmailSubmitted(false);
                    setEmail('');
                    setInboxes([]);
                    setError(null);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  Alterar email
                </button>
              </div>
              
              {error && (
                <div className={`mb-4 p-3 rounded-lg ${
                  error.includes('Token de autenticação') || error.includes('Token WiseApp não encontrado')
                    ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700' 
                    : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700'
                }`}>
                  <p className={`text-sm ${
                    error.includes('Token de autenticação') || error.includes('Token WiseApp não encontrado')
                      ? 'text-red-800 dark:text-red-200'
                      : 'text-yellow-800 dark:text-yellow-200'
                  }`}>
                    {error}
                  </p>
                </div>
              )}
            </>
          )}

          {emailSubmitted && loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Carregando caixas de entrada...</p>
            </div>
          ) : emailSubmitted && inboxes.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {inboxes.map((inbox) => (
                <button
                  key={inbox.id}
                  onClick={() => {
                    console.log('📮 Inbox selecionado:', inbox.name, 'ID:', inbox.id);
                    onSelectInbox(inbox.id);
                    onClose();
                  }}
                  className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getChannelIcon(inbox.channel_type)}
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {inbox.name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {getChannelLabel(inbox.channel_type)}
                          {inbox.phone_number && ` • ${inbox.phone_number}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      {inbox.isOpen ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Clock className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : emailSubmitted && inboxes.length === 0 && !loading ? (
            <div className="text-center py-8">
              <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                {error ? 'Não foi possível carregar as caixas de entrada' : 'Nenhuma caixa de entrada disponível'}
              </p>
              {error && (error.includes('Token de autenticação') || error.includes('Token WiseApp não encontrado')) && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Verifique se o email está cadastrado no sistema
                </p>
              )}
            </div>
          ) : null}
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Selecione uma caixa de entrada para enviar mensagens
          </p>
        </div>
      </div>
    </div>
  );
};

export default InboxSelector;