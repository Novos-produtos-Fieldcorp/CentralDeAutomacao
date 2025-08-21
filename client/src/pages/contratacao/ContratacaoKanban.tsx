// src/pages/contratacao/ContratacaoKanban.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Search, FilePen, MessageCircle, Filter, X, User, ChevronLeft, ChevronRight, Truck, Phone, MapPin, ChevronDown, Tag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCompanyData } from '../../hooks/useCompanyData';
import { useAuth } from '../../context/AuthContext';
import type { Motorista, Veiculo } from '../../types/database';
import { useFloatingChat } from '../../hooks/useFloatingChat';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';
import UnifiedAgregadoModal from '../../components/UnifiedAgregadoModal';
import UnifiedMotoristaModal from '../../components/UnifiedMotoristaModal';

interface MotoristaWithDetails extends Omit<Motorista, 'nome'> {
  end_motorista?: {
    id_end_motorista?: number;
    cidade?: string | null;
    estado?: string | null;
    sigla_estado?: string | null;
    logradouro?: string | null;
    nr_end?: number | null;
    ds_complemento_end?: string | null;
    bairro?: string | null;
    nr_cep?: string | null;
  };
  nome_cliente?: string | null;
  veiculo?: Veiculo[];
  documento_motorista?: any[];
  endereco?: any;
  nome: string | null; // Sobrescrevendo o tipo de nome para permitir null
  nome_cidade?: string | null;
  sigla_estado?: string | null;
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
  const { companyId } = useCompanyData();
  const { startChat } = useFloatingChat();
  // Usando o hook de autenticação
  useAuth(); // Apenas para garantir que o usuário está autenticado
  
  const [loading, setLoading] = useState(true);
  const [funcaoFilter, setFuncaoFilter] = useState<'todos' | 'Motorista' | 'Agregado'>('todos');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedMotorista, setSelectedMotorista] = useState<MotoristaWithDetails | null>(null);
  
  // Advanced filters states
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [cidadeFilter, setCidadeFilter] = useState<string[]>([]);
  const [clienteFilter, setClienteFilter] = useState<string[]>([]);
  const [ativoFilter, setAtivoFilter] = useState('');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  
  // Dropdown states
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showCidadeDropdown, setShowCidadeDropdown] = useState(false);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [showAtivoDropdown, setShowAtivoDropdown] = useState(false);
  const [showTagsDropdown, setShowTagsDropdown] = useState(false);
  
  // Data for dropdowns
  const [cidades, setCidades] = useState<Array<{nome_cidade: string}>>([]);
  const [clientes, setClientes] = useState<Array<{cliente_id: number, nome: string}>>([]);
  const [tags, setTags] = useState<Array<{id: number, nome: string}>>([]);
  
  // Refs for dropdown positioning
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const cidadeDropdownRef = useRef<HTMLDivElement>(null);
  const clienteDropdownRef = useRef<HTMLDivElement>(null);
  const ativoDropdownRef = useRef<HTMLDivElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  
  // Estados para os modais
  const [isUnifiedAgregadoModalOpen, setIsUnifiedAgregadoModalOpen] = useState(false);
  const [isUnifiedMotoristaModalOpen, setIsUnifiedMotoristaModalOpen] = useState(false);

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
      id: 'gestao_risco', 
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

  const fetchColumnCount = async (status: string, companyId: number) => {
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
      console.log('Buscando dados para status:', status);
      // Calculate pagination parameters
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      
      // Build the query with filters using the complete view
      let query = supabase
        .from('vw_motoristas_completo')
        .select(`
          motorista_id,
          nome_motorista as nome,
          funcao,
          st_cadastro,
          telefone,
          email,
          data_cadastro,
          cpf,
          dt_nascimento,
          genero,
          origem_usuario,
          autorizacao_lgpd,
          company_id,
          cliente_id,
          ativo,
          nome_cidade,
          nome_estado,
          sigla_estado,
          logradouro,
          nr_end,
          ds_complemento_end,
          nome_bairro,
          nr_cep
        `)
        .eq('st_cadastro', status)
        .eq('company_id', companyId);

      // Apply function filter if not 'todos'
      if (funcaoFilter !== 'todos') {
        // FIX: Use eq instead of or for filtering by function
        query = query.eq('funcao', funcaoFilter);
      }
      
      // Apply search filter if provided
      if (debouncedSearchTerm) {
        query = query.or(`nome_motorista.ilike.%${debouncedSearchTerm}%,cpf.ilike.%${debouncedSearchTerm}%`);
      }
      
      // Apply sorting by data_cadastro (newest first)
      query = query.order('data_cadastro', { ascending: false });
      
      // Apply pagination
      query = query.range(from, to);
      
      // Primeiro, buscar apenas os dados básicos dos motoristas
      console.log('Executando query para motoristas...');
      
      // First, get data from vw_motoristas_completo
      let motoristasData: any[] = [];
      
      try {
        const { data: motoristasData1, error: error1 } = await query.select('*');
        
        if (error1) {
          console.error('Erro na consulta de motoristas (vw_motoristas_completo):', error1);
          throw error1;
        }
        
        motoristasData = motoristasData1 || [];
        
        // If we're looking for agregados or all, also check vw_agregados_completo
        if (funcaoFilter === 'Agregado' || funcaoFilter === 'todos') {
          let agregadosQuery = supabase
            .from('vw_agregados_completo')
            .select('*')
            .eq('st_cadastro', status)
            .eq('company_id', companyId);
            
          // Always filter for Agregado in this view
          agregadosQuery = agregadosQuery.eq('funcao', 'Agregado');
          
          // Apply search filter if provided
          if (debouncedSearchTerm) {
            agregadosQuery = agregadosQuery.or(
              `nome_motorista.ilike.%${debouncedSearchTerm}%,cpf.ilike.%${debouncedSearchTerm}%`
            );
          }
          
          // Apply sorting by data_cadastro (newest first)
          agregadosQuery = agregadosQuery.order('data_cadastro', { ascending: false });
          
          // Apply pagination
          agregadosQuery = agregadosQuery.range(from, to);
          
          const { data: agregadosData, error: error2 } = await agregadosQuery;
          
          if (error2) {
            console.error('Erro na consulta de agregados (vw_agregados_completo):', error2);
            // Don't throw here, we still have motoristas data
          } else if (agregadosData && agregadosData.length > 0) {
            // Merge the results, ensuring we don't have duplicates
            const existingIds = new Set(motoristasData.map(m => m.motorista_id));
            const newAgregados = agregadosData.filter((a: any) => !existingIds.has(a.motorista_id));
            motoristasData = [...motoristasData, ...newAgregados];
          }
        }
      } catch (err) {
        const error = err as {
          message: string;
          details?: string;
          hint?: string;
          code?: string;
        };
        console.error('Erro ao buscar dados:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
      
      console.log('Dados de motoristas recebidos para', status, ':', motoristasData);
      
      if (!motoristasData || motoristasData.length === 0) {
        console.warn('Nenhum motorista encontrado para o status:', status);
        // Atualizar a coluna com array vazio
        setColumns(prev => prev.map(col => 
          col.id === status 
            ? { ...col, motoristas: [], loading: false, totalCount: 0 } 
            : col
        ));
        return;
      }
      
      // Já temos todos os dados necessários da view, incluindo endereços
      const motoristasComEndereco = motoristasData.map((motorista: any) => {
        // Extrair o primeiro nome para exibição
        const primeiroNome = motorista.nome_motorista ? motorista.nome_motorista.split(' ')[0] : '';
        
        return {
          ...motorista,
          nome: motorista.nome_motorista, // Garantir que o nome está mapeado corretamente
          // Mapeando os campos da view para os nomes esperados pelo componente
          cidade: motorista.nome_cidade,
          estado: motorista.nome_estado,
          sigla_estado: motorista.sigla_estado,
          bairro: motorista.nome_bairro,
          end_motorista: {
            logradouro: motorista.logradouro,
            nr_end: motorista.nr_end,
            ds_complemento_end: motorista.ds_complemento_end,
            bairro: motorista.nome_bairro,
            cidade: motorista.nome_cidade,
            estado: motorista.nome_estado,
            sigla_estado: motorista.sigla_estado,
            nr_cep: motorista.nr_cep
          },
          primeiroNome // Adicionando o primeiro nome para exibição
        };
      });
      
      console.log('Motoristas com endereços:', motoristasComEndereco);
      
      // Buscar clientes em uma consulta separada
      const clienteIds = [...new Set(motoristasComEndereco
        .filter((m: any) => m.cliente_id)
        .map((m: any) => m.cliente_id)
      )];
      
      console.log('Buscando clientes com IDs:', clienteIds);
      
      let clientesData: any[] = [];
      if (clienteIds.length > 0) {
        const { data: clientes, error: clientesError } = await supabase
          .from('cliente')
          .select('cliente_id, nome')
          .in('cliente_id', clienteIds);
          
        if (clientesError) {
          console.error('Erro ao buscar clientes:', clientesError);
        } else {
          clientesData = clientes || [];
          console.log('Clientes encontrados:', clientesData);
        }
      }
      
      // Criar um mapa de cliente_id para nome do cliente
      const clienteMap = clientesData.reduce((acc: Record<number, string>, cliente: any) => {
        acc[cliente.cliente_id] = cliente.nome;
        return acc;
      }, {});
      
      // Buscar veículos e montar dados finais
      const motoristasWithVehicles = await Promise.all(
        motoristasComEndereco.map(async (motorista: any) => {
          const { data: veiculoData } = await supabase
            .from('veiculo')
            .select('*')
            .eq('motorista_id', motorista.motorista_id)
            .limit(1)
            .maybeSingle();

          // Encontrar o nome do cliente usando o mapa
          const nomeCliente = motorista.cliente_id ? clienteMap[motorista.cliente_id] : null;
          
          return {
            ...motorista,
            veiculo: veiculoData ? [{
              veiculo_id: veiculoData.veiculo_id,
              placa: veiculoData.placa,
              status_veiculo: veiculoData.status_veiculo,
              marca: veiculoData.marca,
              modelo: veiculoData.modelo,
              tipologia: veiculoData.tipologia,
              ano: veiculoData.ano,
              combustivel: veiculoData.combustivel,
              peso: veiculoData.peso,
              cubagem: veiculoData.cubagem,
              possui_rastreador: veiculoData.possui_rastreador,
              marca_rastreador: veiculoData.marca_rastreador,
              motorista_id: veiculoData.motorista_id,
              cor: veiculoData.cor,
              tipo: veiculoData.tipo,
              company_id: veiculoData.company_id
            }] : [],
            nome_cidade: motorista.end_motorista?.[0]?.cidade || null,
            sigla_estado: motorista.end_motorista?.[0]?.sigla_estado || null,
            nome_cliente: nomeCliente || null
          };
        })
      );
      
      console.log('Motoristas com veículos:', motoristasWithVehicles);
      
      // Update the column data
      console.log('Atualizando coluna', status, 'com', motoristasWithVehicles.length, 'itens');
      setColumns((prev: any[]) => prev.map((col: any) => {
        if (col.id === status) {
          return {
            ...col,
            motoristas: motoristasWithVehicles,
            totalCount: motoristasWithVehicles.length, // Atualiza a contagem total
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

  const handleStartChat = (motorista: MotoristaWithDetails) => {
    if (!motorista?.telefone) {
      toast.error('Número de telefone não disponível para este motorista');
      return;
    }
    
    // Usando a assinatura correta do startChat com motorista ID
    startChat(motorista.telefone.toString(), motorista.nome, motorista.motorista_id);
  };

  const handleViewDocument = (motorista: MotoristaWithDetails) => {
    if (!motorista) return;
    
    // Usando o motorista diretamente, já que a interface já está correta
    setSelectedMotorista(motorista);
    
    if (motorista.funcao === 'Agregado') {
      setIsUnifiedAgregadoModalOpen(true);
    } else {
      setIsUnifiedMotoristaModalOpen(true);
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
      
      console.log(`Status updated: motorista ${motorista_id} from ${oldStatus} to ${newStatus}`);
      
      // Reset the destination column to page 1 to ensure the moved item is visible
      setColumns(prev => prev.map(col => {
        if (col.id === newStatus) {
          return { ...col, currentPage: 1 };
        }
        return col;
      }));
      
      // Reload all columns with correct pages
      for (const column of columns) {
        const pageToLoad = column.id === newStatus ? 1 : column.currentPage;
        await fetchColumnCount(column.id, companyId);
        await fetchColumnData(column.id, pageToLoad);
      }
      
      toast.success('Status atualizado com sucesso');
    } catch (err) {
      console.error('Error updating status:', err);
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

  // Advanced filter functions
  const fetchCidades = async () => {
    if (!companyId) return;
    try {
      const { data, error } = await supabase
        .from('end_motorista')
        .select('nome_cidade')
        .eq('company_id', companyId)
        .not('nome_cidade', 'is', null)
        .order('nome_cidade');

      if (error) throw error;
      const uniqueCidades = Array.from(new Set(data.map(item => item.nome_cidade))).map(nome_cidade => ({ nome_cidade }));
      setCidades(uniqueCidades);
    } catch (error) {
      console.error('Erro ao carregar cidades:', error);
    }
  };

  const fetchClientes = async () => {
    if (!companyId) return;
    try {
      const { data, error } = await supabase
        .from('cliente')
        .select('cliente_id, nome')
        .eq('company_id', companyId)
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  // Load filter data on mount
  useEffect(() => {
    if (companyId) {
      fetchCidades();
      fetchClientes();
      // fetchTags(); // Temporarily disabled
    }
  }, [companyId]);

  // Dropdown control functions
  const handleToggleStatusDropdown = () => setShowStatusDropdown(!showStatusDropdown);
  const handleToggleCidadeDropdown = () => setShowCidadeDropdown(!showCidadeDropdown);
  const handleToggleClienteDropdown = () => setShowClienteDropdown(!showClienteDropdown);
  const handleToggleAtivoDropdown = () => setShowAtivoDropdown(!showAtivoDropdown);
  const handleToggleTagDropdown = () => setShowTagsDropdown(!showTagsDropdown);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false);
      }
      if (cidadeDropdownRef.current && !cidadeDropdownRef.current.contains(event.target as Node)) {
        setShowCidadeDropdown(false);
      }
      if (clienteDropdownRef.current && !clienteDropdownRef.current.contains(event.target as Node)) {
        setShowClienteDropdown(false);
      }
      if (ativoDropdownRef.current && !ativoDropdownRef.current.contains(event.target as Node)) {
        setShowAtivoDropdown(false);
      }
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setShowTagsDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clear all filters function
  const clearAllFilters = () => {
    setStatusFilter([]);
    setCidadeFilter([]);
    setClienteFilter([]);
    setAtivoFilter('');
    setTagFilter([]);
    setFuncaoFilter('todos');
    setSearchTerm('');
    setDebouncedSearchTerm('');
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



  const filterButtons = [
    { value: 'todos', label: 'Todos' },
    { value: 'Motorista', label: 'Motoristas' },
    { value: 'Agregado', label: 'Agregados' }
  ];

  return (
    <div className="space-y-4 h-[calc(100vh-12rem)]">
      {/* Modern Search and Filter Section */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 rounded-xl shadow-lg border border-purple-200 dark:border-gray-600">
        {/* Search Bar */}
        <div className="p-6 border-b border-purple-200 dark:border-gray-600">
          <div className="relative max-w-2xl">
            <input
              type="text"
              placeholder="🔍 Buscar por nome, CPF, telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-12 py-3 text-base bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-2 border-purple-300 dark:border-gray-500 rounded-xl focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 text-gray-900 dark:text-gray-100 transition-all duration-300 shadow-sm"
            />
            {isSearching ? (
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-500 border-t-transparent"></div>
              </div>
            ) : (
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            )}
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Advanced Filters */}
        <div className="px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Function Filter - Keep existing functionality */}
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo:</span>
              <div className="flex gap-2">
                {filterButtons.map(button => (
                  <button
                    key={button.value}
                    onClick={() => setFuncaoFilter(button.value as 'todos' | 'Motorista' | 'Agregado')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      funcaoFilter === button.value
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 shadow-sm'
                        : 'bg-white/60 text-gray-600 hover:bg-white hover:shadow-sm dark:bg-gray-700/60 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {button.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Status Filter */}
            <div className="relative" ref={statusDropdownRef}>
              <button
                type="button"
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9 w-[120px] justify-between"
                onClick={handleToggleStatusDropdown}
              >
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>
                    {statusFilter.length === 0 ? 'Status' : `Status (${statusFilter.length})`}
                  </span>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${showStatusDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showStatusDropdown && (
                <div className="absolute z-[99999] top-full mt-1 w-64 bg-white dark:bg-gray-700 shadow-xl rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto">
                  <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Selecionar status</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatusFilter([]);
                        }}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                  {columns.map(column => (
                    <div key={column.id} className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 mr-2"
                          checked={statusFilter.includes(column.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setStatusFilter([...statusFilter, column.id]);
                            } else {
                              setStatusFilter(statusFilter.filter(id => id !== column.id));
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-200">{column.title}</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cidade Filter */}
            <div className="relative" ref={cidadeDropdownRef}>
              <button
                type="button"
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9 w-[110px] justify-between"
                onClick={handleToggleCidadeDropdown}
              >
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>
                    {cidadeFilter.length === 0 ? 'Cidade' : `Cidade (${cidadeFilter.length})`}
                  </span>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${showCidadeDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showCidadeDropdown && (
                <div className="absolute z-[99999] top-full mt-1 w-64 bg-white dark:bg-gray-700 shadow-xl rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto">
                  <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Selecionar cidades</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCidadeFilter([]);
                        }}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                  {cidades.map(cidade => (
                    <div key={cidade.nome_cidade} className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 mr-2"
                          checked={cidadeFilter.includes(cidade.nome_cidade)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCidadeFilter([...cidadeFilter, cidade.nome_cidade]);
                            } else {
                              setCidadeFilter(cidadeFilter.filter(c => c !== cidade.nome_cidade));
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-200">{cidade.nome_cidade}</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cliente Filter */}
            <div className="relative" ref={clienteDropdownRef}>
              <button
                type="button"
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9 w-[110px] justify-between"
                onClick={handleToggleClienteDropdown}
              >
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>
                    {clienteFilter.length === 0 ? 'Cliente' : `Cliente (${clienteFilter.length})`}
                  </span>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${showClienteDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showClienteDropdown && (
                <div className="absolute z-[99999] top-full mt-1 w-64 bg-white dark:bg-gray-700 shadow-xl rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto">
                  <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Selecionar clientes</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setClienteFilter([]);
                        }}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                  <div className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 mr-2"
                        checked={clienteFilter.includes('0')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setClienteFilter([...clienteFilter, '0']);
                          } else {
                            setClienteFilter(clienteFilter.filter(id => id !== '0'));
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-200">Sem cliente</span>
                    </label>
                  </div>
                  {clientes.map(cliente => (
                    <div key={cliente.cliente_id} className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 mr-2"
                          checked={clienteFilter.includes(cliente.cliente_id.toString())}
                          onChange={(e) => {
                            const clienteId = cliente.cliente_id.toString();
                            if (e.target.checked) {
                              setClienteFilter([...clienteFilter, clienteId]);
                            } else {
                              setClienteFilter(clienteFilter.filter(id => id !== clienteId));
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-200">{cliente.nome}</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Status Ativo Filter */}
            <div className="relative" ref={ativoDropdownRef}>
              <button
                type="button"
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9 w-[100px] justify-between"
                onClick={handleToggleAtivoDropdown}
              >
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>
                    {!ativoFilter ? 'Ativo' : ativoFilter === 'ativo' ? 'Ativo (Sim)' : 'Ativo (Não)'}
                  </span>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${showAtivoDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showAtivoDropdown && (
                <div className="absolute z-[99999] top-full mt-1 w-48 bg-white dark:bg-gray-700 shadow-xl rounded-md py-1 border border-gray-200 dark:border-gray-600">
                  <div 
                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 ${!ativoFilter ? 'bg-purple-50 dark:bg-purple-900/30' : ''}`}
                    onClick={() => {
                      setAtivoFilter('');
                      setShowAtivoDropdown(false);
                    }}
                  >
                    Todos
                  </div>
                  <div 
                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 ${ativoFilter === 'ativo' ? 'bg-purple-50 dark:bg-purple-900/30' : ''}`}
                    onClick={() => {
                      setAtivoFilter('ativo');
                      setShowAtivoDropdown(false);
                    }}
                  >
                    Somente Ativos
                  </div>
                  <div 
                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 ${ativoFilter === 'inativo' ? 'bg-purple-50 dark:bg-purple-900/30' : ''}`}
                    onClick={() => {
                      setAtivoFilter('inativo');
                      setShowAtivoDropdown(false);
                    }}
                  >
                    Somente Inativos
                  </div>
                </div>
              )}
            </div>

            {/* Items per page selector */}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Itens por coluna:
              </span>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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

            {/* Clear all filters button */}
            {(statusFilter.length > 0 || cidadeFilter.length > 0 || clienteFilter.length > 0 || ativoFilter || funcaoFilter !== 'todos' || searchTerm) && (
              <button
                onClick={clearAllFilters}
                className="px-3 py-2 text-sm bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50 rounded-md transition-colors flex items-center gap-2"
              >
                <X size={16} />
                Limpar Filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Kanban Board Container */}
      <div className="flex-1 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex gap-4 overflow-x-auto overflow-y-hidden h-full"
             style={{ minHeight: 'calc(100vh - 25rem)' }}>
          {columns.map((column) => (
            <div
              key={column.id}
              className="flex-shrink-0 w-[340px] flex flex-col h-full max-h-full"
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

              <div className={`flex-1 ${column.color} overflow-y-auto custom-scrollbar border-x border-b ${column.borderColor} rounded-b-lg kanban-column`}>
                {column.loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : (
                  <>
                    <div className="p-3 space-y-3 kanban-column-content min-h-0">
                      {column.motoristas.length === 0 ? (
                        <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                          {searchTerm ? 'Nenhum resultado encontrado' : 'Nenhum item nesta coluna'}
                        </div>
                      ) : (
                        column.motoristas.map((motorista, index) => (
                          <div
                            key={`${motorista.motorista_id}-${motorista.st_cadastro}-${index}`}
                            className="group bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 cursor-move hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col"
                            draggable
                            onDragStart={(e) => onDragStart(e, motorista.motorista_id, column.id)}
                          >
                            {/* Cabeçalho com nome e função */}
                            <div className="mb-2">
                              <div className="flex items-start gap-2">
                                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                                  motorista.funcao === 'Agregado' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
                                }`}>
                                  {motorista.funcao === 'Agregado' ? (
                                    <Truck className="h-4 w-4 text-green-600 dark:text-green-400" />
                                  ) : (
                                    <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={motorista.nome || ''}>
                                    {motorista.nome}
                                  </h4>
                                  <div className="mt-1">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                      motorista.funcao === 'Agregado' 
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' 
                                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200'
                                    }`}>
                                      {motorista.funcao}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Informações do motorista */}
                            <div className="space-y-2 mt-1">
                              {motorista.end_motorista?.cidade && (
                                <div className="flex items-center text-xs text-gray-600 dark:text-gray-300">
                                  <MapPin size={12} className="mr-1.5 text-gray-400 flex-shrink-0" />
                                  <span className="truncate">
                                    {motorista.end_motorista.cidade} - {motorista.end_motorista.sigla_estado}
                                  </span>
                                </div>
                              )}

                              {motorista.telefone && (
                                <div className="flex items-center text-xs text-gray-600 dark:text-gray-300">
                                  <Phone size={12} className="mr-1.5 text-gray-400 flex-shrink-0" />
                                  <a 
                                    href={`tel:${motorista.telefone}`} 
                                    className="hover:text-blue-500 hover:underline truncate"
                                    onClick={(e) => e.stopPropagation()}
                                    title={`Ligar para ${motorista.telefone}`}
                                  >
                                    {motorista.telefone}
                                  </a>
                                </div>
                              )}

                              {motorista.funcao === 'Agregado' && motorista.veiculo?.[0] && (
                                <div className="flex items-center text-xs text-gray-600 dark:text-gray-300">
                                  <Truck size={12} className="mr-1.5 text-gray-400 flex-shrink-0" />
                                  <span className="truncate">
                                    {motorista.veiculo[0].placa} - {motorista.veiculo[0].marca} {motorista.veiculo[0].modelo}
                                  </span>
                                </div>
                              )}

                              {motorista.nome_cliente && (
                                <div className="pt-1">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200 truncate max-w-full">
                                    {motorista.nome_cliente}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Botões de ação */}
                            <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                Data de cadastro: {motorista.data_cadastro ? new Date(motorista.data_cadastro).toLocaleDateString('pt-BR') : 'N/A'}
                              </div>
                              <div className="flex items-center gap-1">
                                {motorista.telefone && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartChat(motorista);
                                    }}
                                    className="p-1 text-gray-400 hover:text-blue-500 transition-colors rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                    title="Iniciar chat"
                                  >
                                    <MessageCircle size={14} className="text-green-500" />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewDocument(motorista);
                                  }}
                                  className="p-1 text-gray-400 hover:text-blue-500 transition-colors rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                  title="Ver documentos"
                                >
                                  <FilePen size={14} className="text-blue-500" />
                                </button>
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

{/* Unified Agregado Modal */}
      <UnifiedAgregadoModal
        isOpen={isUnifiedAgregadoModalOpen}
        onClose={() => setIsUnifiedAgregadoModalOpen(false)}
        motorista={selectedMotorista!}
        onSuccess={() => {
          // Atualizar a lista após alguma alteração
          columns.forEach(column => {
            fetchColumnData(column.id, column.currentPage);
          });
        }}
      />

      {/* Unified Motorista Modal */}
      <UnifiedMotoristaModal
        isOpen={isUnifiedMotoristaModalOpen}
        onClose={() => setIsUnifiedMotoristaModalOpen(false)}
        motorista={selectedMotorista!}
        onSuccess={() => {
          // Atualizar a lista após alguma alteração
          columns.forEach(column => {
            fetchColumnData(column.id, column.currentPage);
          });
        }}
      />
    </div>
  );
};

export default ContratacaoKanban;