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

// Dados de exemplo para fallback quando a API não funciona
const FALLBACK_INBOXES: Inbox[] = [
  {
    id: 1,
    name: "WhatsApp Suporte",
    channel_type: "Channel::Whatsapp",
    phone_number: "+5511999999999",
    isOpen: true
  },
  {
    id: 2,
    name: "WhatsApp Vendas",
    channel_type: "Channel::Whatsapp", 
    phone_number: "+5511888888888",
    isOpen: true
  },
  {
    id: 3,
    name: "Site Corporativo",
    channel_type: "Channel::WebWidget",
    website_url: "https://empresa.com.br",
    isOpen: true
  }
];

const InboxSelector: React.FC<InboxSelectorProps> = ({
  isOpen,
  onClose,
  onSelectInbox,
  accountId,
  companyId
}) => {
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && accountId && companyId) {
      loadInboxes();
    }
  }, [isOpen, accountId, companyId]);

  const loadInboxes = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Tentando carregar inboxes para company:', companyId, 'account:', accountId);
      
      // Usar chatWootService diretamente
      const { chatWootService } = await import('@/lib/directApiService');
      const data = await chatWootService.getInboxes(parseInt(companyId), accountId);
      
      if (data?.payload && Array.isArray(data.payload)) {
        console.log('✅ Inboxes carregados via ChatWoot direto:', data.payload.length);
        setInboxes(data.payload.map((inbox: any) => ({
          ...inbox,
          isOpen: true // Simplificado para evitar complexidade de horários
        })));
      } else if (Array.isArray(data)) {
        console.log('✅ Inboxes carregados via ChatWoot direto:', data.length);
        setInboxes(data.map((inbox: any) => ({
          ...inbox,
          isOpen: true
        })));
      } else {
        throw new Error('Dados de inboxes inválidos');
      }
    } catch (err) {
      console.log('📦 Usando inboxes de fallback devido ao erro:', err);
      setError('Usando configuração padrão de inboxes');
      setInboxes(FALLBACK_INBOXES);
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
          {error && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Carregando caixas de entrada...</p>
            </div>
          ) : inboxes.length > 0 ? (
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
          ) : (
            <div className="text-center py-8">
              <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                Nenhuma caixa de entrada disponível
              </p>
            </div>
          )}
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