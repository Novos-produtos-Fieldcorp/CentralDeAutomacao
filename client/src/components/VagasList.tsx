import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Users, Building, Clock, Edit2, Trash2, Eye, ChevronDown, Search, Filter, X, Plus, LayoutGrid, LayoutList, Briefcase } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { Vaga } from '@shared/schema';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { queryClient } from '../lib/queryClient';
import VagaDetailsModal from './VagaDetailsModal';
import {
  fetchVagasWithRelations,
  fetchStatusVagas,
  fetchClientes,
  fetchUnidades,
  fetchOperacoes,
  fetchCompanyByAccount,
  updateVagaStatus,
  deleteVaga,
  VagaWithRelations
} from '../lib/vagasService';

interface VagasListProps {
  onRefresh: () => void;
  onAddClick?: () => void;
}

const VagasList: React.FC<VagasListProps> = ({ onRefresh, onAddClick }) => {
  const { accountId } = useAuth();
  const [selectedVaga, setSelectedVaga] = useState<VagaWithRelations | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [clienteFilter, setClienteFilter] = useState<string[]>([]);
  const [unidadeFilter, setUnidadeFilter] = useState<string[]>([]);
  const [operacaoFilter, setOperacaoFilter] = useState<string[]>([]);
  const [quantidadeFilter, setQuantidadeFilter] = useState<{min: number | null, max: number | null}>({min: null, max: null});
  const [dateFilter, setDateFilter] = useState<{start: string, end: string}>({start: '', end: ''});
  
  // Dropdown states
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [showUnidadeDropdown, setShowUnidadeDropdown] = useState(false);
  const [showOperacaoDropdown, setShowOperacaoDropdown] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Get company data first
  const { data: companyData, isLoading: companyLoading, error: companyError } = useQuery({
    queryKey: ['company', accountId],
    queryFn: () => fetchCompanyByAccount(accountId || ''),
    enabled: !!accountId,
  });

  const companyId = companyData?.company_id;

  // Fetch all data using React Query
  const { data: vagas = [], isLoading: vagasLoading, error: vagasError } = useQuery({
    queryKey: ['vagas', companyId],
    queryFn: () => fetchVagasWithRelations(companyId!),
    enabled: !!companyId,
  });

  const { data: statusOptions = [] } = useQuery({
    queryKey: ['status-vagas', companyId],
    queryFn: () => fetchStatusVagas(companyId!),
    enabled: !!companyId,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes', companyId],
    queryFn: () => fetchClientes(companyId!),
    enabled: !!companyId,
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ['unidades', companyId],
    queryFn: () => fetchUnidades(companyId!),
    enabled: !!companyId,
  });

  const { data: operacoes = [] } = useQuery({
    queryKey: ['operacoes', companyId],
    queryFn: () => fetchOperacoes(companyId!),
    enabled: !!companyId,
  });

  // Create mutations for CRUD operations
  const updateStatusMutation = useMutation({
    mutationFn: ({ vagaId, statusId }: { vagaId: number; statusId: number }) =>
      updateVagaStatus(vagaId, statusId, companyId!),
    onSuccess: () => {
      toast.success('Status atualizado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['vagas', companyId] });
      // Removed redundant onRefresh() - queryClient.invalidateQueries already refreshes data
    },
    onError: (error) => {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status');
    },
  });

  const deleteVagaMutation = useMutation({
    mutationFn: (vagaId: number) => deleteVaga(vagaId, companyId!),
    onSuccess: () => {
      toast.success('Vaga deletada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['vagas', companyId] });
      // Removed redundant onRefresh() - queryClient.invalidateQueries already refreshes data
    },
    onError: (error) => {
      console.error('Error deleting vaga:', error);
      toast.error('Erro ao deletar vaga');
    },
  });

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showStatusDropdown && !(event.target as HTMLElement).closest('#status-dropdown')) {
        setShowStatusDropdown(false);
      }
      if (showClienteDropdown && !(event.target as HTMLElement).closest('#cliente-dropdown')) {
        setShowClienteDropdown(false);
      }
      if (showUnidadeDropdown && !(event.target as HTMLElement).closest('#unidade-dropdown')) {
        setShowUnidadeDropdown(false);
      }
      if (showOperacaoDropdown && !(event.target as HTMLElement).closest('#operacao-dropdown')) {
        setShowOperacaoDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showStatusDropdown, showClienteDropdown, showUnidadeDropdown, showOperacaoDropdown]);

  // Filter helper functions
  const toggleFilterOption = (filterType: string, value: string) => {
    switch (filterType) {
      case 'status':
        setStatusFilter(prev => 
          prev.includes(value) 
            ? prev.filter(item => item !== value)
            : [...prev, value]
        );
        break;
      case 'cliente':
        setClienteFilter(prev => 
          prev.includes(value) 
            ? prev.filter(item => item !== value)
            : [...prev, value]
        );
        break;
      case 'unidade':
        setUnidadeFilter(prev => 
          prev.includes(value) 
            ? prev.filter(item => item !== value)
            : [...prev, value]
        );
        break;
      case 'operacao':
        setOperacaoFilter(prev => 
          prev.includes(value) 
            ? prev.filter(item => item !== value)
            : [...prev, value]
        );
        break;
    }
  };

  const hasActiveFilters = () => {
    return statusFilter.length > 0 || clienteFilter.length > 0 || unidadeFilter.length > 0 || 
           operacaoFilter.length > 0 || quantidadeFilter.min !== null || quantidadeFilter.max !== null || 
           dateFilter.start || dateFilter.end;
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (statusFilter.length > 0) count++;
    if (clienteFilter.length > 0) count++;
    if (unidadeFilter.length > 0) count++;
    if (operacaoFilter.length > 0) count++;
    if (quantidadeFilter.min !== null || quantidadeFilter.max !== null) count++;
    if (dateFilter.start || dateFilter.end) count++;
    return count;
  };

  const clearFilter = (filterType: string) => {
    switch (filterType) {
      case 'status':
        setStatusFilter([]);
        break;
      case 'cliente':
        setClienteFilter([]);
        break;
      case 'unidade':
        setUnidadeFilter([]);
        break;
      case 'operacao':
        setOperacaoFilter([]);
        break;
      case 'quantidade':
        setQuantidadeFilter({min: null, max: null});
        break;
      case 'data':
        setDateFilter({start: '', end: ''});
        break;
    }
  };

  const getFilterButtonText = (filterType: string) => {
    switch (filterType) {
      case 'status':
        return statusFilter.length > 0 ? `Status (${statusFilter.length})` : 'Filtrar por Status';
      case 'cliente':
        return clienteFilter.length > 0 ? `Cliente (${clienteFilter.length})` : 'Filtrar por Cliente';
      case 'unidade':
        return unidadeFilter.length > 0 ? `Unidade (${unidadeFilter.length})` : 'Filtrar por Unidade';
      case 'operacao':
        return operacaoFilter.length > 0 ? `Operação (${operacaoFilter.length})` : 'Filtrar por Operação';
      default:
        return 'Filtrar';
    }
  };

  // Loading states
  const loading = companyLoading || vagasLoading;
  const error = companyError || vagasError;
  const filteredVagas = vagas.filter((vaga) => {
    const searchLower = searchTerm.toLowerCase();
    
    // Search filter
    const searchMatch = searchTerm === '' || 
      (vaga.nome || '').toLowerCase().includes(searchLower) ||
      (vaga.descricao || '').toLowerCase().includes(searchLower) ||
      (vaga.cliente_nome || '').toLowerCase().includes(searchLower) ||
      (vaga.unidade_nome || '').toLowerCase().includes(searchLower) ||
      (vaga.operacao_nome || '').toLowerCase().includes(searchLower);
    
    // Status filter
    const statusMatch = statusFilter.length === 0 || 
      (vaga.st_vaga_id && statusFilter.includes(vaga.st_vaga_id.toString()));
    
    // Cliente filter
    const clienteMatch = clienteFilter.length === 0 || 
      (vaga.cliente_id && clienteFilter.includes(vaga.cliente_id.toString()));
    
    // Unidade filter
    const unidadeMatch = unidadeFilter.length === 0 || 
      (vaga.unidade_id && unidadeFilter.includes(vaga.unidade_id.toString()));
    
    // Operacao filter
    const operacaoMatch = operacaoFilter.length === 0 || 
      (vaga.operacao_id && operacaoFilter.includes(vaga.operacao_id.toString()));
    
    // Quantidade filter
    const vagaQuantidade = vaga.quantidade ? Number(vaga.quantidade) : 0;
    const quantidadeMatch = (quantidadeFilter.min === null || vagaQuantidade >= quantidadeFilter.min) &&
      (quantidadeFilter.max === null || vagaQuantidade <= quantidadeFilter.max);
    
    // Data filter (dt_limite)
    const dataMatch = dateFilter.start === '' || dateFilter.end === '' || 
      (vaga.dt_limite && 
       new Date(vaga.dt_limite) >= new Date(dateFilter.start) && 
       new Date(vaga.dt_limite) <= new Date(dateFilter.end));
    
    return searchMatch && statusMatch && clienteMatch && unidadeMatch && operacaoMatch && quantidadeMatch && dataMatch;
  });

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    try {
      return format(new Date(date), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return '-';
    }
  };

  const handleStatusChange = (vagaId: number, newStatusId: number) => {
    updateStatusMutation.mutate({ vagaId, statusId: newStatusId });
  };

  const handleDeleteVaga = (vagaId: number) => {
    // Show confirmation toast
    toast((t) => (
      <div className="flex items-center space-x-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">Deletar vaga?</p>
          <p className="text-xs text-gray-500">Esta ação não pode ser desfeita</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => {
              toast.dismiss(t.id);
              deleteVagaMutation.mutate(vagaId);
            }}
            className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700"
          >
            Deletar
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="bg-gray-200 text-gray-800 px-3 py-1 rounded text-xs hover:bg-gray-300"
          >
            Cancelar
          </button>
        </div>
      </div>
    ), {
      duration: 5000,
      position: 'top-center',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'aberta':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'fechada':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      case 'pausada':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="text-center py-8">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4">
          {/* Compact header with search and add button */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            {/* Search bar */}
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Buscar vagas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              />
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Filter toggle and add button */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                  showAdvancedFilters || hasActiveFilters()
                    ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                <Filter size={16} />
                Filtros
                {hasActiveFilters() && (
                  <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {getActiveFiltersCount()}
                  </span>
                )}
                <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedFilters ? 'transform rotate-180' : ''}`} />
              </button>
              
              {onAddClick && (
                <button
                  onClick={onAddClick}
                  className="inline-flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                  title="Adicionar Vaga"
                >
                  <Plus size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Advanced filters - collapsible */}
          {showAdvancedFilters && (
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Status Filter */}
                <div className="relative" id="status-dropdown">
                  <button
                    type="button"
                    onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                    className="w-full flex justify-between items-center pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-left text-sm"
                  >
                    <span className="truncate">{getFilterButtonText('status')}</span>
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ml-2 ${showStatusDropdown ? 'transform rotate-180' : ''}`} />
                  </button>
                  <Building className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  {showStatusDropdown && (
                    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-48 overflow-auto">
                      <div className="px-3 py-1.5 flex justify-between items-center border-b border-gray-200 dark:border-gray-600">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Selecione os status</span>
                        <button 
                          type="button" 
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setStatusFilter([]);
                          }}
                        >
                          Limpar
                        </button>
                      </div>
                      {statusOptions.map((status) => (
                        <div key={status.id} className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer flex items-center">
                          <input
                            type="checkbox"
                            id={`status-${status.id}`}
                            checked={statusFilter.includes(status.id.toString())}
                            onChange={() => toggleFilterOption('status', status.id.toString())}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <label htmlFor={`status-${status.id}`} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                            {status.status_vaga}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cliente Filter */}
                <div className="relative" id="cliente-dropdown">
                  <button
                    type="button" 
                    onClick={() => setShowClienteDropdown(!showClienteDropdown)}
                    className="w-full flex justify-between items-center pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-left text-sm"
                  >
                    <span className="truncate">{getFilterButtonText('cliente')}</span>
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ml-2 ${showClienteDropdown ? 'transform rotate-180' : ''}`} />
                  </button>
                  <Users className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  {showClienteDropdown && (
                    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-48 overflow-auto">
                      <div className="px-3 py-1.5 flex justify-between items-center border-b border-gray-200 dark:border-gray-600">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Selecione os clientes</span>
                        <button 
                          type="button" 
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setClienteFilter([]);
                          }}
                        >
                          Limpar
                        </button>
                      </div>
                      {clientes.map((cliente) => (
                        <div key={cliente.cliente_id} className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer flex items-center">
                          <input
                            type="checkbox"
                            id={`cliente-${cliente.cliente_id}`}
                            checked={clienteFilter.includes(cliente.cliente_id.toString())}
                            onChange={() => toggleFilterOption('cliente', cliente.cliente_id.toString())}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <label htmlFor={`cliente-${cliente.cliente_id}`} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                            {cliente.nome}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Unidade Filter */}
                <div className="relative" id="unidade-dropdown">
                  <button
                    type="button"
                    onClick={() => setShowUnidadeDropdown(!showUnidadeDropdown)}
                    className="w-full flex justify-between items-center pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-left text-sm"
                  >
                    <span className="truncate">{getFilterButtonText('unidade')}</span>
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ml-2 ${showUnidadeDropdown ? 'transform rotate-180' : ''}`} />
                  </button>
                  <Building className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  {showUnidadeDropdown && (
                    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-48 overflow-auto">
                      <div className="px-3 py-1.5 flex justify-between items-center border-b border-gray-200 dark:border-gray-600">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Selecione as unidades</span>
                        <button 
                          type="button" 
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setUnidadeFilter([]);
                          }}
                        >
                          Limpar
                        </button>
                      </div>
                      {unidades.map((unidade) => (
                        <div key={unidade.id} className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer flex items-center">
                          <input
                            type="checkbox"
                            id={`unidade-${unidade.id}`}
                            checked={unidadeFilter.includes(unidade.id.toString())}
                            onChange={() => toggleFilterOption('unidade', unidade.id.toString())}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <label htmlFor={`unidade-${unidade.id}`} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                            {unidade.unidade}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Operacao Filter */}
                <div className="relative" id="operacao-dropdown">
                  <button
                    type="button"
                    onClick={() => setShowOperacaoDropdown(!showOperacaoDropdown)}
                    className="w-full flex justify-between items-center pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-left text-sm"
                  >
                    <span className="truncate">{getFilterButtonText('operacao')}</span>
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ml-2 ${showOperacaoDropdown ? 'transform rotate-180' : ''}`} />
                  </button>
                  <MapPin className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  {showOperacaoDropdown && (
                    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-48 overflow-auto">
                      <div className="px-3 py-1.5 flex justify-between items-center border-b border-gray-200 dark:border-gray-600">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Selecione as operações</span>
                        <button 
                          type="button" 
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOperacaoFilter([]);
                          }}
                        >
                          Limpar
                        </button>
                      </div>
                      {operacoes.map((operacao) => (
                        <div key={operacao.id} className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer flex items-center">
                          <input
                            type="checkbox"
                            id={`operacao-${operacao.id}`}
                            checked={operacaoFilter.includes(operacao.id.toString())}
                            onChange={() => toggleFilterOption('operacao', operacao.id.toString())}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <label htmlFor={`operacao-${operacao.id}`} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                            {operacao.operacao}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Compact date and quantity filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dateFilter.start}
                    onChange={(e) => setDateFilter(prev => ({...prev, start: e.target.value}))}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                    title="Data inicial"
                  />
                  <input
                    type="date"
                    value={dateFilter.end}
                    onChange={(e) => setDateFilter(prev => ({...prev, end: e.target.value}))}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                    title="Data final"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Qtde Min"
                    value={quantidadeFilter.min || ''}
                    onChange={(e) => setQuantidadeFilter(prev => ({...prev, min: e.target.value ? Number(e.target.value) : null}))}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Qtde Max"
                    value={quantidadeFilter.max || ''}
                    onChange={(e) => setQuantidadeFilter(prev => ({...prev, max: e.target.value ? Number(e.target.value) : null}))}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  />
                </div>
              </div>

              {/* Active filters summary */}
              {hasActiveFilters() && (
                <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {filteredVagas.length} de {vagas.length} vagas
                  </span>
                  <button
                    onClick={() => {
                      setStatusFilter([]);
                      setClienteFilter([]);
                      setUnidadeFilter([]);
                      setOperacaoFilter([]);
                      setQuantidadeFilter({min: null, max: null});
                      setDateFilter({start: '', end: ''});
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Limpar filtros
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        {filteredVagas.length === 0 ? (
          <div className="p-6 text-center py-12">
            <Building className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Nenhuma vaga encontrada
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Crie sua primeira vaga para começar
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Vaga
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Cliente/Unidade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Operação
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Tipo Contrato
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Quantidade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Data Limite
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredVagas.map((vaga) => (
                <tr key={vaga.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {vaga.nome || 'Sem nome'}
                      </div>
                      {vaga.descricao && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                          {vaga.descricao}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      <div className="flex items-center">
                        <Building size={16} className="mr-1 text-gray-400" />
                        {(vaga as any).cliente_nome || 'Sem cliente'}
                      </div>
                      {(vaga as any).unidade_nome && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {(vaga as any).unidade_nome}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {(vaga as any).operacao_nome || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900 dark:text-white">
                      <Briefcase size={16} className="mr-1 text-gray-400" />
                      {vaga.tipo_contrato || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900 dark:text-white">
                      <Users size={16} className="mr-1 text-gray-400" />
                      {vaga.quantidade || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900 dark:text-white">
                      <Calendar size={16} className="mr-1 text-gray-400" />
                      {formatDate(vaga.dt_limite?.toString() || null)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="relative">
                      <select
                        value={vaga.st_vaga_id || ''}
                        onChange={(e) => handleStatusChange(vaga.id, Number(e.target.value))}
                        className={`appearance-none px-3 py-1 text-xs font-semibold rounded-full border-0 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer ${getStatusColor((vaga as any).status_nome || 'Ativa')}`}
                        style={{ paddingRight: '24px' }}
                      >
                        {statusOptions.map((status) => (
                          <option key={status.id} value={status.id} className="bg-white text-gray-900">
                            {status.status_vaga}
                          </option>
                        ))}
                      </select>
                      <ChevronDown 
                        size={12} 
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none text-current" 
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => {
                          setSelectedVaga(vaga);
                          setIsModalOpen(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        title="Visualizar"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteVaga(vaga.id)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
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
      )}
      </div>
      
      {/* Modal de Detalhes/Edição */}
      {selectedVaga && (
        <VagaDetailsModal
          vaga={selectedVaga}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedVaga(null);
          }}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ['vagas', companyId] });
            onRefresh();
          }}
        />
      )}
    </div>
  );
};

export default VagasList;