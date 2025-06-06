import React, { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, Calendar, Truck, User, MapPin, Filter, Search } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useDateRange } from '../../hooks/useDateRange';
import PeriodSelector from '../../components/hodometros/PeriodSelector';
import LoadingSpinner from '../../components/LoadingSpinner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line } from 'recharts';

interface DashboardStats {
  totalKm: number;
  totalReadings: number;
  averageKmPerDay: number;
  topDrivers: {
    name: string;
    km: number;
    percentage: number;
  }[];
  topVehicles: {
    plate: string;
    km: number;
    percentage: number;
  }[];
  monthlyData: {
    month: string;
    km: number;
  }[];
  dailyData: {
    date: string;
    km: number;
  }[];
}

const HodometrosDashboard = () => {
  const { companyId } = useCompanyData();
  const [stats, setStats] = useState<DashboardStats>({
    totalKm: 0,
    totalReadings: 0,
    averageKmPerDay: 0,
    topDrivers: [],
    topVehicles: [],
    monthlyData: [],
    dailyData: []
  });
  const [loading, setLoading] = useState(true);
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('');
  const [clients, setClients] = useState<string[]>([]);
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('1month');

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange, selectedClientFilter]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const baseQuery = supabase.from('hodometro')
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
            tipo
          ),
          cliente:cliente_id (
            cliente_id,
            nome
          )
        `);

      // Apply date range filter
      let query = baseQuery
        .eq('company_id', companyId)
        .gte('data', dateRange.startDate)
        .lte('data', dateRange.endDate);
      
      // Apply client filter if selected
      if (selectedClientFilter) {
        query = query.eq('cliente.nome', selectedClientFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Process dashboard data
      processDashboardData(data || []);
      
      // Extract unique clients
      const uniqueClients = Array.from(new Set(
        (data || [])
          .filter(h => h.cliente?.nome)
          .map(h => h.cliente.nome)
      )).sort();
      
      setClients(uniqueClients);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  const processDashboardData = (data: any[]) => {
    // Calculate total KM
    const totalKm = data.reduce((sum, item) => sum + (item.km_rodado || 0), 0);
    
    // Calculate total readings
    const totalReadings = data.length;
    
    // Calculate average KM per day
    const uniqueDays = new Set(data.map(item => item.data)).size;
    const averageKmPerDay = uniqueDays > 0 ? totalKm / uniqueDays : 0;
    
    // Calculate top drivers
    const driverMap = new Map<string, number>();
    data.forEach(item => {
      if (!item.motorista?.nome) return;
      
      const driverName = item.motorista.nome;
      const km = item.km_rodado || 0;
      
      driverMap.set(driverName, (driverMap.get(driverName) || 0) + km);
    });
    
    const topDrivers = Array.from(driverMap.entries())
      .map(([name, km]) => ({
        name,
        km,
        percentage: totalKm > 0 ? (km / totalKm) * 100 : 0
      }))
      .sort((a, b) => b.km - a.km)
      .slice(0, 5);
    
    // Calculate top vehicles
    const vehicleMap = new Map<string, number>();
    data.forEach(item => {
      if (!item.veiculo?.placa) return;
      
      const plate = item.veiculo.placa.toUpperCase();
      const km = item.km_rodado || 0;
      
      vehicleMap.set(plate, (vehicleMap.get(plate) || 0) + km);
    });
    
    const topVehicles = Array.from(vehicleMap.entries())
      .map(([plate, km]) => ({
        plate,
        km,
        percentage: totalKm > 0 ? (km / totalKm) * 100 : 0
      }))
      .sort((a, b) => b.km - a.km)
      .slice(0, 5);
    
    // Calculate monthly data
    const monthlyMap = new Map<string, number>();
    data.forEach(item => {
      const date = new Date(item.data);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      
      monthlyMap.set(monthName, (monthlyMap.get(monthName) || 0) + (item.km_rodado || 0));
    });
    
    const monthlyData = Array.from(monthlyMap.entries())
      .map(([month, km]) => ({ month, km }))
      .sort((a, b) => {
        // Sort by date (convert month name back to date for sorting)
        const dateA = new Date(a.month.replace('de', '').trim());
        const dateB = new Date(b.month.replace('de', '').trim());
        return dateA.getTime() - dateB.getTime();
      });
    
    // Calculate daily data (last 30 days)
    const dailyMap = new Map<string, number>();
    data.forEach(item => {
      const date = item.data;
      const formattedDate = new Date(date).toLocaleDateString('pt-BR');
      
      dailyMap.set(formattedDate, (dailyMap.get(formattedDate) || 0) + (item.km_rodado || 0));
    });
    
    const dailyData = Array.from(dailyMap.entries())
      .map(([date, km]) => ({ date, km }))
      .sort((a, b) => {
        // Sort by date
        const dateA = new Date(a.date.split('/').reverse().join('-'));
        const dateB = new Date(b.date.split('/').reverse().join('-'));
        return dateA.getTime() - dateB.getTime();
      })
      .slice(-30); // Get only the last 30 days
    
    setStats({
      totalKm,
      totalReadings,
      averageKmPerDay,
      topDrivers,
      topVehicles,
      monthlyData,
      dailyData
    });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md">
          <p className="font-medium text-gray-900 dark:text-white">{label}</p>
          <p className="text-blue-600 dark:text-blue-400">
            {payload[0].value.toLocaleString('pt-BR')} km
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Client Filter */}
          <div className="relative">
            <select
              value={selectedClientFilter}
              onChange={(e) => setSelectedClientFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 
                       dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 
                       focus:border-blue-500 text-gray-900 dark:text-gray-100 appearance-none"
            >
              <option value="">Todos os clientes</option>
              {clients.map((client, index) => (
                <option key={index} value={client}>{client}</option>
              ))}
            </select>
            <Filter className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <ChevronDown className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>

          {/* Period Selector */}
          <div>
            <PeriodSelector
              periodType={periodType}
              dateRange={dateRange}
              onPeriodChange={updatePeriod}
              onDateRangeChange={setDateRange}
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total de KM</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalKm.toLocaleString('pt-BR')} km
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Calendar className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total de Leituras</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalReadings.toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Truck className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Média KM/Dia</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.averageKmPerDay.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-6">
            <BarChart2 className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Quilometragem Mensal
            </h3>
          </div>
          
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.monthlyData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  tickFormatter={(value) => `${value.toLocaleString('pt-BR')}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="km" 
                  fill="#3b82f6" 
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                  animationDuration={1500}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Daily Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="text-green-500 dark:text-green-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Tendência Diária
            </h3>
          </div>
          
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={stats.dailyData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  tickFormatter={(value) => `${value.toLocaleString('pt-BR')}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="km" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  dot={{ fill: '#10b981', r: 4 }}
                  activeDot={{ r: 6, fill: '#10b981' }}
                  animationDuration={1500}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Drivers and Vehicles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Drivers */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-6">
            <User className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Top Motoristas
            </h3>
          </div>
          
          <div className="space-y-4">
            {stats.topDrivers.map((driver, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {driver.name}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {driver.km.toLocaleString('pt-BR')} km
                  </span>
                </div>
                <div className="h-2 bg-blue-100 dark:bg-blue-900/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(5, driver.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
            
            {stats.topDrivers.length === 0 && (
              <div className="text-center py-4">
                <p className="text-gray-500 dark:text-gray-400">
                  Nenhum dado disponível
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* Top Vehicles */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-6">
            <Truck className="text-purple-500 dark:text-purple-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Top Veículos
            </h3>
          </div>
          
          <div className="space-y-4">
            {stats.topVehicles.map((vehicle, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {vehicle.plate}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {vehicle.km.toLocaleString('pt-BR')} km
                  </span>
                </div>
                <div className="h-2 bg-purple-100 dark:bg-purple-900/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-500 dark:bg-purple-400 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(5, vehicle.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
            
            {stats.topVehicles.length === 0 && (
              <div className="text-center py-4">
                <p className="text-gray-500 dark:text-gray-400">
                  Nenhum dado disponível
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HodometrosDashboard;