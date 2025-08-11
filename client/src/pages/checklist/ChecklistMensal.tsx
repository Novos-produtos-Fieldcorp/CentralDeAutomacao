import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Plus, FilePen, CheckCircle2, XCircle, Filter, ChevronDown, Download, X, Calendar } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import type { Checklist } from '../../types/database';
import * as XLSX from 'xlsx';

import ChecklistDetailsModal from '../../components/checklist/ChecklistDetailsModal';
import MonthlyChecklistModal from '../../components/checklist/MonthlyChecklistModal';
import CreateMonthlyChecklistModal from '../../components/checklist/CreateMonthlyChecklistModal';
import DeleteChecklistModal from '../../components/checklist/DeleteChecklistModal';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useDateRange } from '../../hooks/useDateRange';
import { usePagination } from '../../hooks/usePagination';
import Pagination from '../../components/Pagination';
import LoadingSpinner from '../../components/LoadingSpinner';
import BulkDeleteConfirmationModal from '../../components/BulkDeleteConfirmationModal';
import ScrollableTableIndicator from '../../components/ScrollableTableIndicator';
import ContextMenu from '../../components/ContextMenu';

const ChecklistMensal = () => {
  const { query, companyId } = useCompanyData();
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const periodDropdownRef = useRef<HTMLDivElement>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const { periodType, dateRange, pendingDateRange, updatePeriod, setDateRange, applyPendingDateRange } = useDateRange('all', true);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    checklist: Checklist | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    checklist: null,
  });

  useEffect(() => {
    // Only fetch when date range actually changes, not on pending changes
    if (!pendingDateRange && companyId) {
      fetchChecklists();
    }
  }, [dateRange, pendingDateRange, companyId]);

  useEffect(() => {
    // Close context menu and dropdowns when clicking anywhere
    const handleClick = (event: MouseEvent) => {
      if (contextMenu.visible) {
        setContextMenu({ ...contextMenu, visible: false });
      }
      
      // Close status dropdown if clicking outside
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false);
      }
      
      // Close period dropdown if clicking outside
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target as Node)) {
        setShowPeriodDropdown(false);
      }
    };

    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [contextMenu.visible]);

  const fetchChecklists = async () => {
    if (!companyId) return;
    
    try {
      setLoading(true);
      let baseQuery = supabase.from('checklist')
      .select(`
        *,
        motorista:motorista_id (
          motorista_id,
          nome,
          cpf
        ),
        veiculo:veiculo_id (
          veiculo_id,
          placa,
          marca,
          tipo
        )
      `)
        .eq('company_id', companyId)
        .eq('id_tipo_checklist', 1); // 1 = mensal

      // Add date range filter if dates are selected
      if (dateRange.startDate) {
        baseQuery = baseQuery.gte('data', dateRange.startDate);
      }
      if (dateRange.endDate) {
        baseQuery = baseQuery.lte('data', dateRange.endDate);
      }

      const { data, error } = await baseQuery
        .order('data', { ascending: false })
        .order('hora', { ascending: false });

      if (error) throw error;

      // Convert vehicle plates to uppercase
      const formattedData = data?.map(checklist => ({
        ...checklist,
        veiculo: checklist.veiculo ? {
          ...checklist.veiculo,
          placa: checklist.veiculo.placa.toUpperCase()
        } : null
      })) || [];

      setChecklists(formattedData);
    } catch (error) {
      console.error('Error fetching checklists:', error);
      toast.error('Erro ao carregar checklists');
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
    setSelectAll(newSelectedItems.size === filteredChecklists.length);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredChecklists.map(c => c.checklist_id)));
    }
    setSelectAll(!selectAll);
  };

  const handleBulkDelete = async () => {
    try {
      // Delete all selected items
      for (const id of Array.from(selectedItems)) {
        const checklist = checklists.find(c => c.checklist_id === id);
        if (!checklist) continue;

        const { error } = await query('checklist')
          .delete()
          .eq('checklist_id', id)
          .eq('company_id', checklist.company_id);

        if (error) throw error;
      }

      // Update the list
      setChecklists(checklists.filter(c => !selectedItems.has(c.checklist_id)));
      toast.success(`${selectedItems.size} checklist${selectedItems.size !== 1 ? 's' : ''} excluído${selectedItems.size !== 1 ? 's' : ''} com sucesso`);
      
      // Reset selection
      setSelectedItems(new Set());
      setSelectAll(false);
      setIsBulkDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting checklists:', error);
      toast.error('Erro ao excluir checklists');
    }
  };

  const handleToggleStatus = async (e: React.MouseEvent, checklist: Checklist) => {
    e.stopPropagation();
    try {
      setUpdatingStatus(checklist.checklist_id);
      
      // Toggle the verificacao status
      const newStatus = !checklist.status;
      
      const { error } = await supabase
        .from('checklist')
        .update({ status: newStatus })
        .eq('checklist_id', checklist.checklist_id);
        
      if (error) throw error;
      
      // Update local state
      setChecklists(prev => 
        prev.map(c => 
          c.checklist_id === checklist.checklist_id 
            ? { ...c, status: newStatus } 
            : c
        )
      );
      
      toast.success("Status atualizado!");
    } catch (error) {
      console.error('Error toggling checklist status:', error);
      toast.error('Erro ao atualizar status do checklist');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, checklist: Checklist) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      checklist,
    });
  };

  const toggleStatusFilter = (status: string) => {
    setStatusFilter(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status) 
        : [...prev, status]
    );
  };

  const exportToExcel = () => {
    try {
      // Get selected checklists or all filtered checklists
      const checklistsToExport = selectedItems.size > 0 
        ? filteredChecklists.filter(c => selectedItems.has(c.checklist_id))
        : filteredChecklists;

      // Prepare data for export
      const exportData = checklistsToExport.map(checklist => ({
        'ID': checklist.checklist_id,
        'Data': checklist.data ? new Date(checklist.data).toLocaleDateString('pt-BR') : '-',
        'Motorista': checklist.motorista?.nome || 'Não informado',
        'CPF': checklist.motorista?.cpf || 'Não informado',
        'Veículo': checklist.veiculo?.placa || 'Não informado',
        'Status': checklist.status ? 'Ativo' : 'Inativo',
        'Observações': checklist.observacoes || '-',
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Auto-size columns
      const colWidths = [
        { wch: 8 },  // ID
        { wch: 12 }, // Data
        { wch: 25 }, // Motorista
        { wch: 15 }, // CPF
        { wch: 12 }, // Veículo
        { wch: 10 }, // Status
        { wch: 30 }, // Observações
      ];
      
      ws['!cols'] = colWidths;
      
      XLSX.utils.book_append_sheet(wb, ws, 'Checklists Mensais');
      XLSX.writeFile(wb, `checklists_mensais_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast.success('Relatório exportado com sucesso');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Erro ao exportar para Excel');
    }
  };

  const filteredChecklists = checklists.filter(checklist => {
    const searchString = searchTerm.toLowerCase();
    const matchesSearch = (
      checklist.motorista?.nome.toLowerCase().includes(searchString) ||
      checklist.motorista?.cpf?.includes(searchString) ||
      checklist.veiculo?.placa.toLowerCase().includes(searchString)
    );
    
    const matchesStatus = statusFilter.length === 0 || 
      (statusFilter.includes('ativo') && checklist.status) ||
      (statusFilter.includes('inativo') && !checklist.status);
    
    return matchesSearch && matchesStatus;
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
    data: filteredChecklists,
    initialPageSize: 10
  });

  if (loading) {
    return (
      <LoadingSpinner />
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-750 p-6 rounded-xl shadow-lg border border-gray-200/70 dark:border-gray-700/70 backdrop-blur-sm">


        {/* Campo de busca inteligente */}
        <div className="mb-4">
          <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center">
              <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Buscar por motorista, CPF ou placa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-12 py-3.5 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm group-focus-within:shadow-md"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-4 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Filtros modernos */}
        <div className="flex flex-wrap gap-3 items-center justify-between mb-4 relative z-[100]">
          <div className="flex flex-wrap gap-2">
            {/* Status Filter */}
            <div className="relative z-[50]" ref={statusDropdownRef}>
              <button
                type="button"
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9"
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              >
                <Filter className="h-4 w-4" />
                <span>
                  {statusFilter.length === 0 ? 'Status' : `Status (${statusFilter.length})`}
                </span>
                <ChevronDown className="h-4 w-4" />
              </button>

              {showStatusDropdown && (
                <div 
                  className="bg-white dark:bg-gray-700 shadow-xl rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto w-64 animate-in slide-in-from-bottom-2 fade-in duration-200"
                  style={{ 
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    marginBottom: '4px',
                    zIndex: 999999
                  }}
                >
                  <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Selecionar status</span>
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
                  </div>
                  {['ativo', 'inativo'].map((status) => (
                    <div key={status} className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 mr-2"
                          checked={statusFilter.includes(status)}
                          onChange={() => toggleStatusFilter(status)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-200 capitalize">{status}</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Período Filter */}
            <div className="relative z-[40]" ref={periodDropdownRef}>
              <button
                type="button"
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9"
                onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
              >
                <Calendar className="h-4 w-4" />
                <span>
                  {periodType === 'all' ? 'Período' : 
                   periodType === '1day' ? 'Hoje' :
                   periodType === '15days' ? '15 dias' :
                   periodType === '30days' ? '30 dias' :
                   periodType === 'custom' ? 'Personalizado' : 'Período'}
                </span>
                <ChevronDown className="h-4 w-4" />
              </button>

              {showPeriodDropdown && (
                <div 
                  className="bg-white dark:bg-gray-700 shadow-xl rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto w-64 animate-in slide-in-from-bottom-2 fade-in duration-200"
                  style={{ 
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    marginBottom: '4px',
                    zIndex: 999999
                  }}
                >
                  <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Selecionar período</span>
                  </div>
                  {[
                    { value: 'all', label: 'Todos os períodos' },
                    { value: '1day', label: 'Hoje' },
                    { value: '15days', label: 'Últimos 15 dias' },
                    { value: '30days', label: 'Últimos 30 dias' },
                    { value: 'custom', label: 'Período personalizado' }
                  ].map(({ value, label }) => (
                    <div key={value} className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                      <button
                        type="button"
                        className="w-full text-left text-sm text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"
                        onClick={() => {
                          updatePeriod(value as any);
                          setShowPeriodDropdown(false);
                        }}
                      >
                        {label}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Custom Date Range */}
        {periodType === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Data inicial
              </label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Data final
              </label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden relative">
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
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"></th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data/Hora</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Motorista</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Veículo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Quilometragem</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedData.map((checklist) => (
                  <tr 
                    key={checklist.checklist_id} 
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                      selectedItems.has(checklist.checklist_id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                    onContextMenu={(e) => handleContextMenu(e, checklist)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(checklist.checklist_id)}
                        onChange={() => handleSelectItem(checklist.checklist_id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        onClick={(e: React.MouseEvent<HTMLInputElement>) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap" onClick={() => {
                      setSelectedChecklist(checklist);
                      setIsDetailsModalOpen(true);
                    }}>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {checklist.data.split('-').reverse().join('/')}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {checklist.hora}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap" onClick={() => {
                      setSelectedChecklist(checklist);
                      setIsDetailsModalOpen(true);
                    }}>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {checklist.motorista?.nome}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {checklist.motorista?.cpf || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap" onClick={() => {
                      setSelectedChecklist(checklist);
                      setIsDetailsModalOpen(true);
                    }}>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        <span className="uppercase">{checklist.veiculo?.placa}</span>
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {checklist.veiculo?.marca} {checklist.veiculo?.tipo}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap" onClick={() => {
                      setSelectedChecklist(checklist);
                      setIsDetailsModalOpen(true);
                    }}>
                      <div className="text-sm text-gray-900 dark:text-white">
                        {checklist.quilometragem?.toLocaleString('pt-BR')} km
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-3">
                        <button
                          onClick={() => {
                            setSelectedChecklist(checklist);
                            setIsDetailsModalOpen(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                          title="Visualizar"
                        >
                          <FilePen size={18} />
                        </button>
                        <button
                          onClick={(e) => handleToggleStatus(e, checklist)}
                          disabled={updatingStatus === checklist.checklist_id}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                            checklist.status 
                              ? 'bg-green-500 dark:bg-green-600' 
                              : 'bg-gray-200 dark:bg-gray-700'
                          } ${updatingStatus === checklist.checklist_id ? 'opacity-50 cursor-not-allowed' : ''}`}
                          role="switch"
                          aria-checked={checklist.status}
                          title={checklist.status ? "Marcar como não verificado" : "Marcar como verificado"}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              checklist.status ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                          {updatingStatus === checklist.checklist_id && (
                            <Loader2 
                              className="absolute inset-0 m-auto w-4 h-4 text-white animate-spin" 
                            />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Scroll indicators */}
          <ScrollableTableIndicator 
            containerRef={tableContainerRef} 
            className="mr-2 ml-2"
          />
        </div>
        </div>
        {filteredChecklists.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              Nenhum checklist encontrado
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
      {contextMenu.visible && contextMenu.checklist && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu({ ...contextMenu, visible: false })}
          actions={[
            {
              icon: <FilePen size={16} />,
              label: 'Visualizar',
              onClick: () => {
                setSelectedChecklist(contextMenu.checklist);
                setIsDetailsModalOpen(true);
              },
              color: 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors'
            },
            {
              icon: contextMenu.checklist.status ? <XCircle size={16} /> : <CheckCircle2 size={16} />,
              label: contextMenu.checklist.status ? 'Marcar como não verificado' : 'Marcar como verificado',
              onClick: () => {
                const syntheticEvent = {
                  stopPropagation: () => {}
                } as unknown as React.MouseEvent;
                handleToggleStatus(syntheticEvent, contextMenu.checklist!);
              },
              color: contextMenu.checklist.status ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
            }
          ]}
        />
      )}

      {/* Modals */}
      <CreateMonthlyChecklistModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={fetchChecklists}
      />

      <MonthlyChecklistModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={fetchChecklists}
        checklist={selectedChecklist} 
      />

      <DeleteChecklistModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={async () => {
          if (!selectedChecklist) return;

          try {
            const { error } = await query('checklist')
              .delete()
              .eq('checklist_id', selectedChecklist.checklist_id)
              .eq('company_id', selectedChecklist.company_id);

            if (error) throw error;

            setChecklists(checklists.filter(c => c.checklist_id !== selectedChecklist.checklist_id));
            toast.success('Checklist excluído com sucesso');
            setIsDeleteModalOpen(false);
          } catch (error) {
            console.error('Error deleting checklist:', error);
            toast.error('Erro ao excluir checklist');
          }
        }}
        checklist={selectedChecklist}
      />

      <BulkDeleteConfirmationModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        title="Confirmar Exclusão em Massa"
        message="Tem certeza que deseja excluir todos os checklists selecionados? Esta ação não pode ser desfeita."
        itemCount={selectedItems.size}
        itemType="checklist"
      />

      <ChecklistDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        checklist={selectedChecklist}
        onEdit={(checklist) => {
          setSelectedChecklist(checklist);
          setIsEditModalOpen(true);
        }}
      />
    </div>
  );
};

export default ChecklistMensal;