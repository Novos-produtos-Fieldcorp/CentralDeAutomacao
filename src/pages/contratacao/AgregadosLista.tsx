import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Edit2, Trash2, FileText, MessageCircle, Filter, ChevronDown, CheckCircle2, XCircle } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import type { Motorista, DocumentoMotorista, Veiculo, DocumentoVeiculo } from '../../types/database';
import toast from 'react-hot-toast';
import { formatCPF, formatPhone, formatDate } from '../../utils/format';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useFloatingChat } from '../../hooks/useFloatingChat';
import AgregadoDetailView from '../../components/AgregadoDetailView';
import DocumentViewer from '../../components/DocumentViewer';
import BulkActionsModal from '../../components/BulkActionsModal';
import BulkDeleteConfirmationModal from '../../components/BulkDeleteConfirmationModal';
import BulkStatusModal from '../../components/BulkStatusModal';
import MassMessageModal from '../../components/MassMessageModal';
import AddAgregadoModal from '../../components/AddAgregadoModal';
import LoadingSpinner from '../../components/LoadingSpinner';
import ScrollableTableIndicator from '../../components/ScrollableTableIndicator';
import ContextMenu from '../../components/ContextMenu';

interface AgregadoWithDetails extends Motorista {
  documento?: DocumentoMotorista | null;
  veiculo?: (Veiculo & {
    documento_veiculo: (DocumentoVeiculo & {
      pessoa_fisica_dono_veiculo?: {
        id_pessoa_fisica_dono_veiculo: number;
        nome_dono_veiculo: string | null;
        nr_rg: number | null;
      };
      pessoa_juridica_dono_veiculo?: {
        id_pessoa_juridica_dono_veiculo: number;
        cnpj: number | null;
        inscricao_estadual: string | null;
        razao_social: string | null;
      };
    })[];
  }) | null;
  endereco?: any;
}

const AgregadosLista = () => {
  const { query } = useCompanyData();
  const { companyId } = useAuth();
  const { startChat } = useFloatingChat();
  const [agregados, setAgregados] = useState<AgregadoWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteFilter, setClienteFilter] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [isBulkActionsModalOpen, setIsBulkActionsModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false);
  const [isMassMessageModalOpen, setIsMassMessageModalOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'status' | 'client'>('status');
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [selectedAgregado, setSelectedAgregado] = useState<AgregadoWithDetails | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
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
  }, [currentPage, pageSize, statusFilter, clienteFilter, activeFilter]);

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
      
      // Calculate pagination parameters
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      
      // Build the query
      let query = supabase
        .from('motorista')
        .select(`
          *,
          documento_motorista(*),
          veiculo:veiculo!motorista_id(
            *,
            documento_veiculo(
              *,
              pessoa_fisica_dono_veiculo(*),
              pessoa_juridica_dono_veiculo(*)
            )
          ),
          end_motorista!inner(
            nr_end,
            ds_complemento_end,
            logradouro!inner(
              logradouro,
              nr_cep,
              bairro!inner(
                bairro,
                cidade!inner(
                  cidade,
                  estado!inner(
                    sigla_estado
                  )
                )
              )
            )
          )
        `, { count: 'exact' })
        .eq('funcao', 'Agregado')
        .eq('company_id', companyId);
      
      // Apply status filter if selected
      if (statusFilter) {
        query = query.eq('st_cadastro', statusFilter);
      }
      
      // Apply client filter if selected
      if (clienteFilter) {
        query = query.eq('cliente_id', clienteFilter);
      }
      
      // Apply active/inactive filter
      if (activeFilter === 'active') {
        query = query.eq('ativo', true);
      } else if (activeFilter === 'inactive') {
        query = query.eq('ativo', false);
      }
      
      // Apply search filter if provided
      if (searchTerm) {
        query = query.or(`nome.ilike.%${searchTerm}%,cpf.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }
      
      // Apply pagination
      query = query
        .order('nome')
        .range(from, to);
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      // Process the data to format the endereco field
      const processedData = data?.map(agregado => {
        // Extract the first endereco if it exists
        const endereco = agregado.end_motorista?.[0] || null;
        
        // Remove the end_motorista array to avoid duplication
        const { end_motorista, ...rest } = agregado;
        
        return {
          ...rest,
          endereco
        };
      }) || [];
      
      // Update state with the fetched data
      setAgregados(processedData);
      setTotalCount(count || 0);
      setTotalPages(Math.max(1, Math.ceil((count || 0) / pageSize)));
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

  const handleDelete = async (agregado: AgregadoWithDetails) => {
    try {
      const { error } = await query('motorista')
        .delete()
        .eq('motorista_id', agregado.motorista_id);
      
      if (error) throw error;
      
      setAgregados(agregados.filter(a => a.motorista_id !== agregado.motorista_id));
      toast.success('Agregado excluído com sucesso');
    } catch (error) {
      console.error('Error deleting agregado:', error);
      toast.error('Erro ao excluir agregado');
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

  const handleBulkStatusUpdate = async (activate: boolean) => {
    try {
      // Update status for all selected items
      for (const id of selectedItems) {
        const { error } = await query('motorista')
          .update({ ativo: activate })
          .eq('motorista_id', id);
        
        if (error) throw error;
      }
      
      // Update the list
      fetchAgregados();
      
      // Reset selection
      setSelectedItems(new Set());
      setSelectAll(false);
      setIsBulkStatusModalOpen(false);
      
      toast.success(`Status de ${selectedItems.size} agregado${selectedItems.size !== 1 ? 's' : ''} atualizado com sucesso`);
    } catch (error) {
      console.error('Error updating agregados status:', error);
      toast.error('Erro ao atualizar status dos agregados');
    }
  };

  const handleBulkAction = async (actionType: 'status' | 'client') => {
    setBulkActionType(actionType);
    setIsBulkActionsModalOpen(true);
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
    setSelectAll(newSelectedItems.size === agregados.length);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(agregados.map(a => a.motorista_id)));
    }
    setSelectAll(!selectAll);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  const handleViewDetail = (agregado: AgregadoWithDetails) => {
    setSelectedAgregado(agregado);
    setIsDetailViewOpen(true);
  };

  const handleViewDocument = (agregado: AgregadoWithDetails) => {
    setSelectedAgregado(agregado);
    setIsDocumentViewerOpen(true);
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

  const getStatusBadgeColor = (status: string) => {
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
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading && agregados.length === 0) {
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
                onClick={() => setIsBulkStatusModalOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                        transition-colors flex items-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                Ativar/Desativar
              </button>
              <button
                onClick={() => handleBulkAction('status')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                        transition-colors flex items-center gap-2"
              >
                <Filter className="w-5 h-5" />
                Atualizar Status
              </button>
              <button
                onClick={() => handleBulkAction('client')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                        transition-colors flex items-center gap-2"
              >
                <Filter className="w-5 h-5" />
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
            Novo Agregado
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
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
              <option value="gr">GR</option>
              <option value="contrato_enviado">Contrato Enviado</option>
              <option value="contratado">Contratado</option>
              <option value="repescagem">Repescagem</option>
              <option value="rejeitado">Rejeitado</option>
            </select>
            <Filter className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <ChevronDown className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <select
                value={clienteFilter}
                onChange={(e) => setClienteFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none"
              >
                <option value="">Todos os clientes</option>
                {clientes.map((cliente) => (
                  <option key={cliente.cliente_id} value={cliente.cliente_id}>
                    {cliente.nome}
                  </option>
                ))}
              </select>
              <Filter className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <ChevronDown className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
            
            <div className="relative">
              <select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value as 'all' | 'active' | 'inactive')}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none"
              >
                <option value="all">Todos (Ativos/Inativos)</option>
                <option value="active">Somente Ativos</option>
                <option value="inactive">Somente Inativos</option>
              </select>
              <CheckCircle2 className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <ChevronDown className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Veículo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Ativo</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {agregados.map((agregado) => (
                  <tr 
                    key={agregado.motorista_id} 
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                      selectedItems.has(agregado.motorista_id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    } ${!agregado.ativo ? 'opacity-60' : ''}`}
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
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <span className="text-lg font-medium text-green-600 dark:text-green-400">
                            {agregado.nome.charAt(0)}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {agregado.nome}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(agregado.data_cadastro)}
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
                        {agregado.veiculo ? (
                          <span className="uppercase">{agregado.veiculo.placa}</span>
                        ) : (
                          '-'
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {agregado.veiculo ? (
                          `${agregado.veiculo.marca || ''} ${agregado.veiculo.tipo || ''}`
                        ) : (
                          'Sem veículo'
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeColor(agregado.st_cadastro)}`}>
                        {formatStatus(agregado.st_cadastro)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        agregado.ativo 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200' 
                          : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                      }`}>
                        {agregado.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-3">
                        <button
                          onClick={() => handleViewDetail(agregado)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                          title="Visualizar detalhes"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleViewDocument(agregado)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                          title="Visualizar documentos"
                        >
                          <FileText size={18} />
                        </button>
                        {agregado.telefone && (
                          <button
                            onClick={() => handleStartChat(agregado)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            title="Iniciar chat"
                          >
                            <MessageCircle size={18} />
                          </button>
                        )}
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
          
          <ScrollableTableIndicator 
            containerRef={tableContainerRef} 
            className="mr-2 ml-2"
          />
        </div>
        
        {agregados.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              Nenhum agregado encontrado
            </p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4 sm:mb-0">
              <span>
                Mostrando <span className="font-medium">{Math.min((currentPage - 1) * pageSize + 1, totalCount)}</span> a{' '}
                <span className="font-medium">{Math.min(currentPage * pageSize, totalCount)}</span> de{' '}
                <span className="font-medium">{totalCount}</span> resultados
              </span>
              
              <div className="ml-4">
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
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
              icon: <Edit2 size={16} />,
              label: 'Ver Detalhes',
              onClick: () => handleViewDetail(contextMenu.agregado!),
              color: 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300'
            },
            {
              icon: <FileText size={16} />,
              label: 'Ver Documentos',
              onClick: () => handleViewDocument(contextMenu.agregado!),
              color: 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300'
            },
            {
              icon: <MessageCircle size={16} />,
              label: 'Iniciar Chat',
              onClick: () => handleStartChat(contextMenu.agregado!),
              color: 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300',
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

      <AddAgregadoModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchAgregados}
      />

      <AgregadoDetailView
        isOpen={isDetailViewOpen}
        onClose={() => setIsDetailViewOpen(false)}
        agregado={selectedAgregado}
        documento={selectedAgregado?.documento_motorista?.[0] || null}
        veiculo={selectedAgregado?.veiculo || null}
        endereco={selectedAgregado?.endereco}
        onSuccess={fetchAgregados}
      />

      <DocumentViewer
        isOpen={isDocumentViewerOpen}
        onClose={() => setIsDocumentViewerOpen(false)}
        documento={selectedAgregado?.documento_motorista?.[0] || null}
        nome={selectedAgregado?.nome || ''}
        cpf={selectedAgregado?.cpf}
        email={selectedAgregado?.email || undefined}
        telefone={selectedAgregado?.telefone?.toString()}
        dt_nascimento={selectedAgregado?.dt_nascimento}
        endereco={selectedAgregado?.endereco}
        veiculo={selectedAgregado?.veiculo || undefined}
        isAgregado={true}
        st_cadastro={selectedAgregado?.st_cadastro}
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

      <BulkStatusModal
        isOpen={isBulkStatusModalOpen}
        onClose={() => setIsBulkStatusModalOpen(false)}
        onConfirm={handleBulkStatusUpdate}
        title="Atualizar Status de Atividade"
        message="Escolha se deseja ativar ou desativar os agregados selecionados."
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