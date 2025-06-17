import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Trash2, Edit2, FileText, MessageCircle, Filter, ChevronDown, X, CheckCircle2, XCircle, MoreHorizontal, Truck, User } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import type { Motorista, DocumentoMotorista, Veiculo, DocumentoVeiculo } from '../../types/database';
import AddAgregadoModal from '../../components/AddAgregadoModal';
import EditMotoristaModal from '../../components/EditMotoristaModal';
import DocumentViewer from '../../components/DocumentViewer';
import DocumentUploadModal from '../../components/DocumentUploadModal';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import BulkActionsModal from '../../components/BulkActionsModal';
import BulkStatusModal from '../../components/BulkStatusModal';
import BulkDeleteConfirmationModal from '../../components/BulkDeleteConfirmationModal';
import MassMessageModal from '../../components/MassMessageModal';
import toast from 'react-hot-toast';
import { formatCPF, formatPhone, formatDate } from '../../utils/format';
import { useFloatingChat } from '../../hooks/useFloatingChat';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import ContextMenu from '../../components/ContextMenu';
import AgregadoDetailView from '../../components/AgregadoDetailView';
import UnifiedAgregadoModal from '../../components/UnifiedAgregadoModal';

interface AgregadoWithDetails extends Motorista {
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
  veiculo?: (Veiculo & {
    documento_veiculo: (DocumentoVeiculo & {
      pessoa_fisica_dono_veiculo?: any;
      pessoa_juridica_dono_veiculo?: any;
    })[];
  }) | null;
  documento?: DocumentoMotorista | null;
}

const AgregadosLista = () => {
  const { query, companyId } = useCompanyData();
  const { startChat } = useFloatingChat();
  const [agregados, setAgregados] = useState<AgregadoWithDetails[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [clienteFilter, setClienteFilter] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [isDocumentUploadOpen, setIsDocumentUploadOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkActionsModalOpen, setIsBulkActionsModalOpen] = useState(false);
  const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isMassMessageModalOpen, setIsMassMessageModalOpen] = useState(false);
  const [selectedAgregado, setSelectedAgregado] = useState<AgregadoWithDetails | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'status' | 'client'>('status');
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Motorista;
    direction: 'asc' | 'desc';
  }>({ key: 'nome', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  const [isUnifiedModalOpen, setIsUnifiedModalOpen] = useState(false);
  
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    agregado: AgregadoWithDetails | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    agregado: null,
  });

  useEffect(() => {
    fetchAgregados();
    fetchClientes();
  }, [statusFilter, clienteFilter, currentPage, itemsPerPage, sortConfig]);

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

  const fetchAgregados = async () => {
    try {
      setLoading(true);
      
      // Calculate pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      
      // Build query with filters
      let query = supabase
        .from('motorista')
        .select(`
          *,
          cliente:cliente_id (
            cliente_id,
            nome
          )
        `, { count: 'exact' })
        .eq('company_id', companyId)
        .eq('funcao', 'Agregado');
      
      // Apply status filter if selected
      if (statusFilter) {
        query = query.eq('st_cadastro', statusFilter);
      }
      
      // Apply client filter if selected
      if (clienteFilter) {
        query = query.eq('cliente_id', clienteFilter);
      }
      
      // Apply search filter if provided
      if (searchTerm) {
        query = query.or(`nome.ilike.%${searchTerm}%,cpf.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }
      
      // Apply sorting
      query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'asc' });
      
      // Apply pagination
      query = query.range(from, to);
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      // Calculate total pages
      const total = count || 0;
      setTotalPages(Math.ceil(total / itemsPerPage));
      
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

  const handleEdit = (agregado: AgregadoWithDetails) => {
    setSelectedAgregado(agregado);
    setIsEditModalOpen(true);
  };

  const handleViewDocument = async (agregado: AgregadoWithDetails) => {
    try {
      setSelectedAgregado(agregado);
      setIsDocumentViewerOpen(true);

      // Fetch additional details only when viewing documents
      const [documentoResponse, enderecoResponse, veiculoResponse] = await Promise.all([
        supabase
          .from('documento_motorista')
          .select('*')
          .eq('motorista_id', agregado.motorista_id)
          .maybeSingle(),
        supabase
          .from('end_motorista')
          .select(`
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
          `)
          .eq('id_motorista', agregado.motorista_id)
          .maybeSingle(),
        supabase
          .from('veiculo')
          .select(`
            *,
            documento_veiculo (
              *,
              pessoa_fisica_dono_veiculo (*),
              pessoa_juridica_dono_veiculo (*)
            )
          `)
          .eq('motorista_id', agregado.motorista_id)
          .eq('status_veiculo', true)
          .maybeSingle()
      ]);

      if (documentoResponse.error) throw documentoResponse.error;
      if (enderecoResponse.error) throw enderecoResponse.error;
      if (veiculoResponse.error) throw veiculoResponse.error;

      setSelectedAgregado({
        ...agregado,
        documento: documentoResponse.data,
        endereco: enderecoResponse.data,
        veiculo: veiculoResponse.data
      });
    } catch (error) {
      console.error('Error fetching document details:', error);
      toast.error('Erro ao carregar detalhes do documento');
    }
  };

  const handleUploadDocument = (agregado: AgregadoWithDetails) => {
    setSelectedAgregado(agregado);
    setIsDocumentUploadOpen(true);
  };

  const handleDelete = (agregado: AgregadoWithDetails) => {
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

  const handleStartChat = (agregado: AgregadoWithDetails, e: React.MouseEvent) => {
    e.stopPropagation();
    if (agregado.telefone) {
      startChat(agregado.telefone.toString(), agregado.nome);
    } else {
      toast.error('Este agregado não possui telefone cadastrado');
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

  const handleBulkAction = async (actionType: 'status' | 'client') => {
    setBulkActionType(actionType);
    setIsBulkActionsModalOpen(true);
  };

  const handleBulkStatus = () => {
    setIsBulkStatusModalOpen(true);
  };

  const handleBulkDelete = () => {
    setIsBulkDeleteModalOpen(true);
  };

  const handleMassMessage = () => {
    setIsMassMessageModalOpen(true);
  };

  const handleBulkStatusUpdate = async (activate: boolean) => {
    try {
      // Update status for all selected items
      for (const id of selectedItems) {
        const { error } = await query('motorista')
          .update({ st_cadastro: activate ? 'contratado' : 'rejeitado' })
          .eq('motorista_id', id);
          
        if (error) throw error;
      }
      
      // Refresh the list
      fetchAgregados();
      
      toast.success(`Status atualizado para ${selectedItems.size} agregado${selectedItems.size !== 1 ? 's' : ''}`);
      setIsBulkStatusModalOpen(false);
      setSelectedItems(new Set());
      setSelectAll(false);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const handleBulkDeleteConfirm = async () => {
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

  const handleSort = (key: keyof Motorista) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleContextMenu = (e: React.MouseEvent, agregado: AgregadoWithDetails) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      agregado,
    });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (size: number) => {
    setItemsPerPage(size);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  const handleViewDetails = async (agregado: AgregadoWithDetails) => {
    try {
      setSelectedAgregado(agregado);
      
      // Fetch additional details
      const [documentoResponse, enderecoResponse, veiculoResponse] = await Promise.all([
        supabase
          .from('documento_motorista')
          .select('*')
          .eq('motorista_id', agregado.motorista_id)
          .maybeSingle(),
        supabase
          .from('end_motorista')
          .select(`
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
          `)
          .eq('id_motorista', agregado.motorista_id)
          .maybeSingle(),
        supabase
          .from('veiculo')
          .select(`
            *,
            documento_veiculo (
              *,
              pessoa_fisica_dono_veiculo (*),
              pessoa_juridica_dono_veiculo (*)
            )
          `)
          .eq('motorista_id', agregado.motorista_id)
          .eq('status_veiculo', true)
          .maybeSingle()
      ]);

      if (documentoResponse.error) throw documentoResponse.error;
      if (enderecoResponse.error) throw enderecoResponse.error;
      if (veiculoResponse.error) throw veiculoResponse.error;

      setSelectedAgregado({
        ...agregado,
        documento: documentoResponse.data,
        endereco: enderecoResponse.data,
        veiculo: veiculoResponse.data
      });
      
      setIsDetailViewOpen(true);
    } catch (error) {
      console.error('Error fetching agregado details:', error);
      toast.error('Erro ao carregar detalhes do agregado');
    }
  };

  const handleOpenUnifiedModal = (agregado: AgregadoWithDetails) => {
    setSelectedAgregado(agregado);
    setIsUnifiedModalOpen(true);
  };

  const filteredAgregados = agregados.filter(agregado => {
    const searchString = searchTerm.toLowerCase();
    return (
      agregado.nome.toLowerCase().includes(searchString) ||
      agregado.cpf.includes(searchString) ||
      (agregado.email && agregado.email.toLowerCase().includes(searchString))
    );
  });

  const paginatedAgregados = filteredAgregados;

  if (loading && currentPage === 1) {
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
                onClick={() => handleBulkAction('client')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                        transition-colors flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                Atribuir Cliente
              </button>
              <button
                onClick={() => handleBulkAction('status')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                        transition-colors flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                  <path d="m9 12 2 2 4-4"></path>
                </svg>
                Atualizar Status
              </button>
              <button
                onClick={handleBulkStatus}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                        transition-colors flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
                  <path d="m9 12 2 2 4-4"></path>
                </svg>
                Ativar/Desativar
              </button>
              <button
                onClick={handleMassMessage}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                        transition-colors flex items-center gap-2"
              >
                <MessageCircle size={20} />
                Enviar Mensagem
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 
                        focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 
                        transition-colors flex items-center gap-2"
              >
                <Trash2 size={20} />
                Excluir
              </button>
            </>
          )}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                     transition-colors flex items-center gap-2"
          >
            <Plus size={20} />
            Novo Agregado
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por nome, CPF ou email..."
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
            <Filter className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <ChevronDown className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
        </div>
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
                      <div className="flex items-center">
                        Nome
                        {sortConfig.key === 'nome' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">CPF</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Contato</th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800 cursor-pointer"
                      onClick={() => handleSort('data_cadastro')}
                    >
                      <div className="flex items-center">
                        Data Cadastro
                        {sortConfig.key === 'data_cadastro' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedAgregados.map((agregado) => (
                    <tr 
                      key={agregado.motorista_id} 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                        selectedItems.has(agregado.motorista_id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                      onContextMenu={(e) => handleContextMenu(e, agregado)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(agregado.motorista_id)}
                          onChange={() => handleSelectItem(agregado.motorista_id)}
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
                              {agregado.nome}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {agregado.funcao}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {formatCPF(agregado.cpf)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {agregado.telefone ? formatPhone(agregado.telefone.toString()) : '-'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {agregado.email || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {agregado.data_cadastro ? formatDate(agregado.data_cadastro) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {agregado.cliente?.nome || 'Sem cliente'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-medium rounded-full ${
                          agregado.st_cadastro === 'contratado'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                            : agregado.st_cadastro === 'rejeitado'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200'
                        }`}>
                          {agregado.st_cadastro.charAt(0).toUpperCase() + agregado.st_cadastro.slice(1).replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-3">
                          <button
                            onClick={(e) => handleStartChat(agregado, e)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            title="Iniciar chat"
                          >
                            <MessageCircle size={18} />
                          </button>
                          <button
                            onClick={() => handleOpenUnifiedModal(agregado)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            title="Visualizar e Editar"
                          >
                            <Truck size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(agregado)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4 sm:mb-0">
            <span>
              Mostrando <span className="font-medium">{Math.min((currentPage - 1) * itemsPerPage + 1, filteredAgregados.length)}</span> a{' '}
              <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredAgregados.length)}</span> de{' '}
              <span className="font-medium">{filteredAgregados.length}</span> resultados
            </span>
            
            <div className="ml-4">
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value={10}>10 por página</option>
                <option value={25}>25 por página</option>
                <option value={50}>50 por página</option>
                <option value={100}>100 por página</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-2 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Anterior
            </button>
            
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <button
                  key={i}
                  onClick={() => handlePageChange(pageNum)}
                  className={`px-3 py-1 text-sm font-medium rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                    pageNum === currentPage
                      ? 'bg-blue-600 text-white border border-blue-600 dark:bg-blue-700 dark:border-blue-700'
                      : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-2 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Próximo
            </button>
          </div>
        </div>
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
              label: 'Visualizar e Editar',
              onClick: () => handleOpenUnifiedModal(contextMenu.agregado!),
              color: 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300'
            },
            {
              icon: <MessageCircle size={16} />,
              label: 'Iniciar Chat',
              onClick: (e) => handleStartChat(contextMenu.agregado!, e as unknown as React.MouseEvent),
              color: 'text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300',
              disabled: !contextMenu.agregado?.telefone
            },
            {
              icon: <Trash2 size={16} />,
              label: 'Excluir Agregado',
              onClick: () => handleDelete(contextMenu.agregado!),
              color: 'text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300'
            }
          ]}
        />
      )}

      {/* Modals */}
      <AddAgregadoModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchAgregados}
      />

      <EditMotoristaModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        motorista={selectedAgregado}
        onUpdate={fetchAgregados}
      />

      <DocumentViewer
        isOpen={isDocumentViewerOpen}
        onClose={() => setIsDocumentViewerOpen(false)}
        documento={selectedAgregado?.documento || null}
        nome={selectedAgregado?.nome || ''}
        cpf={selectedAgregado?.cpf}
        email={selectedAgregado?.email}
        telefone={selectedAgregado?.telefone?.toString()}
        dt_nascimento={selectedAgregado?.dt_nascimento}
        endereco={selectedAgregado?.endereco}
        veiculo={selectedAgregado?.veiculo}
        isAgregado={true}
        st_cadastro={selectedAgregado?.st_cadastro}
      />

      <DocumentUploadModal
        isOpen={isDocumentUploadOpen}
        onClose={() => setIsDocumentUploadOpen(false)}
        motorista_id={selectedAgregado?.motorista_id || 0}
        nome={selectedAgregado?.nome || ''}
        onUploadSuccess={fetchAgregados}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este agregado? Esta ação não pode ser desfeita."
        itemData={selectedAgregado ? [
          { label: 'Nome', value: selectedAgregado.nome },
          { label: 'CPF', value: formatCPF(selectedAgregado.cpf) },
          { label: 'Status', value: selectedAgregado.st_cadastro.charAt(0).toUpperCase() + selectedAgregado.st_cadastro.slice(1).replace('_', ' ') }
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

      <BulkStatusModal
        isOpen={isBulkStatusModalOpen}
        onClose={() => setIsBulkStatusModalOpen(false)}
        onConfirm={handleBulkStatusUpdate}
        title="Atualizar Status em Massa"
        message="Escolha se deseja ativar ou desativar os agregados selecionados."
        itemCount={selectedItems.size}
        itemType="agregado"
      />

      <BulkDeleteConfirmationModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
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

      <AgregadoDetailView
        isOpen={isDetailViewOpen}
        onClose={() => setIsDetailViewOpen(false)}
        agregado={selectedAgregado}
        documento={selectedAgregado?.documento || null}
        veiculo={selectedAgregado?.veiculo || null}
        endereco={selectedAgregado?.endereco}
      />

      <UnifiedAgregadoModal
        isOpen={isUnifiedModalOpen}
        onClose={() => setIsUnifiedModalOpen(false)}
        agregado={selectedAgregado}
        onSuccess={fetchAgregados}
      />
    </div>
  );
};

export default AgregadosLista;