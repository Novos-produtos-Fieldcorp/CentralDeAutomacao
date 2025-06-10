import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Plus, CheckCircle2, XCircle, FilePen } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import type { Checklist } from '../../types/database';

import ChecklistDetailsModal from '../../components/checklist/ChecklistDetailsModal';
import DeleteChecklistModal from '../../components/checklist/DeleteChecklistModal';
import WeeklyChecklistModal from '../../components/checklist/WeeklyChecklistModal';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useDateRange } from '../../hooks/useDateRange';
import PeriodSelector from '../../components/hodometros/PeriodSelector';
import { usePagination } from '../../hooks/usePagination';
import Pagination from '../../components/Pagination';
import LoadingSpinner from '../../components/LoadingSpinner';
import BulkDeleteConfirmationModal from '../../components/BulkDeleteConfirmationModal';
import ScrollableTableIndicator from '../../components/ScrollableTableIndicator';
import ContextMenu from '../../components/ContextMenu';

const ChecklistSemanal = () => {
  const { query } = useCompanyData();
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('all');
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
    fetchChecklists();
  }, [dateRange]);

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

  const fetchChecklists = async () => {
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
        .eq('id_tipo_checklist', 2); // 2 = semanal

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
      for (const id of selectedItems) {
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
      
      // Toggle the status
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
    setSelectedChecklist(checklist);
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      checklist,
    });
  };

  const filteredChecklists = checklists.filter(checklist => {
    const searchString = searchTerm.toLowerCase();
    return (
      checklist.motorista?.nome.toLowerCase().includes(searchString) ||
      checklist.motorista?.cpf?.includes(searchString) ||
      checklist.veiculo?.placa.toLowerCase().includes(searchString)
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
      {/* Filters Section */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            {/* Search */}
            <div className="relative w-full md:w-96 flex-1">
  <input
    type="text"
    placeholder="Buscar por motorista, CPF ou placa..."
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 transition-all"
  />
  <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
</div>

            {/* Export and New Checklist */}
            <div className="flex gap-2">
              {selectedItems.size > 0 && (
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
              )}
              <button
                onClick={() => setIsNewModalOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                         transition-colors flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Novo Checklist
              </button>
            </div>
          </div>

          {/* Period Selector */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <PeriodSelector
              periodType={periodType}
              dateRange={dateRange}
              onPeriodChange={updatePeriod}
              onDateRangeChange={setDateRange}
            />
          </div>
        </div>
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
              onClick: (e) => {
                handleToggleStatus(e as unknown as React.MouseEvent, contextMenu.checklist!);
              },
              color: contextMenu.checklist.status ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
            }
          ]}
        />
      )}

      {/* Modals */}
      <WeeklyChecklistModal
        isOpen={isNewModalOpen}
        onClose={() => {
          setIsNewModalOpen(false);
          setSelectedChecklist(null);
        }}
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
          setIsNewModalOpen(true);
        }}
      />
    </div>
  );
};

export default ChecklistSemanal;