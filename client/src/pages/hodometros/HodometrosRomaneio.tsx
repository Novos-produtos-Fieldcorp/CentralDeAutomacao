import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Camera, X, Download, Calendar, User, Truck, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { useDateRange } from '../../hooks/useDateRange';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import Pagination from '../../components/Pagination';
import { usePagination } from '../../hooks/usePagination';
import * as XLSX from 'xlsx';

interface Romaneio {
  id: number;
  created_at: string;
  id_company: number | null;
  id_motorista: number | null;
  id_veiculo: number | null;
  foto_romaneio: string | null;
  motorista?: { motorista_id: number; nome: string; cpf: string } | null;
  veiculo?: { veiculo_id: number; placa: string; marca_veiculo: string } | null;
}

const HodometrosRomaneio: React.FC = () => {
  const { companyId } = useAuth();
  const { periodType, dateRange, pendingDateRange, updatePeriod, setDateRange } = useDateRange('30days', true);
  const [searchTerm, setSearchTerm] = useState('');
  const [romaneios, setRomaneios] = useState<Romaneio[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRomaneios, setLoadingRomaneios] = useState(false);
  const [errorRomaneios, setErrorRomaneios] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const periodDropdownRef = useRef<HTMLDivElement>(null);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  const fetchRomaneios = useCallback(async (overrideRange?: { startDate: string; endDate: string }) => {
    try {
      setLoadingRomaneios(true);
      setErrorRomaneios(null);
      const start = overrideRange?.startDate ?? dateRange.startDate;
      const end = overrideRange?.endDate ?? dateRange.endDate;

      if (!start || !end || !companyId) return;

      // Adjust end date to include the full day (23:59:59.999)
      const endDateFull = `${end}T23:59:59.999`;

      const { data, error } = await supabase.from('romaneio')
        .select(`
          id,
          created_at,
          id_company,
          id_motorista,
          id_veiculo,
          foto_romaneio,
          motorista:id_motorista ( motorista_id, nome, cpf ),
          veiculo:id_veiculo ( veiculo_id, placa, marca_veiculo )
        `)
        .eq('id_company', companyId)
        .gte('created_at', start)
        .lte('created_at', endDateFull)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[HodometrosRomaneio] fetchRomaneios supabase error', error);
        throw error;
      }

      if (!data || data.length === 0) {
        setRomaneios([]);
        return;
      }

      const formatted = (data || []).map((item: any) => ({
        ...item,
        motorista: Array.isArray(item.motorista) ? item.motorista[0] : item.motorista,
        veiculo: Array.isArray(item.veiculo) ? item.veiculo[0] : item.veiculo,
      })) as Romaneio[];

      setRomaneios(formatted);

    } catch (err: any) {
      console.error('Error fetching romaneios:', err);
      const msg = err?.message || String(err);
      if (msg.toLowerCase().includes('relation') && msg.toLowerCase().includes('romaneio') && msg.toLowerCase().includes('does not exist')) {
        const friendly = 'A tabela de Romaneio não está disponível neste banco de dados.';
        setErrorRomaneios(friendly);
        toast.error(friendly);
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao carregar romaneios';
        setErrorRomaneios(errorMessage);
        toast.error('Erro ao carregar romaneios: ' + errorMessage);
      }
    } finally {
      setLoadingRomaneios(false);
      setLoading(false);
    }
  }, [dateRange, companyId]);

  useEffect(() => {
    if (!pendingDateRange) fetchRomaneios();
  }, [fetchRomaneios, pendingDateRange]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target as Node)) {
        setShowPeriodDropdown(false);
      }
    };
    if (showPeriodDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPeriodDropdown]);

  const filteredRomaneios = romaneios.filter(r => {
    const s = searchTerm.toLowerCase();
    return (
      !searchTerm ||
      (r.motorista?.nome || '').toLowerCase().includes(s) ||
      (r.motorista?.cpf || '').includes(s) ||
      (r.veiculo?.placa || '').toLowerCase().includes(s) ||
      (r.veiculo?.marca_veiculo || '').toLowerCase().includes(s)
    );
  });

  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedData,
    handlePageChange,
    handlePageSizeChange
  } = usePagination({ data: filteredRomaneios, initialPageSize: 25 });

  const exportRomaneiosToExcel = () => {
    try {
      const exportData = romaneios.map(r => ({
        'Data': r.created_at ? new Date(r.created_at).toISOString().split('T')[0].split('-').reverse().join('/') : '-',
        'Hora': r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        'Motorista': r.motorista?.nome || 'Não informado',
        'CPF': r.motorista?.cpf || 'Não informado',
        'Veículo': r.veiculo?.placa || 'Não informado',
        'Marca/Modelo': r.veiculo?.marca_veiculo || 'Não informado',
        'Tem Foto': r.foto_romaneio ? 'Sim' : 'Não'
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 12 }, { wch: 8 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 25 }, { wch: 10 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Romaneios');
      XLSX.writeFile(wb, `relatorio_romaneios_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Relatório de Romaneios exportado com sucesso');
    } catch (err) {
      console.error('Error exporting romaneios to Excel:', err);
      toast.error('Erro ao exportar romaneios para Excel');
    }
  };

  const handleShowPhoto = (photo: string | null, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (photo) {
      setSelectedPhoto(photo);
      setShowPhotoModal(true);
    } else {
      toast.error('Nenhuma foto disponível');
    }
  };

  if (loading) return <LoadingSpinner />;

  if (errorRomaneios) return (
    <div className="bg-white dark:bg-[#1B2537] p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 text-red-500 mb-4">
        <AlertCircle size={24} />
        <h3 className="text-lg font-medium">Erro ao carregar Romaneios</h3>
      </div>
      <p className="text-gray-600 dark:text-gray-400 mb-4">{errorRomaneios}</p>
      <button onClick={() => fetchRomaneios()} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Tentar novamente</button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-center mb-6">
        <div className="relative flex-grow min-w-64">
          <input
            type="text"
            placeholder="Buscar por motorista, placa ou marca..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search-romaneios"
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#1B2537] text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
        </div>

        <div className="relative" ref={periodDropdownRef}>
          <button
            type="button"
            onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
            data-testid="button-period-filter"
            className="inline-flex items-center px-4 py-2.5 bg-white dark:bg-[#1B2537] text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Calendar className="h-5 w-5 mr-2" />
            {periodType === 'today' && 'Hoje'}
            {periodType === '7days' && 'Últimos 7 dias'}
            {periodType === '15days' && 'Últimos 15 dias'}
            {periodType === '30days' && 'Últimos 30 dias'}
            {periodType === 'custom' && 'Personalizado'}
          </button>

          {showPeriodDropdown && (
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#1B2537] rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
              <div className="p-2">
                <button onClick={() => { updatePeriod('today'); setShowPeriodDropdown(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-700 dark:text-gray-300">Hoje</button>
                <button onClick={() => { updatePeriod('7days'); setShowPeriodDropdown(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-700 dark:text-gray-300">Últimos 7 dias</button>
                <button onClick={() => { updatePeriod('15days'); setShowPeriodDropdown(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-700 dark:text-gray-300">Últimos 15 dias</button>
                <button onClick={() => { updatePeriod('30days'); setShowPeriodDropdown(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-700 dark:text-gray-300">Últimos 30 dias</button>
                
                <div className="border-t border-gray-200 dark:border-gray-600 my-2"></div>
                
                <div className="px-3 py-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Inicial</label>
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                    data-testid="input-start-date"
                    className="w-full px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-md"
                  />
                </div>
                
                <div className="px-3 py-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data Final</label>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                    data-testid="input-end-date"
                    className="w-full px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-md"
                  />
                </div>
                
                <div className="px-3 py-2">
                  <button
                    onClick={() => { updatePeriod('custom'); setShowPeriodDropdown(false); }}
                    data-testid="button-apply-custom-dates"
                    className="w-full px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={exportRomaneiosToExcel}
          data-testid="button-export-romaneios"
          className="inline-flex items-center px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Download className="h-5 w-5 mr-2" />
          Exportar
        </button>
      </div>

      <div className="bg-white dark:bg-[#1B2537] rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data/Hora</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Motorista</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Veículo</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Foto</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-[#1B2537] divide-y divide-gray-200 dark:divide-gray-700">
              {loadingRomaneios ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center">
                    <LoadingSpinner />
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    Nenhum romaneio encontrado
                  </td>
                </tr>
              ) : (
                paginatedData.map((romaneio) => (
                  <tr key={romaneio.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" data-testid={`row-romaneio-${romaneio.id}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {romaneio.created_at ? new Date(romaneio.created_at).toLocaleDateString('pt-BR') : '-'}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {romaneio.created_at ? new Date(romaneio.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {romaneio.motorista?.nome || 'Não informado'}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {romaneio.motorista?.cpf || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {romaneio.veiculo?.placa || 'Não informado'}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {romaneio.veiculo?.marca_veiculo || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {romaneio.foto_romaneio ? (
                        <button
                          onClick={(e) => handleShowPhoto(romaneio.foto_romaneio, e)}
                          data-testid={`button-view-photo-${romaneio.id}`}
                          className="inline-flex items-center px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                        >
                          <Camera className="h-4 w-4 mr-1" />
                          Ver Foto
                        </button>
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-gray-500">Sem foto</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>

      {showPhotoModal && selectedPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={() => setShowPhotoModal(false)}>
          <div className="relative max-w-4xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowPhotoModal(false)}
              data-testid="button-close-photo-modal"
              className="absolute top-4 right-4 p-2 bg-gray-900 bg-opacity-50 hover:bg-opacity-75 text-white rounded-full transition-colors z-10"
            >
              <X className="h-6 w-6" />
            </button>
            <div className="p-4">
              <img
                src={selectedPhoto}
                alt="Foto do romaneio"
                className="max-w-full max-h-[80vh] object-contain mx-auto"
                data-testid="img-romaneio-photo"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HodometrosRomaneio;
