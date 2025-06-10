import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Truck, Users, Filter, Search, BarChart2, TrendingUp, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
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
  Cell,
  PieChart,
  Pie,
  LabelList
} from 'recharts';

interface HodometroData {
  id_hodometro: number;
  data: string;
  hora: string;
  hod_informado: number | null;
  hod_lido: number | null;
  km_rodado: number | null;
  bateria: number | null;
  trip_lida: number | null;
  trip_informada: string | null;
  comparacao_leitura: boolean | null;
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

interface DailyKmData {
  data: string;
  total_km_dia: number;
  motoristas: {
    [motorista_id: number]: {
      nome: string;
      km_rodado: number;
      veiculos: {
        [veiculo_id: number]: {
          placa: string;
          tipo_veiculo: 'automovel' | 'ciclomotor';
          km_rodado: number;
        }
      }
    }
  }
}

interface InconsistentReading {
  id_hodometro: number;
  hod_lido: number | null;
  hod_informado: number | null;
  nome: string;
  data: string;
  placa: string;
  diferenca: number;
}

interface DriverReadingCount {
  motorista_id: number;
  nome: string;
  leituras: number;
}

const HodometrosDashboard = () => {
  const { companyId } = useCompanyData();
  const [hodometros, setHodometros] = useState<HodometroData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicleType, setSelectedVehicleType] = useState<'todos' | 'automovel' | 'ciclomotor'>('todos');
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('30days');
  const [todayReadingsCount, setTodayReadingsCount] = useState(0);

  useEffect(() => {
    fetchHodometros();
  }, [dateRange, selectedVehicleType]);

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
      
      // Count today's readings
      const today = new Date().toISOString().split('T')[0];
      const todayReadings = data?.filter(h => h.data === today) || [];
      setTodayReadingsCount(todayReadings.length);
      
    } catch (error) {
      console.error('Error fetching hodometros:', error);
      toast.error('Erro ao carregar hodômetros');
    } finally {
      setLoading(false);
    }
  };

  // Calculate daily KM data based on the provided logic
  const dailyKmData = useMemo(() => {
    const result: Record<string, DailyKmData> = {};
    
    // Group by date
    hodometros.forEach(hodometro => {
      if (!hodometro.data || !hodometro.motorista || !hodometro.veiculo) return;
      
      const date = hodometro.data;
      const motoristaId = hodometro.motorista.motorista_id;
      const veiculoId = hodometro.veiculo.veiculo_id;
      
      // Initialize date entry if it doesn't exist
      if (!result[date]) {
        result[date] = {
          data: date,
          total_km_dia: 0,
          motoristas: {}
        };
      }
      
      // Initialize motorista entry if it doesn't exist
      if (!result[date].motoristas[motoristaId]) {
        result[date].motoristas[motoristaId] = {
          nome: hodometro.motorista.nome,
          km_rodado: 0,
          veiculos: {}
        };
      }
      
      // Determine vehicle type (ciclomotor if it has battery reading)
      const tipo_veiculo = hodometro.bateria !== null ? 'ciclomotor' : 'automovel';
      
      // Initialize vehicle entry if it doesn't exist
      if (!result[date].motoristas[motoristaId].veiculos[veiculoId]) {
        result[date].motoristas[motoristaId].veiculos[veiculoId] = {
          placa: hodometro.veiculo.placa,
          tipo_veiculo,
          km_rodado: 0
        };
      }
      
      // Add km_rodado to the appropriate vehicle
      if (hodometro.km_rodado && hodometro.km_rodado > 0) {
        result[date].motoristas[motoristaId].veiculos[veiculoId].km_rodado += hodometro.km_rodado;
      }
    });
    
    // Calculate totals
    Object.values(result).forEach(dayData => {
      let dayTotal = 0;
      
      Object.values(dayData.motoristas).forEach(motorista => {
        let motoristaTotal = 0;
        
        Object.values(motorista.veiculos).forEach(veiculo => {
          // Apply vehicle type filter if selected
          if (selectedVehicleType === 'todos' || veiculo.tipo_veiculo === selectedVehicleType) {
            motoristaTotal += veiculo.km_rodado;
          }
        });
        
        motorista.km_rodado = motoristaTotal;
        dayTotal += motoristaTotal;
      });
      
      dayData.total_km_dia = dayTotal;
    });
    
    // Convert to array and sort by date (newest first)
    return Object.values(result)
      .filter(day => day.total_km_dia > 0) // Only include days with KM
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [hodometros, selectedVehicleType]);

  // Calculate total KM
  const totalKm = useMemo(() => {
    return dailyKmData.reduce((sum, day) => sum + day.total_km_dia, 0);
  }, [dailyKmData]);

  // Calculate KM by operation (client)
  const kmByOperation = useMemo(() => {
    const operations: Record<string, number> = {};
    
    hodometros.forEach(hodometro => {
      if (!hodometro.km_rodado || hodometro.km_rodado <= 0) return;
      
      // Apply vehicle type filter
      const isElectric = hodometro.bateria !== null;
      const vehicleType = isElectric ? 'ciclomotor' : 'automovel';
      if (selectedVehicleType !== 'todos' && vehicleType !== selectedVehicleType) return;
      
      const clientName = hodometro.cliente?.nome || 'Sem cliente';
      
      if (!operations[clientName]) {
        operations[clientName] = 0;
      }
      
      operations[clientName] += hodometro.km_rodado;
    });
    
    // Convert to array and sort by KM (descending)
    return Object.entries(operations)
      .map(([name, km]) => ({ name, km }))
      .sort((a, b) => b.km - a.km);
  }, [hodometros, selectedVehicleType]);

  // Calculate readings by driver
  const readingsByDriver = useMemo(() => {
    const drivers: Record<number, DriverReadingCount> = {};
    
    hodometros.forEach(hodometro => {
      if (!hodometro.motorista) return;
      
      // Apply vehicle type filter
      const isElectric = hodometro.bateria !== null;
      const vehicleType = isElectric ? 'ciclomotor' : 'automovel';
      if (selectedVehicleType !== 'todos' && vehicleType !== selectedVehicleType) return;
      
      const motoristaId = hodometro.motorista.motorista_id;
      
      if (!drivers[motoristaId]) {
        drivers[motoristaId] = {
          motorista_id: motoristaId,
          nome: hodometro.motorista.nome,
          leituras: 0
        };
      }
      
      drivers[motoristaId].leituras++;
    });
    
    // Convert to array and sort by reading count (descending)
    return Object.values(drivers)
      .sort((a, b) => b.leituras - a.leituras)
      .slice(0, 10); // Top 10 drivers
  }, [hodometros, selectedVehicleType]);

  // Calculate KM by driver
  const kmByDriver = useMemo(() => {
    const drivers: Record<number, { motorista_id: number, nome: string, km: number }> = {};
    
    dailyKmData.forEach(day => {
      Object.entries(day.motoristas).forEach(([motoristaId, motorista]) => {
        const id = parseInt(motoristaId);
        
        if (!drivers[id]) {
          drivers[id] = {
            motorista_id: id,
            nome: motorista.nome,
            km: 0
          };
        }
        
        drivers[id].km += motorista.km_rodado;
      });
    });
    
    // Convert to array and sort by KM (descending)
    return Object.values(drivers)
      .sort((a, b) => b.km - a.km)
      .slice(0, 10); // Top 10 drivers
  }, [dailyKmData]);

  // Find inconsistent readings (where hod_lido and hod_informado differ significantly)
  const inconsistentReadings = useMemo(() => {
    const readings: InconsistentReading[] = [];
    
    hodometros.forEach(hodometro => {
      if (hodometro.bateria !== null) return; // Skip electric vehicles
      if (hodometro.hod_lido === null || hodometro.hod_informado === null) return;
      if (!hodometro.motorista || !hodometro.veiculo) return;
      
      // Calculate difference and percentage
      const diferenca = Math.abs(hodometro.hod_lido - hodometro.hod_informado);
      const percentDiff = (diferenca / hodometro.hod_lido) * 100;
      
      // Consider inconsistent if difference is more than 1% or 100 km
      if (percentDiff > 1 || diferenca > 100) {
        readings.push({
          id_hodometro: hodometro.id_hodometro,
          hod_lido: hodometro.hod_lido,
          hod_informado: hodometro.hod_informado,
          nome: hodometro.motorista.nome,
          data: hodometro.data,
          placa: hodometro.veiculo.placa,
          diferenca
        });
      }
    });
    
    // Sort by difference (descending)
    return readings.sort((a, b) => b.diferenca - a.diferenca).slice(0, 5); // Top 5 inconsistencies
  }, [hodometros]);

  // Format number with dot as thousands separator
  const formatNumber = (num: number): string => {
    return num.toLocaleString('pt-BR');
  };

  // Format date to DD/MM/YYYY
  const formatDate = (dateStr: string): string => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <div className="bg-gray-800 p-4 rounded-xl shadow-md border border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <select
              value={selectedVehicleType}
              onChange={(e) => setSelectedVehicleType(e.target.value as 'todos' | 'automovel' | 'ciclomotor')}
              className="w-full pl-10 pr-4 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-800 text-white appearance-none"
            >
              <option value="todos">Todos os veículos</option>
              <option value="automovel">Automóveis</option>
              <option value="ciclomotor">Ciclomotores</option>
            </select>
            <Truck className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <ChevronDown className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por motorista ou placa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-800 text-white"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
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
        <div className="bg-gray-800 p-6 rounded-xl shadow-md border border-gray-700 text-center">
          <p className="text-gray-400 uppercase text-sm font-medium mb-2">QTD DE LEITURAS REALIZADAS</p>
          <h2 className="text-4xl font-bold text-white">
            {hodometros.length}
          </h2>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl shadow-md border border-gray-700 text-center">
          <p className="text-gray-400 uppercase text-sm font-medium mb-2">QTD DE LEITURAS REALIZADAS HOJE</p>
          <h2 className="text-4xl font-bold text-white">
            {todayReadingsCount}
          </h2>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl shadow-md border border-gray-700 text-center">
          <p className="text-gray-400 uppercase text-sm font-medium mb-2">KM TOTAL RODADO</p>
          <h2 className="text-4xl font-bold text-white">
            {formatNumber(totalKm)}
          </h2>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KM por Operação */}
        <div className="bg-gray-800 p-6 rounded-xl shadow-md border border-gray-700">
          <h3 className="text-lg font-medium text-white mb-4 uppercase">KM POR OPERAÇÃO</h3>
          <div className="h-64">
            {kmByOperation.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={kmByOperation}
                  margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} horizontal={false} />
                  <XAxis type="number" tickFormatter={(value) => formatNumber(value)} />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={150}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    formatter={(value: any) => [formatNumber(value) + ' km', 'Quilômetros']}
                    contentStyle={{ 
                      backgroundColor: 'rgba(31, 41, 55, 0.9)',
                      borderRadius: '0.5rem',
                      border: '1px solid #4B5563',
                      color: 'white'
                    }}
                  />
                  <Bar 
                    dataKey="km" 
                    fill="#3B82F6" 
                    radius={[0, 4, 4, 0]}
                  >
                    {kmByOperation.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={`rgba(59, 130, 246, ${0.5 + (index * 0.05)})`} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                Nenhum dado disponível para o período selecionado
              </div>
            )}
          </div>
        </div>

        {/* Número de Leituras por Motorista */}
        <div className="bg-gray-800 p-6 rounded-xl shadow-md border border-gray-700">
          <h3 className="text-lg font-medium text-white mb-4 uppercase">NÚMERO DE LEITURAS POR MOTORISTA</h3>
          <div className="h-64">
            {readingsByDriver.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={readingsByDriver}
                  margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                  <XAxis 
                    dataKey="nome" 
                    angle={-45} 
                    textAnchor="end" 
                    height={80} 
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: any) => [value, 'Leituras']}
                    contentStyle={{ 
                      backgroundColor: 'rgba(31, 41, 55, 0.9)',
                      borderRadius: '0.5rem',
                      border: '1px solid #4B5563',
                      color: 'white'
                    }}
                  />
                  <Bar 
                    dataKey="leituras" 
                    fill="#10B981" 
                    radius={[4, 4, 0, 0]}
                  >
                    {readingsByDriver.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={`rgba(16, 185, 129, ${0.5 + (index * 0.05)})`} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                Nenhum dado disponível para o período selecionado
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Leituras Inconsistentes e KM por Motorista */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leituras Inconsistentes */}
        <div className="bg-gray-800 p-6 rounded-xl shadow-md border border-gray-700">
          <h3 className="text-lg font-medium text-white mb-4 uppercase flex items-center gap-2">
            <AlertCircle className="text-amber-500" size={20} />
            LEITURAS INCONSISTENTES
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-white">
              <thead className="text-gray-400 border-b border-gray-700">
                <tr>
                  <th className="py-2">HOD LIDO</th>
                  <th className="py-2">HOD INFORMADO</th>
                  <th className="py-2">NOME</th>
                  <th className="py-2">DATA</th>
                  <th className="py-2">PLACA</th>
                </tr>
              </thead>
              <tbody>
                {inconsistentReadings.length > 0 ? (
                  inconsistentReadings.map((reading) => (
                    <tr key={reading.id_hodometro} className="border-b border-gray-700">
                      <td className="py-2">{formatNumber(reading.hod_lido || 0)}</td>
                      <td className="py-2">{formatNumber(reading.hod_informado || 0)}</td>
                      <td className="py-2">{reading.nome}</td>
                      <td className="py-2">{formatDate(reading.data)}</td>
                      <td className="py-2">{reading.placa.toUpperCase()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-gray-400">
                      Nenhuma leitura inconsistente encontrada
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* KM por Motorista */}
        <div className="bg-gray-800 p-6 rounded-xl shadow-md border border-gray-700">
          <h3 className="text-lg font-medium text-white mb-4 uppercase">KM POR MOTORISTA</h3>
          <div className="h-64">
            {kmByDriver.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={kmByDriver}
                  margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} horizontal={false} />
                  <XAxis type="number" tickFormatter={(value) => formatNumber(value)} />
                  <YAxis 
                    type="category" 
                    dataKey="nome" 
                    width={150}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    formatter={(value: any) => [formatNumber(value) + ' km', 'Quilômetros']}
                    contentStyle={{ 
                      backgroundColor: 'rgba(31, 41, 55, 0.9)',
                      borderRadius: '0.5rem',
                      border: '1px solid #4B5563',
                      color: 'white'
                    }}
                  />
                  <Bar 
                    dataKey="km" 
                    fill="#EC4899" 
                    radius={[0, 4, 4, 0]}
                  >
                    {kmByDriver.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={`rgba(236, 72, 153, ${0.5 + (index * 0.05)})`} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                Nenhum dado disponível para o período selecionado
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Daily KM Table */}
      <div className="bg-gray-800 p-6 rounded-xl shadow-md border border-gray-700">
        <h3 className="text-lg font-medium text-white mb-4 uppercase flex items-center gap-2">
          <Calendar className="text-blue-500" size={20} />
          QUILOMETRAGEM DIÁRIA
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-white">
            <thead className="text-gray-400 border-b border-gray-700">
              <tr>
                <th className="py-2">DATA</th>
                <th className="py-2">TOTAL KM</th>
                <th className="py-2">MOTORISTAS</th>
                <th className="py-2">DETALHES</th>
              </tr>
            </thead>
            <tbody>
              {dailyKmData.length > 0 ? (
                dailyKmData.map((day) => (
                  <tr key={day.data} className="border-b border-gray-700">
                    <td className="py-2">{formatDate(day.data)}</td>
                    <td className="py-2 font-medium text-blue-400">{formatNumber(day.total_km_dia)} km</td>
                    <td className="py-2">{Object.keys(day.motoristas).length}</td>
                    <td className="py-2">
                      <div className="text-xs text-gray-400">
                        {Object.values(day.motoristas)
                          .sort((a, b) => b.km_rodado - a.km_rodado)
                          .slice(0, 3)
                          .map((motorista, index) => (
                            <div key={index}>
                              {motorista.nome}: {formatNumber(motorista.km_rodado)} km
                            </div>
                          ))}
                        {Object.keys(day.motoristas).length > 3 && (
                          <div>+ {Object.keys(day.motoristas).length - 3} motoristas</div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-400">
                    Nenhum dado disponível para o período selecionado
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