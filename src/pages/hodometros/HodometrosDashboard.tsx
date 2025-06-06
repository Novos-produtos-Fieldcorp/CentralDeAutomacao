import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart2, TrendingUp, AlertTriangle, CheckCircle2, 
  Download, Truck, Users, FileCheck, FileX, Store, Battery,
  Calendar, Gauge, XCircle, Clock, BarChart, PieChart, 
  ArrowUp, ArrowDown, Zap, Activity, Camera, X, Filter, Search
} from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import PeriodSelector from '../../components/hodometros/PeriodSelector';
import { useDateRange } from '../../hooks/useDateRange';
import LoadingSpinner from '../../components/LoadingSpinner';

interface DashboardStats {
  totalLeituras: number;
  leiturasHoje: number;
  verificacaoTrue: number;
  verificacaoFalse: number;
  comparacaoTrue: number;
  comparacaoFalse: number;
  kmTotalRodado: number;
  kmMediaPorVeiculo: number;
  kmMediaPorMotorista: number;
  totalVeiculosEletricos: number;
  totalRegistrosCiclomotores: number;
  mediaBateria: number;
  totalBateriaUtilizada: number;
  kmPorVeiculo: {
    placa: string;
    km_total: number;
    data: string;
    is_electric?: boolean;
    bateria?: number | null;
    trip_total?: number;
  }[];
  kmPorMotorista: {
    nome: string;
    km_total: number;
    data: string;
    leituras: number;
    trip_total?: number;
  }[];
  kmPorCliente: {
    nome: string;
    km_total: number;
    data: string;
  }[];
  kmPorOperacao: {
    nome: string;
    km_total: number;
    percentual: number;
  }[];
  leiturasInconsistentes: {
    hod_lido: number;
    hod_informado: number;
    trip_lida?: number | null;
    trip_informada?: string | null;
    nome: string;
    data: string;
    placa: string;
    isElectric: boolean;
    foto_hodometro?: string | null;
    id_hodometro: number;
  }[];
  totalInconsistencias: number;
}

interface VehicleTypeFilter {
  value: string;
  label: string;
}

type VehicleCategory = 'all' | 'automoveis' | 'ciclomotores';

// Interface for a single hodometro reading
interface HodometroReading {
  id_hodometro: number;
  data: string;
  hora: string;
  hod_informado: number | null;
  hod_lido: number | null;
  trip_lida: number | null;
  trip_informada: string | null;
  km_rodado: number | null;
  bateria: number | null;
  motorista_id: number;
  veiculo_id: number;
  cliente_id: number | null;
  timestamp?: number; // Added for sorting
  motorista?: {
    nome: string;
    cpf: string;
  };
  veiculo?: {
    placa: string;
    marca: string;
    tipo: string;
  };
  cliente?: {
    nome: string;
  };
}

// Interface for daily KM calculation result
interface DailyKmResult {
  motorista_id: number;
  veiculo_id: number;
  data: string;
  km_total: number;
  is_electric: boolean;
  motorista_nome?: string;
  veiculo_placa?: string;
  cliente_id?: number | null;
  cliente_nome?: string;
  bateria_final?: number | null;
}

const HodometrosDashboard = () => {
  const { query } = useCompanyData();
  const { companyId } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalLeituras: 0,
    leiturasHoje: 0,
    verificacaoTrue: 0,
    verificacaoFalse: 0,
    comparacaoTrue: 0,
    comparacaoFalse: 0,
    kmTotalRodado: 0,
    kmMediaPorVeiculo: 0,
    kmMediaPorMotorista: 0,
    totalVeiculosEletricos: 0,
    totalRegistrosCiclomotores: 0,
    mediaBateria: 0,
    totalBateriaUtilizada: 0,
    kmPorVeiculo: [],
    kmPorMotorista: [],
    kmPorCliente: [],
    kmPorOperacao: [],
    leiturasInconsistentes: [],
    totalInconsistencias: 0
  });
  const [loading, setLoading] = useState(true);
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('all');
  const [vehicleCategory, setVehicleCategory] = useState<VehicleCategory>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const vehicleTypeOptions: VehicleTypeFilter[] = [
    { value: 'all', label: 'Todos os veículos' },
    { value: 'automoveis', label: 'Automóveis' },
    { value: 'ciclomotores', label: 'Ciclomotores elétricos' }
  ];

  /**
   * Calculate daily KM for a group of hodometro readings
   * For electric vehicles: uses the difference between first and last trip_lida
   * For regular vehicles: uses the difference between first and last hod_lido
   */
  const calculateDailyKm = (readings: HodometroReading[]): number => {
    if (!readings || readings.length === 0) return 0;
    
    // Sort readings by timestamp (earliest first)
    const sortedReadings = [...readings].sort((a, b) => {
      const timeA = a.timestamp || new Date(`${a.data}T${a.hora}`).getTime();
      const timeB = b.timestamp || new Date(`${b.data}T${b.hora}`).getTime();
      return timeA - timeB;
    });
    
    const firstReading = sortedReadings[0];
    const lastReading = sortedReadings[sortedReadings.length - 1];
    
    // Check if it's an electric vehicle
    const isElectric = firstReading.bateria !== null && firstReading.bateria !== undefined;
    
    if (isElectric) {
      // For electric vehicles, calculate the difference between first and last trip_lida
      const firstTripValue = typeof firstReading.trip_lida === 'number' && !isNaN(firstReading.trip_lida) 
        ? firstReading.trip_lida 
        : 0;
        
      const lastTripValue = typeof lastReading.trip_lida === 'number' && !isNaN(lastReading.trip_lida) 
        ? lastReading.trip_lida 
        : 0;
      
      // If we have valid readings, return the difference
      if (lastTripValue >= firstTripValue && firstTripValue > 0) {
        return lastTripValue - firstTripValue;
      }
      
      // Fallback: sum km_rodado values if trip_lida calculation isn't possible
      return sortedReadings.reduce((sum, reading) => {
        const kmValue = typeof reading.km_rodado === 'number' && !isNaN(reading.km_rodado) 
          ? reading.km_rodado 
          : 0;
        return sum + kmValue;
      }, 0);
    } else {
      // For regular vehicles, calculate the difference between first and last hod_lido
      const firstHodValue = typeof firstReading.hod_lido === 'number' && !isNaN(firstReading.hod_lido) 
        ? firstReading.hod_lido 
        : (typeof firstReading.hod_informado === 'number' && !isNaN(firstReading.hod_informado) 
          ? firstReading.hod_informado 
          : 0);
          
      const lastHodValue = typeof lastReading.hod_lido === 'number' && !isNaN(lastReading.hod_lido) 
        ? lastReading.hod_lido 
        : (typeof lastReading.hod_informado === 'number' && !isNaN(lastReading.hod_informado) 
          ? lastReading.hod_informado 
          : 0);
      
      // If we have valid readings, return the difference
      if (lastHodValue >= firstHodValue && firstHodValue > 0) {
        return lastHodValue - firstHodValue;
      }
      
      // Fallback: sum km_rodado values if hodometer calculation isn't possible
      return sortedReadings.reduce((sum, reading) => {
        const kmValue = typeof reading.km_rodado === 'number' && !isNaN(reading.km_rodado) 
          ? reading.km_rodado 
          : 0;
        return sum + kmValue;
      }, 0);
    }
  };

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch all hodometros within date range with related data
      let query = supabase.from('hodometro')
        .select(`
          *,
          motorista:motorista_id (nome),
          veiculo:veiculo_id (placa, marca, tipo),
          cliente:cliente_id (nome)
        `)
        .eq('company_id', companyId);
      
      // Apply date range filter
      if (dateRange.startDate) {
        query = query.gte('data', dateRange.startDate);
      }
      if (dateRange.endDate) {
        query = query.lte('data', dateRange.endDate);
      }
      
      const { data: allHodometros, error } = await query;

      if (error) throw error;

      if (allHodometros) {
        // Filter hodometros based on vehicle category
        let hodometros = allHodometros;
        if (vehicleCategory === 'ciclomotores') {
          hodometros = allHodometros.filter(h => h.bateria !== null && h.bateria !== undefined);
        } else if (vehicleCategory === 'automoveis') {
          hodometros = allHodometros.filter(h => h.bateria === null);
        }
        
        const hoje = new Date().toISOString().split('T')[0];
        
        // Basic stats
        const totalLeituras = hodometros.length;
        const leiturasHoje = hodometros.filter(h => h.data === hoje).length;
        const verificacaoTrue = hodometros.filter(h => h.verificacao).length;
        const verificacaoFalse = hodometros.filter(h => !h.verificacao).length;
        const comparacaoTrue = hodometros.filter(h => h.comparacao_leitura === true).length;
        const comparacaoFalse = hodometros.filter(h => h.comparacao_leitura === false).length;
        
        // Electric vehicles stats
        const electricVehicleReadings = hodometros.filter(h => h.bateria !== null && h.bateria !== undefined);
        const totalVeiculosEletricos = new Set(electricVehicleReadings.map(h => h.veiculo_id)).size;
        const totalRegistrosCiclomotores = electricVehicleReadings.length;
        
        // Calculate average battery level and total battery used
        let mediaBateria = 0;
        let totalBateriaUtilizada = 0;
        
        if (electricVehicleReadings.length > 0) {
          // Calculate average battery level
          let validBatteryReadings = 0;
          let batterySum = 0;
          
          electricVehicleReadings.forEach(reading => {
            if (typeof reading.bateria === 'number' && !isNaN(reading.bateria)) {
              batterySum += reading.bateria;
              validBatteryReadings++;
            }
          });
          
          mediaBateria = validBatteryReadings > 0 ? batterySum / validBatteryReadings : 0;
          
          // Calculate total battery used
          electricVehicleReadings.forEach(reading => {
            if (typeof reading.bateria === 'number' && !isNaN(reading.bateria)) {
              totalBateriaUtilizada += (100 - reading.bateria);
            }
          });
        }

        // Group readings by motorista, date, and vehicle
        const motoristaDateVehicleReadings = new Map<string, Map<string, Map<number, HodometroReading[]>>>();
        
        // First, group all readings by motorista, date, and vehicle
        hodometros.forEach(h => {
          if (!h.motorista_id || !h.data || !h.veiculo_id) return;
          
          const motoristaKey = h.motorista_id.toString();
          const dateKey = h.data;
          const vehicleKey = h.veiculo_id;
          
          // Create motorista map if it doesn't exist
          if (!motoristaDateVehicleReadings.has(motoristaKey)) {
            motoristaDateVehicleReadings.set(motoristaKey, new Map());
          }
          
          // Create date map if it doesn't exist
          const motoristaMap = motoristaDateVehicleReadings.get(motoristaKey)!;
          if (!motoristaMap.has(dateKey)) {
            motoristaMap.set(dateKey, new Map());
          }
          
          // Create vehicle map if it doesn't exist
          const dateMap = motoristaMap.get(dateKey)!;
          if (!dateMap.has(vehicleKey)) {
            dateMap.set(vehicleKey, []);
          }
          
          // Add reading to the list with timestamp for sorting
          const readingWithTimestamp = {
            ...h,
            timestamp: new Date(`${h.data}T${h.hora}`).getTime()
          };
          
          dateMap.get(vehicleKey)!.push(readingWithTimestamp);
        });
        
        // Array to store daily KM calculations
        const dailyKmResults: DailyKmResult[] = [];
        
        // Calculate total KM based on first and last readings for each motorista, date, and vehicle
        let kmTotalRodado = 0;
        
        motoristaDateVehicleReadings.forEach((motoristaMap, motoristaId) => {
          motoristaMap.forEach((dateMap, date) => {
            dateMap.forEach((readings, vehicleId) => {
              // Calculate daily KM for this group of readings
              const dailyKm = calculateDailyKm(readings);
              
              // Add to total
              kmTotalRodado += dailyKm;
              
              // Get additional info for the result
              const isElectric = readings[0].bateria !== null && readings[0].bateria !== undefined;
              
              // Sort readings by timestamp to get the last one for battery level
              const sortedReadings = [...readings].sort((a, b) => 
                (b.timestamp || 0) - (a.timestamp || 0)
              );
              
              // Store the result
              dailyKmResults.push({
                motorista_id: parseInt(motoristaId),
                veiculo_id: vehicleId,
                data: date,
                km_total: dailyKm,
                is_electric: isElectric,
                motorista_nome: readings[0].motorista?.nome,
                veiculo_placa: readings[0].veiculo?.placa,
                cliente_id: readings[0].cliente_id,
                cliente_nome: readings[0].cliente?.nome,
                bateria_final: isElectric ? sortedReadings[0].bateria : null
              });
            });
          });
        });

        // KM por veículo - using daily KM results
        const veiculosMap = new Map<string, {
          km_total: number;
          data: string;
          is_electric: boolean;
          bateria: number | null;
          trip_total: number;
          placa: string;
        }>();
        
        dailyKmResults.forEach(result => {
          if (!result.veiculo_placa) return;
          
          const placa = result.veiculo_placa;
          const current = veiculosMap.get(placa) || {
            km_total: 0,
            data: result.data,
            is_electric: result.is_electric,
            bateria: result.bateria_final,
            trip_total: 0,
            placa
          };
          
          // Add the daily KM to the total
          current.km_total += result.km_total;
          
          // Update the date if this result is more recent
          if (new Date(result.data) > new Date(current.data)) {
            current.data = result.data;
            if (result.is_electric) {
              current.bateria = result.bateria_final;
            }
          }
          
          veiculosMap.set(placa, current);
        });
        
        const kmPorVeiculo = Array.from(veiculosMap.values())
          .map(data => ({
            placa: data.placa,
            km_total: data.km_total,
            data: data.data,
            is_electric: data.is_electric,
            bateria: data.bateria,
            trip_total: data.trip_total
          }))
          .sort((a, b) => b.km_total - a.km_total);

        // KM por motorista - using daily KM results
        const motoristasMap = new Map<string, {
          nome: string;
          km_total: number;
          data: string;
          leituras: number;
          trip_total: number;
        }>();
        
        dailyKmResults.forEach(result => {
          if (!result.motorista_nome) return;
          
          const nome = result.motorista_nome;
          const current = motoristasMap.get(nome) || {
            nome,
            km_total: 0,
            data: result.data,
            leituras: 0,
            trip_total: 0
          };
          
          // Add the daily KM to the total
          current.km_total += result.km_total;
          
          // Count this as one reading (one day)
          current.leituras += 1;
          
          // Update the date if this result is more recent
          if (new Date(result.data) > new Date(current.data)) {
            current.data = result.data;
          }
          
          motoristasMap.set(nome, current);
        });
        
        const kmPorMotorista = Array.from(motoristasMap.values())
          .sort((a, b) => b.leituras - a.leituras);

        // KM por cliente - using daily KM results
        const clientesMap = new Map<string, {
          nome: string;
          km_total: number;
          data: string;
        }>();
        
        // First add "Sem cliente" for readings without a client
        clientesMap.set('Sem cliente', {
          nome: 'Sem cliente',
          km_total: dailyKmResults
            .filter(r => !r.cliente_id)
            .reduce((sum, r) => sum + r.km_total, 0),
          data: new Date().toISOString().split('T')[0]
        });
        
        // Then add KM for each client
        dailyKmResults.forEach(result => {
          if (!result.cliente_nome) return;
          
          const nome = result.cliente_nome;
          const current = clientesMap.get(nome) || {
            nome,
            km_total: 0,
            data: result.data
          };
          
          // Add the daily KM to the total
          current.km_total += result.km_total;
          
          // Update the date if this result is more recent
          if (new Date(result.data) > new Date(current.data)) {
            current.data = result.data;
          }
          
          clientesMap.set(nome, current);
        });
        
        const kmPorCliente = Array.from(clientesMap.values())
          .filter(client => client.km_total > 0) // Only include clients with KM
          .sort((a, b) => b.km_total - a.km_total);

        // KM por operação (agrupado por cliente_id) - using daily KM results
        const operacoesMap = new Map<string, {
          km_total: number;
        }>();
        
        // First, add "Sem operação" for readings without a client
        const semOperacaoKm = dailyKmResults
          .filter(r => !r.cliente_id)
          .reduce((sum, r) => sum + r.km_total, 0);
        
        if (semOperacaoKm > 0) {
          operacoesMap.set('Sem operação', { km_total: semOperacaoKm });
        }
        
        // Then add KM for each client
        dailyKmResults.forEach(result => {
          if (!result.cliente_nome) return;
          
          const nome = result.cliente_nome;
          const current = operacoesMap.get(nome) || { km_total: 0 };
          
          // Add the daily KM to the total
          current.km_total += result.km_total;
          
          operacoesMap.set(nome, current);
        });
        
        // Calculate total for percentages
        const totalKmOperacoes = Array.from(operacoesMap.values())
          .reduce((sum, op) => sum + op.km_total, 0);
        
        // Format operations data with percentages
        const kmPorOperacao = Array.from(operacoesMap.entries())
          .map(([nome, data]) => ({
            nome,
            km_total: data.km_total,
            percentual: totalKmOperacoes > 0 ? (data.km_total / totalKmOperacoes) * 100 : 0
          }))
          .sort((a, b) => b.km_total - a.km_total);

        // Leituras inconsistentes
        const leiturasInconsistentes = hodometros
          .filter(h => {
            // Remove any dots or commas before comparing
            const cleanHodLido = h.hod_lido ? String(h.hod_lido).replace(/[.,]/g, '') : '';
            const cleanHodInformado = h.hod_informado ? String(h.hod_informado).replace(/[.,]/g, '') : '';
            const cleanTripLida = h.trip_lida ? String(h.trip_lida).replace(/[.,]/g, '') : '';
            const cleanTripInformada = h.trip_informada ? String(h.trip_informada).replace(/[.,]/g, '') : '';
            
            // Para automóveis (sem bateria), verificar hod_lido e hod_informado
            if (h.bateria === null) {
              return cleanHodLido !== '' && cleanHodInformado !== '' && cleanHodLido !== cleanHodInformado;
            }
            // Para ciclomotores (com bateria), verificar trip_lida e trip_informada
            else {
              return cleanTripLida !== '' && cleanTripInformada !== '' && cleanTripLida !== cleanTripInformada;
            }
          })
          .map(h => ({
            hod_lido: h.hod_lido || 0,
            hod_informado: h.hod_informado || 0,
            trip_lida: h.trip_lida,
            trip_informada: h.trip_informada,
            nome: h.motorista?.nome || 'Desconhecido',
            data: h.data,
            placa: h.veiculo?.placa?.toUpperCase() || 'Desconhecido',
            isElectric: h.bateria !== null,
            foto_hodometro: h.foto_hodometro,
            id_hodometro: h.id_hodometro
          }))
          .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
          
        const totalInconsistencias = leiturasInconsistentes.length;

        // Count unique vehicles (excluding electric ones if filtering for automobiles only)
        const uniqueVehicles = new Set();
        hodometros.forEach(h => {
          if (h.veiculo?.placa) {
            if (vehicleCategory === 'automoveis' && h.bateria !== null) {
              // Skip electric vehicles when only showing automobiles
              return;
            }
            if (vehicleCategory === 'ciclomotores' && h.bateria === null) {
              // Skip regular vehicles when only showing electric ones
              return;
            }
            uniqueVehicles.add(h.veiculo.placa);
          }
        });
        
        const uniqueVehicleCount = uniqueVehicles.size;
        
        // Calculate KM per vehicle based on the filtered category
        let categoryKmTotal = 0;
        if (vehicleCategory === 'automoveis') {
          // Only regular vehicles
          categoryKmTotal = dailyKmResults
            .filter(r => !r.is_electric)
            .reduce((sum, r) => sum + r.km_total, 0);
        } else if (vehicleCategory === 'ciclomotores') {
          // Only electric vehicles
          categoryKmTotal = dailyKmResults
            .filter(r => r.is_electric)
            .reduce((sum, r) => sum + r.km_total, 0);
        } else {
          // All vehicles
          categoryKmTotal = kmTotalRodado;
        }
        
        // Avoid division by zero
        const kmMediaPorVeiculo = uniqueVehicleCount > 0 ? categoryKmTotal / uniqueVehicleCount : 0;
        
        // Count unique drivers
        const uniqueDrivers = new Set();
        hodometros.forEach(h => {
          if (h.motorista_id) {
            if (vehicleCategory === 'automoveis' && h.bateria !== null) return;
            if (vehicleCategory === 'ciclomotores' && h.bateria === null) return;
            uniqueDrivers.add(h.motorista_id);
          }
        });
        
        const uniqueDriverCount = uniqueDrivers.size;
        // Avoid division by zero
        const kmMediaPorMotorista = uniqueDriverCount > 0 ? categoryKmTotal / uniqueDriverCount : 0;

        setStats({
          totalLeituras,
          leiturasHoje,
          verificacaoTrue,
          verificacaoFalse,
          comparacaoTrue,
          comparacaoFalse,
          kmTotalRodado,
          kmMediaPorVeiculo,
          kmMediaPorMotorista,
          totalVeiculosEletricos,
          totalRegistrosCiclomotores,
          mediaBateria,
          totalBateriaUtilizada,
          kmPorVeiculo,
          kmPorMotorista,
          kmPorCliente,
          kmPorOperacao,
          leiturasInconsistentes: leiturasInconsistentes.slice(0, 5), // Mostrar apenas as 5 mais recentes
          totalInconsistencias
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  }, [dateRange, vehicleCategory, companyId]);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      if (mounted) {
        await fetchDashboardData();
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [fetchDashboardData]);

  const filteredVehicleData = () => {
    if (vehicleCategory === 'all') {
      return stats.kmPorVeiculo;
    } else if (vehicleCategory === 'ciclomotores') {
      return stats.kmPorVeiculo.filter(v => v.is_electric);
    } else {
      return stats.kmPorVeiculo.filter(v => !v.is_electric);
    }
  };

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const filteredInconsistencias = stats.leiturasInconsistentes.filter(item => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      item.nome.toLowerCase().includes(searchLower) ||
      item.placa.toLowerCase().includes(searchLower)
    );
  });

  const handleShowPhoto = (photo: string | null | undefined) => {
    if (photo) {
      setSelectedPhoto(photo);
      setShowPhotoModal(true);
    } else {
      toast.error('Nenhuma foto disponível');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="text-gray-400 w-5 h-5" />
            <div className="text-sm text-gray-600 dark:text-gray-400">Categoria:</div>
            <div className="flex gap-2">
              <button
                onClick={() => setVehicleCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  vehicleCategory === 'all'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setVehicleCategory('automoveis')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  vehicleCategory === 'automoveis'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Automóveis
              </button>
              <button
                onClick={() => setVehicleCategory('ciclomotores')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  vehicleCategory === 'ciclomotores'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Ciclomotores
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2 ml-auto">
            <Calendar className="text-gray-400 w-5 h-5" />
            <PeriodSelector
              periodType={periodType}
              dateRange={dateRange}
              onPeriodChange={updatePeriod}
              onDateRangeChange={setDateRange}
            />
          </div>
        </div>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <StatCard
          title="QTD DE LEITURAS REALIZADAS"
          value={stats.totalLeituras}
          icon={Gauge}
          variant="blue"
        />
        <StatCard
          title="LEITURAS REALIZADAS HOJE"
          value={stats.leiturasHoje}
          icon={Clock}
          variant="green"
        />
        <StatCard
          title="KM TOTAL RODADO"
          value={`${Math.round(stats.kmTotalRodado).toLocaleString('pt-BR')} km`}
          icon={Activity}
          variant="purple"
        />
        <StatCard
          title="MÉDIA KM/VEÍCULO"
          value={`${Math.round(stats.kmMediaPorVeiculo).toLocaleString('pt-BR')} km`}
          icon={TrendingUp}
          variant="amber"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KM por Motorista - MOVED FROM BELOW */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <Users className="text-indigo-500 dark:text-indigo-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              KM POR MOTORISTA
            </h3>
          </div>
          <div className="space-y-4">
            {stats.kmPorMotorista.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-500 dark:text-gray-400">
                  Nenhum dado disponível para o período selecionado
                </p>
              </div>
            ) : (
              stats.kmPorMotorista.slice(0, 5).map((motorista, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {motorista.nome}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {Math.round(motorista.km_total).toLocaleString('pt-BR')} km
                    </span>
                  </div>
                  <div className="h-2.5 bg-indigo-100 dark:bg-indigo-900/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 dark:bg-indigo-400 rounded-full"
                      style={{ width: `${(motorista.km_total / (stats.kmPorMotorista[0]?.km_total || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* KM por Veículo - MOVED FROM BELOW */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <Truck className="text-teal-500 dark:text-teal-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              KM POR VEÍCULO
            </h3>
          </div>
          <div className="space-y-4">
            {filteredVehicleData().length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-500 dark:text-gray-400">
                  Nenhum dado disponível para o período selecionado
                </p>
              </div>
            ) : (
              filteredVehicleData().slice(0, 5).map((veiculo, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {veiculo.placa.toUpperCase()}
                      </span>
                      {veiculo.is_electric && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200">
                          Elétrico
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {Math.round(veiculo.km_total).toLocaleString('pt-BR')} km
                    </span>
                  </div>
                  <div className="h-2.5 bg-teal-100 dark:bg-teal-900/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-teal-500 dark:bg-teal-400 rounded-full"
                      style={{ 
                        width: `${(veiculo.km_total / (filteredVehicleData()[0]?.km_total || 1)) * 100}%` 
                      }}
                    />
                  </div>
                  {veiculo.is_electric && veiculo.bateria !== null && veiculo.bateria !== undefined && (
                    <div className="flex items-center gap-2 mt-1">
                      <Battery className="w-4 h-4 text-green-500" />
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Bateria: {veiculo.bateria}%
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Leituras Inconsistentes - MOVED ABOVE */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-amber-500 dark:text-amber-400" size={20} />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                LEITURAS INCONSISTENTES
              </h3>
              <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                {stats.totalInconsistencias} total
              </span>
            </div>
            
            <div className="relative w-64">
              <input
                type="text"
                placeholder="Buscar por nome ou placa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <Search className="absolute left-2.5 top-1.5 h-4 w-4 text-gray-400" />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            {filteredInconsistencias.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-500 dark:text-gray-400">
                  Nenhuma leitura inconsistente encontrada no período selecionado
                </p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {vehicleCategory === 'ciclomotores' ? 'Trip Lida' : 'Hodômetro Lido'}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {vehicleCategory === 'ciclomotores' ? 'Trip Informada' : 'Hodômetro Informado'}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Motorista
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Placa
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Foto
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredInconsistencias.map((leitura, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                        {leitura.isElectric 
                          ? leitura.trip_lida?.toLocaleString('pt-BR') || '-'
                          : leitura.hod_lido.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                        {leitura.isElectric 
                          ? leitura.trip_informada || '-'
                          : leitura.hod_informado.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                        {leitura.nome}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                        {formatDate(leitura.data)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                        {leitura.placa}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleShowPhoto(leitura.foto_hodometro)}
                          className={`text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 
                                   transition-colors ${!leitura.foto_hodometro && 'opacity-50 cursor-not-allowed'}`}
                          title={leitura.foto_hodometro ? "Ver foto do hodômetro" : "Sem foto disponível"}
                        >
                          <Camera size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* KM por Operação - MOVED FROM ABOVE */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <Store className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              KM POR OPERAÇÃO
            </h3>
          </div>
          <div className="space-y-4">
            {stats.kmPorOperacao.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-500 dark:text-gray-400">
                  Nenhum dado disponível para o período selecionado
                </p>
              </div>
            ) : (
              stats.kmPorOperacao.slice(0, 5).map((item, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {item.nome}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {Math.round(item.km_total).toLocaleString('pt-BR')} km
                    </span>
                  </div>
                  <div className="h-2 bg-blue-100 dark:bg-blue-900/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300"
                      style={{ width: `${item.percentual}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Leituras por Motorista - MOVED FROM ABOVE */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <Users className="text-purple-500 dark:text-purple-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              NÚMERO DE LEITURAS POR MOTORISTA
            </h3>
          </div>
          <div className="space-y-4">
            {stats.kmPorMotorista.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-500 dark:text-gray-400">
                  Nenhum dado disponível para o período selecionado
                </p>
              </div>
            ) : (
              stats.kmPorMotorista.slice(0, 5).map((motorista, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {motorista.nome}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {motorista.leituras} leituras
                    </span>
                  </div>
                  <div className="h-2 bg-purple-100 dark:bg-purple-900/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-500 dark:bg-purple-400 rounded-full"
                      style={{ width: `${(motorista.leituras / Math.max(...stats.kmPorMotorista.map(m => m.leituras), 1)) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Electric Vehicle Stats */}
        {stats.totalVeiculosEletricos > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md lg:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <Zap className="text-green-500 dark:text-green-400" size={20} />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                CICLOMOTORES ELÉTRICOS
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                <div className="text-sm text-green-600 dark:text-green-400 mb-1">Total de Veículos</div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {stats.totalVeiculosEletricos}
                </div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                <div className="text-sm text-green-600 dark:text-green-400 mb-1">Total de Registros</div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {stats.totalRegistrosCiclomotores}
                </div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                <div className="text-sm text-green-600 dark:text-green-400 mb-1">Média de Bateria</div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {Math.round(stats.mediaBateria)}%
                </div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                <div className="text-sm text-green-600 dark:text-green-400 mb-1">Bateria Utilizada</div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {Math.round(stats.totalBateriaUtilizada)}%
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {stats.kmPorVeiculo
                .filter(v => v.is_electric)
                .slice(0, 4)
                .map((veiculo, index) => (
                  <div key={index} className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {veiculo.placa.toUpperCase()}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200">
                        Bateria: {veiculo.bateria}%
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 bg-green-100 dark:bg-green-900/20 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-green-500 dark:bg-green-400 rounded-full"
                          style={{ width: `${(veiculo.bateria || 0)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>KM Total: {Math.round(veiculo.km_total).toLocaleString('pt-BR')} km</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
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
                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
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

const StatCard = ({ 
  title, 
  value, 
  icon: Icon,
  variant = 'blue'
}: { 
  title: string;
  value: string | number;
  icon: any;
  variant?: 'blue' | 'green' | 'purple' | 'amber' | 'teal' | 'indigo';
}) => {
  const variants = {
    'blue': {
      icon: 'text-blue-500 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-100 dark:border-blue-800/30'
    },
    'green': {
      icon: 'text-green-500 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-100 dark:border-green-800/30'
    },
    'purple': {
      icon: 'text-purple-500 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      border: 'border-purple-100 dark:border-purple-800/30'
    },
    'amber': {
      icon: 'text-amber-500 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-100 dark:border-amber-800/30'
    },
    'teal': {
      icon: 'text-teal-500 dark:text-teal-400',
      bg: 'bg-teal-50 dark:bg-teal-900/20',
      border: 'border-teal-100 dark:border-teal-800/30'
    },
    'indigo': {
      icon: 'text-indigo-500 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-900/20',
      border: 'border-indigo-100 dark:border-indigo-800/30'
    }
  };

  const style = variants[variant];

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-md border ${style.border} p-6 transition-all duration-300 hover:shadow-lg`}>
      <div className="flex flex-col items-center text-center">
        <div className={`p-3 rounded-full ${style.bg} mb-4`}>
          <Icon className={`w-6 h-6 ${style.icon}`} />
        </div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">{title}</p>
        <span className="text-3xl font-bold text-gray-900 dark:text-white">
          {value}
        </span>
      </div>
    </div>
  );
};

export default HodometrosDashboard;