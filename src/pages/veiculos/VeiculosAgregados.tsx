import React, { useEffect, useState, useRef } from 'react';
import { Edit2, Trash2, Search, Plus, FilePen, FileText, Phone } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import type { Veiculo, Motorista } from '../../types/database';
import AddVeiculoModal from '../../components/veiculos/AddVeiculoModal';
import EditVeiculoModal from '../../components/veiculos/EditVeiculoModal';
import VehicleDetailsModal from '../../components/veiculos/VehicleDetailsModal';
import VehicleDocumentsModal from '../../components/veiculos/VehicleDocumentsModal';
import DeleteVehicleModal from '../../components/veiculos/DeleteVehicleModal';
import BulkDeleteConfirmationModal from '../../components/BulkDeleteConfirmationModal';
import toast from 'react-hot-toast';
import { formatCPF } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';
import ScrollableTableIndicator from '../../components/ScrollableTableIndicator';
import ContextMenu from '../../components/ContextMenu';
import { supabase } from '../../lib/supabase';
import { useDebounce } from '../../hooks/useDebounce';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: keyof VeiculoWithMotorista;
    direction: 'asc' | 'desc';
  }>({ key: 'placa', direction: 'asc' });

  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const debouncedPhoneSearch = useDebounce(phoneSearch, 500);

  const [isSearching, setIsSearching] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isDocumentsModalOpen, setIsDocumentsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [selectedVeiculo, setSelectedVeiculo] = useState<Veiculo | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
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
        setIsSearching(true);
        await fetchVeiculos();
        await fetchMotoristas();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao inicializar';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsSearching(false);
      }
    };
    init();
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
    if (!companyId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('veiculo')
        .select(`
          *,
          motorista (
            motorista_id,
            nome,
            cpf,
            telefone
          ),
          agregado (
            agregado_id,
            nome,
            st_agregado
          )
        `)
        .eq('company_id', companyId)
        .eq('agregado.st_agregado', true);

      if (error) throw error;

      const veiculosData = data || [];
      setVeiculos(veiculosData);
      setTotalCount(veiculosData.length);
    } catch (error) {
      console.error('Error fetching veiculos:', error);
      toast.error('Erro ao carregar veículos');
      setVeiculos([]);
    } finally {
      setLoading(false);
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

  const handleEdit = (veiculo: Veiculo) => {
    setSelectedVeiculo(veiculo);
    setIsEditModalOpen(true);
  };

  const handleViewDetails = (veiculo: Veiculo) => {
    setSelectedVeiculo(veiculo);
    setIsDetailsModalOpen(true);
  };

  const handleViewDocuments = (veiculo: Veiculo) => {
    setSelectedVeiculo(veiculo);
    setIsDocumentsModalOpen(true);
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

  const filteredVeiculos = veiculos
    .filter(veiculo => {
      const searchString = debouncedSearchTerm.toLowerCase();
      const phoneSearchString = debouncedPhoneSearch.toLowerCase();
      
      const matchesSearch = !debouncedSearchTerm || 
        veiculo.placa.toLowerCase().includes(searchString) ||
        veiculo.marca.toLowerCase().includes(searchString) ||
        veiculo.tipo.toLowerCase().includes(searchString) ||
        (veiculo.motorista?.nome?.toLowerCase().includes(searchString)) ||
        (veiculo.motorista?.cpf?.includes(searchString));

      const matchesPhone = !debouncedPhoneSearch ||
        (veiculo.motorista?.telefone?.toLowerCase().includes(phoneSearchString));

      return matchesSearch && matchesPhone;
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

  if (loading) {
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
              <Trash2 className="w-5 h-5" />
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
              />
              {isSearching ? (
                <div className="absolute left-3 top-2.5">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              )}
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
              />
              {isSearching ? (
                <div className="absolute left-3 top-2.5">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <Phone className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                     transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Adicionar Veículo
            </button>
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
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-3">
                          <button
                            onClick={() => handleViewDetails(veiculo)}
                            className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
                            title="Visualizar Detalhes - Veja todas as informações do veículo, incluindo especificações técnicas"
                          >
                            <FilePen size={18} />
                          </button>
                          <button
                            onClick={() => handleViewDocuments(veiculo)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            title="Documentos do Veículo - Visualize e faça upload do CRV e outros documentos"
                          >
                            <FileText size={18} />
                          </button>
                          <button 
                            onClick={() => handleEdit(veiculo)}
                            className="text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300 transition-colors"
                            title="Editar Veículo - Altere informações como marca, modelo, características e rastreador"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDelete(veiculo)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                            title="Excluir Veículo - Remove permanentemente o veículo do sistema"
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
              label: 'Visualizar Detalhes',
              onClick: () => handleViewDetails(contextMenu.veiculo!),
              color: 'text-gray-600 dark:text-gray-400'
            },
            {
              icon: <FileText size={16} />,
              label: 'Documentos do Veículo',
              onClick: () => handleViewDocuments(contextMenu.veiculo!),
              color: 'text-blue-600 dark:text-blue-400'
            },
            {
              icon: <Edit2 size={16} />,
              label: 'Editar Veículo',
              onClick: () => handleEdit(contextMenu.veiculo!),
              color: 'text-yellow-500 dark:text-yellow-400'
            },
            {
              icon: <Trash2 size={16} />,
              label: 'Excluir Veículo',
              onClick: () => handleDelete(contextMenu.veiculo!),
              color: 'text-red-600 dark:text-red-400'
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

      <VehicleDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        veiculo={selectedVeiculo}
      />

      <VehicleDocumentsModal
        isOpen={isDocumentsModalOpen}
        onClose={() => setIsDocumentsModalOpen(false)}
        documento={selectedVeiculo?.documento_veiculo?.[0] || null}
        placa={selectedVeiculo?.placa || ''}
        marca={selectedVeiculo?.marca || ''}
        tipo={selectedVeiculo?.tipo || ''}
        veiculo_id={selectedVeiculo?.veiculo_id}
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