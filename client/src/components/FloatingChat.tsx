import React, { useState, useEffect, useRef } from 'react';
import {Send, Loader2, AlertCircle, WifiOff, X, Mic, Paperclip, Minus, Square, MessageSquare, File, ArrowLeft } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';

const baseURL = import.meta.env.VITE_CHAT_API_URL || '/api'; // Usar a URL do ambiente ou proxy local para evitar CORS

const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  }
});

// Adicionar interceptor para incluir o token em todas as requisições
apiClient.interceptors.request.use((config) => {
  // Usar API key das variáveis de ambiente primeiro
  const apiKey = import.meta.env.VITE_CHAT_API_KEY || localStorage.getItem('wiseapp_token');
  if (apiKey) {
    config.headers['api_access_token'] = apiKey;
    config.headers['Authorization'] = `Bearer ${apiKey}`;
  }
  return config;
});

// Utilize o apiClient para fazer requisições
export const getInboxes = (accountId: string) => {
  return apiClient.get(`/api/v1/accounts/${accountId}/inboxes?_t=${Date.now()}`);
};

// Função para limpar cache de inboxes
export const clearInboxCache = (accountId?: string) => {
  if (accountId) {
    localStorage.removeItem(`chat_inboxes_${accountId}`);
  } else {
    // Limpar todos os caches de inboxes
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('chat_inboxes_')) {
        localStorage.removeItem(key);
      }
    });
  }
};

// Função para salvar a foto do WhatsApp diretamente usando o ID do motorista
const saveWhatsAppPhotoFromFloatingChat = async (motoristaId: string, photoUrl: string) => {
  try {
    // Validar se temos dados válidos
    if (!motoristaId || !photoUrl) {
      console.log('❌ Dados inválidos para salvamento de foto');
      return;
    }

    // Verificar se a URL da foto é válida (não é placeholder)
    if (photoUrl.includes('placeholder') || photoUrl.includes('default') || photoUrl.length < 10) {
      console.log('❌ URL de foto inválida ou placeholder:', photoUrl);
      return;
    }

    console.log(`🎯 CAPTURA AUTOMÁTICA INICIADA - Motorista ID: ${motoristaId}, Foto: ${photoUrl}`);
    
    // Salvar a foto diretamente usando o ID do motorista
    const saveResponse = await fetch(`/api/motoristas/${motoristaId}/whatsapp-photo`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'account_id': '1'
      },
      body: JSON.stringify({ foto_whatsapp: photoUrl }),
    });
    
    if (saveResponse.ok) {
      console.log(`🎉 SUCESSO! Foto do WhatsApp capturada e salva para motorista ID: ${motoristaId}`);
      console.log(`📸 Nova foto no sistema: ${photoUrl}`);
      
      // Não precisamos recarregar a página - a atualização será automática via query invalidation
    } else {
      console.error('❌ Erro ao salvar foto no banco:', await saveResponse.text());
    }
  } catch (error) {
    console.error('❌ Erro no processo de captura automática:', error);
  }
};

interface FloatingChatProps {
  initialPhone?: string;
  initialName?: string;
  initialEmail?: string;
  motoristaId?: number;
  sourceType?: 'agregado' | 'contratado' | 'motorista';
  additionalInfo?: {
    name?: string;
    email?: string;
    [key: string]: any;
  };
}

type Contact = {
  id: number;
  name?: string;
  phone_number: string;
  thumbnail?: string;
  avatar_url?: string;
  source_id?: string;
  status?: 'online' | 'offline';
  availability_status?: 'online' | 'offline';
  last_seen_at?: string;
  email?: string;
  custom_attributes?: Record<string, any>;
  contact_inboxes?: Array<{
    source_id: string;
    inbox: {
      id: number;
      name: string;
      channel_type: string;
    };
  }>;
};

interface Message {
  id: number;
  content: string;
  created_at: string;
  message_type: 'outgoing' | 'incoming';
  content_type: 'text' | 'image' | 'file' | 'audio';
  status: 'sending' | 'sent' | 'delivered' | 'read';
  sender?: {
    type: 'agent_bot' | 'user';
    phone_number?: string;
    avatar_url?: string;
    thumbnail?: string;
    name?: string;
  };
}

interface Conversation {
  id: number;
  contact?: {
    id: number;
    name: string;
    phone_number: string;
    thumbnail?: string;
  };
  inbox_name?: string;
  status?: string;
  unread_count?: number;
  lastMessage?: {
    content: string;
    created_at: string;
  } | null;
  messages: Message[];
}

interface FileWithPreview {
  file: File;
  preview: string;
  type: 'image' | 'file';
}

const FloatingChat: React.FC<FloatingChatProps> = ({
  initialPhone,
  initialName,
  initialEmail,
  motoristaId,
  sourceType,
  additionalInfo,
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
  const [conversationId, setConversationId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [inboxes, setInboxes] = useState<any[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout>();
  const [showInboxSelector, setShowInboxSelector] = useState(false);
  const [availableInboxes, setAvailableInboxes] = useState<any[]>([]);
  const [selectedInboxId, setSelectedInboxId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [previousConversations, setPreviousConversations] = useState<any[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastMessageId, setLastMessageId] = useState<number | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout>();

  const accountId = searchParams.get('account_id') || localStorage.getItem('account_id');
  const apiKey = localStorage.getItem('wiseapp_token');

  // Usar o apiClient configurado acima

  const checkNetworkConnectivity = () => {
    return navigator.onLine;
  };

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const checkNetwork = () => {
      const isOnline = navigator.onLine;
      setNetworkError(!isOnline);
      if (!isOnline) {
        setError('Sem conexão de rede disponível');
      }
    };

    window.addEventListener('online', checkNetwork);
    window.addEventListener('offline', checkNetwork);

    checkNetwork();

    return () => {
      window.removeEventListener('online', checkNetwork);
      window.removeEventListener('offline', checkNetwork);
    };
  }, []);

  useEffect(() => {
    const loadSavedConversations = () => {
      try {
        const saved = localStorage.getItem('chat_conversations');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setStorageConversations(parsed);
          } else {
            localStorage.removeItem('chat_conversations');
          }
        }
      } catch (error) {
        console.error('Error loading saved conversations:', error);
        localStorage.removeItem('chat_conversations');
      }
    };

    loadSavedConversations();
  }, []);

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
    if (showChat && !minimized && !activeConversation && selectedInboxId && contact) {
      loadPreviousConversations();
    }
  }, [showChat, minimized, activeConversation, selectedInboxId, contact]);

  useEffect(() => {
    if (initialPhone) {
      userInChat(initialPhone, initialName);
    }
  }, [initialPhone, initialName]);

  useEffect(() => {
    // Load only visibility state from localStorage
    const loadSavedState = async () => {
      try {
        const savedShowChat = localStorage.getItem('chat_visible');
        const savedMinimized = localStorage.getItem('chat_minimized');
        
        if (savedShowChat) {
          setShowChat(savedShowChat === 'true');
        }
        
        if (savedMinimized) {
          setMinimized(savedMinimized === 'true');
        }
      } catch (error) {
        console.error('Error loading saved state:', error);
      }
    };

    loadSavedState();
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (activeConversation?.id) {
      // Iniciar polling para novas mensagens
      pollingIntervalRef.current = setInterval(async () => {
        try {
          const response = await apiClient.get(`/api/v1/accounts/${accountId}/conversations/${activeConversation.id}/messages?_t=${Date.now()}`, {
            params: {
              page: 1,
              per_page: 20
            }
          });

          if (response.data?.payload) {
            const newMessages = response.data.payload.map((msg: any) => ({
              id: msg.id,
              content: msg.content,
              created_at: msg.created_at,
              message_type: msg.message_type === 1 ? 'incoming' : 'outgoing',
              content_type: msg.content_type || 'text',
              status: msg.status || 'sent',
              sender: msg.sender || {
                type: msg.message_type === 1 ? 'agent_bot' : 'user',
                name: msg.sender?.name || (msg.message_type === 1 ? 'Agente' : 'Você')
              }
            }));

            // Verificar se há novas mensagens
            const latestMessageId = newMessages[0]?.id;
            if (latestMessageId && latestMessageId !== lastMessageId) {
              setLastMessageId(latestMessageId);
              setActiveConversation(prev => {
                if (!prev) return null;
                return {
                  ...prev,
                  messages: newMessages
                };
              });
              setMessages(newMessages);
            }
          }
        } catch (error) {
          console.error('Error polling messages:', error);
        }
      }, 3000); // Verificar a cada 3 segundos
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [activeConversation?.id, lastMessageId]);

  useEffect(() => {
    // Carregar inboxes assim que o chat for aberto
    const fetchInboxes = async () => {
      try {
        const accountId = searchParams.get('account_id') || localStorage.getItem('account_id');
        if (!accountId) return;

        // Buscar informações da empresa primeiro
        let companyId = localStorage.getItem('company_id');
        if (!companyId) {
          const companyResponse = await fetch(`/api/company/by-account/${accountId}`);
          if (!companyResponse.ok) {
            throw new Error('Não foi possível buscar informações da empresa');
          }
          const companyData = await companyResponse.json();
          companyId = companyData.company_id?.toString();
          if (companyId) {
            localStorage.setItem('company_id', companyId);
          }
        }

        if (!companyId) {
          throw new Error('Company ID não encontrado');
        }

        // Buscar token WiseApp do banco de dados
        let apiKey = localStorage.getItem('wiseapp_token');
        if (!apiKey) {
          const tokenResponse = await fetch(`/api/wiseapp-token/${companyId}`);
          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            apiKey = tokenData.token;
            if (apiKey) {
              localStorage.setItem('wiseapp_token', apiKey);
            }
          } else if (tokenResponse.status === 404) {
            setAuthError(true);
            throw new Error('Token WiseApp não configurado para esta empresa. Configure nas configurações da empresa.');
          }
        }

        if (!apiKey) {
          setAuthError(true);
          throw new Error('Token WiseApp não encontrado');
        }

        // Chave para cache específica por conta
        const cacheKey = `chat_inboxes_${accountId}`;
        
        // Tentar carregar do cache primeiro
        try {
          const cachedInboxes = localStorage.getItem(cacheKey);
          if (cachedInboxes) {
            const parsedInboxes = JSON.parse(cachedInboxes);
            const cacheTimestamp = parsedInboxes.timestamp;
            const now = Date.now();
            
            // Cache válido por 1 hora (3600000 ms)
            if (now - cacheTimestamp < 3600000) {
              console.log('📦 Carregando inboxes do cache para account_id:', accountId);
              const isInboxOpen = (inbox: any) => {
                const now = new Date();
                const dayOfWeek = now.getDay();
                const currentHour = now.getHours();
                const currentMinutes = now.getMinutes();
                
                // Se não houver horário de funcionamento definido, considerar como aberto
                if (!inbox.working_hours || inbox.working_hours.length === 0) {
                  return true;
                }
                
                const workingHours = inbox.working_hours.find((wh: any) => wh.day_of_week === dayOfWeek);
                
                if (!workingHours) return false;
                if (workingHours.closed_all_day) return false;
                if (workingHours.open_all_day) return true;
                
                const openTime = workingHours.open_hour * 60 + workingHours.open_minutes;
                const closeTime = workingHours.close_hour * 60 + workingHours.close_minutes;
                const currentTime = currentHour * 60 + currentMinutes;
                
                return currentTime >= openTime && currentTime <= closeTime;
              };

              const cachedInboxesWithStatus = parsedInboxes.data.map((inbox: any) => ({
                ...inbox,
                isOpen: isInboxOpen(inbox)
              }));

              setAvailableInboxes(cachedInboxesWithStatus);
              setInboxes(parsedInboxes.data);
              
              if (cachedInboxesWithStatus.length === 1) {
                setSelectedInboxId(cachedInboxesWithStatus[0].id);
              } else if (cachedInboxesWithStatus.length > 1) {
                setShowInboxSelector(true);
              }
              
              return; // Usar cache e não fazer requisição
            } else {
              console.log('⏰ Cache expirado, removendo...');
              localStorage.removeItem(cacheKey);
            }
          }
        } catch (cacheError) {
          console.error('Erro ao ler cache:', cacheError);
          localStorage.removeItem(cacheKey);
        }

        // Se não há cache válido, fazer requisição à API
        console.log('🌐 Buscando inboxes da API para account_id:', accountId);
        const url = `/api/api/v1/accounts/${accountId}/inboxes?_t=${Date.now()}`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'api_access_token': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          if (response.status === 401) {
            // Limpar cache quando há erro de autenticação
            localStorage.removeItem(cacheKey);
            setAuthError(true);
            throw new Error('Token de autenticação inválido ou expirado. Verifique suas credenciais.');
          } else if (response.status === 403) {
            throw new Error('Acesso negado. Verifique as permissões da sua conta.');
          } else if (response.status === 404) {
            throw new Error('Conta não encontrada. Verifique o ID da conta.');
          } else {
            throw new Error(`Erro na API ChatWoot (${response.status}). Tente novamente mais tarde.`);
          }
        }

        const data = await response.json();
        
        console.log('Inbox response:', data);
        console.log('Inbox payload:', data?.payload);
        
        if (data?.payload && Array.isArray(data.payload)) {
          // Salvar no cache com timestamp
          const cacheData = {
            data: data.payload,
            timestamp: Date.now(),
            accountId: accountId
          };
          
          try {
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
            console.log('💾 Inboxes salvos no cache para future uso');
          } catch (saveError) {
            console.error('Erro ao salvar cache:', saveError);
          }

          const isInboxOpen = (inbox: any) => {
            const now = new Date();
            const dayOfWeek = now.getDay();
            const currentHour = now.getHours();
            const currentMinutes = now.getMinutes();
            
            // Se não houver horário de funcionamento definido, considerar como aberto
            if (!inbox.working_hours || inbox.working_hours.length === 0) {
              return true;
            }
            
            const workingHours = inbox.working_hours.find((wh: any) => wh.day_of_week === dayOfWeek);
            
            if (!workingHours) return false;
            if (workingHours.closed_all_day) return false;
            if (workingHours.open_all_day) return true;
            
            const openTime = workingHours.open_hour * 60 + workingHours.open_minutes;
            const closeTime = workingHours.close_hour * 60 + workingHours.close_minutes;
            const currentTime = currentHour * 60 + currentMinutes;
            
            return currentTime >= openTime && currentTime <= closeTime;
          };

          const allInboxes = data.payload.map((inbox: any) => ({
            ...inbox,
            isOpen: isInboxOpen(inbox)
          }));

          console.log('Processed inboxes:', allInboxes);
          setAvailableInboxes(allInboxes);
          setInboxes(data.payload);
          
          // Se houver apenas um inbox, selecioná-lo automaticamente
          if (allInboxes.length === 1) {
            setSelectedInboxId(allInboxes[0].id);
          } else if (allInboxes.length > 1) {
            setShowInboxSelector(true);
            setSelectedInboxId(null); // Não seleciona automaticamente
          }
        } else {
          console.log('No payload found or payload is not an array');
          setAvailableInboxes([]);
        }
      } catch (error) {
        console.error('Error fetching inboxes:', error);
        
        if (error instanceof Error) {
          // Se é um erro de autenticação, mostrar mensagem específica
          if (error.message.includes('401') || error.message.includes('autenticação')) {
            setAuthError(true);
            setError('Token WiseApp inválido ou expirado. Por favor, configure um token válido.');
          } else if (error.message.includes('403')) {
            setError('Acesso negado. Verifique as permissões da sua conta WiseApp.');
          } else if (error.message.includes('404')) {
            setError('Conta não encontrada. Verifique se o ID da conta está correto.');
          } else {
            setError('Erro ao carregar caixas de entrada. Tente novamente mais tarde.');
          }
        } else {
          setError('Erro ao carregar caixas de entrada');
        }
        
        setAvailableInboxes([]);
      }
    };
    if (showChat) fetchInboxes();
  }, [showChat]);

  const handleError = (error: unknown) => {
    console.error('Error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('network') || error.message.includes('conexão')) {
        setNetworkError(true);
        setError('Sem conexão de rede disponível');
      } else if (error.message.includes('auth') || error.message.includes('token')) {
        setAuthError(true);
        setError('Erro de autenticação. Por favor, verifique suas credenciais.');
      } else {
        setError(error.message);
      }
    } else if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        setAuthError(true);
        setError('Erro de autenticação. Por favor, verifique suas credenciais.');
      } else if (error.response?.status === 404) {
        setError('Recurso não encontrado');
      } else if (error.response?.status === 500) {
        setError('Erro interno do servidor');
      } else {
        setError(error.response?.data?.message || error.message || 'Erro inesperado');
      }
    } else {
      setError('Erro inesperado');
    }
  };



  const loadContactInfo = async (contactId: number) => {
    try {
      const api = axios.create({
        baseURL: '/api',
        headers: {
          'api_access_token': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const contactResponse = await apiClient.get(`/api/v1/accounts/${accountId}/contacts/${contactId}`);

      if (contactResponse.data) {
        const contactData = {
          id: contactResponse.data.id,
          name: contactResponse.data.name,
          phone_number: contactResponse.data.phone_number,
          thumbnail: contactResponse.data.thumbnail || contactResponse.data.avatar_url || '',
          source_id: contactResponse.data.contact_inboxes?.[0]?.source_id || '',
          availability_status: contactResponse.data.availability_status || 'offline',
          last_seen_at: contactResponse.data.last_seen_at || '',
          email: contactResponse.data.email,
          custom_attributes: contactResponse.data.custom_attributes || {}
        };

        setContact(contactData);
        
        // Se temos uma foto do contato, salvar no banco de dados para motoristas
        if (contactData.thumbnail && motoristaId) {
          console.log('💾 Salvando foto automaticamente do FloatingChat (thumbnail):', contactData.thumbnail);
          saveWhatsAppPhotoFromFloatingChat(motoristaId.toString(), contactData.thumbnail);
        }
        
        return contactData;
      }
    } catch (error) {
      handleError(error);
    }
  };

  const loadAllContactConversations = async (contactId: number) => {
    try {
      const api = axios.create({
        baseURL: '/api',
        headers: {
          'api_access_token': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const conversationsResponse = await apiClient.get(`/api/v1/accounts/${accountId}/contacts/${contactId}/conversations`);

      if (conversationsResponse.data?.payload) {
        const conversations = await Promise.all(
          conversationsResponse.data.payload.map(async (conv: any) => {
            const inboxResponse = await apiClient.get(`/api/v1/accounts/${accountId}/inboxes/${conv.inbox_id}`);
            const inbox = inboxResponse.data;

            return {
              id: conv.id,
              contact: {
                id: contactId,
                name: contact?.name,
                phone_number: contact?.phone_number,
                thumbnail: contact?.thumbnail
              },
              lastMessage: conv.last_non_activity_message ? {
                content: conv.last_non_activity_message.content,
                created_at: conv.last_non_activity_message.created_at,
                message_type: conv.last_non_activity_message.message_type
              } : null,
              unread_count: conv.unread_count || 0,
              status: conv.status,
              inbox_id: conv.inbox_id,
              inbox_name: inbox.name,
              created_at: conv.created_at,
              meta: conv.meta
            };
          })
        );

        conversations.sort((a, b) => {
          if (!a.lastMessage) return 1;
          if (!b.lastMessage) return -1;
          return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime();
        });

        setPreviousConversations(conversations);
        return conversations;
      }
    } catch (error) {
      handleError(error);
    }
  };

  const handleInboxSelection = async (inboxId: number) => {
    try {
      setLoading(true);
      setSelectedInboxId(inboxId);
      setShowInboxSelector(false);

      if (!accountId || !apiKey) {
        throw new Error('Configuração inválida');
      }

      const api = axios.create({
        baseURL: '/api',
        headers: {
          'api_access_token': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (initialPhone) {
        let formattedNumber = formatPhoneNumber(initialPhone);
        if (!formattedNumber.startsWith('+')) {
          formattedNumber = `+${formattedNumber}`;
        }
        const digitsOnly = formattedNumber.replace(/\D/g, '');
        if (digitsOnly.length < 12) {
          setError('Número de telefone inválido. Por favor, insira o número completo com DDD e código do país.');
          setLoading(false);
          return;
        }
        let contactToUse: Contact | undefined;
        try {
          const searchResponse = await apiClient.get(`/api/v1/accounts/${accountId}/contacts/search`, {
            params: {
              q: digitsOnly
            }
          });
          if (searchResponse.data?.payload?.[0]) {
            contactToUse = searchResponse.data.payload[0];
          }
        } catch (error) {
          console.log('Erro ao buscar contato:', error);
        }
        if (!contactToUse) {
          const contactNameToUse = initialName || additionalInfo?.name || 'Novo Contato';
          const contactEmail = initialEmail || additionalInfo?.email;
          try {
            const newContactResponse = await apiClient.post(`/api/v1/accounts/${accountId}/contacts`, {
              name: contactNameToUse,
              phone_number: formattedNumber,
              email: contactEmail,
              custom_attributes: {
                source: "web_chat",
                source_type: sourceType || 'web',
                ...additionalInfo
              }
            });
            if (!newContactResponse.data) {
              throw new Error('Não foi possível criar o contato');
            }
            contactToUse = newContactResponse.data;
          } catch (error) {
            console.error('Erro ao criar contato:', error);
            throw new Error('Falha ao criar novo contato');
          }
        }
        if (contactToUse) {
          try {
            // Buscar conversas existentes para o contato e inbox
            const conversationsResponse = await apiClient.get(`/api/v1/accounts/${accountId}/contacts/${contactToUse.id}/conversations`);
            let existingConversation = null;
            if (conversationsResponse.data?.payload) {
              existingConversation = conversationsResponse.data.payload.find((conv: any) => conv.inbox_id === inboxId);
            }
            if (existingConversation) {
              // Se já existe conversa, abrir ela
              const contactData = {
                id: contactToUse.id,
                name: contactToUse.name || initialName || formattedNumber,
                phone_number: contactToUse.phone_number,
                thumbnail: contactToUse.thumbnail || contactToUse.avatar_url || '',
                source_id: contactToUse.contact_inboxes?.[0]?.source_id || '',
                availability_status: contactToUse.availability_status || 'offline',
                last_seen_at: contactToUse.last_seen_at || '',
                email: contactToUse.email,
                custom_attributes: contactToUse.custom_attributes || {}
              };
              
              setContact(contactData);
              
              // Se temos uma foto do contato, salvar no banco de dados para motoristas
              if (contactData.thumbnail && motoristaId) {
                console.log('💾 Salvando foto automaticamente do chat existente (thumbnail):', contactData.thumbnail);
                saveWhatsAppPhotoFromFloatingChat(motoristaId.toString(), contactData.thumbnail);
              }
              setActiveConversation({
                id: existingConversation.id,
                messages: []
              });
              await loadConversationMessages(existingConversation.id);
              setStorageConversations(prev => {
                const filteredConversations = prev.filter(conv => conv.user.id !== contactToUse!.id);
                return [...filteredConversations, {
                  user: {
                    id: contactToUse!.id,
                    name: contactToUse!.name,
                    phone_number: contactToUse!.phone_number,
                    thumbnail: contactToUse!.thumbnail || ''
                  },
                  conversationId: existingConversation.id
                }];
              });
            } else {
              // Se não existe, criar nova conversa
              const newConversationResponse = await apiClient.post(`/api/v1/accounts/${accountId}/conversations`, {
                inbox_id: inboxId.toString(),
                contact_id: contactToUse.id.toString()
              });
              if (!newConversationResponse.data) {
                throw new Error('Não foi possível criar a conversa');
              }
              const conversationToUse = newConversationResponse.data;
              const contactData = {
                id: contactToUse.id,
                name: contactToUse.name || initialName || formattedNumber,
                phone_number: contactToUse.phone_number,
                thumbnail: contactToUse.thumbnail || contactToUse.avatar_url || '',
                source_id: contactToUse.contact_inboxes?.[0]?.source_id || '',
                availability_status: contactToUse.availability_status || 'offline',
                last_seen_at: contactToUse.last_seen_at || '',
                email: contactToUse.email,
                custom_attributes: contactToUse.custom_attributes || {}
              };
              
              setContact(contactData);
              
              // Se temos uma foto do contato, salvar no banco de dados para motoristas
              if (contactData.thumbnail && motoristaId) {
                console.log('💾 Salvando foto automaticamente da nova conversa (thumbnail):', contactData.thumbnail);
                saveWhatsAppPhotoFromFloatingChat(motoristaId.toString(), contactData.thumbnail);
              }
              setActiveConversation({
                id: conversationToUse.id,
                messages: []
              });
              await loadConversationMessages(conversationToUse.id);
              setStorageConversations(prev => {
                const filteredConversations = prev.filter(conv => conv.user.id !== contactToUse!.id);
                return [...filteredConversations, {
                  user: {
                    id: contactToUse!.id,
                    name: contactToUse!.name,
                    phone_number: contactToUse!.phone_number,
                    thumbnail: contactToUse!.thumbnail || ''
                  },
                  conversationId: conversationToUse.id
                }];
              });
            }
          } catch (error) {
            console.error('Erro ao criar ou buscar conversa:', error);
            throw new Error('Falha ao criar ou buscar conversa');
          }
        }
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Falha ao processar seleção do inbox'
      );
    } finally {
      setLoading(false);
    }
  };

  const loadConversationMessages = async (conversationId: number, page: number = 1, perPage: number = 20) => {
    try {
      const api = axios.create({
        baseURL: '/api',
        headers: {
          'api_access_token': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const response = await apiClient.get(`/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`, {
        params: {
          page,
          per_page: perPage
        }
      });
      
      if (response.data?.payload) {
        const formattedMessages = response.data.payload.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          created_at: msg.created_at,
          message_type: msg.message_type,
          content_type: msg.content_type || 'text',
          status: msg.status || 'sent',
          attachments: msg.attachments || [],
          sender: msg.sender
        }));
        
        setMessages(prevMessages => {
          if (page === 1) {
            return formattedMessages;
          }
          return [...prevMessages, ...formattedMessages];
        });

        setActiveConversation(prev => {
          if (!prev) return null;
          return {
            ...prev,
            messages: formattedMessages.map((msg: any) => ({
              ...msg,
              message_type: msg.message_type === 'outgoing' ? 'outgoing' : 'incoming'
            }))
          };
        });

        setFiles([]);
        setAudioBlob(null); // Limpar áudio ao carregar mensagens

        setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);

        return {
          meta: response.data.meta,
          hasMore: response.data.payload.length === perPage
        };
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Falha ao carregar mensagens'
      );
    }
  };

  const userInChat = async (phoneNumber: string, contactName?: string) => {
    try {
      // Don't reset state if we're already in a chat with this number
      if (contact?.phone_number === phoneNumber && showChat) {
        return;
      }

      setLoading(true);
      setError(null);
      setAuthError(false);
      setNetworkError(false);
      setShowChat(true);
      setActiveConversation(null);
      setContact(null);
      setMessages([]);

      if (!checkNetworkConnectivity()) {
        setNetworkError(true);
        throw new Error('Sem conexão de rede disponível');
      }

      let accountId = searchParams.get('account_id')?.trim();
      
      if (!accountId) {
        accountId = localStorage.getItem('account_id') || undefined;
      }

      if (!accountId) {
        throw new Error('ID da conta é obrigatório');
      }

      // Buscar informações da empresa primeiro
      let companyId = localStorage.getItem('company_id');
      if (!companyId) {
        const companyResponse = await fetch(`/api/company/by-account/${accountId}`);
        if (!companyResponse.ok) {
          throw new Error('Não foi possível buscar informações da empresa');
        }
        const companyData = await companyResponse.json();
        companyId = companyData.company_id?.toString();
        if (companyId) {
          localStorage.setItem('company_id', companyId);
        }
      }

      if (!companyId) {
        throw new Error('Company ID não encontrado');
      }

      // Buscar token WiseApp do banco de dados
      let apiKey = localStorage.getItem('wiseapp_token');
      if (!apiKey) {
        const tokenResponse = await fetch(`/api/wiseapp-token/${companyId}`);
        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          apiKey = tokenData.token;
          if (apiKey) {
            localStorage.setItem('wiseapp_token', apiKey);
          }
        } else if (tokenResponse.status === 404) {
          setAuthError(true);
          throw new Error('Token WiseApp não configurado para esta empresa. Configure nas configurações da empresa.');
        }
      }

      if (!apiKey) {
        setAuthError(true);
        throw new Error('Token WiseApp não encontrado');
      }

      // Carregar inboxes e mostrar o seletor
      // As inboxes serão carregadas automaticamente pelo useEffect quando showChat for true
      setLoading(false);
    } catch (error) {
      console.error('Error in userInChat:', error);
      handleError(error);
      setLoading(false);
    }
  };

  const formatPhoneNumber = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');

    if (!digits.startsWith('55') && digits.length <= 11) {
      return `55${digits}`;
    }

    return `${digits}`;
  };

  const formatTimestamp = (timestamp: string | number | Date) => {
    if (timestamp instanceof Date) {
      return timestamp;
    }
    const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(Number(timestamp) * 1000);
    return date;
  };

  const formatDate = (timestamp: string | number | Date) => {
    const date = formatTimestamp(timestamp);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (timestamp: string | number | Date) => {
    const date = formatTimestamp(timestamp);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateTime = (timestamp: string | number | Date) => {
    const date = formatTimestamp(timestamp);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const createFile = (blob: Blob, filename: string, type: string): File => {
    return new (File as any)([blob], filename, { type });
  };

  const handleNewConversation = async () => {
    try {
      const response = await apiClient.post(`/api/v1/accounts/${accountId}/conversations`, {
        inbox_id: selectedInboxId,
        contact_id: null
      });

      const conversation: Conversation = {
        id: response.data.id,
        contact: {
          id: 0,
          name: 'Novo Contato',
          phone_number: '',
          thumbnail: ''
        },
        inbox_name: 'Nova Conversa',
        status: 'open',
        unread_count: 0,
        lastMessage: null,
        messages: []
      };

      setActiveConversation(conversation);
      setMessages([]);
      setShowHistory(false);
    } catch (error) {
      console.error('Error creating new conversation:', error);
      handleError(error);
    }
  };

  const handleInboxSelect = async (inboxId: number) => {
    try {
      setSelectedInboxId(inboxId);
      const response = await apiClient.get(`/api/v1/accounts/${accountId}/inboxes/${inboxId}`);
      
      const conversation: Conversation = {
        id: 0,
        contact: {
          id: 0,
          name: 'Novo Contato',
          phone_number: '',
          thumbnail: ''
        },
        inbox_name: response.data.name,
        status: 'open',
        unread_count: 0,
        lastMessage: null,
        messages: []
      };

      setActiveConversation(conversation);
      setMessages([]);
    } catch (error) {
      console.error('Error selecting inbox:', error);
      handleError(error);
    }
  };

  const handleSendMessage = async () => {
    if (!activeConversation?.id) {
      console.error('No active conversation');
      return;
    }

    try {
      const textData = newMessage.trim();
      if (textData) {
        // Adiciona mensagem localmente antes da resposta da API
        const tempMessage: Message = {
          id: Date.now(),
          content: textData,
          created_at: new Date().toISOString(),
          message_type: 'outgoing',
          content_type: 'text',
          status: 'sending',
          sender: {
            type: 'user',
            name: 'Você',
            phone_number: undefined
          }
        };
        setActiveConversation(prev => prev ? { ...prev, messages: [...prev.messages, tempMessage] } : prev);
        setMessages(prev => [...prev, tempMessage]);
        setNewMessage('');
        if (inputRef.current) {
          inputRef.current.value = '';
        }

        const response = await apiClient.post(`/api/v1/accounts/${accountId}/conversations/${activeConversation.id}/messages`, {
          content: textData,
          message_type: 'outgoing'
        });

        if (response.data) {
          // Substitui a mensagem temporária pela real
          setActiveConversation(prev => {
            if (!prev) return null;
            const msgs = prev.messages.map(msg =>
              msg.id === tempMessage.id ? response.data : msg
            );
            return { ...prev, messages: msgs };
          });
          setMessages(prev => prev.map(msg =>
            msg.id === tempMessage.id ? response.data : msg
          ));
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      handleError(error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeConversation?.id) {
      console.error('No active conversation');
      return;
    }

    try {
      const selectedFiles = event.target.files;
      if (!selectedFiles || selectedFiles.length === 0) return;

      const newFiles: FileWithPreview[] = Array.from(selectedFiles).map(file => ({
        file,
        preview: URL.createObjectURL(file),
        type: file.type.startsWith('image/') ? 'image' : 'file'
      }));

      setFiles(prev => [...prev, ...newFiles]);

      const formData = new FormData();
      for (const file of Array.from(selectedFiles)) {
        formData.append('attachments[]', file);
      }

      const response = await apiClient.post(
        `/api/v1/accounts/${accountId}/conversations/${activeConversation.id}/messages`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data) {
        const updatedConversation: Conversation = {
          ...activeConversation,
          messages: [...activeConversation.messages, response.data],
          lastMessage: {
            content: response.data.content,
            created_at: response.data.created_at
          }
        };
        setActiveConversation(updatedConversation);
        setMessages(updatedConversation.messages);
        setFiles([]);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      handleError(error);
    }
  };

  const toggleMinimize = () => {
    setMinimized(!minimized);
  };

  const handleVoiceMessage = async () => {
    try {
      setError(null);
      setAuthError(false);
      setNetworkError(false);

      if (!checkNetworkConnectivity()) {
        setNetworkError(true);
        throw new Error('Sem conexão de rede disponível');
      }

      if (!activeConversation?.id) {
        throw new Error('Conversa não encontrada');
      }

      if (!mediaRecorderRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        const chunks: BlobPart[] = [];

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        recorder.onstop = () => {
          const audioBlob = new Blob(chunks, { type: 'audio/webm' });
          setAudioBlob(audioBlob);
          setIsRecording(false);
          mediaRecorderRef.current = null;
        };

        recorder.start();
        setIsRecording(true);
      } else {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        mediaRecorderRef.current = null;
      }
    } catch (error) {
      console.error('Error handling voice message:', error);
      handleError(error);
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        mediaRecorderRef.current = null;
      }
      setIsRecording(false);
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
  }, []);

  useEffect(() => {
    if (storageConversations.length > 0) {
      try {
        localStorage.setItem('chat_conversations', JSON.stringify(storageConversations));
      } catch (error) {
        console.error('Error saving conversations:', error);
      }
    }
  }, [storageConversations]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        mediaRecorderRef.current = null;
      }
      setIsRecording(false);
      
      // Save final state
      localStorage.setItem('chat_visible', showChat.toString());
      localStorage.setItem('chat_minimized', minimized.toString());
      if (storageConversations.length > 0) {
        localStorage.setItem('chat_conversations', JSON.stringify(storageConversations));
      }
    };
  }, []);

  useEffect(() => {
    if (files.length > 0) {
      files.forEach(file => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    }
  }, [files]);

  useEffect(() => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
  }, []);

  const loadPreviousConversations = async (page: number = 1) => {
    try {
      if (!accountId || !apiKey || !selectedInboxId || !contact?.id) {
        return;
      }

      const params: any = {
        page,
        status: 'open',
        assignee_type: 'all',
        per_page: 20,
        inbox_id: selectedInboxId
      };

      // Buscar apenas as conversas do contato específico
      const conversationsResponse = await apiClient.get(`/api/v1/accounts/${accountId}/contacts/${contact.id}/conversations`);
      
      if (conversationsResponse.data?.payload) {
        // Filtrar conversas pelo inbox selecionado
        const inboxConversations = conversationsResponse.data.payload.filter(
          (conv: any) => conv.inbox_id === selectedInboxId
        );

        // Ordenar por data de criação (mais recente primeiro)
        inboxConversations.sort((a: any, b: any) => {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        // Carregar mensagens para cada conversa
        const conversationsWithMessages = await Promise.all(
          inboxConversations.map(async (conv: any) => {
            try {
              const messagesResponse = await apiClient.get(`/api/v1/accounts/${accountId}/conversations/${conv.id}/messages`, {
                params: {
                  page: 1,
                  per_page: 20
                }
              });

              const formattedMessages = messagesResponse.data?.payload?.map((msg: any) => ({
                id: msg.id,
                content: msg.content,
                created_at: msg.created_at,
                message_type: msg.message_type === 1 ? 'incoming' : 'outgoing',
                content_type: msg.content_type || 'text',
                status: msg.status || 'sent',
                sender: msg.sender || {
                  type: msg.message_type === 1 ? 'agent_bot' : 'user',
                  name: msg.sender?.name || (msg.message_type === 1 ? 'Agente' : 'Você')
                }
              })) || [];

              return {
                id: conv.id,
                contact: {
                  id: contact.id,
                  name: contact.name,
                  phone_number: contact.phone_number,
                  thumbnail: contact.thumbnail || ''
                },
                messages: formattedMessages,
                lastMessage: formattedMessages[0] || null,
                unread_count: conv.unread_count || 0,
                status: conv.status,
                inbox_id: conv.inbox_id,
                created_at: conv.created_at
              };
            } catch (error) {
              console.error('Error loading messages for conversation:', error);
              return null;
            }
          })
        );

        // Filtrar conversas nulas e atualizar o estado
        const validConversations = conversationsWithMessages.filter(conv => conv !== null);
        
        setPreviousConversations(validConversations);

        // Se houver conversas, selecionar a mais recente
        if (validConversations.length > 0) {
          const mostRecent = validConversations[0];
          setActiveConversation({
            id: mostRecent.id,
            messages: mostRecent.messages
          });
        }

        return {
          meta: conversationsResponse.data.meta,
          hasMore: inboxConversations.length === params.per_page
        };
      }
    } catch (error) {
      console.error('Error loading previous conversations:', error);
      handleError(error);
    }
  };

  const loadMoreConversations = async () => {
    if (!contact?.id) return;
    const currentPage = Math.ceil(previousConversations.length / 20) + 1;
    const result = await loadPreviousConversations(currentPage);
  };

  const handleHistoryScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    if (element.scrollTop === 0) {
      loadMoreConversations();
    }
  };

  const switchConversation = async (conversationId: number) => {
    try {
      setLoading(true);
      
      const conversation = previousConversations.find(conv => conv.id === conversationId);
      
      if (!conversation) {
        throw new Error('Conversação não encontrada');
      }

      setContact(conversation.contact);
      setActiveConversation({
        id: conversation.id,
        messages: []
      });

      await loadConversationMessages(conversation.id);
      setShowHistory(false);
    } catch (error) {
      console.error('Error switching conversation:', error);
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreMessages = async () => {
    if (!activeConversation?.id) return;
    const currentPage = Math.ceil(messages.length / 20) + 1;
    await loadConversationMessages(activeConversation.id, currentPage);
  };

  const handleMessagesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    if (element.scrollTop === 0) {
      loadMoreMessages();
    }
  };

  const formatWorkingHours = (workingHours: any[]) => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const formattedHours = workingHours.map(wh => {
      const day = days[wh.day_of_week];
      if (wh.closed_all_day) return `${day}: Fechado`;
      if (wh.open_all_day) return `${day}: 24h`;
      return `${day}: ${String(wh.open_hour).padStart(2, '0')}:${String(wh.open_minutes).padStart(2, '0')} - ${String(wh.close_hour).padStart(2, '0')}:${String(wh.close_minutes).padStart(2, '0')}`;
    });
    return formattedHours.join(' | ');
  };

  const renderMessage = (message: Message, index: number) => {
    const showDateSeparator = index === 0 || 
      new Date(message.created_at).toDateString() !== 
      new Date(activeConversation!.messages[index - 1].created_at).toDateString();

    // Mensagens do contato (usuário externo) ficam à esquerda, atendente/bot à direita
    // Considera que o contato é identificado pelo phone_number igual ao contact.phone_number
    const isContact = message.sender?.phone_number && contact?.phone_number && message.sender.phone_number === contact.phone_number;
    const isAgentOrBot = !isContact;

    return (
      <div key={message.id} className="space-y-2">
        {showDateSeparator && (
          <div className="flex justify-center my-4">
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
              {formatDate(message.created_at)}
            </span>
          </div>
        )}

        <div
          className={`flex items-start gap-2 ${
            isContact ? 'justify-start' : 'justify-end'
          }`}
        >
          {isContact && (
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white overflow-hidden flex-shrink-0">
              {message.sender?.avatar_url || message.sender?.thumbnail ? (
                <img 
                  src={message.sender.avatar_url || message.sender.thumbnail} 
                  alt={message.sender.name || 'Avatar'} 
                  className="w-full h-full object-cover"
                />
              ) : (
                message.sender?.name?.[0]?.toUpperCase() || 'C'
              )}
            </div>
          )}
          <div
            className={`max-w-[80%] rounded-lg p-3 ${
              isContact
                ? 'bg-green-100 dark:bg-green-900 text-gray-900 dark:text-white'
                : 'bg-blue-500 text-white ml-auto'
            }`}
          >
            {message.content_type === 'image' ? (
              <img
                src={message.content}
                alt="Imagem"
                className="max-w-full rounded-lg"
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'https://via.placeholder.com/150?text=Imagem+não+encontrada';
                }}
              />
            ) : message.content_type === 'file' ? (
              <a
                href={message.content}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 text-blue-500 hover:text-blue-600"
              >
                <File className="w-5 h-5" />
                <span>{message.content}</span>
              </a>
            ) : message.content_type === 'audio' ? (
              <audio controls className="w-full">
                <source src={message.content} type="audio/webm" />
                Seu navegador não suporta o elemento de áudio.
              </audio>
            ) : (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            )}
            <div className="flex items-center justify-between mt-1">
              <span className={`text-xs ${
                isContact
                  ? 'text-gray-500 dark:text-gray-400'
                  : 'text-blue-100'
              }`}>
                {formatTime(message.created_at)}
              </span>
              {isContact && (
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                  {message.sender?.name}
                </span>
              )}
            </div>
          </div>
          {isAgentOrBot && (
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white overflow-hidden flex-shrink-0">
              {message.sender?.avatar_url || message.sender?.thumbnail ? (
                <img 
                  src={message.sender.avatar_url || message.sender.thumbnail} 
                  alt={message.sender.name || 'Avatar'} 
                  className="w-full h-full object-cover"
                />
              ) : (
                message.sender?.name?.[0]?.toUpperCase() || 'A'
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!showChat) return null;

  if (loading) {
    return (
      <div className="fixed bottom-5 right-5 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 max-w-[300px] z-[9999]">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
          <span className="text-gray-600 dark:text-gray-300">Carregando chat...</span>
        </div>
      </div>
    );
  }

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
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {!minimized && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-[800px] h-[600px] flex mb-4 relative">
          {/* History Sidebar */}
          <div className="w-64 border-r dark:border-gray-700 flex flex-col">
            <div className="p-4 border-b dark:border-gray-700">
              <h3 className="font-medium text-gray-900 dark:text-white">Conversas</h3>
            </div>
            <div className="flex-1 overflow-y-auto" onScroll={handleHistoryScroll}>
              {(() => {
                if (!selectedInboxId) {
                  return (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                      Selecione um inbox para ver as conversas
                    </div>
                  );
                }

                if (!contact) {
                  return (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                      Selecione um contato para ver as conversas
                    </div>
                  );
                }

                if (!previousConversations || previousConversations.length === 0) {
                  return (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                      Nenhuma conversa encontrada
                    </div>
                  );
                }

                return previousConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => switchConversation(conv.id)}
                    className={`w-full p-4 text-left border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      activeConversation?.id === conv.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white overflow-hidden">
                        {conv.contact?.thumbnail ? (
                          <img 
                            src={conv.contact.thumbnail} 
                            alt={conv.contact.name || 'Avatar'} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          conv.contact?.name?.[0]?.toUpperCase() || 'C'
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {conv.contact?.name || conv.contact?.phone_number || 'Contato'}
                          </p>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {conv.inbox_name}
                          </span>
                        </div>
                        {conv.lastMessage && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {conv.lastMessage.content}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {conv.lastMessage ? formatDateTime(conv.lastMessage.created_at) : ''}
                          </span>
                          {conv.status === 'open' && (
                            <span className="text-xs text-green-500">Aberta</span>
                          )}
                        </div>
                      </div>
                      {conv.unread_count > 0 && (
                        <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </button>
                ));
              })()}
            </div>
          </div>

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white overflow-hidden">
                  {contact?.thumbnail ? (
                    <img 
                      src={contact.thumbnail} 
                      alt={contact.name || 'Avatar'} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    contact?.name?.[0]?.toUpperCase() || 'C'
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {contact?.name || 'Chat'}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {contact?.phone_number || 'Selecione um contato'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setMinimized(true)}
                  className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  title="Minimizar"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowChat(false)}
                  className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Inbox Selector Modal */}
            {showInboxSelector && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      Selecione uma Caixa de Entrada
                    </h3>
                    <button
                      onClick={() => setShowInboxSelector(false)}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                      aria-label="Fechar"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {availableInboxes.map((inbox) => (
                      <button
                        key={inbox.id}
                        onClick={() => handleInboxSelection(inbox.id)}
                        className="w-full p-3 text-left rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {inbox.name}
                          </span>
                          <div className="flex items-center gap-2">
                            {inbox.isOpen ? (
                              <span className="text-green-600 dark:text-green-400 text-sm flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                Aberto
                              </span>
                            ) : (
                              <span className="text-red-600 dark:text-red-400 text-sm flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                Fechado
                              </span>
                            )}
                          </div>
                        </div>
                        {!inbox.isOpen && inbox.working_hours && inbox.working_hours.length > 0 && (
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Horário de funcionamento: {formatWorkingHours(inbox.working_hours)}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Messages */}
            <div 
              className="flex-1 overflow-y-auto p-4 space-y-4" 
              ref={messagesEndRef}
              onScroll={handleMessagesScroll}
            >
              {!selectedInboxId ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500 dark:text-gray-400">
                    Selecione um inbox para iniciar a conversa
                  </p>
                </div>
              ) : activeConversation?.messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500 dark:text-gray-400">
                    Nenhuma mensagem ainda. Inicie a conversa!
                  </p>
                </div>
              ) : (
                activeConversation?.messages.map((message, index) => renderMessage(message, index))
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t dark:border-gray-700">
              {error && (
                <div className="mb-2 p-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-100 rounded text-sm">
                  {error}
                </div>
              )}
              {networkError && (
                <div className="mb-2 p-2 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-100 rounded text-sm">
                  Sem conexão de rede disponível
                </div>
              )}
              {authError && (
                <div className="mb-2 p-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-100 rounded text-sm">
                  Erro de autenticação. Por favor, verifique suas credenciais.
                </div>
              )}
              {(files.length > 0 || audioBlob) && (
                <div className="flex gap-2 mt-2">
                  {files.map((f, idx) => (
                    <div key={idx} className="relative">
                      {f.type === 'image' ? (
                        <img src={f.preview} alt="preview" className="w-12 h-12 object-cover rounded" />
                      ) : (
                        <File className="w-8 h-8 text-gray-500" />
                      )}
                      <button type="button" onClick={() => setFiles(files.filter((_, i) => i !== idx))} className="absolute top-0 right-0 bg-white rounded-full p-1"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  {audioBlob && (
                    <div className="flex items-center gap-2 bg-gray-100 p-2 rounded">
                      <audio controls src={URL.createObjectURL(audioBlob)} />
                      <button type="button" onClick={() => setAudioBlob(null)} className="text-red-500"><X className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => document.getElementById('fileInput')?.click()}
                  className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  title="Anexar arquivo"
                  disabled={!selectedInboxId}
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  id="fileInput"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  disabled={!selectedInboxId}
                />
                <button
                  type="button"
                  onClick={handleVoiceMessage}
                  className={`p-1.5 ${
                    isRecording
                      ? 'text-red-500 hover:text-red-700 dark:hover:text-red-400'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                  title={isRecording ? 'Parar gravação' : 'Gravar áudio'}
                  disabled={!selectedInboxId}
                >
                  {isRecording ? (
                    <Square className="w-5 h-5" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </button>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={!selectedInboxId ? "Selecione um inbox primeiro..." : "Digite sua mensagem..."}
                  className="flex-1 p-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  disabled={!selectedInboxId || !activeConversation || networkError || authError}
                />
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={!selectedInboxId || !newMessage.trim() || !activeConversation || networkError || authError}
                  className={`p-2 rounded-full ${
                    !selectedInboxId || !newMessage.trim() || !activeConversation || networkError || authError
                      ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600'
                  }`}
                  title={!selectedInboxId ? "Selecione um inbox primeiro" : "Enviar mensagem"}
                >
                  <Send className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Button */}
      <button
        onClick={() => setMinimized(false)}
        className={`p-4 rounded-full shadow-lg ${
          minimized ? 'bg-blue-500 hover:bg-blue-600' : 'hidden'
        }`}
        title="Abrir chat"
      >
        <MessageSquare className="w-6 h-6 text-white" />
      </button>
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