import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Truck, Users, Filter, Search, BarChart2, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useDateRange } from '../../hooks/useDateRange';
import PeriodSelector from '../../components/hodometros/PeriodSelector';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatCPF } from '../../utils/format';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell
} from 'recharts';

interface HodometroData {
  id_hodometro: number;
  data: string;
  hora: string;
  hod_informado: number | null;
  hod_lido: number | null;
  km_rodado: number | null;
  bateria: number | null;
  motorista_id: number;
  veiculo_id: number;
  motorista: {
    motorista_id: number;
    nome: string;
    cpf: string;
  };
  veiculo: {
    veiculo_id: number;
    placa: string;
    marca: string;
    tipo: string;
  };
  cliente?: {
    cliente_id: number;
    nome: string;
  } | null;
}

interface MotoristaStats {
  motorista_id: number;
  nome: string;
  cpf: string;
  totalKm: number;
  leituras: number;
  veiculos: {
    [placa: string]: {
      marca: string;
      tipo: string;
      totalKm: number;
    }
  };
  cliente?: string;
}

interface VeiculoStats {
  veiculo_id: number;
  placa: string;
  marca: string;
  tipo: string;
  totalKm: number;
  leituras: number;
  motoristas: {
    [id: number]: {
      nome: string;
      totalKm: number;
    }
  };
}

interface MonthlyData {
  month: string;
  km: number;
}

const HodometrosDashboard = () => {
  const { query, companyId } = useCompanyData();
  const [hodometros, setHodometros] = useState<HodometroData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [clients, setClients] = useState<string[]>([]);
  const [expandedMotorista, setExpandedMotorista] = useState<number | null>(null);
  const [expandedVeiculo, setExpandedVeiculo] = useState<number | null>(null);
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('30days');

  useEffect(() => {
    fetchHodometros();
  }, [dateRange]);

  const fetchHodometros = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('hodometro')
        .select(`
          *,
          motorista:motorista_id (
            motorista_id,
            nome,
            cpf
          ),
          veiculo:veiculo_id (
            veiculo_id,
            placa,
            marca,
            tipo
          ),
          cliente:cliente_id (
            cliente_id,
            nome
          )
        `)
        .eq('company_id', companyId)
        .gte('data', dateRange.startDate)
        .lte('data', dateRange.endDate)
        .order('data', { ascending: false });

      if (error) throw error;

      setHodometros(data || []);
      
      // Extract unique clients
      const uniqueClients = Array.from(new Set(
        data
          ?.filter(h => h.cliente?.nome)
          .map(h => h.cliente?.nome) || []
      )).sort();
      
      setClients(uniqueClients as string[]);
    } catch (error) {
      console.error('Error fetching hodometros:', error);
      toast.error('Erro ao carregar hodômetros');
    } finally {
      setLoading(false);
    }
  };

  // Process data for motoristas
  const motoristasStats = useMemo(() => {
    const stats: Record<number, MotoristaStats> = {};
    
    // Group hodometros by motorista
    hodometros.forEach(hodometro => {
      if (!hodometro.motorista) return;
      
      const motoristaId = hodometro.motorista.motorista_id;
      
      if (!stats[motoristaId]) {
        stats[motoristaId] = {
          motorista_id: motoristaId,
          nome: hodometro.motorista.nome,
          cpf: hodometro.motorista.cpf,
          totalKm: 0,
          leituras: 0,
          veiculos: {},
          cliente: hodometro.cliente?.nome
        };
      }
      
      // Add vehicle if not already added
      const placa = hodometro.veiculo?.placa.toUpperCase() || 'Desconhecido';
      if (!stats[motoristaId].veiculos[placa]) {
        stats[motoristaId].veiculos[placa] = {
          marca: hodometro.veiculo?.marca || '',
          tipo: hodometro.veiculo?.tipo || '',
          totalKm: 0
        };
      }
      
      // Add km_rodado to total
      if (hodometro.km_rodado) {
        stats[motoristaId].totalKm += hodometro.km_rodado;
        stats[motoristaId].veiculos[placa].totalKm += hodometro.km_rodado;
      }
      
      stats[motoristaId].leituras++;
    });
    
    // Convert to array and sort by total km (descending)
    return Object.values(stats).sort((a, b) => b.totalKm - a.totalKm);
  }, [hodometros]);

  // Process data for veiculos
  const veiculosStats = useMemo(() => {
    const stats: Record<number, VeiculoStats> = {};
    
    // Group hodometros by veiculo
    hodometros.forEach(hodometro => {
      if (!hodometro.veiculo) return;
      
      const veiculoId = hodometro.veiculo.veiculo_id;
      
      if (!stats[veiculoId]) {
        stats[veiculoId] = {
          veiculo_id: veiculoId,
          placa: hodometro.veiculo.placa.toUpperCase(),
          marca: hodometro.veiculo.marca,
          tipo: hodometro.veiculo.tipo,
          totalKm: 0,
          leituras: 0,
          motoristas: {}
        };
      }
      
      // Add motorista if not already added
      if (hodometro.motorista) {
        const motoristaId = hodometro.motorista.motorista_id;
        if (!stats[veiculoId].motoristas[motoristaId]) {
          stats[veiculoId].motoristas[motoristaId] = {
            nome: hodometro.motorista.nome,
            totalKm: 0
          };
        }
        
        // Add km_rodado to total
        if (hodometro.km_rodado) {
          stats[veiculoId].motoristas[motoristaId].totalKm += hodometro.km_rodado;
        }
      }
      
      // Add km_rodado to total
      if (hodometro.km_rodado) {
        stats[veiculoId].totalKm += hodometro.km_rodado;
      }
      
      stats[veiculoId].leituras++;
    });
    
    // Convert to array and sort by total km (descending)
    return Object.values(stats).sort((a, b) => b.totalKm - a.totalKm);
  }, [hodometros]);

  // Calculate monthly data
  const monthlyData = useMemo(() => {
    const monthlyKm: Record<string, number> = {};
    
    hodometros.forEach(hodometro => {
      if (!hodometro.km_rodado) return;
      
      const date = new Date(hodometro.data);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      
      if (!monthlyKm[monthKey]) {
        monthlyKm[monthKey] = 0;
      }
      
      monthlyKm[monthKey] += hodometro.km_rodado;
    });
    
    // Convert to array and sort by month
    return Object.entries(monthlyKm).map(([key, km]) => {
      const [year, month] = key.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return {
        month: date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
        km: Math.round(km)
      };
    }).sort((a, b) => {
      const monthA = a.month.split(' ')[0];
      const yearA = a.month.split(' ')[1];
      const monthB = b.month.split(' ')[0];
      const yearB = b.month.split(' ')[1];
      
      if (yearA !== yearB) {
        return parseInt(yearA) - parseInt(yearB);
      }
      
      const months = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
      return months.indexOf(monthA) - months.indexOf(monthB);
    });
  }, [hodometros]);

  // Calculate total km
  const totalKm = useMemo(() => {
    return hodometros.reduce((sum, hodometro) => sum + (hodometro.km_rodado || 0), 0);
  }, [hodometros]);

  // Filter motoristas based on search term and selected client
  const filteredMotoristasStats = useMemo(() => {
    return motoristasStats.filter(motorista => {
      const matchesSearch = !searchTerm || 
        motorista.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        motorista.cpf.includes(searchTerm) ||
        Object.keys(motorista.veiculos).some(placa => 
          placa.toLowerCase().includes(searchTerm.toLowerCase())
        );
      
      const matchesClient = !selectedClient || motorista.cliente === selectedClient;
      
      return matchesSearch && matchesClient;
    });
  }, [motoristasStats, searchTerm, selectedClient]);

  // Filter veiculos based on search term
  const filteredVeiculosStats = useMemo(() => {
    return veiculosStats.filter(veiculo => {
      return !searchTerm || 
        veiculo.placa.toLowerCase().includes(searchTerm.toLowerCase()) ||
        veiculo.marca.toLowerCase().includes(searchTerm.toLowerCase()) ||
        veiculo.tipo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        Object.values(veiculo.motoristas).some(motorista => 
          motorista.nome.toLowerCase().includes(searchTerm.toLowerCase())
        );
    });
  }, [veiculosStats, searchTerm]);

  // Format number with dot as thousands separator
  const formatNumber = (num: number): string => {
    return num.toLocaleString('pt-BR');
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por motorista, CPF ou placa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>

          <div className="relative">
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none"
            >
              <option value="">Todos os clientes</option>
              {clients.map((client, index) => (
                <option key={index} value={client}>{client}</option>
              ))}
            </select>
            <Filter className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <ChevronDown className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>

          <div>
            <PeriodSelector
              periodType={periodType}
              dateRange={dateRange}
              onPeriodChange={updatePeriod}
              onDateRangeChange={setDateRange}
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Quilometragem Total
            </h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {formatNumber(totalKm)} km
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {hodometros.length} leituras no período
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Motoristas Ativos
            </h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {motoristasStats.length}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            motoristas com leituras no período
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Truck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Veículos Ativos
            </h3>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {veiculosStats.length}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            veículos com leituras no período
          </p>
        </div>
      </div>

      {/* Monthly Chart */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <BarChart2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Quilometragem Mensal
          </h3>
        </div>
        
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={monthlyData}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis 
                dataKey="month" 
                angle={-45} 
                textAnchor="end" 
                height={60} 
                tick={{ fontSize: 12 }}
                stroke="#9CA3AF"
              />
              <YAxis 
                tickFormatter={(value) => `${formatNumber(value)}`}
                stroke="#9CA3AF"
              />
              <Tooltip 
                formatter={(value: any) => [formatNumber(value) + ' km', 'Quilômetros']}
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  borderRadius: '0.5rem',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Legend />
              <Bar 
                dataKey="km" 
                name="Quilômetros Rodados" 
                fill="#3B82F6" 
                radius={[4, 4, 0, 0]}
              >
                {monthlyData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={`rgba(59, 130, 246, ${0.5 + (index * 0.05)})`} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Motoristas Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Quilometragem por Motorista
            </h3>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Motorista</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Veículos</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Leituras</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">KM Total</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredMotoristasStats.map((motorista) => (
                <React.Fragment key={motorista.motorista_id}>
                  <tr 
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                    onClick={() => setExpandedMotorista(
                      expandedMotorista === motorista.motorista_id ? null : motorista.motorista_id
                    )}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-medium">
                          {motorista.nome.charAt(0)}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {motorista.nome}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {formatCPF(motorista.cpf)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {motorista.cliente || "Sem cliente"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {Object.keys(motorista.veiculos).length} veículo(s)
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {motorista.leituras}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end">
                        <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          {formatNumber(motorista.totalKm)} km
                        </div>
                        {expandedMotorista === motorista.motorista_id ? (
                          <ChevronUp className="ml-2 h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="ml-2 h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </td>
                  </tr>
                  
                  {/* Expanded view with vehicles */}
                  {expandedMotorista === motorista.motorista_id && (
                    <tr className="bg-gray-50 dark:bg-gray-700/30">
                      <td colSpan={5} className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                          Veículos utilizados:
                        </div>
                        <div className="space-y-3">
                          {Object.entries(motorista.veiculos).map(([placa, veiculo]) => (
                            <div key={placa} className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {placa}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {veiculo.marca} {veiculo.tipo}
                                </div>
                              </div>
                              <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                {formatNumber(veiculo.totalKm)} km
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              
              {filteredMotoristasStats.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    Nenhum motorista encontrado para o período selecionado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Veiculos Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Truck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Quilometragem por Veículo
            </h3>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Veículo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Motoristas</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Leituras</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">KM Total</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredVeiculosStats.map((veiculo) => (
                <React.Fragment key={veiculo.veiculo_id}>
                  <tr 
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                    onClick={() => setExpandedVeiculo(
                      expandedVeiculo === veiculo.veiculo_id ? null : veiculo.veiculo_id
                    )}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-medium">
                          {veiculo.placa.charAt(0)}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {veiculo.placa}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {veiculo.marca} {veiculo.tipo}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {Object.keys(veiculo.motoristas).length} motorista(s)
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {veiculo.leituras}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end">
                        <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          {formatNumber(veiculo.totalKm)} km
                        </div>
                        {expandedVeiculo === veiculo.veiculo_id ? (
                          <ChevronUp className="ml-2 h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="ml-2 h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </td>
                  </tr>
                  
                  {/* Expanded view with motoristas */}
                  {expandedVeiculo === veiculo.veiculo_id && (
                    <tr className="bg-gray-50 dark:bg-gray-700/30">
                      <td colSpan={4} className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                          Motoristas que utilizaram este veículo:
                        </div>
                        <div className="space-y-3">
                          {Object.entries(veiculo.motoristas).map(([id, motorista]) => (
                            <div key={id} className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {motorista.nome}
                              </div>
                              <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                {formatNumber(motorista.totalKm)} km
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              
              {filteredVeiculosStats.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    Nenhum veículo encontrado para o período selecionado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HodometrosDashboard;