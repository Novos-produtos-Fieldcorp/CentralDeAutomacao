import React, { useState, useEffect, useMemo } from 'react';
import { BarChart2, Calendar, TrendingUp, Truck, Users, AlertTriangle, Activity, ChevronDown, Clock, FileText, PieChart } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useDateRange } from '../../hooks/useDateRange';
import PeriodSelector from '../../components/hodometros/PeriodSelector';
import LoadingSpinner from '../../components/LoadingSpinner';
import DailyMileageTotal from '../../components/hodometros/DailyMileageTotal';
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
  Line,
  Area,
  AreaChart,
  PieChart as RechartsPieChart,
  Pie,
  Sector
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

interface WeekdayMileage {
  name: string;
  value: number;
  fill: string;
}

const HodometrosDashboard = () => {
  const { query, companyId } = useCompanyData();
  const [loading, setLoading] = useState(true);
  const [dailyMileage, setDailyMileage] = useState<DailyMileage[]>([]);
  const [driverMileage, setDriverMileage] = useState<DriverMileage[]>([]);
  const [vehicleMileage, setVehicleMileage] = useState<VehicleMileage[]>([]);
  const [weekdayMileage, setWeekdayMileage] = useState<WeekdayMileage[]>([]);
  const [totalKm, setTotalKm] = useState(0);
  const [averageKmPerDay, setAverageKmPerDay] = useState(0);
  const [totalReadings, setTotalReadings] = useState(0);
  const [todayReadings, setTodayReadings] = useState(0);
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('30days');
  const [topItemsCount, setTopItemsCount] = useState<number>(5);
  const [activeIndex, setActiveIndex] = useState(0);

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
      const vehicleMileageMap = new Map<number, { placa: string; totalKm: number }>();
      const weekdayMap = new Map<number, { name: string; value: number }>();
      
      // Initialize weekday data
      const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      weekdays.forEach((name, index) => {
        weekdayMap.set(index, { name, value: 0 });
      });
      
      let totalKilometers = 0;
      const today = new Date().toISOString().split('T')[0];
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
        
        // Add to weekday mileage
        const date = new Date(hodometro.data);
        const weekday = date.getDay();
        const weekdayData = weekdayMap.get(weekday);
        if (weekdayData) {
          weekdayMap.set(weekday, { ...weekdayData, value: weekdayData.value + kmValue });
        }
        
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
        .map(([veiculo_id, data]) => ({
          veiculo_id,
          placa: data.placa.toUpperCase(),
          totalKm: data.totalKm
        }))
        .sort((a, b) => b.totalKm - a.totalKm);
      
      // Convert weekday map to array
      const weekdayColors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#8AC249'
      ];
      
      const weekdayMileageArray: WeekdayMileage[] = Array.from(weekdayMap.entries())
        .map(([day, data], index) => ({
          name: data.name,
          value: data.value,
          fill: weekdayColors[index % weekdayColors.length]
        }))
        .filter(item => item.value > 0); // Only include days with data
      
      // Calculate average km per day
      const uniqueDays = new Set(dailyMileageArray.map(item => item.date)).size;
      const avgKmPerDay = uniqueDays > 0 ? totalKilometers / uniqueDays : 0;
      
      // Update state with processed data
      setDailyMileage(dailyMileageArray);
      setDriverMileage(driverMileageArray);
      setVehicleMileage(vehicleMileageArray);
      setWeekdayMileage(weekdayMileageArray);
      setTotalKm(totalKilometers);
      setAverageKmPerDay(avgKmPerDay);
      setTotalReadings(hodometros?.length || 0);
      setTodayReadings(todayReadingsCount);
      
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

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const renderActiveShape = (props: any) => {
    const RADIAN = Math.PI / 180;
    const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const sx = cx + (outerRadius + 10) * cos;
    const sy = cy + (outerRadius + 10) * sin;
    const mx = cx + (outerRadius + 30) * cos;
    const my = cy + (outerRadius + 30) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 22;
    const ey = my;
    const textAnchor = cos >= 0 ? 'start' : 'end';

    return (
      <g>
        <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} className="text-sm">
          {payload.name}
        </text>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
        <Sector
          cx={cx}
          cy={cy}
          startAngle={startAngle}
          endAngle={endAngle}
          innerRadius={outerRadius + 6}
          outerRadius={outerRadius + 10}
          fill={fill}
        />
        <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
        <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
        <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#333" className="text-xs">
          {`${formatNumber(value)} km`}
        </text>
        <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="#999" className="text-xs">
          {`(${(percent * 100).toFixed(2)}%)`}
        </text>
      </g>
    );
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
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border-l-4 border-blue-500 dark:border-blue-400 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
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
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border-l-4 border-green-500 dark:border-green-400 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
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
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border-l-4 border-purple-500 dark:border-purple-400 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
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
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border-l-4 border-amber-500 dark:border-amber-400 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex flex-col items-center text-center">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl mb-3">
              <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Leituras Hoje</h3>
            <p className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent dark:from-amber-400 dark:to-orange-400">
              {formatNumber(todayReadings)}
            </p>
            <DailyMileageTotal selectedDate={new Date().toISOString().split('T')[0]} />
          </div>
        </div>
      </div>

      {/* Daily Mileage Chart */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border-2 border-blue-100 dark:border-blue-900/30 hover:shadow-lg transition-all duration-300">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-500 dark:text-blue-400" />
          Quilometragem Diária
        </h3>
        
        {dailyMileage.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={dailyMileage}
                margin={{ top: 10, right: 30, left: 20, bottom: 70 }}
              >
                <defs>
                  <linearGradient id="colorKm" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
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
                <Area 
                  type="monotone" 
                  dataKey="totalKm" 
                  name="Quilômetros Rodados"
                  stroke="#3B82F6" 
                  fillOpacity={1}
                  fill="url(#colorKm)"
                  strokeWidth={2}
                  activeDot={{ r: 6, fill: "#2563EB" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-60 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
            <AlertTriangle className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Nenhum dado disponível para o período selecionado</p>
          </div>
        )}
      </div>

      {/* Weekday Distribution Chart - New Chart */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border-2 border-indigo-100 dark:border-indigo-900/30 hover:shadow-lg transition-all duration-300">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <PieChart className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
          Distribuição por Dia da Semana
        </h3>
        
        {weekdayMileage.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  activeIndex={activeIndex}
                  activeShape={renderActiveShape}
                  data={weekdayMileage}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  dataKey="value"
                  onMouseEnter={onPieEnter}
                >
                  {weekdayMileage.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
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
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-60 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
            <AlertTriangle className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Nenhum dado disponível para o período selecionado</p>
          </div>
        )}
      </div>

      {/* Top Drivers and Vehicles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Drivers */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border-2 border-green-100 dark:border-green-900/30 hover:shadow-lg transition-all duration-300">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-green-500 dark:text-green-400" />
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
                  <Bar 
                    dataKey="totalKm" 
                    name="Quilômetros Rodados"
                    fill="#10B981"
                    radius={[0, 4, 4, 0]}
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
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border-2 border-purple-100 dark:border-purple-900/30 hover:shadow-lg transition-all duration-300">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-purple-500 dark:text-purple-400" />
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
                  <Bar 
                    dataKey="totalKm" 
                    name="Quilômetros Rodados"
                    fill="#8B5CF6"
                    radius={[0, 4, 4, 0]}
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

      {/* Daily Mileage Table */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border-2 border-amber-100 dark:border-amber-900/30 hover:shadow-lg transition-all duration-300">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            Quilometragem Diária Detalhada
          </h3>
        </div>
        
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