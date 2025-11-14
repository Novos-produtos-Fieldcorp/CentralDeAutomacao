import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, MapPin, X, Download, AlertCircle, ChevronDown, Calendar, User, Camera, Clock, Video, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useDateRange } from '../../hooks/useDateRange';
import Pagination from '../../components/Pagination';
import { usePagination } from '../../hooks/usePagination';
import * as XLSX from 'xlsx';

interface ComprovRotaItem {
  id: number;
  created_at: string;
  id_motorista: number | null;
  company_id: number | null;
  foto: string | null;
  mediaUrl?: string | null;
  isVideo?: boolean;
  motorista?: {
    motorista_id: number;
    nome: string;
  } | null;
}

export default function ComprovRotaLista() {
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [comprovantes, setComprovantes] = useState<ComprovRotaItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [selectedMediaType, setSelectedMediaType] = useState<'image' | 'video'>('image');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const periodDropdownRef = useRef<HTMLDivElement>(null);
  
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('30days', false);

  const fetchComprovantes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!dateRange.startDate || !dateRange.endDate || !companyId) {
        toast.error('Selecione um período para gerar o relatório');
        return;
      }

      const { data, error } = await supabase
        .from('comprov_rota')
        .select(`
          id,
          created_at,
          id_motorista,
          company_id,
          foto,
          motorista:motorista!comprov_rota_id_motorista_fkey (
            motorista_id,
            nome
          )
        `)
        .eq('company_id', companyId)
        .gte('created_at', `${dateRange.startDate}T00:00:00`)
        .lte('created_at', `${dateRange.endDate}T23:59:59`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        setComprovantes([]);
        setLoading(false);
        return;
      }

      // Normalizar motorista de array para objeto único e pré-computar URLs de mídia
      const normalizedData = data.map(item => {
        const mediaUrl = getMediaUrl(item.foto);
        return {
          ...item,
          motorista: Array.isArray(item.motorista) 
            ? (item.motorista[0] ?? null) 
            : (item.motorista ?? null),
          mediaUrl: mediaUrl,
          isVideo: mediaUrl ? isVideoUrl(mediaUrl) : false
        };
      });

      // Log de debug para primeiros itens
      if (normalizedData.length > 0) {
        console.log('📸 [ComprovRota] Amostra de dados carregados:');
        normalizedData.slice(0, 3).forEach((item, index) => {
          console.log(`  ${index + 1}. ID: ${item.id}, foto original: ${item.foto?.substring(0, 50)}...`);
          console.log(`     mediaUrl: ${item.mediaUrl?.substring(0, 80)}...`);
          console.log(`     isVideo: ${item.isVideo}`);
        });
      }

      setComprovantes(normalizedData);
    } catch (error) {
      console.error('Error fetching comprovantes:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao carregar comprovantes';
      setError(errorMessage);
      toast.error('Erro ao carregar comprovantes: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  }, [dateRange, companyId]);

  useEffect(() => {
    fetchComprovantes();
  }, [fetchComprovantes]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target as Node)) {
        setShowPeriodDropdown(false);
      }
    };

    if (showPeriodDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showPeriodDropdown]);

  const formatDateBR = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const isVideoUrl = (url: string): boolean => {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    
    // Check for base64 video MIME types
    if (lowerUrl.startsWith('data:video')) {
      return true;
    }
    
    // Check for file extensions
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.m4v', '.mkv'];
    return videoExtensions.some(ext => lowerUrl.includes(ext));
  };

  const getMediaUrl = (photo: string | null): string | null => {
    if (!photo || photo.trim() === '') return null;
    
    try {
      const trimmedPhoto = photo.trim();
      
      // 1. Base64 data - return directly
      if (trimmedPhoto.startsWith('data:')) {
        return trimmedPhoto;
      }
      
      // 2. Try to parse as JSON array
      if (trimmedPhoto.startsWith('[') || trimmedPhoto.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmedPhoto);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Get first item from array and trim it
            const firstItem = typeof parsed[0] === 'string' ? parsed[0].trim() : null;
            if (firstItem) {
              // Check if it's base64
              if (firstItem.startsWith('data:')) {
                return firstItem;
              }
              // Check if it's a complete URL
              if (firstItem.startsWith('http://') || firstItem.startsWith('https://')) {
                return firstItem;
              }
              // If it's a filename, generate Storage URL
              if (firstItem.includes('.')) {
                const { data } = supabase.storage
                  .from('comprovante')
                  .getPublicUrl(firstItem);
                return data.publicUrl;
              }
            }
          }
        } catch {
          // Not valid JSON, continue to next check
        }
      }
      
      // 3. Comma-separated values
      if (trimmedPhoto.includes(',')) {
        const items = trimmedPhoto.split(',').map(u => u.trim()).filter(u => u.length > 0);
        
        // Try each item until we find a valid one
        for (const item of items) {
          // Base64
          if (item.startsWith('data:')) {
            return item;
          }
          // Complete URL
          if (item.startsWith('http://') || item.startsWith('https://')) {
            return item;
          }
          // Filename with extension
          if (item.includes('.') && !item.includes('http')) {
            const { data } = supabase.storage
              .from('comprovante')
              .getPublicUrl(item);
            return data.publicUrl;
          }
        }
      }
      
      // 4. Complete URL - return directly
      if (trimmedPhoto.startsWith('http://') || trimmedPhoto.startsWith('https://')) {
        return trimmedPhoto;
      }
      
      // 5. Filename only - generate Supabase Storage URL
      // Only do this if it looks like a filename (has extension and no commas)
      if (trimmedPhoto.includes('.') && !trimmedPhoto.includes(',')) {
        const { data } = supabase.storage
          .from('comprovante')
          .getPublicUrl(trimmedPhoto);
        return data.publicUrl;
      }
      
      // If none of the above, return null
      return null;
      
    } catch (error) {
      console.error('❌ [ComprovRota] Erro ao processar mídia:', error, photo);
      return null;
    }
  };

  const handleShowPhoto = (item: ComprovRotaItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.mediaUrl) {
      setSelectedPhoto(item.mediaUrl);
      setSelectedMediaType(item.isVideo ? 'video' : 'image');
      setShowPhotoModal(true);
    } else {
      toast.error('Mídia não disponível ou URL inválida');
      console.error('❌ [ComprovRota] Mídia não disponível para item:', item);
    }
  };

  const exportToExcel = () => {
    try {
      const exportData = comprovantes.map(item => ({
        'ID': item.id,
        'Data/Hora': format(new Date(item.created_at), 'dd/MM/yyyy HH:mm'),
        'Motorista': item.motorista?.nome || 'Não informado',
        'Tem Foto': item.foto ? 'Sim' : 'Não'
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      ws['!cols'] = [
        { wch: 10 },
        { wch: 18 },
        { wch: 30 },
        { wch: 12 }
      ];
      
      XLSX.utils.book_append_sheet(wb, ws, 'Comprovantes');
      
      const fileName = `comprovantes_rota_${new Date().toISOString().split('T')[0]}.xlsx`;
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
      
      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);
      
      toast.success('Relatório exportado com sucesso');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Erro ao exportar para Excel');
    }
  };

  const filteredComprovantes = comprovantes.filter(item => {
    const searchString = searchTerm.toLowerCase();
    return !searchTerm || 
      item.motorista?.nome?.toLowerCase().includes(searchString) ||
      item.id.toString().includes(searchString);
  });

  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedData: paginatedComprovantes,
    handlePageChange,
    handlePageSizeChange
  } = usePagination({
    data: filteredComprovantes,
    initialPageSize: 25
  });

  const validateDate = (dateString: string): boolean => {
    if (!dateString) return true;
    const year = parseInt(dateString.split('-')[0]);
    return year >= 2020 && year <= 2099;
  };

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
          onClick={fetchComprovantes}
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
      <div className="flex flex-wrap gap-3 items-center mb-6">
        {/* Search */}
        <div className="relative flex-grow min-w-64">
          <input
            type="text"
            placeholder="Buscar por motorista ou ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search"
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 
                     dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 
                     focus:border-blue-500 text-gray-900 dark:text-gray-100"
          />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>

        {/* Período Filter */}
        <div className="relative z-[40]" ref={periodDropdownRef}>
          <button
            type="button"
            data-testid="button-period-filter"
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
                { value: 'custom', label: 'Personalizado' }
              ].map(option => (
                <button
                  key={option.value}
                  data-testid={`period-option-${option.value}`}
                  onClick={() => {
                    updatePeriod(option.value as any);
                    setShowPeriodDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-sm
                    ${periodType === option.value ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200'}`}
                >
                  {option.label}
                </button>
              ))}
              
              {periodType === 'custom' && (
                <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-600">
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Data inicial</label>
                      <input
                        type="date"
                        data-testid="input-start-date"
                        value={dateRange.startDate}
                        onChange={(e) => {
                          if (validateDate(e.target.value)) {
                            setDateRange({ ...dateRange, startDate: e.target.value });
                          }
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Data final</label>
                      <input
                        type="date"
                        data-testid="input-end-date"
                        value={dateRange.endDate}
                        onChange={(e) => {
                          if (validateDate(e.target.value)) {
                            setDateRange({ ...dateRange, endDate: e.target.value });
                          }
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Export Button */}
        <button
          onClick={exportToExcel}
          data-testid="button-export-excel"
          disabled={comprovantes.length === 0}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="h-4 w-4" />
          Exportar
        </button>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {totalItems} comprovante{totalItems !== 1 ? 's' : ''} encontrado{totalItems !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Data/Hora
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Motorista
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Foto
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedComprovantes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12">
                    <div className="flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                      <MapPin className="h-12 w-12 mb-3 text-gray-300 dark:text-gray-600" />
                      <p className="text-lg font-medium">Nenhum comprovante encontrado</p>
                      <p className="text-sm mt-1">
                        {searchTerm 
                          ? 'Tente ajustar os filtros de busca' 
                          : 'Nenhum comprovante registrado no período selecionado'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedComprovantes.map((item) => (
                  <tr 
                    key={item.id}
                    data-testid={`row-comprov-${item.id}`}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        #{item.id}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900 dark:text-gray-100">
                          {format(new Date(item.created_at), 'dd/MM/yyyy HH:mm')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900 dark:text-gray-100">
                          {item.motorista?.nome || 'Não informado'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.mediaUrl ? (
                        <div className="flex items-center gap-3">
                          {/* Thumbnail */}
                          <div className="relative w-12 h-12 flex-shrink-0">
                            {item.isVideo ? (
                              <div className="w-full h-full bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
                                <Video className="h-6 w-6 text-gray-400" />
                              </div>
                            ) : (
                              <img
                                src={item.mediaUrl}
                                alt={`Preview ${item.id}`}
                                className="w-full h-full object-cover rounded"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  console.error(`❌ [ComprovRota] Falha ao carregar thumbnail do item ${item.id}:`, item.mediaUrl);
                                }}
                              />
                            )}
                          </div>
                          {/* View Button */}
                          <button
                            onClick={(e) => handleShowPhoto(item, e)}
                            data-testid={`button-view-photo-${item.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/20 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                          >
                            {item.isVideo ? (
                              <>
                                <Video className="h-3 w-3" />
                                Ver vídeo
                              </>
                            ) : (
                              <>
                                <Camera className="h-3 w-3" />
                                Ver foto
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-gray-500">
                          Sem mídia
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      {/* Photo/Video Modal */}
      {showPhotoModal && selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999] p-4"
          onClick={() => setShowPhotoModal(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            <button
              onClick={() => setShowPhotoModal(false)}
              data-testid="button-close-photo"
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <X className="h-8 w-8" />
            </button>
            
            {selectedMediaType === 'video' ? (
              <video
                src={selectedPhoto}
                controls
                autoPlay
                className="w-full h-full max-h-[85vh] rounded-lg"
                onError={(e) => {
                  console.error('❌ [ComprovRota] Erro ao carregar vídeo:', selectedPhoto);
                  toast.error('Erro ao carregar vídeo');
                }}
              >
                Seu navegador não suporta a tag de vídeo.
              </video>
            ) : (
              <img
                src={selectedPhoto}
                alt="Comprovante"
                className="w-full h-full object-contain rounded-lg"
                onError={(e) => {
                  console.error('❌ [ComprovRota] Erro ao carregar imagem:', selectedPhoto);
                  toast.error('Erro ao carregar imagem');
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
