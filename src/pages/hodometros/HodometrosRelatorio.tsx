import React, { useState, useEffect, useCallback } from 'react';
import { Search, Camera, X, Download, AlertCircle, Truck, ChevronUp, ChevronDown, BarChart2, Calendar, Clock, User, Edit, Loader2, Save } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import PeriodSelector from '../../components/hodometros/PeriodSelector';
import { useDateRange } from '../../hooks/useDateRange';
import { formatCPF } from '../../utils/format';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import MileageChartModal from '../../components/hodometros/MileageChartModal';
import * as XLSX from 'xlsx';

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
  cliente?: {
    cliente_id: number;
    nome: string;
  } | null;
}

const HodometrosRelatorio = () => {
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { periodType, dateRange, pendingDateRange, updatePeriod, setDateRange, applyPendingDateRange } = useDateRange('30days', true);
  const [readings, setReadings] = useState<HodometroReading[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<'all' | 'automovel' | 'ciclomotor'>('all');
  
  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedReading, setSelectedReading] = useState<HodometroReading | null>(null);
  const [editFormData, setEditFormData] = useState({
    data: '',
    hora: '',
    hod_informado: '',
    hod_lido: '',
    trip_lida: '',
    trip_informada: '',
    km_rodado: '',
    bateria: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchReadings = useCallback(async () => {
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
          hod_informado,
          hod_lido,
          km_rodado,
          bateria,
          foto_hodometro,
          trip_lida,
          trip_informada,
          comparacao_leitura,
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
          ),
          cliente:cliente_id (
            cliente_id,
            nome
          )
        `)
        .eq('company_id', companyId)
        .gte('data', dateRange.startDate)
        .lte('data', dateRange.endDate)
        .order('data', { ascending: false })
        .order('hora', { ascending: false });

      if (error) {
        console.error('Supabase query error details:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.log('No data returned from Supabase query');
        setReadings([]);
        setLoading(false);
        return;
      }

      // Format the readings
      const formattedReadings = data.map(reading => ({
        ...reading,
        veiculo: {
          ...reading.veiculo,
          placa: reading.veiculo?.placa?.toUpperCase() || ''
        }
      }));

      setReadings(formattedReadings);
    } catch (error) {
      console.error('Error fetching readings:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao carregar leituras';
      setError(errorMessage);
      toast.error('Erro ao carregar leituras: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  }, [dateRange, companyId]);

  useEffect(() => {
    // Only fetch when date range actually changes, not on pending changes
    if (!pendingDateRange) {
      fetchReadings();
    }
  }, [fetchReadings, pendingDateRange]);

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
    if (num === null || num === undefined || isNaN(num)) return '0';
    return num.toLocaleString('pt-BR');
  };

  const handleShowPhoto = (photo: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    if (photo) {
      setSelectedPhoto(photo);
      setShowPhotoModal(true);
    } else {
      toast.error('Nenhuma foto disponível');
    }
  };

  const handleEditReading = (reading: HodometroReading, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Set the selected reading and initialize form data
    setSelectedReading(reading);
    setEditFormData({
      data: reading.data,
      hora: reading.hora,
      hod_informado: reading.hod_informado?.toString() || '',
      hod_lido: reading.hod_lido?.toString() || '',
      trip_lida: reading.trip_lida?.toString() || '',
      trip_informada: reading.trip_informada || '',
      km_rodado: reading.km_rodado?.toString() || '',
      bateria: reading.bateria?.toString() || ''
    });
    
    // Open the edit modal
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedReading) return;
    
    try {
      setSubmitting(true);
      
      // Prepare the data for update
      const updateData: any = {
        data: editFormData.data,
        hora: editFormData.hora,
        km_rodado: editFormData.km_rodado ? parseFloat(editFormData.km_rodado) : null
      };
      
      // Add vehicle-specific fields based on type
      if (editFormData.bateria) {
        // Electric vehicle
        updateData.bateria = parseInt(editFormData.bateria);
        updateData.trip_lida = editFormData.trip_lida ? parseFloat(editFormData.trip_lida) : null;
        updateData.trip_informada = editFormData.trip_informada || null;
      } else {
        // Regular vehicle
        updateData.hod_informado = editFormData.hod_informado ? parseFloat(editFormData.hod_informado) : null;
        updateData.hod_lido = editFormData.hod_lido ? parseFloat(editFormData.hod_lido) : null;
      }
      
      // Update the record in the database
      const { error } = await supabase
        .from('hodometro')
        .update(updateData)
        .eq('id_hodometro', selectedReading.id_hodometro);
        
      if (error) throw error;
      
      // Update the local state
      setReadings(prevReadings => 
        prevReadings.map(reading => 
          reading.id_hodometro === selectedReading.id_hodometro
            ? { 
                ...reading, 
                ...updateData,
                // Ensure proper types for numeric fields
                hod_informado: updateData.hod_informado !== undefined ? updateData.hod_informado : reading.hod_informado,
                hod_lido: updateData.hod_lido !== undefined ? updateData.hod_lido : reading.hod_lido,
                trip_lida: updateData.trip_lida !== undefined ? updateData.trip_lida : reading.trip_lida,
                km_rodado: updateData.km_rodado !== undefined ? updateData.km_rodado : reading.km_rodado,
                bateria: updateData.bateria !== undefined ? updateData.bateria : reading.bateria
              }
            : reading
        )
      );
      
      toast.success('Leitura atualizada com sucesso');
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Error updating reading:', error);
      toast.error('Erro ao atualizar leitura');
    } finally {
      setSubmitting(false);
    }
  };

  const exportToExcel = () => {
    try {
      // Prepare data for export
      const exportData = readings.map(reading => ({
        'Data': formatDateBR(reading.data),
        'Hora': reading.hora,
        'Motorista': reading.motorista?.nome || 'Não informado',
        'CPF': reading.motorista?.cpf ? formatCPF(reading.motorista.cpf) : 'Não informado',
        'Veículo': reading.veiculo?.placa || 'Não informado',
        'Marca/Modelo': `${reading.veiculo?.marca || ''} ${reading.veiculo?.tipo || ''}`.trim() || 'Não informado',
        'Hodômetro Informado': reading.hod_informado !== null ? formatNumber(reading.hod_informado) : '-',
        'Hodômetro Lido': reading.hod_lido !== null ? formatNumber(reading.hod_lido) : '-',
        'Bateria': reading.bateria !== null ? `${reading.bateria}` : '-',
        'Trip Lida': reading.trip_lida !== null ? formatNumber(reading.trip_lida) : '-',
        'Trip Informada': reading.trip_informada || '-',
        'Tem Foto': reading.foto_hodometro ? 'Sim' : 'Não',
        'Cliente': reading.cliente?.nome || 'Sem cliente'
      }));

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Auto-size columns
      const colWidths = [
        { wch: 12 }, // Data
        { wch: 10 }, // Hora
        { wch: 25 }, // Motorista
        { wch: 15 }, // CPF
        { wch: 12 }, // Veículo
        { wch: 25 }, // Marca/Modelo
        { wch: 18 }, // Hodômetro Informado
        { wch: 15 }, // Hodômetro Lido
        { wch: 10 }, // Bateria
        { wch: 12 }, // Trip Lida
        { wch: 15 }, // Trip Informada
        { wch: 10 }, // Tem Foto
        { wch: 20 }  // Cliente
      ];
      
      ws['!cols'] = colWidths;
      
      XLSX.utils.book_append_sheet(wb, ws, 'Leituras');
      XLSX.writeFile(wb, `relatorio_leituras_hodometro_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast.success('Relatório exportado com sucesso');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Erro ao exportar para Excel');
    }
  };

  const filteredReadings = readings.filter(reading => {
    // Apply search filter
    const searchString = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      reading.motorista?.nome.toLowerCase().includes(searchString) ||
      reading.motorista?.cpf?.includes(searchString) ||
      reading.veiculo?.placa.toLowerCase().includes(searchString) ||
      reading.veiculo?.marca?.toLowerCase().includes(searchString) ||
      reading.veiculo?.tipo?.toLowerCase().includes(searchString);
    
    // Apply vehicle type filter
    const isElectric = reading.bateria !== null && reading.bateria !== undefined;
    const matchesVehicleType = 
      vehicleTypeFilter === 'all' || 
      (vehicleTypeFilter === 'ciclomotor' && isElectric) ||
      (vehicleTypeFilter === 'automovel' && !isElectric);
    
    return matchesSearch && matchesVehicleType;
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-[#1B2537] p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 text-red-500 mb-4">
          <AlertCircle size={24} />
          <h3 className="text-lg font-medium">Erro ao carregar dados</h3>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
        <button 
          onClick={fetchReadings}
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
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row items-center gap-4">
          {/* Search */}
          <div className="relative flex-grow w-full md:w-auto">
            <input
              type="text"
              placeholder="Buscar por motorista, placa ou marca..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 
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
              pendingDateRange={pendingDateRange}
              onPeriodChange={updatePeriod}
              onDateRangeChange={setDateRange}
              onApplyCustomRange={() => {
                if (applyPendingDateRange()) {
                  fetchReadings();
                }
              }}
            />
          </div>

          {/* Vehicle Type Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setVehicleTypeFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                vehicleTypeFilter === 'all'
                  ? 'bg-blue-600 text-white dark:bg-blue-400 dark:text-black'
                  : 'bg-gray-100 text-gray-700 dark:bg-[#334155] dark:text-gray-300'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setVehicleTypeFilter('automovel')}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                vehicleTypeFilter === 'automovel'
                  ? 'bg-blue-600 text-white dark:bg-blue-400 dark:text-black'
                  : 'bg-gray-100 text-gray-700 dark:bg-[#334155] dark:text-gray-300'
              }`}
            >
              Automóveis
            </button>
            <button
              onClick={() => setVehicleTypeFilter('ciclomotor')}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                vehicleTypeFilter === 'ciclomotor'
                  ? 'bg-blue-600 text-white dark:bg-blue-400 dark:text-black'
                  : 'bg-gray-100 text-gray-700 dark:bg-[#334155] dark:text-gray-300'
              }`}
            >
              Ciclomotores
            </button>
          </div>

          {/* Export Button */}
          <div className="relative group">
            <button
              onClick={exportToExcel}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                       transition-colors flex items-center justify-center"
              disabled={filteredReadings.length === 0}
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

      {/* Readings Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-white dark:bg-gray-800">
              <tr className="bg-gray-50 dark:bg-gray-800">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data/Hora</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Motorista</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Veículo</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hodômetro</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Trip</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Foto</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Editar</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredReadings.map((reading) => {
                const isElectric = reading.bateria !== null && reading.bateria !== undefined;
                
                return (
                  <tr key={reading.id_hodometro} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 text-gray-400 mr-1" />
                        <div className="text-sm text-gray-900 dark:text-white">
                          {formatDateBR(reading.data)}
                        </div>
                      </div>
                      <div className="flex items-center mt-1">
                        <Clock className="h-4 w-4 text-gray-400 mr-1" />
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {reading.hora}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="h-4 w-4 text-gray-400 mr-1" />
                        <div className="text-sm text-gray-900 dark:text-white">
                          {reading.motorista?.nome || 'Não informado'}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 ml-5">
                        {reading.motorista?.cpf ? formatCPF(reading.motorista.cpf) : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Truck className="h-4 w-4 text-gray-400 mr-1" />
                        <div className="text-sm text-gray-900 dark:text-white">
                          {reading.veiculo?.placa || 'Não informado'}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 ml-5">
                        {reading.veiculo?.marca} {reading.veiculo?.tipo}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {isElectric ? (
                        <div className="text-sm text-gray-900 dark:text-white">
                          Bateria: {reading.bateria}
                        </div>
                      ) : (
                        <>
                          <div className="text-sm text-gray-900 dark:text-white">
                            Lido: {formatNumber(reading.hod_lido)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Informado: {formatNumber(reading.hod_informado)}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {reading.trip_lida !== null ? (
                        <>
                          <div className="text-sm text-gray-900 dark:text-white">
                            Lida: {formatNumber(reading.trip_lida)}
                          </div>
                          {reading.trip_informada && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Informada: {reading.trip_informada}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-sm text-gray-500 dark:text-gray-400">-</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {reading.foto_hodometro ? (
                        <button
                          onClick={(e) => handleShowPhoto(reading.foto_hodometro, e)}
                          className="inline-flex items-center justify-center p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                          title="Ver foto do hodômetro"
                        >
                          <Camera size={16} />
                        </button>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600">
                          <Camera size={16} className="inline-block opacity-50" />
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={(e) => handleEditReading(reading, e)}
                        className="inline-flex items-center justify-center p-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 rounded-full hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
                        title="Editar leitura"
                      >
                        <Edit size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredReadings.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Nenhuma leitura encontrada para o período selecionado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Photo Modal */}
      {showPhotoModal && selectedPhoto && (
        <div 
          className="fixed inset-0 bg-transparent z-50 flex items-center justify-center p-4"
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

      {/* Edit Modal */}
      {isEditModalOpen && selectedReading && (
        <div 
          className="fixed inset-0 bg-transparent z-50 flex items-center justify-center p-4"
          onClick={() => setIsEditModalOpen(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-md border border-gray-200 dark:border-gray-700"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Editar Leitura de Hodômetro
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSaveEdit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Data
                  </label>
                  <input
                    type="date"
                    value={editFormData.data}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, data: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Hora
                  </label>
                  <input
                    type="time"
                    value={editFormData.hora}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, hora: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                
                {/* Vehicle Information */}
                <div className="md:col-span-2 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Truck className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Veículo: {selectedReading.veiculo?.placa} - {selectedReading.veiculo?.marca} {selectedReading.veiculo?.tipo}
                    </h4>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Motorista: {selectedReading.motorista?.nome}
                    </h4>
                  </div>
                </div>
                
                {/* Hodometer Fields - Show based on vehicle type */}
                {selectedReading.bateria !== null && selectedReading.bateria !== undefined ? (
                  <>
                    {/* Electric Vehicle Fields */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Bateria (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={editFormData.bateria}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, bateria: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Trip Lida
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={editFormData.trip_lida}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, trip_lida: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Trip Informada
                      </label>
                      <input
                        type="text"
                        value={editFormData.trip_informada}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, trip_informada: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Regular Vehicle Fields */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Hodômetro Informado
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={editFormData.hod_informado}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, hod_informado: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Hodômetro Lido
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={editFormData.hod_lido}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, hod_lido: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </>
                )}
                
                {/* Common Fields */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    KM Rodado
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={editFormData.km_rodado}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, km_rodado: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Salvar
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HodometrosRelatorio;