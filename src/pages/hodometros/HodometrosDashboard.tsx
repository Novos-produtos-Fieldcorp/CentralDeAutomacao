import React, { useState, useEffect, useMemo } from 'react';
import { Gauge, Calendar, TrendingUp, BarChart2, Truck, User, Building2, Clock, AlertCircle } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useDateRange } from '../../hooks/useDateRange';
import PeriodSelector from '../../components/hodometros/PeriodSelector';
import LoadingSpinner from '../../components/LoadingSpinner';
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

interface DashboardStats {
  totalReadings: number;
  todayReadings: number;
  totalKm: number;
  avgKmPerVehicle: number;
  kmByDriver: {
    driver_id: number;
    driver_name: string;
    total_km: number;
  }[];
  kmByVehicle: {
    vehicle_id: number;
    plate: string;
    total_km: number;
    is_electric: boolean;
    battery_level?: number;
  }[];
  kmByClient: {
    client_id: number | null;
    client_name: string;
    total_km: number;
  }[];
  inconsistentReadings: {
    id: number;
    date: string;
    driver_name: string;
    vehicle_plate: string;
    hod_informado: number;
    hod_lido: number;
    difference: number;
  }[];
  electricVehicles: {
    total_vehicles: number;
    total_readings: number;
    avg_battery: number;
    battery_usage: number;
  };
}

const HodometrosDashboard = () => {
  const { companyId } = useCompanyData();
  const [stats, setStats] = useState<DashboardStats>({
    totalReadings: 0,
    todayReadings: 0,
    totalKm: 0,
    avgKmPerVehicle: 0,
    kmByDriver: [],
    kmByVehicle: [],
    kmByClient: [],
    inconsistentReadings: [],
    electricVehicles: {
      total_vehicles: 0,
      total_readings: 0,
      avg_battery: 0,
      battery_usage: 0
    }
  });
  const [loading, setLoading] = useState(true);
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('30days');
  const [vehicleFilter, setVehicleFilter] = useState<'todos' | 'automoveis' | 'ciclomotores'>('todos');

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange, vehicleFilter]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Get all hodometro readings for the period
      const { data: hodometros, error: hodometrosError } = await supabase
        .from('hodometro')
        .select(`
          id_hodometro,
          data,
          hora,
          hod_informado,
          hod_lido,
          km_rodado,
          bateria,
          trip_lida,
          trip_informada,
          motorista_id,
          veiculo_id,
          cliente_id,
          motorista:motorista_id (
            motorista_id,
            nome
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

      if (hodometrosError) throw hodometrosError;

      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];

      // Calculate total readings
      const totalReadings = hodometros?.length || 0;

      // Calculate today's readings
      const todayReadings = hodometros?.filter(h => h.data === today).length || 0;

      // Calculate total KM
      // For regular vehicles: sum of km_rodado
      // For electric vehicles: sum of km_rodado
      const totalKm = hodometros?.reduce((sum, h) => sum + (h.km_rodado || 0), 0) || 0;

      // Get unique vehicles
      const uniqueVehicles = new Set(hodometros?.map(h => h.veiculo_id) || []);
      const vehicleCount = uniqueVehicles.size;

      // Calculate average KM per vehicle
      const avgKmPerVehicle = vehicleCount > 0 ? totalKm / vehicleCount : 0;

      // Calculate KM by driver
      const driverMap = new Map<number, { name: string; totalKm: number }>();
      
      hodometros?.forEach(h => {
        if (!h.motorista_id || !h.motorista) return;
        
        const driverId = h.motorista_id;
        const driverName = h.motorista.nome;
        const km = h.km_rodado || 0;
        
        if (driverMap.has(driverId)) {
          const driver = driverMap.get(driverId)!;
          driver.totalKm += km;
        } else {
          driverMap.set(driverId, { name: driverName, totalKm: km });
        }
      });
      
      const kmByDriver = Array.from(driverMap.entries()).map(([driver_id, data]) => ({
        driver_id,
        driver_name: data.name,
        total_km: data.totalKm
      })).sort((a, b) => b.total_km - a.total_km);

      // Calculate KM by vehicle
      const vehicleMap = new Map<number, { 
        plate: string; 
        totalKm: number; 
        isElectric: boolean;
        batteryLevel?: number;
      }>();
      
      hodometros?.forEach(h => {
        if (!h.veiculo_id || !h.veiculo) return;
        
        const vehicleId = h.veiculo_id;
        const vehiclePlate = h.veiculo.placa.toUpperCase();
        const km = h.km_rodado || 0;
        const isElectric = h.bateria !== null && h.bateria !== undefined;
        
        if (vehicleMap.has(vehicleId)) {
          const vehicle = vehicleMap.get(vehicleId)!;
          vehicle.totalKm += km;
          // Update battery level with the most recent reading
          if (isElectric) {
            vehicle.batteryLevel = h.bateria;
          }
        } else {
          vehicleMap.set(vehicleId, { 
            plate: vehiclePlate, 
            totalKm: km,
            isElectric,
            batteryLevel: isElectric ? h.bateria : undefined
          });
        }
      });
      
      const kmByVehicle = Array.from(vehicleMap.entries()).map(([vehicle_id, data]) => ({
        vehicle_id,
        plate: data.plate,
        total_km: data.totalKm,
        is_electric: data.isElectric,
        battery_level: data.batteryLevel
      })).sort((a, b) => b.total_km - a.total_km);

      // Calculate KM by client
      const clientMap = new Map<number | null, { name: string; totalKm: number }>();
      
      hodometros?.forEach(h => {
        const clientId = h.cliente_id;
        const clientName = h.cliente?.nome || 'Sem cliente';
        const km = h.km_rodado || 0;
        
        const mapKey = clientId || 0; // Use 0 as key for null client_id
        
        if (clientMap.has(mapKey)) {
          const client = clientMap.get(mapKey)!;
          client.totalKm += km;
        } else {
          clientMap.set(mapKey, { name: clientName, totalKm: km });
        }
      });
      
      const kmByClient = Array.from(clientMap.entries()).map(([client_id, data]) => ({
        client_id: client_id === 0 ? null : client_id,
        client_name: data.name,
        total_km: data.totalKm
      })).sort((a, b) => b.total_km - a.total_km);

      // Find inconsistent readings (where hod_informado and hod_lido differ significantly)
      const inconsistentReadings = hodometros?.filter(h => {
        if (h.bateria !== null && h.bateria !== undefined) return false; // Skip electric vehicles
        if (h.hod_informado === null || h.hod_lido === null) return false;
        
        const difference = Math.abs((h.hod_informado || 0) - (h.hod_lido || 0));
        return difference > 100; // Consider readings with difference > 100 km as inconsistent
      }).map(h => ({
        id: h.id_hodometro,
        date: h.data,
        driver_name: h.motorista?.nome || 'Desconhecido',
        vehicle_plate: h.veiculo?.placa.toUpperCase() || 'Desconhecido',
        hod_informado: h.hod_informado || 0,
        hod_lido: h.hod_lido || 0,
        difference: Math.abs((h.hod_informado || 0) - (h.hod_lido || 0))
      })).sort((a, b) => b.difference - a.difference).slice(0, 5);

      // Calculate electric vehicle stats
      const electricVehicles = hodometros?.filter(h => h.bateria !== null && h.bateria !== undefined);
      const uniqueElectricVehicles = new Set(electricVehicles?.map(h => h.veiculo_id) || []);
      
      const avgBattery = electricVehicles?.length 
        ? electricVehicles.reduce((sum, h) => sum + (h.bateria || 0), 0) / electricVehicles.length 
        : 0;
      
      const batteryUsage = electricVehicles?.length 
        ? 100 - avgBattery 
        : 0;

      setStats({
        totalReadings,
        todayReadings,
        totalKm,
        avgKmPerVehicle,
        kmByDriver,
        kmByVehicle,
        kmByClient,
        inconsistentReadings,
        electricVehicles: {
          total_vehicles: uniqueElectricVehicles.size,
          total_readings: electricVehicles?.length || 0,
          avg_battery: avgBattery,
          battery_usage: batteryUsage
        }
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  const filteredVehicles = useMemo(() => {
    if (vehicleFilter === 'todos') return stats.kmByVehicle;
    if (vehicleFilter === 'automoveis') return stats.kmByVehicle.filter(v => !v.is_electric);
    if (vehicleFilter === 'ciclomotores') return stats.kmByVehicle.filter(v => v.is_electric);
    return stats.kmByVehicle;
  }, [stats.kmByVehicle, vehicleFilter]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <PeriodSelector
            periodType={periodType}
            dateRange={dateRange}
            onPeriodChange={updatePeriod}
            onDateRangeChange={setDateRange}
          />
          
          <div className="flex gap-2">
            <button
              onClick={() => setVehicleFilter('todos')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                vehicleFilter === 'todos'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setVehicleFilter('automoveis')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                vehicleFilter === 'automoveis'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              Automóveis
            </button>
            <button
              onClick={() => setVehicleFilter('ciclomotores')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                vehicleFilter === 'ciclomotores'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              Ciclomotores
            </button>
          </div>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="QTD DE LEITURAS REALIZADAS"
          value={stats.totalReadings}
          icon={Gauge}
          color="blue"
        />
        <StatCard
          title="LEITURAS REALIZADAS HOJE"
          value={stats.todayReadings}
          icon={Calendar}
          color="green"
        />
        <StatCard
          title="KM TOTAL RODADO"
          value={`${Math.round(stats.totalKm).toLocaleString('pt-BR')} km`}
          icon={TrendingUp}
          color="purple"
        />
        <StatCard
          title="MÉDIA KM/VEÍCULO"
          value={`${Math.round(stats.avgKmPerVehicle).toLocaleString('pt-BR')} km`}
          icon={BarChart2}
          color="amber"
        />
      </div>

      {/* KM by Driver */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-6">
          <User className="text-purple-500 dark:text-purple-400" size={20} />
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            KM POR MOTORISTA
          </h3>
        </div>
        
        {stats.kmByDriver.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            Nenhum dado disponível para o período selecionado
          </div>
        ) : (
          <div className="space-y-4">
            {stats.kmByDriver.slice(0, 5).map((driver, index) => (
              <div key={driver.driver_id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {driver.driver_name}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {Math.round(driver.total_km).toLocaleString('pt-BR')} km
                  </span>
                </div>
                <div className="h-2 bg-purple-100 dark:bg-purple-900/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-500 dark:bg-purple-400 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.max(
                        5, 
                        (driver.total_km / Math.max(...stats.kmByDriver.map(d => d.total_km), 1)) * 100
                      )}%` 
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* KM by Vehicle */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Truck className="text-blue-500 dark:text-blue-400" size={20} />
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            KM POR VEÍCULO
          </h3>
        </div>
        
        {filteredVehicles.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            Nenhum dado disponível para o período selecionado
          </div>
        ) : (
          <div className="space-y-4">
            {filteredVehicles.slice(0, 5).map((vehicle, index) => (
              <div key={vehicle.vehicle_id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {vehicle.plate}
                    </span>
                    {vehicle.is_electric && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200">
                        Elétrico
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {Math.round(vehicle.total_km).toLocaleString('pt-BR')} km
                  </span>
                </div>
                <div className="h-2 bg-blue-100 dark:bg-blue-900/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.max(
                        5, 
                        (vehicle.total_km / Math.max(...filteredVehicles.map(v => v.total_km), 1)) * 100
                      )}%` 
                    }}
                  />
                </div>
                {vehicle.is_electric && vehicle.battery_level !== undefined && (
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Bateria: {vehicle.battery_level}%</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* KM by Client */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Building2 className="text-green-500 dark:text-green-400" size={20} />
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            KM POR OPERAÇÃO
          </h3>
        </div>
        
        {stats.kmByClient.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            Nenhum dado disponível para o período selecionado
          </div>
        ) : (
          <div className="space-y-4">
            {stats.kmByClient.slice(0, 5).map((client, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {client.client_name}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {Math.round(client.total_km).toLocaleString('pt-BR')} km
                  </span>
                </div>
                <div className="h-2 bg-green-100 dark:bg-green-900/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 dark:bg-green-400 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.max(
                        5, 
                        (client.total_km / Math.max(...stats.kmByClient.map(c => c.total_km), 1)) * 100
                      )}%` 
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inconsistent Readings */}
      {stats.inconsistentReadings.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-6">
            <AlertCircle className="text-amber-500 dark:text-amber-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              LEITURAS INCONSISTENTES
            </h3>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
              {stats.inconsistentReadings.length} total
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    HODÔMETRO LIDO
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    HODÔMETRO INFORMADO
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    MOTORISTA
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    DATA
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {stats.inconsistentReadings.map((reading) => (
                  <tr key={reading.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {reading.hod_lido.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {reading.hod_informado.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {reading.driver_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {reading.date.split('-').reverse().join('/')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Electric Vehicles Section */}
      {stats.electricVehicles.total_vehicles > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-6">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="text-green-500 dark:text-green-400"
            >
              <path d="M14 5h1.5a2.5 2.5 0 0 1 0 5H14" />
              <path d="M9 5h1.5a2.5 2.5 0 0 0 0 5H9" />
              <path d="M5 5v14" />
              <path d="M5 9h14" />
              <path d="M9 5v14" />
              <path d="M14 5v14" />
              <path d="M19 5v14" />
            </svg>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              CICLOMOTORES ELÉTRICOS
            </h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-xl">
              <div className="text-sm text-green-600 dark:text-green-400 mb-1">
                Total de Veículos
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.electricVehicles.total_vehicles}
              </div>
            </div>
            
            <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-xl">
              <div className="text-sm text-green-600 dark:text-green-400 mb-1">
                Total de Registros
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.electricVehicles.total_readings}
              </div>
            </div>
            
            <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-xl">
              <div className="text-sm text-green-600 dark:text-green-400 mb-1">
                Média de Bateria
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {Math.round(stats.electricVehicles.avg_battery)}%
              </div>
            </div>
            
            <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-xl">
              <div className="text-sm text-green-600 dark:text-green-400 mb-1">
                Bateria Utilizada
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {Math.round(stats.electricVehicles.battery_usage)}%
              </div>
            </div>
          </div>
          
          {/* Electric Vehicles List */}
          <div className="mt-6">
            {filteredVehicles.filter(v => v.is_electric).slice(0, 5).map((vehicle, index) => (
              <div key={vehicle.vehicle_id} className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      className="text-green-600 dark:text-green-400"
                    >
                      <path d="M14 5h1.5a2.5 2.5 0 0 1 0 5H14" />
                      <path d="M9 5h1.5a2.5 2.5 0 0 0 0 5H9" />
                      <path d="M5 5v14" />
                      <path d="M5 9h14" />
                      <path d="M9 5v14" />
                      <path d="M14 5v14" />
                      <path d="M19 5v14" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {vehicle.plate}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Bateria: {vehicle.battery_level || 0}%
                    </div>
                  </div>
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {Math.round(vehicle.total_km).toLocaleString('pt-BR')} km
                </div>
              </div>
            ))}
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
  color = 'blue'
}: { 
  title: string;
  value: number | string;
  icon: any;
  color?: 'blue' | 'green' | 'purple' | 'amber';
}) => {
  const colors = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      text: 'text-blue-600 dark:text-blue-400',
      icon: 'text-blue-500 dark:text-blue-400'
    },
    green: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      text: 'text-green-600 dark:text-green-400',
      icon: 'text-green-500 dark:text-green-400'
    },
    purple: {
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      text: 'text-purple-600 dark:text-purple-400',
      icon: 'text-purple-500 dark:text-purple-400'
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      text: 'text-amber-600 dark:text-amber-400',
      icon: 'text-amber-500 dark:text-amber-400'
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex flex-col items-center text-center">
        <div className={`p-3 rounded-full ${colors[color].bg} mb-4`}>
          <Icon className={`w-6 h-6 ${colors[color].icon}`} />
        </div>
        <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          {title}
        </h3>
        <p className={`text-2xl font-bold ${colors[color].text}`}>
          {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
        </p>
      </div>
    </div>
  );
};

export default HodometrosDashboard;