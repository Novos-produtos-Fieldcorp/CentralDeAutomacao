import React, { useState, useEffect, useCallback } from 'react';
import { BarChart2, Calendar, TrendingUp, Truck, Users, Gauge, ArrowUp, ArrowDown, Clock, AlertTriangle } from 'lucide-react';
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
  Cell,
  LineChart,
  Line
} from 'recharts';

interface DailyMileage {
  date: string;
  formattedDate: string;
  totalKm: number;
  vehicleCount: number;
  driverCount: number;
}

interface DriverMileage {
  motorista_id: number;
  nome: string;
  totalKm: number;
  vehicleCount: number;
  readingCount: number;
}

interface VehicleMileage {
  veiculo_id: number;
  placa: string;
  marca: string;
  tipo: string;
  totalKm: number;
  readingCount: number;
  isElectric: boolean;
}

const HodometrosDashboard = () => {
  const { query, companyId } = useCompanyData();
  const [loading, setLoading] = useState(true);
  const [dailyMileage, setDailyMileage] = useState<DailyMileage[]>([]);
  const [driverMileage, setDriverMileage] = useState<DriverMileage[]>([]);
  const [vehicleMileage, setVehicleMileage] = useState<VehicleMileage[]>([]);
  const [totalKm, setTotalKm] = useState(0);
  const [totalVehicles, setTotalVehicles] = useState(0);
  const [totalDrivers, setTotalDrivers] = useState(0);
  const [totalReadings, setTotalReadings] = useState(0);
  const [averageKmPerDay, setAverageKmPerDay] = useState(0);
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('30days');

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch all hodometro readings within the date range
      const { data: hodometros, error } = await supabase
        .from('hodometro')
        .select(`
          id_hodometro,
          data,
          hora,
          hod_lido,
          hod_informado,
          trip_lida,
          trip_informada,
          km_rodado,
          bateria,
          motorista_id,
          veiculo_id,
          motorista:motorista_id (
            motorista_id,
            nome
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
        .order('data', { ascending: true })
        .order('hora', { ascending: true });

      if (error) throw error;

      if (!hodometros || hodometros.length === 0) {
        setDailyMileage([]);
        setDriverMileage([]);
        setVehicleMileage([]);
        setTotalKm(0);
        setTotalVehicles(0);
        setTotalDrivers(0);
        setTotalReadings(0);
        setAverageKmPerDay(0);
        setLoading(false);
        return;
      }

      // Process data for dashboard
      processHodometrosData(hodometros);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Erro ao carregar dados do dashboard');
      setLoading(false);
    }
  }, [dateRange, companyId]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const processHodometrosData = (hodometros: any[]) => {
    // Group by date
    const byDate: Record<string, any[]> = {};
    // Group by motorista
    const byMotorista: Record<number, any[]> = {};
    // Group by veiculo
    const byVeiculo: Record<number, any[]> = {};
    
    // First, group all readings
    hodometros.forEach(hodometro => {
      // Group by date
      const date = hodometro.data;
      if (!byDate[date]) {
        byDate[date] = [];
      }
      byDate[date].push(hodometro);
      
      // Group by motorista
      const motoristaId = hodometro.motorista_id;
      if (!byMotorista[motoristaId]) {
        byMotorista[motoristaId] = [];
      }
      byMotorista[motoristaId].push(hodometro);
      
      // Group by veiculo
      const veiculoId = hodometro.veiculo_id;
      if (!byVeiculo[veiculoId]) {
        byVeiculo[veiculoId] = [];
      }
      byVeiculo[veiculoId].push(hodometro);
    });
    
    // Process daily mileage
    const dailyMileageData: DailyMileage[] = [];
    let totalKmAll = 0;
    
    Object.entries(byDate).forEach(([date, readings]) => {
      // Group by motorista and veiculo for this date
      const byMotoristaVeiculo: Record<string, any[]> = {};
      
      readings.forEach(reading => {
        const key = `${reading.motorista_id}_${reading.veiculo_id}`;
        if (!byMotoristaVeiculo[key]) {
          byMotoristaVeiculo[key] = [];
        }
        byMotoristaVeiculo[key].push(reading);
      });
      
      // Calculate KM for each motorista-veiculo pair on this date
      let dailyTotalKm = 0;
      const uniqueDrivers = new Set<number>();
      const uniqueVehicles = new Set<number>();
      
      Object.entries(byMotoristaVeiculo).forEach(([key, dailyReadings]) => {
        const [motoristaId, veiculoId] = key.split('_').map(Number);
        uniqueDrivers.add(motoristaId);
        uniqueVehicles.add(veiculoId);
        
        // Sort by time
        dailyReadings.sort((a, b) => {
          const timeA = new Date(`${a.data}T${a.hora}`);
          const timeB = new Date(`${b.data}T${b.hora}`);
          return timeA.getTime() - timeB.getTime();
        });
        
        // Get first and last reading
        const firstReading = dailyReadings[0];
        const lastReading = dailyReadings[dailyReadings.length - 1];
        
        // Check if it's an electric vehicle (has battery readings)
        const isElectric = firstReading.bateria !== null && firstReading.bateria !== undefined;
        
        let kmForPair = 0;
        
        if (isElectric) {
          // For electric vehicles, use trip_lida difference or sum of km_rodado
          if (firstReading.trip_lida !== null && lastReading.trip_lida !== null) {
            // Use trip_lida difference
            kmForPair = Math.max(0, lastReading.trip_lida - firstReading.trip_lida);
          } else {
            // Use sum of km_rodado as fallback
            kmForPair = dailyReadings.reduce((sum, r) => sum + (r.km_rodado || 0), 0);
          }
        } else {
          // For regular vehicles, use hod_lido difference
          if (firstReading.hod_lido !== null && lastReading.hod_lido !== null) {
            kmForPair = Math.max(0, lastReading.hod_lido - firstReading.hod_lido);
          } else {
            // Use sum of km_rodado as fallback
            kmForPair = dailyReadings.reduce((sum, r) => sum + (r.km_rodado || 0), 0);
          }
        }
        
        dailyTotalKm += kmForPair;
      });
      
      // Format date for display
      const [year, month, day] = date.split('-');
      const formattedDate = `${day}/${month}/${year}`;
      
      dailyMileageData.push({
        date,
        formattedDate,
        totalKm: dailyTotalKm,
        vehicleCount: uniqueVehicles.size,
        driverCount: uniqueDrivers.size
      });
      
      totalKmAll += dailyTotalKm;
    });
    
    // Sort by date (newest first for display)
    dailyMileageData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Process driver mileage
    const driverMileageData: DriverMileage[] = [];
    
    Object.entries(byMotorista).forEach(([motoristaIdStr, readings]) => {
      const motoristaId = parseInt(motoristaIdStr);
      const motoristaNome = readings[0]?.motorista?.nome || 'Desconhecido';
      
      // Group by veiculo for this motorista
      const byVeiculoForMotorista: Record<number, any[]> = {};
      
      readings.forEach(reading => {
        const veiculoId = reading.veiculo_id;
        if (!byVeiculoForMotorista[veiculoId]) {
          byVeiculoForMotorista[veiculoId] = [];
        }
        byVeiculoForMotorista[veiculoId].push(reading);
      });
      
      // Calculate KM for each vehicle this driver used
      let totalKmForDriver = 0;
      
      Object.entries(byVeiculoForMotorista).forEach(([veiculoId, veiculoReadings]) => {
        // Group by date
        const byDateForVeiculo: Record<string, any[]> = {};
        
        veiculoReadings.forEach(reading => {
          const date = reading.data;
          if (!byDateForVeiculo[date]) {
            byDateForVeiculo[date] = [];
          }
          byDateForVeiculo[date].push(reading);
        });
        
        // Calculate KM for each date
        Object.entries(byDateForVeiculo).forEach(([date, dateReadings]) => {
          // Sort by time
          dateReadings.sort((a, b) => {
            const timeA = new Date(`${a.data}T${a.hora}`);
            const timeB = new Date(`${b.data}T${b.hora}`);
            return timeA.getTime() - timeB.getTime();
          });
          
          // Get first and last reading
          const firstReading = dateReadings[0];
          const lastReading = dateReadings[dateReadings.length - 1];
          
          // Check if it's an electric vehicle (has battery readings)
          const isElectric = firstReading.bateria !== null && firstReading.bateria !== undefined;
          
          let kmForDay = 0;
          
          if (isElectric) {
            // For electric vehicles, use trip_lida difference or sum of km_rodado
            if (firstReading.trip_lida !== null && lastReading.trip_lida !== null) {
              // Use trip_lida difference
              kmForDay = Math.max(0, lastReading.trip_lida - firstReading.trip_lida);
            } else {
              // Use sum of km_rodado as fallback
              kmForDay = dateReadings.reduce((sum, r) => sum + (r.km_rodado || 0), 0);
            }
          } else {
            // For regular vehicles, use hod_lido difference
            if (firstReading.hod_lido !== null && lastReading.hod_lido !== null) {
              kmForDay = Math.max(0, lastReading.hod_lido - firstReading.hod_lido);
            } else {
              // Use sum of km_rodado as fallback
              kmForDay = dateReadings.reduce((sum, r) => sum + (r.km_rodado || 0), 0);
            }
          }
          
          totalKmForDriver += kmForDay;
        });
      });
      
      driverMileageData.push({
        motorista_id: motoristaId,
        nome: motoristaNome,
        totalKm: totalKmForDriver,
        vehicleCount: Object.keys(byVeiculoForMotorista).length,
        readingCount: readings.length
      });
    });
    
    // Sort by total KM (highest first)
    driverMileageData.sort((a, b) => b.totalKm - a.totalKm);
    
    // Process vehicle mileage
    const vehicleMileageData: VehicleMileage[] = [];
    
    Object.entries(byVeiculo).forEach(([veiculoIdStr, readings]) => {
      const veiculoId = parseInt(veiculoIdStr);
      const veiculoPlaca = readings[0]?.veiculo?.placa?.toUpperCase() || 'Desconhecido';
      const veiculoMarca = readings[0]?.veiculo?.marca || '';
      const veiculoTipo = readings[0]?.veiculo?.tipo || '';
      
      // Check if it's an electric vehicle
      const isElectric = readings[0]?.bateria !== null && readings[0]?.bateria !== undefined;
      
      // Group by date
      const byDateForVeiculo: Record<string, any[]> = {};
      
      readings.forEach(reading => {
        const date = reading.data;
        if (!byDateForVeiculo[date]) {
          byDateForVeiculo[date] = [];
        }
        byDateForVeiculo[date].push(reading);
      });
      
      // Calculate KM for each date
      let totalKmForVehicle = 0;
      
      Object.entries(byDateForVeiculo).forEach(([date, dateReadings]) => {
        // Sort by time
        dateReadings.sort((a, b) => {
          const timeA = new Date(`${a.data}T${a.hora}`);
          const timeB = new Date(`${b.data}T${b.hora}`);
          return timeA.getTime() - timeB.getTime();
        });
        
        // Get first and last reading
        const firstReading = dateReadings[0];
        const lastReading = dateReadings[dateReadings.length - 1];
        
        let kmForDay = 0;
        
        if (isElectric) {
          // For electric vehicles, use trip_lida difference or sum of km_rodado
          if (firstReading.trip_lida !== null && lastReading.trip_lida !== null) {
            // Use trip_lida difference
            kmForDay = Math.max(0, lastReading.trip_lida - firstReading.trip_lida);
          } else {
            // Use sum of km_rodado as fallback
            kmForDay = dateReadings.reduce((sum, r) => sum + (r.km_rodado || 0), 0);
          }
        } else {
          // For regular vehicles, use hod_lido difference
          if (firstReading.hod_lido !== null && lastReading.hod_lido !== null) {
            kmForDay = Math.max(0, lastReading.hod_lido - firstReading.hod_lido);
          } else {
            // Use sum of km_rodado as fallback
            kmForDay = dateReadings.reduce((sum, r) => sum + (r.km_rodado || 0), 0);
          }
        }
        
        totalKmForVehicle += kmForDay;
      });
      
      vehicleMileageData.push({
        veiculo_id: veiculoId,
        placa: veiculoPlaca,
        marca: veiculoMarca,
        tipo: veiculoTipo,
        totalKm: totalKmForVehicle,
        readingCount: readings.length,
        isElectric
      });
    });
    
    // Sort by total KM (highest first)
    vehicleMileageData.sort((a, b) => b.totalKm - a.totalKm);
    
    // Calculate summary statistics
    const uniqueVehicles = new Set(hodometros.map(h => h.veiculo_id));
    const uniqueDrivers = new Set(hodometros.map(h => h.motorista_id));
    const totalDays = Object.keys(byDate).length;
    
    setDailyMileage(dailyMileageData);
    setDriverMileage(driverMileageData);
    setVehicleMileage(vehicleMileageData);
    setTotalKm(totalKmAll);
    setTotalVehicles(uniqueVehicles.size);
    setTotalDrivers(uniqueDrivers.size);
    setTotalReadings(hodometros.length);
    setAverageKmPerDay(totalDays > 0 ? totalKmAll / totalDays : 0);
    
    setLoading(false);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <PeriodSelector
          periodType={periodType}
          dateRange={dateRange}
          onPeriodChange={updatePeriod}
          onDateRangeChange={setDateRange}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Rodado</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {totalKm.toLocaleString('pt-BR')} km
                </h3>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Truck className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Veículos Ativos</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {totalVehicles}
                </h3>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Motoristas Ativos</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {totalDrivers}
                </h3>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <Gauge className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Média Diária</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {averageKmPerDay.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km
                </h3>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Mileage Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-6">
            <Calendar className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Quilometragem Diária
            </h3>
          </div>
          
          <div className="h-80">
            {dailyMileage.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dailyMileage.slice(0, 14).reverse()} // Show last 14 days in chronological order
                  margin={{ top: 10, right: 30, left: 20, bottom: 70 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                  <XAxis 
                    dataKey="formattedDate" 
                    angle={-45} 
                    textAnchor="end" 
                    height={70} 
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
                    dataKey="totalKm" 
                    name="Quilômetros Rodados"
                    fill="#3B82F6" 
                    radius={[4, 4, 0, 0]}
                  >
                    {dailyMileage.slice(0, 14).reverse().map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={`rgba(59, 130, 246, ${0.5 + (index * 0.03)})`} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-gray-500 dark:text-gray-400">Nenhum dado disponível para o período selecionado</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Drivers Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-6">
            <Users className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Top Motoristas por Quilometragem
            </h3>
          </div>
          
          <div className="h-80">
            {driverMileage.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={driverMileage.slice(0, 10)} // Show top 10 drivers
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 100, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                  <XAxis 
                    type="number"
                    tickFormatter={(value) => `${value.toLocaleString('pt-BR')}`}
                    stroke="#9CA3AF"
                  />
                  <YAxis 
                    type="category"
                    dataKey="nome" 
                    tick={{ fontSize: 12 }}
                    width={100}
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
                    dataKey="totalKm" 
                    name="Quilômetros Rodados"
                    fill="#8B5CF6" 
                    radius={[0, 4, 4, 0]}
                  >
                    {driverMileage.slice(0, 10).map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={`rgba(139, 92, 246, ${0.5 + (index * 0.05)})`} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-gray-500 dark:text-gray-400">Nenhum dado disponível para o período selecionado</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Mileage Table */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-6">
            <Calendar className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Quilometragem por Dia
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    KM Rodados
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Veículos
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Motoristas
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {dailyMileage.slice(0, 10).map((day, index) => (
                  <tr key={day.date} className={index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700/50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {day.formattedDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-blue-600 dark:text-blue-400">
                      {day.totalKm.toLocaleString('pt-BR')} km
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-400">
                      {day.vehicleCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-400">
                      {day.driverCount}
                    </td>
                  </tr>
                ))}
                {dailyMileage.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      Nenhum dado disponível para o período selecionado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Vehicles Table */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-6">
            <Truck className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Top Veículos por Quilometragem
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Veículo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    KM Rodados
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Leituras
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {vehicleMileage.slice(0, 10).map((vehicle, index) => (
                  <tr key={vehicle.veiculo_id} className={index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700/50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {vehicle.placa}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {vehicle.isElectric ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                          Elétrico
                        </span>
                      ) : (
                        `${vehicle.marca} ${vehicle.tipo}`
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-blue-600 dark:text-blue-400">
                      {vehicle.totalKm.toLocaleString('pt-BR')} km
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-400">
                      {vehicle.readingCount}
                    </td>
                  </tr>
                ))}
                {vehicleMileage.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      Nenhum dado disponível para o período selecionado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Additional Insights */}
      {dailyMileage.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-6">
            <AlertTriangle className="text-amber-500 dark:text-amber-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Insights e Recomendações
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Average KM per Vehicle */}
            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  Média por Veículo
                </h4>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {totalVehicles > 0 
                  ? (totalKm / totalVehicles).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
                  : 0} km
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Média de quilometragem por veículo no período
              </p>
            </div>
            
            {/* Average KM per Driver */}
            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  Média por Motorista
                </h4>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {totalDrivers > 0 
                  ? (totalKm / totalDrivers).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
                  : 0} km
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Média de quilometragem por motorista no período
              </p>
            </div>
            
            {/* Readings per Day */}
            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  Leituras por Dia
                </h4>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {dailyMileage.length > 0 
                  ? (totalReadings / dailyMileage.length).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
                  : 0}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Média de leituras registradas por dia
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HodometrosDashboard;