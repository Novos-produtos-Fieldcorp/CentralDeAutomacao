import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Camera, X, Download, Calendar, Clock, User, Truck, AlertCircle, ChevronDown, Edit2, Plus, Trash2, Copy, Check, FilePen } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { useDateRange } from '../../hooks/useDateRange';
import { formatCPF } from '../../utils/format';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import Pagination from '../../components/Pagination';
import { usePagination } from '../../hooks/usePagination';
import * as XLSX from 'xlsx';

interface Minuta {
  id: number;
  minuta_informada: string | null;
  minuta_lida: string | null;
  romaneio: string[] | null;
  foto_minuta: string | null;
  filial_id: number | null;
  filial?: { id: number; filial: string } | null;
  company_id?: number | null;
  motorista_id?: number | null;
  motorista?: { motorista_id: number; nome: string; cpf: string } | null;
  veiculo_id?: number | null;
  veiculo?: { veiculo_id: number; placa: string; marca: string; tipo: string } | null;
  created_at: string;
}

const RomaneioCell: React.FC<{ romaneio: string[] | string | null }> = ({ romaneio }) => {
  const [copied, setCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  let romaneios: string[] = [];
  if (romaneio) {
    if (Array.isArray(romaneio)) {
      // Se for array, garantir que cada item seja string e remover duplicatas
      romaneios = [...new Set(romaneio.map(r => String(r).trim()).filter(r => r))];
    } else if (typeof romaneio === 'string') {
      // Se for string, tentar parsear como JSON
      try {
        const parsed = JSON.parse(romaneio);
        if (Array.isArray(parsed)) {
          // Array parseado do JSON, remover duplicatas
          romaneios = [...new Set(parsed.map(r => String(r).trim()).filter(r => r))];
        } else {
          romaneios = [String(parsed).trim()].filter(r => r);
        }
      } catch {
        // Se falhar o parse JSON, verificar se é string com múltiplos valores separados
        // Tentar separar por espaço, vírgula, ponto-e-vírgula ou quebra de linha
        const separated = romaneio.split(/[\s,;\n]+/).map(r => r.trim()).filter(r => r);
        if (separated.length > 1) {
          romaneios = [...new Set(separated)];
        } else {
          romaneios = [romaneio.trim()].filter(r => r);
        }
      }
    }
  }
  
  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
    }
  };
  
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showDropdown) {
      updatePosition();
    }
    setShowDropdown(!showDropdown);
  };
  
  const handleClickOutside = (event: MouseEvent) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target as Node) &&
      buttonRef.current &&
      !buttonRef.current.contains(event.target as Node)
    ) {
      setShowDropdown(false);
    }
  };
  
  const handleScroll = () => {
    if (showDropdown) {
      updatePosition();
    }
  };
  
  useEffect(() => {
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleScroll);
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleScroll);
      };
    }
  }, [showDropdown]);
  
  const handleCopyRomaneios = () => {
    const text = romaneios.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success('Romaneios copiados!');
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast.error('Erro ao copiar');
    });
  };
  
  if (romaneios.length === 0) return <span>-</span>;
  
  if (romaneios.length === 1) {
    return (
      <div className="inline-flex items-center gap-2">
        <span className="text-sm text-gray-900 dark:text-white">
          {romaneios[0]}
        </span>
        <button
          onClick={handleCopyRomaneios}
          className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          title="Copiar romaneio"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
    );
  }
  
  const renderDropdown = () => {
    if (!showDropdown) return null;

    return createPortal(
      <div
        ref={dropdownRef}
        className="fixed bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
        style={{
          top: dropdownPosition.top,
          left: dropdownPosition.left,
          minWidth: '120px',
          maxHeight: '200px',
          overflowY: 'auto',
          zIndex: 9999
        }}
      >
        <div className="border-b border-gray-200 dark:border-gray-700 mb-1 pb-1">
          <button
            onClick={handleCopyRomaneios}
            className="w-full px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-center gap-1.5"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copiar
              </>
            )}
          </button>
        </div>
        {romaneios.map((r, idx) => (
          <div key={idx} className="text-sm text-gray-900 dark:text-white px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap">
            {r}
          </div>
        ))}
      </div>,
      document.body
    );
  };
  
  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="cursor-pointer inline-flex items-center gap-1 text-sm text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
      >
        {romaneios[0]} <ChevronDown className="h-3 w-3" />
      </button>
      
      {renderDropdown()}
    </div>
  );
};

const HodometrosMinuta: React.FC = () => {
  const { companyId } = useAuth();
  // moduleAccess removed — create modal removed
  const { periodType, dateRange, pendingDateRange, updatePeriod, setDateRange } = useDateRange('30days', true);
  const [searchTerm, setSearchTerm] = useState('');
  const [minutas, setMinutas] = useState<Minuta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMinutas, setLoadingMinutas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorMinutas, setErrorMinutas] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const periodDropdownRef = useRef<HTMLDivElement>(null);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMinuta, setSelectedMinuta] = useState<Minuta | null>(null);
  const [editFormData, setEditFormData] = useState({
    minuta_informada: '',
    minuta_lida: '',
    romaneios: [] as string[],
    newRomaneio: '',
    motorista_id: null as number | null,
    veiculo_id: null as number | null,
    foto_minuta: null as string | null
  });
  const [isSaving, setIsSaving] = useState(false);
  const [motoristas, setMotoristas] = useState<Array<{ motorista_id: number; nome: string }>>([]);
  const [veiculos, setVeiculos] = useState<Array<{ veiculo_id: number; placa: string }>>([]);
  const [loadingMotoristas, setLoadingMotoristas] = useState(false);
  const [loadingVeiculos, setLoadingVeiculos] = useState(false);

  const fetchMinutas = useCallback(async (overrideRange?: { startDate: string; endDate: string }) => {
    try {
      setLoadingMinutas(true);
      setErrorMinutas(null);
      const start = overrideRange?.startDate ?? dateRange.startDate;
      const end = overrideRange?.endDate ?? dateRange.endDate;

      if (!start || !end || !companyId) return;

      // Adjust end date to include the full day (23:59:59.999)
      const endDateFull = `${end}T23:59:59.999`;

      const { data, error } = await supabase.from('minuta')
        .select(`
          id,
          minuta_informada,
          minuta_lida,
          romaneio,
          foto_minuta,
          filial_id,
          filial:filial_id ( id, filial ),
          motorista_id,
          motorista:motorista_id ( motorista_id, nome, cpf ),
          veiculo_id,
          veiculo:veiculo_id ( veiculo_id, placa, marca, tipo ),
          company_id,
          created_at
        `)
        .eq('company_id', companyId)
        .gte('created_at', start)
        .lte('created_at', endDateFull)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[HodometrosMinuta] fetchMinutas supabase error', error);
        throw error;
      }
    // raw data received from supabase
      if (!data || data.length === 0) {
        setMinutas([]);
        return;
      }

      const formatted = (data || []).map((item: any) => ({
        ...item,
        motorista: Array.isArray(item.motorista) ? item.motorista[0] : item.motorista,
        veiculo: Array.isArray(item.veiculo) ? item.veiculo[0] : item.veiculo,
        filial: Array.isArray(item.filial) ? item.filial[0] : item.filial
      })) as Minuta[];

      // formatted results (joined relations flattened)

      setMinutas(formatted);

      // no create-modal filiais fallback (create UI removed)
    } catch (err: any) {
      console.error('Error fetching minutas:', err);
      const msg = err?.message || String(err);
      if (msg.toLowerCase().includes('relation') && msg.toLowerCase().includes('minuta') && msg.toLowerCase().includes('does not exist')) {
        const friendly = 'A tabela de Minuta não está disponível neste banco de dados.';
        setErrorMinutas(friendly);
        toast.error(friendly);
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao carregar minutas';
        setErrorMinutas(errorMessage);
        toast.error('Erro ao carregar minutas: ' + errorMessage);
      }
    } finally {
      setLoadingMinutas(false);
      setLoading(false);
    }
  }, [dateRange, companyId]);

  useEffect(() => {
    if (!pendingDateRange) fetchMinutas();
  }, [fetchMinutas, pendingDateRange]);

  // create options removed (create modal removed)

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

  const filteredMinutas = minutas.filter(m => {
    const s = searchTerm.toLowerCase();
    return (
      !searchTerm ||
      (m.motorista?.nome || '').toLowerCase().includes(s) ||
      (m.motorista?.cpf || '').includes(s) ||
      (m.veiculo?.placa || '').toLowerCase().includes(s) ||
      (m.veiculo?.marca || '').toLowerCase().includes(s) ||
      (m.veiculo?.tipo || '').toLowerCase().includes(s) ||
      (m.minuta_informada || '').toLowerCase().includes(s) ||
      (m.romaneio && Array.isArray(m.romaneio) ? m.romaneio.some(r => r.toLowerCase().includes(s)) : false) ||
      (m.filial?.filial || '').toLowerCase().includes(s)
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
  } = usePagination({ data: filteredMinutas, initialPageSize: 25 });

  const exportMinutasToExcel = () => {
    try {
      const exportData = minutas.map(m => {
        let romaneios: string[] = [];
        if (m.romaneio) {
          if (Array.isArray(m.romaneio)) {
            romaneios = m.romaneio;
          } else if (typeof m.romaneio === 'string') {
            // Tentar parsear como JSON
            try {
              const parsed = JSON.parse(m.romaneio);
              if (Array.isArray(parsed)) {
                romaneios = parsed;
              } else {
                romaneios = [m.romaneio];
              }
            } catch {
              romaneios = [m.romaneio];
            }
          }
        }
        
        return {
          'Data': m.created_at ? new Date(m.created_at).toISOString().split('T')[0].split('-').reverse().join('/') : '-',
          'Hora': m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
          'Motorista': m.motorista?.nome || 'Não informado',
          'CPF': m.motorista?.cpf ? formatCPF(m.motorista.cpf) : 'Não informado',
          'Veículo': m.veiculo?.placa || 'Não informado',
          'Marca/Modelo': `${m.veiculo?.marca || ''} ${m.veiculo?.tipo || ''}`.trim() || 'Não informado',
          'Nº Minuta Informada': m.minuta_informada || '-',
          'Nº Minuta Lida': m.minuta_lida || '-',
          'Romaneios': romaneios.length > 0 ? romaneios.join(', ') : '-',
          'Filial': m.filial?.filial || 'Sem filial',
          'Tem Foto': m.foto_minuta ? 'Sim' : 'Não'
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 12 }, { wch: 8 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 10 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Minutas');
      XLSX.writeFile(wb, `relatorio_minutas_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Relatório de Minutas exportado com sucesso');
    } catch (err) {
      console.error('Error exporting minutas to Excel:', err);
      toast.error('Erro ao exportar minutas para Excel');
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

  const handleOpenEditModal = async (minuta: Minuta) => {
    setSelectedMinuta(minuta);
    
    // Garantir que romaneio seja sempre um array
    let romaneios: string[] = [];
    if (minuta.romaneio) {
      if (Array.isArray(minuta.romaneio)) {
        romaneios = minuta.romaneio.map((r: any) => String(r).trim()).filter((r: string) => r);
      } else if (typeof minuta.romaneio === 'string') {
        const romaneioStr = minuta.romaneio;
        // Tentar parsear como JSON
        try {
          const parsed = JSON.parse(romaneioStr);
          if (Array.isArray(parsed)) {
            romaneios = parsed.map((r: any) => String(r).trim()).filter((r: string) => r);
          } else {
            // Se parsed não é array, converter para string e usar
            romaneios = [String(parsed).trim()].filter((r: string) => r);
          }
        } catch {
          // Se JSON.parse falhar, tentar separar por vírgula ou espaço
          if (romaneioStr.includes(',')) {
            romaneios = romaneioStr.split(',').map((r: string) => r.trim()).filter((r: string) => r);
          } else if (romaneioStr.includes(' ')) {
            romaneios = romaneioStr.split(/\s+/).filter((r: string) => r);
          } else {
            romaneios = [romaneioStr.trim()].filter((r: string) => r);
          }
        }
      }
    }
    
    setEditFormData({
      minuta_informada: minuta.minuta_informada || '',
      minuta_lida: minuta.minuta_lida || '',
      romaneios: romaneios,
      newRomaneio: '',
      motorista_id: minuta.motorista_id || null,
      veiculo_id: minuta.veiculo_id || null,
      foto_minuta: minuta.foto_minuta || null
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

  const handleAddRomaneio = () => {
    if (editFormData.newRomaneio.trim()) {
      setEditFormData(prev => ({
        ...prev,
        romaneios: [...prev.romaneios, prev.newRomaneio.trim()],
        newRomaneio: ''
      }));
    }
  };

  const handleRemoveRomaneio = (index: number) => {
    setEditFormData(prev => ({
      ...prev,
      romaneios: prev.romaneios.filter((_, i) => i !== index)
    }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditFormData(prev => ({
          ...prev,
          foto_minuta: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setEditFormData(prev => ({
      ...prev,
      foto_minuta: null
    }));
  };

  const handleSaveMinuta = async () => {
    if (!selectedMinuta) return;

    try {
      setIsSaving(true);

      const { error } = await supabase
        .from('minuta')
        .update({
          minuta_informada: editFormData.minuta_informada || null,
          minuta_lida: editFormData.minuta_lida || null,
          romaneio: editFormData.romaneios.length > 0 ? editFormData.romaneios : null,
          motorista_id: editFormData.motorista_id,
          veiculo_id: editFormData.veiculo_id,
          foto_minuta: editFormData.foto_minuta
        })
        .eq('id', selectedMinuta.id);

      if (error) throw error;

      toast.success('Minuta atualizada com sucesso!');
      setShowEditModal(false);
      fetchMinutas();
    } catch (err) {
      console.error('Error updating minuta:', err);
      toast.error('Erro ao atualizar minuta');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  if (errorMinutas) return (
    <div className="bg-white dark:bg-[#1B2537] p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 text-red-500 mb-4">
        <AlertCircle size={24} />
        <h3 className="text-lg font-medium">Erro ao carregar Minutas</h3>
      </div>
      <p className="text-gray-600 dark:text-gray-400 mb-4">{errorMinutas}</p>
      <button onClick={() => fetchMinutas()} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Tentar novamente</button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-center mb-6">
        <div className="relative flex-grow min-w-64">
          <input
            type="text"
            placeholder="Buscar por motorista, placa, minuta, romaneio ou filial..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 
                     dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 
                     focus:border-blue-500 text-gray-900 dark:text-gray-100"
          />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>

        <div className="relative z-[40]" ref={periodDropdownRef}>
          <button
            type="button"
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9"
            onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
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
                  >
                    {label}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-2">
            {/* create modal removed for testing */}

            <div className="relative group">
              <button
                onClick={exportMinutasToExcel}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                         transition-colors flex items-center justify-center"
                disabled={filteredMinutas.length === 0}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nº Minuta</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Romaneios</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Filial</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Foto</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Editar</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loadingMinutas ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">Carregando...</td></tr>
              ) : errorMinutas ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-red-500">{errorMinutas}</td></tr>
              ) : minutas.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">Nenhuma minuta encontrada para o período selecionado</td></tr>
              ) : (
                (paginatedData || []).map((m) => {
                  const created = m.created_at ? new Date(m.created_at) : null;
                  const dateStr = created ? `${String(created.getDate()).padStart(2,'0')}/${String(created.getMonth()+1).padStart(2,'0')}/${created.getFullYear()}` : '-';
                  const timeStr = created ? `${String(created.getHours()).padStart(2,'0')}:${String(created.getMinutes()).padStart(2,'0')}` : '-';

                  return (
                    <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center"><Calendar className="h-4 w-4 text-gray-400 mr-1" /><div className="text-sm text-gray-900 dark:text-white">{dateStr}</div></div>
                        <div className="flex items-center mt-1"><Clock className="h-4 w-4 text-gray-400 mr-1" /><div className="text-xs text-gray-500 dark:text-gray-400">{timeStr}</div></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center"><User className="h-4 w-4 text-gray-400 mr-1" /><div className="text-sm text-gray-900 dark:text-white">{m.motorista?.nome || 'Não informado'}</div></div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 ml-5">{m.motorista?.cpf ? formatCPF(m.motorista.cpf) : ''}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center"><Truck className="h-4 w-4 text-gray-400 mr-1" /><div className="text-sm text-gray-900 dark:text-white">{m.veiculo?.placa || 'Não informado'}</div></div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 ml-5">{m.veiculo?.marca} {m.veiculo?.tipo}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {m.minuta_lida && <div><span className="text-gray-500 dark:text-gray-400 text-xs">Lido:</span> {m.minuta_lida}</div>}
                          {m.minuta_informada && <div><span className="text-gray-500 dark:text-gray-400 text-xs">Informado:</span> {m.minuta_informada}</div>}
                          {!m.minuta_lida && !m.minuta_informada && <span className="text-gray-500 dark:text-gray-400">-</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        <RomaneioCell romaneio={m.romaneio} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{m.filial?.filial || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {m.foto_minuta ? (
                          <button onClick={() => { setSelectedPhoto(m.foto_minuta); setShowPhotoModal(true); }} className="inline-flex items-center justify-center p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors" title="Ver foto da minuta">
                            <Camera size={16} />
                          </button>
                        ) : (
                          <span className="inline-flex items-center justify-center p-2 text-gray-400 dark:text-gray-600 opacity-50"><Camera size={16} /></span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleOpenEditModal(m)}
                          className="inline-flex items-center justify-center p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                          title="Editar minuta"
                          data-testid={`button-edit-minuta-${m.id}`}
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

      {filteredMinutas.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      {/* create modal removed for tests */}

      {/* Photo Modal */}
      {showPhotoModal && selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setShowPhotoModal(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-md border border-gray-200 dark:border-gray-700"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Foto da Minuta</h3>
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
                alt="Foto da Minuta"
                className="absolute inset-0 w-full h-full object-contain"
              />
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <a
                href={selectedPhoto}
                download="minuta.jpg"
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
      {showEditModal && selectedMinuta && (
        <div 
          className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setShowEditModal(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-md border border-gray-200 dark:border-gray-700"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Editar Minuta</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                data-testid="button-close-edit-modal"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Minuta Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Minuta Informada
                  </label>
                  <input
                    type="text"
                    value={editFormData.minuta_informada}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, minuta_informada: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    data-testid="input-minuta-informada"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Minuta Lida
                  </label>
                  <input
                    type="text"
                    value={editFormData.minuta_lida}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, minuta_lida: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    data-testid="input-minuta-lida"
                  />
                </div>
              </div>

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

              {/* Romaneios Section */}
              <div className="border border-gray-300 dark:border-gray-600 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Romaneios
                </h4>

                {/* Current Romaneios List */}
                {editFormData.romaneios.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {editFormData.romaneios.map((rom, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300">
                        <span className="text-sm">{rom}</span>
                        <button
                          onClick={() => handleRemoveRomaneio(idx)}
                          className="text-blue-600 dark:text-blue-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          title="Remover romaneio"
                          data-testid={`button-remove-romaneio-${idx}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New Romaneio */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editFormData.newRomaneio}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, newRomaneio: e.target.value }))}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddRomaneio();
                      }
                    }}
                    placeholder="Digite o nº do romaneio"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    data-testid="input-new-romaneio"
                  />
                  <button
                    onClick={handleAddRomaneio}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    data-testid="button-add-romaneio"
                  >
                    <Plus size={16} />
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Foto da Minuta Section */}
              <div className="border border-gray-300 dark:border-gray-600 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Foto da Minuta
                </h4>

                {editFormData.foto_minuta ? (
                  <div className="space-y-3">
                    <div className="relative w-full h-48 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                      <img 
                        src={editFormData.foto_minuta} 
                        alt="Preview da foto" 
                        className="w-full h-full object-contain"
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
                onClick={handleSaveMinuta}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="button-save-minuta"
              >
                {isSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HodometrosMinuta;