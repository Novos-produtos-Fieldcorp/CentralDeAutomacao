import React, { useState, useEffect, useCallback } from 'react';
import { Search, Eye, ChevronDown, ChevronUp, Edit2, Trash2, Camera, X } from 'lucide-react';
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

interface DailyTotal {
  date: string;
  totalKm: number;
  hodometros: Hodometro[];
  isExpanded: boolean;
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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedHodometro, setSelectedHodometro] = useState<Hodometro | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
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

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total KM</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Detalhes</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredTotals.map((total) => (
              <React.Fragment key={total.date}>
                {/* Daily Total Row */}
                <tr 
                  className="bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50"
                  onClick={() => toggleExpand(total.date)}
                >
                  <td className="px-6 py-4 whitespace-nowrap relative">
                    {/* Progress Bar */}
                    <div 
                      className="absolute left-0 top-0 h-full bg-blue-100 dark:bg-blue-900/20 transition-all duration-300"
                      style={{ width: `${(total.totalKm / maxDailyKm) * 100}%`, zIndex: 0 }}
                    />
                    <div className="relative z-10">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {total.date.split('-').reverse().join('/')}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap relative">
                    <div className="relative z-10">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {Math.round(total.totalKm).toLocaleString('pt-BR')} km
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap relative">
                    <div className="relative z-10">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {total.hodometros.length} leituras
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right relative">
                    <div className="relative z-10">
                      <button className="text-gray-500 dark:text-gray-400">
                        {total.isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </button>
                    </div>
                  </td>
                </tr>

                {/* Individual Entries */}
                {total.isExpanded && total.hodometros.map((hodometro) => (
                  <tr 
                    key={hodometro.id_hodometro}
                    className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg"
                    onClick={(e) => {
                      // Don't toggle selection when clicking on action buttons
                      if ((e.target as HTMLElement).closest('button')) return;
                      handleSelectItem(hodometro.id_hodometro);
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap pl-12 relative">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(hodometro.id_hodometro)}
                        onChange={() => handleSelectItem(hodometro.id_hodometro)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 absolute left-4 top-1/2 transform -translate-y-1/2"
                        onClick={(e) => e.stopPropagation()}
                      />
                      {/* Progress Bar */}
                      <div 
                        className="absolute left-0 top-0 h-full bg-blue-50 dark:bg-blue-900/10 transition-all duration-300"
                        style={{ width: `${((hodometro.hod_lido || 0) / maxIndividualKm) * 100}%`, zIndex: 0 }}
                      />
                      <div className="relative z-10">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {hodometro.hora}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap relative">
                      <div className="relative z-10">
                        {hodometro.bateria ? (
                          <div className="text-sm text-gray-900 dark:text-white">
                            Bateria: {hodometro.bateria}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-900 dark:text-white">
                            {hodometro.hod_lido?.toLocaleString('pt-BR')} km
                          </div>
                        )}
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Trip: {hodometro.trip_lida?.toLocaleString('pt-BR') || 'N/A'}
                        </div>
                        {hodometro.comparacao_leitura !== null && (
                          <div className={`text-xs px-2 py-1 rounded-full font-medium mt-1 inline-block ${
                            hodometro.comparacao_leitura
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                          }`}>
                            {hodometro.comparacao_leitura ? 'Leitura OK' : 'Leitura Divergente'}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 relative">
                      <div className="relative z-10">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {hodometro.motorista?.nome}
                          </div>
                          <div className="text-gray-500 dark:text-gray-400">
                            {hodometro.veiculo?.placa}
                          </div>
                          <div className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200 rounded-full inline-block mt-1">
                            Operação: {hodometro.cliente?.nome || 'Sem operação'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right relative">
                      <div className="relative z-10">
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
                      </div>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
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