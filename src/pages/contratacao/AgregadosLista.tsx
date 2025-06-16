import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Filter, ChevronDown, ChevronUp, Truck, Phone, Mail, Calendar, MessageCircle } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import type { Motorista, DocumentoMotorista, Veiculo } from '../../types/database';
import { formatCPF, formatPhone, formatDate } from '../../utils/format';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import AddAgregadoModal from '../../components/AddAgregadoModal';
import BulkDeleteConfirmationModal from '../../components/BulkDeleteConfirmationModal';
import BulkActionsModal from '../../components/BulkActionsModal';
import BulkStatusModal from '../../components/BulkStatusModal';
import MassMessageModal from '../../components/MassMessageModal';
import { useFloatingChat } from '../../hooks/useFloatingChat';
import LoadingSpinner from '../../components/LoadingSpinner';
import UnifiedAgregadoModal from '../../components/UnifiedAgregadoModal';

interface AgregadoWithDetails extends Motorista {
  documento?: DocumentoMotorista | null;
  veiculo?: (Veiculo & {
    documento_veiculo: any[];
  })[] | null;
  endereco?: any;
  isExpanded?: boolean;
}

const AgregadosLista = () => {
  const { query, companyId } = useCompanyData();
  const { startChat } = useFloatingChat();
  const [agregados, setAgregados] = useState<AgregadoWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUnifiedModalOpen, setIsUnifiedModalOpen] = useState(false);
  const [selectedAgregado, setSelectedAgregado] = useState<Motorista | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkActionsModalOpen, setIsBulkActionsModalOpen] = useState(false);
  const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false);
  const [isMassMessageModalOpen, setIsMassMessageModalOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'status' | 'client'>('status');
  const [clientes, setClientes] = useState<any[]>([]);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Motorista;
    direction: 'asc' | 'desc';
  }>({ key: 'nome', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAgregados();
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    try {
      const { data, error } = await supabase
        .from('cliente')
        .select('*')
        .eq('company_id', companyId)
        .eq('st_cliente', true);

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error('Error fetching clientes:', error);
      toast.error('Erro ao carregar clientes');
    }
  };

  const fetchAgregados = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('motorista')
        .select(`
          *,
          cliente (
            cliente_id,
            nome
          )
        `)
        .eq('company_id', companyId)
        .eq('funcao', 'Agregado')
        .order('nome');

      if (error) throw error;
      setAgregados(data || []);
    } catch (error) {
      console.error('Error fetching agregados:', error);
      toast.error('Erro ao carregar agregados');
    } finally {
      setLoading(false);
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
      setSelectedItems(new Set(filteredAgregados.map(m => m.motorista_id)));
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
      setAgregados(agregados.filter(m => !selectedItems.has(m.motorista_id)));
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
      const newStatus = activate ? 'contratado' : 'rejeitado';
      
      // Update status for all selected items
      for (const id of selectedItems) {
        const { error } = await query('motorista')
          .update({ st_cadastro: newStatus })
          .eq('motorista_id', id);

        if (error) throw error;
      }

      // Update the list
      setAgregados(agregados.map(m => 
        selectedItems.has(m.motorista_id) 
          ? { ...m, st_cadastro: newStatus } 
          : m
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

  const handleSort = (key: keyof Motorista) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleViewAgregado = (agregado: Motorista) => {
    setSelectedAgregado(agregado);
    setIsUnifiedModalOpen(true);
  };

  const handleStartChat = (agregado: Motorista, e: React.MouseEvent) => {
    e.stopPropagation();
    if (agregado.telefone) {
      startChat(agregado.telefone.toString(), agregado.nome);
    } else {
      toast.error('Este agregado não possui telefone cadastrado');
    }
  };

  const filteredAgregados = agregados
    .filter(agregado => {
      const searchString = searchTerm.toLowerCase();
      const statusMatch = statusFilter ? agregado.st_cadastro === statusFilter : true;
      
      return statusMatch && (
        agregado.nome.toLowerCase().includes(searchString) ||
        agregado.cpf.includes(searchString) ||
        (agregado.email && agregado.email.toLowerCase().includes(searchString)) ||
        (agregado.telefone && agregado.telefone.toString().includes(searchString))
      );
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

  // Pagination
  const totalPages = Math.ceil(filteredAgregados.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedAgregados = filteredAgregados.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1); // Reset to first page when changing items per page
  };

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
                onClick={() => {
                  setBulkActionType('status');
                  setIsBulkActionsModalOpen(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                        transition-colors flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                </svg>
                Atualizar Status
              </button>
              <button
                onClick={() => setIsBulkStatusModalOpen(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 
                        focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 
                        transition-colors flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                Ativar/Desativar
              </button>
              <button
                onClick={() => setIsMassMessageModalOpen(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 
                        focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 
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
                Excluir Selecionados
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
              <option value="contrato_enviado">Contrato Enviado</option>
              <option value="contratado">Contratado</option>
              <option value="repescagem">Repescagem</option>
              <option value="rejeitado">Rejeitado</option>
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
            <div ref={tableRef} className="overflow-x-auto w-full">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"></th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer"
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Contato
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
                  {paginatedAgregados.map((agregado) => (
                    <tr 
                      key={agregado.motorista_id} 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${
                        selectedItems.has(agregado.motorista_id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                      onClick={() => handleViewAgregado(agregado)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(agregado.motorista_id)}
                          onChange={() => handleSelectItem(agregado.motorista_id)}
                          onClick={(e) => e.stopPropagation()}
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
                              {formatCPF(agregado.cpf)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white flex items-center gap-1">
                          <Phone className="w-4 h-4 text-gray-400" />
                          {agregado.telefone ? formatPhone(agregado.telefone.toString()) : 'Não informado'}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                          <Mail className="w-4 h-4 text-gray-400" />
                          {agregado.email || 'Não informado'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          agregado.st_cadastro === 'contratado' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200' :
                          agregado.st_cadastro === 'rejeitado' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200' :
                          agregado.st_cadastro === 'qualificado' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200' :
                          agregado.st_cadastro === 'documentacao' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200' :
                          agregado.st_cadastro === 'contrato_enviado' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200' :
                          agregado.st_cadastro === 'repescagem' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {agregado.st_cadastro === 'contrato_enviado' ? 'Contrato Enviado' : 
                           agregado.st_cadastro.charAt(0).toUpperCase() + agregado.st_cadastro.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {agregado.cliente?.nome || 'Sem cliente'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-3">
                          <button 
                            onClick={(e) => handleStartChat(agregado, e)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 
                                     transition-colors"
                            title="Iniciar chat"
                          >
                            <MessageCircle size={18} />
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
                onChange={handleItemsPerPageChange}
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
        onSuccess={fetchAgregados}
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
        message="Escolha a ação que deseja realizar com os agregados selecionados."
        itemCount={selectedItems.size}
        itemType="agregado"
      />

      <MassMessageModal
        isOpen={isMassMessageModalOpen}
        onClose={() => setIsMassMessageModalOpen(false)}
        numbers={Array.from(selectedItems).map(id => {
          const agregado = agregados.find(m => m.motorista_id === id);
          return agregado?.telefone?.toString() || '';
        }).filter(Boolean)}
      />
    </div>
  );
};

export default AgregadosLista;