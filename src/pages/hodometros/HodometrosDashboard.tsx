import React, { useState, useEffect, useMemo } from 'react';
import { BarChart2, Calendar, TrendingUp, Truck, Users, AlertTriangle, Activity, FileText } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useDateRange } from '../../hooks/useDateRange';
import PeriodSelector from '../../components/hodometros/PeriodSelector';
import LoadingSpinner from '../../components/LoadingSpinner';
import DailyMileageTotal from '../../components/hodometros/DailyMileageTotal';
import ReadingsPerDriverChart from '../../components/hodometros/ReadingsPerDriverChart';
import VehicleMileageChart from '../../components/hodometros/VehicleMileageChart';
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

const HodometrosDashboard = () => {
  const { query, companyId } = useCompanyData();
  const [loading, setLoading] = useState(true);
  const [dailyMileage, setDailyMileage] = useState<DailyMileage[]>([]);
  const [driverMileage, setDriverMileage] = useState<DriverMileage[]>([]);
  const [vehicleMileage, setVehicleMileage] = useState<VehicleMileage[]>([]);
  const [driverReadings, setDriverReadings] = useState<DriverReadings[]>([]);
  const [totalKm, setTotalKm] = useState(0);
  const [averageKmPerDay, setAverageKmPerDay] = useState(0);
  const [totalReadings, setTotalReadings] = useState(0);
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('30days');

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch all hodometro readings within the date range
      const { data: hodometros, error } = await supabase
        .from('hodometro')
        .select(`
          id_hodometro,
          data,
          hora,
          km_rodado,
          hod_lido,
          hod_informado,
          bateria,
          motorista_id,
          veiculo_id,
          motorista:motorista_id (
            motorista_id,
            nome
          ),
          veiculo:veiculo_id (
            veiculo_id,
            placa
          )
        `)
        .eq('company_id', companyId)
        .gte('data', dateRange.startDate)
        .lte('data', dateRange.endDate)
        .order('data', { ascending: true });

      if (error) throw error;

      // Process data for daily mileage
      const dailyMileageMap = new Map<string, number>();
      const driverMileageMap = new Map<number, { nome: string; totalKm: number }>();
      const vehicleMileageMap = new Map<number, { placa: string; totalKm: number; lastDate?: string }>();
      const driverReadingsMap = new Map<number, { nome: string; count: number }>();
      
      let totalKilometers = 0;
      
      // Process each reading
      hodometros?.forEach(hodometro => {
        // Use km_rodado as the primary source of mileage data
        const kmValue = hodometro.km_rodado || 0;
        
        // Skip invalid or zero values
        if (kmValue <= 0) return;
        
        // Add to total kilometers
        totalKilometers += kmValue;
        
        // Add to daily mileage
        const dateKey = hodometro.data;
        dailyMileageMap.set(dateKey, (dailyMileageMap.get(dateKey) || 0) + kmValue);
        
        // Add to driver mileage
        if (hodometro.motorista_id && hodometro.motorista) {
          const driverId = hodometro.motorista_id;
          const driverName = hodometro.motorista.nome;
          
          if (!driverMileageMap.has(driverId)) {
            driverMileageMap.set(driverId, { nome: driverName, totalKm: 0 });
          }
          
          const driverData = driverMileageMap.get(driverId)!;
          driverData.totalKm += kmValue;
          driverMileageMap.set(driverId, driverData);
          
          // Count readings per driver
          if (!driverReadingsMap.has(driverId)) {
            driverReadingsMap.set(driverId, { nome: driverName, count: 0 });
          }
          
          const driverReadingsData = driverReadingsMap.get(driverId)!;
          driverReadingsData.count += 1;
          driverReadingsMap.set(driverId, driverReadingsData);
        }
        
        // Add to vehicle mileage
        if (hodometro.veiculo_id && hodometro.veiculo) {
          const vehicleId = hodometro.veiculo_id;
          const vehiclePlate = hodometro.veiculo.placa.toUpperCase();
          
          if (!vehicleMileageMap.has(vehicleId)) {
            vehicleMileageMap.set(vehicleId, { 
              placa: vehiclePlate, 
              totalKm: 0,
              lastDate: hodometro.data
            });
          }
          
          const vehicleData = vehicleMileageMap.get(vehicleId)!;
          vehicleData.totalKm += kmValue;
          
          // Update last date if this reading is more recent
          const currentDate = new Date(hodometro.data);
          const existingDate = vehicleData.lastDate ? new Date(vehicleData.lastDate) : null;
          
          if (!existingDate || currentDate > existingDate) {
            vehicleData.lastDate = hodometro.data;
          }
          
          vehicleMileageMap.set(vehicleId, vehicleData);
        }
      });
      
      // Convert daily mileage map to array and sort by date
      const dailyMileageArray: DailyMileage[] = Array.from(dailyMileageMap.entries())
        .map(([date, totalKm]) => {
          // Format date for display (DD/MM/YYYY)
          const [year, month, day] = date.split('-');
          const formattedDate = `${day}/${month}/${year}`;
          
          return {
            date,
            totalKm,
            formattedDate
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date));
      
      // Convert driver mileage map to array and sort by total km (descending)
      const driverMileageArray: DriverMileage[] = Array.from(driverMileageMap.entries())
        .map(([motorista_id, data]) => ({
          motorista_id,
          nome: data.nome,
          totalKm: data.totalKm
        }))
        .sort((a, b) => b.totalKm - a.totalKm);
      
      // Convert vehicle mileage map to array and sort by total km (descending)
      const vehicleMileageArray: VehicleMileage[] = Array.from(vehicleMileageMap.entries())
        .map(([veiculo_id, data]) => {
          // Format the last date
          let formattedLastDate;
          if (data.lastDate) {
            const [year, month, day] = data.lastDate.split('-');
            formattedLastDate = `${day}/${month}/${year}`;
          }
          
          return {
            veiculo_id,
            placa: data.placa,
            totalKm: data.totalKm,
            lastDate: formattedLastDate
          };
        })
        .sort((a, b) => b.totalKm - a.totalKm);
        
      // Convert driver readings map to array and sort by count (descending)
      const driverReadingsArray: DriverReadings[] = Array.from(driverReadingsMap.entries())
        .map(([motorista_id, data]) => ({
          motorista_id,
          nome: data.nome,
          count: data.count
        }))
        .sort((a, b) => b.count - a.count);
      
      // Calculate average km per day
      const uniqueDays = new Set(dailyMileageArray.map(item => item.date)).size;
      const avgKmPerDay = uniqueDays > 0 ? totalKilometers / uniqueDays : 0;
      
      // Update state with processed data
      setDailyMileage(dailyMileageArray);
      setDriverMileage(driverMileageArray);
      setVehicleMileage(vehicleMileageArray);
      setDriverReadings(driverReadingsArray);
      setTotalKm(totalKilometers);
      setAverageKmPerDay(avgKmPerDay);
      setTotalReadings(hodometros?.length || 0);
      
    } catch (error) {
      console.error('Error fetching hodometro data:', error);
      toast.error('Erro ao carregar dados de hodômetro');
    } finally {
      setLoading(false);
    }
  };

  // Format number with dot as thousands separator
  const formatNumber = (num: number): string => {
    return num.toLocaleString('pt-BR');
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex flex-col items-center text-center">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl mb-3">
              <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Total Percorrido</h3>
            <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-indigo-400">
              {formatNumber(totalKm)} km
            </p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex flex-col items-center text-center">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl mb-3">
              <Calendar className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Média Diária</h3>
            <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent dark:from-green-400 dark:to-emerald-400">
              {formatNumber(Math.round(averageKmPerDay))} km
            </p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex flex-col items-center text-center">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl mb-3">
              <Activity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Total de Leituras</h3>
            <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent dark:from-purple-400 dark:to-violet-400">
              {formatNumber(totalReadings)}
            </p>
          </div>
        </div>
      </div>

      {/* Daily Mileage Chart */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-500 dark:text-blue-400" />
          Quilometragem Diária
        </h3>
        
        {dailyMileage.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dailyMileage}
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
                  tickFormatter={(value) => formatNumber(value)}
                  stroke="#9CA3AF"
                />
                <Tooltip 
                  formatter={(value: any) => [formatNumber(value) + ' km', 'Quilômetros']}
                  labelFormatter={(label) => `Data: ${label}`}
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    borderRadius: '0.5rem',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend />
                <Bar 
                  dataKey="totalKm" 
                  name="Quilômetros Rodados"
                  fill="#3B82F6"
                  radius={[4, 4, 0, 0]}
                >
                  {dailyMileage.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={`rgba(59, 130, 246, ${0.5 + (index * 0.5 / dailyMileage.length)})`} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-60 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
            <AlertTriangle className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Nenhum dado disponível para o período selecionado</p>
          </div>
        )}
      </div>

      {/* Readings per Driver Chart */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
          Número de Leituras por Motorista
        </h3>
        
        {driverReadings.length > 0 ? (
          <div className="h-80">
            <ReadingsPerDriverChart data={driverReadings} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-60 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
            <AlertTriangle className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Nenhum dado disponível para o período selecionado</p>
          </div>
        )}
      </div>

      {/* Vehicle Mileage Chart */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <Truck className="w-5 h-5 text-blue-500 dark:text-blue-400" />
          Quilometragem por Veículo
        </h3>
        
        {vehicleMileage.length > 0 ? (
          <div className="h-auto">
            <VehicleMileageChart data={vehicleMileage} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-60 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
            <AlertTriangle className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Nenhum dado disponível para o período selecionado</p>
          </div>
        )}
      </div>

      {/* Drivers and Vehicles Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* All Drivers */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-green-500 dark:text-green-400" />
              Motoristas por Quilometragem
            </h3>
          </div>
          
          {driverMileage.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={driverMileage}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                  <XAxis 
                    type="number"
                    tickFormatter={(value) => formatNumber(value)}
                    stroke="#9CA3AF"
                  />
                  <YAxis 
                    dataKey="nome" 
                    type="category" 
                    width={150}
                    tick={{ fontSize: 12 }}
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
                  <Legend 
                    wrapperStyle={{ bottom: 0 }}
                    formatter={() => 'Quilômetros Rodados'}
                  />
                  <Bar 
                    dataKey="totalKm" 
                    name="Quilômetros Rodados"
                    fill="#10B981"
                    radius={[0, 4, 4, 0]}
                  >
                    {driverMileage.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={`rgba(16, 185, 129, ${0.9 - (index * 0.7 / driverMileage.length)})`} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-60 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
              <Users className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Nenhum dado disponível para o período selecionado</p>
            </div>
          )}
        </div>
        
        {/* All Vehicles */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-purple-500 dark:text-purple-400" />
              Veículos por Quilometragem
            </h3>
          </div>
          
          {vehicleMileage.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={vehicleMileage}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                  <XAxis 
                    type="number"
                    tickFormatter={(value) => formatNumber(value)}
                    stroke="#9CA3AF"
                  />
                  <YAxis 
                    dataKey="placa" 
                    type="category" 
                    width={80}
                    tick={{ fontSize: 12 }}
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
                  <Legend 
                    wrapperStyle={{ bottom: 0 }}
                    formatter={() => 'Quilômetros Rodados'}
                  />
                  <Bar 
                    dataKey="totalKm" 
                    name="Quilômetros Rodados"
                    fill="#8B5CF6"
                    radius={[0, 4, 4, 0]}
                  >
                    {vehicleMileage.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={`rgba(139, 92, 246, ${0.9 - (index * 0.7 / vehicleMileage.length)})`} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-60 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
              <Truck className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Nenhum dado disponível para o período selecionado</p>
            </div>
          )}
        </div>
      </div>

      {/* Daily Mileage Table */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-amber-500 dark:text-amber-400" />
          Quilometragem Diária Detalhada
        </h3>
        
        {dailyMileage.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 rounded-lg overflow-hidden">
              <thead className="bg-amber-50 dark:bg-amber-900/20">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                    Quilômetros Rodados
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {dailyMileage.map((item, index) => (
                  <tr key={index} className="hover:bg-amber-50/50 dark:hover:bg-amber-900/10">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {item.formattedDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-amber-600 dark:text-amber-400">
                      {formatNumber(item.totalKm)} km
                    </td>
                  </tr>
                ))}
                <tr className="bg-amber-50 dark:bg-amber-900/20">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                    Total
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-amber-600 dark:text-amber-400">
                    {formatNumber(totalKm)} km
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
            <AlertTriangle className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Nenhum dado disponível para o período selecionado</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HodometrosDashboard;