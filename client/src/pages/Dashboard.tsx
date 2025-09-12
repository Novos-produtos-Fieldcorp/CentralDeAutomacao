import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ClipboardCheck,
  FileDown,
  Gauge,
  Store,
  Truck,
  Users,
  Lock,
  AlertTriangle,
  MessagesSquare,
  Tag,
  Briefcase,
  FileText,
  Activity,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useModuleAccess } from "../hooks/useModuleAccess";
import { useWiseAppAccess } from "../context/WiseAppAccessContext";
import ImportExportModal from "../components/ImportExportModal";
import LoadingSpinner from "../components/LoadingSpinner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../lib/supabase';

interface MenuItem {
  title: string;
  icon: LucideIcon;
  link: string;
  description: string;
  enabled: boolean;
  isSpecial?: boolean;
  onClick?: () => void;
}

interface StatCard {
  title: string;
  count: number;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'violet';
  link: string;
}

interface DashboardStats {
  motoristas: number;
  veiculos: number;
  checklists: number;
  comprovantes: number;
  hodometros: number;
  monthlyData: { month: string; value: number }[];
  distributionData: { name: string; value: number; color: string }[];
  recentLogs: { time: string; action: string; user: string; icon: LucideIcon }[];
}

const MenuCard = ({
  title,
  icon: Icon,
  link,
  description,
  enabled = true,
  isSpecial = false,
  onClick,
}: MenuItem) => {
  const cardContent = (
    <>
      <div
        className={`absolute inset-0 bg-gradient-to-br ${
          isSpecial
            ? "from-orange-500/10 to-amber-500/5"
            : "from-primary/5 to-transparent"
        } opacity-0 transition-opacity duration-300 ${enabled ? "group-hover:opacity-100" : ""}`}
      />
      <div className="relative flex flex-col h-full justify-between p-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 flex items-center justify-center ${
                isSpecial
                  ? "bg-orange-100 dark:bg-orange-900/30 group-hover:bg-orange-200 dark:group-hover:bg-orange-800/40"
                  : "bg-blue-100 dark:bg-blue-900/30 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40"
              } rounded-full transform transition-all duration-300 ${enabled ? "group-hover:scale-110" : ""}`}
            >
              <Icon
                className={`w-6 h-6 ${
                  isSpecial
                    ? "text-orange-600 dark:text-orange-400 group-hover:text-orange-700 dark:group-hover:text-orange-300"
                    : "text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300"
                } transition-colors duration-300`}
              />
            </div>

            <h3
              className={`text-xl font-bold ${
                isSpecial
                  ? "text-orange-700 dark:text-orange-400"
                  : "text-gray-800 dark:text-white"
              }`}
            >
              {title}
              {!enabled && (
                <Lock className="w-4 h-4 text-gray-400 dark:text-gray-600 ml-2 inline-block" />
              )}
            </h3>
          </div>

          <p
            className={`text-base text-center mt-8 ${
              isSpecial
                ? "text-orange-700/80 dark:text-orange-300/90"
                : "text-gray-600 dark:text-gray-300"
            }`}
          >
            {description}
          </p>
        </div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <div
        onClick={onClick}
        className={`group relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl 
                 border ${isSpecial ? "border-orange-200 dark:border-orange-800/50" : "border-gray-200 dark:border-gray-700"} 
                 shadow-md hover:shadow-lg
                 transform hover:-translate-y-1 transition-all duration-300
                 w-full h-[200px] flex flex-col justify-between
                 cursor-pointer`}
        aria-label={`Acessar ${title}`}
      >
        {cardContent}
      </div>
    );
  }

  return enabled ? (
    <Link
      to={link}
      className={`group relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl 
                 border ${isSpecial ? "border-orange-200 dark:border-orange-800/50" : "border-gray-200 dark:border-gray-700"} 
                 shadow-md hover:shadow-lg
                 transform hover:-translate-y-1 transition-all duration-300
                 w-full h-[200px] flex flex-col justify-between`}
      aria-label={`Acessar ${title}`}
    >
      {cardContent}
    </Link>
  ) : (
    <div
      className="group relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl 
                 border border-gray-200 dark:border-gray-700 shadow-md opacity-60
                 w-full h-[200px] flex flex-col justify-between
                 cursor-not-allowed select-none"
      aria-disabled="true"
    >
      {cardContent}
    </div>
  );
};

const StatCard = ({ title, count, icon: Icon, color, link }: StatCard) => {
  const colorClasses = {
    blue: 'bg-blue-500 text-white',
    green: 'bg-green-500 text-white',
    purple: 'bg-purple-500 text-white',
    orange: 'bg-orange-500 text-white'
  };

  return (
    <Link to={link} className="block">
      <div className={`${colorClasses[color]} rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1`}>
        <div className="flex items-center justify-between mb-4">
          <Icon className="w-8 h-8" />
          <div className="text-right">
            <p className="text-sm opacity-90">{title}</p>
          </div>
        </div>
        <div className="text-4xl font-bold mb-2">{count}</div>
      </div>
    </Link>
  );
};

const Dashboard = () => {
  const { loading, moduleAccess } = useModuleAccess();
  const { companyId } = useWiseAppAccess();
  const [isImportExportModalOpen, setIsImportExportModalOpen] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    motoristas: 0,
    veiculos: 0,
    checklists: 0,
    comprovantes: 0,
    hodometros: 0,
    monthlyData: [],
    distributionData: [],
    recentLogs: []
  });
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (companyId) {
      fetchDashboardData();
    } else {
      // Se não tiver companyId, manter loading como false para não travar a UI
      setStatsLoading(false);
    }
  }, [companyId]);

  const fetchDashboardData = async () => {
    try {
      setStatsLoading(true);
      
      // Fetch counts in parallel with error checking
      const [motoristasResult, veiculosResult, checklistsResult, comprovantesResult, hodometroResult] = await Promise.all([
        supabase.from('motorista').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('veiculo').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('checklist').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('comprovante').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('hodometro').select('*', { count: 'exact', head: true }).eq('company_id', companyId)
      ]);
      
      if (motoristasResult.error) throw new Error(`Erro ao buscar motoristas: ${motoristasResult.error.message}`);
      if (veiculosResult.error) throw new Error(`Erro ao buscar veículos: ${veiculosResult.error.message}`);
      if (checklistsResult.error) throw new Error(`Erro ao buscar checklists: ${checklistsResult.error.message}`);
      if (comprovantesResult.error) throw new Error(`Erro ao buscar comprovantes: ${comprovantesResult.error.message}`);
      if (hodometroResult.error) throw new Error(`Erro ao buscar hodômetros: ${hodometroResult.error.message}`);
      
      const motoristasCount = motoristasResult.count;
      const veiculosCount = veiculosResult.count;
      const checklistsCount = checklistsResult.count;
      const comprovantesCount = comprovantesResult.count;
      const hodometroCount = hodometroResult.count;
      
      // Fetch monthly data (non-critical)
      let monthlyData = [];
      try {
        const sixMonthsAgo = subMonths(new Date(), 5);
        const { data: monthlyComprovantes, error: monthlyError } = await supabase
          .from('comprovante')
          .select('created_at')
          .eq('company_id', companyId)
          .gte('created_at', sixMonthsAgo.toISOString())
          .order('created_at', { ascending: true });
        
        if (monthlyError) throw monthlyError;
        
        // Process monthly data
        const monthlyDataMap: { [key: string]: number } = {};
        (monthlyComprovantes || []).forEach(item => {
          const date = new Date(item.created_at);
          const monthKey = format(date, 'MMM yyyy', { locale: ptBR });
          monthlyDataMap[monthKey] = (monthlyDataMap[monthKey] || 0) + 1;
        });
        
        for (let i = 5; i >= 0; i--) {
          const date = subMonths(new Date(), i);
          const month = format(date, 'MMM', { locale: ptBR });
          const fullMonth = format(date, 'MMM yyyy', { locale: ptBR });
          monthlyData.push({ month, value: monthlyDataMap[fullMonth] || 0 });
        }
      } catch (error) {
        console.warn('Erro ao buscar dados mensais:', error);
        // Default empty monthly data
        for (let i = 5; i >= 0; i--) {
          const date = subMonths(new Date(), i);
          const month = format(date, 'MMM', { locale: ptBR });
          monthlyData.push({ month, value: 0 });
        }
      }
      
      // Distribution data (non-critical)
      let distributionData = [];
      try {
        const { data: motoristaTypes, error: typesError } = await supabase
          .from('motorista')
          .select('tipo')
          .eq('company_id', companyId);
        
        if (typesError) throw typesError;
        
        const typeCount: { [key: string]: number } = {};
        (motoristaTypes || []).forEach(item => {
          const tipo = item.tipo || 'Não definido';
          typeCount[tipo] = (typeCount[tipo] || 0) + 1;
        });
        
        const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];
        distributionData = Object.entries(typeCount).map(([name, value], index) => ({
          name,
          value,
          color: colors[index % colors.length]
        }));
      } catch (error) {
        console.warn('Erro ao buscar distribuição de tipos:', error);
        // Default distribution with totals
        distributionData = [
          { name: 'Motoristas', value: motoristasCount || 0, color: '#10B981' }
        ];
      }
      
      // Recent activity logs (non-critical)
      let recentLogsProcessed: { time: string; action: string; user: string; icon: LucideIcon }[] = [];
      try {
        const recentLogs: { time: string; action: string; user: string; icon: LucideIcon; timestamp: number }[] = [];
        
        // Fetch recent data in parallel
        const [motoristasResult, comprovantesResult, veiculosResult] = await Promise.all([
          supabase.from('motorista').select('nome, created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(2),
          supabase.from('comprovante').select('created_at, cliente_id').eq('company_id', companyId).order('created_at', { ascending: false }).limit(2),
          supabase.from('veiculo').select('placa, created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1)
        ]);
        
        // Get cliente names for comprovantes
        let clienteNames: { [key: string]: string } = {};
        if (comprovantesResult.data && comprovantesResult.data.length > 0) {
          const clienteIds = comprovantesResult.data.map(c => c.cliente_id).filter(Boolean);
          if (clienteIds.length > 0) {
            const { data: clientes } = await supabase
              .from('cliente')
              .select('cliente_id, nome')
              .in('cliente_id', clienteIds);
            
            if (clientes) {
              clienteNames = clientes.reduce((acc, cliente) => {
                acc[cliente.cliente_id] = cliente.nome;
                return acc;
              }, {} as { [key: string]: string });
            }
          }
        }
        
        // Build recent logs array
        (motoristasResult.data || []).forEach(item => {
          const timestamp = new Date(item.created_at).getTime();
          recentLogs.push({
            timestamp,
            time: format(new Date(item.created_at), 'dd/MM HH:mm'),
            action: `${item.nome} contratado`,
            user: '',
            icon: Users
          });
        });
        
        (veiculosResult.data || []).forEach(item => {
          const timestamp = new Date(item.created_at).getTime();
          recentLogs.push({
            timestamp,
            time: format(new Date(item.created_at), 'dd/MM HH:mm'),
            action: `Veículo ${item.placa} cadastrado`,
            user: '',
            icon: Truck
          });
        });
        
        (comprovantesResult.data || []).forEach(item => {
          const clienteName = clienteNames[item.cliente_id] || 'Cliente não identificado';
          const timestamp = new Date(item.created_at).getTime();
          recentLogs.push({
            timestamp,
            time: format(new Date(item.created_at), 'dd/MM HH:mm'),
            action: `Novo comprovante - ${clienteName}`,
            user: '',
            icon: FileText
          });
        });
        
        // Sort and limit logs, remove timestamp for UI
        const sortedLogs = recentLogs.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
        recentLogsProcessed = sortedLogs.map(({ timestamp, ...rest }) => rest);
        
      } catch (error) {
        console.warn('Erro ao buscar logs recentes:', error);
        recentLogsProcessed = [];
      }
      
      setStats({
        motoristas: motoristasCount || 0,
        veiculos: veiculosCount || 0,
        checklists: checklistsCount || 0,
        comprovantes: comprovantesCount || 0,
        hodometros: hodometroCount || 0,
        monthlyData,
        distributionData,
        recentLogs: recentLogsProcessed
      });
      
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error instanceof Error ? { message: error.message, stack: error.stack } : error);
      // Set default empty data on error
      setStats({
        motoristas: 0,
        veiculos: 0,
        checklists: 0,
        comprovantes: 0,
        hodometros: 0,
        monthlyData: [],
        distributionData: [],
        recentLogs: []
      });
    } finally {
      setStatsLoading(false);
    }
  };

  if (loading || statsLoading) {
    return <LoadingSpinner />;
  }

  const menuItems: MenuItem[] = [
    {
      title: "Checklists",
      icon: ClipboardCheck,
      link: "/checklist",
      description: "Gerencie os checklists semanais e mensais",
      enabled: moduleAccess.checklist,
    },
    {
      title: "Contratações",
      icon: Users,
      link: "/motoristas",
      description:
        "Gerencie as informações para contratação de novos motoristas e agregados",
      enabled: moduleAccess.motoristas,
    },
    {
      title: "Vagas",
      icon: Briefcase,
      link: "/vagas",
      description:
        "Gerencie as vagas de emprego e processos seletivos da empresa",
      enabled: moduleAccess.vagas,
    },
    {
      title: "Veículos",
      icon: Truck,
      link: "/veiculos",
      description: "Gerencie os veículos dos agregados e da sua empresa",
      enabled: moduleAccess.veiculos,
    },
    {
      title: "Hodômetros",
      icon: Gauge,
      link: "/hodometros",
      description: "Acompanhe a leitura de hodômetro dos seus motoristas",
      enabled: moduleAccess.hodometros,
    },
    {
      title: "Clientes",
      icon: Store,
      link: "/clientes",
      description: "Gerencie os clientes da sua empresa",
      enabled: moduleAccess.clientes,
    },
    {
      title: "Resumos em Grupo",
      icon: MessagesSquare,
      link: "/resumos-grupo",
      description: "Configure resumos automáticos para seus grupos de WhatsApp",
      enabled: moduleAccess.resumos,
    },
    {
      title: "Marcadores",
      icon: Tag,
      link: "/tags-admin",
      description:
        "Gerencie marcadores para categorizar e organizar motoristas",
      enabled: moduleAccess.tags,
    },
    {
      title: "Comprovantes",
      icon: FileText,
      link: "/comprovantes",
      description:
        "Gerencie Comprovantes para acompanhar as entregas e envios dos motoristas",
      enabled: moduleAccess.comprovantes,
    },
  ];

  const statCards: StatCard[] = [
    {
      title: "Motoristas",
      count: stats.motoristas,
      icon: Users,
      color: "blue",
      link: "/motoristas"
    },
    {
      title: "Veículos",
      count: stats.veiculos,
      icon: Truck,
      color: "green",
      link: "/veiculos"
    },
    {
      title: "Checklists",
      count: stats.checklists,
      icon: ClipboardCheck,
      color: "purple",
      link: "/checklist"
    },
    {
      title: "Comprovantes",
      count: stats.comprovantes,
      icon: FileText,
      color: "orange",
      link: "/comprovantes"
    },
    {
      title: "Hodômetros",
      count: stats.hodometros,
      icon: Gauge,
      color: "purple",
      link: "/hodometros"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 dark:from-blue-400 dark:to-blue-300 bg-clip-text text-transparent mb-4 md:mb-0">
            Central de Automações
          </h1>
          <button
            onClick={() => setIsImportExportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FileDown className="w-4 h-4" />
            Importar Dados
          </button>
        </header>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((card, index) => (
            <StatCard key={index} {...card} />
          ))}
        </div>

        {/* Charts and Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Monthly Records Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-blue-500" />
              Comprovantes dos últimos 6 meses
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" className="text-sm" />
                  <YAxis className="text-sm" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(59, 130, 246, 0.9)',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#3B82F6"
                    strokeWidth={3}
                    dot={{ fill: '#3B82F6', strokeWidth: 2, r: 6 }}
                    activeDot={{ r: 8, stroke: '#3B82F6', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Distribution Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <Activity className="w-6 h-6 text-green-500" />
              Distribuição por Tipo de Motorista
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.distributionData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {stats.distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              {stats.distributionData.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Logs */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <FileText className="w-6 h-6 text-purple-500" />
            Logs Recentes
          </h3>
          <div className="space-y-4">
            {stats.recentLogs.map((log, index) => {
              const IconComponent = log.icon;
              return (
                <div key={index} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400 min-w-[80px]">
                    {log.time}
                  </div>
                  <IconComponent className="w-5 h-5 text-blue-500" />
                  <div className="text-sm text-gray-900 dark:text-white flex-1">
                    {log.action}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ImportExportModal
        isOpen={isImportExportModalOpen}
        onClose={() => setIsImportExportModalOpen(false)}
      />
    </div>
  );
};

export default Dashboard;
