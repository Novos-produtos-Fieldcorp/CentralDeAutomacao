import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Eye, ChevronDown, ChevronUp, Edit2, Trash2, Camera, X, BarChart2, Calendar, Filter } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import PeriodSelector from '../../components/hodometros/PeriodSelector';
import { useDateRange } from '../../hooks/useDateRange';
import type { Hodometro } from '../../types/database';
import BulkDeleteConfirmationModal from '../../components/BulkDeleteConfirmationModal';
import { useAuth } from '../../context/AuthContext';
import EditHodometroModal from '../../components/hodometros/EditHodometroModal';
import DeleteHodometroModal from '../../components/hodometros/DeleteHodometroModal';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatCPF } from '../../utils/format';

interface MileageData {
  motorista_id: number;
  nome: string;
  foto?: string;
  placa: string;
  cliente: string;
  leitura_inicial: number;
  leitura_final: number;
  km_total: number;
  ultima_data: string;
  hodometros: Hodometro[];
}

interface MonthlyData {
  month: string;
  km: number;
}

const HodometrosLista = () => {
  const { query } = useCompanyData();
  const { companyId } = useAuth();
  const [hodometros, setHodometros] = useState<Hodometro[]>([]);
  const [mileageData, setMileageData] = useState<MileageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedHodometro, setSelectedHodometro] = useState<Hodometro | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('');
  const [clients, setClients] = useState<string[]>([]);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [showChartModal, setShowChartModal] = useState(false);
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('1month');

  const fetchHodometros = useCallback(async () => {
    try {
      setLoading(true);
      
      const baseQuery = supabase.from('hodometro')
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
        `);

      const { data, error } = await baseQuery
        .eq('company_id', companyId)
        .gte('data', dateRange.startDate)
        .lte('data', dateRange.endDate)
        .order('data', { ascending: false })
        .order('hora', { ascending: false });

      if (error) throw error;

      // Ensure data is sorted by date (newest first)
      const sortedData = (data || []).sort((a, b) => {
        const dateA = new Date(`${a.data} ${a.hora}`);
        const dateB = new Date(`${b.data} ${b.hora}`);
        return dateB.getTime() - dateA.getTime();
      });

      setHodometros(sortedData);

      // Process data for the new UI
      processHodometrosData(sortedData);

      // Extract unique clients
      const uniqueClients = Array.from(new Set(
        sortedData
          .filter(h => h.cliente?.nome)
          .map(h => h.cliente.nome)
      )).sort();
      
      setClients(uniqueClients);
    } catch (error) {
      console.error('Error fetching hodometros:', error);
      toast.error('Erro ao carregar hodômetros');
    } finally {
      setLoading(false);
    }
  }, [dateRange, companyId]);

  useEffect(() => {
    fetchHodometros();
  }, [fetchHodometros]);

  const processHodometrosData = (data: Hodometro[]) => {
    // Group by motorista and veiculo
    const groupedData: Record<string, Hodometro[]> = {};
    
    data.forEach(hodometro => {
      if (!hodometro.motorista || !hodometro.veiculo) return;
      
      const key = `${hodometro.motorista_id}_${hodometro.veiculo_id}`;
      if (!groupedData[key]) {
        groupedData[key] = [];
      }
      groupedData[key].push(hodometro);
    });

    // Process each group to get initial and final readings
    const processedData: MileageData[] = [];
    
    Object.values(groupedData).forEach(group => {
      if (group.length === 0) return;
      
      // Sort by date (oldest first for initial reading, newest first for final reading)
      const sortedGroup = [...group].sort((a, b) => {
        const dateA = new Date(`${a.data} ${a.hora}`);
        const dateB = new Date(`${b.data} ${b.hora}`);
        return dateA.getTime() - dateB.getTime();
      });
      
      const firstReading = sortedGroup[0];
      const lastReading = sortedGroup[sortedGroup.length - 1];
      
      // Check if it's an electric vehicle (has battery readings)
      const isElectric = firstReading.bateria !== null && firstReading.bateria !== undefined;
      
      // Calculate total KM
      let totalKm = 0;
      if (isElectric) {
        // For electric vehicles, use the sum of km_rodado values
        totalKm = sortedGroup.reduce((sum, reading) => sum + (reading.km_rodado || 0), 0);
      } else {
        // For regular vehicles, use the difference between first and last readings
        const firstHodLido = firstReading.hod_lido || 0;
        const lastHodLido = lastReading.hod_lido || 0;
        totalKm = Math.max(0, lastHodLido - firstHodLido);
      }

      // Format date
      const lastDate = new Date(lastReading.data);
      const formattedDate = lastDate.toLocaleDateString('pt-BR');

      // Create the processed data entry
      processedData.push({
        motorista_id: firstReading.motorista_id,
        nome: firstReading.motorista.nome,
        foto: `https://ui-avatars.com/api/?name=${encodeURIComponent(firstReading.motorista.nome)}&background=random&color=fff&size=128`,
        placa: firstReading.veiculo.placa.toUpperCase(),
        cliente: firstReading.cliente?.nome || 'Sem cliente',
        leitura_inicial: isElectric ? 0 : (firstReading.hod_lido || 0),
        leitura_final: isElectric ? 0 : (lastReading.hod_lido || 0),
        km_total: totalKm,
        ultima_data: formattedDate,
        hodometros: sortedGroup
      });
    });

    // Sort by total KM (highest first)
    processedData.sort((a, b) => b.km_total - a.km_total);
    
    setMileageData(processedData);
  };

  const generateMonthlyData = (hodometros: Hodometro[]) => {
    // Group by month
    const monthlyData: Record<string, number> = {};
    
    hodometros.forEach(hodometro => {
      const date = new Date(hodometro.data);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = 0;
      }
      
      monthlyData[monthKey] += hodometro.km_rodado || 0;
    });
    
    // Convert to array and sort by month
    const result = Object.entries(monthlyData).map(([key, km]) => {
      const [year, month] = key.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return {
        month: date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
        km: Math.round(km)
      };
    }).sort((a, b) => {
      const dateA = new Date(a.month);
      const dateB = new Date(b.month);
      return dateA.getTime() - dateB.getTime();
    });
    
    setMonthlyData(result);
  };

  const handleEdit = (e: React.MouseEvent, hodometro: Hodometro) => {
    e.stopPropagation();
    setSelectedHodometro(hodometro);
    setIsEditModalOpen(true);
  };

  const handleDelete = (e: React.MouseEvent, hodometro: Hodometro) => {
    e.stopPropagation();
    setSelectedHodometro(hodometro);
    setIsDeleteModalOpen(true);
  };

  const handleShowPhoto = (e: React.MouseEvent, photo: string | null) => {
    e.stopPropagation();
    if (photo) {
      setSelectedPhoto(photo);
      setShowPhotoModal(true);
    } else {
      toast.error('Nenhuma foto disponível');
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedHodometro) return;

    try {
      const { error } = await query('hodometro')
        .delete()
        .eq('id_hodometro', selectedHodometro.id_hodometro);

      if (error) throw error;

      toast.success('Leitura excluída com sucesso');
      fetchHodometros();
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting hodometro:', error);
      toast.error('Erro ao excluir leitura');
    }
  };

  const handleSelectItem = (id: number) => {
    const newSelectedItems = new Set(selectedItems);
    if (selectedItems.has(id)) {
      newSelectedItems.delete(id);
    } else {
      newSelectedItems.add(id);
    }
    setSelectedItems(newSelectedItems);
  };

  const handleBulkDelete = async () => {
    try {
      // Delete all selected items
      for (const id of selectedItems) {
        const { error } = await query('hodometro')
          .delete()
          .eq('id_hodometro', id);

        if (error) throw error;
      }

      toast.success(`${selectedItems.size} leitura${selectedItems.size !== 1 ? 's' : ''} excluída${selectedItems.size !== 1 ? 's' : ''} com sucesso`);
      fetchHodometros();
      setSelectedItems(new Set());
      setIsBulkDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting hodometros:', error);
      toast.error('Erro ao excluir leituras');
    }
  };

  const toggleExpand = (motorista_id: number) => {
    if (expandedItem === motorista_id) {
      setExpandedItem(null);
    } else {
      setExpandedItem(motorista_id);
      // Generate monthly data for the selected motorista
      const selectedData = mileageData.find(data => data.motorista_id === motorista_id);
      if (selectedData) {
        generateMonthlyData(selectedData.hodometros);
        setShowChartModal(true);
      }
    }
  };

  const filteredData = mileageData.filter(data => {
    const searchLower = searchTerm.toLowerCase();
    const clientMatch = selectedClientFilter ? data.cliente === selectedClientFilter : true;
    
    return (
      clientMatch &&
      (data.nome.toLowerCase().includes(searchLower) ||
       data.placa.toLowerCase().includes(searchLower) ||
       data.cliente.toLowerCase().includes(searchLower))
    );
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          {selectedItems.size > 0 && (
            <span className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 rounded-full text-sm">
              {selectedItems.size} selecionado{selectedItems.size !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {selectedItems.size > 0 && (
            <button
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 
                      focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 
                      transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-5 h-5" />
              Excluir Selecionados
            </button>
          )}
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por motorista, placa ou cliente..."
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
              value={selectedClientFilter}
              onChange={(e) => setSelectedClientFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 
                       dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 
                       focus:border-blue-500 text-gray-900 dark:text-gray-100 appearance-none"
            >
              <option value="">Todos os clientes</option>
              {clients.map((client, index) => (
                <option key={index} value={client}>{client}</option>
              ))}
            </select>
            <Filter className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <ChevronDown className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
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

      {/* Mileage List */}
      <div className="space-y-4">
        {filteredData.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center shadow-md border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col items-center justify-center">
              <Calendar className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
                Nenhuma leitura encontrada
              </h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-md">
                Não foram encontradas leituras para o período e filtros selecionados. Tente ajustar os filtros ou selecionar um período diferente.
              </p>
            </div>
          </div>
        ) : (
          filteredData.map((data) => (
            <div 
              key={`${data.motorista_id}_${data.placa}`} 
              className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div 
                className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                onClick={() => toggleExpand(data.motorista_id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <img 
                      src={data.foto} 
                      alt={data.nome} 
                      className="w-12 h-12 rounded-full object-cover border-2 border-blue-500 dark:border-blue-400"
                    />
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{data.nome}</h3>
                      <div className="flex items-center mt-1 space-x-2">
                        <span className="text-blue-600 dark:text-blue-400 font-medium">{data.placa}</span>
                        <span className="text-gray-500 dark:text-gray-400">•</span>
                        <span className="text-gray-600 dark:text-gray-300">{data.cliente}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-8">
                    <div className="text-right">
                      <div className="text-sm text-gray-500 dark:text-gray-400">Leitura Inicial</div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {data.leitura_inicial.toLocaleString('pt-BR')} km
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-sm text-gray-500 dark:text-gray-400">Leitura Final</div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {data.leitura_final.toLocaleString('pt-BR')} km
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-sm text-gray-500 dark:text-gray-400">Total KM</div>
                      <div className="font-semibold text-blue-600 dark:text-blue-400">
                        {data.km_total.toLocaleString('pt-BR')} km
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-sm text-gray-500 dark:text-gray-400">Última Leitura</div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {data.ultima_data}
                      </div>
                    </div>
                    
                    <button 
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(data.motorista_id);
                      }}
                    >
                      {expandedItem === data.motorista_id ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              
              {expandedItem === data.motorista_id && (
                <div className="bg-gray-50 dark:bg-gray-700/30 p-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      <BarChart2 className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                      Quilometragem Mensal
                    </h4>
                    <button
                      onClick={() => setShowChartModal(true)}
                      className="text-blue-600 dark:text-blue-400 text-sm hover:underline"
                    >
                      Ver gráfico completo
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {monthlyData.map((item, index) => (
                      <div key={index} className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {item.month}
                          </span>
                          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                            {item.km.toLocaleString('pt-BR')} km
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 dark:bg-blue-400 rounded-full"
                            style={{ 
                              width: `${Math.max(5, (item.km / Math.max(...monthlyData.map(d => d.km), 1)) * 100)}%` 
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-6 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hora</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hodômetro</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">KM Rodado</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {data.hodometros.map((hodometro) => (
                          <tr key={hodometro.id_hodometro} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {new Date(hodometro.data).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {hodometro.hora}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {hodometro.bateria !== null && hodometro.bateria !== undefined ? (
                                <span>Bateria: {hodometro.bateria}%</span>
                              ) : (
                                <span>{hodometro.hod_lido?.toLocaleString('pt-BR')} km</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400">
                              {hodometro.km_rodado?.toLocaleString('pt-BR')} km
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end space-x-3">
                                <button
                                  onClick={(e) => handleShowPhoto(e, hodometro.foto_hodometro)}
                                  className={`text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 
                                           transition-colors ${!hodometro.foto_hodometro && 'opacity-50 cursor-not-allowed'}`}
                                  title={hodometro.foto_hodometro ? "Ver foto do hodômetro" : "Sem foto disponível"}
                                >
                                  <Camera size={18} />
                                </button>
                                <button
                                  onClick={(e) => handleEdit(e, hodometro)}
                                  className="text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300 
                                           transition-colors"
                                  title="Editar"
                                >
                                  <Edit2 size={18} />
                                </button>
                                <button
                                  onClick={(e) => handleDelete(e, hodometro)}
                                  className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 
                                           transition-colors"
                                  title="Excluir"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

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
          </div>
        </div>
      )}

      {/* Chart Modal */}
      {showChartModal && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowChartModal(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-md border border-gray-200 dark:border-gray-700"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                Quilometragem Mensal
              </h3>
              <button
                onClick={() => setShowChartModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              <div className="h-80 w-full">
                <div className="flex h-full items-end space-x-2">
                  {monthlyData.map((item, index) => {
                    const maxValue = Math.max(...monthlyData.map(d => d.km));
                    const percentage = (item.km / maxValue) * 100;
                    
                    return (
                      <div key={index} className="flex-1 flex flex-col items-center">
                        <div className="w-full flex justify-center mb-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {item.km.toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <div 
                          className="w-full bg-blue-500 dark:bg-blue-400 rounded-t-lg transition-all duration-500"
                          style={{ height: `${Math.max(5, percentage)}%` }}
                        />
                        <div className="w-full text-center mt-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {item.month}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <EditHodometroModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        hodometro={selectedHodometro}
        onUpdate={fetchHodometros}
      />

      <DeleteHodometroModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        hodometroData={selectedHodometro}
      />

      <BulkDeleteConfirmationModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        title="Confirmar Exclusão em Massa"
        message="Tem certeza que deseja excluir todas as leituras selecionadas? Esta ação não pode ser desfeita."
        itemCount={selectedItems.size}
        itemType="leitura"
      />
    </div>
  );
};

export default HodometrosLista;