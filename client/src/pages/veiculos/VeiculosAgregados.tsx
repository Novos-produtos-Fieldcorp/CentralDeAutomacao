import React, { useEffect, useState, useRef } from 'react';
import { Search, Plus, FilePen, Phone, CheckCircle2, X } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import type { Veiculo, Motorista } from '../../types/database';
import AddVeiculoModal from '../../components/veiculos/AddVeiculoModal';
import EditVeiculoModal from '../../components/veiculos/EditVeiculoModal';

import DeleteVehicleModal from '../../components/veiculos/DeleteVehicleModal';
import BulkDeleteConfirmationModal from '../../components/BulkDeleteConfirmationModal';
import toast from 'react-hot-toast';
import { formatCPF } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';
import ScrollableTableIndicator from '../../components/ScrollableTableIndicator';
import ContextMenu from '../../components/ContextMenu';
import { supabase } from '../../lib/supabase';
import { useBlixxSources } from '../../lib/blixxSource';
import BlixxVeiculoModal from '../../components/blixx/BlixxVeiculoModal';
import { useDebounce } from '../../hooks/useDebounce';
import CombinedVehicleModal from '../../components/veiculos/CombinedVehicleModal';

interface VeiculoWithMotorista extends Veiculo {
  motorista?: {
    motorista_id: number;
    nome: string;
    cpf: string;
    telefone: string;
  } | null;
  agregado?: {
    agregado_id: number;
    nome: string;
    st_agregado: boolean;
  } | null;
}

const VeiculosAgregados = () => {
  const { companyId } = useCompanyData();
  const { agregadosView, veiculoTable, veiculoPk, motoristaTable, isBlixx } = useBlixxSources();
  const [veiculos, setVeiculos] = useState<VeiculoWithMotorista[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig] = useState<{
    key: keyof VeiculoWithMotorista;
    direction: 'asc' | 'desc';
  }>({ key: 'placa', direction: 'asc' });

  // Aumentado o delay do debounce de 500ms para 1000ms para alinhar com outros componentes
  const debouncedSearchTerm = useDebounce(searchTerm, 1000);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCombinedModalOpen, setIsCombinedModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [selectedVeiculo, setSelectedVeiculo] = useState<Veiculo | null>(null);
  
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
    veiculo: Veiculo | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    veiculo: null,
  });

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
    try {
      setError(null);
      setInitialLoading(true);
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      // Buscar apenas vínculos ativos de veículos dos agregados.
      let query = supabase
        .from(agregadosView)
        .select('*', { count: 'exact' })
        .eq('company_id', companyId)
        .eq('ativo', true)
        .eq('status_veiculo', true)
        .not('veiculo_id', 'is', null);

      if (debouncedSearchTerm) {
        query = query.or(
          `placa.ilike.%${debouncedSearchTerm}%,marca_veiculo.ilike.%${debouncedSearchTerm}%,tipo.ilike.%${debouncedSearchTerm}%,nome_motorista.ilike.%${debouncedSearchTerm}%,cpf.ilike.%${debouncedSearchTerm}%`
        );
      }

      query = query.order('placa', { ascending: true }).range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      setTotalCount(count || 0);
      setTotalPages(Math.max(1, Math.ceil((count || 0) / pageSize)));

      // A view usa LEFT JOIN; filtramos novamente para evitar registros órfãos.
      const veiculosAtivos = (data || [])
        .filter((veiculo: any) => veiculo.veiculo_id && veiculo.status_veiculo === true)
        .map((veiculo: any) => ({
          ...veiculo,
          placa: veiculo.placa?.toUpperCase() || '',
          motorista: veiculo.nome_motorista
            ? {
                motorista_id: veiculo.motorista_id,
                nome: veiculo.nome_motorista,
                cpf: veiculo.cpf || '',
                telefone: veiculo.telefone || '',
              }
            : null,
        }))
        .sort((a, b) => (a.placa || '').localeCompare(b.placa || ''));

      setVeiculos(veiculosAtivos);
    } catch (error: any) {
      console.error('Error fetching veiculos (full):', error);
      const errorMessage = error?.message || error?.error?.message || JSON.stringify(error) || 'Erro desconhecido ao carregar veículos';
      console.error('Error fetching veiculos:', errorMessage);
      setError(errorMessage);
      toast.error(errorMessage);
      setVeiculos([]);
    } finally {
      setInitialLoading(false);
    }
  };

  const fetchMotoristas = async () => {
    try {
      setError(null);
      const { data: motoristasData, error: motoristasError } = await supabase
        .from(motoristaTable)
        .select('*')
        .eq('funcao', 'Agregado')
        .eq('ativo', true)
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

  const handleDelete = (veiculo: Veiculo) => {
    setSelectedVeiculo(veiculo);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedVeiculo) return;
    try {
      const { error } = await supabase
        .from(veiculoTable)
        .update({ status_veiculo: false })
        .eq(veiculoPk, selectedVeiculo.veiculo_id);

      if (error) throw error;

      setVeiculos(veiculos.filter(v => v.veiculo_id !== selectedVeiculo.veiculo_id));
      toast.success('Veículo excluído com sucesso');
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting veiculo:', error);
      toast.error('Erro ao excluir veículo');
    }
  };

  const handleToggleStatus = async (veiculo: Veiculo, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!veiculo.veiculo_id) return;
    
    try {
      setUpdatingStatus(veiculo.veiculo_id);
      
      const { error } = await supabase
        .from(veiculoTable)
        .update({ status_veiculo: !veiculo.status_veiculo })
        .eq(veiculoPk, veiculo.veiculo_id);

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
        .from(veiculoTable)
        .update({ status_veiculo: newStatus })
        .in(veiculoPk, Array.from(selectedItems));

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

  const handleViewCombined = (veiculo: Veiculo) => {
    setSelectedVeiculo(veiculo);
    setIsCombinedModalOpen(true);
  };

  const handleSelectItem = (id: number) => {
    const newSelectedItems = new Set(selectedItems);
    if (selectedItems.has(id)) {
      newSelectedItems.delete(id);
    } else {
      newSelectedItems.add(id);
    }
    setSelectedItems(newSelectedItems);
    
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
      for (const id of selectedItems) {
        const { error } = await supabase
          .from(veiculoTable)
          .update({ status_veiculo: false })
          .eq(veiculoPk, id);

        if (error) throw error;
      }

      setVeiculos(veiculos.filter(v => !selectedItems.has(v.veiculo_id)));
      toast.success(`${selectedItems.size} veículo${selectedItems.size !== 1 ? 's' : ''} excluído${selectedItems.size !== 1 ? 's' : ''} com sucesso`);
      
      setSelectedItems(new Set());
      setSelectAll(false);
      setIsBulkDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting veiculos:', error);
      toast.error('Erro ao excluir veículos');
    }
  };

  const handleContextMenu = (e: React.MouseEvent, veiculo: Veiculo) => {
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
    setCurrentPage(1);
  };

  const sortedVeiculos = veiculos.sort((a, b) => {
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
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 dark:text-red-400">{error}</p>
      </div>
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
          <div className="relative w-full md:w-auto flex-1">
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

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 relative overflow-hidden">
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
              <table className="w-full min-w-[860px] table-fixed divide-y divide-gray-200 dark:divide-gray-700 xl:min-w-full">
                <thead>
                  <tr>
                    <th className="w-12 px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800 md:px-4"></th>
                    <th className="w-[24%] px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800 md:px-4">Veículo</th>
                    <th className="w-[20%] px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800 md:px-4">Agregado</th>
                    <th className="w-[26%] px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800 md:px-4">Características</th>
                    <th className="hidden w-[14%] px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800 lg:table-cell md:px-4">Rastreador</th>
                    <th className="w-[10%] px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800 md:px-4">Status</th>
                    <th className="w-[10%] px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800 md:px-4">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {sortedVeiculos.map((veiculo) => (
                    <tr 
                      key={veiculo.veiculo_id} 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                        selectedItems.has(veiculo.veiculo_id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                      onContextMenu={(e) => handleContextMenu(e, veiculo)}
                    >
                      <td className="px-3 py-4 align-middle md:px-4">
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={selectedItems.has(veiculo.veiculo_id)}
                            onChange={() => handleSelectItem(veiculo.veiculo_id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-4 align-top md:px-4">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                            <span className="text-lg font-medium text-gray-600 dark:text-gray-300">
                              {veiculo.placa.charAt(0)}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
                              {veiculo.placa.toUpperCase()}
                            </div>
                            <div className="line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
                              {[veiculo.marca, veiculo.tipo].filter(Boolean).join(' ') || 'Dados não informados'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4 align-top md:px-4">
                        <div className="min-w-0">
                          <div className="line-clamp-2 text-sm font-medium text-gray-900 dark:text-white">
                            {veiculo.motorista?.nome || 'Agregado não identificado'}
                          </div>
                          <div className="truncate text-sm text-gray-500 dark:text-gray-400">
                            {veiculo.motorista?.cpf ? formatCPF(veiculo.motorista.cpf) : 'CPF não informado'}
                          </div>
                          {veiculo.motorista?.telefone && (
                            <div className="truncate text-xs text-gray-400 dark:text-gray-500">
                              {veiculo.motorista.telefone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-4 align-top md:px-4">
                        <div className="text-sm text-gray-900 dark:text-white uppercase">
                          {veiculo.tipologia || 'NÃO INFORMADA'}
                        </div>
                        <div className="break-words text-sm text-gray-500 dark:text-gray-400">
                          {veiculo.peso && veiculo.cubagem ? (
                            <span className="uppercase">
                              PESO: {veiculo.peso} | CUBAGEM: {veiculo.cubagem}
                            </span>
                          ) : (
                            'DADOS NÃO INFORMADOS'
                          )}
                        </div>
                      </td>
                      <td className="hidden px-3 py-4 align-middle lg:table-cell md:px-4">
                        <div className="flex flex-col items-center justify-center gap-1 text-center">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            veiculo.possui_rastreador
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}>
                            {veiculo.possui_rastreador ? 'SIM' : 'NÃO'}
                          </span>
                          {veiculo.possui_rastreador && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 uppercase">
                              {veiculo.marca_rastreador}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-4 align-middle md:px-4">
                        <div className="flex flex-col items-center justify-center gap-2 text-center">
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
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 lg:hidden">
                            {veiculo.possui_rastreador ? veiculo.marca_rastreador || 'Rastreador ativo' : 'Sem rastreador'}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4 align-middle text-center text-sm font-medium md:px-4">
                        <div className="flex items-center justify-center space-x-3">
                          <button
                            onClick={() => handleViewCombined(veiculo)}
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
            
            <ScrollableTableIndicator 
              containerRef={tableContainerRef} 
              className="mr-2 ml-2"
            />
          </div>
        </div>
        {sortedVeiculos.length === 0 ? (
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
              onClick: () => handleViewCombined(contextMenu.veiculo!),
              color: 'text-blue-600 dark:text-blue-400'
            }
          ]}
        />
      )}

      {isBlixx ? (
        <BlixxVeiculoModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={fetchVeiculos}
          companyId={companyId as number | null}
          motoristas={motoristas.map((m: any) => ({
            motorista_blixx_id: m.motorista_blixx_id,
            nome: m.nome,
            cpf: m.cpf,
          }))}
        />
      ) : (
        <AddVeiculoModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={fetchVeiculos}
          motoristas={motoristas}
        />
      )}

      <EditVeiculoModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        veiculo={selectedVeiculo}
        onUpdate={fetchVeiculos}
        motoristas={motoristas}
      />

      {isBlixx ? (
        <BlixxVeiculoModal
          isOpen={isCombinedModalOpen}
          onClose={() => setIsCombinedModalOpen(false)}
          onSuccess={fetchVeiculos}
          companyId={companyId as number | null}
          veiculoId={selectedVeiculo?.veiculo_id ?? null}
          motoristas={motoristas.map((m: any) => ({
            motorista_blixx_id: m.motorista_blixx_id,
            nome: m.nome,
            cpf: m.cpf,
          }))}
        />
      ) : (
        <CombinedVehicleModal
          isOpen={isCombinedModalOpen}
          onClose={() => setIsCombinedModalOpen(false)}
          veiculo={selectedVeiculo}
          onUploadSuccess={fetchVeiculos}
        />
      )}

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
    </div>
  );
};

export default VeiculosAgregados;