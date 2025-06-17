import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Edit2, Trash2, FileText, MessageCircle, Filter, ChevronDown, X, Truck, Loader2, MapPin, FilePen } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import type { Motorista, DocumentoMotorista, Veiculo, DocumentoVeiculo } from '../../types/database';
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
import AgregadoDetailView from '../../components/AgregadoDetailView';

interface MotoristaWithDetails extends Motorista {
  veiculo?: (Veiculo & {
    documento_veiculo: (DocumentoVeiculo & {
      pessoa_fisica_dono_veiculo?: {
        id_pessoa_fisica_dono_veiculo: number;
        nome_dono_veiculo: string;
        nr_rg: number;
      };
      pessoa_juridica_dono_veiculo?: {
        id_pessoa_juridica_dono_veiculo: number;
        cnpj: number;
        inscricao_estadual: string;
        razao_social: string;
      };
    })[];
  })[];
  documento?: DocumentoMotorista | null;
  endereco?: {
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
  } | null;
}

const AgregadosLista = () => {
  const { query, companyId } = useCompanyData();
  const { startChat } = useFloatingChat();
  const [agregados, setAgregados] = useState<MotoristaWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [isDocumentUploadOpen, setIsDocumentUploadOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkActionsModalOpen, setIsBulkActionsModalOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'status' | 'client'>('status');
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isMassMessageModalOpen, setIsMassMessageModalOpen] = useState(false);
  const [selectedAgregado, setSelectedAgregado] = useState<MotoristaWithDetails | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteFilter, setClienteFilter] = useState<string>('');
  const [cidadeFilter, setCidadeFilter] = useState<string>('');
  const [cidades, setCidades] = useState<string[]>([]);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    agregado: MotoristaWithDetails | null;
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

  const fetchAgregados = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('motorista')
        .select(`
          *,
          veiculo (
            *,
            documento_veiculo (
              *,
              pessoa_fisica_dono_veiculo (*),
              pessoa_juridica_dono_veiculo (*)
            )
          ),
          documento_motorista (*),
          end_motorista (
            nr_end,
            ds_complemento_end,
            logradouro (
              logradouro,
              nr_cep,
              bairro (
                bairro,
                cidade (
                  cidade,
                  estado (
                    sigla_estado
                  )
                )
              )
            )
          ),
          cliente (
            cliente_id,
            nome
          )
        `)
        .eq('funcao', 'Agregado')
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
      data?.forEach(agregado => {
        const cidade = agregado.end_motorista?.[0]?.logradouro?.bairro?.cidade?.cidade;
        if (cidade) {
          uniqueCities.add(cidade);
        }
      });
      setCidades(Array.from(uniqueCities).sort());

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
      const { data, error } = await supabase
        .from('cliente')
        .select('*')
        .eq('company_id', companyId)
        .eq('st_cliente', true)
        .order('nome');

      if (error) throw error;

      setClientes(data || []);
    } catch (error) {
      console.error('Error fetching clientes:', error);
      toast.error('Erro ao carregar clientes');
    }
  };

  const handleViewDetail = (agregado: MotoristaWithDetails) => {
    setSelectedAgregado(agregado);
    setIsDetailViewOpen(true);
  };

  const handleUploadDocument = (agregado: MotoristaWithDetails) => {
    setSelectedAgregado(agregado);
    setIsDocumentUploadOpen(true);
  };

  const handleEdit = (agregado: MotoristaWithDetails) => {
    setSelectedAgregado(agregado);
    setIsEditModalOpen(true);
  };

  const handleDelete = (agregado: MotoristaWithDetails) => {
    setSelectedAgregado(agregado);
    setIsDeleteModalOpen(true);
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
      setSelectedItems(new Set(filteredAgregados.map(a => a.motorista_id)));
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
      setAgregados(agregados.filter(a => !selectedItems.has(a.motorista_id)));
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

  const handleContextMenu = (e: React.MouseEvent, agregado: MotoristaWithDetails) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      agregado,
    });
  };

  const toggleStatusDropdown = (e: React.MouseEvent, agregadoId: number) => {
    e.stopPropagation();
    if (statusDropdownOpen === agregadoId) {
      setStatusDropdownOpen(null);
    } else {
      setStatusDropdownOpen(agregadoId);
    }
  };

  const toggleClienteDropdown = (e: React.MouseEvent, agregadoId: number) => {
    e.stopPropagation();
    if (clienteDropdownOpen === agregadoId) {
      setClienteDropdownOpen(null);
    } else {
      setClienteDropdownOpen(agregadoId);
    }
  };

  const handleUpdateStatus = async (e: React.MouseEvent, agregado: MotoristaWithDetails, newStatus: string) => {
    e.stopPropagation();
    try {
      setUpdatingStatus(agregado.motorista_id);
      
      // Update the status in the database
      const { error } = await supabase
        .from('motorista')
        .update({ st_cadastro: newStatus })
        .eq('motorista_id', agregado.motorista_id);
        
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

  const handleUpdateCliente = async (e: React.MouseEvent, agregado: MotoristaWithDetails, clienteId: number | null) => {
    e.stopPropagation();
    try {
      setUpdatingCliente(agregado.motorista_id);
      
      // Update the cliente_id in the database
      const { error } = await supabase
        .from('motorista')
        .update({ cliente_id: clienteId })
        .eq('motorista_id', agregado.motorista_id);
        
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

  const handleToggleStatus = async (e: React.MouseEvent, agregado: MotoristaWithDetails) => {
    e.stopPropagation();
    try {
      setUpdatingStatus(agregado.motorista_id);
      
      // Update the ativo status in the database (toggle it)
      const newAtivo = !agregado.ativo;
      
      const { error } = await supabase
        .from('motorista')
        .update({ ativo: newAtivo })
        .eq('motorista_id', agregado.motorista_id);
        
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

  const getAgregadoCity = (agregado: MotoristaWithDetails): string | null => {
    return agregado.end_motorista?.[0]?.logradouro?.bairro?.cidade?.cidade || null;
  };

  const filteredAgregados = agregados.filter(agregado => {
    const searchLower = searchTerm.toLowerCase();
    const statusMatch = statusFilter ? agregado.st_cadastro === statusFilter : true;
    const clienteMatch = clienteFilter ? agregado.cliente_id === parseInt(clienteFilter) : true;
    const cidadeMatch = cidadeFilter ? getAgregadoCity(agregado) === cidadeFilter : true;
    
    return (
      statusMatch &&
      clienteMatch &&
      cidadeMatch &&
      ((agregado.nome && agregado.nome.toLowerCase().includes(searchLower)) ||
       (agregado.cpf && agregado.cpf.includes(searchLower)) ||
       (typeof agregado.email === 'string' && agregado.email.toLowerCase().includes(searchLower)) ||
       (typeof agregado.telefone === 'number' && agregado.telefone.toString().includes(searchLower)) ||
       (agregado.veiculo && agregado.veiculo[0]?.placa && agregado.veiculo[0].placa.toLowerCase().includes(searchLower)))
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
                <Trash2 className="w-5 h-5" />
                Excluir
              </button>
            </>
          )}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                     transition-colors flex items-center justify-center w-10 h-10"
            title="Adicionar Agregado"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por nome, CPF, email, telefone ou placa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none"
            >
              <option value="">Todos os status</option>
              <option value="cadastrado">Cadastrado</option>
              <option value="qualificado">Qualificado</option>
              <option value="documentacao">Documentação</option>
              <option value="contrato_enviado">Contrato Enviado</option>
              <option value="contratado">Contratado</option>
              <option value="repescagem">Repescagem</option>
              <option value="rejeitado">Rejeitado</option>
            </select>
            <Filter className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <ChevronDown className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>

          <div className="relative">
            <select
              value={cidadeFilter}
              onChange={(e) => setCidadeFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none"
            >
              <option value="">Todas as cidades</option>
              {cidades.map((cidade, index) => (
                <option key={index} value={cidade}>
                  {cidade}
                </option>
              ))}
            </select>
            <MapPin className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <ChevronDown className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
        </div>
        
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <select
              value={clienteFilter}
              onChange={(e) => setClienteFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none"
            >
              <option value="">Todos os clientes</option>
              {clientes.map(cliente => (
                <option key={cliente.cliente_id} value={cliente.cliente_id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <ChevronDown className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>

          <div className="relative">
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
        </div>

        {dateFilter === 'custom' && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              