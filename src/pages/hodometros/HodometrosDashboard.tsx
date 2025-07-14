import React, { useState, useEffect } from 'react';
import { 
  BarChart2, Calendar, TrendingUp, Truck, Users, 
  AlertTriangle, Activity, FileText, Camera, X, Eye,
  Gauge, AlertCircle, FileBarChart
} from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useDateRange } from '../../hooks/useDateRange';
import PeriodSelector from '../../components/hodometros/PeriodSelector';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatCPF } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';

interface DailyMileage {
  date: string;
  totalKm: number;
  formattedDate: string;
}

interface DriverMileage {
  motorista_id: number;
  nome: string;
  totalKm: number;
}

interface VehicleMileage {
  veiculo_id: number;
  placa: string;
  totalKm: number;
  lastDate?: string;
}

interface DriverReadings {
  motorista_id: number;
  nome: string;
  count: number;
}

interface OperationMileage {
  name: string;
  value: number;
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
  verificacao: boolean | null;
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

interface DailyVehicleReadings {
  firstReadingKm: number | null;
  lastReadingKm: number | null;
  firstReadingTrip: number | null;
  lastReadingTrip: number | null;
  vehicleType: 'automovel' | 'ciclomotor' | 'unknown';
  motorista_id: number | null;
  motorista_nome: string | null;
  veiculo_id: number | null;
  veiculo_placa: string | null;
}

const HodometrosDashboard = () => {
  const { query } = useCompanyData();
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dailyMileage, setDailyMileage] = useState<DailyMileage[]>([]);
  const [driverMileage, setDriverMileage] = useState<DriverMileage[]>([]);
  const [vehicleMileage, setVehicleMileage] = useState<VehicleMileage[]>([]);
  const [driverReadings, setDriverReadings] = useState<DriverReadings[]>([]);
  const [operationMileage, setOperationMileage] = useState<OperationMileage[]>([]);
  const [totalKm, setTotalKm] = useState(0);
  const [averageKmPerDay, setAverageKmPerDay] = useState(0);
  const [totalReadings, setTotalReadings] = useState(0);
  const [todayReadings, setTodayReadings] = useState(0);
  const { periodType, dateRange, pendingDateRange, updatePeriod, setDateRange, applyPendingDateRange } = useDateRange('30days', true);
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<'all' | 'automovel' | 'ciclomotor'>('all');
  
  // Inconsistencies table state
  const [hodometros, setHodometros] = useState<HodometroReading[]>([]);
  const [totalInconsistencies, setTotalInconsistencies] = useState(0);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  
  // Connection error state
  const [connectionError, setConnectionError] = useState(false);

  useEffect(() => {
    // Only fetch when date range actually changes, not on pending changes
    if (!pendingDateRange) {
      fetchData();
      fetchTodayReadings();
      fetchInconsistencies();
    }
  }, [dateRange, pendingDateRange]);

  // Enhanced error handling function
  const handleSupabaseError = (error: any, operation: string) => {
    console.error(`Error in ${operation}:`, error);
    
    // Check if it's a network/connection error
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      setConnectionError(true);
      toast.error('Não foi possível conectar ao servidor. Verifique sua conexão com a internet.');
      return;
    }
    
    // Check for other connection-related errors
    if (error.message && (
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('connection refused') ||
        error.message.includes('network error') ||
        error.message.includes('supabase.co') ||
        error.message.includes('Failed to fetch')
    )) {
      setConnectionError(true);
      toast.error('Serviço temporariamente indisponível. Tente novamente em alguns instantes.');
      return;
    }
    
    // Reset connection error flag for other types of errors
    setConnectionError(false);
    
    // Handle other types of errors
    if (error.message) {
      toast.error(`Erro ao ${operation}: ${error.message}`);
    } else {
      toast.error(`Erro inesperado ao ${operation}`);
    }
  };

  // Format date from YYYY-MM-DD to DD/MM/YYYY
  const formatDateBR = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setConnectionError(false);
      
      // Fetch all hodometro readings within date range
      const { data, error } = await supabase.from('hodometro')
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
        .lte('data', dateRange.endDate)
        .order('veiculo_id', { ascending: true })
        .order('data', { ascending: true })
        .order('hora', { ascending: true });

      if (error) throw error;

      console.log(`Fetched ${data?.length || 0} hodometro readings`);

      // Initialize maps for data processing
      const dailyMileageMap = new Map<string, { totalKm: number; formattedDate: string }>();
      const driverMileageMap = new Map<number, { nome: string; totalKm: number }>();
      const vehicleMileageMap = new Map<number, { placa: string; totalKm: number; lastDate?: string }>();
      const driverReadingsMap = new Map<number, { nome: string; count: number }>();
      const operationMileageMap = new Map<string, number>();
      
      // Map to store daily vehicle readings
      const dailyVehicleDataMap = new Map<string, DailyVehicleReadings>();
      
      // Process each reading
      (data || []).forEach(hodometro => {
        // ALWAYS process driver reading counts regardless of km values
        if (hodometro.motorista_id && hodometro.motorista) {
          const driverId = hodometro.motorista_id;
          const driverName = hodometro.motorista.nome;
          
          // Update driver readings count
          if (!driverReadingsMap.has(driverId)) {
            driverReadingsMap.set(driverId, { nome: driverName, count: 0 });
          }
          
          const driverReadingsData = driverReadingsMap.get(driverId)!;
          driverReadingsData.count += 1;
          driverReadingsMap.set(driverId, driverReadingsData);
        }
        
        // Skip if missing essential data for mileage calculation
        if (!hodometro.data || !hodometro.veiculo_id || !hodometro.veiculo) {
          return;
        }
        
        // Determine vehicle type based on whether it has battery readings
        const vehicleType = hodometro.bateria !== null && hodometro.bateria !== undefined 
          ? 'ciclomotor' 
          : 'automovel';
        
        // Create unique key for day and vehicle
        const dateKey = hodometro.data;
        const vehicleId = hodometro.veiculo_id;
        const uniqueKey = `${dateKey}_${vehicleId}`;
        
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
        const dailyVehicleEntry = dailyVehicleDataMap.get(uniqueKey) || {
          firstReadingKm: null,
          lastReadingKm: null,
          firstReadingTrip: null,
          lastReadingTrip: null,
          vehicleType,
          motorista_id: hodometro.motorista_id,
          motorista_nome: hodometro.motorista?.nome || 'Desconhecido',
          veiculo_id: hodometro.veiculo_id,
          veiculo_placa: hodometro.veiculo?.placa || null
        };
        
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
        
        dailyVehicleDataMap.set(uniqueKey, dailyVehicleEntry);
        
        // Process operation mileage if client exists and km_rodado is available
        const operationName = hodometro.cliente?.nome || 'Sem cliente';
        
        if (hodometro.km_rodado && hodometro.km_rodado > 0) {
          operationMileageMap.set(
            operationName, 
            (operationMileageMap.get(operationName) || 0) + hodometro.km_rodado
          );
        }
      });
      
      // Post-process daily vehicle data to calculate total kilometers
      let totalKilometers = 0;
      
      // Process daily vehicle data to calculate mileage
      for (const [key, data] of dailyVehicleDataMap.entries()) {
        const [date, vehicleId] = key.split('_');
        let kmRodadoNoDia = 0;
        
        if (data.vehicleType === 'automovel' && data.firstReadingKm !== null && data.lastReadingKm !== null) {
          kmRodadoNoDia = data.lastReadingKm - data.firstReadingKm;
          // Handle cases where final reading is less than initial (odometer reset or error)
          if (kmRodadoNoDia < 0) {
            console.warn(`Negative km_rodado for automovel on ${date} for vehicle ${vehicleId}. Resetting to 0.`);
            kmRodadoNoDia = 0;
          }
        } else if (data.vehicleType === 'ciclomotor' && data.firstReadingTrip !== null && data.lastReadingTrip !== null) {
          // For ciclomotors, calculate km_rodado as the difference between last and first trip readings
          kmRodadoNoDia = data.lastReadingTrip - data.firstReadingTrip;
          if (kmRodadoNoDia < 0) {
            console.warn(`Negative km_rodado for ciclomotor on ${date} for vehicle ${vehicleId}. Resetting to 0.`);
            kmRodadoNoDia = 0;
          }
        }
        
        if (kmRodadoNoDia > 0) {
          // Update total kilometers
          totalKilometers += kmRodadoNoDia;
          
          // Update daily mileage map
          const dailyData = dailyMileageMap.get(date) || { 
            totalKm: 0, 
            formattedDate: formatDateBR(date) 
          };
          dailyData.totalKm += kmRodadoNoDia;
          dailyMileageMap.set(date, dailyData);
          
          // Update driver mileage map
          if (data.motorista_id && data.motorista_nome) {
            const driverData = driverMileageMap.get(data.motorista_id) || {
              nome: data.motorista_nome,
              totalKm: 0
            };
            driverData.totalKm += kmRodadoNoDia;
            driverMileageMap.set(data.motorista_id, driverData);
          }
          
          // Update vehicle mileage map
          if (data.veiculo_id && data.veiculo_placa) {
            const vehicleData = vehicleMileageMap.get(data.veiculo_id) || {
              placa: data.veiculo_placa,
              totalKm: 0,
              lastDate: date
            };
            vehicleData.totalKm += kmRodadoNoDia;
            
            // Update last date if this reading is more recent
            const currentDate = new Date(date);
            const existingDate = vehicleData.lastDate ? new Date(vehicleData.lastDate) : null;
            
            if (!existingDate || currentDate > existingDate) {
              vehicleData.lastDate = date;
            }
            
            vehicleMileageMap.set(data.veiculo_id, vehicleData);
          }
        }
      }
      
      // Fetch all clients to ensure they're all represented in the chart
      const { data: clientesData, error: clientesError } = await supabase
        .from('cliente')
        .select('nome')
        .eq('company_id', companyId)
        .eq('st_cliente', true);
        
      if (clientesError) throw clientesError;
      
      // Add all clients to the operation mileage map with 0 km if they don't exist
      if (clientesData) {
        clientesData.forEach(cliente => {
          if (!operationMileageMap.has(cliente.nome)) {
            operationMileageMap.set(cliente.nome, 0);
          }
        });
      }
      
      // Always ensure "Sem cliente" exists in the map
      if (!operationMileageMap.has('Sem cliente')) {
        operationMileageMap.set('Sem cliente', 0);
      }
      
      // Convert maps to arrays for state
      const dailyMileageArray: DailyMileage[] = Array.from(dailyMileageMap.entries())
        .map(([date, data]) => ({
          date,
          totalKm: data.totalKm,
          formattedDate: data.formattedDate
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
      
      const driverMileageArray: DriverMileage[] = Array.from(driverMileageMap.entries())
        .map(([motorista_id, data]) => ({
          motorista_id: Number(motorista_id),
          nome: data.nome,
          totalKm: data.totalKm
        }))
        .sort((a, b) => b.totalKm - a.totalKm);
      
      const vehicleMileageArray: VehicleMileage[] = Array.from(vehicleMileageMap.entries())
        .map(([veiculo_id, data]) => ({
          veiculo_id: Number(veiculo_id),
          placa: data.placa,
          totalKm: data.totalKm,
          lastDate: data.lastDate ? formatDateBR(data.lastDate) : undefined
        }))
        .sort((a, b) => b.totalKm - a.totalKm);
      
      const driverReadingsArray: DriverReadings[] = Array.from(driverReadingsMap.entries())
        .map(([motorista_id, data]) => ({
          motorista_id: Number(motorista_id),
          nome: data.nome,
          count: data.count
        }))
        .sort((a, b) => b.count - a.count);
      
      const operationMileageArray: OperationMileage[] = Array.from(operationMileageMap.entries())
        .map(([name, value]) => ({
          name,
          value
        }))
        .sort((a, b) => b.value - a.value);
      
      // Calculate average km per day
      const uniqueDays = new Set(dailyMileageArray.map(item => item.date)).size;
      const avgKmPerDay = uniqueDays > 0 ? totalKilometers / uniqueDays : 0;
      
      // Update state with processed data
      setDailyMileage(dailyMileageArray);
      setDriverMileage(driverMileageArray);
      setVehicleMileage(vehicleMileageArray);
      setDriverReadings(driverReadingsArray);
      setOperationMileage(operationMileageArray);
      setTotalKm(totalKilometers);
      setAverageKmPerDay(avgKmPerDay);
      setTotalReadings(data?.length || 0);
      
      console.log(`Processed data: ${driverReadingsArray.length} drivers with readings`);
      
    } catch (error) {
      handleSupabaseError(error, 'carregar dados de hodômetro');
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayReadings = async () => {
    try {
      setConnectionError(false);
      
      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];
      
      // Check if today is within the selected date range
      const startDate = dateRange.startDate ? new Date(dateRange.startDate) : null;
      const endDate = dateRange.endDate ? new Date(dateRange.endDate) : null;
      const todayDate = new Date(today);
      
      // If today is not in the selected range, set todayReadings to 0
      if ((startDate && todayDate < startDate) || (endDate && todayDate > endDate)) {
        setTodayReadings(0);
        return;
      }
      
      const { data, error, count } = await supabase
        .from('hodometro')
        .select('id_hodometro', { count: 'exact' })
        .eq('company_id', companyId)
        .eq('data', today);
      
      if (error) throw error;
      
      setTodayReadings(count || 0);
    } catch (error) {
      handleSupabaseError(error, 'calcular leituras de hoje');
    }
  };

  const fetchInconsistencies = async () => {
    try {
      setConnectionError(false);
      
      // Build the query with date range filter
      let query = supabase
        .from('hodometro')
        .select(`
          id_hodometro,
          data,
          hora,
          hod_lido,
          hod_informado,
          km_rodado,
          bateria,
          foto_hodometro,
          trip_lida,
          trip_informada,
          comparacao_leitura,
          verificacao,
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
        `, { count: 'exact' })
        .eq('company_id', companyId)
        .eq('verificacao', false);
      
      // Apply date range filter
      if (dateRange.startDate) {
        query = query.gte('data', dateRange.startDate);
      }
      if (dateRange.endDate) {
        query = query.lte('data', dateRange.endDate);
      }
      
      const { data, error, count } = await query
        .order('data', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      setHodometros(data || []);
      setTotalInconsistencies(count || 0);
    } catch (error) {
      handleSupabaseError(error, 'carregar inconsistências');
    }
  };

  const handleShowPhoto = (photo: string | null) => {
    if (photo) {
      setSelectedPhoto(photo);
      setShowPhotoModal(true);
    } else {
      toast.error('Nenhuma foto disponível');
    }
  };

  // Format number with dot as thousands separator
  const formatNumber = (num: number | null | undefined): string => {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return num.toLocaleString('pt-BR');
  };

  // Retry connection function
  const retryConnection = () => {
    setConnectionError(false);
    fetchData();
    fetchTodayReadings();
    fetchInconsistencies();
  };

  // Filter hodometros by vehicle type
  const filteredHodometros = hodometros.filter(h => {
    if (vehicleTypeFilter === 'all') return true;
    if (vehicleTypeFilter === 'ciclomotor') return h.bateria !== null && h.bateria !== undefined;
    if (vehicleTypeFilter === 'automovel') return h.bateria === null || h.bateria === undefined;
    return true;
  });

  // Check if there's a discrepancy between reported and read values
  const hasDiscrepancy = (hodometro: HodometroReading): boolean => {
    // If comparacao_leitura is explicitly false, there's a discrepancy
    if (hodometro.comparacao_leitura === false) return true;
    
    // For electric vehicles (with battery), we can't compare hodometer values
    if (hodometro.bateria !== null && hodometro.bateria !== undefined) return false;
    
    // For regular vehicles, check if values are different
    if (hodometro.hod_informado !== null && hodometro.hod_lido !== null) {
      // Allow a small tolerance (e.g., 1% difference)
      const tolerance = hodometro.hod_informado * 0.01;
      return Math.abs(hodometro.hod_informado - hodometro.hod_lido) > tolerance;
    }
    
    return false;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  // Show connection error state
  if (connectionError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-black dark:text-white mb-2">
            Problema de Conexão
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
            Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.
          </p>
          <button
            onClick={retryConnection}
            className="px-6 py-3 bg-blue-600 text-black dark:text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <PeriodSelector
          periodType={periodType}
          dateRange={dateRange}
          pendingDateRange={pendingDateRange}
          onPeriodChange={updatePeriod}
          onDateRangeChange={setDateRange}
          onApplyCustomRange={() => {
            if (applyPendingDateRange()) {
              fetchData();
              fetchTodayReadings();
              fetchInconsistencies();
            }
          }}
        />
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total de Quilômetros"
          value={totalKm}
          icon={TrendingUp}
          color="blue"
        />
        <StatCard
          title="Média Diária"
          value={Math.round(averageKmPerDay)}
          icon={Calendar}
          color="green"
          unit="km"
        />
        <StatCard
          title="Total de Leituras"
          value={totalReadings}
          icon={Activity}
          color="purple"
        />
        <StatCard
          title="Leituras Hoje"
          value={todayReadings}
          icon={FileText}
          color="amber"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Mileage */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="mb-6 flex items-center gap-2">
  <BarChart2 className="text-blue-500" size={20} />
  <h3 className="text-lg font-bold text-black dark:text-white">Quilometragem Diária</h3>
</div>
          
          {dailyMileage.length > 0 ? (
            <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
              {dailyMileage.map((day, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-black dark:text-gray-400">
                      {day.formattedDate}
                    </span>
                    <span className="text-sm font-medium text-black dark:text-white">
                      {formatNumber(day.totalKm)} km
                    </span>
                  </div>
                  <div className="h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${Math.max(
                          5, 
                          (day.totalKm / Math.max(...dailyMileage.map(d => d.totalKm), 1)) * 100
                        )}%` 
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-60 bg-card rounded-2xl shadow">
              <BarChart2 className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-4" />
              <p className="text-gray-400">Nenhum dado disponível para o período selecionado</p>
            </div>
          )}
        </div>

        {/* Driver Mileage */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="mb-6 flex items-center gap-2">
  <Users className="text-green-500" size={20} />
  <h3 className="text-lg font-bold text-black dark:text-white">Quilometragem por Motorista</h3>
</div>
          
          {driverMileage.length > 0 ? (
            <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
              {driverMileage.map((driver, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-black dark:text-gray-400">
                      {driver.nome}
                    </span>
                    <span className="text-sm font-medium text-black dark:text-white">
                      {formatNumber(driver.totalKm)} km
                    </span>
                  </div>
                  <div className="h-2 bg-green-200 dark:bg-green-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${Math.max(
                          5, 
                          (driver.totalKm / Math.max(...driverMileage.map(d => d.totalKm), 1)) * 100
                        )}%` 
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-60 bg-card rounded-2xl shadow">
              <Users className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-4" />
              <p className="text-gray-400">Nenhum dado disponível para o período selecionado</p>
            </div>
          )}
        </div>

        {/* Vehicle Mileage */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-black dark:text-white mb-6 flex items-center gap-2">
            <Truck className="text-purple-500 dark:text-purple-400" size={20} />
            Quilometragem por Veículo
          </h3>
          
          {vehicleMileage.length > 0 ? (
            <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
              {vehicleMileage.map((vehicle, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-black dark:text-gray-400">
                      {vehicle.placa}
                    </span>
                    <span className="text-sm font-medium text-black dark:text-white">
                      {formatNumber(vehicle.totalKm)} km
                    </span>
                  </div>
                  <div className="h-2 bg-purple-200 dark:bg-purple-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-500 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${Math.max(
                          5, 
                          (vehicle.totalKm / Math.max(...vehicleMileage.map(v => v.totalKm), 1)) * 100
                        )}%` 
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-60 bg-card rounded-2xl shadow">
              <Truck className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-4" />
              <p className="text-gray-400">Nenhum dado disponível para o período selecionado</p>
            </div>
          )}
        </div>

        {/* Leituras por Motorista Chart and KM per Operation Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-black dark:text-white mb-6 flex items-center gap-2">
            <FileBarChart className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            Leituras por Motorista
          </h3>
          
          {driverReadings.length > 0 ? (
            <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
              {driverReadings.map((driver, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-black dark:text-gray-400">
                      {driver.nome}
                    </span>
                    <span className="text-sm font-medium text-black dark:text-white">
                      {driver.count} {driver.count === 1 ? 'leitura' : 'leituras'}
                    </span>
                  </div>
                  <div className="h-2 bg-white dark:bg-[#1F2937] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-orange-500 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${Math.max(
                          5, 
                          (driver.count / Math.max(...driverReadings.map(d => d.count), 1)) * 100
                        )}%` 
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-60 bg-card rounded-2xl shadow">
              <FileBarChart className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-4" />
              <p className="text-gray-400">Nenhum dado disponível para o período selecionado</p>
            </div>
          )}
        </div>
      </div>

      {/* KM per Operation Chart */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-black dark:text-white mb-6 flex items-center gap-2">
          <Gauge className="w-5 h-5 text-orange-500 dark:text-orange-400" />
          Quilômetros por Operação
        </h3>
        
        {operationMileage.length > 0 ? (
          <div className="space-y-6">
            {operationMileage.map((item, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {item.name}
                  </span>
                  <span className="text-sm font-medium text-black dark:text-white">
                    {formatNumber(item.value)} km
                  </span>
                </div>
                <div className="h-2 bg-orange-200 dark:bg-orange-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-orange-500 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.max(
                        5, 
                        (item.value / Math.max(...operationMileage.map(m => m.value), 1)) * 100
                      )}%` 
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-60 bg-card rounded-2xl">
            <AlertCircle className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-gray-400">Nenhum dado disponível para o período selecionado</p>
          </div>
        )}
      </div>

      {/* Inconsistencies Table */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400" />
            <h3 className="text-lg font-medium text-black dark:text-white">
              Inconsistência de Leitura
            </h3>
          </div>
          <div className="flex items-center gap-4">
            <div className="px-3 py-1 bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200 rounded-full text-sm font-medium">
              {totalInconsistencies} {totalInconsistencies === 1 ? 'inconsistência' : 'inconsistências'}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setVehicleTypeFilter('all')}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  vehicleTypeFilter === 'all'
                    ? 'bg-blue-600 text-white dark:bg-blue-400 dark:text-black'
                    : 'bg-gray-100 text-gray-700 dark:bg-[#334155] dark:text-gray-300'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setVehicleTypeFilter('automovel')}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  vehicleTypeFilter === 'automovel'
                    ? 'bg-blue-600 text-white dark:bg-blue-400 dark:text-black'
                    : 'bg-gray-100 text-gray-700 dark:bg-[#334155] dark:text-gray-300'
                }`}
              >
                Automóveis
              </button>
              <button
                onClick={() => setVehicleTypeFilter('ciclomotor')}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  vehicleTypeFilter === 'ciclomotor'
                    ? 'bg-blue-600 text-white dark:bg-blue-400 dark:text-black'
                    : 'bg-gray-100 text-gray-700 dark:bg-[#334155] dark:text-gray-300'
                }`}
              >
                Ciclomotores
              </button>
            </div>
          </div>
        </div>
        
        {filteredHodometros.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="p-6 min-h-[calc(100vh-16rem)] bg-card">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Nome</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Data</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Placa</th>
                  
                  {vehicleTypeFilter === 'all' || vehicleTypeFilter === 'automovel' ? (
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Hodômetro</th>
                  ) : null}
                  
                  {vehicleTypeFilter === 'all' || vehicleTypeFilter === 'ciclomotor' ? (
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Trip</th>
                  ) : null}
                  
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Foto</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-gray-200 dark:divide-gray-700">
                {filteredHodometros.map((hodometro) => {
                  const isElectric = hodometro.bateria !== null && hodometro.bateria !== undefined;
                  
                  // Skip if vehicle type doesn't match filter
                  if ((vehicleTypeFilter === 'automovel' && isElectric) || 
                      (vehicleTypeFilter === 'ciclomotor' && !isElectric)) {
                    return null;
                  }
                  
                  return (
                    <tr key={hodometro.id_hodometro} className="hover:bg-blue-50 dark:hover:bg-blue-900/10">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-black dark:text-white">
                          {hodometro.motorista?.nome || 'Não informado'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {hodometro.motorista?.cpf ? formatCPF(hodometro.motorista.cpf) : ''}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-black dark:text-white">
                          {formatDateBR(hodometro.data)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {hodometro.hora}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-blue-600 dark:text-blue-400 uppercase">
                          {hodometro.veiculo?.placa || 'Não informada'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {hodometro.veiculo?.marca} {hodometro.veiculo?.tipo}
                        </div>
                      </td>
                      
                      {/* Conditional columns based on vehicle type */}
                      {(vehicleTypeFilter === 'all' || vehicleTypeFilter === 'automovel') && !isElectric && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <div className="text-sm text-black dark:text-white">
                              Lido: {hodometro.hod_lido !== null ? formatNumber(hodometro.hod_lido) : '-'}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              Informado: {hodometro.hod_informado !== null ? formatNumber(hodometro.hod_informado) : '-'}
                            </div>
                          </div>
                        </td>
                      )}
                      
                      {/* Hide these columns for automóveis */}
                      {(vehicleTypeFilter === 'all' || vehicleTypeFilter === 'automovel') && isElectric && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-black dark:text-gray-400">-</div>
                        </td>
                      )}
                      
                      {/* Trip columns for ciclomotores */}
                      {(vehicleTypeFilter === 'all' || vehicleTypeFilter === 'ciclomotor') && isElectric && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <div className="text-sm text-black dark:text-white">
                              Lida: {hodometro.trip_lida !== null ? formatNumber(hodometro.trip_lida) : '-'}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              Informada: {hodometro.trip_informada || '-'}
                            </div>
                          </div>
                        </td>
                      )}
                      
                      {/* Hide these columns for ciclomotores */}
                      {(vehicleTypeFilter === 'all' || vehicleTypeFilter === 'ciclomotor') && !isElectric && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-black dark:text-gray-400">-</div>
                        </td>
                      )}
                      
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {hodometro.foto_hodometro ? (
                          <button
                            onClick={() => handleShowPhoto(hodometro.foto_hodometro)}
                            className="inline-flex items-center justify-center p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                            title="Ver foto do hodômetro"
                          >
                            <Camera size={18} />
                          </button>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-600">
                            <Camera size={18} className="inline-block opacity-50" />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 bg-card rounded-2xl">
            <Eye className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-gray-400">Nenhuma inconsistência encontrada</p>
          </div>
        )}
      </div>

      {/* Photo Modal */}
      {showPhotoModal && selectedPhoto && (
        <div 
          className="fixed inset-0 bg-transparent z-50 flex items-center justify-center p-4"
          onClick={() => setShowPhotoModal(false)}
        >
          <div 
            className="bg-card rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-none border-none"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-medium text-black dark:text-white">
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
    </div>
  );
};

// Stat Card Component
const StatCard = ({ 
  title, 
  value, 
  icon: Icon,
  color = 'blue',
  unit = ''
}: { 
  title: string;
  value: number;
  icon: any;
  color?: 'blue' | 'green' | 'purple' | 'amber' | 'red';
  unit?: string;
}) => {
  // Define color variants based on the hodometros dashboard style
  const colorVariants = {
    blue: {
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      gradient: 'from-blue-600 to-indigo-600',
      darkGradient: 'dark:from-blue-400 dark:to-indigo-400'
    },
    green: {
      iconBg: 'bg-green-100 dark:bg-green-900/30',
      iconColor: 'text-green-600 dark:text-green-400',
      gradient: 'from-green-600 to-emerald-600',
      darkGradient: 'dark:from-green-400 dark:to-emerald-400'
    },
    purple: {
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
      iconColor: 'text-purple-600 dark:text-purple-400',
      gradient: 'from-purple-600 to-violet-600',
      darkGradient: 'dark:from-purple-400 dark:to-violet-400'
    },
    amber: {
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      gradient: 'from-amber-600 to-orange-600',
      darkGradient: 'dark:from-amber-400 dark:to-orange-400'
    },
    red: {
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      iconColor: 'text-red-600 dark:text-red-400',
      gradient: 'from-red-600 to-rose-600',
      darkGradient: 'dark:from-red-400 dark:to-rose-400'
    }
  };

  const variant = colorVariants[color];

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg transition-all duration-300 transform hover:-translate-y-1">
      <div className="flex flex-col items-center text-center">
        <div className={`p-3 ${variant.iconBg} rounded-2xl mb-3`}>
          <Icon className={`w-6 h-6 ${variant.iconColor}`} />
        </div>
        
        <h3 className="text-sm font-medium text-gray-400 mb-2">
          {title}
        </h3>
        
        <p className={`text-3xl font-bold bg-gradient-to-r ${variant.gradient} ${variant.darkGradient} bg-clip-text text-transparent`}>
          {value.toLocaleString('pt-BR')}{unit && ` ${unit}`}
        </p>
      </div>
    </div>
  );
};

export default HodometrosDashboard;