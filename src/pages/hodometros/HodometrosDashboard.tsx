import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Eye, X, BarChart2, Users, Car, Calendar, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
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

interface DailyMileage {
  date: string;
  total_km: number;
}

interface DriverMileage {
  motorista_nome: string;
  total_km: number;
}

interface VehicleMileage {
  veiculo_placa: string;
  total_km: number;
}

interface DriverReadings {
  motorista_nome: string;
  total_readings: number;
}

interface OperationMileage {
  operacao: string;
  total_km: number;
}

interface Inconsistency {
  id_hodometro: string;
  data_hora: string;
  motorista_nome: string;
  veiculo_placa: string;
  hodometro: number;
  previous_hodometro: number;
  difference: number;
  foto_url: string | null;
}

const HodometrosDashboard: React.FC = () => {
  const [dailyMileage, setDailyMileage] = useState<DailyMileage[]>([]);
  const [driverMileage, setDriverMileage] = useState<DriverMileage[]>([]);
  const [vehicleMileage, setVehicleMileage] = useState<VehicleMileage[]>([]);
  const [driverReadings, setDriverReadings] = useState<DriverReadings[]>([]);
  const [operationMileage, setOperationMileage] = useState<OperationMileage[]>([]);
  const [inconsistencies, setInconsistencies] = useState<Inconsistency[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch daily mileage for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: dailyData } = await supabase
        .from('hodometros')
        .select('data_hora, hodometro, trip')
        .gte('data_hora', thirtyDaysAgo.toISOString())
        .order('data_hora', { ascending: true });

      // Process daily mileage
      const dailyMap = new Map<string, number>();
      dailyData?.forEach(reading => {
        const date = format(new Date(reading.data_hora), 'yyyy-MM-dd');
        const km = reading.trip || 0;
        dailyMap.set(date, (dailyMap.get(date) || 0) + km);
      });

      setDailyMileage(
        Array.from(dailyMap.entries()).map(([date, total_km]) => ({
          date,
          total_km
        }))
      );

      // Fetch driver mileage
      const { data: driverData } = await supabase
        .from('hodometros')
        .select('motorista_nome, trip')
        .gte('data_hora', thirtyDaysAgo.toISOString());

      const driverMap = new Map<string, number>();
      driverData?.forEach(reading => {
        const km = reading.trip || 0;
        driverMap.set(reading.motorista_nome, (driverMap.get(reading.motorista_nome) || 0) + km);
      });

      setDriverMileage(
        Array.from(driverMap.entries())
          .map(([motorista_nome, total_km]) => ({ motorista_nome, total_km }))
          .sort((a, b) => b.total_km - a.total_km)
          .slice(0, 10)
      );

      // Fetch vehicle mileage
      const { data: vehicleData } = await supabase
        .from('hodometros')
        .select('veiculo_placa, trip')
        .gte('data_hora', thirtyDaysAgo.toISOString());

      const vehicleMap = new Map<string, number>();
      vehicleData?.forEach(reading => {
        const km = reading.trip || 0;
        vehicleMap.set(reading.veiculo_placa, (vehicleMap.get(reading.veiculo_placa) || 0) + km);
      });

      setVehicleMileage(
        Array.from(vehicleMap.entries())
          .map(([veiculo_placa, total_km]) => ({ veiculo_placa, total_km }))
          .sort((a, b) => b.total_km - a.total_km)
          .slice(0, 10)
      );

      // Fetch driver readings count
      const { data: readingsData } = await supabase
        .from('hodometros')
        .select('motorista_nome')
        .gte('data_hora', thirtyDaysAgo.toISOString());

      const readingsMap = new Map<string, number>();
      readingsData?.forEach(reading => {
        readingsMap.set(reading.motorista_nome, (readingsMap.get(reading.motorista_nome) || 0) + 1);
      });

      setDriverReadings(
        Array.from(readingsMap.entries())
          .map(([motorista_nome, total_readings]) => ({ motorista_nome, total_readings }))
          .sort((a, b) => b.total_readings - a.total_readings)
          .slice(0, 10)
      );

      // Fetch operation mileage (mock data for now)
      setOperationMileage([
        { operacao: 'Entrega', total_km: 15420 },
        { operacao: 'Coleta', total_km: 8930 },
        { operacao: 'Transferência', total_km: 5670 },
        { operacao: 'Manutenção', total_km: 2340 },
        { operacao: 'Outros', total_km: 1890 }
      ]);

      // Fetch inconsistencies (readings with large jumps)
      const { data: inconsistencyData } = await supabase
        .from('hodometros')
        .select('*')
        .gte('data_hora', thirtyDaysAgo.toISOString())
        .order('data_hora', { ascending: false });

      // Process inconsistencies (simplified logic)
      const inconsistenciesList: Inconsistency[] = [];
      if (inconsistencyData) {
        for (let i = 1; i < inconsistencyData.length; i++) {
          const current = inconsistencyData[i - 1];
          const previous = inconsistencyData[i];
          
          if (current.veiculo_placa === previous.veiculo_placa) {
            const difference = current.hodometro - previous.hodometro;
            if (Math.abs(difference) > 1000) { // Large jump threshold
              inconsistenciesList.push({
                id_hodometro: current.id_hodometro,
                data_hora: current.data_hora,
                motorista_nome: current.motorista_nome,
                veiculo_placa: current.veiculo_placa,
                hodometro: current.hodometro,
                previous_hodometro: previous.hodometro,
                difference,
                foto_url: current.foto_url
              });
            }
          }
        }
      }

      setInconsistencies(inconsistenciesList.slice(0, 10));

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoClick = (photoUrl: string) => {
    setSelectedPhoto(photoUrl);
    setShowPhotoModal(true);
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
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Quilometragem
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {dailyMileage.reduce((sum, day) => sum + day.total_km, 0).toLocaleString()} km
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Motoristas Ativos
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {driverReadings.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Car className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Veículos
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {vehicleMileage.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
              <Calendar className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Leituras Hoje
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {dailyMileage.length > 0 ? dailyMileage[dailyMileage.length - 1]?.total_km || 0 : 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Mileage Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
              <BarChart2 className="h-5 w-5 mr-2 text-blue-600" />
              Quilometragem Diária
            </h3>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {dailyMileage.slice(-7).map((day, index) => (
              <div key={day.date} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {format(new Date(day.date), 'dd/MM', { locale: ptBR })}
                </span>
                <div className="flex items-center flex-1 mx-4">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min((day.total_km / Math.max(...dailyMileage.map(d => d.total_km))) * 100, 100)}%`
                      }}
                    ></div>
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {day.total_km.toLocaleString()} km
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Driver Mileage Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
              <Users className="h-5 w-5 mr-2 text-green-600" />
              Quilometragem por Motorista
            </h3>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {driverMileage.map((driver, index) => (
              <div key={driver.motorista_nome} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-32">
                  {driver.motorista_nome}
                </span>
                <div className="flex items-center flex-1 mx-4">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min((driver.total_km / Math.max(...driverMileage.map(d => d.total_km))) * 100, 100)}%`
                      }}
                    ></div>
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {driver.total_km.toLocaleString()} km
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Vehicle Mileage Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
              <Car className="h-5 w-5 mr-2 text-purple-600" />
              Quilometragem por Veículo
            </h3>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {vehicleMileage.map((vehicle, index) => (
              <div key={vehicle.veiculo_placa} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {vehicle.veiculo_placa}
                </span>
                <div className="flex items-center flex-1 mx-4">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min((vehicle.total_km / Math.max(...vehicleMileage.map(v => v.total_km))) * 100, 100)}%`
                      }}
                    ></div>
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {vehicle.total_km.toLocaleString()} km
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Driver Readings Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-orange-600" />
              Leituras por Motorista
            </h3>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {driverReadings.map((driver, index) => (
              <div key={driver.motorista_nome} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-32">
                  {driver.motorista_nome}
                </span>
                <div className="flex items-center flex-1 mx-4">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min((driver.total_readings / Math.max(...driverReadings.map(d => d.total_readings))) * 100, 100)}%`
                      }}
                    ></div>
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {driver.total_readings} leituras
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Operation Mileage */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-indigo-600" />
            Quilômetros por Operação
          </h3>
        </div>
        <div className="space-y-3">
          {operationMileage.map((operation, index) => (
            <div key={operation.operacao} className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {operation.operacao}
              </span>
              <div className="flex items-center flex-1 mx-4">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min((operation.total_km / Math.max(...operationMileage.map(o => o.total_km))) * 100, 100)}%`
                    }}
                  ></div>
                </div>
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {operation.total_km.toLocaleString()} km
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Inconsistencies */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
            <Eye className="h-5 w-5 mr-2 text-red-600" />
            Inconsistência de Leitura
            <span className="ml-2 px-2 py-1 text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-full">
              {inconsistencies.length} inconsistências
            </span>
          </h3>
        </div>
        
        {inconsistencies.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 dark:bg-[#1E2A3B]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Placa
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Hodômetro
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {inconsistencies.map((inconsistency) => {
                  return (
                    <tr key={inconsistency.id_hodometro}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {inconsistency.motorista_nome}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {format(new Date(inconsistency.data_hora), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {inconsistency.veiculo_placa}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <div className="text-gray-900 dark:text-white">
                          {inconsistency.hodometro.toLocaleString()}
                        </div>
                        <div className="text-xs text-red-600 dark:text-red-400">
                          Diferença: {inconsistency.difference > 0 ? '+' : ''}{inconsistency.difference.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {inconsistency.foto_url ? (
                          <button
                            onClick={() => handlePhotoClick(inconsistency.foto_url!)}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-600">
                            -
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 bg-card rounded-2xl">
            <Eye className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
            <p className="text-gray-400">Nenhuma inconsistência encontrada</p>
          </div>
        )}
      </div>

      {/* Photo Modal */}
      {showPhotoModal && selectedPhoto && (
        <div 
          className="fixed inset-0 bg-transparent z-50 flex items-center justify-center p-4"
          onClick={() => setShowPhotoModal(false)}
        >
          <div 
            className="bg-card rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-none border-none"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-medium text-black dark:text-white">
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
          </div>
        </div>
      )}
    </div>
  );
};

export default HodometrosDashboard;