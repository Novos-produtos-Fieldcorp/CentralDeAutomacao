import React, { useState, useEffect, useCallback } from 'react';
import { Search, Camera, X, Download, AlertCircle } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import PeriodSelector from '../../components/hodometros/PeriodSelector';
import { useDateRange } from '../../hooks/useDateRange';
import { formatCPF } from '../../utils/format';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import * as XLSX from 'xlsx';

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
  cliente?: {
    cliente_id: number;
    nome: string;
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

const HodometrosRelatorio = () => {
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('30days');
  const [vehicleData, setVehicleData] = useState<VehicleData[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleData | null>(null);
  const [showChartModal, setShowChartModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const fetchVehicleData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!dateRange.startDate || !dateRange.endDate || !companyId) {
        toast.error('Selecione um período para gerar o relatório');
        return;
      }

      // Log query parameters for debugging
      console.log('Fetching hodometro data with params:', {
        companyId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });

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
          )
        `)
        .eq('company_id', companyId)
        .gte('data', dateRange.startDate)
        .lte('data', dateRange.endDate)
        .order('data', { ascending: false }); // Order by date descending for newest first

      // Log raw response for debugging
      console.log('Supabase response:', { data: data?.length || 0, error });
      
      if (error) {
        console.error('Supabase query error details:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.log('No data returned from Supabase query');
        setVehicleData([]);
        setLoading(false);
        return;
      }

      console.log('First 5 records from response:', data.slice(0, 5));

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

      console.log('Processing hodometro records...');
      
      // First, create a unique set of vehicle IDs to avoid duplicates
      const uniqueVehicleIds = new Set<number>();
      
      (data || []).forEach((hodometro) => {
        if (hodometro.veiculo_id && hodometro.veiculo) {
          uniqueVehicleIds.add(hodometro.veiculo_id);
        }
      });
      
      console.log(`Found ${uniqueVehicleIds.size} unique vehicles`);
      
      // Create a map to store daily vehicle readings
      const dailyVehicleReadingsMap = new Map<string, {
        firstReadingKm: number | null;
        lastReadingKm: number | null;
        firstReadingTrip: number | null;
        lastReadingTrip: number | null;
        vehicleType: 'automovel' | 'ciclomotor';
        motorista_id: number | null;
        motorista_nome: string | null;
        veiculo_id: number | null;
        veiculo_placa: string | null;
        readings: HodometroReading[];
      }>();
      
      // First pass: collect all readings by day and vehicle
      (data || []).forEach((hodometro) => {
        // Skip records without veiculo_id
        if (!hodometro.veiculo_id || !hodometro.veiculo || !hodometro.motorista) {
          return;
        }
        
        const vehicleId = hodometro.veiculo_id;
        const date = hodometro.data;
        const uniqueKey = `${date}_${vehicleId}`;
        
        // Determine vehicle type based on whether it has battery readings
        const vehicleType = hodometro.bateria !== null && hodometro.bateria !== undefined 
          ? 'ciclomotor' 
          : 'automovel';
        
        // Get current reading based on vehicle type
        let currentReading: number | null = null;
        let isOdometerReading = false;
        
        if (vehicleType === 'automovel' && hodometro.hod_lido !== null) {
          currentReading = hodometro.hod_lido;
          isOdometerReading = true;
        } else if (vehicleType === 'ciclomotor' && hodometro.trip_lida !== null) {
          currentReading = hodometro.trip_lida;
        }
        
        // Skip if no valid reading
        if (currentReading === null) {
          return;
        }
        
        // Get or create daily vehicle entry
        const dailyVehicleEntry = dailyVehicleReadingsMap.get(uniqueKey) || {
          firstReadingKm: null,
          lastReadingKm: null,
          firstReadingTrip: null,
          lastReadingTrip: null,
          vehicleType,
          motorista_id: hodometro.motorista_id,
          motorista_nome: hodometro.motorista?.nome || 'Desconhecido',
          veiculo_id: hodometro.veiculo_id,
          veiculo_placa: hodometro.veiculo?.placa || null,
          readings: []
        };
        
        // Add reading to the collection
        dailyVehicleEntry.readings.push(hodometro);
        
        // Update first and last readings
        if (isOdometerReading) {
          if (dailyVehicleEntry.firstReadingKm === null || currentReading < dailyVehicleEntry.firstReadingKm) {
            dailyVehicleEntry.firstReadingKm = currentReading;
          }
          if (dailyVehicleEntry.lastReadingKm === null || currentReading > dailyVehicleEntry.lastReadingKm) {
            dailyVehicleEntry.lastReadingKm = currentReading;
          }
        } else {
          if (dailyVehicleEntry.firstReadingTrip === null || currentReading < dailyVehicleEntry.firstReadingTrip) {
            dailyVehicleEntry.firstReadingTrip = currentReading;
          }
          if (dailyVehicleEntry.lastReadingTrip === null || currentReading > dailyVehicleEntry.lastReadingTrip) {
            dailyVehicleEntry.lastReadingTrip = currentReading;
          }
        }
        
        dailyVehicleReadingsMap.set(uniqueKey, dailyVehicleEntry);
      });
      
      // Second pass: calculate daily kilometers and build vehicle data
      for (const [key, dailyData] of dailyVehicleReadingsMap.entries()) {
        const [date, vehicleIdStr] = key.split('_');
        const vehicleId = parseInt(vehicleIdStr);
        
        // Calculate kilometers for the day
        let kmRodadoNoDia = 0;
        
        if (dailyData.vehicleType === 'automovel' && dailyData.firstReadingKm !== null && dailyData.lastReadingKm !== null) {
          kmRodadoNoDia = dailyData.lastReadingKm - dailyData.firstReadingKm;
          // Handle cases where final reading is less than initial (odometer reset or error)
          if (kmRodadoNoDia < 0) {
            console.warn(`Negative km_rodado for automovel on ${date} for vehicle ${vehicleId}. Resetting to 0.`);
            kmRodadoNoDia = 0;
          }
        } else if (dailyData.vehicleType === 'ciclomotor' && dailyData.firstReadingTrip !== null && dailyData.lastReadingTrip !== null) {
          // For ciclomotors, calculate km_rodado as the difference between last and first trip readings
          kmRodadoNoDia = dailyData.lastReadingTrip - dailyData.firstReadingTrip;
          if (kmRodadoNoDia < 0) {
            console.warn(`Negative km_rodado for ciclomotor on ${date} for vehicle ${vehicleId}. Resetting to 0.`);
            kmRodadoNoDia = 0;
          }
        }
        
        // Get or create vehicle data
        const vehicleData = vehicleMap.get(vehicleId) || {
          placa: dailyData.veiculo_placa || '',
          marca: dailyData.readings[0]?.veiculo?.marca || '',
          tipo: dailyData.readings[0]?.veiculo?.tipo || '',
          totalKm: 0,
          dailyData: new Map<string, number>(),
          daysWithReadings: new Set<string>(),
          motoristas: new Map<number, { nome: string; km: number }>(),
          readings: []
        };
        
        // Add km to total
        vehicleData.totalKm += kmRodadoNoDia;
        
        // Add km to daily data
        vehicleData.dailyData.set(date, kmRodadoNoDia);
        
        // Add date to days with readings
        vehicleData.daysWithReadings.add(date);
        
        // Add km to motorista
        if (dailyData.motorista_id && dailyData.motorista_nome) {
          const motoristaData = vehicleData.motoristas.get(dailyData.motorista_id) || { 
            nome: dailyData.motorista_nome, 
            km: 0 
          };
          motoristaData.km += kmRodadoNoDia;
          vehicleData.motoristas.set(dailyData.motorista_id, motoristaData);
        }
        
        // Add readings to vehicle data
        vehicleData.readings.push(...dailyData.readings);
        
        // Update vehicle data
        vehicleMap.set(vehicleId, vehicleData);
      }

      console.log('Vehicle map after processing:', {
        vehicleCount: vehicleMap.size,
        vehicleIds: Array.from(vehicleMap.keys())
      });

      // Convert to array and sort by total km (descending)
      const vehiclesArray: VehicleData[] = Array.from(vehicleMap.entries()).map(([veiculo_id, data]) => {
        const daysWithReadings = data.daysWithReadings.size;
        const avgKmPerDay = daysWithReadings > 0 ? data.totalKm / daysWithReadings : 0;
        
        return {
          veiculo_id,
          placa: data.placa,
          marca: data.marca,
          tipo: data.tipo,
          totalKm: data.totalKm,
          avgKmPerDay,
          daysWithReadings,
          dailyData: Array.from(data.dailyData.entries()).map(([date, km]) => ({
            date,
            km,
            formattedDate: formatDateBR(date)
          })).sort((a, b) => a.date.localeCompare(b.date)), // Sort by date ascending
          motoristas: Array.from(data.motoristas.entries()).map(([motorista_id, motorista]) => ({
            motorista_id,
            nome: motorista.nome,
            km: motorista.km
          })).sort((a, b) => b.km - a.km), // Sort by km descending
          expanded: false,
          readings: data.readings.sort((a, b) => {
            // Sort by date descending, then by time descending
            const dateCompare = b.data.localeCompare(a.data);
            if (dateCompare !== 0) return dateCompare;
            return b.hora.localeCompare(a.hora);
          })
        };
      }).sort((a, b) => b.totalKm - a.totalKm);

      console.log('Final processed vehicle data:', {
        count: vehiclesArray.length,
        totalKm: vehiclesArray.reduce((sum, vehicle) => sum + vehicle.totalKm, 0),
        firstVehicle: vehiclesArray.length > 0 ? {
          placa: vehiclesArray[0].placa,
          totalKm: vehiclesArray[0].totalKm,
          daysWithReadings: vehiclesArray[0].daysWithReadings,
          motoristasCount: vehiclesArray[0].motoristas.length,
          readingsCount: vehiclesArray[0].readings.length
        } : null
      });

      setVehicleData(vehiclesArray);
    } catch (error) {
      console.error('Error fetching vehicle data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setError(errorMessage);
      toast.error('Erro ao carregar dados de quilometragem: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  }, [dateRange, companyId]);

  useEffect(() => {
    fetchVehicleData();
  }, [fetchVehicleData]);

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
    if (num === null || num === undefined) return '-';
    return num.toLocaleString('pt-BR');
  };

  const handleShowPhoto = (photo: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    if (photo) {
      setSelectedPhoto(photo);
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
          'Bateria': reading.bateria !== null ? `${reading.bateria}%` : '-',
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
      <div className="bg-white dark:bg-[#1B2537] p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row items-center gap-4">
          {/* Search */}
          <div className="relative flex-grow w-full md:w-auto">
            <input
              type="text"
              placeholder="Buscar por placa, marca, modelo ou motorista..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#1B2537] border border-gray-200 
                       dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 
                       focus:border-blue-500 text-gray-900 dark:text-gray-100"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>

          {/* Period Selector */}
          <div className="w-full md:w-48">
            <PeriodSelector
              periodType={periodType}
              dateRange={dateRange}
              onPeriodChange={updatePeriod}
              onDateRangeChange={setDateRange}
            />
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
      </div>

      {/* Vehicle Mileage Table */}
      <div className="bg-white dark:bg-[#1B2537] rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#1B2537]">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Veículo</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total KM</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Média Diária</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dias com Leitura</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-[#1B2537] divide-y divide-gray-200 dark:divide-gray-700">
              {filteredVehicleData.map((vehicle) => (
                <React.Fragment key={vehicle.veiculo_id}>
                  <tr 
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
                  
                  {/* Expanded vehicle details */}
                  {vehicle.expanded && (
                    <tr className="bg-gray-50 dark:bg-gray-800/30">
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
                                          Bateria: {reading.bateria}%
                                        </div>
                                      ) : (
                                        <>
                                          <div className="text-sm text-gray-900 dark:text-white">
                                            Lido: {formatNumber(reading.hod_lido)}
                                          </div>
                                          <div className="text-xs text-gray-500 dark:text-gray-400">
                                            Informado: {formatNumber(reading.hod_informado)}
                                          </div>
                                        </>
                                      )}
                                    </td>
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
                                      {reading.foto_hodometro ? (
                                        <button
                                          onClick={(e) => handleShowPhoto(reading.foto_hodometro, e)}
                                          className="inline-flex items-center justify-center p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                          title="Ver foto do hodômetro"
                                        >
                                          <Camera size={16} />
                                        </button>
                                      ) : (
                                        <span className="text-gray-400 dark:text-gray-600">
                                          <Camera size={16} className="inline-block opacity-50" />
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                                {vehicle.readings.length === 0 && (
                                  <tr>
                                    <td colSpan={6} className="px-4 py-4 text-center text-gray-500 dark:text-gray-400">
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
                  )}
                </React.Fragment>
              ))}
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
    </div>
  );
};

export default HodometrosRelatorio;