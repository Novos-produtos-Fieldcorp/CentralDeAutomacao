import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, FilePen, Trash2, MoreHorizontal, Filter, ChevronDown, MessageCircle, FileText, Phone, Mail, Calendar, Truck, User, CheckCircle2, XCircle } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { supabase } from '../../lib/supabase';
import type { Motorista, DocumentoMotorista, Veiculo } from '../../types/database';
import toast from 'react-hot-toast';
import { formatCPF, formatPhone, formatDate } from '../../utils/format';
import { useFloatingChat } from '../../hooks/useFloatingChat';
import AddAgregadoModal from '../../components/AddAgregadoModal';
import DocumentViewer from '../../components/DocumentViewer';
import BulkActionsModal from '../../components/BulkActionsModal';
import BulkStatusModal from '../../components/BulkStatusModal';
import BulkDeleteConfirmationModal from '../../components/BulkDeleteConfirmationModal';
import MassMessageModal from '../../components/MassMessageModal';
import LoadingSpinner from '../../components/LoadingSpinner';
import UnifiedAgregadoModal from '../../components/UnifiedAgregadoModal';
import ContextMenu from '../../components/ContextMenu';

interface MotoristaWithDetails extends Motorista {
  documento?: DocumentoMotorista;
  veiculo?: Veiculo[];
  endereco?: any;
}

const AgregadosLista = () => {
  const { query, companyId } = useCompanyData();
  const { startChat } = useFloatingChat();
  const [agregados, setAgregados] = useState<MotoristaWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [clienteFilter, setClienteFilter] = useState<string>('');
  const [clientes, setClientes] = useState<{ cliente_id: number; nome: string }[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [isUnifiedModalOpen, setIsUnifiedModalOpen] = useState(false);
  const [isBulkActionsModalOpen, setIsBulkActionsModalOpen] = useState(false);
  const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isMassMessageModalOpen, setIsMassMessageModalOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'status' | 'client'>('status');
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [selectedAgregado, setSelectedAgregado] = useState<MotoristaWithDetails | null>(null);
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

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchAgregados();
    fetchClientes();
  }, [currentPage, pageSize, statusFilter, clienteFilter]);

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
      
      // Build the query with filters
      let query = supabase
        .from('vw_agregados_completo')
        .select('*', { count: 'exact' })
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
        query = query.or(`nome.ilike.%${searchTerm}%,cpf.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,telefone.ilike.%${searchTerm}%`);
      }
      
      // Apply pagination
      query = query
        .order('data_cadastro', { ascending: false })
        .range(from, to);
      
      // Execute the query
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      // Update state with the results
      setAgregados(data || []);
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
        .select('cliente_id, nome')
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page when searching
    fetchAgregados();
  };

  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handleClienteFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setClienteFilter(e.target.value);
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when changing page size
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

  const handleViewDocument = async (agregado: MotoristaWithDetails) => {
    try {
      setSelectedAgregado(agregado);
      
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
            documento_veiculo (*)
          `)
          .eq('motorista_id', agregado.motorista_id)
          .eq('status_veiculo', true)
          .maybeSingle()
      ]);

      if (documentoResponse.error) throw new Error(`Erro ao buscar documentos: ${documentoResponse.error.message}`);
      if (enderecoResponse.error) throw new Error(`Erro ao buscar endereço: ${enderecoResponse.error.message}`);
      if (veiculoResponse.error) throw new Error(`Erro ao buscar veículo: ${veiculoResponse.error.message}`);

      // Update the selected agregado with the fetched details
      setSelectedAgregado({
        ...agregado,
        documento: documentoResponse.data,
        endereco: enderecoResponse.data,
        veiculo: veiculoResponse.data ? [veiculoResponse.data] : []
      });
      
      // Open the unified modal
      setIsUnifiedModalOpen(true);
    } catch (error) {
      console.error('Erro ao carregar detalhes do agregado:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar detalhes do agregado');
    }
  };

  const handleStartChat = (agregado: MotoristaWithDetails) => {
    if (agregado.telefone) {
      startChat(agregado.telefone.toString(), agregado.nome);
    } else {
      toast.error('Este agregado não possui telefone cadastrado');
    }
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
      
      toast.success(`Status atualizado para ${selectedItems.size} agregado${selectedItems.size !== 1 ? 's' : ''}`);
      fetchAgregados();
      setIsBulkStatusModalOpen(false);
      setSelectedItems(new Set());
      setSelectAll(false);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status');
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
      
      toast.success(`${selectedItems.size} agregado${selectedItems.size !== 1 ? 's' : ''} excluído${selectedItems.size !== 1 ? 's' : ''} com sucesso`);
      fetchAgregados();
      setIsBulkDeleteModalOpen(false);
      setSelectedItems(new Set());
      setSelectAll(false);
    } catch (error) {
      console.error('Error deleting agregados:', error);
      toast.error('Erro ao excluir agregados');
    }
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

  const getStatusBadge = (status: string) => {
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
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
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

  const filteredAgregados = agregados.filter(agregado => {
    const searchString = searchTerm.toLowerCase();
    return (
      (agregado.nome?.toLowerCase() || '').includes(searchString) ||
      (agregado.cpf || '').includes(searchString) ||
      (agregado.email?.toLowerCase() || '').includes(searchString) ||
      (agregado.telefone?.toString() || '').includes(searchString)
    );
  });

  if (loading) {
    return <LoadingSpinner />;
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
                <CheckCircle2 className="w-5 h-5" />
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
                <Truck className="w-5 h-5" />
                Atribuir Cliente
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
          Novo Agregado
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <form onSubmit={handleSearch}>
              <input
                type="text"
                placeholder="Buscar por nome, CPF, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <button type="submit" className="sr-only">Buscar</button>
            </form>
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={handleStatusFilterChange}
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

          <div className="relative">
            <select
              value={clienteFilter}
              onChange={handleClienteFilterChange}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none"
            >
              <option value="">Todos os clientes</option>
              {clientes.map(cliente => (
                <option key={cliente.cliente_id} value={cliente.cliente_id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
            <Truck className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <ChevronDown className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
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
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"></th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contato</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Veículo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredAgregados.map((agregado) => (
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
                      <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {agregado.nome || 'Nome não informado'}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {agregado.cpf ? formatCPF(agregado.cpf) : 'CPF não informado'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">
                    {agregado.telefone ? formatPhone(agregado.telefone.toString()) : 'Não informado'}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {agregado.email || 'Não informado'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">
                    {agregado.placa ? agregado.placa.toUpperCase() : 'Não informado'}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {agregado.tipologia || 'Não informado'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">
                    {agregado.cliente_nome || 'Não atribuído'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-medium rounded-full ${getStatusBadge(agregado.st_cadastro)}`}>
                    {getStatusLabel(agregado.st_cadastro)}
                  </span>
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
                      onClick={() => handleViewDocument(agregado)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                      title="Visualizar"
                    >
                      <FilePen size={18} />
                    </button>
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleContextMenu(e, agregado);
                        }}
                        className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                        title="Mais opções"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {filteredAgregados.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  Nenhum agregado encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
        
        {/* Pagination */}
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
      </div>

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.agregado && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu({ ...contextMenu, visible: false })}
          actions={[
            {
              icon: <FilePen size={16} />,
              label: 'Visualizar',
              onClick: () => handleViewDocument(contextMenu.agregado!),
              color: 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors'
            },
            {
              icon: <MessageCircle size={16} />,
              label: 'Iniciar chat',
              onClick: () => handleStartChat(contextMenu.agregado!),
              color: 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors',
              disabled: !contextMenu.agregado?.telefone
            },
            {
              icon: <FileText size={16} />,
              label: 'Ver documentos',
              onClick: () => handleViewDocument(contextMenu.agregado!),
              color: 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors'
            },
            {
              icon: <Trash2 size={16} />,
              label: 'Excluir',
              onClick: () => {
                setSelectedItems(new Set([contextMenu.agregado!.motorista_id]));
                setIsBulkDeleteModalOpen(true);
              },
              color: 'text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors'
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

      <UnifiedAgregadoModal
        isOpen={isUnifiedModalOpen}
        onClose={() => setIsUnifiedModalOpen(false)}
        agregado={selectedAgregado}
        documento={selectedAgregado?.documento}
        veiculo={selectedAgregado?.veiculo?.[0]}
        endereco={selectedAgregado?.endereco}
        onSuccess={fetchAgregados}
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
        veiculo={selectedAgregado?.veiculo?.[0]}
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

      <BulkStatusModal
        isOpen={isBulkStatusModalOpen}
        onClose={() => setIsBulkStatusModalOpen(false)}
        onConfirm={handleBulkStatusUpdate}
        title="Atualizar Status em Massa"
        message="Deseja atualizar o status dos agregados selecionados?"
        itemCount={selectedItems.size}
        itemType="agregado"
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
        numbers={Array.from(selectedItems).map(id => {
          const agregado = agregados.find(a => a.motorista_id === id);
          return agregado?.telefone?.toString() || '';
        }).filter(Boolean)}
      />
    </div>
  );
};

export default AgregadosLista;