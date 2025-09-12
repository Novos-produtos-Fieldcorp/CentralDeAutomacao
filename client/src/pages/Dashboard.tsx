import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Gauge,
  Briefcase,
  ExternalLink,
} from "lucide-react";
import { useWiseAppAccess } from "../context/WiseAppAccessContext";
import LoadingSpinner from "../components/LoadingSpinner";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subMonths, isBefore, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../lib/supabase';

interface VagaWidget {
  id: number;
  nome: string;
  quantidade: number;
  dt_limite: string | null;
  created_at: string;
}

interface DashboardStats {
  hodometroData: { month: string; km_rodados: number; leituras: number }[];
  vagas: VagaWidget[];
}

// Custom Tooltip Components
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
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-6 shadow-sm h-[400px]">
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
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {stats.vagas.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Nenhuma vaga cadastrada
            </p>
          </div>
        ) : (
          stats.vagas.slice(0, 6).map((vaga) => {
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
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-6 shadow-sm h-[400px]">
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
      <div className="flex gap-3 mb-6">
        <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
          {totalKm.toLocaleString()} km
        </div>
        <div className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
          {totalLeituras} leituras
        </div>
      </div>

      {/* Gráfico */}
      <div className="h-72">
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

const Dashboard = () => {
  const { companyId } = useWiseAppAccess();
  const [stats, setStats] = useState<DashboardStats>({
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
      
      // Fetch only data needed for the two hero cards
      const [vagasResult] = await Promise.all([
        supabase.from('vaga').select('id, nome, quantidade, dt_limite, created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(10)
      ]);
      
      if (vagasResult.error) throw new Error(`Erro ao buscar vagas: ${vagasResult.error.message}`);
      
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
        
        // Process hodometro data by month
        const hodometroMap: { [key: string]: { km_rodados: number; leituras: number } } = {};
        
        (hodometroRecords || []).forEach(record => {
          const date = new Date(record.data);
          const monthKey = format(date, 'MMM yyyy', { locale: ptBR });
          
          if (!hodometroMap[monthKey]) {
            hodometroMap[monthKey] = { km_rodados: 0, leituras: 0 };
          }
          
          // Sum km_rodado values
          if (record.km_rodado && typeof record.km_rodado === 'number') {
            hodometroMap[monthKey].km_rodados += record.km_rodado;
          }
          
          // Count readings
          hodometroMap[monthKey].leituras += 1;
        });
        
        // Create final array with last 6 months
        for (let i = 5; i >= 0; i--) {
          const date = subMonths(new Date(), i);
          const month = format(date, 'MMM', { locale: ptBR });
          const fullMonth = format(date, 'MMM yyyy', { locale: ptBR });
          const monthData = hodometroMap[fullMonth];
          
          hodometroData.push({
            month,
            km_rodados: Math.round(monthData?.km_rodados || 0),
            leituras: monthData?.leituras || 0
          });
        }
      } catch (error) {
        console.warn('Erro ao buscar dados de hodômetro:', error);
        // Default empty hodometro data for last 6 months
        for (let i = 5; i >= 0; i--) {
          const date = subMonths(new Date(), i);
          const month = format(date, 'MMM', { locale: ptBR });
          hodometroData.push({ month, km_rodados: 0, leituras: 0 });
        }
      }
      
      setStats({
        hodometroData,
        vagas: vagasResult.data || []
      });
      
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
      // Set default empty data on error
      setStats({
        hodometroData: Array.from({ length: 6 }, (_, i) => {
          const date = subMonths(new Date(), 5 - i);
          const month = format(date, 'MMM', { locale: ptBR });
          return { month, km_rodados: 0, leituras: 0 };
        }),
        vagas: []
      });
    } finally {
      setStatsLoading(false);
    }
  };

  if (statsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Visão geral dos dados principais
          </p>
        </div>

        {/* Hero Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="lg:col-span-1">
            <ContratacaoHeroCard stats={stats} />
          </div>
          <div className="lg:col-span-1">
            <HodometroHeroCard stats={stats} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;