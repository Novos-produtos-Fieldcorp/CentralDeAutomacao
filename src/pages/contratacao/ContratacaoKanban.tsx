import React, { useState, useEffect, ReactNode, useCallback } from 'react';
import { MapPin, Phone, Mail, Calendar, Filter, X, FileText, Truck, User, MessageCircle, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import type { Motorista, DocumentoMotorista, Veiculo } from '../../types/database';
import DocumentViewer from '../../components/DocumentViewer';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useFloatingChat } from '../../hooks/useFloatingChat';
import { supabase } from '../../lib/supabase';
import UnifiedAgregadoModal from '../../components/UnifiedAgregadoModal';
import UnifiedMotoristaModal from '../../components/UnifiedMotoristaModal';

interface MotoristaWithDetails extends Motorista {
  veiculo?: Veiculo[];
}

interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  borderColor: string;
  motoristas: MotoristaWithDetails[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  loading: boolean;
}

const ContratacaoKanban = () => {
  const { query, companyId } = useCompanyData();
  const { startChat } = useFloatingChat();
  const [loading, setLoading] = useState(true);
  const [funcaoFilter, setFuncaoFilter] = useState<'todos' | 'Motorista' | 'Agregado'>('todos');
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [isUnifiedAgregadoModalOpen, setIsUnifiedAgregadoModalOpen] = useState(false);
  const [isUnifiedMotoristaModalOpen, setIsUnifiedMotoristaModalOpen] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedMotorista, setSelectedMotorista] = useState<{
    documento: DocumentoMotorista | null;
    nome: string;
    endereco: any;
    veiculo: (Veiculo & { documento_veiculo: any[] }) | null;
    motorista_id?: number;
    funcao?: string;
  }>({ documento: null, nome: '', endereco: null, veiculo: null });

  const [columns, setColumns] = useState<KanbanColumn[]>([
    { 
      id: 'cadastrado', 
      title: 'Cadastrado', 
      color: 'bg-blue-50/80 dark:bg-blue-900/20',
      borderColor: 'border-blue-100 dark:border-blue-800/30',
      motoristas: [],
      totalCount: 0,
      currentPage: 1,
      totalPages: 1,
      loading: false
    },
    { 
      id: 'qualificado', 
      title: 'Qualificado', 
      color: 'bg-purple-50/80 dark:bg-purple-900/20',
      borderColor: 'border-purple-100 dark:border-purple-800/30',
      motoristas: [],
      totalCount: 0,
      currentPage: 1,
      totalPages: 1,
      loading: false
    },
    { 
      id: 'documentacao', 
      title: 'Documentação', 
      color: 'bg-yellow-50/80 dark:bg-yellow-900/20',
      borderColor: 'border-yellow-100 dark:border-yellow-800/30',
      motoristas: [],
      totalCount: 0,
      currentPage: 1,
      totalPages: 1,
      loading: false
    },
    { 
      id: 'gr', 
      title: 'Gestão de Risco', 
      color: 'bg-pink-50/80 dark:bg-pink-900/30',
      borderColor: 'border-pink-100 dark:border-pink-800/40',
      motoristas: [],
      totalCount: 0,
      currentPage: 1,
      totalPages: 1,
      loading: false
    },
    { 
      id: 'contrato_enviado', 
      title: 'Contrato Enviado', 
      color: 'bg-indigo-50/80 dark:bg-indigo-900/20',
      borderColor: 'border-indigo-100 dark:border-indigo-800/30',
      motoristas: [],
      totalCount: 0,
      currentPage: 1,
      totalPages: 1,
      loading: false
    },
    { 
      id: 'contratado', 
      title: 'Contratado', 
      color: 'bg-green-50/80 dark:bg-green-900/20',
      borderColor: 'border-green-100 dark:border-green-800/30',
      motoristas: [],
      totalCount: 0,
      currentPage: 1,
      totalPages: 1,
      loading: false
    },
    { 
      id: 'repescagem', 
      title: 'Repescagem', 
      color: 'bg-orange-50/80 dark:bg-orange-900/20',
      borderColor: 'border-orange-100 dark:border-orange-800/30',
      motoristas: [],
      totalCount: 0,
      currentPage: 1,
      totalPages: 1,
      loading: false
    },
    { 
      id: 'rejeitado', 
      title: 'Rejeitado', 
      color: 'bg-red-50/80 dark:bg-red-900/20',
      borderColor: 'border-red-100 dark:border-red-800/30',
      motoristas: [],
      totalCount: 0,
      currentPage: 1,
      totalPages: 1,
      loading: false
    }
  ]);

  // Debounce search term with a longer delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 1000); // 1 second delay

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Effect to handle search when debounced term changes
  useEffect(() => {
    if (debouncedSearchTerm !== undefined && companyId) {
      handleSearch();
    }
  }, [debouncedSearchTerm, companyId]);

  useEffect(() => {
    // Initial load of all columns
    const loadAllColumns = async () => {
      if (!companyId) return; // Add guard clause
      
      setLoading(true);
      try {
        // First, get counts for all statuses
        await Promise.all(columns.map(column => fetchColumnCount(column.id, companyId)));
        
        // Then load first page of data for each column
        await Promise.all(columns.map(column => fetchColumnData(column.id, 1)));
      } catch (error) {
        console.error('Error loading kanban data:', error);
        toast.error('Erro ao carregar dados do kanban');
      } finally {
        setLoading(false);
      }
    };
    
    if (companyId) {
      loadAllColumns();
    }
  }, [funcaoFilter, itemsPerPage, companyId]); // Add companyId to dependencies

  const fetchColumnCount = async (status: string, companyId: string) => {
    try {
      // Get all motoristas with this status
      const { data, error } = await supabase
        .from('motorista')
        .select('motorista_id')
        .eq('st_cadastro', status)
        .eq('company_id', companyId);

      if (error) throw error;

      // Filter the data based on function and search term
      let filteredData = data || [];
      
      // Apply function filter if not 'todos'
      if (funcaoFilter !== 'todos') {
        // We need to get the full data to filter by function
        const { data: fullData } = await supabase
          .from('motorista')
          .select('motorista_id, funcao')
          .eq('st_cadastro', status)
          .eq('company_id', companyId);
          
        if (fullData) {
          const matchingIds = fullData
            .filter(m => m.funcao === funcaoFilter)
            .map(m => m.motorista_id);
          
          filteredData = filteredData.filter(m => matchingIds.includes(m.motorista_id));
        }
      }
      
      // Apply search filter if provided
      if (debouncedSearchTerm) {
        // We need to get the full data to search by name or CPF
        const { data: fullData } = await supabase
          .from('motorista')
          .select('motorista_id, nome, cpf')
          .eq('st_cadastro', status)
          .eq('company_id', companyId);
          
        if (fullData) {
          const searchLower = debouncedSearchTerm.toLowerCase();
          const matchingIds = fullData.filter(m => 
            (m.nome?.toLowerCase().includes(searchLower) || 
            m.cpf?.includes(searchLower))
          ).map(m => m.motorista_id);
          
          filteredData = filteredData.filter(m => matchingIds.includes(m.motorista_id));
        }
      }
      
      const totalCount = filteredData.length;

      // Update the column with the count
      setColumns(prev => prev.map(col => {
        if (col.id === status) {
          // Ensure we calculate total pages correctly
          const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage || 1));
          return {
            ...col,
            totalCount: totalCount,
            totalPages: totalPages,
          };
        }
        return col;
      }));

      return totalCount;
    } catch (error) {
      console.error(`Erro ao buscar contagem para ${status}:`, error);
      toast.error(`Erro ao carregar contagem para ${status}`);
      return 0;
    }
  };

  const fetchColumnData = async (status: string, page: number) => {
    if (!companyId) return;
    
    // Find the column
    const column = columns.find(col => col.id === status);
    if (!column) return;
    
    // Update loading state for this column
    setColumns(prev => prev.map(col => 
      col.id === status ? { ...col, loading: true } : col
    ));
    
    try {
      // Calculate pagination parameters
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      
      // Build the query with filters
      let query = supabase
        .from('motorista')
        .select(`
          motorista_id,
          nome,
          funcao,
          st_cadastro,
          telefone,
          email,
          data_cadastro,
          cpf
        `)
        .eq('st_cadastro', status)
        .eq('company_id', companyId);

      // Apply function filter if not 'todos'
      if (funcaoFilter !== 'todos') {
        query = query.eq('funcao', funcaoFilter);
      }
      
      // Apply search filter if provided
      if (debouncedSearchTerm) {
        query = query.or(`nome.ilike.%${debouncedSearchTerm}%,cpf.ilike.%${debouncedSearchTerm}%`);
      }
      
      // Apply sorting by data_cadastro (newest first)
      query = query.order('data_cadastro', { ascending: false });
      
      // Apply pagination
      query = query.range(from, to);
      
      // Execute the query
      const { data: motoristasData, error } = await query;
      
      if (error) throw error;
      
      // Fetch vehicle data for each motorista
      const motoristasWithVehicles = await Promise.all(
        (motoristasData || []).map(async (motorista) => {
          const { data: veiculoData } = await supabase
            .from('veiculo')
            .select('placa, tipologia')
            .eq('motorista_id', motorista.motorista_id)
            .limit(1)
            .maybeSingle();

          return {
            ...motorista,
            veiculo: veiculoData ? [veiculoData] : [],
          };
        })
      );
      
      // Update the column data
      setColumns(prev => prev.map(col => {
        if (col.id === status) {
          return {
            ...col,
            motoristas: motoristasWithVehicles,
            currentPage: page,
            loading: false
          };
        }
        return col;
      }));
    } catch (error) {
      console.error(`Error fetching data for ${status}:`, error);
      toast.error(`Erro ao carregar dados para ${status}`);
      
      // Reset loading state on error
      setColumns(prev => prev.map(col => 
        col.id === status ? { ...col, loading: false } : col
      ));
    }
  };

  const handleSearch = async () => {
    if (!companyId) return;
    
    try {
      setIsSearching(true);
      
      // Refresh counts and data for all columns with the search term
      // First update all counts
      await Promise.all(columns.map(column => fetchColumnCount(column.id, companyId)));
      
      // Then fetch data for all columns
      await Promise.all(columns.map(column => fetchColumnData(column.id, 1)));
      
    } catch (error) {
      console.error('Error searching:', error);
      toast.error('Erro ao buscar dados');
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = async () => {
    if (!companyId) return;
    
    setSearchTerm('');
    setDebouncedSearchTerm('');
    try {
      setIsSearching(true);
      
      // Refresh counts and data for all columns without the search term
      // First update all counts
      for (const column of columns) {
        await fetchColumnCount(column.id, companyId);
      }
      
      // Then fetch data for all columns
      for (const column of columns) {
        await fetchColumnData(column.id, 1);
      }
      
    } catch (error) {
      console.error('Error clearing search:', error);
      toast.error('Erro ao limpar busca');
    } finally {
      setIsSearching(false);
    }
  };

  const handleStartChat = (motorista: MotoristaWithDetails, e: React.MouseEvent) => {
    e.stopPropagation();
    if (motorista.telefone) {
      startChat(motorista.telefone.toString());
    } else {
      toast.error('Este motorista não possui telefone cadastrado');
    }
  };

  const handleViewDocument = async (motorista: MotoristaWithDetails) => {
    try {
      setSelectedMotorista({
        documento: null,
        nome: motorista.nome,
        endereco: null,
        veiculo: null,
        motorista_id: motorista.motorista_id,
        funcao: motorista.funcao
      });

      // Open the appropriate modal based on the motorista's function
      if (motorista.funcao === 'Agregado') {
        setIsUnifiedAgregadoModalOpen(true);
      } else {
        setIsUnifiedMotoristaModalOpen(true);
      }
    } catch (error) {
      console.error('Erro ao carregar documentos:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar documentos');
    }
  };

  const updateStatus = async (motorista_id: number, newStatus: string, oldStatus: string) => {
    if (!companyId) return; // Add guard clause
    
    try {
      const { error } = await supabase
        .from('motorista')
        .update({ st_cadastro: newStatus })
        .eq('motorista_id', motorista_id);

      if (error) throw error;
      
      // Remove from current column
      setColumns(prev => prev.map(col => {
        if (col.id === oldStatus) {
          return {
            ...col,
            motoristas: col.motoristas.filter(m => m.motorista_id !== motorista_id),
            totalCount: Math.max(0, col.totalCount - 1)
          };
        }
        return col;
      }));
      
      // Update count and refresh data for the new column
      await fetchColumnCount(newStatus, companyId);
      await fetchColumnData(newStatus, 1);
      
      toast.success('Status atualizado com sucesso');
    } catch (err) {
      toast.error('Erro ao atualizar status');
    }
  };

  const handlePageChange = async (columnId: string, newPage: number) => {
    await fetchColumnData(columnId, newPage);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    
    // Reset all columns to page 1 and reload data
    setColumns(prev => prev.map(col => ({
      ...col,
      currentPage: 1
    })));
  };

  if (loading) {
    return (
      <LoadingSpinner />
    );
  }

  const onDragStart = (e: React.DragEvent, motorista_id: number, currentStatus: string) => {
    e.dataTransfer.setData('motorista_id', motorista_id.toString());
    e.dataTransfer.setData('current_status', currentStatus);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = async (e: React.DragEvent, status: string) => {
    e.preventDefault();
    const motorista_id = Number(e.dataTransfer.getData('motorista_id'));
    const currentStatus = e.dataTransfer.getData('current_status');
    
    if (status !== currentStatus) {
      await updateStatus(motorista_id, status, currentStatus);
    }
  };

  const getStatusBadgeStyle = (funcao: string) => {
    return funcao === 'Motorista'
      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  const filterButtons = [
    { value: 'todos', label: 'Todos' },
    { value: 'Motorista', label: 'Motoristas' },
    { value: 'Agregado', label: 'Agregados' }
  ];

  return (
    <div className="space-y-4 h-[calc(100vh-12rem)]">
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter size={20} className="text-gray-400" />
            <div className="flex gap-2">
              {filterButtons.map(button => (
                <button
                  key={button.value}
                  onClick={() => setFuncaoFilter(button.value as 'todos' | 'Motorista' | 'Agregado')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    funcaoFilter === button.value
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {button.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Search input */}
          <div className="relative w-full md:w-auto md:flex-1 max-w-md">
            <input
              type="text"
              placeholder="Buscar por nome ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 
                       dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 
                       focus:border-blue-500 text-gray-900 dark:text-gray-100"
            />
            {isSearching ? (
              <div className="absolute left-3 top-2.5">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            )}
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={16} />
              </button>
            )}
          </div>
          
          {/* Items per page selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Itens por coluna:
            </span>
            <select
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
              className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
              <option value={2000}>2000</option>
              <option value={3000}>3000</option>
              <option value={5000}>5000</option>
              <option value={7000}>7000</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        <div className="flex-1 flex gap-4 overflow-x-auto pb-6">
          {columns.map((column) => (
            <div
              key={column.id}
              className="flex-shrink-0 w-[340px] flex flex-col h-[calc(100vh-20rem)]"
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, column.id)}
            >
              <div className={`rounded-t-lg ${column.color} p-4 border-x border-t ${column.borderColor} sticky top-0 z-10`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{column.title}</h3>
                  <div className="flex items-center">
                    <span className="text-sm font-medium px-2.5 py-0.5 rounded-full bg-white/50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300">
                      {column.totalCount}
                    </span>
                    {column.totalCount > itemsPerPage && (
                      <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                        (mostrando {Math.min(itemsPerPage, column.totalCount)})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className={`flex-1 ${column.color} overflow-y-auto custom-scrollbar border-x ${column.borderColor} rounded-b-lg kanban-column`}>
                {column.loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : (
                  <>
                    <div className="p-3 space-y-3 kanban-column-content">
                      {column.motoristas.length === 0 ? (
                        <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                          {searchTerm ? 'Nenhum resultado encontrado' : 'Nenhum item nesta coluna'}
                        </div>
                      ) : (
                        column.motoristas.map(motorista => (
                          <div
                            key={motorista.motorista_id}
                            className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 cursor-move hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
                            draggable
                            onDragStart={(e) => onDragStart(e, motorista.motorista_id, column.id)}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="flex-shrink-0 h-9 w-9 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                                    {motorista.funcao === 'Motorista' ? (
                                      <User className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                                    ) : (
                                      <Truck className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                                    )}
                                  </div>
                                  <div>
                                    <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                                      {motorista.nome}
                                    </h4>
                                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full mt-0.5 ${getStatusBadgeStyle(motorista.funcao)}`}>
                                      {motorista.funcao}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  {motorista.telefone && (
                                    <button 
                                      onClick={(e) => handleStartChat(motorista, e)}
                                      className="p-1 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                      title="Iniciar chat"
                                    >
                                      <MessageCircle size={16} />
                                    </button>
                                  )}
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleViewDocument(motorista);
                                    }}
                                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                  >
                                    <FileText size={16} className="text-gray-500 dark:text-gray-400" />
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 gap-1.5">
                                {motorista.telefone && (
                                  <div className="flex items-center text-gray-600 dark:text-gray-300">
                                    <Phone size={14} className="mr-1.5 text-gray-400" />
                                    <span className="text-xs truncate">{motorista.telefone}</span>
                                  </div>
                                )}

                                {motorista.funcao === 'Agregado' && motorista.veiculo?.[0] && (
                                  <div className="flex items-center text-gray-600 dark:text-gray-300">
                                    <Truck size={14} className="mr-1.5 text-gray-400" />
                                    <span className="text-xs truncate">
                                      {motorista.veiculo[0].placa} - {motorista.veiculo[0].tipologia}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    
                    {/* Pagination controls for each column */}
                    {column.totalPages > 1 && (
                      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50">
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => handlePageChange(column.id, Math.max(1, column.currentPage - 1))}
                            disabled={column.currentPage === 1}
                            className="p-1 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {column.currentPage} / {column.totalPages}
                          </span>
                          
                          <button
                            onClick={() => handlePageChange(column.id, Math.min(column.totalPages, column.currentPage + 1))}
                            disabled={column.currentPage === column.totalPages}
                            className="p-1 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <DocumentViewer
        isOpen={isDocumentViewerOpen}
        onClose={() => setIsDocumentViewerOpen(false)}
        documento={selectedMotorista.documento}
        nome={selectedMotorista.nome}
        endereco={selectedMotorista.endereco}
        veiculo={selectedMotorista.veiculo}
        isAgregado={funcaoFilter === 'Agregado'}
      />

      {/* Unified Agregado Modal */}
      <UnifiedAgregadoModal
        isOpen={isUnifiedAgregadoModalOpen}
        onClose={() => setIsUnifiedAgregadoModalOpen(false)}
        motorista={selectedMotorista.motorista_id ? { motorista_id: selectedMotorista.motorista_id, nome: selectedMotorista.nome } : null}
        onSuccess={() => {
          // Refresh data after changes
          if (companyId) {
            Promise.all(columns.map(column => fetchColumnData(column.id, column.currentPage)));
          }
        }}
      />

      {/* Unified Motorista Modal */}
      <UnifiedMotoristaModal
        isOpen={isUnifiedMotoristaModalOpen}
        onClose={() => setIsUnifiedMotoristaModalOpen(false)}
        motorista={selectedMotorista.motorista_id ? { motorista_id: selectedMotorista.motorista_id, nome: selectedMotorista.nome } : null}
        onSuccess={() => {
          // Refresh data after changes
          if (companyId) {
            Promise.all(columns.map(column => fetchColumnData(column.id, column.currentPage)));
          }
        }}
      />
    </div>
  );
};

export default ContratacaoKanban;