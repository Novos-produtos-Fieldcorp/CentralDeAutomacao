import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Truck, Users, Gauge, TrendingUp, BarChart2, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useDateRange } from '../../hooks/useDateRange';
import PeriodSelector from '../../components/hodometros/PeriodSelector';
import LoadingSpinner from '../../components/LoadingSpinner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardStats {
  totalKm: number;
  totalVehicles: number;
  totalDrivers: number;
  avgKmPerVehicle: number;
  topDrivers: {
    nome: string;
    km: number;
  }[];
  topVehicles: {
    placa: string;
    km: number;
  }[];
  dailyKm: {
    date: string;
    km: number;
  }[];
}

const HodometrosDashboard = () => {
  const { query } = useCompanyData();
  const [stats, setStats] = useState<DashboardStats>({
    totalKm: 0,
    totalVehicles: 0,
    totalDrivers: 0,
    avgKmPerVehicle: 0,
    topDrivers: [],
    topVehicles: [],
    dailyKm: []
  });
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('30days');

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch all hodometro readings within the date range
      const { data: hodometros, error: hodometrosError } = await supabase
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
        .gte('data', dateRange.startDate)
        .lte('data', dateRange.endDate)
        .order('data', { ascending: true })
        .order('hora', { ascending: true });

      if (hodometrosError) throw hodometrosError;

      // Process the data
      const processedData = processHodometrosData(hodometros || []);
      setStats(processedData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  const processHodometrosData = (hodometros: any[]) => {
    // Group readings by motorista_id, veiculo_id, and date
    const groupedByMotoristaVeiculoDate: Record<string, any[]> = {};
    
    hodometros.forEach(hodometro => {
      if (!hodometro.motorista_id || !hodometro.veiculo_id || !hodometro.data) return;
      
      const key = `${hodometro.motorista_id}_${hodometro.veiculo_id}_${hodometro.data}`;
      if (!groupedByMotoristaVeiculoDate[key]) {
        groupedByMotoristaVeiculoDate[key] = [];
      }
      groupedByMotoristaVeiculoDate[key].push(hodometro);
    });
    
    // Calculate km driven for each motorista-veiculo-date combination
    const kmByMotoristaVeiculoDate: Record<string, number> = {};
    
    Object.entries(groupedByMotoristaVeiculoDate).forEach(([key, readings]) => {
      if (readings.length < 2) return; // Need at least 2 readings to calculate difference
      
      // Sort readings by time
      readings.sort((a, b) => {
        const timeA = `${a.data} ${a.hora}`;
        const timeB = `${b.data} ${b.hora}`;
        return timeA.localeCompare(timeB);
      });
      
      const firstReading = readings[0];
      const lastReading = readings[readings.length - 1];
      
      // Check if it's an electric vehicle (has battery readings)
      const isElectric = firstReading.bateria !== null && firstReading.bateria !== undefined;
      
      let kmDriven = 0;
      if (isElectric) {
        // For electric vehicles, use trip_lida
        const firstTrip = firstReading.trip_lida || 0;
        const lastTrip = lastReading.trip_lida || 0;
        kmDriven = Math.max(0, lastTrip - firstTrip);
      } else {
        // For regular vehicles, use hod_lido
        const firstHod = firstReading.hod_lido || 0;
        const lastHod = lastReading.hod_lido || 0;
        kmDriven = Math.max(0, lastHod - firstHod);
      }
      
      kmByMotoristaVeiculoDate[key] = kmDriven;
    });
    
    // Calculate total km driven
    const totalKm = Object.values(kmByMotoristaVeiculoDate).reduce((sum, km) => sum + km, 0);
    
    // Calculate km by motorista
    const kmByMotorista: Record<number, { nome: string; km: number }> = {};
    
    Object.entries(kmByMotoristaVeiculoDate).forEach(([key, km]) => {
      const [motoristaId] = key.split('_');
      const motorista = hodometros.find(h => h.motorista_id === parseInt(motoristaId))?.motorista;
      
      if (motorista) {
        if (!kmByMotorista[motorista.motorista_id]) {
          kmByMotorista[motorista.motorista_id] = { nome: motorista.nome, km: 0 };
        }
        kmByMotorista[motorista.motorista_id].km += km;
      }
    });
    
    // Calculate km by veiculo
    const kmByVeiculo: Record<number, { placa: string; km: number }> = {};
    
    Object.entries(kmByMotoristaVeiculoDate).forEach(([key, km]) => {
      const [_, veiculoId] = key.split('_');
      const veiculo = hodometros.find(h => h.veiculo_id === parseInt(veiculoId))?.veiculo;
      
      if (veiculo) {
        if (!kmByVeiculo[veiculo.veiculo_id]) {
          kmByVeiculo[veiculo.veiculo_id] = { placa: veiculo.placa.toUpperCase(), km: 0 };
        }
        kmByVeiculo[veiculo.veiculo_id].km += km;
      }
    });
    
    // Calculate km by date
    const kmByDate: Record<string, number> = {};
    
    Object.entries(kmByMotoristaVeiculoDate).forEach(([key, km]) => {
      const [_, __, date] = key.split('_');
      
      if (!kmByDate[date]) {
        kmByDate[date] = 0;
      }
      kmByDate[date] += km;
    });
    
    // Get unique vehicles and drivers
    const uniqueVehicles = new Set(hodometros.map(h => h.veiculo_id).filter(Boolean));
    const uniqueDrivers = new Set(hodometros.map(h => h.motorista_id).filter(Boolean));
    
    // Calculate average km per vehicle
    const avgKmPerVehicle = uniqueVehicles.size > 0 ? totalKm / uniqueVehicles.size : 0;
    
    // Get top drivers
    const topDrivers = Object.values(kmByMotorista)
      .sort((a, b) => b.km - a.km)
      .slice(0, 5);
    
    // Get top vehicles
    const topVehicles = Object.values(kmByVeiculo)
      .sort((a, b) => b.km - a.km)
      .slice(0, 5);
    
    // Format daily km data for chart
    const dailyKm = Object.entries(kmByDate)
      .map(([date, km]) => ({ date, km }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    return {
      totalKm,
      totalVehicles: uniqueVehicles.size,
      totalDrivers: uniqueDrivers.size,
      avgKmPerVehicle,
      topDrivers,
      topVehicles,
      dailyKm
    };
  };

  const toggleSection = (section: string) => {
    if (expandedSection === section) {
      setExpandedSection(null);
    } else {
      setExpandedSection(section);
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total KM Rodado"
          value={formatNumber(stats.totalKm)}
          icon={Gauge}
          color="blue"
        />
        <StatCard
          title="Veículos Ativos"
          value={formatNumber(stats.totalVehicles)}
          icon={Truck}
          color="green"
        />
        <StatCard
          title="Motoristas Ativos"
          value={formatNumber(stats.totalDrivers)}
          icon={Users}
          color="purple"
        />
        <StatCard
          title="Média KM/Veículo"
          value={formatNumber(stats.avgKmPerVehicle)}
          icon={TrendingUp}
          color="amber"
        />
      </div>

      {/* Top Drivers */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div 
          className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center cursor-pointer"
          onClick={() => toggleSection('drivers')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Top Motoristas por KM
            </h3>
          </div>
          {expandedSection === 'drivers' ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
        
        {(expandedSection === 'drivers' || expandedSection === null) && (
          <div className="p-4">
            {stats.topDrivers.length > 0 ? (
              <div className="space-y-4">
                {stats.topDrivers.map((driver, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {driver.nome}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {formatNumber(driver.km)} km
                      </span>
                    </div>
                    <div className="h-2 bg-blue-100 dark:bg-blue-900/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 dark:bg-blue-400 rounded-full"
                        style={{ width: `${(driver.km / stats.topDrivers[0].km) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                Nenhum dado disponível para o período selecionado
              </div>
            )}
          </div>
        )}
      </div>

      {/* Top Vehicles */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div 
          className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center cursor-pointer"
          onClick={() => toggleSection('vehicles')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <Truck className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Top Veículos por KM
            </h3>
          </div>
          {expandedSection === 'vehicles' ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
        
        {(expandedSection === 'vehicles' || expandedSection === null) && (
          <div className="p-4">
            {stats.topVehicles.length > 0 ? (
              <div className="space-y-4">
                {stats.topVehicles.map((vehicle, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {vehicle.placa}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {formatNumber(vehicle.km)} km
                      </span>
                    </div>
                    <div className="h-2 bg-green-100 dark:bg-green-900/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 dark:bg-green-400 rounded-full"
                        style={{ width: `${(vehicle.km / stats.topVehicles[0].km) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                Nenhum dado disponível para o período selecionado
              </div>
            )}
          </div>
        )}
      </div>

      {/* Daily KM Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div 
          className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center cursor-pointer"
          onClick={() => toggleSection('daily')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <BarChart2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              KM Rodado por Dia
            </h3>
          </div>
          {expandedSection === 'daily' ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
        
        {(expandedSection === 'daily' || expandedSection === null) && (
          <div className="p-4">
            {stats.dailyKm.length > 0 ? (
              <div className="space-y-4">
                {stats.dailyKm.map((day, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {format(parseISO(day.date), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {formatNumber(day.km)} km
                      </span>
                    </div>
                    <div className="h-2 bg-purple-100 dark:bg-purple-900/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-purple-500 dark:bg-purple-400 rounded-full"
                        style={{ 
                          width: `${Math.max(
                            5, 
                            (day.km / Math.max(...stats.dailyKm.map(d => d.km), 1)) * 100
                          )}%` 
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                Nenhum dado disponível para o período selecionado
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: string;
  icon: React.FC<{ className?: string }>;
  color: 'blue' | 'green' | 'purple' | 'amber';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color }) => {
  const colorClasses = {
    blue: {
      bg: 'bg-blue-100 dark:bg-blue-900/20',
      text: 'text-blue-600 dark:text-blue-400'
    },
    green: {
      bg: 'bg-green-100 dark:bg-green-900/20',
      text: 'text-green-600 dark:text-green-400'
    },
    purple: {
      bg: 'bg-purple-100 dark:bg-purple-900/20',
      text: 'text-purple-600 dark:text-purple-400'
    },
    amber: {
      bg: 'bg-amber-100 dark:bg-amber-900/20',
      text: 'text-amber-600 dark:text-amber-400'
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${colorClasses[color].bg}`}>
          <Icon className={`w-6 h-6 ${colorClasses[color].text}`} />
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {title}
          </h3>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
};

export default HodometrosDashboard;