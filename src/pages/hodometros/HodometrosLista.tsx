import React, { useState, useEffect, useCallback } from 'react';
import { Search, BarChart2, Download, X, Calendar, User, Truck } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import PeriodSelector from '../../components/hodometros/PeriodSelector';
import { useDateRange } from '../../hooks/useDateRange';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import * as XLSX from 'xlsx';
import MileageChartModal from '../../components/hodometros/MileageChartModal';

interface DailyData {
  date: string;
  km: number;
  formattedDate: string;
}

interface VehicleData {
  veiculo_id: number;
  placa: string;
  marca: string;
  tipo: string;
  totalKm: number;
  avgKmPerDay: number;
  daysWithReadings: number;
  dailyData: DailyData[];
  motoristas: {
    motorista_id: number;
    nome: string;
    km: number;
  }[];
}

const HodometrosLista = () => {
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('30days');
  const [vehicleData, setVehicleData] = useState<VehicleData[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleData | null>(null);
  const [showChartModal, setShowChartModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVehicleData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!dateRange.startDate || !dateRange.endDate || !companyId) {
        toast.error('Selecione um período para gerar o relatório');
        return;
      }

      // Log query parameters for debugging
      console.log('Fetching hodometro data with params:', {
        companyId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });

      // Get all readings in the period
      const { data, error } = await supabase.from('hodometro')
        .select(`
          id_hodometro,
          data,
          hora,
          km_rodado,
          motorista_id,
          veiculo_id,
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
          )
        `)
        .eq('company_id', companyId)
        .gte('data', dateRange.startDate)
        .lte('data', dateRange.endDate)
        .order('data', { ascending: true }); // Order by date ascending for time series

      // Log raw response for debugging
      console.log('Supabase response:', { data: data?.length || 0, error });
      
      if (error) {
        console.error('Supabase query error details:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.log('No data returned from Supabase query');
        setVehicleData([]);
        setLoading(false);
        return;
      }

      console.log('First 5 records from response:', data.slice(0, 5));

      // Process data to get mileage by vehicle and date
      const vehicleMap = new Map<number, {
        placa: string;
        marca: string;
        tipo: string;
        totalKm: number;
        dailyData: Map<string, number>;
        daysWithReadings: Set<string>;
        motoristas: Map<number, { nome: string; km: number }>;
      }>();

      console.log('Processing hodometro records...');
      
      (data || []).forEach((hodometro, index) => {
        // Log every 50th record for debugging
        if (index % 50 === 0) {
          console.log(`Processing record ${index}:`, {
            id: hodometro.id_hodometro,
            data: hodometro.data,
            veiculo_id: hodometro.veiculo_id,
            veiculo: hodometro.veiculo,
            motorista_id: hodometro.motorista_id,
            motorista: hodometro.motorista,
            km_rodado: hodometro.km_rodado
          });
        }

        // Skip records without veiculo_id
        if (!hodometro.veiculo_id) {
          console.log(`Skipping record ${hodometro.id_hodometro} - missing veiculo_id`);
          return;
        }

        // Skip records without veiculo relation data
        if (!hodometro.veiculo) {
          console.log(`Record ${hodometro.id_hodometro} has veiculo_id ${hodometro.veiculo_id} but no veiculo relation data`);
          // Continue processing using veiculo_id instead of skipping
          return;
        }

        const vehicleId = hodometro.veiculo_id;
        const vehiclePlate = hodometro.veiculo.placa.toUpperCase();
        const vehicleMake = hodometro.veiculo.marca || '';
        const vehicleModel = hodometro.veiculo.tipo || '';
        const date = hodometro.data;
        const km = hodometro.km_rodado || 0; // Use 0 if km_rodado is null or undefined

        // Get motorista info
        const motorista_id = hodometro.motorista_id;
        const motorista_nome = hodometro.motorista?.nome || `Motorista ID ${motorista_id}`;

        // Get or create vehicle data
        const vehicleData = vehicleMap.get(vehicleId) || {
          placa: vehiclePlate,
          marca: vehicleMake,
          tipo: vehicleModel,
          totalKm: 0,
          dailyData: new Map<string, number>(),
          daysWithReadings: new Set<string>(),
          motoristas: new Map<number, { nome: string; km: number }>()
        };

        // Add km to total
        vehicleData.totalKm += km;

        // Add km to daily data
        const dailyKm = vehicleData.dailyData.get(date) || 0;
        vehicleData.dailyData.set(date, dailyKm + km);

        // Add date to days with readings
        vehicleData.daysWithReadings.add(date);

        // Add km to motorista
        if (motorista_id) {
          const motoristaData = vehicleData.motoristas.get(motorista_id) || { nome: motorista_nome, km: 0 };
          motoristaData.km += km;
          vehicleData.motoristas.set(motorista_id, motoristaData);
        }

        // Update vehicle data
        vehicleMap.set(vehicleId, vehicleData);
      });

      console.log('Vehicle map after processing:', {
        vehicleCount: vehicleMap.size,
        vehicleIds: Array.from(vehicleMap.keys())
      });

      // Convert to array and sort by total km (descending)
      const vehiclesArray: VehicleData[] = Array.from(vehicleMap.entries()).map(([veiculo_id, data]) => {
        const daysWithReadings = data.daysWithReadings.size;
        const avgKmPerDay = daysWithReadings > 0 ? data.totalKm / daysWithReadings : 0;
        
        return {
          veiculo_id,
          placa: data.placa,
          marca: data.marca,
          tipo: data.tipo,
          totalKm: data.totalKm,
          avgKmPerDay,
          daysWithReadings,
          dailyData: Array.from(data.dailyData.entries()).map(([date, km]) => ({
            date,
            km,
            formattedDate: formatDateBR(date)
          })).sort((a, b) => a.date.localeCompare(b.date)), // Sort by date ascending
          motoristas: Array.from(data.motoristas.entries()).map(([motorista_id, motorista]) => ({
            motorista_id,
            nome: motorista.nome,
            km: motorista.km
          })).sort((a, b) => b.km - a.km) // Sort by km descending
        };
      }).sort((a, b) => b.totalKm - a.totalKm);

      console.log('Final processed vehicle data:', {
        count: vehiclesArray.length,
        totalKm: vehiclesArray.reduce((sum, vehicle) => sum + vehicle.totalKm, 0),
        firstVehicle: vehiclesArray.length > 0 ? {
          placa: vehiclesArray[0].placa,
          totalKm: vehiclesArray[0].totalKm,
          daysWithReadings: vehiclesArray[0].daysWithReadings,
          motoristasCount: vehiclesArray[0].motoristas.length
        } : null
      });

      setVehicleData(vehiclesArray);
    } catch (error) {
      console.error('Error fetching vehicle data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setError(errorMessage);
      toast.error('Erro ao carregar dados de quilometragem: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  }, [dateRange, companyId]);

  useEffect(() => {
    fetchVehicleData();
  }, [fetchVehicleData]);

  const handleViewChart = (vehicle: VehicleData) => {
    setSelectedVehicle(vehicle);
    setShowChartModal(true);
  };

  // Format date from YYYY-MM-DD to DD/MM/YYYY
  const formatDateBR = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Format number with dot as thousands separator
  const formatNumber = (num: number | null | undefined): string => {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString('pt-BR');
  };

  const exportToExcel = () => {
    try {
      // Prepare main vehicle data
      const exportData = vehicleData.map(vehicle => ({
        'Placa': vehicle.placa,
        'Veículo': `${vehicle.marca} ${vehicle.tipo}`.trim(),
        'Total KM': vehicle.totalKm.toLocaleString('pt-BR'),
        'Média Diária': vehicle.avgKmPerDay.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
        'Dias com Leitura': vehicle.daysWithReadings,
        'Motoristas': vehicle.motoristas.map(m => m.nome).join(', ')
      }));

      // Create a workbook with multiple sheets
      const wb = XLSX.utils.book_new();
      
      // Add main vehicle summary sheet
      const mainWs = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, mainWs, 'Resumo por Veículo');
      
      // Auto-size columns for main sheet
      const mainColWidths = [
        { wch: 12 }, // Placa
        { wch: 25 }, // Veículo
        { wch: 15 }, // Total KM
        { wch: 15 }, // Média Diária
        { wch: 15 }, // Dias com Leitura
        { wch: 40 }  // Motoristas
      ];
      mainWs['!cols'] = mainColWidths;
      
      // Add detailed sheets for each vehicle
      vehicleData.forEach(vehicle => {
        // Create daily data sheet
        const dailyData = vehicle.dailyData.map(day => ({
          'Data': day.formattedDate,
          'KM': day.km.toLocaleString('pt-BR')
        }));
        
        if (dailyData.length > 0) {
          const dailyWs = XLSX.utils.json_to_sheet(dailyData);
          XLSX.utils.book_append_sheet(wb, dailyWs, `${vehicle.placa} - Diário`.substring(0, 31));
          
          // Auto-size columns
          dailyWs['!cols'] = [
            { wch: 12 }, // Data
            { wch: 15 }  // KM
          ];
        }
        
        // Create motorista data sheet
        const motoristaData = vehicle.motoristas.map(motorista => ({
          'Motorista': motorista.nome,
          'KM': motorista.km.toLocaleString('pt-BR')
        }));
        
        if (motoristaData.length > 0) {
          const motoristaWs = XLSX.utils.json_to_sheet(motoristaData);
          XLSX.utils.book_append_sheet(wb, motoristaWs, `${vehicle.placa} - Motoristas`.substring(0, 31));
          
          // Auto-size columns
          motoristaWs['!cols'] = [
            { wch: 30 }, // Motorista
            { wch: 15 }  // KM
          ];
        }
      });
      
      XLSX.writeFile(wb, `relatorio_quilometragem_veiculos_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Relatório exportado com sucesso');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Erro ao exportar para Excel');
    }
  };

  const filteredVehicleData = vehicleData.filter(vehicle => {
    const searchString = searchTerm.toLowerCase();
    return (
      !searchTerm ||
      vehicle.placa.toLowerCase().includes(searchString) ||
      vehicle.marca.toLowerCase().includes(searchString) ||
      vehicle.tipo.toLowerCase().includes(searchString) ||
      vehicle.motoristas.some(m => m.nome.toLowerCase().includes(searchString))
    );
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-[#1B2537] p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 text-red-500 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h3 className="text-lg font-medium">Erro ao carregar dados</h3>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
        <button 
          onClick={fetchVehicleData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <div className="bg-white dark:bg-[#1B2537] p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row items-center gap-4">
          {/* Search */}
          <div className="relative flex-grow w-full md:w-auto">
            <input
              type="text"
              placeholder="Buscar por placa, marca, modelo ou motorista..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#1B2537] border border-gray-200 
                       dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 
                       focus:border-blue-500 text-gray-900 dark:text-gray-100"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>

          {/* Period Selector */}
          <div className="w-full md:w-48">
            <PeriodSelector
              periodType={periodType}
              dateRange={dateRange}
              onPeriodChange={updatePeriod}
              onDateRangeChange={setDateRange}
            />
          </div>

          {/* Export Button */}
          <div className="relative group">
            <button
              onClick={exportToExcel}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                       transition-colors flex items-center justify-center"
              disabled={filteredVehicleData.length === 0}
              aria-label="Exportar Excel"
            >
              <Download className="w-5 h-5" />
            </button>
            <div className="opacity-0 group-hover:opacity-100 absolute right-0 top-full mt-1 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap">
              Exportar Excel
            </div>
          </div>
        </div>
      </div>

      {/* Vehicle Mileage Table */}
      <div className="bg-white dark:bg-[#1B2537] rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#1B2537]">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Veículo</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total KM</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Média Diária</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dias com Leitura</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Motoristas</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Gráfico</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-[#1B2537] divide-y divide-gray-200 dark:divide-gray-700">
              {filteredVehicleData.map((vehicle) => (
                <tr key={vehicle.veiculo_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-medium">
                        <Truck className="h-5 w-5" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {vehicle.placa}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {vehicle.marca} {vehicle.tipo}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      {formatNumber(vehicle.totalKm)} km
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {formatNumber(vehicle.avgKmPerDay)} km
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {vehicle.daysWithReadings}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-white max-w-xs overflow-hidden">
                      {vehicle.motoristas.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {vehicle.motoristas.slice(0, 3).map((motorista, index) => (
                            <span key={motorista.motorista_id} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                              {motorista.nome} ({formatNumber(motorista.km)} km)
                            </span>
                          ))}
                          {vehicle.motoristas.length > 3 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                              +{vehicle.motoristas.length - 3} motoristas
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">Nenhum motorista</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => handleViewChart(vehicle)}
                      className="inline-flex items-center justify-center p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                      title="Ver gráfico de quilometragem"
                      disabled={vehicle.dailyData.length === 0}
                    >
                      <BarChart2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredVehicleData.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Nenhum dado de quilometragem encontrado para o período selecionado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart Modal */}
      {selectedVehicle && (
        <MileageChartModal
          isOpen={showChartModal}
          onClose={() => setShowChartModal(false)}
          data={selectedVehicle.dailyData}
          driverName={`Veículo: ${selectedVehicle.placa} - ${selectedVehicle.marca} ${selectedVehicle.tipo}`}
        />
      )}
    </div>
  );
};

export default HodometrosLista;