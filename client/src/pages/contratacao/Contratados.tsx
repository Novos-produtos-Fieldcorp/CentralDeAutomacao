import React, { useState, useEffect, useRef } from 'react';
import { Search, Edit2, FileText, MessageCircle, Filter, ChevronDown, X, User, Loader2, MapPin, FilePen, Truck } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import type { Motorista, MotoristaWithAddress, DocumentoMotorista, EnderecoMotorista, Veiculo } from '../../types/database'; // Adicionando tipos necessários
import { formatCPF, formatPhone, formatDate } from '../../utils/format';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DocumentViewer from '../../components/DocumentViewer';
import DocumentUploadModal from '../../components/DocumentUploadModal';
import EditMotoristaModal from '../../components/EditMotoristaModal';
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
import { TableDropdown } from '../../components/TableDropdown';
import { TagsFilter } from '../../components/TagsFilter';
import { TagsDisplay } from '../../components/TagsDisplay';

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
  // Missing properties needed by the components
  nome_cliente?: string;
  cidade?: string;
  tags?: string[];
  integr_interna?: string;
  treinamento_cliente?: string;
  tipo_veiculo?: string;
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
  const [contratados, setContratados] = useState<ViewContratado[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [ativoFilter, setAtivoFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [showCidadeDropdown, setShowCidadeDropdown] = useState(false);
  const [showTipoVeiculoDropdown, setShowTipoVeiculoDropdown] = useState(false);
  const [isDocumentUploadOpen, setIsDocumentUploadOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkActionsModalOpen, setIsBulkActionsModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
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
  const tableContainerRef = useRef<HTMLDivElement>(null);
  


  // Efeito para fechar dropdowns ao clicar fora deles
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showStatusDropdown && !(event.target as HTMLElement).closest('#status-dropdown')) {
        setShowStatusDropdown(false);
      }
      if (showClienteDropdown && !(event.target as HTMLElement).closest('#cliente-dropdown')) {
        setShowClienteDropdown(false);
      }
      if (showCidadeDropdown && !(event.target as HTMLElement).closest('#cidade-dropdown')) {
        setShowCidadeDropdown(false);
      }
      if (showTipoVeiculoDropdown && !(event.target as HTMLElement).closest('#tipo-veiculo-dropdown')) {
        setShowTipoVeiculoDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showStatusDropdown, showClienteDropdown, showCidadeDropdown, showTipoVeiculoDropdown]);
  
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Utility function to get status color
  const getStatusColor = (status: string) => {
    const statusOption = STATUS_OPTIONS.find(opt => opt.value === status);
    return statusOption?.color || 'bg-gray-100 dark:bg-gray-700';
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
  }, [dateFilter, customDateRange]);

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
      // Buscar apenas os contratados (st_cadastro = 'contratado')
      let query = supabase
        .from('vw_contratados_completo')
        .select('*')
        .eq('company_id', companyId)
        .eq('st_cadastro', 'contratado');

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

      // Log the data to check the ativo field
      console.log('Fetched contratados:', data);

      // Extract unique cities from contratados
      const uniqueCities = new Set<string>();
      const uniqueVehicleTypes = new Set<string>();
      
      // Primeiro, vamos buscar os status ativos dos motoristas
      const motoristaIds = data?.map(m => m.motorista_id) || [];
      let ativosStatus: Record<number, boolean> = {};
      
      if (motoristaIds.length > 0) {
        const { data: motoristas, error: motoristasError } = await supabase
          .from('motorista')
          .select('motorista_id, ativo')
          .in('motorista_id', motoristaIds);
          
        if (motoristasError) {
          console.error('Erro ao buscar status dos motoristas:', motoristasError);
        } else {
          // Criar um mapa de motorista_id para status ativo
          motoristas?.forEach(m => {
            ativosStatus[m.motorista_id] = m.ativo === true;
          });
        }
      }
      
      // Processar os dados com os status ativos
      const processedData = data?.map(motorista => {
        const ativo = ativosStatus[motorista.motorista_id] === true;
        return {
          ...motorista,
          ativo: ativo
        };
      }) || [];

      // Agrupar ajudantes por motorista_id
      const contratadosAgrupadosMap = new Map();
      processedData.forEach(contratado => {
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
      const contratadosAgrupados = Array.from(contratadosAgrupadosMap.values());

      console.log('Dados processados:', JSON.parse(JSON.stringify(contratadosAgrupados)));
      
      processedData.forEach(motorista => {
        if (motorista.nome_cidade) {
          uniqueCities.add(motorista.nome_cidade);
        }
        
        // Extract vehicle types
        if (motorista.veiculo && motorista.veiculo.length > 0) {
          motorista.veiculo.forEach((veiculo: { tipologia?: string }) => {
            if (veiculo.tipologia) {
              uniqueVehicleTypes.add(veiculo.tipologia);
            }
          });
        }
      });
      
      setCidades(Array.from(uniqueCities).sort());
      setTiposVeiculo(Array.from(uniqueVehicleTypes).sort());

      setContratados(contratadosAgrupados);
    } catch (error) {
      console.error('Error fetching contratados:', error);
      toast.error('Erro ao carregar contratados');
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
      console.error('Error fetching clientes:', error);
      toast.error('Erro ao carregar clientes');
    }
  };

  const handleViewDocument = async (motorista: ViewContratado) => {
    try {
      setSelectedMotorista(motorista);
      setIsUnifiedModalOpen(true);
    } catch (error) {
      console.error('Error fetching document details:', error);
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
      console.error('Error deleting motorista:', error);
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
    setSelectAll(newSelectedItems.size === filteredContratados.length);
  };
  
  // Funções para manipular filtros de múltipla seleção
  const toggleFilterOption = (filterType: 'status' | 'cliente' | 'cidade' | 'tipoVeiculo', value: string) => {
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
    }
  };
  
  const clearFilter = (filterType: 'status' | 'cliente' | 'cidade' | 'tipoVeiculo') => {
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
    }
  };
  
  const getFilterButtonText = (filterType: 'status' | 'cliente' | 'cidade' | 'tipoVeiculo') => {
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
      }
    };
    
    const { filter, allText } = filterMap[filterType];
    
    if (filter.length === 0) return allText;
    if (filter.length === 1) {
      if (filter[0] === 'sem_cliente') return 'Sem cliente';
      if (filter[0] === 'sem_veiculo') return 'Sem veículo';
      return `${filter[0]}`;
    }
    return `${filter.length} selecionado(s)`;
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredContratados.map(m => m.motorista_id || 0)));
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
    } catch (error) {
      console.error('Erro ao atualizar integração em massa:', error);
      toast.error('Erro ao atualizar integração');
    }
  };

  const handleMassMessage = () => {
    setIsMassMessageModalOpen(true);
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
      
      // If the new status is not 'contratado', remove from the list
      if (newStatus !== 'contratado') {
        setContratados(prev => prev.filter(m => m.motorista_id !== motorista.motorista_id));
        toast.success(`Status atualizado para ${newStatus.replace('_', ' ')}. Motorista removido da lista.`);
      } else {
        // Update the local state
        setContratados(prev => 
          prev.map(m => 
            m.motorista_id === motorista.motorista_id 
              ? { ...m, st_cadastro: newStatus } 
              : m
          )
        );
        toast.success(`Status atualizado para ${newStatus.replace('_', ' ')}`);
      }
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

  const getMotoristaCity = (motorista: ViewContratado): string | null => {
    // Usa o campo nome_cidade que já está disponível no ViewContratado
    return motorista.nome_cidade || null;
  };


  const filteredContratados = contratados.filter((motorista): boolean => {
    const searchLower = searchTerm.toLowerCase();
    
    // Lógica para filtro de status (multiseleção)
    const statusMatch = statusFilter.length === 0 || 
      (motorista.st_cadastro && statusFilter.includes(motorista.st_cadastro));
    
    // Lógica para filtro de cliente (multiseleção)
    let clienteMatch = true;
    if (clienteFilter.length > 0) {
      if (clienteFilter.includes('sem_cliente')) {
        // Se 'sem_cliente' está selecionado, inclui registros sem cliente
        clienteMatch = motorista.cliente_id === null || motorista.cliente_id === undefined;
      } else {
        // Verifica se o cliente do motorista está na lista de clientes selecionados
        clienteMatch = motorista.cliente_id !== null && 
          motorista.cliente_id !== undefined &&
          clienteFilter.includes(motorista.cliente_id.toString());
      }
      
      // Se 'sem_cliente' está selecionado junto com outros clientes, combina os resultados
      if (clienteFilter.includes('sem_cliente') && clienteFilter.length > 1) {
        clienteMatch = clienteMatch || (motorista.cliente_id === null || motorista.cliente_id === undefined);
      }
    }
    
    // Lógica para filtro de cidade (multiseleção)
    const cidadeMatch = cidadeFilter.length === 0 || 
      (motorista.nome_cidade && cidadeFilter.includes(motorista.nome_cidade));
    
    // Lógica para filtro de tipo de veículo (multiseleção)
    let tipoVeiculoMatch = true;
    if (tipoVeiculoFilter.length > 0) {
      if (tipoVeiculoFilter.includes('sem_veiculo')) {
        tipoVeiculoMatch = !motorista.veiculo || motorista.veiculo.length === 0;
      } else {
        tipoVeiculoMatch = !!(motorista.veiculo && motorista.veiculo.some(v => 
          v.tipologia && tipoVeiculoFilter.includes(v.tipologia)
        ));
      }
      
      // Se 'sem_veiculo' está selecionado junto com outros tipos, combina os resultados
      if (tipoVeiculoFilter.includes('sem_veiculo') && tipoVeiculoFilter.length > 1) {
        tipoVeiculoMatch = tipoVeiculoMatch || (!motorista.veiculo || motorista.veiculo.length === 0);
      }
    }
    
    const ativoMatch = ativoFilter === '' ? true : 
                      ativoFilter === 'active' ? motorista.ativo === true : 
                      ativoFilter === 'inactive' ? motorista.ativo === false : true;

    // Lógica para filtro de tags (multiseleção)
    let tagMatch = true;
    if (tagFilter.length > 0) {
      // TODO: Implementar busca das tags associadas ao motorista
      // Esta funcionalidade será implementada quando houver motoristas no sistema
      // Por enquanto, permite todos os motoristas passarem pelo filtro
      tagMatch = true;
    }
    
    const searchMatch = Boolean(
      (motorista.nome_motorista && motorista.nome_motorista.toLowerCase().includes(searchLower)) ||
      (motorista.cpf && motorista.cpf.includes(searchLower)) ||
      (typeof motorista.email === 'string' && motorista.email.toLowerCase().includes(searchLower)) ||
      (motorista.telefone && motorista.telefone.toString().includes(searchLower))
    );
    
    return Boolean(
      statusMatch &&
      clienteMatch &&
      cidadeMatch &&
      tipoVeiculoMatch &&
      ativoMatch &&
      tagMatch &&
      searchMatch
    );
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
    data: filteredContratados,
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
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <path d="m9 11 3 3L22 4"/>
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
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                    <path d="M6 12v5c3 3 9 1 9-1v-5"/>
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

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {/* Busca */}
          <div className="xl:col-span-2">
            <div className="relative h-[38px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 z-10" />
              <input
                type="text"
                placeholder="Buscar motorista..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                          bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm
                          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                          transition-colors placeholder:text-gray-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 z-10"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="xl:col-span-1">
            <div className="relative h-[38px]" id="status-dropdown">
              <button
                type="button"
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="w-full h-full flex justify-between items-center pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                          bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm text-left
                          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                          transition-colors hover:bg-gray-50 dark:hover:bg-gray-750"
              >
                <span className="truncate">{getFilterButtonText('status')}</span>
                <div className="flex items-center">
                  {statusFilter.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearFilter('status');
                      }}
                      className="mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X size={16} />
                    </button>
                  )}
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showStatusDropdown ? 'transform rotate-180' : ''}`} />
                </div>
              </button>
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 z-10" />
            {showStatusDropdown && (
              <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-60 overflow-auto">
                <div className="px-3 py-1.5 flex justify-between items-center border-b border-gray-200 dark:border-gray-600">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Selecione os status</span>
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
                  <div key={value} className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer flex items-center">
                    <input
                      type="checkbox"
                      id={`status-${value}`}
                      checked={statusFilter.includes(value)}
                      onChange={() => toggleFilterOption('status', value)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <label htmlFor={`status-${value}`} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                      {label}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ativo/Inativo */}
          <div className="xl:col-span-1">
            <div className="relative h-[38px]">
              <select
                value={ativoFilter}
                onChange={(e) => setAtivoFilter(e.target.value)}
                className="w-full h-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                          bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm appearance-none
                          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                          transition-colors hover:bg-gray-50 dark:hover:bg-gray-750"
              >
                <option value="">Todos</option>
                <option value="active">Somente Ativos</option>
                <option value="inactive">Somente Inativos</option>
              </select>
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 z-10" />
              <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 z-10" />
            </div>
          </div>

          {/* Cliente */}
          <div className="xl:col-span-1">
            <div className="relative h-[38px]" id="cliente-dropdown">
              <button
                type="button"
                onClick={() => setShowClienteDropdown(!showClienteDropdown)}
                className="w-full h-full flex justify-between items-center pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                          bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm text-left
                          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                          transition-colors hover:bg-gray-50 dark:hover:bg-gray-750"
              >
                <span className="truncate">{getFilterButtonText('cliente')}</span>
                <div className="flex items-center">
                  {clienteFilter.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearFilter('cliente');
                      }}
                      className="mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X size={16} />
                    </button>
                  )}
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showClienteDropdown ? 'transform rotate-180' : ''}`} />
                </div>
              </button>
              <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 z-10" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              {showClienteDropdown && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-60 overflow-auto">
                  <div className="px-3 py-1.5 flex justify-between items-center border-b border-gray-200 dark:border-gray-600">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Selecione os clientes</span>
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
                  <div className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer flex items-center">
                    <input
                      type="checkbox"
                      id="cliente-sem_cliente"
                      checked={clienteFilter.includes('sem_cliente')}
                      onChange={() => toggleFilterOption('cliente', 'sem_cliente')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <label htmlFor="cliente-sem_cliente" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                      Sem cliente
                    </label>
                  </div>
                  {clientes.map((cliente) => (
                    <div key={cliente.cliente_id} className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer flex items-center">
                      <input
                        type="checkbox"
                        id={`cliente-${cliente.cliente_id}`}
                        checked={clienteFilter.includes(cliente.cliente_id.toString())}
                        onChange={() => toggleFilterOption('cliente', cliente.cliente_id.toString())}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <label htmlFor={`cliente-${cliente.cliente_id}`} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        {cliente.nome}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="xl:col-span-1">
            <div className="h-[38px]">
              <TagsFilter
                selectedTags={tagFilter}
                onTagsChange={setTagFilter}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Seção da Tabela */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        {filteredContratados.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-500 dark:text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2M4 13h2m13-8l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Nenhum motorista encontrado
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Ajuste os filtros ou adicione novos motoristas contratados.
            </p>
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Motoristas Contratados
                  </h3>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                    {filteredContratados.length} {filteredContratados.length === 1 ? 'motorista' : 'motoristas'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      className="form-checkbox h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Selecionar todos ({filteredContratados.length})
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Selecionar</span>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Motorista
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Tags
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Cidade
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Int. Interna
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Treinamento
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Veículo
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Data Cadastro
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedData.map((motorista) => (
                    <tr 
                      key={motorista.motorista_id || Math.random()} 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                        selectedItems.has(motorista.motorista_id || 0) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                      onContextMenu={(e) => handleContextMenu(e, motorista)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(motorista.motorista_id || 0)}
                          onChange={() => handleSelectItem(motorista.motorista_id || 0)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            {motorista.funcao === 'Motorista' ? (
                              <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            ) : (
                              <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            )}
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
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(motorista.st_cadastro || '')}`}>
                          {motorista.st_cadastro || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {motorista.nome_cliente || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <TagsDisplay motoristaId={motorista.motorista_id || 0} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {motorista.cidade || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          motorista.integr_interna === 'Finalizada' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' :
                          motorista.integr_interna === 'Em Andamento' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {motorista.integr_interna || 'Não iniciada'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          motorista.treinamento_cliente === 'Finalizado' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' :
                          motorista.treinamento_cliente === 'Em Andamento' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {motorista.treinamento_cliente || 'Não iniciado'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {motorista.tipo_veiculo || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {motorista.data_cadastro ? format(new Date(motorista.data_cadastro), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
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
          </>
        )}
      </div>

      {/* Modais */}
      <UnifiedMotoristaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        motorista={convertToMotorista(selectedMotorista)}
        onSuccess={fetchContratados}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este motorista? Esta ação não pode ser desfeita."
        itemData={selectedMotorista ? [
          { label: "Nome", value: selectedMotorista.nome_motorista || "Não informado" },
          { label: "CPF", value: selectedMotorista.cpf ? formatCPF(selectedMotorista.cpf) : "Não informado" },
          { label: "Status", value: selectedMotorista.st_cadastro || "Não informado" }
        ].filter(item => item.value !== "Não informado") : []}
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

      <MassMessageModal
        isOpen={isMassMessageModalOpen}
        onClose={() => setIsMassMessageModalOpen(false)}
        numbers={Array.from(selectedItems)
          .map(id => {
            const motorista = contratados.find(m => m.motorista_id === id);
            return motorista?.telefone ? motorista.telefone.toString() : "";
          })
          .filter(Boolean)}
      />
    </div>
    </div>
  );
};

export default Contratados;
