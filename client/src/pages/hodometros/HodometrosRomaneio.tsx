import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Camera, X, Download, Calendar, Clock, User, Truck, AlertCircle, ChevronDown, FilePen } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { useDateRange } from '../../hooks/useDateRange';
import { formatCPF } from '../../utils/format';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import Pagination from '../../components/Pagination';
import { usePagination } from '../../hooks/usePagination';
import * as XLSX from 'xlsx';
import type { Romaneio as RomaneioType } from '@shared/schema';

interface RomaneioWithRelations extends RomaneioType {
  motorista?: { motorista_id: number; nome: string; cpf: string } | null;
  veiculo?: { veiculo_id: number; placa: string; marca: string } | null;
}

const HodometrosRomaneio: React.FC = () => {
  const { companyId } = useAuth();
  const { periodType, dateRange, pendingDateRange, updatePeriod, setDateRange } = useDateRange('30days', true);
  const [searchTerm, setSearchTerm] = useState('');
  const [romaneios, setRomaneios] = useState<RomaneioWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRomaneios, setLoadingRomaneios] = useState(false);
  const [errorRomaneios, setErrorRomaneios] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const periodDropdownRef = useRef<HTMLDivElement>(null);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRomaneio, setSelectedRomaneio] = useState<RomaneioWithRelations | null>(null);
  const [editFormData, setEditFormData] = useState({
    motorista_id: null as number | null,
    veiculo_id: null as number | null,
    foto_romaneio: null as string | null
  });
  const [isSaving, setIsSaving] = useState(false);
  const [motoristas, setMotoristas] = useState<Array<{ motorista_id: number; nome: string }>>([]);
  const [veiculos, setVeiculos] = useState<Array<{ veiculo_id: number; placa: string }>>([]);
  const [loadingMotoristas, setLoadingMotoristas] = useState(false);
  const [loadingVeiculos, setLoadingVeiculos] = useState(false);

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
          veiculo:id_veiculo ( veiculo_id, placa, marca )
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
      })) as RomaneioWithRelations[];

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
      (r.veiculo?.marca || '').toLowerCase().includes(s)
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
        'Marca/Modelo': r.veiculo?.marca || 'Não informado',
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

  const handleOpenEditModal = async (romaneio: RomaneioWithRelations) => {
    setSelectedRomaneio(romaneio);
    setEditFormData({
      motorista_id: romaneio.id_motorista || null,
      veiculo_id: romaneio.id_veiculo || null,
      foto_romaneio: romaneio.foto_romaneio || null
    });
    setShowEditModal(true);
    
    // Fetch motoristas e veículos
    await Promise.all([fetchMotoristas(), fetchVeiculos()]);
  };

  const fetchMotoristas = async () => {
    try {
      setLoadingMotoristas(true);
      const { data, error } = await supabase
        .from('motorista')
        .select('motorista_id, nome')
        .eq('company_id', companyId)
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      setMotoristas(data || []);
    } catch (err) {
      console.error('Error fetching motoristas:', err);
      toast.error('Erro ao carregar motoristas');
    } finally {
      setLoadingMotoristas(false);
    }
  };

  const fetchVeiculos = async () => {
    try {
      setLoadingVeiculos(true);
      const { data, error } = await supabase
        .from('veiculo')
        .select('veiculo_id, placa')
        .eq('company_id', companyId)
        .eq('status_veiculo', true)
        .order('placa');
      
      if (error) throw error;
      setVeiculos(data || []);
    } catch (err) {
      console.error('Error fetching veiculos:', err);
      toast.error('Erro ao carregar veículos');
    } finally {
      setLoadingVeiculos(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditFormData(prev => ({
          ...prev,
          foto_romaneio: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setEditFormData(prev => ({
      ...prev,
      foto_romaneio: null
    }));
  };

  const handleSaveRomaneio = async () => {
    if (!selectedRomaneio) return;

    try {
      setIsSaving(true);

      const { error } = await supabase
        .from('romaneio')
        .update({
          id_motorista: editFormData.motorista_id,
          id_veiculo: editFormData.veiculo_id,
          foto_romaneio: editFormData.foto_romaneio
        })
        .eq('id', selectedRomaneio.id);

      if (error) throw error;

      toast.success('Romaneio atualizado com sucesso!');
      setShowEditModal(false);
      fetchRomaneios();
    } catch (err) {
      console.error('Error updating romaneio:', err);
      toast.error('Erro ao atualizar romaneio');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div data-testid="status-loading-page"><LoadingSpinner /></div>;

  if (errorRomaneios) return (
    <div className="bg-white dark:bg-[#1B2537] p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 text-red-500 mb-4">
        <AlertCircle size={24} />
        <h3 className="text-lg font-medium" data-testid="text-error-title">Erro ao carregar Romaneios</h3>
      </div>
      <p className="text-gray-600 dark:text-gray-400 mb-4" data-testid="text-error-message">{errorRomaneios}</p>
      <button onClick={() => fetchRomaneios()} data-testid="button-retry" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Tentar novamente</button>
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
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 
                     dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 
                     focus:border-blue-500 text-gray-900 dark:text-gray-100"
            data-testid="input-search-romaneios"
          />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>

        <div className="relative z-[40]" ref={periodDropdownRef}>
          <button
            type="button"
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9"
            onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
            data-testid="button-period-filter"
          >
            <Calendar className="h-4 w-4" />
            <span>
              {periodType === 'all' ? 'Período' : 
               periodType === '1day' ? 'Hoje' :
               periodType === '15days' ? '15 dias' :
               periodType === '30days' ? '30 dias' :
               periodType === 'custom' ? 'Personalizado' : 'Período'}
            </span>
            <ChevronDown className="h-4 w-4" />
          </button>

          {showPeriodDropdown && (
            <div 
              className="bg-white dark:bg-gray-700 shadow-xl rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto w-64 animate-in slide-in-from-top-2 fade-in duration-200"
              style={{ 
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                zIndex: 999999
              }}
            >
              <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                <span className="text-xs text-gray-500 dark:text-gray-400">Selecionar período</span>
              </div>
              {[
                { value: 'all', label: 'Todos os períodos' },
                { value: '1day', label: 'Hoje' },
                { value: '15days', label: 'Últimos 15 dias' },
                { value: '30days', label: 'Últimos 30 dias' },
                { value: 'custom', label: 'Período personalizado' }
              ].map(({ value, label }) => (
                <div key={value} className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                  <button
                    type="button"
                    className="w-full text-left text-sm text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"
                    onClick={() => {
                      updatePeriod(value as any);
                      setShowPeriodDropdown(false);
                    }}
                    data-testid={`button-period-${value}`}
                  >
                    {label}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative group">
            <button
              onClick={exportRomaneiosToExcel}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                       transition-colors flex items-center justify-center"
              disabled={filteredRomaneios.length === 0}
              aria-label="Exportar Excel"
              data-testid="button-export-romaneios"
            >
              <Download className="w-5 h-5" />
            </button>
            <div className="opacity-0 group-hover:opacity-100 absolute right-0 top-full mt-1 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap">
              Exportar Excel
            </div>
          </div>
        </div>
      </div>

      {/* Custom Date Range */}
      {periodType === 'custom' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Data inicial
            </label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              data-testid="input-start-date"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Data final
            </label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              data-testid="input-end-date"
            />
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-white dark:bg-gray-800">
              <tr className="bg-gray-50 dark:bg-gray-800">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Data/Hora</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Motorista</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Veículo</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Foto</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Editar</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loadingRomaneios ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center" data-testid="status-loading">
                    <LoadingSpinner />
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400" data-testid="text-empty-state">
                    Nenhum romaneio encontrado
                  </td>
                </tr>
              ) : (
                paginatedData.map((romaneio) => {
                  const created = romaneio.created_at ? new Date(romaneio.created_at) : null;
                  const dateStr = created ? `${String(created.getDate()).padStart(2,'0')}/${String(created.getMonth()+1).padStart(2,'0')}/${created.getFullYear()}` : '-';
                  const timeStr = created ? `${String(created.getHours()).padStart(2,'0')}:${String(created.getMinutes()).padStart(2,'0')}` : '-';

                  return (
                    <tr key={romaneio.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50" data-testid={`row-romaneio-${romaneio.id}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 text-gray-400 mr-1" />
                          <div className="text-sm text-gray-900 dark:text-white" data-testid={`text-date-${romaneio.id}`}>{dateStr}</div>
                        </div>
                        <div className="flex items-center mt-1">
                          <Clock className="h-4 w-4 text-gray-400 mr-1" />
                          <div className="text-xs text-gray-500 dark:text-gray-400" data-testid={`text-time-${romaneio.id}`}>{timeStr}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <User className="h-4 w-4 text-gray-400 mr-1" />
                          <div className="text-sm text-gray-900 dark:text-white" data-testid={`text-motorista-${romaneio.id}`}>
                            {romaneio.motorista?.nome || 'Não informado'}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 ml-5" data-testid={`text-cpf-${romaneio.id}`}>
                          {romaneio.motorista?.cpf ? formatCPF(romaneio.motorista.cpf) : ''}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Truck className="h-4 w-4 text-gray-400 mr-1" />
                          <div className="text-sm text-gray-900 dark:text-white" data-testid={`text-placa-${romaneio.id}`}>
                            {romaneio.veiculo?.placa || 'Não informado'}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 ml-5" data-testid={`text-marca-${romaneio.id}`}>
                          {romaneio.veiculo?.marca || ''}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {romaneio.foto_romaneio ? (
                          <button
                            onClick={() => { setSelectedPhoto(romaneio.foto_romaneio); setShowPhotoModal(true); }}
                            className="inline-flex items-center justify-center p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                            title="Ver foto do romaneio"
                            data-testid={`button-view-photo-${romaneio.id}`}
                          >
                            <Camera size={16} />
                          </button>
                        ) : (
                          <span className="inline-flex items-center justify-center p-2 text-gray-400 dark:text-gray-600 opacity-50">
                            <Camera size={16} />
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleOpenEditModal(romaneio)}
                          className="inline-flex items-center justify-center p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                          title="Editar romaneio"
                          data-testid={`button-edit-romaneio-${romaneio.id}`}
                        >
                          <FilePen size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filteredRomaneios.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      {/* Photo Modal */}
      {showPhotoModal && selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setShowPhotoModal(false)}
          data-testid="overlay-photo-modal"
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-md border border-gray-200 dark:border-gray-700"
            onClick={e => e.stopPropagation()}
            data-testid="container-photo-modal"
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Foto do Romaneio</h3>
              <button
                onClick={() => setShowPhotoModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                data-testid="button-close-photo-modal"
              >
                <X size={24} />
              </button>
            </div>
            <div className="relative aspect-video">
              <img
                src={selectedPhoto}
                alt="Foto do Romaneio"
                className="absolute inset-0 w-full h-full object-contain"
                data-testid="img-romaneio-photo"
              />
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <a
                href={selectedPhoto}
                download="romaneio.jpg"
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
      {showEditModal && selectedRomaneio && (
        <div 
          className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setShowEditModal(false)}
          data-testid="overlay-edit-modal"
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-md border border-gray-200 dark:border-gray-700"
            onClick={e => e.stopPropagation()}
            data-testid="container-edit-modal"
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Editar Romaneio</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                data-testid="button-close-edit-modal"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Motorista e Veículo Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Motorista
                  </label>
                  <select
                    value={editFormData.motorista_id || ''}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, motorista_id: e.target.value ? Number(e.target.value) : null }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    data-testid="select-motorista"
                    disabled={loadingMotoristas}
                  >
                    <option value="">Selecione um motorista</option>
                    {motoristas.map((m) => (
                      <option key={m.motorista_id} value={m.motorista_id}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Veículo
                  </label>
                  <select
                    value={editFormData.veiculo_id || ''}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, veiculo_id: e.target.value ? Number(e.target.value) : null }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    data-testid="select-veiculo"
                    disabled={loadingVeiculos}
                  >
                    <option value="">Selecione um veículo</option>
                    {veiculos.map((v) => (
                      <option key={v.veiculo_id} value={v.veiculo_id}>
                        {v.placa}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Foto do Romaneio Section */}
              <div className="border border-gray-300 dark:border-gray-600 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Foto do Romaneio
                </h4>

                {editFormData.foto_romaneio ? (
                  <div className="space-y-3">
                    <div className="relative w-full h-48 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                      <img 
                        src={editFormData.foto_romaneio} 
                        alt="Preview da foto" 
                        className="w-full h-full object-contain"
                        data-testid="img-preview-photo"
                      />
                    </div>
                    <div className="flex gap-2">
                      <label className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer text-center">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="hidden"
                          data-testid="input-replace-photo"
                        />
                        Substituir Foto
                      </label>
                      <button
                        onClick={handleRemovePhoto}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        data-testid="button-remove-photo"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="block w-full px-4 py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer text-center">
                    <Camera className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Clique para adicionar foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      data-testid="input-upload-photo"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-gray-800">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                data-testid="button-cancel-edit"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveRomaneio}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="button-save-romaneio"
              >
                {isSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HodometrosRomaneio;
