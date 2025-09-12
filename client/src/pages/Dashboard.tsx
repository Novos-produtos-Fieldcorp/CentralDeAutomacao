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
  TrendingDown,
  Filter,
  Search,
  Eye,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useModuleAccess } from "../hooks/useModuleAccess";
import { useWiseAppAccess } from "../context/WiseAppAccessContext";
import LoadingSpinner from "../components/LoadingSpinner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { format, subMonths, isBefore, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "../lib/supabase";

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

interface HodometroMonthData {
  month: string;
  fullMonth: string;
  km_rodados: number;
  leituras: number;
  avgKmPerLeitura: number;
  previousMonth?: {
    km_rodados: number;
    leituras: number;
  };
}

interface VagasStats {
  abertas: number;
  preenchidas: number;
  vencidas: number;
  total: number;
  taxaPreenchimento: number;
  recentVagas: VagaWidget[];
  statusData: { name: string; value: number; color: string }[];
}

interface ExpandedActivity {
  id: string;
  time: string;
  timestamp: Date;
  action: string;
  type: 'hire' | 'vaga' | 'hodometro' | 'vehicle' | 'document' | 'other';
  details: string;
  user: string;
  icon: LucideIcon;
}

interface DashboardStats {
  motoristas: number;
  agregados: number;
  contratados: number;
  agregadosPercentage: number;
  contratadosPercentage: number;
  agregadosGrowth: number;
  contratadosGrowth: number;
  recentHires: {
    name: string;
    type: 'agregado' | 'contratado';
    date: string;
  }[];
  veiculos: number;
  checklists: number;
  comprovantes: number;
  hodometros: number;
  monthlyData: {
    month: string;
    fullMonth: string;
    value: number;
    clients: number;
    avgPerDay: number;
  }[];
  distributionData: { name: string; value: number; color: string }[];
  vehicleTypeData: { name: string; value: number; color: string }[];
  recentLogs: {
    time: string;
    action: string;
    user: string;
    icon: LucideIcon;
  }[];
  expandedActivities: ExpandedActivity[];
  hodometroData: HodometroMonthData[];
  vagas: VagaWidget[];
  vagasStats: VagasStats;
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
    const avgKmPerLeitura = data.leituras > 0 ? (data.km_rodados / data.leituras).toFixed(1) : 0;
    const previousComparison = data.previousMonth ? {
      kmDiff: data.km_rodados - data.previousMonth.km_rodados,
      leiturasDiff: data.leituras - data.previousMonth.leituras,
    } : null;

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-4 min-w-[250px]">
        <div className="flex items-center gap-2 mb-3">
          <Gauge className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {data.fullMonth}
          </p>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-300">KM Rodados:</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {data.km_rodados.toLocaleString()} km
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-300">Leituras:</span>
            <span className="font-semibold text-green-600 dark:text-green-400">
              {data.leituras}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-300">Média km/leitura:</span>
            <span className="font-semibold text-purple-600 dark:text-purple-400">
              {avgKmPerLeitura} km
            </span>
          </div>
          {previousComparison && (
            <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">vs. mês anterior:</p>
              <div className="flex justify-between text-xs">
                <span className={previousComparison.kmDiff >= 0 ? "text-green-600" : "text-red-600"}>
                  {previousComparison.kmDiff >= 0 ? "+" : ""}{previousComparison.kmDiff.toLocaleString()} km
                </span>
                <span className={previousComparison.leiturasDiff >= 0 ? "text-green-600" : "text-red-600"}>
                  {previousComparison.leiturasDiff >= 0 ? "+" : ""}{previousComparison.leiturasDiff} leituras
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

const VehicleTypeTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    const totalVehicles = payload[0].payload.totalVehicles || data.value;
    const percentage = totalVehicles > 0 ? ((data.value / totalVehicles) * 100).toFixed(1) : 0;
    
    const getVehicleIcon = (type: string) => {
      switch (type.toLowerCase()) {
        case 'caminhão':
        case 'caminhao':
          return <Truck className="w-4 h-4" />;
        case 'van':
        case 'furgão':
        case 'furgao':
          return <Users className="w-4 h-4" />;
        default:
          return <Truck className="w-4 h-4" />;
      }
    };

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <div style={{ color: data.payload.color }}>
            {getVehicleIcon(data.name)}
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {data.name}
          </p>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-300">Quantidade:</span>
            <span className="font-semibold" style={{ color: data.payload.color }}>
              {data.value}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-300">Percentual:</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {percentage}%
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const DriverDistributionTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    const totalDrivers = payload[0].payload.totalDrivers || data.value;
    const percentage = totalDrivers > 0 ? ((data.value / totalDrivers) * 100).toFixed(1) : 0;
    
    const getDriverIcon = (type: string) => {
      switch (type.toLowerCase()) {
        case 'agregado':
          return <UserCheck className="w-4 h-4" />;
        case 'motorista':
        case 'contratado':
          return <Users className="w-4 h-4" />;
        default:
          return <Users className="w-4 h-4" />;
      }
    };

    const getDriverTypeLabel = (type: string) => {
      switch (type.toLowerCase()) {
        case 'agregado':
          return 'Agregados';
        case 'motorista':
          return 'Contratados';
        default:
          return type;
      }
    };

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <div style={{ color: data.payload.color }}>
            {getDriverIcon(data.name)}
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {getDriverTypeLabel(data.name)}
          </p>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-300">Quantidade:</span>
            <span className="font-semibold" style={{ color: data.payload.color }}>
              {data.value}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-300">Percentual:</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {percentage}%
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const ComprovantesTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const activityStatus = data.value > data.avgPerDay ? "Alta atividade" : 
                          data.value === 0 ? "Sem atividade" : "Atividade normal";

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-4 min-w-[220px]">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-green-600 dark:text-green-400" />
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {data.fullMonth}
          </p>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-300">Comprovantes:</span>
            <span className="font-semibold text-green-600 dark:text-green-400">
              {data.value}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-300">Clientes ativos:</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {data.clients}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-300">Média/dia:</span>
            <span className="font-semibold text-purple-600 dark:text-purple-400">
              {data.avgPerDay}
            </span>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
            <div className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-gray-500" />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {activityStatus}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// Hero Card Components
const ContratacaoHeroCard = ({ stats }: { stats: DashboardStats }) => {
  const hasGrowthData = stats.agregadosGrowth !== 0 || stats.contratadosGrowth !== 0;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-6 shadow-sm h-[320px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Contratação
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Agregados vs Contratados
            </p>
          </div>
        </div>
        <Link
          to="/contratacao"
          className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1"
          data-testid="link-contratacao-all"
        >
          Ver todos
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* KPI Principal */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-6">
          {/* Agregados */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
              <Truck className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.agregados}
              </div>
              <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                Agregados ({stats.agregadosPercentage}%)
              </p>
            </div>
          </div>

          {/* vs */}
          <div className="text-lg text-gray-400 dark:text-gray-500 font-medium">vs</div>

          {/* Contratados */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.contratados}
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                Contratados ({stats.contratadosPercentage}%)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Distribuição Visual */}
      <div className="mb-4">
        <div className="flex rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 h-3">
          <div 
            className="bg-orange-500 transition-all duration-300"
            style={{ width: `${stats.agregadosPercentage}%` }}
          />
          <div 
            className="bg-blue-500 transition-all duration-300"
            style={{ width: `${stats.contratadosPercentage}%` }}
          />
        </div>
      </div>

      {/* Tendências de Crescimento */}
      {hasGrowthData && (
        <div className="flex gap-4 mb-4">
          {stats.agregadosGrowth !== 0 && (
            <div className="flex items-center gap-1">
              {stats.agregadosGrowth > 0 ? (
                <TrendingUp className="w-3 h-3 text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-600 dark:text-red-400" />
              )}
              <span className={`text-xs font-medium ${stats.agregadosGrowth > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {stats.agregadosGrowth > 0 ? '+' : ''}{stats.agregadosGrowth} agregados
              </span>
            </div>
          )}
          {stats.contratadosGrowth !== 0 && (
            <div className="flex items-center gap-1">
              {stats.contratadosGrowth > 0 ? (
                <TrendingUp className="w-3 h-3 text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-600 dark:text-red-400" />
              )}
              <span className={`text-xs font-medium ${stats.contratadosGrowth > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {stats.contratadosGrowth > 0 ? '+' : ''}{stats.contratadosGrowth} contratados
              </span>
            </div>
          )}
        </div>
      )}

      {/* Últimas Contratações */}
      <div className="space-y-2 max-h-32 overflow-y-auto">
        {(!stats.recentHires || stats.recentHires.length === 0) ? (
          <div className="text-center py-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Nenhuma contratação recente
            </p>
          </div>
        ) : (
          (stats.recentHires || []).slice(0, 3).map((hire, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
            >
              <div className="flex items-center gap-2">
                {hire.type === 'agregado' ? (
                  <Truck className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                ) : (
                  <UserCheck className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                )}
                <span className="text-xs font-medium text-gray-900 dark:text-white">
                  {hire.name}
                </span>
              </div>
              <div className={`text-xs px-2 py-1 rounded-full ${
                hire.type === 'agregado' 
                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              }`}>
                {hire.date}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const VagasManagementHeroCard = ({ stats }: { stats: DashboardStats }) => {
  const vagasStats = stats.vagasStats;
  
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-6 shadow-sm h-[320px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Gestão de Vagas
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Status e performance
            </p>
          </div>
        </div>
        <Link
          to="/vagas"
          className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1"
          data-testid="link-vagas-all"
        >
          Ver todas
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* KPIs Principais */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {vagasStats.abertas}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Abertas</p>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {vagasStats.preenchidas}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Preenchidas</p>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {vagasStats.vencidas}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Vencidas</p>
        </div>
      </div>

      {/* Taxa de Preenchimento */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Taxa de Preenchimento
          </span>
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            {vagasStats.taxaPreenchimento}%
          </span>
        </div>
        <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${vagasStats.taxaPreenchimento}%` }}
          />
        </div>
      </div>

      {/* Gráfico de Status */}
      <div className="h-16 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={vagasStats.statusData}
              cx="50%"
              cy="50%"
              innerRadius={12}
              outerRadius={28}
              dataKey="value"
            >
              {vagasStats.statusData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<SimpleTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Últimas Vagas */}
      <div className="space-y-2 max-h-32 overflow-y-auto">
        {(!vagasStats.recentVagas || vagasStats.recentVagas.length === 0) ? (
          <div className="text-center py-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Nenhuma vaga recente
            </p>
          </div>
        ) : (
          (vagasStats.recentVagas || []).slice(0, 3).map((vaga) => {
            const isUrgent = vaga.dt_limite && 
              isBefore(new Date(vaga.dt_limite), addDays(new Date(), 7));
            return (
              <div
                key={vaga.id}
                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-medium text-gray-900 dark:text-white truncate">
                    {vaga.nome}
                  </h4>
                  {vaga.dt_limite && (
                    <p className={`text-xs ${isUrgent ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400"}`}>
                      {format(new Date(vaga.dt_limite), "dd/MM")}
                    </p>
                  )}
                </div>
                <div className="text-xs font-medium px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full">
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
  const totalKm = stats.hodometroData.reduce(
    (sum, item) => sum + item.km_rodados,
    0,
  );
  const totalLeituras = stats.hodometroData.reduce(
    (sum, item) => sum + item.leituras,
    0,
  );

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-6 shadow-sm h-[320px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <Gauge className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Hodômetro
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Últimos 6 meses
            </p>
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
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "currentColor" }}
              tickCount={6}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "currentColor" }}
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
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            Comprovantes
          </h3>
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
            <Tooltip content={<ComprovantesTooltip />} />
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
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            Veículos
          </h3>
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
            <Tooltip content={<VehicleTypeTooltip />} />
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
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            Motoristas
          </h3>
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
            <Tooltip content={<DriverDistributionTooltip />} />
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
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            Atividade
          </h3>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">Recente</div>
      </div>

      <div className="space-y-2 h-20 overflow-y-auto">
        {(!stats.recentLogs || stats.recentLogs.length === 0) ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Nenhuma atividade recente
          </p>
        ) : (
          (stats.recentLogs || []).slice(0, 3).map((log, index) => (
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

const ExpandedActivitiesSection = ({ stats }: { stats: DashboardStats }) => {
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const activityTypeLabels = {
    hire: 'Contratação',
    vaga: 'Vagas',
    hodometro: 'Hodômetro',
    vehicle: 'Veículos',
    document: 'Documentos',
    other: 'Outros'
  };

  const filteredActivities = (stats.expandedActivities || []).filter(activity => {
    const matchesFilter = filter === 'all' || activity.type === filter;
    const matchesSearch = activity.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         activity.details.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getActivityTypeColor = (type: string) => {
    switch (type) {
      case 'hire': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
      case 'vaga': return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
      case 'hodometro': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
      case 'vehicle': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
      case 'document': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Atividades Recentes
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Registro completo de ações no sistema
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
            {filteredActivities.length} atividades
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Filtro por tipo */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="filter-activity-type"
          >
            <option value="all">Todos os tipos</option>
            {Object.entries(activityTypeLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* Busca */}
        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <Search className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <input
            type="text"
            placeholder="Buscar atividades..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
            data-testid="search-activities"
          />
        </div>
      </div>

      {/* Lista de Atividades */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {filteredActivities.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {searchTerm || filter !== 'all' 
                ? 'Nenhuma atividade encontrada com os filtros aplicados'
                : 'Nenhuma atividade recente registrada'
              }
            </p>
          </div>
        ) : (
          filteredActivities.slice(0, 15).map((activity) => (
            <div
              key={activity.id}
              className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              data-testid={`activity-${activity.type}`}
            >
              {/* Ícone */}
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg flex items-center justify-center">
                  <activity.icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </div>
              </div>

              {/* Conteúdo */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {activity.action}
                  </p>
                  <span className={`text-xs px-2 py-1 rounded-full ${getActivityTypeColor(activity.type)}`}>
                    {activityTypeLabels[activity.type]}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">
                  {activity.details}
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{activity.time}</span>
                  </div>
                  {activity.user && (
                    <div className="flex items-center gap-1">
                      <UserCheck className="w-3 h-3" />
                      <span>{activity.user}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Ação */}
              <div className="flex-shrink-0">
                <button
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="Ver detalhes"
                  data-testid={`view-activity-${activity.id}`}
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {filteredActivities.length > 15 && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Mostrando 15 de {filteredActivities.length} atividades
            </p>
            <button className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mt-1">
              Ver todas as atividades
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Stats Pills Component
const StatsPills = ({ stats }: { stats: DashboardStats }) => {
  const pills: StatPill[] = [
    {
      title: "Motoristas",
      count: stats.motoristas,
      icon: Users,
      link: "/motoristas",
    },
    {
      title: "Veículos",
      count: stats.veiculos,
      icon: Truck,
      link: "/veiculos",
    },
    {
      title: "Checklists",
      count: stats.checklists,
      icon: ClipboardCheck,
      link: "/checklist",
    },
    {
      title: "Comprovantes",
      count: stats.comprovantes,
      icon: FileText,
      link: "/comprovantes",
    },
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
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {pill.title}
          </span>
          <span className="text-xl font-semibold text-gray-900 dark:text-white">
            {pill.count}
          </span>
        </Link>
      ))}
    </div>
  );
};

const Dashboard = () => {
  const { loading, moduleAccess } = useModuleAccess();
  const { companyId } = useWiseAppAccess();
  const [stats, setStats] = useState<DashboardStats>({
    motoristas: 0,
    agregados: 0,
    contratados: 0,
    agregadosPercentage: 0,
    contratadosPercentage: 0,
    veiculos: 0,
    checklists: 0,
    comprovantes: 0,
    hodometros: 0,
    monthlyData: [],
    distributionData: [],
    vehicleTypeData: [],
    recentLogs: [],
    hodometroData: [],
    vagas: [],
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
      const [
        motoristasResult,
        veiculosResult,
        checklistsResult,
        comprovantesResult,
        hodometroResult,
        vagasResult,
      ] = await Promise.all([
        supabase
          .from("motorista")
          .select("*", { count: "exact", head: true })
          .eq("company_id", companyId),
        supabase
          .from("veiculo")
          .select("*", { count: "exact", head: true })
          .eq("company_id", companyId),
        supabase
          .from("checklist")
          .select("*", { count: "exact", head: true })
          .eq("company_id", companyId),
        supabase
          .from("comprovante")
          .select("*", { count: "exact", head: true })
          .eq("company_id", companyId),
        supabase
          .from("hodometro")
          .select("*", { count: "exact", head: true })
          .eq("company_id", companyId),
        supabase
          .from("vaga")
          .select("id, nome, quantidade, dt_limite, created_at")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (motoristasResult.error)
        throw new Error(
          `Erro ao buscar motoristas: ${motoristasResult.error.message}`,
        );
      if (veiculosResult.error)
        throw new Error(
          `Erro ao buscar veículos: ${veiculosResult.error.message}`,
        );
      if (checklistsResult.error)
        throw new Error(
          `Erro ao buscar checklists: ${checklistsResult.error.message}`,
        );
      if (comprovantesResult.error)
        throw new Error(
          `Erro ao buscar comprovantes: ${comprovantesResult.error.message}`,
        );
      if (hodometroResult.error)
        throw new Error(
          `Erro ao buscar hodômetros: ${hodometroResult.error.message}`,
        );
      if (vagasResult.error)
        throw new Error(`Erro ao buscar vagas: ${vagasResult.error.message}`);

      const motoristasCount = motoristasResult.count;
      const veiculosCount = veiculosResult.count;
      const checklistsCount = checklistsResult.count;
      const comprovantesCount = comprovantesResult.count;
      const hodometroCount = hodometroResult.count;

      // Fetch monthly data (non-critical)
      let monthlyData = [];
      try {
        const sixMonthsAgo = subMonths(new Date(), 5);
        const { data: monthlyComprovantes, error: monthlyError } =
          await supabase
            .from("comprovante")
            .select("created_at, cliente_id")
            .eq("company_id", companyId)
            .gte("created_at", sixMonthsAgo.toISOString())
            .order("created_at", { ascending: true });

        if (monthlyError) throw monthlyError;

        // Process monthly data with detailed information
        const monthlyDataMap: {
          [key: string]: { count: number; clients: Set<string>; dates: Date[] };
        } = {};
        (monthlyComprovantes || []).forEach((item) => {
          const date = new Date(item.created_at);
          const monthKey = format(date, "MMM yyyy", { locale: ptBR });

          if (!monthlyDataMap[monthKey]) {
            monthlyDataMap[monthKey] = {
              count: 0,
              clients: new Set(),
              dates: [],
            };
          }

          monthlyDataMap[monthKey].count += 1;
          if (item.cliente_id) {
            monthlyDataMap[monthKey].clients.add(item.cliente_id);
          }
          monthlyDataMap[monthKey].dates.push(date);
        });

        for (let i = 5; i >= 0; i--) {
          const date = subMonths(new Date(), i);
          const month = format(date, "MMM", { locale: ptBR });
          const fullMonth = format(date, "MMM yyyy", { locale: ptBR });
          const monthData = monthlyDataMap[fullMonth];

          let avgPerDay = 0;
          if (monthData && monthData.dates.length > 0) {
            // Calculate unique days with activity
            const uniqueDays = new Set(
              monthData.dates.map((d) => format(d, "yyyy-MM-dd")),
            );
            avgPerDay = monthData.count / uniqueDays.size;
          }

          monthlyData.push({
            month,
            fullMonth,
            value: monthData?.count || 0,
            clients: monthData?.clients.size || 0,
            avgPerDay: Number(avgPerDay.toFixed(1)),
          });
        }
      } catch (error) {
        console.warn("Erro ao buscar dados mensais:", error);
        // Default empty monthly data
        for (let i = 5; i >= 0; i--) {
          const date = subMonths(new Date(), i);
          const month = format(date, "MMM", { locale: ptBR });
          const fullMonth = format(date, "MMM yyyy", { locale: ptBR });
          monthlyData.push({
            month,
            fullMonth,
            value: 0,
            clients: 0,
            avgPerDay: 0,
          });
        }
      }

      // Agregados vs Contratados data and distribution (non-critical)
      let distributionData = [];
      let agregadosCount = 0;
      let contratadosCount = 0;
      let agregadosPercentage = 0;
      let contratadosPercentage = 0;
      
      try {
        const { data: motoristaTypes, error: typesError } = await supabase
          .from("motorista")
          .select("funcao")
          .eq("company_id", companyId);

        if (typesError) throw typesError;

        const typeCount: { [key: string]: number } = {};
        (motoristaTypes || []).forEach((item) => {
          const funcao = item.funcao || "Não definido";
          typeCount[funcao] = (typeCount[funcao] || 0) + 1;
          
          // Count agregados vs contratados specifically
          if (funcao.toLowerCase() === "agregado") {
            agregadosCount += 1;
          } else if (funcao.toLowerCase() === "motorista" || funcao.toLowerCase() === "contratado") {
            contratadosCount += 1;
          } else {
            // Other types are considered contratados by default
            contratadosCount += 1;
          }
        });

        // Calculate percentages
        const totalDrivers = agregadosCount + contratadosCount;
        if (totalDrivers > 0) {
          agregadosPercentage = Number(((agregadosCount / totalDrivers) * 100).toFixed(1));
          contratadosPercentage = Number(((contratadosCount / totalDrivers) * 100).toFixed(1));
        }

        // Build distribution data for chart with agregados vs contratados
        distributionData = [
          {
            name: "Agregado",
            value: agregadosCount,
            color: "#10B981",
            totalDrivers: totalDrivers
          },
          {
            name: "Motorista",
            value: contratadosCount,
            color: "#3B82F6",
            totalDrivers: totalDrivers
          }
        ].filter(item => item.value > 0); // Only show categories with data

      } catch (error) {
        console.warn("Erro ao buscar distribuição de tipos:", error);
        // Default distribution with totals
        distributionData = [
          { name: "Motoristas", value: motoristasCount || 0, color: "#10B981", totalDrivers: motoristasCount || 0 },
        ];
      }

      // Vehicle type distribution data (non-critical)
      let vehicleTypeData = [];
      try {
        const { data: vehicleTypes, error: vehicleTypesError } = await supabase
          .from("veiculo")
          .select("tipologia")
          .eq("company_id", companyId)
          .eq("status_veiculo", true);

        if (vehicleTypesError) throw vehicleTypesError;

        const vehicleTypeCount: { [key: string]: number } = {};
        (vehicleTypes || []).forEach((item) => {
          const tipologia = item.tipologia || "Não definido";
          vehicleTypeCount[tipologia] = (vehicleTypeCount[tipologia] || 0) + 1;
        });

        const vehicleColors = [
          "#F59E0B",
          "#EF4444",
          "#10B981",
          "#3B82F6",
          "#8B5CF6",
        ];
        const totalVehicles = Object.values(vehicleTypeCount).reduce((sum, count) => sum + count, 0);
        vehicleTypeData = Object.entries(vehicleTypeCount).map(
          ([name, value], index) => ({
            name,
            value,
            color: vehicleColors[index % vehicleColors.length],
            totalVehicles,
          }),
        );
      } catch (error) {
        console.warn(
          "Erro ao buscar distribuição de tipos de veículos:",
          error,
        );
        // Default vehicle type distribution
        vehicleTypeData = [
          { name: "Veículos", value: veiculosCount || 0, color: "#F59E0B" },
        ];
      }

      // Recent activity logs (non-critical)
      let recentLogsProcessed: {
        time: string;
        action: string;
        user: string;
        icon: LucideIcon;
      }[] = [];
      try {
        const recentLogs: {
          time: string;
          action: string;
          user: string;
          icon: LucideIcon;
          timestamp: number;
        }[] = [];

        // Fetch recent data in parallel
        const [motoristasResult, comprovantesResult, veiculosResult] =
          await Promise.all([
            supabase
              .from("motorista")
              .select("nome, created_at")
              .eq("company_id", companyId)
              .order("created_at", { ascending: false })
              .limit(2),
            supabase
              .from("comprovante")
              .select("created_at, cliente_id")
              .eq("company_id", companyId)
              .order("created_at", { ascending: false })
              .limit(2),
            supabase
              .from("veiculo")
              .select("placa, created_at")
              .eq("company_id", companyId)
              .order("created_at", { ascending: false })
              .limit(1),
          ]);

        // Get cliente names for comprovantes
        let clienteNames: { [key: string]: string } = {};
        if (comprovantesResult.data && comprovantesResult.data.length > 0) {
          const clienteIds = comprovantesResult.data
            .map((c) => c.cliente_id)
            .filter(Boolean);
          if (clienteIds.length > 0) {
            const { data: clientes } = await supabase
              .from("cliente")
              .select("cliente_id, nome")
              .in("cliente_id", clienteIds);

            if (clientes) {
              clienteNames = clientes.reduce(
                (acc, cliente) => {
                  acc[cliente.cliente_id] = cliente.nome;
                  return acc;
                },
                {} as { [key: string]: string },
              );
            }
          }
        }

        // Build recent logs array
        (motoristasResult.data || []).forEach((item) => {
          const timestamp = new Date(item.created_at).getTime();
          recentLogs.push({
            timestamp,
            time: format(new Date(item.created_at), "dd/MM HH:mm"),
            action: `${item.nome} contratado`,
            user: "",
            icon: Users,
          });
        });

        (veiculosResult.data || []).forEach((item) => {
          const timestamp = new Date(item.created_at).getTime();
          recentLogs.push({
            timestamp,
            time: format(new Date(item.created_at), "dd/MM HH:mm"),
            action: `Veículo ${item.placa} cadastrado`,
            user: "",
            icon: Truck,
          });
        });

        (comprovantesResult.data || []).forEach((item) => {
          const clienteName =
            clienteNames[item.cliente_id] || "Cliente não identificado";
          const timestamp = new Date(item.created_at).getTime();
          recentLogs.push({
            timestamp,
            time: format(new Date(item.created_at), "dd/MM HH:mm"),
            action: `Novo comprovante - ${clienteName}`,
            user: "",
            icon: FileText,
          });
        });

        // Sort and limit logs, remove timestamp for UI
        const sortedLogs = recentLogs
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 5);
        recentLogsProcessed = sortedLogs.map(({ timestamp, ...rest }) => rest);
      } catch (error) {
        console.warn("Erro ao buscar logs recentes:", error);
        recentLogsProcessed = [];
      }

      // Hodometro data (non-critical)
      let hodometroData: {
        month: string;
        fullMonth: string;
        km_rodados: number;
        leituras: number;
        avgKmPerLeitura: number;
        previousMonth?: {
          km_rodados: number;
          leituras: number;
        };
      }[] = [];
      try {
        const sixMonthsAgo = subMonths(new Date(), 5);

        // Get hodometro records with correct field names
        const { data: hodometroRecords, error: hodometroError } = await supabase
          .from("hodometro")
          .select(
            "id_hodometro, veiculo_id, data, trip_lida, hod_lido, km_rodado, company_id",
          )
          .eq("company_id", companyId)
          .gte("data", format(sixMonthsAgo, "yyyy-MM-dd"))
          .order("data", { ascending: true });

        if (hodometroError) {
          console.warn("Erro na consulta de hodômetros:", hodometroError);
          throw hodometroError;
        }

        // Process hodometro data by month and calculate km_rodados using real field names
        const hodometroDataMap: {
          [key: string]: {
            km_rodados: number;
            leituras: number;
            km_readings: number[];
          };
        } = {};

        (hodometroRecords || []).forEach((record) => {
          const date = new Date(record.data);
          const monthKey = format(date, "MMM yyyy", { locale: ptBR });

          // Use km_rodado if available, otherwise use trip_lida as numeric value, or hod_lido
          const kmValue =
            Number(record.km_rodado) ||
            Number(record.trip_lida) ||
            Number(record.hod_lido) ||
            0;

          if (!hodometroDataMap[monthKey]) {
            hodometroDataMap[monthKey] = {
              km_rodados: 0,
              leituras: 0,
              km_readings: [],
            };
          }

          // Store km readings for later calculation
          hodometroDataMap[monthKey].km_readings.push(kmValue);
          hodometroDataMap[monthKey].leituras += 1;
        });

        // Calculate km_rodados - sum up all km_rodado values or calculate difference between readings
        Object.keys(hodometroDataMap).forEach((monthKey) => {
          const readings = hodometroDataMap[monthKey].km_readings;
          if (readings.length > 0) {
            // Sum up the km values for the month (since km_rodado might represent trip distances)
            const totalKm = readings.reduce((sum, km) => sum + km, 0);
            hodometroDataMap[monthKey].km_rodados = Math.round(totalKm);
          }
        });

        // Generate data for the last 6 months with enhanced calculations
        const monthlyDataArray: HodometroMonthData[] = [];
        for (let i = 5; i >= 0; i--) {
          const date = subMonths(new Date(), i);
          const month = format(date, "MMM", { locale: ptBR });
          const fullMonth = format(date, "MMM yyyy", { locale: ptBR });
          const monthData = hodometroDataMap[fullMonth] || {
            km_rodados: 0,
            leituras: 0,
          };

          const avgKmPerLeitura = monthData.leituras > 0 ? 
            Number((monthData.km_rodados / monthData.leituras).toFixed(1)) : 0;

          monthlyDataArray.push({
            month,
            fullMonth,
            km_rodados: Math.round(monthData.km_rodados),
            leituras: monthData.leituras,
            avgKmPerLeitura,
          });
        }

        // Add previous month comparison
        hodometroData = monthlyDataArray.map((currentMonth, index) => {
          const previousMonth = index > 0 ? monthlyDataArray[index - 1] : null;
          return {
            ...currentMonth,
            previousMonth: previousMonth ? {
              km_rodados: previousMonth.km_rodados,
              leituras: previousMonth.leituras,
            } : undefined,
          };
        });
      } catch (error) {
        console.warn("Erro ao buscar dados de hodômetros:", error);
        // Default empty hodometro data for last 6 months  
        for (let i = 5; i >= 0; i--) {
          const date = subMonths(new Date(), i);
          const month = format(date, "MMM", { locale: ptBR });
          const fullMonth = format(date, "MMM yyyy", { locale: ptBR });
          hodometroData.push({ 
            month, 
            fullMonth,
            km_rodados: 0, 
            leituras: 0,
            avgKmPerLeitura: 0,
            previousMonth: undefined
          });
        }
      }

      // Process vagas data
      const vagasData =
        vagasResult.data?.map((vaga) => ({
          id: vaga.id,
          nome: vaga.nome || "Vaga não definida",
          quantidade: Number(vaga.quantidade) || 0,
          dt_limite: vaga.dt_limite,
          created_at: vaga.created_at,
        })) || [];

      // Generate default vagas stats
      const defaultVagasStats: VagasStats = {
        abertas: vagasData.length,
        preenchidas: 0,
        vencidas: 0,
        total: vagasData.length,
        taxaPreenchimento: 0,
        recentVagas: vagasData.slice(0, 5),
        statusData: [
          { name: 'Abertas', value: vagasData.length, color: '#10B981' },
          { name: 'Preenchidas', value: 0, color: '#3B82F6' },
          { name: 'Vencidas', value: 0, color: '#EF4444' }
        ]
      };

      // Generate default expanded activities
      const defaultExpandedActivities: ExpandedActivity[] = recentLogsProcessed.map((log, index) => ({
        id: `activity-${index}`,
        time: log.time,
        timestamp: new Date(),
        action: log.action,
        type: 'other' as const,
        details: `Atividade registrada no sistema`,
        user: log.user || 'Sistema',
        icon: log.icon
      }));

      setStats({
        motoristas: motoristasCount || 0,
        agregados: agregadosCount,
        contratados: contratadosCount,
        agregadosPercentage,
        contratadosPercentage,
        agregadosGrowth: 0,
        contratadosGrowth: 0,
        recentHires: [],
        veiculos: veiculosCount || 0,
        checklists: checklistsCount || 0,
        comprovantes: comprovantesCount || 0,
        hodometros: hodometroCount || 0,
        monthlyData,
        distributionData,
        vehicleTypeData,
        recentLogs: recentLogsProcessed,
        expandedActivities: defaultExpandedActivities,
        hodometroData,
        vagas: vagasData,
        vagasStats: defaultVagasStats,
      });
    } catch (error) {
      console.error(
        "Erro ao buscar dados do dashboard:",
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error,
      );
      // Set default empty data on error
      const defaultMonthlyData = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const month = format(date, "MMM", { locale: ptBR });
        const fullMonth = format(date, "MMM yyyy", { locale: ptBR });
        defaultMonthlyData.push({
          month,
          fullMonth,
          value: 0,
          clients: 0,
          avgPerDay: 0,
        });
      }

      setStats({
        motoristas: 0,
        agregados: 0,
        contratados: 0,
        agregadosPercentage: 0,
        contratadosPercentage: 0,
        agregadosGrowth: 0,
        contratadosGrowth: 0,
        recentHires: [],
        veiculos: 0,
        checklists: 0,
        comprovantes: 0,
        hodometros: 0,
        monthlyData: defaultMonthlyData,
        distributionData: [],
        vehicleTypeData: [],
        recentLogs: [],
        expandedActivities: [],
        hodometroData: [],
        vagas: [],
        vagasStats: {
          abertas: 0,
          preenchidas: 0,
          vencidas: 0,
          total: 0,
          taxaPreenchimento: 0,
          recentVagas: [],
          statusData: []
        },
      });
    } finally {
      setStatsLoading(false);
    }
  };

  if (loading || statsLoading) {
    return <LoadingSpinner />;
  }


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Visão geral das operações e métricas principais
          </p>
        </div>

        {/* Stats Pills */}
        <StatsPills stats={stats} />

        {/* Hero Cards Grid - 3 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ContratacaoHeroCard stats={stats} />
          <VagasManagementHeroCard stats={stats} />
          <HodometroHeroCard stats={stats} />
        </div>

        {/* Mini Insights Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ComprovantesInsightCard stats={stats} />
          <VeiculosInsightCard stats={stats} />
          <MotoristasInsightCard stats={stats} />
          <AtividadeInsightCard stats={stats} />
        </div>

        {/* Expanded Activities Section */}
        <ExpandedActivitiesSection stats={stats} />

      </div>

    </div>
  );
};


export default Dashboard;
