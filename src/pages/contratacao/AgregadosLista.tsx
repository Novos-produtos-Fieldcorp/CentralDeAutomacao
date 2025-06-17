import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Edit2, Trash2, FileText, Filter, ChevronDown, MessageSquare, X, CheckCircle2, XCircle, Truck } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import type { Motorista, DocumentoMotorista, Veiculo, DocumentoVeiculo } from '../../types/database';
import { formatCPF, formatPhone, formatDate } from '../../utils/format';
import AddAgregadoModal from '../../components/AddAgregadoModal';
import EditMotoristaModal from '../../components/EditMotoristaModal';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import DocumentViewer from '../../components/DocumentViewer';
import DocumentUploadModal from '../../components/DocumentUploadModal';
import BulkActionsModal from '../../components/BulkActionsModal';
import BulkDeleteConfirmationModal from '../../components/BulkDeleteConfirmationModal';
import BulkStatusModal from '../../components/BulkStatusModal';
import MassMessageModal from '../../components/MassMessageModal';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useFloatingChat } from '../../hooks/useFloatingChat';
import { usePagination } from '../../hooks/usePagination';
import Pagination from '../../components/Pagination';
import LoadingSpinner from '../../components/LoadingSpinner';
import ScrollableTableIndicator from '../../components/ScrollableTableIndicator';
import ContextMenu from '../../components/ContextMenu';
import AgregadoDetailView from '../../components/AgregadoDetailView';

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
  const { query, companyId } = useCompanyData();
  const { startChat } = useFloatingChat();
  const [agregados, setAgregados] = useState<AgregadoWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [isDocumentUploadModalOpen, setIsDocumentUploadModalOpen] = useState(false);
  const [isBulkActionsModalOpen, setIsBulkActionsModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false);
  const [isMassMessageModalOpen, setIsMassMessageModalOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'status' | 'client'>('status');
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [selectedAgregado, setSelectedAgregado] = useState<AgregadoWithDetails | null>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  const [agregadoDocumento, setAgregadoDocumento] = useState<DocumentoMotorista | null>(null);
  const [agregadoVeiculo, setAgregadoVeiculo] = useState<(Veiculo & {
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
  }) | null>(null);
  const [agregadoEndereco, setAgregadoEndereco] = useState<any | null>(null);
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
  }, [statusFilter]);

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
      
      // Build the query with filters
      let query = supabase
        .from('vw_agregados_completo')
        .select('*')
        .eq('company_id', companyId);
      
      // Apply status filter if not 'todos'
      if (statusFilter !== 'todos') {
        query = query.eq('st_cadastro', statusFilter);
      }
      
      // Apply search filter if provided
      if (searchTerm) {
        query = query.or(`nome.ilike.%${searchTerm}%,cpf.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,telefone.ilike.%${searchTerm}%`);
      }
      
      // Execute the query
      const { data, error } = await query.order('data_cadastro', { ascending: false });
      
      if (error) throw error;
      
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
      const { data, error } = await query('cliente')
        .select('*')
        .eq('st_cliente', true);

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error('Error fetching clientes:', error);
      toast.error('Erro ao carregar clientes');
    }
  };

  const handleSearch = () => {
    fetchAgregados();
  };

  const handleEdit = (agregado: AgregadoWithDetails) => {
    setSelectedAgregado(agregado);
    setIsEditModalOpen(true);
  };

  const handleDelete = (agregado: AgregadoWithDetails) => {
    setSelectedAgregado(agregado);
    setIsDeleteModalOpen(true);
  };

  const handleViewDetail = async (agregado: AgregadoWithDetails) => {
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

      setAgregadoDocumento(documentoResponse.data);
      setAgregadoEndereco(enderecoResponse.data);
      setAgregadoVeiculo(veiculoResponse.data);
      
      setIsDetailViewOpen(true);
    } catch (error) {
      console.error('Error fetching agregado details:', error);
      toast.error('Erro ao carregar detalhes do agregado');
    }
  };

  const handleUploadDocument = (agregado: AgregadoWithDetails) => {
    setSelectedAgregado(agregado);
    setIsDocumentUploadModalOpen(true);
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

  const handleBulkStatus = async (activate: boolean) => {
    try {
      const newStatus = activate ? 'contratado' : 'rejeitado';
      
      // Update status for all selected items
      for (const id of selectedItems) {
        const { error } = await query('motorista')
          .update({ st_cadastro: newStatus })
          .eq('motorista_id', id);

        if (error) throw error;
      }

      // Update the list
      setAgregados(agregados.map(a => {
        if (selectedItems.has(a.motorista_id)) {
          return { ...a, st_cadastro: newStatus };
        }
        return a;
      }));
      
      toast.success(`Status atualizado para ${selectedItems.size} agregado${selectedItems.size !== 1 ? 's' : ''}`);
      
      // Reset selection
      setSelectedItems(new Set());
      setSelectAll(false);
      setIsBulkStatusModalOpen(false);
      
      // Refresh the list to ensure we have the latest data
      fetchAgregados();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status');
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

  const handleStartChat = (agregado: AgregadoWithDetails) => {
    if (agregado.telefone) {
      startChat(agregado.telefone.toString(), agregado.nome);
    } else {
      toast.error('Este agregado não possui telefone cadastrado');
    }
  };

  const filteredAgregados = agregados.filter(agregado => {
    const searchString = searchTerm.toLowerCase();
    return (
      agregado.nome.toLowerCase().includes(searchString) ||
      agregado.cpf.includes(searchString) ||
      (agregado.email && agregado.email.toLowerCase().includes(searchString)) ||
      (agregado.telefone && agregado.telefone.toString().includes(searchString))
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
                onClick={() => {
                  setBulkActionType('status');
                  setIsBulkActionsModalOpen(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                        transition-colors flex items-center gap-2"
              >
                <Edit2 className="w-5 h-5" />
                Atualizar Status
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
                <CheckCircle2 className="w-5 h-5" />
                Atribuir Cliente
              </button>
              <button
                onClick={() => setIsBulkStatusModalOpen(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 
                        focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 
                        transition-colors flex items-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                Ativar/Desativar
              </button>
              <button
                onClick={() => setIsMassMessageModalOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                        transition-colors flex items-center gap-2"
              >
                <MessageSquare className="w-5 h-5" />
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por nome, CPF, email ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  fetchAgregados();
                }}
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
            <Filter className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <ChevronDown className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                       transition-colors flex items-center gap-2"
            >
              <Search className="w-5 h-5" />
              Buscar
            </button>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">CPF</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Contato</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Data Cadastro</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedData.map((agregado) => (
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
                              Agregado
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
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          agregado.st_cadastro === 'contratado' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200' :
                          agregado.st_cadastro === 'rejeitado' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200' :
                          agregado.st_cadastro === 'qualificado' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200' :
                          agregado.st_cadastro === 'documentacao' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200' :
                          agregado.st_cadastro === 'gr' ? 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-200' :
                          agregado.st_cadastro === 'contrato_enviado' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-200' :
                          agregado.st_cadastro === 'repescagem' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200'
                        }`}>
                          {agregado.st_cadastro === 'cadastrado' ? 'Cadastrado' :
                           agregado.st_cadastro === 'qualificado' ? 'Qualificado' :
                           agregado.st_cadastro === 'documentacao' ? 'Documentação' :
                           agregado.st_cadastro === 'gr' ? 'GR' :
                           agregado.st_cadastro === 'contrato_enviado' ? 'Contrato Enviado' :
                           agregado.st_cadastro === 'contratado' ? 'Contratado' :
                           agregado.st_cadastro === 'repescagem' ? 'Repescagem' :
                           agregado.st_cadastro === 'rejeitado' ? 'Rejeitado' :
                           agregado.st_cadastro}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {agregado.data_cadastro ? formatDate(agregado.data_cadastro) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-3">
                          <button
                            onClick={() => handleStartChat(agregado)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            title="Iniciar chat"
                          >
                            <MessageSquare size={18} />
                          </button>
                          <button
                            onClick={() => handleViewDetail(agregado)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            title="Visualizar detalhes"
                          >
                            <FileText size={18} />
                          </button>
                          <button
                            onClick={() => handleEdit(agregado)}
                            className="text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300 transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={18} />
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
              icon: <FileText size={16} />,
              label: 'Visualizar Detalhes',
              onClick: () => handleViewDetail(contextMenu.agregado!),
              color: 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors'
            },
            {
              icon: <Edit2 size={16} />,
              label: 'Editar Agregado',
              onClick: () => handleEdit(contextMenu.agregado!),
              color: 'text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300 transition-colors'
            },
            {
              icon: <MessageSquare size={16} />,
              label: 'Iniciar Chat',
              onClick: () => handleStartChat(contextMenu.agregado!),
              color: 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors',
              disabled: !contextMenu.agregado?.telefone
            },
            {
              icon: <Trash2 size={16} />,
              label: 'Excluir Agregado',
              onClick: () => handleDelete(contextMenu.agregado!),
              color: 'text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors'
            }
          ]}
        />
      )}

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

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este agregado? Esta ação não pode ser desfeita."
        itemData={selectedAgregado ? [
          { label: 'Nome', value: selectedAgregado.nome },
          { label: 'CPF', value: formatCPF(selectedAgregado.cpf) }
        ] : []}
      />

      <AgregadoDetailView
        isOpen={isDetailViewOpen}
        onClose={() => setIsDetailViewOpen(false)}
        agregado={selectedAgregado}
        documento={agregadoDocumento}
        veiculo={agregadoVeiculo}
        endereco={agregadoEndereco}
      />

      <DocumentUploadModal
        isOpen={isDocumentUploadModalOpen}
        onClose={() => setIsDocumentUploadModalOpen(false)}
        motorista_id={selectedAgregado?.motorista_id || 0}
        nome={selectedAgregado?.nome || ''}
        onUploadSuccess={fetchAgregados}
      />

      <BulkActionsModal
        isOpen={isBulkActionsModalOpen}
        onClose={() => setIsBulkActionsModalOpen(false)}
        selectedItems={selectedItems}
        actionType={bulkActionType}
        onSuccess={() => {
          fetchAgregados();
          setSelectedItems(new Set());
          setSelectAll(false);
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

      <BulkStatusModal
        isOpen={isBulkStatusModalOpen}
        onClose={() => setIsBulkStatusModalOpen(false)}
        onConfirm={handleBulkStatus}
        title="Ativar/Desativar Agregados"
        message="Escolha se deseja ativar (contratar) ou desativar (rejeitar) os agregados selecionados."
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