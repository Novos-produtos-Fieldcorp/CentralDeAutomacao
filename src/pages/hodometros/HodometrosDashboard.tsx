import React, { useState, useEffect } from 'react';
import { Calendar, Truck, Users, TrendingUp, BarChart2, Filter } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import DailyMileageTotal from '../../components/hodometros/DailyMileageTotal';

const HodometrosDashboard = () => {
  const { query, companyId } = useCompanyData();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalReadings: 0,
    activeVehicles: 0,
    activeDrivers: 0,
    totalKm: 0,
    averageKmPerDay: 0,
    topDrivers: [] as { name: string; km: number }[],
    monthlyData: [] as { month: string; km: number }[]
  });
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Get date range for last 30 days
      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);
      
      const startDate = thirtyDaysAgo.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];

      // Fetch hodometer readings for the last 30 days
      const { data: hodometros, error: hodometrosError } = await supabase
        .from('hodometro')
        .select(`
          id_hodometro,
          data,
          km_rodado,
          hod_lido,
          hod_informado,
          motorista:motorista_id (
            motorista_id,
            nome
          ),
          veiculo:veiculo_id (
            veiculo_id,
            placa
          )
        `)
        .gte('data', startDate)
        .lte('data', endDate)
        .eq('company_id', companyId);

      if (hodometrosError) throw hodometrosError;

      // Calculate total readings
      const totalReadings = hodometros?.length || 0;

      // Calculate unique active vehicles
      const uniqueVehicles = new Set(hodometros?.map(h => h.veiculo_id) || []);
      const activeVehicles = uniqueVehicles.size;

      // Calculate unique active drivers
      const uniqueDrivers = new Set(hodometros?.map(h => h.motorista_id) || []);
      const activeDrivers = uniqueDrivers.size;

      // Calculate total kilometers
      let totalKm = 0;
      hodometros?.forEach(h => {
        if (h.km_rodado) {
          totalKm += h.km_rodado;
        } else if (h.hod_lido && h.hod_informado) {
          // Calculate difference between readings
          const diff = Math.max(0, h.hod_lido - h.hod_informado);
          totalKm += diff;
        }
      });

      // Calculate average km per day
      const daysDiff = Math.max(1, Math.round((today.getTime() - thirtyDaysAgo.getTime()) / (1000 * 60 * 60 * 24)));
      const averageKmPerDay = totalKm / daysDiff;

      // Calculate top drivers by kilometers
      const driverMap = new Map<number, { name: string; km: number }>();
      hodometros?.forEach(h => {
        if (!h.motorista_id || !h.motorista) return;
        
        const driverId = h.motorista_id;
        const driverName = h.motorista.nome;
        const km = h.km_rodado || 0;
        
        if (driverMap.has(driverId)) {
          const current = driverMap.get(driverId)!;
          driverMap.set(driverId, { name: current.name, km: current.km + km });
        } else {
          driverMap.set(driverId, { name: driverName, km });
        }
      });
      
      const topDrivers = Array.from(driverMap.values())
        .sort((a, b) => b.km - a.km)
        .slice(0, 5);

      // Calculate monthly data
      const monthlyMap = new Map<string, number>();
      hodometros?.forEach(h => {
        if (!h.data) return;
        
        const date = new Date(h.data);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const km = h.km_rodado || 0;
        
        if (monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, monthlyMap.get(monthKey)! + km);
        } else {
          monthlyMap.set(monthKey, km);
        }
      });
      
      const monthlyData = Array.from(monthlyMap.entries())
        .map(([key, value]) => {
          const [year, month] = key.split('-');
          const date = new Date(parseInt(year), parseInt(month) - 1, 1);
          return {
            month: date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
            km: value
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

      setStats({
        totalReadings,
        activeVehicles,
        activeDrivers,
        totalKm,
        averageKmPerDay,
        topDrivers,
        monthlyData
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Date Selector */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Calendar className="text-gray-400" size={20} />
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Selecione uma data para visualizar a quilometragem diária:
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* Daily Total Mileage Card */}
        <DailyMileageTotal selectedDate={selectedDate} />
        
        {/* Other Stats Cards */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-blue-100 dark:border-blue-800/30 p-6 transition-all duration-300 hover:shadow-lg">
          <div className="flex flex-col items-center text-center">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
              <Truck className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
              Veículos Ativos
            </h3>
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {stats.activeVehicles}
            </span>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-green-100 dark:border-green-800/30 p-6 transition-all duration-300 hover:shadow-lg">
          <div className="flex flex-col items-center text-center">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
              <Users className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
              Motoristas Ativos
            </h3>
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {stats.activeDrivers}
            </span>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-amber-100 dark:border-amber-800/30 p-6 transition-all duration-300 hover:shadow-lg">
          <div className="flex flex-col items-center text-center">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full mb-4">
              <TrendingUp className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
              Média Diária (30 dias)
            </h3>
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {Math.round(stats.averageKmPerDay).toLocaleString('pt-BR')} km
            </span>
          </div>
        </div>
      </div>

      {/* Additional dashboard content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Drivers */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <Users className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Top Motoristas por Quilometragem
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
                Nenhum dado disponível
              </div>
            )}
          </div>
        </div>
        
        {/* Monthly Trend */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <BarChart2 className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Quilometragem Mensal
            </h3>
          </div>
          <div className="space-y-4">
            {stats.monthlyData.map((item, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {item.month}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {item.km.toLocaleString('pt-BR')} km
                  </span>
                </div>
                <div className="h-2 bg-blue-100 dark:bg-blue-900/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.max(
                        5, 
                        (item.km / Math.max(...stats.monthlyData.map(m => m.km), 1)) * 100
                      )}%` 
                    }}
                  />
                </div>
              </div>
            ))}
            
            {stats.monthlyData.length === 0 && (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                Nenhum dado disponível
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HodometrosDashboard;