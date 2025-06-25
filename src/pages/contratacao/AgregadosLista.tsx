import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Edit2, Trash2, Filter, ChevronDown, ChevronUp, FileText, MessageCircle, Users } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Motorista, Veiculo } from '../../types/database';
import toast from 'react-hot-toast';
import { formatCPF, formatPhone } from '../../utils/format';
import { useFloatingChat } from '../../hooks/useFloatingChat';
import AddAgregadoModal from '../../components/AddAgregadoModal';
import AgregadoDetailView from '../../components/AgregadoDetailView';
import DocumentViewer from '../../components/DocumentViewer';
import BulkActionsModal from '../../components/BulkActionsModal';
import BulkDeleteConfirmationModal from '../../components/BulkDeleteConfirmationModal';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import MassMessageModal from '../../components/MassMessageModal';
import LoadingSpinner from '../../components/LoadingSpinner';
import { usePagination } from '../../hooks/usePagination';
import Pagination from '../../components/Pagination';
import ContextMenu from '../../components/ContextMenu';
import UnifiedAgregadoModal from '../../components/UnifiedAgregadoModal';

interface AgregadoWithDetails extends Motorista {
  veiculo?: (Veiculo & {
    documento_veiculo: any[];
  })[];
  documento_motorista?: any[];
  endereco?: any;
  ajudantes?: any[];
  isExpanded?: boolean;
}

const AgregadosLista = () => {
  const { query, companyId } = useCompanyData();
  const { startChat } = useFloatingChat();
  const { accountId } = useAuth();
  const [agregados, setAgregados] = useState<AgregadoWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [clienteFilter, setClienteFilter] = useState<string>('todos');
  const [clientes, setClientes] = useState<any[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [isUnifiedModalOpen, setIsUnifiedModalOpen] = useState(false);
  const [selectedAgregado, setSelectedAgregado] = useState<AgregadoWithDetails | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false);
  const [isBulkClientModalOpen, setIsBulkClientModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMassMessageModalOpen, setIsMassMessageModalOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof AgregadoWithDetails;
    direction: 'asc' | 'desc';
  }>({ key: 'data_cadastro', direction: 'desc' });
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

  const fetchAgregados = async () => {
    try {
      setLoading(true);
      
      // Fetch agregados with their vehicles and documents
      const { data, error } = await supabase
        .from('vw_agregados_completo')
        .select(`
          *,
          veiculo:veiculo_id (
            *,
            documento_veiculo (*)
          ),
          documento_motorista:motorista_id (
            *
          ),
          end_motorista:motorista_id (
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
          documento_ajudante:motorista_id (
            id_ajudante,
            nome,
            cpf,
            telefone
          )
        `)
        .eq('company_id', companyId);

      if (error) throw error;

      // Format the data
      const formattedData = data?.map(agregado => ({
        ...agregado,
        veiculo: Array.isArray(agregado.veiculo) ? agregado.veiculo : (agregado.veiculo ? [agregado.veiculo] : []),
        documento_motorista: Array.isArray(agregado.documento_motorista) ? agregado.documento_motorista : (agregado.documento_motorista ? [agregado.documento_motorista] : []),
        endereco: agregado.end_motorista,
        ajudantes: Array.isArray(agregado.documento_ajudante) ? agregado.documento_ajudante : (agregado.documento_ajudante ? [agregado.documento_ajudante] : [])
      })) || [];

      setAgregados(formattedData);
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
        .select('cliente_id, nome')
        .eq('st_cliente', true);

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error('Error fetching clientes:', error);
      toast.error('Erro ao carregar clientes');
    }
  };

  const handleSort = (key: keyof AgregadoWithDetails) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
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

  const handleBulkStatusUpdate = async (newStatus: string) => {
    try {
      // Update status for all selected items
      for (const id of selectedItems) {
        const { error } = await query('motorista')
          .update({ st_cadastro: newStatus })
          .eq('motorista_id', id);
          
        if (error) throw error;
      }
      
      // Update the list
      setAgregados(agregados.map(a => 
        selectedItems.has(a.motorista_id) ? { ...a, st_cadastro: newStatus } : a
      ));
      
      toast.success(`Status atualizado para ${selectedItems.size} agregado${selectedItems.size !== 1 ? 's' : ''}`);
      
      // Reset selection
      setSelectedItems(new Set());
      setSelectAll(false);
      setIsBulkStatusModalOpen(false);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const handleBulkClientUpdate = async (clienteId: string) => {
    try {
      // Update client for all selected items
      for (const id of selectedItems) {
        const { error } = await query('motorista')
          .update({ cliente_id: clienteId ? parseInt(clienteId) : null })
          .eq('motorista_id', id);
          
        if (error) throw error;
      }
      
      // Update the list
      setAgregados(agregados.map(a => 
        selectedItems.has(a.motorista_id) ? { ...a, cliente_id: clienteId ? parseInt(clienteId) : null } : a
      ));
      
      toast.success(`Cliente atualizado para ${selectedItems.size} agregado${selectedItems.size !== 1 ? 's' : ''}`);
      
      // Reset selection
      setSelectedItems(new Set());
      setSelectAll(false);
      setIsBulkClientModalOpen(false);
    } catch (error) {
      console.error('Error updating client:', error);
      toast.error('Erro ao atualizar cliente');
    }
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

  const handleViewDetails = (agregado: AgregadoWithDetails) => {
    setSelectedAgregado(agregado);
    setIsDetailViewOpen(true);
  };

  const handleViewDocuments = (agregado: AgregadoWithDetails) => {
    setSelectedAgregado(agregado);
    setIsDocumentViewerOpen(true);
  };

  const handleViewUnified = (agregado: AgregadoWithDetails) => {
    setSelectedAgregado(agregado);
    setIsUnifiedModalOpen(true);
  };

  const handleStartChat = (agregado: AgregadoWithDetails) => {
    if (agregado.telefone) {
      startChat(agregado.telefone.toString(), agregado.nome);
    } else {
      toast.error('Este agregado não possui telefone cadastrado');
    }
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

  const toggleExpand = (id: number) => {
    setAgregados(prevAgregados => 
      prevAgregados.map(agregado => 
        agregado.motorista_id === id 
          ? { ...agregado, isExpanded: !agregado.isExpanded } 
          : agregado
      )
    );
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'cadastrado':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200';
      case 'qualificado':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200';
      case 'documentacao':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200';
      case 'gr':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-200';
      case 'contrato_enviado':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-200';
      case 'contratado':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200';
      case 'repescagem':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200';
      case 'rejeitado':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'cadastrado':
        return 'Cadastrado';
      case 'qualificado':
        return 'Qualificado';
      case 'documentacao':
        return 'Documentação';
      case 'gr':
        return 'GR';
      case 'contrato_enviado':
        return 'Contrato Enviado';
      case 'contratado':
        return 'Contratado';
      case 'repescagem':
        return 'Repescagem';
      case 'rejeitado':
        return 'Rejeitado';
      default:
        return status;
    }
  };

  const filteredAgregados = agregados
    .filter(agregado => {
      // Apply status filter
      if (statusFilter !== 'todos' && agregado.st_cadastro !== statusFilter) {
        return false;
      }
      
      // Apply client filter
      if (clienteFilter !== 'todos') {
        if (clienteFilter === 'sem_cliente') {
          if (agregado.cliente_id) return false;
        } else {
          if (agregado.cliente_id !== parseInt(clienteFilter)) return false;
        }
      }
      
      // Apply search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          agregado.nome.toLowerCase().includes(searchLower) ||
          (agregado.cpf && agregado.cpf.includes(searchTerm)) ||
          (agregado.telefone && agregado.telefone.toString().includes(searchTerm)) ||
          (agregado.email && agregado.email.toLowerCase().includes(searchLower)) ||
          (agregado.veiculo && agregado.veiculo.some(v => 
            v.placa.toLowerCase().includes(searchLower) ||
            (v.marca && v.marca.toLowerCase().includes(searchLower)) ||
            (v.tipo && v.tipo.toLowerCase().includes(searchLower))
          ))
        );
      }
      
      return true;
    })
    .sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
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
    return (
      <LoadingSpinner />
    );
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
                onClick={() => setIsBulkStatusModalOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                        transition-colors flex items-center gap-2"
              >
                <Edit2 className="w-5 h-5" />
                Atualizar Status
              </button>
              <button
                onClick={() => setIsBulkClientModalOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                        transition-colors flex items-center gap-2"
              >
                <Users className="w-5 h-5" />
                Atualizar Cliente
              </button>
              <button
                onClick={() => setIsMassMessageModalOpen(true)}
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
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                     transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Adicionar Agregado
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative w-full md:w-auto flex-1">
            <input
              type="text"
              placeholder="Buscar por nome, CPF, telefone, email ou placa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>

          <div className="flex gap-4">
            <div className="w-full md:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="todos">Todos os status</option>
                <option value="cadastrado">Cadastrado</option>
                <option value="qualificado">Qualificado</option>
                <option value="documentacao">Documentação</option>
                <option value="gr">GR</option>
                <option value="contrato_enviado">Contrato Enviado</option>
                <option value="contratado">Contratado</option>
                <option value="repescagem">Repescagem</option>
                <option value="rejeitado">Rejeitado</option>
              </select>
            </div>

            <div className="w-full md:w-48">
              <select
                value={clienteFilter}
                onChange={(e) => setClienteFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="todos">Todos os clientes</option>
                <option value="sem_cliente">Sem cliente</option>
                {clientes.map(cliente => (
                  <option key={cliente.cliente_id} value={cliente.cliente_id}>
                    {cliente.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('nome')}
                >
                  <div className="flex items-center">
                    Nome
                    {sortConfig.key === 'nome' && (
                      sortConfig.direction === 'asc' ? 
                        <ChevronUp className="ml-1 h-4 w-4" /> : 
                        <ChevronDown className="ml-1 h-4 w-4" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Contato
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Veículo
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('data_cadastro')}
                >
                  <div className="flex items-center">
                    Data Cadastro
                    {sortConfig.key === 'data_cadastro' && (
                      sortConfig.direction === 'asc' ? 
                        <ChevronUp className="ml-1 h-4 w-4" /> : 
                        <ChevronDown className="ml-1 h-4 w-4" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedData.map((agregado) => (
                <React.Fragment key={agregado.motorista_id}>
                  <tr 
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
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap" onClick={() => toggleExpand(agregado.motorista_id)}>
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <span className="text-lg font-medium text-blue-600 dark:text-blue-400">
                            {agregado.nome.charAt(0)}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {agregado.nome}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {agregado.cpf && formatCPF(agregado.cpf)}
                          </div>
                          {agregado.ajudantes && agregado.ajudantes.length > 0 && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Ajudante: {agregado.ajudantes[0].nome}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap" onClick={() => toggleExpand(agregado.motorista_id)}>
                      <div className="text-sm text-gray-900 dark:text-white">
                        {agregado.telefone && formatPhone(agregado.telefone.toString())}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {agregado.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap" onClick={() => toggleExpand(agregado.motorista_id)}>
                      {agregado.veiculo && agregado.veiculo.length > 0 ? (
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {agregado.veiculo[0].placa.toUpperCase()}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {agregado.veiculo[0].marca} {agregado.veiculo[0].tipo}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Sem veículo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap" onClick={() => toggleExpand(agregado.motorista_id)}>
                      <div className="text-sm text-gray-900 dark:text-white">
                        {agregado.data_cadastro ? new Date(agregado.data_cadastro).toLocaleDateString('pt-BR') : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap" onClick={() => toggleExpand(agregado.motorista_id)}>
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(agregado.st_cadastro)}`}>
                        {getStatusLabel(agregado.st_cadastro)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap" onClick={() => toggleExpand(agregado.motorista_id)}>
                      <div className="text-sm text-gray-900 dark:text-white">
                        {agregado.cliente?.nome || 'Sem cliente'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-3">
                        <button
                          onClick={() => handleStartChat(agregado)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                          title="Iniciar chat"
                        >
                          <MessageCircle size={18} />
                        </button>
                        <button
                          onClick={() => handleViewUnified(agregado)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                          title="Visualizar detalhes"
                        >
                          <FileText size={18} />
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
                  {agregado.isExpanded && (
                    <tr className="bg-gray-50 dark:bg-gray-700/30">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Informações Pessoais</h4>
                            <div className="space-y-1">
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                <span className="font-medium">Nome:</span> {agregado.nome}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                <span className="font-medium">CPF:</span> {agregado.cpf && formatCPF(agregado.cpf)}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                <span className="font-medium">Telefone:</span> {agregado.telefone && formatPhone(agregado.telefone.toString())}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                <span className="font-medium">Email:</span> {agregado.email || 'Não informado'}
                              </p>
                              {agregado.ajudantes && agregado.ajudantes.length > 0 && (
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  <span className="font-medium">Ajudante:</span> {agregado.ajudantes[0].nome}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Veículo</h4>
                            {agregado.veiculo && agregado.veiculo.length > 0 ? (
                              <div className="space-y-1">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  <span className="font-medium">Placa:</span> {agregado.veiculo[0].placa.toUpperCase()}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  <span className="font-medium">Marca/Modelo:</span> {agregado.veiculo[0].marca} {agregado.veiculo[0].tipo}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  <span className="font-medium">Ano:</span> {agregado.veiculo[0].ano || 'Não informado'}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  <span className="font-medium">Tipologia:</span> {agregado.veiculo[0].tipologia || 'Não informada'}
                                </p>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum veículo cadastrado</p>
                            )}
                          </div>
                          
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Endereço</h4>
                            {agregado.endereco ? (
                              <div className="space-y-1">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  <span className="font-medium">Logradouro:</span> {agregado.endereco.logradouro?.logradouro || 'Não informado'}
                                  {agregado.endereco.nr_end ? `, ${agregado.endereco.nr_end}` : ''}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  <span className="font-medium">Complemento:</span> {agregado.endereco.ds_complemento_end || 'Não informado'}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  <span className="font-medium">Bairro:</span> {agregado.endereco.logradouro?.bairro?.bairro || 'Não informado'}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  <span className="font-medium">Cidade/UF:</span> {agregado.endereco.logradouro?.bairro?.cidade?.cidade || 'Não informada'}/{agregado.endereco.logradouro?.bairro?.cidade?.estado?.sigla_estado || ''}
                                </p>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum endereço cadastrado</p>
                            )}
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
              icon: <FileText size={16} />,
              label: 'Ver Detalhes',
              onClick: () => handleViewUnified(contextMenu.agregado!),
              color: 'text-blue-600 dark:text-blue-400'
            },
            {
              icon: <MessageCircle size={16} />,
              label: 'Iniciar Chat',
              onClick: () => handleStartChat(contextMenu.agregado!),
              color: 'text-green-600 dark:text-green-400',
              disabled: !contextMenu.agregado!.telefone
            },
            {
              icon: <Trash2 size={16} />,
              label: 'Excluir',
              onClick: () => handleDelete(contextMenu.agregado!),
              color: 'text-red-600 dark:text-red-400'
            }
          ]}
        />
      )}

      <AddAgregadoModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchAgregados}
      />

      <AgregadoDetailView
        isOpen={isDetailViewOpen}
        onClose={() => setIsDetailViewOpen(false)}
        agregado={selectedAgregado}
        onSuccess={fetchAgregados}
        documento={selectedAgregado?.documento_motorista?.[0] || null}
        veiculo={selectedAgregado?.veiculo?.[0] || null}
        endereco={selectedAgregado?.endereco || null}
        ajudantes={selectedAgregado?.ajudantes || []}
      />

      <DocumentViewer
        isOpen={isDocumentViewerOpen}
        onClose={() => setIsDocumentViewerOpen(false)}
        documento={selectedAgregado?.documento_motorista?.[0] || null}
        nome={selectedAgregado?.nome || ''}
        cpf={selectedAgregado?.cpf}
        email={selectedAgregado?.email}
        telefone={selectedAgregado?.telefone?.toString()}
        dt_nascimento={selectedAgregado?.dt_nascimento}
        endereco={selectedAgregado?.endereco || null}
        veiculo={selectedAgregado?.veiculo?.[0] || null}
        isAgregado={true}
        st_cadastro={selectedAgregado?.st_cadastro}
      />

      <UnifiedAgregadoModal
        isOpen={isUnifiedModalOpen}
        onClose={() => setIsUnifiedModalOpen(false)}
        motorista={selectedAgregado}
        onSuccess={fetchAgregados}
      />

      <BulkActionsModal
        isOpen={isBulkStatusModalOpen}
        onClose={() => setIsBulkStatusModalOpen(false)}
        selectedItems={selectedItems}
        actionType="status"
        onSuccess={() => {
          fetchAgregados();
          setIsBulkStatusModalOpen(false);
        }}
      />

      <BulkActionsModal
        isOpen={isBulkClientModalOpen}
        onClose={() => setIsBulkClientModalOpen(false)}
        selectedItems={selectedItems}
        actionType="client"
        onSuccess={() => {
          fetchAgregados();
          setIsBulkClientModalOpen(false);
        }}
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

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este agregado? Esta ação não pode ser desfeita."
        itemData={selectedAgregado ? [
          { label: 'Nome', value: selectedAgregado.nome },
          { label: 'CPF', value: selectedAgregado.cpf ? formatCPF(selectedAgregado.cpf) : 'Não informado' },
          { label: 'Veículo', value: selectedAgregado.veiculo && selectedAgregado.veiculo.length > 0 ? 
            `${selectedAgregado.veiculo[0].placa.toUpperCase()} - ${selectedAgregado.veiculo[0].marca} ${selectedAgregado.veiculo[0].tipo}` : 
            'Sem veículo' 
          }
        ] : []}
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