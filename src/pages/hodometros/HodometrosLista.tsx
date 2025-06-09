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

interface MileageData {
  motorista_id: number;
  nome: string;
  cpf: string;
  placa: string;
  cliente: string;
  leitura_inicial: number;
  leitura_final: number;
  km_total: number;
  ultima_data: string;
  hodometros: Hodometro[];
  isElectric: boolean;
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
  const [selectedDriverName, setSelectedDriverName] = useState<string>('');
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('1day');
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

  // Function to format percentage values to avoid double % signs
  const formatPercentage = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return 'N/A';
    return `${value}%`;
  };

  const processHodometrosData = (data: Hodometro[]) => {
    // Group by motorista and veiculo
    const groupedData: Record<string, Hodometro[]> = {};
    
    data.forEach(hodometro => {
      if (!hodometro.motorista || !hodometro.veiculo) return;
      
      const key = `${hodometro.motorista_id}_${hodometro.veiculo_id}`;
      if (!groupedData[key]) {
        groupedData[key] = [];
      }
      groupedData[key].push(hodometro);
    });

    // Process each group to get initial and final readings
    const processedData: MileageData[] = [];
    
    Object.values(groupedData).forEach(group => {
      if (group.length === 0) return;
      
      // Sort by date (oldest first for initial reading, newest first for final reading)
      const sortedGroup = [...group].sort((a, b) => {
        const dateA = new Date(`${a.data} ${a.hora}`);
        const dateB = new Date(`${b.data} ${b.hora}`);
        return dateA.getTime() - dateB.getTime();
      });
      
      const firstReading = sortedGroup[0];
      const lastReading = sortedGroup[sortedGroup.length - 1];
      
      // Check if it's an electric vehicle (has battery readings)
      const isElectric = firstReading.bateria !== null && firstReading.bateria !== undefined;
      
      // Calculate total KM
      let totalKm = 0;
      if (isElectric) {
        // For electric vehicles, use the sum of km_rodado values
        totalKm = sortedGroup.reduce((sum, reading) => sum + (reading.km_rodado || 0), 0);
      } else {
        // For regular vehicles, use the difference between first and last readings
        const firstHodLido = firstReading.hod_lido || 0;
        const lastHodLido = lastReading.hod_lido || 0;
        totalKm = Math.max(0, lastHodLido - firstHodLido);
      }

      // Format date
      const lastDate = new Date(lastReading.data);
      const formattedDate = lastDate.toLocaleDateString('pt-BR');

      // Create the processed data entry
      processedData.push({
        motorista_id: firstReading.motorista_id,
        nome: firstReading.motorista.nome,
        cpf: firstReading.motorista.cpf,
        placa: firstReading.veiculo.placa.toUpperCase(),
        cliente: firstReading.cliente?.nome || 'Sem cliente',
        leitura_inicial: isElectric ? 0 : (firstReading.hod_lido || 0),
        leitura_final: isElectric ? 0 : (lastReading.hod_lido || 0),
        km_total: totalKm,
        ultima_data: formattedDate,
        hodometros: sortedGroup,
        isElectric
      });
    });

    // Sort by total KM (highest first)
    processedData.sort((a, b) => b.km_total - a.km_total);
    
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
      
      monthlyData[monthKey] += hodometro.km_rodado || 0;
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
      setSelectedItems(new Set(mileageData.map(m => m.motorista_id)));
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

  const toggleExpand = (motorista_id: number, driverName: string) => {
    if (expandedItem === motorista_id) {
      setExpandedItem(null);
    } else {
      setExpandedItem(motorista_id);
      setSelectedDriverName(driverName);
      // Generate monthly data for the selected motorista
      const selectedData = mileageData.find(data => data.motorista_id === motorista_id);
      if (selectedData) {
        generateMonthlyData(selectedData.hodometros);
      }
    }
  };

  const openChartModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowChartModal(true);
  };

  const filteredData = mileageData.filter(data => {
    const searchLower = searchTerm.toLowerCase();
    const clientMatch = selectedClientFilter ? data.cliente === selectedClientFilter : true;
    
    return (
      clientMatch &&
      (data.nome.toLowerCase().includes(searchLower) ||
       data.placa.toLowerCase().includes(searchLower) ||
       data.cliente.toLowerCase().includes(searchLower))
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

      {/* Filters Section */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por motorista, placa ou cliente..."
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
              value={selectedClientFilter}
              onChange={(e) => setSelectedClientFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 
                       dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 
                       focus:border-blue-500 text-gray-900 dark:text-gray-100 appearance-none"
            >
              <option value="">Todos os clientes</option>
              {clients.map((client, index) => (
                <option key={index} value={client}>{client}</option>
              ))}
            </select>
            <Filter className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <ChevronDown className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
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

      {/* Table */}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Motorista</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Placa</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Leitura Inicial</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Leitura Final</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">KM Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Última Leitura</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredData.map((data) => (
                  <React.Fragment key={`${data.motorista_id}_${data.placa}`}>
                    <tr 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${
                        selectedItems.has(data.motorista_id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                      onClick={() => toggleExpand(data.motorista_id, data.nome)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedItems.has(data.motorista_id)}
                            onChange={() => handleSelectItem(data.motorista_id)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                          />
                          {expandedItem === data.motorista_id ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-medium">
                            {data.nome.charAt(0)}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {data.nome}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {formatCPF(data.cpf)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          {data.placa}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {data.cliente}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {data.isElectric ? (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200 rounded-full">
                              Veículo Elétrico
                            </span>
                          ) : (
                            `${data.leitura_inicial.toLocaleString('pt-BR')} km`
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {data.isElectric ? (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200 rounded-full">
                              Veículo Elétrico
                            </span>
                          ) : (
                            `${data.leitura_final.toLocaleString('pt-BR')} km`
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          {data.km_total.toLocaleString('pt-BR')} km
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {data.ultima_data}
                        </div>
                      </td>
                    </tr>
                    
                    {expandedItem === data.motorista_id && (
                      <tr>
                        <td colSpan={8} className="px-0 py-0 border-b border-gray-200 dark:border-gray-700">
                          <div className="bg-gray-50 dark:bg-gray-700/30 p-4">
                            <div className="flex justify-between items-center mb-4">
                              <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                <BarChart2 className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                                Quilometragem Mensal
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
                                    tickFormatter={(value) => `${value.toLocaleString('pt-BR')}`}
                                    stroke="#9CA3AF"
                                  />
                                  <Tooltip 
                                    formatter={(value: any) => [`${value.toLocaleString('pt-BR')} km`, 'Quilômetros']}
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
                                    {data.hodometros.map((hodometro, index) => (
                                      <tr key={hodometro.id_hodometro} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                          {new Date(hodometro.data).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                          {hodometro.hora}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                          {hodometro.bateria !== null && hodometro.bateria !== undefined ? (
                                            <span>Bateria: {formatPercentage(hodometro.bateria)}</span>
                                          ) : (
                                            <span>{hodometro.hod_lido?.toLocaleString('pt-BR')} km</span>
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
          <ScrollableTableIndicator containerRef={tableRef} />
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
        driverName={selectedDriverName}
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