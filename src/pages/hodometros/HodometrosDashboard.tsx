import React, { useState, useEffect } from 'react';
import { Calendar, Users, Car, TrendingUp, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PeriodSelector } from '../../components/hodometros/PeriodSelector';
import { DriverMileageChart } from '../../components/hodometros/DriverMileageChart';

interface MileageData {
  id: string;
  veiculo_id: string;
  motorista_id: string;
  quilometragem: number;
  data_leitura: string;
  foto_url?: string;
  veiculo?: {
    placa: string;
    modelo: string;
  };
  motorista?: {
    nome: string;
  };
}

interface DashboardStats {
  totalKm: number;
  totalDrivers: number;
  totalVehicles: number;
  avgKmPerDay: number;
}

const HodometrosDashboard: React.FC = () => {
  const [mileageData, setMileageData] = useState<MileageData[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalKm: 0,
    totalDrivers: 0,
    totalVehicles: 0,
    avgKmPerDay: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('30');

  useEffect(() => {
    fetchMileageData();
  }, [selectedPeriod]);

  const fetchMileageData = async () => {
    try {
      setLoading(true);
      
      const daysAgo = parseInt(selectedPeriod);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      
      const { data, error } = await supabase
        .from('hodometros')
        .select(`
          *,
          veiculo:veiculos(placa, modelo),
          motorista:motoristas(nome)
        `)
        .gte('data_leitura', startDate.toISOString())
        .order('data_leitura', { ascending: false });

      if (error) throw error;

      setMileageData(data || []);
      calculateStats(data || []);
    } catch (error) {
      console.error('Erro ao buscar dados de hodômetros:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: MileageData[]) => {
    const totalKm = data.reduce((sum, item) => sum + item.quilometragem, 0);
    const uniqueDrivers = new Set(data.map(item => item.motorista_id)).size;
    const uniqueVehicles = new Set(data.map(item => item.veiculo_id)).size;
    const avgKmPerDay = data.length > 0 ? totalKm / parseInt(selectedPeriod) : 0;

    setStats({
      totalKm,
      totalDrivers: uniqueDrivers,
      totalVehicles: uniqueVehicles,
      avgKmPerDay
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-background dark:bg-[#1B1F2B] min-h-screen p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Dashboard de Hodômetros
        </h1>
        <PeriodSelector
          selectedPeriod={selectedPeriod}
          onPeriodChange={setSelectedPeriod}
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total de Quilometragem"
          value={stats.totalKm}
          icon={TrendingUp}
          color="blue"
          unit="km"
        />
        <StatCard
          title="Motoristas Ativos"
          value={stats.totalDrivers}
          icon={Users}
          color="green"
        />
        <StatCard
          title="Veículos Monitorados"
          value={stats.totalVehicles}
          icon={Car}
          color="purple"
        />
        <StatCard
          title="Média Diária"
          value={Math.round(stats.avgKmPerDay)}
          icon={Clock}
          color="amber"
          unit="km/dia"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card dark:bg-[#1B1F2B] p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quilometragem por Motorista
          </h3>
          <DriverMileageChart data={mileageData} />
        </div>

        <div className="bg-card dark:bg-[#1B1F2B] p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Leituras Recentes
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {mileageData.slice(0, 10).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {item.veiculo?.placa} - {item.motorista?.nome}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(item.data_leitura).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {item.quilometragem.toLocaleString('pt-BR')} km
                  </p>
                </div>
              </div>
            ))}
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
  color = 'blue',
  unit = ''
}: { 
  title: string;
  value: number;
  icon: any;
  color?: 'blue' | 'green' | 'purple' | 'amber' | 'red';
  unit?: string;
}) => {
  const colorVariants = {
    blue: {
      iconBg: 'bg-blue-100 dark:bg-blue-900/20',
      iconColor: 'text-blue-600 dark:text-blue-400',
      gradient: 'from-blue-600 to-blue-800',
      darkGradient: 'dark:from-blue-400 dark:to-blue-600'
    },
    green: {
      iconBg: 'bg-green-100 dark:bg-green-900/20',
      iconColor: 'text-green-600 dark:text-green-400',
      gradient: 'from-green-600 to-green-800',
      darkGradient: 'dark:from-green-400 dark:to-green-600'
    },
    purple: {
      iconBg: 'bg-purple-100 dark:bg-purple-900/20',
      iconColor: 'text-purple-600 dark:text-purple-400',
      gradient: 'from-purple-600 to-purple-800',
      darkGradient: 'dark:from-purple-400 dark:to-purple-600'
    },
    amber: {
      iconBg: 'bg-amber-100 dark:bg-amber-900/20',
      iconColor: 'text-amber-600 dark:text-amber-400',
      gradient: 'from-amber-600 to-amber-800',
      darkGradient: 'dark:from-amber-400 dark:to-amber-600'
    },
    red: {
      iconBg: 'bg-red-100 dark:bg-red-900/20',
      iconColor: 'text-red-600 dark:text-red-400',
      gradient: 'from-red-600 to-red-800',
      darkGradient: 'dark:from-red-400 dark:to-red-600'
    }
  };

  const variant = colorVariants[color];

  return (
    <div className="bg-white dark:bg-card p-6 rounded-2xl shadow-lg transition-all duration-300 transform hover:-translate-y-1">
      <div className="flex flex-col items-center text-center">
        <div className={`p-3 ${variant.iconBg} rounded-2xl mb-3`}>
          <Icon className={`w-6 h-6 ${variant.iconColor}`} />
        </div>
        
        <h3 className="text-sm font-medium text-gray-400 mb-2">
          {title}
        </h3>
        
        <p className={`text-3xl font-bold bg-gradient-to-r ${variant.gradient} ${variant.darkGradient} bg-clip-text text-transparent`}>
          {value.toLocaleString('pt-BR')}{unit && ` ${unit}`}
        </p>
      </div>
    </div>
  );
};

export default HodometrosDashboard;