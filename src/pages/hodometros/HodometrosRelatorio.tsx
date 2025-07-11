import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, Download, Filter, FileText, TrendingUp } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HodometroReading {
  id_hodometro: string;
  data_hora: string;
  motorista_nome: string;
  veiculo_placa: string;
  hodometro: number;
  trip: number | null;
  bateria: number | null;
  foto_url: string | null;
  observacoes: string | null;
}

interface ReportData {
  totalReadings: number;
  totalMileage: number;
  averageMileagePerDay: number;
  topDrivers: Array<{ name: string; mileage: number; readings: number }>;
  topVehicles: Array<{ plate: string; mileage: number; readings: number }>;
  dailyData: Array<{ date: string; readings: number; mileage: number }>;
}

const HodometrosRelatorio: React.FC = () => {
  const [readings, setReadings] = useState<HodometroReading[]>([]);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [filterDriver, setFilterDriver] = useState('');
  const [filterVehicle, setFilterVehicle] = useState('');

  useEffect(() => {
    fetchReportData();
  }, [selectedMonth, filterDriver, filterVehicle]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      
      const startDate = startOfMonth(selectedMonth);
      const endDate = endOfMonth(selectedMonth);

      let query = supabase
        .from('hodometros')
        .select('*')
        .gte('data_hora', startDate.toISOString())
        .lte('data_hora', endDate.toISOString())
        .order('data_hora', { ascending: true });

      if (filterDriver) {
        query = query.eq('motorista_nome', filterDriver);
      }

      if (filterVehicle) {
        query = query.eq('veiculo_placa', filterVehicle);
      }

      const { data, error } = await query;

      if (error) throw error;

      const readingsData = data || [];
      setReadings(readingsData);

      // Process report data
      const totalReadings = readingsData.length;
      const totalMileage = readingsData.reduce((sum, reading) => sum + (reading.trip || 0), 0);
      const daysInMonth = endDate.getDate();
      const averageMileagePerDay = totalMileage / daysInMonth;

      // Top drivers
      const driverStats = new Map<string, { mileage: number; readings: number }>();
      readingsData.forEach(reading => {
        const current = driverStats.get(reading.motorista_nome) || { mileage: 0, readings: 0 };
        driverStats.set(reading.motorista_nome, {
          mileage: current.mileage + (reading.trip || 0),
          readings: current.readings + 1
        });
      });

      const topDrivers = Array.from(driverStats.entries())
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.mileage - a.mileage)
        .slice(0, 10);

      // Top vehicles
      const vehicleStats = new Map<string, { mileage: number; readings: number }>();
      readingsData.forEach(reading => {
        const current = vehicleStats.get(reading.veiculo_placa) || { mileage: 0, readings: 0 };
        vehicleStats.set(reading.veiculo_placa, {
          mileage: current.mileage + (reading.trip || 0),
          readings: current.readings + 1
        });
      });

      const topVehicles = Array.from(vehicleStats.entries())
        .map(([plate, stats]) => ({ plate, ...stats }))
        .sort((a, b) => b.mileage - a.mileage)
        .slice(0, 10);

      // Daily data
      const dailyStats = new Map<string, { readings: number; mileage: number }>();
      readingsData.forEach(reading => {
        const date = format(new Date(reading.data_hora), 'yyyy-MM-dd');
        const current = dailyStats.get(date) || { readings: 0, mileage: 0 };
        dailyStats.set(date, {
          readings: current.readings + 1,
          mileage: current.mileage + (reading.trip || 0)
        });
      });

      const dailyData = Array.from(dailyStats.entries())
        .map(([date, stats]) => ({ date, ...stats }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setReportData({
        totalReadings,
        totalMileage,
        averageMileagePerDay,
        topDrivers,
        topVehicles,
        dailyData
      });

    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const uniqueDrivers = [...new Set(readings.map(r => r.motorista_nome))];
  const uniqueVehicles = [...new Set(readings.map(r => r.veiculo_placa))];

  const exportReport = () => {
    // Implementation for exporting report
    console.log('Exporting report...');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Relatório de Hodômetros
        </h2>
        <button
          onClick={exportReport}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download className="h-4 w-4 mr-2" />
          Exportar Relatório
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Mês/Ano
            </label>
            <input
              type="month"
              value={format(selectedMonth, 'yyyy-MM')}
              onChange={(e) => setSelectedMonth(new Date(e.target.value + '-01'))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Motorista
            </label>
            <select
              value={filterDriver}
              onChange={(e) => setFilterDriver(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Todos os motoristas</option>
              {uniqueDrivers.map(driver => (
                <option key={driver} value={driver}>{driver}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Veículo
            </label>
            <select
              value={filterVehicle}
              onChange={(e) => setFilterVehicle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Todos os veículos</option>
              {uniqueVehicles.map(vehicle => (
                <option key={vehicle} value={vehicle}>{vehicle}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setFilterDriver('');
                setFilterVehicle('');
              }}
              className="w-full flex items-center justify-center px-4 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
            >
              <Filter className="h-4 w-4 mr-2" />
              Limpar
            </button>
          </div>
        </div>
      </div>

      {reportData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Total de Leituras
                  </p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {reportData.totalReadings.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Quilometragem Total
                  </p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {reportData.totalMileage.toLocaleString()} km
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <Calendar className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Média Diária
                  </p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {Math.round(reportData.averageMileagePerDay).toLocaleString()} km
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Período
                  </p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {format(selectedMonth, 'MMM/yyyy', { locale: ptBR })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts and Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Drivers */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Top 10 Motoristas
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50 dark:bg-[#1E2A3B]">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Motorista</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Hodômetro</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Trip</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Foto</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Editar</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {reportData.topDrivers.map((driver, index) => (
                      <tr key={driver.name}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          <div className="flex items-center">
                            <span className="w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full flex items-center justify-center text-xs font-medium mr-3">
                              {index + 1}
                            </span>
                            {driver.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                          {driver.mileage.toLocaleString()} km
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-right">
                          {driver.readings} leituras
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Vehicles */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Top 10 Veículos
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50 dark:bg-[#1E2A3B]">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Veículo</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Quilometragem</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Leituras</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {reportData.topVehicles.map((vehicle, index) => (
                      <tr key={vehicle.plate}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          <div className="flex items-center">
                            <span className="w-6 h-6 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full flex items-center justify-center text-xs font-medium mr-3">
                              {index + 1}
                            </span>
                            {vehicle.plate}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                          {vehicle.mileage.toLocaleString()} km
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-right">
                          {vehicle.readings} leituras
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Detailed Readings Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Leituras Detalhadas
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-[#1E2A3B]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Data/Hora</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Motorista</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Veículo</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Hodômetro</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Trip</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Foto</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Editar</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {readings.map((reading) => {
                    const isElectric = reading.bateria !== null && reading.bateria !== undefined;
                    
                    return (
                      <tr key={reading.id_hodometro}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {format(new Date(reading.data_hora), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {reading.motorista_nome}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          <div className="flex items-center">
                            {reading.veiculo_placa}
                            {isElectric && (
                              <span className="ml-2 px-2 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full">
                                {reading.bateria}%
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                          {reading.hodometro.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                          {reading.trip ? reading.trip.toLocaleString() : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {reading.foto_url ? (
                            <span className="text-green-600 dark:text-green-400">✓</span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-600">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                            Editar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HodometrosRelatorio;