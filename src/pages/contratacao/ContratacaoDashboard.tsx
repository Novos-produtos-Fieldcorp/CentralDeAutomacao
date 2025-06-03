import React, { useState, useEffect, useMemo } from 'react';
import { Users, Truck, FileText, Award, CheckCircle2, XCircle, Calendar, MapPin, BarChart2, TrendingUp, AlertCircle } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import { supabase } from '../../lib/supabase';

interface DashboardStats {
  totalMotoristas: number;
  totalAgregados: number;
  documentacao: number;
  qualificados: number;
  contratosAtivos: number;
  rejeitados: number;
  monthlyRegistrations: {
    month: string;
    value: number;
  }[];
  clientesContratados: {
    nome: string;
    total: number;
    motoristas: number;
    agregados: number;
    percentual: number;
  }[];
}

const ContratacaoDashboard = () => {
  const { query, companyId } = useCompanyData();
  const [stats, setStats] = useState<DashboardStats>({
    totalMotoristas: 0,
    totalAgregados: 0,
    documentacao: 0,
    qualificados: 0,
    contratosAtivos: 0,
    rejeitados: 0,
    monthlyRegistrations: [],
    clientesContratados: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Get date range for last 6 months
      const today = new Date();
      const sixMonthsAgo = subMonths(today, 5);
      
      // Format dates for query
      const startDate = sixMonthsAgo.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];

      // First, get all clients for the company
      const { data: clientesData, error: clientesError } = await supabase
        .from('cliente')
        .select('cliente_id, nome')
        .eq('company_id', companyId);

      if (clientesError) throw clientesError;

      // Then get motoristas and agregados data
      const [totalMotoristasResponse, totalAgregadosResponse] = await Promise.all([
        supabase
          .from('vw_motoristas_completo')
          .select('*')
          .eq('company_id', companyId),
        supabase
          .from('vw_agregados_completo')
          .select('*')
          .eq('company_id', companyId)
      ]);
      
      if (totalMotoristasResponse.error) throw totalMotoristasResponse.error;
      if (totalAgregadosResponse.error) throw totalAgregadosResponse.error;

      const totalMotoristasData = totalMotoristasResponse.data || [];
      const totalAgregadosData = totalAgregadosResponse.data || [];

      // Then get data for monthly registrations with date filter
      const [motoristasDataResponse, agregadosDataResponse] = await Promise.all([
        supabase
          .from('vw_motoristas_completo')
          .select('*')
          .eq('company_id', companyId)
          .gte('data_cadastro', startDate)
          .lte('data_cadastro', endDate),
        supabase
          .from('vw_agregados_completo')
          .select('*')
          .eq('company_id', companyId)
          .gte('data_cadastro', startDate)
          .lte('data_cadastro', endDate)
      ]);
      
      if (motoristasDataResponse.error) throw motoristasDataResponse.error;
      if (agregadosDataResponse.error) throw agregadosDataResponse.error;

      const motoristasData = motoristasDataResponse.data || [];
      const agregadosData = agregadosDataResponse.data || [];

      if (totalMotoristasData && totalAgregadosData && motoristasData && agregadosData) {
        const totalMotoristas = totalMotoristasData.length;
        const totalAgregados = totalAgregadosData.length;
        const documentacao = [...totalMotoristasData, ...totalAgregadosData].filter(m => m.st_cadastro === 'documentacao').length;
        const qualificados = [...totalMotoristasData, ...totalAgregadosData].filter(m => m.st_cadastro === 'qualificado').length;
        const contratosAtivos = [...totalMotoristasData, ...totalAgregadosData].filter(m => m.st_cadastro === 'contratado').length;
        const rejeitados = [...totalMotoristasData, ...totalAgregadosData].filter(m => m.st_cadastro === 'rejeitado').length;

        // Calculate monthly registrations using date-filtered data
        const monthlyData = calculateMonthlyRegistrations([...motoristasData, ...agregadosData]);

        // Initialize clientesContratados with all clients
        const clientesContratados = (clientesData || []).reduce((acc: { [key: string]: { total: number, motoristas: number, agregados: number, cliente_id: number } }, cliente) => {
          acc[cliente.nome] = { 
            total: 0, 
            motoristas: 0, 
            agregados: 0,
            cliente_id: cliente.cliente_id
          };
          return acc;
        }, {});

        // Add "Sem Cliente" category
        clientesContratados['Sem Cliente'] = { total: 0, motoristas: 0, agregados: 0, cliente_id: 0 };

        // Calculate contractors by client using total data
        [...totalMotoristasData, ...totalAgregadosData]
          .filter(m => m.st_cadastro === 'contratado')
          .forEach(curr => {
            const clientName = curr.nome_cliente || 'Sem Cliente';
            if (!clientesContratados[clientName]) {
              clientesContratados[clientName] = { 
                total: 0, 
                motoristas: 0, 
                agregados: 0,
                cliente_id: curr.cliente_id || 0
              };
            }
            clientesContratados[clientName].total++;
            if (curr.funcao === 'Motorista') {
              clientesContratados[clientName].motoristas++;
            } else if (curr.funcao === 'Agregado') {
              clientesContratados[clientName].agregados++;
            }
          });

        const totalContratados = Object.values(clientesContratados).reduce((sum, client) => sum + client.total, 0);

        const clientesContratadosArray = Object.entries(clientesContratados)
          .map(([nome, data]) => ({ 
            nome, 
            total: data.total,
            motoristas: data.motoristas,
            agregados: data.agregados,
            cliente_id: data.cliente_id,
            percentual: totalContratados > 0 ? (data.total / totalContratados) * 100 : 0
          }))
          .sort((a, b) => b.total - a.total);

        setStats({
          totalMotoristas,
          totalAgregados,
          documentacao,
          qualificados,
          contratosAtivos,
          rejeitados,
          monthlyRegistrations: monthlyData,
          clientesContratados: clientesContratadosArray
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Function to calculate registrations by month for the last 6 months
  const calculateMonthlyRegistrations = (motoristas: any[]) => {
    // Create array of last 6 months
    const months: { key: string; name: string; count: number }[] = [];
    const today = new Date();
    
    for (let i = 0; i <= 5; i++) {
      const month = subMonths(today, i);
      const monthKey = format(month, 'yyyy-MM');
      const monthName = format(month, 'MMM', { locale: ptBR });
      
      months.push({
        key: monthKey,
        name: monthName.charAt(0).toUpperCase() + monthName.slice(1),
        count: 0
      });
    }
    
    // Count registrations for each month
    motoristas.forEach(motorista => {
      if (motorista.data_cadastro) {
        const cadastroDate = new Date(motorista.data_cadastro);
        const monthKey = format(cadastroDate, 'yyyy-MM');
        
        const monthIndex = months.findIndex(m => m.key === monthKey);
        if (monthIndex !== -1) {
          months[monthIndex].count++;
        }
      }
    });
    
    // Format for chart display
    return months.map(month => ({
      month: month.name,
      value: month.count
    }));
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  // Calculate values for charts based on actual data
  const cadastrados = (stats.totalMotoristas + stats.totalAgregados) - 
                      (stats.contratosAtivos + stats.qualificados + stats.documentacao + stats.rejeitados);
    
  // Client distribution - using actual data
  const contratadosMotoristas = stats.contratosAtivos > 0 ? 
    Math.floor(stats.contratosAtivos * (stats.totalMotoristas / (stats.totalMotoristas + stats.totalAgregados || 1))) : 0;
  
  const contratadosAgregados = stats.contratosAtivos - contratadosMotoristas;
  
  // Status distribution
  const statusDistribution = [
    { status: 'Cadastrado', value: Math.max(0, cadastrados) },
    { status: 'Contratado', value: stats.contratosAtivos },
    { status: 'Qualificado', value: stats.qualificados }
  ];
  
  // Calculate max values for proper bar scaling
  const maxStatusValue = Math.max(...statusDistribution.map(s => s.value), 1);

  return (
    <div className="space-y-8">
      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <StatCard
          title="Total de Motoristas"
          value={stats.totalMotoristas}
          icon={Users}
          variant="blue"
        />
        <StatCard
          title="Total de Agregados"
          value={stats.totalAgregados}
          icon={Truck}
          variant="blue-light"
        />
        <StatCard
          title="Documentação"
          value={stats.documentacao}
          icon={FileText}
          variant="blue"
        />
        <StatCard
          title="Qualificados"
          value={stats.qualificados}
          icon={Award}
          variant="blue-light"
        />
        <StatCard
          title="Contratos Ativos"
          value={stats.contratosAtivos}
          icon={CheckCircle2}
          variant="blue"
        />
        <StatCard
          title="Rejeitados"
          value={stats.rejeitados}
          icon={XCircle}
          variant="blue-light"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Registrations */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <Calendar className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Registros nos Últimos 6 Meses
            </h3>
          </div>
          <div className="space-y-6">
            {stats.monthlyRegistrations.map((item, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {item.month}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {item.value} registros
                  </span>
                </div>
                <div className="h-2 bg-blue-100 dark:bg-blue-900/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.max(
                        5, 
                        (item.value / Math.max(...stats.monthlyRegistrations.map(m => m.value), 1)) * 100
                      )}%` 
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contracted by Client */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <Users className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Contratados por Cliente
            </h3>
          </div>
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Total: {stats.contratosAtivos} contratados
                </p>
              </div>
              <div className="space-y-4">
                {stats.clientesContratados.map((cliente, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{cliente.nome}</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {cliente.total} ({cliente.percentual.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-blue-100 dark:bg-blue-900/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300"
                        style={{ width: `${cliente.percentual}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>Motoristas: {cliente.motoristas}</span>
                      <span>Agregados: {cliente.agregados}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Top 3 Cities */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <MapPin className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Distribuição por Tipo
            </h3>
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Motoristas
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {stats.totalMotoristas} cadastrados
                </span>
              </div>
              <div className="h-2 bg-blue-100 dark:bg-blue-900/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300"
                  style={{ width: `${(stats.totalMotoristas / (stats.totalMotoristas + stats.totalAgregados || 1)) * 100}%` }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Agregados
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {stats.totalAgregados} cadastrados
                </span>
              </div>
              <div className="h-2 bg-blue-100 dark:bg-blue-900/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300"
                  style={{ width: `${(stats.totalAgregados / (stats.totalMotoristas + stats.totalAgregados || 1)) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <BarChart2 className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Distribuição por Status
            </h3>
          </div>
          <div className="space-y-6">
            {statusDistribution.map((status, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {status.status}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {status.value} motoristas
                  </span>
                </div>
                <div className="h-2 bg-blue-100 dark:bg-blue-900/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300"
                    style={{ width: `${maxStatusValue > 0 ? (status.value / maxStatusValue) * 100 : 0}%` }}
                  />
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
  variant = 'blue'
}: { 
  title: string;
  value: number;
  icon: any;
  variant?: 'blue' | 'blue-light';
}) => {
  const variants = {
    'blue': {
      icon: 'text-blue-500 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20'
    },
    'blue-light': {
      icon: 'text-blue-400 dark:text-blue-300',
      bg: 'bg-blue-50/80 dark:bg-blue-900/10'
    }
  };

  const style = variants[variant];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-md min-h-[160px] flex flex-col">
      <div className="flex flex-col items-center text-center h-full">
        {/* Icon Container */}
        <div className={`p-3 rounded-lg ${style.bg} mb-3`}>
          <Icon className={`w-6 h-6 ${style.icon}`} />
        </div>
        
        {/* Title Container - Allow wrapping for long titles */}
        <div className="flex-1 flex items-center">
          <h3 className="text-[18px] font-medium text-gray-600 dark:text-gray-400 leading-tight">
            {title}
          </h3>
        </div>
        
        {/* Value Container */}
        <div className="mt-3">
          <span className="text-[16px] font-bold text-gray-900 dark:text-white">
            {value}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ContratacaoDashboard;