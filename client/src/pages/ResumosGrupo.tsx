import React, { useState, useEffect } from 'react';
import { Plus, Loader2, Calendar, MessagesSquare, Trash2, BarChart2, Clock, Link2, Send, Edit2, AlertTriangle, CheckCircle2, XCircle, Settings, Smartphone, LayoutList, History, Users, Bell, FileText, Home, Truck, Gauge, ClipboardCheck, Store, Mail, Phone, Map, Star, Heart, Bookmark, Flag, Award, Zap, Briefcase, Coffee, Compass, Database, Headphones, Image, Key, Layers, Music, Package, Printer, Radio, Shield, ShoppingBag, Smile, Sun, Terminal, Umbrella, Video, Wifi, Activity, Anchor, Archive, AtSign, Battery, Book, Box, Camera, Cast, Cloud, Code, Command, Copy, CreditCard, Disc, Download, Droplet, Eye, Facebook, Film, Filter, Folder, Gift, GitBranch, Globe, Grid, HardDrive, Hash, Instagram, Laptop, Leaf, LifeBuoy, Link, Linkedin, List, Lock, Maximize, Menu, MessageCircle, Mic, Monitor, Moon, Move, Navigation, Octagon, Paperclip, Pause, Percent, Play, Power, RefreshCw as Refresh, RotateCcw, Save, Search, Server, Share, ShoppingCart, Slash, Sliders, Speaker, Square, Tag, Target, ThumbsUp, Trash, Twitter, Upload, User, Voicemail, Volume, Watch, Wind, Youtube, Info } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../lib/api-config-supabase';
import { useCompanyData } from '../hooks/useCompanyData';
import { useCurrentAccount } from '../hooks/useCurrentAccount';
import { useWiseAppAccess } from '../context/WiseAppAccessContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { format, parseISO, subHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import TimeDebugModal from '../components/TimeDebugModal';
import { convertBrasiliaToUTC, convertUTCToBrasilia } from '../utils/time';
import Pagination from '../components/Pagination';

interface GrupoResumo {
  id: number;
  nome_grupo: string;
  horario: string;
  ativo: boolean;
  company_id: number;
  icon_name?: string;
  color_name?: string;
  inbox_id?: number;
  nome_inbox?: string;
  account_id?: number;
  tipo?: string;
  conv_id?: number;
  contact_name?: string;
}

interface EnvioResumo {
  id: number;
  grupo_id: number;
  data_envio: string;
  created_at?: string;
  status: boolean;
  mensagem: string;
  resumo_grupo?: string;
  tipo?: string;
  grupo?: {
    nome_grupo: string;
  };
}

interface Inbox {
  id: number;
  name: string;
  channel_type: string;
  phone_number?: string;
}

interface WiseAppContact {
  id: number;
  name: string;
  phone_number?: string;
  email?: string;
}

interface WiseAppConversation {
  id: number;
  inbox_id: number;
  status: string;
  meta?: {
    sender?: {
      name?: string;
    };
  };
  created_at?: string;
  messages_count?: number;
}

const AI_SUMMARY_URL = `${API_BASE_URL}/ai/group-summary`;
const AI_CONV_SUMMARY_URL = `${API_BASE_URL}/ai/conversation-summary`;

const ResumosGrupo = () => {
  const [searchParams] = useSearchParams();
  const { query, companyId: legacyCompanyId } = useCompanyData();
  const { accountId: hookAccountId, companyId } = useCurrentAccount();
  const effectiveCompanyId = companyId || legacyCompanyId;
  const { token: wiseAppToken } = useWiseAppAccess();

  // AccountId: URL/localStorage primeiro (como FloatingChat), depois hook para carregar inboxes ao criar/editar grupo
  const accountId = searchParams.get("account_id")
    || (typeof localStorage !== 'undefined' ? localStorage.getItem("account_id") : null)
    || hookAccountId || null;
  const [loading, setLoading] = useState(true);
  const [grupos, setGrupos] = useState<GrupoResumo[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isTimeDebugModalOpen, setIsTimeDebugModalOpen] = useState(false);
  const [selectedGrupo, setSelectedGrupo] = useState<GrupoResumo | null>(null);
  const [formData, setFormData] = useState({
    nome_grupo: '',
    horario: '08:00',
    ativo: true,
    icon_name: 'MessagesSquare',
    color_name: 'blue',
    inbox_id: null as number | null,
    nome_inbox: '',
    account_id: null as number | null
  });
  const [availableInboxes, setAvailableInboxes] = useState<Inbox[]>([]);
  const [loadingInboxes, setLoadingInboxes] = useState(false);
  const [modalAccounts, setModalAccounts] = useState<{ account_id: string; name: string }[]>([]);
  const [loadingModalAccounts, setLoadingModalAccounts] = useState(false);
  const [envios, setEnvios] = useState<Record<number, EnvioResumo[]>>({});
  const [allEnvios, setAllEnvios] = useState<EnvioResumo[]>([]);
  const [loadingEnvios, setLoadingEnvios] = useState<Record<number, boolean>>({});
  const [loadingAllEnvios, setLoadingAllEnvios] = useState(false);
  const [sendingManualSummary, setSendingManualSummary] = useState<Record<number, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<'groups' | 'conversations' | 'emails' | 'history'>('groups');
  const [selectedEnvio, setSelectedEnvio] = useState<EnvioResumo | null>(null);
  const [isEnvioModalOpen, setIsEnvioModalOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });
  const [filteredEnvios, setFilteredEnvios] = useState<EnvioResumo[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [paginatedEnvios, setPaginatedEnvios] = useState<EnvioResumo[]>([]);

  const [conversas, setConversas] = useState<GrupoResumo[]>([]);
  const [emails, setEmails] = useState<GrupoResumo[]>([]);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [contactSearchResults, setContactSearchResults] = useState<WiseAppContact[]>([]);
  const [loadingContactSearch, setLoadingContactSearch] = useState(false);
  const [selectedContact, setSelectedContact] = useState<WiseAppContact | null>(null);
  const [contactConversations, setContactConversations] = useState<WiseAppConversation[]>([]);
  const [loadingContactConversations, setLoadingContactConversations] = useState(false);
  const [emailInboxes, setEmailInboxes] = useState<Inbox[]>([]);
  const [emailConversations, setEmailConversations] = useState<WiseAppConversation[]>([]);
  const [loadingEmailConversations, setLoadingEmailConversations] = useState(false);
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [selectedConvName, setSelectedConvName] = useState('');

  useEffect(() => {
    if (effectiveCompanyId) {
      fetchGrupos();
    }
  }, [effectiveCompanyId]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchAllEnvios();
    }
  }, [activeTab]);

  useEffect(() => {
    // Filter envios based on date range
    if (!allEnvios.length) {
      setFilteredEnvios([]);
      return;
    }

    let filtered = [...allEnvios];

    if (dateFilter.from) {
      const fromDate = new Date(dateFilter.from + 'T00:00:00');
      filtered = filtered.filter(envio => {
        const timestamp = envio.created_at || envio.data_envio;
        const envioDate = new Date(timestamp);
        return envioDate >= fromDate;
      });
    }

    if (dateFilter.to) {
      const toDate = new Date(dateFilter.to + 'T23:59:59');
      filtered = filtered.filter(envio => {
        const timestamp = envio.created_at || envio.data_envio;
        const envioDate = new Date(timestamp);
        return envioDate <= toDate;
      });
    }

    setFilteredEnvios(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [allEnvios, dateFilter]);

  useEffect(() => {
    // Paginate filtered envios
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    setPaginatedEnvios(filteredEnvios.slice(startIndex, endIndex));
  }, [filteredEnvios, currentPage, pageSize]);

  // Load accounts when modal opens
  useEffect(() => {
    if (isAddModalOpen || isEditModalOpen) {
      loadModalAccounts();
    }
  }, [isAddModalOpen, isEditModalOpen]);

  // Load inboxes whenever the modal account changes
  useEffect(() => {
    if ((isAddModalOpen || isEditModalOpen) && formData.account_id) {
      loadInboxesForAccount(String(formData.account_id));
    }
  }, [isAddModalOpen, isEditModalOpen, formData.account_id]);

  const loadModalAccounts = async () => {
    const token = wiseAppToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('wiseapp_token') : null);
    if (!token) return;
    setLoadingModalAccounts(true);
    try {
      const response = await fetch('/api/wiseapp/available-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (response.ok) {
        const data = await response.json();
        setModalAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error('Error loading modal accounts:', error);
    } finally {
      setLoadingModalAccounts(false);
    }
  };

  const loadInboxesForAccount = async (targetAccountId: string) => {
    if (!targetAccountId) return;

    // Get API key for this account from wiseapp_acesso
    let apiKey: string | null = null;
    try {
      const cachedSession = localStorage.getItem('wiseapp_session');
      let userEmail = '';
      if (cachedSession) {
        try { userEmail = JSON.parse(cachedSession).email || ''; } catch {}
      }
      if (userEmail) {
        const { data: accessData } = await supabase
          .from('wiseapp_acesso')
          .select('access_token_wiseapp')
          .eq('email', userEmail)
          .eq('id_conta_wiseapp', targetAccountId)
          .single();
        apiKey = accessData?.access_token_wiseapp || null;
      }
      // Fallback: any valid key for this account
      if (!apiKey) {
        const { data: fallback } = await supabase
          .from('wiseapp_acesso')
          .select('access_token_wiseapp')
          .eq('id_conta_wiseapp', targetAccountId)
          .not('access_token_wiseapp', 'is', null)
          .limit(1)
          .single();
        apiKey = fallback?.access_token_wiseapp || null;
      }
    } catch {}

    // Last resort: use the current global token
    if (!apiKey) {
      apiKey = wiseAppToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('wiseapp_token') : null);
    }

    if (!apiKey) return;

    setLoadingInboxes(true);
    setAvailableInboxes([]);
    try {
      const api = axios.create({
        baseURL: API_BASE_URL,
        headers: {
          api_access_token: apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });
      const response = await api.get(`/v1/accounts/${targetAccountId}/inboxes`);

      if (response.data?.error === 'WiseApp authentication failed') {
        setAvailableInboxes([]);
        return;
      }

      const inboxesData = response.data?.payload ?? response.data?.inboxes ?? response.data;
      if (inboxesData && Array.isArray(inboxesData) && inboxesData.length > 0) {
        setAvailableInboxes(inboxesData.map((inbox: any) => ({
          id: inbox.id,
          name: inbox.name ?? inbox.nome,
          channel_type: inbox.channel_type ?? 'channel',
          phone_number: inbox.phone_number,
        })));
      } else {
        setAvailableInboxes([]);
      }
    } catch (error) {
      console.error('Error loading inboxes:', error);
      setAvailableInboxes([]);
    } finally {
      setLoadingInboxes(false);
    }
  };

  const fetchGrupos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('grupo_resumo')
        .select('*')
        .eq('company_id', effectiveCompanyId)
        .order('nome_grupo');

      if (error) throw error;
      
      const gruposWithLocalTime = (data || []).map(grupo => ({
        ...grupo,
        horario: convertUTCToBrasilia(grupo.horario)
      }));
      
      setGrupos(gruposWithLocalTime.filter(g => !g.tipo || g.tipo === 'grupo'));
      setConversas(gruposWithLocalTime.filter(g => g.tipo === 'conversa'));
      setEmails(gruposWithLocalTime.filter(g => g.tipo === 'email'));
    } catch (error) {
      console.error('Error fetching grupos:', error);
      toast.error('Erro ao carregar grupos');
    } finally {
      setLoading(false);
    }
  };

  const fetchEnvios = async (grupoId: number) => {
    try {
      setLoadingEnvios(prev => ({ ...prev, [grupoId]: true }));
      const { data, error } = await supabase
        .from('envio_resumo')
        .select('*')
        .eq('grupo_id', grupoId)
        .order('data_envio', { ascending: false })
        .limit(10);

      if (error) throw error;
      setEnvios(prev => ({ ...prev, [grupoId]: data || [] }));
    } catch (error) {
      console.error('Error fetching envios:', error);
      toast.error('Erro ao carregar histórico de envios');
    } finally {
      setLoadingEnvios(prev => ({ ...prev, [grupoId]: false }));
    }
  };

  const fetchAllEnvios = async () => {
    try {
      setLoadingAllEnvios(true);
      
      // Try different approach: use raw SQL query to bypass RLS
      const { data, error } = await supabase.rpc('get_envio_resumo_all', {
        p_company_id: effectiveCompanyId
      });

      if (error) {
        // Fallback to regular query if function doesn't exist
        console.log('Using fallback query');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('envio_resumo')
          .select(`
            *,
            grupo:grupo_id (
              nome_grupo
            )
          `)
          .eq('company_id', effectiveCompanyId)
          .order('created_at', { ascending: false })
          .limit(100);
        
        if (fallbackError) throw fallbackError;
        setAllEnvios(fallbackData || []);
      } else {
        // Process the raw data from the SQL function
        const processedData = (data || []).map((item: any) => ({
          ...item,
          grupo: item.grupo_nome ? { nome_grupo: item.grupo_nome } : null
        }));
        setAllEnvios(processedData);
      }
    } catch (error) {
      console.error('Error fetching all envios:', error);
      toast.error('Erro ao carregar histórico de envios');
    } finally {
      setLoadingAllEnvios(false);
    }
  };

  const handleAddGrupo = async () => {
    // Validar campos obrigatórios
    if (!formData.nome_grupo?.trim()) {
      toast.error('Nome do grupo é obrigatório');
      return;
    }
    
    if (!formData.horario) {
      toast.error('Horário é obrigatório');
      return;
    }
    
    if (!formData.inbox_id) {
      toast.error('Caixa de entrada é obrigatória');
      return;
    }

    try {
      // Convert Brasilia time to UTC for storage in the database
      const utcHorario = convertBrasiliaToUTC(formData.horario);
      
      // Prepare insert data
      const insertData: any = {
        nome_grupo: formData.nome_grupo,
        nome_inbox: formData.nome_inbox || formData.nome_grupo,
        horario: utcHorario,
        ativo: formData.ativo,
        icon_name: formData.icon_name,
        color_name: formData.color_name,
        company_id: effectiveCompanyId,
        account_id: formData.account_id || (accountId ? Number(accountId) : null),
        tipo: 'grupo'
      };
      
      // Add inbox_id if selected
      if (formData.inbox_id) {
        insertData.inbox_id = formData.inbox_id;
      }
      
      const { data, error } = await supabase
        .from('grupo_resumo')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      
      // Convert the UTC time back to Brasilia time for display
      const newGrupo = {
        ...data,
        horario: convertUTCToBrasilia(data.horario)
      };
      
      setGrupos([...grupos, newGrupo]);
      setIsAddModalOpen(false);
      resetForm();
      toast.success('Grupo adicionado com sucesso');
    } catch (error) {
      console.error('Error adding grupo:', error);
      toast.error('Erro ao adicionar grupo');
    }
  };

  const handleEditGrupo = async () => {
    if (!selectedGrupo) return;

    // Validar campos obrigatórios
    if (!formData.nome_grupo?.trim()) {
      toast.error('Nome do grupo é obrigatório');
      return;
    }
    
    if (!formData.horario) {
      toast.error('Horário é obrigatório');
      return;
    }
    
    if (!formData.inbox_id) {
      toast.error('Caixa de entrada é obrigatória');
      return;
    }

    try {
      // Convert Brasilia time to UTC for storage in the database
      const utcHorario = convertBrasiliaToUTC(formData.horario);
      
      const updateData: any = {
        nome_grupo: formData.nome_grupo,
        nome_inbox: formData.nome_inbox || formData.nome_grupo,
        horario: utcHorario,
        icon_name: formData.icon_name,
        color_name: formData.color_name,
        account_id: formData.account_id || (accountId ? Number(accountId) : null)
      };
      
      // Add inbox_id if selected
      if (formData.inbox_id) {
        updateData.inbox_id = formData.inbox_id;
      }
      
      const { error } = await supabase
        .from('grupo_resumo')
        .update(updateData)
        .eq('id', selectedGrupo.id);

      if (error) throw error;
      
      setGrupos(grupos.map(grupo => 
        grupo.id === selectedGrupo.id 
          ? { 
              ...grupo, 
              nome_grupo: formData.nome_grupo,
              horario: formData.horario,
              icon_name: formData.icon_name,
              color_name: formData.color_name
            } 
          : grupo
      ));
      
      setIsEditModalOpen(false);
      resetForm();
      toast.success('Grupo atualizado com sucesso');
    } catch (error) {
      console.error('Error updating grupo:', error);
      toast.error('Erro ao atualizar grupo');
    }
  };

  const handleDeleteGrupo = async () => {
    if (!selectedGrupo) return;

    try {
      const { error } = await supabase
        .from('grupo_resumo')
        .delete()
        .eq('id', selectedGrupo.id);

      if (error) throw error;
      const filterOut = (list: GrupoResumo[]) => list.filter(g => g.id !== selectedGrupo.id);
      setGrupos(filterOut(grupos));
      setConversas(filterOut(conversas));
      setEmails(filterOut(emails));
      setIsDeleteModalOpen(false);
      const label = activeTab === 'conversations' ? 'Conversa' : activeTab === 'emails' ? 'E-mail' : 'Grupo';
      toast.success(`${label} excluído(a) com sucesso`);
    } catch (error) {
      console.error('Error deleting grupo:', error);
      toast.error('Erro ao excluir');
    }
  };

  const handleToggleActive = async (grupo: GrupoResumo) => {
    try {
      const { error } = await supabase
        .from('grupo_resumo')
        .update({ ativo: !grupo.ativo })
        .eq('id', grupo.id);

      if (error) throw error;
      
      const updater = (list: GrupoResumo[]) => list.map(g => g.id === grupo.id ? { ...g, ativo: !g.ativo } : g);
      setGrupos(updater(grupos));
      setConversas(updater(conversas));
      setEmails(updater(emails));
      
      toast.success(`${!grupo.ativo ? 'Ativado' : 'Desativado'} com sucesso`);
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Erro ao alterar status');
    }
  };

  const handleSendManualSummary = async (grupo: GrupoResumo) => {
    try {
      setSendingManualSummary(prev => ({ ...prev, [grupo.id]: true }));
      
      // Get current user session from WiseApp cache
      const cachedSession = localStorage.getItem('wiseapp_session');
      let userEmail = '';
      let userAccountId = '';
      
      if (cachedSession) {
        try {
          const session = JSON.parse(cachedSession);
          userEmail = session.email || '';
          userAccountId = session.accountId || '';
        } catch (e) {
          console.error('Error parsing cached session:', e);
        }
      }
      
      // Use account_id stored on the group (set when creating/editing), or fall back to current account
      const wiseappAccountId = grupo.account_id
        ? String(grupo.account_id)
        : (accountId || userAccountId || null);
      
      // Fetch user's API key from wiseapp_acesso for the correct account
      let apiKey = null;
      if (userEmail && wiseappAccountId) {
        const { data: accessData } = await supabase
          .from('wiseapp_acesso')
          .select('access_token_wiseapp')
          .eq('email', userEmail)
          .eq('id_conta_wiseapp', wiseappAccountId)
          .single();
        
        apiKey = accessData?.access_token_wiseapp || null;
      }
      
      // If no API key found for this user, try any valid key for the account
      if (!apiKey && wiseappAccountId) {
        const { data: fallbackAccessData } = await supabase
          .from('wiseapp_acesso')
          .select('access_token_wiseapp')
          .eq('id_conta_wiseapp', wiseappAccountId)
          .not('access_token_wiseapp', 'is', null)
          .limit(1)
          .single();
        
        apiKey = fallbackAccessData?.access_token_wiseapp || null;
      }
      
      console.log('Manual summary trigger data:', {
        group_id: grupo.id,
        company_id: effectiveCompanyId,
        account_id: wiseappAccountId,
        inbox_id: grupo.inbox_id,
        has_api_key: !!apiKey
      });
      
      // Send to AI Summary Service
      const response = await fetch(AI_SUMMARY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nome_do_grupo: grupo.nome_grupo,
          company_id: effectiveCompanyId,
          group_id: grupo.id,
          account_id: wiseappAccountId,
          api_key: apiKey,
          inbox_id: grupo.inbox_id
        })
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        console.error('AI Summary error:', result.error);
        throw new Error(result.error || `Falha ao gerar resumo: ${response.status}`);
      }
      
      // Show success and display summary if available
      if (result.summary) {
        toast.success('Resumo gerado com sucesso!');
        console.log('AI Generated Summary:', result.summary);
      } else {
        toast.success('Resumo gerado com sucesso!');
      }
      
      // Refresh the delivery history
      fetchEnvios(grupo.id);
      if (activeTab === 'history') {
        fetchAllEnvios();
      }
    } catch (error) {
      console.error('Error sending manual summary:', error);
      toast.error(`Erro ao enviar resumo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setSendingManualSummary(prev => ({ ...prev, [grupo.id]: false }));
    }
  };

  const handleSendConvSummary = async (item: GrupoResumo) => {
    try {
      setSendingManualSummary(prev => ({ ...prev, [item.id]: true }));
      
      const cachedSession = localStorage.getItem('wiseapp_session');
      let userEmail = '';
      if (cachedSession) {
        try { userEmail = JSON.parse(cachedSession).email || ''; } catch {}
      }
      
      const wiseappAccountId = item.account_id ? String(item.account_id) : (accountId || null);
      
      let apiKey = null;
      if (userEmail && wiseappAccountId) {
        const { data: accessData } = await supabase
          .from('wiseapp_acesso')
          .select('access_token_wiseapp')
          .eq('email', userEmail)
          .eq('id_conta_wiseapp', wiseappAccountId)
          .single();
        apiKey = accessData?.access_token_wiseapp || null;
      }
      if (!apiKey && wiseappAccountId) {
        const { data: fallbackData } = await supabase
          .from('wiseapp_acesso')
          .select('access_token_wiseapp')
          .eq('id_conta_wiseapp', wiseappAccountId)
          .not('access_token_wiseapp', 'is', null)
          .limit(1)
          .single();
        apiKey = fallbackData?.access_token_wiseapp || null;
      }
      
      const response = await fetch(AI_CONV_SUMMARY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: wiseappAccountId,
          api_key: apiKey,
          conv_id: item.conv_id,
          conv_name: item.contact_name || item.nome_grupo,
          tipo: item.tipo || 'conversa',
          group_id: item.id,
          company_id: effectiveCompanyId
        })
      });
      
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Falha ao gerar resumo');
      }
      
      toast.success('Resumo gerado com sucesso!');
      fetchEnvios(item.id);
      if (activeTab === 'history') fetchAllEnvios();
    } catch (error) {
      console.error('Error sending conv summary:', error);
      toast.error(`Erro ao enviar resumo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setSendingManualSummary(prev => ({ ...prev, [item.id]: false }));
    }
  };

  const searchContacts = async (query: string) => {
    if (!formData.account_id || !query.trim()) {
      setContactSearchResults([]);
      return;
    }
    setLoadingContactSearch(true);
    try {
      const response = await fetch(`${API_BASE_URL}/wiseapp/${formData.account_id}/contacts-search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      const contacts = data?.payload || [];
      setContactSearchResults(contacts.map((c: any) => ({
        id: c.id,
        name: c.name || 'Sem nome',
        phone_number: c.phone_number,
        email: c.email
      })));
    } catch (error) {
      console.error('Error searching contacts:', error);
      setContactSearchResults([]);
    } finally {
      setLoadingContactSearch(false);
    }
  };

  const fetchContactConversations = async (contactId: number, accountOverride?: number) => {
    const accId = accountOverride || formData.account_id;
    if (!accId) return;
    setLoadingContactConversations(true);
    try {
      const response = await fetch(`${API_BASE_URL}/wiseapp/${accId}/contacts/${contactId}/conversations`);
      const data = await response.json();
      // WiseApp API may return { payload: [...] } or { data: [...] } or array directly
      let convs: any[] = [];
      if (Array.isArray(data)) convs = data;
      else if (Array.isArray(data?.payload)) convs = data.payload;
      else if (Array.isArray(data?.data)) convs = data.data;
      console.log('[fetchContactConversations] raw keys:', Object.keys(data || {}), 'convs:', convs.length);
      if (convs.length > 0) {
        const f = convs[0];
        console.log('[fetchContactConversations] first conv keys:', Object.keys(f));
        console.log('[fetchContactConversations] first conv id:', f.id, 'messages_count:', f.messages_count, 'meta:', JSON.stringify(f.meta), 'messages.length:', f.messages?.length);
      }
      setContactConversations(convs.map((c: any) => ({
        id: c.id,
        inbox_id: c.inbox_id,
        status: c.status,
        meta: c.meta,
        created_at: c.created_at,
        messages_count: c.messages_count || c.messages?.length || c.meta?.all_count || 0
      })));
    } catch (error) {
      console.error('Error fetching contact conversations:', error);
      setContactConversations([]);
    } finally {
      setLoadingContactConversations(false);
    }
  };

  const fetchEmailConversations = async (inboxId: number) => {
    if (!formData.account_id) return;
    setLoadingEmailConversations(true);
    try {
      const response = await fetch(`${API_BASE_URL}/wiseapp/${formData.account_id}/conversations?inbox_id=${inboxId}`);
      const data = await response.json();
      const convs = data?.data?.payload || [];
      setEmailConversations(convs.map((c: any) => ({
        id: c.id,
        inbox_id: c.inbox_id,
        status: c.status,
        meta: c.meta,
        created_at: c.created_at,
        messages_count: c.messages_count
      })));
    } catch (error) {
      console.error('Error fetching email conversations:', error);
      setEmailConversations([]);
    } finally {
      setLoadingEmailConversations(false);
    }
  };

  const handleAddConvOrEmail = async (tipo: 'conversa' | 'email') => {
    if (!formData.nome_grupo?.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    if (!formData.horario) {
      toast.error('Horário é obrigatório');
      return;
    }
    if (!selectedConvId) {
      toast.error(tipo === 'email' ? 'Selecione uma conversa de e-mail' : 'Selecione uma conversa');
      return;
    }

    try {
      const utcHorario = convertBrasiliaToUTC(formData.horario);
      const insertData: any = {
        nome_grupo: formData.nome_grupo,
        horario: utcHorario,
        ativo: formData.ativo,
        icon_name: formData.icon_name,
        color_name: formData.color_name,
        company_id: effectiveCompanyId,
        account_id: formData.account_id || (accountId ? Number(accountId) : null),
        tipo,
        conv_id: selectedConvId,
        contact_name: selectedConvName || formData.nome_grupo,
        nome_inbox: formData.nome_inbox || '',
        inbox_id: formData.inbox_id || null
      };

      if (tipo === 'email' && formData.inbox_id) {
        insertData.inbox_id = formData.inbox_id;
        insertData.nome_inbox = formData.nome_inbox || '';
      }

      const { data, error } = await supabase
        .from('grupo_resumo')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      const newItem = { ...data, horario: convertUTCToBrasilia(data.horario) };
      if (tipo === 'conversa') {
        setConversas([...conversas, newItem]);
      } else {
        setEmails([...emails, newItem]);
      }
      setIsAddModalOpen(false);
      resetForm();
      toast.success(`${tipo === 'email' ? 'E-mail' : 'Conversa'} adicionado(a) com sucesso`);
    } catch (error) {
      console.error('Error adding item:', error);
      toast.error('Erro ao adicionar');
    }
  };

  const handleEditConvOrEmail = async (tipo: 'conversa' | 'email') => {
    if (!selectedGrupo) return;
    if (!formData.nome_grupo?.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    if (!formData.horario) {
      toast.error('Horário é obrigatório');
      return;
    }

    try {
      const utcHorario = convertBrasiliaToUTC(formData.horario);
      const updateData: any = {
        nome_grupo: formData.nome_grupo,
        horario: utcHorario,
        icon_name: formData.icon_name,
        color_name: formData.color_name,
        account_id: formData.account_id || (accountId ? Number(accountId) : null)
      };

      if (selectedConvId) {
        updateData.conv_id = selectedConvId;
        updateData.contact_name = selectedConvName || formData.nome_grupo;
      }

      if (tipo === 'email' && formData.inbox_id) {
        updateData.inbox_id = formData.inbox_id;
        updateData.nome_inbox = formData.nome_inbox;
      }

      const { error } = await supabase
        .from('grupo_resumo')
        .update(updateData)
        .eq('id', selectedGrupo.id);

      if (error) throw error;

      const updater = (item: GrupoResumo) =>
        item.id === selectedGrupo.id
          ? { ...item, nome_grupo: formData.nome_grupo, horario: formData.horario, icon_name: formData.icon_name, color_name: formData.color_name, ...(selectedConvId ? { conv_id: selectedConvId, contact_name: selectedConvName } : {}) }
          : item;

      if (tipo === 'conversa') setConversas(conversas.map(updater));
      else setEmails(emails.map(updater));

      setIsEditModalOpen(false);
      resetForm();
      toast.success('Atualizado com sucesso');
    } catch (error) {
      console.error('Error updating:', error);
      toast.error('Erro ao atualizar');
    }
  };

  const resetForm = () => {
    setFormData({
      nome_grupo: '',
      horario: '08:00',
      ativo: true,
      icon_name: 'MessagesSquare',
      color_name: 'blue',
      inbox_id: null,
      nome_inbox: '',
      account_id: accountId ? Number(accountId) : null
    });
    setSelectedGrupo(null);
    setContactSearchQuery('');
    setContactSearchResults([]);
    setSelectedContact(null);
    setContactConversations([]);
    setEmailConversations([]);
    setSelectedConvId(null);
    setSelectedConvName('');
  };

  const toggleGroupExpansion = (grupoId: number) => {
    const newExpandedGroups = new Set(expandedGroups);
    if (expandedGroups.has(grupoId)) {
      newExpandedGroups.delete(grupoId);
    } else {
      newExpandedGroups.add(grupoId);
      fetchEnvios(grupoId);
    }
    setExpandedGroups(newExpandedGroups);
  };

  const formatDateTime = (dateTimeStr: string) => {
    try {
      const date = parseISO(dateTimeStr);
      return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch (error) {
      return dateTimeStr;
    }
  };

  const getIconComponent = (iconName: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      MessagesSquare: <MessagesSquare />,
      BarChart2: <BarChart2 />,
      Calendar: <Calendar />,
      Smartphone: <Smartphone />,
      Settings: <Settings />,
      Users: <Users />,
      Bell: <Bell />,
      FileText: <FileText />,
      Home: <Home />,
      Truck: <Truck />,
      Gauge: <Gauge />,
      ClipboardCheck: <ClipboardCheck />,
      Store: <Store />,
      Mail: <Mail />,
      Phone: <Phone />,
      Map: <Map />,
      Star: <Star />,
      Heart: <Heart />,
      Bookmark: <Bookmark />,
      Flag: <Flag />,
      Award: <Award />,
      Zap: <Zap />,
      Briefcase: <Briefcase />,
      Coffee: <Coffee />,
      Compass: <Compass />,
      Database: <Database />,
      Headphones: <Headphones />,
      Image: <Image />,
      Key: <Key />,
      Layers: <Layers />,
      Music: <Music />,
      Package: <Package />,
      Printer: <Printer />,
      Radio: <Radio />,
      Shield: <Shield />,
      ShoppingBag: <ShoppingBag />,
      Smile: <Smile />,
      Sun: <Sun />,
      Terminal: <Terminal />,
      Umbrella: <Umbrella />,
      Video: <Video />,
      Wifi: <Wifi />,
      Activity: <Activity />,
      Anchor: <Anchor />,
      Archive: <Archive />,
      AtSign: <AtSign />,
      Battery: <Battery />,
      Book: <Book />,
      Box: <Box />,
      Camera: <Camera />,
      Cast: <Cast />,
      Cloud: <Cloud />,
      Code: <Code />,
      Command: <Command />,
      Copy: <Copy />,
      CreditCard: <CreditCard />,
      Disc: <Disc />,
      Download: <Download />,
      Droplet: <Droplet />,
      Eye: <Eye />,
      Facebook: <Facebook />,
      Film: <Film />,
      Filter: <Filter />,
      Folder: <Folder />,
      Gift: <Gift />,
      GitBranch: <GitBranch />,
      Globe: <Globe />,
      Grid: <Grid />,
      HardDrive: <HardDrive />,
      Hash: <Hash />,
      Instagram: <Instagram />,
      Laptop: <Laptop />,
      Leaf: <Leaf />,
      LifeBuoy: <LifeBuoy />,
      Link: <Link />,
      Linkedin: <Linkedin />,
      List: <List />,
      Lock: <Lock />,
      Maximize: <Maximize />,
      Menu: <Menu />,
      MessageCircle: <MessageCircle />,
      Mic: <Mic />,
      Monitor: <Monitor />,
      Moon: <Moon />,
      Move: <Move />,
      Navigation: <Navigation />,
      Octagon: <Octagon />,
      Paperclip: <Paperclip />,
      Pause: <Pause />,
      Percent: <Percent />,
      Play: <Play />,
      Power: <Power />,
      Refresh: <Refresh />,
      RotateCcw: <RotateCcw />,
      Save: <Save />,
      Search: <Search />,
      Server: <Server />,
      Share: <Share />,
      ShoppingCart: <ShoppingCart />,
      Slash: <Slash />,
      Sliders: <Sliders />,
      Speaker: <Speaker />,
      Square: <Square />,
      Tag: <Tag />,
      Target: <Target />,
      ThumbsUp: <ThumbsUp />,
      Trash: <Trash />,
      Twitter: <Twitter />,
      Upload: <Upload />,
      User: <User />,
      Voicemail: <Voicemail />,
      Volume: <Volume />,
      Watch: <Watch />,
      Wind: <Wind />,
      Youtube: <Youtube />
    };
    
    return iconMap[iconName] || <MessagesSquare />;
  };

  const getColorClass = (colorName: string) => {
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
      purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
      amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
      red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
    };
    
    return colorMap[colorName] || colorMap.blue;
  };

  const iconOptions = [
    { value: 'MessagesSquare', component: <MessagesSquare /> },
    { value: 'BarChart2', component: <BarChart2 /> },
    { value: 'Calendar', component: <Calendar /> },
    { value: 'Smartphone', component: <Smartphone /> },
    { value: 'Settings', component: <Settings /> },
    { value: 'Users', component: <Users /> },
    { value: 'Bell', component: <Bell /> },
    { value: 'FileText', component: <FileText /> },
    { value: 'Home', component: <Home /> },
    { value: 'Truck', component: <Truck /> },
    { value: 'Gauge', component: <Gauge /> },
    { value: 'ClipboardCheck', component: <ClipboardCheck /> },
    { value: 'Store', component: <Store /> },
    { value: 'Mail', component: <Mail /> },
    { value: 'Phone', component: <Phone /> },
    { value: 'Map', component: <Map /> },
    { value: 'Star', component: <Star /> },
    { value: 'Heart', component: <Heart /> },
    { value: 'Bookmark', component: <Bookmark /> },
    { value: 'Flag', component: <Flag /> },
    { value: 'Award', component: <Award /> },
    { value: 'Zap', component: <Zap /> },
    { value: 'Briefcase', component: <Briefcase /> },
    { value: 'Coffee', component: <Coffee /> },
    { value: 'Compass', component: <Compass /> },
    { value: 'Database', component: <Database /> },
    { value: 'Headphones', component: <Headphones /> },
    { value: 'Image', component: <Image /> },
    { value: 'Key', component: <Key /> },
    { value: 'Layers', component: <Layers /> },
    { value: 'Music', component: <Music /> },
    { value: 'Package', component: <Package /> },
    { value: 'Printer', component: <Printer /> },
    { value: 'Radio', component: <Radio /> },
    { value: 'Shield', component: <Shield /> },
    { value: 'ShoppingBag', component: <ShoppingBag /> },
    { value: 'Smile', component: <Smile /> },
    { value: 'Sun', component: <Sun /> },
    { value: 'Terminal', component: <Terminal /> },
    { value: 'Umbrella', component: <Umbrella /> },
    { value: 'Video', component: <Video /> },
    { value: 'Wifi', component: <Wifi /> },
    { value: 'Activity', component: <Activity /> },
    { value: 'Anchor', component: <Anchor /> },
    { value: 'Archive', component: <Archive /> },
    { value: 'AtSign', component: <AtSign /> },
    { value: 'Battery', component: <Battery /> },
    { value: 'Book', component: <Book /> },
    { value: 'Box', component: <Box /> },
    { value: 'Camera', component: <Camera /> },
    { value: 'Cast', component: <Cast /> },
    { value: 'Cloud', component: <Cloud /> },
    { value: 'Code', component: <Code /> },
    { value: 'Command', component: <Command /> },
    { value: 'Copy', component: <Copy /> },
    { value: 'CreditCard', component: <CreditCard /> },
    { value: 'Disc', component: <Disc /> },
    { value: 'Download', component: <Download /> },
    { value: 'Droplet', component: <Droplet /> },
    { value: 'Eye', component: <Eye /> },
    { value: 'Facebook', component: <Facebook /> },
    { value: 'Film', component: <Film /> },
    { value: 'Filter', component: <Filter /> },
    { value: 'Folder', component: <Folder /> },
    { value: 'Gift', component: <Gift /> },
    { value: 'GitBranch', component: <GitBranch /> },
    { value: 'Globe', component: <Globe /> },
    { value: 'Grid', component: <Grid /> },
    { value: 'HardDrive', component: <HardDrive /> },
    { value: 'Hash', component: <Hash /> },
    { value: 'Instagram', component: <Instagram /> },
    { value: 'Laptop', component: <Laptop /> },
    { value: 'Leaf', component: <Leaf /> },
    { value: 'LifeBuoy', component: <LifeBuoy /> },
    { value: 'Link', component: <Link /> },
    { value: 'Linkedin', component: <Linkedin /> },
    { value: 'List', component: <List /> },
    { value: 'Lock', component: <Lock /> },
    { value: 'Maximize', component: <Maximize /> },
    { value: 'Menu', component: <Menu /> },
    { value: 'MessageCircle', component: <MessageCircle /> },
    { value: 'Mic', component: <Mic /> },
    { value: 'Monitor', component: <Monitor /> },
    { value: 'Moon', component: <Moon /> },
    { value: 'Move', component: <Move /> },
    { value: 'Navigation', component: <Navigation /> },
    { value: 'Octagon', component: <Octagon /> },
    { value: 'Paperclip', component: <Paperclip /> },
    { value: 'Pause', component: <Pause /> },
    { value: 'Percent', component: <Percent /> },
    { value: 'Play', component: <Play /> },
    { value: 'Power', component: <Power /> },
    { value: 'Refresh', component: <Refresh /> },
    { value: 'RotateCcw', component: <RotateCcw /> },
    { value: 'Save', component: <Save /> },
    { value: 'Search', component: <Search /> },
    { value: 'Server', component: <Server /> },
    { value: 'Share', component: <Share /> },
    { value: 'ShoppingCart', component: <ShoppingCart /> },
    { value: 'Slash', component: <Slash /> },
    { value: 'Sliders', component: <Sliders /> },
    { value: 'Speaker', component: <Speaker /> },
    { value: 'Square', component: <Square /> },
    { value: 'Tag', component: <Tag /> },
    { value: 'Target', component: <Target /> },
    { value: 'ThumbsUp', component: <ThumbsUp /> },
    { value: 'Trash', component: <Trash /> },
    { value: 'Twitter', component: <Twitter /> },
    { value: 'Upload', component: <Upload /> },
    { value: 'User', component: <User /> },
    { value: 'Voicemail', component: <Voicemail /> },
    { value: 'Volume', component: <Volume /> },
    { value: 'Watch', component: <Watch /> },
    { value: 'Wind', component: <Wind /> },
    { value: 'Youtube', component: <Youtube /> }
  ];

  const colorOptions = [
    { value: 'blue', class: 'bg-blue-500 dark:bg-blue-400' },
    { value: 'green', class: 'bg-green-500 dark:bg-green-400' },
    { value: 'purple', class: 'bg-purple-500 dark:bg-purple-400' },
    { value: 'amber', class: 'bg-amber-500 dark:bg-amber-400' },
    { value: 'red', class: 'bg-red-500 dark:bg-red-400' }
  ];

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Resumos de Conversas</h1>
        <div className="flex gap-2">
          {activeTab !== 'history' && (
            <button
              onClick={() => {
                setIsAddModalOpen(true);
                resetForm();
              }}
              data-testid="btn-add-new"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                       transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              {activeTab === 'conversations' ? 'Nova Conversa' : 'Novo Grupo'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('groups')}
              data-testid="tab-groups"
              className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-all duration-200 ${
                activeTab === 'groups'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <MessagesSquare className="w-5 h-5 mr-2" />
              Grupos
            </button>
            <button
              onClick={() => setActiveTab('conversations')}
              data-testid="tab-conversations"
              className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-all duration-200 ${
                activeTab === 'conversations'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Conversas
            </button>
            <button
              onClick={() => setActiveTab('history')}
              data-testid="tab-history"
              className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-all duration-200 ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <History className="w-5 h-5 mr-2" />
              Histórico de Envios
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'groups' && (
            <>
              {grupos.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
                  <MessagesSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Nenhum grupo configurado
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                    Configure grupos para enviar resumos automáticos diários com informações sobre motoristas, agregados, hodômetros e checklists.
                  </p>
                  <button
                    onClick={() => {
                      setIsAddModalOpen(true);
                      resetForm();
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                             transition-colors flex items-center gap-2 mx-auto"
                  >
                    <Plus className="w-5 h-5" />
                    Adicionar Grupo
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {grupos.map(grupo => (
                    <div 
                      key={grupo.id} 
                      className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden ${
                        !grupo.ativo ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-full ${getColorClass(grupo.color_name || 'blue')}`}>
                              {getIconComponent(grupo.icon_name || 'MessagesSquare')}
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {grupo.nome_grupo}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  {grupo.horario}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center">
                            <button
                              onClick={() => handleToggleActive(grupo)}
                              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                grupo.ativo 
                                  ? 'bg-green-500 dark:bg-green-600' 
                                  : 'bg-gray-200 dark:bg-gray-700'
                              }`}
                              role="switch"
                              aria-checked={grupo.ativo}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  grupo.ativo ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center mt-6">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedGrupo(grupo);
                                setFormData({
                                  nome_grupo: grupo.nome_grupo,
                                  horario: grupo.horario,
                                  ativo: grupo.ativo,
                                  icon_name: grupo.icon_name || 'MessagesSquare',
                                  color_name: grupo.color_name || 'blue',
                                  inbox_id: grupo.inbox_id || null,
                                  nome_inbox: grupo.nome_inbox || '',
                                  account_id: grupo.account_id || (accountId ? Number(accountId) : null)
                                });
                                setIsEditModalOpen(true);
                              }}
                              className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                              title="Editar grupo"
                            >
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedGrupo(grupo);
                                setIsDeleteModalOpen(true);
                              }}
                              className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Excluir grupo"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              onClick={() => toggleGroupExpansion(grupo.id)}
                              className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                              title={expandedGroups.has(grupo.id) ? "Ocultar histórico" : "Ver histórico"}
                            >
                              <LayoutList className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleSendManualSummary(grupo)}
                              disabled={sendingManualSummary[grupo.id] || !grupo.ativo}
                              className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Enviar resumo agora"
                            >
                              {sendingManualSummary[grupo.id] ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : (
                                <Send className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Delivery History */}
                      {expandedGroups.has(grupo.id) && (
                        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Histórico de Envios
                          </h4>
                          
                          {loadingEnvios[grupo.id] ? (
                            <div className="flex justify-center py-4">
                              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                            </div>
                          ) : envios[grupo.id]?.length ? (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {envios[grupo.id].map(envio => (
                                <div 
                                  key={envio.id} 
                                  className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-between"
                                >
                                  <div>
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                      {formatDateTime(envio.data_envio)}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                      {envio.mensagem}
                                    </div>
                                  </div>
                                  <div>
                                    {envio.status ? (
                                      <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-400" />
                                    ) : (
                                      <XCircle className="w-5 h-5 text-red-500 dark:text-red-400" />
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                              Nenhum envio registrado
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Conversas Tab */}
          {activeTab === 'conversations' && (
            <>
              {conversas.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
                  <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Nenhuma conversa configurada
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                    Configure conversas individuais para gerar resumos automáticos diários. O resumo será enviado como nota privada.
                  </p>
                  <button
                    onClick={() => { setIsAddModalOpen(true); resetForm(); }}
                    data-testid="btn-add-conversa"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center gap-2 mx-auto"
                  >
                    <Plus className="w-5 h-5" />
                    Adicionar Conversa
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {conversas.map(item => (
                    <div key={item.id} className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden ${!item.ativo ? 'opacity-60' : ''}`}>
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-full ${getColorClass(item.color_name || 'blue')}`}>
                              {getIconComponent(item.icon_name || 'MessageCircle')}
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{item.nome_grupo}</h3>
                              {item.contact_name && item.contact_name !== item.nome_grupo && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">{item.contact_name}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                <span className="text-sm text-gray-500 dark:text-gray-400">{item.horario}</span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleToggleActive(item)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${item.ativo ? 'bg-green-500 dark:bg-green-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                            role="switch"
                            aria-checked={item.ativo}
                          >
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${item.ativo ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </div>
                        <div className="flex justify-between items-center mt-6">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedGrupo(item);
                                setFormData({ nome_grupo: item.nome_grupo, horario: item.horario, ativo: item.ativo, icon_name: item.icon_name || 'MessageCircle', color_name: item.color_name || 'blue', inbox_id: item.inbox_id || null, nome_inbox: item.nome_inbox || '', account_id: item.account_id || (accountId ? Number(accountId) : null) });
                                setSelectedConvId(item.conv_id || null);
                                setSelectedConvName(item.contact_name || '');
                                setIsEditModalOpen(true);
                              }}
                              className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => { setSelectedGrupo(item); setIsDeleteModalOpen(true); }}
                              className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => toggleGroupExpansion(item.id)}
                              className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                              title={expandedGroups.has(item.id) ? "Ocultar histórico" : "Ver histórico"}
                            >
                              <LayoutList className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleSendConvSummary(item)}
                              disabled={sendingManualSummary[item.id] || !item.ativo}
                              className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Enviar resumo agora"
                            >
                              {sendingManualSummary[item.id] ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                      {expandedGroups.has(item.id) && (
                        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Histórico de Envios</h4>
                          {loadingEnvios[item.id] ? (
                            <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
                          ) : envios[item.id]?.length ? (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {envios[item.id].map(envio => (
                                <div key={envio.id} className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                  <div>
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{formatDateTime(envio.data_envio)}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{envio.mensagem}</div>
                                  </div>
                                  <div>{envio.status ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-gray-500 dark:text-gray-400">Nenhum envio registrado</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* E-mails Tab */}
          {activeTab === 'emails' && (
            <>
              {emails.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
                  <Mail className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Nenhum e-mail configurado
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                    Configure conversas de e-mail para gerar resumos automáticos diários. O resumo será enviado como nota privada.
                  </p>
                  <button
                    onClick={() => { setIsAddModalOpen(true); resetForm(); }}
                    data-testid="btn-add-email"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center gap-2 mx-auto"
                  >
                    <Plus className="w-5 h-5" />
                    Adicionar E-mail
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {emails.map(item => (
                    <div key={item.id} className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden ${!item.ativo ? 'opacity-60' : ''}`}>
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-full ${getColorClass(item.color_name || 'purple')}`}>
                              {getIconComponent(item.icon_name || 'Mail')}
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{item.nome_grupo}</h3>
                              {item.contact_name && item.contact_name !== item.nome_grupo && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">{item.contact_name}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                <span className="text-sm text-gray-500 dark:text-gray-400">{item.horario}</span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleToggleActive(item)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${item.ativo ? 'bg-green-500 dark:bg-green-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                            role="switch"
                            aria-checked={item.ativo}
                          >
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${item.ativo ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </div>
                        <div className="flex justify-between items-center mt-6">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedGrupo(item);
                                setFormData({ nome_grupo: item.nome_grupo, horario: item.horario, ativo: item.ativo, icon_name: item.icon_name || 'Mail', color_name: item.color_name || 'purple', inbox_id: item.inbox_id || null, nome_inbox: item.nome_inbox || '', account_id: item.account_id || (accountId ? Number(accountId) : null) });
                                setSelectedConvId(item.conv_id || null);
                                setSelectedConvName(item.contact_name || '');
                                setIsEditModalOpen(true);
                              }}
                              className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => { setSelectedGrupo(item); setIsDeleteModalOpen(true); }}
                              className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => toggleGroupExpansion(item.id)}
                              className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                              title={expandedGroups.has(item.id) ? "Ocultar histórico" : "Ver histórico"}
                            >
                              <LayoutList className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleSendConvSummary(item)}
                              disabled={sendingManualSummary[item.id] || !item.ativo}
                              className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Enviar resumo agora"
                            >
                              {sendingManualSummary[item.id] ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                      {expandedGroups.has(item.id) && (
                        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Histórico de Envios</h4>
                          {loadingEnvios[item.id] ? (
                            <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
                          ) : envios[item.id]?.length ? (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {envios[item.id].map(envio => (
                                <div key={envio.id} className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                  <div>
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{formatDateTime(envio.data_envio)}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{envio.mensagem}</div>
                                  </div>
                                  <div>{envio.status ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-gray-500 dark:text-gray-400">Nenhum envio registrado</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'history' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                  Histórico de Envios
                </h2>
                
                {/* Date Filter */}
                <div className="mb-4 flex flex-wrap gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtrar por data:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 dark:text-gray-400">De:</label>
                    <input
                      type="date"
                      value={dateFilter.from}
                      onChange={(e) => setDateFilter(prev => ({ ...prev, from: e.target.value }))}
                      className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 dark:text-gray-400">Até:</label>
                    <input
                      type="date"
                      value={dateFilter.to}
                      onChange={(e) => setDateFilter(prev => ({ ...prev, to: e.target.value }))}
                      className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  {(dateFilter.from || dateFilter.to) && (
                    <button
                      onClick={() => setDateFilter({ from: '', to: '' })}
                      className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
                
                {loadingAllEnvios ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  </div>
                ) : filteredEnvios.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Data/Hora
                            </th>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Nome
                            </th>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Tipo
                            </th>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Status
                            </th>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Mensagem
                            </th>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Resumo
                            </th>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Ações
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {paginatedEnvios.map((envio) => (
                            <tr key={envio.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900 dark:text-white">
                                {(() => {
                                  // Use created_at que já tem o timezone correto
                                  const timestamp = envio.created_at || envio.data_envio;
                                  const date = new Date(timestamp);
                                  return format(date, 'dd/MM HH:mm', { locale: ptBR });
                                })()}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900 dark:text-white max-w-[120px]">
                                <div className="truncate" title={envio.grupo?.nome_grupo || 'Desconhecido'}>
                                  {envio.grupo?.nome_grupo || 'Desconhecido'}
                                </div>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {(() => {
                                  const tipo = envio.tipo || 'grupo';
                                  const badgeConfig = {
                                    grupo: { label: 'Grupo', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
                                    conversa: { label: 'Conversa', cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
                                    email: { label: 'E-mail', cls: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' }
                                  }[tipo] || { label: tipo, cls: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' };
                                  return (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badgeConfig.cls}`}>
                                      {badgeConfig.label}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {envio.status ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-500 dark:text-green-400" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
                                )}
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 max-w-[150px]">
                                <div className="truncate" title={envio.mensagem}>
                                  {envio.mensagem}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 max-w-[150px]">
                                {envio.resumo_grupo ? (
                                  <div className="truncate" title={envio.resumo_grupo}>
                                    {envio.resumo_grupo.length > 50 
                                      ? `${envio.resumo_grupo.substring(0, 50)}...` 
                                      : envio.resumo_grupo
                                    }
                                  </div>
                                ) : (
                                  <span className="text-gray-400 italic">-</span>
                                )}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <button
                                  onClick={() => {
                                    setSelectedEnvio(envio);
                                    setIsEnvioModalOpen(true);
                                  }}
                                  className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-medium"
                                  title="Ver detalhes"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Pagination */}
                    <Pagination
                      currentPage={currentPage}
                      totalPages={Math.ceil(filteredEnvios.length / pageSize)}
                      totalItems={filteredEnvios.length}
                      pageSize={pageSize}
                      onPageChange={setCurrentPage}
                      onPageSizeChange={(newSize) => {
                        setPageSize(newSize);
                        setCurrentPage(1);
                      }}
                    />
                  </>
                ) : (
                  <div className="text-center py-8">
                    <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      {(dateFilter.from || dateFilter.to) 
                        ? 'Nenhum envio encontrado para o período selecionado' 
                        : 'Nenhum histórico de envio encontrado'
                      }
                    </p>
                    {(dateFilter.from || dateFilter.to) && (
                      <button
                        onClick={() => setDateFilter({ from: '', to: '' })}
                        className="mt-2 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
                      >
                        Limpar filtros para ver todos os envios
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Modal (Groups / Conversas / Emails) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {activeTab === 'conversations' ? 'Nova Conversa' : 'Novo Grupo'}
              </h2>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {activeTab === 'conversations' ? 'Nome da Conversa *' : activeTab === 'emails' ? 'Nome do E-mail *' : 'Nome do Grupo *'}
                  {activeTab === 'groups' && (
                    <div className="relative group">
                      <Info className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-help" />
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                        <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded py-1.5 px-2 shadow-lg whitespace-nowrap">
                          Nome deve ser igual ao WhatsApp
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                        </div>
                      </div>
                    </div>
                  )}
                </label>
                <input
                  type="text"
                  value={formData.nome_grupo}
                  onChange={(e) => setFormData({ ...formData, nome_grupo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder={activeTab === 'conversations' ? 'Ex: Resumo João Silva' : activeTab === 'emails' ? 'Ex: Resumo Suporte' : 'Ex: Resumo Operações'}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Horário de Envio (Brasília) *
                </label>
                <input
                  type="time"
                  value={formData.horario}
                  onChange={(e) => setFormData({ ...formData, horario: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Horário no fuso de Brasília (UTC-3)
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Conta WiseApp *
                </label>
                {loadingModalAccounts ? (
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Carregando contas...</span>
                  </div>
                ) : modalAccounts.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {modalAccounts.map(acc => (
                      <button
                        key={acc.account_id}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, account_id: Number(acc.account_id), inbox_id: null, nome_inbox: '' }));
                          setSelectedContact(null);
                          setContactSearchResults([]);
                          setContactConversations([]);
                          setEmailConversations([]);
                          setSelectedConvId(null);
                          setSelectedConvName('');
                          if (activeTab === 'emails') {
                            const emailInbs = availableInboxes.filter(i => i.channel_type === 'Channel::Email');
                            setEmailInboxes(emailInbs);
                          }
                        }}
                        data-testid={`account-btn-${acc.account_id}`}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                          formData.account_id === Number(acc.account_id)
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        {acc.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma conta disponível</p>
                )}
              </div>

              {/* Groups: Inbox selector */}
              {activeTab === 'groups' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Caixa de Entrada *
                  </label>
                  {!formData.account_id ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Selecione uma conta primeiro</p>
                  ) : loadingInboxes ? (
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Carregando caixas de entrada...</span>
                    </div>
                  ) : availableInboxes.length > 0 ? (
                    <select
                      value={formData.inbox_id || ''}
                      onChange={(e) => {
                        const selectedId = e.target.value ? Number(e.target.value) : null;
                        const selectedInbox = availableInboxes.find(i => i.id === selectedId);
                        setFormData({ ...formData, inbox_id: selectedId, nome_inbox: selectedInbox?.name || '' });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      required
                      data-testid="select-inbox"
                    >
                      <option value="">Selecione uma caixa de entrada</option>
                      {availableInboxes.map(inbox => (
                        <option key={inbox.id} value={inbox.id}>
                          {inbox.name} {inbox.phone_number ? `(${inbox.phone_number})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma caixa de entrada disponível</p>
                  )}
                </div>
              )}

              {/* Conversas: Contact search + conversation picker */}
              {activeTab === 'conversations' && formData.account_id && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Buscar Contato *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={contactSearchQuery}
                        onChange={(e) => setContactSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchContacts(contactSearchQuery); } }}
                        placeholder="Nome ou telefone do contato"
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        data-testid="input-contact-search"
                      />
                      <button
                        type="button"
                        onClick={() => searchContacts(contactSearchQuery)}
                        disabled={loadingContactSearch}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        data-testid="btn-search-contacts"
                      >
                        {loadingContactSearch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {contactSearchResults.length > 0 && (
                    <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      {contactSearchResults.map(contact => (
                        <button
                          key={contact.id}
                          type="button"
                          onClick={() => {
                            setSelectedContact(contact);
                            setContactSearchResults([]);
                            setFormData(prev => ({ ...prev, nome_grupo: prev.nome_grupo || contact.name }));
                            fetchContactConversations(contact.id);
                          }}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
                            selectedContact?.id === contact.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                          data-testid={`contact-${contact.id}`}
                        >
                          <div className="font-medium text-gray-900 dark:text-white">{contact.name}</div>
                          {contact.phone_number && <div className="text-xs text-gray-500">{contact.phone_number}</div>}
                          {contact.email && <div className="text-xs text-gray-500">{contact.email}</div>}
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedContact && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg flex items-center justify-between">
                      <span className="text-sm text-blue-800 dark:text-blue-200">
                        <User className="w-4 h-4 inline mr-1" />
                        {selectedContact.name}
                      </span>
                      <button type="button" onClick={() => { setSelectedContact(null); setContactConversations([]); setSelectedConvId(null); }} className="text-blue-600 hover:text-blue-800 dark:text-blue-400">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  {selectedContact && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Conversa *
                      </label>
                      {loadingContactConversations ? (
                        <div className="flex items-center gap-2 text-gray-500 py-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">Carregando conversas...</span>
                        </div>
                      ) : contactConversations.length > 0 ? (
                        <select
                          value={selectedConvId || ''}
                          onChange={(e) => {
                            const id = e.target.value ? Number(e.target.value) : null;
                            setSelectedConvId(id);
                            const conv = contactConversations.find(c => c.id === id);
                            setSelectedConvName(conv?.meta?.sender?.name || selectedContact.name);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          data-testid="select-conv"
                        >
                          <option value="">Selecione uma conversa</option>
                          {contactConversations.map(conv => (
                            <option key={conv.id} value={conv.id}>
                              #{conv.id} - {conv.meta?.sender?.name || 'Conversa'} ({conv.messages_count || 0} msgs · {conv.status === 'resolved' ? 'resolvida' : conv.status === 'pending' ? 'pendente' : 'aberta'})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma conversa encontrada</p>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* E-mails: Email inbox + conversation picker */}
              {activeTab === 'emails' && formData.account_id && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Caixa de E-mail *
                    </label>
                    {loadingInboxes ? (
                      <div className="flex items-center gap-2 text-gray-500 py-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Carregando caixas...</span>
                      </div>
                    ) : (() => {
                      const emailInbs = availableInboxes.filter(i => i.channel_type === 'Channel::Email');
                      return emailInbs.length > 0 ? (
                        <select
                          value={formData.inbox_id || ''}
                          onChange={(e) => {
                            const selectedId = e.target.value ? Number(e.target.value) : null;
                            const selectedInbox = emailInbs.find(i => i.id === selectedId);
                            setFormData({ ...formData, inbox_id: selectedId, nome_inbox: selectedInbox?.name || '' });
                            if (selectedId) fetchEmailConversations(selectedId);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          data-testid="select-email-inbox"
                        >
                          <option value="">Selecione uma caixa de e-mail</option>
                          {emailInbs.map(inbox => (
                            <option key={inbox.id} value={inbox.id}>{inbox.name}</option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma caixa de e-mail disponível</p>
                      );
                    })()}
                  </div>
                  {formData.inbox_id && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Conversa de E-mail *
                      </label>
                      {loadingEmailConversations ? (
                        <div className="flex items-center gap-2 text-gray-500 py-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">Carregando conversas...</span>
                        </div>
                      ) : emailConversations.length > 0 ? (
                        <select
                          value={selectedConvId || ''}
                          onChange={(e) => {
                            const id = e.target.value ? Number(e.target.value) : null;
                            setSelectedConvId(id);
                            const conv = emailConversations.find(c => c.id === id);
                            setSelectedConvName(conv?.meta?.sender?.name || 'E-mail');
                            if (conv?.meta?.sender?.name && !formData.nome_grupo) {
                              setFormData(prev => ({ ...prev, nome_grupo: conv.meta?.sender?.name || '' }));
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          data-testid="select-email-conv"
                        >
                          <option value="">Selecione uma conversa</option>
                          {emailConversations.map(conv => (
                            <option key={conv.id} value={conv.id}>
                              #{conv.id} - {conv.meta?.sender?.name || 'E-mail'} ({conv.messages_count || 0} msgs · {conv.status === 'resolved' ? 'resolvida' : conv.status === 'pending' ? 'pendente' : 'aberta'})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma conversa encontrada</p>
                      )}
                    </div>
                  )}
                </>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ícone
                </label>
                <div className="flex flex-wrap gap-1 mt-2 max-h-40 overflow-y-auto p-2 border border-gray-200 dark:border-gray-700 rounded-lg">
                  {iconOptions.map(icon => (
                    <button
                      key={icon.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon_name: icon.value })}
                      className={`p-2 rounded-lg transition-colors ${
                        formData.icon_name === icon.value
                          ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 ring-2 ring-blue-500'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {icon.component}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cor
                </label>
                <div className="flex gap-3 mt-2">
                  {colorOptions.map(color => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color_name: color.value })}
                      className={`w-8 h-8 rounded-full ${color.class} ${
                        formData.color_name === color.value
                          ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-600'
                          : ''
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (activeTab === 'conversations') handleAddConvOrEmail('conversa');
                  else if (activeTab === 'emails') handleAddConvOrEmail('email');
                  else handleAddGrupo();
                }}
                data-testid="btn-save-add"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal (Groups / Conversas / Emails) */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {activeTab === 'conversations' ? 'Editar Conversa' : activeTab === 'emails' ? 'Editar E-mail' : 'Editar Grupo'}
              </h2>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {activeTab === 'conversations' ? 'Nome da Conversa *' : activeTab === 'emails' ? 'Nome do E-mail *' : 'Nome do Grupo *'}
                  {activeTab === 'groups' && (
                    <div className="relative group">
                      <Info className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-help" />
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                        <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded py-1.5 px-2 shadow-lg whitespace-nowrap">
                          Nome deve ser igual ao WhatsApp
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                        </div>
                      </div>
                    </div>
                  )}
                </label>
                <input
                  type="text"
                  value={formData.nome_grupo}
                  onChange={(e) => setFormData({ ...formData, nome_grupo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Horário de Envio (Brasília) *
                </label>
                <input
                  type="time"
                  value={formData.horario}
                  onChange={(e) => setFormData({ ...formData, horario: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Horário no fuso de Brasília (UTC-3)
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Conta WiseApp *
                </label>
                {loadingModalAccounts ? (
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Carregando contas...</span>
                  </div>
                ) : modalAccounts.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {modalAccounts.map(acc => (
                      <button
                        key={acc.account_id}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, account_id: Number(acc.account_id), inbox_id: null, nome_inbox: '' }))}
                        data-testid={`account-btn-edit-${acc.account_id}`}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                          formData.account_id === Number(acc.account_id)
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        {acc.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma conta disponível</p>
                )}
              </div>

              {/* Groups: Inbox selector */}
              {activeTab === 'groups' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Caixa de Entrada *
                  </label>
                  {!formData.account_id ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Selecione uma conta primeiro</p>
                  ) : loadingInboxes ? (
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Carregando caixas de entrada...</span>
                    </div>
                  ) : availableInboxes.length > 0 ? (
                    <select
                      value={formData.inbox_id || ''}
                      onChange={(e) => {
                        const selectedId = e.target.value ? Number(e.target.value) : null;
                        const selectedInbox = availableInboxes.find(i => i.id === selectedId);
                        setFormData({ ...formData, inbox_id: selectedId, nome_inbox: selectedInbox?.name || '' });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      required
                      data-testid="select-inbox-edit"
                    >
                      <option value="">Selecione uma caixa de entrada</option>
                      {availableInboxes.map(inbox => (
                        <option key={inbox.id} value={inbox.id}>
                          {inbox.name} {inbox.phone_number ? `(${inbox.phone_number})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma caixa de entrada disponível</p>
                  )}
                </div>
              )}

              {/* Conversas: Current conv + contact search to change */}
              {activeTab === 'conversations' && formData.account_id && (
                <>
                  {selectedConvId && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg">
                      <span className="text-sm text-blue-800 dark:text-blue-200">
                        <MessageCircle className="w-4 h-4 inline mr-1" />
                        Conversa atual: #{selectedConvId} {selectedConvName && `- ${selectedConvName}`}
                      </span>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Alterar Contato (opcional)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={contactSearchQuery}
                        onChange={(e) => setContactSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchContacts(contactSearchQuery); } }}
                        placeholder="Buscar contato..."
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                      <button type="button" onClick={() => searchContacts(contactSearchQuery)} disabled={loadingContactSearch} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                        {loadingContactSearch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {contactSearchResults.length > 0 && (
                    <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      {contactSearchResults.map(contact => (
                        <button key={contact.id} type="button" onClick={() => { setSelectedContact(contact); setContactSearchResults([]); fetchContactConversations(contact.id); }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                          <div className="font-medium text-gray-900 dark:text-white">{contact.name}</div>
                          {contact.phone_number && <div className="text-xs text-gray-500">{contact.phone_number}</div>}
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedContact && contactConversations.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nova Conversa</label>
                      <select value={selectedConvId || ''} onChange={(e) => { const id = e.target.value ? Number(e.target.value) : null; setSelectedConvId(id); const conv = contactConversations.find(c => c.id === id); setSelectedConvName(conv?.meta?.sender?.name || selectedContact.name); }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                        <option value="">Selecione</option>
                        {contactConversations.map(conv => (<option key={conv.id} value={conv.id}>#{conv.id} - {conv.meta?.sender?.name || 'Conversa'} ({conv.messages_count || 0} msgs · {conv.status === 'resolved' ? 'resolvida' : conv.status === 'pending' ? 'pendente' : 'aberta'})</option>))}
                      </select>
                    </div>
                  )}
                </>
              )}

              {/* E-mails: Current conv + email inbox to change */}
              {activeTab === 'emails' && formData.account_id && (
                <>
                  {selectedConvId && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded-lg">
                      <span className="text-sm text-purple-800 dark:text-purple-200">
                        <Mail className="w-4 h-4 inline mr-1" />
                        Conversa atual: #{selectedConvId} {selectedConvName && `- ${selectedConvName}`}
                      </span>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Caixa de E-mail</label>
                    {(() => {
                      const emailInbs = availableInboxes.filter(i => i.channel_type === 'Channel::Email');
                      return emailInbs.length > 0 ? (
                        <select value={formData.inbox_id || ''} onChange={(e) => { const selectedId = e.target.value ? Number(e.target.value) : null; const selectedInbox = emailInbs.find(i => i.id === selectedId); setFormData({ ...formData, inbox_id: selectedId, nome_inbox: selectedInbox?.name || '' }); if (selectedId) fetchEmailConversations(selectedId); }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                          <option value="">Selecione</option>
                          {emailInbs.map(inbox => (<option key={inbox.id} value={inbox.id}>{inbox.name}</option>))}
                        </select>
                      ) : <p className="text-sm text-gray-500">Nenhuma caixa de e-mail</p>;
                    })()}
                  </div>
                  {emailConversations.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nova Conversa de E-mail</label>
                      <select value={selectedConvId || ''} onChange={(e) => { const id = e.target.value ? Number(e.target.value) : null; setSelectedConvId(id); const conv = emailConversations.find(c => c.id === id); setSelectedConvName(conv?.meta?.sender?.name || 'E-mail'); }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                        <option value="">Selecione</option>
                        {emailConversations.map(conv => (<option key={conv.id} value={conv.id}>#{conv.id} - {conv.meta?.sender?.name || 'E-mail'} ({conv.messages_count || 0} msgs · {conv.status === 'resolved' ? 'resolvida' : conv.status === 'pending' ? 'pendente' : 'aberta'})</option>))}
                      </select>
                    </div>
                  )}
                </>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ícone
                </label>
                <div className="flex flex-wrap gap-1 mt-2 max-h-40 overflow-y-auto p-2 border border-gray-200 dark:border-gray-700 rounded-lg">
                  {iconOptions.map(icon => (
                    <button
                      key={icon.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon_name: icon.value })}
                      className={`p-2 rounded-lg transition-colors ${
                        formData.icon_name === icon.value
                          ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 ring-2 ring-blue-500'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {icon.component}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cor
                </label>
                <div className="flex gap-3 mt-2">
                  {colorOptions.map(color => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color_name: color.value })}
                      className={`w-8 h-8 rounded-full ${color.class} ${
                        formData.color_name === color.value
                          ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-600'
                          : ''
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (activeTab === 'conversations') handleEditConvOrEmail('conversa');
                  else if (activeTab === 'emails') handleEditConvOrEmail('email');
                  else handleEditGrupo();
                }}
                data-testid="btn-save-edit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="text-red-500" size={24} />
                Confirmar Exclusão
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                Tem certeza que deseja excluir o grupo "{selectedGrupo?.nome_grupo}"? Esta ação não pode ser desfeita.
              </p>
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-100 dark:border-red-800/30">
                <p className="text-sm text-red-800 dark:text-red-200">
                  Todos os dados relacionados a este grupo, incluindo histórico de envios, serão permanentemente excluídos.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteGrupo}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Envio Details Modal */}
      {isEnvioModalOpen && selectedEnvio && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="text-blue-500" size={24} />
                Detalhes do Envio
              </h2>
            </div>
            <div className="p-6 space-y-6">
              {/* Data e Hora */}
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  Data e Hora do Envio
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  {(() => {
                    // Use created_at que já tem o timezone correto
                    const timestamp = selectedEnvio.created_at || selectedEnvio.data_envio;
                    const date = new Date(timestamp);
                    return format(date, 'dd/MM/yyyy HH:mm:ss', { locale: ptBR });
                  })()}
                </p>
              </div>

              {/* Grupo */}
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4 text-green-500" />
                  Grupo
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  {selectedEnvio.grupo?.nome_grupo || 'Grupo desconhecido'}
                </p>
              </div>

              {/* Status */}
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  {selectedEnvio.status ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  Status do Envio
                </h3>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    selectedEnvio.status 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200' 
                      : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                  }`}>
                    {selectedEnvio.status ? 'Sucesso' : 'Falha'}
                  </span>
                </div>
              </div>

              {/* Mensagem */}
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-orange-500" />
                  Mensagem de Resposta
                </h3>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {selectedEnvio.mensagem}
                </p>
              </div>

              {/* Resumo Enviado */}
              {selectedEnvio.resumo_grupo && (
                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-500" />
                    Resumo Enviado
                  </h3>
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 p-4 rounded-lg">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">
                      {selectedEnvio.resumo_grupo}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setIsEnvioModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Time Debug Modal */}
      <TimeDebugModal 
        isOpen={isTimeDebugModalOpen}
        onClose={() => setIsTimeDebugModalOpen(false)}
      />
    </div>
  );
};

export default ResumosGrupo;