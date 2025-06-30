import React, { useState, useEffect, useCallback } from 'react';
import { Search, Eye, Camera, X, Download, FileText, AlertCircle, BarChart2 } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import PeriodSelector from '../../components/hodometros/PeriodSelector';
import { useDateRange } from '../../hooks/useDateRange';
import { formatCPF } from '../../utils/format';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import * as XLSX from 'xlsx';
import MileageChartModal from '../../components/hodometros/MileageChartModal';
import DriverMileageChart from '../../components/hodometros/DriverMileageChart';

interface HodometroReading {
  id_hodometro: number;
  data: string;
  hora: string;
  hod_informado: number | null;
  hod_lido: number | null;
  km_rodado: number | null;
  bateria: number | null;
  foto_hodometro: string | null;
  trip_lida: number | null;
  trip_informada: string | null;
  comparacao_leitura: boolean | null;
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
}

interface DailyData {
  date: string;
  km: number;
  formattedDate: string;
}

interface DriverData {
  motorista_id: number;
  nome: string;
  totalKm: number;
  dailyData: DailyData[];
}

const HodometrosLista = () => {
  const { query } = useCompanyData();
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('30days');
  const [driverData, setDriverData] = useState<DriverData[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<DriverData | null>(null);
  const [showChartModal, setShowChartModal] = useState(false);

  const fetchDriverData = useCallback(async () => {
    try {
      setLoading(true);

      if (!dateRange.startDate || !dateRange.endDate) {
        toast.error('Selecione um período para gerar o relatório');
        return;
      }

      // Get all readings in the period
      const { data, error } = await supabase.from('hodometro')
        .select(`
          id_hodometro,
          data,
          hora,
          hod_lido,
          hod_informado,
          km_rodado,
          bateria,
          foto_hodometro,
          trip_lida,
          trip_informada,
          comparacao_leitura,
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

      if (error) throw error;

      // Process data to get mileage by driver and date
      const driverMap = new Map<number, {
        nome: string;
        totalKm: number;
        dailyData: Map<string, number>;
      }>();

      (data || []).forEach(hodometro => {
        if (!hodometro.motorista_id || !hodometro.motorista || !hodometro.km_rodado) return;

        const driverId = hodometro.motorista.motorista_id;
        const driverName = hodometro.motorista.nome;
        const date = hodometro.data;
        const km = hodometro.km_rodado;

        // Get or create driver data
        const driverData = driverMap.get(driverId) || {
          nome: driverName,
          totalKm: 0,
          dailyData: new Map<string, number>()
        };

        // Add km to total
        driverData.totalKm += km;

        // Add km to daily data
        const dailyKm = driverData.dailyData.get(date) || 0;
        driverData.dailyData.set(date, dailyKm + km);

        // Update driver data
        driverMap.set(driverId, driverData);
      });

      // Convert to array and sort by total km (descending)
      const driversArray: DriverData[] = Array.from(driverMap.entries()).map(([motorista_id, data]) => ({
        motorista_id,
        nome: data.nome,
        totalKm: data.totalKm,
        dailyData: Array.from(data.dailyData.entries()).map(([date, km]) => ({
          date,
          km,
          formattedDate: formatDateBR(date)
        })).sort((a, b) => a.date.localeCompare(b.date)) // Sort by date ascending
      })).sort((a, b) => b.totalKm - a.totalKm);

      setDriverData(driversArray);
    } catch (error) {
      console.error('Error fetching driver data:', error);
      toast.error('Erro ao carregar dados de quilometragem');
    } finally {
      setLoading(false);
    }
  }, [dateRange, companyId]);

  useEffect(() => {
    fetchDriverData();
  }, [fetchDriverData]);

  const handleShowPhoto = (photo: string | null) => {
    if (photo) {
      setSelectedPhoto(photo);
      setShowPhotoModal(true);
    } else {
      toast.error('Nenhuma foto disponível');
    }
  };

  const handleViewChart = (driver: DriverData) => {
    setSelectedDriver(driver);
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
      const exportData = driverData.map(driver => ({
        'Motorista': driver.nome,
        'Total KM': driver.totalKm.toLocaleString('pt-BR'),
        'Média Diária': (driver.totalKm / Math.max(1, driver.dailyData.length)).toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
        'Dias com Leitura': driver.dailyData.length
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Quilometragem');
      
      // Auto-size columns
      const colWidths = [
        { wch: 30 }, // Motorista
        { wch: 15 }, // Total KM
        { wch: 15 }, // Média Diária
        { wch: 15 }  // Dias com Leitura
      ];
      ws['!cols'] = colWidths;
      
      XLSX.writeFile(wb, `relatorio_quilometragem_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Relatório exportado com sucesso');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Erro ao exportar para Excel');
    }
  };

  const filteredDriverData = driverData.filter(driver => {
    const searchString = searchTerm.toLowerCase();
    return (
      !searchTerm ||
      driver.nome.toLowerCase().includes(searchString)
    );
  });

  if (loading) {
    return <LoadingSpinner />;
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
              placeholder="Buscar por motorista..."
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
              disabled={filteredDriverData.length === 0}
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

      {/* Driver Mileage Table */}
      <div className="bg-white dark:bg-[#1B2537] rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#1B2537]">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Motorista</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total KM</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Média Diária</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dias com Leitura</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Gráfico</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-[#1B2537] divide-y divide-gray-200 dark:divide-gray-700">
              {filteredDriverData.map((driver) => (
                <tr key={driver.motorista_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-medium">
                        {driver.nome.charAt(0)}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {driver.nome}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      {formatNumber(driver.totalKm)} km
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {formatNumber(driver.totalKm / Math.max(1, driver.dailyData.length))} km
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {driver.dailyData.length}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => handleViewChart(driver)}
                      className="inline-flex items-center justify-center p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                      title="Ver gráfico de quilometragem"
                    >
                      <BarChart2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredDriverData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Nenhum dado de quilometragem encontrado para o período selecionado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart Modal */}
      {selectedDriver && (
        <MileageChartModal
          isOpen={showChartModal}
          onClose={() => setShowChartModal(false)}
          data={selectedDriver.dailyData}
          driverName={selectedDriver.nome}
        />
      )}

      {/* Photo Modal */}
      {showPhotoModal && selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowPhotoModal(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-md border border-gray-200 dark:border-gray-700"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Foto do Hodômetro
              </h3>
              <button
                onClick={() => setShowPhotoModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <X size={24} />
              </button>
            </div>
            <div className="relative aspect-video">
              <img
                src={selectedPhoto}
                alt="Foto do Hodômetro"
                className="absolute inset-0 w-full h-full object-contain"
              />
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <a
                href={selectedPhoto}
                download="hodometro.jpg"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                         transition-colors flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <Download size={16} />
                Baixar Imagem
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HodometrosLista;