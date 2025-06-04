import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart2, TrendingUp, AlertTriangle, CheckCircle2, 
  Download, Truck, Users, FileCheck, FileX, Store, Battery,
  Calendar, Gauge, XCircle, Clock, BarChart, PieChart
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
  verificacaoTrue: number;
  verificacaoFalse: number;
  comparacaoTrue: number;
  comparacaoFalse: number;
  kmTotalRodado: number;
  kmMediaPorVeiculo: number;
  kmMediaPorMotorista: number;
  totalVeiculosEletricos: number;
  totalRegistrosCiclomotores: number;
  mediaBateria: number;
  totalBateriaUtilizada: number;
  kmPorVeiculo: {
    placa: string;
    km_total: number;
    data: string;
    is_electric?: boolean;
    bateria?: number | null;
  }[];
  kmPorMotorista: {
    nome: string;
    km_total: number;
    data: string;
    leituras: number;
  }[];
  kmPorCliente: {
    nome: string;
    km_total: number;
    data: string;
  }[];
  kmPorOperacao: {
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
}

interface VehicleTypeFilter {
  value: string;
  label: string;
}

const HodometrosDashboard = () => {
  const { query } = useCompanyData();
  const { companyId } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalLeituras: 0,
    leiturasHoje: 0,
    verificacaoTrue: 0,
    verificacaoFalse: 0,
    comparacaoTrue: 0,
    comparacaoFalse: 0,
    kmTotalRodado: 0,
    kmMediaPorVeiculo: 0,
    kmMediaPorMotorista: 0,
    totalVeiculosEletricos: 0,
    totalRegistrosCiclomotores: 0,
    mediaBateria: 0,
    totalBateriaUtilizada: 0,
    kmPorVeiculo: [],
    kmPorMotorista: [],
    kmPorCliente: [],
    kmPorOperacao: [],
    leiturasInconsistentes: []
  });
  const [loading, setLoading] = useState(true);
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('all');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<string>('all');

  const vehicleTypeOptions: VehicleTypeFilter[] = [
    { value: 'all', label: 'Todos os veículos' },
    { value: 'electric', label: 'Ciclomotores elétricos' },
    { value: 'regular', label: 'Veículos regulares' }
  ];

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: hodometros, error } = await supabase.from('hodometro')
        .select(`
          *,
          motorista:motorista_id (nome),
          veiculo:veiculo_id (placa, marca, tipo),
          cliente:cliente_id (nome)
        `)
        .eq('company_id', companyId)
        .gte('data', dateRange.startDate)
        .lte('data', dateRange.endDate)
        .order('data', { ascending: true });

      if (error) throw error;

      if (hodometros) {
        const hoje = new Date().toISOString().split('T')[0];
        
        // Basic stats
        const totalLeituras = hodometros.length;
        const leiturasHoje = hodometros.filter(h => h.data === hoje).length;
        const verificacaoTrue = hodometros.filter(h => h.verificacao).length;
        const verificacaoFalse = hodometros.filter(h => !h.verificacao).length;
        const comparacaoTrue = hodometros.filter(h => h.comparacao_leitura === true).length;
        const comparacaoFalse = hodometros.filter(h => h.comparacao_leitura === false).length;
        
        // Electric vehicles stats
        const electricVehicleReadings = hodometros.filter(h => h.bateria !== null && h.bateria !== undefined);
        const totalVeiculosEletricos = new Set(electricVehicleReadings.map(h => h.veiculo_id)).size;
        const totalRegistrosCiclomotores = electricVehicleReadings.length;
        
        // Calculate average battery level and total battery used
        let mediaBateria = 0;
        let totalBateriaUtilizada = 0;
        
        if (electricVehicleReadings.length > 0) {
          // Calculate average battery level
          let validBatteryReadings = 0;
          let batterySum = 0;
          
          electricVehicleReadings.forEach(reading => {
            if (typeof reading.bateria === 'number') {
              batterySum += reading.bateria;
              validBatteryReadings++;
            }
          });
          
          mediaBateria = validBatteryReadings > 0 ? batterySum / validBatteryReadings : 0;
          
          // Calculate total battery used
          electricVehicleReadings.forEach(reading => {
            if (typeof reading.bateria === 'number') {
              totalBateriaUtilizada += (100 - reading.bateria);
            }
          });
        }

        // Total KM
        const kmTotalRodado = hodometros.reduce((acc, curr) => acc + (curr.km_rodado || 0), 0);

        // KM por veículo
        const veiculosMap = new Map();
        hodometros.forEach(h => {
          if (!h.veiculo?.placa) return;
          
          const isElectric = h.bateria !== null && h.bateria !== undefined;
          const current = veiculosMap.get(h.veiculo.placa) || { 
            km_total: 0, 
            data: h.data, 
            is_electric: isElectric,
            bateria: isElectric ? h.bateria : null
          };
          
          current.km_total += h.km_rodado || 0;
          current.data = h.data;
          
          // Update battery info for electric vehicles
          if (isElectric) {
            current.bateria = h.bateria;
          }
          
          veiculosMap.set(h.veiculo.placa, current);
        });

        const kmPorVeiculo = Array.from(veiculosMap.entries())
          .map(([placa, data]) => ({
            placa,
            km_total: data.km_total,
            data: data.data,
            is_electric: data.is_electric,
            bateria: data.bateria
          }))
          .sort((a, b) => b.km_total - a.km_total);

        // KM por motorista
        const motoristasMap = new Map();
        hodometros.forEach(h => {
          if (!h.motorista?.nome || !h.km_rodado) return;
          
          const current = motoristasMap.get(h.motorista.nome) || { 
            km_total: 0, 
            data: h.data,
            leituras: 0
          };
          current.km_total += h.km_rodado;
          current.data = h.data;
          current.leituras += 1;
          motoristasMap.set(h.motorista.nome, current);
        });

        const kmPorMotorista = Array.from(motoristasMap.entries())
          .map(([nome, data]) => ({
            nome,
            km_total: data.km_total,
            data: data.data,
            leituras: data.leituras
          }))
          .sort((a, b) => b.km_total - a.km_total);

        // KM por cliente
        const clientesMap = new Map();
        hodometros.forEach(h => {
          if (!h.cliente?.nome || !h.km_rodado) return;
          
          const current = clientesMap.get(h.cliente.nome) || { km_total: 0, data: h.data };
          current.km_total += h.km_rodado;
          current.data = h.data;
          clientesMap.set(h.cliente.nome, current);
        });

        const kmPorCliente = Array.from(clientesMap.entries())
          .map(([nome, data]) => ({
            nome,
            km_total: data.km_total,
            data: data.data
          }))
          .sort((a, b) => b.km_total - a.km_total);

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
          .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
          .slice(0, 5); // Mostrar apenas as 5 mais recentes

        // Calculate averages
        const regularVehicles = veiculosMap.size - totalVeiculosEletricos;
        const kmMediaPorVeiculo = regularVehicles > 0 
          ? kmTotalRodado / regularVehicles 
          : 0;
        const kmMediaPorMotorista = kmTotalRodado / (motoristasMap.size || 1);

        setStats({
          totalLeituras,
          leiturasHoje,
          verificacaoTrue,
          verificacaoFalse,
          comparacaoTrue,
          comparacaoFalse,
          kmTotalRodado,
          kmMediaPorVeiculo,
          kmMediaPorMotorista,
          totalVeiculosEletricos,
          totalRegistrosCiclomotores,
          mediaBateria,
          totalBateriaUtilizada,
          kmPorVeiculo,
          kmPorMotorista,
          kmPorCliente,
          kmPorOperacao,
          leiturasInconsistentes
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  }, [dateRange, companyId]);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      if (mounted) {
        await fetchDashboardData();
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [fetchDashboardData]);

  const filteredVehicleData = () => {
    if (vehicleTypeFilter === 'all') {
      return stats.kmPorVeiculo;
    } else if (vehicleTypeFilter === 'electric') {
      return stats.kmPorVeiculo.filter(v => v.is_electric);
    } else {
      return stats.kmPorVeiculo.filter(v => !v.is_electric);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="text-gray-400 w-5 h-5" />
            <PeriodSelector
              periodType={periodType}
              dateRange={dateRange}
              onPeriodChange={updatePeriod}
              onDateRangeChange={setDateRange}
            />
          </div>
          
          <div className="flex items-center gap-2 ml-auto">
            <Truck className="text-gray-400 w-5 h-5" />
            <select
              value={vehicleTypeFilter}
              onChange={(e) => setVehicleTypeFilter(e.target.value)}
              className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {vehicleTypeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <StatCard
          title="Total de Leituras"
          value={stats.totalLeituras}
          icon={Gauge}
          variant="blue"
        />
        <StatCard
          title="Leituras Hoje"
          value={stats.leiturasHoje}
          icon={Clock}
          variant="green"
        />
        <StatCard
          title="KM Total Rodado"
          value={`${Math.round(stats.kmTotalRodado).toLocaleString('pt-BR')} km`}
          icon={Truck}
          variant="purple"
        />
        <StatCard
          title="Média KM/Veículo"
          value={`${Math.round(stats.kmMediaPorVeiculo).toLocaleString('pt-BR')} km`}
          icon={TrendingUp}
          variant="amber"
        />
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KM por Operação */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <Store className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Quilometragem por Operação
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
                      {operacao.percentual.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-3 bg-blue-100 dark:bg-blue-900/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 dark:bg-blue-400 rounded-full"
                        style={{ width: `${operacao.percentual}%` }}
                      />
                    </div>
                    <span className="w-24 text-right text-sm font-medium text-gray-900 dark:text-white">
                      {Math.round(operacao.km_total).toLocaleString('pt-BR')} km
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Leituras por Motorista */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <Users className="text-purple-500 dark:text-purple-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Número de Leituras por Motorista
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
                      {motorista.leituras} leituras
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-3 bg-purple-100 dark:bg-purple-900/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-purple-500 dark:bg-purple-400 rounded-full"
                        style={{ width: `${(motorista.leituras / Math.max(...stats.kmPorMotorista.map(m => m.leituras))) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Leituras Inconsistentes */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md lg:col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <AlertTriangle className="text-amber-500 dark:text-amber-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Leituras Inconsistentes
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            {stats.leiturasInconsistentes.length === 0 ? (
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
                  {stats.leiturasInconsistentes.map((leitura, index) => (
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

        {/* Verification and Consistency Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <FileCheck className="text-green-500 dark:text-green-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Verificação por IA ({stats.totalLeituras} leituras)
            </h3>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Leituras Confirmadas
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {stats.verificacaoTrue} ({Math.round((stats.verificacaoTrue / (stats.totalLeituras || 1)) * 100)}%)
                </span>
              </div>
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 dark:bg-green-400 rounded-full"
                  style={{ width: `${(stats.verificacaoTrue / (stats.totalLeituras || 1)) * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Leituras Reprovadas
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {stats.verificacaoFalse} ({Math.round((stats.verificacaoFalse / (stats.totalLeituras || 1)) * 100)}%)
                </span>
              </div>
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-500 dark:bg-red-400 rounded-full"
                  style={{ width: `${(stats.verificacaoFalse / (stats.totalLeituras || 1)) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Consistency Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <FileX className="text-amber-500 dark:text-amber-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Consistência das Leituras
            </h3>
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Consistentes</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {stats.comparacaoTrue} leituras ({Math.round((stats.comparacaoTrue / (stats.totalLeituras || 1)) * 100)}%)
                </span>
              </div>
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 dark:bg-green-400 rounded-full"
                  style={{ width: `${(stats.comparacaoTrue / (stats.totalLeituras || 1)) * 100}%` }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Inconsistentes</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {stats.comparacaoFalse} leituras ({Math.round((stats.comparacaoFalse / (stats.totalLeituras || 1)) * 100)}%)
                </span>
              </div>
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 dark:bg-amber-400 rounded-full"
                  style={{ width: `${(stats.comparacaoFalse / (stats.totalLeituras || 1)) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* KM por Motorista */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <Users className="text-indigo-500 dark:text-indigo-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Quilometragem por Motorista
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
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-3 bg-indigo-100 dark:bg-indigo-900/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 dark:bg-indigo-400 rounded-full"
                        style={{ width: `${(motorista.km_total / (stats.kmPorMotorista[0]?.km_total || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* KM por Veículo */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <Truck className="text-teal-500 dark:text-teal-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Quilometragem por Veículo
            </h3>
          </div>
          <div className="space-y-4">
            {filteredVehicleData().length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-500 dark:text-gray-400">
                  Nenhum dado disponível para o período selecionado
                </p>
              </div>
            ) : (
              filteredVehicleData().slice(0, 5).map((veiculo, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {veiculo.placa.toUpperCase()}
                      </span>
                      {veiculo.is_electric && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200">
                          Elétrico
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {Math.round(veiculo.km_total).toLocaleString('pt-BR')} km
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-3 bg-teal-100 dark:bg-teal-900/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-teal-500 dark:bg-teal-400 rounded-full"
                        style={{ 
                          width: `${(veiculo.km_total / (filteredVehicleData()[0]?.km_total || 1)) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                  {veiculo.is_electric && veiculo.bateria !== null && veiculo.bateria !== undefined && (
                    <div className="flex items-center gap-2 mt-1">
                      <Battery className="w-4 h-4 text-green-500" />
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Bateria: {veiculo.bateria}%
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Electric Vehicle Stats */}
        {stats.totalVeiculosEletricos > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md lg:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <Battery className="text-green-500 dark:text-green-400" size={20} />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Ciclomotores Elétricos
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                <div className="text-sm text-green-600 dark:text-green-400 mb-1">Total de Veículos</div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {stats.totalVeiculosEletricos}
                </div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                <div className="text-sm text-green-600 dark:text-green-400 mb-1">Total de Registros</div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {stats.totalRegistrosCiclomotores}
                </div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                <div className="text-sm text-green-600 dark:text-green-400 mb-1">Média de Bateria</div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {Math.round(stats.mediaBateria)}%
                </div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                <div className="text-sm text-green-600 dark:text-green-400 mb-1">Bateria Utilizada</div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {Math.round(stats.totalBateriaUtilizada)}%
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {stats.kmPorVeiculo
                .filter(v => v.is_electric)
                .slice(0, 4)
                .map((veiculo, index) => (
                  <div key={index} className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {veiculo.placa.toUpperCase()}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200">
                        Bateria: {veiculo.bateria}%
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 bg-green-100 dark:bg-green-900/20 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-green-500 dark:bg-green-400 rounded-full"
                          style={{ width: `${(veiculo.bateria || 0)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Autonomia: {Math.round(veiculo.km_total).toLocaleString('pt-BR')} km</span>
                        <span>Bateria utilizada: {typeof veiculo.bateria === 'number' ? (100 - veiculo.bateria) : 0}%</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
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
  value: string | number;
  icon: any;
  variant?: 'blue' | 'green' | 'purple' | 'amber' | 'teal' | 'indigo';
}) => {
  const variants = {
    'blue': {
      icon: 'text-blue-500 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20'
    },
    'green': {
      icon: 'text-green-500 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20'
    },
    'purple': {
      icon: 'text-purple-500 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-900/20'
    },
    'amber': {
      icon: 'text-amber-500 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-900/20'
    },
    'teal': {
      icon: 'text-teal-500 dark:text-teal-400',
      bg: 'bg-teal-50 dark:bg-teal-900/20'
    },
    'indigo': {
      icon: 'text-indigo-500 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-900/20'
    }
  };

  const style = variants[variant];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400 mb-4">
        <div className={`p-2 rounded-lg ${style.bg}`}>
          <Icon className={`w-6 h-6 ${style.icon}`} />
        </div>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <span className="text-2xl font-bold text-gray-900 dark:text-white">
        {value}
      </span>
    </div>
  );
};

export default HodometrosDashboard;