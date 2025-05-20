import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart2, TrendingUp, AlertTriangle, CheckCircle2, 
  Download, Truck, Users, FileCheck, FileX, Store, Battery
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
    kmPorOperacao: []
  });
  const [loading, setLoading] = useState(true);
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('all');

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: hodometros, error } = await supabase.from('hodometro')
        .select(`
          *,
          motorista:motorista_id (nome),
          veiculo:veiculo_id (placa),
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
          
          const current = motoristasMap.get(h.motorista.nome) || { km_total: 0, data: h.data };
          current.km_total += h.km_rodado;
          current.data = h.data;
          motoristasMap.set(h.motorista.nome, current);
        });

        const kmPorMotorista = Array.from(motoristasMap.entries())
          .map(([nome, data]) => ({
            nome,
            km_total: data.km_total,
            data: data.data
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
          kmPorOperacao
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

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

  if (loading) {
    return (
      <LoadingSpinner />
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <PeriodSelector
          periodType={periodType}
          dateRange={dateRange}
          onPeriodChange={updatePeriod}
          onDateRangeChange={setDateRange}
        />
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total de Leituras"
          value={stats.totalLeituras}
          icon={BarChart2}
          variant="blue"
        />
        <StatCard
          title="Leituras Hoje"
          value={stats.leiturasHoje}
          icon={TrendingUp}
          variant="blue-light"
        />
        <StatCard
          title="KM Total Rodado"
          value={`${Math.round(stats.kmTotalRodado).toLocaleString('pt-BR')} km`}
          icon={Truck}
          variant="blue"
        />
        <StatCard
          title="Média KM/Veículo"
          value={`${Math.round(stats.kmMediaPorVeiculo).toLocaleString('pt-BR')} km`}
          icon={TrendingUp}
          variant="blue-light"
        />
      </div>

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
            stats.kmPorOperacao.map((operacao, index) => (
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
                  <div className="flex-1 h-2 bg-blue-100 dark:bg-blue-900/20 rounded-full overflow-hidden">
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

      {/* Electric Vehicle Stats */}
      {stats.totalVeiculosEletricos > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
            <div className="flex items-center gap-2 mb-6">
              <Battery className="text-green-500 dark:text-green-400" size={20} />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Ciclomotores Elétricos
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                <div className="text-sm text-green-600 dark:text-green-400 mb-1">Total de Registros</div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {stats.totalRegistrosCiclomotores}
                </div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                <div className="text-sm text-green-600 dark:text-green-400 mb-1">Bateria Utilizada</div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {Math.round(stats.totalBateriaUtilizada)}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
            <div className="flex items-center gap-2 mb-6">
              <Battery className="text-green-500 dark:text-green-400" size={20} />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Ciclomotores por Bateria
              </h3>
            </div>
            <div className="space-y-4">
              {stats.kmPorVeiculo
                .filter(v => v.is_electric)
                .slice(0, 5)
                .map((veiculo, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {veiculo.placa.toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Bateria: {veiculo.bateria}
                      </span>
                    </div>
                    <div className="h-2 bg-green-100 dark:bg-green-900/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 dark:bg-green-400 rounded-full"
                        style={{ width: `${(veiculo.bateria || 0)}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
                      Bateria utilizada: {typeof veiculo.bateria === 'number' ? (100 - veiculo.bateria) : 0}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Verification and Consistency Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Verificação IA */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <FileCheck className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Verificação por IA ({stats.totalLeituras} leituras)
              <span className="block text-xs font-normal text-gray-500 dark:text-gray-400 mt-1">
                Comparação entre a leitura da IA e a informada pelo motorista
              </span>
            </h3>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Leituras Confirmadas pela IA
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                    (IA = Motorista)
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {stats.verificacaoTrue} ({Math.round((stats.verificacaoTrue / stats.totalLeituras) * 100)}%)
                </span>
              </div>
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 dark:bg-green-400 rounded-full"
                  style={{ width: `${(stats.verificacaoTrue / stats.totalLeituras) * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Leituras Reprovadas pela IA
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                    (IA ≠ Motorista)
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {stats.verificacaoFalse} ({Math.round((stats.verificacaoFalse / stats.totalLeituras) * 100)}%)
                </span>
              </div>
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-500 dark:bg-red-400 rounded-full"
                  style={{ width: `${(stats.verificacaoFalse / stats.totalLeituras) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Consistency Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <FileX className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Consistência das Leituras
            </h3>
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Consistentes</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {stats.comparacaoTrue} leituras
                </span>
              </div>
              <div className="h-2 bg-blue-100 dark:bg-blue-900/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 dark:bg-blue-400 rounded-full"
                  style={{ width: `${(stats.comparacaoTrue / stats.totalLeituras) * 100}%` }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Inconsistentes</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {stats.comparacaoFalse} leituras
                </span>
              </div>
              <div className="h-2 bg-blue-100 dark:bg-blue-900/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 dark:bg-blue-400 rounded-full"
                  style={{ width: `${(stats.comparacaoFalse / stats.totalLeituras) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KM Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KM por Cliente */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <Store className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Quilometragem por Cliente
            </h3>
          </div>
          <div className="space-y-4">
            {stats.kmPorCliente.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-500 dark:text-gray-400">
                  Nenhum dado disponível para o período selecionado
                </p>
              </div>
            ) : (
              stats.kmPorCliente.map((cliente, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {cliente.nome}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(cliente.data).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-blue-100 dark:bg-blue-900/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 dark:bg-blue-400 rounded-full"
                        style={{ width: `${(cliente.km_total / stats.kmPorCliente[0].km_total) * 100}%` }}
                      />
                    </div>
                    <span className="w-24 text-right text-sm font-medium text-gray-900 dark:text-white">
                      {Math.round(cliente.km_total).toLocaleString('pt-BR')} km
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* KM por Veículo */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <Truck className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Quilometragem por Veículo
            </h3>
          </div>
          <div className="space-y-4">
            {stats.kmPorVeiculo
              .filter(v => !v.is_electric)
              .map((veiculo, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {veiculo.placa.toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(veiculo.data).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-blue-100 dark:bg-blue-900/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 dark:bg-blue-400 rounded-full"
                        style={{ 
                          width: `${(veiculo.km_total / Math.max(...stats.kmPorVeiculo.filter(v => !v.is_electric).map(v => v.km_total))) * 100}%` 
                        }}
                      />
                    </div>
                    <span className="w-24 text-right text-sm font-medium text-gray-900 dark:text-white">
                      {Math.round(veiculo.km_total).toLocaleString('pt-BR')} km
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* KM por Motorista */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <Users className="text-blue-500 dark:text-blue-400" size={20} />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Quilometragem por Motorista
            </h3>
          </div>
          <div className="space-y-4">
            {stats.kmPorMotorista.map((motorista, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {motorista.nome}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(motorista.data).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-blue-100 dark:bg-blue-900/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 dark:bg-blue-400 rounded-full"
                      style={{ width: `${(motorista.km_total / stats.kmPorMotorista[0].km_total) * 100}%` }}
                    />
                  </div>
                  <span className="w-24 text-right text-sm font-medium text-gray-900 dark:text-white">
                    {Math.round(motorista.km_total).toLocaleString('pt-BR')} km
                  </span>
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
  value: string | number;
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