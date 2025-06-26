import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Edit2, FileText, MessageCircle, Filter, ChevronDown, X, Truck, Loader2, MapPin, FilePen, User } from 'lucide-react';
import type { MotoristaWithAddress, EnderecoMotorista } from '../../types/database';
import { useCompanyData } from '../../hooks/useCompanyData';
import { formatCPF, formatPhone, formatDate } from '../../utils/format';
import DocumentViewer from '../../components/DocumentViewer';
import DocumentUploadModal from '../../components/DocumentUploadModal';
import EditMotoristaModal from '../../components/EditMotoristaModal';
import AddAgregadoModal from '../../components/AddAgregadoModal';
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
import UnifiedAgregadoModal from '../../components/UnifiedAgregadoModal';

export interface ViewAgregado {
  // Identificação básica
  motorista_id: number;
  nome: string;
  nome_motorista?: string; // Alias para compatibilidade
  cpf: string;
  
  // Dados pessoais
  dt_nascimento: string;
  genero: string;
  telefone: string | number | null;
  email: string | null;
  funcao: string;
  origem_usuario: string;
  st_cadastro: string;
  autorizacao_lgpd: string;
  
  // Dados da empresa
  company_id: number;
  data_cadastro: string;
  cliente_id: number | null;
  ativo: boolean;
  
  // Dados do cliente
  cliente?: {
    id: number;
    nome: string;
    // Adicione outras propriedades do cliente conforme necessário
  };
  
  // Endereço (estrutura aninhada)
  endereco?: {
    id_end_motorista?: number | null;
    nr_end?: number | null;
    ds_complemento_end?: string | null;
    st_end?: boolean | null;
    logradouro?: string | null;
    nr_cep?: string | null;
    bairro?: string | null;
    nome_bairro?: string | null;
    cidade?: string | null;
    nome_cidade?: string | null;
    estado?: string | null;
    nome_estado?: string | null;
    sigla_estado?: string | null;
  };
  
  // Campos de endereço alternativos (para compatibilidade)
  id_end_motorista?: number | null;
  nr_end?: number | null;
  ds_complemento_end?: string | null;
  st_end?: boolean | null;
  logradouro?: string | null;
  nr_cep?: string | null;
  nome_bairro?: string | null;
  nome_cidade?: string | null;
  nome_estado?: string | null;
  sigla_estado?: string | null;
  
  // Veículo
  veiculo?: Array<{
    veiculo_id: number;
    placa: string | null;
    tipologia?: string | null;
    marca_veiculo?: string | null;
    ano?: string | null;
    combustivel?: string | null;
    peso?: string | null;
    cubagem?: string | null;
    possui_rastreador?: boolean | null;
    marca_rastreador?: string | null;
    cor?: string | null;
    tipo?: string | null;
  }>;
  
  // Propriedade tipologia no nível raiz para compatibilidade
  tipologia?: string | null;
  
  // Documentos
  documento_motorista?: Array<{
    id: number;
    // Adicione propriedades dos documentos conforme necessário
  }>;
  
  // Propriedades de relacionamento
  veiculo_id?: number | null;
  placa?: string | null;
  conversation_id?: string;
  
  // Outras propriedades
  nome_ajudante?: string | null;
}

const AgregadosLista = () => {
  const { query, companyId } = useCompanyData();
  const { startChat } = useFloatingChat();
  const [agregados, setAgregados] = useState<ViewAgregado[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientesLoading, setClientesLoading] = useState(true);
  

  // Função para alternar status selecionado
  const toggleStatus = (status: string) => {
    setStatusFilter((prev: string[]) => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };
  
  // Função para limpar todos os status
  const clearStatusFilter = () => {
    setStatusFilter([]);
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [ativoFilter, setAtivoFilter] = useState<string>('');
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [isDocumentUploadOpen, setIsDocumentUploadOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkActionsModalOpen, setIsBulkActionsModalOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'status' | 'client'>('status');
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isMassMessageModalOpen, setIsMassMessageModalOpen] = useState(false);
  const [selectedAgregado, setSelectedAgregado] = useState<ViewAgregado | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteFilter, setClienteFilter] = useState<string[]>([]);
  const [cidadeFilter, setCidadeFilter] = useState<string[]>([]);
  const [tipoVeiculoFilter, setTipoVeiculoFilter] = useState<string[]>([]);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [showCidadeDropdown, setShowCidadeDropdown] = useState(false);
  const [showTipoVeiculoDropdown, setShowTipoVeiculoDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [tiposVeiculo, setTiposVeiculo] = useState<string[]>([]);
  const [cidades, setCidades] = useState<string[]>([]);
  
  // Opções de status para o filtro
  const statusOptions = [
    { value: 'cadastrado', label: 'Cadastrado' },
    { value: 'qualificado', label: 'Qualificado' },
    { value: 'documentacao', label: 'Documentação' },
    { value: 'contrato_enviado', label: 'Contrato Enviado' },
    { value: 'contratado', label: 'Contratado' },
    { value: 'repescagem', label: 'Repescagem' },
    { value: 'rejeitado', label: 'Rejeitado' }
  ];

  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    agregado: ViewAgregado | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    agregado: null,
  });
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

  // Refs for dropdowns
  const clienteDropdownRef = useRef<HTMLDivElement>(null);
  const cidadeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAgregados();
    fetchClientes();
  }, [dateFilter, customDateRange]);

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
      
      // Check if click is outside client dropdown
      if (clienteDropdownRef.current && !clienteDropdownRef.current.contains(target)) {
        setShowClienteDropdown(false);
      }
      
      // Check if click is outside city dropdown
      if (cidadeDropdownRef.current && !cidadeDropdownRef.current.contains(target)) {
        setShowCidadeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchAgregados = async () => {
    try {
      setLoading(true);
      let query = supabase
      .from('vw_agregados_completo')
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

      // Extract unique cities from agregados
      const uniqueCities = new Set<string>();
      const uniqueVehicleTypes = new Set<string>();
      
      data?.forEach(agregado => {
        if (agregado.nome_cidade) {
          uniqueCities.add(agregado.nome_cidade);
        }
        
        // Extract vehicle types
        if (agregado.tipologia) {
          uniqueVehicleTypes.add(agregado.tipologia);
        }
      });
      
      setCidades(Array.from(uniqueCities).sort());
      setTiposVeiculo(Array.from(uniqueVehicleTypes).sort());

      setAgregados(data || []);
    } catch (error) {
      console.error('Error fetching agregados:', error);
      toast.error('Erro ao carregar agregados');
    } finally {
      setLoading(false);
    }
  };

  const fetchClientes = async () => {
    try {
      console.log('Iniciando carregamento de clientes...');
      setClientesLoading(true);
      
      console.log('Company ID:', companyId);
      const { data, error, status } = await supabase
        .from('cliente')
        .select('*')
        .eq('company_id', companyId)
        .eq('st_cliente', true)  // Filtra apenas clientes ativos
        .order('nome');

      console.log('Resposta da API - Status:', status);
      console.log('Dados retornados:', data);
      
      if (error) {
        console.error('Erro na consulta:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.warn('Nenhum cliente ativo encontrado para a empresa');
      } else {
        // Mapeando os dados para garantir que usamos o campo correto (cliente_id)
        const clientesMapeados = data.map(cliente => ({
          ...cliente,
          id: cliente.cliente_id, // Garantindo que o campo id existe
          nome: cliente.nome || 'Cliente sem nome'
        }));
        
        console.log(`Encontrados ${clientesMapeados.length} clientes ativos`);
        console.log('Lista de clientes:', clientesMapeados.map(c => ({ id: c.id, nome: c.nome })));
        
        setClientes(clientesMapeados);
      }
    } catch (err) {
      const error = err as Error;
      console.error('Erro detalhado ao carregar clientes:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      toast.error('Erro ao carregar clientes. Verifique o console para mais detalhes.');
    } finally {
      setClientesLoading(false);
    }
  };

  const handleViewDetail = (agregado: ViewAgregado) => {
    setSelectedAgregado(agregado);
    setIsDetailViewOpen(true);
  };

  const handleUploadDocument = (agregado: ViewAgregado) => {
    setSelectedAgregado(agregado);
    setIsDocumentUploadOpen(true);
  };

  const handleEdit = (agregado: ViewAgregado | null) => {
    if (!agregado) return;
    setSelectedAgregado(agregado);
    setIsEditModalOpen(true);
  };

  // Função para manipular o menu de contexto
  const handleContextMenu = (e: React.MouseEvent, agregado: ViewAgregado) => {
    e.preventDefault();
    setSelectedAgregado(agregado);
    // Implementar lógica de menu de contexto se necessário
  };

  // Função para alternar o dropdown de status
  const toggleStatusDropdown = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setStatusDropdownOpen(prev => prev === id ? null : id);
  };

  const confirmDelete = async () => {
    if (!selectedAgregado) return;

    try {
      const { error } = await query('motorista')
        .delete()
        .eq('motorista_id', selectedAgregado.motorista_id);

      if (error) throw error;

      setAgregados(agregados.filter(a => a.motorista_id !== selectedAgregado.motorista_id));
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
    setSelectAll(newSelectedItems.size === filteredAgregados.length);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredAgregados.map(a => a.motorista_id || 0)));
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
      setAgregados(agregados.filter(a => !selectedItems.has(a.motorista_id || 0)));
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

  const handleBulkAction = async (actionType: 'status' | 'client') => {
    setBulkActionType(actionType);
    setIsBulkActionsModalOpen(true);
  };

  const handleMassMessage = () => {
    setIsMassMessageModalOpen(true);
  };


  const toggleClienteDropdown = (e: React.MouseEvent, agregadoId: number) => {
    e.stopPropagation();
    if (clienteDropdownOpen === agregadoId) {
      setClienteDropdownOpen(null);
    } else {
      setClienteDropdownOpen(agregadoId);
    }
  };
  const handleUpdateStatus = async (e: React.MouseEvent, agregado: ViewAgregado, newStatus: string) => {
    e.stopPropagation();
    e.stopPropagation();
    try {
      setUpdatingStatus(agregado.motorista_id || 0);
      
      // Update the status in the database
      const { error } = await supabase
        .from('motorista')
        .update({ st_cadastro: newStatus })
        .eq('motorista_id', agregado.motorista_id || 0);
        
      if (error) throw error;
      
      // Update the local state
      setAgregados(prev => 
        prev.map(a => 
          a.motorista_id === agregado.motorista_id 
            ? { ...a, st_cadastro: newStatus } 
            : a
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

  const handleUpdateCliente = async (e: React.MouseEvent, agregado: ViewAgregado, clienteId: number | null) => {
    e.stopPropagation();
    try {
      setUpdatingCliente(agregado.motorista_id || 0);
      
      // Update the cliente_id in the database
      const { error } = await supabase
        .from('motorista')
        .update({ cliente_id: clienteId })
        .eq('motorista_id', agregado.motorista_id || 0);
        
      if (error) throw error;
      
      // Update the local state
      setAgregados(prev => 
        prev.map(a => 
          a.motorista_id === agregado.motorista_id 
            ? { 
                ...a, 
                cliente_id: clienteId,
                cliente: clienteId 
                  ? clientes.find(c => c.cliente_id === clienteId) 
                  : null
              } 
            : a
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

  const handleToggleStatus = async (e: React.MouseEvent, agregado: ViewAgregado) => {
    e.stopPropagation();
    try {
      setUpdatingStatus(agregado.motorista_id || 0);
      
      // Update the ativo status in the database (toggle it)
      const newAtivo = !agregado.ativo;
      
      const { error } = await supabase
        .from('motorista')
        .update({ ativo: newAtivo })
        .eq('motorista_id', agregado.motorista_id || 0);
        
      if (error) throw error;
      
      // Update the local state
      setAgregados(prev => 
        prev.map(a => 
          a.motorista_id === agregado.motorista_id 
            ? { ...a, ativo: newAtivo } 
            : a
        )
      );
      
      toast.success(`Agregado ${newAtivo ? 'ativado' : 'desativado'} com sucesso`);
    } catch (error) {
      console.error('Error updating ativo status:', error);
      toast.error('Erro ao atualizar status do agregado');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const filteredAgregados = (agregados || []).filter(agregado => {
    if (!agregado) return false;
    
    const searchLower = searchTerm.toLowerCase();
    // Filtro de status
    if (statusFilter.length > 0 && !statusFilter.includes(agregado.st_cadastro)) {
      return false;
    }
    
    // Lógica para filtro de cliente
    let clienteMatch = true;
    if (clienteFilter.length > 0) {
      if (clienteFilter.includes('sem_cliente')) {
        clienteMatch = agregado.cliente_id === null || agregado.cliente_id === undefined;
      } else if (agregado.cliente_id) {
        clienteMatch = clienteFilter.includes(agregado.cliente_id.toString());
      } else {
        clienteMatch = false;
      }
    }
    
    // Lógica para filtro de veículo
    let veiculoMatch = true;
    if (tipoVeiculoFilter.length > 0) {
      if (tipoVeiculoFilter.includes('sem_veiculo')) {
        veiculoMatch = !agregado.veiculo_id;
      } else {
        veiculoMatch = agregado.tipologia ? tipoVeiculoFilter.includes(agregado.tipologia) : false;
      }
    }
    
    const cidadeMatch = cidadeFilter.length > 0 ? (agregado.nome_cidade ? cidadeFilter.includes(agregado.nome_cidade) : false) : true;
    const ativoMatch = ativoFilter === '' ? true : 
      (ativoFilter === 'true' ? agregado.ativo === true : agregado.ativo === false);
    
    try {
      // Verifica se o status do agregado está na lista de status filtrados
      const statusMatch = statusFilter.length > 0 
        ? (agregado.st_cadastro ? statusFilter.includes(agregado.st_cadastro) : false)
        : true;
        
      return (
        statusMatch &&
        clienteMatch &&
        veiculoMatch &&
        cidadeMatch &&
        ativoMatch &&
        ((agregado.nome_motorista?.toLowerCase().includes(searchLower)) ||
         (agregado.cpf?.includes(searchLower)) ||
         (typeof agregado.email === 'string' && agregado.email.toLowerCase().includes(searchLower)) ||
         (agregado.telefone?.toString().includes(searchLower)) ||
         (agregado.placa?.toLowerCase().includes(searchLower)))
      );
    } catch (error) {
      console.error('Erro ao filtrar agregado:', error, agregado);
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
    data: filteredAgregados,
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Buscar por nome, CPF, email, telefone ou placa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="relative group">
            <div className="relative w-full">
              <button
                type="button"
                className="w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-left bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowStatusDropdown(!showStatusDropdown);
                  setShowClienteDropdown(false);
                  setShowCidadeDropdown(false);
                }}
              >
                <div className="flex-1 truncate text-left">
                  {statusFilter.length === 0 ? 'Todos os status' : `${statusFilter.length} selecionado(s)`}
                </div>
              </button>
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showStatusDropdown ? 'transform rotate-180' : ''}`} />
              </div>
            </div>
            
            {showStatusDropdown && (
              <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg rounded-md py-1 max-h-60 overflow-auto">
                <div className="px-3 py-1 border-b border-gray-200 dark:border-gray-600">
                  <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>Selecionar status</span>
                    <button 
                      type="button" 
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearStatusFilter();
                      }}
                    >
                      Limpar
                    </button>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {statusOptions.map((status) => (
                    <div key={status.value} className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                          checked={statusFilter.includes(status.value)}
                          onChange={() => toggleStatus(status.value)}
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-200">{status.label}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <div className="relative w-full">
              <select
                value={ativoFilter}
                onChange={(e) => setAtivoFilter(e.target.value)}
                className="w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none"
              >
                <option value="">Todos (Ativos/Inativos)</option>
                <option value="active">Somente Ativos</option>
                <option value="inactive">Somente Inativos</option>
              </select>
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative group" ref={clienteDropdownRef}>
            <div className="relative w-full">
              <button
                type="button"
                className="w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-left bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowClienteDropdown(!showClienteDropdown);
                  setShowCidadeDropdown(false);
                }}
                disabled={clientesLoading}
              >
                <div className="flex-1 truncate text-left">
                  {clientesLoading ? 'Carregando...' : 
                   clienteFilter.length === 0 ? 'Todos os clientes' : `${clienteFilter.length} selecionado(s)`}
                </div>
              </button>
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                {clientesLoading ? (
                  <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
                ) : (
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showClienteDropdown ? 'transform rotate-180' : ''}`} />
                )}
              </div>
            </div>
            
            {showClienteDropdown && !clientesLoading && (
              <div 
                className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg rounded-md py-1 max-h-60 overflow-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-1 border-b border-gray-200 dark:border-gray-600">
                  <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>Selecionar clientes</span>
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
                <div className="max-h-48 overflow-y-auto">
                  <div className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                        checked={clienteFilter.includes('sem_cliente')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setClienteFilter([...clienteFilter, 'sem_cliente']);
                          } else {
                            setClienteFilter(clienteFilter.filter(c => c !== 'sem_cliente'));
                          }
                        }}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-200">Sem cliente</span>
                    </label>
                  </div>
                  {clientes.map((cliente) => {
                    // Skip rendering if cliente or cliente.id is undefined
                    if (!cliente || cliente.id === undefined || cliente.id === null) {
                      return null;
                    }
                    const clienteId = cliente.id.toString();
                    return (
                      <div key={clienteId} className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                            checked={clienteFilter.includes(clienteId)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setClienteFilter([...clienteFilter, clienteId]);
                              } else {
                                setClienteFilter(clienteFilter.filter(c => c !== clienteId));
                              }
                            }}
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-200">{cliente.nome || 'Cliente sem nome'}</span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="relative group" ref={cidadeDropdownRef}>
            <div className="relative w-full">
              <button
                type="button"
                className="w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-left bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCidadeDropdown(!showCidadeDropdown);
                  setShowClienteDropdown(false);
                }}
              >
                <div className="flex-1 truncate text-left">
                  {cidadeFilter.length === 0 ? 'Todas as cidades' : `${cidadeFilter.length} selecionada(s)`}
                </div>
              </button>
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showCidadeDropdown ? 'transform rotate-180' : ''}`} />
              </div>
            </div>
            
            {showCidadeDropdown && (
              <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg rounded-md py-1 max-h-60 overflow-auto">
                <div className="px-3 py-1 border-b border-gray-200 dark:border-gray-600">
                  <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>Selecionar cidades</span>
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
                <div className="max-h-48 overflow-y-auto">
                  {cidades.map((cidade, index) => (
                    <div key={index} className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                          checked={cidadeFilter.includes(cidade)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCidadeFilter([...cidadeFilter, cidade]);
                            } else {
                              setCidadeFilter(cidadeFilter.filter(c => c !== cidade));
                            }
                          }}
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-200">{cidade}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative group">
            <div className="relative w-full">
              <button
                type="button"
                className="w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-left bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                onClick={() => setShowTipoVeiculoDropdown(!showTipoVeiculoDropdown)}
              >
                <div className="flex-1 truncate text-left">
                  {tipoVeiculoFilter.length === 0 ? 'Todos os tipos' : `${tipoVeiculoFilter.length} selecionado(s)`}
                </div>
              </button>
              <Truck className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showTipoVeiculoDropdown ? 'transform rotate-180' : ''}`} />
              </div>
            </div>
            
            {showTipoVeiculoDropdown && (
              <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg rounded-md py-1 max-h-60 overflow-auto">
                <div className="px-3 py-1 border-b border-gray-200 dark:border-gray-600">
                  <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>Selecionar tipos</span>
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
                <div className="max-h-48 overflow-y-auto">
                  <div className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                        checked={tipoVeiculoFilter.includes('sem_veiculo')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTipoVeiculoFilter([...tipoVeiculoFilter, 'sem_veiculo']);
                          } else {
                            setTipoVeiculoFilter(tipoVeiculoFilter.filter(t => t !== 'sem_veiculo'));
                          }
                        }}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-200">Sem veículo</span>
                    </label>
                  </div>
                  {tiposVeiculo.map((tipo, index) => (
                    <div key={index} className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                          checked={tipoVeiculoFilter.includes(tipo)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTipoVeiculoFilter([...tipoVeiculoFilter, tipo]);
                            } else {
                              setTipoVeiculoFilter(tipoVeiculoFilter.filter(t => t !== tipo));
                            }
                          }}
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-200">{tipo}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-4 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none"
            >
              <option value="all">Todos os períodos</option>
              <option value="today">Hoje</option>
              <option value="2days">Últimos 2 dias</option>
              <option value="15days">Últimos 15 dias</option>
              <option value="30days">Último mês</option>
              <option value="custom">Personalizado</option>
            </select>
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <ChevronDown className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
          
          <div className="relative group self-center">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                       transition-colors flex items-center justify-center"
              aria-label="Adicionar novo agregado"
            >
              <Plus className="w-5 h-5" />
            </button>
            <div className="invisible group-hover:visible absolute z-10 w-auto px-1.5 py-0.5 text-xs text-white bg-gray-800 rounded shadow -bottom-6 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Novo Agregado
            </div>
          </div>
        </div>

        {dateFilter === 'custom' && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
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

      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 relative">
        <div className="overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAll}
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Cidade</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Veículo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Data Cadastro</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedData.map((agregado, index) => (
                    <tr 
                      key={`agregado-${agregado.motorista_id || 'new'}-${index}`} 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                        selectedItems.has(agregado.motorista_id || 0) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                      onContextMenu={(e) => handleContextMenu(e, agregado)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(agregado.motorista_id || 0)}
                          onChange={() => handleSelectItem(agregado.motorista_id || 0)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {agregado.nome_motorista || ''}
                              {agregado.nome_ajudante && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  Ajudante: {agregado.nome_ajudante}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {formatCPF(agregado.cpf || '')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {agregado.telefone ? formatPhone(agregado.telefone.toString()) : '-'}
                          </div>
                          {agregado.telefone && (
                            <button
                              onClick={() => agregado.telefone && startChat(agregado.telefone.toString(), agregado.nome_motorista || '')}
                              className="ml-2 p-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 rounded-full hover:bg-green-50 dark:hover:bg-green-900/20"
                              title="Iniciar chat"
                            >
                              <MessageCircle size={16} />
                            </button>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {agregado.email || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="relative">
                          <button
                            onClick={(e) => toggleStatusDropdown(e, agregado.motorista_id || 0)}
                            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
                                     hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors
                                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                                     dark:focus:ring-offset-gray-800"
                          >
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              agregado.st_cadastro === 'contratado' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200' :
                              agregado.st_cadastro === 'rejeitado' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200' :
                              agregado.st_cadastro === 'documentacao' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200' :
                              agregado.st_cadastro === 'qualificado' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200' :
                              agregado.st_cadastro === 'contrato_enviado' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200' :
                              agregado.st_cadastro === 'repescagem' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {agregado.st_cadastro === 'contrato_enviado' ? 'Contrato Enviado' : 
                               agregado.st_cadastro ? (agregado.st_cadastro.charAt(0).toUpperCase() + agregado.st_cadastro.slice(1)) : 'Indefinido'}
                            </span>
                            <ChevronDown size={14} className="text-gray-500 dark:text-gray-400" />
                          </button>
                          
                          {statusDropdownOpen === agregado.motorista_id && (
                            <div 
                              className="absolute left-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 border border-gray-200 dark:border-gray-700"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="py-1">
                                <button
                                  onClick={(e) => handleUpdateStatus(e, agregado, 'cadastrado')}
                                  className={`block w-full text-left px-4 py-2 text-sm ${
                                    agregado.st_cadastro === 'cadastrado' 
                                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' 
                                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                  }`}
                                >
                                  Cadastrado
                                </button>
                                <button
                                  onClick={(e) => handleUpdateStatus(e, agregado, 'qualificado')}
                                  className={`block w-full text-left px-4 py-2 text-sm ${
                                    agregado.st_cadastro === 'qualificado' 
                                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' 
                                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                  }`}
                                >
                                  Qualificado
                                </button>
                                <button
                                  onClick={(e) => handleUpdateStatus(e, agregado, 'documentacao')}
                                  className={`block w-full text-left px-4 py-2 text-sm ${
                                    agregado.st_cadastro === 'documentacao' 
                                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' 
                                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                  }`}
                                >
                                  Documentação
                                </button>
                                <button
                                  onClick={(e) => handleUpdateStatus(e, agregado, 'contrato_enviado')}
                                  className={`block w-full text-left px-4 py-2 text-sm ${
                                    agregado.st_cadastro === 'contrato_enviado' 
                                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' 
                                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                  }`}
                                >
                                  Contrato Enviado
                                </button>
                                <button
                                  onClick={(e) => handleUpdateStatus(e, agregado, 'contratado')}
                                  className={`block w-full text-left px-4 py-2 text-sm ${
                                    agregado.st_cadastro === 'contratado' 
                                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' 
                                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                  }`}
                                >
                                  Contratado
                                </button>
                                <button
                                  onClick={(e) => handleUpdateStatus(e, agregado, 'repescagem')}
                                  className={`block w-full text-left px-4 py-2 text-sm ${
                                    agregado.st_cadastro === 'repescagem' 
                                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' 
                                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                  }`}
                                >
                                  Repescagem
                                </button>
                                <button
                                  onClick={(e) => handleUpdateStatus(e, agregado, 'rejeitado')}
                                  className={`block w-full text-left px-4 py-2 text-sm ${
                                    agregado.st_cadastro === 'rejeitado' 
                                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' 
                                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                  }`}
                                >
                                  Rejeitado
                                </button>
                              </div>
                            </div>
                          )}
                          
                          {updatingStatus === agregado.motorista_id && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 rounded-full">
                              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="relative">
                          <button
                            onClick={(e) => toggleClienteDropdown(e, agregado.motorista_id || 0)}
                            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
                                     hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors
                                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                                     dark:focus:ring-offset-gray-800 text-left w-full"
                          >
                            <span className="truncate max-w-[150px]">
                              {agregado.cliente_id ? clientes.find(c => c.cliente_id === agregado.cliente_id)?.nome || 'Cliente não encontrado' : 'Sem cliente'}
                            </span>
                            <ChevronDown size={14} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
                          </button>
                          
                          {clienteDropdownOpen === agregado.motorista_id && (
                            <div 
                              className="absolute left-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 border border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="py-1">
                                <button
                                  onClick={(e) => handleUpdateCliente(e, agregado, null)}
                                  className={`block w-full text-left px-4 py-2 text-sm ${
                                    !agregado.cliente_id
                                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' 
                                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                  }`}
                                >
                                  Sem cliente
                                </button>
                                
                                {clientes.map((cliente) => {
                                  // Skip rendering if cliente or cliente.id is undefined
                                  if (!cliente || cliente.id === undefined || cliente.id === null) {
                                    return null;
                                  }
                                  const clienteId = cliente.id.toString();
                                  return (
                                    <button
                                      key={clienteId}
                                      onClick={(e) => handleUpdateCliente(e, agregado, cliente.id)}
                                      className={`block w-full text-left px-4 py-2 text-sm truncate ${
                                        agregado.cliente_id === cliente.id
                                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' 
                                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                      }`}
                                    >
                                      {cliente.nome || 'Cliente sem nome'}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {updatingCliente === agregado.motorista_id && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 rounded-full">
                              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {agregado.nome_cidade || 'Não informada'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {agregado.placa ? (
                            <span className="uppercase">{agregado.placa}</span>
                          ) : (
                            'Não informado'
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {agregado.tipologia || ''}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {formatDate(agregado.data_cadastro || '')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-3">
                          <button
                            onClick={() => handleViewDetail(agregado)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            title="Visualizar"
                          >
                            <FilePen size={18} />
                          </button>
                          <button
                            onClick={(e) => handleToggleStatus(e, agregado)}
                            disabled={updatingStatus === agregado.motorista_id}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                              agregado.ativo 
                                ? 'bg-green-500 dark:bg-green-600' 
                                : 'bg-gray-200 dark:bg-gray-700'
                            } ${updatingStatus === agregado.motorista_id ? 'opacity-50 cursor-not-allowed' : ''}`}
                            role="switch"
                            aria-checked={agregado.ativo}
                            title={agregado.ativo ? "Desativar agregado" : "Ativar agregado"}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                agregado.ativo ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                            {updatingStatus === agregado.motorista_id && (
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
        
        {filteredAgregados.length === 0 ? (
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
      {contextMenu.visible && contextMenu.agregado && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu({ ...contextMenu, visible: false })}
          actions={[
            {
              icon: <Truck size={16} />,
              label: 'Visualizar Detalhes',
              onClick: () => handleViewDetail(contextMenu.agregado!),
              color: 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300'
            },
            {
              icon: <Edit2 size={16} />,
              label: 'Editar Agregado',
              onClick: () => handleEdit(contextMenu.agregado!),
              color: 'text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300'
            },
            {
              icon: <FileText size={16} />,
              label: 'Gerenciar Documentos',
              onClick: () => handleUploadDocument(contextMenu.agregado!),
              color: 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300'
            },
            {
              icon: <MessageCircle size={16} />,
              label: 'Iniciar Chat',
              onClick: () => startChat(contextMenu.agregado!.telefone?.toString() || '', contextMenu.agregado!.nome || ''),
              color: 'text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300',
              disabled: !contextMenu.agregado!.telefone
            }
          ]}
        />
      )}

      {/* Modals */}
      <UnifiedAgregadoModal
        isOpen={isDetailViewOpen}
        onClose={() => setIsDetailViewOpen(false)}
        motorista={selectedAgregado}
        onSuccess={() => {
          setIsDetailViewOpen(false);
          // Add any success callback logic here if needed
        }}
      />

      {selectedAgregado && (() => {
        // Transformar o selectedAgregado em um objeto MotoristaWithAddress
        // Criar objeto veículo compatível com o tipo Veiculo
        const veiculo = selectedAgregado.veiculo?.[0] ? {
          veiculo_id: selectedAgregado.veiculo[0].veiculo_id || 0,
          placa: selectedAgregado.veiculo[0].placa || '',
          status_veiculo: true, // Valor padrão
          marca: selectedAgregado.veiculo[0].marca_veiculo || '',
          tipologia: selectedAgregado.veiculo[0].tipologia || '',
          ano: selectedAgregado.veiculo[0].ano || '',
          combustivel: selectedAgregado.veiculo[0].combustivel || '',
          peso: selectedAgregado.veiculo[0].peso || '',
          cubagem: selectedAgregado.veiculo[0].cubagem || '',
          possui_rastreador: selectedAgregado.veiculo[0].possui_rastreador || false,
          marca_rastreador: selectedAgregado.veiculo[0].marca_rastreador || '',
          motorista_id: selectedAgregado.motorista_id || 0,
          cor: selectedAgregado.veiculo[0].cor || '',
          tipo: selectedAgregado.veiculo[0].tipo || '',
          documento_veiculo: []
        } : undefined;

        // Criar objeto motorista compatível com o tipo MotoristaWithAddress
        const motoristaWithAddress: MotoristaWithAddress = {
          motorista_id: selectedAgregado.motorista_id || 0,
          cpf: selectedAgregado.cpf || '',
          dt_nascimento: selectedAgregado.dt_nascimento || '',
          genero: selectedAgregado.genero || '',
          telefone: selectedAgregado.telefone ? Number(selectedAgregado.telefone) : null,
          email: selectedAgregado.email || null,
          funcao: selectedAgregado.funcao || '',
          nome: selectedAgregado.nome || selectedAgregado.nome_motorista || '',
          origem_usuario: selectedAgregado.origem_usuario || '',
          st_cadastro: selectedAgregado.st_cadastro || '',
          autorizacao_lgpd: selectedAgregado.autorizacao_lgpd || '',
          company_id: selectedAgregado.company_id || 0,
          data_cadastro: selectedAgregado.data_cadastro || '',
          cliente_id: selectedAgregado.cliente_id || 0,
          ativo: selectedAgregado.ativo || false,
          endereco: {
            id_end_motorista: selectedAgregado.id_end_motorista || 0,
            nr_end: selectedAgregado.nr_end !== null && selectedAgregado.nr_end !== undefined 
              ? Number(selectedAgregado.nr_end) 
              : null,
            ds_complemento_end: selectedAgregado.ds_complemento_end || null,
            st_end: selectedAgregado.st_end !== null && selectedAgregado.st_end !== undefined 
              ? selectedAgregado.st_end 
              : null,
            logradouro: selectedAgregado.logradouro || selectedAgregado.endereco?.logradouro || null,
            nr_cep: selectedAgregado.nr_cep || (selectedAgregado.endereco as any)?.cep?.replace(/\D/g, '') || null,
            bairro: selectedAgregado.nome_bairro || selectedAgregado.endereco?.bairro || null,
            cidade: selectedAgregado.nome_cidade || selectedAgregado.endereco?.cidade || null,
            estado: selectedAgregado.nome_estado || selectedAgregado.endereco?.estado || null,
            sigla_estado: selectedAgregado.sigla_estado || 
              (selectedAgregado.endereco?.estado ? selectedAgregado.endereco.estado.substring(0, 2).toUpperCase() : null)
          },
          veiculo: veiculo,
          documento_motorista: [] // Inicializa vazio por enquanto, já que não temos os dados completos
        };

        // Função para formatar o endereço para o DocumentViewer
        const formatEndereco = (endereco: EnderecoMotorista | null | undefined) => {
          if (!endereco) return undefined;
          
          const result: {
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
          } = {};
          
          if (endereco.logradouro) {
            result.logradouro = {
              logradouro: endereco.logradouro || undefined,
              nr_cep: endereco.nr_cep?.toString() || undefined,
              bairro: endereco.bairro ? {
                bairro: endereco.bairro,
                cidade: endereco.cidade ? {
                  cidade: endereco.cidade,
                  estado: endereco.sigla_estado ? {
                    sigla_estado: endereco.sigla_estado
                  } : undefined
                } : undefined
              } : undefined
            };
          }
          
          if (endereco.nr_end) {
            result.nr_end = endereco.nr_end;
          }
          
          if (endereco.ds_complemento_end) {
            result.ds_complemento_end = endereco.ds_complemento_end;
          }
          
          return Object.keys(result).length > 0 ? result : undefined;
        };

        return (
          <DocumentViewer
            isOpen={isDocumentViewerOpen}
            onClose={() => setIsDocumentViewerOpen(false)}
            documento={null} // Definido como null por enquanto, já que não temos os documentos
            nome={motoristaWithAddress.nome || ''}
            cpf={motoristaWithAddress.cpf || undefined}
            email={motoristaWithAddress.email || undefined}
            telefone={motoristaWithAddress.telefone?.toString() || undefined}
            dt_nascimento={motoristaWithAddress.dt_nascimento || undefined}
            endereco={formatEndereco(motoristaWithAddress.endereco)}
            veiculo={veiculo || null}
            isAgregado={true}
            st_cadastro={motoristaWithAddress.st_cadastro || null}
          />
        );
      })()}

      <DocumentUploadModal
        isOpen={isDocumentUploadOpen}
        onClose={() => setIsDocumentUploadOpen(false)}
        motorista_id={selectedAgregado?.motorista_id || 0}
        nome={selectedAgregado?.nome || ''}
        onUploadSuccess={fetchAgregados}
      />

      {selectedAgregado && (
        <EditMotoristaModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedAgregado(null);
          }}
          motorista={{
            motorista_id: selectedAgregado.motorista_id,
            cpf: selectedAgregado.cpf,
            dt_nascimento: selectedAgregado.dt_nascimento,
            genero: selectedAgregado.genero,
            telefone: selectedAgregado.telefone ? Number(selectedAgregado.telefone) : null,
            email: selectedAgregado.email,
            funcao: selectedAgregado.funcao,
            nome: selectedAgregado.nome || selectedAgregado.nome_motorista || '',
            origem_usuario: selectedAgregado.origem_usuario,
            st_cadastro: selectedAgregado.st_cadastro,
            autorizacao_lgpd: selectedAgregado.autorizacao_lgpd,
            company_id: selectedAgregado.company_id,
            data_cadastro: selectedAgregado.data_cadastro,
            cliente_id: selectedAgregado.cliente_id || 0,
            ativo: selectedAgregado.ativo || false,
            endereco: {
              id_end_motorista: selectedAgregado.id_end_motorista || 0,
              nr_end: selectedAgregado.nr_end !== null && selectedAgregado.nr_end !== undefined 
                ? Number(selectedAgregado.nr_end) 
                : null,
              ds_complemento_end: selectedAgregado.ds_complemento_end || null,
              st_end: selectedAgregado.st_end || null,
              logradouro: selectedAgregado.logradouro || selectedAgregado.endereco?.logradouro || null,
              nr_cep: selectedAgregado.nr_cep || (selectedAgregado.endereco as any)?.cep?.replace(/\D/g, '') || null,
              bairro: selectedAgregado.nome_bairro || selectedAgregado.endereco?.bairro || null,
              cidade: selectedAgregado.nome_cidade || selectedAgregado.endereco?.cidade || null,
              estado: selectedAgregado.nome_estado || selectedAgregado.endereco?.estado || null,
              sigla_estado: selectedAgregado.sigla_estado || 
                (selectedAgregado.endereco?.estado ? selectedAgregado.endereco.estado.substring(0, 2).toUpperCase() : null)
            },
            veiculo: selectedAgregado.veiculo?.[0] ? {
              veiculo_id: selectedAgregado.veiculo[0].veiculo_id || 0,
              placa: selectedAgregado.veiculo[0].placa || '',
              status_veiculo: true,
              marca: selectedAgregado.veiculo[0].marca_veiculo || '',
              tipologia: selectedAgregado.veiculo[0].tipologia || '',
              ano: selectedAgregado.veiculo[0].ano || '',
              combustivel: selectedAgregado.veiculo[0].combustivel || '',
              peso: selectedAgregado.veiculo[0].peso || '',
              cubagem: selectedAgregado.veiculo[0].cubagem || '',
              possui_rastreador: selectedAgregado.veiculo[0].possui_rastreador || false,
              marca_rastreador: selectedAgregado.veiculo[0].marca_rastreador || '',
              motorista_id: selectedAgregado.motorista_id,
              cor: selectedAgregado.veiculo[0].cor || '',
              tipo: selectedAgregado.veiculo[0].tipo || ''
            } : undefined,
            documento_motorista: []
          }}
          onUpdate={() => {
            fetchAgregados();
            setSelectedAgregado(null);
          }}
        />
      )}

      <AddAgregadoModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchAgregados}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este agregado? Esta ação não pode ser desfeita."
        itemData={selectedAgregado ? [
          { label: 'Nome', value: selectedAgregado.nome },
          { label: 'CPF', value: formatCPF(selectedAgregado.cpf || '') },
          { label: 'Status', value: selectedAgregado.st_cadastro },
          { label: 'Veículo', value: (selectedAgregado.veiculo?.[0]?.placa || '').toUpperCase() || 'Não informado' }
        ] : []}
      />

      <BulkActionsModal
        isOpen={isBulkActionsModalOpen}
        onClose={() => setIsBulkActionsModalOpen(false)}
        selectedItems={selectedItems}
        actionType={bulkActionType}
        onSuccess={fetchAgregados}
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

      <MassMessageModal
        isOpen={isMassMessageModalOpen}
        onClose={() => setIsMassMessageModalOpen(false)}
        numbers={Array.from(selectedItems)
          .map(id => {
            const agregado = agregados.find(a => a.motorista_id === id);
            return agregado?.telefone ? agregado.telefone.toString() : '';
          })
          .filter(Boolean)}
      />
    </div>
  );
};

export default AgregadosLista;