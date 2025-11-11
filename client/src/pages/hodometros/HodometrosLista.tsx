import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, BarChart2, Download, X, Calendar, User, Truck, ChevronDown, ChevronUp, Eye, Clock, Camera, Gauge, Fuel } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { useAuth } from '../../context/AuthContext';
import { useModuleAccess } from '../../hooks/useModuleAccess';
import toast from 'react-hot-toast';
import { useDateRange } from '../../hooks/useDateRange';
import { usePagination } from '../../hooks/usePagination';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import Pagination from '../../components/Pagination';
import * as XLSX from 'xlsx';
import MileageChartModal from '../../components/hodometros/MileageChartModal';
import { formatCPF } from '../../utils/format';

interface DailyData {
  date: string;
  km: number;
  formattedDate: string;
}

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
  bomba_gasolina?: {
    preco_lido: string | null;
    preco_informado: string | null;
    litro_lido: string | null;
    litro_informado: string | null;
    foto_bomba: string | null;
  } | null;
}

interface VehicleData {
  veiculo_id: number;
  placa: string;
  marca: string;
  tipo: string;
  totalKm: number;
  avgKmPerDay: number;
  daysWithReadings: number;
  dailyData: DailyData[];
  motoristas: {
    motorista_id: number;
    nome: string;
    km: number;
  }[];
  expanded?: boolean;
  readings: HodometroReading[];
}

const HodometrosLista = () => {
  const { companyId } = useAuth();
  const { moduleAccess } = useModuleAccess();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('all', false);
  const [vehicleData, setVehicleData] = useState<VehicleData[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleData | null>(null);
  const [showChartModal, setShowChartModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const periodDropdownRef = useRef<HTMLDivElement>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhotoData, setSelectedPhotoData] = useState<{
    url: string;
    type: 'hodometro' | 'bomba';
  } | null>(null);

  // Photo title mapping
  const PHOTO_TITLES = {
    hodometro: 'Foto do Hodômetro',
    bomba: 'Foto da Bomba'
  };

  // Validate date is within acceptable range
  const validateDate = (dateString: string): boolean => {
    if (!dateString) return true; // Allow empty
    const year = parseInt(dateString.split('-')[0]);
    return year >= 2020 && year <= 2099;
  };

  const fetchVehicleData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!dateRange.startDate || !dateRange.endDate || !companyId) {
        toast.error('Selecione um período para gerar o relatório');
        return;
      }

      // Fetching hodometro data for the specified period

      // Get all readings in the period
      const { data, error } = await supabase.from('hodometro')
        .select(`
          id_hodometro,
          data,
          hora,
          hod_informado,
          hod_lido,
          km_rodado,
          bateria,
          foto_hodometro,
          trip_lida,
          trip_informada,
          comparacao_leitura,
          motorista_id,
          veiculo_id,
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
          bomba_gasolina!bomba_gasolina_hodometro_id_fkey (
            preco_lido,
            preco_informado,
            litro_lido,
            litro_informado,
            foto_bomba
          )
        `)
        .eq('company_id', companyId)
        .gte('data', dateRange.startDate)
        .lte('data', dateRange.endDate)
        .order('data', { ascending: false }); // Order by date descending for newest first

      // Processing Supabase response
      
      if (error) {
        console.error('Supabase query error details:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        // No data returned from query
        setVehicleData([]);
        setLoading(false);
        return;
      }

      // Processing response data

      // Process data to get mileage by vehicle and date
      const vehicleMap = new Map<number, {
        placa: string;
        marca: string;
        tipo: string;
        totalKm: number;
        dailyData: Map<string, number>;
        daysWithReadings: Set<string>;
        motoristas: Map<number, { nome: string; km: number }>;
        readings: HodometroReading[];
      }>();

      // Processing hodometro records
      
      // First pass: Group readings by vehicle
      (data || []).forEach((hodometro) => {
        // Skip records without required data
        if (!hodometro.veiculo_id || !hodometro.veiculo || !hodometro.motorista) {
          return;
        }
        
        const vehicleId = hodometro.veiculo_id;
        const motoristaNome = Array.isArray(hodometro.motorista) 
          ? (hodometro.motorista?.[0] as any)?.nome || 'Desconhecido'
          : (hodometro.motorista as any)?.nome || 'Desconhecido';
        
        const veiculoPlaca = Array.isArray(hodometro.veiculo) 
          ? (hodometro.veiculo[0] as any)?.placa || null
          : (hodometro.veiculo as any)?.placa || null;

        // Format reading - ensure proper type casting
        const formattedHodometro: HodometroReading = {
          ...hodometro,
          motorista: Array.isArray(hodometro.motorista) 
            ? (hodometro.motorista[0] as any) 
            : (hodometro.motorista as any),
          veiculo: Array.isArray(hodometro.veiculo) 
            ? (hodometro.veiculo[0] as any)
            : (hodometro.veiculo as any),
          bomba_gasolina: Array.isArray(hodometro.bomba_gasolina) && hodometro.bomba_gasolina.length > 0
            ? (hodometro.bomba_gasolina[0] as any)
            : null
        };
        
        // Get or create vehicle data
        const vehicleData = vehicleMap.get(vehicleId) || {
          placa: veiculoPlaca || '',
          marca: formattedHodometro.veiculo?.marca || '',
          tipo: formattedHodometro.veiculo?.tipo || '',
          totalKm: 0,
          dailyData: new Map<string, number>(),
          daysWithReadings: new Set<string>(),
          motoristas: new Map<number, { nome: string; km: number }>(),
          readings: [] as HodometroReading[]
        };
        
        // Add reading to vehicle
        vehicleData.readings.push(formattedHodometro);
        
        // Update vehicle map
        vehicleMap.set(vehicleId, vehicleData);
      });

      // Vehicle data processing completed

      // Helper function to recalculate km_rodado for each reading based on calculoUmPorDia flag
      const recalculateKmRodado = (readings: HodometroReading[], calculoUmPorDia: boolean): HodometroReading[] => {
        if (readings.length === 0) return readings;
        
        console.log(`📊 recalculateKmRodado - Modo: ${calculoUmPorDia ? 'INTRA-DAY' : 'INTER-DAY'}`);
        
        // Determine if vehicle is ciclomotor (has battery) or automovel
        const isCiclomotor = readings.some(r => r.bateria !== null && r.bateria !== undefined);
        console.log(`🔍 Tipo de veículo: ${isCiclomotor ? 'CICLOMOTOR' : 'AUTOMÓVEL'}`);
        
        // Sort readings chronologically (ascending by date, then time)
        const sortedReadings = [...readings].sort((a, b) => {
          const dateCompare = a.data.localeCompare(b.data);
          if (dateCompare !== 0) return dateCompare;
          return a.hora.localeCompare(b.hora);
        });
        
        if (calculoUmPorDia) {
          // INTRA-DAY: km_rodado = last reading of day - first reading of day
          const readingsByDay = new Map<string, HodometroReading[]>();
          
          // Group by day
          sortedReadings.forEach(reading => {
            const dayKey = reading.data;
            if (!readingsByDay.has(dayKey)) {
              readingsByDay.set(dayKey, []);
            }
            readingsByDay.get(dayKey)!.push(reading);
          });
          
          // Calculate km_rodado for each day
          return sortedReadings.map(reading => {
            const dayReadings = readingsByDay.get(reading.data)!;
            const firstReading = dayReadings[0];
            const lastReading = dayReadings[dayReadings.length - 1];
            
            let kmRodado = 0;
            if (isCiclomotor) {
              const first = Number(firstReading.trip_lida) || 0;
              const last = Number(lastReading.trip_lida) || 0;
              kmRodado = last - first;
            } else {
              const first = Number(firstReading.hod_lido) || 0;
              const last = Number(lastReading.hod_lido) || 0;
              kmRodado = last - first;
            }
            
            // Clamp negative values to 0
            if (kmRodado < 0) kmRodado = 0;
            
            return {
              ...reading,
              km_rodado: kmRodado
            };
          });
          
        } else {
          // INTER-DAY: km_rodado = today's reading - last reading of previous day
          const readingsByDay = new Map<string, HodometroReading[]>();
          
          // Group by day
          sortedReadings.forEach(reading => {
            const dayKey = reading.data;
            if (!readingsByDay.has(dayKey)) {
              readingsByDay.set(dayKey, []);
            }
            readingsByDay.get(dayKey)!.push(reading);
          });
          
          // Get unique days sorted
          const uniqueDays = Array.from(readingsByDay.keys()).sort();
          
          // Map each day to its last reading value
          const dayLastReadings = new Map<string, number>();
          uniqueDays.forEach(day => {
            const dayReadings = readingsByDay.get(day)!;
            const lastReading = dayReadings[dayReadings.length - 1];
            const value = isCiclomotor 
              ? (Number(lastReading.trip_lida) || 0)
              : (Number(lastReading.hod_lido) || 0);
            dayLastReadings.set(day, value);
          });
          
          // Calculate km_rodado for each reading
          return sortedReadings.map(reading => {
            const currentDay = reading.data;
            const currentDayIndex = uniqueDays.indexOf(currentDay);
            
            let kmRodado = 0;
            if (currentDayIndex > 0) {
              const previousDay = uniqueDays[currentDayIndex - 1];
              const previousDayLastReading = dayLastReadings.get(previousDay) ?? 0;
              const todayLastReading = dayLastReadings.get(currentDay) ?? 0;
              kmRodado = todayLastReading - previousDayLastReading;
              
              // Clamp negative values to 0
              if (kmRodado < 0) kmRodado = 0;
            }
            
            return {
              ...reading,
              km_rodado: kmRodado
            };
          });
        }
      };

      // Recalculate km_rodado and compute aggregates from recalculated values
      const vehiclesArray: VehicleData[] = Array.from(vehicleMap.entries()).map(([veiculo_id, vehicleData]) => {
        // Step 1: Recalculate km_rodado for all readings based on calculoUmPorDia flag
        const recalculatedReadings = recalculateKmRodado(vehicleData.readings, moduleAccess.calculoUmPorDia);
        
        // Debug: log recalculated values
        console.log(`🔧 Veículo ${veiculo_id} - Readings recalculados:`, recalculatedReadings.map(r => ({
          data: r.data,
          hora: r.hora,
          hod_lido: r.hod_lido,
          trip_lida: r.trip_lida,
          km_rodado_calculado: r.km_rodado
        })));
        
        // Step 2: Group readings by day to avoid double-counting
        // In intra-day mode, all readings of the same day have the same km_rodado
        // So we take only one reading per day for aggregation
        const readingsByDay = new Map<string, HodometroReading[]>();
        recalculatedReadings.forEach(reading => {
          if (!readingsByDay.has(reading.data)) {
            readingsByDay.set(reading.data, []);
          }
          readingsByDay.get(reading.data)!.push(reading);
        });
        
        // Step 3: Compute aggregates from one reading per day (the last chronological one)
        let totalKm = 0;
        const dailyData = new Map<string, number>();
        const motoristas = new Map<number, { nome: string; km: number }>();
        const daysWithReadings = new Set<string>();
        
        // Process each day
        for (const [date, dayReadings] of readingsByDay.entries()) {
          // Sort by time to get the last reading
          const sortedDayReadings = dayReadings.sort((a, b) => a.hora.localeCompare(b.hora));
          const lastReading = sortedDayReadings[sortedDayReadings.length - 1];
          
          const kmForDay = lastReading.km_rodado ?? 0;
          
          // Add to total
          totalKm += kmForDay;
          
          // Add to daily data
          dailyData.set(date, kmForDay);
          
          // Add to days set
          daysWithReadings.add(date);
          
          // Add to motorista (use last reading's motorista)
          if (lastReading.motorista?.motorista_id) {
            const motoristaData = motoristas.get(lastReading.motorista.motorista_id) || {
              nome: lastReading.motorista.nome || 'Desconhecido',
              km: 0
            };
            motoristaData.km += kmForDay;
            motoristas.set(lastReading.motorista.motorista_id, motoristaData);
          }
        }
        
        const daysCount = daysWithReadings.size;
        const avgKmPerDay = daysCount > 0 ? totalKm / daysCount : 0;
        
        return {
          veiculo_id,
          placa: vehicleData.placa,
          marca: vehicleData.marca,
          tipo: vehicleData.tipo,
          totalKm,
          avgKmPerDay,
          daysWithReadings: daysCount,
          dailyData: Array.from(dailyData.entries()).map(([date, km]) => ({
            date,
            km,
            formattedDate: formatDateBR(date)
          })).sort((a, b) => a.date.localeCompare(b.date)), // Sort by date ascending
          motoristas: Array.from(motoristas.entries()).map(([motorista_id, motorista]) => ({
            motorista_id,
            nome: motorista.nome,
            km: motorista.km
          })).sort((a, b) => b.km - a.km), // Sort by km descending
          expanded: false,
          readings: recalculatedReadings.sort((a, b) => {
            // Sort by date descending, then by time descending
            const dateCompare = b.data.localeCompare(a.data);
            if (dateCompare !== 0) return dateCompare;
            return b.hora.localeCompare(a.hora);
          })
        };
      }).sort((a, b) => b.totalKm - a.totalKm);

      // Final vehicle data array prepared for display

      setVehicleData(vehiclesArray);
    } catch (error) {
      console.error('Error fetching vehicle data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setError(errorMessage);
      toast.error('Erro ao carregar dados de quilometragem: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  }, [dateRange, companyId, moduleAccess.calculoUmPorDia]);

  useEffect(() => {
    // Only fetch when date range actually changes
    fetchVehicleData();
  }, [fetchVehicleData]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target as Node)) {
        setShowPeriodDropdown(false);
      }
    };

    if (showPeriodDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showPeriodDropdown]);

  const handleViewChart = (vehicle: VehicleData) => {
    setSelectedVehicle(vehicle);
    setShowChartModal(true);
  };

  const toggleVehicleExpanded = (vehicleId: number) => {
    setVehicleData(prevData => 
      prevData.map(vehicle => 
        vehicle.veiculo_id === vehicleId 
          ? { ...vehicle, expanded: !vehicle.expanded } 
          : vehicle
      )
    );
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
    if (num === null || num === undefined || isNaN(num)) return '0';
    return num.toLocaleString('pt-BR');
  };

  const handleShowPhoto = (photo: string | null, type: 'hodometro' | 'bomba', e: React.MouseEvent) => {
    e.stopPropagation();
    if (photo) {
      setSelectedPhotoData({ url: photo, type });
      setShowPhotoModal(true);
    } else {
      toast.error('Nenhuma foto disponível');
    }
  };

  const exportToExcel = () => {
    try {
      // Prepare main vehicle data
      const exportData = vehicleData.map(vehicle => ({
        'Placa': vehicle.placa,
        'Veículo': `${vehicle.marca} ${vehicle.tipo}`.trim(),
        'Total KM': vehicle.totalKm.toLocaleString('pt-BR'),
        'Média Diária': vehicle.avgKmPerDay.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
        'Dias com Leitura': vehicle.daysWithReadings
      }));

      // Create a workbook with multiple sheets
      const wb = XLSX.utils.book_new();
      
      // Add main vehicle summary sheet
      const mainWs = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, mainWs, 'Resumo por Veículo');
      
      // Auto-size columns for main sheet
      const mainColWidths = [
        { wch: 12 }, // Placa
        { wch: 25 }, // Veículo
        { wch: 15 }, // Total KM
        { wch: 15 }, // Média Diária
        { wch: 15 } // Dias com Leitura
      ];
      mainWs['!cols'] = mainColWidths;
      
      // Add detailed sheets for each vehicle
      vehicleData.forEach(vehicle => {
        // Create daily data sheet
        const dailyData = vehicle.dailyData.map(day => ({
          'Data': day.formattedDate,
          'KM': day.km.toLocaleString('pt-BR')
        }));
        
        if (dailyData.length > 0) {
          const dailyWs = XLSX.utils.json_to_sheet(dailyData);
          XLSX.utils.book_append_sheet(wb, dailyWs, `${vehicle.placa} - Diário`.substring(0, 31));
          
          // Auto-size columns
          dailyWs['!cols'] = [
            { wch: 12 }, // Data
            { wch: 15 }  // KM
          ];
        }
        
        // Create motorista data sheet
        const motoristaData = vehicle.motoristas.map(motorista => ({
          'Motorista': motorista.nome,
          'KM': motorista.km.toLocaleString('pt-BR')
        }));
        
        if (motoristaData.length > 0) {
          const motoristaWs = XLSX.utils.json_to_sheet(motoristaData);
          XLSX.utils.book_append_sheet(wb, motoristaWs, `${vehicle.placa} - Motoristas`.substring(0, 31));
          
          // Auto-size columns
          motoristaWs['!cols'] = [
            { wch: 30 }, // Motorista
            { wch: 15 }  // KM
          ];
        }
        
        // Create detailed readings sheet
        const readingsData = vehicle.readings.map(reading => ({
          'Data': formatDateBR(reading.data),
          'Hora': reading.hora,
          'Motorista': reading.motorista.nome,
          'CPF': formatCPF(reading.motorista.cpf),
          'Hodômetro Informado': reading.hod_informado !== null ? formatNumber(reading.hod_informado) : '-',
          'Hodômetro Lido': reading.hod_lido !== null ? formatNumber(reading.hod_lido) : '-',
          'Bateria': reading.bateria !== null ? `${reading.bateria}` : '-',
          'KM Rodado': reading.km_rodado !== null ? formatNumber(reading.km_rodado) : '-',
          'Trip Lida': reading.trip_lida !== null ? formatNumber(reading.trip_lida) : '-',
          'Trip Informada': reading.trip_informada || '-',
          'Tem Foto': reading.foto_hodometro ? 'Sim' : 'Não'
        }));
        
        if (readingsData.length > 0) {
          const readingsWs = XLSX.utils.json_to_sheet(readingsData);
          XLSX.utils.book_append_sheet(wb, readingsWs, `${vehicle.placa} - Leituras`.substring(0, 31));
          
          // Auto-size columns
          readingsWs['!cols'] = [
            { wch: 12 }, // Data
            { wch: 10 }, // Hora
            { wch: 25 }, // Motorista
            { wch: 15 }, // CPF
            { wch: 18 }, // Hodômetro Informado
            { wch: 15 }, // Hodômetro Lido
            { wch: 10 }, // Bateria
            { wch: 12 }, // KM Rodado
            { wch: 12 }, // Trip Lida
            { wch: 15 }, // Trip Informada
            { wch: 10 }  // Tem Foto
          ];
        }
      });
      
      XLSX.writeFile(wb, `relatorio_quilometragem_veiculos_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Relatório exportado com sucesso');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Erro ao exportar para Excel');
    }
  };

  const filteredVehicleData = vehicleData.filter(vehicle => {
    const searchString = searchTerm.toLowerCase();
    return (
      !searchTerm ||
      vehicle.placa.toLowerCase().includes(searchString) ||
      vehicle.marca.toLowerCase().includes(searchString) ||
      vehicle.tipo.toLowerCase().includes(searchString) ||
      vehicle.motoristas.some(m => m.nome.toLowerCase().includes(searchString))
    );
  });

  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedData: paginatedVehicleData,
    handlePageChange,
    handlePageSizeChange
  } = usePagination({
    data: filteredVehicleData,
    initialPageSize: 10
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-[#1B2537] p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 text-red-500 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h3 className="text-lg font-medium">Erro ao carregar dados</h3>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
        <button 
          onClick={fetchVehicleData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <div className="flex flex-wrap gap-3 items-center mb-6">
        {/* Search */}
        <div className="relative flex-grow min-w-64">
          <input
            type="text"
            placeholder="Buscar por placa, marca, modelo ou motorista..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 
                     dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 
                     focus:border-blue-500 text-gray-900 dark:text-gray-100"
          />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>

        {/* Período Filter */}
        <div className="relative z-[40]" ref={periodDropdownRef}>
          <button
            type="button"
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9"
            onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
          >
            <Calendar className="h-4 w-4" />
            <span>
              {periodType === 'all' ? 'Período' : 
               periodType === '1day' ? 'Hoje' :
               periodType === '15days' ? '15 dias' :
               periodType === '30days' ? '30 dias' :
               periodType === 'custom' ? 'Personalizado' : 'Período'}
            </span>
            <ChevronDown className="h-4 w-4" />
          </button>

          {showPeriodDropdown && (
            <div 
              className="bg-white dark:bg-gray-700 shadow-xl rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto w-64 animate-in slide-in-from-top-2 fade-in duration-200"
              style={{ 
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                zIndex: 999999
              }}
            >
              <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                <span className="text-xs text-gray-500 dark:text-gray-400">Selecionar período</span>
              </div>
              {[
                { value: 'all', label: 'Todos os períodos' },
                { value: '1day', label: 'Hoje' },
                { value: '15days', label: 'Últimos 15 dias' },
                { value: '30days', label: 'Últimos 30 dias' },
                { value: 'custom', label: 'Período personalizado' }
              ].map(({ value, label }) => (
                <div key={value} className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                  <button
                    type="button"
                    className="w-full text-left text-sm text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"
                    onClick={() => {
                      updatePeriod(value as any);
                      setShowPeriodDropdown(false);
                    }}
                  >
                    {label}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Export Button */}
        <div className="relative group">
          <button
            onClick={exportToExcel}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                     transition-colors flex items-center justify-center"
            disabled={filteredVehicleData.length === 0}
            aria-label="Exportar Excel"
          >
            <Download className="w-5 h-5" />
          </button>
          <div className="opacity-0 group-hover:opacity-100 absolute right-0 top-full mt-1 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap">
            Exportar Excel
          </div>
        </div>
      </div>

      {/* Custom Date Range */}
      {periodType === 'custom' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Data inicial
            </label>
            <input
              type="date"
              data-testid="input-custom-start-date-lista"
              value={dateRange.startDate}
              onChange={(e) => {
                const newDate = e.target.value;
                if (validateDate(newDate)) {
                  setDateRange({ ...dateRange, startDate: newDate });
                } else {
                  toast.error('Por favor selecione uma data entre 2020 e 2099');
                }
              }}
              min="2020-01-01"
              max="2099-12-31"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Data final
            </label>
            <input
              type="date"
              data-testid="input-custom-end-date-lista"
              value={dateRange.endDate}
              onChange={(e) => {
                const newDate = e.target.value;
                if (validateDate(newDate)) {
                  setDateRange({ ...dateRange, endDate: newDate });
                } else {
                  toast.error('Por favor selecione uma data entre 2020 e 2099');
                }
              }}
              min="2020-01-01"
              max="2099-12-31"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
      )}

      {/* Vehicle Mileage Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Veículo</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total KM</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Média Diária</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dias com Leitura</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedVehicleData.flatMap((vehicle) => {
                const rows = [
                  <tr 
                    key={`vehicle-main-${vehicle.veiculo_id}`}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${
                      vehicle.expanded ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                    onClick={() => toggleVehicleExpanded(vehicle.veiculo_id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-medium">
                          <Truck className="h-5 w-5" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                            {vehicle.placa}
                            {vehicle.expanded ? 
                              <ChevronUp className="h-4 w-4 text-gray-400" /> : 
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            }
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {vehicle.marca} {vehicle.tipo}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {formatNumber(vehicle.totalKm)} km
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {formatNumber(vehicle.avgKmPerDay)} km
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {vehicle.daysWithReadings}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewChart(vehicle);
                          }}
                          className="inline-flex items-center justify-center p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                          title="Ver gráfico de quilometragem"
                          disabled={vehicle.dailyData.length === 0}
                        >
                          <BarChart2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>

                ];
                
                if (vehicle.expanded) {
                  rows.push(
                    <tr key={`vehicle-expanded-${vehicle.veiculo_id}`} className="bg-gray-50 dark:bg-[#252A3B]">
                      <td colSpan={5} className="px-6 py-4">
                        <div className="space-y-4">
                          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Leituras de Hodômetro para {vehicle.placa} - {vehicle.marca} {vehicle.tipo}
                          </h3>
                          
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
                              <thead className="bg-gray-100 dark:bg-gray-700">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Data/Hora</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Motorista</th>
                                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Hodômetro</th>
                                  {moduleAccess.bomba && (
                                    <>
                                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Preço</th>
                                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Litros</th>
                                    </>
                                  )}
                                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Trip</th>
                                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">KM Rodado</th>
                                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">Foto</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {vehicle.readings.map((reading) => (
                                  <tr key={reading.id_hodometro} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-4 py-2 whitespace-nowrap">
                                      <div className="flex items-center">
                                        <Calendar className="h-4 w-4 text-gray-400 mr-1" />
                                        <div className="text-sm text-gray-900 dark:text-white">
                                          {formatDateBR(reading.data)}
                                        </div>
                                      </div>
                                      <div className="flex items-center mt-1">
                                        <Clock className="h-4 w-4 text-gray-400 mr-1" />
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                          {reading.hora}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap">
                                      <div className="flex items-center">
                                        <User className="h-4 w-4 text-gray-400 mr-1" />
                                        <div className="text-sm text-gray-900 dark:text-white">
                                          {reading.motorista.nome}
                                        </div>
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400 ml-5">
                                        {formatCPF(reading.motorista.cpf)}
                                      </div>
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-right">
                                      {reading.bateria !== null ? (
                                        <div className="text-sm text-gray-900 dark:text-white">
                                          Bateria: {reading.bateria}
                                        </div>
                                      ) : (
                                        <div>
                                          <div className="text-sm text-gray-900 dark:text-white">
                                            Lido: {formatNumber(reading.hod_lido)}
                                          </div>
                                          <div className="text-xs text-gray-500 dark:text-gray-400">
                                            Informado: {formatNumber(reading.hod_informado)}
                                          </div>
                                        </div>
                                      )}
                                    </td>
                                    {moduleAccess.bomba && (
                                      <>
                                        <td className="px-4 py-2 whitespace-nowrap text-right">
                                          {reading.bomba_gasolina ? (
                                            <div>
                                              <div className="text-sm text-gray-900 dark:text-white">
                                                Lido: {reading.bomba_gasolina.preco_lido ? `R$ ${reading.bomba_gasolina.preco_lido}` : '-'}
                                              </div>
                                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                                Informado: {reading.bomba_gasolina.preco_informado ? `R$ ${reading.bomba_gasolina.preco_informado}` : '-'}
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="text-sm text-gray-500 dark:text-gray-400">-</div>
                                          )}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-right">
                                          {reading.bomba_gasolina ? (
                                            <div>
                                              <div className="text-sm text-gray-900 dark:text-white">
                                                Lido: {reading.bomba_gasolina.litro_lido || '-'}
                                              </div>
                                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                                Informado: {reading.bomba_gasolina.litro_informado || '-'}
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="text-sm text-gray-500 dark:text-gray-400">-</div>
                                          )}
                                        </td>
                                      </>
                                    )}
                                    <td className="px-4 py-2 whitespace-nowrap text-right">
                                      {reading.trip_lida !== null ? (
                                        <div className="text-sm text-gray-900 dark:text-white">
                                          {formatNumber(reading.trip_lida)}
                                        </div>
                                      ) : (
                                        <div className="text-sm text-gray-500 dark:text-gray-400">-</div>
                                      )}
                                      {reading.trip_informada && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                          {reading.trip_informada}
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-right">
                                      <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                        {formatNumber(reading.km_rodado)} km
                                      </div>
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-center">
                                      <div className="flex items-center justify-center gap-2">
                                        {reading.foto_hodometro ? (
                                          <button
                                            onClick={(e) => handleShowPhoto(reading.foto_hodometro, 'hodometro', e)}
                                            className="inline-flex items-center justify-center p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                            title="Ver foto do hodômetro"
                                          >
                                            <Gauge size={16} />
                                          </button>
                                        ) : (
                                          <span className="inline-flex items-center justify-center p-2 text-gray-400 dark:text-gray-600 opacity-50" title="Sem foto do hodômetro">
                                            <Gauge size={16} />
                                          </span>
                                        )}
                                        {moduleAccess.bomba && (
                                          reading.bomba_gasolina?.foto_bomba ? (
                                            <button
                                              onClick={(e) => handleShowPhoto(reading.bomba_gasolina?.foto_bomba || null, 'bomba', e)}
                                              className="inline-flex items-center justify-center p-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-full hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                                              title="Ver foto da bomba de gasolina"
                                            >
                                              <Fuel size={16} />
                                            </button>
                                          ) : (
                                            <span className="inline-flex items-center justify-center p-2 text-gray-400 dark:text-gray-600 opacity-50" title="Sem foto da bomba">
                                              <Fuel size={16} />
                                            </span>
                                          )
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                                {vehicle.readings.length === 0 && (
                                  <tr>
                                    <td colSpan={8} className="px-4 py-4 text-center text-gray-500 dark:text-gray-400">
                                      Nenhuma leitura encontrada para este veículo
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                }
                
                return rows;
              })}
              {filteredVehicleData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Nenhum dado de quilometragem encontrado para o período selecionado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {filteredVehicleData.length > 0 && (
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

      {/* Chart Modal */}
      {selectedVehicle && (
        <MileageChartModal
          isOpen={showChartModal}
          onClose={() => setShowChartModal(false)}
          data={selectedVehicle.dailyData}
          driverName={`Veículo: ${selectedVehicle.placa} - ${selectedVehicle.marca} ${selectedVehicle.tipo}`}
        />
      )}

      {/* Photo Modal */}
      {showPhotoModal && selectedPhotoData && (
        <div 
          className="fixed inset-0 bg-transparent z-50 flex items-center justify-center p-4"
          onClick={() => setShowPhotoModal(false)}
        >
          <div 
            className="bg-white dark:bg-[#1E2332] rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-md border border-gray-200 dark:border-gray-700"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {selectedPhotoData ? PHOTO_TITLES[selectedPhotoData.type] : 'Foto'}
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
                src={selectedPhotoData?.url || ''}
                alt={selectedPhotoData ? PHOTO_TITLES[selectedPhotoData.type] : 'Foto'}
                className="absolute inset-0 w-full h-full object-contain"
              />
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <a
                href={selectedPhotoData?.url || ''}
                download={selectedPhotoData?.type === 'bomba' ? 'bomba.jpg' : 'hodometro.jpg'}
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
    </div>
  );
};

export default HodometrosLista;