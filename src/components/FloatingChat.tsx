import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Minimize2, Maximize2, Phone, Loader2, AlertCircle, WifiOff, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import ChatwootClient from 'chat2one-sdk';
import toast from 'react-hot-toast';

interface FloatingChatProps {
  initialPhone?: string;
  initialName?: string;
}

type Contact = {
  id: number;
  name?: string;
  phone_number: string;
  thumbnail?: string;
  source_id?: string;
};

type Message = {
  id: number;
  content: string;
  created_at: string;
  message_type: 'incoming' | 'outgoing';
  sender?: {
    name?: string;
  };
};

type Conversation = {
  id: number;
  messages: Message[];
};

const MAX_RETRIES = 5;
const BASE_DELAY = 1000;

const FloatingChat: React.FC<FloatingChatProps> = ({
  initialPhone,
  initialName,
}) => {
  const [showChat, setShowChat] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [storageConversations, setStorageConversations] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<boolean>(false);
  const [networkError, setNetworkError] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchParams] = useSearchParams();
  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const [chatInstance, setChatInstance] = useState<any | null>(null);

  const checkNetworkConnectivity = () => {
    return navigator.onLine;
  };

  const validateApiConfig = (
    accountId: string,
    token: string
  ) => {
    if (!accountId) {
      throw new Error('ID da conta é obrigatório. Verifique os parâmetros da URL.');
    }
    if (!token) {
      throw new Error('Token de acesso à API é obrigatório');
    }
  };

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setNetworkError(false);
      if (contact && activeConversation) {
        userInChat(contact.phone_number, contact.name);
      }
    };

    const handleOffline = () => {
      setNetworkError(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [contact, activeConversation]);

  useEffect(() => {
    if (messagesEndRef.current && showChat && !minimized) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeConversation?.messages, showChat, minimized]);

  useEffect(() => {
    if (showChat && !minimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showChat, minimized]);

  useEffect(() => {
    if (initialPhone) {
      userInChat(initialPhone, initialName);
    }
  }, [initialPhone, initialName]);

  const userInChat = async (phoneNumber: string, contactName?: string) => {
    try {
      setLoading(true);
      setError(null);
      setAuthError(false);
      setNetworkError(false);
      setShowChat(true);

      if (!checkNetworkConnectivity()) {
        setNetworkError(true);
        throw new Error('Sem conexão de rede disponível');
      }

      // Primeiro, verificar se temos o accountId nos parâmetros da URL
      let accountId = searchParams.get('account_id');
      
      // Se não estiver na URL, tentar pegar do localStorage
      if (!accountId) {
        accountId = localStorage.getItem('account_id');
      }

      // Se ainda não tiver, lançar erro
      if (!accountId) {
        throw new Error('ID da conta é obrigatório. Verifique os parâmetros da URL ou configure o account_id no localStorage.');
      }

      // Remover espaços em branco e garantir que é uma string válida
      accountId = accountId.trim();
      if (!accountId) {
        throw new Error('ID da conta inválido. Verifique os parâmetros da URL ou configure o account_id no localStorage.');
      }

      // Verificar o token
      const apiKey = localStorage.getItem('wiseapp_token');
      if (!apiKey) {
        setAuthError(true);
        throw new Error('Token WiseApp não encontrado. Configure seu token primeiro.');
      }

      try {
        validateApiConfig(accountId, apiKey);
        
        const config = {
          basePath: 'https://chat.wiseapp360.com',
          with_credentials: false,
          credentials: 'omit' as const,
          token: apiKey,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 30000,
          validateStatus: (status: number) => status >= 200 && status < 500,
          maxRedirects: 5,
          maxContentLength: 50 * 1024 * 1024,
          responseType: 'json' as const
        };
        
        console.log('Iniciando cliente com:', { 
          accountId, 
          apiKey: apiKey.substring(0, 5) + '...',
          basePath: config.basePath
        });
        
        const chatClient = new ChatwootClient({ 
          config: {
            ...config,
            accountId: parseInt(accountId, 10) // Convert to number
          }
        });
        console.log('Cliente criado:', chatClient);
        
        setChatInstance(chatClient);

        const formattedNumber = formatPhoneNumber(phoneNumber);
        console.log('Número formatado:', formattedNumber);

        // Buscar contato existente
        console.log('Buscando contatos...');
        const contacts = await chatClient.contacts.list({
          q: formattedNumber,
          account_id: parseInt(accountId, 10) // Convert to number
        });
        console.log('Contatos encontrados:', contacts);

        let contactId;
        let contactData;

        if (contacts && contacts.length > 0) {
          contactData = contacts[0];
          contactId = contactData.id;
          console.log(`Found existing contact with ID: ${contactId}`);
        } else {
          console.log(`No contact found, creating new contact with phone: ${formattedNumber}`);

          const newContact = await chatClient.contacts.create({
            name: contactName || formattedNumber,
            phone_number: formattedNumber,
            account_id: parseInt(accountId, 10) // Convert to number
          });

          contactData = newContact;
          contactId = contactData.id;
          console.log(`Created new contact with ID: ${contactId}`);
        }

        setContact({
          id: contactId,
          name: contactData.name || contactName || '',
          phone_number: formattedNumber,
          thumbnail: contactData.thumbnail_url || '',
          source_id: contactData.source_id
        });

        // Criar ou obter conversa
        console.log('Criando conversa...');
        const conversation = await chatClient.conversations.create({
          source_id: contactData.source_id,
          inbox_id: 1,
          account_id: parseInt(accountId, 10) // Convert to number
        });
        console.log('Conversa criada:', conversation);

        const conversationId = conversation.id;

        if (!conversationId) {
          throw new Error('Não foi possível obter ou criar uma conversa');
        }

        // Carregar mensagens
        console.log('Carregando mensagens...');
        const messages = await chatClient.messages.list(conversationId, {
          account_id: parseInt(accountId, 10) // Convert to number
        });
        console.log('Mensagens carregadas:', messages);

        setActiveConversation({
          id: conversationId,
          messages: messages.map((msg: any) => ({
            id: msg.id,
            content: msg.content,
            created_at: msg.created_at,
            message_type: msg.message_type,
            sender: msg.sender
          }))
        });

        setStorageConversations(prev => [
          ...prev,
          {
            user: {
              id: contactId,
              name: contactData.name || contactName || '',
              phone_number: formattedNumber,
            },
            conversationId: conversationId,
          },
        ]);
      } catch (error) {
        console.error('API call failed:', error);
        if (error instanceof Error) {
          console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
          });
          
          // Verificar se é um erro de rede
          if (error.message === 'Network Error') {
            setNetworkError(true);
            throw new Error('Erro de conexão com o servidor. Verifique sua conexão com a internet.');
          }
          
          // Verificar se é um erro de autenticação
          if (error.message.includes('401') || error.message.includes('403')) {
            setAuthError(true);
            throw new Error('Erro de autenticação. Verifique seu token.');
          }
        }
        throw error;
      }
    } catch (error) {
      console.error('Error in userInChat:', error);
      if (!checkNetworkConnectivity()) {
        setNetworkError(true);
      }
      setError(
        error instanceof Error ? error.message : 'Falha ao conectar ao serviço de chat'
      );
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneNumber = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');

    if (!digits.startsWith('55') && digits.length <= 11) {
      return `55${digits}`;
    }

    return digits;
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeConversation || !contact) return;

    try {
      setError(null);
      setAuthError(false);
      setNetworkError(false);

      if (!checkNetworkConnectivity()) {
        setNetworkError(true);
        throw new Error('Sem conexão de rede disponível');
      }

      const tempMessage: Message = {
        id: Date.now(),
        content: newMessage,
        created_at: new Date().toISOString(),
        message_type: 'outgoing',
      };

      setActiveConversation(prev => ({
        ...prev!,
        messages: [...prev!.messages, tempMessage],
      }));

      setNewMessage('');

      let accountId = searchParams.get('account_id')?.trim();

      if (!accountId) {
        accountId = localStorage.getItem('account_id');
      }

      if (!accountId) {
        throw new Error('ID da conta é obrigatório');
      }

      const apiKey = localStorage.getItem('wiseapp_token');

      if (!apiKey) {
        setAuthError(true);
        throw new Error('Token WiseApp não encontrado');
      }

      try {
        validateApiConfig(accountId, apiKey);
        
        if (chatInstance) {
          await chatInstance.messages.create(activeConversation.id, {
            content: newMessage,
            message_type: 'outgoing'
          });
        } else {
          const config = {
            basePath: 'https://chat.wiseapp360.com',
            with_credentials: true,
            credentials: 'include' as const,
            token: apiKey,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            }
          };
          
          const chatClient = new ChatwootClient({ 
            config: {
              ...config,
              accountId: parseInt(accountId, 10) // Convert to number
            }
          });
          setChatInstance(chatClient);
          
          await chatClient.messages.create(activeConversation.id, {
            content: newMessage,
            message_type: 'outgoing'
          });
        }
      
        setTimeout(async () => {
          try {
            const messages = await chatInstance?.messages.list(activeConversation.id);
            
            if (messages) {
              setActiveConversation(prev => ({
                ...prev!,
                messages: messages.map((msg: any) => ({
                  id: msg.id,
                  content: msg.content,
                  created_at: msg.created_at,
                  message_type: msg.message_type,
                  sender: msg.sender
                }))
              }));
            }
          } catch (error) {
            console.error('Error reloading messages:', error);
          }
        }, 1000);
      } catch (error) {
        console.error('Error sending message:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in sendMessage:', error);
      setError(
        error instanceof Error ? error.message : 'Falha ao enviar mensagem'
      );
    }
  };

  const toggleMinimize = () => {
    setMinimized(!minimized);
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return '';
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).userInChat = userInChat;
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).userInChat;
      }
    };
  }, [storageConversations]);

  if (!showChat) return null;

  if (authError) {
    return (
      <div className="fixed bottom-5 right-5 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 max-w-[300px] z-[9999]">
        <div className="flex items-center gap-2 text-red-500 mb-3">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">Erro de Autenticação</span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
          Não foi possível acessar o chat. Verifique se você está logado e tente novamente.
        </p>
        <button
          onClick={() => setShowChat(false)}
          className="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Fechar
        </button>
      </div>
    );
  }

  if (networkError) {
    return (
      <div className="fixed bottom-5 right-5 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 max-w-[300px] z-[9999]">
        <div className="flex items-center gap-2 text-yellow-500 mb-3">
          <WifiOff className="w-5 h-5" />
          <span className="font-medium">Erro de Rede</span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
          Não foi possível conectar ao serviço de chat. Verifique sua conexão com a internet e tente novamente.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setNetworkError(false);
              if (contact) {
                userInChat(contact.phone_number, contact.name);
              }
            }}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Tentar Novamente
          </button>
          <button
            onClick={() => setShowChat(false)}
            className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed z-[9999] transition-all duration-300 ${
        minimized
          ? 'bottom-5 right-5 w-auto h-auto'
          : 'bottom-5 right-5 w-[350px] h-[500px] md:w-[400px] md:h-[600px]'
      }`}
    >
      {minimized ? (
        <button
          onClick={toggleMinimize}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        >
          <Phone className="w-5 h-5" />
          <span>{contact?.name || contact?.phone_number || 'Chat'}</span>
          <Maximize2 className="w-4 h-4 ml-1" />
        </button>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                {contact?.thumbnail ? (
                  <img
                    src={contact.thumbnail}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-lg font-semibold text-gray-500 dark:text-gray-400">
                    {contact?.name?.[0] || contact?.phone_number?.[0] || '?'}
                  </div>
                )}
              </div>
              <div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {contact?.name || contact?.phone_number || 'Chat'}
                </div>
                {contact?.phone_number && !contact?.name && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {contact.phone_number}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMinimize}
                className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                aria-label="Minimize"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowChat(false)}
                className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-grow overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900">
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full text-red-500 dark:text-red-400 p-4 text-center">
                <p className="font-medium">Erro</p>
                <p className="text-sm mt-1">{error}</p>
                <button
                  onClick={() => {
                    if (contact) {
                      userInChat(contact.phone_number, contact.name);
                    }
                  }}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Tentar Novamente
                </button>
              </div>
            ) : activeConversation?.messages &&
              activeConversation.messages.length > 0 ? (
              activeConversation.messages.map((msg, i) => (
                <div
                  key={msg.id || i}
                  className={`mb-4 max-w-[80%] ${
                    msg.message_type === 'outgoing' ? 'ml-auto' : 'mr-auto'
                  }`}
                >
                  <div
                    className={`rounded-lg px-4 py-2 inline-block ${
                      msg.message_type === 'outgoing'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <div
                    className={`text-xs mt-1 ${
                      msg.message_type === 'outgoing'
                        ? 'text-right text-gray-500 dark:text-gray-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {formatTime(msg.created_at)}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <p>Nenhuma mensagem ainda</p>
                <p className="text-sm mt-1">
                  Envie uma mensagem para iniciar a conversa
                </p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="flex-grow px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FloatingChat;

export const initChat = (phoneNumber: string, contactName?: string) => {
  if (typeof window !== 'undefined' && (window as any).userInChat) {
    (window as any).userInChat(phoneNumber, contactName);
  } else {
    console.error('Chat function not available');
  }
}; 