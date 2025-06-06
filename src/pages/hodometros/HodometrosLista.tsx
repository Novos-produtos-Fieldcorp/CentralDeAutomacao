import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Download, Eye, ChevronDown, ChevronUp, Edit2, Trash2, Camera, X, BarChart2 } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { exportToExcel, exportToPDF } from '../../utils/export';
import PeriodSelector from '../../components/hodometros/PeriodSelector';
import { useDateRange } from '../../hooks/useDateRange';
import type { Hodometro } from '../../types/database';
import { formatCPF } from '../../utils/format';
import BulkDeleteConfirmationModal from '../../components/BulkDeleteConfirmationModal';
import { useAuth } from '../../context/AuthContext';
import EditHodometroModal from '../../components/hodometros/EditHodometroModal';
import DeleteHodometroModal from '../../components/hodometros/DeleteHodometroModal';
import LoadingSpinner from '../../components/LoadingSpinner';

interface DailyTotal {
  date: string;
  totalKm: number;
  hodometros: Hodometro[];
  isExpanded: boolean;
}

interface MonthlyKmData {
  month: string;
  km: number;
}

const HodometrosLista = () => {
  const { query } = useCompanyData();
  const { companyId } = useAuth();
  const [hodometros, setHodometros] = useState<Hodometro[]>([]);
  const [dailyTotals, setDailyTotals] = useState<DailyTotal[]>([]);
  const [maxDailyKm, setMaxDailyKm] = useState(0);
  const [maxIndividualKm, setMaxIndividualKm] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedHodometro, setSelectedHodometro] = useState<Hodometro | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [showKmChartModal, setShowKmChartModal] = useState(false);
  const [selectedMotoristaNome, setSelectedMotoristaNome] = useState<string>('');
  const [monthlyKmData, setMonthlyKmData] = useState<MonthlyKmData[]>([]);
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('all');

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

      // Find max individual KM
      const maxKm = Math.max(...sortedData.map(h => h.hod_lido || 0));
      setMaxIndividualKm(maxKm);

      // Group hodometros by date and calculate totals
      const groupedByDate = sortedData.reduce<Record<string, Hodometro[]>>((acc, hodometro) => {
        const date = hodometro.data;
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(hodometro);
        return acc;
      }, {});

      // Create daily totals array
      const totals = Object.entries(groupedByDate).map(([date, entries]) => {
        // Calculate total KM for this date from km_rodado values
        const totalKm = entries.reduce((sum, entry) => sum + (entry.km_rodado || 0), 0);

        // Sort entries by time ascending to get first and last readings

        return {
          date,
          totalKm,
          hodometros: [...entries].sort((a, b) => b.hora.localeCompare(a.hora)), // Sort by time descending for display
          isExpanded: false
        };
      });

      // Sort by date descending (newest first)
      totals.sort((a, b) => b.date.localeCompare(a.date));

      // Find max daily total KM
      const maxDailyKm = Math.max(...totals.map(t => t.totalKm));
      setMaxDailyKm(maxDailyKm);

      setDailyTotals(totals);
    } catch (error) {
      console.error('Error fetching hodometros:', error);
      toast.error('Erro ao carregar hodômetros');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchHodometros();
  }, [fetchHodometros]);

  const toggleExpand = (date: string) => {
    setDailyTotals(prev => 
      prev.map(total => 
        total.date === date 
          ? { ...total, isExpanded: !total.isExpanded } 
          : total
      )
    );
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

  const showKmChart = async (motorista_id: number, nome: string) => {
    try {
      // Fetch all hodometros for this driver in the last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const startDate = sixMonthsAgo.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('hodometro')
        .select('*')
        .eq('motorista_id', motorista_id)
        .gte('data', startDate)
        .order('data', { ascending: true });
        
      if (error) throw error;
      
      if (!data || data.length === 0) {
        toast.error('Não há dados suficientes para gerar o gráfico');
        return;
      }
      
      // Group by month and calculate total KM
      const monthlyData: Record<string, number> = {};
      
      data.forEach(hodometro => {
        const date = new Date(hodometro.data);
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData[monthYear]) {
          monthlyData[monthYear] = 0;
        }
        
        monthlyData[monthYear] += hodometro.km_rodado || 0;
      });
      
      // Convert to array format for chart
      const chartData = Object.entries(monthlyData).map(([monthYear, km]) => {
        const [year, month] = monthYear.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        const monthName = date.toLocaleString('pt-BR', { month: 'short' });
        
        return {
          month: `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`,
          km: Math.round(km)
        };
      });
      
      // Sort by date
      chartData.sort((a, b) => {
        const monthA = a.month.split(' ')[0];
        const yearA = a.month.split(' ')[1];
        const monthB = b.month.split(' ')[0];
        const yearB = b.month.split(' ')[1];
        
        if (yearA !== yearB) {
          return parseInt(yearA) - parseInt(yearB);
        }
        
        const monthOrder = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return monthOrder.indexOf(monthA) - monthOrder.indexOf(monthB);
      });
      
      setMonthlyKmData(chartData);
      setSelectedMotoristaNome(nome);
      setShowKmChartModal(true);
    } catch (error) {
      console.error('Error generating chart data:', error);
      toast.error('Erro ao gerar dados do gráfico');
    }
  };

  const filteredTotals = dailyTotals.filter(total => {
    const searchString = searchTerm.toLowerCase();
    return total.hodometros.some(h => 
      h.motorista?.nome.toLowerCase().includes(searchString) ||
      h.veiculo?.placa.toLowerCase().includes(searchString) ||
      h.cliente?.nome?.toLowerCase().includes(searchString)
    );
  });

  if (loading) {
    return (
      <LoadingSpinner />
    );
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      {/* List View */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Leituras de Hodômetro</h3>
          </div>
          
          {filteredTotals.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                Nenhuma leitura encontrada para o período selecionado
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTotals.map((total) => (
                <div key={total.date} className="bg-white dark:bg-gray-800">
                  {/* Date Header */}
                  <div 
                    className="p-4 cursor-pointer bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 flex justify-between items-center"
                    onClick={() => toggleExpand(total.date)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {total.date.split('-').reverse().join('/')}
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {Math.round(total.totalKm).toLocaleString('pt-BR')} km
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {total.hodometros.length} leituras
                      </div>
                    </div>
                    <button className="text-gray-500 dark:text-gray-400">
                      {total.isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>

                  {/* Expanded Readings */}
                  {total.isExpanded && (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                      {total.hodometros.map((hodometro) => (
                        <div 
                          key={hodometro.id_hodometro}
                          className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                          onClick={() => showKmChart(hodometro.motorista_id, hodometro.motorista?.nome || 'Motorista')}
                        >
                          <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-center">
                            {/* Motorista */}
                            <div className="flex items-center gap-3 md:col-span-2">
                              <div className="flex-shrink-0 h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                                <span className="text-lg font-medium text-gray-600 dark:text-gray-300">
                                  {hodometro.motorista?.nome?.charAt(0) || 'M'}
                                </span>
                              </div>
                              <div>
                                <div className="font-medium text-gray-900 dark:text-white">
                                  {hodometro.motorista?.nome || 'Motorista não informado'}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {hodometro.veiculo?.placa?.toUpperCase() || 'Sem placa'} • {hodometro.hora}
                                </div>
                              </div>
                            </div>

                            {/* Cliente */}
                            <div className="md:col-span-1">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                                {hodometro.cliente?.nome || 'Sem cliente'}
                              </span>
                            </div>

                            {/* Leitura */}
                            <div className="md:col-span-1">
                              {hodometro.bateria ? (
                                <div className="text-sm text-gray-900 dark:text-white">
                                  Bateria: {hodometro.bateria}%
                                </div>
                              ) : (
                                <div className="text-sm text-gray-900 dark:text-white">
                                  {hodometro.hod_lido?.toLocaleString('pt-BR')} km
                                </div>
                              )}
                            </div>

                            {/* Trip */}
                            <div className="md:col-span-1">
                              <div className="text-sm text-gray-900 dark:text-white">
                                Trip: {hodometro.trip_lida?.toLocaleString('pt-BR') || 'N/A'}
                              </div>
                            </div>

                            {/* KM Rodado */}
                            <div className="md:col-span-1">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {hodometro.km_rodado?.toLocaleString('pt-BR')} km
                              </div>
                              {hodometro.comparacao_leitura !== null && (
                                <div className={`text-xs px-2 py-0.5 rounded-full font-medium inline-block ${
                                  hodometro.comparacao_leitura
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                                }`}>
                                  {hodometro.comparacao_leitura ? 'Leitura OK' : 'Divergente'}
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end space-x-3 md:col-span-1">
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
                              <input
                                type="checkbox"
                                checked={selectedItems.has(hodometro.id_hodometro)}
                                onChange={() => handleSelectItem(hodometro.id_hodometro)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
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
                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
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

      {/* KM Chart Modal */}
      {showKmChartModal && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowKmChartModal(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-md border border-gray-200 dark:border-gray-700"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Quilometragem Mensal - {selectedMotoristaNome}
              </h3>
              <button
                onClick={() => setShowKmChartModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              {monthlyKmData.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">
                    Não há dados suficientes para gerar o gráfico
                  </p>
                </div>
              ) : (
                <div className="h-80">
                  <div className="flex h-full items-end space-x-2">
                    {monthlyKmData.map((item, index) => {
                      const maxKm = Math.max(...monthlyKmData.map(d => d.km));
                      const percentage = (item.km / maxKm) * 100;
                      
                      return (
                        <div key={index} className="flex-1 flex flex-col items-center">
                          <div className="w-full text-center mb-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {item.km.toLocaleString('pt-BR')} km
                            </span>
                          </div>
                          <div 
                            className="w-full bg-blue-500 dark:bg-blue-600 rounded-t-lg transition-all duration-500"
                            style={{ height: `${Math.max(5, percentage)}%` }}
                          ></div>
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
              )}
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowKmChartModal(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                           transition-colors"
                >
                  Fechar
                </button>
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