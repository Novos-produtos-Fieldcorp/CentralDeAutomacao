import React, { useState, useEffect, useMemo } from 'react';
import { Gauge, TrendingUp, Calendar, Truck, Users, BarChart2, ArrowUp, ArrowDown } from 'lucide-react';
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
  PieChart,
  Pie,
  Sector
} from 'recharts';

interface DashboardStats {
  totalKm: number;
  totalVehicles: number;
  totalDrivers: number;
  avgKmPerVehicle: number;
  avgKmPerDriver: number;
  topVehicles: {
    placa: string;
    km: number;
  }[];
  topDrivers: {
    nome: string;
    km: number;
  }[];
  kmByMonth: {
    month: string;
    km: number;
  }[];
  kmByVehicleType: {
    type: string;
    value: number;
    percentage: number;
  }[];
}

const HodometrosDashboard = () => {
  const { query, companyId } = useCompanyData();
  const [stats, setStats] = useState<DashboardStats>({
    totalKm: 0,
    totalVehicles: 0,
    totalDrivers: 0,
    avgKmPerVehicle: 0,
    avgKmPerDriver: 0,
    topVehicles: [],
    topDrivers: [],
    kmByMonth: [],
    kmByVehicleType: []
  });
  const [loading, setLoading] = useState(true);
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('30days');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch all hodometro readings within date range
      const { data: hodometros, error: hodometrosError } = await supabase
        .from('hodometro')
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
            tipo,
            tipologia
          )
        `)
        .eq('company_id', companyId)
        .gte('data', dateRange.startDate)
        .lte('data', dateRange.endDate);

      if (hodometrosError) throw hodometrosError;

      if (hodometros) {
        // Process the data to calculate statistics
        
        // 1. Calculate total KM
        const totalKm = hodometros.reduce((sum, h) => sum + (h.km_rodado || 0), 0);
        
        // 2. Count unique vehicles and drivers
        const uniqueVehicles = new Set(hodometros.map(h => h.veiculo_id));
        const uniqueDrivers = new Set(hodometros.map(h => h.motorista_id));
        
        // 3. Calculate average KM per vehicle and driver
        const avgKmPerVehicle = uniqueVehicles.size > 0 ? totalKm / uniqueVehicles.size : 0;
        const avgKmPerDriver = uniqueDrivers.size > 0 ? totalKm / uniqueDrivers.size : 0;
        
        // 4. Calculate KM by vehicle
        const kmByVehicle = hodometros.reduce((acc, h) => {
          const placa = h.veiculo?.placa?.toUpperCase() || 'Desconhecido';
          if (!acc[placa]) {
            acc[placa] = 0;
          }
          acc[placa] += h.km_rodado || 0;
          return acc;
        }, {} as Record<string, number>);
        
        // 5. Calculate KM by driver
        const kmByDriver = hodometros.reduce((acc, h) => {
          const nome = h.motorista?.nome || 'Desconhecido';
          if (!acc[nome]) {
            acc[nome] = 0;
          }
          acc[nome] += h.km_rodado || 0;
          return acc;
        }, {} as Record<string, number>);
        
        // 6. Calculate KM by month
        const kmByMonth = hodometros.reduce((acc, h) => {
          const date = new Date(h.data);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const monthName = date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
          
          if (!acc[monthKey]) {
            acc[monthKey] = {
              month: monthName,
              km: 0
            };
          }
          
          acc[monthKey].km += h.km_rodado || 0;
          return acc;
        }, {} as Record<string, { month: string; km: number }>);
        
        // 7. Calculate KM by vehicle type
        const kmByVehicleType = hodometros.reduce((acc, h) => {
          const type = h.veiculo?.tipologia || 'Não informado';
          if (!acc[type]) {
            acc[type] = 0;
          }
          acc[type] += h.km_rodado || 0;
          return acc;
        }, {} as Record<string, number>);
        
        // Convert to arrays and sort
        const topVehicles = Object.entries(kmByVehicle)
          .map(([placa, km]) => ({ placa, km }))
          .sort((a, b) => b.km - a.km)
          .slice(0, 5);
          
        const topDrivers = Object.entries(kmByDriver)
          .map(([nome, km]) => ({ nome, km }))
          .sort((a, b) => b.km - a.km)
          .slice(0, 5);
          
        const kmByMonthArray = Object.values(kmByMonth)
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
          
        const kmByVehicleTypeArray = Object.entries(kmByVehicleType)
          .map(([type, value]) => ({ 
            type, 
            value,
            percentage: totalKm > 0 ? (value / totalKm) * 100 : 0
          }))
          .sort((a, b) => b.value - a.value);
        
        setStats({
          totalKm,
          totalVehicles: uniqueVehicles.size,
          totalDrivers: uniqueDrivers.size,
          avgKmPerVehicle,
          avgKmPerDriver,
          topVehicles,
          topDrivers,
          kmByMonth: kmByMonthArray,
          kmByVehicleType: kmByVehicleTypeArray
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
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
          {payload.type}
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
          {`${value.toLocaleString('pt-BR')} km`}
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

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <StatCard
          title="Total KM Rodado"
          value={`${stats.totalKm.toLocaleString('pt-BR')} km`}
          icon={Gauge}
          color="blue"
        />
        <StatCard
          title="Média KM/Veículo"
          value={`${stats.avgKmPerVehicle.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`}
          icon={Truck}
          color="green"
        />
        <StatCard
          title="Média KM/Motorista"
          value={`${stats.avgKmPerDriver.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`}
          icon={Users}
          color="purple"
        />
        <StatCard
          title="Total de Veículos"
          value={stats.totalVehicles.toString()}
          icon={Truck}
          color="orange"
        />
        <StatCard
          title="Total de Motoristas"
          value={stats.totalDrivers.toString()}
          icon={Users}
          color="indigo"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly KM Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <Calendar className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Quilometragem Mensal
            </h3>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.kmByMonth}
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
                  formatter={(value: any) => [`${value.toLocaleString('pt-BR')} km`, 'Quilômetros']}
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    borderRadius: '0.5rem',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend />
                <Bar 
                  dataKey="km" 
                  name="Quilômetros Rodados" 
                  fill="#3B82F6" 
                  radius={[4, 4, 0, 0]}
                >
                  {stats.kmByMonth.map((entry, index) => (
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
          <div className="flex items-center gap-2 mb-6">
            <Truck className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Distribuição por Tipo de Veículo
            </h3>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  activeIndex={activeIndex}
                  activeShape={renderActiveShape}
                  data={stats.kmByVehicleType}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  onMouseEnter={onPieEnter}
                >
                  {stats.kmByVehicleType.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={[
                        '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', 
                        '#EC4899', '#6366F1', '#F97316', '#14B8A6'
                      ][index % 8]} 
                    />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => [`${value.toLocaleString('pt-BR')} km`, 'Quilômetros']}
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
          <div className="flex items-center gap-2 mb-6">
            <Truck className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Top 5 Veículos
            </h3>
          </div>
          <div className="space-y-4">
            {stats.topVehicles.map((vehicle, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {vehicle.placa}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {vehicle.km.toLocaleString('pt-BR')} km
                  </span>
                </div>
                <div className="h-2 bg-blue-100 dark:bg-blue-900/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.max(
                        5, 
                        (vehicle.km / Math.max(...stats.topVehicles.map(v => v.km), 1)) * 100
                      )}%` 
                    }}
                  />
                </div>
              </div>
            ))}
            {stats.topVehicles.length === 0 && (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                Nenhum dado disponível para o período selecionado
              </div>
            )}
          </div>
        </div>

        {/* Top Drivers */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <Users className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Top 5 Motoristas
            </h3>
          </div>
          <div className="space-y-4">
            {stats.topDrivers.map((driver, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {driver.nome}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {driver.km.toLocaleString('pt-BR')} km
                  </span>
                </div>
                <div className="h-2 bg-blue-100 dark:bg-blue-900/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.max(
                        5, 
                        (driver.km / Math.max(...stats.topDrivers.map(d => d.km), 1)) * 100
                      )}%` 
                    }}
                  />
                </div>
              </div>
            ))}
            {stats.topDrivers.length === 0 && (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                Nenhum dado disponível para o período selecionado
              </div>
            )}
          </div>
        </div>
      </div>
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
  value: string;
  icon: any;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'indigo';
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
    orange: {
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      text: 'text-orange-600 dark:text-orange-400',
      icon: 'text-orange-500 dark:text-orange-400'
    },
    indigo: {
      bg: 'bg-indigo-50 dark:bg-indigo-900/20',
      text: 'text-indigo-600 dark:text-indigo-400',
      icon: 'text-indigo-500 dark:text-indigo-400'
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
      <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400 mb-4">
        <div className={`p-2 rounded-lg ${colors[color].bg}`}>
          <Icon className={`w-6 h-6 ${colors[color].icon}`} />
        </div>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <span className={`text-2xl font-bold ${colors[color].text}`}>
        {value}
      </span>
    </div>
  );
};

export default HodometrosDashboard;