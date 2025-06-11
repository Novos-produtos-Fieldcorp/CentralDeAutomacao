import React, { useState, useEffect, useCallback } from 'react';
import { Search, Eye, ChevronDown, ChevronUp, Edit2, Trash2, Camera, X, BarChart2, Filter, AlertCircle, RefreshCw } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { supabase, testSupabaseConnection } from '../../lib/supabase';
import toast from 'react-hot-toast';
import PeriodSelector from '../../components/hodometros/PeriodSelector';
import { useDateRange } from '../../hooks/useDateRange';
import type { Hodometro } from '../../types/database';
import BulkDeleteConfirmationModal from '../../components/BulkDeleteConfirmationModal';
import { useAuth } from '../../context/AuthContext';
import EditHodometroModal from '../../components/hodometros/EditHodometroModal';
import DeleteHodometroModal from '../../components/hodometros/DeleteHodometroModal';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatCPF } from '../../utils/format';
import ScrollableTableIndicator from '../../components/ScrollableTableIndicator';
import DriverMileageChart from '../../components/hodometros/DriverMileageChart';
import MileageChartModal from '../../components/hodometros/MileageChartModal';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell
} from 'recharts';

interface VehicleMileageData {
  veiculo_id: number;
  placa: string;
  marca?: string;
  tipo?: string;
  cliente?: string;
  leitura_inicial: number;
  leitura_final: number;
  km_total: number;
  ultima_data: string;
  hodometros: Hodometro[];
  isElectric: boolean;
}

interface DailyData {
  date: string;
  km: number;
  formattedDate: string;
}

const HodometrosLista = () => {
  const { query } = useCompanyData();
  const { companyId } = useAuth();
  const [hodometros, setHodometros] = useState<Hodometro[]>([]);
  const [vehicleMileageData, setVehicleMileageData] = useState<VehicleMileageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedHodometro, setSelectedHodometro] = useState<Hodometro | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('');
  const [clients, setClients] = useState<string[]>([]);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [showChartModal, setShowChartModal] = useState(false);
  const [selectedVehicleName, setSelectedVehicleName] = useState<string>('');
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('30days');
  const tableRef = React.useRef<HTMLDivElement>(null);

  const fetchHodometros = useCallback(async () => {
    try {
      setLoading(true);
      setConnectionError(false);
      
      // Test connection first
      const connectionOk = await testSupabaseConnection();
      if (!connectionOk) {
        setConnectionError(true);
        return;
      }

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

      // Extract unique clients
      const uniqueClients = Array.from(new Set(
        sortedData
          .filter(h => h.cliente?.nome)
          .map(h => h.cliente.nome)
      )).sort();
      
      setClients(uniqueClients);
    } catch (error) {
      console.error('Error fetching hodometros:', error);
      
      // Check if it's a connection error
      if (error instanceof Error && 
          (error.message.includes('conexão') || 
           error.message.includes('conectar') ||
           error.message.includes('servidor'))) {
        setConnectionError(true);
        toast.error(error.message);
      } else {
        toast.error('Erro ao carregar hodômetros');
      }
    } finally {
      setLoading(false);
    }
  }, [dateRange, companyId]);

  useEffect(() => {
    fetchHodometros();
  }, [fetchHodometros]);

  const handleRetry = () => {
    fetchHodometros();
  };

  // Format date from YYYY-MM-DD to DD/MM/YYYY
  const formatDateBR = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Format number with dot as thousands separator
  const formatNumber = (num: number | null | undefined): string => {
    if (num === null || num === undefined) return '-';
    
    // Convert to string with dots as thousands separators
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const processHodometrosData = (data: Hodometro[]) => {
    // Group by veiculo
    const groupedByVeiculo: Record<number, Hodometro[]> = {};
    
    data.forEach(hodometro => {
      if (!hodometro.veiculo) return;
      
      const veiculoId = hodometro.veiculo_id;
      if (!groupedByVeiculo[veiculoId]) {
        groupedByVeiculo[veiculoId] = [];
      }
      groupedByVeiculo[veiculoId].push(hodometro);
    });

    // Process each vehicle group
    const processedData: VehicleMileageData[] = [];
    
    Object.entries(groupedByVeiculo).forEach(([veiculoId, hodometrosVeiculo]) => {
      if (hodometrosVeiculo.length === 0) return;
      
      // Sort by date (oldest first for initial reading, newest first for final reading)
      const sortedHodometros = [...hodometrosVeiculo].sort((a, b) => {
        const dateA = new Date(`${a.data} ${a.hora}`);
        const dateB = new Date(`${b.data} ${b.hora}`);
        return dateA.getTime() - dateB.getTime();
      });
      
      const firstReading = sortedHodometros[0];
      const lastReading = sortedHodometros[sortedHodometros.length - 1];
      
      // Check if it's an electric vehicle (has battery readings)
      const isElectric = firstReading.bateria !== null && firstReading.bateria !== undefined;
      
      // Calculate total KM
      let totalKm = 0;
      if (isElectric) {
        // For electric vehicles, use the sum of km_rodado values
        totalKm = sortedHodometros.reduce((sum, reading) => sum + (reading.km_rodado || 0), 0);
      } else {
        // For regular vehicles, use the difference between last and first readings
        const firstHodLido = firstReading.hod_lido || 0;
        const lastHodLido = lastReading.hod_lido || 0;
        
        // Make sure the result is positive by taking the absolute difference
        totalKm = Math.max(0, lastHodLido - firstHodLido);
      }

      // Format date
      const lastDate = new Date(lastReading.data);
      const formattedDate = formatDateBR(lastReading.data);

      processedData.push({
        veiculo_id: parseInt(veiculoId),
        placa: firstReading.veiculo.placa.toUpperCase(),
        marca: firstReading.veiculo.marca,
        tipo: firstReading.veiculo.tipo,
        cliente: firstReading.cliente?.nome || 'Sem cliente',
        leitura_inicial: isElectric ? 0 : (firstReading.hod_lido || 0),
        leitura_final: isElectric ? 0 : (lastReading.hod_lido || 0),
        km_total: totalKm,
        ultima_data: formattedDate,
        hodometros: sortedHodometros,
        isElectric
      });
    });

    // Sort by placa (A-Z)
    processedData.sort((a, b) => a.placa.localeCompare(b.placa));
    
    setVehicleMileageData(processedData);
  };

  const generateDailyData = (hodometros: Hodometro[]) => {
    // Group by day
    const dailyDataMap = new Map<string, { km: number, formattedDate: string }>();
    
    // First, sort hodometros by date
    const sortedHodometros = [...hodometros].sort((a, b) => {
      return new Date(a.data).getTime() - new Date(b.data).getTime();
    });
    
    // Group by date and calculate daily km
    sortedHodometros.forEach(hodometro => {
      const dateKey = hodometro.data;
      const formattedDate = formatDateBR(dateKey);
      
      if (!dailyDataMap.has(dateKey)) {
        dailyDataMap.set(dateKey, { km: 0, formattedDate });
      }
      
      // Add km_rodado to daily total
      if (hodometro.km_rodado && hodometro.km_rodado > 0) {
        const currentData = dailyDataMap.get(dateKey)!;
        currentData.km += hodometro.km_rodado;
        dailyDataMap.set(dateKey, currentData);
      }
    });
    
    // Convert to array and sort by date
    const result = Array.from(dailyDataMap.entries()).map(([date, data]) => ({
      date,
      km: data.km,
      formattedDate: data.formattedDate
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    setDailyData(result);
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
    
    // Update selectAll state
    setSelectAll(newSelectedItems.size === vehicleMileageData.length);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(vehicleMileageData.map(m => m.veiculo_id)));
    }
    setSelectAll(!selectAll);
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

  const toggleExpand = (veiculo_id: number, vehicleName: string) => {
    if (expandedItem === veiculo_id) {
      setExpandedItem(null);
    } else {
      setExpandedItem(veiculo_id);
      setSelectedVehicleName(vehicleName);
      
      // Collect all hodometros for this vehicle
      const selectedData = vehicleMileageData.find(data => data.veiculo_id === veiculo_id);
      if (selectedData) {
        generateDailyData(selectedData.hodometros);
      }
    }
  };

  const openChartModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowChartModal(true);
  };

  const filteredData = vehicleMileageData.filter(data => {
    const searchLower = searchTerm.toLowerCase();
    const clientMatch = selectedClientFilter ? data.cliente === selectedClientFilter : true;
    
    return (
      clientMatch &&
      (data.placa.toLowerCase().includes(searchLower) ||
       (data.marca && data.marca.toLowerCase().includes(searchLower)) ||
       (data.tipo && data.tipo.toLowerCase().includes(searchLower)) ||
       (data.cliente && data.cliente.toLowerCase().includes(searchLower)))
    );
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  // Connection error state
  if (connectionError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Erro de Conexão
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
            Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.
          </p>
          <button
            onClick={handleRetry}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar Novamente
          </button>
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
              <Trash2 className="w-5 h-5" />
              Excluir Selecionados
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por placa, marca ou modelo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              autoComplete="off"
            />
            {loading ? (
              <div className="absolute left-3 top-2.5">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            )}
          </div>

          <div className="relative">
            <select
              value={selectedClientFilter}
              onChange={(e) => setSelectedClientFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none"
            >
              <option value="">Todos os clientes</option>
              {clients.map((client, index) => (
                <option key={index} value={client}>{client}</option>
              ))}
            </select>
            <Filter className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <ChevronDown className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>

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

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
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
          <div ref={tableRef} className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"></th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Veículo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">KM Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Última Leitura</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredData.map((data) => (
                  <React.Fragment key={data.veiculo_id}>
                    <tr 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${
                        selectedItems.has(data.veiculo_id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                      onClick={() => toggleExpand(data.veiculo_id, data.placa)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedItems.has(data.veiculo_id)}
                            onChange={() => handleSelectItem(data.veiculo_id)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                          />
                          {expandedItem === data.veiculo_id ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-medium">
                            {data.placa.charAt(0)}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {data.placa}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {data.marca} {data.tipo}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          {data.isElectric ? 'Ciclomotor Elétrico' : 'Automóvel'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {data.cliente || "Sem cliente"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          {formatNumber(data.km_total)} km
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {data.ultima_data}
                        </div>
                      </td>
                    </tr>
                    
                    {expandedItem === data.veiculo_id && (
                      <tr>
                        <td colSpan={6} className="px-0 py-0 border-b border-gray-200 dark:border-gray-700">
                          <div className="bg-gray-50 dark:bg-gray-700/30 p-4">
                            <div className="flex justify-between items-center mb-4">
                              <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                <BarChart2 className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                                Quilometragem Diária
                              </h4>
                              <button
                                onClick={openChartModal}
                                className="text-blue-600 dark:text-blue-400 text-sm hover:underline flex items-center gap-1"
                              >
                                <Eye size={16} />
                                Ver gráfico completo
                              </button>
                            </div>
                            
                            {/* Recharts Bar Chart */}
                            <div className="h-64 w-full mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={dailyData}
                                  margin={{ top: 10, right: 30, left: 0, bottom: 30 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                                  <XAxis 
                                    dataKey="formattedDate" 
                                    angle={-45} 
                                    textAnchor="end" 
                                    height={60} 
                                    tick={{ fontSize: 12 }}
                                    stroke="#9CA3AF"
                                  />
                                  <YAxis 
                                    tickFormatter={(value) => formatNumber(value)}
                                    stroke="#9CA3AF"
                                  />
                                  <Tooltip 
                                    formatter={(value: any) => [formatNumber(value) + ' km', 'Quilômetros']}
                                    contentStyle={{ 
                                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                      borderRadius: '0.5rem',
                                      border: '1px solid #e5e7eb',
                                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                    }}
                                  />
                                  <Bar 
                                    dataKey="km" 
                                    fill="#3B82F6" 
                                    radius={[4, 4, 0, 0]}
                                    animationDuration={1500}
                                  >
                                    {dailyData.map((entry, index) => (
                                      <Cell 
                                        key={`cell-${index}`} 
                                        fill={`rgba(59, 130, 246, ${0.5 + (index * 0.05)})`} 
                                      />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                            
                            {/* Leituras do veículo */}
                            <div className="overflow-x-auto">
                              <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                  <thead className="bg-gray-100 dark:bg-gray-800 rounded-t-xl">
                                    <tr>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider rounded-tl-xl">Data/Hora</th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Motorista</th>
                                      {data.isElectric ? (
                                        <>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Trip Informada</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Trip Lida</th>
                                        </>
                                      ) : (
                                        <>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hodômetro Informado</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hodômetro Lido</th>
                                        </>
                                      )}
                                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider rounded-tr-xl">Foto</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {data.hodometros.map((hodometro, index) => (
                                      <tr key={hodometro.id_hodometro} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                          <div className="text-sm text-gray-900 dark:text-white">
                                            {formatDateBR(hodometro.data)}
                                          </div>
                                          <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {hodometro.hora}
                                          </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                                            {hodometro.motorista?.nome || 'Não informado'}
                                          </div>
                                          <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {hodometro.motorista?.cpf ? formatCPF(hodometro.motorista.cpf) : ''}
                                          </div>
                                        </td>
                                        {data.isElectric ? (
                                          <>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                              {hodometro.trip_informada || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                              {hodometro.trip_lida !== null ? formatNumber(hodometro.trip_lida) : '-'}
                                            </td>
                                          </>
                                        ) : (
                                          <>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                              {hodometro.hod_informado !== null ? formatNumber(hodometro.hod_informado) : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                              {hodometro.hod_lido !== null ? formatNumber(hodometro.hod_lido) : '-'}
                                            </td>
                                          </>
                                        )}
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                          <div className="flex items-center justify-end space-x-3">
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
                                    {data.hodometros.length === 0 && (
                                      <tr>
                                        <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                          Nenhuma leitura encontrada
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          
          <ScrollableTableIndicator 
            containerRef={tableRef} 
            className="mr-2 ml-2"
          />
        </div>
        
        {filteredData.length === 0 && !connectionError && (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              Nenhuma leitura encontrada para o período selecionado
            </p>
          </div>
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
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <X size={24} />
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
      <MileageChartModal
        isOpen={showChartModal}
        onClose={() => setShowChartModal(false)}
        data={dailyData}
        driverName={selectedVehicleName}
      />

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