import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Edit2, FileText, MessageCircle, Filter, ChevronDown, X, User, Loader2, MapPin, FilePen, Trash2, ArrowLeftRight, AlertTriangle, XCircle, Tag, CheckCircle, Calendar } from 'lucide-react';
import WhatsAppAvatar from '../../components/WhatsAppAvatar';
import { useCompanyData } from '../../hooks/useCompanyData';
import { useQuery } from '@tanstack/react-query';
import type { Motorista, MotoristaWithAddress, DocumentoMotorista } from '../../types/database';
import { formatCPF, formatPhone, formatDate } from '../../utils/format';
import DocumentUploadModal from '../../components/DocumentUploadModal';
import EditMotoristaModal from '../../components/EditMotoristaModal';
import AddMotoristaModal from '../../components/AddMotoristaModal';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import BulkActionsModal from '../../components/BulkActionsModal';
import BulkDeleteConfirmationModal from '../../components/BulkDeleteConfirmationModal';
import MassMessageModal from '../../components/MassMessageModal';
import toast from 'react-hot-toast';
import { useFloatingChat } from '../../hooks/useFloatingChat';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { usePagination } from '../../hooks/usePagination';
import Pagination from '../../components/Pagination';
import ScrollableTableIndicator from '../../components/ScrollableTableIndicator';
import ContextMenu from '../../components/ContextMenu';
import UnifiedMotoristaModal from '../../components/UnifiedMotoristaModal';
import UnifiedAgregadoModal from '../../components/UnifiedAgregadoModal';
import { TableDropdown } from '../../components/TableDropdown';
import BulkContactTagsSync from '../../components/BulkContactTagsSync';
import { useAuth } from '../../context/AuthContext';
import { useWiseAppAccess } from '../../context/WiseAppAccessContext';
import { useWiseAppSync } from '../../hooks/useWiseAppSync';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { API_BASE_URL, createApiUrl } from '@/lib/api-config-supabase';
import FilterTags from '../../components/FilterTags';

// Função auxiliar para converter ViewMotorista para Motorista
const toMotorista = (viewMotorista: ViewMotorista): MotoristaWithAddress => {
  // Convert telefone to number if it's a string
  const telefone = typeof viewMotorista.telefone === 'string' 
    ? parseInt(viewMotorista.telefone, 10) || 0 
    : viewMotorista.telefone || 0;

  const motorista: Motorista = {
    motorista_id: viewMotorista.motorista_id,
    cpf: viewMotorista.cpf || '',
    dt_nascimento: viewMotorista.dt_nascimento || '',
    genero: viewMotorista.genero || '',
    telefone: telefone,
    email: viewMotorista.email || null,
    funcao: 'Motorista',
    nome: viewMotorista.nome || '',
    origem_usuario: viewMotorista.origem_usuario || '',
    st_cadastro: viewMotorista.st_cadastro || '',
    autorizacao_lgpd: viewMotorista.autorizacao_lgpd || '',
    company_id: viewMotorista.company_id || 0,
    data_cadastro: viewMotorista.data_cadastro || '',
    cliente_id: viewMotorista.cliente_id || 0,
    ativo: viewMotorista.ativo || false,
    foto_whatsapp: viewMotorista.foto_whatsapp || null
  };

  const motoristaWithAddress: MotoristaWithAddress = {
    ...motorista,
    endereco: viewMotorista.endereco ? {
      id_end_motorista: viewMotorista.id_end_motorista || 0,
      nr_end: viewMotorista.nr_end,
      ds_complemento_end: viewMotorista.ds_complemento_end,
      st_end: viewMotorista.st_end,
      logradouro: viewMotorista.logradouro,
      nr_cep: viewMotorista.nr_cep,
      bairro: viewMotorista.nome_bairro,
      cidade: viewMotorista.nome_cidade,
      estado: viewMotorista.nome_estado,
      sigla_estado: viewMotorista.sigla_estado
    } : undefined,
    veiculo: viewMotorista.veiculo ? viewMotorista.veiculo[0] : undefined
  };

  return motoristaWithAddress;
};

// Status options for dropdown - matching database values exactly
const STATUS_OPTIONS = [
  { value: 'Cadastrado', label: 'Cadastrado', color: 'bg-gray-100 dark:bg-gray-700' },
  { value: 'qualificado', label: 'Qualificado', color: 'bg-blue-100 dark:bg-blue-900/30' },
  { value: 'documentacao', label: 'Documentação', color: 'bg-yellow-100 dark:bg-yellow-900/30' },
  { value: 'contrato_enviado', label: 'Contrato Enviado', color: 'bg-purple-100 dark:bg-purple-900/30' },
  { value: 'contratado', label: 'Contratado', color: 'bg-green-100 dark:bg-green-900/30' },
  { value: 'repescagem', label: 'Repescagem', color: 'bg-orange-100 dark:bg-orange-900/30' },
  { value: 'gestao_risco', label: 'Gestão de Risco', color: 'bg-rose-100 dark:bg-rose-900/30' },
  { value: 'rejeitado', label: 'Rejeitado', color: 'bg-red-100 dark:bg-red-900/30' }
];

// Interface para representar os dados da view do motorista
// Mantemos separado do tipo Motorista para evitar conflitos com campos opcionais
interface ViewMotoristaBase {
  motorista_id: number;
  nome_motorista: string;
  cpf: string;
  dt_nascimento?: string; // Torna opcional para compatibilidade
  genero: string;
  telefone: string | number | null;
  email: string | null;
  funcao: string;
  origem_usuario: string;
  st_cadastro: string;
  autorizacao_lgpd: string;
  company_id: number;
  data_cadastro: string;
  cliente_id: number | null;
  conversation_id?: string;
  ativo: boolean;
  nr_end: number | null;
  ds_complemento_end: string | null;
  st_end: boolean | null;
  id_end_motorista: number | null;
  logradouro: string | null;
  nr_cep: string | null;
  nome_bairro: string | null;
  nome_cidade: string | null;
  nome_estado: string | null;
  sigla_estado: string | null;
}

// Adicionamos campos opcionais para compatibilidade com o formulário
export interface ViewMotorista extends Omit<ViewMotoristaBase, 'nome_motorista'> {
  // Garantimos que os campos obrigatórios do Motorista estejam presentes
  motorista_id: number;
  nome: string; // Mapeado de nome_motorista
  cpf: string;
  telefone: string | number | null;
  email: string | null;
  company_id: number;
  data_cadastro: string;
  cliente_id: number | null;
  // Ajudante information
  nome_ajudante?: string;
  ajudantes?: string[]; // Add ajudantes property
  // WhatsApp photo
  foto_whatsapp?: string | null;
  // Adiciona propriedades opcionais para compatibilidade
  documento_motorista?: any[];
  veiculo?: any[];
  endereco?: any;
}

const MotoristasLista = () => {
  const { companyId } = useCompanyData();
  const { startChat } = useFloatingChat();
  const { syncAllMotoristas, isBulkSyncing } = useWiseAppSync();
  const [motoristas, setMotoristas] = useState<ViewMotorista[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [ativoFilter, setAtivoFilter] = useState<string>('');
  // Query para buscar tags da empresa
  const { data: tags = [], isLoading: tagsLoading } = useQuery<any[]>({
    queryKey: ['local-tags', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('tag')
        .select('*')
        .eq('company_id', companyId)
        .order('nome');

      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });
  const [tagSearchFilter, setTagSearchFilter] = useState('');
  const [motoristaTags, setMotoristaTags] = useState<{[key: number]: any[]}>({});
  const [tagDropdownOpen, setTagDropdownOpen] = useState<{[key: number]: boolean}>({});
  const [tagDropdownPosition, setTagDropdownPosition] = useState<{[key: number]: {top: number, left: number, width: number}}>({});
  const [updatingMotoristaTag, setUpdatingMotoristaTag] = useState<number | null>(null);
  const [tagSearchTerm, setTagSearchTerm] = useState<{[key: number]: string}>({});

  // Função para sincronizar tag com WiseApp via proxy backend
  const syncTagWithWiseApp = async (motoristaId: number, tagData: any) => {
    // Iniciando sincronização de tag

    if (!companyId) {
      console.warn('❌ CompanyId não encontrado');
      return;
    }

    try {
      // 1. Buscar todas as tags existentes
      const labelsResponse = await fetch(createApiUrl(`wiseapp/${companyId}/labels`), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'wiseapp-account-id': accountId || '',
          'wiseapp-token': wiseAppToken || ''
        }
      });

      if (!labelsResponse.ok) {
        // Erro ao buscar tags
        return;
      }

      const labels = await labelsResponse.json();
      // Tags encontradas

      const existingTag = labels.find((label: any) => 
        label.name.toLowerCase() === tagData.nome.toLowerCase()
      );

      if (!existingTag) {
        // Tag não encontrada
        // Available tags processed
        return;
      }

      // Tag encontrada

      // 2. Buscar o motorista para obter o telefone
      const motorista = motoristas.find(m => m.motorista_id === motoristaId);
      if (!motorista?.telefone) {
        console.warn('Telefone do motorista não encontrado para sincronização');
        return;
      }

      // 3. Buscar o contato pelo telefone (sem +55 como funciona)
      const phoneStr = String(motorista.telefone);
      const formattedPhone = phoneStr.replace(/^\+55/, ''); // Remove +55 se existir

      // Buscando contato por telefone
      const searchContactResponse = await fetch(createApiUrl(`wiseapp/${companyId}/contacts/search?phone=${formattedPhone}`), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'wiseapp-account-id': accountId || '',
          'wiseapp-token': wiseAppToken || ''
        }
      });

      if (!searchContactResponse.ok) {
        // Erro ao buscar contato
        return;
      }

      const contactData = await searchContactResponse.json();
      // Contact data retrieved

      const contactId = contactData.payload?.[0]?.id || contactData[0]?.id;

      if (!contactId) {
        // Contato não encontrado
        // Contact data structure processed
        return;
      }

      // Contact found with ID

      // 4. Aplicar a tag existente ao contato específico
      // Applying tag to contact
      const applyTagResponse = await fetch(createApiUrl(`wiseapp/${companyId}/contacts/${contactId}/labels`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'wiseapp-account-id': accountId || '',
          'wiseapp-token': wiseAppToken || ''
        },
        body: JSON.stringify({
          tagName: existingTag.name
        })
      });

      // Tag application completed

      if (applyTagResponse.ok) {
        // Tag aplicada com sucesso
      } else {
        const errorText = await applyTagResponse.text();
        console.error(`❌ Erro ao aplicar tag ao contato: ${applyTagResponse.status} - ${errorText}`);
      }

    } catch (error) {
      console.warn('Erro ao sincronizar tag com WiseApp (não crítico):', error);
    }
  };

  const removeTagFromWiseApp = async (motoristaId: number, tagId: number) => {
    if (!companyId) return;

    try {
      // Buscar dados da tag
      const { data: tagData } = await supabase
        .from('tag')
        .select('*')
        .eq('id', tagId)
        .single();

      if (!tagData) return;

      // Buscar labels no WiseApp via proxy
      const labelsResponse = await fetch(createApiUrl(`wiseapp/${companyId}/labels`), {
        headers: {
          'wiseapp-account-id': accountId || '',
          'wiseapp-token': wiseAppToken || ''
        }
      });

      if (labelsResponse.ok) {
        const labels = await labelsResponse.json();
        const wiseAppLabel = labels.find((label: any) => label.name === tagData.nome);

        if (wiseAppLabel) {
          // Remover label do WiseApp via proxy
          const deleteResponse = await fetch(createApiUrl(`wiseapp/${companyId}/labels/${wiseAppLabel.id}`), {
            method: 'DELETE',
            headers: {
              'wiseapp-account-id': accountId || '',
              'wiseapp-token': wiseAppToken || ''
            }
          });

          if (deleteResponse.ok) {
            // Tag removed from WiseApp successfully
          } else {
            console.warn(`Erro ao remover tag do WiseApp: ${deleteResponse.status}`);
          }
        }
      } else {
        console.warn(`Erro ao buscar labels do WiseApp: ${labelsResponse.status}`);
      }
    } catch (error) {
      console.warn('Erro ao remover tag do WiseApp (não crítico):', error);
    }
  };

  // Função para adicionar marcador a um motorista
  const handleAddTag = async (motoristaId: number, tagId: number) => {
    try {
      setUpdatingMotoristaTag(motoristaId);
      setTagDropdownOpen(prev => ({ ...prev, [motoristaId]: false }));

      // Verificar se a associação já existe (ignorar erros RLS)
      let skipDuplicateCheck = false;
      try {
        const { data: existingAssociation } = await supabase
          .from('associacao_tags')
          .select('id')
          .eq('motorista_id', motoristaId)
          .eq('tag_id', tagId)
          .single();

        if (existingAssociation) {
          toast.error('Marcador já está associado a este motorista');
          return;
        }
      } catch (error: any) {
        // Ignorar erros de RLS (406) e continuar com a aplicação
        if (error.code === 'PGRST301' || error.status === 406) {
          console.warn('RLS blocked duplicate check, proceeding anyway');
          skipDuplicateCheck = true;
        } else {
          throw error;
        }
      }

      // Criar a associação no Supabase (ignorar erros RLS se duplicata check foi pulado)
      if (!skipDuplicateCheck) {
        try {
          const { data, error } = await supabase
            .from('associacao_tags')
            .insert({
              motorista_id: motoristaId,
              tag_id: tagId
            })
            .select();

          if (error) throw error;
        } catch (error: any) {
          // Ignorar erros de RLS ou duplicata
          if (error.code === 'PGRST301' || error.status === 406 || error.code === '23505') {
            console.warn('Supabase association blocked by RLS or duplicate, but WiseApp will work');
          } else {
            throw error;
          }
        }
      }

      // Buscar a tag completa para atualizar o estado local
      const { data: tagData, error: tagError } = await supabase
        .from('tag')
        .select('*')
        .eq('id', tagId)
        .single();

      if (tagError) throw tagError;

      // Atualizar tags localmente
      if (tagData) {
        setMotoristaTags(prev => ({
          ...prev,
          [motoristaId]: [...(prev[motoristaId] || []), tagData]
        }));
      }

      // Sincronizar com WiseApp se disponível
      if (accountId && wiseAppToken) {
        try {
          await syncTagWithWiseApp(motoristaId, tagData);
        } catch (wiseAppError) {
          console.error('Erro ao sincronizar com WiseApp:', wiseAppError);
          // Não falhar a operação se o WiseApp falhar
        }
      }

      toast.success('Marcador adicionado com sucesso!');
    } catch (error) {
      console.error('Erro ao adicionar marcador:', error);
      toast.error('Erro ao adicionar marcador');
    } finally {
      setUpdatingMotoristaTag(null);
    }
  };

  // Função para remover tag de um motorista
  const handleRemoveTag = async (motoristaId: number, tagId: number) => {
    try {
      setUpdatingMotoristaTag(motoristaId);

      // Remover a associação do Supabase
      const { error } = await supabase
        .from('associacao_tags')
        .delete()
        .eq('motorista_id', motoristaId)
        .eq('tag_id', tagId);

      if (error) throw error;

      // Remover tag localmente
      setMotoristaTags(prev => ({
        ...prev,
        [motoristaId]: (prev[motoristaId] || []).filter(tag => tag.id !== tagId)
      }));

      // Sincronizar remoção com WiseApp se disponível
      if (accountId && wiseAppToken) {
        try {
          await removeTagFromWiseApp(motoristaId, tagId);
        } catch (wiseAppError) {
          console.error('Erro ao sincronizar remoção com WiseApp:', wiseAppError);
          // Não falhar a operação se o WiseApp falhar
        }
      }

      toast.success('Marcador removido com sucesso!');
    } catch (error) {
      console.error('Erro ao remover marcador:', error);
      toast.error('Erro ao remover marcador');
    } finally {
      setUpdatingMotoristaTag(null);
    }
  };
  const [isAgregadoModalOpen, setIsAgregadoModalOpen] = useState(false);
  const [isDocumentUploadOpen, setIsDocumentUploadOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkActionsModalOpen, setIsBulkActionsModalOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'status' | 'client' | 'tags'>('status');
  const [selectedMotorista, setSelectedMotorista] = useState<ViewMotorista | null>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteFilter, setClienteFilter] = useState<string[]>([]);
  const [cidadeFilter, setCidadeFilter] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [tagFilterMode, setTagFilterMode] = useState<'contains' | 'not_contains'>('contains');
  const [showCidadeDropdown, setShowCidadeDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [showAtivoDropdown, setShowAtivoDropdown] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  // Refs para os dropdowns
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const clienteDropdownRef = useRef<HTMLDivElement>(null);
  const cidadeDropdownRef = useRef<HTMLDivElement>(null);
  const ativoDropdownRef = useRef<HTMLDivElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const motoristaTagDropdownRefs = useRef<{[key: number]: HTMLDivElement | null}>({});

  // Funções para alternar os dropdowns
  const handleToggleStatusDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowStatusDropdown(!showStatusDropdown);
    setShowCidadeDropdown(false);
    setShowClienteDropdown(false);
    setShowAtivoDropdown(false);
    setShowTagDropdown(false);
  };

  const handleToggleCidadeDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowCidadeDropdown(!showCidadeDropdown);
    setShowStatusDropdown(false);
    setShowClienteDropdown(false);
    setShowAtivoDropdown(false);
    setShowTagDropdown(false);
  };

  const handleToggleClienteDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowClienteDropdown(!showClienteDropdown);
    setShowStatusDropdown(false);
    setShowCidadeDropdown(false);
    setShowAtivoDropdown(false);
    setShowTagDropdown(false);
  };

  const handleToggleAtivoDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowAtivoDropdown(!showAtivoDropdown);
    setShowStatusDropdown(false);
    setShowCidadeDropdown(false);
    setShowClienteDropdown(false);
    setShowTagDropdown(false);
  };

  const handleToggleTagDropdown = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const isOpening = !showTagDropdown;
    setShowTagDropdown(isOpening);
    setShowStatusDropdown(false);
    setShowCidadeDropdown(false);
    setShowClienteDropdown(false);
    setShowAtivoDropdown(false);

    // Carregar tags dos motoristas apenas quando abrir o dropdown pela primeira vez
    if (isOpening && Object.keys(motoristaTags).length === 0 && motoristas.length > 0) {
      await fetchAllMotoristaTags(motoristas);
    }
  };

  const [cidades, setCidades] = useState<string[]>([]);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    motorista: ViewMotorista | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    motorista: null,
  });
  const [isUnifiedModalOpen, setIsUnifiedModalOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState<number | null>(null);
  const [clienteDropdownOpen, setClienteDropdownOpen] = useState<number | null>(null);
  const [updatingCliente, setUpdatingCliente] = useState<number | null>(null);
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [customDateRange, setCustomDateRange] = useState<{
    startDate: string;
    endDate: string;
  }>({
    startDate: '',
    endDate: '',
  });
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [documento] = useState<DocumentoMotorista | null>(null);
  const [endereco] = useState<any | null>(null);
  const [isMassMessageModalOpen, setIsMassMessageModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isNovoMotoristaModalOpen, setIsNovoMotoristaModalOpen] = useState(false);

  // Role change modal state
  const [roleChangeModal, setRoleChangeModal] = useState<{
    isOpen: boolean;
    motorista: ViewMotorista | null;
    newRole: 'Motorista' | 'Agregado' | null;
    isLoading: boolean;
  }>({
    isOpen: false,
    motorista: null,
    newRole: null,
    isLoading: false,
  });

  useEffect(() => {
    fetchMotoristas();
    fetchClientes();
    // Tags serão carregadas quando o usuário clicar no filtro
  }, [dateFilter, customDateRange]);

  // Carregar tags dos motoristas automaticamente quando a lista de motoristas mudar
  useEffect(() => {
    if (motoristas && motoristas.length > 0) {
      fetchAllMotoristaTags(motoristas);
    }
  }, [motoristas]);


  // Sistema de filtros automáticos de tags
  useEffect(() => {
    if (tags.length > 0 && motoristas.length > 0 && Object.keys(motoristaTags).length > 0) {
      applyAutomaticTagFilters();
    }
  }, [tags, motoristas, motoristaTags]);

  const applyAutomaticTagFilters = async () => {
    // Sistema duplo: filtros automáticos e aplicação automática de tags
    const currentHour = new Date().getHours();
    const isWorkingHours = currentHour >= 6 && currentHour <= 18;

    // PARTE 1: Aplicação automática de tags aos motoristas
    // Critério 1: Aplicar tag "VIP" para motoristas com veículo próprio
    const vipTag = tags.find(tag => tag.nome.toLowerCase().includes('vip'));
    if (vipTag) {
      for (const motorista of motoristas) {
        const hasVeiculo = motorista.veiculo && motorista.veiculo.length > 0;
        const alreadyHasTag = motoristaTags[motorista.motorista_id || 0]?.some((tag: any) => tag.id === vipTag.id);

        if (hasVeiculo && !alreadyHasTag && motorista.motorista_id) {
          await handleAddTag(motorista.motorista_id, vipTag.id);
        }
      }
    }

    // Critério 2: Aplicar tag "Novo" para motoristas cadastrados nos últimos 7 dias
    const novoTag = tags.find(tag => tag.nome.toLowerCase().includes('novo'));
    if (novoTag) {
      for (const motorista of motoristas) {
        const cadastroDate = new Date(motorista.data_cadastro || '');
        const daysSinceCadastro = (Date.now() - cadastroDate.getTime()) / (1000 * 60 * 60 * 24);
        const alreadyHasTag = motoristaTags[motorista.motorista_id || 0]?.some((tag: any) => tag.id === novoTag.id);

        if (daysSinceCadastro <= 7 && !alreadyHasTag && motorista.motorista_id) {
          await handleAddTag(motorista.motorista_id, novoTag.id);
        }
      }
    }

    // Critério 3: Aplicar tag "Experiente" para motoristas com mais de 6 meses
    const experienteTag = tags.find(tag => tag.nome.toLowerCase().includes('experiente'));
    if (experienteTag) {
      for (const motorista of motoristas) {
        const cadastroDate = new Date(motorista.data_cadastro || '');
        const daysSinceCadastro = (Date.now() - cadastroDate.getTime()) / (1000 * 60 * 60 * 24);
        const alreadyHasTag = motoristaTags[motorista.motorista_id || 0]?.some((tag: any) => tag.id === experienteTag.id);

        if (daysSinceCadastro > 180 && !alreadyHasTag && motorista.motorista_id) {
          await handleAddTag(motorista.motorista_id, experienteTag.id);
        }
      }
    }

    // PARTE 2: Filtros automáticos na interface
    // Durante horário comercial, mostrar apenas motoristas VIP e Experientes
    if (isWorkingHours) {
      const priorityTags = tags.filter(tag => 
        tag.nome.toLowerCase().includes('vip') || 
        tag.nome.toLowerCase().includes('experiente') ||
        tag.nome.toLowerCase().includes('prioridade')
      );

      if (priorityTags.length > 0 && tagFilter.length === 0) {
        const priorityTagIds = priorityTags.map(tag => tag.id.toString());
        setTagFilter(priorityTagIds);
        return;
      }
    }

    // Se há poucos motoristas disponíveis (<3), não filtrar por tags
    const availableMotoristas = motoristas.filter(m => m.ativo && m.st_cadastro === 'contratado');
    if (availableMotoristas.length < 3 && tagFilter.length > 0) {
      setTagFilter([]);
      return;
    }
  };

  useEffect(() => {
    // Close context menu when clicking anywhere
    const handleClick = () => {
      if (contextMenu.visible) {
        setContextMenu({ ...contextMenu, visible: false });
      }

      // Close any open status dropdown
      if (statusDropdownOpen !== null) {
        setStatusDropdownOpen(null);
      }

      // Close any open cliente dropdown
      if (clienteDropdownOpen !== null) {
        setClienteDropdownOpen(null);
      }
    };

    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [contextMenu.visible, statusDropdownOpen, clienteDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as HTMLElement;

    // Verifica se o clique foi fora do dropdown de status
    if (showStatusDropdown && statusDropdownRef.current && !statusDropdownRef.current.contains(target)) {
      setShowStatusDropdown(false);
    }

    // Verifica se o clique foi fora do dropdown de cidades
    if (showCidadeDropdown && cidadeDropdownRef.current && !cidadeDropdownRef.current.contains(target)) {
      setShowCidadeDropdown(false);
    }

    // Verifica se o clique foi fora do dropdown de clientes
    if (showClienteDropdown && clienteDropdownRef.current && !clienteDropdownRef.current.contains(target)) {
      setShowClienteDropdown(false);
    }

    // Verifica se o clique foi fora do dropdown de ativo/inativo
    if (showAtivoDropdown && ativoDropdownRef.current && !ativoDropdownRef.current.contains(target)) {
      setShowAtivoDropdown(false);
    }

    // Verifica se o clique foi fora do dropdown de tags
    if (showTagDropdown && tagDropdownRef.current && !tagDropdownRef.current.contains(target)) {
      setShowTagDropdown(false);
    }

    // Verifica se o clique foi fora dos dropdowns de tags dos motoristas
    Object.keys(tagDropdownOpen).forEach(motoristaIdStr => {
      const motoristaId = parseInt(motoristaIdStr);
      if (tagDropdownOpen[motoristaId]) {
        const ref = motoristaTagDropdownRefs.current[motoristaId];
        if (ref && !ref.contains(target)) {
          setTagDropdownOpen(prev => ({ ...prev, [motoristaId]: false }));
        }
      }
    });
  };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showStatusDropdown, showCidadeDropdown, showClienteDropdown, showAtivoDropdown, showTagDropdown, tagDropdownOpen]);

  // Listener adicional para scroll - fechar dropdowns de tags quando rolar
  useEffect(() => {
    const handleScroll = (event: Event) => {
      // Só fechar dropdown se for scroll da janela principal, não scroll interno de elementos
      if ((event.target === document || event.target === document.documentElement || event.target === document.body) && 
          Object.values(tagDropdownOpen).some(isOpen => isOpen)) {
        setTagDropdownOpen({});
        setTagDropdownPosition({});
        setTagSearchTerm({});
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [tagDropdownOpen]);

  const fetchMotoristas = async () => {
    try {
      setLoading(true);
      let query = supabase
      .from('vw_motoristas_completo')
      .select('*')
      .eq('company_id', companyId);
      // Apply date filter
      if (dateFilter !== 'all') {
        const today = new Date();
        let startDate = new Date();

        if (dateFilter === 'today') {
          // Today only
          startDate = new Date(today.setHours(0, 0, 0, 0));
          query = query.gte('data_cadastro', startDate.toISOString().split('T')[0]);
          query = query.lte('data_cadastro', new Date().toISOString().split('T')[0]);
        } else if (dateFilter === '2days') {
          // Last 2 days
          startDate.setDate(today.getDate() - 2);
          query = query.gte('data_cadastro', startDate.toISOString().split('T')[0]);
        } else if (dateFilter === '15days') {
          // Last 15 days
          startDate.setDate(today.getDate() - 15);
          query = query.gte('data_cadastro', startDate.toISOString().split('T')[0]);
        } else if (dateFilter === '30days') {
          // Last 30 days
          startDate.setDate(today.getDate() - 30);
          query = query.gte('data_cadastro', startDate.toISOString().split('T')[0]);
        } else if (dateFilter === 'custom' && customDateRange.startDate && customDateRange.endDate) {
          // Custom date range
          query = query.gte('data_cadastro', customDateRange.startDate);
          query = query.lte('data_cadastro', customDateRange.endDate);
        }
      }

      // Order by data_cadastro (newest first)
      query = query.order('data_cadastro', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      // Fetch foto_whatsapp separately for each motorista
      const motoristasComFoto = await Promise.all(
        (data || []).map(async (motorista) => {
          let foto_whatsapp = null;
          try {
            const { data: motoristaData } = await supabase
              .from('motorista')
              .select('foto_whatsapp')
              .eq('motorista_id', motorista.motorista_id)
              .single();
            foto_whatsapp = motoristaData?.foto_whatsapp || null;
          } catch (error) {
            console.warn(`Erro ao buscar foto para motorista ${motorista.motorista_id}:`, error);
          }

          return {
            ...motorista,
            nome: motorista.nome || motorista.nome_motorista || 'N/A',
            foto_whatsapp,
          };
        })
      );

      // Mapear os dados para garantir a compatibilidade com a interface ViewMotorista
      const motoristasMapeados = motoristasComFoto;

      // Agrupar ajudantes por motorista_id
      const motoristasAgrupadosMap = new Map();
      motoristasMapeados?.forEach(motorista => {
        if (!motoristasAgrupadosMap.has(motorista.motorista_id)) {
          motoristasAgrupadosMap.set(motorista.motorista_id, {
            ...motorista,
            ajudantes: motorista.nome_ajudante ? [motorista.nome_ajudante] : [],
          });
        } else {
          const existente = motoristasAgrupadosMap.get(motorista.motorista_id);
          if (motorista.nome_ajudante && !existente.ajudantes.includes(motorista.nome_ajudante)) {
            existente.ajudantes.push(motorista.nome_ajudante);
          }
        }
      });
      const motoristasAgrupados = Array.from(motoristasAgrupadosMap.values());

      // Extract unique cities from motoristas
      const uniqueCities = new Set<string>();
      motoristasAgrupados?.forEach(motorista => {
        if (motorista.nome_cidade) {
          uniqueCities.add(motorista.nome_cidade);
        }
      });
      setCidades(Array.from(uniqueCities).sort());

      setMotoristas(motoristasAgrupados || []);

      // Tags serão carregadas apenas quando necessário (filtro, ações em massa, etc.)
      // Para melhor performance, não carregar automaticamente
    } catch (error) {
      console.error('Error fetching motoristas:', error);
      toast.error('Erro ao carregar motoristas');
    } finally {
      setLoading(false);
    }
  };

  // Carregar tags individuais dos motoristas
  const fetchMotoristaTags = async (motoristas: ViewMotorista[]) => {
    try {
      const newMotoristaTags: { [key: number]: any[] } = {};

      for (const motorista of motoristas) {
        if (motorista.motorista_id) {
          try {
            const { data, error } = await supabase
              .from('tag')
              .select(`
                tag:tag_id (
                  id,
                  nome,
                  cor,
                  company_id,
                  limite_max,
                  created_at,
                  updated_at
                )
              `)
              .eq('motorista_id', motorista.motorista_id);

            if (error) throw error;
            newMotoristaTags[motorista.motorista_id] = data?.map(item => item.tag).filter(Boolean) || [];
          } catch (error) {
            console.error(`Erro ao carregar tags do motorista ${motorista.motorista_id}:`, error);
            newMotoristaTags[motorista.motorista_id] = [];
          }
        }
      }

      setMotoristaTags(newMotoristaTags);
    } catch (error) {
      console.error('Erro ao carregar marcadores dos motoristas:', error);
      toast.error('Erro ao carregar marcadores dos motoristas');
    }
  };

  const fetchAllMotoristaTags = async (motoristas: ViewMotorista[]) => {
    // Carregar tags individuais dos motoristas
    try {
      const newMotoristaTags: { [key: number]: any[] } = {};

      for (const motorista of motoristas) {
        if (motorista.motorista_id) {
          try {
            const { data, error } = await supabase
              .from('associacao_tags')
              .select(`
                tag:tag_id (
                  id,
                  nome,
                  cor,
                  company_id,
                  limite_max,
                  created_at,
                  updated_at
                )
              `)
              .eq('motorista_id', motorista.motorista_id);

            if (error) throw error;
            newMotoristaTags[motorista.motorista_id] = data?.map((item: any) => item.tag).filter(Boolean) || [];
          } catch (error) {
            console.error(`Erro ao carregar tags do motorista ${motorista.motorista_id}:`, error);
            newMotoristaTags[motorista.motorista_id] = [];
          }
        }
      }

      setMotoristaTags(newMotoristaTags);
    } catch (error) {
      console.error('Erro ao carregar marcadores dos motoristas:', error);
      toast.error('Erro ao carregar marcadores dos motoristas');
    }
  };

  // Cores padrão para os clientes (apenas fundo, sem borda)
  const defaultClientColors = [
    'bg-blue-100 dark:bg-blue-900/30',
    'bg-green-100 dark:bg-green-900/30',
    'bg-yellow-100 dark:bg-yellow-900/30',
    'bg-red-100 dark:bg-red-900/30',
    'bg-purple-100 dark:bg-purple-900/30',
    'bg-pink-100 dark:bg-pink-900/30',
    'bg-indigo-100 dark:bg-indigo-900/30',
  ];

  const fetchClientes = async () => {
    try {
      const { data, error } = await supabase
        .from('cliente')
        .select('*')
        .eq('company_id', companyId)
        .eq('st_cliente', true)
        .order('nome');

      if (error) throw error;

      // Adiciona uma cor a cada cliente (usando o índice para selecionar uma cor)
      const clientesComCores = (data || []).map((cliente, index) => ({
        ...cliente,
        cor: defaultClientColors[index % defaultClientColors.length]
      }));

      setClientes(clientesComCores);
    } catch (error) {
      console.error('Error fetching clientes:', error);
      toast.error('Erro ao carregar clientes');
    }
  };

  const { accountId } = useAuth();
  const { token: wiseAppToken } = useWiseAppAccess();


  const handleViewDocument = async (motorista: ViewMotorista | null) => {
    if (!motorista) return;

    try {
      setSelectedMotorista(motorista);

      // Verificar se é agregado para usar o modal correto
      if (motorista.funcao === 'Agregado') {
        setIsAgregadoModalOpen(true);
      } else {
        setIsUnifiedModalOpen(true);
      }
    } catch (error) {
      console.error('Error loading document:', error);
      toast.error('Erro ao carregar documento');
    }
  };

  const handleUploadDocument = (motorista: ViewMotorista) => {
    setSelectedMotorista(motorista);
    setIsDocumentUploadOpen(true);
  };

  const handleEdit = (motorista: ViewMotorista | null) => {
    if (!motorista) return;
    setSelectedMotorista(motorista);
    setIsEditModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedMotorista) return;

    try {
      const { error } = await supabase
        .from('motorista')
        .delete()
        .eq('motorista_id', selectedMotorista.motorista_id);

      if (error) throw error;

      setMotoristas(motoristas.filter(m => m.motorista_id !== selectedMotorista.motorista_id));
      toast.success('Motorista excluído com sucesso');
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting motorista:', error);
      toast.error('Erro ao excluir motorista');
    }
  };

  const handleSelectItem = (motoristaId: number, e?: React.ChangeEvent<HTMLInputElement> | React.MouseEvent) => {
    // Impede a propagação do evento para evitar fechar dropdowns ou acionar outros eventos
    if (e && 'stopPropagation' in e) {
      e.stopPropagation();
    }

    const newSelectedItems = new Set(selectedItems);
    if (newSelectedItems.has(motoristaId)) {
      newSelectedItems.delete(motoristaId);
    } else {
      newSelectedItems.add(motoristaId);
    }
    setSelectedItems(newSelectedItems);

    // Atualiza o estado de selecionar todos
    setSelectAll(newSelectedItems.size === filteredMotoristas.length);
  };

  const handleSelectAll = (e?: React.ChangeEvent<HTMLInputElement> | React.MouseEvent) => {
    // Impede a propagação do evento para evitar fechar dropdowns ou acionar outros eventos
    if (e && 'stopPropagation' in e) {
      e.stopPropagation();
    }

    if (selectAll) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(
        motoristas
          .filter(motorista => {
            if (!motorista) return false;
            const searchLower = searchTerm.toLowerCase();

            // Lógica para filtro de status (multiseleção)
            const statusMatch = statusFilter.length === 0 || 
              (motorista.st_cadastro && statusFilter.includes(motorista.st_cadastro));

            // Lógica para filtro de cliente (multiseleção)
            let clienteMatch = true;
            if (clienteFilter.length > 0) {
              if (clienteFilter.includes('sem_cliente')) {
                clienteMatch = motorista.cliente_id === null || motorista.cliente_id === undefined;
              } else {
                clienteMatch = motorista.cliente_id !== null && 
                  motorista.cliente_id !== undefined &&
                  clienteFilter.includes(motorista.cliente_id.toString());
              }

              if (clienteFilter.includes('sem_cliente') && clienteFilter.length > 1) {
                clienteMatch = clienteMatch || (motorista.cliente_id === null || motorista.cliente_id === undefined);
              }
            }

            // Lógica para filtro de cidade (já está em multiseleção)
            const cidadeMatch = cidadeFilter.length === 0 || 
              (motorista.nome_cidade && cidadeFilter.includes(motorista.nome_cidade));

            // Lógica para filtro de ativo/inativo (seleção única)
            const ativoMatch = !ativoFilter || 
              (ativoFilter === 'ativo' ? motorista.ativo === true : motorista.ativo === false);

            // Verificação de busca por texto
            const searchMatch = searchTerm === '' ||
              (motorista.nome?.toLowerCase().includes(searchLower) ||
               motorista.cpf?.includes(searchLower) ||
               (typeof motorista.email === 'string' && motorista.email.toLowerCase().includes(searchLower)) ||
               (motorista.telefone ? String(motorista.telefone).includes(searchLower) : false));

            return statusMatch && clienteMatch && cidadeMatch && ativoMatch && searchMatch;
          })
          .map(motorista => motorista.motorista_id)
      ));
    }
    setSelectAll(!selectAll);
  };

  const handleRoleChangeConfirm = async () => {
    if (!roleChangeModal.motorista || !roleChangeModal.newRole) return;

    try {
      setRoleChangeModal(prev => ({ ...prev, isLoading: true }));

      const { error } = await supabase
        .from('motorista')
        .update({ funcao: roleChangeModal.newRole })
        .eq('motorista_id', roleChangeModal.motorista.motorista_id);

      if (error) throw error;

      // Update local state
      setMotoristas(prev => 
        prev.map(m => 
          m.motorista_id === roleChangeModal.motorista?.motorista_id 
            ? { ...m, funcao: roleChangeModal.newRole as 'Motorista' | 'Agregado' } 
            : m
        )
      );

      toast.success(
        `Função alterada com sucesso para ${roleChangeModal.newRole === 'Motorista' ? 'Motorista' : 'Agregado'}!`,
        { duration: 3000 }
      );

      // If in filtered view, refresh the list
      if (searchTerm) {
        fetchMotoristas();
      }

      // Close the modal
      setRoleChangeModal({ isOpen: false, motorista: null, newRole: null, isLoading: false });
    } catch (error) {
      console.error('Error changing role:', error);
      toast.error(
        <div className="flex items-center space-x-2">
          <XCircle className="w-5 h-5 text-red-500" />
          <span>Erro ao alterar função do motorista</span>
        </div>,
        { duration: 3000 }
      );
      setRoleChangeModal(prev => ({ ...prev, isLoading: false }));
    }
  };

  const openRoleChangeModal = (motorista: ViewMotorista, newRole: 'Motorista' | 'Agregado') => {
    setRoleChangeModal({
      isOpen: true,
      motorista,
      newRole,
      isLoading: false
    });
  };

  const handleBulkDelete = async () => {
    try {
      // Delete all selected items
      for (const id of Array.from(selectedItems)) {
        const { error } = await supabase
          .from('motorista')
          .delete()
          .eq('motorista_id', id);

        if (error) throw error;
      }

      // Update the list
      setMotoristas(motoristas.filter(m => !selectedItems.has(m.motorista_id || 0)));
      toast.success(`${selectedItems.size} motorista${selectedItems.size !== 1 ? 's' : ''} excluído${selectedItems.size !== 1 ? 's' : ''} com sucesso`);

      // Reset selection
      setSelectedItems(new Set());
      setSelectAll(false);
      setIsBulkDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting motoristas:', error);
      toast.error('Erro ao excluir motoristas');
    }
  };

  const handleBulkAction = (type: 'status' | 'client' | 'tags') => {
    setBulkActionType(type);
    setIsBulkActionsModalOpen(true);
  };

  const handleMassMessage = () => {
    setIsMassMessageModalOpen(true);
  };

  const handleContextMenu = (e: React.MouseEvent, motorista: ViewMotorista) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      motorista
    });
  };

  const handleRowStatusDropdown = (e: React.MouseEvent, motoristaId: number) => {
    e.stopPropagation();
    setStatusDropdownOpen(statusDropdownOpen === motoristaId ? null : motoristaId);
    setClienteDropdownOpen(null);
  };

  const handleRowClienteDropdown = (e: React.MouseEvent, motoristaId: number) => {
    e.stopPropagation();
    setClienteDropdownOpen(clienteDropdownOpen === motoristaId ? null : motoristaId);
    setStatusDropdownOpen(null);
  };

  const handleUpdateCliente = async (e: React.MouseEvent | null, motorista: ViewMotorista, clienteId: number | null) => {
    if (e) e.stopPropagation();
    try {
      setUpdatingCliente(motorista.motorista_id || 0);

      // Update the cliente_id in the database
      const { error } = await supabase
        .from('motorista')
        .update({ cliente_id: clienteId })
        .eq('motorista_id', motorista.motorista_id);

      if (error) throw error;

      // Update the local state
      setMotoristas(prev => 
        prev.map(m => 
          m.motorista_id === motorista.motorista_id 
            ? { 
                ...m, 
                cliente_id: clienteId,
                cliente: clienteId 
                  ? clientes.find(c => c.cliente_id === clienteId) 
                  : null
              } 
            : m
        )
      );

      toast.success(clienteId ? 'Cliente atualizado com sucesso' : 'Cliente removido com sucesso');
    } catch (error) {
      console.error('Error updating cliente:', error);
      toast.error('Erro ao atualizar cliente');
    } finally {
      setUpdatingCliente(null);
      setClienteDropdownOpen(null);
    }
  };

  const handleUpdateStatus = async (e: React.MouseEvent | null, motorista: ViewMotorista, newStatus: string) => {
    if (e) e.stopPropagation();
    try {
      setUpdatingStatus(motorista.motorista_id || 0);

      const { error } = await supabase
        .from('motorista')
        .update({ st_cadastro: newStatus })
        .eq('motorista_id', motorista.motorista_id);

      if (error) throw error;

      // Update the local state
      setMotoristas(prev => 
        prev.map(m => 
          m.motorista_id === motorista.motorista_id 
            ? { ...m, st_cadastro: newStatus } 
            : m
        )
      );

      toast.success(`Status atualizado para ${newStatus.replace('_', ' ')}`);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status');
    } finally {
      setUpdatingStatus(null);
      setStatusDropdownOpen(null);
    }
  };

  const handleToggleStatus = async (e: React.MouseEvent, motorista: ViewMotorista) => {
    e.stopPropagation();
    try {
      setUpdatingStatus(motorista.motorista_id || 0);

      // Update the ativo status in the database (toggle it)
      const newAtivo = !motorista.ativo;

      const { error } = await supabase
        .from('motorista')
        .update({ ativo: newAtivo })
        .eq('motorista_id', motorista.motorista_id);

      if (error) throw error;

      // Update the local state
      setMotoristas(prev => 
        prev.map(m => 
          m.motorista_id === motorista.motorista_id 
            ? { ...m, ativo: newAtivo } 
            : m
        )
      );

      toast.success(`Motorista ${newAtivo ? 'ativado' : 'desativado'} com sucesso`);
    } catch (error) {
      console.error('Error updating ativo status:', error);
      toast.error('Erro ao atualizar status do motorista');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const filteredMotoristas = (motoristas || []).filter(motorista => {
    if (!motorista) return false;

    const searchLower = searchTerm.toLowerCase();

    // Lógica para filtro de status (multiseleção)
    const statusMatch = statusFilter.length === 0 || 
      (motorista.st_cadastro && statusFilter.includes(motorista.st_cadastro));

    // Lógica para filtro de cliente (multiseleção)
    let clienteMatch = true;
    if (clienteFilter.length > 0) {
      if (clienteFilter.includes('sem_cliente')) {
        clienteMatch = motorista.cliente_id === null || motorista.cliente_id === undefined;
      } else {
        clienteMatch = motorista.cliente_id !== null && 
          motorista.cliente_id !== undefined &&
          clienteFilter.includes(motorista.cliente_id.toString());
      }

      if (clienteFilter.includes('sem_cliente') && clienteFilter.length > 1) {
        clienteMatch = clienteMatch || (motorista.cliente_id === null || motorista.cliente_id === undefined);
      }
    }

    // Lógica para filtro de cidade (já está em multiseleção)
    const cidadeMatch = cidadeFilter.length === 0 || 
      (motorista.nome_cidade && cidadeFilter.includes(motorista.nome_cidade));

    // Lógica para filtro de ativo/inativo (seleção única)
    const ativoMatch = !ativoFilter || 
      (ativoFilter === 'ativo' ? motorista.ativo === true : motorista.ativo === false);

    // Lógica para filtro de tags (multiseleção)
    let tagMatch = true;
    if (Array.isArray(tagFilter) && tagFilter.length > 0) {
      const motoristaTagsList = motoristaTags[motorista.motorista_id] || [];

      // Garantir que temos um array válido
      if (Array.isArray(motoristaTagsList) && motoristaTagsList.length > 0) {
        const motoristaTagIds = motoristaTagsList.map((tag: any) => {
          // Garantir que o ID existe e convertê-lo para string
          return tag?.id?.toString() || '';
        }).filter(id => id !== '');

        if (tagFilterMode === 'contains') {
          // Modo "contém": motorista deve ter pelo menos uma das tags selecionadas
          tagMatch = tagFilter.some(tagId => motoristaTagIds.includes(tagId));
        } else {
          // Modo "não contém": motorista NÃO deve ter nenhuma das tags selecionadas
          tagMatch = !tagFilter.some(tagId => motoristaTagIds.includes(tagId));
        }
      } else {
        // Se motorista não tem tags, no modo "contém" não passa, no modo "não contém" passa
        tagMatch = tagFilterMode === 'not_contains';
      }
    }

    // Verificação de busca por texto
    const searchMatch = searchTerm === '' ||
      (motorista.nome?.toLowerCase().includes(searchLower) ||
       motorista.cpf?.includes(searchLower) ||
       (typeof motorista.email === 'string' && motorista.email.toLowerCase().includes(searchLower)) ||
       (motorista.telefone ? String(motorista.telefone).includes(searchLower) : false));

    try {
      return statusMatch && clienteMatch && cidadeMatch && ativoMatch && tagMatch && searchMatch;
    } catch (error) {
      console.error('Erro ao filtrar motorista:', error, motorista);
      return false;
    }
  });

  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedData,
    handlePageChange,
    handlePageSizeChange
  } = usePagination({
    data: filteredMotoristas,
    initialPageSize: 10
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          {selectedItems.size > 0 && (
            <span className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 rounded-full text-sm">
              {selectedItems.size} selecionado{selectedItems.size !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {selectedItems.size > 0 && (
            <>
              <button
                onClick={() => handleBulkAction('status')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                        transition-colors flex items-center gap-2"
              >
                <Edit2 className="w-5 h-5" />
                Atualizar Status
              </button>
              <button
                onClick={() => handleBulkAction('client')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                        transition-colors flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                Atribuir Cliente
              </button>
              <button
                onClick={() => handleBulkAction('tags')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 
                        focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 
                        transition-colors flex items-center gap-2"
              >
                <Tag className="w-5 h-5" />
                Adicionar Marcador
              </button>
              <button
                onClick={handleMassMessage}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                        transition-colors flex items-center gap-2"
              >
                <MessageCircle className="w-5 h-5" />
                Enviar Mensagem
              </button>
              <button
                onClick={() => setIsBulkDeleteModalOpen(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 
                        focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 
                        transition-colors flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18"></path>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                </svg>
                Excluir
              </button>
            </>
          )}

        </div>
      </div>

      <div className="bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-750 p-6 rounded-xl shadow-lg border border-gray-200/70 dark:border-gray-700/70 backdrop-blur-sm">
        {/* Ações */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            {/* Bulk Contact Tags Sync Button */}
            <BulkContactTagsSync 
              onSyncComplete={(result) => {
                // Atualizar tags dos motoristas após sincronização
                if (result.success && motoristas && motoristas.length > 0) {
                  fetchAllMotoristaTags(motoristas);
                }
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            {/* Contador de filtros ativos */}
            {(statusFilter.length > 0 || cidadeFilter.length > 0 || clienteFilter.length > 0 || 
              ativoFilter !== '' || tagFilter.length > 0 || dateFilter !== 'all') && (
              <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs">
                <Filter className="w-3 h-3" />
                <span>{[statusFilter.length > 0 ? 1 : 0, cidadeFilter.length > 0 ? 1 : 0, clienteFilter.length > 0 ? 1 : 0, ativoFilter !== '' ? 1 : 0, tagFilter.length > 0 ? 1 : 0, dateFilter !== 'all' ? 1 : 0].reduce((a, b) => a + b, 0)}</span>
              </div>
            )}

            {/* Botão limpar filtros */}
            {(statusFilter.length > 0 || cidadeFilter.length > 0 || clienteFilter.length > 0 || 
              ativoFilter !== '' || tagFilter.length > 0 || dateFilter !== 'all' || searchTerm) && (
              <button
                onClick={() => {
                  setStatusFilter([]);
                  setCidadeFilter([]);
                  setClienteFilter([]);
                  setAtivoFilter('');
                  setTagFilter([]);
                  setDateFilter('all');
                  setSearchTerm('');
                }}
                className="flex items-center gap-1 px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                <X className="w-3 h-3" />
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Campo de busca inteligente */}
        <div className="mb-4">
          <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center">
              <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Buscar por nome, CPF, email ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-12 py-3.5 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm group-focus-within:shadow-md"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-4 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Tags - Filtros aplicados como tags removíveis */}
        <FilterTags
          statusFilter={statusFilter}
          ativoFilter={ativoFilter}
          clienteFilter={clienteFilter}
          cidadeFilter={cidadeFilter}
          tagFilter={tagFilter}
          dateFilter={dateFilter}
          customDateRange={customDateRange}
          onRemoveStatus={(status) => {
            setStatusFilter(statusFilter.filter(s => s !== status));
          }}
          onRemoveAtivo={() => {
            setAtivoFilter('');
          }}
          onRemoveCliente={(clienteId) => {
            setClienteFilter(clienteFilter.filter(c => c !== clienteId));
          }}
          onRemoveCidade={(cidade) => {
            setCidadeFilter(cidadeFilter.filter(c => c !== cidade));
          }}
          onRemoveTag={(tagId) => {
            setTagFilter(tagFilter.filter(t => t !== tagId));
          }}
          onRemoveDate={() => {
            setDateFilter('all');
          }}
          onClearAll={() => {
            setStatusFilter([]);
            setCidadeFilter([]);
            setClienteFilter([]);
            setAtivoFilter('');
            setTagFilter([]);
            setDateFilter('all');
          }}
          clientes={clientes}
          tags={tags}
          cidades={cidades}
        />

        {/* Filtros modernos */}
        <div className="flex flex-wrap gap-3 items-center justify-between mb-4 relative z-[100]">
          <div className="flex flex-wrap gap-2">
            {/* Status Filter */}
            <div className="relative">
              <div className="relative group" ref={statusDropdownRef}>
                <button
                  type="button"
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9 w-auto"
                  onClick={handleToggleStatusDropdown}
                >
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <span>
                      {statusFilter.length === 0 ? 'Status' : `Status (${statusFilter.length})`}
                    </span>
                  </div>

                </button>

              {showStatusDropdown && (
                <div 
                  className="bg-white dark:bg-gray-700 shadow-xl rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto w-64 animate-in slide-in-from-bottom-2 fade-in duration-200"
                  style={{ 
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    marginBottom: '4px',
                    zIndex: 999999
                  }}>
                  <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Selecionar status</span>
                      <button 
                        type="button" 
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatusFilter([]);
                        }}
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                  {['cadastrado', 'qualificado', 'documentacao', 'gestao_risco', 'contrato_enviado', 'contratado', 'repescagem', 'rejeitado'].map((status) => (
                    <div key={status} className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 mr-2"
                          checked={statusFilter.includes(status)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setStatusFilter([...statusFilter, status]);
                            } else {
                              setStatusFilter(statusFilter.filter(s => s !== status));
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-200 capitalize">
                          {status === 'contrato_enviado' ? 'Contrato Enviado' : status === 'gestao_risco' ? 'Gestão de Risco' : status}
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
              </div>
            </div>

            {/* Cidade Filter */}
            <div className="relative">
              <div className="relative group" ref={cidadeDropdownRef}>
                <button
                  type="button"
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9 w-auto"
                  onClick={handleToggleCidadeDropdown}
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>
                      {cidadeFilter.length === 0 ? 'Cidade' : `Cidade (${cidadeFilter.length})`}
                    </span>
                  </div>

                </button>

              {showCidadeDropdown && (
                <div 
                  className="bg-white dark:bg-gray-700 shadow-xl rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-48 overflow-y-auto w-64 animate-in slide-in-from-bottom-2 fade-in duration-200"
                  style={{ 
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    marginBottom: '4px',
                    zIndex: 999999
                  }}>
                  <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Selecionar cidades</span>
                      <button 
                        type="button" 
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCidadeFilter([]);
                        }}
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                  {cidades.map((cidade) => (
                    <div key={cidade} className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 mr-2"
                          checked={cidadeFilter.includes(cidade)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCidadeFilter([...cidadeFilter, cidade]);
                            } else {
                              setCidadeFilter(cidadeFilter.filter(c => c !== cidade));
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-200">{cidade}</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
              </div>
            </div>

            {/* Cliente Filter */}
            <div className="relative z-[50]">
              <div className="relative group" ref={clienteDropdownRef}>
                <button
                  type="button"
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9 w-auto"
                  onClick={handleToggleClienteDropdown}
                >
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <span>
                      {clienteFilter.length === 0 ? 'Cliente' : `Cliente (${clienteFilter.length})`}
                    </span>
                  </div>

                </button>

              {showClienteDropdown && (
                <div 
                  className="bg-white dark:bg-gray-700 shadow-xl rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto w-64 animate-in slide-in-from-bottom-2 fade-in duration-200"
                  style={{ 
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    marginBottom: '4px',
                    zIndex: 999999
                  }}>
                  <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Selecionar clientes</span>
                      <button 
                        type="button" 
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setClienteFilter([]);
                        }}
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                  <div className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 mr-2"
                        checked={clienteFilter.includes('sem_cliente')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setClienteFilter([...clienteFilter, 'sem_cliente']);
                          } else {
                            setClienteFilter(clienteFilter.filter(id => id !== 'sem_cliente'));
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-200">Sem cliente</span>
                    </label>
                  </div>
                  {clientes.map(cliente => (
                    <div key={cliente.cliente_id} className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 mr-2"
                          checked={clienteFilter.includes(cliente.cliente_id.toString())}
                          onChange={(e) => {
                            const clienteId = cliente.cliente_id.toString();
                            if (e.target.checked) {
                              setClienteFilter([...clienteFilter, clienteId]);
                            } else {
                              setClienteFilter(clienteFilter.filter(id => id !== clienteId));
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-200">{cliente.nome}</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
              </div>
            </div>



            {/* Tags Filter */}
            <div className="relative z-[50]">
              <div className="relative group" ref={tagDropdownRef}>
                <button
                  type="button"
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9 w-auto"
                  onClick={handleToggleTagDropdown}
                >
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    <span>
                      {tagFilter.length === 0 
                        ? (tagFilterMode === 'contains' ? 'Contém marcadores' : 'Não contém marcadores')
                        : `${tagFilterMode === 'contains' ? 'Contém' : 'Não contém'} (${tagFilter.length})`
                      }
                    </span>
                  </div>

                </button>
                {showTagDropdown && (
                  <div 
                    className="bg-white dark:bg-gray-700 shadow-xl rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto w-80 animate-in slide-in-from-bottom-2 fade-in duration-200"
                    style={{ 
                      position: 'absolute',
                      bottom: '100%',
                      left: 0,
                      marginBottom: '4px',
                      zIndex: 999999
                    }}>

                    <div className="px-3 py-2">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Filtro de tags</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTagFilter([]);
                          }}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Limpar
                        </button>
                      </div>

                      {/* Abas Contém / Não Contém */}
                      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-md p-1 mb-3">
                        <button
                          type="button"
                          className={`flex-1 text-xs px-2 py-1 rounded transition-colors ${
                            tagFilterMode === 'contains'
                              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                              : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setTagFilterMode('contains');
                          }}
                        >
                          Contém
                        </button>
                        <button
                          type="button"
                          className={`flex-1 text-xs px-2 py-1 rounded transition-colors ${
                            tagFilterMode === 'not_contains'
                              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                              : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setTagFilterMode('not_contains');
                          }}
                        >
                          Não contém
                        </button>
                      </div>
                      <div className="mb-3">
                        <input
                          type="text"
                          placeholder="Pesquisar marcadores..."
                          value={tagSearchFilter}
                          onChange={(e) => setTagSearchFilter(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {tagsLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Carregando tags...</span>
                          </div>
                        ) : tags.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                            Nenhuma tag encontrada
                          </div>
                        ) : (
                          tags.filter(tag => 
                            tag.nome.toLowerCase().includes(tagSearchFilter.toLowerCase())
                          ).map((tag) => (
                            <label key={`filter-${tag.id}`} className="flex items-center cursor-pointer py-1 px-2 hover:bg-gray-50 dark:hover:bg-gray-600 rounded">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 mr-2"
                                checked={tagFilter.includes(tag.id.toString())}
                                onChange={(e) => {
                                  const tagId = tag.id.toString();
                                  if (e.target.checked) {
                                    setTagFilter([...tagFilter, tagId]);
                                  } else {
                                    setTagFilter(tagFilter.filter(id => id !== tagId));
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="flex items-center gap-2 flex-1">
                                <div
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: tag.cor }}
                                />
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                                  {tag.nome}
                                </span>
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Status Ativo Filter */}
            <div className="relative z-[50]">
              <div className="relative group" ref={ativoDropdownRef}>
                <button
                  type="button"
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9 w-auto"
                  onClick={handleToggleAtivoDropdown}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    <span>
                      {!ativoFilter ? 'Ativo' : ativoFilter === 'ativo' ? 'Ativo (Sim)' : 'Ativo (Não)'}
                    </span>
                  </div>
                </button>

                {showAtivoDropdown && (
                  <div className="absolute z-[999999] top-full mt-1 w-48 bg-white dark:bg-gray-700 shadow-xl rounded-md py-1 border border-gray-200 dark:border-gray-600">
                    <div 
                      className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 ${!ativoFilter ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                      onClick={() => {
                        setAtivoFilter('');
                        setShowAtivoDropdown(false);
                      }}
                    >
                      Todos
                    </div>
                    <div 
                      className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 ${ativoFilter === 'ativo' ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                      onClick={() => {
                        setAtivoFilter('ativo');
                        setShowAtivoDropdown(false);
                      }}
                    >
                      Somente Ativos
                    </div>
                    <div 
                      className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 ${ativoFilter === 'inativo' ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                      onClick={() => {
                        setAtivoFilter('inativo');
                        setShowAtivoDropdown(false);
                      }}
                    >
                      Somente Desativos
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Período Filter */}
            <div className="relative z-[50]">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10">
                <Calendar className="h-4 w-4 text-gray-400" />
              </div>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 pl-10 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none pr-3 h-9 w-[120px]"
              >
                <option value="all">Período</option>
                <option value="today">Hoje</option>
                <option value="2days">2 dias</option>
                <option value="15days">15 dias</option>
                <option value="30days">30 dias</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>

          </div>

          {/* Botão Sincronizar Contatos */}
          <button
            onClick={syncAllMotoristas}
            disabled={isBulkSyncing}
            className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg 
              className={`w-4 h-4 ${isBulkSyncing ? 'animate-spin' : ''}`} 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <path d="M1 4v6h6" />
              <path d="M23 20v-6h-6" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
            </svg>
            <span>{isBulkSyncing ? 'Sincronizando...' : 'Sincronizar Contatos'}</span>
          </button>

          {/* Botão Novo Motorista */}
          <button
            onClick={() => {
              setIsNovoMotoristaModalOpen(true);
              setSelectedMotorista(null);
              setIsUnifiedModalOpen(true);
            }}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2 text-sm
            text-blue-600"
            title="Adicionar motorista"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Motorista</span>
          </button>
        </div>

        {dateFilter === 'custom' && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Data inicial
              </label>
              <input
                type="date"
                value={customDateRange.startDate}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Data final
              </label>
              <input
                type="date"
                value={customDateRange.endDate}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
        )}
      </div>


      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 relative z-[10]">
        <div className="overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={(e) => {
                  handleSelectAll(e);
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  // Impede que o clique no checkbox feche dropdowns ou acione outros eventos
                  e.stopPropagation();
                }}
                className="rounded border-gray-300 text-blue-600 mr-2"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectedItems.size > 0 ? `${selectedItems.size} selecionado${selectedItems.size !== 1 ? 's' : ''}` : 'Selecionar todos'}
              </span>
            </div>
          </div>

          <div className="relative">
            <div ref={tableContainerRef} className="overflow-x-auto w-full">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800"></th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">CPF</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Contato</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Marcadores</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Cidade</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Data Cadastro</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedData.map((motorista, index) => (
                    <tr 
                      key={`motorista-${motorista.motorista_id}-${motorista.cpf || ''}-${index}`}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                        selectedItems.has(motorista.motorista_id || 0) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      } ${
                        !motorista.ativo ? 'opacity-50 bg-gray-100/50 dark:bg-gray-900/50' : ''
                      }`}
                      onContextMenu={(e) => handleContextMenu(e, motorista)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(motorista.motorista_id)}
                          onChange={(e) => {
                            // Usa o evento para evitar propagação
                            handleSelectItem(motorista.motorista_id, e);
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            // Impede que o clique no checkbox feche dropdowns ou acione outros eventos
                            e.stopPropagation();
                          }}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <WhatsAppAvatar 
                              photoUrl={motorista.foto_whatsapp}
                              name={motorista.nome}
                              size="md"
                            />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {motorista.nome || 'N/A'}
                              {motorista.ajudantes && motorista.ajudantes.length > 0 && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  Ajudantes: {motorista.ajudantes.join(', ')}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {formatCPF(motorista.cpf || '')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {motorista.telefone ? formatPhone(String(motorista.telefone)) : '-'}
                          </div>
                          {motorista.telefone && (
                            <button
                              onClick={() => {
                                if (motorista.telefone) {
                                  startChat(String(motorista.telefone), motorista.nome || '', motorista.motorista_id);
                                }
                              }}
                              className="ml-2 p-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 rounded-full hover:bg-green-50 dark:hover:bg-green-900/20"
                              title="Iniciar chat"
                            >
                              <MessageCircle size={16} />
                            </button>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {motorista.email || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="relative">
                          <TableDropdown
                            value={motorista.st_cadastro || ''}
                            options={STATUS_OPTIONS}
                            onSelect={(value) => handleUpdateStatus(null, motorista, value as string)}
                            placeholder="Selecionar Status"
                            disabled={updatingStatus === motorista.motorista_id}
                            buttonClassName={
                              motorista.st_cadastro === 'contratado' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' :
                              motorista.st_cadastro === 'rejeitado' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200' :
                              motorista.st_cadastro === 'documentacao' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200' :
                              motorista.st_cadastro === 'qualificado' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' :
                              motorista.st_cadastro === 'contrato_enviado' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200' :
                              motorista.st_cadastro === 'repescagem' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200' :
                              motorista.st_cadastro === 'gestao_risco' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200' :
                              motorista.st_cadastro === 'cadastrado' || motorista.st_cadastro === 'Cadastrado' ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200' :
                              'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                            }
                          />

                          {updatingStatus === motorista.motorista_id && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 rounded-full">
                              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="relative">
                          <TableDropdown
                            value={motorista.cliente_id?.toString() || ''}
                            options={[
                              { value: '', label: 'Sem cliente', color: 'bg-gray-100 dark:bg-gray-700' },
                              ...clientes.map(cliente => ({
                                value: cliente.cliente_id.toString(),
                                label: cliente.nome,
                                color: cliente.cor || 'bg-gray-100 dark:bg-gray-700'
                              }))
                            ]}
                            onSelect={(value: string | number) => handleUpdateCliente(null, motorista, value ? parseInt(value.toString(), 10) : null)}
                            placeholder="Selecionar Cliente"
                            disabled={updatingCliente === motorista.motorista_id}
                            buttonClassName={
                              motorista.cliente_id 
                                ? clientes.find(c => c.cliente_id === motorista.cliente_id)?.cor || 
                                  'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200'
                                : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200'
                            }
                          />

                          {updatingCliente === motorista.motorista_id && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 rounded-full">
                              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="relative">
                          {/* Tags atuais */}
                          <div className="flex flex-wrap gap-1 mb-2">
                            {motoristaTags[motorista.motorista_id]?.map((tag: any) => (
                              <span
                                key={tag.id}
                                className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full cursor-pointer hover:opacity-75 group text-gray-900 dark:text-white"
                                style={{
                                  backgroundColor: tag.cor + '30',
                                  border: `1px solid ${tag.cor}50`
                                }}
                                title="Clique para remover este marcador"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveTag(motorista.motorista_id, tag.id);
                                }}
                              >
                                {tag.nome}
                                <X className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </span>
                            ))}
                          </div>

                          {/* Botão para adicionar marcadores */}
                          <div 
                            className="relative inline-block"
                            ref={(el) => motoristaTagDropdownRefs.current[motorista.motorista_id] = el}
                          >
                            <button
                              type="button"
                              className="inline-flex items-center justify-center w-6 h-6 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 border border-dashed border-gray-300 dark:border-gray-600 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                const isOpening = !tagDropdownOpen[motorista.motorista_id];

                                if (isOpening) {
                                  // Calcular posição do dropdown e limpar campo de pesquisa
                                  const buttonElement = e.currentTarget as HTMLElement;
                                  const rect = buttonElement.getBoundingClientRect();
                                  setTagDropdownPosition(prev => ({
                                    ...prev,
                                    [motorista.motorista_id]: {
                                      top: rect.bottom + 4, // Usar posição direta, sem window.scrollY
                                      left: rect.left,      // Usar posição direta, sem window.scrollX
                                      width: 256 // w-64 = 256px
                                    }
                                  }));
                                  setTagSearchTerm(prev => ({
                                    ...prev,
                                    [motorista.motorista_id]: ''
                                  }));
                                }

                                setTagDropdownOpen(prev => ({
                                  ...prev,
                                  [motorista.motorista_id]: isOpening
                                }));
                              }}
                              disabled={updatingMotoristaTag === motorista.motorista_id}
                            >
                              {updatingMotoristaTag === motorista.motorista_id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Tag className="w-3 h-3" />
                              )}
                            </button>

                            {/* Dropdown de tags disponíveis - usando createPortal para z-index correto */}
                            {tagDropdownOpen[motorista.motorista_id] && tagDropdownPosition[motorista.motorista_id] && 
                              createPortal(
                                <div 
                                  className="bg-white dark:bg-gray-700 shadow-xl rounded-md py-2 border border-gray-200 dark:border-gray-600 max-h-48 overflow-y-auto"
                                  style={{
                                    position: 'fixed',
                                    top: tagDropdownPosition[motorista.motorista_id].top,
                                    left: tagDropdownPosition[motorista.motorista_id].left,
                                    width: tagDropdownPosition[motorista.motorista_id].width,
                                    zIndex: 9999
                                  }}
                                >
                                  <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                                    <input
                                      type="text"
                                      placeholder="Buscar marcadores..."
                                      className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      value={tagSearchTerm[motorista.motorista_id] || ''}
                                      onChange={(e) => setTagSearchTerm(prev => ({
                                        ...prev,
                                        [motorista.motorista_id]: e.target.value
                                      }))}
                                      autoFocus
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    {tags
                                      .filter(tag => {
                                        // Só mostrar tags que têm ID numérico (do Supabase) e não foram adicionadas
                                        const hasNumericId = typeof tag.id === 'number';
                                        const notAdded = !motoristaTags[motorista.motorista_id]?.some((mt: any) => mt.id === tag.id);
                                        const searchTerm = tagSearchTerm[motorista.motorista_id] || '';
                                        const matchesSearch = !searchTerm || tag.nome.toLowerCase().includes(searchTerm.toLowerCase());
                                        return hasNumericId && notAdded && matchesSearch;
                                      })
                                      .map((tag) => (
                                      <div
                                        key={tag.id}
                                        className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer select-none"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          if (motorista.motorista_id && tag.id) {
                                            handleAddTag(motorista.motorista_id, tag.id);
                                            // Fechar dropdown e limpar pesquisa após adicionar tag
                                            setTimeout(() => {
                                              setTagDropdownOpen(prev => ({ ...prev, [motorista.motorista_id]: false }));
                                              setTagDropdownPosition(prev => {
                                                const newState = { ...prev };
                                                delete newState[motorista.motorista_id];
                                                return newState;
                                              });
                                              setTagSearchTerm(prev => ({ ...prev, [motorista.motorista_id]: '' }));
                                            }, 100);
                                          }
                                        }}
                                      >
                                        <div
                                          className="w-3 h-3 rounded-full flex-shrink-0 mr-2"
                                          style={{ backgroundColor: tag.cor }}
                                        />
                                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                                          {tag.nome}
                                        </span>
                                      </div>
                                    ))}
                                    {tags.filter(tag => {
                                      const hasNumericId = typeof tag.id === 'number';
                                      const notAdded = !motoristaTags[motorista.motorista_id]?.some((mt: any) => mt.id === tag.id);
                                      const searchTerm = tagSearchTerm[motorista.motorista_id] || '';
                                      const matchesSearch = !searchTerm || tag.nome.toLowerCase().includes(searchTerm.toLowerCase());
                                      return hasNumericId && notAdded && matchesSearch;
                                    }).length === 0 && (
                                      <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                                        {tagSearchTerm[motorista.motorista_id] ? 'Nenhum marcador encontrado' : (tags.length === 0 ? 'Nenhum marcador disponível' : 'Todos os marcadores já foram adicionados')}
                                      </div>
                                    )}
                                  </div>
                                </div>,
                                document.body
                              )
                            }
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {motorista.nome_cidade || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {formatDate(motorista.data_cadastro || '')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => {
                              setSelectedMotorista(motorista);
                              setIsUnifiedModalOpen(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            title="Inspecionar motorista"
                          >
                            <FilePen size={18} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openRoleChangeModal(motorista, 'Agregado')
                            }}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            title="Transformar em Agregado"
                          >
                            <ArrowLeftRight size={18} />
                          </button>
                          <button
                            onClick={(e) => handleToggleStatus(e, motorista)}
                            disabled={updatingStatus === motorista.motorista_id}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                              motorista.ativo 
                                ? 'bg-green-500 dark:bg-green-600' 
                                : 'bg-gray-200 dark:bg-gray-700'
                            } ${updatingStatus === motorista.motorista_id ? 'opacity-50 cursor-not-allowed' : ''}`}
                            role="switch"
                            aria-checked={motorista.ativo}
                            title={motorista.ativo ? "Desativar motorista" : "Ativar motorista"}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                motorista.ativo ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                            {updatingStatus === motorista.motorista_id && (
                              <Loader2 
                                className="absolute inset-0 m-auto w-4 h-4 text-white animate-spin" 
                              />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ScrollableTableIndicator 
              containerRef={tableContainerRef} 
              className="mr-2 ml-2"
            />
          </div>
        </div>

        {filteredMotoristas.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              Nenhum motorista encontrado
            </p>
          </div>
        ) : (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </div>

      {/* Role Change Confirmation Modal */}
      {roleChangeModal.isOpen && roleChangeModal.motorista && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Confirmar alteração de função
              </h2>
              <button
                onClick={() => setRoleChangeModal({ isOpen: false, motorista: null, newRole: null, isLoading: false })}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                disabled={roleChangeModal.isLoading}
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center justify-center mb-4">
                <div className="bg-yellow-100 dark:bg-yellow-900 p-3 rounded-full">
                  <AlertTriangle className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-300 text-center mb-6">
                Tem certeza que deseja transformar <span className="font-semibold">{roleChangeModal.motorista.nome}</span> em um <span className="font-semibold">{roleChangeModal.newRole === 'Motorista' ? 'Motorista' : 'Agregado'}</span>?
              </p>

              <div className="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 dark:border-yellow-500 p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-yellow-400 dark:text-yellow-300" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      {roleChangeModal.newRole === 'Agregado' 
                        ? 'Ao transformar em Agregado, o registro será ativado automaticamente.'
                        : 'Ao transformar em Motorista, o registro será ativado automaticamente.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setRoleChangeModal({ isOpen: false, motorista: null, newRole: null, isLoading: false })}
                  disabled={roleChangeModal.isLoading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleRoleChangeConfirm}
                  disabled={roleChangeModal.isLoading}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {roleChangeModal.isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    'Confirmar Alteração'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.motorista && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu({ ...contextMenu, visible: false })}
          actions={[
            {
              icon: <User size={16} />,
              label: 'Visualizar Detalhes',
              onClick: () => handleViewDocument(contextMenu.motorista!),
              color: 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300'
            },
            {
              icon: <MessageCircle size={16} />,
              label: 'Iniciar Chat',
              onClick: () => startChat(contextMenu.motorista!.telefone ? String(contextMenu.motorista!.telefone) : '', contextMenu.motorista!.nome || '', contextMenu.motorista!.motorista_id),
              color: 'text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300',
              disabled: !contextMenu.motorista!.telefone
            },
            // Divisor - usando um item de menu vazio estilizado
            {
              icon: <div className="w-full h-px bg-gray-200 dark:bg-gray-700 my-1" />,
              label: '',
              onClick: () => {},
              disabled: true
            },
            {
              icon: <Trash2 size={16} />,
              label: 'Excluir Motorista',
              onClick: () => {
                setSelectedMotorista(contextMenu.motorista!);
                setIsDeleteModalOpen(true);
              },
              color: 'text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300',
              disabled: false
            }
          ]}
        />
      )}

      {/* Modals */}
      <UnifiedMotoristaModal
        key={`motorista-modal-${selectedMotorista?.motorista_id || 'none'}`}
        isOpen={isUnifiedModalOpen}
        onClose={() => setIsUnifiedModalOpen(false)}
        motorista={selectedMotorista ? toMotorista(selectedMotorista) : null}
        onSuccess={fetchMotoristas}
      />

      <UnifiedAgregadoModal
        isOpen={isAgregadoModalOpen}
        onClose={() => setIsAgregadoModalOpen(false)}
        motorista={selectedMotorista ? toMotorista(selectedMotorista) : null}
        onSuccess={fetchMotoristas}
      />

      <DocumentUploadModal
        isOpen={isDocumentUploadOpen}
        onClose={() => setIsDocumentUploadOpen(false)}
        motorista_id={selectedMotorista?.motorista_id || 0}
        nome={selectedMotorista?.nome || ''}
        onUploadSuccess={fetchMotoristas}
      />

      {selectedMotorista && (
        <EditMotoristaModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          motorista={{
            motorista_id: selectedMotorista.motorista_id,
            cpf: selectedMotorista.cpf || '',
            dt_nascimento: selectedMotorista.dt_nascimento || '',
            genero: selectedMotorista.genero || '',
            telefone: selectedMotorista.telefone ? Number(selectedMotorista.telefone) : null,
            email: selectedMotorista.email,
            funcao: selectedMotorista.funcao || 'Motorista',
            nome: selectedMotorista.nome || '',
            origem_usuario: selectedMotorista.origem_usuario || '',
            st_cadastro: selectedMotorista.st_cadastro || '',
            autorizacao_lgpd: selectedMotorista.autorizacao_lgpd || '',
            company_id: selectedMotorista.company_id || 0,
            data_cadastro: selectedMotorista.data_cadastro || new Date().toISOString(),
            cliente_id: selectedMotorista.cliente_id || 0,
            ativo: selectedMotorista.ativo || false,
            endereco: selectedMotorista.endereco || {
              id_end_motorista: selectedMotorista.id_end_motorista || 0,
              nr_end: selectedMotorista.nr_end,
              ds_complemento_end: selectedMotorista.ds_complemento_end,
              st_end: selectedMotorista.st_end,
              logradouro: selectedMotorista.logradouro,
              nr_cep: selectedMotorista.nr_cep,
              bairro: selectedMotorista.nome_bairro,
              cidade: selectedMotorista.nome_cidade,
              estado: selectedMotorista.nome_estado,
              sigla_estado: selectedMotorista.sigla_estado
            },
            veiculo: selectedMotorista.veiculo?.[0] || undefined
          }}
          onUpdate={fetchMotoristas}
        />
      )}

      <AddMotoristaModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchMotoristas}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este motorista? Esta ação não pode ser desfeita."
        itemData={selectedMotorista ? [
          { label: 'Nome', value: selectedMotorista.nome },
          { label: 'CPF', value: formatCPF(selectedMotorista.cpf || '') },
          { label: 'Status', value: selectedMotorista.st_cadastro ?? '' }
        ] : []}
      />

      <BulkActionsModal
        isOpen={isBulkActionsModalOpen}
        onClose={() => setIsBulkActionsModalOpen(false)}
        selectedItems={selectedItems}
        actionType={bulkActionType}
        onSuccess={fetchMotoristas}
        clientes={clientes}
      />

      <BulkDeleteConfirmationModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        title="Confirmar Exclusão em Massa"
        message="Tem certeza que deseja excluir todos os motoristas selecionados? Esta ação não pode ser desfeita."
        itemCount={selectedItems.size}
        itemType="motorista"
      />

      <MassMessageModal
        isOpen={isMassMessageModalOpen}
        onClose={() => setIsMassMessageModalOpen(false)}
        numbers={Array.from(selectedItems)
          .map(id => {
            const motorista = motoristas.find(m => m.motorista_id === id);
            return motorista?.telefone ? String(motorista.telefone) : '';
          })
          .filter(Boolean)}
      />

      <AddMotoristaModal
        isOpen={isNovoMotoristaModalOpen}
        onClose={() => setIsNovoMotoristaModalOpen(false)}
        onSuccess={fetchMotoristas}
      />
    </div>
  );
};

export default MotoristasLista;