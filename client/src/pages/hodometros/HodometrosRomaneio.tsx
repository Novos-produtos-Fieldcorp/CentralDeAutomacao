import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Camera, X, Download, Calendar, Clock, User, Truck, AlertCircle, ChevronDown, FilePen, Building2 } from 'lucide-react';
import { useCurrentAccount } from '../../hooks/useCurrentAccount';
import toast from 'react-hot-toast';
import { useDateRange } from '../../hooks/useDateRange';
import { formatCPF } from '../../utils/format';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import Pagination from '../../components/Pagination';
import { usePagination } from '../../hooks/usePagination';
import * as XLSX from 'xlsx';

interface RomaneioWithRelations {
  id: number;
  created_at: string;
  id_company: number | null;
  id_motorista: number | null;
  id_veiculo: number | null;
  foto_romaneio: string | null;
  filial_id: number | null;
  motorista?: { motorista_id: number; nome: string; cpf: string } | null;
  veiculo?: { veiculo_id: number; placa: string; marca: string } | null;
  filial?: { id: number; filial: string } | null;
}

const HodometrosRomaneio: React.FC = () => {
  const { companyId } = useCurrentAccount();
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

  // Filial filter (list)
  const [filialFilter, setFilialFilter] = useState<string>('all');
  const [showFilialDropdown, setShowFilialDropdown] = useState(false);
  const [filialSearch, setFilialSearch] = useState('');
  const filialDropdownRef = useRef<HTMLDivElement>(null);

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRomaneio, setSelectedRomaneio] = useState<RomaneioWithRelations | null>(null);
  const [editFormData, setEditFormData] = useState({
    motorista_id: null as number | null,
    veiculo_id: null as number | null,
    filial_id: null as number | null,
    foto_romaneio: null as string | null,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [motoristas, setMotoristas] = useState<Array<{ motorista_id: number; nome: string }>>([]);
  const [veiculos, setVeiculos] = useState<Array<{ veiculo_id: number; placa: string }>>([]);
  const [filiais, setFiliais] = useState<Array<{ id: number; filial: string }>>([]);
  const [loadingMotoristas, setLoadingMotoristas] = useState(false);
  const [loadingVeiculos, setLoadingVeiculos] = useState(false);
  const [loadingFiliais, setLoadingFiliais] = useState(false);
  const [showMotoristaDropdown, setShowMotoristaDropdown] = useState(false);
  const [showVeiculoDropdown, setShowVeiculoDropdown] = useState(false);
  const [showFilialEditDropdown, setShowFilialEditDropdown] = useState(false);
  const [motoristaSearch, setMotoristaSearch] = useState('');
  const [veiculoSearch, setVeiculoSearch] = useState('');
  const [filialEditSearch, setFilialEditSearch] = useState('');
  const motoristaDropdownRef = useRef<HTMLDivElement>(null);
  const veiculoDropdownRef = useRef<HTMLDivElement>(null);
  const filialEditDropdownRef = useRef<HTMLDivElement>(null);

  const fetchRomaneios = useCallback(async (overrideRange?: { startDate: string; endDate: string }) => {
    try {
      setLoadingRomaneios(true);
      setErrorRomaneios(null);
      const start = overrideRange?.startDate ?? dateRange.startDate;
      const end = overrideRange?.endDate ?? dateRange.endDate;

      if (!start || !end || !companyId) return;

      const endDateFull = `${end}T23:59:59.999`;

      const { data, error } = await supabase.from('romaneio')
        .select(`
          id,
          created_at,
          id_company,
          id_motorista,
          id_veiculo,
          foto_romaneio,
          filial_id,
          motorista:id_motorista ( motorista_id, nome, cpf ),
          veiculo:id_veiculo ( veiculo_id, placa, marca ),
          filial:filial_id ( id, filial )
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
        filial: Array.isArray(item.filial) ? item.filial[0] : item.filial,
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

  // Click-outside: period dropdown
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

  // Click-outside: filial filter dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filialDropdownRef.current && !filialDropdownRef.current.contains(event.target as Node)) {
        setShowFilialDropdown(false);
      }
    };
    if (showFilialDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showFilialDropdown]);

  // Click-outside: edit modal dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (motoristaDropdownRef.current && !motoristaDropdownRef.current.contains(event.target as Node)) {
        setShowMotoristaDropdown(false);
      }
      if (veiculoDropdownRef.current && !veiculoDropdownRef.current.contains(event.target as Node)) {
        setShowVeiculoDropdown(false);
      }
      if (filialEditDropdownRef.current && !filialEditDropdownRef.current.contains(event.target as Node)) {
        setShowFilialEditDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const uniqueFiliais = React.useMemo(() => {
    const map = new Map<string, string>();
    let hasNoFilial = false;
    romaneios.forEach(r => {
      const name = r.filial?.filial?.trim();
      if (name) {
        map.set(name, name);
      } else {
        hasNoFilial = true;
      }
    });
    const sorted = Array.from(map.keys()).sort();
    return { filiais: sorted, hasNoFilial };
  }, [romaneios]);

  const filteredRomaneios = romaneios.filter(r => {
    if (filialFilter !== 'all') {
      if (filialFilter === '__no_filial__') {
        if (r.filial?.filial?.trim()) return false;
      } else {
        if ((r.filial?.filial?.trim() || '') !== filialFilter) return false;
      }
    }

    const s = searchTerm.toLowerCase();
    return (
      !searchTerm ||
      (r.motorista?.nome || '').toLowerCase().includes(s) ||
      (r.motorista?.cpf || '').includes(s) ||
      (r.veiculo?.placa || '').toLowerCase().includes(s) ||
      (r.veiculo?.marca || '').toLowerCase().includes(s) ||
      (r.filial?.filial || '').toLowerCase().includes(s)
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
        'Filial': r.filial?.filial || '-',
        'Tem Foto': r.foto_romaneio ? 'Sim' : 'Não'
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 12 }, { wch: 8 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 25 }, { wch: 25 }, { wch: 10 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Romaneios');
      XLSX.writeFile(wb, `relatorio_romaneios_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Relatório de Romaneios exportado com sucesso');
    } catch (err) {
      console.error('Error exporting romaneios to Excel:', err);
      toast.error('Erro ao exportar romaneios para Excel');
    }
  };

  const handleOpenEditModal = async (romaneio: RomaneioWithRelations) => {
    setSelectedRomaneio(romaneio);
    setEditFormData({
      motorista_id: romaneio.id_motorista || null,
      veiculo_id: romaneio.id_veiculo || null,
      filial_id: romaneio.filial_id || null,
      foto_romaneio: romaneio.foto_romaneio || null,
    });
    setShowEditModal(true);

    await Promise.all([fetchMotoristas(), fetchVeiculos(romaneio.id_veiculo || null), fetchFiliais()]);
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

  const fetchVeiculos = async (currentVeiculoId?: number | null) => {
    try {
      setLoadingVeiculos(true);
      const { data, error } = await supabase
        .from('veiculo')
        .select('veiculo_id, placa')
        .eq('company_id', companyId)
        .eq('status_veiculo', true)
        .order('placa');

      if (error) throw error;

      let result = data || [];

      if (currentVeiculoId && !result.find(v => v.veiculo_id === currentVeiculoId)) {
        const { data: current } = await supabase
          .from('veiculo')
          .select('veiculo_id, placa')
          .eq('veiculo_id', currentVeiculoId)
          .single();
        if (current) result = [current, ...result];
      }

      setVeiculos(result);
    } catch (err) {
      console.error('Error fetching veiculos:', err);
      toast.error('Erro ao carregar veículos');
    } finally {
      setLoadingVeiculos(false);
    }
  };

  const fetchFiliais = async () => {
    try {
      setLoadingFiliais(true);
      const { data, error } = await supabase
        .from('filial')
        .select('id, filial')
        .eq('company_id', companyId)
        .order('filial');
      if (error) throw error;
      setFiliais(data || []);
    } catch (err) {
      console.error('Error fetching filiais:', err);
      toast.error('Erro ao carregar filiais');
    } finally {
      setLoadingFiliais(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditFormData(prev => ({ ...prev, foto_romaneio: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setEditFormData(prev => ({ ...prev, foto_romaneio: null }));
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
          filial_id: editFormData.filial_id,
          foto_romaneio: editFormData.foto_romaneio,
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
            placeholder="Buscar por motorista, placa ou filial..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200
                     dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500
                     focus:border-blue-500 text-gray-900 dark:text-gray-100"
            data-testid="input-search-romaneios"
          />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>

        {/* Filial filter */}
        <div className="relative z-[40]" ref={filialDropdownRef}>
          <button
            type="button"
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9"
            onClick={() => { setFilialSearch(''); setShowFilialDropdown(!showFilialDropdown); }}
            data-testid="select-filial-filter"
          >
            <Building2 className="h-4 w-4" />
            <span>
              {filialFilter === 'all' ? 'Filiais' :
               filialFilter === '__no_filial__' ? 'Sem filial' :
               filialFilter}
            </span>
            <ChevronDown className="h-4 w-4" />
          </button>

          {showFilialDropdown && (
            <div
              className="bg-white dark:bg-gray-700 shadow-xl rounded-md border border-gray-200 dark:border-gray-600 w-52 animate-in slide-in-from-top-2 fade-in duration-200"
              style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', zIndex: 999999 }}
            >
              <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-600">
                <div className="relative">
                  <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar filial..."
                    value={filialSearch}
                    onChange={(e) => setFilialSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="max-h-52 overflow-y-auto py-1">
                {[
                  { value: 'all', label: 'Todas as filiais' },
                  ...uniqueFiliais.filiais.map(f => ({ value: f, label: f })),
                  ...(uniqueFiliais.hasNoFilial ? [{ value: '__no_filial__', label: 'Sem filial' }] : [])
                ]
                  .filter(({ label }) => label.toLowerCase().includes(filialSearch.toLowerCase()))
                  .map(({ value, label }) => (
                    <div key={value} className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                      <button
                        type="button"
                        className={`w-full text-left text-sm ${filialFilter === value ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white'}`}
                        onClick={() => { setFilialFilter(value); setShowFilialDropdown(false); }}
                      >
                        {label}
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Period filter */}
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
              style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', zIndex: 999999 }}
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
                    onClick={() => { updatePeriod(value as any); setShowPeriodDropdown(false); }}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Filial</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Foto</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Editar</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loadingRomaneios ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center" data-testid="status-loading">
                    <LoadingSpinner />
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400" data-testid="text-empty-state">
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Building2 className="h-4 w-4 text-gray-400 mr-1" />
                          <div className="text-sm text-gray-900 dark:text-white" data-testid={`text-filial-${romaneio.id}`}>
                            {romaneio.filial?.filial || 'Não informado'}
                          </div>
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
        <div className="fixed inset-0 z-50 overflow-y-auto" data-testid="overlay-photo-modal">
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70" onClick={() => setShowPhotoModal(false)} />
          <div className="flex items-center justify-center min-h-screen p-4">
            <div
              className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-md border border-gray-200 dark:border-gray-700 relative z-50"
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
                >
                  <Download size={16} />
                  Baixar Imagem
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedRomaneio && (
        <div className="fixed inset-0 z-50 overflow-y-auto" data-testid="overlay-edit-modal">
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70" onClick={() => setShowEditModal(false)} />
          <div className="flex items-center justify-center min-h-screen p-4">
            <div
              className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-md border border-gray-200 dark:border-gray-700 relative z-50"
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

              <div className="p-6 space-y-6">
                {/* Responsável pelo Transporte */}
                <div className="space-y-4">
                  <h3 className="text-base font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                    Responsável pelo Transporte
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Motorista dropdown */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Motorista
                      </label>
                      <div className="relative" ref={motoristaDropdownRef}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-10"
                          onClick={() => { setShowMotoristaDropdown(p => !p); setShowVeiculoDropdown(false); setShowFilialEditDropdown(false); }}
                          disabled={loadingMotoristas}
                          data-testid="select-motorista"
                        >
                          <User className="h-4 w-4 text-gray-400 shrink-0" />
                          <span className="flex-1 text-left truncate">
                            {loadingMotoristas
                              ? 'Carregando...'
                              : motoristas.find(m => m.motorista_id === editFormData.motorista_id)?.nome || 'Selecione um motorista'}
                          </span>
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        </button>
                        {showMotoristaDropdown && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 shadow-xl rounded-md border border-gray-200 dark:border-gray-600 z-[999]">
                            <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-600">
                              <div className="relative">
                                <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-gray-400" />
                                <input
                                  type="text"
                                  placeholder="Buscar motorista..."
                                  value={motoristaSearch}
                                  onChange={(e) => setMotoristaSearch(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  autoFocus
                                  className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                            <div className="max-h-44 overflow-y-auto py-1">
                              <div
                                className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm text-gray-500 dark:text-gray-400"
                                onClick={() => { setEditFormData(prev => ({ ...prev, motorista_id: null })); setShowMotoristaDropdown(false); setMotoristaSearch(''); }}
                              >
                                Nenhum
                              </div>
                              {motoristas.filter(m => m.nome.toLowerCase().includes(motoristaSearch.toLowerCase())).map(m => (
                                <div
                                  key={m.motorista_id}
                                  className={`px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm ${editFormData.motorista_id === m.motorista_id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-200'}`}
                                  onClick={() => { setEditFormData(prev => ({ ...prev, motorista_id: m.motorista_id })); setShowMotoristaDropdown(false); setMotoristaSearch(''); }}
                                >
                                  {m.nome}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Veículo dropdown */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Veículo
                      </label>
                      <div className="relative" ref={veiculoDropdownRef}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-10"
                          onClick={() => { setShowVeiculoDropdown(p => !p); setShowMotoristaDropdown(false); setShowFilialEditDropdown(false); }}
                          disabled={loadingVeiculos}
                          data-testid="select-veiculo"
                        >
                          <Truck className="h-4 w-4 text-gray-400 shrink-0" />
                          <span className="flex-1 text-left truncate">
                            {loadingVeiculos
                              ? 'Carregando...'
                              : veiculos.find(v => v.veiculo_id === editFormData.veiculo_id)?.placa || 'Selecione um veículo'}
                          </span>
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        </button>
                        {showVeiculoDropdown && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 shadow-xl rounded-md border border-gray-200 dark:border-gray-600 z-[999]">
                            <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-600">
                              <div className="relative">
                                <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-gray-400" />
                                <input
                                  type="text"
                                  placeholder="Buscar placa..."
                                  value={veiculoSearch}
                                  onChange={(e) => setVeiculoSearch(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  autoFocus
                                  className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                            <div className="max-h-44 overflow-y-auto py-1">
                              <div
                                className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm text-gray-500 dark:text-gray-400"
                                onClick={() => { setEditFormData(prev => ({ ...prev, veiculo_id: null })); setShowVeiculoDropdown(false); setVeiculoSearch(''); }}
                              >
                                Nenhum
                              </div>
                              {veiculos.filter(v => v.placa.toLowerCase().includes(veiculoSearch.toLowerCase())).map(v => (
                                <div
                                  key={v.veiculo_id}
                                  className={`px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm ${editFormData.veiculo_id === v.veiculo_id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-200'}`}
                                  onClick={() => { setEditFormData(prev => ({ ...prev, veiculo_id: v.veiculo_id })); setShowVeiculoDropdown(false); setVeiculoSearch(''); }}
                                >
                                  {v.placa}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filial de Destino */}
                <div className="space-y-4">
                  <h3 className="text-base font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                    Filial de Destino
                  </h3>
                  <div ref={filialEditDropdownRef} className="relative">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Filial
                    </label>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-10"
                      onClick={() => { setShowFilialEditDropdown(p => !p); setShowMotoristaDropdown(false); setShowVeiculoDropdown(false); }}
                      disabled={loadingFiliais}
                      data-testid="select-filial"
                    >
                      <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
                      <span className="flex-1 text-left truncate">
                        {loadingFiliais
                          ? 'Carregando...'
                          : filiais.find(f => f.id === editFormData.filial_id)?.filial || 'Selecione uma filial'}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    </button>
                    {showFilialEditDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 shadow-xl rounded-md border border-gray-200 dark:border-gray-600 z-[999]">
                        <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-600">
                          <div className="relative">
                            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Buscar filial..."
                              value={filialEditSearch}
                              onChange={(e) => setFilialEditSearch(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                              className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        <div className="max-h-44 overflow-y-auto py-1">
                          <div
                            className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm text-gray-500 dark:text-gray-400"
                            onClick={() => { setEditFormData(prev => ({ ...prev, filial_id: null })); setShowFilialEditDropdown(false); setFilialEditSearch(''); }}
                          >
                            Nenhuma
                          </div>
                          {filiais.filter(f => f.filial.toLowerCase().includes(filialEditSearch.toLowerCase())).map(f => (
                            <div
                              key={f.id}
                              className={`px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm ${editFormData.filial_id === f.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-200'}`}
                              onClick={() => { setEditFormData(prev => ({ ...prev, filial_id: f.id })); setShowFilialEditDropdown(false); setFilialEditSearch(''); }}
                            >
                              {f.filial}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Foto do Romaneio */}
                <div className="space-y-4">
                  <h3 className="text-base font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                    Foto do Romaneio
                  </h3>
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
                        <label className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer text-center text-sm font-medium">
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
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
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
        </div>
      )}
    </div>
  );
};

export default HodometrosRomaneio;
