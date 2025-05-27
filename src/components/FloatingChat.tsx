import React, { useState, useEffect, useRef } from 'react';
import {Send, Minimize2, Maximize2, Phone, Loader2, AlertCircle, WifiOff, X, Mic, Image, Paperclip } from 'lucide-react';
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

type Message = {
  id: number;
  content: string;
  created_at: string;
  message_type: 'incoming' | 'outgoing';
  sender?: {
    name?: string;
  };
  content_type?: string;
  status?: string;
};

type Conversation = {
  id: number;
  messages: Message[];
};

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
  const [files, setFiles] = useState<File[]>([]);
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
      console.error('API request failed:', error);
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

      // Primeiro, verificar se já temos uma conversa ativa para este número
      const existingConversation = storageConversations.find(
        sc => sc.user.phone_number === formattedNumber
      );

      if (existingConversation) {
        console.log('Found existing conversation in storage:', existingConversation);
        setContact(existingConversation.user);
        setActiveConversation({
          id: existingConversation.conversationId,
          messages: []
        });
        await loadConversationMessages(existingConversation.conversationId);
        setLoading(false);
        return;
      }

      // Se não encontrou na storage, buscar no servidor
      const contactsResponse = await api.post(`/api/v1/accounts/${accountId}/contacts/filter`, {
        payload: [
          {
            attribute_key: "phone_number",
            filter_operator: "equal_to",
            values: [formattedNumber]
          }
        ]
      });

      if (contactsResponse.data?.payload?.[0]) {
        const user = contactsResponse.data.payload[0];
        
        const contactData = {
          id: user.id,
          name: user.name,
          phone_number: user.phone_number,
          thumbnail: user.thumbnail || '',
          source_id: user.contact_inboxes?.[0]?.source_id || '',
          availability_status: user.availability_status || 'offline',
          last_seen_at: user.last_activity_at ? new Date(user.last_activity_at * 1000).toISOString() : ''
        };
        
        console.log('Setting contact data:', contactData);
        setContact(contactData);

        // Buscar todas as conversas existentes para o contato no inbox selecionado
        const conversationsResponse = await api.get(`/api/v1/accounts/${accountId}/conversations`, {
          params: {
            inbox_id: inboxId,
            q: user.id
          }
        });

        console.log('All conversations response:', conversationsResponse.data);

        if (conversationsResponse.data?.payload?.length > 0) {
          // Ordenar conversas por data de criação (mais recente primeiro)
          const sortedConversations = conversationsResponse.data.payload.sort((a: any, b: any) => {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });

          // Usar a conversa mais recente
          const latestConversation = sortedConversations[0];
          console.log('Using latest conversation:', latestConversation.id);
          
          // Verificar se a conversa já existe na storage
          const existingStorageConversation = storageConversations.find(
            sc => sc.conversationId === latestConversation.id
          );

          if (!existingStorageConversation) {
            setStorageConversations(prev => [
              ...prev,
              {
                user: contactData,
                conversationId: latestConversation.id
              }
            ]);
          }

          setActiveConversation({
            id: latestConversation.id,
            messages: []
          });

          // Carregar mensagens da conversa
          await loadConversationMessages(latestConversation.id);
        } else {
          console.log('No existing conversation found, creating new one');
          // Criar nova conversa
          const conversationResponse = await api.post(`/api/v1/accounts/${accountId}/conversations`, {
            source_id: contactData.phone_number,
            inbox_id: inboxId.toString(),
            contact_id: contactData.id.toString()
          });

          if (conversationResponse.data?.id) {
            const conversation = conversationResponse.data;
            console.log('Created new conversation:', conversation.id);
            
            setStorageConversations(prev => [
              ...prev,
              {
                user: contactData,
                conversationId: conversation.id
              }
            ]);

            setActiveConversation({
              id: conversation.id,
              messages: []
            });
          }
        }
      } else {
        // Criar novo contato
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
          
          const contactData = {
            id: newContact.id,
            name: newContact.name,
            phone_number: newContact.phone_number,
            thumbnail: newContact.thumbnail || '',
            source_id: newContact.contact_inboxes?.[0]?.source_id || '',
            availability_status: newContact.availability_status || 'offline',
            last_seen_at: newContact.last_activity_at ? new Date(newContact.last_activity_at * 1000).toISOString() : ''
          };
          
          console.log('Setting new contact data:', contactData);
          setContact(contactData);

          // Criar conversa para o novo contato
          const conversationResponse = await api.post(`/api/v1/accounts/${accountId}/conversations`, {
            source_id: contactNumber,
            inbox_id: inboxId.toString(),
            contact_id: newContact.id.toString()
          });
          
          if (conversationResponse.data?.id) {
            const conversation = conversationResponse.data;
            setStorageConversations(prev => [
              ...prev,
              {
                user: contactData,
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
          sender: msg.sender,
          content_type: msg.content_type,
          status: msg.status
        }));

        setMessages(formattedMessages);
        
        // Atualizar as mensagens na conversa ativa
        setActiveConversation(prev => {
          if (!prev) return null;
          return {
            ...prev,
            messages: formattedMessages
          };
        });

        // Scroll para a última mensagem
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

  const sendMessage = async () => {
    console.log('Attempting to send message...');
    console.log('Current state:', {
      newMessage,
      activeConversation,
      contact,
      accountId: searchParams.get('account_id') || localStorage.getItem('account_id'),
      apiKey: localStorage.getItem('wiseapp_token')
    });
    
    if (!newMessage.trim()) {
      console.log('Message is empty');
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

      const api = axios.create({
        baseURL: '/api',
        headers: {
          'api_access_token': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      let conversationId = activeConversation?.id;

      // Se não houver conversa ativa, buscar ou criar uma
      if (!conversationId && contact) {
        console.log('No active conversation, searching for existing one...');
        
        // Buscar conversas existentes para o contato
        const conversationsResponse = await api.get(`/api/v1/accounts/${accountId}/conversations`, {
          params: {
            inbox_id: selectedInboxId,
            q: contact.id
          }
        });

        if (conversationsResponse.data?.payload?.[0]) {
          // Usar conversa existente
          const existingConversation = conversationsResponse.data.payload[0];
          conversationId = existingConversation.id;
          console.log('Found existing conversation:', conversationId);

          setActiveConversation({
            id: conversationId,
            messages: []
          });

          // Atualizar storageConversations
          setStorageConversations(prev => [
            ...prev,
            {
              user: contact,
              conversationId: conversationId
            }
          ]);

          // Carregar mensagens existentes
          await loadConversationMessages(conversationId);
        } else {
          console.log('No existing conversation found, creating new one...');
          
          // Criar nova conversa
          const conversationResponse = await api.post(`/api/v1/accounts/${accountId}/conversations`, {
            source_id: contact.phone_number,
            inbox_id: selectedInboxId?.toString(),
            contact_id: contact.id.toString()
          });

          if (conversationResponse.data?.id) {
            conversationId = conversationResponse.data.id;
            console.log('Created new conversation:', conversationId);

            setActiveConversation({
              id: conversationId,
              messages: []
            });

            // Atualizar storageConversations
            setStorageConversations(prev => [
              ...prev,
              {
                user: contact,
                conversationId: conversationId
              }
            ]);
          } else {
            throw new Error('Falha ao criar conversa');
          }
        }
      }

      if (!conversationId) {
        throw new Error('Não foi possível criar ou encontrar uma conversa');
      }

      const textData = newMessage;
      console.log('Sending message:', textData);

      // Adicionar mensagem temporária
      const tempMessage: Message = {
        id: Date.now(),
        content: textData,
        created_at: new Date().toISOString(),
        message_type: 'outgoing',
      };

      setActiveConversation(prev => ({
        ...prev!,
        messages: [...prev!.messages, tempMessage],
      }));

      // Enviar mensagem
      console.log('Making API request to:', `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`);
      const response = await api.post(`/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`, {
        content: textData,
        message_type: 'outgoing'
      });

      console.log('Message sent successfully:', response.data);

      // Limpar o input após o envio bem-sucedido
      setNewMessage('');
      if (inputRef.current) {
        inputRef.current.value = '';
      }

      if (response.data) {
        // Recarregar mensagens após envio
        await loadConversationMessages(conversationId);

        // Scroll para a última mensagem
        setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      }

    } catch (error) {
      console.error('Error in sendMessage:', error);
      let errorMessage = 'Falha ao enviar mensagem';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (axios.isAxiosError(error)) {
        errorMessage = error.response?.data?.message || error.message;
      }
      
      setError(errorMessage);
      
      // Remover mensagem temporária em caso de erro
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles || !activeConversation) return;

    try {
      const accountId = searchParams.get('account_id') || localStorage.getItem('account_id');
      const apiKey = localStorage.getItem('wiseapp_token');

      if (!accountId || !apiKey) {
        throw new Error('Configuração inválida');
      }

      const formData = new FormData();
      formData.append('Url', `/api/v1/accounts/${accountId}/conversations/${activeConversation.id}/messages`);
      formData.append('Method', 'POST');
      formData.append('Headers[api_access_token]', apiKey);

      Array.from(uploadedFiles).forEach(file => {
        formData.append('Files', file);
      });

      if (newMessage.trim()) {
        formData.append('Params[content]', newMessage.trim());
        setNewMessage('');
      }

      const api = axios.create({
        baseURL: '/api',
        headers: {
          'api_access_token': apiKey,
          'Content-Type': 'multipart/form-data',
          'Accept': 'application/json'
        }
      });

      await api.post(`/api/v1/accounts/${accountId}/conversations/${activeConversation.id}/messages`, formData);
      await loadConversationMessages(activeConversation.id);

      // Limpar o input de arquivo
      event.target.value = '';

      // Scroll para a última mensagem
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);

    } catch (error) {
      console.error('Error uploading files:', error);
      setError('Falha ao enviar arquivo');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const audioChunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const accountId = searchParams.get('account_id') || localStorage.getItem('account_id');
        const apiKey = localStorage.getItem('wiseapp_token');

        if (!accountId || !apiKey || !activeConversation) return;

        try {
          const formData = new FormData();
          formData.append('Url', `/api/v1/accounts/${accountId}/conversations/${activeConversation.id}/messages`);
          formData.append('Method', 'POST');
          formData.append('Headers[api_access_token]', apiKey);
          formData.append('Files', audioBlob, 'audio.wav');

          if (newMessage.trim()) {
            formData.append('Params[content]', newMessage.trim());
            setNewMessage('');
          }

          const api = axios.create({
            baseURL: '/api',
            headers: {
              'api_access_token': apiKey,
              'Content-Type': 'multipart/form-data',
              'Accept': 'application/json'
            }
          });

          await api.post(`/api/v1/accounts/${accountId}/conversations/${activeConversation.id}/messages`, formData);
          await loadConversationMessages(activeConversation.id);

          // Limpar estado de gravação
          setIsRecording(false);
          setRecordingTime(0);
          if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
          }

          // Scroll para a última mensagem
          setTimeout(() => {
            if (messagesEndRef.current) {
              messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
            }
          }, 100);

        } catch (error) {
          console.error('Error sending audio:', error);
          setError('Falha ao enviar áudio');
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      setError('Falha ao iniciar gravação');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
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

    // Carregar conversas salvas do localStorage
    const savedConversations = localStorage.getItem('chat_conversations');
    if (savedConversations) {
      try {
        const parsedConversations = JSON.parse(savedConversations);
        setStorageConversations(parsedConversations);
      } catch (error) {
        console.error('Error loading saved conversations:', error);
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).userInChat;
      }
    };
  }, []);

  // Salvar conversas no localStorage quando houver mudanças
  useEffect(() => {
    if (storageConversations.length > 0) {
      localStorage.setItem('chat_conversations', JSON.stringify(storageConversations));
    }
  }, [storageConversations]);

  useEffect(() => {
    if (activeConversation?.id) {
      console.log('Conversation changed, loading messages for:', activeConversation.id);
      loadConversationMessages(activeConversation.id);
    }
  }, [activeConversation?.id]);

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
    <div
      className={`fixed z-[9999] transition-all duration-300 ${
        minimized
          ? 'bottom-4 right-4 w-auto h-auto'
          : 'bottom-4 right-4 w-[320px] h-[480px] sm:w-[350px] sm:h-[500px] md:w-[380px] md:h-[550px] lg:w-[400px] lg:h-[600px]'
      }`}
    >
      {showInboxSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-[90%] max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Selecione o Canal de Atendimento
            </h3>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {availableInboxes.map((inbox) => (
                <button
                  key={inbox.id}
                  onClick={() => handleInboxSelection(inbox.id)}
                  className={`w-full p-3 rounded-lg text-left transition-colors ${
                    inbox.isOpen
                      ? 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                      : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700/70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {inbox.avatar_url ? (
                      <img
                        src={inbox.avatar_url}
                        alt={inbox.name}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                        <span className="text-lg font-semibold text-gray-600 dark:text-gray-300">
                          {inbox.name[0]}
                        </span>
                      </div>
                    )}
                    <div className="flex-grow">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {inbox.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {inbox.isOpen ? (
                          <span className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full" />
                            Aberto
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full" />
                            Fechado
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {minimized ? (
        <button
          onClick={toggleMinimize}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        >
          <Phone className="w-5 h-5" />
          <span className="max-w-[150px] truncate">{contact?.name || formatPhoneNumber(contact?.phone_number || '') || 'Chat'}</span>
          <Maximize2 className="w-4 h-4 ml-1" />
        </button>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between p-2.5 sm:p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                {contact?.thumbnail ? (
                  <img
                    src={contact.thumbnail}
                    alt={contact.name || 'Avatar'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-base sm:text-lg font-semibold text-gray-500 dark:text-gray-400">
                    {contact?.name?.[0]?.toUpperCase() || contact?.phone_number?.[0] || '?'}
                  </div>
                )}
                {contact?.availability_status === 'online' && (
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800" />
                )}
              </div>
              <div className="min-w-0">
                <div className="font-medium text-gray-900 dark:text-white text-sm sm:text-base truncate">
                  {contact?.name || formatPhoneNumber(contact?.phone_number || '') || 'Chat'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 sm:gap-2">
                  {contact?.phone_number && (
                    <span className="flex items-center">
                      <Phone className="w-3 h-3 mr-1" />
                      <span className="truncate">{formatPhoneNumber(contact.phone_number)}</span>
                    </span>
                  )}
                  {contact?.availability_status === 'online' ? (
                    <span className="flex items-center text-green-500">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-1" />
                      Online
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <div className="w-2 h-2 bg-gray-400 rounded-full mr-1" />
                      Offline
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={toggleMinimize}
                className="p-1 sm:p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                aria-label="Minimize"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowChat(false)}
                className="p-1 sm:p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-grow overflow-y-auto p-3 sm:p-4 bg-gray-50 dark:bg-gray-900">
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full text-red-500 dark:text-red-400 p-3 sm:p-4 text-center">
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
              activeConversation.messages.map((msg, i) => {
                const isOutgoing = msg.message_type === 'outgoing';
                return (
                  <div
                    key={msg.id || i}
                    className={`mb-3 sm:mb-4 flex ${
                      isOutgoing ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div className={`max-w-[85%] sm:max-w-[80%] flex flex-col ${
                      isOutgoing ? 'items-end' : 'items-start'
                    }`}>
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-sm sm:text-base relative ${
                          isOutgoing
                            ? 'bg-blue-500 text-white rounded-tr-none'
                            : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-tl-none shadow-sm'
                        }`}
                      >
                        {msg.content_type === 'audio' ? (
                          <div className="flex items-center gap-2 min-w-[200px]">
                            <audio controls className="w-full">
                              <source src={msg.content} type="audio/wav" />
                              Seu navegador não suporta o elemento de áudio.
                            </audio>
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                        )}
                      </div>
                      <div
                        className={`text-xs mt-1 flex items-center gap-1 ${
                          isOutgoing
                            ? 'text-gray-500 dark:text-gray-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        <span>{formatTime(msg.created_at)}</span>
                        {isOutgoing && (
                          <span className="flex items-center">
                            {msg.status === 'sent' && (
                              <span className="text-gray-400">✓</span>
                            )}
                            {msg.status === 'delivered' && (
                              <span className="text-gray-400">✓✓</span>
                            )}
                            {msg.status === 'read' && (
                              <span className="text-blue-500">✓✓</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 text-sm sm:text-base">
                <p>Nenhuma mensagem ainda</p>
                <p className="text-xs sm:text-sm mt-1">
                  Envie uma mensagem para iniciar a conversa
                </p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-2.5 sm:p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                console.log('Form submitted');
                if (newMessage.trim()) {
                  sendMessage();
                }
              }}
              className="flex items-center gap-2"
            >
              <div className="flex-grow flex items-center gap-1.5 sm:gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 min-w-0">
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      console.log('Enter pressed');
                      if (newMessage.trim()) {
                        sendMessage();
                      }
                    }
                  }}
                  placeholder="Digite sua mensagem..."
                  className="flex-grow bg-transparent border-none focus:outline-none focus:ring-0 dark:text-white text-sm sm:text-base min-w-0"
                />
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="fileInput"
                    accept="image/*"
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('fileInput')?.click()}
                    className="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 shrink-0"
                    title="Enviar imagem"
                  >
                    <Image className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => document.getElementById('fileInput')?.click()}
                    className="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 shrink-0"
                    title="Enviar arquivo"
                  >
                    <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  {isRecording ? (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="p-1.5 sm:p-2 text-red-500 hover:text-red-700 dark:hover:text-red-400 shrink-0"
                      title="Parar gravação"
                    >
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-xs">{formatRecordingTime(recordingTime)}</span>
                      </div>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startRecording}
                      className="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 shrink-0"
                      title="Gravar áudio"
                    >
                      <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  )}
                </div>
              </div>
              <button
                type="submit"
                disabled={!newMessage.trim()}
                onClick={(e) => {
                  e.preventDefault();
                  if (newMessage.trim()) {
                    sendMessage();
                  }
                }}
                className="p-1.5 sm:p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shrink-0 min-w-[40px]"
              >
                <Send className="w-4 h-4 sm:w-5 sm:h-5" />
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