import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, Edit2, FileText, MessageCircle, Filter, ChevronDown, X, User, Loader2, MapPin, FilePen, Truck, Tag, CheckCircle, Calendar, Tags, Plus } from 'lucide-react';
import WhatsAppAvatar from '../../components/WhatsAppAvatar';
import { useCompanyData } from '../../hooks/useCompanyData';
import type { Motorista, MotoristaWithAddress, DocumentoMotorista, EnderecoMotorista, Veiculo } from '../../types/database'; // Adicionando tipos necessários
import { formatCPF, formatPhone, formatDate } from '../../utils/format';
import DocumentViewer from '../../components/DocumentViewer';
import DocumentUploadModal from '../../components/DocumentUploadModal';
import EditMotoristaModal from '../../components/EditMotoristaModal';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import BulkActionsModal from '../../components/BulkActionsModal';
import BulkDeleteConfirmationModal from '../../components/BulkDeleteConfirmationModal';
import MassMessageWithChatModal from '../../components/MassMessageWithChatModal';
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
import { TableDropdown } from '../../components/TableDropdown';
import { useWiseAppAccess } from '../../context/WiseAppAccessContext';
import { useAuth } from '../../context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { searchWiseAppContact, applyWiseAppContactLabels, getWiseAppLabels } from '../../lib/directApiService';

// Interface para a view de contratados
export interface ViewContratado {
  motorista_id?: number;
  nome_motorista?: string;
  cpf?: string;
  dt_nascimento?: string;
  genero?: string;
  telefone?: string | number | null;
  email?: string | null;
  funcao?: string;
  origem_usuario?: string;
  st_cadastro?: string | null;
  autorizacao_lgpd?: string;
  company_id?: number;
  data_cadastro?: string;
  integracao_data?: string | null;
  treinamento_data?: string | null;
  treinamento?: boolean;
  cliente_id?: number | null;
  conversation_id?: string;
  foto_whatsapp?: string | null;
  ativo?: boolean;
  nr_end?: number | null;
  ds_complemento_end?: string | null;
  st_end?: boolean | null;
  id_end_motorista?: number | null;
  logradouro?: string | null;
  nr_cep?: string | null;
  nome_bairro?: string | null;
  nome_cidade?: string | null;
  nome_estado?: string | null;
  sigla_estado?: string | null;
  veiculo_id?: number | null;
  placa?: string | null;
  status_veiculo?: boolean | null;
  marca?: string | null;
  tipologia?: string | null;
  ano?: string | null;
  combustivel?: string | null;
  peso?: string | null;
  cubagem?: string | null;
  possui_rastreador?: boolean | null;
  marca_rastreador?: string | null;
  cor?: string | null;
  tipo?: string | null;
  veiculo?: Array<{
    placa: string;
    tipologia: string;
    marca?: string;
    tipo?: string;
  }>;
  ajudantes?: string[];
}



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

const Contratados = () => {
  const { query, companyId } = useCompanyData();
  const { startChat } = useFloatingChat();
  const { accountId } = useAuth();
  const { token: wiseAppToken } = useWiseAppAccess();
  const queryClient = useQueryClient();
  const [contratados, setContratados] = useState<ViewContratado[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [ativoFilter, setAtivoFilter] = useState<string>('');
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [showCidadeDropdown, setShowCidadeDropdown] = useState(false);
  const [showTipoVeiculoDropdown, setShowTipoVeiculoDropdown] = useState(false);
  const [showFuncaoDropdown, setShowFuncaoDropdown] = useState(false);
  const [showAtivoDropdown, setShowAtivoDropdown] = useState(false);
  const ativoDropdownRef = useRef<HTMLDivElement>(null);
  const [tagDropdownOpen, setTagDropdownOpen] = useState<{[key: number]: boolean}>({});
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const cidadeDropdownRef = useRef<HTMLDivElement>(null);
  const clienteDropdownRef = useRef<HTMLDivElement>(null);
  const tipoVeiculoDropdownRef = useRef<HTMLDivElement>(null);
  const funcaoDropdownRef = useRef<HTMLDivElement>(null);
  const [isDocumentUploadOpen, setIsDocumentUploadOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkActionsModalOpen, setIsBulkActionsModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isMassMessageWithChatModalOpen, setIsMassMessageWithChatModalOpen] = useState(false);
  const [isMassMessageModalOpen, setIsMassMessageModalOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'status' | 'client'>('status');
  const [selectedMotorista, setSelectedMotorista] = useState<ViewContratado | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [documento] = useState<DocumentoMotorista | null>(null);
  const [endereco, setEndereco] = useState<{
    logradouro?: {
      logradouro?: string;
      nr_cep?: string;
      bairro?: {
        bairro?: string;
        cidade?: {
          cidade?: string;
          estado?: {
            sigla_estado?: string;
          };
        };
      };
    };
    nr_end?: number;
    ds_complemento_end?: string;
  } | null>(null);

  // Atualiza o endereco quando o selectedMotorista mudar
  useEffect(() => {
    if (selectedMotorista) {
      setEndereco({
        logradouro: {
          logradouro: selectedMotorista.logradouro || undefined,
          nr_cep: selectedMotorista.nr_cep || undefined,
          bairro: {
            bairro: selectedMotorista.nome_bairro || undefined,
            cidade: {
              cidade: selectedMotorista.nome_cidade || undefined,
              estado: {
                sigla_estado: selectedMotorista.sigla_estado || undefined
              }
            }
          }
        },
        nr_end: selectedMotorista.nr_end || undefined,
        ds_complemento_end: selectedMotorista.ds_complemento_end || undefined
      });
    } else {
      setEndereco(null);
    }
  }, [selectedMotorista]);

  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteFilter, setClienteFilter] = useState<string[]>([]);
  const [cidadeFilter, setCidadeFilter] = useState<string[]>([]);
  const [cidades, setCidades] = useState<string[]>([]);
  const [tipoVeiculoFilter, setTipoVeiculoFilter] = useState<string[]>([]);
  const [tiposVeiculo, setTiposVeiculo] = useState<string[]>([]);
  const [funcaoFilter, setFuncaoFilter] = useState<string[]>([]);
  const [funcoes, setFuncoes] = useState<string[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [visibleTags, setVisibleTags] = useState<string[]>([]);
  const [motoristaTags, setMotoristaTags] = useState<{ [key: number]: any[] }>({});
  const [showTagsDropdown, setShowTagsDropdown] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);



  // Efeito para fechar dropdowns ao clicar fora deles
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      if (showStatusDropdown && statusDropdownRef.current && !statusDropdownRef.current.contains(target)) {
        setShowStatusDropdown(false);
      }
      if (showAtivoDropdown && ativoDropdownRef.current && !ativoDropdownRef.current.contains(target)) {
        setShowAtivoDropdown(false);
      }

      if (showClienteDropdown && clienteDropdownRef.current && !clienteDropdownRef.current.contains(target)) {
        setShowClienteDropdown(false);
      }
      if (showCidadeDropdown && cidadeDropdownRef.current && !cidadeDropdownRef.current.contains(target)) {
        setShowCidadeDropdown(false);
      }
      if (showTipoVeiculoDropdown && tipoVeiculoDropdownRef.current && !tipoVeiculoDropdownRef.current.contains(target)) {
        setShowTipoVeiculoDropdown(false);
      }
      if (showFuncaoDropdown && funcaoDropdownRef.current && !funcaoDropdownRef.current.contains(target)) {
        setShowFuncaoDropdown(false);
      }
      if (showTagsDropdown && !(event.target as HTMLElement).closest('#tags-dropdown')) {
        setShowTagsDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showStatusDropdown, showClienteDropdown, showCidadeDropdown, showTipoVeiculoDropdown, showFuncaoDropdown, showTagsDropdown]);

  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    motorista: ViewContratado | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    motorista: null,
  });

  const [isUnifiedModalOpen, setIsUnifiedModalOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isApplyingTag, setIsApplyingTag] = useState(false);
  const [editingDate, setEditingDate] = useState<{ type: 'integracao' | 'treinamento' | 'cadastro', motoristaId: number } | null>(null);
  const [tempDate, setTempDate] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Funções auxiliares para filtros
  const hasActiveFilters = () => {
    return statusFilter.length > 0 || cidadeFilter.length > 0 || clienteFilter.length > 0 ||
      ativoFilter !== '' || tipoVeiculoFilter.length > 0 || dateFilter !== 'all' || tagFilter.length > 0;
  };


  const [ativoDropdownPosition, setAtivoDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);


  const getActiveFiltersCount = () => {
    return [statusFilter.length > 0 ? 1 : 0, cidadeFilter.length > 0 ? 1 : 0, clienteFilter.length > 0 ? 1 : 0,
    ativoFilter !== '' ? 1 : 0, tipoVeiculoFilter.length > 0 ? 1 : 0, dateFilter !== 'all' ? 1 : 0,
    tagFilter.length > 0 ? 1 : 0].reduce((a, b) => a + b, 0);
  };

  const convertToMotorista = (contratado: ViewContratado | null): MotoristaWithAddress | null => {
    if (!contratado) return null;

    const motoristaBase: Motorista = {
      motorista_id: contratado.motorista_id || 0,
      cpf: contratado.cpf || '',
      dt_nascimento: contratado.dt_nascimento || '',
      genero: contratado.genero || '',
      telefone: contratado.telefone ? Number(contratado.telefone) : null,
      email: contratado.email || null,
      funcao: contratado.funcao || '',
      nome: contratado.nome_motorista || 'Nome não informado',
      origem_usuario: contratado.origem_usuario || '',
      st_cadastro: contratado.st_cadastro || 'cadastrado',
      autorizacao_lgpd: contratado.autorizacao_lgpd || '',
      company_id: contratado.company_id || 0,
      data_cadastro: contratado.data_cadastro || new Date().toISOString(),
      cliente_id: contratado.cliente_id || 0,
      ativo: contratado.ativo || false,
      conversation_id: contratado.conversation_id,
      cidade: contratado.nome_cidade || undefined, // Garantindo que seja string | undefined
      documento_motorista: [],
      documento_ajudante: []
    };

    // Criando o objeto de endereço se houver informações disponíveis
    const endereco: EnderecoMotorista | undefined =
      (contratado.logradouro || contratado.nr_cep || contratado.nome_bairro || contratado.nome_cidade || contratado.sigla_estado)
        ? {
          id_end_motorista: contratado.id_end_motorista || 0,
          nr_end: contratado.nr_end || null,
          ds_complemento_end: contratado.ds_complemento_end || null,
          st_end: contratado.st_end || null,
          logradouro: contratado.logradouro || null,
          nr_cep: contratado.nr_cep || null,
          bairro: contratado.nome_bairro || null,
          cidade: contratado.nome_cidade || null,
          estado: contratado.nome_estado || null,
          sigla_estado: contratado.sigla_estado || null
        }
        : undefined;

    // Criando o objeto de veículo se houver informações disponíveis
    const veiculo: Veiculo | undefined = contratado.veiculo_id || contratado.placa || contratado.tipologia
      ? {
        veiculo_id: contratado.veiculo_id || 0,
        placa: contratado.placa || '',
        status_veiculo: contratado.status_veiculo || false,
        marca: contratado.marca || '',
        tipologia: contratado.tipologia || '',
        ano: contratado.ano || '',
        combustivel: contratado.combustivel || '',
        peso: contratado.peso || '',
        cubagem: contratado.cubagem || '',
        possui_rastreador: contratado.possui_rastreador || false,
        marca_rastreador: contratado.marca_rastreador || '',
        motorista_id: contratado.motorista_id || 0,
        cor: contratado.cor || '',
        tipo: contratado.tipo || ''
      }
      : undefined;

    // Retornando o objeto MotoristaWithAddress
    return {
      ...motoristaBase,
      ...(endereco && { endereco }),
      ...(veiculo && { veiculo })
    };
  };
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);

  const [updatingCliente, setUpdatingCliente] = useState<number | null>(null);
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [customDateRange, setCustomDateRange] = useState<{
    startDate: string;
    endDate: string;
  }>({
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    fetchContratados();
    fetchClientes();
  }, [dateFilter, customDateRange, currentPage, pageSize, searchTerm]);

  useEffect(() => {
    // Close context menu when clicking anywhere
    const handleClick = () => {
      if (contextMenu.visible) {
        setContextMenu({ ...contextMenu, visible: false });
      }
    };

    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [contextMenu.visible]);

  const fetchContratados = async () => {
    try {
      setLoading(true);
  
      // STEP 1: Buscar IDs únicos separadamente para motoristas e agregados
      const [motoristasIds, agregadosIds] = await Promise.all([
        // Buscar motoristas contratados
        supabase
          .from('vw_contratados_completo')
          .select('motorista_id')
          .eq('company_id', companyId)
          .eq('st_cadastro', 'contratado')
          .eq('funcao', 'Motorista')
          .order('data_cadastro', { ascending: false }),
        
        // Buscar agregados contratados
        supabase
          .from('vw_agregados_completo')
          .select('motorista_id')
          .eq('company_id', companyId)
          .eq('st_cadastro', 'contratado')
          .eq('funcao', 'Agregado')
          .order('data_cadastro', { ascending: false })
      ]);
  
      if (motoristasIds.error) throw motoristasIds.error;
      if (agregadosIds.error) throw agregadosIds.error;
  
      // Combinar todos os IDs
      const allMotoristaIds = [
        ...(motoristasIds.data || []).map(item => item.motorista_id),
        ...(agregadosIds.data || []).map(item => item.motorista_id)
      ];
  
      const uniqueIds = [...new Set(allMotoristaIds)];
      setTotalCount(uniqueIds.length);
  
      // Aplicar paginação
      const from = (currentPage - 1) * pageSize;
      const paginatedIds = uniqueIds.slice(from, from + pageSize);
  
      if (paginatedIds.length === 0) {
        setContratados([]);
        setCidades([]);
        setTiposVeiculo([]);
        setFuncoes([]);
        return;
      }

      // STEP 2: Buscar detalhes completos apenas dos IDs paginados
      const { data: detailedData, error: detailsError } = await supabase
        .from('vw_contratados_completo')
        .select('*')
        .in('motorista_id', paginatedIds)
        .eq('company_id', companyId)
        .order('data_cadastro', { ascending: false });

      if (detailsError) throw detailsError;

      // Agrupar ajudantes por motorista_id após buscar detalhes
      const contratadosAgrupadosMap = new Map();
      allData.forEach(contratado => {
        if (!contratadosAgrupadosMap.has(contratado.motorista_id)) {
          contratadosAgrupadosMap.set(contratado.motorista_id, {
            ...contratado,
            ajudantes: contratado.nome_ajudante ? [contratado.nome_ajudante] : [],
          });
        } else {
          const existente = contratadosAgrupadosMap.get(contratado.motorista_id);
          if (contratado.nome_ajudante && !existente.ajudantes.includes(contratado.nome_ajudante)) {
            existente.ajudantes.push(contratado.nome_ajudante);
          }
        }
      });
  
      // Converter para array mantendo ordem
      const contratadosAgrupados = paginatedIds
        .map(id => contratadosAgrupadosMap.get(id))
        .filter(Boolean);
  
      // Buscar dados para filtros de forma eficiente
      const [motoristasFilters, agregadosFilters] = await Promise.all([
        supabase
          .from('vw_contratados_completo')
          .select('nome_cidade, tipologia, funcao')
          .eq('company_id', companyId)
          .eq('st_cadastro', 'contratado')
          .eq('funcao', 'Motorista'),
        
        supabase
          .from('vw_agregados_completo')
          .select('nome_cidade, tipologia, funcao')
          .eq('company_id', companyId)
          .eq('st_cadastro', 'contratado')
          .eq('funcao', 'Agregado')
      ]);
  
      if (!motoristasFilters.error && !agregadosFilters.error) {
        const uniqueCities = new Set<string>();
        const uniqueVehicleTypes = new Set<string>();
        const uniqueFunctions = new Set<string>();
  
        // Processar filtros de motoristas
        (motoristasFilters.data || []).forEach(item => {
          if (item.nome_cidade) uniqueCities.add(item.nome_cidade);
          if (item.tipologia) uniqueVehicleTypes.add(item.tipologia);
          if (item.funcao) uniqueFunctions.add(item.funcao);
        });
  
        // Processar filtros de agregados
        (agregadosFilters.data || []).forEach(item => {
          if (item.nome_cidade) uniqueCities.add(item.nome_cidade);
          if (item.tipologia) uniqueVehicleTypes.add(item.tipologia);
          if (item.funcao) uniqueFunctions.add(item.funcao);
        });
  
        setCidades(Array.from(uniqueCities).sort());
        setTiposVeiculo(Array.from(uniqueVehicleTypes).sort());
        setFuncoes(Array.from(uniqueFunctions).sort());
      }
  
      setContratados(contratadosAgrupados);
    } catch (error) {
      console.error('Erro ao buscar contratados:', error);
      toast.error('Erro ao carregar dados dos contratados');
    } finally {
      setLoading(false);
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

      // Adiciona uma cor a cada cliente
      const clientesComCor = (data || []).map((cliente, index) => ({
        ...cliente,
        cor: defaultClientColors[index % defaultClientColors.length] || 'bg-gray-100 dark:bg-gray-700',
      }));

      setClientes(clientesComCor);
    } catch (error) {
      toast.error('Erro ao carregar clientes');
    }
  };

  const handleViewDocument = async (motorista: ViewContratado) => {
    try {
      setSelectedMotorista(motorista);
      setIsUnifiedModalOpen(true);
    } catch (error) {
      toast.error('Erro ao carregar detalhes do documento');
    }
  };

  const handleUploadDocument = (motorista: ViewContratado) => {
    setSelectedMotorista(motorista);
    setIsDocumentUploadOpen(true);
  };

  const handleEdit = (motorista: ViewContratado) => {
    setSelectedMotorista(motorista);
    setIsEditModalOpen(true);
  };



  const confirmDelete = async () => {
    if (!selectedMotorista) return;

    try {
      const { error } = await query('motorista')
        .delete()
        .eq('motorista_id', selectedMotorista.motorista_id);

      if (error) throw error;

      setContratados(contratados.filter(m => m.motorista_id !== selectedMotorista.motorista_id));
      toast.success('Motorista excluído com sucesso');
      setIsDeleteModalOpen(false);
    } catch (error) {
      toast.error('Erro ao excluir motorista');
    }
  };

  const handleSelectItem = (id: number) => {
    const newSelectedItems = new Set(selectedItems);
    if (selectedItems.has(id)) {
      newSelectedItems.delete(id);
    } else {
      newSelectedItems.add(id);
    }
    setSelectedItems(newSelectedItems);

    // Update selectAll state
    setSelectAll(newSelectedItems.size === contratados.length);
  };

  // Funções para manipular filtros de múltipla seleção
  const toggleFilterOption = (filterType: 'status' | 'cliente' | 'cidade' | 'tipoVeiculo' | 'funcao', value: string) => {
    switch (filterType) {
      case 'status':
        setStatusFilter(prev =>
          prev.includes(value)
            ? prev.filter(v => v !== value)
            : [...prev, value]
        );
        break;
      case 'cliente':
        setClienteFilter(prev =>
          prev.includes(value)
            ? prev.filter(v => v !== value)
            : [...prev, value]
        );
        break;
      case 'cidade':
        setCidadeFilter(prev =>
          prev.includes(value)
            ? prev.filter(v => v !== value)
            : [...prev, value]
        );
        break;
      case 'tipoVeiculo':
        setTipoVeiculoFilter(prev =>
          prev.includes(value)
            ? prev.filter(v => v !== value)
            : [...prev, value]
        );
        break;
      case 'funcao':
        setFuncaoFilter(prev =>
          prev.includes(value)
            ? prev.filter(v => v !== value)
            : [...prev, value]
        );
        break;
    }
  };



  const clearFilter = (filterType: 'status' | 'cliente' | 'cidade' | 'tipoVeiculo' | 'funcao') => {
    switch (filterType) {
      case 'status':
        setStatusFilter([]);
        break;
      case 'cliente':
        setClienteFilter([]);
        break;
      case 'cidade':
        setCidadeFilter([]);
        break;
      case 'tipoVeiculo':
        setTipoVeiculoFilter([]);
        break;
      case 'funcao':
        setFuncaoFilter([]);
        break;
    }
  };

  const getFilterButtonText = (filterType: 'status' | 'cliente' | 'cidade' | 'tipoVeiculo' | 'funcao') => {
    const filterMap = {
      status: {
        label: 'Status',
        filter: statusFilter,
        allText: 'Todos os status'
      },
      cliente: {
        label: 'Cliente',
        filter: clienteFilter,
        allText: 'Todos os clientes'
      },
      cidade: {
        label: 'Cidade',
        filter: cidadeFilter,
        allText: 'Todas as cidades'
      },
      tipoVeiculo: {
        label: 'Tipo de Veículo',
        filter: tipoVeiculoFilter,
        allText: 'Todos os tipos de veículo'
      },
      funcao: {
        label: 'Função',
        filter: funcaoFilter,
        allText: 'Todas as funções'
      }
    };

    const { filter, allText } = filterMap[filterType];

    if (filter.length === 0) return allText;
    if (filter.length === 1) {
      if (filter[0] === 'sem_cliente') return 'Sem cliente';
      if (filter[0] === 'sem_veiculo') return 'Sem veículo';
      if (filter[0] === 'sem_funcao') return 'Sem função';
      return `${filter[0]}`;
    }
    return `${filter.length} selecionado(s)`;
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(contratados.map(m => m.motorista_id || 0)));
    }
    setSelectAll(!selectAll);
  };

  const handleBulkDelete = async () => {
    try {
      // Delete all selected items
      for (const id of Array.from(selectedItems)) {
        const { error } = await query('motorista')
          .delete()
          .eq('motorista_id', id);

        if (error) throw error;
      }

      // Update the list
      setContratados(contratados.filter(m => !selectedItems.has(m.motorista_id || 0)));
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

  const handleBulkAction = (type: 'status' | 'client') => {
    setBulkActionType(type);
    setIsBulkActionsModalOpen(true);
  };


  // Listener adicional para scroll - fechar dropdowns de tags quando rolar
  useEffect(() => {
    const handleScroll = () => {
      // Fecha todos os dropdowns de filtro se estiverem abertos
      if (showStatusDropdown) setShowStatusDropdown(false);
      if (showClienteDropdown) setShowClienteDropdown(false);
      if (showCidadeDropdown) setShowCidadeDropdown(false);
      if (showTipoVeiculoDropdown) setShowTipoVeiculoDropdown(false);
      if (showFuncaoDropdown) setShowFuncaoDropdown(false);
      if (showAtivoDropdown) setShowAtivoDropdown(false);
  
      // Mantém a lógica para fechar os dropdowns de tags das linhas
      if (Object.values(tagDropdownOpen).some(isOpen => isOpen)) {
        setTagDropdownOpen({});
      }
    };
  
    // Adiciona o listener tanto na janela principal quanto no contêiner da tabela
    const tableEl = tableContainerRef.current;
    window.addEventListener('scroll', handleScroll, true); // `true` para capturar o evento mais cedo
    if (tableEl) {
      tableEl.addEventListener('scroll', handleScroll, true);
    }
  
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      if (tableEl) {
        tableEl.removeEventListener('scroll', handleScroll, true);
      }
    };
  }, [
    // Adicione todas as dependências para o hook funcionar corretamente
    tagDropdownOpen,
    showStatusDropdown,
    showClienteDropdown,
    showCidadeDropdown,
    showTipoVeiculoDropdown,
    showFuncaoDropdown
  ]);
  
  
  const handleBulkUpdateTreinamento = async (marcar: boolean) => {
    if (selectedItems.size === 0) {
      toast.error('Selecione pelo menos um motorista');
      return;
    }

    try {
      const newDate = marcar ? new Date().toISOString().split('T')[0] : null;

      // Atualiza no banco de dados
      const { error } = await supabase
        .from('motorista_eventos_cliente')
        .upsert(
          Array.from(selectedItems).map(id => ({
            motorista_id: id,
            treinamento: marcar,
            treinamento_data: newDate
          })),
          { onConflict: 'motorista_id' }
        );

      if (error) throw error;

      // Atualiza o estado local
      setContratados(prev =>
        prev.map(motorista =>
          selectedItems.has(motorista.motorista_id!)
            ? {
              ...motorista,
              treinamento: marcar,
              treinamento_data: newDate
            }
            : motorista
        )
      );

      toast.success(`Treinamento ${marcar ? 'marcado' : 'desmarcado'} em massa com sucesso`);
    } catch (error) {
      console.error('Erro ao atualizar treinamento em massa:', error);
      toast.error('Erro ao atualizar treinamento');
    } finally {
      // Reset selection
      setSelectedItems(new Set());
      setSelectAll(false);
    }
  };

  const handleBulkUpdateIntegracao = async (marcar: boolean) => {
    if (selectedItems.size === 0) {
      toast.error('Selecione pelo menos um motorista');
      return;
    }

    try {
      const newDate = marcar ? new Date().toISOString().split('T')[0] : null;

      // Atualiza no banco de dados
      const { error } = await supabase
        .from('motorista_eventos_cliente')
        .upsert(
          Array.from(selectedItems).map(id => ({
            motorista_id: id,
            integracao: marcar,
            integracao_data: newDate
          })),
          { onConflict: 'motorista_id' }
        );

      if (error) throw error;

      // Atualiza o estado local
      setContratados(prev =>
        prev.map(motorista =>
          selectedItems.has(motorista.motorista_id!)
            ? {
              ...motorista,
              integracao: marcar,
              integracao_data: newDate
            }
            : motorista
        )
      );

      toast.success(`Integração Interna ${marcar ? 'marcada' : 'desmarcada'} em massa com sucesso`);

      // Reset selection
      setSelectedItems(new Set());
      setSelectAll(false);
    } catch (error) {
      console.error('Erro ao atualizar integração em massa:', error);
      toast.error('Erro ao atualizar integração');
    }
  };

  const handleMassMessage = () => {
    if (selectedItems.size === 0) {
      toast.error('Selecione pelo menos um motorista');
      return;
    }
    setIsMassMessageWithChatModalOpen(true);
  };

  const handleApplyTagsBulk = async (tagIds: string[]) => {
    if (selectedItems.size === 0) {
      toast.error('Selecione pelo menos um motorista');
      return;
    }

    try {
      // Process each selected motorista
      for (const motoristaId of Array.from(selectedItems)) {
        const motorista = contratados.find(m => m.motorista_id === motoristaId);
        if (motorista && motorista.telefone) {
          await applyTagToContactById(motorista, tagIds);
        }
      }

      toast.success(`Tags aplicadas a ${selectedItems.size} motorista${selectedItems.size !== 1 ? 's' : ''} com sucesso`);

      // Reset selection
      setSelectedItems(new Set());
      setSelectAll(false);
    } catch (error) {
      console.error('Erro ao aplicar tags em massa:', error);
      toast.error('Erro ao aplicar tags em massa');
    }
  };

  const applyTagToContactById = async (motorista: ViewContratado, tagIds: string[]) => {
    if (!motorista.telefone) return;

    try {
      // Buscar o contato no WiseApp
      const searchData = await searchWiseAppContact(accountId || '', wiseAppToken || '', motorista.telefone);
      const contacts = searchData.payload || [];

      if (contacts.length === 0) return;

      const contact = contacts[0];

      // Buscar as tags pelo ID
      const labelsData = await getWiseAppLabels(accountId || '', wiseAppToken || '');
      const tagNames = tagIds.map(tagId => {
        const tag = labelsData.payload?.find((t: any) => t.id.toString() === tagId);
        return tag?.title || tag?.name;
      }).filter(Boolean);

      if (tagNames.length > 0) {
        await applyWiseAppContactLabels(accountId || '', wiseAppToken || '', contact.id, tagNames);
      }
    } catch (error) {
      console.error('Erro ao aplicar tag ao contato:', error);
    }
  };

  const handleUpdateDataCadastro = async (motorista: ViewContratado, novaData: string) => {
    try {
      // Update the data_cadastro in the database
      const { error } = await supabase
        .from('motorista')
        .update({ data_cadastro: novaData })
        .eq('motorista_id', motorista.motorista_id);

      if (error) throw error;

      // Update the local state
      setContratados(prev =>
        prev.map(m =>
          m.motorista_id === motorista.motorista_id
            ? { ...m, data_cadastro: novaData }
            : m
        )
      );

      toast.success('Data de cadastro atualizada com sucesso');
    } catch (error) {
      console.error('Erro ao atualizar data de cadastro:', error);
      toast.error('Erro ao atualizar data de cadastro');
    }
  };

  const handleApplyTags = (motorista: ViewContratado) => {
    setSelectedMotorista(motorista);
    setIsTagModalOpen(true);
  };

  const applyTagToContact = async (tagId: string) => {
    if (!selectedMotorista || !selectedMotorista.telefone) {
      toast.error('Telefone do motorista não encontrado');
      return;
    }

    setIsApplyingTag(true);
    try {
      // Primeiro, buscar o contato no WiseApp pelo telefone
      const searchData = await searchWiseAppContact(accountId || '', wiseAppToken || '', selectedMotorista.telefone);
      const contacts = searchData.payload || [];

      if (contacts.length === 0) {
        toast.error('Contato não encontrado no WiseApp');
        return;
      }

      const contact = contacts[0]; // Pegar o primeiro contato encontrado

      // Buscar o nome da tag pelo ID para aplicar
      const selectedTag = await getWiseAppLabels(accountId || '', wiseAppToken || '');
      const tagToApply = selectedTag.payload?.find((t: any) => t.id.toString() === tagId);

      if (!tagToApply) {
        throw new Error('Tag não encontrada');
      }

      toast.success(`Marcador "${tagToApply.title || tagToApply.name}" aplicado ao contato ${selectedMotorista.nome_motorista}!`);
      setIsTagModalOpen(false);

    } catch (error) {
      console.error('Erro ao aplicar tag:', error);
      toast.error('Erro ao aplicar marcador ao contato');
    } finally {
      setIsApplyingTag(false);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, motorista: ViewContratado) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      motorista,
    });
  };



  const handleUpdateStatus = async (e: React.MouseEvent | null, motorista: ViewContratado, newStatus: string) => {
    if (e) e.stopPropagation();
    try {
      setUpdatingStatus(motorista.motorista_id || 0);

      // Update the status in the database
      const { error } = await supabase
        .from('motorista')
        .update({ st_cadastro: newStatus })
        .eq('motorista_id', motorista.motorista_id || 0);

      if (error) throw error;

      // Update the local state
      setContratados(prev =>
        prev.map(m =>
          m.motorista_id === motorista.motorista_id
            ? { ...m, st_cadastro: newStatus }
            : m
        )
      );
      toast.success('Status atualizado com sucesso');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status');
    } finally {
      setUpdatingStatus(null);
      setShowStatusDropdown(false);
    }
  };

  const handleUpdateIntegracaoInterna = async (motorista: ViewContratado, dataIntegracao: string | null) => {
    try {
      // Primeiro, verifica se já existe um registro para este motorista
      const { data: existingRecord, error: fetchError } = await supabase
        .from('motorista_eventos_cliente')
        .select('motorista_id')
        .eq('motorista_id', motorista.motorista_id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      let error;

      if (existingRecord) {
        // Se existir, faz update
        const { error: updateError } = await supabase
          .from('motorista_eventos_cliente')
          .update({
            integracao: !!dataIntegracao,
            integracao_data: dataIntegracao
          })
          .eq('motorista_id', motorista.motorista_id);

        error = updateError;
      } else {
        // Se não existir, faz insert
        const { error: insertError } = await supabase
          .from('motorista_eventos_cliente')
          .insert([{
            motorista_id: motorista.motorista_id,
            integracao: !!dataIntegracao,
            integracao_data: dataIntegracao,
            treinamento: false,
            treinamento_data: null
          }]);

        error = insertError;
      }

      if (error) throw error;

      // Atualiza o estado local
      setContratados(prev =>
        prev.map(m =>
          m.motorista_id === motorista.motorista_id
            ? {
              ...m,
              integracao_data: dataIntegracao,
              integracao: !!dataIntegracao
            }
            : m
        )
      );

      toast.success('Status de integração interna atualizado');
    } catch (error) {
      console.error('Erro ao atualizar integração interna:', error);
      toast.error('Erro ao atualizar status de integração');
    }
  };

  const handleUpdateTreinamentoCliente = async (motorista: ViewContratado, dataTreinamento: string | null) => {
    try {
      // Primeiro, verifica se já existe um registro para este motorista
      const { data: existingRecord, error: fetchError } = await supabase
        .from('motorista_eventos_cliente')
        .select('motorista_id')
        .eq('motorista_id', motorista.motorista_id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      let error;

      if (existingRecord) {
        // Se existir, faz update
        const { error: updateError } = await supabase
          .from('motorista_eventos_cliente')
          .update({
            treinamento: !!dataTreinamento,
            treinamento_data: dataTreinamento
          })
          .eq('motorista_id', motorista.motorista_id);

        error = updateError;
      } else {
        // Se não existir, faz insert
        const { error: insertError } = await supabase
          .from('motorista_eventos_cliente')
          .insert([{
            motorista_id: motorista.motorista_id,
            treinamento: !!dataTreinamento,
            treinamento_data: dataTreinamento,
            integracao: false,
            integracao_data: null
          }]);

        error = insertError;
      }

      if (error) throw error;

      // Atualiza o estado local
      setContratados(prev =>
        prev.map(m =>
          m.motorista_id === motorista.motorista_id
            ? {
              ...m,
              treinamento_data: dataTreinamento,
              treinamento: !!dataTreinamento
            }
            : m
        )
      );

      toast.success('Status de treinamento do cliente atualizado');
    } catch (error) {
      console.error('Erro ao atualizar treinamento do cliente:', error);
      toast.error('Erro ao atualizar status de treinamento');
    }
  };

  const handleUpdateCliente = async (e: React.MouseEvent | null, motorista: ViewContratado, clienteId: number | null) => {
    if (e) e.stopPropagation();
    try {
      setUpdatingCliente(motorista.motorista_id || 0);

      // Update the cliente_id in the database
      const { error } = await supabase
        .from('motorista')
        .update({ cliente_id: clienteId })
        .eq('motorista_id', motorista.motorista_id || 0);

      if (error) throw error;

      // Update the local state
      setContratados(prev =>
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
      setShowClienteDropdown(false);
    }
  };

  const handleToggleStatus = async (e: React.MouseEvent, motorista: ViewContratado) => {
    e.stopPropagation();
    try {
      setUpdatingStatus(motorista.motorista_id || 0);

      // Update the ativo status in the database (toggle it)
      const newAtivo = !motorista.ativo;

      const { error } = await supabase
        .from('motorista')
        .update({ ativo: newAtivo })
        .eq('motorista_id', motorista.motorista_id || 0);

      if (error) throw error;

      // Update the local state
      setContratados(prev =>
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

  const handleToggleAtivoDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const isOpening = !showAtivoDropdown;

    if (isOpening) {
      // Calcular posição do dropdown
      const buttonElement = e.currentTarget as HTMLElement;
      const rect = buttonElement.getBoundingClientRect();
      setAtivoDropdownPosition({
        top: rect.bottom + 4, // Para aparecer abaixo do botão
        left: rect.left,
        width: 192 // w-48 = 192px
      });
    } else {
      setAtivoDropdownPosition(null);
    }
    setShowAtivoDropdown(!showAtivoDropdown);
    setShowStatusDropdown(false);
    setShowClienteDropdown(false);
    setShowCidadeDropdown(false);
    setShowTipoVeiculoDropdown(false);
    setShowFuncaoDropdown(false);
    setShowTagsDropdown(false);
  };


  const getMotoristaCity = (motorista: ViewContratado): string | null => {
    // Usa o campo nome_cidade que já está disponível no ViewContratado
    return motorista.nome_cidade || null;
  };



  // Calculate total pages for pagination controls
  const totalPages = Math.ceil(totalCount / pageSize);

  // Dados já paginados e filtrados vem diretamente do servidor
  const paginatedData = contratados;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when changing page size
  };

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
              <div className="flex items-center gap-2">
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
                  onClick={() => handleBulkUpdateIntegracao(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 
                          focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 
                          transition-colors flex items-center gap-2"
                  title="Marcar Integração Interna"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check-circle">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <path d="m9 11 3 3L22 4" />
                  </svg>
                  Int. Interna
                </button>

                <button
                  onClick={() => handleBulkUpdateTreinamento(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 
                          focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 
                          transition-colors flex items-center gap-2"
                  title="Marcar Treinamento Cliente"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-graduation-cap">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c3 3 9 1 9-1v-5" />
                  </svg>
                  Treinamento
                </button>
              </div>
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

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4">
          {/* Compact header with search and add button */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            {/* Search bar */}
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Buscar por nome, CPF, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              />
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Filter toggle and add button */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-lg border transition-colors ${showAdvancedFilters || hasActiveFilters()
                    ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
              >
                <Filter size={16} />
                Filtros
                {hasActiveFilters() && (
                  <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {getActiveFiltersCount()}
                  </span>
                )}
                <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedFilters ? 'transform rotate-180' : ''}`} />
              </button>

              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                title="Novo Contratado"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          {/* Advanced filters - collapsible */}
          {showAdvancedFilters && (
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              {/* Filtros modernos */}
              <div className="flex flex-wrap gap-3 items-center justify-between mb-4 relative z-[100]">
                <div className="flex flex-wrap gap-2">
                  {/* Status Filter */}
                  <div className="relative z-[50]">
                    <div className="relative group" ref={statusDropdownRef}>
                      <button
                        type="button"
                        className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9 w-auto"
                        onClick={() => setShowStatusDropdown(!showStatusDropdown)}
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
                          {[
                            { value: 'cadastrado', label: 'Cadastrado' },
                            { value: 'qualificado', label: 'Qualificado' },
                            { value: 'documentacao', label: 'Documentação' },
                            { value: 'gestao_risco', label: 'Gestão de Risco' },
                            { value: 'contrato_enviado', label: 'Contrato Enviado' },
                            { value: 'contratado', label: 'Contratado' },
                            { value: 'repescagem', label: 'Repescagem' },
                            { value: 'rejeitado', label: 'Rejeitado' }
                          ].map(({ value, label }) => (
                            <div key={value} className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                              <label className="flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 mr-2"
                                  checked={statusFilter.includes(value)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setStatusFilter([...statusFilter, value]);
                                    } else {
                                      setStatusFilter(statusFilter.filter(s => s !== value));
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-200">{label}</span>
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>



                  {/* Cliente Filter */}
                  <div className="relative z-[40]">
                    <div className="relative group" ref={clienteDropdownRef}>
                      <button
                        type="button"
                        className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9 w-auto"
                        onClick={() => setShowClienteDropdown(!showClienteDropdown)}
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

                  {/* Cidade Filter */}
                  <div className="relative z-[35]">
                    <div className="relative group" ref={cidadeDropdownRef}>
                      <button
                        type="button"
                        className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9 w-auto"
                        onClick={() => setShowCidadeDropdown(!showCidadeDropdown)}
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
                          {cidades.map((cidade, index) => (
                            <div key={index} className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
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

                  {/* Tipo Veículo Filter */}
                  <div className="relative z-[25]">
                    <div className="relative group" ref={tipoVeiculoDropdownRef}>
                      <button
                        type="button"
                        className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9 w-auto"
                        onClick={() => setShowTipoVeiculoDropdown(!showTipoVeiculoDropdown)}
                      >
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4" />
                          <span>
                            {tipoVeiculoFilter.length === 0 ? 'Veículo' : `Veículo (${tipoVeiculoFilter.length})`}
                          </span>
                        </div>

                      </button>

                      {showTipoVeiculoDropdown && (
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
                              <span className="text-xs text-gray-500 dark:text-gray-400">Selecionar tipos</span>
                              <button
                                type="button"
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTipoVeiculoFilter([]);
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
                                checked={tipoVeiculoFilter.includes('sem_veiculo')}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setTipoVeiculoFilter([...tipoVeiculoFilter, 'sem_veiculo']);
                                  } else {
                                    setTipoVeiculoFilter(tipoVeiculoFilter.filter(t => t !== 'sem_veiculo'));
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-200">Sem veículo</span>
                            </label>
                          </div>
                          {tiposVeiculo.map((tipo, index) => (
                            <div key={index} className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                              <label className="flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 mr-2"
                                  checked={tipoVeiculoFilter.includes(tipo)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setTipoVeiculoFilter([...tipoVeiculoFilter, tipo]);
                                    } else {
                                      setTipoVeiculoFilter(tipoVeiculoFilter.filter(t => t !== tipo));
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-200">{tipo}</span>
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Função Filter */}
                  <div className="relative z-[30]">
                    <div className="relative group" ref={funcaoDropdownRef}>
                      <button
                        type="button"
                        className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9 w-auto"
                        onClick={() => setShowFuncaoDropdown(!showFuncaoDropdown)}
                      >
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>
                            {funcaoFilter.length === 0 ? 'Função' : `Função (${funcaoFilter.length})`}
                          </span>
                        </div>

                      </button>

                      {showFuncaoDropdown && (
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
                              <span className="text-xs text-gray-500 dark:text-gray-400">Selecionar funções</span>
                              <button
                                type="button"
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFuncaoFilter([]);
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
                                checked={funcaoFilter.includes('sem_funcao')}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFuncaoFilter([...funcaoFilter, 'sem_funcao']);
                                  } else {
                                    setFuncaoFilter(funcaoFilter.filter(f => f !== 'sem_funcao'));
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-200">Sem função</span>
                            </label>
                          </div>
                          {funcoes.map((funcao, index) => (
                            <div key={index} className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                              <label className="flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 mr-2"
                                  checked={funcaoFilter.includes(funcao)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setFuncaoFilter([...funcaoFilter, funcao]);
                                    } else {
                                      setFuncaoFilter(funcaoFilter.filter(f => f !== funcao));
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-200">{funcao}</span>
                              </label>
                            </div>
                          ))}
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

                {/* Dropdown usando createPortal */}
                {showAtivoDropdown && ativoDropdownPosition && 
                  createPortal(
                    <div 
                      className="bg-white dark:bg-gray-700 shadow-xl rounded-md py-1 border border-gray-200 dark:border-gray-600"
                      style={{
                        position: 'fixed',
                        top: ativoDropdownPosition.top,
                        left: ativoDropdownPosition.left,
                        width: ativoDropdownPosition.width,
                        zIndex: 9999
                      }}
                    >
                      <div 
                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 ${!ativoFilter ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                        onClick={() => {
                          setAtivoFilter('');
                          setShowAtivoDropdown(false);
                          setAtivoDropdownPosition(null);
                        }}
                      >
                        Todos
                      </div>
                      <div 
                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 ${ativoFilter === 'ativo' ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                        onClick={() => {
                          setAtivoFilter('ativo');
                          setShowAtivoDropdown(false);
                          setAtivoDropdownPosition(null);
                        }}
                      >
                        Somente Ativos
                      </div>
                      <div 
                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 ${ativoFilter === 'inativo' ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                        onClick={() => {
                          setAtivoFilter('inativo');
                          setShowAtivoDropdown(false);
                          setAtivoDropdownPosition(null);
                        }}
                      >
                        Somente Desativos
                      </div>
                    </div>,
                    document.body
                )}
              </div>
            </div>

                  {/* Date Filter */}
                  <div className="relative z-[10]">
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
              </div>

              {/* Custom Date Range */}
              {dateFilter === 'custom' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Data inicial
                    </label>
                    <input
                      type="date"
                      value={customDateRange.startDate}
                      onChange={(e) => setCustomDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 relative z-[1]">
        <div className="overflow-visible">
          <div className="sticky top-0 z-20 p-4 border-b border-gray-200 dark:border-gray-700 flex items-center bg-white dark:bg-gray-800">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAll}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectedItems.size > 0 ? `${selectedItems.size} selecionado${selectedItems.size !== 1 ? 's' : ''}` : 'Selecionar todos'}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div ref={tableContainerRef} className="w-full">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800"></th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">CPF</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Contato</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Cidade</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Integração Interna</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Treinamento Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Veículo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Data Cadastro</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedData.map((motorista) => (
                    <tr
                      key={motorista.motorista_id || Math.random()}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${selectedItems.has(motorista.motorista_id || 0) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        } ${motorista.ativo === false ? 'opacity-50 bg-gray-100/50 dark:bg-gray-900/50' : ''
                        }`}
                      onContextMenu={(e) => handleContextMenu(e, motorista)}
                    >

                      {/* No <tbody> - primeira coluna de cada linha */}
                      <td className="sticky left-0 z-10 px-6 py-4 whitespace-nowrap bg-white dark:bg-gray-800">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(motorista.motorista_id || 0)}
                          onChange={() => handleSelectItem(motorista.motorista_id || 0)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <WhatsAppAvatar
                              photoUrl={motorista.foto_whatsapp}
                              name={motorista.nome_motorista}
                              size="md"
                            />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {motorista.nome_motorista || ''}
                              {motorista.ajudantes && motorista.ajudantes.length > 0 && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  Ajudantes: {motorista.ajudantes.join(', ')}
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {motorista.funcao}
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
                            {motorista.telefone ? formatPhone(motorista.telefone.toString()) : '-'}
                          </div>
                          {motorista.telefone && (
                            <button
                              onClick={() => startChat(motorista.telefone?.toString() || '', motorista.nome_motorista || '', motorista.motorista_id)}
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
                            onSelect={(value) => handleUpdateCliente(null, motorista, value ? parseInt(value as string) : null)}
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
                        <div className="text-sm text-gray-900 dark:text-white">
                          {getMotoristaCity(motorista) || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <label className="inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!motorista.integracao_data}
                              onChange={(e) => {
                                const newDate = e.target.checked ? new Date().toISOString().split('T')[0] : null;
                                handleUpdateIntegracaoInterna(motorista, newDate);
                              }}
                              className="form-checkbox h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </label>
                          {motorista.integracao_data && (
                            editingDate?.type === 'integracao' && editingDate?.motoristaId === motorista.motorista_id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="date"
                                  value={tempDate}
                                  onChange={(e) => setTempDate(e.target.value)}
                                  onBlur={async () => {
                                    if (tempDate && tempDate !== motorista.integracao_data?.split('T')[0]) {
                                      await handleUpdateIntegracaoInterna(motorista, tempDate);
                                    }
                                    setEditingDate(null);
                                    setTempDate('');
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.currentTarget.blur();
                                    } else if (e.key === 'Escape') {
                                      setEditingDate(null);
                                      setTempDate('');
                                    }
                                  }}
                                  className="text-xs border rounded px-1 py-0.5 w-24"
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <span
                                className="text-sm text-gray-600 cursor-pointer hover:text-blue-600 hover:underline transition-colors"
                                onDoubleClick={() => {
                                  setEditingDate({ type: 'integracao', motoristaId: motorista.motorista_id || 0 });
                                  setTempDate(motorista.integracao_data?.split('T')[0] || '');
                                }}
                                title="Duplo clique para editar data"
                              >
                                {new Date(motorista.integracao_data + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </span>
                            )
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <label className="inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!motorista.treinamento_data}
                              onChange={(e) => {
                                const newDate = e.target.checked ? new Date().toISOString().split('T')[0] : null;
                                handleUpdateTreinamentoCliente(motorista, newDate);
                              }}
                              className="form-checkbox h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </label>
                          {motorista.treinamento_data && (
                            editingDate?.type === 'treinamento' && editingDate?.motoristaId === motorista.motorista_id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="date"
                                  value={tempDate}
                                  onChange={(e) => setTempDate(e.target.value)}
                                  onBlur={async () => {
                                    if (tempDate && tempDate !== motorista.treinamento_data?.split('T')[0]) {
                                      await handleUpdateTreinamentoCliente(motorista, tempDate);
                                    }
                                    setEditingDate(null);
                                    setTempDate('');
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.currentTarget.blur();
                                    } else if (e.key === 'Escape') {
                                      setEditingDate(null);
                                      setTempDate('');
                                    }
                                  }}
                                  className="text-xs border rounded px-1 py-0.5 w-24"
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <span
                                className="text-sm text-gray-600 cursor-pointer hover:text-blue-600 hover:underline transition-colors"
                                onDoubleClick={() => {
                                  setEditingDate({ type: 'treinamento', motoristaId: motorista.motorista_id || 0 });
                                  setTempDate(motorista.treinamento_data?.split('T')[0] || '');
                                }}
                                title="Duplo clique para editar data"
                              >
                                {new Date(motorista.treinamento_data + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </span>
                            )
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {motorista.veiculo && motorista.veiculo.length > 0 ? (
                            <div>
                              <div className="font-medium">{motorista.veiculo[0].placa || ''}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {motorista.veiculo[0].tipologia || ''}
                              </div>
                            </div>
                          ) : (
                            '-'
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {editingDate?.type === 'cadastro' && editingDate?.motoristaId === motorista.motorista_id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="date"
                                value={tempDate}
                                onChange={(e) => setTempDate(e.target.value)}
                                onBlur={async () => {
                                  if (tempDate && tempDate !== motorista.data_cadastro?.split('T')[0]) {
                                    await handleUpdateDataCadastro(motorista, tempDate);
                                  }
                                  setEditingDate(null);
                                  setTempDate('');
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.currentTarget.blur();
                                  } else if (e.key === 'Escape') {
                                    setEditingDate(null);
                                    setTempDate('');
                                  }
                                }}
                                className="text-xs border rounded px-1 py-0.5 w-24"
                                autoFocus
                              />
                            </div>
                          ) : (
                            <span
                              className="text-sm text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors"
                              onDoubleClick={() => {
                                setEditingDate({ type: 'cadastro', motoristaId: motorista.motorista_id || 0 });
                                setTempDate(motorista.data_cadastro?.split('T')[0] || '');
                              }}
                              title="Duplo clique para editar data (ou copiar com Ctrl+Click)"
                              onClickCapture={(e) => {
                                if (e.ctrlKey || e.metaKey) {
                                  const formattedDate = formatDate(motorista.data_cadastro);
                                  navigator.clipboard.writeText(formattedDate);
                                  toast.success('Data copiada para a área de transferência');
                                }
                              }}
                            >
                              {formatDate(motorista.data_cadastro)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-3">
                          <button
                            onClick={() => handleViewDocument(motorista)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            title="Visualizar"
                          >
                            <FilePen size={18} />
                          </button>
                          <button
                            onClick={(e) => handleToggleStatus(e, motorista)}
                            disabled={updatingStatus === motorista.motorista_id}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${motorista.ativo
                                ? 'bg-green-500 dark:bg-green-600'
                                : 'bg-gray-200 dark:bg-gray-700'
                              } ${updatingStatus === motorista.motorista_id ? 'opacity-50 cursor-not-allowed' : ''}`}
                            role="switch"
                            aria-checked={motorista.ativo}
                            title={motorista.ativo ? "Desativar motorista" : "Ativar motorista"}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${motorista.ativo ? 'translate-x-5' : 'translate-x-0'
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

        {paginatedData.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              Nenhum contratado encontrado
            </p>
          </div>
        ) : (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalCount}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.motorista && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu({ ...contextMenu, visible: false })}
          actions={[
            {
              icon: <User size={16} />,
              label: 'Visualizar Detalhes' as const satisfies string,
              onClick: () => handleViewDocument(contextMenu.motorista!),
              color: 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300'
            },
            {
              icon: <Edit2 size={16} />,
              label: 'Editar Motorista',
              onClick: () => handleEdit(contextMenu.motorista!),
              color: 'text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300'
            },
            {
              icon: <FileText size={16} />,
              label: 'Gerenciar Documentos',
              onClick: () => handleUploadDocument(contextMenu.motorista!),
              color: 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300'
            },
            {
              icon: <MessageCircle size={16} />,
              label: 'Iniciar Chat',
              onClick: () => startChat(contextMenu.motorista!.telefone?.toString() || '', contextMenu.motorista!.nome_motorista || ''),
              color: 'text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300',
              disabled: !contextMenu.motorista!.telefone
            },
            {
              icon: <Tags size={16} />,
              label: 'Aplicar Tags',
              onClick: () => handleApplyTags(contextMenu.motorista!),
              color: 'text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300',
              disabled: !contextMenu.motorista!.telefone
            }
          ]}
        />
      )}

      {/* Modals */}
      <UnifiedMotoristaModal
        isOpen={isUnifiedModalOpen}
        onClose={() => setIsUnifiedModalOpen(false)}
        motorista={selectedMotorista ? convertToMotorista(selectedMotorista) : null}
        onSuccess={fetchContratados}
      />

      <DocumentViewer
        isOpen={isDocumentViewerOpen}
        onClose={() => setIsDocumentViewerOpen(false)}
        documento={documento}
        nome={selectedMotorista?.nome_motorista || ''}
        cpf={selectedMotorista?.cpf}
        email={selectedMotorista?.email || undefined}
        telefone={selectedMotorista?.telefone?.toString()}
        dt_nascimento={selectedMotorista?.dt_nascimento}
        foto_whatsapp={selectedMotorista?.foto_whatsapp}
        endereco={endereco}
        st_cadastro={selectedMotorista?.st_cadastro || 'cadastrado'}
      />

      <DocumentUploadModal
        isOpen={isDocumentUploadOpen}
        onClose={() => setIsDocumentUploadOpen(false)}
        motorista_id={selectedMotorista?.motorista_id || 0}
        nome={selectedMotorista?.nome_motorista || ''}
        onUploadSuccess={fetchContratados}
      />

      <EditMotoristaModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        motorista={selectedMotorista ? (() => {
          const motoristaWithAddress: MotoristaWithAddress = {
            ...selectedMotorista as unknown as Motorista,
            nome: selectedMotorista.nome_motorista || '',
            endereco: {
              id_end_motorista: selectedMotorista.id_end_motorista || 0,
              nr_end: selectedMotorista.nr_end ?? null,
              ds_complemento_end: selectedMotorista.ds_complemento_end ?? null,
              st_end: selectedMotorista.st_end ?? null,
              logradouro: selectedMotorista.logradouro ?? null,
              nr_cep: selectedMotorista.nr_cep ?? null,
              bairro: selectedMotorista.nome_bairro ?? null,
              cidade: selectedMotorista.nome_cidade ?? null,
              estado: selectedMotorista.nome_estado ?? null,
              sigla_estado: selectedMotorista.sigla_estado ?? null
            },
            veiculo: selectedMotorista.veiculo_id ? {
              veiculo_id: selectedMotorista.veiculo_id,
              placa: selectedMotorista.placa || '',
              status_veiculo: selectedMotorista.status_veiculo || false,
              marca: selectedMotorista.marca || '',
              tipologia: selectedMotorista.tipologia || '',
              ano: selectedMotorista.ano || '',
              combustivel: selectedMotorista.combustivel || '',
              peso: selectedMotorista.peso || '',
              cubagem: selectedMotorista.cubagem || '',
              possui_rastreador: selectedMotorista.possui_rastreador || false,
              marca_rastreador: selectedMotorista.marca_rastreador || '',
              motorista_id: selectedMotorista.motorista_id || 0,
              cor: selectedMotorista.cor || '',
              tipo: selectedMotorista.tipo || ''
            } : undefined
          };
          return motoristaWithAddress;
        })() : null}
        onUpdate={fetchContratados}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este motorista? Esta ação não pode ser desfeita."
        itemData={selectedMotorista ? [
          { label: 'Nome', value: selectedMotorista.nome_motorista || 'Não informado' },
          { label: 'CPF', value: selectedMotorista.cpf ? formatCPF(selectedMotorista.cpf) : 'Não informado' },
          { label: 'Status', value: selectedMotorista.st_cadastro || 'Não informado' }
        ].filter(item => item.value !== 'Não informado') : []}
      />

      <BulkActionsModal
        isOpen={isBulkActionsModalOpen}
        onClose={() => setIsBulkActionsModalOpen(false)}
        selectedItems={selectedItems}
        actionType={bulkActionType}
        onSuccess={fetchContratados}
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
      {/* Modal de Escolha entre Chat e Mensagem em Massa */}
      <MassMessageWithChatModal
        isOpen={isMassMessageWithChatModalOpen}
        onClose={() => setIsMassMessageWithChatModalOpen(false)}
        numbers={Array.from(selectedItems)
          .map(id => {
            const motorista = contratados.find(m => m.motorista_id === id);
            return motorista?.telefone ? motorista.telefone.toString() : '';
          })
          .filter(num => num !== '')}
        motoristas={Array.from(selectedItems)
          .map(id => contratados.find(m => m.motorista_id === id))
          .filter(m => m !== undefined)}
      />

      <MassMessageModal
        isOpen={isMassMessageModalOpen}
        onClose={() => setIsMassMessageModalOpen(false)}
        numbers={Array.from(selectedItems)
          .map(id => {
            const motorista = contratados.find(m => m.motorista_id === id);
            return motorista?.telefone ? motorista.telefone.toString() : '';
          })
          .filter(Boolean)}
      />

      {/* Modal de Aplicar Tags */}
      {isTagModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Aplicar Tags - {selectedMotorista?.nome_motorista}
              </h3>
              <button
                onClick={() => setIsTagModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              {tags.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  Nenhuma tag disponível. Sincronize tags do WiseApp primeiro.
                </p>
              ) : (
                tags.map((tag: any) => (
                  <button
                    key={tag.id}
                    onClick={() => applyTagToContact(tag.id.toString())}
                    disabled={isApplyingTag}
                    className={`w-full text-left p-3 rounded-lg border-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between`}
                    style={{
                      borderColor: tag.cor || '#3B82F6',
                      backgroundColor: `${tag.cor || '#3B82F6'}10`
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: tag.cor || '#3B82F6' }}
                      />
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {tag.nome}
                      </span>
                    </div>
                    {isApplyingTag && (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                    )}
                  </button>
                ))
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsTagModalOpen(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Contratados;