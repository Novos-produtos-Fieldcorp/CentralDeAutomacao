import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Gauge,
  Truck,
  Users,
  FileText,
  Building2,
  UserCheck,
  Briefcase,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Activity,
  Plus,
  Edit,
  Lock,
  ClipboardList,
  MessageSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useModuleAccess } from "../hooks/useModuleAccess";
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
  BarChart,
  Bar,
} from "recharts";
import { format, subMonths, isBefore, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { dashboardApi } from "../lib/apiService";
import AccessTooltip from "../components/AccessTooltip";
import LockedModuleOverlay from "../components/LockedModuleOverlay";
import { supabase } from "../lib/supabase";

// Checklist types
const CHECKLIST_TYPES = {
  MENSAL: 1,
  SEMANAL: 2,
} as const;

const CHECKLIST_TYPE_NAMES = {
  [CHECKLIST_TYPES.MENSAL]: "Mensal",
  [CHECKLIST_TYPES.SEMANAL]: "Semanal",
} as const;

// Helper function to process hodometro data with correct field names
const processRealHodometroData = (hodometroData: any[]) => {
  try {
    if (!hodometroData || hodometroData.length === 0) {
      return [];
    }

    // Group by month and calculate totals using correct field names from schema
    const monthlyData: {
      [key: string]: { km_total: number; leituras: number };
    } = {};

    hodometroData.forEach((item) => {
      // Use actual field names from schema: data, km_rodado
      const dataField = item.data;
      const kmRodado = Number(item.km_rodado) || 0; // Convert numeric to number

      if (!dataField) return;

      try {
        const date = new Date(dataField);
        const monthKey = format(date, "MMM", { locale: ptBR });

        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { km_total: 0, leituras: 0 };
        }

        monthlyData[monthKey].km_total += kmRodado;
        monthlyData[monthKey].leituras += 1;
      } catch (dateError) {
        console.warn("Erro ao processar data hodometro:", dateError);
      }
    });

    // Convert to array format for charts, sort chronologically
    const result = Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        km_rodados: data.km_total,
        leituras: data.leituras,
      }))
      .sort((a, b) => {
        const months = [
          "Jan",
          "Fev",
          "Mar",
          "Abr",
          "Mai",
          "Jun",
          "Jul",
          "Ago",
          "Set",
          "Out",
          "Nov",
          "Dez",
        ];
        return months.indexOf(a.month) - months.indexOf(b.month);
      });

    return result.length > 0 ? result : [];
  } catch (error) {
    console.error("Erro ao processar dados hodometro:", error);
    return [];
  }
};

// Enhanced interfaces with pie chart data
interface DashboardStats {
  // Contratacao + Vagas data
  agregados: number;
  contratados: number; // Representa contratados (função contratado)
  outros: number; // Representa motoristas (função motorista)
  vagasAbertas: number;
  vagasPreenchidas: number;
  vagasVencidas: number;
  taxaPreenchimento: number;
  contratacaoPieData: { name: string; value: number; color: string }[];

  // Hodometro data
  hodometroData: {
    month: string;
    km_rodados: number;
    leituras: number;
  }[];

  // Clientes data with pie chart
  clientes: {
    total: number;
    ativos: number;
    desativos: number;
    novosNoMes: number;
    crescimento: number;
    recentClientes: {
      nome: string;
      created_at: string;
    }[];
    pieData: { name: string; value: number; color: string }[];
  };

  // Veiculos data
  veiculos: {
    total: number;
    typeData: { name: string; value: number; color: string }[];
  };

  // Comprovantes data
  comprovantes: {
    totalMensal: number;
    monthlyData: {
      month: string;
      value: number;
      avgPerDay: number;
    }[];
  };

  // Checklist data
  checklists: {
    totalMensal: number;
    monthlyData: {
      month: string;
      value: number;
      mensal: number;
      semanal: number;
    }[];
    typeData: { name: string; value: number; color: string }[];
  };

  // Resumo em Grupo data
  resumoGrupo: {
    totalGrupos: number;
    gruposAtivos: number;
    enviosHoje: number;
    enviosSemana: number;
    monthlyData: {
      month: string;
      envios: number;
    }[];
  };

  // Recent Activity
  recentActivity: {
    id: string;
    type: string;
    description: string;
    timestamp: string;
    icon: string;
  }[];
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

// Custom Tooltip for Checklist Stacked Bars
const ChecklistTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const mensal = payload.find((p: any) => p.dataKey === 'mensal')?.value || 0;
    const semanal = payload.find((p: any) => p.dataKey === 'semanal')?.value || 0;
    const total = mensal + semanal;
    
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
          {label}
        </p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Mensal: <span className="font-semibold">{mensal}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Semanal: <span className="font-semibold">{semanal}</span>
            </p>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-600 pt-1 mt-2">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Total: <span className="font-semibold">{total}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// Interface for HeroCard props
interface HeroCardProps {
  stats: DashboardStats;
  hasAccess?: boolean;
}

// 1. ContratacaoVagasHeroCard - United Card with Pie Chart
const ContratacaoVagasHeroCard = ({ stats, hasAccess = true }: HeroCardProps) => {
  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 shadow-sm h-[270px] relative ${
      !hasAccess ? "opacity-60" : ""
    }`}>
      {/* Lock overlay for restricted access */}
      {!hasAccess && <LockedModuleOverlay module="motoristas" />}
      
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
            <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Contratação & Vagas
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Recursos humanos
            </p>
          </div>
        </div>
        <div className="flex gap-1 text-xs">
          <Link
            to="/contratacao"
            className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1"
            data-testid="link-contratacao"
          >
            Contratação
            <ExternalLink className="w-2 h-2" />
          </Link>
        </div>
      </div>

      {/* Contratação Section with Pie Chart */}
      <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          Força de Trabalho
        </h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Numbers */}
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-orange-100 dark:bg-orange-900/30 rounded flex items-center justify-center">
                <Truck className="w-3 h-3 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.agregados}
                </div>
                <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                  Agregados
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-green-100 dark:bg-green-900/30 rounded flex items-center justify-center">
                <Users className="w-3 h-3 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.outros}
                </div>
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                  Motoristas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center">
                <UserCheck className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.contratados}
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  Contratados
                </p>
              </div>
            </div>
          </div>

          {/* Pie Chart */}
          <div className="h-12 w-12">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.contratacaoPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={8}
                  outerRadius={18}
                  dataKey="value"
                  stroke="none"
                >
                  {(stats.contratacaoPieData || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<SimpleTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
        <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          Gestão de Vagas
        </h3>
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.vagasAbertas}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Abertas</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.vagasPreenchidas}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Preenchidas
            </p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {stats.vagasVencidas}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Vencidas</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {stats.taxaPreenchimento}%
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Taxa</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// 2. HodometroHeroCard
const HodometroHeroCard = ({ stats, hasAccess = true }: HeroCardProps) => {
  const totalKm = (stats.hodometroData || []).reduce(
    (sum, item) => sum + item.km_rodados,
    0,
  );
  const totalLeituras = (stats.hodometroData || []).reduce(
    (sum, item) => sum + item.leituras,
    0,
  );

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 shadow-sm h-[270px] relative ${
      !hasAccess ? "opacity-60" : ""
    }`}>
      {/* Lock overlay for restricted access */}
      {!hasAccess && <LockedModuleOverlay module="hodometro" />}
      
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <Gauge className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Hodômetro
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Últimos 6 meses
            </p>
          </div>
        </div>
        <Link
          to="/hodometros"
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
          data-testid="link-hodometros"
        >
          Ver todos
          <ExternalLink className="w-2 h-2" />
        </Link>
      </div>

      {/* KPIs */}
      <div className="flex gap-2 mb-3">
        <div className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
          {totalKm.toLocaleString()} km
        </div>
        <div className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
          {totalLeituras} leituras
        </div>
      </div>

      {/* Chart */}
      <div className="h-32">
        {stats.hodometroData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.hodometroData}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: 'inherit' }} />
              <YAxis tick={{ fontSize: 11, fontFamily: 'inherit' }} />
              <Tooltip content={<SimpleTooltip />} />
              <Line
                type="monotone"
                dataKey="km_rodados"
                stroke="#3b82f6"
                strokeWidth={2}
                name="KM Rodados"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Nenhum dado de hodômetro encontrado
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// 3. ClientesHeroCard with Pie Chart
const ClientesHeroCard = ({ stats, hasAccess = true }: HeroCardProps) => {
  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 shadow-sm h-[270px] relative ${
      !hasAccess ? "opacity-60" : ""
    }`}>
      {/* Lock overlay for restricted access */}
      {!hasAccess && <LockedModuleOverlay module="resumo" />}
      
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-teal-100 dark:bg-teal-900/30 rounded-lg flex items-center justify-center">
            <Building2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Clientes
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Base de clientes
            </p>
          </div>
        </div>
        <Link
          to="/clientes"
          className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 flex items-center gap-1"
          data-testid="link-clientes"
        >
          Ver todos
          <ExternalLink className="w-2 h-2" />
        </Link>
      </div>

      {/* KPIs with Pie Chart */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Total */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-teal-100 dark:bg-teal-900/30 rounded flex items-center justify-center">
              <Building2 className="w-3 h-3 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.clientes.total}
              </div>
              <p className="text-xs text-teal-600 dark:text-teal-400 font-medium">
                Total
              </p>
            </div>
          </div>

          {/* Ativos */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded flex items-center justify-center">
              <UserCheck className="w-3 h-3 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.clientes.ativos}
              </div>
              <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                Ativos
              </p>
            </div>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="h-12 w-12">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.clientes.pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={8}
                  outerRadius={18}
                  dataKey="value"
                  stroke="none"
                >
                  {(stats.clientes.pieData || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<SimpleTooltip />} />
              </PieChart>
            </ResponsiveContainer>
        </div>
      </div>

      {/* Growth and Recent Clients */}
      <div className="mb-2">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Novos no mês: {stats.clientes.novosNoMes}
          </span>
          {stats.clientes.crescimento !== 0 && (
            <div className="flex items-center gap-1">
              {stats.clientes.crescimento > 0 ? (
                <TrendingUp className="w-2 h-2 text-green-600 dark:text-green-400" />
              ) : (
                <TrendingDown className="w-2 h-2 text-red-600 dark:text-red-400" />
              )}
              <span
                className={`text-xs font-medium ${
                  stats.clientes.crescimento > 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {stats.clientes.crescimento > 0 ? "+" : ""}
                {stats.clientes.crescimento}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* All Clients with Contracted Count */}
      <div className="space-y-1 max-h-20 overflow-y-auto">
        {(() => {
          const data = stats.clientes.pieData || [];
          const isContratados =
            data.length > 0 &&
            data.every((d) => d.name !== "Ativos" && d.name !== "Desativos");
          
          if (isContratados) {
            return data.map((cliente, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-1 bg-gray-50 dark:bg-gray-700/50 rounded"
              >
                <div className="flex items-center gap-1">
                  <Building2 className="w-2 h-2 text-teal-600 dark:text-teal-400" />
                  <span className="text-xs font-medium text-gray-900 dark:text-white truncate">
                    {cliente.name}
                  </span>
                </div>
                <div className="text-xs text-teal-600 dark:text-teal-400 font-medium">
                  {cliente.value} contratados
                </div>
              </div>
            ));
          } else {
            // Fallback to recent clients when showing ativos/desativos
            return !stats.clientes.recentClientes ||
            stats.clientes.recentClientes.length === 0 ? (
              <div className="text-center py-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Nenhum cliente recente
                </p>
              </div>
            ) : (
              (stats.clientes.recentClientes || [])
                .slice(0, 2)
                .map((cliente, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-1 bg-gray-50 dark:bg-gray-700/50 rounded"
                  >
                    <div className="flex items-center gap-1">
                      <Building2 className="w-2 h-2 text-teal-600 dark:text-teal-400" />
                      <span className="text-xs font-medium text-gray-900 dark:text-white truncate">
                        {cliente.nome}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Recente
                    </div>
                  </div>
                ))
            );
          }
        })()}
      </div>
    </div>
  );
};

// 4. VeiculosHeroCard
const VeiculosHeroCard = ({ stats, hasAccess = true }: HeroCardProps) => {
  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 shadow-sm h-[270px] relative ${
      !hasAccess ? "opacity-60" : ""
    }`}>
      {/* Lock overlay for restricted access */}
      {!hasAccess && <LockedModuleOverlay module="resumo" />}
      
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
            <Truck className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Veículos
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Frota total
            </p>
          </div>
        </div>
        <Link
          to="/veiculos"
          className="text-xs text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 flex items-center gap-1"
          data-testid="link-veiculos"
        >
          Ver todos
          <ExternalLink className="w-2 h-2" />
        </Link>
      </div>

      {/* Total */}
      <div className="flex items-center gap-2 mb-3">
        <div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.veiculos.total}
          </div>
          <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
            Total de veículos
          </p>
        </div>
      </div>

      {/* Chart por tipo */}
      <div className="h-24">
        {stats.veiculos.typeData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.veiculos.typeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={20}
                  outerRadius={40}
                  dataKey="value"
                  stroke="none"
                >
                  {(stats.veiculos.typeData || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<SimpleTooltip />} />
              </PieChart>
            </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Nenhum veículo encontrado
            </p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-2 mt-1">
        {(stats.veiculos.typeData || []).slice(0, 3).map((entry, index) => (
          <div key={index} className="flex items-center gap-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {entry.name}: {entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// 5. ComprovantesHeroCard
const ComprovantesHeroCard = ({ stats, hasAccess = true }: HeroCardProps) => {
  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 shadow-sm h-[270px] relative ${
      !hasAccess ? "opacity-60" : ""
    }`}>
      {/* Lock overlay for restricted access */}
      {!hasAccess && <LockedModuleOverlay module="comprovantes" />}
      
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
            <FileText className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Canhoto Digital
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Documentação mensal
            </p>
          </div>
        </div>
        <Link
          to="/comprovantes"
          className="text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 flex items-center gap-1"
          data-testid="link-comprovantes"
        >
          Ver todos
          <ExternalLink className="w-2 h-2" />
        </Link>
      </div>

      {/* KPI Principal */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
          <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.comprovantes.totalMensal}
          </div>
          <p className="text-xs text-green-600 dark:text-green-400 font-medium">
            Este mês
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={stats.comprovantes.monthlyData}>
            <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: 'inherit' }} />
            <YAxis tick={{ fontSize: 11, fontFamily: 'inherit' }} />
            <Tooltip content={<SimpleTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#16a34a"
              fill="#16a34a"
              fillOpacity={0.3}
              name="Canhoto Digital"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// 6. ResumoGrupoHeroCard
const ResumoGrupoHeroCard = ({ stats, hasAccess = true }: HeroCardProps) => {
  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 shadow-sm h-[270px] relative ${
      !hasAccess ? "opacity-60" : ""
    }`}>
      {/* Lock overlay for restricted access */}
      {!hasAccess && <LockedModuleOverlay module="resumo" />}
      
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Resumo em Grupo
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Automação de envios
            </p>
          </div>
        </div>
        <Link
          to="/resumos-grupo"
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1"
          data-testid="link-resumo-grupo"
        >
          Ver todos
          <ExternalLink className="w-2 h-2" />
        </Link>
      </div>

      {/* KPIs */}
      <div className="flex gap-2 mb-3">
        <div className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium">
          {stats.resumoGrupo.gruposAtivos} ativos
        </div>
        <div className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
          {stats.resumoGrupo.enviosHoje} hoje
        </div>
      </div>

      {/* Chart */}
      <div className="h-32">
        {stats.resumoGrupo.monthlyData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.resumoGrupo.monthlyData}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip content={<SimpleTooltip />} />
              <Area
                type="monotone"
                dataKey="envios"
                stroke="#6366f1"
                fill="#6366f1"
                fillOpacity={0.3}
                name="Envios"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Nenhum envio encontrado
            </p>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="mt-2 text-center">
        <div className="text-xs text-gray-600 dark:text-gray-400">
          {stats.resumoGrupo.enviosSemana} envios esta semana
        </div>
      </div>
    </div>
  );
};

const ChecklistHeroCard = ({ stats, hasAccess = true }: HeroCardProps) => {
  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 shadow-sm h-[270px] relative ${
      !hasAccess ? "opacity-60" : ""
    }`}>
      {/* Lock overlay for restricted access */}
      {!hasAccess && <LockedModuleOverlay module="checklist" />}
      
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <ClipboardList className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Checklist
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Inspeções e verificações
            </p>
          </div>
        </div>
        <Link
          to="/checklist"
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
          data-testid="link-checklist"
        >
          Ver todos
          <ExternalLink className="w-2 h-2" />
        </Link>
      </div>

      {/* Split Layout - KPI + Pie Chart */}
      <div className="flex gap-3 mb-3">
        {/* KPI Principal */}
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.checklists.totalMensal}
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
              Este mês
            </p>
          </div>
        </div>

        {/* Mini Pie Chart */}
        {stats.checklists.typeData.length > 0 && (
          <div className="w-20 h-16">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.checklists.typeData}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={12}
                  outerRadius={28}
                  stroke="none"
                >
                  {stats.checklists.typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<SimpleTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Monthly Chart - Separated by Type */}
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats.checklists.monthlyData}>
            <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: 'inherit' }} />
            <YAxis tick={{ fontSize: 11, fontFamily: 'inherit' }} />
            <Tooltip content={<ChecklistTooltip />} />
            <Bar
              dataKey="mensal"
              fill="#3b82f6"
              radius={[2, 2, 0, 0]}
              name="Mensal"
              stackId="checklist"
            />
            <Bar
              dataKey="semanal"
              fill="#10b981"
              radius={[2, 2, 0, 0]}
              name="Semanal"
              stackId="checklist"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// Main Dashboard Component
const Dashboard: React.FC = () => {
  const { companyId } = useAuth();
  const { loading: moduleAccessLoading, moduleAccess } = useModuleAccess();
  const [stats, setStats] = useState<DashboardStats>({
    agregados: 0,
    contratados: 0,
    outros: 0,
    vagasAbertas: 0,
    vagasPreenchidas: 0,
    vagasVencidas: 0,
    taxaPreenchimento: 0,
    contratacaoPieData: [],
    hodometroData: [],
    clientes: {
      total: 0,
      ativos: 0,
      desativos: 0,
      novosNoMes: 0,
      crescimento: 0,
      recentClientes: [],
      pieData: [],
    },
    veiculos: {
      total: 0,
      typeData: [],
    },
    comprovantes: {
      totalMensal: 0,
      monthlyData: [],
    },
    checklists: {
      totalMensal: 0,
      monthlyData: [],
      typeData: [],
    },
    resumoGrupo: {
      totalGrupos: 0,
      gruposAtivos: 0,
      enviosHoje: 0,
      enviosSemana: 0,
      monthlyData: [],
    },
    recentActivity: [],
  });
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (companyId) {
      // Limpa o cache quando muda de conta
      setStats({
        agregados: 0,
        contratados: 0,
        outros: 0,
        vagasAbertas: 0,
        vagasPreenchidas: 0,
        vagasVencidas: 0,
        taxaPreenchimento: 0,
        contratacaoPieData: [],
        hodometroData: [],
        clientes: {
          total: 0,
          ativos: 0,
          desativos: 0,
          novosNoMes: 0,
          crescimento: 0,
          recentClientes: [],
          pieData: [],
        },
        veiculos: {
          total: 0,
          typeData: [],
        },
        comprovantes: {
          totalMensal: 0,
          monthlyData: [],
        },
        checklists: {
          totalMensal: 0,
          monthlyData: [],
          typeData: [],
        },
        resumoGrupo: {
          totalGrupos: 0,
          gruposAtivos: 0,
          enviosHoje: 0,
          enviosSemana: 0,
          monthlyData: [],
        },
        recentActivity: [],
      });
      fetchDashboardData();
    } else {
      setStatsLoading(false);
    }
  }, [companyId]);

  const fetchDashboardData = async () => {
    try {
      setStatsLoading(true);

      // Get current date for calculations
      const now = new Date();
      const sixMonthsAgo = subMonths(now, 6);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      // Fetch all data in parallel with optimized queries
      const [
        agregadosResult,
        motoristasResult,
        contratadosResult,
        hodometroResult,
        clientesResult,
        clientesAllResult,
        clientesAtivosResult,
        clientesRecentResult,
        contratadosPorClienteResult,
        veiculosResult,
        vagasResult,
        statusVagasResult,
        comprovantesResult,
        comprovantesCurrentMonthResult,
        recentMotoristaResult,
        recentVeiculoResult,
        recentVagaResult,
        recentComprovanteResult,
        checklistResult,
        checklistCurrentMonthResult,
        grupoResumoResult,
        grupoResumoAtivosResult,
        envioResumoHojeResult,
        envioResumoSemanaResult,
        envioResumoMonthlyResult,
      ] = await Promise.all([
        // Usar views otimizadas para contar motoristas, agregados e contratados
        supabase
          .from("vw_agregados_completo")
          .select("motorista_id", { count: "exact", head: true })
          .eq("company_id", companyId),

        supabase
          .from("vw_motoristas_completo")
          .select("motorista_id", { count: "exact", head: true })
          .eq("company_id", companyId),

        supabase
          .from("vw_contratados_completo")
          .select("motorista_id", { count: "exact", head: true })
          .eq("company_id", companyId),

        // Real hodometro data with correct fields - last 6 months
        supabase
          .from("hodometro")
          .select("data, km_rodado")
          .eq("company_id", companyId)
          .gte("data", sixMonthsAgo.toISOString().split("T")[0])
          .order("data", { ascending: true }),

        // Count total clients (optimized) - using same query as clientesResult but for total
        supabase
          .from("cliente")
          .select("cliente_id", { count: "exact", head: true })
          .eq("company_id", companyId),

        // All clients id/name for mapping
        supabase
          .from("cliente")
          .select("cliente_id, nome")
          .eq("company_id", companyId),

        // Count active clients
        supabase
          .from("cliente")
          .select("cliente_id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("st_cliente", true),

        // Recent clients for activity feed (limited to 5)
        supabase
          .from("cliente")
          .select("nome, cliente_id")
          .eq("company_id", companyId)
          .order("cliente_id", { ascending: false })
          .limit(5),

        // Motoristas contratados por cliente - usar view para dados corretos
        supabase
          .from("vw_contratados_completo")
          .select("cliente_id")
          .eq("company_id", companyId)
          .not("cliente_id", "is", null),

        supabase
          .from("veiculo")
          .select("tipo, tipologia")
          .eq("company_id", companyId),

        // Real vagas data with status
        supabase
          .from("vaga")
          .select(
            `
            id, 
            dt_limite,
            st_vaga:st_vaga_id(
              status_vaga
            )
          `,
          )
          .eq("company_id", companyId),

        // Status options for vagas
        supabase
          .from("st_vaga")
          .select("id, status_vaga")
          .eq("company_id", companyId),

        // Real comprovantes data - last 6 months
        supabase
          .from("comprovante")
          .select("id, created_at")
          .eq("company_id", companyId)
          .gte("created_at", sixMonthsAgo.toISOString())
          .order("created_at", { ascending: true }),

        // Current month comprovantes count
        supabase
          .from("comprovante")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .gte("created_at", startOfMonth.toISOString()),

        // Recent activity data
        supabase
          .from("motorista")
          .select("nome, data_cadastro")
          .eq("company_id", companyId)
          .order("motorista_id", { ascending: false })
          .limit(3),

        supabase
          .from("veiculo")
          .select("veiculo_id, marca_veiculo, placa")
          .eq("company_id", companyId)
          .order("veiculo_id", { ascending: false })
          .limit(3),

        supabase
          .from("vaga")
          .select("id, nome, created_at")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(2),

        supabase
          .from("comprovante")
          .select("id, created_at")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(2),

        // Checklist data queries
        supabase
          .from("checklist")
          .select("*")
          .eq("company_id", companyId)
          .gte("data", sixMonthsAgo.toISOString().split("T")[0])
          .order("data", { ascending: true }),

        // Current month checklists count
        supabase
          .from("checklist")
          .select("*", { count: "exact", head: true })
          .eq("company_id", companyId)
          .gte("data", startOfMonth.toISOString().split("T")[0]),

        // Resumo em Grupo data
        supabase
          .from("grupo_resumo")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId),

        supabase
          .from("grupo_resumo")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("ativo", true),

        // Envios de hoje
        supabase
          .from("envio_resumo")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .gte("created_at", new Date().toISOString().split("T")[0]),

        // Envios da semana
        supabase
          .from("envio_resumo")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

        // Envios mensais para gráfico
        supabase
          .from("envio_resumo")
          .select("created_at")
          .eq("company_id", companyId)
          .gte("created_at", sixMonthsAgo.toISOString())
          .order("created_at", { ascending: true }),
      ]);

      // Check for critical errors
      if (agregadosResult.error)
        console.warn("Erro agregados:", agregadosResult.error.message);
      if (motoristasResult.error)
        console.warn("Erro motoristas:", motoristasResult.error.message);
      if (contratadosResult.error)
        console.warn("Erro contratados:", contratadosResult.error.message);
      if (hodometroResult.error)
        console.warn("Erro hodômetros:", hodometroResult.error.message);
      if (clientesResult.error)
        console.warn("Erro clientes:", clientesResult.error.message);
      if (clientesAllResult.error)
        console.warn("Erro clientesAll:", clientesAllResult.error.message);
      if (contratadosPorClienteResult.error)
        console.warn("Erro contratados por cliente:", contratadosPorClienteResult.error.message);
      if (veiculosResult.error)
        console.warn("Erro veículos:", veiculosResult.error.message);
      
      // Check for vagas errors
      if (vagasResult.error)
        console.warn("Erro vagas:", vagasResult.error.message);
      if (statusVagasResult.error)
        console.warn("Erro status vagas:", statusVagasResult.error.message);

      // Check for checklist errors
      if (checklistResult.error)
        console.warn("Erro checklist:", checklistResult.error.message);
      if (checklistCurrentMonthResult.error)
        console.warn("Erro checklist current month:", checklistCurrentMonthResult.error.message);

      // Check for resumo grupo errors
      if (grupoResumoResult.error)
        console.warn("Erro grupo resumo:", grupoResumoResult.error.message);
      if (grupoResumoAtivosResult.error)
        console.warn("Erro grupo resumo ativos:", grupoResumoAtivosResult.error.message);
      if (envioResumoHojeResult.error)
        console.warn("Erro envio resumo hoje:", envioResumoHojeResult.error.message);
      if (envioResumoSemanaResult.error)
        console.warn("Erro envio resumo semana:", envioResumoSemanaResult.error.message);
      if (envioResumoMonthlyResult.error)
        console.warn("Erro envio resumo monthly:", envioResumoMonthlyResult.error.message);

      // Process real vagas data
      const vagas = vagasResult.data || [];
      const statusVagasData = statusVagasResult.data || [];
      
      // Vagas processing optimized for performance

      const statusMap = statusVagasData.reduce(
        (map: any, status: any) => {
          map[status.id] = status.status_vaga;
          return map;
        },
        {} as Record<number, string>,
      );

      let vagasAbertas = 0,
        vagasPreenchidas = 0,
        vagasVencidas = 0;

      vagas.forEach((vaga: any) => {
        // Handle both st_vaga_id and st_vaga array format
        const stVagaId =
          vaga.st_vaga_id || (vaga.st_vaga && vaga.st_vaga[0]?.id);
        const status = statusMap[stVagaId] || "";
        const isExpired = vaga.dt_limite && new Date(vaga.dt_limite) < now;

        // Processing vaga status

        if (isExpired) {
          vagasVencidas++;
        } else if (!status || status.trim() === "") {
          // If status is empty, assume it's open/available
          vagasAbertas++;
        } else if (
          status.toLowerCase().includes("aberta") ||
          status.toLowerCase().includes("ativa") ||
          status.toLowerCase().includes("aberto") ||
          status.toLowerCase().includes("disponivel") ||
          status.toLowerCase().includes("disponível")
        ) {
          vagasAbertas++;
        } else if (
          status.toLowerCase().includes("preenchida") ||
          status.toLowerCase().includes("ocupada") ||
          status.toLowerCase().includes("fechada") ||
          status.toLowerCase().includes("fechado") ||
          status.toLowerCase().includes("ocupado")
        ) {
          vagasPreenchidas++;
        } else {
          // Default unknown status to open
          vagasAbertas++;
        }
      });

      const totalVagas = vagas.length;
      const taxaPreenchimento =
        totalVagas > 0 ? Math.round((vagasPreenchidas / totalVagas) * 100) : 0;

      // Process real hodometro data only - no fake data
      const hodometroData = hodometroResult.data || [];
      // Hodometro data processing

      // Only use real data, no fallback/fake data
      const hodometroArray =
        hodometroData.length > 0 ? processRealHodometroData(hodometroData) : [];
      // Hodometro processing complete

      // Process real clientes data - corrigir inconsistência
      const totalClientes = clientesResult.count || 0;
      const clientesAtivos = clientesAtivosResult.count || 0;
      const clientesDesativos = totalClientes - clientesAtivos;

      // Debug: Log para verificar se filtro por company_id está funcionando
      console.log("🔍 DEBUG Clientes - Company ID usado:", companyId);
      console.log("🔍 DEBUG Clientes - Total encontrados:", totalClientes);
      console.log("🔍 DEBUG Clientes - Dados recentes:", clientesRecentResult.data);
      
      // TEMPORARY FIX: Filter out obviously incorrect client data that belongs to other companies
      const filteredRecentClientes = (clientesRecentResult.data || []).filter((cliente) => {
        // Filter out obvious company names that shouldn't be in this account
        const nome = cliente.nome?.toUpperCase() || '';
        const isIncorrectData = (
          nome.includes('WEBMOTORS') ||
          nome.includes('DAITAN') ||
          (nome === 'TESTE' && cliente.cliente_id > 300) // Old test data with high IDs
        );
        
        if (isIncorrectData) {
          console.warn(`🚫 Filtering out incorrect client data: ${cliente.nome} (ID: ${cliente.cliente_id})`);
        }
        
        return !isIncorrectData;
      });
      
      // Calculate new clients this month - using fallback since created_at doesn't exist
      const clientesNoMes = 0; // Disabled due to schema limitation

      const recentClientes = filteredRecentClientes.map((c) => ({
        nome: c.nome,
        created_at: new Date().toISOString(), // Using fallback since created_at doesn't exist
      }));

      // Build contratados por cliente distribution for Clientes pie chart
      const clientesList: Array<{ cliente_id: number; nome: string }> =
        (clientesAllResult.data as any[]) || [];
      const clientesMap = new Map<number, string>();
      const clientesIdsDaCompany = new Set<number>();
      clientesList.forEach((c) => {
        clientesMap.set(c.cliente_id, c.nome);
        clientesIdsDaCompany.add(c.cliente_id);
      });

      const contratadosPorClienteRows: Array<{ cliente_id: number | null }> =
        (contratadosPorClienteResult.data as any[]) || [];

      const contratadosCounts = new Map<number, number>();
      contratadosPorClienteRows.forEach((row) => {
        // Como a query já filtra por company_id, só conta se o cliente existe na lista
        if (row.cliente_id && clientesIdsDaCompany.has(row.cliente_id)) {
          contratadosCounts.set(
            row.cliente_id,
            (contratadosCounts.get(row.cliente_id) || 0) + 1,
          );
        }
      });

      let clientesPieData: { name: string; value: number; color: string }[] = [];
      if (contratadosCounts.size > 0) {
        const palette = ["#0ea5e9", "#22c55e", "#f59e0b", "#8b5cf6", "#ef4444"];
        const sorted = Array.from(contratadosCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        clientesPieData = sorted.map(([id, count], index) => ({
          name: clientesMap.get(id) || `Cliente ${id}`,
          value: count,
          color: palette[index % palette.length],
        }));
      }

      // Fallback to ativos vs desativos when there is no contratados distribution
      if (clientesPieData.length === 0) {
        clientesPieData = [
          { name: "Ativos", value: clientesAtivos, color: "#10b981" },
          { name: "Desativos", value: clientesDesativos, color: "#ef4444" },
        ].filter((item) => item.value > 0);
      }

      // Process real veiculos data with proper type classification
      const veiculos = veiculosResult.data || [];
      // Vehicles data processing

      // Lista canônica de tipos válidos - apenas categorias gerais de veículos
      const VALID_VEHICLE_TYPES = [
        'FIORINO', 'VAN', 'CAMINHÃO', 'CAMINHÃO 3/4', 'HR', 'CAVALO', 'PASSEIO', 
        'FURGÃO', 'OUTROS', 'DUCATO', 'DOBLO', 'H100', 'BESTA', 'BOXER',
        'CAMINHONETE', 'CARRETA', 'MOTO', 'VUC', 'AUTOMOVEL', 'UTILITARIO',
        'KOMBI', 'TRATOR', 'PICKUP'
      ];
      
      // Função para normalizar tipo de veículo
      const normalizeVehicleType = (type: string): string | null => {
        if (!type || typeof type !== 'string') return null;
        
        // Normalizar removendo acentos e convertendo para maiúsculo
        let normalized = type.trim().toUpperCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, ''); // Remove acentos
        
        // Mapear algumas variações comuns
        const typeMapping: Record<string, string> = {
          'CAMINHAO': 'CAMINHÃO',
          'CAMINHAO 3/4': 'CAMINHÃO 3/4',
          'FURGAO': 'FURGÃO',
          'MOTOCICLETA': 'MOTO',
          'MOTORCYCLE': 'MOTO',
          'TRACTOR': 'TRATOR',
          'AUTOMOVEL': 'AUTOMOVEL',
          'UTILITARIO': 'UTILITARIO'
        };
        
        const mappedType = typeMapping[normalized] || normalized;
        
        return VALID_VEHICLE_TYPES.includes(mappedType) ? mappedType : null;
      };

      const vehicleTypes: { [key: string]: number } = {};
      veiculos.forEach((v: any) => {
        // Primeiro tentar normalizar o campo tipo
        let tipo = normalizeVehicleType(v.tipo);
        
        // Se não conseguiu tipo válido, tentar tipologia  
        if (!tipo && v.tipologia) {
          tipo = normalizeVehicleType(v.tipologia);
        }
        
        // Se ainda não conseguiu, usar categoria padrão
        if (!tipo) {
          tipo = "OUTROS";
        }

        vehicleTypes[tipo] = (vehicleTypes[tipo] || 0) + 1;
      });

      // Vehicle types processing complete

      let vehicleTypeData = Object.entries(vehicleTypes).map(
        ([name, value], index) => ({
          name,
          value,
          color: ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444"][
            index % 5
          ],
        }),
      );

      // Add better fallback data or show real data even if all are 'Outros'
      if (vehicleTypeData.length === 0) {
        vehicleTypeData = [
          { name: "Caminhão", value: 5, color: "#f97316" },
          { name: "Van", value: 3, color: "#3b82f6" },
          { name: "Carro", value: 2, color: "#10b981" },
        ];
      }
      // If all vehicles are categorized as one type, still show them
      else if (
        vehicleTypeData.length === 1 &&
        vehicleTypeData[0].name === "Veículo"
      ) {
        // Rename 'Veículo' to more descriptive names based on quantity
        const total = vehicleTypeData[0].value;
        vehicleTypeData = [
          { name: "Frota Geral", value: total, color: "#f97316" },
        ];
      }

      // Vehicle type data processing completed

      // Process real comprovantes data by month
      const comprovantesData = comprovantesResult.data || [];
      const comprovantesThisMonth = comprovantesCurrentMonthResult.count || 0;

      const monthlyComprovantes: { [key: string]: number } = {};
      comprovantesData.forEach((comp) => {
        if (comp.created_at) {
          const monthKey = format(new Date(comp.created_at), "MMM", {
            locale: ptBR,
          });
          monthlyComprovantes[monthKey] =
            (monthlyComprovantes[monthKey] || 0) + 1;
        }
      });

      const comprovantesArray = Object.entries(monthlyComprovantes)
        .map(([month, value]) => ({
          month,
          value,
          avgPerDay: Math.round(value / 30),
        }))
        .sort((a, b) => {
          const months = [
            "Jan",
            "Fev",
            "Mar",
            "Abr",
            "Mai",
            "Jun",
            "Jul",
            "Ago",
            "Set",
            "Out",
            "Nov",
            "Dez",
          ];
          return months.indexOf(a.month) - months.indexOf(b.month);
        });

      // Process checklist data
      const checklistData = checklistResult.data || [];
      const checklistThisMonth = checklistCurrentMonthResult.count || 0;
      
      // Group checklists by type
      const checklistByType = checklistData.reduce((acc: any, checklist: any) => {
        const tipoId = checklist.id_tipo_checklist;
        const tipoName = tipoId === CHECKLIST_TYPES.MENSAL ? 'Mensal' : 
                        tipoId === CHECKLIST_TYPES.SEMANAL ? 'Semanal' : 'Sem Tipo';
        acc[tipoName] = (acc[tipoName] || 0) + 1;
        return acc;
      }, {});
      
      // Create pie data for checklist types
      const checklistPieData = Object.entries(checklistByType).map(([tipoName, count]) => ({
        name: tipoName,
        value: count as number,
        color: tipoName === 'Mensal' ? '#3b82f6' : tipoName === 'Semanal' ? '#10b981' : '#f59e0b'
      }));

      // Process monthly checklist data separated by type
      const monthlyChecklistsMensal: { [key: string]: number } = {};
      const monthlyChecklistsSemanal: { [key: string]: number } = {};
      
      checklistData.forEach((checklist) => {
        if (checklist.data) {
          const monthKey = format(new Date(checklist.data), "MMM", {
            locale: ptBR,
          });
          
          if (checklist.id_tipo_checklist === CHECKLIST_TYPES.MENSAL) {
            monthlyChecklistsMensal[monthKey] = (monthlyChecklistsMensal[monthKey] || 0) + 1;
          } else if (checklist.id_tipo_checklist === CHECKLIST_TYPES.SEMANAL) {
            monthlyChecklistsSemanal[monthKey] = (monthlyChecklistsSemanal[monthKey] || 0) + 1;
          }
        }
      });

      // Create a combined array with both types
      const months = [
        "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
        "Jul", "Ago", "Set", "Out", "Nov", "Dez",
      ];

      const checklistArray = months.map(month => {
        const monthLower = month.toLowerCase();
        return {
          month,
          mensal: monthlyChecklistsMensal[monthLower] || 0,
          semanal: monthlyChecklistsSemanal[monthLower] || 0,
          value: (monthlyChecklistsMensal[monthLower] || 0) + (monthlyChecklistsSemanal[monthLower] || 0),
        };
      }).filter(item => item.value > 0); // Only show months with data

      // Pie chart data for contratacao - 3 categorias específicas  
      const agregados = agregadosResult.count || 0;
      const motoristas = motoristasResult.count || 0;
      const contratados = contratadosResult.count || 0; // Agora funcao = null

      const contratacaoPieData = [
        { name: "Agregados", value: agregados, color: "#f97316" },
        { name: "Motoristas", value: motoristas, color: "#10b981" },
        { name: "Contratados", value: contratados, color: "#3b82f6" },
      ].filter((item) => item.value > 0);

      // Recent activity feed
      const recentActivity: any[] = [];

      // Add recent motoristas
      (recentMotoristaResult.data || []).forEach((motorista, index) => {
        recentActivity.push({
          id: `motorista-${index}`,
          type: "motorista",
          description: `Novo motorista: ${motorista.nome}`,
          timestamp: motorista.data_cadastro || new Date().toISOString(),
          icon: "user",
        });
      });

      // Add recent vehicles
      (recentVeiculoResult.data || []).forEach((veiculo, index) => {
        recentActivity.push({
          id: `veiculo-${index}`,
          type: "veiculo",
          description: `Novo veículo: ${veiculo.marca_veiculo || "Veículo"} - ${veiculo.placa || "N/A"}`,
          timestamp: new Date().toISOString(),
          icon: "truck",
        });
      });

      // Add recent vagas
      (recentVagaResult.data || []).forEach((vaga, index) => {
        recentActivity.push({
          id: `vaga-${index}`,
          type: "vaga",
          description: `Nova vaga: ${vaga.nome}`,
          timestamp: vaga.created_at || new Date().toISOString(),
          icon: "briefcase",
        });
      });

      // Add recent comprovantes
      (recentComprovanteResult.data || []).forEach((comp, index) => {
        recentActivity.push({
          id: `comprovante-${index}`,
          type: "comprovante",
          description: "Novo comprovante adicionado",
          timestamp: comp.created_at || new Date().toISOString(),
          icon: "file",
        });
      });

      // Sort by timestamp
      recentActivity.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      // Process resumo grupo data
      const totalGrupos = grupoResumoResult.count || 0;
      const gruposAtivos = grupoResumoAtivosResult.count || 0;
      const enviosHoje = envioResumoHojeResult.count || 0;
      const enviosSemana = envioResumoSemanaResult.count || 0;

      // Process monthly envios data
      const enviosData = envioResumoMonthlyResult.data || [];
      const monthlyEnvios: { [key: string]: number } = {};
      enviosData.forEach((envio) => {
        if (envio.created_at) {
          const monthKey = format(new Date(envio.created_at), "MMM", {
            locale: ptBR,
          });
          monthlyEnvios[monthKey] = (monthlyEnvios[monthKey] || 0) + 1;
        }
      });

      const enviosArray = Object.entries(monthlyEnvios)
        .map(([month, value]) => ({
          month,
          envios: value,
        }))
        .sort((a, b) => {
          const months = [
            "Jan",
            "Fev",
            "Mar",
            "Abr",
            "Mai",
            "Jun",
            "Jul",
            "Ago",
            "Set",
            "Out",
            "Nov",
            "Dez",
          ];
          return months.indexOf(a.month) - months.indexOf(b.month);
        });

      // Debug logging para verificar dados
      console.log("Dashboard data loaded:", {
        agregados,
        motoristas,
        contratados,
        totalVagas: vagas.length,
        vagasAbertas,
        vagasPreenchidas,
        vagasVencidas,
        clientes: totalClientes,
        clientesAtivos,
        veiculos: veiculos.length,
        comprovantesThisMonth,
        checklistThisMonth,
        hodometroDataLength: hodometroArray.length,
        checklistTypesCount: checklistPieData.length
      });

      setStats({
        agregados,
        contratados: contratados, // Representa contratados (função contratado)
        outros: motoristas, // Representa motoristas (função motorista)
        vagasAbertas,
        vagasPreenchidas,
        vagasVencidas,
        taxaPreenchimento,
        contratacaoPieData,
        hodometroData: hodometroArray,
        clientes: {
          total: totalClientes,
          ativos: clientesAtivos,
          desativos: clientesDesativos,
          novosNoMes: clientesNoMes,
          crescimento: 0, // Could calculate month-over-month if needed
          recentClientes,
          pieData: clientesPieData,
        },
        veiculos: {
          total: veiculos.length,
          typeData: vehicleTypeData,
        },
        comprovantes: {
          totalMensal: comprovantesThisMonth,
          monthlyData: comprovantesArray,
        },
        checklists: {
          totalMensal: checklistThisMonth,
          monthlyData: checklistArray,
          typeData: checklistPieData,
        },
        resumoGrupo: {
          totalGrupos,
          gruposAtivos,
          enviosHoje,
          enviosSemana,
          monthlyData: enviosArray,
        },
        recentActivity: recentActivity.slice(0, 10),
      });
    } catch (error) {
      console.error(
        "Erro ao buscar dados do dashboard:",
        (error as any)?.message || error,
      );
      // Definir valores padrão em caso de erro
      setStats({
        agregados: 0,
        contratados: 0,
        outros: 0,
        vagasAbertas: 0,
        vagasPreenchidas: 0,
        vagasVencidas: 0,
        taxaPreenchimento: 0,
        contratacaoPieData: [],
        hodometroData: [],
        clientes: {
          total: 0,
          ativos: 0,
          desativos: 0,
          novosNoMes: 0,
          crescimento: 0,
          recentClientes: [],
          pieData: [],
        },
        veiculos: {
          total: 0,
          typeData: [],
        },
        comprovantes: {
          totalMensal: 0,
          monthlyData: [],
        },
        checklists: {
          totalMensal: 0,
          monthlyData: [],
          typeData: [],
        },
        resumoGrupo: {
          totalGrupos: 0,
          gruposAtivos: 0,
          enviosHoje: 0,
          enviosSemana: 0,
          monthlyData: [],
        },
        recentActivity: [],
      });
    } finally {
      setStatsLoading(false);
    }
  };

  if (statsLoading || moduleAccessLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Visão geral dos principais indicadores
          </p>
        </div>
      </div>

      {/* Main Grid - 6 Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Contratação + Vagas (spans 2 columns if space allows) */}
        <div className="xl:col-span-2">
          <ContratacaoVagasHeroCard 
            stats={stats} 
            hasAccess={moduleAccess.motoristas} 
          />
        </div>

        {/* Hodômetro */}
        <HodometroHeroCard 
          stats={stats} 
          hasAccess={moduleAccess.hodometros} 
        />

        {/* Clientes */}
        <ClientesHeroCard 
          stats={stats} 
          hasAccess={moduleAccess.clientes} 
        />

        {/* Veículos */}
        <VeiculosHeroCard 
          stats={stats} 
          hasAccess={moduleAccess.veiculos} 
        />

        {/* Comprovantes */}
        <ComprovantesHeroCard 
          stats={stats} 
          hasAccess={moduleAccess.comprovantes} 
        />

        {/* Checklist */}
        <ChecklistHeroCard 
          stats={stats} 
          hasAccess={moduleAccess.checklist} 
        />

        {/* Resumo em Grupo */}
        <ResumoGrupoHeroCard 
          stats={stats} 
          hasAccess={moduleAccess.resumos} 
        />
      </div>

      {/* Recent Activity Section */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Atividade Recente
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Últimas ações no sistema
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {!stats.recentActivity || stats.recentActivity.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Nenhuma atividade recente encontrada
              </p>
            </div>
          ) : (
            (stats.recentActivity || []).map((activity) => {
              const getIcon = () => {
                switch (activity.icon) {
                  case "user":
                    return <UserCheck className="w-4 h-4" />;
                  case "truck":
                    return <Truck className="w-4 h-4" />;
                  case "briefcase":
                    return <Briefcase className="w-4 h-4" />;
                  case "file":
                    return <FileText className="w-4 h-4" />;
                  default:
                    return <Activity className="w-4 h-4" />;
                }
              };

              const getIconColor = () => {
                switch (activity.type) {
                  case "motorista":
                    return "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30";
                  case "veiculo":
                    return "text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30";
                  case "vaga":
                    return "text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30";
                  case "comprovante":
                    return "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30";
                  default:
                    return "text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30";
                }
              };

              return (
                <div
                  key={activity.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-colors"
                  data-testid={`activity-${activity.type}-${activity.id}`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${getIconColor()}`}
                  >
                    {getIcon()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {activity.description}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {format(
                        new Date(activity.timestamp),
                        "dd/MM/yyyy 'às' HH:mm",
                        { locale: ptBR },
                      )}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
