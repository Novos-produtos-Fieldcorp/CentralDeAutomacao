import React, { useEffect, useState, useRef } from 'react';
import { Search, Plus, FilePen, Phone } from 'lucide-react';
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
import { supabase, testSupabaseConnection } from '../../lib/supabase';
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
  const [veiculos, setVeiculos] = useState<VeiculoWithMotorista[]>([]);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [sortConfig] = useState<{
    key: keyof VeiculoWithMotorista;
    direction: 'asc' | 'desc';
  }>({ key: 'placa', direction: 'asc' });

  // Aumentado o delay do debounce de 500ms para 1000ms para alinhar com outros componentes
  const debouncedSearchTerm = useDebounce(searchTerm, 1000);
  const debouncedPhoneSearch = useDebounce(phoneSearch, 1000);

  
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
        setError(null);
        
        // Test connection first
        const isConnected = await testSupabaseConnection();
        if (!isConnected) {
          throw new Error('Não foi possível conectar ao banco de dados. Verifique se o Supabase está configurado corretamente e se as configurações de CORS incluem *.webcontainer-api.io');
        }
        
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
    if (currentPage === 1 && pageSize === 100 && debouncedSearchTerm === '' && debouncedPhoneSearch === '') {
      // Só mostra o loading inicial na primeira montagem
      init();
    } else {
      fetchVeiculos();
      fetchMotoristas();
    }
  }, [currentPage, pageSize, debouncedSearchTerm, debouncedPhoneSearch]);

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
      
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      
      // Buscar motoristas contratados filtrando por telefone, se necessário
      let motoristasQuery = supabase
        .from('motorista')
        .select('motorista_id')
        .eq('company_id', companyId)
        .eq('st_cadastro', 'contratado')
        .eq('funcao', 'Agregado');
        
      if (phoneSearch) {
        motoristasQuery = motoristasQuery.ilike('telefone', `%${phoneSearch}%`);
      }
      
      const { data: motoristasData, error: motoristasError } = await motoristasQuery;
      
      if (motoristasError) {
        throw new Error(`Erro ao buscar motoristas: ${motoristasError.message}`);
      }
      
      if (!motoristasData || motoristasData.length === 0) {
        setVeiculos([]);
        setTotalCount(0);
        setTotalPages(1);
        return;
      }
      
      const motoristaIds = motoristasData.map(m => m.motorista_id);

      // Contar veículos apenas com os IDs filtrados
      let vehicleCountQuery = supabase
        .from('veiculo')
        .select('veiculo_id', { count: 'exact', head: true })
        .eq('status_veiculo', true)
        .in('motorista_id', motoristaIds);
        
      if (searchTerm) {
        vehicleCountQuery = vehicleCountQuery.or(
          `placa.ilike.%${searchTerm}%,marca.ilike.%${searchTerm}%,tipo.ilike.%${searchTerm}%`
        );
      }
      
      const { count: vehicleCount, error: vehicleCountError } = await vehicleCountQuery;
      
      if (vehicleCountError) {
        throw new Error(`Erro ao contar veículos: ${vehicleCountError.message}`);
      }
      
      setTotalCount(vehicleCount || 0);
      setTotalPages(Math.max(1, Math.ceil((vehicleCount || 0) / pageSize)));

      let dataQuery = supabase
        .from('veiculo')
        .select(`
          *,
          motorista:motorista_id (
            motorista_id,
            nome,
            cpf,
            telefone,
            email,
            st_cadastro,
            documento_motorista (*)
          ),
          documento_veiculo (*)
        `)
        .in('motorista_id', motoristaIds);
      
      if (searchTerm) {
        dataQuery = dataQuery.or(
          `placa.ilike.%${searchTerm}%,marca.ilike.%${searchTerm}%,tipo.ilike.%${searchTerm}%`
        );
      }
      
      dataQuery = dataQuery
        .order('placa', { ascending: true })
        .range(from, to);
      
      const { data: veiculosData, error: veiculosError } = await dataQuery;

      if (veiculosError) {
        throw new Error(`Erro ao buscar veículos: ${veiculosError.message}`);
      }

      if (!veiculosData) {
        setVeiculos([]);
        return;
      }

      const veiculosContratados = veiculosData
        .filter(veiculo => veiculo.motorista?.st_cadastro === 'contratado')
        .map(veiculo => ({
          ...veiculo,
          placa: veiculo.placa?.toUpperCase() || ''
        }))
        .sort((a, b) => (a.placa || '').localeCompare(b.placa || ''));

      setVeiculos(veiculosContratados);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao carregar veículos';
      console.error('Error fetching veiculos:', errorMessage);
      setError(errorMessage);
      toast.error(errorMessage);
      setVeiculos([]);
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

  const handleDelete = (veiculo: Veiculo) => {
    setSelectedVeiculo(veiculo);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedVeiculo) return;
    try {
      const { error } = await supabase
        .from('veiculo')
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

  const handleToggleStatus = async (veiculo: Veiculo, e: React.MouseEvent) => {
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
          .from('veiculo')
          .update({ status_veiculo: false })
          .eq('veiculo_id', id);

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
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-2xl mx-auto">
          <div className="flex items-center justify-center mb-4">
            <div className="flex-shrink-0">
              <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-red-800 dark:text-red-200">
                Erro de Conexão
              </h3>
            </div>
          </div>
          <div className="text-red-700 dark:text-red-300 text-sm">
            <p className="mb-4">{error}</p>
            <div className="bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-700 rounded-md p-4">
              <h4 className="font-medium mb-2">Para resolver este problema:</h4>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Verifique se você clicou no botão "Connect to Supabase" no canto superior direito</li>
                <li>Vá para o painel do Supabase → Configurações do Projeto → API</li>
                <li>Na seção CORS, adicione <code className="bg-red-200 dark:bg-red-800 px-1 rounded">*.webcontainer-api.io</code> às URLs permitidas</li>
                <li>Verifique se as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão configuradas</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
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
        </div>
      </div>

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

          <div className="relative w-full md:w-auto flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar por telefone..."
                value={phoneSearch}
                onChange={(e) => setPhoneSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                autoComplete="off"
              />
              <Phone className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Motorista</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Características</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Rastreador</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Ações</th>
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
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {veiculo.motorista?.nome}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {veiculo.motorista?.cpf && formatCPF(veiculo.motorista.cpf)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white uppercase">
                          {veiculo.tipologia || 'NÃO INFORMADA'}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {veiculo.peso && veiculo.cubagem ? (
                            <span className="uppercase">
                              PESO: {veiculo.peso} | CUBAGEM: {veiculo.cubagem}
                            </span>
                          ) : (
                            'DADOS NÃO INFORMADOS'
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

      <AddVeiculoModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchVeiculos}
        motoristas={motoristas}
      />

      <EditVeiculoModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        veiculo={selectedVeiculo}
        onUpdate={fetchVeiculos}
        motoristas={motoristas}
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
    </div>
  );
};

export default VeiculosAgregados;