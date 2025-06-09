import React, { useState, useEffect, useCallback } from 'react';
import { Gauge, Calendar, BarChart2, TrendingUp, Users, Truck, ArrowUp, ArrowDown } from 'lucide-react';
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
  totalKm: number;
  averageKmPerVehicle: number;
  topDriver: {
    name: string;
    km: number;
  };
  topVehicle: {
    plate: string;
    km: number;
  };
  kmByDriver: {
    name: string;
    km: number;
  }[];
  kmByVehicle: {
    plate: string;
    km: number;
  }[];
  kmByMonth: {
    month: string;
    km: number;
  }[];
}

const HodometrosDashboard = () => {
  const { query, companyId } = useCompanyData();
  const [stats, setStats] = useState<DashboardStats>({
    totalReadings: 0,
    totalKm: 0,
    averageKmPerVehicle: 0,
    topDriver: { name: '', km: 0 },
    topVehicle: { plate: '', km: 0 },
    kmByDriver: [],
    kmByVehicle: [],
    kmByMonth: []
  });
  const [loading, setLoading] = useState(true);
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('30days');

  // Format number with dot as thousands separator
  const formatNumber = (num: number | null | undefined): string => {
    if (num === null || num === undefined) return '-';
    
    // Convert to string with dots as thousands separators
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get all hodometro readings for the period
      const { data: hodometros, error } = await supabase
        .from('hodometro')
        .select(`
          id_hodometro,
          data,
          hora,
          hod_informado,
          hod_lido,
          km_rodado,
          bateria,
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
        .lte('data', dateRange.endDate);

      if (error) throw error;

      // Process the data
      if (hodometros) {
        // Calculate total KM
        const totalKm = hodometros.reduce((sum, h) => sum + (h.km_rodado || 0), 0);
        
        // Group by motorista
        const kmByDriver: Record<string, number> = {};
        hodometros.forEach(h => {
          if (h.motorista?.nome && h.km_rodado) {
            if (!kmByDriver[h.motorista.nome]) {
              kmByDriver[h.motorista.nome] = 0;
            }
            kmByDriver[h.motorista.nome] += h.km_rodado;
          }
        });
        
        // Group by vehicle
        const kmByVehicle: Record<string, number> = {};
        hodometros.forEach(h => {
          if (h.veiculo?.placa && h.km_rodado) {
            if (!kmByVehicle[h.veiculo.placa]) {
              kmByVehicle[h.veiculo.placa] = 0;
            }
            kmByVehicle[h.veiculo.placa] += h.km_rodado;
          }
        });
        
        // Group by month
        const kmByMonth: Record<string, number> = {};
        hodometros.forEach(h => {
          if (h.data && h.km_rodado) {
            const date = new Date(h.data);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const monthName = date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
            
            if (!kmByMonth[monthName]) {
              kmByMonth[monthName] = 0;
            }
            kmByMonth[monthName] += h.km_rodado;
          }
        });
        
        // Find top driver
        let topDriver = { name: '', km: 0 };
        Object.entries(kmByDriver).forEach(([name, km]) => {
          if (km > topDriver.km) {
            topDriver = { name, km };
          }
        });
        
        // Find top vehicle
        let topVehicle = { plate: '', km: 0 };
        Object.entries(kmByVehicle).forEach(([plate, km]) => {
          if (km > topVehicle.km) {
            topVehicle = { plate, km };
          }
        });
        
        // Calculate average KM per vehicle
        const vehicleCount = Object.keys(kmByVehicle).length;
        const averageKmPerVehicle = vehicleCount > 0 ? totalKm / vehicleCount : 0;
        
        // Format data for charts
        const kmByDriverArray = Object.entries(kmByDriver)
          .map(([name, km]) => ({ name, km }))
          .sort((a, b) => b.km - a.km);
        
        const kmByVehicleArray = Object.entries(kmByVehicle)
          .map(([plate, km]) => ({ plate, km }))
          .sort((a, b) => b.km - a.km);
        
        const kmByMonthArray = Object.entries(kmByMonth)
          .map(([month, km]) => ({ month, km }))
          .sort((a, b) => {
            const monthA = new Date(a.month.split(' ')[1] + '-' + getMonthNumber(a.month.split(' ')[0]) + '-01');
            const monthB = new Date(b.month.split(' ')[1] + '-' + getMonthNumber(b.month.split(' ')[0]) + '-01');
            return monthA.getTime() - monthB.getTime();
          });
        
        setStats({
          totalReadings: hodometros.length,
          totalKm,
          averageKmPerVehicle,
          topDriver,
          topVehicle,
          kmByDriver: kmByDriverArray,
          kmByVehicle: kmByVehicleArray,
          kmByMonth: kmByMonthArray
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  }, [dateRange, companyId]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Helper function to get month number from Portuguese month name
  const getMonthNumber = (monthName: string): string => {
    const months: Record<string, string> = {
      'jan.': '01', 'fev.': '02', 'mar.': '03', 'abr.': '04',
      'mai.': '05', 'jun.': '06', 'jul.': '07', 'ago.': '08',
      'set.': '09', 'out.': '10', 'nov.': '11', 'dez.': '12'
    };
    return months[monthName.toLowerCase()] || '01';
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
          title="Total de Leituras"
          value={stats.totalReadings}
          icon={Gauge}
          color="blue"
        />
        <StatCard
          title="KM Total Rodado"
          value={formatNumber(stats.totalKm)}
          suffix="km"
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Média KM/Veículo"
          value={formatNumber(Math.round(stats.averageKmPerVehicle))}
          suffix="km"
          icon={Truck}
          color="purple"
        />
        <StatCard
          title="Motorista com Maior KM"
          value={stats.topDriver.name}
          subvalue={formatNumber(stats.topDriver.km) + " km"}
          icon={Users}
          color="indigo"
        />
        <StatCard
          title="Veículo com Maior KM"
          value={stats.topVehicle.plate.toUpperCase()}
          subvalue={formatNumber(stats.topVehicle.km) + " km"}
          icon={Truck}
          color="pink"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KM by Month */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            Quilometragem por Mês
          </h3>
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
                  tickFormatter={(value) => formatNumber(value)}
                  stroke="#9CA3AF"
                />
                <Tooltip 
                  formatter={(value: any) => [formatNumber(value) + " km", "Quilometragem"]}
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    borderRadius: '0.5rem',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Bar 
                  dataKey="km" 
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

        {/* KM by Driver */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            Quilometragem por Motorista
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.kmByDriver.slice(0, 10)}
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
                  dataKey="name" 
                  type="category" 
                  width={150}
                  tick={{ fontSize: 12 }}
                  stroke="#9CA3AF"
                />
                <Tooltip 
                  formatter={(value: any) => [formatNumber(value) + " km", "Quilometragem"]}
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    borderRadius: '0.5rem',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Bar 
                  dataKey="km" 
                  fill="#8B5CF6" 
                  radius={[0, 4, 4, 0]}
                >
                  {stats.kmByDriver.slice(0, 10).map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={`rgba(139, 92, 246, ${0.5 + (index * 0.05)})`} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* KM by Vehicle */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            Quilometragem por Veículo
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.kmByVehicle.slice(0, 10)}
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
                  dataKey="plate" 
                  type="category" 
                  width={80}
                  tick={{ fontSize: 12 }}
                  stroke="#9CA3AF"
                />
                <Tooltip 
                  formatter={(value: any) => [formatNumber(value) + " km", "Quilometragem"]}
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    borderRadius: '0.5rem',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Bar 
                  dataKey="km" 
                  fill="#EC4899" 
                  radius={[0, 4, 4, 0]}
                >
                  {stats.kmByVehicle.slice(0, 10).map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={`rgba(236, 72, 153, ${0.5 + (index * 0.05)})`} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Trend */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            Tendência de Quilometragem
          </h3>
          
          <div className="space-y-6">
            {stats.kmByMonth.map((month, index) => {
              // Calculate percentage change from previous month
              const prevMonth = index > 0 ? stats.kmByMonth[index - 1].km : null;
              const percentChange = prevMonth ? ((month.km - prevMonth) / prevMonth) * 100 : 0;
              const isIncrease = percentChange > 0;
              
              return (
                <div key={month.month} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {month.month}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatNumber(month.km)} km
                      </span>
                      {index > 0 && (
                        <span className={`text-xs flex items-center ${
                          isIncrease 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {isIncrease ? (
                            <ArrowUp className="w-3 h-3 mr-1" />
                          ) : (
                            <ArrowDown className="w-3 h-3 mr-1" />
                          )}
                          {Math.abs(percentChange).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-2 bg-blue-100 dark:bg-blue-900/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${Math.max(
                          5, 
                          (month.km / Math.max(...stats.kmByMonth.map(m => m.km), 1)) * 100
                        )}%` 
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: string | number;
  suffix?: string;
  subvalue?: string;
  icon: React.FC<{ className?: string }>;
  color: 'blue' | 'green' | 'purple' | 'indigo' | 'pink';
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  suffix, 
  subvalue, 
  icon: Icon,
  color
}) => {
  const colorClasses = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      text: 'text-blue-600 dark:text-blue-400'
    },
    green: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      text: 'text-green-600 dark:text-green-400'
    },
    purple: {
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      text: 'text-purple-600 dark:text-purple-400'
    },
    indigo: {
      bg: 'bg-indigo-50 dark:bg-indigo-900/20',
      text: 'text-indigo-600 dark:text-indigo-400'
    },
    pink: {
      bg: 'bg-pink-50 dark:bg-pink-900/20',
      text: 'text-pink-600 dark:text-pink-400'
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${colorClasses[color].bg}`}>
          <Icon className={`w-6 h-6 ${colorClasses[color].text}`} />
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {title}
          </h3>
          <div className="mt-1 flex items-center">
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
              {value}
              {suffix && <span className="ml-1 text-lg">{suffix}</span>}
            </p>
          </div>
          {subvalue && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {subvalue}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default HodometrosDashboard;