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
  Calendar,
  UserCheck,
  BarChart3,
  Plus,
  ExternalLink,
  ChevronRight,
  Clock,
  MapPin,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useModuleAccess } from "../hooks/useModuleAccess";
import { useWiseAppAccess } from "../context/WiseAppAccessContext";
import ImportExportModal from "../components/ImportExportModal";
import LoadingSpinner from "../components/LoadingSpinner";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { format, subMonths, isBefore, addDays } from 'date-fns';
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

interface StatPill {
  title: string;
  count: number;
  icon: LucideIcon;
  link: string;
}

interface VagaWidget {
  id: number;
  nome: string;
  quantidade: number;
  dt_limite: string | null;
  created_at: string;
}

interface DashboardStats {
  motoristas: number;
  veiculos: number;
  checklists: number;
  comprovantes: number;
  hodometros: number;
  monthlyData: { month: string; fullMonth: string; value: number; clients: number; avgPerDay: number }[];
  distributionData: { name: string; value: number; color: string }[];
  vehicleTypeData: { name: string; value: number; color: string }[];
  recentLogs: { time: string; action: string; user: string; icon: LucideIcon }[];
  hodometroData: { month: string; km_rodados: number; leituras: number }[];
  vagas: VagaWidget[];
}

// Custom Tooltip Components
const SimpleTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {label}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {data.name}: <span className="font-semibold">{data.value}</span>
        </p>
      </div>
    );
  }
  return null;
};

const HodometroTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
          {label}
        </p>
        <div className="space-y-1">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            KM Rodados: <span className="font-semibold">{data.km_rodados}</span>
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Leituras: <span className="font-semibold">{data.leituras}</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

// Hero Card Components
const ContratacaoHeroCard = ({ stats }: { stats: DashboardStats }) => {
  const totalVagas = stats.vagas.reduce((sum, vaga) => sum + vaga.quantidade, 0);
  const vagasVencendo = stats.vagas.filter(vaga => {
    if (!vaga.dt_limite) return false;
    const limite = new Date(vaga.dt_limite);
    const proximaVencimento = addDays(new Date(), 7);
    return isBefore(limite, proximaVencimento);
  }).length;
  
  const vagasSemPrazo = stats.vagas.filter(vaga => !vaga.dt_limite).length;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-6 shadow-sm h-[320px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Contratação</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Gestão de vagas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/vagas"
            className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1"
            data-testid="link-vagas-all"
          >
            Ver todas
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* KPI Principal */}
      <div className="mb-6">
        <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {totalVagas}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {totalVagas === 1 ? 'vaga aberta' : 'vagas abertas'}
        </p>
      </div>

      {/* Sub-KPIs */}
      <div className="flex gap-2 mb-6">
        {vagasVencendo > 0 && (
          <div className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-xs font-medium">
            {vagasVencendo} vencendo
          </div>
        )}
        {vagasSemPrazo > 0 && (
          <div className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs font-medium">
            {vagasSemPrazo} sem prazo
          </div>
        )}
      </div>

      {/* Lista Mini de Vagas */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {stats.vagas.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Nenhuma vaga cadastrada
            </p>
          </div>
        ) : (
          stats.vagas.slice(0, 5).map((vaga) => {
            const isUrgent = vaga.dt_limite && isBefore(new Date(vaga.dt_limite), addDays(new Date(), 7));
            return (
              <div key={vaga.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {vaga.nome}
                  </h4>
                  {vaga.dt_limite && (
                    <p className={`text-xs ${isUrgent ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      Até {format(new Date(vaga.dt_limite), 'dd/MM/yyyy')}
                    </p>
                  )}
                </div>
                <div className="text-xs font-medium px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                  {vaga.quantidade}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const HodometroHeroCard = ({ stats }: { stats: DashboardStats }) => {
  const totalKm = stats.hodometroData.reduce((sum, item) => sum + item.km_rodados, 0);
  const totalLeituras = stats.hodometroData.reduce((sum, item) => sum + item.leituras, 0);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-6 shadow-sm h-[320px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <Gauge className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Hodômetro</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Últimos 6 meses</p>
          </div>
        </div>
        <Link
          to="/hodometros"
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
          data-testid="link-hodometros-all"
        >
          Ver detalhes
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* KPI Chips */}
      <div className="flex gap-3 mb-4">
        <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
          {totalKm.toLocaleString()} km
        </div>
        <div className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
          {totalLeituras} leituras
        </div>
      </div>

      {/* Gráfico */}
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={stats.hodometroData}>
            <defs>
              <linearGradient id="kmGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="month" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: 'currentColor' }}
              tickCount={6}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: 'currentColor' }}
              tickCount={5}
            />
            <Tooltip content={<HodometroTooltip />} />
            <Area
              type="monotone"
              dataKey="km_rodados"
              stroke="#3B82F6"
              strokeWidth={1.5}
              fill="url(#kmGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// Mini Cards Components
const ComprovantesInsightCard = ({ stats }: { stats: DashboardStats }) => {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-4 shadow-sm h-40">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-green-600 dark:text-green-400" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Comprovantes</h3>
        </div>
        <div className="text-lg font-semibold text-gray-900 dark:text-white">
          {stats.comprovantes}
        </div>
      </div>
      
      <div className="h-20">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={stats.monthlyData}>
            <Line
              type="monotone"
              dataKey="value"
              stroke="#10B981"
              strokeWidth={1.5}
              dot={false}
            />
            <Tooltip content={<SimpleTooltip />} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const VeiculosInsightCard = ({ stats }: { stats: DashboardStats }) => {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-4 shadow-sm h-40">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Veículos</h3>
        </div>
        <div className="text-lg font-semibold text-gray-900 dark:text-white">
          {stats.veiculos}
        </div>
      </div>
      
      <div className="h-20 flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={stats.vehicleTypeData}
              cx="50%"
              cy="50%"
              innerRadius={15}
              outerRadius={30}
              dataKey="value"
            >
              {stats.vehicleTypeData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<SimpleTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const MotoristasInsightCard = ({ stats }: { stats: DashboardStats }) => {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-4 shadow-sm h-40">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Motoristas</h3>
        </div>
        <div className="text-lg font-semibold text-gray-900 dark:text-white">
          {stats.motoristas}
        </div>
      </div>
      
      <div className="h-20 flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={stats.distributionData}
              cx="50%"
              cy="50%"
              innerRadius={15}
              outerRadius={30}
              dataKey="value"
            >
              {stats.distributionData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<SimpleTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const AtividadeInsightCard = ({ stats }: { stats: DashboardStats }) => {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-4 shadow-sm h-40">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Atividade</h3>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">Recente</div>
      </div>
      
      <div className="space-y-2 h-20 overflow-y-auto">
        {stats.recentLogs.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Nenhuma atividade recente
          </p>
        ) : (
          stats.recentLogs.slice(0, 3).map((log, index) => (
            <div key={index} className="flex items-center gap-2">
              <log.icon className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-600 dark:text-gray-300 truncate">
                  {log.action}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {log.time}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Stats Pills Component
const StatsPills = ({ stats }: { stats: DashboardStats }) => {
  const pills: StatPill[] = [
    { title: "Motoristas", count: stats.motoristas, icon: Users, link: "/motoristas" },
    { title: "Veículos", count: stats.veiculos, icon: Truck, link: "/veiculos" },
    { title: "Checklists", count: stats.checklists, icon: ClipboardCheck, link: "/checklist" },
    { title: "Comprovantes", count: stats.comprovantes, icon: FileText, link: "/comprovantes" },
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {pills.map((pill) => (
        <Link
          key={pill.title}
          to={pill.link}
          className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          data-testid={`pill-${pill.title.toLowerCase()}`}
        >
          <pill.icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm text-gray-600 dark:text-gray-300">{pill.title}</span>
          <span className="text-xl font-semibold text-gray-900 dark:text-white">{pill.count}</span>
        </Link>
      ))}
    </div>
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
    vehicleTypeData: [],
    recentLogs: [],
    hodometroData: [],
    vagas: []
  });
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (companyId) {
      fetchDashboardData();
    } else {
      setStatsLoading(false);
    }
  }, [companyId]);

  const fetchDashboardData = async () => {
    try {
      setStatsLoading(true);
      
      // Fetch counts in parallel with error checking
      const [motoristasResult, veiculosResult, checklistsResult, comprovantesResult, hodometroResult, vagasResult] = await Promise.all([
        supabase.from('motorista').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('veiculo').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('checklist').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('comprovante').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('hodometro').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('vaga').select('id, nome, quantidade, dt_limite, created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(5)
      ]);
      
      if (motoristasResult.error) throw new Error(`Erro ao buscar motoristas: ${motoristasResult.error.message}`);
      if (veiculosResult.error) throw new Error(`Erro ao buscar veículos: ${veiculosResult.error.message}`);
      if (checklistsResult.error) throw new Error(`Erro ao buscar checklists: ${checklistsResult.error.message}`);
      if (comprovantesResult.error) throw new Error(`Erro ao buscar comprovantes: ${comprovantesResult.error.message}`);
      if (hodometroResult.error) throw new Error(`Erro ao buscar hodômetros: ${hodometroResult.error.message}`);
      if (vagasResult.error) throw new Error(`Erro ao buscar vagas: ${vagasResult.error.message}`);
      
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
          .select('created_at, cliente_id')
          .eq('company_id', companyId)
          .gte('created_at', sixMonthsAgo.toISOString())
          .order('created_at', { ascending: true });
        
        if (monthlyError) throw monthlyError;
        
        // Process monthly data with detailed information
        const monthlyDataMap: { [key: string]: { count: number; clients: Set<string>; dates: Date[] } } = {};
        (monthlyComprovantes || []).forEach(item => {
          const date = new Date(item.created_at);
          const monthKey = format(date, 'MMM yyyy', { locale: ptBR });
          
          if (!monthlyDataMap[monthKey]) {
            monthlyDataMap[monthKey] = { count: 0, clients: new Set(), dates: [] };
          }
          
          monthlyDataMap[monthKey].count += 1;
          if (item.cliente_id) {
            monthlyDataMap[monthKey].clients.add(item.cliente_id);
          }
          monthlyDataMap[monthKey].dates.push(date);
        });
        
        for (let i = 5; i >= 0; i--) {
          const date = subMonths(new Date(), i);
          const month = format(date, 'MMM', { locale: ptBR });
          const fullMonth = format(date, 'MMM yyyy', { locale: ptBR });
          const monthData = monthlyDataMap[fullMonth];
          
          let avgPerDay = 0;
          if (monthData && monthData.dates.length > 0) {
            // Calculate unique days with activity
            const uniqueDays = new Set(monthData.dates.map(d => format(d, 'yyyy-MM-dd')));
            avgPerDay = monthData.count / uniqueDays.size;
          }
          
          monthlyData.push({ 
            month, 
            fullMonth,
            value: monthData?.count || 0,
            clients: monthData?.clients.size || 0,
            avgPerDay: Number(avgPerDay.toFixed(1))
          });
        }
      } catch (error) {
        console.warn('Erro ao buscar dados mensais:', error);
        // Default empty monthly data
        for (let i = 5; i >= 0; i--) {
          const date = subMonths(new Date(), i);
          const month = format(date, 'MMM', { locale: ptBR });
          const fullMonth = format(date, 'MMM yyyy', { locale: ptBR });
          monthlyData.push({ month, fullMonth, value: 0, clients: 0, avgPerDay: 0 });
        }
      }
      
      // Distribution data (non-critical)
      let distributionData = [];
      try {
        const { data: motoristaTypes, error: typesError } = await supabase
          .from('motorista')
          .select('funcao')
          .eq('company_id', companyId);
        
        if (typesError) throw typesError;
        
        const typeCount: { [key: string]: number } = {};
        (motoristaTypes || []).forEach(item => {
          const funcao = item.funcao || 'Não definido';
          typeCount[funcao] = (typeCount[funcao] || 0) + 1;
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
      
      // Vehicle type distribution data (non-critical)
      let vehicleTypeData = [];
      try {
        const { data: vehicleTypes, error: vehicleTypesError } = await supabase
          .from('veiculo')
          .select('tipologia')
          .eq('company_id', companyId)
          .eq('status_veiculo', true);
        
        if (vehicleTypesError) throw vehicleTypesError;
        
        const vehicleTypeCount: { [key: string]: number } = {};
        (vehicleTypes || []).forEach(item => {
          const tipologia = item.tipologia || 'Não definido';
          vehicleTypeCount[tipologia] = (vehicleTypeCount[tipologia] || 0) + 1;
        });
        
        const vehicleColors = ['#F59E0B', '#EF4444', '#10B981', '#3B82F6', '#8B5CF6'];
        vehicleTypeData = Object.entries(vehicleTypeCount).map(([name, value], index) => ({
          name,
          value,
          color: vehicleColors[index % vehicleColors.length]
        }));
      } catch (error) {
        console.warn('Erro ao buscar distribuição de tipos de veículos:', error);
        // Default vehicle type distribution
        vehicleTypeData = [
          { name: 'Veículos', value: veiculosCount || 0, color: '#F59E0B' }
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
      
      // Hodometro data (non-critical)
      let hodometroData: { month: string; km_rodados: number; leituras: number }[] = [];
      try {
        const sixMonthsAgo = subMonths(new Date(), 5);
        
        // Get hodometro records with correct field names
        const { data: hodometroRecords, error: hodometroError } = await supabase
          .from('hodometro')
          .select('id_hodometro, veiculo_id, data, trip_lida, hod_lido, km_rodado, company_id')
          .eq('company_id', companyId)
          .gte('data', format(sixMonthsAgo, 'yyyy-MM-dd'))
          .order('data', { ascending: true });
          
        if (hodometroError) {
          console.warn('Erro na consulta de hodômetros:', hodometroError);
          throw hodometroError;
        }
        
        // Process hodometro data by month and calculate km_rodados using real field names
        const hodometroDataMap: { [key: string]: { km_rodados: number; leituras: number; km_readings: number[] } } = {};
        
        (hodometroRecords || []).forEach(record => {
          const date = new Date(record.data);
          const monthKey = format(date, 'MMM yyyy', { locale: ptBR });
          
          // Use km_rodado if available, otherwise use trip_lida as numeric value, or hod_lido
          const kmValue = Number(record.km_rodado) || Number(record.trip_lida) || Number(record.hod_lido) || 0;
          
          if (!hodometroDataMap[monthKey]) {
            hodometroDataMap[monthKey] = { km_rodados: 0, leituras: 0, km_readings: [] };
          }
          
          // Store km readings for later calculation  
          hodometroDataMap[monthKey].km_readings.push(kmValue);
          hodometroDataMap[monthKey].leituras += 1;
        });
        
        // Calculate km_rodados - sum up all km_rodado values or calculate difference between readings
        Object.keys(hodometroDataMap).forEach(monthKey => {
          const readings = hodometroDataMap[monthKey].km_readings;
          if (readings.length > 0) {
            // Sum up the km values for the month (since km_rodado might represent trip distances)
            const totalKm = readings.reduce((sum, km) => sum + km, 0);
            hodometroDataMap[monthKey].km_rodados = Math.round(totalKm);
          }
        });
        
        // Generate data for the last 6 months
        for (let i = 5; i >= 0; i--) {
          const date = subMonths(new Date(), i);
          const month = format(date, 'MMM', { locale: ptBR });
          const fullMonth = format(date, 'MMM yyyy', { locale: ptBR });
          const monthData = hodometroDataMap[fullMonth] || { km_rodados: 0, leituras: 0 };
          
          hodometroData.push({
            month,
            km_rodados: Math.round(monthData.km_rodados),
            leituras: monthData.leituras
          });
        }
      } catch (error) {
        console.warn('Erro ao buscar dados de hodômetros:', error);
        // Default empty hodometro data for last 6 months
        for (let i = 5; i >= 0; i--) {
          const date = subMonths(new Date(), i);
          const month = format(date, 'MMM', { locale: ptBR });
          hodometroData.push({ month, km_rodados: 0, leituras: 0 });
        }
      }
      
      // Process vagas data
      const vagasData = vagasResult.data?.map(vaga => ({
        id: vaga.id,
        nome: vaga.nome || 'Vaga não definida',
        quantidade: Number(vaga.quantidade) || 0,
        dt_limite: vaga.dt_limite,
        created_at: vaga.created_at
      })) || [];
      
      setStats({
        motoristas: motoristasCount || 0,
        veiculos: veiculosCount || 0,
        checklists: checklistsCount || 0,
        comprovantes: comprovantesCount || 0,
        hodometros: hodometroCount || 0,
        monthlyData,
        distributionData,
        vehicleTypeData,
        recentLogs: recentLogsProcessed,
        hodometroData,
        vagas: vagasData
      });
      
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error instanceof Error ? { message: error.message, stack: error.stack } : error);
      // Set default empty data on error
      const defaultMonthlyData = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const month = format(date, 'MMM', { locale: ptBR });
        const fullMonth = format(date, 'MMM yyyy', { locale: ptBR });
        defaultMonthlyData.push({ month, fullMonth, value: 0, clients: 0, avgPerDay: 0 });
      }
      
      setStats({
        motoristas: 0,
        veiculos: 0,
        checklists: 0,
        comprovantes: 0,
        hodometros: 0,
        monthlyData: defaultMonthlyData,
        distributionData: [],
        vehicleTypeData: [],
        recentLogs: [],
        hodometroData: [],
        vagas: []
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
      title: "Motoristas",
      icon: Users,
      link: "/motoristas",
      description: "Gestão de motoristas e ajudantes",
      enabled: moduleAccess.motoristas,
    },
    {
      title: "Veículos",
      icon: Truck,
      link: "/veiculos",
      description: "Gestão de frota e veículos",
      enabled: moduleAccess.veiculos,
    },
    {
      title: "Checklist",
      icon: ClipboardCheck,
      link: "/checklist",
      description: "Inspeções e checklists de segurança",
      enabled: moduleAccess.checklist,
    },
    {
      title: "Comprovantes",
      icon: FileText,
      link: "/comprovantes",
      description: "Gestão de documentos e comprovantes",
      enabled: moduleAccess.comprovantes,
    },
    {
      title: "Hodômetros",
      icon: Gauge,
      link: "/hodometros",
      description: "Controle de quilometragem",
      enabled: moduleAccess.hodometros,
    },
    {
      title: "Vagas",
      icon: Briefcase,
      link: "/vagas",
      description: "Gestão de vagas e contratação",
      enabled: moduleAccess.vagas,
    },
    {
      title: "Clientes",
      icon: Store,
      link: "/clientes",
      description: "Gestão de clientes",
      enabled: moduleAccess.clientes,
    },
    {
      title: "Admin",
      icon: Tag,
      link: "/admin",
      description: "Administração e configurações",
      enabled: moduleAccess.admin,
    },
    {
      title: "Importar/Exportar",
      icon: FileDown,
      link: "",
      description: "Gestão de dados em lote",
      enabled: true,
      isSpecial: true,
      onClick: () => setIsImportExportModalOpen(true),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Visão geral das operações e métricas principais
          </p>
        </div>

        {/* Stats Pills */}
        <StatsPills stats={stats} />

        {/* Hero Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ContratacaoHeroCard stats={stats} />
          <HodometroHeroCard stats={stats} />
        </div>

        {/* Mini Insights Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ComprovantesInsightCard stats={stats} />
          <VeiculosInsightCard stats={stats} />
          <MotoristasInsightCard stats={stats} />
          <AtividadeInsightCard stats={stats} />
        </div>
      </div>

      {/* Import/Export Modal */}
      {isImportExportModalOpen && (
        <ImportExportModal
          isOpen={isImportExportModalOpen}
          onClose={() => setIsImportExportModalOpen(false)}
        />
      )}
    </div>
  );
};

// Keep existing MenuCard component unchanged
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
        data-testid={`menu-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
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
      data-testid={`menu-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
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
      data-testid={`menu-card-${title.toLowerCase().replace(/\s+/g, '-')}-disabled`}
    >
      {cardContent}
    </div>
  );
};

export default Dashboard;