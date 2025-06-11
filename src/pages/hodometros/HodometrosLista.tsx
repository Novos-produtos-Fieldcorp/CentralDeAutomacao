import React, { useState, useEffect, useCallback } from 'react';
import { Search, Eye, Camera, X, Download, FileText, AlertCircle, Trash2, Edit2, BarChart2 } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import PeriodSelector from '../../components/hodometros/PeriodSelector';
import { useDateRange } from '../../hooks/useDateRange';
import { formatCPF } from '../../utils/format';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import * as XLSX from 'xlsx';
import { usePagination } from '../../hooks/usePagination';
import Pagination from '../../components/Pagination';
import EditHodometroModal from '../../components/hodometros/EditHodometroModal';
import DeleteHodometroModal from '../../components/hodometros/DeleteHodometroModal';
import BulkDeleteConfirmationModal from '../../components/BulkDeleteConfirmationModal';
import ScrollableTableIndicator from '../../components/ScrollableTableIndicator';
import DriverMileageChart from '../../components/hodometros/DriverMileageChart';
import MileageChartModal from '../../components/hodometros/MileageChartModal';

interface HodometroReading {
  id_hodometro: number;
  data: string;
  hora: string;
  hod_informado: number | null;
  hod_lido: number | null;
  km_rodado: number | null;
  bateria: number | null;
  foto_hodometro: string | null;
  trip_lida: number | null;
  trip_informada: string | null;
  comparacao_leitura: boolean | null;
  motorista: {
    motorista_id: number;
    nome: string;
    cpf: string;
  };
  veiculo: {
    veiculo_id: number;
    placa: string;
    marca: string;
    tipo: string;
  };
  cliente?: {
    cliente_id: number;
    nome: string;
  } | null;
}

interface MonthlyData {
  month: string;
  km: number;
}

const HodometrosLista = () => {
  const { query } = useCompanyData();
  const { companyId } = useAuth();
  const [hodometros, setHodometros] = useState<HodometroReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedHodometro, setSelectedHodometro] = useState<HodometroReading | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('');
  const [clients, setClients] = useState<string[]>([]);
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState<string>('');
  const [vehicles, setVehicles] = useState<{placa: string, veiculo_id: number}[]>([]);
  const [selectedMotoristaFilter, setSelectedMotoristaFilter] = useState<string>('');
  const [motoristas, setMotoristas] = useState<{nome: string, motorista_id: number}[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [showChartModal, setShowChartModal] = useState(false);
  const [selectedVehicleName, setSelectedVehicleName] = useState<string>('');
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('30days');
  const tableRef = React.useRef<HTMLDivElement>(null);

  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedData,
    handlePageChange,
    handlePageSizeChange
  } = usePagination({
    data: hodometros,
    initialPageSize: 20
  });

  const fetchHodometros = useCallback(async () => {
    try {
      setLoading(true);
      
      let queryBuilder = supabase.from('hodometro')
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
      `)
        .eq('company_id', companyId)
        .gte('data', dateRange.startDate)
        .lte('data', dateRange.endDate);
      
      // Apply filters if selected
      if (selectedClientFilter) {
        queryBuilder = queryBuilder.eq('cliente.nome', selectedClientFilter);
      }
      
      if (selectedVehicleFilter) {
        queryBuilder = queryBuilder.eq('veiculo.placa', selectedVehicleFilter);
      }
      
      if (selectedMotoristaFilter) {
        queryBuilder = queryBuilder.eq('motorista.nome', selectedMotoristaFilter);
      }
      
      // Apply search term if provided
      if (searchTerm) {
        queryBuilder = queryBuilder.or(`motorista.nome.ilike.%${searchTerm}%,motorista.cpf.ilike.%${searchTerm}%,veiculo.placa.ilike.%${searchTerm}%`);
      }

      const { data, error } = await queryBuilder
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
      
      // Extract unique clients, vehicles, and motoristas for filters
      const uniqueClients = Array.from(new Set(
        sortedData
          .filter(h => h.cliente?.nome)
          .map(h => h.cliente!.nome)
      )).sort();
      
      const uniqueVehicles = Array.from(new Set(
        sortedData
          .filter(h => h.veiculo?.placa)
          .map(h => ({ 
            placa: h.veiculo.placa.toUpperCase(),
            veiculo_id: h.veiculo.veiculo_id
          }))
      )).sort((a, b) => a.placa.localeCompare(b.placa));
      
      const uniqueMotoristas = Array.from(new Set(
        sortedData
          .filter(h => h.motorista?.nome)
          .map(h => ({ 
            nome: h.motorista.nome,
            motorista_id: h.motorista.motorista_id
          }))
      )).sort((a, b) => a.nome.localeCompare(b.nome));
      
      setClients(uniqueClients);
      setVehicles(uniqueVehicles);
      setMotoristas(uniqueMotoristas);
      
      // Generate monthly data for the first vehicle
      if (sortedData.length > 0) {
        generateMonthlyDataForVehicle(sortedData[0].veiculo_id);
      }
    } catch (error) {
      console.error('Error fetching hodometros:', error);
      toast.error('Erro ao carregar hodômetros');
    } finally {
      setLoading(false);
    }
  }, [dateRange, companyId, searchTerm, selectedClientFilter, selectedVehicleFilter, selectedMotoristaFilter]);

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
    return num.toLocaleString('pt-BR');
  };

  const generateMonthlyDataForVehicle = (vehicleId: number) => {
    // Filter hodometros for this vehicle
    const vehicleHodometros = hodometros.filter(h => h.veiculo_id === vehicleId);
    
    // Group by month
    const monthlyData: Record<string, number> = {};
    
    vehicleHodometros.forEach(hodometro => {
      const date = new Date(hodometro.data);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
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
    
    // Set the vehicle name for the chart
    const vehicle = hodometros.find(h => h.veiculo_id === vehicleId)?.veiculo;
    if (vehicle) {
      setSelectedVehicleName(`${vehicle.placa.toUpperCase()} - ${vehicle.marca} ${vehicle.tipo}`);
    }
  };

  const handleEdit = (hodometro: HodometroReading) => {
    setSelectedHodometro(hodometro);
    setIsEditModalOpen(true);
  };

  const handleDelete = (hodometro: HodometroReading) => {
    setSelectedHodometro(hodometro);
    setIsDeleteModalOpen(true);
  };

  const handleShowPhoto = (photo: string | null) => {
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
    setSelectAll(newSelectedItems.size === hodometros.length);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(hodometros.map(h => h.id_hodometro)));
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

  const openChartModal = (vehicleId: number) => {
    generateMonthlyDataForVehicle(vehicleId);
    setShowChartModal(true);
  };

  const exportToExcel = () => {
    try {
      const exportData = hodometros.map(h => ({
        'Data': formatDateBR(h.data),
        'Hora': h.hora,
        'Motorista': h.motorista?.nome || '',
        'CPF': h.motorista?.cpf ? formatCPF(h.motorista.cpf) : '',
        'Placa': h.veiculo?.placa.toUpperCase() || '',
        'Veículo': `${h.veiculo?.marca || ''} ${h.veiculo?.tipo || ''}`,
        'Hodômetro Informado': h.hod_informado !== null ? formatNumber(h.hod_informado) : '',
        'Hodômetro Lido': h.bateria !== null ? `Bateria: ${h.bateria}` : formatNumber(h.hod_lido),
        'Trip Informada': h.trip_informada || '',
        'Trip Lida': h.trip_lida !== null ? formatNumber(h.trip_lida) : '',
        'KM Rodado': h.km_rodado !== null ? formatNumber(h.km_rodado) : '',
        'Leitura Divergente': h.comparacao_leitura === false ? 'Sim' : 'Não',
        'Cliente': h.cliente?.nome || 'Sem cliente'
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Hodometros');
      
      // Auto-size columns
      const colWidths = [
        { wch: 12 }, // Data
        { wch: 8 },  // Hora
        { wch: 25 }, // Motorista
        { wch: 15 }, // CPF
        { wch: 10 }, // Placa
        { wch: 20 }, // Veículo
        { wch: 18 }, // Hodômetro Informado
        { wch: 15 }, // Hodômetro Lido
        { wch: 15 }, // Trip Informada
        { wch: 12 }, // Trip Lida
        { wch: 12 }, // KM Rodado
        { wch: 15 }, // Leitura Divergente
        { wch: 20 }  // Cliente
      ];
      ws['!cols'] = colWidths;
      
      XLSX.writeFile(wb, `relatorio_hodometros_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Relatório exportado com sucesso');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Erro ao exportar para Excel');
    }
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

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por placa, motorista ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>

          {/* Export Button */}
          <div className="flex justify-end">
            <button
              onClick={exportToExcel}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                       transition-colors flex items-center gap-2"
              disabled={hodometros.length === 0}
            >
              <Download className="w-5 h-5" />
              Exportar Excel
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Vehicle Filter */}
          <div className="relative">
            <select
              value={selectedVehicleFilter}
              onChange={(e) => setSelectedVehicleFilter(e.target.value)}
              className="w-full pl-4 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none"
            >
              <option value="">Todos os veículos</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.veiculo_id} value={vehicle.placa}>
                  {vehicle.placa}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </div>
          </div>

          {/* Motorista Filter */}
          <div className="relative">
            <select
              value={selectedMotoristaFilter}
              onChange={(e) => setSelectedMotoristaFilter(e.target.value)}
              className="w-full pl-4 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none"
            >
              <option value="">Todos os motoristas</option>
              {motoristas.map((motorista) => (
                <option key={motorista.motorista_id} value={motorista.nome}>
                  {motorista.nome}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </div>
          </div>

          {/* Client Filter */}
          <div className="relative">
            <select
              value={selectedClientFilter}
              onChange={(e) => setSelectedClientFilter(e.target.value)}
              className="w-full pl-4 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none"
            >
              <option value="">Todos os clientes</option>
              {clients.map((client, index) => (
                <option key={index} value={client}>{client}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </div>
          </div>
        </div>

        {/* Period Selector */}
        <div className="mt-4">
          <PeriodSelector
            periodType={periodType}
            dateRange={dateRange}
            onPeriodChange={updatePeriod}
            onDateRangeChange={setDateRange}
          />
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data/Hora</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Veículo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Motorista</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hodômetro</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">KM Rodado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedData.map((hodometro) => (
                  <tr key={hodometro.id_hodometro} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                    selectedItems.has(hodometro.id_hodometro) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(hodometro.id_hodometro)}
                        onChange={() => handleSelectItem(hodometro.id_hodometro)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatDateBR(hodometro.data)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {hodometro.hora}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-blue-600 dark:text-blue-400 uppercase">
                        {hodometro.veiculo?.placa || 'Não informada'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {hodometro.veiculo?.marca} {hodometro.veiculo?.tipo}
                      </div>
                      <button
                        onClick={() => openChartModal(hodometro.veiculo_id)}
                        className="mt-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                      >
                        <BarChart2 size={12} />
                        Ver gráfico
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {hodometro.motorista?.nome || 'Não informado'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {hodometro.motorista?.cpf ? formatCPF(hodometro.motorista.cpf) : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {hodometro.bateria !== null && hodometro.bateria !== undefined ? (
                        <div className="text-sm text-gray-900 dark:text-white">
                          Bateria: {hodometro.bateria}%
                        </div>
                      ) : (
                        <>
                          <div className="text-sm text-gray-900 dark:text-white">
                            Lido: {hodometro.hod_lido !== null ? formatNumber(hodometro.hod_lido) : '-'} km
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Informado: {hodometro.hod_informado !== null ? formatNumber(hodometro.hod_informado) : '-'} km
                          </div>
                        </>
                      )}
                      {hodometro.comparacao_leitura === false && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 mt-1">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Divergente
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {hodometro.km_rodado !== null ? formatNumber(hodometro.km_rodado) : '-'} km
                      </div>
                      {hodometro.trip_lida !== null && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Trip: {formatNumber(hodometro.trip_lida)} km
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {hodometro.cliente?.nome || 'Sem cliente'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center space-x-3">
                        {hodometro.foto_hodometro ? (
                          <button
                            onClick={() => handleShowPhoto(hodometro.foto_hodometro)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            title="Ver foto do hodômetro"
                          >
                            <Camera size={18} />
                          </button>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-600">
                            <Camera size={18} className="inline-block opacity-50" />
                          </span>
                        )}
                        <button
                          onClick={() => handleEdit(hodometro)}
                          className="text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300 transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(hodometro)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {hodometros.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                      Nenhuma leitura encontrada para o período selecionado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <ScrollableTableIndicator 
            containerRef={tableRef} 
            className="mr-2 ml-2"
          />
        </div>
        
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
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
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <a
                href={selectedPhoto}
                download="hodometro.jpg"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                         transition-colors flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <Download size={16} />
                Baixar Imagem
              </a>
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