import React, { useEffect, useState, useRef } from 'react';
import { Edit2, Search, Plus, FilePen, AlertCircle, CheckCircle2, X, Trash2, Loader2 } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import type { Veiculo, Motorista } from '../../types/database';
import AddVeiculoModal from '../../components/veiculos/AddVeiculoModal';
import EditVeiculoModal from '../../components/veiculos/EditVeiculoModal';
import DeleteVehicleModal from '../../components/veiculos/DeleteVehicleModal';
import toast from 'react-hot-toast';
import BulkDeleteConfirmationModal from '../../components/BulkDeleteConfirmationModal';
import LoadingSpinner from '../../components/LoadingSpinner';
import ScrollableTableIndicator from '../../components/ScrollableTableIndicator';
import ContextMenu from '../../components/ContextMenu';
import CombinedVehicleModal from '../../components/veiculos/CombinedVehicleModal';
import { supabase } from '../../lib/supabase';
import { useDebounce } from '../../hooks/useDebounce';

interface VeiculoWithMotorista extends Veiculo {
    motorista?: {
        motorista_id: number;
        nome: string;
        cpf: string;
        telefone: string;
    } | null;
}

const VeiculosEmpresa = () => {
  const { query, companyId } = useCompanyData();
  const [veiculos, setVeiculos] = useState<VeiculoWithMotorista[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCombinedModalOpen, setIsCombinedModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [selectedVeiculo, setSelectedVeiculo] = useState<VeiculoWithMotorista | null>(null);
  const [missingDataCount, setMissingDataCount] = useState(0);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof VeiculoWithMotorista;
    direction: 'asc' | 'desc';
  }>({ key: 'placa', direction: 'asc' });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
  
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    veiculo: VeiculoWithMotorista | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    veiculo: null,
  });

  // Duplicate removal state
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [isRemovingDuplicates, setIsRemovingDuplicates] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

  // Aumentado o delay do debounce de 500ms para 1000ms para alinhar com outros componentes
  const debouncedSearchTerm = useDebounce(searchTerm, 1000);

  useEffect(() => {
    const init = async () => {
      try {
        setInitialLoading(true);
        await fetchVeiculos();
        await fetchMotoristas();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao inicializar';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setInitialLoading(false);
      }
    };
    if (currentPage === 1 && pageSize === 100 && debouncedSearchTerm === '') {
      // Só mostra o loading inicial na primeira montagem
      init();
    } else {
      fetchVeiculos();
      fetchMotoristas();
    }
  }, [currentPage, pageSize, debouncedSearchTerm]);

  useEffect(() => {
    // Count vehicles with missing characteristics
    const count = veiculos.filter(veiculo => 
      !veiculo.tipologia || !veiculo.peso || !veiculo.cubagem
    ).length;
    setMissingDataCount(count);
  }, [veiculos]);

  useEffect(() => {
    // Count duplicate plates (excluding blank/invalid plates)
    const placaCount = new Map<string, number>();
    veiculos.forEach(v => {
      const placa = v.placa?.toUpperCase().trim() || '';
      if (placa.length >= 7) {
        placaCount.set(placa, (placaCount.get(placa) || 0) + 1);
      }
    });
    const duplicates = veiculos.filter(v => {
      const placa = v.placa?.toUpperCase().trim() || '';
      return placa.length >= 7 && (placaCount.get(placa) || 0) > 1;
    });
    // Count how many to remove (total duplicates - unique plates)
    const uniqueDuplicatePlates = new Set(duplicates.map(v => v.placa?.toUpperCase().trim()));
    const toRemove = duplicates.length - uniqueDuplicatePlates.size;
    setDuplicateCount(toRemove);
  }, [veiculos]);

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

  const fetchVeiculos = async () => {
    if (!companyId) return;
    
    try {
      
      const { data, error } = await supabase
        .from('veiculo')
        .select(`
          *,
          motorista (
            motorista_id,
            nome,
            cpf,
            telefone
          )
        `)
        .eq('company_id', companyId)
        .is('motorista_id', null);

      if (error) throw error;

      const veiculosData = data || [];
      setVeiculos(veiculosData);
      setTotalCount(veiculosData.length);
    } catch (error) {
      console.error('Error fetching veiculos:', error);
      toast.error('Erro ao carregar veículos');
      setVeiculos([]);
    } finally {
      
    }
  };

  const fetchMotoristas = async () => {
    try {
      setError(null);
      const { data: motoristasData, error: motoristasError } = await supabase
        .from('motorista')
        .select('*')
        .eq('funcao', 'Agregado')
        .eq('st_cadastro', 'contratado')
        .eq('company_id', companyId);

      if (motoristasError) {
        throw new Error(`Erro ao buscar motoristas: ${motoristasError.message}`);
      }

      setMotoristas(motoristasData || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao carregar motoristas';
      console.error('Error fetching motoristas:', errorMessage);
      setError(errorMessage);
      toast.error(errorMessage);
      setMotoristas([]);
    }
  };

  const handleDelete = (veiculo: VeiculoWithMotorista) => {
    setSelectedVeiculo(veiculo);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedVeiculo) return;
    try {
      const { error } = await query('veiculo')
        .update({ status_veiculo: false })
        .eq('veiculo_id', selectedVeiculo.veiculo_id);

      if (error) throw error;

      setVeiculos(veiculos.filter(v => v.veiculo_id !== selectedVeiculo.veiculo_id));
      toast.success('Veículo excluído com sucesso');
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting veiculo:', error);
      toast.error('Erro ao excluir veículo');
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
    setSelectAll(newSelectedItems.size === veiculos.length);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(veiculos.map(v => v.veiculo_id)));
    }
    setSelectAll(!selectAll);
  };

  const handleBulkDelete = async () => {
    try {
      // Delete all selected items
      for (const id of selectedItems) {
        const { error } = await query('veiculo')
          .update({ status_veiculo: false })
          .eq('veiculo_id', id);

        if (error) throw error;
      }

      // Update the list
      setVeiculos(veiculos.filter(v => !selectedItems.has(v.veiculo_id)));
      toast.success(`${selectedItems.size} veículo${selectedItems.size !== 1 ? 's' : ''} excluído${selectedItems.size !== 1 ? 's' : ''} com sucesso`);
      
      // Reset selection
      setSelectedItems(new Set());
      setSelectAll(false);
      setIsBulkDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting veiculos:', error);
      toast.error('Erro ao excluir veículos');
    }
  };

  const handleViewVehicle = (veiculo: VeiculoWithMotorista) => {
    setSelectedVeiculo(veiculo);
    setIsCombinedModalOpen(true);
  };

  const handleRemoveDuplicates = async () => {
    if (!companyId) return;
    
    try {
      setIsRemovingDuplicates(true);
      
      const placaGroups = new Map<string, VeiculoWithMotorista[]>();
      veiculos.forEach(v => {
        const placa = v.placa?.toUpperCase().trim() || '';
        // Only process valid plates (7+ characters)
        if (placa.length >= 7) {
          if (!placaGroups.has(placa)) {
            placaGroups.set(placa, []);
          }
          placaGroups.get(placa)!.push(v);
        }
      });
      
      const idsToDelete: number[] = [];
      
      placaGroups.forEach((group) => {
        if (group.length > 1) {
          // Keep the most recent (highest veiculo_id), remove the rest
          const sorted = group.sort((a, b) => b.veiculo_id - a.veiculo_id);
          for (let i = 1; i < sorted.length; i++) {
            idsToDelete.push(sorted[i].veiculo_id);
          }
        }
      });
      
      if (idsToDelete.length === 0) {
        toast.success('Nenhum veículo duplicado encontrado');
        setIsDuplicateModalOpen(false);
        return;
      }
      
      // Use soft delete (status_veiculo = false) for consistency with other deletion flows
      const { error } = await supabase
        .from('veiculo')
        .update({ status_veiculo: false })
        .in('veiculo_id', idsToDelete);
        
      if (error) throw error;
      
      setVeiculos(prev => prev.filter(v => !idsToDelete.includes(v.veiculo_id)));
      toast.success(`${idsToDelete.length} veículo${idsToDelete.length !== 1 ? 's' : ''} duplicado${idsToDelete.length !== 1 ? 's' : ''} removido${idsToDelete.length !== 1 ? 's' : ''}`);
      setIsDuplicateModalOpen(false);
    } catch (error) {
      console.error('Error removing duplicates:', error);
      toast.error('Erro ao remover veículos duplicados');
    } finally {
      setIsRemovingDuplicates(false);
    }
  };

  const handleToggleStatus = async (veiculo: VeiculoWithMotorista, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!veiculo.veiculo_id) return;
    
    try {
      setUpdatingStatus(veiculo.veiculo_id);
      
      const { error } = await supabase
        .from('veiculo')
        .update({ status_veiculo: !veiculo.status_veiculo })
        .eq('veiculo_id', veiculo.veiculo_id);
        
      if (error) throw error;
      
      // Update local state
      setVeiculos(prev => 
        prev.map(v => 
          v.veiculo_id === veiculo.veiculo_id 
            ? { ...v, status_veiculo: !veiculo.status_veiculo } 
            : v
        )
      );
      
      toast.success(`Veículo ${!veiculo.status_veiculo ? 'ativado' : 'desativado'} com sucesso`);
    } catch (error) {
      console.error('Error toggling vehicle status:', error);
      toast.error('Erro ao atualizar status do veículo');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleBulkUpdateStatus = async (newStatus: boolean) => {
    if (!companyId || selectedItems.size === 0) return;

    try {
      const { error } = await supabase
        .from('veiculo')
        .update({ status_veiculo: newStatus })
        .in('veiculo_id', Array.from(selectedItems));

      if (error) throw error;

      // Update local state
      setVeiculos(veiculos.map(v => 
        selectedItems.has(v.veiculo_id) 
          ? { ...v, status_veiculo: newStatus }
          : v
      ));

      const action = newStatus ? 'ativado' : 'desativado';
      const actionPlural = newStatus ? 'ativados' : 'desativados';
      toast.success(`${selectedItems.size} veículo${selectedItems.size !== 1 ? 's' : ''} ${selectedItems.size !== 1 ? actionPlural : action} com sucesso`);

      // Reset selection
      setSelectedItems(new Set());
      setSelectAll(false);
    } catch (error) {
      console.error('Error updating veiculos status:', error);
      toast.error('Erro ao atualizar status dos veículos');
    }
  };

  const handleContextMenu = (e: React.MouseEvent, veiculo: VeiculoWithMotorista) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      veiculo,
    });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  const hasMissingData = (veiculo: VeiculoWithMotorista) => {
    return !veiculo.tipologia || !veiculo.peso || !veiculo.cubagem;
  };

  const filteredVeiculos = veiculos
    .filter(veiculo => {
      const searchString = debouncedSearchTerm.toLowerCase();
      return !debouncedSearchTerm || 
        (veiculo.placa || '').toLowerCase().includes(searchString) ||
        (veiculo.marca || '').toLowerCase().includes(searchString) ||
        (veiculo.tipo || '').toLowerCase().includes(searchString);
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

  if (initialLoading) {
    return (
      <LoadingSpinner />
    );
  }

  return (
    <div className="space-y-6">
      {selectedItems.size > 0 && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center justify-between gap-4 flex-wrap">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {selectedItems.size} veículo{selectedItems.size !== 1 ? 's' : ''} selecionado{selectedItems.size !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleBulkUpdateStatus(true)}
              className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1.5"
              data-testid="button-bulk-activate"
            >
              <CheckCircle2 size={16} />
              Ativar
            </button>
            <button
              onClick={() => handleBulkUpdateStatus(false)}
              className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1.5"
              data-testid="button-bulk-deactivate"
            >
              <X size={16} />
              Desativar
            </button>
            <button
              onClick={() => {
                setSelectedItems(new Set());
                setSelectAll(false);
              }}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              data-testid="button-bulk-clear"
            >
              Limpar
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
  <div className="relative w-full flex-1">
    <div className="relative">
      <input
        type="text"
        placeholder="Buscar por placa, marca, modelo, nome ou CPF..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        autoComplete="off"
      />
      <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
    </div>
  </div>

          <div className="flex gap-2">
            {duplicateCount > 0 && (
              <div className="relative group">
                <button
                  onClick={() => setIsDuplicateModalOpen(true)}
                  className="p-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 
                           focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 
                           transition-colors flex items-center justify-center"
                  aria-label="Remover Duplicados"
                  data-testid="button-remove-duplicates"
                >
                  <Trash2 className="w-5 h-5" />
                  <span className="ml-1 text-xs font-bold">{duplicateCount}</span>
                </button>
                <div className="invisible group-hover:visible absolute z-10 w-auto px-1.5 py-0.5 text-xs text-white bg-gray-800 rounded shadow -bottom-6 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  Remover {duplicateCount} Duplicado{duplicateCount !== 1 ? 's' : ''}
                </div>
              </div>
            )}
            <div className="relative group">
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                         transition-colors flex items-center justify-center"
                aria-label="Adicionar Veículo"
              >
                <Plus className="w-5 h-5" />
              </button>
              <div className="invisible group-hover:visible absolute z-10 w-auto px-1.5 py-0.5 text-xs text-white bg-gray-800 rounded shadow -bottom-6 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Adicionar Veículo
              </div>
            </div>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Veículo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Características</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Rastreador</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredVeiculos.map((veiculo) => (
                    <tr 
                      key={veiculo.veiculo_id} 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                        selectedItems.has(veiculo.veiculo_id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                      onContextMenu={(e) => handleContextMenu(e, veiculo)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(veiculo.veiculo_id)}
                          onChange={() => handleSelectItem(veiculo.veiculo_id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                            <span className="text-lg font-medium text-gray-600 dark:text-gray-300">
                              {veiculo.placa.charAt(0)}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {veiculo.placa.toUpperCase()}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {veiculo.marca} {veiculo.tipo}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="text-sm text-gray-900 dark:text-white uppercase">
                              {veiculo.tipologia || 'NÃO INFORMADA'}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 uppercase">
                              {veiculo.peso && veiculo.cubagem ? (
                                <>PESO: {veiculo.peso} | CUBAGEM: {veiculo.cubagem}</>
                              ) : (
                                'DADOS NÃO INFORMADOS'
                              )}
                            </div>
                          </div>
                          {hasMissingData(veiculo) && (
                            <div className="text-amber-500 dark:text-amber-400" title="Dados incompletos">
                              <AlertCircle size={18} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          veiculo.possui_rastreador
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {veiculo.possui_rastreador ? 'SIM' : 'NÃO'}
                        </span>
                        {veiculo.possui_rastreador && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 uppercase">
                            {veiculo.marca_rastreador}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={(e) => handleToggleStatus(veiculo, e)}
                          disabled={updatingStatus === veiculo.veiculo_id}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                            veiculo.status_veiculo 
                              ? 'bg-green-500 dark:bg-green-600' 
                              : 'bg-red-500 dark:bg-red-600'
                          } ${updatingStatus === veiculo.veiculo_id ? 'opacity-50 cursor-not-allowed' : ''}`}
                          role="switch"
                          aria-checked={veiculo.status_veiculo}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              veiculo.status_veiculo ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-3">
                          <button
                            onClick={() => handleViewVehicle(veiculo)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            title="Visualizar e Editar Veículo"
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
        {filteredVeiculos.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              Nenhum veículo encontrado
            </p>
          </div>
        ) : (
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
                  <option value={250}>250 por página</option>
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
                // Calculate page numbers to show (always show 5 pages if possible)
                let pageNum;
                if (totalPages <= 5) {
                  // If 5 or fewer pages, show all
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  // If near the start, show first 5 pages
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  // If near the end, show last 5 pages
                  pageNum = totalPages - 4 + i;
                } else {
                  // Otherwise show 2 before and 2 after current page
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

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.veiculo && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu({ ...contextMenu, visible: false })}
          actions={[
            {
              icon: <FilePen size={16} />,
              label: 'Visualizar e Editar',
              onClick: () => handleViewVehicle(contextMenu.veiculo!),
              color: 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors'
            }
          ]}
        />
      )}

      <AddVeiculoModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchVeiculos}
        isEmpresa
      />

      <CombinedVehicleModal
        isOpen={isCombinedModalOpen}
        onClose={() => setIsCombinedModalOpen(false)}
        veiculo={selectedVeiculo}
        onUploadSuccess={fetchVeiculos}
      />

      <DeleteVehicleModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        veiculo={selectedVeiculo}
      />

      <BulkDeleteConfirmationModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        title="Confirmar Exclusão em Massa"
        message="Tem certeza que deseja excluir todos os veículos selecionados? Esta ação não pode ser desfeita."
        itemCount={selectedItems.size}
        itemType="veículo"
      />

      {isDuplicateModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Remover Veículos Duplicados
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Foram encontrados <span className="font-bold text-amber-600">{duplicateCount}</span> veículo{duplicateCount !== 1 ? 's' : ''} duplicado{duplicateCount !== 1 ? 's' : ''}.
              <br /><br />
              Esta ação irá manter apenas o cadastro mais recente de cada placa e remover os registros antigos duplicados.
              <br /><br />
              <span className="text-red-600 font-medium">Esta ação não pode ser desfeita.</span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsDuplicateModalOpen(false)}
                disabled={isRemovingDuplicates}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                data-testid="button-cancel-duplicates"
              >
                Cancelar
              </button>
              <button
                onClick={handleRemoveDuplicates}
                disabled={isRemovingDuplicates}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                data-testid="button-confirm-duplicates"
              >
                {isRemovingDuplicates ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Removendo...
                  </>
                ) : (
                  'Remover Duplicados'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VeiculosEmpresa;