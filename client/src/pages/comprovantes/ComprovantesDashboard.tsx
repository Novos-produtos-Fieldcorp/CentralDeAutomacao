import { useState, useEffect } from 'react';
import { FileText, Users, Calendar, MapPin, BarChart2, CheckCircle2, Clock } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import { supabase } from '../../lib/supabase';

interface DashboardStats {
  totalComprovantes: number;
  hoje: number;
  esteMes: number;
  monthlyData: {
    month: string;
    value: number;
  }[];
  porMotorista: {
    nome: string;
    total: number;
    percentual: number;
  }[];
  porCliente: {
    nome: string;
    total: number;
    percentual: number;
  }[];
}

const ComprovantesDashboard = () => {
  const { companyId } = useCompanyData();
  const [stats, setStats] = useState<DashboardStats>({
    totalComprovantes: 0,
    hoje: 0,
    esteMes: 0,
    monthlyData: [],
    porMotorista: [],
    porCliente: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [companyId]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Get date range for last 6 months
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const sixMonthsAgo = subMonths(today, 5);
      
      // Format dates for query
      const todayStr = startOfToday.toISOString();
      const monthStr = startOfMonth.toISOString();
      const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];
      const endDateStr = today.toISOString().split('T')[0];

      // Fetch total comprovantes
      const { data: totalData, error: totalError } = await supabase
        .from('comprovante')
        .select('id')
        .eq('company_id', companyId);

      if (totalError) throw totalError;

      // Fetch comprovantes from today
      const { data: todayData, error: todayError } = await supabase
        .from('comprovante')
        .select('id')
        .eq('company_id', companyId)
        .gte('created_at', todayStr);

      if (todayError) throw todayError;

      // Fetch comprovantes from this month
      const { data: monthData, error: monthError } = await supabase
        .from('comprovante')
        .select('id')
        .eq('company_id', companyId)
        .gte('created_at', monthStr);

      if (monthError) throw monthError;

      // Fetch data for monthly chart
      const { data: chartData, error: chartError } = await supabase
        .from('comprovante')
        .select('created_at')
        .eq('company_id', companyId)
        .gte('created_at', sixMonthsAgoStr)
        .lte('created_at', endDateStr);

      if (chartError) throw chartError;

      // Fetch data grouped by motorista
      const { data: motoristaData, error: motoristaError } = await supabase
        .from('comprovante')
        .select(`
          id,
          motorista:motorista_id (nome)
        `)
        .eq('company_id', companyId)
        .not('motorista_id', 'is', null);

      if (motoristaError) throw motoristaError;

      // Fetch data grouped by cliente
      const { data: clienteData, error: clienteError } = await supabase
        .from('comprovante')
        .select(`
          id,
          cliente:cliente_id (nome)
        `)
        .eq('company_id', companyId)
        .not('cliente_id', 'is', null);

      if (clienteError) throw clienteError;

      // Process monthly data
      const monthlyDataProcessed = calculateMonthlyData(chartData || []);

      // Process motorista data
      const motoristaStats = processGroupedData(motoristaData || [], 'motorista');

      // Process cliente data
      const clienteStats = processGroupedData(clienteData || [], 'cliente');

      setStats({
        totalComprovantes: totalData?.length || 0,
        hoje: todayData?.length || 0,
        esteMes: monthData?.length || 0,
        monthlyData: monthlyDataProcessed,
        porMotorista: motoristaStats,
        porCliente: clienteStats
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  const calculateMonthlyData = (data: any[]) => {
    const monthCounts: { [key: string]: number } = {};
    
    data.forEach(item => {
      const date = new Date(item.created_at);
      const monthKey = format(date, 'MMM yyyy', { locale: ptBR });
      monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
    });

    return Object.entries(monthCounts)
      .map(([month, value]) => ({ month, value }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
      .slice(-6);
  };

  const processGroupedData = (data: any[], type: 'motorista' | 'cliente') => {
    const counts: { [key: string]: number } = {};
    const total = data.length;

    data.forEach(item => {
      if (item[type] && item[type].nome) {
        const name = item[type].nome;
        counts[name] = (counts[name] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([nome, count]) => ({
        nome,
        total: count,
        percentual: total > 0 ? Math.round((count / total) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total de Comprovantes</p>
              <p className="text-3xl font-bold">{stats.totalComprovantes}</p>
            </div>
            <div className="bg-blue-400 bg-opacity-30 rounded-lg p-3">
              <FileText className="w-8 h-8" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Hoje</p>
              <p className="text-3xl font-bold">{stats.hoje}</p>
            </div>
            <div className="bg-green-400 bg-opacity-30 rounded-lg p-3">
              <Calendar className="w-8 h-8" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Este Mês</p>
              <p className="text-3xl font-bold">{stats.esteMes}</p>
            </div>
            <div className="bg-purple-400 bg-opacity-30 rounded-lg p-3">
              <BarChart2 className="w-8 h-8" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts and Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-500" />
            Comprovantes por Mês
          </h3>
          <div className="space-y-3">
            {stats.monthlyData.length > 0 ? (
              stats.monthlyData.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                    {item.month}
                  </span>
                  <div className="flex items-center gap-3 flex-1 mx-4">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${Math.max((item.value / Math.max(...stats.monthlyData.map(d => d.value))) * 100, 5)}%` 
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white min-w-[2rem] text-right">
                      {item.value}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                Nenhum dado disponível
              </p>
            )}
          </div>
        </div>

        {/* Top Motoristas */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-green-500" />
            Top Motoristas
          </h3>
          <div className="space-y-3">
            {stats.porMotorista.length > 0 ? (
              stats.porMotorista.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      index === 0 ? 'bg-yellow-500' : 
                      index === 1 ? 'bg-gray-400' : 
                      index === 2 ? 'bg-orange-600' : 'bg-blue-500'
                    }`}>
                      {index + 1}
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.nome}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {item.percentual}%
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {item.total}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                Nenhum motorista com comprovantes
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Top Clientes */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-purple-500" />
          Top Clientes
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.porCliente.length > 0 ? (
            stats.porCliente.map((item, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {item.nome}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {item.percentual}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div 
                      className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${item.percentual}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {item.total}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full">
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                Nenhum cliente com comprovantes
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComprovantesDashboard;