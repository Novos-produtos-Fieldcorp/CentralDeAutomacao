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
}

type Conversation = {
  id: number;
  messages: Message[];
};

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

    // Initial check
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
            // Invalid data, remove it
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
      console.log('Fetching inboxes for account:', accountId);
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
        console.log('All inboxes:', response.data.payload);
        setInboxes(response.data.payload);
        
        // Função para verificar se o inbox está em horário de funcionamento
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

        // Mapear todas as inboxes com status de funcionamento
        const allInboxes = response.data.payload.map((inbox: any) => ({
          ...inbox,
          isOpen: isInboxOpen(inbox)
        }));

        console.log('All inboxes with status:', allInboxes);
        setAvailableInboxes(allInboxes);

        // Se houver apenas um inbox, seleciona automaticamente
        if (allInboxes.length === 1) {
          console.log('Auto-selecting single inbox:', allInboxes[0].id);
          setSelectedInboxId(allInboxes[0].id);
          return allInboxes[0].id;
        }

        // Se houver mais de um inbox, mostra o seletor
        if (allInboxes.length > 1) {
          console.log('Showing inbox selector with options:', allInboxes.map((inbox: any) => inbox.id));
          setShowInboxSelector(true);
          return null;
        }

        console.log('No inboxes available');
        return null;
      }
      return null;
    } catch (error) {
      console.error('Error fetching inboxes:', error);
      return null;
    }
  };

  const handleInboxSelection = async (inboxId: number) => {
    try {
      console.log('Handling inbox selection:', inboxId);
      setLoading(true);
      setSelectedInboxId(inboxId);
      setShowInboxSelector(false);

      const accountId = searchParams.get('account_id') || localStorage.getItem('account_id');
      const apiKey = localStorage.getItem('wiseapp_token');

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

      // Se já temos um contato, usamos ele
      if (contact?.phone_number) {
        const formattedNumber = formatPhoneNumber(contact.phone_number);
        console.log('Using existing contact:', contact.id);
        
        // Buscar conversas existentes
        const conversationsResponse = await api.get(`/api/v1/accounts/${accountId}/conversations`, {
          params: {
            inbox_id: inboxId,
            q: contact.id
          }
        });

        console.log('Conversations response:', conversationsResponse.data);

        if (conversationsResponse.data?.payload?.[0]) {
          const conversation = conversationsResponse.data.payload[0];
          console.log('Found existing conversation:', conversation.id);
          
          setStorageConversations(prev => [
            ...prev,
            {
              user: contact,
              conversationId: conversation.id
            }
          ]);

          setActiveConversation({
            id: conversation.id,
            messages: []
          });
          await loadConversationMessages(conversation.id);
        } else {
          console.log('No existing conversation found, creating new one');
          // Criar nova conversa
          const conversationResponse = await api.post(`/api/v1/accounts/${accountId}/conversations`, {
            source_id: contact.phone_number,
            inbox_id: inboxId.toString(),
            contact_id: contact.id.toString()
          });

          console.log('New conversation response:', conversationResponse.data);

          if (conversationResponse.data?.id) {
            const conversation = conversationResponse.data;
            console.log('Created new conversation:', conversation.id);
            
            setStorageConversations(prev => [
              ...prev,
              {
                user: contact,
                conversationId: conversation.id
              }
            ]);

            setActiveConversation({
              id: conversation.id,
              messages: []
            });
            await loadConversationMessages(conversation.id);
          }
        }
      } else if (initialPhone) {
        // Se não temos contato mas temos um número inicial, primeiro verificamos se o contato já existe
        const formattedNumber = formatPhoneNumber(initialPhone);
        
        // Buscar contato existente
        const contactsResponse = await api.post(`/api/v1/accounts/${accountId}/contacts/filter`, {
          payload: [
            {
              attribute_key: "phone_number",
              filter_operator: "equal_to",
              values: [formattedNumber]
            }
          ]
        });

        let contactToUse;

        if (contactsResponse.data?.payload?.[0]) {
          // Se encontrou o contato, usa ele
          const existingContact = contactsResponse.data.payload[0];
          contactToUse = {
            id: existingContact.id,
            name: existingContact.name,
            phone_number: existingContact.phone_number,
            thumbnail: existingContact.thumbnail || '',
            source_id: existingContact.contact_inboxes?.[0]?.source_id || '',
            availability_status: existingContact.availability_status || 'offline',
            last_seen_at: existingContact.last_activity_at ? new Date(existingContact.last_activity_at * 1000).toISOString() : ''
          };
        } else {
          // Se não encontrou, cria um novo contato
          const contactNumber = `+${formattedNumber}`;
          const contactNameToUse = additionalInfo?.name || initialName || formattedNumber;
          const contactEmail = additionalInfo?.email || initialEmail;

          const newContactResponse = await api.post(`/api/v1/accounts/${accountId}/contacts`, {
            name: contactNameToUse,
            email: contactEmail,
            inbox_id: inboxId,
            source_id: contactNumber,
            phone_number: contactNumber,
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
              thumbnail: newContactResponse.data.thumbnail || '',
              source_id: newContactResponse.data.contact_inboxes?.[0]?.source_id || '',
              availability_status: newContactResponse.data.availability_status || 'offline',
              last_seen_at: newContactResponse.data.last_activity_at ? new Date(newContactResponse.data.last_activity_at * 1000).toISOString() : ''
            };
          }
        }

        if (contactToUse) {
          setContact(contactToUse);

          // Buscar ou criar conversa
          const conversationsResponse = await api.get(`/api/v1/accounts/${accountId}/conversations`, {
            params: {
              inbox_id: inboxId,
              q: contactToUse.id
            }
          });

          if (conversationsResponse.data?.payload?.[0]) {
            const conversation = conversationsResponse.data.payload[0];
            setStorageConversations(prev => [
              ...prev,
              {
                user: contactToUse,
                conversationId: conversation.id
              }
            ]);

            setActiveConversation({
              id: conversation.id,
              messages: []
            });
            await loadConversationMessages(conversation.id);
          } else {
            // Criar nova conversa
            const conversationResponse = await api.post(`/api/v1/accounts/${accountId}/conversations`, {
              source_id: contactToUse.phone_number,
              inbox_id: inboxId.toString(),
              contact_id: contactToUse.id.toString()
            });

            if (conversationResponse.data?.id) {
              const conversation = conversationResponse.data;
              setStorageConversations(prev => [
                ...prev,
                {
                  user: contactToUse,
                  conversationId: conversation.id
                }
              ]);

              setActiveConversation({
                id: conversation.id,
                messages: []
              });
            }
          }
        }
      } else {
        throw new Error('Nenhum número de telefone disponível para criar o contato');
      }
    } catch (error) {
      console.error('Error in handleInboxSelection:', error);
      setError(
        error instanceof Error ? error.message : 'Falha ao processar seleção do inbox'
      );
    } finally {
      setLoading(false);
    }
  };

  const userInChat = async (phoneNumber: string, contactName?: string) => {
    try {
      setLoading(true);
      setError(null);
      setAuthError(false);
      setNetworkError(false);
      setShowChat(true);
      // Limpar estados anteriores
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

      // Buscar inboxes primeiro
      const inboxId = await fetchInboxes(accountId, apiKey);
      
      // Se retornar null, significa que precisa selecionar um inbox
      if (inboxId === null) {
        setLoading(false);
        return;
      }

      const formattedNumber = formatPhoneNumber(phoneNumber);

      // Configure axios instance
      const api = axios.create({
        baseURL: '/api',
        headers: {
          'api_access_token': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      // Buscar contato no servidor
      const contactsResponse = await api.post(`/api/v1/accounts/${accountId}/contacts/filter`, {
        payload: [
          {
            attribute_key: "phone_number",
            filter_operator: "equal_to",
            values: [formattedNumber]
          }
        ]
      });

      let contactData;
      if (contactsResponse.data?.payload?.[0]) {
        const user = contactsResponse.data.payload[0];
        contactData = {
          id: user.id,
          name: user.name,
          phone_number: user.phone_number,
          thumbnail: user.avatar_url || user.thumbnail || '',
          source_id: user.contact_inboxes?.[0]?.source_id || '',
          availability_status: user.availability_status || 'offline',
          last_seen_at: user.last_activity_at ? new Date(user.last_activity_at * 1000).toISOString() : ''
        };
      } else {
        // Criar novo contato se não existir
        const contactNumber = `+${formattedNumber}`;
        const contactNameToUse = additionalInfo?.name || contactName || formatPhoneNumber(formattedNumber);
        const contactEmail = additionalInfo?.email || initialEmail;

        const newContactResponse = await api.post(`/api/v1/accounts/${accountId}/contacts`, {
          name: contactNameToUse,
          email: contactEmail,
          inbox_id: inboxId,
          source_id: contactNumber,
          phone_number: contactNumber,
          custom_attributes: {
            source: "web_chat",
            source_type: sourceType || 'web',
            ...additionalInfo
          }
        });
        
        if (newContactResponse.data) {
          const newContact = newContactResponse.data;
          contactData = {
            id: newContact.id,
            name: newContact.name,
            phone_number: newContact.phone_number,
            thumbnail: newContact.avatar_url || newContact.thumbnail || '',
            source_id: newContact.contact_inboxes?.[0]?.source_id || '',
            availability_status: newContact.availability_status || 'offline',
            last_seen_at: newContact.last_activity_at ? new Date(newContact.last_activity_at * 1000).toISOString() : ''
          };
        }
      }

      if (contactData) {
        console.log('Setting contact data:', contactData);
        setContact(contactData);

        // Buscar todas as conversas existentes para o contato
        const conversationsResponse = await api.get(`/api/v1/accounts/${accountId}/conversations`, {
          params: {
            q: contactData.id
          }
        });

        console.log('All conversations response:', conversationsResponse.data);

        if (conversationsResponse.data?.payload?.length > 0) {
          // Buscar mensagens para cada conversa
          const conversationsWithMessages = await Promise.all(
            conversationsResponse.data.payload.map(async (conversation: any) => {
              const messagesResponse = await api.get(
                `/api/v1/accounts/${accountId}/conversations/${conversation.id}/messages`
              );
              return {
                ...conversation,
                hasMessages: messagesResponse.data?.payload?.length > 0,
                messageCount: messagesResponse.data?.payload?.length || 0
              };
            })
          );

          // Ordenar conversas por: 1) tem mensagens, 2) data de criação
          const sortedConversations = conversationsWithMessages.sort((a, b) => {
            if (a.hasMessages && !b.hasMessages) return -1;
            if (!a.hasMessages && b.hasMessages) return 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });

          // Usar a primeira conversa que tem mensagens ou a mais recente
          const selectedConversation = sortedConversations[0];
          console.log('Selected conversation:', selectedConversation);

          setActiveConversation({
            id: selectedConversation.id,
            messages: []
          });

          // Carregar mensagens da conversa
          await loadConversationMessages(selectedConversation.id);
        } else {
          console.log('No existing conversation found, creating new one');
          // Criar nova conversa apenas se não existir nenhuma
          const conversationResponse = await api.post(`/api/v1/accounts/${accountId}/conversations`, {
            source_id: contactData.phone_number,
            inbox_id: inboxId.toString(),
            contact_id: contactData.id.toString()
          });

          if (conversationResponse.data?.id) {
            const conversation = conversationResponse.data;
            console.log('Created new conversation:', conversation.id);

            setActiveConversation({
              id: conversation.id,
              messages: []
            });
          }
        }
      } else {
        throw new Error('Falha ao criar ou encontrar o contato');
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

  const loadConversationMessages = async (conversationId: number) => {
    try {
      console.log('Loading messages for conversation:', conversationId);
      const accountId = searchParams.get('account_id') || localStorage.getItem('account_id');
      const apiKey = localStorage.getItem('wiseapp_token');

      if (!accountId || !apiKey) {
        console.error('Missing accountId or apiKey');
        return;
      }

      const api = axios.create({
        baseURL: '/api',
        headers: {
          'api_access_token': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      console.log('Fetching messages from:', `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`);
      const response = await api.get(`/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`);
      
      if (response.data?.payload) {
        console.log('Messages loaded:', response.data.payload);
        const formattedMessages = response.data.payload.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          created_at: msg.created_at,
          message_type: msg.message_type,
          content_type: msg.content_type,
          status: msg.status
        }));

        console.log('Formatted messages:', formattedMessages);
        
        // Update both messages state and active conversation
        setMessages(formattedMessages);
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

        // Clear any files that might be in the upload queue
        setFiles([]);

        // Scroll to the last message after a short delay
        setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setError(
        error instanceof Error ? error.message : 'Falha ao carregar mensagens'
      );
    }
  };

  const formatPhoneNumber = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');

    if (!digits.startsWith('55') && digits.length <= 11) {
      return `55${digits}`;
    }

    return `${digits}`;
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.error('Invalid date:', dateString);
        return '';
      }
      return new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
        hourCycle: 'h23'
      }).format(date);
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };

  const formatDate = (date: Date) => {
    return date.toISOString();
  };

  const createFile = (blob: Blob, filename: string, type: string): File => {
    return new (File as any)([blob], filename, { type });
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) {
      return;
    }

    try {
      setError(null);
      setAuthError(false);
      setNetworkError(false);

      if (!checkNetworkConnectivity()) {
        setNetworkError(true);
        throw new Error('Sem conexão de rede disponível');
      }

      const accountId = searchParams.get('account_id') || localStorage.getItem('account_id');
      const apiKey = localStorage.getItem('wiseapp_token');

      if (!accountId || !apiKey) {
        throw new Error('Configuração inválida');
      }

      if (!activeConversation?.id) {
        throw new Error('Conversa não encontrada');
      }

      const textData = newMessage.trim();
      
      // Add temporary message
      const tempMessage: Message = {
        id: Date.now(),
        content: textData,
        created_at: formatDate(new Date()),
        message_type: 'outgoing',
        content_type: 'text',
        status: 'sending'
      };

      setActiveConversation(prev => {
        if (!prev) return null;
        return {
          ...prev,
          messages: [...prev.messages, tempMessage]
        };
      });

      // Clear input immediately
      setNewMessage('');
      if (inputRef.current) {
        inputRef.current.value = '';
      }

      const api = axios.create({
        baseURL: '/api',
        headers: {
          'api_access_token': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const response = await api.post(`/api/v1/accounts/${accountId}/conversations/${activeConversation.id}/messages`, {
        content: textData,
        message_type: 'outgoing'
      });

      if (response.data) {
        // Update message status
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

        // Reload messages to get final status
        await loadConversationMessages(activeConversation.id);

        // Scroll to last message
        setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      }

    } catch (error) {
      console.error('Error in sendMessage:', error);
      handleError(error);
      
      // Remove temporary message on error
      setActiveConversation(prev => {
        if (!prev) return null;
        return {
          ...prev,
          messages: prev.messages.filter(msg => msg.id !== Date.now())
        };
      });
    }
  };

  const toggleMinimize = () => {
    setMinimized(!minimized);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    try {
      setError(null);
      setAuthError(false);
      setNetworkError(false);

      if (!checkNetworkConnectivity()) {
        setNetworkError(true);
        throw new Error('Sem conexão de rede disponível');
      }

      const accountId = searchParams.get('account_id') || localStorage.getItem('account_id');
      const apiKey = localStorage.getItem('wiseapp_token');

      if (!accountId || !apiKey) {
        throw new Error('Configuração inválida');
      }

      if (!activeConversation?.id) {
        throw new Error('Conversa não encontrada');
      }

      const newFiles: FileWithPreview[] = Array.from(selectedFiles).map(file => ({
        file,
        preview: URL.createObjectURL(file),
        type: file.type.startsWith('image/') ? 'image' : 'file'
      }));

      setFiles(prev => [...prev, ...newFiles]);

      // Clear input
      event.target.value = '';

      // Upload files
      const formData = new FormData();
      newFiles.forEach(({ file }) => {
        formData.append('attachments[]', file);
      });

      const api = axios.create({
        baseURL: '/api',
        headers: {
          'api_access_token': apiKey,
          'Accept': 'application/json'
        }
      });

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
        // Add messages for each file
        const messages: Message[] = newFiles.map(({ file }, index) => ({
          id: response.data[index]?.id || Date.now() + index,
          content: file.name,
          created_at: formatDate(new Date()),
          message_type: 'outgoing',
          content_type: file.type.startsWith('image/') ? 'image' : 'file',
          status: 'sent'
        }));

        setActiveConversation(prev => {
          if (!prev) return null;
          return {
            ...prev,
            messages: [...prev.messages, ...messages]
          };
        });

        // Clear files
        setFiles([]);

        // Reload messages
        await loadConversationMessages(activeConversation.id);

        // Scroll to last message
        setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      }

    } catch (error) {
      console.error('Error uploading files:', error);
      handleError(error);
      
      // Clear files on error
      setFiles([]);
    }
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

      const accountId = searchParams.get('account_id') || localStorage.getItem('account_id');
      const apiKey = localStorage.getItem('wiseapp_token');

      if (!accountId || !apiKey) {
        throw new Error('Configuração inválida');
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

            // Add temporary message
            const tempMessage: Message = {
              id: Date.now(),
              content: 'Mensagem de voz',
              created_at: formatDate(new Date()),
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

            // Upload audio file
            const formData = new FormData();
            formData.append('attachments[]', audioFile);

            const api = axios.create({
              baseURL: '/api',
              headers: {
                'api_access_token': apiKey,
                'Accept': 'application/json'
              }
            });

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
              // Update message status
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

              // Reload messages
              await loadConversationMessages(activeConversation.id);

              // Scroll to last message
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
      
      // Cleanup on error
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
    if (activeConversation?.id) {
      console.log('Conversation changed, loading messages for:', activeConversation.id);
      loadConversationMessages(activeConversation.id);
    }
  }, [activeConversation?.id]);

  useEffect(() => {
    // Save conversations to localStorage when they change
    if (storageConversations.length > 0) {
      try {
        localStorage.setItem('chat_conversations', JSON.stringify(storageConversations));
      } catch (error) {
        console.error('Error saving conversations:', error);
      }
    }
  }, [storageConversations]);

  useEffect(() => {
    // Cleanup function for media recorder
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
    // Cleanup function for file previews
    return () => {
      files.forEach(file => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, [files]);

  useEffect(() => {
    // Cleanup function for intervals
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

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

  console.log('Current contact state:', contact);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {!minimized && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-96 h-[600px] flex flex-col mb-4">
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
          <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={messagesEndRef}>
            {activeConversation?.messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.message_type === 'outgoing' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.message_type === 'outgoing'
                      ? 'bg-blue-500 text-white'
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
                  <span className="text-xs opacity-75 mt-1 block">
                    {formatTime(message.created_at)}
                  </span>
                </div>
              </div>
            ))}
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
                onChange={handleFileSelect}
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
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Digite sua mensagem..."
                className="flex-1 p-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                disabled={!activeConversation || networkError || authError}
              />
              <button
                type="button"
                onClick={sendMessage}
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