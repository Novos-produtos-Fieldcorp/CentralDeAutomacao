import React, { useState, useEffect, useRef } from 'react';
import {Send, Minimize2, Maximize2, Phone, Loader2, AlertCircle, WifiOff, X, Mic, Image, Paperclip, Minus, Square, MessageSquare, File } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';

interface FloatingChatProps {
  initialPhone?: string;
  initialName?: string;
  initialEmail?: string;
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
  source_id?: string;
  status?: 'online' | 'offline';
  availability_status?: 'online' | 'offline';
  last_seen_at?: string;
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

  const accountId = searchParams.get('account_id') || localStorage.getItem('account_id');
  const apiKey = localStorage.getItem('wiseapp_token');

  const api = axios.create({
    baseURL: '/api',
    headers: {
      'api_access_token': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });

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
    if (showChat && !minimized && !activeConversation && selectedInboxId) {
      loadPreviousConversations();
    }
  }, [showChat, minimized, activeConversation, selectedInboxId]);

  useEffect(() => {
    if (initialPhone) {
      userInChat(initialPhone, initialName);
    }
  }, [initialPhone, initialName]);

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

  const proxyRequest = async (request: any) => {
    try {
      const url = request.url.replace(import.meta.env.VITE_CHAT_API_URL, '/api');
      
      const response = await fetch(url, {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          'api_access_token': request.headers.api_access_token
        },
        body: request.method !== 'GET' ? JSON.stringify(request.params) : undefined
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      handleError(error);
      throw error;
    }
  };

  const proxyRequestWithFiles = async (formData: FormData) => {
    const url = (formData.get('Url') as string).replace(import.meta.env.VITE_CHAT_API_URL, '/api');
    const method = formData.get('Method') as string;
    const token = formData.get('Headers[api_access_token]') as string;
    
    const newFormData = new FormData();
    formData.forEach((value, key) => {
      if (key !== 'Url') {
        newFormData.append(key, value);
      }
    });
    
    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'api_access_token': token
        },
        body: newFormData
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('File upload request failed:', error);
      throw error;
    }
  };

  const fetchInboxes = async (accountId: string, apiKey: string) => {
    try {
      const api = axios.create({
        baseURL: '/api',
        headers: {
          'api_access_token': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const response = await api.get(`/api/v1/accounts/${accountId}/inboxes`);
      if (response.data?.payload) {
        setInboxes(response.data.payload);
        
        const isInboxOpen = (inbox: any) => {
          const now = new Date();
          const dayOfWeek = now.getDay();
          const currentHour = now.getHours();
          const currentMinutes = now.getMinutes();
          
          const workingHours = inbox.working_hours.find((wh: any) => wh.day_of_week === dayOfWeek);
          
          if (!workingHours) return false;
          if (workingHours.closed_all_day) return false;
          if (workingHours.open_all_day) return true;
          
          const openTime = workingHours.open_hour * 60 + workingHours.open_minutes;
          const closeTime = workingHours.close_hour * 60 + workingHours.close_minutes;
          const currentTime = currentHour * 60 + currentMinutes;
          
          return currentTime >= openTime && currentTime <= closeTime;
        };

        const allInboxes = response.data.payload.map((inbox: any) => ({
          ...inbox,
          isOpen: isInboxOpen(inbox)
        }));

        setAvailableInboxes(allInboxes);

        if (allInboxes.length === 1) {
          setSelectedInboxId(allInboxes[0].id);
          return allInboxes[0].id;
        }

        if (allInboxes.length > 1) {
          setShowInboxSelector(true);
          return null;
        }

        return null;
      }
      return null;
    } catch (error) {
      return null;
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

      const contactResponse = await api.get(`/api/v1/accounts/${accountId}/contacts/${contactId}`);

      if (contactResponse.data) {
        const contactData = {
          id: contactResponse.data.id,
          name: contactResponse.data.name,
          phone_number: contactResponse.data.phone_number,
          thumbnail: contactResponse.data.avatar_url || contactResponse.data.thumbnail || '',
          source_id: contactResponse.data.contact_inboxes?.[0]?.source_id || '',
          availability_status: contactResponse.data.availability_status || 'offline',
          last_seen_at: contactResponse.data.last_activity_at ? new Date(contactResponse.data.last_activity_at * 1000).toISOString() : '',
          email: contactResponse.data.email,
          custom_attributes: contactResponse.data.custom_attributes || {}
        };

        setContact(contactData);
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

      const conversationsResponse = await api.get(`/api/v1/accounts/${accountId}/contacts/${contactId}/conversations`);

      if (conversationsResponse.data?.payload) {
        const conversations = await Promise.all(
          conversationsResponse.data.payload.map(async (conv: any) => {
            const inboxResponse = await api.get(`/api/v1/accounts/${accountId}/inboxes/${conv.inbox_id}`);
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

      if (initialPhone) {
        const formattedNumber = formatPhoneNumber(initialPhone);
        
        // Buscar contato existente
        const searchResponse = await api.get(`/api/v1/accounts/${accountId}/contacts/search`, {
          params: {
            q: formattedNumber
          }
        });

        let contactToUse;

        if (searchResponse.data?.payload?.[0]) {
          // Usar contato existente
          const existingContact = searchResponse.data.payload[0];
          contactToUse = {
            id: existingContact.id,
            name: existingContact.name,
            phone_number: existingContact.phone_number,
            thumbnail: existingContact.avatar_url || existingContact.thumbnail || ''
          };

          // Buscar conversas do contato
          const conversationsResponse = await api.get(`/api/v1/accounts/${accountId}/contacts/${contactToUse.id}/conversations`);

          if (conversationsResponse.data?.payload?.length > 0) {
            // Filtrar conversas pelo inbox selecionado
            const inboxConversations = conversationsResponse.data.payload.filter(
              (conv: any) => conv.inbox_id === inboxId
            );

            if (inboxConversations.length > 0) {
              // Usar a conversa mais recente do inbox selecionado
              const conversationToUse = inboxConversations[0];
              
              setContact(contactToUse);
              setActiveConversation({
                id: conversationToUse.id,
                messages: []
              });

              // Carregar mensagens apenas uma vez
              const messagesResponse = await api.get(`/api/v1/accounts/${accountId}/conversations/${conversationToUse.id}/messages`, {
                params: {
                  page: 1,
                  per_page: 20
                }
              });

              if (messagesResponse.data?.payload) {
                setActiveConversation(prev => ({
                  ...prev!,
                  messages: messagesResponse.data.payload.map((msg: any) => ({
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
                  }))
                }));
              }
            } else {
              // Criar nova conversa no inbox selecionado
              const newConversationResponse = await api.post(`/api/v1/accounts/${accountId}/conversations`, {
                inbox_id: inboxId.toString(),
                contact_id: contactToUse.id.toString()
              });

              if (newConversationResponse.data) {
                setContact(contactToUse);
                setActiveConversation({
                  id: newConversationResponse.data.id,
                  messages: []
                });
              }
            }
          } else {
            // Criar nova conversa para o contato existente
            const newConversationResponse = await api.post(`/api/v1/accounts/${accountId}/conversations`, {
              inbox_id: inboxId.toString(),
              contact_id: contactToUse.id.toString()
            });

            if (newConversationResponse.data) {
              setContact(contactToUse);
              setActiveConversation({
                id: newConversationResponse.data.id,
                messages: []
              });
            }
          }
        } else {
          // Criar novo contato
          const contactNameToUse = initialName || additionalInfo?.name || 'Novo Contato';
          const contactEmail = initialEmail || additionalInfo?.email;

          const newContactResponse = await api.post(`/api/v1/accounts/${accountId}/contacts`, {
            name: contactNameToUse,
            phone_number: formattedNumber,
            email: contactEmail,
            custom_attributes: {
              source: "web_chat",
              source_type: sourceType || 'web',
              ...additionalInfo
            }
          });

          if (newContactResponse.data) {
            contactToUse = {
              id: newContactResponse.data.id,
              name: newContactResponse.data.name,
              phone_number: newContactResponse.data.phone_number,
              thumbnail: newContactResponse.data.avatar_url || newContactResponse.data.thumbnail || ''
            };

            // Criar nova conversa para o novo contato
            const newConversationResponse = await api.post(`/api/v1/accounts/${accountId}/conversations`, {
              inbox_id: inboxId.toString(),
              contact_id: contactToUse.id.toString()
            });

            if (newConversationResponse.data) {
              setContact(contactToUse);
              setActiveConversation({
                id: newConversationResponse.data.id,
                messages: []
              });
            }
          }
        }
      } else {
        throw new Error('Nenhum número de telefone disponível para criar o contato');
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

      const response = await api.get(`/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`, {
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

  const loadAllConversations = async () => {
    try {
      const response = await api.get(`/api/v1/accounts/${accountId}/conversations`, {
        params: {
          status: 'open',
          assignee_type: 'all',
          per_page: 50
        }
      });

      if (response.data?.payload) {
        const conversations = await Promise.all(
          response.data.payload.map(async (conv: any) => {
            try {
              const contactResponse = await api.get(`/api/v1/accounts/${accountId}/contacts/${conv.contact_id}`);
              const contact = contactResponse.data;

              const inboxResponse = await api.get(`/api/v1/accounts/${accountId}/inboxes/${conv.inbox_id}`);
              const inbox = inboxResponse.data;

              const messagesResponse = await api.get(
                `/api/v1/accounts/${accountId}/conversations/${conv.id}/messages?page=1&per_page=1`
              );
              const lastMessage = messagesResponse.data?.payload?.[0];

              const processedConversation = {
                id: conv.id,
                contact: {
                  id: contact.id,
                  name: contact.name,
                  phone_number: contact.phone_number,
                  thumbnail: contact.avatar_url || contact.thumbnail || ''
                },
                lastMessage: lastMessage ? {
                  content: lastMessage.content,
                  created_at: lastMessage.created_at,
                  message_type: lastMessage.message_type
                } : null,
                unread_count: conv.unread_count || 0,
                status: conv.status,
                inbox_id: conv.inbox_id,
                inbox_name: inbox.name,
                created_at: conv.created_at,
                meta: conv.meta
              };

              return processedConversation;
            } catch (error) {
              return null;
            }
          })
        );

        const validConversations = conversations.filter(conv => conv !== null);

        validConversations.sort((a, b) => {
          if (!a.lastMessage) return 1;
          if (!b.lastMessage) return -1;
          return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime();
        });
        
        setPreviousConversations(validConversations);
        
        return validConversations;
      }
    } catch (error) {
      handleError(error);
    }
  };

  const userInChat = async (phoneNumber: string, contactName?: string) => {
    try {
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

      const apiKey = localStorage.getItem('wiseapp_token');
      if (!apiKey) {
        setAuthError(true);
        throw new Error('Token WiseApp não encontrado');
      }

      const api = axios.create({
        baseURL: '/api',
        headers: {
          'api_access_token': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const formattedNumber = formatPhoneNumber(phoneNumber);

      // Buscar contato existente
      const searchResponse = await api.get(`/api/v1/accounts/${accountId}/contacts/search`, {
        params: {
          q: formattedNumber
        }
      });

      let user;
      if (!searchResponse.data?.payload?.[0]) {
        const contactNameToUse = contactName || 'Novo Contato';
        const newContactResponse = await api.post(`/api/v1/accounts/${accountId}/contacts`, {
          name: contactNameToUse,
          phone_number: formattedNumber,
          custom_attributes: {
            source: "web_chat",
            source_type: sourceType || 'web',
            ...additionalInfo
          }
        });

        if (!newContactResponse.data) {
          throw new Error('Não foi possível criar o contato');
        }

        user = newContactResponse.data;
      } else {
        user = searchResponse.data.payload[0];
      }

      const contactResponse = await api.get(`/api/v1/accounts/${accountId}/contacts/${user.id}`);

      if (!contactResponse.data) {
        throw new Error('Não foi possível carregar detalhes do contato');
      }

      const contactData = {
        id: contactResponse.data.id,
        name: contactResponse.data.name || contactName || formattedNumber,
        phone_number: contactResponse.data.phone_number,
        thumbnail: contactResponse.data.avatar_url || contactResponse.data.thumbnail || '',
        source_id: contactResponse.data.contact_inboxes?.[0]?.source_id || '',
        availability_status: contactResponse.data.availability_status || 'offline',
        last_seen_at: contactResponse.data.last_activity_at ? new Date(contactResponse.data.last_activity_at * 1000).toISOString() : '',
        email: contactResponse.data.email,
        custom_attributes: contactResponse.data.custom_attributes || {}
      };

      setContact(contactData);

      const inboxId = await fetchInboxes(accountId, apiKey);
      if (!inboxId) {
        setLoading(false);
        return;
      }

      const conversationsResponse = await api.get(`/api/v1/accounts/${accountId}/contacts/${user.id}/conversations`);

      let conversationToUse = null;
      const contactForConvs = contactData || contact;
      const sortedConversations = conversationsResponse.data.payload.sort((a: any, b: any) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      const inboxConversations = sortedConversations.filter(
        (conv: any) => conv.inbox_id === inboxId
      );
      if (inboxConversations.length > 0) {
        conversationToUse = inboxConversations[0];
      } else if (sortedConversations.length === 0) {
        // Criar nova conversa apenas se não houver nenhuma conversa existente
        const newConversationResponse = await api.post(`/api/v1/accounts/${accountId}/conversations`, {
          inbox_id: inboxId.toString(),
          contact_id: user.id.toString()
        });

        if (newConversationResponse.data) {
          conversationToUse = newConversationResponse.data;
        }
      } else {
        // Se houver conversas em outros inboxes, use a mais recente
        conversationToUse = sortedConversations[0];
      }

      const formattedConversations = await Promise.all(sortedConversations.map(async (conv: any) => {
        const inboxResponse = await api.get(`/api/v1/accounts/${accountId}/inboxes/${conv.inbox_id}`);
        const inbox = inboxResponse.data;
        const contactForConvs = contactData || contact;

        return {
          id: conv.id,
          contact: {
            id: contactForConvs.id,
            name: contactForConvs.name,
            phone_number: contactForConvs.phone_number,
            thumbnail: contactForConvs.thumbnail
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
      }));

      setPreviousConversations(formattedConversations);

      if (!conversationToUse) {
        const newConversationResponse = await api.post(`/api/v1/accounts/${accountId}/conversations`, {
          inbox_id: inboxId.toString(),
          contact_id: user.id.toString()
        });

        if (newConversationResponse.data) {
          conversationToUse = newConversationResponse.data;
        }
      }

      if (conversationToUse) {
        setActiveConversation({
          id: conversationToUse.id,
          messages: []
        });

        await loadConversationMessages(conversationToUse.id);

        setStorageConversations(prev => [
          ...prev,
          {
            user: contactData,
            conversationId: conversationToUse.id
          }
        ]);
      }

    } catch (error) {
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
      const response = await api.post(`/api/v1/accounts/${accountId}/conversations`, {
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
      const response = await api.get(`/api/v1/accounts/${accountId}/inboxes/${inboxId}`);
      
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
        const response = await api.post(`/api/v1/accounts/${accountId}/conversations/${activeConversation.id}/messages`, {
          content: textData,
          message_type: 'outgoing'
        });

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
          setNewMessage('');
          if (inputRef.current) {
            inputRef.current.value = '';
          }
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
      for (const file of selectedFiles) {
        formData.append('attachments[]', file);
      }

      const response = await api.post(
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

        recorder.ondataavailable = async (event) => {
          if (event.data.size > 0) {
            const audioBlob = new Blob([event.data], { type: 'audio/webm' });
            const audioFile = createFile(audioBlob, 'audio-message.webm', 'audio/webm');

            const tempMessage: Message = {
              id: Date.now(),
              content: 'Mensagem de voz',
              created_at: formatDateTime(new Date()),
              message_type: 'outgoing',
              content_type: 'audio',
              status: 'sending'
            };

            setActiveConversation(prev => {
              if (!prev) return null;
              return {
                ...prev,
                messages: [...prev.messages, tempMessage]
              };
            });

            const formData = new FormData();
            formData.append('attachments[]', audioFile);

            const response = await api.post(
              `/api/v1/accounts/${accountId}/conversations/${activeConversation.id}/messages`,
              formData,
              {
                headers: {
                  'Content-Type': 'multipart/form-data'
                }
              }
            );

            if (response.data) {
              setActiveConversation(prev => {
                if (!prev) return null;
                return {
                  ...prev,
                  messages: prev.messages.map(msg => 
                    msg.id === tempMessage.id 
                      ? { ...msg, id: response.data.id, status: 'sent' }
                      : msg
                  )
                };
              });

              await loadConversationMessages(activeConversation.id);

              setTimeout(() => {
                if (messagesEndRef.current) {
                  messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
                }
              }, 100);
            }
          }
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
    };
  }, []);

  useEffect(() => {

    return () => {
      files.forEach(file => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, [files]);

  useEffect(() => {

    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  const loadPreviousConversations = async (page: number = 1) => {
    try {
      if (!accountId || !apiKey || !selectedInboxId) {
        return;
      }

      const params: any = {
        page,
        status: 'open',
        assignee_type: 'all',
        per_page: 20,
        inbox_id: selectedInboxId
      };

      const response = await api.get(`/api/v1/accounts/${accountId}/conversations`, { params });

      if (response.data?.payload?.[0]) {
        const conv = response.data.payload[0];
        try {
          const contactResponse = await api.get(`/api/v1/accounts/${accountId}/contacts/${conv.contact_id}`);
          const contact = contactResponse.data;

          const conversation = {
            id: conv.id,
            contact: {
              id: contact.id,
              name: contact.name,
              phone_number: contact.phone_number,
              thumbnail: contact.avatar_url || contact.thumbnail || ''
            },
            lastMessage: conv.last_non_activity_message ? {
              content: conv.last_non_activity_message.content,
              created_at: conv.last_non_activity_message.created_at,
              message_type: conv.last_non_activity_message.message_type
            } : null,
            unread_count: conv.unread_count || 0,
            status: conv.status,
            inbox_id: conv.inbox_id,
            created_at: conv.created_at
          };

          setContact(conversation.contact);
          setActiveConversation({
            id: conversation.id,
            messages: []
          });

          // Carregar mensagens apenas uma vez
          const messagesResponse = await api.get(`/api/v1/accounts/${accountId}/conversations/${conv.id}/messages`, {
            params: {
              page: 1,
              per_page: 20
            }
          });

          if (messagesResponse.data?.payload) {
            setActiveConversation(prev => ({
              ...prev!,
              messages: messagesResponse.data.payload.map((msg: any) => ({
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
              }))
            }));
          }

          setPreviousConversations([conversation]);

          return {
            meta: response.data.meta,
            hasMore: response.data.payload.length === params.per_page
          };
        } catch (error) {
          console.error('Error loading contact:', error);
          handleError(error);
        }
      } else if (initialPhone) {
        // Se não houver conversas e tiver um número inicial, criar novo contato
        try {
          const formattedNumber = formatPhoneNumber(initialPhone);
          
          // Buscar contato existente
          const searchResponse = await api.get(`/api/v1/accounts/${accountId}/contacts/search`, {
            params: {
              q: formattedNumber
            }
          });

          let contactToUse;

          if (searchResponse.data?.payload?.[0]) {
            // Usar contato existente
            const existingContact = searchResponse.data.payload[0];
            contactToUse = {
              id: existingContact.id,
              name: existingContact.name,
              phone_number: existingContact.phone_number,
              thumbnail: existingContact.avatar_url || existingContact.thumbnail || ''
            };
          } else {
            // Criar novo contato
            const contactNameToUse = initialName || additionalInfo?.name || 'Novo Contato';
            const contactEmail = initialEmail || additionalInfo?.email;

            const newContactResponse = await api.post(`/api/v1/accounts/${accountId}/contacts`, {
              name: contactNameToUse,
              phone_number: formattedNumber,
              email: contactEmail,
              custom_attributes: {
                source: "web_chat",
                source_type: sourceType || 'web',
                ...additionalInfo
              }
            });

            if (newContactResponse.data) {
              contactToUse = {
                id: newContactResponse.data.id,
                name: newContactResponse.data.name,
                phone_number: newContactResponse.data.phone_number,
                thumbnail: newContactResponse.data.avatar_url || newContactResponse.data.thumbnail || ''
              };
            }
          }

          if (contactToUse) {
            // Criar nova conversa para o contato
            const newConversationResponse = await api.post(`/api/v1/accounts/${accountId}/conversations`, {
              inbox_id: selectedInboxId?.toString() || '1',
              contact_id: contactToUse.id.toString()
            });

            if (newConversationResponse.data) {
              const newConversation = {
                id: newConversationResponse.data.id,
                contact: contactToUse,
                lastMessage: null,
                unread_count: 0,
                status: 'open',
                inbox_id: selectedInboxId || 1,
                created_at: new Date().toISOString()
              };

              setContact(newConversation.contact);
              setActiveConversation({
                id: newConversation.id,
                messages: []
              });

              setPreviousConversations([newConversation]);
            }
          }
        } catch (error) {
          console.error('Error handling contact:', error);
          handleError(error);
        }
      }
    } catch (error) {
      console.error('Error loading previous conversations:', error);
      handleError(error);
    }
  };

  const loadMoreConversations = async () => {
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-[800px] h-[600px] flex mb-4">
          {/* History Sidebar */}
          <div className="w-64 border-r dark:border-gray-700 flex flex-col">
            <div className="p-4 border-b dark:border-gray-700">
              <h3 className="font-medium text-gray-900 dark:text-white">Conversas</h3>
            </div>
            <div className="flex-1 overflow-y-auto" onScroll={handleHistoryScroll}>
              {(() => {
                return !previousConversations || previousConversations.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                    Nenhuma conversa encontrada
                  </div>
                ) : (
                  previousConversations.map((conv) => {
                    return (
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
                    );
                  })
                );
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
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Selecione um Inbox
                  </h3>
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
                          {inbox.isOpen ? (
                            <span className="text-green-600 dark:text-green-400 text-sm">
                              Aberto
                            </span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400 text-sm">
                              Fechado
                            </span>
                          )}
                        </div>
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
              {activeConversation?.messages.map((message, index) => {
                const showDateSeparator = index === 0 || 
                  new Date(message.created_at).toDateString() !== 
                  new Date(activeConversation.messages[index - 1].created_at).toDateString();

                return (
                  <div key={message.id} className="space-y-2">
                    {/* Date Separator */}
                    {showDateSeparator && (
                      <div className="flex justify-center my-4">
                        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                          {formatDate(message.created_at)}
                        </span>
                      </div>
                    )}

                    {/* Message */}
                    <div
                      className={`flex items-start gap-2 ${message.sender?.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {message.sender?.type !== 'user' && (
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
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          message.sender?.type === 'user'
                            ? 'bg-blue-500 text-white ml-auto'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
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
                            message.sender?.type === 'user'
                              ? 'text-blue-100' 
                              : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            {formatTime(message.created_at)}
                          </span>
                          {message.sender?.type !== 'user' && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                              {message.sender?.name}
                            </span>
                          )}
                        </div>
                      </div>
                      {message.sender?.type === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white overflow-hidden flex-shrink-0">
                          {message.sender?.avatar_url || message.sender?.thumbnail ? (
                            <img 
                              src={message.sender.avatar_url || message.sender.thumbnail} 
                              alt={message.sender.name || 'Avatar'} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            message.sender?.name?.[0]?.toUpperCase() || 'U'
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => document.getElementById('fileInput')?.click()}
                  className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  title="Anexar arquivo"
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
                  placeholder="Digite sua mensagem..."
                  className="flex-1 p-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  disabled={!activeConversation || networkError || authError}
                />
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || !activeConversation || networkError || authError}
                  className={`p-2 rounded-full ${
                    !newMessage.trim() || !activeConversation || networkError || authError
                      ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600'
                  }`}
                  title="Enviar mensagem"
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