import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Truck, User, FileText, Edit2, Trash2, ChevronDown, ChevronUp, Filter, FilePen } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { supabase } from '../../lib/supabase';
import type { Motorista, DocumentoMotorista, Veiculo, DocumentoVeiculo } from '../../types/database';
import toast from 'react-hot-toast';
import { formatCPF, formatPhone, formatDate } from '../../utils/format';
import AddAgregadoModal from '../../components/AddAgregadoModal';
import EditMotoristaModal from '../../components/EditMotoristaModal';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import DocumentViewer from '../../components/DocumentViewer';
import AgregadoDetailView from '../../components/AgregadoDetailView';
import BulkActionsModal from '../../components/BulkActionsModal';
import BulkDeleteConfirmationModal from '../../components/BulkDeleteConfirmationModal';
import MassMessageModal from '../../components/MassMessageModal';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useFloatingChat } from '../../hooks/useFloatingChat';
import UnifiedAgregadoModal from '../../components/UnifiedAgregadoModal';

interface AgregadoWithDetails extends Motorista {
  veiculo?: Veiculo[];
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
  const { query } = useCompanyData();
  const { companyId } = useAuth();
  const { startChat } = useFloatingChat();
  const [agregados, setAgregados] = useState<AgregadoWithDetails[]>([]);
  const [filteredAgregados, setFilteredAgregados] = useState<AgregadoWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [clienteFilter, setClienteFilter] = useState('todos');
  const [clientes, setClientes] = useState<{ cliente_id: number; nome: string }[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  const [isUnifiedModalOpen, setIsUnifiedModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [isBulkActionsModalOpen, setIsBulkActionsModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isMassMessageModalOpen, setIsMassMessageModalOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'status' | 'client'>('status');
  const [selectedAgregado, setSelectedAgregado] = useState<AgregadoWithDetails | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Motorista;
    direction: 'asc' | 'desc';
  }>({ key: 'nome', direction: 'asc' });
  const [selectedDocumento, setSelectedDocumento] = useState<{
    documento: DocumentoMotorista | null;
    nome: string;
    endereco: any;
    veiculo: (Veiculo & { documento_veiculo: DocumentoVeiculo[] }) | null;
  }>({
    documento: null,
    nome: '',
    endereco: null,
    veiculo: null
  });
  
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAgregados();
    fetchClientes();
  }, []);

  useEffect(() => {
    filterAgregados();
  }, [agregados, searchTerm, statusFilter, clienteFilter]);

  const fetchAgregados = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vw_agregados_completo')
        .select('*')
        .eq('company_id', companyId);

      if (error) throw error;

      // Fetch veiculos for each agregado
      const agregadosWithVehicles = await Promise.all(
        (data || []).map(async (agregado) => {
          const { data: veiculoData, error: veiculoError } = await supabase
            .from('veiculo')
            .select('*')
            .eq('motorista_id', agregado.motorista_id)
            .eq('status_veiculo', true);

          if (veiculoError) {
            console.error('Error fetching veiculo:', veiculoError);
            return { ...agregado, veiculo: [] };
          }

          return { ...agregado, veiculo: veiculoData || [] };
        })
      );

      setAgregados(agregadosWithVehicles);
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

  const filterAgregados = () => {
    let filtered = [...agregados];

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        agregado =>
          agregado.nome.toLowerCase().includes(searchLower) ||
          agregado.cpf.includes(searchTerm) ||
          (agregado.telefone && agregado.telefone.toString().includes(searchTerm)) ||
          (agregado.email && agregado.email.toLowerCase().includes(searchLower)) ||
          (agregado.veiculo && agregado.veiculo.some(v => v.placa.toLowerCase().includes(searchLower)))
      );
    }

    // Apply status filter
    if (statusFilter !== 'todos') {
      filtered = filtered.filter(agregado => agregado.st_cadastro === statusFilter);
    }

    // Apply cliente filter
    if (clienteFilter !== 'todos') {
      if (clienteFilter === 'sem_cliente') {
        filtered = filtered.filter(agregado => !agregado.cliente_id);
      } else {
        filtered = filtered.filter(agregado => agregado.cliente_id === parseInt(clienteFilter));
      }
    }

    // Apply sorting
    filtered.sort((a, b) => {
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

    setFilteredAgregados(filtered);
    setTotalPages(Math.ceil(filtered.length / itemsPerPage));
  };

  const handleEdit = (agregado: AgregadoWithDetails) => {
    setSelectedAgregado(agregado);
    setIsEditModalOpen(true);
  };

  const handleDelete = (agregado: AgregadoWithDetails) => {
    setSelectedAgregado(agregado);
    setIsDeleteModalOpen(true);
  };

  const handleViewDetails = (agregado: AgregadoWithDetails) => {
    setSelectedAgregado(agregado);
    setIsDetailViewOpen(true);
  };

  const handleOpenUnifiedModal = (agregado: AgregadoWithDetails) => {
    setSelectedAgregado(agregado);
    setIsUnifiedModalOpen(true);
  };

  const handleViewDocument = async (agregado: AgregadoWithDetails) => {
    try {
      setSelectedDocumento({
        documento: null,
        nome: agregado.nome,
        endereco: null,
        veiculo: null
      });
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
            documento_veiculo (*)
          `)
          .eq('motorista_id', agregado.motorista_id)
          .eq('status_veiculo', true)
          .maybeSingle()
      ]);

      if (documentoResponse.error) throw new Error(`Erro ao buscar documentos: ${documentoResponse.error.message}`);
      if (enderecoResponse.error) throw new Error(`Erro ao buscar endereço: ${enderecoResponse.error.message}`);
      if (veiculoResponse.error) throw new Error(`Erro ao buscar veículo: ${veiculoResponse.error.message}`);

      setSelectedDocumento({
        documento: documentoResponse.data,
        nome: agregado.nome,
        endereco: enderecoResponse.data,
        veiculo: veiculoResponse.data
      });
    } catch (error) {
      console.error('Erro ao carregar documentos:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar documentos');
      setIsDocumentViewerOpen(false);
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

  const handleBulkAction = async (actionType: 'status' | 'client', value: string) => {
    try {
      if (actionType === 'status') {
        // Update status for all selected items
        for (const id of selectedItems) {
          const { error } = await query('motorista')
            .update({ st_cadastro: value })
            .eq('motorista_id', id);
            
          if (error) throw error;
        }
        
        // Update local state
        setAgregados(agregados.map(a => 
          selectedItems.has(a.motorista_id) ? { ...a, st_cadastro: value } : a
        ));
        
        toast.success(`Status atualizado para ${selectedItems.size} agregado${selectedItems.size !== 1 ? 's' : ''}`);
      } else if (actionType === 'client') {
        // Update client for all selected items
        const clienteId = value ? parseInt(value) : null;
        
        for (const id of selectedItems) {
          const { error } = await query('motorista')
            .update({ cliente_id: clienteId })
            .eq('motorista_id', id);
            
          if (error) throw error;
        }
        
        // Update local state
        setAgregados(agregados.map(a => 
          selectedItems.has(a.motorista_id) ? { ...a, cliente_id: clienteId } : a
        ));
        
        toast.success(`Cliente atualizado para ${selectedItems.size} agregado${selectedItems.size !== 1 ? 's' : ''}`);
      }
      
      // Reset selection
      setSelectedItems(new Set());
      setSelectAll(false);
      setIsBulkActionsModalOpen(false);
    } catch (error) {
      console.error('Error performing bulk action:', error);
      toast.error('Erro ao atualizar agregados');
    }
  };

  const handleSort = (key: keyof Motorista) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (perPage: number) => {
    setItemsPerPage(perPage);
    setCurrentPage(1); // Reset to first page
  };

  const getPaginatedData = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAgregados.slice(startIndex, endIndex);
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

  const formatStatus = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
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
                <Edit2 className="w-5 h-5" />
                Atualizar Cliente
              </button>
              <button
                onClick={() => setIsBulkDeleteModalOpen(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 
                        focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 
                        transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-5 h-5" />
                Excluir Selecionados
              </button>
              <button
                onClick={() => {
                  const phoneNumbers = Array.from(selectedItems)
                    .map(id => {
                      const agregado = agregados.find(a => a.motorista_id === id);
                      return agregado?.telefone ? agregado.telefone.toString() : null;
                    })
                    .filter(Boolean) as string[];
                  
                  if (phoneNumbers.length === 0) {
                    toast.error('Nenhum dos agregados selecionados possui telefone cadastrado');
                    return;
                  }
                  
                  setIsMassMessageModalOpen(true);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 
                        focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 
                        transition-colors flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z" />
                  <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" />
                </svg>
                Mensagem em Massa
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
              placeholder="Buscar por nome, CPF, telefone, email ou placa..."
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

          <div className="relative">
            <select
              value={clienteFilter}
              onChange={(e) => setClienteFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none"
            >
              <option value="todos">Todos os clientes</option>
              <option value="sem_cliente">Sem cliente</option>
              {clientes.map(cliente => (
                <option key={cliente.cliente_id} value={cliente.cliente_id.toString()}>
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
            <div ref={tableRef} className="overflow-x-auto w-full">
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
                          sortConfig.direction === 'asc' ? 
                            <ChevronUp className="ml-1 w-4 h-4" /> : 
                            <ChevronDown className="ml-1 w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Veículo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Contato</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Cliente</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {getPaginatedData().map((agregado) => (
                    <tr 
                      key={agregado.motorista_id} 
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
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
                              {formatCPF(agregado.cpf)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {agregado.veiculo && agregado.veiculo.length > 0 ? (
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white uppercase">
                              {agregado.veiculo[0].placa}
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {agregado.telefone ? (
                            <button 
                              onClick={() => startChat(agregado.telefone!.toString(), agregado.nome)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline flex items-center gap-1"
                            >
                              {formatPhone(agregado.telefone.toString())}
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z" />
                                <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" />
                              </svg>
                            </button>
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400">Não informado</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {agregado.email || 'Email não informado'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {agregado.cliente_id ? (
                            clientes.find(c => c.cliente_id === agregado.cliente_id)?.nome || 'Cliente não encontrado'
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400">Sem cliente</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusClass(agregado.st_cadastro)}`}>
                          {formatStatus(agregado.st_cadastro)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-3">
                          <button
                            onClick={() => handleViewDocument(agregado)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            title="Ver documentos"
                          >
                            <FileText size={18} />
                          </button>
                          <button
                            onClick={() => handleOpenUnifiedModal(agregado)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            title="Visualizar detalhes"
                          >
                            <FilePen size={18} />
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
        
        {filteredAgregados.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              Nenhum agregado encontrado
            </p>
          </div>
        ) : (
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
        )}
      </div>

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

      <AgregadoDetailView
        isOpen={isDetailViewOpen}
        onClose={() => setIsDetailViewOpen(false)}
        agregado={selectedAgregado}
        onSuccess={fetchAgregados}
        documento={selectedAgregado?.documento || null}
        veiculo={selectedAgregado?.veiculo?.[0] as any || null}
        endereco={selectedAgregado?.endereco || null}
      />

      <UnifiedAgregadoModal
        isOpen={isUnifiedModalOpen}
        onClose={() => setIsUnifiedModalOpen(false)}
        agregado={selectedAgregado}
        onSuccess={fetchAgregados}
      />

      <DocumentViewer
        isOpen={isDocumentViewerOpen}
        onClose={() => setIsDocumentViewerOpen(false)}
        documento={selectedDocumento.documento}
        nome={selectedDocumento.nome}
        endereco={selectedDocumento.endereco}
        veiculo={selectedDocumento.veiculo}
        isAgregado={true}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={async () => {
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
        }}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este agregado? Esta ação não pode ser desfeita."
        itemData={[
          { label: 'Nome', value: selectedAgregado?.nome || '' },
          { label: 'CPF', value: selectedAgregado?.cpf ? formatCPF(selectedAgregado.cpf) : '' },
          { label: 'Veículo', value: selectedAgregado?.veiculo?.[0]?.placa ? selectedAgregado.veiculo[0].placa.toUpperCase() : 'Sem veículo' }
        ]}
      />

      <BulkActionsModal
        isOpen={isBulkActionsModalOpen}
        onClose={() => setIsBulkActionsModalOpen(false)}
        selectedItems={selectedItems}
        actionType={bulkActionType}
        onSuccess={() => {
          setIsBulkActionsModalOpen(false);
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

      <MassMessageModal
        isOpen={isMassMessageModalOpen}
        onClose={() => setIsMassMessageModalOpen(false)}
        numbers={Array.from(selectedItems)
          .map(id => {
            const agregado = agregados.find(a => a.motorista_id === id);
            return agregado?.telefone ? agregado.telefone.toString() : null;
          })
          .filter(Boolean) as string[]}
      />
    </div>
  );
};

export default AgregadosLista;