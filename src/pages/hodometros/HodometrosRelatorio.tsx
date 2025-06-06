import React, { useState, useEffect, useCallback } from 'react';
import { Search, Calendar, BarChart2, User, Truck, X, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [showChartModal, setShowChartModal] = useState(false);

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

  const handleReportClick = (report: MileageReport) => {
    setSelectedReport(report);
    setShowChartModal(true);
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

      {/* Report Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Motorista</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Placa</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Leitura Inicial</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Leitura Final</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total KM</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                    <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                    <p>Nenhum registro encontrado para o período selecionado</p>
                  </td>
                </tr>
              ) : (
                filteredReports.map((report) => (
                  report.veiculos.map((veiculo, vIndex) => (
                    <tr 
                      key={`${report.motorista_id}-${veiculo.placa}-${vIndex}`}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                      onClick={() => handleReportClick(report)}
                    >
                      {vIndex === 0 ? (
                        <td className="px-6 py-4 whitespace-nowrap" rowSpan={report.veiculos.length}>
                          <div className="flex items-center">
                            <img 
                              src={report.foto_perfil || `https://ui-avatars.com/api/?name=${encodeURIComponent(report.nome)}&background=random&color=fff&size=128`} 
                              alt={report.nome}
                              className="w-10 h-10 rounded-full object-cover mr-3"
                            />
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {report.nome}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {formatCPF(report.cpf)}
                              </div>
                            </div>
                          </div>
                        </td>
                      ) : null}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-blue-600 dark:text-blue-400 uppercase">
                          {veiculo.placa}
                        </div>
                        {veiculo.is_electric && (
                          <div className="text-xs px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200 rounded-full inline-block mt-1">
                            Elétrico
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {veiculo.cliente || 'Sem cliente'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {veiculo.is_electric ? (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            Ciclomotor elétrico
                          </div>
                        ) : (
                          <div className="text-sm text-gray-900 dark:text-white">
                            {veiculo.km_inicial.toLocaleString('pt-BR')} km
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {veiculo.is_electric ? (
                          <div className="text-sm text-gray-900 dark:text-white">
                            Bateria: {veiculo.bateria}%
                          </div>
                        ) : (
                          <div className="text-sm text-gray-900 dark:text-white">
                            {veiculo.km_final.toLocaleString('pt-BR')} km
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {veiculo.km_total.toLocaleString('pt-BR')} km
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {formatDate(veiculo.data_final)}
                        </div>
                      </td>
                    </tr>
                  ))
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Chart Modal */}
      {showChartModal && selectedReport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-blue-500" />
                Quilometragem Mensal
              </h3>
              <button
                onClick={() => setShowChartModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <img 
                  src={selectedReport.foto_perfil || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedReport.nome)}&background=random&color=fff&size=128`} 
                  alt={selectedReport.nome}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {selectedReport.nome}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatCPF(selectedReport.cpf)}
                  </p>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {selectedReport.km_total_geral.toLocaleString('pt-BR')} km
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Total no período
                  </div>
                </div>
              </div>
              
              {selectedReport.monthlyData && selectedReport.monthlyData.length > 0 ? (
                <div className="space-y-6">
                  <h4 className="text-base font-medium text-gray-900 dark:text-white">
                    Distribuição Mensal
                  </h4>
                  
                  <div className="space-y-4">
                    {selectedReport.monthlyData.map((data, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {data.month}
                          </span>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {data.km.toLocaleString('pt-BR')} km
                          </span>
                        </div>
                        <div className="h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 dark:bg-blue-400 rounded-lg transition-all duration-300 flex items-center"
                            style={{ width: `${Math.max(5, (data.km / maxKmValue) * 100)}%` }}
                          >
                            <span className="text-xs font-medium text-white px-2 truncate">
                              {data.km.toLocaleString('pt-BR')} km
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-base font-medium text-gray-900 dark:text-white mb-3">
                      Detalhes dos Veículos
                    </h4>
                    
                    <div className="space-y-3">
                      {selectedReport.veiculos.map((veiculo, idx) => (
                        <div 
                          key={idx}
                          className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg"
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                                <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div>
                                <div className="font-medium text-gray-900 dark:text-white uppercase">
                                  {veiculo.placa}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {veiculo.cliente || 'Sem cliente'}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-gray-900 dark:text-white">
                                {veiculo.km_total.toLocaleString('pt-BR')} km
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {formatDate(veiculo.data_final)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Calendar className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 max-w-md">
                    Não há dados mensais disponíveis para este motorista no período selecionado.
                    Tente selecionar um período maior ou verificar se existem leituras registradas.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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