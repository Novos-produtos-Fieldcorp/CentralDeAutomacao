import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Edit2, Trash2, FileText, Filter, ChevronDown, MessageSquare, X, CheckCircle2, XCircle } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import type { Motorista, DocumentoMotorista, Veiculo } from '../../types/database';
import { formatCPF, formatPhone, formatDate } from '../../utils/format';
import AddMotoristaModal from '../../components/AddMotoristaModal';
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
import UnifiedMotoristaModal from '../../components/UnifiedMotoristaModal';

interface MotoristaWithDetails extends Motorista {
  documento?: DocumentoMotorista | null;
  veiculo?: Veiculo | null;
  endereco?: any;
}

const MotoristasLista = () => {
  const { query, companyId } = useCompanyData();
  const { startChat } = useFloatingChat();
  const [motoristas, setMotoristas] = useState<MotoristaWithDetails[]>([]);
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
  const [selectedMotorista, setSelectedMotorista] = useState<MotoristaWithDetails | null>(null);
  const [clientes, setClientes] = useState<any[]>([]);
  const [isUnifiedModalOpen, setIsUnifiedModalOpen] = useState(false);
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

  const fetchMotoristas = async () => {
    try {
      setLoading(true);
      
      // Build the query with filters
      let query = supabase
        .from('vw_motoristas_completo')
        .select('*')
        .eq('company_id', companyId)
        .eq('funcao', 'Motorista');
      
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
      
      setMotoristas(data || []);
    } catch (error) {
      console.error('Error fetching motoristas:', error);
      toast.error('Erro ao carregar motoristas');
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
    fetchMotoristas();
  };

  const handleEdit = (motorista: MotoristaWithDetails) => {
    setSelectedMotorista(motorista);
    setIsEditModalOpen(true);
  };

  const handleDelete = (motorista: MotoristaWithDetails) => {
    setSelectedMotorista(motorista);
    setIsDeleteModalOpen(true);
  };

  const handleViewDocument = async (motorista: MotoristaWithDetails) => {
    try {
      setSelectedMotorista(motorista);
      setIsUnifiedModalOpen(true);
    } catch (error) {
      console.error('Error fetching document details:', error);
      toast.error('Erro ao carregar detalhes do documento');
    }
  };

  const handleUploadDocument = (motorista: MotoristaWithDetails) => {
    setSelectedMotorista(motorista);
    setIsDocumentUploadModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedMotorista) return;

    try {
      const { error } = await query('motorista')
        .delete()
        .eq('motorista_id', selectedMotorista.motorista_id);

      if (error) throw error;

      setMotoristas(motoristas.filter(m => m.motorista_id !== selectedMotorista.motorista_id));
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
      setMotoristas(motoristas.map(m => {
        if (selectedItems.has(m.motorista_id)) {
          return { ...m, st_cadastro: newStatus };
        }
        return m;
      }));
      
      toast.success(`Status atualizado para ${selectedItems.size} motorista${selectedItems.size !== 1 ? 's' : ''}`);
      
      // Reset selection
      setSelectedItems(new Set());
      setSelectAll(false);
      setIsBulkStatusModalOpen(false);
      
      // Refresh the list to ensure we have the latest data
      fetchMotoristas();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status');
    }
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

  const handleStartChat = (motorista: MotoristaWithDetails) => {
    if (motorista.telefone) {
      startChat(motorista.telefone.toString(), motorista.nome);
    } else {
      toast.error('Este motorista não possui telefone cadastrado');
    }
  };

  const filteredMotoristas = motoristas.filter(motorista => {
    const searchString = searchTerm.toLowerCase();
    return (
      motorista.nome.toLowerCase().includes(searchString) ||
      motorista.cpf.includes(searchString) ||
      (motorista.email && motorista.email.toLowerCase().includes(searchString)) ||
      (motorista.telefone && motorista.telefone.toString().includes(searchString))
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
            Adicionar Motorista
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
                  fetchMotoristas();
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
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {motorista.nome}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {formatCPF(motorista.cpf)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {motorista.telefone ? formatPhone(motorista.telefone.toString()) : '-'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {motorista.email || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          motorista.st_cadastro === 'contratado' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200' :
                          motorista.st_cadastro === 'rejeitado' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200' :
                          motorista.st_cadastro === 'qualificado' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200' :
                          motorista.st_cadastro === 'documentacao' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200' :
                          motorista.st_cadastro === 'gr' ? 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-200' :
                          motorista.st_cadastro === 'contrato_enviado' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-200' :
                          motorista.st_cadastro === 'repescagem' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200'
                        }`}>
                          {motorista.st_cadastro === 'cadastrado' ? 'Cadastrado' :
                           motorista.st_cadastro === 'qualificado' ? 'Qualificado' :
                           motorista.st_cadastro === 'documentacao' ? 'Documentação' :
                           motorista.st_cadastro === 'gr' ? 'GR' :
                           motorista.st_cadastro === 'contrato_enviado' ? 'Contrato Enviado' :
                           motorista.st_cadastro === 'contratado' ? 'Contratado' :
                           motorista.st_cadastro === 'repescagem' ? 'Repescagem' :
                           motorista.st_cadastro === 'rejeitado' ? 'Rejeitado' :
                           motorista.st_cadastro}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {motorista.data_cadastro ? formatDate(motorista.data_cadastro) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-3">
                          <button
                            onClick={() => handleStartChat(motorista)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            title="Iniciar chat"
                          >
                            <MessageSquare size={18} />
                          </button>
                          <button
                            onClick={() => handleViewDocument(motorista)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            title="Visualizar documentos"
                          >
                            <FileText size={18} />
                          </button>
                          <button
                            onClick={() => handleEdit(motorista)}
                            className="text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300 transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(motorista)}
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
        
        {filteredMotoristas.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              Nenhum motorista encontrado
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
              label: 'Visualizar Documentos',
              onClick: () => handleViewDocument(contextMenu.motorista!),
              color: 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors'
            },
            {
              icon: <Edit2 size={16} />,
              label: 'Editar Motorista',
              onClick: () => handleEdit(contextMenu.motorista!),
              color: 'text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300 transition-colors'
            },
            {
              icon: <MessageSquare size={16} />,
              label: 'Iniciar Chat',
              onClick: () => handleStartChat(contextMenu.motorista!),
              color: 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors',
              disabled: !contextMenu.motorista?.telefone
            },
            {
              icon: <Trash2 size={16} />,
              label: 'Excluir Motorista',
              onClick: () => handleDelete(contextMenu.motorista!),
              color: 'text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors'
            }
          ]}
        />
      )}

      <AddMotoristaModal
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
        message="Tem certeza que deseja excluir este motorista? Esta ação não pode ser desfeita."
        itemData={selectedMotorista ? [
          { label: 'Nome', value: selectedMotorista.nome },
          { label: 'CPF', value: formatCPF(selectedMotorista.cpf) }
        ] : []}
      />

      <UnifiedMotoristaModal
        isOpen={isUnifiedModalOpen}
        onClose={() => setIsUnifiedModalOpen(false)}
        motorista={selectedMotorista}
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
        onSuccess={() => {
          fetchMotoristas();
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
        message="Tem certeza que deseja excluir todos os motoristas selecionados? Esta ação não pode ser desfeita."
        itemCount={selectedItems.size}
        itemType="motorista"
      />

      <BulkStatusModal
        isOpen={isBulkStatusModalOpen}
        onClose={() => setIsBulkStatusModalOpen(false)}
        onConfirm={handleBulkStatus}
        title="Ativar/Desativar Motoristas"
        message="Escolha se deseja ativar (contratar) ou desativar (rejeitar) os motoristas selecionados."
        itemCount={selectedItems.size}
        itemType="motorista"
      />

      <MassMessageModal
        isOpen={isMassMessageModalOpen}
        onClose={() => setIsMassMessageModalOpen(false)}
        numbers={Array.from(selectedItems)
          .map(id => {
            const motorista = motoristas.find(m => m.motorista_id === id);
            return motorista?.telefone ? motorista.telefone.toString() : '';
          })
          .filter(Boolean)}
      />
    </div>
  );
};

export default MotoristasLista;