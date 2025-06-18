import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Edit2, Trash2, ChevronDown, ChevronUp, Filter, MessageCircle, FileText, Truck, User } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import type { Motorista, Veiculo } from '../../types/database';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { formatCPF, formatPhone, formatDate } from '../../utils/format';
import AddAgregadoModal from '../../components/AddAgregadoModal';
import DocumentViewer from '../../components/DocumentViewer';
import AgregadoDetailView from '../../components/AgregadoDetailView';
import { useFloatingChat } from '../../hooks/useFloatingChat';
import { usePagination } from '../../hooks/usePagination';
import Pagination from '../../components/Pagination';
import BulkActionsModal from '../../components/BulkActionsModal';
import BulkDeleteConfirmationModal from '../../components/BulkDeleteConfirmationModal';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import MassMessageModal from '../../components/MassMessageModal';
import BulkStatusModal from '../../components/BulkStatusModal';
import { VEHICLE_TYPES } from '../../constants/vehicleTypes';
import UnifiedMotoristaModal from '../../components/UnifiedMotoristaModal';

interface MotoristaWithVeiculo extends Motorista {
  veiculo?: Veiculo[];
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
  documento?: {
    id_documento_motorista: number;
    foto_cnh: string | null;
    nr_rg: string | null;
    orgao_expedidor: string | null;
    data_expedicao: string | null;
    foto_rg: string | null;
    nome_pai: string | null;
    nome_mae: string | null;
    nr_registro_cnh: number | null;
    categoria_cnh: string | null;
    validade_cnh: string | null;
    foto_comprovante_residencia: string | null;
    motorista_id: number;
  } | null;
  isExpanded?: boolean;
}

const AgregadosLista = () => {
  const { query, companyId } = useCompanyData();
  const { startChat } = useFloatingChat();
  const { companyId: authCompanyId } = useAuth();
  const [motoristas, setMotoristas] = useState<MotoristaWithVeiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  const [isUnifiedModalOpen, setIsUnifiedModalOpen] = useState(false);
  const [selectedMotorista, setSelectedMotorista] = useState<MotoristaWithVeiculo | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [isBulkActionsModalOpen, setIsBulkActionsModalOpen] = useState(false);
  const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMassMessageModalOpen, setIsMassMessageModalOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'status' | 'client'>('status');
  const [clientes, setClientes] = useState<any[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAgregados();
    fetchClientes();
  }, []);

  const fetchAgregados = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vw_agregados_completo')
        .select('*')
        .eq('company_id', authCompanyId);

      if (error) throw error;

      // Sort by nome
      const sortedData = [...(data || [])].sort((a, b) => 
        a.nome.localeCompare(b.nome)
      );

      setMotoristas(sortedData);
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

  const handleDelete = (motorista: MotoristaWithVeiculo) => {
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

      setMotoristas(motoristas.filter(m => m.motorista_id !== selectedMotorista.motorista_id));
      toast.success('Agregado excluído com sucesso');
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting agregado:', error);
      toast.error('Erro ao excluir agregado');
    }
  };

  const handleToggleStatus = async (motorista: MotoristaWithVeiculo) => {
    try {
      setUpdatingStatus(motorista.motorista_id);
      
      const { error } = await supabase
        .from('motorista')
        .update({ ativo: !motorista.ativo })
        .eq('motorista_id', motorista.motorista_id);

      if (error) throw error;

      // Update local state
      setMotoristas(prev => 
        prev.map(m => 
          m.motorista_id === motorista.motorista_id 
            ? { ...m, ativo: !motorista.ativo } 
            : m
        )
      );
      
      toast.success(`Agregado ${!motorista.ativo ? 'ativado' : 'desativado'} com sucesso`);
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Erro ao atualizar status');
    } finally {
      setUpdatingStatus(null);
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
      setMotoristas(motoristas.filter(m => !selectedItems.has(m.motorista_id)));
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
        const { error } = await supabase
          .from('motorista')
          .update({ ativo: activate })
          .eq('motorista_id', id);
          
        if (error) throw error;
      }
      
      // Update the list
      setMotoristas(prev => 
        prev.map(m => 
          selectedItems.has(m.motorista_id) 
            ? { ...m, ativo: activate } 
            : m
        )
      );
      
      toast.success(`${selectedItems.size} agregado${selectedItems.size !== 1 ? 's' : ''} ${activate ? 'ativado' : 'desativado'}${selectedItems.size !== 1 ? 's' : ''} com sucesso`);
      
      // Reset selection
      setSelectedItems(new Set());
      setSelectAll(false);
      setIsBulkStatusModalOpen(false);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const handleBulkAction = async (data: any) => {
    try {
      // Update all selected items
      for (const id of selectedItems) {
        let updateData = {};
        
        if (bulkActionType === 'status') {
          updateData = { st_cadastro: data.selectedStatus };
        } else if (bulkActionType === 'client') {
          updateData = { cliente_id: data.selectedClient ? parseInt(data.selectedClient) : null };
        }
        
        const { error } = await query('motorista')
          .update(updateData)
          .eq('motorista_id', id);
          
        if (error) throw error;
      }
      
      // Refresh the list
      fetchAgregados();
      
      // Reset selection
      setSelectedItems(new Set());
      setSelectAll(false);
      setIsBulkActionsModalOpen(false);
      
      toast.success(`${selectedItems.size} agregado${selectedItems.size !== 1 ? 's' : ''} atualizado${selectedItems.size !== 1 ? 's' : ''} com sucesso`);
    } catch (error) {
      console.error('Error updating agregados:', error);
      toast.error('Erro ao atualizar agregados');
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

  const handleViewDocument = (motorista: MotoristaWithVeiculo) => {
    setSelectedMotorista(motorista);
    setIsDocumentViewerOpen(true);
  };

  const handleViewDetail = (motorista: MotoristaWithVeiculo) => {
    setSelectedMotorista(motorista);
    setIsDetailViewOpen(true);
  };

  const handleViewUnified = (motorista: MotoristaWithVeiculo) => {
    setSelectedMotorista(motorista);
    setIsUnifiedModalOpen(true);
  };

  const toggleExpand = (motorista_id: number) => {
    if (expandedItem === motorista_id) {
      setExpandedItem(null);
    } else {
      setExpandedItem(motorista_id);
    }
  };

  const getVehicleTypeLabel = (type: string) => {
    const vehicleType = VEHICLE_TYPES.find(t => t.value === type);
    return vehicleType ? vehicleType.label : type;
  };

  // Filter motoristas based on search term and status filter
  const filteredMotoristas = motoristas.filter(motorista => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      motorista.nome.toLowerCase().includes(searchLower) ||
      motorista.cpf.includes(searchLower) ||
      (motorista.email && motorista.email.toLowerCase().includes(searchLower)) ||
      (motorista.telefone && motorista.telefone.toString().includes(searchTerm)) ||
      (motorista.veiculo && motorista.veiculo[0]?.placa && motorista.veiculo[0].placa.toLowerCase().includes(searchLower));
    
    const matchesStatus = !statusFilter || motorista.st_cadastro === statusFilter;
    const matchesActive = activeFilter === '' || 
                         (activeFilter === 'active' && motorista.ativo) || 
                         (activeFilter === 'inactive' && !motorista.ativo);
    
    const matchesVehicleType = !vehicleTypeFilter || 
                              (motorista.veiculo && 
                               motorista.veiculo[0]?.tipologia === vehicleTypeFilter);
    
    return matchesSearch && matchesStatus && matchesActive && matchesVehicleType;
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
                onClick={() => setIsBulkStatusModalOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                        transition-colors flex items-center gap-2"
              >
                <Edit2 className="w-5 h-5" />
                Ativar/Desativar
              </button>
              <button
                onClick={() => setIsMassMessageModalOpen(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 
                        focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 
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

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por nome, CPF, email, telefone ou placa..."
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
              <option value="gr">Gestão de Risco</option>
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
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none"
            >
              <option value="">Todos (Ativos/Inativos)</option>
              <option value="active">Somente Ativos</option>
              <option value="inactive">Somente Inativos</option>
            </select>
            <User className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <ChevronDown className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>

          <div className="relative">
            <select
              value={vehicleTypeFilter}
              onChange={(e) => setVehicleTypeFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none"
            >
              <option value="">Todos os tipos de veículo</option>
              {VEHICLE_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <Truck className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Contato</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Veículo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Ativo</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedData.map((motorista) => (
                    <React.Fragment key={motorista.motorista_id}>
                      <tr 
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                          selectedItems.has(motorista.motorista_id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        } ${!motorista.ativo ? 'opacity-60' : ''}`}
                        onClick={() => toggleExpand(motorista.motorista_id)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedItems.has(motorista.motorista_id)}
                            onChange={() => handleSelectItem(motorista.motorista_id)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                              <span className="text-lg font-medium text-blue-600 dark:text-blue-400">
                                {motorista.nome.charAt(0)}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {motorista.nome}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {formatCPF(motorista.cpf)}
                              </div>
                            </div>
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
                          {motorista.veiculo && motorista.veiculo.length > 0 ? (
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white uppercase">
                                {motorista.veiculo[0].placa}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {motorista.veiculo[0].tipologia && getVehicleTypeLabel(motorista.veiculo[0].tipologia)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500 dark:text-gray-400">Sem veículo</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-medium rounded-full ${
                            motorista.st_cadastro === 'contratado'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                              : motorista.st_cadastro === 'rejeitado'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200'
                          }`}>
                            {motorista.st_cadastro === 'cadastrado' && 'Cadastrado'}
                            {motorista.st_cadastro === 'qualificado' && 'Qualificado'}
                            {motorista.st_cadastro === 'documentacao' && 'Documentação'}
                            {motorista.st_cadastro === 'gr' && 'Gestão de Risco'}
                            {motorista.st_cadastro === 'contrato_enviado' && 'Contrato Enviado'}
                            {motorista.st_cadastro === 'contratado' && 'Contratado'}
                            {motorista.st_cadastro === 'repescagem' && 'Repescagem'}
                            {motorista.st_cadastro === 'rejeitado' && 'Rejeitado'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStatus(motorista);
                            }}
                            disabled={updatingStatus === motorista.motorista_id}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                              motorista.ativo 
                                ? 'bg-green-500 dark:bg-green-600' 
                                : 'bg-gray-200 dark:bg-gray-700'
                            } ${updatingStatus === motorista.motorista_id ? 'opacity-50 cursor-not-allowed' : ''}`}
                            role="switch"
                            aria-checked={motorista.ativo}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                motorista.ativo ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                            {updatingStatus === motorista.motorista_id && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
                              </div>
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (motorista.telefone) {
                                  startChat(motorista.telefone.toString(), motorista.nome);
                                } else {
                                  toast.error('Este agregado não possui telefone cadastrado');
                                }
                              }}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                              title="Iniciar chat"
                            >
                              <MessageCircle size={18} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewDocument(motorista);
                              }}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                              title="Ver documentos"
                            >
                              <FileText size={18} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewUnified(motorista);
                              }}
                              className="text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300 transition-colors"
                              title="Editar"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(motorista);
                              }}
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Expanded row */}
                      {expandedItem === motorista.motorista_id && (
                        <tr className="bg-gray-50 dark:bg-gray-700/30">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Informações Pessoais</h4>
                                <div className="space-y-1">
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    <span className="font-medium">Data de Nascimento:</span> {motorista.dt_nascimento ? formatDate(motorista.dt_nascimento) : 'Não informada'}
                                  </p>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    <span className="font-medium">Gênero:</span> {motorista.genero || 'Não informado'}
                                  </p>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    <span className="font-medium">Data de Cadastro:</span> {formatDate(motorista.data_cadastro)}
                                  </p>
                                </div>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Endereço</h4>
                                {motorista.endereco?.logradouro ? (
                                  <div className="space-y-1">
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                      {motorista.endereco.logradouro.logradouro}, {motorista.endereco.nr_end || 'S/N'}
                                      {motorista.endereco.ds_complemento_end && ` - ${motorista.endereco.ds_complemento_end}`}
                                    </p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                      {motorista.endereco.logradouro.bairro?.bairro}, {motorista.endereco.logradouro.bairro?.cidade?.cidade}/{motorista.endereco.logradouro.bairro?.cidade?.estado?.sigla_estado}
                                    </p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                      CEP: {motorista.endereco.logradouro.nr_cep}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500 dark:text-gray-400">Endereço não cadastrado</p>
                                )}
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Documentos</h4>
                                <div className="space-y-1">
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    <span className="font-medium">CNH:</span> {motorista.documento?.nr_registro_cnh ? 'Cadastrada' : 'Não cadastrada'}
                                  </p>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    <span className="font-medium">Categoria:</span> {motorista.documento?.categoria_cnh || 'Não informada'}
                                  </p>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    <span className="font-medium">Validade:</span> {motorista.documento?.validade_cnh ? formatDate(motorista.documento.validade_cnh) : 'Não informada'}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="mt-4 flex justify-end">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewDetail(motorista);
                                }}
                                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                                         transition-colors"
                              >
                                Ver Detalhes Completos
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {filteredMotoristas.length === 0 ? (
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

      <AddAgregadoModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchAgregados}
      />

      <DocumentViewer
        isOpen={isDocumentViewerOpen}
        onClose={() => setIsDocumentViewerOpen(false)}
        documento={selectedMotorista?.documento || null}
        nome={selectedMotorista?.nome || ''}
        cpf={selectedMotorista?.cpf}
        email={selectedMotorista?.email}
        telefone={selectedMotorista?.telefone?.toString()}
        dt_nascimento={selectedMotorista?.dt_nascimento}
        endereco={selectedMotorista?.endereco}
        veiculo={selectedMotorista?.veiculo?.[0]}
        isAgregado={true}
        st_cadastro={selectedMotorista?.st_cadastro}
      />

      <AgregadoDetailView
        isOpen={isDetailViewOpen}
        onClose={() => setIsDetailViewOpen(false)}
        agregado={selectedMotorista}
        onSuccess={fetchAgregados}
        documento={selectedMotorista?.documento || null}
        veiculo={selectedMotorista?.veiculo?.[0] || null}
        endereco={selectedMotorista?.endereco}
      />

      <UnifiedMotoristaModal
        isOpen={isUnifiedModalOpen}
        onClose={() => setIsUnifiedModalOpen(false)}
        motorista={selectedMotorista}
        onSuccess={fetchAgregados}
      />

      <BulkActionsModal
        isOpen={isBulkActionsModalOpen}
        onClose={() => setIsBulkActionsModalOpen(false)}
        selectedItems={selectedItems}
        actionType={bulkActionType}
        onSuccess={handleBulkAction}
        clientes={clientes}
      />

      <BulkStatusModal
        isOpen={isBulkStatusModalOpen}
        onClose={() => setIsBulkStatusModalOpen(false)}
        onConfirm={handleBulkStatusUpdate}
        title="Atualizar Status"
        message="Escolha se deseja ativar ou desativar os agregados selecionados."
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

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este agregado? Esta ação não pode ser desfeita."
        itemData={selectedMotorista ? [
          { label: 'Nome', value: selectedMotorista.nome },
          { label: 'CPF', value: formatCPF(selectedMotorista.cpf) },
          { label: 'Veículo', value: selectedMotorista.veiculo && selectedMotorista.veiculo.length > 0 ? selectedMotorista.veiculo[0].placa.toUpperCase() : 'Sem veículo' }
        ] : []}
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

export default AgregadosLista;