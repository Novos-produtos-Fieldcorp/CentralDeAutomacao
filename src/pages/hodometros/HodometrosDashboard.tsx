import React, { useState, useEffect, useCallback } from 'react';
import { 
  Gauge, Clock, Activity, TrendingUp, Store, Users, 
  Calendar, Filter, AlertCircle, Search
} from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import PeriodSelector from '../../components/hodometros/PeriodSelector';
import { useDateRange } from '../../hooks/useDateRange';
import LoadingSpinner from '../../components/LoadingSpinner';

interface DashboardStats {
  totalLeituras: number;
  leiturasHoje: number;
  kmTotalRodado: number;
  kmPorOperacao: {
    nome: string;
    km_total: number;
    percentual: number;
  }[];
  leiturasPorMotorista: {
    nome: string;
    total: number;
    percentual: number;
  }[];
  kmPorMotorista: {
    nome: string;
    km_total: number;
    percentual: number;
  }[];
  leiturasInconsistentes: {
    hod_lido: number;
    hod_informado: number;
    nome: string;
    data: string;
    placa: string;
  }[];
  totalInconsistencias: number;
}

type VehicleCategory = 'all' | 'automoveis' | 'ciclomotores';

const HodometrosDashboard = () => {
  const { query } = useCompanyData();
  const { companyId } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalLeituras: 0,
    leiturasHoje: 0,
    kmTotalRodado: 0,
    kmPorOperacao: [],
    leiturasPorMotorista: [],
    kmPorMotorista: [],
    leiturasInconsistentes: [],
    totalInconsistencias: 0
  });
  const [loading, setLoading] = useState(true);
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('1month');
  const [vehicleCategory, setVehicleCategory] = useState<VehicleCategory>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch all hodometros within date range with related data
      let query = supabase.from('hodometro')
        .select(`
          *,
          motorista:motorista_id (nome),
          veiculo:veiculo_id (placa, marca, tipo, tipologia),
          cliente:cliente_id (nome)
        `)
        .eq('company_id', companyId);
      
      // Apply date range filter
      if (dateRange.startDate) {
        query = query.gte('data', dateRange.startDate);
      }
      if (dateRange.endDate) {
        query = query.lte('data', dateRange.endDate);
      }
      
      // Apply vehicle category filter
      if (vehicleCategory === 'ciclomotores') {
        query = query.not('bateria', 'is', null);
      } else if (vehicleCategory === 'automoveis') {
        query = query.is('bateria', null);
      }
      
      const { data: hodometros, error } = await query;

      if (error) throw error;

      if (hodometros) {
        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        
        // Basic stats
        const totalLeituras = hodometros.length;
        const leiturasHoje = hodometros.filter(h => h.data === today).length;
        const kmTotalRodado = hodometros.reduce((acc, curr) => acc + (curr.km_rodado || 0), 0);
        
        // KM por operação (agrupado por cliente_id)
        const operacoesMap = new Map();
        
        // Primeiro, adicionar "Sem operação" para leituras sem cliente
        const semOperacaoKm = hodometros
          .filter(h => !h.cliente_id)
          .reduce((sum, h) => sum + (h.km_rodado || 0), 0);
        
        if (semOperacaoKm > 0) {
          operacoesMap.set('Sem operação', { km_total: semOperacaoKm });
        }
        
        // Depois, agrupar por cliente
        hodometros.forEach(h => {
          if (!h.cliente?.nome || !h.km_rodado) return;
          
          const current = operacoesMap.get(h.cliente.nome) || { km_total: 0 };
          current.km_total += h.km_rodado;
          operacoesMap.set(h.cliente.nome, current);
        });
        
        // Calcular o total para percentuais
        const totalKmOperacoes = Array.from(operacoesMap.values())
          .reduce((sum, op) => sum + op.km_total, 0);
        
        // Formatar dados de operações com percentuais
        const kmPorOperacao = Array.from(operacoesMap.entries())
          .map(([nome, data]) => ({
            nome,
            km_total: data.km_total,
            percentual: (data.km_total / totalKmOperacoes) * 100
          }))
          .sort((a, b) => b.km_total - a.km_total);
        
        // Leituras por motorista
        const motoristasLeiturasMap = new Map();
        
        hodometros.forEach(h => {
          if (!h.motorista?.nome) return;
          
          const current = motoristasLeiturasMap.get(h.motorista.nome) || { total: 0 };
          current.total += 1;
          motoristasLeiturasMap.set(h.motorista.nome, current);
        });
        
        // Calcular o total para percentuais
        const totalLeiturasPorMotorista = Array.from(motoristasLeiturasMap.values())
          .reduce((sum, m) => sum + m.total, 0);
        
        // Formatar dados de leituras por motorista com percentuais
        const leiturasPorMotorista = Array.from(motoristasLeiturasMap.entries())
          .map(([nome, data]) => ({
            nome,
            total: data.total,
            percentual: (data.total / totalLeiturasPorMotorista) * 100
          }))
          .sort((a, b) => b.total - a.total);
        
        // KM por motorista
        const motoristasKmMap = new Map();
        
        hodometros.forEach(h => {
          if (!h.motorista?.nome || !h.km_rodado) return;
          
          const current = motoristasKmMap.get(h.motorista.nome) || { km_total: 0 };
          current.km_total += h.km_rodado;
          motoristasKmMap.set(h.motorista.nome, current);
        });
        
        // Calcular o total para percentuais
        const totalKmPorMotorista = Array.from(motoristasKmMap.values())
          .reduce((sum, m) => sum + m.km_total, 0);
        
        // Formatar dados de KM por motorista com percentuais
        const kmPorMotorista = Array.from(motoristasKmMap.entries())
          .map(([nome, data]) => ({
            nome,
            km_total: data.km_total,
            percentual: (data.km_total / totalKmPorMotorista) * 100
          }))
          .sort((a, b) => b.km_total - a.km_total);
        
        // Leituras inconsistentes
        const leiturasInconsistentes = hodometros
          .filter(h => h.comparacao_leitura === false && h.hod_lido !== null && h.hod_informado !== null)
          .map(h => ({
            hod_lido: h.hod_lido || 0,
            hod_informado: h.hod_informado || 0,
            nome: h.motorista?.nome || 'Desconhecido',
            data: h.data,
            placa: h.veiculo?.placa?.toUpperCase() || 'Desconhecido'
          }))
          .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
        
        const totalInconsistencias = leiturasInconsistentes.length;

        setStats({
          totalLeituras,
          leiturasHoje,
          kmTotalRodado,
          kmPorOperacao,
          leiturasPorMotorista,
          kmPorMotorista,
          leiturasInconsistentes: leiturasInconsistentes.slice(0, 5), // Mostrar apenas as 5 mais recentes
          totalInconsistencias
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  }, [dateRange, vehicleCategory, companyId]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const filteredInconsistencias = stats.leiturasInconsistentes.filter(item => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      item.nome.toLowerCase().includes(searchLower) ||
      item.placa.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          {/* Vehicle Category Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="text-gray-400 w-5 h-5" />
            <div className="text-sm text-gray-600 dark:text-gray-400">Categoria:</div>
            <div className="flex gap-2">
              <button
                onClick={() => setVehicleCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  vehicleCategory === 'all'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setVehicleCategory('automoveis')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  vehicleCategory === 'automoveis'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Automóveis
              </button>
              <button
                onClick={() => setVehicleCategory('ciclomotores')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  vehicleCategory === 'ciclomotores'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Ciclomotores
              </button>
            </div>
          </div>
          
          {/* Period Selector */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Calendar className="text-gray-400 w-5 h-5" />
            <div className="text-sm text-gray-600 dark:text-gray-400">Período:</div>
            <PeriodSelector
              periodType={periodType}
              dateRange={dateRange}
              onPeriodChange={updatePeriod}
              onDateRangeChange={setDateRange}
            />
          </div>
        </div>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard
          title="QTD DE LEITURAS REALIZADAS"
          value={stats.totalLeituras}
          icon={Gauge}
        />
        <StatCard
          title="LEITURAS REALIZADAS HOJE"
          value={stats.leiturasHoje}
          icon={Clock}
        />
        <StatCard
          title="KM TOTAL RODADO"
          value={`${Math.round(stats.kmTotalRodado).toLocaleString('pt-BR')} km`}
          icon={Activity}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KM por Operação */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <Store className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              KM POR OPERAÇÃO
            </h3>
          </div>
          <div className="space-y-4">
            {stats.kmPorOperacao.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-500 dark:text-gray-400">
                  Nenhum dado disponível para o período selecionado
                </p>
              </div>
            ) : (
              stats.kmPorOperacao.slice(0, 5).map((operacao, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {operacao.nome}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {Math.round(operacao.km_total).toLocaleString('pt-BR')} km
                    </span>
                  </div>
                  <div className="h-2.5 bg-blue-100 dark:bg-blue-900/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300"
                      style={{ width: `${operacao.percentual}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Leituras por Motorista */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <Users className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              NÚMERO DE LEITURAS POR MOTORISTA
            </h3>
          </div>
          <div className="space-y-4">
            {stats.leiturasPorMotorista.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-500 dark:text-gray-400">
                  Nenhum dado disponível para o período selecionado
                </p>
              </div>
            ) : (
              stats.leiturasPorMotorista.slice(0, 5).map((motorista, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {motorista.nome}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {motorista.total} leituras
                    </span>
                  </div>
                  <div className="h-2.5 bg-blue-100 dark:bg-blue-900/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300"
                      style={{ width: `${motorista.percentual}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Leituras Inconsistentes */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="text-amber-500 dark:text-amber-400" size={20} />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                LEITURAS INCONSISTENTES
              </h3>
              <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                {stats.totalInconsistencias} total
              </span>
            </div>
            
            <div className="relative w-64">
              <input
                type="text"
                placeholder="Buscar por nome ou placa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <Search className="absolute left-2.5 top-1.5 h-4 w-4 text-gray-400" />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            {filteredInconsistencias.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-500 dark:text-gray-400">
                  Nenhuma leitura inconsistente encontrada no período selecionado
                </p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Hodômetro Lido
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Hodômetro Informado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Motorista
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Placa
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredInconsistencias.map((leitura, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                        {leitura.hod_lido.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                        {leitura.hod_informado.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                        {leitura.nome}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                        {formatDate(leitura.data)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                        {leitura.placa}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* KM por Motorista */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md lg:col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              KM POR MOTORISTA
            </h3>
          </div>
          <div className="space-y-4">
            {stats.kmPorMotorista.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-500 dark:text-gray-400">
                  Nenhum dado disponível para o período selecionado
                </p>
              </div>
            ) : (
              stats.kmPorMotorista.slice(0, 5).map((motorista, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {motorista.nome}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {Math.round(motorista.km_total).toLocaleString('pt-BR')} km
                    </span>
                  </div>
                  <div className="h-2.5 bg-blue-100 dark:bg-blue-900/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300"
                      style={{ width: `${motorista.percentual}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ 
  title, 
  value, 
  icon: Icon
}: { 
  title: string;
  value: string | number;
  icon: any;
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex flex-col items-center text-center">
        <div className="p-3 rounded-full bg-blue-50 dark:bg-blue-900/20 mb-4">
          <Icon className="w-6 h-6 text-blue-500 dark:text-blue-400" />
        </div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">{title}</p>
        <span className="text-3xl font-bold text-gray-900 dark:text-white">
          {value}
        </span>
      </div>
    </div>
  );
};

export default HodometrosDashboard;