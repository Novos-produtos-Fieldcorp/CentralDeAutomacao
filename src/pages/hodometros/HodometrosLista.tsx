import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Camera, ChevronDown, ChevronUp, Edit2, Trash2, X, BarChart2, Calendar, Truck, User, Building2 } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useDateRange } from '../../hooks/useDateRange';
import PeriodSelector from '../../components/hodometros/PeriodSelector';
import type { Hodometro } from '../../types/database';
import { formatCPF } from '../../utils/format';
import BulkDeleteConfirmationModal from '../../components/BulkDeleteConfirmationModal';
import { useAuth } from '../../context/AuthContext';
import EditHodometroModal from '../../components/hodometros/EditHodometroModal';
import DeleteHodometroModal from '../../components/hodometros/DeleteHodometroModal';
import LoadingSpinner from '../../components/LoadingSpinner';

interface MileageData {
  motorista_id: number;
  motorista_nome: string;
  motorista_foto?: string | null;
  veiculo_placa: string;
  cliente_nome: string | null;
  leitura_inicial: number;
  leitura_final: number;
  km_total: number;
  ultima_data: string;
  hodometros: Hodometro[];
  isExpanded: boolean;
}

interface MonthlyData {
  month: string;
  km: number;
}

const HodometrosLista = () => {
  const { query } = useCompanyData();
  const { companyId } = useAuth();
  const [hodometros, setHodometros] = useState<Hodometro[]>([]);
  const [mileageData, setMileageData] = useState<MileageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [clients, setClients] = useState<{id: number, nome: string}[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedHodometro, setSelectedHodometro] = useState<Hodometro | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [selectedDriverData, setSelectedDriverData] = useState<{
    driverId: number;
    driverName: string;
    monthlyData: MonthlyData[];
  } | null>(null);
  const [showChartModal, setShowChartModal] = useState(false);
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('1month');

  const fetchHodometros = useCallback(async () => {
    try {
      setLoading(true);
      
      const baseQuery = supabase.from('hodometro')
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
          ),
          cliente:cliente_id (
            cliente_id,
            nome
          )
        `);

      const { data, error } = await baseQuery
        .eq('company_id', companyId)
        .gte('data', dateRange.startDate)
        .lte('data', dateRange.endDate)
        .order('data', { ascending: false })
        .order('hora', { ascending: false });

      if (error) throw error;

      // Ensure data is sorted by date (newest first)
      const sortedData = (data || []).sort((a, b) => {
        const dateA = new Date(`${a.data} ${a.hora}`);
        const dateB = new Date(`${b.data} ${b.hora}`);
        return dateB.getTime() - dateA.getTime();
      });

      setHodometros(sortedData);

      // Process data for the new UI
      processHodometrosData(sortedData);
      
      // Fetch clients for filter
      fetchClients();
    } catch (error) {
      console.error('Error fetching hodometros:', error);
      toast.error('Erro ao carregar hodômetros');
    } finally {
      setLoading(false);
    }
  }, [dateRange, companyId]);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('cliente')
        .select('cliente_id, nome')
        .eq('company_id', companyId)
        .eq('st_cliente', true)
        .order('nome');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error('Erro ao carregar clientes');
    }
  };

  const processHodometrosData = (hodometros: Hodometro[]) => {
    // Group by motorista and veiculo
    const groupedData: Record<string, Hodometro[]> = {};
    
    hodometros.forEach(hodometro => {
      if (!hodometro.motorista || !hodometro.veiculo) return;
      
      const key = `${hodometro.motorista_id}_${hodometro.veiculo_id}`;
      if (!groupedData[key]) {
        groupedData[key] = [];
      }
      groupedData[key].push(hodometro);
    });
    
    // Process each group to create MileageData
    const processedData: MileageData[] = [];
    
    Object.values(groupedData).forEach(group => {
      if (group.length === 0) return;
      
      // Sort by date (oldest first for calculations)
      const sortedGroup = [...group].sort((a, b) => {
        const dateA = new Date(`${a.data} ${a.hora}`);
        const dateB = new Date(`${b.data} ${b.hora}`);
        return dateA.getTime() - dateB.getTime();
      });
      
      const firstReading = sortedGroup[0];
      const lastReading = sortedGroup[sortedGroup.length - 1];
      
      // Skip if missing required data
      if (!firstReading.motorista || !firstReading.veiculo) return;
      
      // Calculate total KM
      let totalKm = 0;
      let initialReading = 0;
      let finalReading = 0;
      
      // Check if it's an electric vehicle (has battery readings)
      const isElectric = firstReading.bateria !== null && firstReading.bateria !== undefined;
      
      if (isElectric) {
        // For electric vehicles, use the sum of km_rodado values
        totalKm = sortedGroup.reduce((sum, reading) => {
          return sum + (reading.km_rodado || 0);
        }, 0);
      } else {
        // For regular vehicles, use the difference between first and last readings
        initialReading = firstReading.hod_lido || 0;
        finalReading = lastReading.hod_lido || 0;
        totalKm = Math.max(0, finalReading - initialReading);
      }
      
      processedData.push({
        motorista_id: firstReading.motorista.motorista_id,
        motorista_nome: firstReading.motorista.nome,
        motorista_foto: null, // We'll use initials instead of photos
        veiculo_placa: firstReading.veiculo.placa.toUpperCase(),
        cliente_nome: lastReading.cliente?.nome || 'Sem cliente',
        leitura_inicial: initialReading,
        leitura_final: finalReading,
        km_total: totalKm,
        ultima_data: lastReading.data,
        hodometros: sortedGroup,
        isExpanded: false
      });
    });
    
    // Sort by total KM (highest first)
    processedData.sort((a, b) => b.km_total - a.km_total);
    
    setMileageData(processedData);
  };

  useEffect(() => {
    fetchHodometros();
  }, [fetchHodometros]);

  const toggleExpand = (index: number) => {
    setMileageData(prev => 
      prev.map((item, i) => 
        i === index ? { ...item, isExpanded: !item.isExpanded } : item
      )
    );
  };

  const handleEdit = (e: React.MouseEvent, hodometro: Hodometro) => {
    e.stopPropagation();
    setSelectedHodometro(hodometro);
    setIsEditModalOpen(true);
  };

  const handleDelete = (e: React.MouseEvent, hodometro: Hodometro) => {
    e.stopPropagation();
    setSelectedHodometro(hodometro);
    setIsDeleteModalOpen(true);
  };

  const handleShowPhoto = (e: React.MouseEvent, photo: string | null) => {
    e.stopPropagation();
    if (photo) {
      setSelectedPhoto(photo);
      setShowPhotoModal(true);
    } else {
      toast.error('Nenhuma foto disponível');
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedHodometro) return;

    try {
      const { error } = await query('hodometro')
        .delete()
        .eq('id_hodometro', selectedHodometro.id_hodometro);

      if (error) throw error;

      toast.success('Leitura excluída com sucesso');
      fetchHodometros();
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting hodometro:', error);
      toast.error('Erro ao excluir leitura');
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
  };

  const handleBulkDelete = async () => {
    try {
      // Delete all selected items
      for (const id of selectedItems) {
        const { error } = await query('hodometro')
          .delete()
          .eq('id_hodometro', id);

        if (error) throw error;
      }

      toast.success(`${selectedItems.size} leitura${selectedItems.size !== 1 ? 's' : ''} excluída${selectedItems.size !== 1 ? 's' : ''} com sucesso`);
      fetchHodometros();
      setSelectedItems(new Set());
      setIsBulkDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting hodometros:', error);
      toast.error('Erro ao excluir leituras');
    }
  };

  const showMonthlyKmChart = (driverId: number, driverName: string) => {
    // Get all hodometros for this driver
    const driverHodometros = hodometros.filter(h => h.motorista_id === driverId);
    
    // Group by month
    const monthlyData: Record<string, number> = {};
    
    driverHodometros.forEach(hodometro => {
      const date = new Date(hodometro.data);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = 0;
      }
      
      monthlyData[monthKey] += hodometro.km_rodado || 0;
    });
    
    // Convert to array and sort by month
    const chartData: MonthlyData[] = Object.entries(monthlyData)
      .map(([key, km]) => {
        const [year, month] = key.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        return {
          month: date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
          km
        };
      })
      .sort((a, b) => {
        const dateA = new Date(a.month);
        const dateB = new Date(b.month);
        return dateA.getTime() - dateB.getTime();
      });
    
    setSelectedDriverData({
      driverId,
      driverName,
      monthlyData: chartData
    });
    
    setShowChartModal(true);
  };

  const filteredData = mileageData.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      item.motorista_nome.toLowerCase().includes(searchLower) ||
      item.veiculo_placa.toLowerCase().includes(searchLower);
    
    const matchesClient = !selectedClient || 
      (item.cliente_nome && item.cliente_nome.toLowerCase() === selectedClient.toLowerCase());
    
    return matchesSearch && matchesClient;
  });

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
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

      {/* Filters Section */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por motorista ou placa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 
                       dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 
                       focus:border-blue-500 text-gray-900 dark:text-gray-100"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>

          {/* Client Filter */}
          <div className="relative">
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 
                       dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 
                       focus:border-blue-500 text-gray-900 dark:text-gray-100 appearance-none"
            >
              <option value="">Todos os clientes</option>
              {clients.map(client => (
                <option key={client.cliente_id} value={client.nome}>
                  {client.nome}
                </option>
              ))}
            </select>
            <Building2 className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <ChevronDown className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
          </div>

          {/* Period Selector */}
          <div>
            <PeriodSelector
              periodType={periodType}
              dateRange={dateRange}
              onPeriodChange={updatePeriod}
              onDateRangeChange={setDateRange}
            />
          </div>
        </div>
      </div>

      {/* Mileage Cards */}
      <div className="space-y-4">
        {filteredData.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center shadow-md border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col items-center justify-center">
              <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-full mb-4">
                <Truck className="w-8 h-8 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Nenhuma leitura encontrada</h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-md">
                Não foram encontradas leituras de hodômetro para o período e filtros selecionados.
              </p>
            </div>
          </div>
        ) : (
          filteredData.map((item, index) => (
            <div 
              key={`${item.motorista_id}_${item.veiculo_placa}`} 
              className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Main Card */}
              <div 
                className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                onClick={() => toggleExpand(index)}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg">
                      {item.motorista_nome.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{item.motorista_nome}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-blue-600 dark:text-blue-400 font-medium">{item.veiculo_placa}</span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">•</span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">{item.cliente_nome}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Leitura Inicial</div>
                      <div className="font-medium text-gray-900 dark:text-white">{item.leitura_inicial.toLocaleString('pt-BR')} km</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Leitura Final</div>
                      <div className="font-medium text-gray-900 dark:text-white">{item.leitura_final.toLocaleString('pt-BR')} km</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Total KM</div>
                      <div className="font-medium text-gray-900 dark:text-white">{item.km_total.toLocaleString('pt-BR')} km</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Última Leitura</div>
                      <div className="font-medium text-gray-900 dark:text-white">{formatDate(item.ultima_data)}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        showMonthlyKmChart(item.motorista_id, item.motorista_nome);
                      }}
                      className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 
                               hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title="Ver gráfico de KM por mês"
                    >
                      <BarChart2 size={20} />
                    </button>
                    {item.isExpanded ? (
                      <ChevronUp className="text-gray-400" size={20} />
                    ) : (
                      <ChevronDown className="text-gray-400" size={20} />
                    )}
                  </div>
                </div>
              </div>
              
              {/* Expanded Details */}
              {item.isExpanded && (
                <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <div className="p-4">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">Histórico de Leituras</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hora</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hodômetro</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">KM Rodado</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {item.hodometros.map((hodometro) => (
                            <tr key={hodometro.id_hodometro} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                {formatDate(hodometro.data)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                {hodometro.hora}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                {hodometro.bateria !== null && hodometro.bateria !== undefined ? (
                                  <span>Bateria: {hodometro.bateria}%</span>
                                ) : (
                                  <span>{hodometro.hod_lido?.toLocaleString('pt-BR')} km</span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                {hodometro.km_rodado?.toLocaleString('pt-BR')} km
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedItems.has(hodometro.id_hodometro)}
                                    onChange={() => handleSelectItem(hodometro.id_hodometro)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <button
                                    onClick={(e) => handleShowPhoto(e, hodometro.foto_hodometro)}
                                    className={`text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 
                                             transition-colors ${!hodometro.foto_hodometro && 'opacity-50 cursor-not-allowed'}`}
                                    title={hodometro.foto_hodometro ? "Ver foto do hodômetro" : "Sem foto disponível"}
                                  >
                                    <Camera size={18} />
                                  </button>
                                  <button
                                    onClick={(e) => handleEdit(e, hodometro)}
                                    className="text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300 
                                             transition-colors"
                                    title="Editar"
                                  >
                                    <Edit2 size={18} />
                                  </button>
                                  <button
                                    onClick={(e) => handleDelete(e, hodometro)}
                                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 
                                             transition-colors"
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
              )}
            </div>
          ))
        )}
      </div>

      {/* Photo Modal */}
      {showPhotoModal && selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowPhotoModal(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-md border border-gray-200 dark:border-gray-700"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Foto do Hodômetro
              </h3>
              <button
                onClick={() => setShowPhotoModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="relative aspect-video">
              <img
                src={selectedPhoto}
                alt="Foto do Hodômetro"
                className="absolute inset-0 w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Chart Modal */}
      {showChartModal && selectedDriverData && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowChartModal(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-md border border-gray-200 dark:border-gray-700"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                KM Rodado por Mês - {selectedDriverData.driverName}
              </h3>
              <button
                onClick={() => setShowChartModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              {selectedDriverData.monthlyData.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">
                    Não há dados suficientes para gerar o gráfico
                  </p>
                </div>
              ) : (
                <div className="h-64">
                  <div className="flex h-full items-end">
                    {selectedDriverData.monthlyData.map((data, i) => {
                      const maxKm = Math.max(...selectedDriverData.monthlyData.map(d => d.km));
                      const percentage = (data.km / maxKm) * 100;
                      
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center group">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {data.km.toLocaleString('pt-BR')} km
                          </div>
                          <div 
                            className="w-full max-w-[40px] bg-blue-500 dark:bg-blue-600 rounded-t-md transition-all duration-500 ease-out hover:bg-blue-600 dark:hover:bg-blue-500"
                            style={{ height: `${Math.max(5, percentage)}%` }}
                          ></div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 font-medium">
                            {data.month}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <EditHodometroModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        hodometro={selectedHodometro}
        onUpdate={fetchHodometros}
      />

      <DeleteHodometroModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        hodometroData={selectedHodometro}
      />

      <BulkDeleteConfirmationModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        title="Confirmar Exclusão em Massa"
        message="Tem certeza que deseja excluir todas as leituras selecionadas? Esta ação não pode ser desfeita."
        itemCount={selectedItems.size}
        itemType="leitura"
      />
    </div>
  );
};

export default HodometrosLista;