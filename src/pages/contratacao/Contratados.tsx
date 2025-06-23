import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Edit2, FileText, MessageCircle, Filter, ChevronDown, X, User, Loader2, MapPin, FilePen, Truck } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import type { Motorista, DocumentoMotorista } from '../../types/database';
import { formatCPF, formatPhone, formatDate } from '../../utils/format';
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

interface MotoristaWithAddress extends Motorista {
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
  veiculo?: {
    placa: string;
    tipologia: string;
    marca?: string;
    tipo?: string;
  }[];
}

const Contratados = () => {
  const { query, companyId } = useCompanyData();
  const { startChat } = useFloatingChat();
  const [contratados, setContratados] = useState<MotoristaWithAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [ativoFilter, setAtivoFilter] = useState<string>('');
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [isDocumentUploadOpen, setIsDocumentUploadOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkActionsModalOpen, setIsBulkActionsModalOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'status' | 'client'>('status');
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isMassMessageModalOpen, setIsMassMessageModalOpen] = useState(false);
  const [selectedMotorista, setSelectedMotorista] = useState<Motorista | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [documento, setDocumento] = useState<DocumentoMotorista | null>(null);
  const [endereco, setEndereco] = useState<any | null>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteFilter, setClienteFilter] = useState<string>('');
  const [cidadeFilter, setCidadeFilter] = useState<string>('');
  const [cidades, setCidades] = useState<string[]>([]);
  const [tipoVeiculoFilter, setTipoVeiculoFilter] = useState<string>('');
  const [tiposVeiculo, setTiposVeiculo] = useState<string[]>([]);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    motorista: Motorista | null;
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

  const fetchContratados = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('motorista')
        .select(`
          *,
          end_motorista (
            logradouro (
              bairro (
                cidade (
                  cidade
                )
              )
            )
          ),
          cliente (
            cliente_id,
            nome
          ),
          veiculo (
            placa,
            tipologia,
            marca,
            tipo
          )
        `)
        .eq('st_cadastro', 'contratado')
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

      // Extract unique cities from contratados
      const uniqueCities = new Set<string>();
      const uniqueVehicleTypes = new Set<string>();
      
      data?.forEach(motorista => {
        const cidade = motorista.end_motorista?.[0]?.logradouro?.bairro?.cidade?.cidade;
        if (cidade) {
          uniqueCities.add(cidade);
        }
        
        // Extract vehicle types
        if (motorista.veiculo && motorista.veiculo.length > 0) {
          motorista.veiculo.forEach(veiculo => {
            if (veiculo.tipologia) {
              uniqueVehicleTypes.add(veiculo.tipologia);
            }
          });
        }
      });
      
      setCidades(Array.from(uniqueCities).sort());
      setTiposVeiculo(Array.from(uniqueVehicleTypes).sort());

      setContratados(data || []);
    } catch (error) {
      console.error('Error fetching contratados:', error);
      toast.error('Erro ao carregar contratados');
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

  const handleViewDocument = async (motorista: Motorista) => {
    try {
      setSelectedMotorista(motorista);
      setIsUnifiedModalOpen(true);
    } catch (error) {
      console.error('Error fetching document details:', error);
      toast.error('Erro ao carregar detalhes do documento');
    }
  };

  const handleUploadDocument = (motorista: Motorista) => {
    setSelectedMotorista(motorista);
    setIsDocumentUploadOpen(true);
  };

  const handleEdit = (motorista: Motorista) => {
    setSelectedMotorista(motorista);
    setIsEditModalOpen(true);
  };

  const handleDelete = (motorista: Motorista) => {
    setSelectedMotorista(motorista);
    setIsDeleteModalOpen(true);
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

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredContratados.map(m => m.motorista_id)));
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
      setContratados(contratados.filter(m => !selectedItems.has(m.motorista_id)));
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

  const handleBulkAction = async (actionType: 'status' | 'client') => {
    setBulkActionType(actionType);
    setIsBulkActionsModalOpen(true);
  };

  const handleMassMessage = () => {
    setIsMassMessageModalOpen(true);
  };

  const handleContextMenu = (e: React.MouseEvent, motorista: Motorista) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      motorista,
    });
  };

  const toggleStatusDropdown = (e: React.MouseEvent, motoristaId: number) => {
    e.stopPropagation();
    if (statusDropdownOpen === motoristaId) {
      setStatusDropdownOpen(null);
    } else {
      setStatusDropdownOpen(motoristaId);
    }
  };

  const toggleClienteDropdown = (e: React.MouseEvent, motoristaId: number) => {
    e.stopPropagation();
    if (clienteDropdownOpen === motoristaId) {
      setClienteDropdownOpen(null);
    } else {
      setClienteDropdownOpen(motoristaId);
    }
  };

  const handleUpdateStatus = async (e: React.MouseEvent, motorista: Motorista, newStatus: string) => {
    e.stopPropagation();
    try {
      setUpdatingStatus(motorista.motorista_id);
      
      // Update the status in the database
      const { error } = await supabase
        .from('motorista')
        .update({ st_cadastro: newStatus })
        .eq('motorista_id', motorista.motorista_id);
        
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
      setStatusDropdownOpen(null);
    }
  };

  const handleUpdateCliente = async (e: React.MouseEvent, motorista: Motorista, clienteId: number | null) => {
    e.stopPropagation();
    try {
      setUpdatingCliente(motorista.motorista_id);
      
      // Update the cliente_id in the database
      const { error } = await supabase
        .from('motorista')
        .update({ cliente_id: clienteId })
        .eq('motorista_id', motorista.motorista_id);
        
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
      setClienteDropdownOpen(null);
    }
  };

  const handleToggleStatus = async (e: React.MouseEvent, motorista: Motorista) => {
    e.stopPropagation();
    try {
      setUpdatingStatus(motorista.motorista_id);
      
      // Update the ativo status in the database (toggle it)
      const newAtivo = !motorista.ativo;
      
      const { error } = await supabase
        .from('motorista')
        .update({ ativo: newAtivo })
        .eq('motorista_id', motorista.motorista_id);
        
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

  const getMotoristaCity = (motorista: MotoristaWithAddress): string | null => {
    return motorista.end_motorista?.[0]?.logradouro?.bairro?.cidade?.cidade || null;
  };

  const getVehicleType = (motorista: MotoristaWithAddress): string | null => {
    return motorista.veiculo && motorista.veiculo.length > 0 ? motorista.veiculo[0].tipologia : null;
  };

  const filteredContratados = contratados.filter(motorista => {
    const searchLower = searchTerm.toLowerCase();
    const statusMatch = statusFilter ? motorista.st_cadastro === statusFilter : true;
    const clienteMatch = clienteFilter ? motorista.cliente_id === parseInt(clienteFilter) : true;
    const cidadeMatch = cidadeFilter ? getMotoristaCity(motorista) === cidadeFilter : true;
    const tipoVeiculoMatch = tipoVeiculoFilter ? 
      (motorista.veiculo && motorista.veiculo.some(v => v.tipologia === tipoVeiculoFilter)) : true;
    const ativoMatch = ativoFilter === '' ? true : 
                      ativoFilter === 'active' ? motorista.ativo === true : 
                      ativoFilter === 'inactive' ? motorista.ativo === false : true;
    
    return (
      statusMatch &&
      clienteMatch &&
      cidadeMatch &&
      tipoVeiculoMatch &&
      ativoMatch &&
      ((motorista.nome && motorista.nome.toLowerCase().includes(searchLower)) ||
       (motorista.cpf && motorista.cpf.includes(searchLower)) ||
       (typeof motorista.email === 'string' && motorista.email.toLowerCase().includes(searchLower)) ||
       (typeof motorista.telefone === 'number' && motorista.telefone.toString().includes(searchLower)))
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
            <input
              type="text"
              placeholder="Buscar por nome, CPF, email ou telefone..."
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
              value={ativoFilter}
              onChange={(e) => setAtivoFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none"
            >
              <option value="">Todos (Ativos/Inativos)</option>
              <option value="active">Somente Ativos</option>
              <option value="inactive">Somente Inativos</option>
            </select>
            <User className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <ChevronDown className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
        </div>
        
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
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

          <div className="relative">
            <select
              value={tipoVeiculoFilter}
              onChange={(e) => setTipoVeiculoFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none"
            >
              <option value="">Todos os tipos de veículo</option>
              {tiposVeiculo.map((tipo, index) => (
                <option key={index} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
            <Truck className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <ChevronDown className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
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
                  {paginatedData.map((motorista) => (
                    <tr 
                      key={motorista.motorista_id} 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                        selectedItems.has(motorista.motorista_id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                      onContextMenu={(e) => handleContextMenu(e, motorista)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
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
                            {motorista.funcao === 'Motorista' ? (
                              <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            ) : (
                              <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {motorista.nome}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {motorista.funcao}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {formatCPF(motorista.cpf)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {motorista.telefone ? formatPhone(motorista.telefone.toString()) : '-'}
                          </div>
                          {motorista.telefone && (
                            <button
                              onClick={() => startChat(motorista.telefone.toString(), motorista.nome)}
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
                          <button
                            onClick={(e) => toggleStatusDropdown(e, motorista.motorista_id)}
                            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
                                     hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors
                                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                                     dark:focus:ring-offset-gray-800"
                          >
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              motorista.st_cadastro === 'contratado' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200' :
                              motorista.st_cadastro === 'rejeitado' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200' :
                              motorista.st_cadastro === 'documentacao' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200' :
                              motorista.st_cadastro === 'qualificado' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200' :
                              motorista.st_cadastro === 'contrato_enviado' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200' :
                              motorista.st_cadastro === 'repescagem' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {motorista.st_cadastro === 'contrato_enviado' ? 'Contrato Enviado' : 
                               motorista.st_cadastro.charAt(0).toUpperCase() + motorista.st_cadastro.slice(1)}
                            </span>
                            <ChevronDown size={14} className="text-gray-500 dark:text-gray-400" />
                          </button>
                          
                          {statusDropdownOpen === motorista.motorista_id && (
                            <div 
                              className="absolute left-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 border border-gray-200 dark:border-gray-700"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="py-1">
                                <button
                                  onClick={(e) => handleUpdateStatus(e, motorista, 'cadastrado')}
                                  className={`block w-full text-left px-4 py-2 text-sm ${
                                    motorista.st_cadastro === 'cadastrado' 
                                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' 
                                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                  }`}
                                >
                                  Cadastrado
                                </button>
                                <button
                                  onClick={(e) => handleUpdateStatus(e, motorista, 'qualificado')}
                                  className={`block w-full text-left px-4 py-2 text-sm ${
                                    motorista.st_cadastro === 'qualificado' 
                                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' 
                                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                  }`}
                                >
                                  Qualificado
                                </button>
                                <button
                                  onClick={(e) => handleUpdateStatus(e, motorista, 'documentacao')}
                                  className={`block w-full text-left px-4 py-2 text-sm ${
                                    motorista.st_cadastro === 'documentacao' 
                                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' 
                                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                  }`}
                                >
                                  Documentação
                                </button>
                                <button
                                  onClick={(e) => handleUpdateStatus(e, motorista, 'contrato_enviado')}
                                  className={`block w-full text-left px-4 py-2 text-sm ${
                                    motorista.st_cadastro === 'contrato_enviado' 
                                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' 
                                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                  }`}
                                >
                                  Contrato Enviado
                                </button>
                                <button
                                  onClick={(e) => handleUpdateStatus(e, motorista, 'contratado')}
                                  className={`block w-full text-left px-4 py-2 text-sm ${
                                    motorista.st_cadastro === 'contratado' 
                                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' 
                                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                  }`}
                                >
                                  Contratado
                                </button>
                                <button
                                  onClick={(e) => handleUpdateStatus(e, motorista, 'repescagem')}
                                  className={`block w-full text-left px-4 py-2 text-sm ${
                                    motorista.st_cadastro === 'repescagem' 
                                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' 
                                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                  }`}
                                >
                                  Repescagem
                                </button>
                                <button
                                  onClick={(e) => handleUpdateStatus(e, motorista, 'rejeitado')}
                                  className={`block w-full text-left px-4 py-2 text-sm ${
                                    motorista.st_cadastro === 'rejeitado' 
                                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' 
                                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                  }`}
                                >
                                  Rejeitado
                                </button>
                              </div>
                            </div>
                          )}
                          
                          {updatingStatus === motorista.motorista_id && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 rounded-full">
                              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="relative">
                          <button
                            onClick={(e) => toggleClienteDropdown(e, motorista.motorista_id)}
                            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
                                     hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors
                                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                                     dark:focus:ring-offset-gray-800 text-left w-full"
                          >
                            <span className="truncate max-w-[150px]">
                              {motorista.cliente?.nome || 'Sem cliente'}
                            </span>
                            <ChevronDown size={14} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
                          </button>
                          
                          {clienteDropdownOpen === motorista.motorista_id && (
                            <div 
                              className="absolute left-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 border border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="py-1">
                                <button
                                  onClick={(e) => handleUpdateCliente(e, motorista, null)}
                                  className={`block w-full text-left px-4 py-2 text-sm ${
                                    !motorista.cliente_id
                                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' 
                                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                  }`}
                                >
                                  Sem cliente
                                </button>
                                
                                {clientes.map(cliente => (
                                  <button
                                    key={cliente.cliente_id}
                                    onClick={(e) => handleUpdateCliente(e, motorista, cliente.cliente_id)}
                                    className={`block w-full text-left px-4 py-2 text-sm truncate ${
                                      motorista.cliente_id === cliente.cliente_id
                                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' 
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`}
                                  >
                                    {cliente.nome}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          
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
                        <div className="text-sm text-gray-900 dark:text-white">
                          {motorista.veiculo && motorista.veiculo.length > 0 ? (
                            <div>
                              <div className="font-medium">{motorista.veiculo[0].placa.toUpperCase()}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {motorista.veiculo[0].tipologia}
                              </div>
                            </div>
                          ) : (
                            '-'
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {formatDate(motorista.data_cadastro)}
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
        
        {filteredContratados.length === 0 ? (
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
              icon: <User size={16} />,
              label: 'Visualizar Detalhes',
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
              onClick: () => startChat(contextMenu.motorista!.telefone?.toString() || '', contextMenu.motorista!.nome),
              color: 'text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300',
              disabled: !contextMenu.motorista!.telefone
            }
          ]}
        />
      )}

      {/* Modals */}
      <UnifiedMotoristaModal
        isOpen={isUnifiedModalOpen}
        onClose={() => setIsUnifiedModalOpen(false)}
        motorista={selectedMotorista}
        onSuccess={fetchContratados}
      />

      <DocumentViewer
        isOpen={isDocumentViewerOpen}
        onClose={() => setIsDocumentViewerOpen(false)}
        documento={documento}
        nome={selectedMotorista?.nome || ''}
        cpf={selectedMotorista?.cpf}
        email={selectedMotorista?.email}
        telefone={selectedMotorista?.telefone?.toString()}
        dt_nascimento={selectedMotorista?.dt_nascimento}
        endereco={endereco}
        st_cadastro={selectedMotorista?.st_cadastro}
      />

      <DocumentUploadModal
        isOpen={isDocumentUploadOpen}
        onClose={() => setIsDocumentUploadOpen(false)}
        motorista_id={selectedMotorista?.motorista_id || 0}
        nome={selectedMotorista?.nome || ''}
        onUploadSuccess={fetchContratados}
      />

      <EditMotoristaModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        motorista={selectedMotorista}
        onUpdate={fetchContratados}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este motorista? Esta ação não pode ser desfeita."
        itemData={selectedMotorista ? [
          { label: 'Nome', value: selectedMotorista.nome },
          { label: 'CPF', value: formatCPF(selectedMotorista.cpf) },
          { label: 'Status', value: selectedMotorista.st_cadastro }
        ] : []}
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
            return motorista?.telefone ? motorista.telefone.toString() : '';
          })
          .filter(Boolean)}
      />
    </div>
  );
};

export default Contratados;