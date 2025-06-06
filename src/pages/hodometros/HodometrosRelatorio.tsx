import React, { useState, useEffect, useCallback } from 'react';
import { Search, Calendar, BarChart2, User, Truck, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import PeriodSelector from '../../components/hodometros/PeriodSelector';
import { useDateRange } from '../../hooks/useDateRange';
import { formatCPF } from '../../utils/format';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';

interface MileageReport {
  motorista_id: number;
  nome: string;
  cpf: string;
  foto_perfil?: string | null;
  veiculos: {
    placa: string;
    km_inicial: number;
    km_final: number;
    km_total: number;
    data_inicial: string;
    data_final: string;
    total_leituras: number;
    bateria?: number | null;
    is_electric?: boolean;
    cliente?: string | null;
  }[];
  km_total_geral: number;
  isExpanded?: boolean;
  monthlyData?: {
    month: string;
    km: number;
  }[];
}

const HodometrosRelatorio = () => {
  const { query } = useCompanyData();
  const { companyId } = useAuth();
  const [reports, setReports] = useState<MileageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [clients, setClients] = useState<string[]>([]);
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('all');
  const [selectedReport, setSelectedReport] = useState<MileageReport | null>(null);

  const fetchMileageReports = useCallback(async () => {
    try {
      setLoading(true);

      if (!dateRange.startDate || !dateRange.endDate) {
        toast.error('Selecione um período para gerar o relatório');
        return;
      }

      // Get all readings in the period
      const { data: hodometros, error: hodometrosError } = await supabase.from('hodometro')
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
        .order('data', { ascending: true })
        .order('hora', { ascending: true });

      if (hodometrosError) throw hodometrosError;

      if (!hodometros || hodometros.length === 0) {
        setReports([]);
        return;
      }

      // Extract unique clients
      const uniqueClients = new Set<string>();
      hodometros.forEach(h => {
        if (h.cliente?.nome) {
          uniqueClients.add(h.cliente.nome);
        }
      });
      setClients(Array.from(uniqueClients).sort());

      // Group readings by driver
      const reportMap = new Map<number, MileageReport>();

      // Group readings by motorista and veiculo
      const groupedReadings = hodometros.reduce((acc, hodometro) => {
        if (!hodometro.motorista || !hodometro.veiculo) return acc;

        const key = `${hodometro.motorista_id}_${hodometro.veiculo_id}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(hodometro);
        return acc;
      }, {} as Record<string, typeof hodometros>);

      // Process each group
      for (const readings of Object.values(groupedReadings)) {
        if (!readings || readings.length === 0) continue;
        
        // Sort readings by date and time
        const sortedReadings = [...readings].sort((a, b) => {
          const dateA = new Date(`${a.data}T${a.hora}`);
          const dateB = new Date(`${b.data}T${b.hora}`);
          return dateA.getTime() - dateB.getTime();
        });
        
        const firstReading = sortedReadings[0]; // First reading (earliest date/time)
        const lastReading = sortedReadings[sortedReadings.length - 1]; // Last reading (latest date/time)
        
        // Check if it's an electric vehicle (has battery readings)
        const isElectric = firstReading.bateria !== null && firstReading.bateria !== undefined;
        
        // Calculate total KM
        let totalKm = 0;
        if (isElectric) {
          // For electric vehicles, use the sum of km_rodado values
          totalKm = sortedReadings.reduce((sum, reading) => {
            // Ensure km_rodado is a valid number
            const kmValue = typeof reading.km_rodado === 'number' && !isNaN(reading.km_rodado) 
              ? reading.km_rodado 
              : 0;
            return sum + kmValue;
          }, 0);
        } else {
          // For regular vehicles, use the difference between first and last readings
          // Ensure hod_lido values are valid numbers
          const firstHodLido = typeof firstReading.hod_lido === 'number' && !isNaN(firstReading.hod_lido) 
            ? firstReading.hod_lido 
            : 0;
            
          const lastHodLido = typeof lastReading.hod_lido === 'number' && !isNaN(lastReading.hod_lido) 
            ? lastReading.hod_lido 
            : 0;
            
          totalKm = Math.max(0, lastHodLido - firstHodLido);
        }

        if (!firstReading.motorista || !firstReading.veiculo) continue;

        const motorista = reportMap.get(firstReading.motorista_id);

        // Generate monthly data for the chart
        const monthlyData = generateMonthlyData(sortedReadings, isElectric);

        if (motorista) {
          // Find vehicle in driver's vehicles array
          const veiculo = motorista.veiculos.find(v => v.placa === firstReading.veiculo.placa);

          if (veiculo) {
            // Update existing vehicle stats
            veiculo.km_total += totalKm;
            veiculo.total_leituras += readings.length;

            // Update with first and last readings
            if (isElectric) {
              veiculo.is_electric = true;
              veiculo.bateria = lastReading.bateria;
            } else {
              // Ensure hod_lido values are valid numbers
              veiculo.km_inicial = typeof firstReading.hod_lido === 'number' && !isNaN(firstReading.hod_lido) 
                ? firstReading.hod_lido 
                : 0;
                
              veiculo.km_final = typeof lastReading.hod_lido === 'number' && !isNaN(lastReading.hod_lido) 
                ? lastReading.hod_lido 
                : 0;
            }
            veiculo.data_inicial = firstReading.data;
            veiculo.data_final = lastReading.data;
            veiculo.cliente = lastReading.cliente?.nome || null;
          } else {
            // Add new vehicle to driver's vehicles array
            motorista.veiculos.push({
              placa: firstReading.veiculo.placa,
              km_inicial: isElectric ? 0 : (typeof firstReading.hod_lido === 'number' && !isNaN(firstReading.hod_lido) ? firstReading.hod_lido : 0),
              km_final: isElectric ? 0 : (typeof lastReading.hod_lido === 'number' && !isNaN(lastReading.hod_lido) ? lastReading.hod_lido : 0),
              km_total: totalKm,
              data_inicial: firstReading.data,
              data_final: lastReading.data,
              total_leituras: readings.length,
              bateria: isElectric ? lastReading.bateria : null,
              is_electric: isElectric,
              cliente: lastReading.cliente?.nome || null
            });
          }

          // Update total KM for driver
          motorista.km_total_geral += totalKm;
          
          // Update monthly data
          motorista.monthlyData = combineMonthlyData(motorista.monthlyData || [], monthlyData);
        } else {
          // Create new driver entry
          reportMap.set(firstReading.motorista_id, {
            motorista_id: firstReading.motorista_id,
            nome: firstReading.motorista.nome,
            cpf: firstReading.motorista.cpf,
            foto_perfil: `https://ui-avatars.com/api/?name=${encodeURIComponent(firstReading.motorista.nome)}&background=random&color=fff&size=128`,
            veiculos: [{
              placa: firstReading.veiculo.placa,
              km_inicial: isElectric ? 0 : (typeof firstReading.hod_lido === 'number' && !isNaN(firstReading.hod_lido) ? firstReading.hod_lido : 0),
              km_final: isElectric ? 0 : (typeof lastReading.hod_lido === 'number' && !isNaN(lastReading.hod_lido) ? lastReading.hod_lido : 0),
              km_total: totalKm,
              data_inicial: firstReading.data,
              data_final: lastReading.data,
              total_leituras: readings.length,
              bateria: isElectric ? lastReading.bateria : null,
              is_electric: isElectric,
              cliente: lastReading.cliente?.nome || null
            }],
            km_total_geral: totalKm,
            monthlyData: monthlyData
          });
        }
      }

      // Convert map to array and sort by driver name
      const reportArray = Array.from(reportMap.values())
        .sort((a, b) => a.nome.localeCompare(b.nome));

      setReports(reportArray);
    } catch (error) {
      console.error('Error fetching mileage reports:', error);
      toast.error('Erro ao carregar relatório de quilometragem');
    } finally {
      setLoading(false);
    }
  }, [dateRange, companyId]);

  // Generate monthly data for charts
  const generateMonthlyData = (readings: any[], isElectric: boolean) => {
    const monthlyData: { [key: string]: number } = {};
    
    readings.forEach((reading, index) => {
      if (index === 0) return; // Skip first reading
      
      const prevReading = readings[index - 1];
      const month = reading.data.substring(0, 7); // YYYY-MM format
      
      let kmValue = 0;
      if (isElectric) {
        // For electric vehicles, use km_rodado
        kmValue = typeof reading.km_rodado === 'number' && !isNaN(reading.km_rodado) ? reading.km_rodado : 0;
      } else {
        // For regular vehicles, calculate difference between readings
        const currentHod = typeof reading.hod_lido === 'number' && !isNaN(reading.hod_lido) ? reading.hod_lido : 0;
        const prevHod = typeof prevReading.hod_lido === 'number' && !isNaN(prevReading.hod_lido) ? prevReading.hod_lido : 0;
        kmValue = Math.max(0, currentHod - prevHod);
      }
      
      if (!monthlyData[month]) {
        monthlyData[month] = 0;
      }
      monthlyData[month] += kmValue;
    });
    
    // Convert to array format
    return Object.entries(monthlyData).map(([month, km]) => {
      // Format month for display (YYYY-MM to MMM/YYYY)
      const [year, monthNum] = month.split('-');
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const formattedMonth = `${monthNames[parseInt(monthNum) - 1]}/${year.substring(2)}`;
      
      return { month: formattedMonth, km };
    }).sort((a, b) => {
      // Extract year and month for proper sorting
      const [aMonth, aYear] = a.month.split('/');
      const [bMonth, bYear] = b.month.split('/');
      
      const aMonthIndex = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].indexOf(aMonth);
      const bMonthIndex = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].indexOf(bMonth);
      
      if (aYear !== bYear) return parseInt(aYear) - parseInt(bYear);
      return aMonthIndex - bMonthIndex;
    });
  };

  // Combine monthly data from multiple sources
  const combineMonthlyData = (existing: { month: string; km: number }[], newData: { month: string; km: number }[]) => {
    const combined: { [key: string]: number } = {};
    
    // Add existing data
    existing.forEach(item => {
      combined[item.month] = item.km;
    });
    
    // Add new data
    newData.forEach(item => {
      if (!combined[item.month]) {
        combined[item.month] = 0;
      }
      combined[item.month] += item.km;
    });
    
    // Convert back to array format
    return Object.entries(combined).map(([month, km]) => ({ month, km }))
      .sort((a, b) => {
        // Extract year and month for proper sorting
        const [aMonth, aYear] = a.month.split('/');
        const [bMonth, bYear] = b.month.split('/');
        
        const aMonthIndex = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].indexOf(aMonth);
        const bMonthIndex = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].indexOf(bMonth);
        
        if (aYear !== bYear) return parseInt(aYear) - parseInt(bYear);
        return aMonthIndex - bMonthIndex;
      });
  };

  useEffect(() => {
    fetchMileageReports();
  }, [fetchMileageReports]);

  const toggleExpand = (motorista_id: number) => {
    setReports(prev => 
      prev.map(report => 
        report.motorista_id === motorista_id 
          ? { ...report, isExpanded: !report.isExpanded } 
          : report
      )
    );
  };

  const handleReportClick = (report: MileageReport) => {
    setSelectedReport(report);
  };

  const filteredReports = reports.filter(report => {
    const searchString = searchTerm.toLowerCase();
    const clientMatch = !selectedClient || report.veiculos.some(v => v.cliente === selectedClient);
    
    return (
      clientMatch &&
      (report.nome.toLowerCase().includes(searchString) ||
       report.cpf.includes(searchString) ||
       report.veiculos.some(v => v.placa.toLowerCase().includes(searchString)))
    );
  });

  // Find the maximum KM value for chart scaling
  const maxKmValue = selectedReport?.monthlyData 
    ? Math.max(...selectedReport.monthlyData.map(d => d.km), 1) 
    : 1;

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por motorista, CPF ou placa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 
                       dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 
                       focus:border-blue-500 text-gray-900 dark:text-gray-100"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>

          {/* Client Filter */}
          <div className="relative">
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full pl-4 pr-10 py-2 bg-white dark:bg-gray-800 border border-gray-200 
                       dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 
                       focus:border-blue-500 text-gray-900 dark:text-gray-100 appearance-none"
            >
              <option value="">Todos os clientes</option>
              {clients.map((client, index) => (
                <option key={index} value={client}>{client}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <ChevronDown className="h-5 w-5 text-gray-400" />
            </div>
          </div>

          {/* Period Selector */}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-500" />
            Relatório de Quilometragem
          </h2>
          
          {filteredReports.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center border border-gray-200 dark:border-gray-700">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                Nenhum registro encontrado para o período selecionado
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReports.map((report) => (
                <div 
                  key={report.motorista_id}
                  className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm transition-all duration-200 ${
                    selectedReport?.motorista_id === report.motorista_id ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  {/* Driver Info Header */}
                  <div 
                    className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    onClick={() => handleReportClick(report)}
                  >
                    <div className="flex items-center gap-4">
                      <img 
                        src={report.foto_perfil || `https://ui-avatars.com/api/?name=${encodeURIComponent(report.nome)}&background=random&color=fff&size=128`} 
                        alt={report.nome}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                              {report.nome}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {formatCPF(report.cpf)}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                              {report.km_total_geral.toLocaleString('pt-BR')} km
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {report.veiculos.length} veículo{report.veiculos.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Vehicle Summary */}
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {report.veiculos.map((veiculo, idx) => (
                        <div 
                          key={`${report.motorista_id}-${veiculo.placa}-${idx}`}
                          className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg flex items-center gap-3"
                        >
                          <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                            <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between">
                              <div className="font-medium text-gray-900 dark:text-white">
                                {veiculo.placa.toUpperCase()}
                              </div>
                              <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                                {veiculo.km_total.toLocaleString('pt-BR')} km
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 flex justify-between">
                              <span>{veiculo.cliente || 'Sem cliente'}</span>
                              <span>{formatDate(veiculo.data_final)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Monthly Chart */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 h-full">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <BarChart2 className="w-5 h-5 text-blue-500" />
              Quilometragem Mensal
            </h2>
            
            {selectedReport ? (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <img 
                    src={selectedReport.foto_perfil || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedReport.nome)}&background=random&color=fff&size=128`} 
                    alt={selectedReport.nome}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {selectedReport.nome}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Total: {selectedReport.km_total_geral.toLocaleString('pt-BR')} km
                    </p>
                  </div>
                </div>
                
                {selectedReport.monthlyData && selectedReport.monthlyData.length > 0 ? (
                  <div className="space-y-4">
                    {selectedReport.monthlyData.map((data, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {data.month}
                          </span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {data.km.toLocaleString('pt-BR')} km
                          </span>
                        </div>
                        <div className="h-2 bg-blue-100 dark:bg-blue-900/20 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300"
                            style={{ width: `${(data.km / maxKmValue) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-2" />
                    <p className="text-gray-500 dark:text-gray-400">
                      Não há dados mensais disponíveis para este motorista no período selecionado
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <User className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-gray-500 dark:text-gray-400">
                  Selecione um motorista para visualizar o gráfico de quilometragem mensal
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to format dates
const formatDate = (date: string) => {
  if (!date) return '';
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
};

export default HodometrosRelatorio;