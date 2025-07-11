import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Eye, Edit, Trash2, Search, Filter, Download, BarChart2 } from 'lucide-react';
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

const HodometrosLista: React.FC = () => {
  const [readings, setReadings] = useState<HodometroReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDriver, setFilterDriver] = useState('');
  const [filterVehicle, setFilterVehicle] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  useEffect(() => {
    fetchReadings();
  }, []);

  const fetchReadings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('hodometros')
        .select('*')
        .order('data_hora', { ascending: false });

      if (error) throw error;
      setReadings(data || []);
    } catch (error) {
      console.error('Error fetching readings:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredReadings = readings.filter(reading => {
    const matchesSearch = 
      reading.motorista_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reading.veiculo_placa.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDriver = !filterDriver || reading.motorista_nome === filterDriver;
    const matchesVehicle = !filterVehicle || reading.veiculo_placa === filterVehicle;

    return matchesSearch && matchesDriver && matchesVehicle;
  });

  const paginatedReadings = filteredReadings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredReadings.length / itemsPerPage);

  const uniqueDrivers = [...new Set(readings.map(r => r.motorista_nome))];
  const uniqueVehicles = [...new Set(readings.map(r => r.veiculo_placa))];

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
          Lista de Hodômetros
        </h2>
        <div className="flex gap-2">
          <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Buscar por motorista ou placa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

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

          <button
            onClick={() => {
              setSearchTerm('');
              setFilterDriver('');
              setFilterVehicle('');
            }}
            className="flex items-center justify-center px-4 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
          >
            <Filter className="h-4 w-4 mr-2" />
            Limpar
          </button>
        </div>
      </div>

      {/* Results Summary */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Mostrando {paginatedReadings.length} de {filteredReadings.length} registros
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-[#1E2A3B]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Data/Hora
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Motorista
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Veículo
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Hodômetro
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Trip
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Bateria
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Foto
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedReadings.map((reading) => {
                const isElectric = reading.bateria !== null && reading.bateria !== undefined;
                
                return (
                  <tr key={reading.id_hodometro} className="hover:bg-gray-50 dark:hover:bg-gray-700">
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
                            Elétrico
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                      {isElectric ? `${reading.bateria}%` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {reading.foto_url ? (
                        <button className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                          <Eye className="h-4 w-4" />
                        </button>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300">
                          <BarChart2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Página {currentPage} de {totalPages}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HodometrosLista;