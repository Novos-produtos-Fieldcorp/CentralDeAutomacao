import React, { useState, useEffect, useCallback } from 'react';
import { Search, Eye, Camera, X, Download, FileText, AlertCircle } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import PeriodSelector from '../../components/hodometros/PeriodSelector';
import { useDateRange } from '../../hooks/useDateRange';
import { formatCPF } from '../../utils/format';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import * as XLSX from 'xlsx';

interface HodometroReading {
  id_hodometro: number;
  data: string;
  hora: string;
  hod_lido: number | null;
  hod_informado: number | null;
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

const HodometrosRelatorio = () => {
  const { query } = useCompanyData();
  const { companyId } = useAuth();
  const [hodometros, setHodometros] = useState<HodometroReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('1day');

  const fetchHodometros = useCallback(async () => {
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
        .order('data', { ascending: false })
        .order('hora', { ascending: false });

      if (error) throw error;

      setHodometros(data || []);
    } catch (error) {
      console.error('Error fetching hodometros:', error);
      toast.error('Erro ao carregar leituras de hodômetro');
    } finally {
      setLoading(false);
    }
  }, [dateRange, companyId]);

  useEffect(() => {
    fetchHodometros();
  }, [fetchHodometros]);

  const handleShowPhoto = (photo: string | null) => {
    if (photo) {
      setSelectedPhoto(photo);
      setShowPhotoModal(true);
    } else {
      toast.error('Nenhuma foto disponível');
    }
  };

  // Format date from YYYY-MM-DD to DD/MM/YYYY
  const formatDateBR = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const exportToExcel = () => {
    try {
      const exportData = filteredHodometros.map(h => ({
        'Data': formatDateBR(h.data),
        'Hora': h.hora,
        'Motorista': h.motorista?.nome || '',
        'CPF': h.motorista?.cpf ? formatCPF(h.motorista.cpf) : '',
        'Placa': h.veiculo?.placa.toUpperCase() || '',
        'Veículo': `${h.veiculo?.marca || ''} ${h.veiculo?.tipo || ''}`,
        'Hodômetro Informado': h.hod_informado?.toLocaleString('pt-BR') || '',
        'Hodômetro Lido': h.bateria !== null ? `Bateria: ${h.bateria}` : h.hod_lido?.toLocaleString('pt-BR'),
        'Trip Informada': h.trip_informada || '',
        'Trip Lida': h.trip_lida?.toLocaleString('pt-BR') || '',
        'Leitura Divergente': h.comparacao_leitura === false ? 'Sim' : 'Não'
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Hodometros');
      
      // Auto-size columns
      const colWidths = [
        { wch: 12 }, // Data
        { wch: 8 },  // Hora
        { wch: 25 }, // Motorista
        { wch: 15 }, // CPF
        { wch: 10 }, // Placa
        { wch: 20 }, // Veículo
        { wch: 18 }, // Hodômetro Informado
        { wch: 15 }, // Hodômetro Lido
        { wch: 15 }, // Trip Informada
        { wch: 12 },  // Trip Lida
        { wch: 15 }  // Leitura Divergente
      ];
      ws['!cols'] = colWidths;
      
      XLSX.writeFile(wb, `relatorio_hodometros_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Relatório exportado com sucesso');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Erro ao exportar para Excel');
    }
  };

  // Check if there's a discrepancy between reported and read values
  const hasDiscrepancy = (hodometro: HodometroReading): boolean => {
    // If comparacao_leitura is explicitly false, there's a discrepancy
    if (hodometro.comparacao_leitura === false) return true;
    
    // For electric vehicles (with battery), we can't compare hodometer values
    if (hodometro.bateria !== null && hodometro.bateria !== undefined) return false;
    
    // For regular vehicles, check if values are different
    if (hodometro.hod_informado !== null && hodometro.hod_lido !== null) {
      // Allow a small tolerance (e.g., 1% difference)
      const tolerance = hodometro.hod_informado * 0.01;
      return Math.abs(hodometro.hod_informado - hodometro.hod_lido) > tolerance;
    }
    
    return false;
  };

  const filteredHodometros = hodometros.filter(hodometro => {
    const searchString = searchTerm.toLowerCase();
    return (
      !searchTerm ||
      (hodometro.motorista?.nome && hodometro.motorista.nome.toLowerCase().includes(searchString)) ||
      (hodometro.motorista?.cpf && hodometro.motorista.cpf.includes(searchString)) ||
      (hodometro.veiculo?.placa && hodometro.veiculo.placa.toLowerCase().includes(searchString)) ||
      (hodometro.veiculo?.marca && hodometro.veiculo.marca.toLowerCase().includes(searchString)) ||
      (hodometro.veiculo?.tipo && hodometro.veiculo.tipo.toLowerCase().includes(searchString))
    );
  });

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
          <div className="flex justify-end">
            <button
              onClick={exportToExcel}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                       transition-colors flex items-center gap-2"
              disabled={filteredHodometros.length === 0}
            >
              <Download className="w-5 h-5" />
              Exportar Excel
            </button>
          </div>
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

      {/* Readings Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Motorista</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Placa</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data/Hora</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hodômetro Informado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hodômetro Lido</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Trip</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Foto</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredHodometros.map((hodometro) => (
                <tr key={hodometro.id_hodometro} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-medium">
                        {hodometro.motorista?.nome?.charAt(0) || '?'}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {hodometro.motorista?.nome || 'Não informado'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {hodometro.motorista?.cpf ? formatCPF(hodometro.motorista.cpf) : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-blue-600 dark:text-blue-400 uppercase">
                      {hodometro.veiculo?.placa || 'Não informada'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {hodometro.veiculo?.marca} {hodometro.veiculo?.tipo}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {formatDateBR(hodometro.data)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {hodometro.hora}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {hodometro.bateria !== null && hodometro.bateria !== undefined ? (
                        <span>-</span>
                      ) : (
                        <span>{hodometro.hod_informado !== null ? hodometro.hod_informado.toLocaleString('pt-BR') : '-'}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {hodometro.bateria !== null && hodometro.bateria !== undefined ? (
                        <div className="text-sm text-gray-900 dark:text-white">
                          Bateria: {hodometro.bateria}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-900 dark:text-white">
                          {hodometro.hod_lido !== null ? hodometro.hod_lido.toLocaleString('pt-BR') : '-'}
                        </div>
                      )}
                      
                      {/* Discrepancy tag */}
                      {hasDiscrepancy(hodometro) && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Divergente
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {hodometro.trip_informada && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          Informada: {hodometro.trip_informada}
                        </div>
                      )}
                      {hodometro.trip_lida !== null ? (
                        <div className="text-sm text-gray-900 dark:text-white">
                          Lida: {hodometro.trip_lida.toLocaleString('pt-BR')}
                        </div>
                      ) : (
                        <span>-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {hodometro.foto_hodometro ? (
                      <button
                        onClick={() => handleShowPhoto(hodometro.foto_hodometro)}
                        className="inline-flex items-center justify-center p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                        title="Ver foto do hodômetro"
                      >
                        <Camera size={18} />
                      </button>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-600">
                        <Camera size={18} className="inline-block opacity-50" />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredHodometros.length === 0 && (
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

export default HodometrosRelatorio;