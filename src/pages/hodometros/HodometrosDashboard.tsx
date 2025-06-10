import React, { useState, useEffect, useMemo } from 'react';
import { BarChart2, Calendar, TrendingUp, Truck, Users, AlertTriangle, Activity, ChevronDown, Clock, FileText, Camera, X } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useDateRange } from '../../hooks/useDateRange';
import PeriodSelector from '../../components/hodometros/PeriodSelector';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatCPF } from '../../utils/format';
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
}

interface InconsistentReading {
  id_hodometro: number;
  hod_lido: number;
  hod_informado: number;
  motorista: {
    nome: string;
  };
  data: string;
  veiculo: {
    placa: string;
  };
  foto_hodometro: string | null;
}

const HodometrosDashboard = () => {
  const { query, companyId } = useCompanyData();
  const [loading, setLoading] = useState(true);
  const [dailyMileage, setDailyMileage] = useState<DailyMileage[]>([]);
  const [driverMileage, setDriverMileage] = useState<DriverMileage[]>([]);
  const [vehicleMileage, setVehicleMileage] = useState<VehicleMileage[]>([]);
  const [inconsistentReadings, setInconsistentReadings] = useState<InconsistentReading[]>([]);
  const [totalKm, setTotalKm] = useState(0);
  const [averageKmPerDay, setAverageKmPerDay] = useState(0);
  const [totalReadings, setTotalReadings] = useState(0);
  const [todayReadings, setTodayReadings] = useState(0);
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('30days');
  const [topItemsCount, setTopItemsCount] = useState<number>(5);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Get current date in YYYY-MM-DD format for today's readings
      const today = new Date().toISOString().split('T')[0];
      
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
          trip_lida,
          trip_informada,
          motorista_id,
          veiculo_id,
          verificacao,
          comparacao_leitura,
          foto_hodometro,
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
      const vehicleMileageMap = new Map<number, { placa: string; totalKm: number }>();
      const inconsistentReadingsArray: InconsistentReading[] = [];
      
      let totalKilometers = 0;
      let todayReadingsCount = 0;
      
      // Process each reading
      hodometros?.forEach(hodometro => {
        // Use km_rodado as the primary source of mileage data
        const kmValue = hodometro.km_rodado || 0;
        
        // Skip invalid or zero values
        if (kmValue <= 0) return;
        
        // Add to total kilometers
        totalKilometers += kmValue;
        
        // Count today's readings
        if (hodometro.data === today) {
          todayReadingsCount++;
        }
        
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
        }
        
        // Add to vehicle mileage
        if (hodometro.veiculo_id && hodometro.veiculo) {
          const vehicleId = hodometro.veiculo_id;
          const vehiclePlate = hodometro.veiculo.placa;
          
          if (!vehicleMileageMap.has(vehicleId)) {
            vehicleMileageMap.set(vehicleId, { placa: vehiclePlate, totalKm: 0 });
          }
          
          const vehicleData = vehicleMileageMap.get(vehicleId)!;
          vehicleData.totalKm += kmValue;
          vehicleMileageMap.set(vehicleId, vehicleData);
        }

        // Check for inconsistent readings (where verificacao is false)
        if (hodometro.verificacao === false && 
            hodometro.hod_lido !== null && 
            hodometro.hod_informado !== null &&
            hodometro.motorista && 
            hodometro.veiculo) {
          inconsistentReadingsArray.push({
            id_hodometro: hodometro.id_hodometro,
            hod_lido: hodometro.hod_lido,
            hod_informado: hodometro.hod_informado,
            motorista: hodometro.motorista,
            data: hodometro.data,
            veiculo: hodometro.veiculo,
            foto_hodometro: hodometro.foto_hodometro
          });
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
          motorista_id: Number(motorista_id),
          nome: data.nome,
          totalKm: data.totalKm
        }))
        .sort((a, b) => b.totalKm - a.totalKm);
      
      // Convert vehicle mileage map to array and sort by total km (descending)
      const vehicleMileageArray: VehicleMileage[] = Array.from(vehicleMileageMap.entries())
        .map(([veiculo_id, data]) => ({
          veiculo_id: Number(veiculo_id),
          placa: data.placa.toUpperCase(),
          totalKm: data.totalKm
        }))
        .sort((a, b) => b.totalKm - a.totalKm);
      
      // Calculate average km per day
      const uniqueDays = new Set(dailyMileageArray.map(item => item.date)).size;
      const avgKmPerDay = uniqueDays > 0 ? totalKilometers / uniqueDays : 0;
      
      // Update state with processed data
      setDailyMileage(dailyMileageArray);
      setDriverMileage(driverMileageArray);
      setVehicleMileage(vehicleMileageArray);
      setInconsistentReadings(inconsistentReadingsArray);
      setTotalKm(totalKilometers);
      setAverageKmPerDay(avgKmPerDay);
      setTotalReadings(hodometros?.length || 0);
      
      // Get today's readings count directly from the API
      const { data: todayData, error: todayError } = await supabase
        .from('hodometro')
        .select('id_hodometro', { count: 'exact' })
        .eq('company_id', companyId)
        .eq('data', today);
        
      if (todayError) throw todayError;
      
      // Set today's readings count
      setTodayReadings(todayData?.length || 0);
      
    } catch (error) {
      console.error('Error fetching hodometro data:', error);
      toast.error('Erro ao carregar dados de hodômetro');
    } finally {
      setLoading(false);
    }
  };

  // Format number with dot as thousands separator
  const formatNumber = (num: number | null | undefined): string => {
    if (num === null || num === undefined) return '-';
    
    // Convert to string with dots as thousands separators
    return num.toLocaleString('pt-BR');
  };

  // Format date to DD/MM/YYYY
  const formatDate = (dateStr: string): string => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const handleShowPhoto = (photo: string | null) => {
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex flex-col items-center text-center">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl mb-3">
              <TrendingUp className="w-8 h-8 text-blue-600 dark:text-blue-400" />
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
              <Calendar className="w-8 h-8 text-green-600 dark:text-green-400" />
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
              <Activity className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Total de Leituras</h3>
            <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent dark:from-purple-400 dark:to-violet-400">
              {formatNumber(totalReadings)}
            </p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex flex-col items-center text-center">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl mb-3">
              <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Leituras Hoje</h3>
            <p className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent dark:from-amber-400 dark:to-orange-400">
              {formatNumber(todayReadings)}
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
                      fill={`rgba(59, 130, 246, ${0.5 + (index * 0.05)})`} 
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

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Drivers */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="text-green-500 dark:text-green-400" size={20} />
              Top Motoristas por Quilometragem
            </h3>
            
            <div className="relative">
              <select
                value={topItemsCount}
                onChange={(e) => setTopItemsCount(Number(e.target.value))}
                className="appearance-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 py-1 px-3 pr-8 rounded-lg leading-tight focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
              >
                <option value={3}>Top 3</option>
                <option value={5}>Top 5</option>
                <option value={10}>Top 10</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>
          
          {driverMileage.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={driverMileage.slice(0, topItemsCount)}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                  <XAxis 
                    dataKey="nome" 
                    tick={{ fontSize: 12 }}
                    stroke="#9CA3AF"
                    angle={-45}
                    textAnchor="end"
                    height={80}
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
                    dataKey="totalKm" 
                    name="Quilômetros Rodados"
                    fill="#10B981"
                    radius={[4, 4, 0, 0]}
                  >
                    {driverMileage.slice(0, topItemsCount).map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={`rgba(16, 185, 129, ${0.9 - (index * 0.07)})`} 
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

        {/* Top Vehicles */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <Truck className="text-purple-500 dark:text-purple-400" size={20} />
              Top Veículos por Quilometragem
            </h3>
            
            <div className="relative">
              <select
                value={topItemsCount}
                onChange={(e) => setTopItemsCount(Number(e.target.value))}
                className="appearance-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 py-1 px-3 pr-8 rounded-lg leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
              >
                <option value={3}>Top 3</option>
                <option value={5}>Top 5</option>
                <option value={10}>Top 10</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>
          
          {vehicleMileage.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={vehicleMileage.slice(0, topItemsCount)}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                  <XAxis 
                    dataKey="placa" 
                    tick={{ fontSize: 12 }}
                    stroke="#9CA3AF"
                    angle={-45}
                    textAnchor="end"
                    height={80}
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
                    dataKey="totalKm" 
                    name="Quilômetros Rodados"
                    fill="#8B5CF6"
                    radius={[4, 4, 0, 0]}
                  >
                    {vehicleMileage.slice(0, topItemsCount).map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={`rgba(139, 92, 246, ${0.9 - (index * 0.07)})`} 
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

      {/* Inconsistent Readings Table */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" />
            Leituras Inconsistentes
            <span className="ml-2 px-2.5 py-0.5 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 text-sm font-medium rounded-full">
              {inconsistentReadings.length}
            </span>
          </h3>
        </div>
        
        {inconsistentReadings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 rounded-lg overflow-hidden">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Hodômetro Lido
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Hodômetro Informado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Nome
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
                {inconsistentReadings.map((reading) => (
                  <tr key={reading.id_hodometro} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {formatNumber(reading.hod_lido)} km
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {formatNumber(reading.hod_informado)} km
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {reading.motorista.nome}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {formatDate(reading.data)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {reading.veiculo.placa.toUpperCase()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {reading.foto_hodometro ? (
                        <button
                          onClick={() => handleShowPhoto(reading.foto_hodometro)}
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
            <AlertTriangle className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Nenhuma leitura inconsistente encontrada no período selecionado</p>
          </div>
        )}
      </div>

      {/* Daily Mileage Table */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            Quilometragem Diária Detalhada
          </h3>
        </div>
        
        {dailyMileage.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 rounded-lg overflow-hidden">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Quilômetros Rodados
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {dailyMileage.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {item.formattedDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-amber-600 dark:text-amber-400">
                      {formatNumber(item.totalKm)} km
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 dark:bg-gray-800">
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