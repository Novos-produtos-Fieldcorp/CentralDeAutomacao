import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Edit2, Trash2, FileText, Filter, X, ChevronDown, ChevronUp, CreditCard, Phone, Mail, Calendar, MapPin, Truck, User, MessageCircle } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Motorista, DocumentoMotorista, Veiculo, DocumentoVeiculo } from '../../types/database';
import { formatCPF, formatPhone, formatDate } from '../../utils/format';
import toast from 'react-hot-toast';
import AddAgregadoModal from '../../components/AddAgregadoModal';
import EditMotoristaModal from '../../components/EditMotoristaModal';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import DocumentViewer from '../../components/DocumentViewer';
import DocumentoMotoristaForm from '../../components/DocumentoMotoristaForm';
import DocumentUploadModal from '../../components/DocumentUploadModal';
import BulkActionsModal from '../../components/BulkActionsModal';
import BulkDeleteConfirmationModal from '../../components/BulkDeleteConfirmationModal';
import BulkStatusModal from '../../components/BulkStatusModal';
import { useFloatingChat } from '../../hooks/useFloatingChat';
import LoadingSpinner from '../../components/LoadingSpinner';
import { usePagination } from '../../hooks/usePagination';
import Pagination from '../../components/Pagination';
import ScrollableTableIndicator from '../../components/ScrollableTableIndicator';
import ContextMenu from '../../components/ContextMenu';
import AgregadoDetailView from '../../components/AgregadoDetailView';
import UnifiedAgregadoModal from '../../components/UnifiedAgregadoModal';

interface MotoristaWithDetails extends Motorista {
  documento?: DocumentoMotorista;
  veiculo?: (Veiculo & { documento_veiculo: DocumentoVeiculo[] }) | null;
  endereco?: any;
  ajudantes?: any[];
  isExpanded?: boolean;
}

interface FilterState {
  status: string;
  cidade: string;
  cliente: string;
  tipologia: string;
}

const AgregadosLista = () => {
  const { query, companyId } = useCompanyData();
  const { startChat } = useFloatingChat();
  const { accountId } = useAuth();
  const [motoristas, setMotoristas] = useState<MotoristaWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [isDocumentFormOpen, setIsDocumentFormOpen] = useState(false);
  const [isDocumentUploadModalOpen, setIsDocumentUploadModalOpen] = useState(false);
  const [isAgregadoDetailViewOpen, setIsAgregadoDetailViewOpen] = useState(false);
  const [isUnifiedModalOpen, setIsUnifiedModalOpen] = useState(false);
  const [selectedMotorista, setSelectedMotorista] = useState<MotoristaWithDetails | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [isBulkActionsModalOpen, setIsBulkActionsModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'status' | 'client'>('status');
  const [clientes, setClientes] = useState<any[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    status: '',
    cidade: '',
    cliente: '',
    tipologia: ''
  });
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [cidadeOptions, setCidadeOptions] = useState<string[]>([]);
  const [tipologiaOptions, setTipologiaOptions] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Motorista;
    direction: 'asc' | 'desc';
  }>({ key: 'nome', direction: 'asc' });
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    motorista: MotoristaWithDetails | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    motorista: null,
  });

  useEffect(() => {
    fetchMotoristas();
    fetchClientes();
    fetchFilterOptions();
  }, [accountId]);

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

  const fetchMotoristas = async () => {
    try {
      setLoading(true);
      
      // Fetch all agregados with their documents, vehicles, and addresses
      const { data, error } = await supabase
        .from('vw_agregados_completo')
        .select(`
          *,
          documento_motorista(*),
          veiculo!inner(*),
          end_motorista(
            nr_end,
            ds_complemento_end,
            logradouro(
              logradouro,
              nr_cep,
              bairro(
                bairro,
                cidade(
                  cidade,
                  estado(
                    sigla_estado
                  )
                )
              )
            )
          ),
          cliente(*)
        `)
        .eq('company_id', companyId)
        .order('nome');

      if (error) throw error;

      // Fetch ajudantes for each agregado
      const motoristasWithAjudantes = await Promise.all((data || []).map(async (motorista) => {
        try {
          const { data: ajudantesData, error: ajudantesError } = await supabase
            .from('documento_ajudante')
            .select(`
              *,
              cnh_ajudante(*),
              rg_ajudante(*)
            `)
            .eq('motorista_id', motorista.motorista_id);

          if (ajudantesError) throw ajudantesError;

          return {
            ...motorista,
            ajudantes: ajudantesData || [],
            documento: motorista.documento_motorista?.[0] || null,
            endereco: motorista.end_motorista?.[0] || null,
            veiculo: motorista.veiculo?.[0] || null
          };
        } catch (ajudantesError) {
          console.error('Error fetching ajudantes:', ajudantesError);
          return {
            ...motorista,
            ajudantes: [],
            documento: motorista.documento_motorista?.[0] || null,
            endereco: motorista.end_motorista?.[0] || null,
            veiculo: motorista.veiculo?.[0] || null
          };
        }
      }));

      setMotoristas(motoristasWithAjudantes);
    } catch (error) {
      console.error('Error fetching agregados:', error);
      toast.error('Erro ao carregar agregados');
    } finally {
      setLoading(false);
    }
  };

  const fetchClientes = async () => {
    try {
      const { data, error } = await query('cliente')
        .select('*')
        .eq('st_cliente', true)
        .order('nome');

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error('Error fetching clientes:', error);
      toast.error('Erro ao carregar clientes');
    }
  };

  const fetchFilterOptions = async () => {
    try {
      // Fetch status options
      const { data: statusData, error: statusError } = await supabase
        .from('motorista')
        .select('st_cadastro')
        .eq('funcao', 'Agregado')
        .eq('company_id', companyId);

      if (statusError) throw statusError;

      // Fetch cidade options
      const { data: cidadeData, error: cidadeError } = await supabase
        .from('motorista')
        .select('cidade')
        .eq('funcao', 'Agregado')
        .eq('company_id', companyId);

      if (cidadeError) throw cidadeError;

      // Fetch tipologia options
      const { data: tipologiaData, error: tipologiaError } = await supabase
        .from('veiculo')
        .select('tipologia')
        .eq('status_veiculo', true)
        .eq('company_id', companyId);

      if (tipologiaError) throw tipologiaError;

      // Process and set options
      const uniqueStatuses = [...new Set(statusData?.map(item => item.st_cadastro).filter(Boolean))];
      const uniqueCidades = [...new Set(cidadeData?.map(item => item.cidade).filter(Boolean))];
      const uniqueTipologias = [...new Set(tipologiaData?.map(item => item.tipologia).filter(Boolean))];

      setStatusOptions(uniqueStatuses);
      setCidadeOptions(uniqueCidades);
      setTipologiaOptions(uniqueTipologias);
    } catch (error) {
      console.error('Error fetching filter options:', error);
      toast.error('Erro ao carregar opções de filtro');
    }
  };

  const handleEdit = (motorista: MotoristaWithDetails) => {
    setSelectedMotorista(motorista);
    setIsEditModalOpen(true);
  };

  const handleDelete = (motorista: MotoristaWithDetails) => {
    setSelectedMotorista(motorista);
    setIsDeleteModalOpen(true);
  };

  const handleViewDocument = (motorista: MotoristaWithDetails) => {
    setSelectedMotorista(motorista);
    setIsDocumentViewerOpen(true);
  };

  const handleEditDocument = (motorista: MotoristaWithDetails) => {
    setSelectedMotorista(motorista);
    setIsDocumentFormOpen(true);
  };

  const handleUploadDocument = (motorista: MotoristaWithDetails) => {
    setSelectedMotorista(motorista);
    setIsDocumentUploadModalOpen(true);
  };

  const handleViewDetails = (motorista: MotoristaWithDetails) => {
    setSelectedMotorista(motorista);
    setIsAgregadoDetailViewOpen(true);
  };

  const handleViewUnified = (motorista: MotoristaWithDetails) => {
    setSelectedMotorista(motorista);
    setIsUnifiedModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedMotorista) return;

    try {
      const { error } = await query('motorista')
        .delete()
        .eq('motorista_id', selectedMotorista.motorista_id);

      if (error) throw error;

      setMotoristas(motoristas.filter(m => m.motorista_id !== selectedMotorista.motorista_id));
      toast.success('Agregado excluído com sucesso');
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting agregado:', error);
      toast.error('Erro ao excluir agregado');
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
    setSelectAll(newSelectedItems.size === filteredMotoristas.length);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredMotoristas.map(m => m.motorista_id)));
    }
    setSelectAll(!selectAll);
  };

  const handleBulkDelete = async () => {
    try {
      // Delete all selected items
      for (const id of selectedItems) {
        const { error } = await query('motorista')
          .delete()
          .eq('motorista_id', id);

        if (error) throw error;
      }

      // Update the list
      setMotoristas(motoristas.filter(m => !selectedItems.has(m.motorista_id)));
      toast.success(`${selectedItems.size} agregado${selectedItems.size !== 1 ? 's' : ''} excluído${selectedItems.size !== 1 ? 's' : ''} com sucesso`);
      
      // Reset selection
      setSelectedItems(new Set());
      setSelectAll(false);
      setIsBulkDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting agregados:', error);
      toast.error('Erro ao excluir agregados');
    }
  };

  const handleBulkStatus = async (activate: boolean) => {
    try {
      // Update status for all selected items
      for (const id of selectedItems) {
        const { error } = await query('motorista')
          .update({ st_cadastro: activate ? 'contratado' : 'rejeitado' })
          .eq('motorista_id', id);

        if (error) throw error;
      }

      // Update the list
      setMotoristas(motoristas.map(m => {
        if (selectedItems.has(m.motorista_id)) {
          return { ...m, st_cadastro: activate ? 'contratado' : 'rejeitado' };
        }
        return m;
      }));

      toast.success(`${selectedItems.size} agregado${selectedItems.size !== 1 ? 's' : ''} ${activate ? 'ativado' : 'desativado'}${selectedItems.size !== 1 ? 's' : ''} com sucesso`);
      
      // Reset selection
      setSelectedItems(new Set());
      setSelectAll(false);
      setIsBulkStatusModalOpen(false);
    } catch (error) {
      console.error('Error updating agregados status:', error);
      toast.error('Erro ao atualizar status dos agregados');
    }
  };

  const handleSort = (key: keyof Motorista) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleContextMenu = (e: React.MouseEvent, motorista: MotoristaWithDetails) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      motorista,
    });
  };

  const toggleExpand = (id: number) => {
    setMotoristas(prevMotoristas => 
      prevMotoristas.map(motorista => 
        motorista.motorista_id === id 
          ? { ...motorista, isExpanded: !motorista.isExpanded } 
          : motorista
      )
    );
  };

  const handleStartChat = (motorista: MotoristaWithDetails) => {
    if (motorista.telefone) {
      startChat(motorista.telefone.toString(), motorista.nome);
    } else {
      toast.error('Este motorista não possui telefone cadastrado');
    }
  };

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      status: '',
      cidade: '',
      cliente: '',
      tipologia: ''
    });
  };

  const filteredMotoristas = motoristas
    .filter(motorista => {
      // Apply search filter
      const searchString = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        motorista.nome.toLowerCase().includes(searchString) ||
        motorista.cpf.includes(searchString) ||
        (motorista.email && motorista.email.toLowerCase().includes(searchString)) ||
        (motorista.telefone && motorista.telefone.toString().includes(searchString)) ||
        (motorista.veiculo?.placa && motorista.veiculo.placa.toLowerCase().includes(searchString));

      // Apply status filter
      const matchesStatus = !filters.status || motorista.st_cadastro === filters.status;

      // Apply cidade filter
      const matchesCidade = !filters.cidade || motorista.cidade === filters.cidade;

      // Apply cliente filter
      const matchesCliente = !filters.cliente || 
        (filters.cliente === 'sem_cliente' && !motorista.cliente_id) ||
        (motorista.cliente_id && motorista.cliente_id.toString() === filters.cliente);

      // Apply tipologia filter
      const matchesTipologia = !filters.tipologia || 
        (motorista.veiculo && motorista.veiculo.tipologia === filters.tipologia);

      return matchesSearch && matchesStatus && matchesCidade && matchesCliente && matchesTipologia;
    })
    .sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      const aStr = String(aValue);
      const bStr = String(bValue);

      const comparison = aStr.localeCompare(bStr);
      return sortConfig.direction === 'asc' ? comparison : -comparison;
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
    return (
      <LoadingSpinner />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          {selectedItems.size > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setBulkActionType('status');
                  setIsBulkStatusModalOpen(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                        transition-colors flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                  <path d="m9 12 2 2 4-4"></path>
                </svg>
                Alterar Status
              </button>
              <button
                onClick={() => {
                  setBulkActionType('client');
                  setIsBulkActionsModalOpen(true);
                }}
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
                Excluir Selecionados
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                   transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Adicionar Agregado
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-auto flex-1">
            <input
              type="text"
              placeholder="Buscar por nome, CPF, email, telefone ou placa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={() => setIsFiltersOpen(!isFiltersOpen)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 
                       focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 
                       transition-colors flex items-center gap-2"
            >
              <Filter className="w-5 h-5" />
              Filtros
              {isFiltersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {Object.values(filters).some(Boolean) && (
              <button
                onClick={resetFilters}
                className="px-4 py-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 
                         focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 
                         transition-colors flex items-center gap-2"
              >
                <X className="w-5 h-5" />
                Limpar Filtros
              </button>
            )}
          </div>
        </div>

        {isFiltersOpen && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">Todos</option>
                {statusOptions.map(status => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cidade
              </label>
              <select
                value={filters.cidade}
                onChange={(e) => handleFilterChange('cidade', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">Todas</option>
                {cidadeOptions.map(cidade => (
                  <option key={cidade} value={cidade}>
                    {cidade}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipologia do Veículo
              </label>
              <select
                value={filters.tipologia}
                onChange={(e) => handleFilterChange('tipologia', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">Todas</option>
                {tipologiaOptions.map(tipologia => (
                  <option key={tipologia} value={tipologia}>
                    {tipologia}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cliente
              </label>
              <select
                value={filters.cliente}
                onChange={(e) => handleFilterChange('cliente', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">Todos</option>
                <option value="sem_cliente">Sem Cliente</option>
                {clientes.map(cliente => (
                  <option key={cliente.cliente_id} value={cliente.cliente_id}>
                    {cliente.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 relative">
        <div className="overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center">
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
          
          <div className="relative">
            <div ref={tableContainerRef} className="overflow-x-auto w-full">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800"></th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800 cursor-pointer"
                      onClick={() => handleSort('nome')}
                    >
                      <div className="flex items-center gap-2">
                        Nome
                        {sortConfig.key === 'nome' && (
                          sortConfig.direction === 'asc' ?
                            <ChevronUp className="w-4 h-4" /> :
                            <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Contato</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Veículo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Documentos</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedData.map((motorista) => (
                    <React.Fragment key={motorista.motorista_id}>
                      <tr 
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                          selectedItems.has(motorista.motorista_id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                        onClick={() => toggleExpand(motorista.motorista_id)}
                        onContextMenu={(e) => handleContextMenu(e, motorista)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedItems.has(motorista.motorista_id)}
                            onChange={() => handleSelectItem(motorista.motorista_id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                              <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {motorista.nome}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {formatCPF(motorista.cpf)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            {motorista.telefone && (
                              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                                <Phone className="w-4 h-4 mr-1 text-gray-400" />
                                {formatPhone(motorista.telefone.toString())}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartChat(motorista);
                                  }}
                                  className="ml-2 p-1 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                  title="Iniciar chat"
                                >
                                  <MessageCircle size={16} />
                                </button>
                              </div>
                            )}
                            {motorista.email && (
                              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                                <Mail className="w-4 h-4 mr-1 text-gray-400" />
                                {motorista.email}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {motorista.veiculo ? (
                            <div className="flex flex-col">
                              <div className="flex items-center text-sm text-gray-900 dark:text-white">
                                <Truck className="w-4 h-4 mr-1 text-gray-400" />
                                <span className="font-medium">{motorista.veiculo.placa.toUpperCase()}</span>
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {motorista.veiculo.marca} {motorista.veiculo.tipo}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              Sem veículo
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            {/* Document Type */}
                            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                              <CreditCard className="w-4 h-4 mr-1 text-gray-400" />
                              <span>
                                {motorista.documento?.foto_cnh ? 'CNH' : 'Não enviado'}
                              </span>
                            </div>
                            
                            {/* Ajudantes Count */}
                            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                              <Users className="w-4 h-4 mr-1 text-gray-400" />
                              <span>
                                {motorista.ajudantes && motorista.ajudantes.length > 0 
                                  ? `${motorista.ajudantes.length} ajudante${motorista.ajudantes.length !== 1 ? 's' : ''}`
                                  : 'Sem ajudantes'}
                              </span>
                            </div>
                            
                            {/* Document Preview */}
                            {motorista.ajudantes && motorista.ajudantes.length > 0 && (
                              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {motorista.ajudantes.map((ajudante, idx) => {
                                  // Determine document type
                                  let documentType = 'Não informado';
                                  let documentNumber = 'Não informado';
                                  
                                  if (ajudante.cnh_ajudante && ajudante.cnh_ajudante.length > 0) {
                                    documentType = 'CNH';
                                    documentNumber = ajudante.cnh_ajudante[0].nr_registro || 'Não informado';
                                  } else if (ajudante.rg_ajudante && ajudante.rg_ajudante.length > 0) {
                                    documentType = 'RG';
                                    documentNumber = ajudante.rg_ajudante[0].nr_rg || 'Não informado';
                                  }
                                  
                                  return (
                                    <div key={idx} className="flex flex-col">
                                      <span>{ajudante.nome}</span>
                                      <span>Tipo: {documentType}</span>
                                      <span>Número: {documentNumber}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            motorista.st_cadastro === 'contratado'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                              : motorista.st_cadastro === 'rejeitado'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200'
                          }`}>
                            {motorista.st_cadastro.charAt(0).toUpperCase() + motorista.st_cadastro.slice(1).replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewUnified(motorista);
                              }}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                              title="Visualizar detalhes"
                            >
                              <FileText size={18} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(motorista);
                              }}
                              className="text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-300 transition-colors"
                              title="Editar"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(motorista);
                              }}
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      
                      {/* Expanded Row */}
                      {motorista.isExpanded && (
                        <tr className="bg-gray-50 dark:bg-gray-700/30">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {/* Address Information */}
                              <div className="space-y-2">
                                <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                  <MapPin className="w-4 h-4 text-gray-400" />
                                  Endereço
                                </h4>
                                {motorista.endereco ? (
                                  <div className="text-sm text-gray-600 dark:text-gray-300">
                                    <p>
                                      {motorista.endereco.logradouro?.logradouro}, {motorista.endereco.nr_end || 'S/N'}
                                      {motorista.endereco.ds_complemento_end && ` - ${motorista.endereco.ds_complemento_end}`}
                                    </p>
                                    <p>
                                      {motorista.endereco.logradouro?.bairro?.bairro} - {motorista.endereco.logradouro?.nr_cep}
                                    </p>
                                    <p>
                                      {motorista.endereco.logradouro?.bairro?.cidade?.cidade}/{motorista.endereco.logradouro?.bairro?.cidade?.estado?.sigla_estado}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Nenhum endereço cadastrado
                                  </p>
                                )}
                              </div>
                              
                              {/* Document Information */}
                              <div className="space-y-2">
                                <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-gray-400" />
                                  Documentos
                                </h4>
                                <div className="text-sm text-gray-600 dark:text-gray-300">
                                  <p>
                                    <span className="font-medium">CNH:</span> {motorista.documento?.nr_registro_cnh || 'Não informado'}
                                  </p>
                                  <p>
                                    <span className="font-medium">Categoria:</span> {motorista.documento?.categoria_cnh || 'Não informada'}
                                  </p>
                                  <p>
                                    <span className="font-medium">Validade:</span> {motorista.documento?.validade_cnh ? formatDate(motorista.documento.validade_cnh) : 'Não informada'}
                                  </p>
                                </div>
                                <div className="flex gap-2 mt-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleViewDocument(motorista);
                                    }}
                                    className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
                                  >
                                    Ver Documentos
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditDocument(motorista);
                                    }}
                                    className="px-2 py-1 text-xs font-medium text-yellow-600 bg-yellow-100 rounded-md hover:bg-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:hover:bg-yellow-900/30"
                                  >
                                    Editar Documentos
                                  </button>
                                </div>
                              </div>
                              
                              {/* Additional Information */}
                              <div className="space-y-2">
                                <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-gray-400" />
                                  Informações Adicionais
                                </h4>
                                <div className="text-sm text-gray-600 dark:text-gray-300">
                                  <p>
                                    <span className="font-medium">Data de Cadastro:</span> {formatDate(motorista.data_cadastro)}
                                  </p>
                                  <p>
                                    <span className="font-medium">Cliente:</span> {motorista.cliente?.nome || 'Não atribuído'}
                                  </p>
                                  <p>
                                    <span className="font-medium">Cidade:</span> {motorista.cidade || 'Não informada'}
                                  </p>
                                </div>
                                <div className="flex gap-2 mt-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleViewDetails(motorista);
                                    }}
                                    className="px-2 py-1 text-xs font-medium text-green-600 bg-green-100 rounded-md hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30"
                                  >
                                    Detalhes Completos
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Scroll indicators */}
            <ScrollableTableIndicator 
              containerRef={tableContainerRef} 
              className="mr-2 ml-2"
            />
          </div>
        </div>
        {filteredMotoristas.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              Nenhum agregado encontrado
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

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.motorista && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu({ ...contextMenu, visible: false })}
          actions={[
            {
              icon: <FileText size={16} />,
              label: 'Visualizar Detalhes',
              onClick: () => handleViewUnified(contextMenu.motorista!),
              color: 'text-blue-600 dark:text-blue-400'
            },
            {
              icon: <Edit2 size={16} />,
              label: 'Editar Agregado',
              onClick: () => handleEdit(contextMenu.motorista!),
              color: 'text-yellow-600 dark:text-yellow-400'
            },
            {
              icon: <FileText size={16} />,
              label: 'Visualizar Documentos',
              onClick: () => handleViewDocument(contextMenu.motorista!),
              color: 'text-green-600 dark:text-green-400'
            },
            {
              icon: <Trash2 size={16} />,
              label: 'Excluir Agregado',
              onClick: () => handleDelete(contextMenu.motorista!),
              color: 'text-red-600 dark:text-red-400'
            }
          ]}
        />
      )}

      <AddAgregadoModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchMotoristas}
      />

      <EditMotoristaModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        motorista={selectedMotorista}
        onUpdate={fetchMotoristas}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este agregado? Esta ação não pode ser desfeita."
        itemData={selectedMotorista ? [
          { label: 'Nome', value: selectedMotorista.nome },
          { label: 'CPF', value: formatCPF(selectedMotorista.cpf) },
          { label: 'Placa', value: selectedMotorista.veiculo?.placa.toUpperCase() || 'Não informada' }
        ] : []}
      />

      <DocumentViewer
        isOpen={isDocumentViewerOpen}
        onClose={() => setIsDocumentViewerOpen(false)}
        documento={selectedMotorista?.documento || null}
        nome={selectedMotorista?.nome || ''}
        cpf={selectedMotorista?.cpf}
        email={selectedMotorista?.email}
        telefone={selectedMotorista?.telefone?.toString()}
        dt_nascimento={selectedMotorista?.dt_nascimento}
        endereco={selectedMotorista?.endereco}
        veiculo={selectedMotorista?.veiculo}
        isAgregado={true}
        st_cadastro={selectedMotorista?.st_cadastro}
      />

      <DocumentoMotoristaForm
        isOpen={isDocumentFormOpen}
        onClose={() => setIsDocumentFormOpen(false)}
        motorista_id={selectedMotorista?.motorista_id || 0}
        onSuccess={fetchMotoristas}
      />

      <DocumentUploadModal
        isOpen={isDocumentUploadModalOpen}
        onClose={() => setIsDocumentUploadModalOpen(false)}
        motorista_id={selectedMotorista?.motorista_id || 0}
        nome={selectedMotorista?.nome || ''}
        onUploadSuccess={fetchMotoristas}
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
        message="Tem certeza que deseja excluir todos os agregados selecionados? Esta ação não pode ser desfeita."
        itemCount={selectedItems.size}
        itemType="agregado"
      />

      <BulkStatusModal
        isOpen={isBulkStatusModalOpen}
        onClose={() => setIsBulkStatusModalOpen(false)}
        onConfirm={handleBulkStatus}
        title="Alterar Status em Massa"
        message="Escolha o novo status para os agregados selecionados:"
        itemCount={selectedItems.size}
        itemType="agregado"
      />

      <AgregadoDetailView
        isOpen={isAgregadoDetailViewOpen}
        onClose={() => setIsAgregadoDetailViewOpen(false)}
        agregado={selectedMotorista}
        documento={selectedMotorista?.documento || null}
        veiculo={selectedMotorista?.veiculo || null}
        endereco={selectedMotorista?.endereco}
        ajudantes={selectedMotorista?.ajudantes}
        onSuccess={fetchMotoristas}
      />

      <UnifiedAgregadoModal
        isOpen={isUnifiedModalOpen}
        onClose={() => setIsUnifiedModalOpen(false)}
        motorista={selectedMotorista}
        onSuccess={fetchMotoristas}
      />
    </div>
  );
};

export default AgregadosLista;