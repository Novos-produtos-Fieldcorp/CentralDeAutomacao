import React, { useState, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
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
  }[];
  km_total_geral: number;
}

const HodometrosRelatorio = () => {
  const { query } = useCompanyData();
  const { companyId } = useAuth();
  const [reports, setReports] = useState<MileageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('all');

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
              is_electric: isElectric
            });
          }

          // Update total KM for driver
          motorista.km_total_geral += totalKm;
        } else {
          // Create new driver entry
          reportMap.set(firstReading.motorista_id, {
            motorista_id: firstReading.motorista_id,
            nome: firstReading.motorista.nome,
            cpf: firstReading.motorista.cpf,
            veiculos: [{
              placa: firstReading.veiculo.placa,
              km_inicial: isElectric ? 0 : (typeof firstReading.hod_lido === 'number' && !isNaN(firstReading.hod_lido) ? firstReading.hod_lido : 0),
              km_final: isElectric ? 0 : (typeof lastReading.hod_lido === 'number' && !isNaN(lastReading.hod_lido) ? lastReading.hod_lido : 0),
              km_total: totalKm,
              data_inicial: firstReading.data,
              data_final: lastReading.data,
              total_leituras: readings.length,
              bateria: isElectric ? lastReading.bateria : null,
              is_electric: isElectric
            }],
            km_total_geral: totalKm
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
  }, [dateRange]);

  useEffect(() => {
    fetchMileageReports();
  }, [fetchMileageReports]);

  const filteredReports = reports.filter(report => {
    const searchString = searchTerm.toLowerCase();
    return (
      report.nome.toLowerCase().includes(searchString) ||
      report.cpf.includes(searchString) ||
      report.veiculos.some(v => v.placa.toLowerCase().includes(searchString))
    );
  });

  // Find the maximum KM total across all vehicles
  const maxKmTotal = Math.max(...reports.flatMap(report => 
    report.veiculos.map(veiculo => veiculo.km_total)
  ), 0); // Add 0 as fallback to prevent -Infinity if array is empty

  if (loading) {
    return (
      <LoadingSpinner />
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          {/* Export Button */}
        </div>

        {/* Period Selector */}
        <div className="mt-4">
          <PeriodSelector
            periodType={periodType}
            dateRange={dateRange}
            onPeriodChange={updatePeriod}
            onDateRangeChange={setDateRange}
          />
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Motorista</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Placa</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Leitura Inicial</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Leitura Final</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total KM</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredReports.map((report) => (
                <React.Fragment key={report.motorista_id}>
                  {report.veiculos.map((veiculo, index) => (
                    <tr key={`${report.motorista_id}-${veiculo.placa}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      {index === 0 ? (
                        <td className="px-6 py-4 whitespace-nowrap" rowSpan={report.veiculos.length}>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {report.nome}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {formatCPF(report.cpf)}
                          </div>
                          <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mt-1">
                            Total: {report.km_total_geral.toLocaleString('pt-BR')} km
                          </div>
                        </td>
                      ) : null}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white uppercase">
                          {veiculo.placa}
                        </div>
                        {veiculo.is_electric && (
                          <div className="text-xs px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200 rounded-full inline-block mt-1">
                            Elétrico
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {veiculo.is_electric ? (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            Ciclomotor elétrico
                          </div>
                        ) : (
                          <>
                            <div className="text-sm text-gray-900 dark:text-white">
                              {veiculo.km_inicial.toLocaleString('pt-BR')} km
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(veiculo.data_inicial).toLocaleDateString('pt-BR')}
                            </div>
                          </>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {veiculo.is_electric ? (
                          <div className="text-sm text-gray-900 dark:text-white">
                            Bateria: {veiculo.bateria}
                          </div>
                        ) : (
                          <>
                            <div className="text-sm text-gray-900 dark:text-white">
                              {veiculo.km_final.toLocaleString('pt-BR')} km
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(veiculo.data_final).toLocaleDateString('pt-BR')}
                            </div>
                          </>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {veiculo.km_total.toLocaleString('pt-BR')} km
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {filteredReports.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              Nenhum registro encontrado para o período selecionado
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HodometrosRelatorio;