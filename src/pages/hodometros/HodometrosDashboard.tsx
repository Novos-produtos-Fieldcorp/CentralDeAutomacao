import React, { useState, useEffect, useMemo } from 'react';
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
  PieChart,
  Pie,
  Sector
} from 'recharts';
import { Gauge, Calendar, TrendingUp, Users, Truck, AlertTriangle, ChevronDown } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { useDateRange } from '../../hooks/useDateRange';
import PeriodSelector from '../../components/hodometros/PeriodSelector';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';

interface DashboardData {
  totalReadings: number;
  totalKm: number;
  totalVehicles: number;
  totalDrivers: number;
  averageKmPerDay: number;
  topVehicles: {
    placa: string;
    km: number;
    marca?: string;
    tipo?: string;
  }[];
  topDrivers: {
    nome: string;
    km: number;
  }[];
  kmByMonth: {
    month: string;
    km: number;
  }[];
  vehicleTypeDistribution: {
    name: string;
    value: number;
  }[];
}

const HodometrosDashboard = () => {
  const { query, companyId } = useCompanyData();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalReadings: 0,
    totalKm: 0,
    totalVehicles: 0,
    totalDrivers: 0,
    averageKmPerDay: 0,
    topVehicles: [],
    topDrivers: [],
    kmByMonth: [],
    vehicleTypeDistribution: []
  });
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('30days');
  const [activeVehicleIndex, setActiveVehicleIndex] = useState(0);
  const [activeDriverIndex, setActiveDriverIndex] = useState(0);
  const [topVehiclesCount, setTopVehiclesCount] = useState(5);
  const [topDriversCount, setTopDriversCount] = useState(5);

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange, topVehiclesCount, topDriversCount]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch hodometro data with date range filter
      const { data: hodometros, error: hodometrosError } = await supabase
        .from('hodometro')
        .select(`
          id_hodometro,
          data,
          hora,
          hod_lido,
          hod_informado,
          km_rodado,
          bateria,
          motorista:motorista_id (
            motorista_id,
            nome
          ),
          veiculo:veiculo_id (
            veiculo_id,
            placa,
            marca,
            tipo,
            tipologia
          )
        `)
        .gte('data', dateRange.startDate)
        .lte('data', dateRange.endDate);

      if (hodometrosError) throw hodometrosError;

      // Process dashboard data
      const processedData = processDashboardData(hodometros || []);
      setDashboardData(processedData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  const processDashboardData = (hodometros: any[]): DashboardData => {
    // Calculate total KM
    const totalKm = hodometros.reduce((sum, h) => sum + (h.km_rodado || 0), 0);
    
    // Count unique vehicles and drivers
    const uniqueVehicles = new Set(hodometros.map(h => h.veiculo_id));
    const uniqueDrivers = new Set(hodometros.map(h => h.motorista_id));
    
    // Calculate average KM per day
    const days = calculateDaysBetween(dateRange.startDate, dateRange.endDate);
    const averageKmPerDay = days > 0 ? totalKm / days : 0;
    
    // Calculate top vehicles by KM
    const vehicleMap = new Map<string, { km: number; placa: string; marca?: string; tipo?: string }>();
    hodometros.forEach(h => {
      if (!h.veiculo) return;
      
      const placa = h.veiculo.placa.toUpperCase();
      if (!vehicleMap.has(placa)) {
        vehicleMap.set(placa, { 
          km: 0, 
          placa, 
          marca: h.veiculo.marca,
          tipo: h.veiculo.tipo
        });
      }
      vehicleMap.get(placa)!.km += h.km_rodado || 0;
    });
    
    const topVehicles = Array.from(vehicleMap.values())
      .sort((a, b) => b.km - a.km)
      .slice(0, topVehiclesCount);
    
    // Calculate top drivers by KM
    const driverMap = new Map<number, { km: number; nome: string }>();
    hodometros.forEach(h => {
      if (!h.motorista) return;
      
      const id = h.motorista.motorista_id;
      if (!driverMap.has(id)) {
        driverMap.set(id, { km: 0, nome: h.motorista.nome });
      }
      driverMap.get(id)!.km += h.km_rodado || 0;
    });
    
    const topDrivers = Array.from(driverMap.values())
      .sort((a, b) => b.km - a.km)
      .slice(0, topDriversCount);
    
    // Calculate KM by month
    const kmByMonth = calculateKmByMonth(hodometros);
    
    // Calculate vehicle type distribution
    const vehicleTypeDistribution = calculateVehicleTypeDistribution(hodometros);
    
    return {
      totalReadings: hodometros.length,
      totalKm,
      totalVehicles: uniqueVehicles.size,
      totalDrivers: uniqueDrivers.size,
      averageKmPerDay,
      topVehicles,
      topDrivers,
      kmByMonth,
      vehicleTypeDistribution
    };
  };

  const calculateDaysBetween = (startDate: string, endDate: string): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1; // Ensure at least 1 day
  };

  const calculateKmByMonth = (hodometros: any[]): { month: string; km: number }[] => {
    const monthMap = new Map<string, number>();
    
    hodometros.forEach(h => {
      const date = new Date(h.data);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, 0);
      }
      
      monthMap.set(monthKey, monthMap.get(monthKey)! + (h.km_rodado || 0));
    });
    
    // Convert to array and sort by month
    return Array.from(monthMap.entries())
      .map(([key, km]) => {
        const [year, month] = key.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        return {
          month: date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
          km
        };
      })
      .sort((a, b) => {
        const monthA = a.month.split(' ')[0];
        const yearA = a.month.split(' ')[1];
        const monthB = b.month.split(' ')[0];
        const yearB = b.month.split(' ')[1];
        
        if (yearA !== yearB) {
          return parseInt(yearA) - parseInt(yearB);
        }
        
        const months = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
        return months.indexOf(monthA) - months.indexOf(monthB);
      });
  };

  const calculateVehicleTypeDistribution = (hodometros: any[]): { name: string; value: number }[] => {
    const typeMap = new Map<string, number>();
    const vehicleSet = new Set<string>();
    
    hodometros.forEach(h => {
      if (!h.veiculo || !h.veiculo.tipologia || vehicleSet.has(h.veiculo.placa)) return;
      
      vehicleSet.add(h.veiculo.placa);
      
      const type = h.veiculo.tipologia.toUpperCase();
      if (!typeMap.has(type)) {
        typeMap.set(type, 0);
      }
      
      typeMap.set(type, typeMap.get(type)! + 1);
    });
    
    // Convert to array and sort by count
    return Array.from(typeMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString('pt-BR');
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
          {`${value} veículos`}
        </text>
        <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="#999" className="text-xs">
          {`(${(percent * 100).toFixed(2)}%)`}
        </text>
      </g>
    );
  };

  const onPieEnter = (_: any, index: number) => {
    setActiveVehicleIndex(index);
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total de Leituras"
          value={dashboardData.totalReadings}
          icon={Gauge}
          color="blue"
        />
        <StatCard
          title="Quilômetros Rodados"
          value={dashboardData.totalKm}
          suffix="km"
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Veículos Monitorados"
          value={dashboardData.totalVehicles}
          icon={Truck}
          color="purple"
        />
        <StatCard
          title="Motoristas Ativos"
          value={dashboardData.totalDrivers}
          icon={Users}
          color="orange"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly KM Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            Quilometragem Mensal
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dashboardData.kmByMonth}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis 
                  dataKey="month" 
                  angle={-45} 
                  textAnchor="end" 
                  height={60} 
                  tick={{ fontSize: 12 }}
                  stroke="#9CA3AF"
                />
                <YAxis 
                  tickFormatter={(value) => `${value.toLocaleString('pt-BR')}`}
                  stroke="#9CA3AF"
                />
                <Tooltip 
                  formatter={(value: any) => [value.toLocaleString('pt-BR') + ' km', 'Quilômetros']}
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
                  dataKey="km" 
                  fill="#3B82F6" 
                  radius={[4, 4, 0, 0]}
                  animationDuration={1500}
                >
                  {dashboardData.kmByMonth.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={`rgba(59, 130, 246, ${0.5 + (index * 0.05)})`} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Vehicle Type Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Truck className="w-5 h-5 text-purple-500 dark:text-purple-400" />
            Distribuição por Tipo de Veículo
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  activeIndex={activeVehicleIndex}
                  activeShape={renderActiveShape}
                  data={dashboardData.vehicleTypeDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  onMouseEnter={onPieEnter}
                >
                  {dashboardData.vehicleTypeDistribution.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={[
                        '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', 
                        '#10B981', '#6366F1', '#EF4444', '#14B8A6'
                      ][index % 8]} 
                    />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => [`${value} veículos`, 'Quantidade']}
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    borderRadius: '0.5rem',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Vehicles */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-500 dark:text-blue-400" />
              Top Veículos por KM
            </h3>
            <div className="relative">
              <select
                value={topVehiclesCount}
                onChange={(e) => setTopVehiclesCount(Number(e.target.value))}
                className="appearance-none bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 py-1 px-3 pr-8 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={3}>Top 3</option>
                <option value={5}>Top 5</option>
                <option value={10}>Top 10</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>
          <div className="space-y-4">
            {dashboardData.topVehicles.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Nenhum dado disponível
              </div>
            ) : (
              dashboardData.topVehicles.map((vehicle, index) => (
                <div key={index} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400 font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {vehicle.placa}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {vehicle.marca} {vehicle.tipo}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {formatNumber(vehicle.km)} km
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 dark:bg-blue-500 h-2.5 rounded-full" 
                      style={{ width: `${(vehicle.km / dashboardData.topVehicles[0].km) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Drivers */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-green-500 dark:text-green-400" />
              Top Motoristas por KM
            </h3>
            <div className="relative">
              <select
                value={topDriversCount}
                onChange={(e) => setTopDriversCount(Number(e.target.value))}
                className="appearance-none bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 py-1 px-3 pr-8 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={3}>Top 3</option>
                <option value={5}>Top 5</option>
                <option value={10}>Top 10</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>
          <div className="space-y-4">
            {dashboardData.topDrivers.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Nenhum dado disponível
              </div>
            ) : (
              dashboardData.topDrivers.map((driver, index) => (
                <div key={index} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 dark:text-green-400 font-medium">
                        {index + 1}
                      </div>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {driver.nome}
                      </h4>
                    </div>
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">
                      {formatNumber(driver.km)} km
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                    <div 
                      className="bg-green-600 dark:bg-green-500 h-2.5 rounded-full" 
                      style={{ width: `${(driver.km / dashboardData.topDrivers[0].km) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Average KM per Day */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-orange-500 dark:text-orange-400" />
          Média de Quilômetros por Dia
        </h3>
        <div className="flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl font-bold text-orange-600 dark:text-orange-400">
              {formatNumber(Math.round(dashboardData.averageKmPerDay))}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              km/dia no período selecionado
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ 
  title, 
  value, 
  suffix = '', 
  icon: Icon,
  color = 'blue'
}: { 
  title: string;
  value: number;
  suffix?: string;
  icon: React.ElementType;
  color?: 'blue' | 'green' | 'purple' | 'orange';
}) => {
  const colors = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800/30',
      text: 'text-blue-600 dark:text-blue-400',
      icon: 'text-blue-500 dark:text-blue-400',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30'
    },
    green: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800/30',
      text: 'text-green-600 dark:text-green-400',
      icon: 'text-green-500 dark:text-green-400',
      iconBg: 'bg-green-100 dark:bg-green-900/30'
    },
    purple: {
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      border: 'border-purple-200 dark:border-purple-800/30',
      text: 'text-purple-600 dark:text-purple-400',
      icon: 'text-purple-500 dark:text-purple-400',
      iconBg: 'bg-purple-100 dark:bg-purple-900/30'
    },
    orange: {
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      border: 'border-orange-200 dark:border-orange-800/30',
      text: 'text-orange-600 dark:text-orange-400',
      icon: 'text-orange-500 dark:text-orange-400',
      iconBg: 'bg-orange-100 dark:bg-orange-900/30'
    }
  };

  const colorStyle = colors[color];

  return (
    <div className={`rounded-xl p-6 shadow-md ${colorStyle.bg} border ${colorStyle.border} flex flex-col items-center text-center`}>
      <div className={`p-3 rounded-full ${colorStyle.iconBg} mb-4`}>
        <Icon className={`w-6 h-6 ${colorStyle.icon}`} />
      </div>
      <h3 className="text-base font-medium text-gray-700 dark:text-gray-300 mb-3">
        {title}
      </h3>
      <div className={`text-3xl font-bold ${colorStyle.text}`}>
        {value.toLocaleString('pt-BR')}{suffix}
      </div>
    </div>
  );
};

export default HodometrosDashboard;