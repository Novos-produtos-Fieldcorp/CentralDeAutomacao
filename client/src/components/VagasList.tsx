import React, { useState, useEffect, useRef } from 'react';
import { Calendar, MapPin, Users, Building, Clock, Edit2, Trash2, Eye, ChevronDown, Search, Filter, X, Plus, LayoutGrid, LayoutList, Briefcase, AlertTriangle, Loader2 } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useCurrentAccount } from '../hooks/useCurrentAccount';
import { Vaga } from '@shared/schema';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { queryClient } from '../lib/queryClient';
import VagaDetailsModal from './VagaDetailsModal';
import Pagination from './Pagination';
import ScrollableTableIndicator from './ScrollableTableIndicator';
import { usePagination } from '../hooks/usePagination';
import { TableDropdown } from './TableDropdown';
import { API_BASE_URL } from '../lib/api-config-supabase';
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

const getStatusColor = (statusName: string | null | undefined): string => {
  if (!statusName) return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';

  const lower = statusName.toLowerCase();
  if (lower.includes('aberta')) return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
  if (lower.includes('fechada')) return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
  if (lower.includes('pausada')) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';

  return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
};

const VagasList: React.FC<VagasListProps> = ({ onRefresh, onAddClick }) => {
  const { accountId } = useCurrentAccount();
  const [selectedVaga, setSelectedVaga] = useState<VagaWithRelations | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [vagaToDelete, setVagaToDelete] = useState<VagaWithRelations | null>(null);
  
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
  const [updatingStatusVaga, setUpdatingStatusVaga] = useState<number | null>(null);

  // Table and pagination
  const tableContainerRef = useRef<HTMLDivElement>(null);

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
    onSuccess: (_, { vagaId, statusId }) => {
      // Update cache directly so UI reflects immediately
      queryClient.setQueryData(
        ['vagas', companyId],
        (old: VagaWithRelations[] | undefined) =>
          old
            ? old.map(v =>
                v.id === vagaId
                  ? {
                      ...v,
                      st_vaga_id: statusId,
                      status_nome: statusOptions.find(s => s.id === statusId)?.status_vaga ?? v.status_nome,
                    }
                  : v
              )
            : old
      );
      toast.success('Status atualizado com sucesso!');
      onRefresh();
      setUpdatingStatusVaga(null);
    },
    onError: (error) => {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status');
      setUpdatingStatusVaga(null);
    },
  });

  const deleteVagaMutation = useMutation({
    mutationFn: (vagaId: number) => deleteVaga(vagaId, companyId!),
    onSuccess: (_data, vagaId) => {
      queryClient.setQueryData(
        ['vagas', companyId],
        (old: VagaWithRelations[] | undefined) => old ? old.filter(v => v.id !== vagaId) : []
      );
      setVagaToDelete(null);
      toast.success('Vaga deletada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['vagas'], exact: false });
      onRefresh();
    },
    onError: (error) => {
      setVagaToDelete(null);
      console.error('Error deleting vaga:', error);
      toast.error('Erro ao deletar vaga');
    },
  });

  // Auto-deactivate vagas when dt_limite has passed — runs once per unique batch of IDs
  const processedIdsRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!vagas.length || !companyId) return;
    const now = new Date();
    const expired = vagas.filter(v => {
      if (!v.dt_limite) return false;
      if (v.ativo === false) return false;
      if (processedIdsRef.current.has(v.id)) return false;
      return new Date(v.dt_limite) < now;
    });
    if (expired.length === 0) return;

    expired.forEach(v => processedIdsRef.current.add(v.id));

    Promise.allSettled(
      expired.map(vaga =>
        fetch(`${API_BASE_URL}/vagas/${vaga.id}/ativo`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ativo: false, company_id: companyId }),
        }).then(res => {
          if (!res.ok) processedIdsRef.current.delete(vaga.id);
          return res;
        }).catch(() => {
          processedIdsRef.current.delete(vaga.id);
        })
      )
    ).then(() => {
      queryClient.invalidateQueries({ queryKey: ['vagas'], exact: false });
    });
  }, [vagas, companyId]);

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

  const clearAllFilters = () => {
    setStatusFilter([]);
    setClienteFilter([]);
    setUnidadeFilter([]);
    setOperacaoFilter([]);
    setQuantidadeFilter({ min: null, max: null });
    setDateFilter({ start: '', end: '' });
  };

  const clearSearchAndFilters = () => {
    setSearchTerm('');
    clearAllFilters();
  };

  const getStatusName = (statusId: string) => {
    const status = statusOptions.find((item) => item.id.toString() === statusId);
    return status?.status_vaga || `Status ${statusId}`;
  };

  const getClienteName = (clienteId: string) => {
    const cliente = clientes.find((item) => item.cliente_id.toString() === clienteId);
    return cliente?.nome || `Cliente ${clienteId}`;
  };

  const getUnidadeName = (unidadeId: string) => {
    const unidade = unidades.find((item) => item.id.toString() === unidadeId);
    return unidade?.unidade || `Unidade ${unidadeId}`;
  };

  const getOperacaoName = (operacaoId: string) => {
    const operacao = operacoes.find((item) => item.id.toString() === operacaoId);
    return operacao?.operacao || `Operação ${operacaoId}`;
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

  const { currentPage, pageSize, totalPages, totalItems, paginatedData,
          handlePageChange, handlePageSizeChange } =
    usePagination({ data: filteredVagas, initialPageSize: 25 });

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    try {
      return format(new Date(date), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return '-';
    }
  };

  const handleStatusChange = (vagaId: number, newStatusId: number) => {
    setUpdatingStatusVaga(vagaId);
    updateStatusMutation.mutate({ vagaId, statusId: newStatusId });
  };

  const handleDeleteVaga = (vaga: VagaWithRelations) => {
    setVagaToDelete(vaga);
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
      <div className="search-section-surface p-6">
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Buscar vagas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
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

        <div className="search-toolbar-meta mb-4">
          <div className="search-toolbar-summary">
            {hasActiveFilters() && (
              <div className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                <Filter className="h-3 w-3" />
                <span>{getActiveFiltersCount()}</span>
              </div>
            )}
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {filteredVagas.length} de {vagas.length} vagas
            </div>
          </div>
          <div className="search-toolbar-summary">
            {(hasActiveFilters() || searchTerm) && (
              <button
                onClick={clearSearchAndFilters}
                className="flex items-center gap-1 rounded-md px-3 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              >
                <X className="h-3 w-3" />
                Limpar busca e filtros
              </button>
            )}
          </div>
        </div>

        {hasActiveFilters() && (
          <div className="filter-tags-panel mb-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  Filtros ativos
                </span>
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-100 px-2 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  {getActiveFiltersCount()}
                </span>
              </div>
              <button
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1.5 self-start rounded-lg bg-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
              >
                <X className="h-3 w-3" />
                <span>Limpar todos</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {statusFilter.map((statusId) => (
                <div key={`status-${statusId}`} className="filter-tags-chip bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300">
                  <Filter className="h-3 w-3" />
                  <span className="filter-tags-chip-label">Status: {getStatusName(statusId)}</span>
                  <button
                    onClick={() => setStatusFilter(statusFilter.filter((item) => item !== statusId))}
                    className="rounded-sm p-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {clienteFilter.map((clienteId) => (
                <div key={`cliente-${clienteId}`} className="filter-tags-chip bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
                  <Users className="h-3 w-3" />
                  <span className="filter-tags-chip-label">Cliente: {getClienteName(clienteId)}</span>
                  <button
                    onClick={() => setClienteFilter(clienteFilter.filter((item) => item !== clienteId))}
                    className="rounded-sm p-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {unidadeFilter.map((unidadeId) => (
                <div key={`unidade-${unidadeId}`} className="filter-tags-chip bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300">
                  <Building className="h-3 w-3" />
                  <span className="filter-tags-chip-label">Unidade: {getUnidadeName(unidadeId)}</span>
                  <button
                    onClick={() => setUnidadeFilter(unidadeFilter.filter((item) => item !== unidadeId))}
                    className="rounded-sm p-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {operacaoFilter.map((operacaoId) => (
                <div key={`operacao-${operacaoId}`} className="filter-tags-chip bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
                  <MapPin className="h-3 w-3" />
                  <span className="filter-tags-chip-label">Operação: {getOperacaoName(operacaoId)}</span>
                  <button
                    onClick={() => setOperacaoFilter(operacaoFilter.filter((item) => item !== operacaoId))}
                    className="rounded-sm p-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {(quantidadeFilter.min !== null || quantidadeFilter.max !== null) && (
                <div className="filter-tags-chip bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300">
                  <Users className="h-3 w-3" />
                  <span className="filter-tags-chip-label">
                    Quantidade: {quantidadeFilter.min ?? '0'} - {quantidadeFilter.max ?? 'sem limite'}
                  </span>
                  <button
                    onClick={() => clearFilter('quantidade')}
                    className="rounded-sm p-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {(dateFilter.start || dateFilter.end) && (
                <div className="filter-tags-chip bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300">
                  <Calendar className="h-3 w-3" />
                  <span className="filter-tags-chip-label">
                    Período: {dateFilter.start || '...'} até {dateFilter.end || '...'}
                  </span>
                  <button
                    onClick={() => clearFilter('data')}
                    className="rounded-sm p-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="search-toolbar-row relative">
          <div className="search-filter-grid">
            <div className="relative" id="status-dropdown">
              <button
                type="button"
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="search-filter-trigger !pl-10 !pr-14"
              >
                <span className="truncate flex-1">{getFilterButtonText('status')}</span>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ${showStatusDropdown ? 'transform rotate-180' : ''}`} />
              </button>
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 search-filter-icon-status" />
              {showStatusDropdown && (
                <div className="absolute z-[var(--z-layer-page-dropdown)] mt-1 w-full rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-700 max-h-48 overflow-auto">
                  <div className="flex items-center justify-between border-b border-gray-200 px-3 py-1.5 dark:border-gray-600">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Selecione os status</span>
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStatusFilter([]);
                      }}
                    >
                      Limpar
                    </button>
                  </div>
                  {statusOptions.map((status) => (
                    <div key={status.id} className="flex cursor-pointer items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600">
                      <input
                        type="checkbox"
                        id={`status-${status.id}`}
                        checked={statusFilter.includes(status.id.toString())}
                        onChange={() => toggleFilterOption('status', status.id.toString())}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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

            <div className="relative" id="cliente-dropdown">
              <button
                type="button"
                onClick={() => setShowClienteDropdown(!showClienteDropdown)}
                className="search-filter-trigger justify-between !pl-10 !pr-14"
              >
                <span className="truncate">{getFilterButtonText('cliente')}</span>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ${showClienteDropdown ? 'transform rotate-180' : ''}`} />
              </button>
              <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 search-filter-icon-cliente" />
              {showClienteDropdown && (
                <div className="absolute z-[var(--z-layer-page-dropdown)] mt-1 w-full rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-700 max-h-48 overflow-auto">
                  <div className="flex items-center justify-between border-b border-gray-200 px-3 py-1.5 dark:border-gray-600">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Selecione os clientes</span>
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        setClienteFilter([]);
                      }}
                    >
                      Limpar
                    </button>
                  </div>
                  {clientes.map((cliente) => (
                    <div key={cliente.cliente_id} className="flex cursor-pointer items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600">
                      <input
                        type="checkbox"
                        id={`cliente-${cliente.cliente_id}`}
                        checked={clienteFilter.includes(cliente.cliente_id.toString())}
                        onChange={() => toggleFilterOption('cliente', cliente.cliente_id.toString())}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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

            <div className="relative" id="unidade-dropdown">
              <button
                type="button"
                onClick={() => setShowUnidadeDropdown(!showUnidadeDropdown)}
                className="search-filter-trigger justify-between !pl-10 !pr-14"
              >
                <span className="truncate">{getFilterButtonText('unidade')}</span>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ${showUnidadeDropdown ? 'transform rotate-180' : ''}`} />
              </button>
              <Building className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 search-filter-icon-unidade" />
              {showUnidadeDropdown && (
                <div className="absolute z-[var(--z-layer-page-dropdown)] mt-1 w-full rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-700 max-h-48 overflow-auto">
                  <div className="flex items-center justify-between border-b border-gray-200 px-3 py-1.5 dark:border-gray-600">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Selecione as unidades</span>
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUnidadeFilter([]);
                      }}
                    >
                      Limpar
                    </button>
                  </div>
                  {unidades.map((unidade) => (
                    <div key={unidade.id} className="flex cursor-pointer items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600">
                      <input
                        type="checkbox"
                        id={`unidade-${unidade.id}`}
                        checked={unidadeFilter.includes(unidade.id.toString())}
                        onChange={() => toggleFilterOption('unidade', unidade.id.toString())}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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

            <div className="relative" id="operacao-dropdown">
              <button
                type="button"
                onClick={() => setShowOperacaoDropdown(!showOperacaoDropdown)}
                className="search-filter-trigger justify-between !pl-10 !pr-14"
              >
                <span className="truncate">{getFilterButtonText('operacao')}</span>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ${showOperacaoDropdown ? 'transform rotate-180' : ''}`} />
              </button>
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 search-filter-icon-operacao" />
              {showOperacaoDropdown && (
                <div className="absolute z-[var(--z-layer-page-dropdown)] mt-1 w-full rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-700 max-h-48 overflow-auto">
                  <div className="flex items-center justify-between border-b border-gray-200 px-3 py-1.5 dark:border-gray-600">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Selecione as operações</span>
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOperacaoFilter([]);
                      }}
                    >
                      Limpar
                    </button>
                  </div>
                  {operacoes.map((operacao) => (
                    <div key={operacao.id} className="flex cursor-pointer items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600">
                      <input
                        type="checkbox"
                        id={`operacao-${operacao.id}`}
                        checked={operacaoFilter.includes(operacao.id.toString())}
                        onChange={() => toggleFilterOption('operacao', operacao.id.toString())}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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

            <div className="relative">
              <div className="absolute left-3 top-1/2 z-10 -translate-y-1/2">
                <Calendar className="h-4 w-4 search-filter-icon-periodo" />
              </div>
              <input
                type="date"
                value={dateFilter.start}
                onChange={(e) => setDateFilter((prev) => ({ ...prev, start: e.target.value }))}
                className="search-filter-input pl-10"
                title="Data inicial"
              />
            </div>

            <div className="relative">
              <div className="absolute left-3 top-1/2 z-10 -translate-y-1/2">
                <Calendar className="h-4 w-4 search-filter-icon-periodo" />
              </div>
              <input
                type="date"
                value={dateFilter.end}
                onChange={(e) => setDateFilter((prev) => ({ ...prev, end: e.target.value }))}
                className="search-filter-input pl-10"
                title="Data final"
              />
            </div>

            <div className="relative">
              <div className="absolute left-3 top-1/2 z-10 -translate-y-1/2">
                <Users className="h-4 w-4 search-filter-icon-quantidade" />
              </div>
              <input
                type="number"
                placeholder="Qtde Min"
                value={quantidadeFilter.min || ''}
                onChange={(e) => setQuantidadeFilter((prev) => ({ ...prev, min: e.target.value ? Number(e.target.value) : null }))}
                className="search-filter-input pl-10"
              />
            </div>

            <div className="relative">
              <div className="absolute left-3 top-1/2 z-10 -translate-y-1/2">
                <Users className="h-4 w-4 search-filter-icon-quantidade" />
              </div>
              <input
                type="number"
                placeholder="Qtde Max"
                value={quantidadeFilter.max || ''}
                onChange={(e) => setQuantidadeFilter((prev) => ({ ...prev, max: e.target.value ? Number(e.target.value) : null }))}
                className="search-filter-input pl-10"
              />
            </div>
          </div>

          <div className="search-toolbar-actions">
            {onAddClick && (
              <button
                onClick={onAddClick}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                title="Adicionar Vaga"
              >
                <Plus size={16} />
                <span>Nova Vaga</span>
              </button>
            )}
          </div>
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
        <div className="relative">
          <div ref={tableContainerRef} className="overflow-x-auto">
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
              {paginatedData.map((vaga) => (
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
                      <TableDropdown
                        value={vaga.st_vaga_id?.toString() || ''}
                        options={statusOptions.map(status => ({
                          value: status.id.toString(),
                          label: status.status_vaga,
                          color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                        }))}
                        onSelect={(value) => handleStatusChange(vaga.id, Number(value))}
                        placeholder="Selecionar Status"
                        disabled={updatingStatusVaga === vaga.id}
                        buttonClassName={getStatusColor((vaga as any).status_nome)}
                      />

                      {updatingStatusVaga === vaga.id && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 rounded-full">
                          <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                        </div>
                      )}
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
                        onClick={() => handleDeleteVaga(vaga)}
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
          <ScrollableTableIndicator containerRef={tableContainerRef} />
        </div>
      )}
      </div>

      {/* Pagination */}
      {filteredVagas.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
      
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
            queryClient.invalidateQueries({ queryKey: ['vagas'], exact: false });
            onRefresh();
          }}
        />
      )}

      {/* Diálogo de confirmação de exclusão */}
      {vagaToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70" onClick={() => setVagaToDelete(null)} />
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full p-6 relative z-50" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Excluir vaga
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Tem certeza que deseja excluir a vaga{' '}
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    "{vagaToDelete.nome}"
                  </span>
                  ? Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setVagaToDelete(null)}
                disabled={deleteVagaMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteVagaMutation.mutate(vagaToDelete.id)}
                disabled={deleteVagaMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {deleteVagaMutation.isPending ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  'Excluir'
                )}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VagasList;