import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart2, Calendar, TrendingUp, Truck, Users, 
  AlertTriangle, Activity, FileText, Camera, X, Eye,
  Gauge, AlertCircle, FileBarChart, ChevronDown, Lock,
  ClipboardList, UserCheck, ImageIcon, Fuel
} from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useDateRange } from '../../hooks/useDateRange';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatCPF } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import { useModuleAccess } from '../../hooks/useModuleAccess';

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
  placa: string; // Normalized to UPPERCASE for consolidation
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

interface FilialMinutas {
  filial: string;
  count: number;
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

interface BombaReading {
  id: number;
  data: string;
  litro_lido: number;
  preco_lido: number;
  km_rodado: number | null;
  veiculo_placa: string;
  veiculo_marca: string;
  motorista_nome: string;
}

interface VehicleFuelStats {
  veiculo_id: number;
  placa: string;
  marca: string;
  totalLitros: number;
  totalGasto: number;
  totalKm: number;
  mediaKmPorLitro: number;
  abastecimentos: number;
}

interface KmVsPriceData {
  placa: string;
  km: number;
  preco: number;
}

const HodometrosDashboard = () => {
  const { query } = useCompanyData();
  const { companyId } = useAuth();
  const { loading: moduleLoading, moduleAccess } = useModuleAccess();
  const [loading, setLoading] = useState(true);
  const [dailyMileage, setDailyMileage] = useState<DailyMileage[]>([]);
  const [driverMileage, setDriverMileage] = useState<DriverMileage[]>([]);
  const [vehicleMileage, setVehicleMileage] = useState<VehicleMileage[]>([]);
  const [driverReadings, setDriverReadings] = useState<DriverReadings[]>([]);
  const [operationMileage, setOperationMileage] = useState<OperationMileage[]>([]);
  const [filialMinutas, setFilialMinutas] = useState<FilialMinutas[]>([]);
  const [driverMinutaBomba, setDriverMinutaBomba] = useState<DriverReadings[]>([]);
  const [driverHodometroBomba, setDriverHodometroBomba] = useState<DriverReadings[]>([]);
  const [showMinutaBombaView, setShowMinutaBombaView] = useState(false);
  const [totalKm, setTotalKm] = useState(0);
  const [averageKmPerDay, setAverageKmPerDay] = useState(0);
  const [totalReadings, setTotalReadings] = useState(0);
  const [todayReadings, setTodayReadings] = useState(0);
  
  // Minuta stats
  const [totalMinutas, setTotalMinutas] = useState(0);
  const [avgMinutasPerDay, setAvgMinutasPerDay] = useState(0);
  const [avgMinutasPerDriver, setAvgMinutasPerDriver] = useState(0);
  const [minutasWithPhotoPercent, setMinutasWithPhotoPercent] = useState(0);
  
  // Bomba stats
  const [totalBomba, setTotalBomba] = useState(0);
  const [todayBombaMinuta, setTodayBombaMinuta] = useState(0);
  
  // Detailed Bomba stats
  const [vehicleFuelStats, setVehicleFuelStats] = useState<VehicleFuelStats[]>([]);
  const [kmVsPriceData, setKmVsPriceData] = useState<KmVsPriceData[]>([]);
  const [totalLitros, setTotalLitros] = useState(0);
  const [totalGasto, setTotalGasto] = useState(0);
  const [avgCustoPorLitro, setAvgCustoPorLitro] = useState(0);
  
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('30days', false);
  
  // Validate date is within acceptable range
  const validateDate = (dateString: string): boolean => {
    if (!dateString) return true; // Allow empty
    const year = parseInt(dateString.split('-')[0]);
    return year >= 2020 && year <= 2099;
  };
  
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<'all' | 'automovel' | 'ciclomotor'>('all');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const periodDropdownRef = useRef<HTMLDivElement>(null);
  
  // Inconsistencies table state
  const [hodometros, setHodometros] = useState<HodometroReading[]>([]);
  const [totalInconsistencies, setTotalInconsistencies] = useState(0);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  
  // Connection error state
  const [connectionError, setConnectionError] = useState(false);

  useEffect(() => {
    // Only fetch when date range actually changes
    // AND when user has access to the module
    if (moduleAccess.hodometros) {
      fetchData();
      fetchTodayReadings();
      fetchInconsistencies();
      
      // Fetch minutas stats if user has access
      if (moduleAccess.minuta || moduleAccess.bomba) {
        if (moduleAccess.minuta) {
          fetchMinutasStats();
          fetchFilialMinutas();
          fetchDriverMinutas();
        }
        fetchDriverHodometroBomba();
      }
      
      // Fetch bomba stats if user has access
      if (moduleAccess.bomba) {
        fetchBombaStats();
        fetchBombaDetailedStats();
      }
      
      // Fetch combined today stats
      fetchTodayBombaMinuta();
    }
  }, [dateRange, moduleAccess.hodometros, moduleAccess.minuta, moduleAccess.bomba, moduleAccess.calculoUmPorDia]);

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
      
      // STEP 1: Fetch all hodometro readings within date range
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

      // Processing hodometro readings data

      // Initialize maps for data processing
      const dailyMileageMap = new Map<string, { totalKm: number; formattedDate: string }>();
      const driverMileageMap = new Map<number, { nome: string; totalKm: number }>();
      // Group by NORMALIZED PLACA (uppercase) to avoid duplicates like "Hbz6f14" and "HBZ6F14"
      const vehicleMileageMap = new Map<string, { placa: string; totalKm: number; lastDate?: string }>();
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
      // When calculoUmPorDia is true: compare today's reading with yesterday's reading
      // When calculoUmPorDia is false: use difference between first and last reading of the same day
      
      if (moduleAccess.calculoUmPorDia) {
        // NEW METHOD: One reading per day - compare with previous day
        // Group readings by vehicle and sort by date
        const vehicleReadingsMap = new Map<number, Array<{ date: string; reading: number; vehicleType: string; data: DailyVehicleReadings }>>();
        
        for (const [key, data] of Array.from(dailyVehicleDataMap.entries())) {
          const [date, vehicleId] = key.split('_');
          const numericVehicleId = parseInt(vehicleId);
          
          if (!vehicleReadingsMap.has(numericVehicleId)) {
            vehicleReadingsMap.set(numericVehicleId, []);
          }
          
          // Get the reading for this day
          let reading: number | null = null;
          if (data.vehicleType === 'automovel' && data.lastReadingKm !== null) {
            reading = data.lastReadingKm;
          } else if (data.vehicleType === 'ciclomotor' && data.lastReadingTrip !== null) {
            reading = data.lastReadingTrip;
          }
          
          if (reading !== null) {
            vehicleReadingsMap.get(numericVehicleId)!.push({
              date,
              reading,
              vehicleType: data.vehicleType,
              data
            });
          }
        }
        
        // Process each vehicle's readings chronologically
        for (const [vehicleId, readings] of vehicleReadingsMap.entries()) {
          // Sort by date
          readings.sort((a, b) => a.date.localeCompare(b.date));
          
          // Calculate km for each day by comparing with previous day
          for (let i = 1; i < readings.length; i++) {
            const currentDay = readings[i];
            const previousDay = readings[i - 1];
            
            const kmRodadoNoDia = currentDay.reading - previousDay.reading;
            
            // Handle negative values (odometer reset or error)
            if (kmRodadoNoDia < 0) {
              console.warn(`Negative km_rodado for vehicle ${vehicleId} on ${currentDay.date}. Resetting to 0.`);
              continue; // Skip this day
            }
            
            if (kmRodadoNoDia > 0) {
              // Update total kilometers
              totalKilometers += kmRodadoNoDia;
              
              // Update daily mileage map
              const dailyData = dailyMileageMap.get(currentDay.date) || { 
                totalKm: 0, 
                formattedDate: formatDateBR(currentDay.date) 
              };
              dailyData.totalKm += kmRodadoNoDia;
              dailyMileageMap.set(currentDay.date, dailyData);
              
              // Update driver mileage map
              if (currentDay.data.motorista_id && currentDay.data.motorista_nome) {
                const driverData = driverMileageMap.get(currentDay.data.motorista_id) || {
                  nome: currentDay.data.motorista_nome,
                  totalKm: 0
                };
                driverData.totalKm += kmRodadoNoDia;
                driverMileageMap.set(currentDay.data.motorista_id, driverData);
              }
              
              // Update vehicle mileage map (grouped by NORMALIZED PLACA to avoid duplicates)
              if (currentDay.data.veiculo_id && currentDay.data.veiculo_placa) {
                const placaNormalizada = (currentDay.data.veiculo_placa || '').trim().toUpperCase();
                const vehicleData = vehicleMileageMap.get(placaNormalizada) || {
                  placa: placaNormalizada, // Always store normalized placa
                  totalKm: 0,
                  lastDate: currentDay.date
                };
                vehicleData.totalKm += kmRodadoNoDia;
                
                // Update last date if this reading is more recent (compare strings directly)
                if (!vehicleData.lastDate || currentDay.date > vehicleData.lastDate) {
                  vehicleData.lastDate = currentDay.date;
                }
                
                vehicleMileageMap.set(placaNormalizada, vehicleData);
              }
            }
          }
        }
      } else {
        // ORIGINAL METHOD: Multiple readings per day - calculate difference within the same day
        for (const [key, data] of Array.from(dailyVehicleDataMap.entries())) {
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
          
          // Update vehicle mileage map (grouped by NORMALIZED PLACA to avoid duplicates)
          if (data.veiculo_id && data.veiculo_placa) {
            const placaNormalizada = (data.veiculo_placa || '').trim().toUpperCase();
            const vehicleData = vehicleMileageMap.get(placaNormalizada) || {
              placa: placaNormalizada, // Always store normalized placa
              totalKm: 0,
              lastDate: date
            };
            vehicleData.totalKm += kmRodadoNoDia;
            
            // Update last date if this reading is more recent (compare strings directly)
            if (!vehicleData.lastDate || date > vehicleData.lastDate) {
              vehicleData.lastDate = date;
            }
            
            vehicleMileageMap.set(placaNormalizada, vehicleData);
          }
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
      
      // STEP 2: Fetch FIRST-EVER readings for vehicles present in the period
      // Collect unique vehicle_ids from the period
      const vehicleIdsInPeriod = new Set<number>();
      (data || []).forEach(hodometro => {
        if (hodometro.veiculo_id) {
          vehicleIdsInPeriod.add(hodometro.veiculo_id);
        }
      });
      
      // Fetch first non-null reading for each vehicle (optimized query)
      const firstReadingsByPlaca = new Map<string, { firstHodLido: number | null; firstTripLida: number | null }>();
      
      if (vehicleIdsInPeriod.size > 0) {
        const { data: firstReadingsData, error: firstReadingsError } = await supabase
          .from('hodometro')
          .select(`
            veiculo_id,
            hod_lido,
            trip_lida,
            data,
            hora,
            bateria,
            veiculo:veiculo_id (
              placa
            )
          `)
          .eq('company_id', companyId)
          .in('veiculo_id', Array.from(vehicleIdsInPeriod))
          .order('data', { ascending: true })
          .order('hora', { ascending: true });
        
        if (firstReadingsError) throw firstReadingsError;
        
        // Build map: normalized_placa -> { firstHodLido, firstTripLida }
        // Detect odometer resets and use first reading AFTER last reset as baseline
        
        // Group readings by normalized placa
        const readingsByPlaca = new Map<string, any[]>();
        (firstReadingsData || []).forEach(reading => {
          const veiculoData = Array.isArray(reading.veiculo) ? reading.veiculo[0] : reading.veiculo;
          if (!veiculoData?.placa) return;
          
          const placaNormalizada = veiculoData.placa.trim().toUpperCase();
          if (!readingsByPlaca.has(placaNormalizada)) {
            readingsByPlaca.set(placaNormalizada, []);
          }
          readingsByPlaca.get(placaNormalizada)!.push(reading);
        });
        
        // Process each placa to detect resets
        readingsByPlaca.forEach((readings, placaNormalizada) => {
          if (readings.length === 0) return;
          
          const isElectric = readings.some(r => r.bateria !== null && r.bateria !== undefined);
          
          // Track reset detection
          let baselineHodLido: number | null = null;
          let baselineTripLida: number | null = null;
          let previousHodValue = -1;
          let previousTripValue = -1;
          
          for (const reading of readings) {
            const hodValue = reading.hod_lido ? parseFloat(reading.hod_lido) : 0;
            const tripValue = reading.trip_lida ? parseFloat(reading.trip_lida) : 0;
            
            // Detect reset for automobiles (hod_lido)
            if (!isElectric && hodValue > 0) {
              if (previousHodValue > 0 && hodValue < previousHodValue) {
                // Reset detected! Update baseline
                baselineHodLido = hodValue;
                previousHodValue = hodValue;
              } else if (baselineHodLido === null) {
                // First valid reading
                baselineHodLido = hodValue;
                previousHodValue = hodValue;
              } else {
                previousHodValue = hodValue;
              }
            }
            
            // Detect reset for ciclomotors (trip_lida)
            if (isElectric && tripValue > 0) {
              if (previousTripValue > 0 && tripValue < previousTripValue) {
                // Reset detected! Update baseline
                baselineTripLida = tripValue;
                previousTripValue = tripValue;
              } else if (baselineTripLida === null) {
                // First valid reading
                baselineTripLida = tripValue;
                previousTripValue = tripValue;
              } else {
                previousTripValue = tripValue;
              }
            }
          }
          
          // Store the baseline (after last reset)
          firstReadingsByPlaca.set(placaNormalizada, {
            firstHodLido: baselineHodLido,
            firstTripLida: baselineTripLida
          });
        });
      }
      
      // STEP 3: Recalculate vehicleMileageMap using the correct formula:
      // km_rodado = (latest reading in period) - (first-ever reading)
      vehicleMileageMap.clear(); // Clear existing data
      
      // Build a map to track the latest reading per normalized placa
      const latestReadingByPlaca = new Map<string, { reading: number; vehicleType: string; lastDate: string }>();
      
      for (const [key, data] of Array.from(dailyVehicleDataMap.entries())) {
        const [date, _vehicleId] = key.split('_');
        if (!data.veiculo_placa) continue;
        
        const placaNormalizada = data.veiculo_placa.trim().toUpperCase();
        
        // Get the latest reading for this vehicle type
        let latestReading: number | null = null;
        if (data.vehicleType === 'automovel' && data.lastReadingKm !== null) {
          latestReading = data.lastReadingKm;
        } else if (data.vehicleType === 'ciclomotor' && data.lastReadingTrip !== null) {
          latestReading = data.lastReadingTrip;
        }
        
        if (latestReading === null) continue;
        
        // Update if this is a more recent reading or first time seeing this placa
        const existingEntry = latestReadingByPlaca.get(placaNormalizada);
        if (!existingEntry || date > existingEntry.lastDate || 
            (date === existingEntry.lastDate && latestReading > existingEntry.reading)) {
          latestReadingByPlaca.set(placaNormalizada, {
            reading: latestReading,
            vehicleType: data.vehicleType,
            lastDate: date
          });
        }
      }
      
      // Now calculate km_rodado for each placa: latest - first-ever
      for (const [placaNormalizada, latestData] of latestReadingByPlaca.entries()) {
        const firstReading = firstReadingsByPlaca.get(placaNormalizada);
        
        if (!firstReading) {
          console.warn(`No first-ever reading found for placa ${placaNormalizada}`);
          continue;
        }
        
        let km_rodado = 0;
        
        if (latestData.vehicleType === 'automovel' && firstReading.firstHodLido !== null) {
          km_rodado = latestData.reading - firstReading.firstHodLido;
        } else if (latestData.vehicleType === 'ciclomotor' && firstReading.firstTripLida !== null) {
          km_rodado = latestData.reading - firstReading.firstTripLida;
        }
        
        // Handle negative values (odometer reset or error)
        if (km_rodado < 0) {
          console.warn(`Negative km_rodado for placa ${placaNormalizada}: latest ${latestData.reading} - first ${latestData.vehicleType === 'automovel' ? firstReading.firstHodLido : firstReading.firstTripLida}`);
          km_rodado = 0;
        }
        
        if (km_rodado >= 0) {
          vehicleMileageMap.set(placaNormalizada, {
            placa: placaNormalizada,
            totalKm: km_rodado,
            lastDate: latestData.lastDate
          });
        }
      }
      
      // Convert maps to arrays for state
      const dailyMileageArray: DailyMileage[] = Array.from(dailyMileageMap.entries())
        .map(([date, data]) => ({
          date,
          totalKm: data.totalKm,
          formattedDate: data.formattedDate
        }))
        .sort((a, b) => b.date.localeCompare(a.date)); // Sort descending: most recent first
      
      const driverMileageArray: DriverMileage[] = Array.from(driverMileageMap.entries())
        .map(([motorista_id, data]) => ({
          motorista_id: Number(motorista_id),
          nome: data.nome,
          totalKm: data.totalKm
        }))
        .sort((a, b) => b.totalKm - a.totalKm);
      
      const vehicleMileageArray: VehicleMileage[] = Array.from(vehicleMileageMap.entries())
        .map(([placaNormalizada, data]) => ({
          placa: data.placa, // Already normalized to UPPERCASE
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
      
      // Data processing completed for drivers
      
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
      
      // Check if today is within the selected date range (compare strings directly)
      const startDate = dateRange.startDate;
      const endDate = dateRange.endDate;
      
      // If today is not in the selected range, set todayReadings to 0
      if ((startDate && today < startDate) || (endDate && today > endDate)) {
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
      
      // Format the data to handle array structures from Supabase joins
      const formattedData = (data || []).map((item: any) => ({
        ...item,
        motorista: Array.isArray(item.motorista) ? item.motorista[0] : item.motorista,
        veiculo: Array.isArray(item.veiculo) ? item.veiculo[0] : item.veiculo
      })) as HodometroReading[];
      
      setHodometros(formattedData);
      setTotalInconsistencies(count || 0);
    } catch (error) {
      handleSupabaseError(error, 'carregar inconsistências');
    }
  };

  const fetchMinutasStats = async () => {
    try {
      setConnectionError(false);
      
      // Adjust end date to include the full day (23:59:59.999)
      const endDateFull = dateRange.endDate ? `${dateRange.endDate}T23:59:59.999` : null;
      
      // Fetch minutas within date range
      const { data, error } = await supabase
        .from('minuta')
        .select('id, created_at, motorista_id, foto_minuta')
        .eq('company_id', companyId)
        .gte('created_at', dateRange.startDate)
        .lte('created_at', endDateFull)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const minutas = data || [];
      const totalMinutasCount = minutas.length;
      
      // Calculate unique days (extract date part without creating Date object)
      const uniqueDays = new Set(
        minutas.map(m => m.created_at.split('T')[0])
      ).size;
      
      // Calculate average minutas per day
      const avgPerDay = uniqueDays > 0 ? totalMinutasCount / uniqueDays : 0;
      
      // Only calculate average per driver if bomba module is not active (metric won't be displayed)
      let avgPerDriver = 0;
      if (!moduleAccess.bomba) {
        // Calculate unique drivers
        const uniqueDrivers = new Set(
          minutas.filter(m => m.motorista_id).map(m => m.motorista_id)
        ).size;
        
        // Calculate average minutas per driver
        avgPerDriver = uniqueDrivers > 0 ? totalMinutasCount / uniqueDrivers : 0;
      }
      
      // Calculate percentage of minutas with photo
      const minutasWithPhoto = minutas.filter(m => m.foto_minuta && m.foto_minuta.trim() !== '').length;
      const percentWithPhoto = totalMinutasCount > 0 
        ? (minutasWithPhoto / totalMinutasCount) * 100 
        : 0;
      
      setTotalMinutas(totalMinutasCount);
      setAvgMinutasPerDay(avgPerDay);
      setAvgMinutasPerDriver(avgPerDriver);
      setMinutasWithPhotoPercent(percentWithPhoto);
      
    } catch (error) {
      handleSupabaseError(error, 'carregar estatísticas de minutas');
    }
  };

  const fetchBombaStats = async () => {
    try {
      setConnectionError(false);
      
      // Fetch bomba_gasolina records within date range
      const { data, error } = await supabase
        .from('bomba_gasolina')
        .select('id, data')
        .eq('company_id', companyId)
        .gte('data', dateRange.startDate)
        .lte('data', dateRange.endDate)
        .order('data', { ascending: false });
      
      if (error) throw error;
      
      const bombas = data || [];
      setTotalBomba(bombas.length);
      
    } catch (error) {
      handleSupabaseError(error, 'carregar estatísticas de bomba');
    }
  };

  // Helper function to recalculate km_rodado using the same logic as HodometrosLista
  const recalculateKmRodadoForVehicle = (readings: any[], calculoUmPorDia: boolean): Map<number, number> => {
    const kmRodadoMap = new Map<number, number>();
    
    if (readings.length === 0) return kmRodadoMap;
    
    const isCiclomotor = readings.some((r: any) => r.bateria !== null && r.bateria !== undefined);
    
    const sortedReadings = [...readings].sort((a: any, b: any) => {
      const dateCompare = a.data.localeCompare(b.data);
      if (dateCompare !== 0) return dateCompare;
      return a.hora.localeCompare(b.hora);
    });
    
    if (calculoUmPorDia) {
      const readingsByDay = new Map<string, any[]>();
      
      sortedReadings.forEach((reading: any) => {
        if (!readingsByDay.has(reading.data)) {
          readingsByDay.set(reading.data, []);
        }
        readingsByDay.get(reading.data)!.push(reading);
      });
      
      const uniqueDays = Array.from(readingsByDay.keys()).sort();
      const dayLastReadings = new Map<string, number>();
      
      uniqueDays.forEach(day => {
        const dayReadings = readingsByDay.get(day)!;
        let maxValue = 0;
        dayReadings.forEach((reading: any) => {
          const value = isCiclomotor 
            ? (Number(reading.trip_lida) || 0)
            : (Number(reading.hod_lido) || 0);
          if (value > maxValue) maxValue = value;
        });
        dayLastReadings.set(day, maxValue);
      });
      
      sortedReadings.forEach((reading: any) => {
        const currentDayIndex = uniqueDays.indexOf(reading.data);
        let kmRodado = 0;
        
        if (currentDayIndex < uniqueDays.length - 1) {
          const nextDay = uniqueDays[currentDayIndex + 1];
          const currentDate = new Date(reading.data + 'T00:00:00');
          const nextDate = new Date(nextDay + 'T00:00:00');
          const daysDiff = Math.round((nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysDiff === 1) {
            const todayReading = dayLastReadings.get(reading.data) ?? 0;
            const nextDayReading = dayLastReadings.get(nextDay) ?? 0;
            kmRodado = nextDayReading - todayReading;
            if (kmRodado < 0) kmRodado = 0;
          }
        }
        
        kmRodadoMap.set(reading.id_hodometro, kmRodado);
      });
      
    } else {
      const readingsByDay = new Map<string, any[]>();
      
      sortedReadings.forEach((reading: any) => {
        if (!readingsByDay.has(reading.data)) {
          readingsByDay.set(reading.data, []);
        }
        readingsByDay.get(reading.data)!.push(reading);
      });
      
      sortedReadings.forEach((reading: any) => {
        const dayReadings = readingsByDay.get(reading.data)!;
        const firstReading = dayReadings[0];
        const lastReading = dayReadings[dayReadings.length - 1];
        
        let kmRodado = 0;
        if (isCiclomotor) {
          kmRodado = (Number(lastReading.trip_lida) || 0) - (Number(firstReading.trip_lida) || 0);
        } else {
          kmRodado = (Number(lastReading.hod_lido) || 0) - (Number(firstReading.hod_lido) || 0);
        }
        
        if (kmRodado < 0) kmRodado = 0;
        kmRodadoMap.set(reading.id_hodometro, kmRodado);
      });
    }
    
    return kmRodadoMap;
  };

  const fetchBombaDetailedStats = async () => {
    try {
      setConnectionError(false);
      
      // Helper to safely parse string numbers
      const parseNumber = (value: string | null | undefined): number => {
        if (!value) return 0;
        const num = parseFloat(value);
        return isNaN(num) ? 0 : num;
      };
      
      // Step 1: Fetch all bomba_gasolina records first to identify which vehicles we need
      const { data: bombasData, error: bombasError } = await supabase
        .from('bomba_gasolina')
        .select(`
          id,
          data,
          litro_lido,
          preco_lido,
          veiculo_id,
          motorista_id,
          hodometro_id,
          veiculo:veiculo_id (
            veiculo_id,
            placa,
            marca
          ),
          motorista:motorista_id (
            motorista_id,
            nome
          )
        `)
        .eq('company_id', companyId)
        .order('data', { ascending: false });
      
      if (bombasError) throw bombasError;
      
      const bombas = bombasData || [];
      
      // Collect unique vehicle_ids from bomba records
      const vehicleIdsInBomba = new Set<number>();
      bombas.forEach((bomba: any) => {
        const veiculo = Array.isArray(bomba.veiculo) ? bomba.veiculo[0] : bomba.veiculo;
        if (veiculo?.veiculo_id) {
          vehicleIdsInBomba.add(veiculo.veiculo_id);
        }
      });
      
      // Step 2: Fetch historical hodometro readings ONLY for vehicles that have bomba records
      // This is optimized and only gets what we need
      const firstReadingsByPlaca = new Map<string, { firstHodLido: number | null; firstTripLida: number | null }>();
      const totalKmRodadoByVehicleId = new Map<number, number>();
      const vehicleIdToPlaca = new Map<number, string>();
      
      if (vehicleIdsInBomba.size > 0) {
        const { data: allHodometrosData, error: allHodometrosError } = await supabase
          .from('hodometro')
          .select(`
            id_hodometro,
            data,
            hora,
            hod_lido,
            trip_lida,
            bateria,
            veiculo_id,
            veiculo:veiculo_id (
              veiculo_id,
              placa
            )
          `)
          .eq('company_id', companyId)
          .in('veiculo_id', Array.from(vehicleIdsInBomba))
          .order('veiculo_id')
          .order('data')
          .order('hora');
        
        if (allHodometrosError) throw allHodometrosError;
        
        // Group by veiculo_id
        const allHodometrosByVehicle = new Map<number, any[]>();
        (allHodometrosData || []).forEach(hod => {
          if (!allHodometrosByVehicle.has(hod.veiculo_id)) {
            allHodometrosByVehicle.set(hod.veiculo_id, []);
          }
          allHodometrosByVehicle.get(hod.veiculo_id)!.push(hod);
        });
        
        // Calculate km_rodado per veiculo_id: (latest in period) - (first-ever VALID reading)
        allHodometrosByVehicle.forEach((readings, veiculoId) => {
          if (readings.length === 0) return;
          
          // Sort by date and time to ensure correct order
          const sortedReadings = [...readings].sort((a, b) => {
            const dateCompare = a.data.localeCompare(b.data);
            if (dateCompare !== 0) return dateCompare;
            return a.hora.localeCompare(b.hora);
          });
          
          // Determine vehicle type from any reading
          const sampleReading = sortedReadings.find(r => r.bateria !== undefined);
          const isCiclomotor = sampleReading && sampleReading.bateria !== null && sampleReading.bateria !== undefined;
          
          // Find FIRST VALID reading AFTER the last odometer reset
          // Detect resets by tracking when the odometer value decreases
          let baselineReading = null;
          let previousValue = -1;
          
          for (const reading of sortedReadings) {
            const currentValue = isCiclomotor 
              ? parseNumber(reading.trip_lida) 
              : parseNumber(reading.hod_lido);
            
            // Skip null/zero readings
            if (currentValue === 0) continue;
            
            // Detect reset: current value is less than previous value
            if (previousValue > 0 && currentValue < previousValue) {
              // Reset detected! Use this as new baseline
              baselineReading = reading;
              previousValue = currentValue;
            } else if (baselineReading === null) {
              // First valid reading ever
              baselineReading = reading;
              previousValue = currentValue;
            } else {
              // Normal progression, update previous value
              previousValue = currentValue;
            }
          }
          
          if (!baselineReading) return; // No valid baseline reading
          
          // Filter readings within the selected period
          const readingsInPeriod = sortedReadings.filter(r => 
            r.data >= dateRange.startDate && r.data <= dateRange.endDate
          );
          
          if (readingsInPeriod.length === 0) return; // No readings in period
          
          // Find LAST VALID reading in period
          let lastValidReadingInPeriod = null;
          for (let i = readingsInPeriod.length - 1; i >= 0; i--) {
            const reading = readingsInPeriod[i];
            if (isCiclomotor && reading.trip_lida !== null) {
              lastValidReadingInPeriod = reading;
              break;
            } else if (!isCiclomotor && reading.hod_lido !== null) {
              lastValidReadingInPeriod = reading;
              break;
            }
          }
          
          if (!lastValidReadingInPeriod) return; // No valid reading in period
          
          // Calculate total km_rodado from baseline (after last reset) to most recent valid in period
          let totalKm = 0;
          if (isCiclomotor) {
            const baselineValue = parseNumber(baselineReading.trip_lida);
            const lastValue = parseNumber(lastValidReadingInPeriod.trip_lida);
            totalKm = lastValue - baselineValue;
          } else {
            const baselineValue = parseNumber(baselineReading.hod_lido);
            const lastValue = parseNumber(lastValidReadingInPeriod.hod_lido);
            totalKm = lastValue - baselineValue;
          }
          
          // Ensure non-negative (should not happen with reset detection, but keep as safeguard)
          if (totalKm < 0) {
            console.warn(`Negative km_rodado for vehicle ${veiculoId}: ${totalKm}. Setting to 0.`);
            totalKm = 0;
          }
          
          totalKmRodadoByVehicleId.set(veiculoId, totalKm);
          
          // Map veiculo_id to normalized placa
          const veiculo = Array.isArray(baselineReading.veiculo) ? baselineReading.veiculo[0] : baselineReading.veiculo;
          if (veiculo && veiculo.placa) {
            const placaNormalizada = veiculo.placa.trim().toUpperCase();
            vehicleIdToPlaca.set(veiculoId, placaNormalizada);
            
            // Also store in firstReadingsByPlaca for consistency (using baseline after reset)
            if (!firstReadingsByPlaca.has(placaNormalizada)) {
              firstReadingsByPlaca.set(placaNormalizada, {
                firstHodLido: isCiclomotor ? null : parseNumber(baselineReading.hod_lido),
                firstTripLida: isCiclomotor ? parseNumber(baselineReading.trip_lida) : null
              });
            }
          }
        });
      }
      
      // Step 3: Process bomba data and aggregate by normalized placa
      // Maps to aggregate data by vehicle (using placa as key to avoid duplicates)
      const vehicleStatsMap = new Map<string, VehicleFuelStats>();
      const kmVsPriceMap = new Map<string, { km: number; preco: number }>();
      
      let totalLitrosSum = 0;
      let totalGastoSum = 0;
      let validReadingsCount = 0;
      
      bombas.forEach((bomba: any) => {
        const litros = parseNumber(bomba.litro_lido);
        const preco = parseNumber(bomba.preco_lido);
        
        // Skip invalid readings
        if (litros === 0 && preco === 0) return;
        
        const veiculo = Array.isArray(bomba.veiculo) ? bomba.veiculo[0] : bomba.veiculo;
        if (!veiculo || !veiculo.veiculo_id) return;
        
        const veiculoId = veiculo.veiculo_id;
        const placaNormalizada = (veiculo.placa || 'Desconhecida').toUpperCase();
        const marca = veiculo.marca || 'Desconhecida';
        
        // Aggregate by placa (normalized to uppercase) instead of veiculo_id
        if (!vehicleStatsMap.has(placaNormalizada)) {
          // Step 3: Consolidate km_rodado by normalized placa
          // Sum km from all veiculo_ids that share this normalized placa
          let totalKmForPlaca = 0;
          totalKmRodadoByVehicleId.forEach((km, vId) => {
            const placa = vehicleIdToPlaca.get(vId);
            if (placa === placaNormalizada) {
              totalKmForPlaca += km;
            }
          });
          
          vehicleStatsMap.set(placaNormalizada, {
            veiculo_id: veiculoId,
            placa: placaNormalizada,
            marca,
            totalLitros: 0,
            totalGasto: 0,
            totalKm: totalKmForPlaca,
            mediaKmPorLitro: 0,
            abastecimentos: 0
          });
        }
        
        const stats = vehicleStatsMap.get(placaNormalizada)!;
        stats.totalLitros += litros;
        stats.totalGasto += preco;
        stats.abastecimentos += 1;
        
        vehicleStatsMap.set(placaNormalizada, stats);
        
        // Aggregate km vs price by placa (normalized to uppercase)
        const totalKmForPlaca = vehicleStatsMap.get(placaNormalizada)?.totalKm ?? 0;
        if (totalKmForPlaca > 0) {
          const existing = kmVsPriceMap.get(placaNormalizada) || { km: 0, preco: 0 };
          // Only set km once per placa (not per bomba)
          if (existing.km === 0) {
            existing.km = totalKmForPlaca;
          }
          existing.preco += preco;
          kmVsPriceMap.set(placaNormalizada, existing);
        }
        
        // Sum totals
        totalLitrosSum += litros;
        totalGastoSum += preco;
        if (litros > 0) validReadingsCount++;
      });
      
      // Calculate average km per liter for each vehicle
      const vehicleStats = Array.from(vehicleStatsMap.values()).map(stats => ({
        ...stats,
        mediaKmPorLitro: stats.totalLitros > 0 ? stats.totalKm / stats.totalLitros : 0
      }));
      
      // Convert km vs price map to array
      const kmVsPrice = Array.from(kmVsPriceMap.entries()).map(([placa, data]) => ({
        placa,
        km: data.km,
        preco: data.preco
      }));
      
      // Calculate average cost per liter
      const avgCusto = totalLitrosSum > 0 ? totalGastoSum / totalLitrosSum : 0;
      
      setVehicleFuelStats(vehicleStats);
      setKmVsPriceData(kmVsPrice);
      setTotalLitros(totalLitrosSum);
      setTotalGasto(totalGastoSum);
      setAvgCustoPorLitro(avgCusto);
      
    } catch (error) {
      handleSupabaseError(error, 'carregar estatísticas detalhadas de bomba');
    }
  };

  const fetchTodayBombaMinuta = async () => {
    try {
      setConnectionError(false);
      
      const today = new Date().toISOString().split('T')[0];
      const todayEnd = `${today}T23:59:59.999`;
      
      // Fetch today's minutas
      let minutasCount = 0;
      if (moduleAccess.minuta) {
        const { count, error: minutasError } = await supabase
          .from('minuta')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .gte('created_at', today)
          .lte('created_at', todayEnd);
        
        if (!minutasError && count !== null) {
          minutasCount = count;
        }
      }
      
      // Fetch today's bomba
      let bombaCount = 0;
      if (moduleAccess.bomba) {
        const { count, error: bombaError } = await supabase
          .from('bomba_gasolina')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('data', today);
        
        if (!bombaError && count !== null) {
          bombaCount = count;
        }
      }
      
      setTodayBombaMinuta(minutasCount + bombaCount);
      
    } catch (error) {
      handleSupabaseError(error, 'carregar estatísticas de hoje');
    }
  };

  const fetchFilialMinutas = async () => {
    try {
      setConnectionError(false);
      
      // Adjust end date to include the full day (23:59:59.999)
      const endDateFull = dateRange.endDate ? `${dateRange.endDate}T23:59:59.999` : null;
      
      // Fetch minutas grouped by filial
      const { data, error } = await supabase
        .from('minuta')
        .select(`
          id,
          filial_id,
          filial:filial_id ( id, filial )
        `)
        .eq('company_id', companyId)
        .gte('created_at', dateRange.startDate)
        .lte('created_at', endDateFull)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const minutas = data || [];
      
      // Group by filial
      const filialCounts = new Map<string, number>();
      
      minutas.forEach((minuta: any) => {
        const filialName = minuta.filial?.filial || 'Sem Filial';
        filialCounts.set(filialName, (filialCounts.get(filialName) || 0) + 1);
      });
      
      // Convert to array and sort by count
      const filialArray = Array.from(filialCounts.entries())
        .map(([filial, count]) => ({ filial, count }))
        .sort((a, b) => b.count - a.count);
      
      setFilialMinutas(filialArray);
      
    } catch (error) {
      handleSupabaseError(error, 'carregar minutas por filial');
    }
  };

  const fetchDriverMinutas = async () => {
    try {
      setConnectionError(false);
      
      const endDateFull = dateRange.endDate ? `${dateRange.endDate}T23:59:59.999` : null;
      
      // Fetch minutas by driver
      const minutasByDriver = new Map<number, { nome: string; count: number }>();
      
      if (moduleAccess.minuta) {
        const { data: minutasData, error: minutasError } = await supabase
          .from('minuta')
          .select(`
            id,
            motorista_id,
            motorista:motorista_id ( motorista_id, nome )
          `)
          .eq('company_id', companyId)
          .gte('created_at', dateRange.startDate)
          .lte('created_at', endDateFull);
        
        if (!minutasError && minutasData) {
          minutasData.forEach((minuta: any) => {
            if (minuta.motorista_id && minuta.motorista) {
              const motorista = Array.isArray(minuta.motorista) ? minuta.motorista[0] : minuta.motorista;
              const existing = minutasByDriver.get(minuta.motorista_id);
              if (existing) {
                existing.count++;
              } else {
                minutasByDriver.set(minuta.motorista_id, {
                  nome: motorista.nome,
                  count: 1
                });
              }
            }
          });
        }
      }
      
      // Convert to array and sort by count
      const driverArray = Array.from(minutasByDriver.values())
        .map(({ nome, count }) => ({ motorista_id: 0, nome, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20); // Limit to top 20
      
      setDriverMinutaBomba(driverArray);
      
    } catch (error) {
      handleSupabaseError(error, 'carregar minutas por motorista');
    }
  };

  const fetchDriverHodometroBomba = async () => {
    try {
      setConnectionError(false);
      
      const endDateFull = dateRange.endDate ? `${dateRange.endDate}T23:59:59.999` : null;
      
      // Fetch hodometros and bomba by driver
      const readingsByDriver = new Map<number, { nome: string; count: number }>();
      
      // Fetch hodometros by driver
      const { data: hodometrosData, error: hodometrosError } = await supabase
        .from('hodometro')
        .select(`
          id_hodometro,
          motorista_id,
          motorista:motorista_id ( motorista_id, nome )
        `)
        .eq('company_id', companyId)
        .gte('created_at', dateRange.startDate)
        .lte('created_at', endDateFull);
      
      if (!hodometrosError && hodometrosData) {
        hodometrosData.forEach((hodo: any) => {
          if (hodo.motorista_id && hodo.motorista) {
            const motorista = Array.isArray(hodo.motorista) ? hodo.motorista[0] : hodo.motorista;
            const existing = readingsByDriver.get(hodo.motorista_id);
            if (existing) {
              existing.count++;
            } else {
              readingsByDriver.set(hodo.motorista_id, {
                nome: motorista.nome,
                count: 1
              });
            }
          }
        });
      }
      
      // Fetch bomba by driver (using hodometro_id to get motorista)
      if (moduleAccess.bomba) {
        const { data: bombaData, error: bombaError } = await supabase
          .from('bomba_gasolina')
          .select(`
            id,
            hodometro_id,
            hodometro:hodometro_id (
              id_hodometro,
              motorista_id,
              motorista:motorista_id ( motorista_id, nome )
            )
          `)
          .eq('company_id', companyId)
          .gte('data', dateRange.startDate)
          .lte('data', dateRange.endDate);
        
        if (!bombaError && bombaData) {
          bombaData.forEach((bomba: any) => {
            if (bomba.hodometro?.motorista_id && bomba.hodometro?.motorista) {
              const motorista = Array.isArray(bomba.hodometro.motorista) 
                ? bomba.hodometro.motorista[0] 
                : bomba.hodometro.motorista;
              const motoristaId = bomba.hodometro.motorista_id;
              const existing = readingsByDriver.get(motoristaId);
              if (existing) {
                existing.count++;
              } else {
                readingsByDriver.set(motoristaId, {
                  nome: motorista.nome,
                  count: 1
                });
              }
            }
          });
        }
      }
      
      // Convert to array and sort by count
      const driverArray = Array.from(readingsByDriver.values())
        .map(({ nome, count }) => ({ motorista_id: 0, nome, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20); // Limit to top 20
      
      setDriverHodometroBomba(driverArray);
      
    } catch (error) {
      handleSupabaseError(error, 'carregar hodômetro/bomba por motorista');
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
    // Only retry if user has module access
    if (!moduleAccess.hodometros) return;
    
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

  // Show loading spinner while checking module access
  if (moduleLoading) {
    return <LoadingSpinner />;
  }

  // Show access denied state if user doesn't have hodometros module access
  if (!moduleAccess.hodometros) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
        <div className="max-w-lg w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <Lock className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Acesso Restrito
              </h1>
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Módulo Hodômetros não está disponível
            </p>
          </div>
          
          <div className="p-6 space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Sua empresa não possui acesso ao módulo de Hodômetros. Entre em contato com o administrador do sistema para mais informações sobre como habilitar este recurso.
            </p>
            
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Recursos do Módulo Hodômetros:
              </h2>
              <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400 list-disc list-inside">
                <li>Dashboard de quilometragem por período</li>
                <li>Relatórios de leituras por motorista</li>
                <li>Análise de quilometragem por veículo</li>
                <li>Detecção de inconsistências nas leituras</li>
                <li>Gráficos e estatísticas detalhadas</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show loading spinner while fetching data (only for users with access)
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
      {/* Period Filter */}
      <div className="flex flex-wrap gap-3 items-center mb-6">
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
              data-testid="input-custom-start-date"
              value={dateRange.startDate}
              onChange={(e) => {
                const newDate = e.target.value;
                if (validateDate(newDate)) {
                  setDateRange({ ...dateRange, startDate: e.target.value });
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
              data-testid="input-custom-end-date"
              value={dateRange.endDate}
              onChange={(e) => {
                const newDate = e.target.value;
                if (validateDate(newDate)) {
                  setDateRange({ ...dateRange, endDate: e.target.value });
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
        {moduleAccess.bomba && (
          <>
            <StatCard
              title="Total de leituras de abastecimentos"
              value={totalBomba + totalMinutas}
              icon={Fuel}
              color="purple"
            />
            <StatCard
              title="Total de leituras de minutas"
              value={todayBombaMinuta}
              icon={ClipboardList}
              color="amber"
            />
          </>
        )}
      </div>

      {/* Minuta Stats - Only visible with minuta access */}
      {moduleAccess.minuta && (
        <div className={`grid grid-cols-1 ${!moduleAccess.bomba ? 'md:grid-cols-2' : ''} gap-6`}>
          <StatCard
            title="Média Diária de Minutas"
            value={Math.round(avgMinutasPerDay * 10) / 10}
            icon={ClipboardList}
            color="blue"
          />
          {!moduleAccess.bomba && (
            <StatCard
              title="Média por Motorista"
              value={Math.round(avgMinutasPerDriver * 10) / 10}
              icon={UserCheck}
              color="green"
            />
          )}
        </div>
      )}

      {/* Bomba Dashboard Section - Only visible with bomba access */}
      {moduleAccess.bomba && (
        <>
          {/* Bomba Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard
              title="Litros totais abastecidos"
              value={Math.round(totalLitros * 10) / 10}
              icon={Activity}
              color="green"
              unit="L"
              data-testid="stat-litros-totais"
            />
            <StatCard
              title="Gastos totais com abastecimento"
              value={Math.round(totalGasto * 100) / 100}
              icon={AlertCircle}
              color="amber"
              data-testid="stat-gasto-total"
            />
            <StatCard
              title="Custo Médio/Litro (R$)"
              value={totalLitros > 0 ? Math.round(avgCustoPorLitro * 100) / 100 : 0}
              icon={Gauge}
              color="purple"
              data-testid="stat-custo-medio-litro"
            />
          </div>

          {/* Consumo Médio Chart (Bar Chart) */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
            <div className="mb-6 flex items-center gap-2">
              <BarChart2 className="text-blue-500" size={20} />
              <h3 className="text-lg font-bold text-black dark:text-white">Média de Consumo por Veículo (km/L)</h3>
            </div>
            
            {vehicleFuelStats.length > 0 ? (
              <div className="overflow-x-auto">
                <div className="min-w-[600px] h-[300px] flex items-end justify-center gap-3 p-4">
                  {vehicleFuelStats
                    .sort((a, b) => b.mediaKmPorLitro - a.mediaKmPorLitro)
                    .map((stats, index) => {
                      // Set Y-axis to 20, but increase if any value exceeds it
                      const actualMaxValue = Math.max(...vehicleFuelStats.map(s => s.mediaKmPorLitro), 1);
                      const maxMedia = Math.max(actualMaxValue, 20);
                      const heightPercent = (stats.mediaKmPorLitro / maxMedia) * 100;
                      
                      return (
                        <div 
                          key={stats.placa} 
                          className="flex flex-col items-center gap-2"
                          style={{ width: '80px' }}
                          data-testid={`bar-vehicle-${stats.placa}`}
                        >
                          <div className="w-full flex flex-col items-center gap-1">
                            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                              {stats.mediaKmPorLitro > 0 ? stats.mediaKmPorLitro.toFixed(2) : '0'}
                            </span>
                            <div 
                              className="w-full bg-gradient-to-t from-purple-500 to-purple-400 dark:from-purple-600 dark:to-purple-500 rounded-t-lg transition-all duration-500 hover:opacity-80 relative group"
                              style={{ 
                                height: `${Math.max(10, heightPercent)}%`,
                                minHeight: '20px'
                              }}
                            >
                              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                {stats.placa}: {stats.mediaKmPorLitro.toFixed(2)} km/L
                              </div>
                            </div>
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-bold text-gray-900 dark:text-white uppercase">
                              {stats.placa}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-60 bg-gray-50 dark:bg-gray-700 rounded-2xl shadow">
                <BarChart2 className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-4" />
                <p className="text-gray-400">Nenhum dado disponível para o período selecionado</p>
              </div>
            )}
          </div>

          {/* Custo por Litro Table */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
            <div className="mb-6 flex items-center gap-2">
              <FileBarChart className="text-purple-500" size={20} />
              <h3 className="text-lg font-bold text-black dark:text-white">Custo por Litro por Veículo</h3>
            </div>
            
            {vehicleFuelStats.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="table-custo-por-litro">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Placa</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Marca</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Abast.</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Litros</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Gasto (R$)</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">KM</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Média (km/L)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicleFuelStats
                      .sort((a, b) => b.mediaKmPorLitro - a.mediaKmPorLitro)
                      .map((stats, index) => (
                        <tr 
                          key={stats.placa} 
                          className={`border-b border-gray-100 dark:border-gray-700 ${index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-900/50' : 'bg-white dark:bg-gray-800'}`}
                          data-testid={`row-vehicle-${stats.placa}`}
                        >
                          <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100 font-medium">{stats.placa}</td>
                          <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{stats.marca}</td>
                          <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100 text-right">{stats.abastecimentos}</td>
                          <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100 text-right">{stats.totalLitros.toFixed(1)} L</td>
                          <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100 text-right">R$ {stats.totalGasto.toFixed(2)}</td>
                          <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100 text-right">
                            {stats.totalKm > 0 ? `${stats.totalKm.toFixed(0)} km` : '-'}
                          </td>
                          <td className="py-3 px-4 text-sm font-semibold text-purple-600 dark:text-purple-400 text-right">
                            {stats.mediaKmPorLitro > 0 ? `${stats.mediaKmPorLitro.toFixed(2)} km/L` : '-'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 bg-gray-50 dark:bg-gray-700 rounded-2xl shadow">
                <FileBarChart className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-4" />
                <p className="text-gray-400">Nenhum dado disponível para o período selecionado</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Charts Grid - Always visible */}
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
            <div className="flex flex-col items-center justify-center h-60 bg-gray-50 dark:bg-gray-700 rounded-2xl shadow">
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
            <div className="flex flex-col items-center justify-center h-60 bg-gray-50 dark:bg-gray-700 rounded-2xl shadow">
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
              {vehicleMileage.map((vehicle) => (
                <div key={vehicle.placa} className="space-y-2">
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
            <div className="flex flex-col items-center justify-center h-60 bg-gray-50 dark:bg-gray-700 rounded-2xl shadow">
              <Truck className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-4" />
              <p className="text-gray-400">Nenhum dado disponível para o período selecionado</p>
            </div>
          )}
        </div>

        {/* Leituras por Motorista Chart with Switch */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-black dark:text-white flex items-center gap-2">
              <FileBarChart className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              Leituras por Motorista
            </h3>
            {moduleAccess.minuta && (
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setShowMinutaBombaView(false)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    !showMinutaBombaView
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Leituras
                </button>
                <button
                  onClick={() => setShowMinutaBombaView(true)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    showMinutaBombaView
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Minuta
                </button>
              </div>
            )}
          </div>
          
          {showMinutaBombaView ? (
            driverMinutaBomba.length > 0 ? (
              <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
                {driverMinutaBomba.map((driver, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-black dark:text-gray-400">
                        {driver.nome}
                      </span>
                      <span className="text-sm font-medium text-black dark:text-white">
                        {driver.count} {driver.count === 1 ? 'leitura' : 'leituras'}
                      </span>
                    </div>
                    <div className="h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${Math.max(
                            5, 
                            (driver.count / Math.max(...driverMinutaBomba.map(d => d.count), 1)) * 100
                          )}%` 
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-60 bg-gray-50 dark:bg-gray-700 rounded-2xl shadow">
                <Fuel className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-4" />
                <p className="text-gray-400">Nenhum dado disponível para o período selecionado</p>
              </div>
            )
          ) : (
            driverHodometroBomba.length > 0 ? (
              <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
                {driverHodometroBomba.map((driver, index) => (
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
                            (driver.count / Math.max(...driverHodometroBomba.map(d => d.count), 1)) * 100
                          )}%` 
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-60 bg-gray-50 dark:bg-gray-700 rounded-2xl shadow">
                <FileBarChart className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-4" />
                <p className="text-gray-400">Nenhum dado disponível para o período selecionado</p>
              </div>
            )
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
          <div className="flex flex-col items-center justify-center h-60 bg-gray-50 dark:bg-gray-700 rounded-2xl">
            <AlertCircle className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-gray-400">Nenhum dado disponível para o período selecionado</p>
          </div>
        )}
      </div>

      {/* Minutas por Filial - Only visible with minuta access */}
      {moduleAccess.minuta && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-black dark:text-white mb-6 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            Minutas por Filial
          </h3>
          
          {filialMinutas.length > 0 ? (
            <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
              {filialMinutas.map((item, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {item.filial}
                    </span>
                    <span className="text-sm font-medium text-black dark:text-white">
                      {item.count} {item.count === 1 ? 'minuta' : 'minutas'}
                    </span>
                  </div>
                  <div className="h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${Math.max(
                          5, 
                          (item.count / Math.max(...filialMinutas.map(m => m.count), 1)) * 100
                        )}%` 
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-60 bg-gray-50 dark:bg-gray-700 rounded-2xl">
              <ClipboardList className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-gray-400">Nenhum dado disponível para o período selecionado</p>
            </div>
          )}
        </div>
      )}

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
              <thead className="bg-gray-50 dark:bg-gray-700">
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
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
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