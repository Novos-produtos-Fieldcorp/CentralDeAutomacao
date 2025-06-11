import React, { useState, useEffect, useCallback } from 'react';
import { Search, Eye, ChevronDown, ChevronUp, Edit2, Trash2, Camera, X, BarChart2, Filter } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { supabase } from '../../lib/supabase';
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

interface MotoristaWithDetails extends Motorista {
  veiculo?: Veiculo[];
}

interface MileageData {
  veiculo_id: number;
  placa: string;
  marca?: string;
  tipo?: string;
  motoristas: {
    motorista_id: number;
    nome: string;
    cpf: string;
    cliente?: string;
    leitura_inicial: number;
    leitura_final: number;
    km_total: number;
    ultima_data: string;
    hodometros: Hodometro[];
    isElectric: boolean;
  }[];
  totalKm: number;
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
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [showChartModal, setShowChartModal] = useState(false);
  const [selectedVehicleName, setSelectedVehicleName] = useState<string>('');
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('30days');
  const tableRef = React.useRef<HTMLDivElement>(null);

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

      // Extract unique clients
      const uniqueClients = Array.from(new Set(
        sortedData
          .filter(h => h.cliente?.nome)
          .map(h => h.cliente.nome)
      )).sort();
      
      setClients(uniqueClients);
    } catch (error) {
      console.error('Error fetching hodometros:', error);
      toast.error('Erro ao carregar hodômetros');
    } finally {
      setLoading(false);
    }
  }, [dateRange, companyId]);

  useEffect(() => {
    fetchHodometros();
  }, [fetchHodometros]);

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
      if (!hodometro.veiculo || !hodometro.veiculo_id) return;
      
      const veiculoId = hodometro.veiculo_id;
      if (!groupedByVeiculo[veiculoId]) {
        groupedByVeiculo[veiculoId] = [];
      }
      groupedByVeiculo[veiculoId].push(hodometro);
    });

    // Process each veiculo group
    const processedData: MileageData[] = [];
    
    Object.entries(groupedByVeiculo).forEach(([veiculoId, hodometrosVeiculo]) => {
      if (hodometrosVeiculo.length === 0) return;
      
      // Group by motorista
      const groupedByMotorista: Record<number, Hodometro[]> = {};
      
      hodometrosVeiculo.forEach(hodometro => {
        if (!hodometro.motorista_id) return;
        
        const motoristaId = hodometro.motorista_id;
        if (!groupedByMotorista[motoristaId]) {
          groupedByMotorista[motoristaId] = [];
        }
        groupedByMotorista[motoristaId].push(hodometro);
      });
      
      // Process each motorista group
      const motoristas = Object.entries(groupedByMotorista).map(([motoristaId, hodometrosMotorista]) => {
        // Sort by date (oldest first for initial reading, newest first for final reading)
        const sortedHodometros = [...hodometrosMotorista].sort((a, b) => {
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

        return {
          motorista_id: parseInt(motoristaId),
          nome: firstReading.motorista?.nome || 'Desconhecido',
          cpf: firstReading.motorista?.cpf || '',
          cliente: firstReading.cliente?.nome || 'Sem cliente',
          leitura_inicial: isElectric ? 0 : (firstReading.hod_lido || 0),
          leitura_final: isElectric ? 0 : (lastReading.hod_lido || 0),
          km_total: totalKm,
          ultima_data: formattedDate,
          hodometros: sortedHodometros,
          isElectric
        };
      });
      
      // Calculate total KM across all motoristas for this vehicle
      const totalKm = motoristas.reduce((sum, motorista) => sum + motorista.km_total, 0);
      
      // Get the first hodometro to extract vehicle info
      const firstHodometro = hodometrosVeiculo[0];
      
      processedData.push({
        veiculo_id: parseInt(veiculoId),
        placa: firstHodometro.veiculo.placa.toUpperCase(),
        marca: firstHodometro.veiculo.marca,
        tipo: firstHodometro.veiculo.tipo,
        motoristas,
        totalKm
      });
    });

    // Sort by placa (A-Z)
    processedData.sort((a, b) => a.placa.localeCompare(b.placa));
    
    setMileageData(processedData);
  };

  const generateMonthlyData = (hodometros: Hodometro[]) => {
    // Group by month
    const monthlyData: Record<string, number> = {};
    
    hodometros.forEach(hodometro => {
      const date = new Date(hodometro.data);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = 0;
      }
      
      // Add the km_rodado value (which should always be positive)
      if (hodometro.km_rodado && hodometro.km_rodado > 0) {
        monthlyData[monthKey] += hodometro.km_rodado;
      }
    });
    
    // Convert to array and sort by month
    const result = Object.entries(monthlyData).map(([key, km]) => {
      const [year, month] = key.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return {
        month: date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
        km: Math.round(km)
      };
    }).sort((a, b) => {
      const monthA = a.month.split(' ')[0];
      const yearA = a.month.split(' ')[1];
      const monthB = b.month.split(' ')[0];
      const yearB = b.month.split(' ')[1];
      
      if (yearA !== yearB) {
        return parseInt(yearA) - parseInt(yearB);
      }
      
      const months = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
      return months.indexOf(monthA) - months.indexOf(monthB);
    });
    
    setMonthlyData(result);
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
    setSelectAll(newSelectedItems.size === mileageData.length);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(mileageData.map(m => m.veiculo_id)));
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
      
      // Collect all hodometros from all motoristas for this vehicle
      const selectedData = mileageData.find(data => data.veiculo_id === veiculo_id);
      if (selectedData) {
        const allHodometros = selectedData.motoristas.flatMap(m => m.hodometros);
        generateMonthlyData(allHodometros);
      }
    }
  };

  const openChartModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowChartModal(true);
  };

  const filteredData = mileageData.filter(data => {
    const searchLower = searchTerm.toLowerCase();
    const clientMatch = selectedClientFilter ? 
      data.motoristas.some(m => m.cliente === selectedClientFilter) : true;
    
    return (
      clientMatch &&
      (data.placa.toLowerCase().includes(searchLower) ||
       (data.marca && data.marca.toLowerCase().includes(searchLower)) ||
       (data.tipo && data.tipo.toLowerCase().includes(searchLower)) ||
       data.motoristas.some(m => 
         m.nome.toLowerCase().includes(searchLower) || 
         m.cpf.includes(searchLower)
       ))
    );
  });

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

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por placa, marca, modelo, motorista ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Marca/Modelo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Motoristas</th>
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
                        <div className="text-lg font-medium text-blue-600 dark:text-blue-400">
                          {data.placa}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {data.marca} {data.tipo}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {data.motoristas.length} motorista{data.motoristas.length !== 1 ? 's' : ''}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          {formatNumber(data.totalKm)} km
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {data.motoristas.length > 0 ? 
                            data.motoristas.reduce((latest, m) => {
                              const mDate = new Date(m.ultima_data.split('/').reverse().join('-'));
                              const latestDate = latest ? new Date(latest.split('/').reverse().join('-')) : null;
                              return !latestDate || mDate > latestDate ? m.ultima_data : latest;
                            }, '') : 
                            "-"
                          }
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
                                Quilometragem Mensal - {data.placa}
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
                                  data={monthlyData}
                                  margin={{ top: 10, right: 30, left: 0, bottom: 30 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                                  <XAxis 
                                    dataKey="month" 
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
                                    {monthlyData.map((entry, index) => (
                                      <Cell 
                                        key={`cell-${index}`} 
                                        fill={`rgba(59, 130, 246, ${0.5 + (index * 0.05)})`} 
                                      />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                            
                            {/* Motoristas e leituras */}
                            {data.motoristas.map((motorista, motoristaIndex) => (
                              <div key={motoristaIndex} className="mb-6">
                                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm mb-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 dark:text-blue-400">
                                          <path d="M19 16v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3"></path>
                                          <path d="M12 2h7a2 2 0 0 1 2 2v7"></path>
                                          <path d="M11 13 21 3"></path>
                                        </svg>
                                      </div>
                                      <div>
                                        <h5 className="font-medium text-gray-900 dark:text-white">
                                          {motorista.nome}
                                        </h5>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                          {formatCPF(motorista.cpf)}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                                        Total: {formatNumber(motorista.km_total)} km
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {motorista.isElectric ? 'Veículo Elétrico' : `${formatNumber(motorista.leitura_inicial)} → ${formatNumber(motorista.leitura_final)} km`}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="overflow-x-auto">
                                  <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                      <thead className="bg-gray-100 dark:bg-gray-800 rounded-t-xl">
                                        <tr>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider rounded-tl-xl">Data</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hora</th>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hodômetro</th>
                                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider rounded-tr-xl">Ações</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {motorista.hodometros.map((hodometro, index) => (
                                          <tr key={hodometro.id_hodometro} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                              {formatDateBR(hodometro.data)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                              {hodometro.hora}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                              {hodometro.bateria !== null && hodometro.bateria !== undefined ? (
                                                <span>Bateria: {hodometro.bateria}</span>
                                              ) : (
                                                <span>{formatNumber(hodometro.hod_lido)} km</span>
                                              )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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
                                        {motorista.hodometros.length === 0 && (
                                          <tr>
                                            <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                              Nenhuma leitura encontrada
                                            </td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            ))}
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
        
        {filteredData.length === 0 && (
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
        data={monthlyData}
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