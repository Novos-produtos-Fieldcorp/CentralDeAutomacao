import React, { useState, useEffect } from 'react';
import { 
  BarChart2, Calendar, TrendingUp, Truck, Users, 
  AlertCircle, Activity, FileText, Camera, X, Eye,
  Gauge
} from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { supabase, createFilteredQuery } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useDateRange } from '../../hooks/useDateRange';
import PeriodSelector from '../../components/hodometros/PeriodSelector';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatCPF } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
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

const HodometrosDashboard = () => {
  const { query, companyId } = useAuth();
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
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('30days');
  
  // Inconsistencies table state
  const [hodometros, setHodometros] = useState<HodometroReading[]>([]);
  const [totalInconsistencies, setTotalInconsistencies] = useState(0);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    fetchTodayReadings();
    fetchInconsistencies();
  }, [dateRange, companyId]);

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
      
      // Use the error handling wrapper for better network error handling
      const hodometroQuery = createFilteredQuery('hodometro', companyId);
      const { data: hodometros, error } = await hodometroQuery.select(`
        id_hodometro,
        data,
        hora,
        km_rodado,
        hod_lido,
        hod_informado,
        bateria,
        motorista_id,
        veiculo_id,
        cliente_id,
        motorista:motorista_id (
          motorista_id,
          nome
        ),
        veiculo:veiculo_id (
          veiculo_id,
          placa
        ),
        cliente:cliente_id (
          cliente_id,
          nome
        )
      `).gte('data', dateRange.startDate)
        .lte('data', dateRange.endDate)
        .order('data', { ascending: true });

      if (error) throw error;

      // Process data for daily mileage
      const dailyMileageMap = new Map<string, number>();
      const driverMileageMap = new Map<number, { nome: string; totalKm: number }>();
      const vehicleMileageMap = new Map<number, { placa: string; totalKm: number; lastDate?: string }>();
      const driverReadingsMap = new Map<number, { nome: string; count: number }>();
      const operationMileageMap = new Map<string, number>();
      
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
        
        // Add to operation mileage
        const operationName = hodometro.cliente?.nome || 'Sem cliente';
        operationMileageMap.set(operationName, (operationMileageMap.get(operationName) || 0) + kmValue);
      });
      
      // Convert daily mileage map to array and sort by date
      const dailyMileageArray: DailyMileage[] = Array.from(dailyMileageMap.entries())
        .map(([date, totalKm]) => {
          return {
            date,
            totalKm,
            formattedDate: formatDateBR(date) // Format date as DD/MM/YYYY
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
          return {
            veiculo_id: Number(veiculo_id),
            placa: data.placa,
            totalKm: data.totalKm,
            lastDate: data.lastDate ? formatDateBR(data.lastDate) : undefined // Format date as DD/MM/YYYY
          };
        })
        .sort((a, b) => b.totalKm - a.totalKm);
        
      // Convert driver readings map to array and sort by count (descending)
      const driverReadingsArray: DriverReadings[] = Array.from(driverReadingsMap.entries())
        .map(([motorista_id, data]) => ({
          motorista_id: Number(motorista_id),
          nome: data.nome,
          count: data.count
        }))
        .sort((a, b) => b.count - a.count);
        
      // Convert operation mileage map to array and sort by total km (descending)
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
      setTotalReadings(hodometros?.length || 0);
      
    } catch (error) {
      console.error('Error fetching hodometro data:', error);
      toast.error('Erro ao carregar dados de hodômetro');
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayReadings = async () => {
    try {
      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];
      
      // Use the error handling wrapper for better network error handling
      const hodometroQuery = createFilteredQuery('hodometro', companyId);
      const { data, error, count } = await hodometroQuery.select('id_hodometro', { count: 'exact' })
        .eq('data', today);
      
      if (error) throw error;
      
      setTodayReadings(count || 0);
    } catch (error) {
      console.error('Error fetching today readings:', error);
      toast.error('Erro ao calcular leituras de hoje');
    }
  };

  const fetchInconsistencies = async () => {
    try {
      // Use the error handling wrapper for better network error handling
      const hodometroQuery = createFilteredQuery('hodometro', companyId);
      const { data, error, count } = await hodometroQuery.select(`
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
        .eq('verificacao', false)
        .order('data', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      setHodometros(data || []);
      setTotalInconsistencies(count || 0);
    } catch (error) {
      console.error('Error fetching inconsistencies:', error);
      toast.error('Erro ao carregar inconsistências');
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
    if (num === null || num === undefined) return '-';
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total KM Card */}
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
        
        {/* Average KM Card */}
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
        
        {/* Total Readings Card */}
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
        
        {/* Today's Readings Card */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex flex-col items-center text-center">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl mb-3">
              <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Leituras Realizadas Hoje
            </h3>
            <p className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-purple-400">
              {todayReadings}
            </p>
          </div>
        </div>
      </div>

      {/* KM per Operation Chart */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <Gauge className="w-5 h-5 text-orange-500 dark:text-orange-400" />
          Quilômetros por Operação
        </h3>
        
        {operationMileage.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={operationMileage}
                margin={{ top: 5, right: 30, left: 20, bottom: 70 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis 
                  dataKey="name" 
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
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    borderRadius: '0.5rem',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend />
                <Bar 
                  dataKey="value" 
                  name="Quilômetros Rodados"
                  fill="#F59E0B"
                  radius={[4, 4, 0, 0]}
                >
                  {operationMileage.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={[
                        '#F59E0B', '#EC4899', '#8B5CF6', '#3B82F6', 
                        '#10B981', '#6366F1', '#EF4444', '#14B8A6'
                      ][index % 8]} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-60 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
            <AlertCircle className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Nenhum dado disponível para o período selecionado</p>
          </div>
        )}
      </div>

      {/* Inconsistencies Table */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Inconsistências de Hodômetro
            </h3>
          </div>
          <div className="px-3 py-1 bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200 rounded-full text-sm font-medium">
            {totalInconsistencies} {totalInconsistencies === 1 ? 'inconsistência' : 'inconsistências'}
          </div>
        </div>
        
        {hodometros.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Placa</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hodômetro Informado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hodômetro Lido</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Foto</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {hodometros.map((hodometro) => (
                  <tr key={hodometro.id_hodometro} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {hodometro.motorista?.nome || 'Não informado'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {hodometro.motorista?.cpf ? formatCPF(hodometro.motorista.cpf) : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
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
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {hodometro.bateria !== null && hodometro.bateria !== undefined ? (
                          <span>-</span>
                        ) : (
                          <span>{hodometro.hod_informado !== null ? formatNumber(hodometro.hod_informado) : '-'}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {hodometro.bateria !== null && hodometro.bateria !== undefined ? (
                          <div className="text-sm text-gray-900 dark:text-white">
                            Bateria: {hodometro.bateria}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-900 dark:text-white">
                            {hodometro.hod_lido !== null ? formatNumber(hodometro.hod_lido) : '-'}
                          </div>
                        )}
                        
                        {/* Discrepancy tag */}
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Divergente
                        </span>
                      </div>
                    </td>
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
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
            <Eye className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Nenhuma inconsistência encontrada</p>
          </div>
        )}
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
            <AlertCircle className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
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
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={driverReadings}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis 
                  type="number"
                  tickFormatter={formatNumber}
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
                  formatter={(value: any) => [`${value} leituras`, 'Número de Leituras']}
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    borderRadius: '0.5rem',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend 
                  wrapperStyle={{ bottom: 0 }}
                  formatter={() => 'Número de Leituras'}
                />
                <Bar 
                  dataKey="count" 
                  name="Número de Leituras"
                  fill="#6366F1"
                  radius={[0, 4, 4, 0]}
                >
                  {driverReadings.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={`rgba(99, 102, 241, ${0.9 - (index * 0.7 / Math.max(driverReadings.length, 1))})`} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-60 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
            <AlertCircle className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
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
          <div className="w-full space-y-4">
            {vehicleMileage.map((vehicle, index) => (
              <div key={index} className="relative mb-4">
                <div className="flex justify-between items-center mb-1">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {vehicle.placa}
                  </div>
                  <div className="flex items-center gap-2">
                    {vehicle.lastDate && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {vehicle.lastDate}
                      </span>
                    )}
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatNumber(vehicle.totalKm)} km
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
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
          <div className="flex flex-col items-center justify-center h-60 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
            <AlertCircle className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
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
            <AlertCircle className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Nenhum dado disponível para o período selecionado</p>
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
    </div>
  );
};

export default HodometrosDashboard;