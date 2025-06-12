import React, { useEffect, useState, useRef, useCallback } from 'react';

import { Edit2, Trash2, Search, Phone, Filter, MapPin, Plus, Store, MessageCircle, MessageSquare, Users, Building2, Truck, FilePen, Upload } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { supabase } from '../../lib/supabase';
import type { Motorista } from '../../types/database';
import DocumentViewer from '../../components/DocumentViewer';
import toast from 'react-hot-toast';
import { formatCPF, formatPhone } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';
import ScrollableTableIndicator from '../../components/ScrollableTableIndicator';
import ContextMenu from '../../components/ContextMenu';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import AgregadoDetailView from '../../components/AgregadoDetailView';
import { useFloatingChat } from '../../hooks/useFloatingChat';
import BulkActionsModal from '../../components/BulkActionsModal';
import MassMessageModal from '../../components/MassMessageModal';
import AddAgregadoModal from '../../components/AddAgregadoModal';
import UnifiedAgregadoModal from '../../components/UnifiedAgregadoModal';
import { useAuth } from '../../context/AuthContext';

interface MotoristaWithAddress extends Omit<Motorista, 'telefone' | 'autorizacao_lgpd' | 'cliente_id' | 'documento_motorista'> {
  telefone?: string | number;
  autorizacao_lgpd?: string;
  cidade?: string;
  cidadeLowerCase?: string;
  estado?: {
    sigla_estado: string;
  };
  cliente_id?: number | null;
  documento_motorista?: DocumentoMotorista | null;
  ativo: boolean;
  veiculo?: Array<{
    placa: string;
    marca: string;
    tipo: string;
    tipologia: string;
  }>;
}

interface ViewAgregado {
  motorista_id: number;
  nome_motorista: string;
  cpf: string;
  dt_nascimento: string;
  genero: string;
  telefone: string;
  email: string;
  funcao: string;
  origem_usuario: string;
  st_cadastro: string;
  autorizacao_lgpd: boolean;
  company_id: number;
  data_cadastro: string;
  cliente_id: number | null;
  conversation_id: string;
  nome_cidade: string | null;
  sigla_estado: string | null;
  veiculo_id: number | null;
  placa: string | null;
  status_veiculo: string | null;
  marca_veiculo: string | null;
  tipologia: string | null;
  ano: number | null;
  combustivel: string | null;
  peso: number | null;
  cubagem: number | null;
  possui_rastreador: boolean | null;
  marca_rastreador: string | null;
  cor: string | null;
  tipo: string | null;
  ativo: boolean;
}

interface City {
  cidade: string;
  estado: {
    sigla_estado: string;
  };
}

interface CityResponse {
  cidade: string;
  estado: {
    sigla_estado: string;
  };
}

interface DashboardData {
  name: string;
  count: number;
}

const AgregadosLista = () => {
  const { query, companyId } = useCompanyData();
  const { startChat } = useFloatingChat();
  const { accountId } = useAuth();
  const [motoristas, setMotoristas] = useState<MotoristaWithAddress[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [debouncedPhoneSearch, setDebouncedPhoneSearch] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<number>(0);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedVehicleType, setSelectedVehicleType] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ startDate: string | null; endDate: string | null }>({
    startDate: null,
    endDate: null
  });
  const [cities, setCities] = useState<City[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<string[]>([]);
  const [funcaoFilter, setFuncaoFilter] = useState<'todos' | 'Motorista' | 'Agregado'>('todos');
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [isAgregadoDetailOpen, setIsAgregadoDetailOpen] = useState(false);
  const [isUnifiedModalOpen, setIsUnifiedModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedMotorista, setSelectedMotorista] = useState<MotoristaWithAddress | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [isMassMessageModalOpen, setIsMassMessageModalOpen] = useState(false);
  const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false);
  const [isBulkClientModalOpen, setIsBulkClientModalOpen] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    motorista: MotoristaWithAddress | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    motorista: null,
  });
  const [selectedDocumento, setSelectedDocumento] = useState<{
    documento: any | null;
    nome: string;
    cpf?: string;
    email?: string;
    telefone?: string;
    dt_nascimento?: string;
    endereco: any;
    veiculo: any | null;
    agregado?: MotoristaWithAddress | null;
  }>({ documento: null, nome: '', endereco: null, veiculo: null });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData[]>([]);

  // Debounce search terms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 1000);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPhoneSearch(phoneSearch);
    }, 1000);

    return () => clearTimeout(timer);
  }, [phoneSearch]);

  // Effect to handle search when debounced terms change
  useEffect(() => {
    if (companyId) {
      const loadData = async () => {
        try {
          setIsSearching(true);
          await fetchMotoristas();
        } catch (error) {
          console.error('Error loading data:', error);
          toast.error('Erro ao carregar dados');
        } finally {
          setIsSearching(false);
        }
      };
      loadData();
    }
  }, [debouncedSearchTerm, debouncedPhoneSearch, selectedStatus, selectedCity, selectedClient, selectedVehicleType, funcaoFilter, currentPage, pageSize, dateRange]);

  useEffect(() => {
    if (companyId) {
      const loadInitialData = async () => {
        try {
          setLoading(true);
          await Promise.all([
            fetchMotoristas(),
            fetchClientes(),
            fetchCities(),
            fetchVehicleTypes(),
            fetchDashboardData()
          ]);
        } catch (error) {
          console.error('Error loading initial data:', error);
          toast.error('Erro ao carregar dados iniciais');
        } finally {
          setLoading(false);
        }
      };
      loadInitialData();
    }
  }, [companyId]);

  useEffect(() => {
    // Close context menu when clicking anywhere
    const handleClick = () => {
      if (contextMenu.visible) {
        setContextMenu({ ...contextMenu, visible: false });
      }
    };

    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [contextMenu.visible]);

  const fetchMotoristas = async () => {
    try {
      if (currentPage === 1 && !debouncedSearchTerm && !debouncedPhoneSearch && !selectedStatus && !selectedCity && !selectedClient && !selectedVehicleType) {
        setLoading(true);
      }
      
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      
      // Build the query with all filters
      let query = supabase
        .from('vw_agregados_completo')
        .select('*', { count: 'exact' })
        .eq('company_id', companyId)
        .eq('funcao', 'Agregado');

      if (selectedStatus) {
        query = query.eq('st_cadastro', selectedStatus);
      }

      if (dateRange.startDate && dateRange.endDate) {
        query = query
          .gte('data_cadastro', dateRange.startDate)
          .lte('data_cadastro', dateRange.endDate);
      }

      // Apply search filter if provided
      if (debouncedSearchTerm) {
        query = query.or(`nome_motorista.ilike.%${debouncedSearchTerm}%,cpf.ilike.%${debouncedSearchTerm}%,placa.ilike.%${debouncedSearchTerm}%`);
      }

      // Apply city filter if selected
      if (selectedCity) {
        query = query.ilike('nome_cidade', selectedCity);
      }

      // Apply client filter if selected
      if (selectedClient) {
        query = query.eq('cliente_id', selectedClient);
      }

      // Apply vehicle type filter if selected
      if (selectedVehicleType) {
        query = query.eq('tipologia', selectedVehicleType);
      }

      // Apply pagination
      query = query
        .order('data_cadastro', { ascending: false })
        .range(from, to);

      // Execute the query
      const { data, error, count } = await query;

      if (error) throw error;

      // Process the data
      let motoristasData = (data as ViewAgregado[])?.map(motorista => ({
        motorista_id: motorista.motorista_id,
        nome: motorista.nome_motorista,
        cpf: motorista.cpf,
        dt_nascimento: motorista.dt_nascimento,
        genero: motorista.genero,
        telefone: motorista.telefone,
        email: motorista.email,
        funcao: motorista.funcao,
        origem_usuario: motorista.origem_usuario,
        st_cadastro: motorista.st_cadastro,
        autorizacao_lgpd: motorista.autorizacao_lgpd,
        company_id: motorista.company_id,
        data_cadastro: motorista.data_cadastro,
        cliente_id: motorista.cliente_id || 0,
        conversation_id: motorista.conversation_id,
        cidade: motorista.nome_cidade || 'Não informada',
        cidadeLowerCase: motorista.nome_cidade?.toLowerCase() || '',
        estado: motorista.sigla_estado || '',
        ativo: motorista.ativo,
        veiculo: motorista.veiculo_id ? [{
          veiculo_id: motorista.veiculo_id,
          placa: motorista.placa || '',
          status_veiculo: motorista.status_veiculo || '',
          marca: motorista.marca_veiculo || '',
          tipologia: motorista.tipologia || '',
          ano: motorista.ano || 0,
          combustivel: motorista.combustivel || '',
          peso: motorista.peso || 0,
          cubagem: motorista.cubagem || 0,
          possui_rastreador: motorista.possui_rastreador || false,
          marca_rastreador: motorista.marca_rastreador || '',
          cor: motorista.cor || '',
          tipo: motorista.tipo || ''
        }] : undefined
      })) as unknown as MotoristaWithAddress[];

      // Log the processed data
      console.log('Processed data:', motoristasData);

      // Apply phone filter on frontend
      let filteredData = motoristasData;
      if (debouncedPhoneSearch) {
        const phoneSearchLower = debouncedPhoneSearch.toLowerCase().replace(/[()\-\s]/g, '');
        filteredData = motoristasData.filter(motorista => {
          const phoneStr = motorista.telefone?.toString().replace(/[()\-\s]/g, '') || '';
          return phoneStr.toLowerCase().includes(phoneSearchLower);
        });
      }

      // Create a Map to deduplicate motoristas by motorista_id
      const uniqueMotoristas = new Map();
      filteredData.forEach(motorista => {
        uniqueMotoristas.set(motorista.motorista_id, motorista);
      });

      // Convert Map back to array
      const deduplicatedMotoristas = Array.from(uniqueMotoristas.values());

      // Update total count based on filtered data
      const filteredCount = count || deduplicatedMotoristas.length;
      setTotalCount(filteredCount);
      setTotalPages(Math.max(1, Math.ceil(filteredCount / pageSize)));

      setMotoristas(deduplicatedMotoristas);
    } catch (error) {
      console.error('Error fetching motoristas:', error);
      toast.error('Erro ao carregar agregados');
    } finally {
      setLoading(false);
    }
  };

  const fetchClientes = async () => {
    try {
      const { data, error } = await supabase.from('cliente')
        .select('*')
        .eq('st_cliente', true)
        .eq('company_id', companyId)
        .order('nome');

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error('Error fetching clientes:', error);
      toast.error('Erro ao carregar clientes');
    }
  };

  const fetchCities = async () => {
    try {
      const { data, error } = await supabase
        .from('cidade')
        .select(`
          cidade,
          estado!inner (
            sigla_estado
          )
        `)
        .order('cidade');

      if (error) throw error;
      
      const typedData = data.map(city => ({
        cidade: city.cidade,
        estado: {
          sigla_estado: Array.isArray(city.estado) ? city.estado[0]?.sigla_estado || '' : city.estado?.sigla_estado || ''
        }
      })) as City[];
      
      setCities(typedData);
    } catch (error) {
      console.error('Error fetching cities:', error);
      toast.error('Erro ao carregar cidades');
    }
  };

  const fetchVehicleTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('veiculo')
        .select('tipologia')
        .eq('company_id', companyId)
        .not('tipologia', 'is', null)
        .not('tipologia', 'eq', '')
        .order('tipologia');

      if (error) throw error;
      
      const uniqueTypes = [...new Set(data?.map((v: { tipologia: string }) => v.tipologia) || [])].sort();
      setVehicleTypes(uniqueTypes);
    } catch (error) {
      console.error('Error fetching vehicle types:', error);
      toast.error('Erro ao carregar tipos de veículos');
    }
  };

  const fetchDashboardData = async () => {
    try {
      const { data, error } = await supabase
        .from('motorista')
        .select('st_cadastro')
        .eq('company_id', companyId)
        .eq('funcao', 'Agregado');

      if (error) throw error;

      // Group the data manually on the client side
      const statusCounts: { [key: string]: number } = {};
      (data || []).forEach(item => {
        statusCounts[item.st_cadastro] = (statusCounts[item.st_cadastro] || 0) + 1;
      });

      const formattedData = Object.entries(statusCounts).map(([status, count]) => ({
        name: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
        count
      }));

      setDashboardData(formattedData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Erro ao carregar dados do dashboard');
    }
  };

  const handleOpenMassMessageModal = () => {
    const selectedNumbers = motoristas
      .filter(m => selectedItems.has(m.motorista_id))
      .map(m => m.telefone?.toString() || '')
      .filter(num => num !== '');
    
    if (selectedNumbers.length === 0) {
      toast.error('Selecione pelo menos um agregado com telefone cadastrado');
      return;
    }
    
    setIsMassMessageModalOpen(true);
  };

  const handleStartChat = (motorista: MotoristaWithAddress) => {
    if (motorista.telefone) {
      startChat(motorista.telefone.toString());
    } else {
      toast.error('Este agregado não possui telefone cadastrado');
    }
  };

  const handleViewUnifiedModal = (motorista: MotoristaWithAddress) => {
    setSelectedMotorista(motorista);
    setIsUnifiedModalOpen(true);
  };

  const handleViewAgregadoDetail = async (motorista: MotoristaWithAddress) => {
    try {
      setSelectedDocumento({
        agregado: motorista,
        documento: null,
        nome: motorista.nome,
        cpf: motorista.cpf,
        email: motorista.email,
        telefone: motorista.telefone?.toString(),
        dt_nascimento: motorista.dt_nascimento,
        endereco: null,
        veiculo: null
      });
      
      setIsAgregadoDetailOpen(true);

      // Fetch documento_motorista
      const { data: documentoData, error: documentoError } = await supabase
        .from('documento_motorista')
        .select('*')
        .eq('motorista_id', motorista.motorista_id)
        .maybeSingle();

      if (documentoError && documentoError.code !== 'PGRST116') {
        throw documentoError;
      }

      // Fetch endereco
      const { data: enderecoData, error: enderecoError } = await supabase
        .from('end_motorista')
        .select(`
          nr_end,
          ds_complemento_end,
          logradouro (
            logradouro,
            nr_cep,
            bairro (
              bairro,
              cidade (
                cidade,
                estado (
                  sigla_estado
                )
              )
            )
          )
        `)
        .eq('id_motorista', motorista.motorista_id)
        .maybeSingle();

      if (enderecoError && enderecoError.code !== 'PGRST116') {
        throw enderecoError;
      }

      // Fetch veiculo
      const { data: veiculoData, error: veiculoError } = await supabase
        .from('veiculo')
        .select(`
          *,
          documento_veiculo (*)
        `)
        .eq('motorista_id', motorista.motorista_id)
        .eq('status_veiculo', true)
        .maybeSingle();

      if (veiculoError && veiculoError.code !== 'PGRST116') {
        throw veiculoError;
      }

      setSelectedDocumento({
        documento: documentoData || null,
        nome: motorista.nome,
        cpf: motorista.cpf,
        email: motorista.email,
        telefone: motorista.telefone?.toString(),
        dt_nascimento: motorista.dt_nascimento,
        endereco: enderecoData || null,
        veiculo: veiculoData || null,
        agregado: motorista
      });
    } catch (error) {
      console.error('Erro ao carregar dados do agregado:', error);
      toast.error('Erro ao carregar dados do agregado');
      setIsAgregadoDetailOpen(false);
    }
  };

  const handleDelete = (motorista: MotoristaWithAddress) => {
    setSelectedMotorista(motorista);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedMotorista) return;

    try {
      const { error } = await query('motorista')
        .delete()
        .eq('motorista_id', selectedMotorista.motorista_id);

      if (error) throw error;

      setMotoristas(motoristas.filter(m => m.motorista_id !== selectedMotorista.motorista_id));
      toast.success('Agregado excluído com sucesso');
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting motorista:', error);
      toast.error('Erro ao excluir agregado');
    }
  };

  const updateStatus = async (motorista_id: number, newStatus: string) => {
    try {
      const { error } = await query('motorista')
        .update({ st_cadastro: newStatus })
        .eq('motorista_id', motorista_id);

      if (error) throw error;
      
      setMotoristas(prev => prev.map(m => 
        m.motorista_id === motorista_id ? { ...m, st_cadastro: newStatus } : m
      ));
      
      toast.success('Status atualizado com sucesso');
    } catch (err) {
      toast.error('Erro ao atualizar status');
    }
  };

  const updateCliente = async (motorista_id: number, cliente_id: number | null) => {
    try {
      const { error } = await query('motorista')
        .update({ cliente_id })
        .eq('motorista_id', motorista_id);

      if (error) throw error;

      setMotoristas(prev => prev.map(m => 
        m.motorista_id === motorista_id ? { ...m, cliente_id: cliente_id || 0 } : m
      ));
      
      toast.success('Cliente atualizado com sucesso');
    } catch (error) {
      console.error('Error updating cliente:', error);
      toast.error('Erro ao atualizar cliente');
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
    
    // Update selectAll state
    setSelectAll(newSelectedItems.size === motoristas.length);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(motoristas.map(m => m.motorista_id)));
    }
    setSelectAll(!selectAll);
  };

  const handleContextMenu = (e: React.MouseEvent, motorista: MotoristaWithAddress) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      motorista,
    });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchMotoristas();
  };

  const filterButtons = [
    { value: 'todos', label: 'Todos' },
    { value: 'Motorista', label: 'Motoristas' },
    { value: 'Agregado', label: 'Agregados' }
  ];

  const statusOptions = [
    { value: '', label: 'Todos os status' },
    { value: 'cadastrado', label: 'Cadastrado' },
    { value: 'qualificado', label: 'Qualificado' },
    { value: 'documentacao', label: 'Documentação' },
    { value: 'contrato_enviado', label: 'Contrato Enviado' },
    { value: 'contratado', label: 'Contratado' },
    { value: 'repescagem', label: 'Repescagem' },
    { value: 'rejeitado', label: 'Rejeitado' },
    { value: 'gr', label: 'Gestão de Risco' }
  ];

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCity(e.target.value);
    setCurrentPage(1);
  };

  const handleClientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedClient(Number(e.target.value));
    setCurrentPage(1);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedStatus(e.target.value);
    setCurrentPage(1);
  };

  const handleVehicleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedVehicleType(e.target.value);
    setCurrentPage(1);
  };

  const toggleStatus = async (motorista_id: number, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('motorista')
        .update({ ativo: !currentStatus })
        .eq('motorista_id', motorista_id);

      if (error) throw error;

      setMotoristas(motoristas.map(m => 
        m.motorista_id === motorista_id ? { ...m, ativo: !currentStatus } : m
      ));
      
      toast.success(`Agregado ${!currentStatus ? 'ativado' : 'desativado'} com sucesso`);
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Erro ao alterar status do agregado');
    }
  };

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
            <>
              <button
                onClick={handleOpenMassMessageModal}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                        transition-colors flex items-center gap-2"
              >
                <MessageSquare className="w-5 h-5" />
                Enviar Mensagem
              </button>
              <button
                onClick={() => setIsBulkStatusModalOpen(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 
                        focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 
                        transition-colors flex items-center gap-2"
              >
                <Users className="w-5 h-5" />
                Alterar Status
              </button>
              <button
                onClick={() => setIsBulkClientModalOpen(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 
                        focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 
                        transition-colors flex items-center gap-2"
              >
                <Building2 className="w-5 h-5" />
                Alterar Cliente
              </button>
            </>
          )}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                     transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Novo Agregado
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por nome, CPF, placa, marca ou modelo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              autoComplete="off"
            />
            {isSearching ? (
              <div className="absolute left-3 top-2.5">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            )}
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por telefone..."
              value={phoneSearch}
              onChange={(e) => setPhoneSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              autoComplete="off"
            />
            {isSearching ? (
              <div className="absolute left-3 top-2.5">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <Phone className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            )}
          </div>

          <div className="relative">
            <select
              value={selectedStatus}
              onChange={handleStatusChange}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Filter className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>

          <div className="relative">
            <select
              value={selectedCity}
              onChange={handleCityChange}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">Todas as cidades</option>
              {cities.map((city, index) => (
                <option key={index} value={city.cidade}>
                  {city.cidade} ({city.estado.sigla_estado})
                </option>
              ))}
            </select>
            <MapPin className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>

          <div className="relative">
            <select
              value={selectedClient.toString()}
              onChange={handleClientChange}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="0">Todos os clientes</option>
              {clientes.map((cliente) => (
                <option key={cliente.cliente_id} value={cliente.cliente_id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
            <Building2 className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>

          <div className="relative">
            <select
              value={selectedVehicleType}
              onChange={handleVehicleTypeChange}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">Todos os tipos de veículo</option>
              {vehicleTypes.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <Truck className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 relative">
        <div className="overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAll}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectedItems.size > 0 ? `${selectedItems.size} selecionado${selectedItems.size !== 1 ? 's' : ''}` : 'Selecionar todos'}
              </span>
            </div>
          </div>
          
          <div className="relative">
            <div ref={tableContainerRef} className="overflow-x-auto w-full">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800"></th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Contato</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">CPF</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Cidade</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Veículo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Cliente</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {motoristas.map((motorista) => (
                    <tr 
                      key={motorista.motorista_id} 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                        selectedItems.has(motorista.motorista_id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                      onContextMenu={(e) => handleContextMenu(e, motorista)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(motorista.motorista_id)}
                          onChange={() => handleSelectItem(motorista.motorista_id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                            <span className="text-lg font-medium text-gray-600 dark:text-gray-300">
                              {motorista.nome.charAt(0)}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {motorista.nome}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {motorista.funcao}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {motorista.telefone ? formatPhone(motorista.telefone.toString()) : '-'}
                          </div>
                          {motorista.telefone && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartChat(motorista);
                              }}
                              className="p-1 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              title="Iniciar chat"
                            >
                              <MessageCircle size={16} />
                            </button>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {motorista.email || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                        {formatCPF(motorista.cpf)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">{motorista.cidade}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{motorista.estado}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={motorista.st_cadastro}
                          onChange={(e) => updateStatus(motorista.motorista_id, e.target.value)}
                          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                            motorista.st_cadastro === 'cadastrado' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            motorista.st_cadastro === 'qualificado' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                            motorista.st_cadastro === 'documentacao' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            motorista.st_cadastro === 'contrato_enviado' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' :
                            motorista.st_cadastro === 'contratado' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            motorista.st_cadastro === 'repescagem' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                            motorista.st_cadastro === 'rejeitado' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                            motorista.st_cadastro === 'gr' ? 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                          }`}
                        >
                          <option value="cadastrado">Cadastrado</option>
                          <option value="qualificado">Qualificado</option>
                          <option value="documentacao">Documentação</option>
                          <option value="contrato_enviado">Contrato Enviado</option>
                          <option value="contratado">Contratado</option>
                          <option value="repescagem">Repescagem</option>
                          <option value="rejeitado">Rejeitado</option>
                          <option value="gr">Gestão de Risco</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {motorista.veiculo && motorista.veiculo.length > 0 ? (
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white uppercase">
                              {motorista.veiculo[0].placa}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {motorista.veiculo[0].marca} {motorista.veiculo[0].tipo}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {motorista.veiculo[0].tipologia || 'Tipo não informado'}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            Sem veículo
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={motorista.cliente_id || ''}
                          onChange={(e) => updateCliente(motorista.motorista_id, e.target.value ? Number(e.target.value) : null)}
                          className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 transition-colors"
                        >
                          <option value="">Sem cliente</option>
                          {clientes.map((cliente) => (
                            <option key={cliente.cliente_id} value={cliente.cliente_id}>
                              {cliente.nome}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewUnifiedModal(motorista);
                            }}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            title="Visualizar Documentos"
                          >
                            <FilePen size={18} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(motorista);
                            }}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={18} />
                          </button>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={motorista.ativo}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleStatus(motorista.motorista_id, motorista.ativo);
                              }}
                            />
                            <div className={`w-11 h-6 rounded-full peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 ${
                              motorista.ativo 
                                ? 'bg-green-600' 
                                : 'bg-red-600'
                            }`}></div>
                          </label>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Scroll indicators */}
            <ScrollableTableIndicator 
              containerRef={tableContainerRef} 
              className="mr-2 ml-2"
            />
          </div>

          {/* Custom Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4 sm:mb-0">
              <span>
                Mostrando <span className="font-medium">{Math.min((currentPage - 1) * pageSize + 1, totalCount)}</span> a{' '}
                <span className="font-medium">{Math.min(currentPage * pageSize, totalCount)}</span> de{' '}
                <span className="font-medium">{totalCount}</span> resultados
              </span>
              
              <div className="ml-4">
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value={10}>10 por página</option>
                  <option value={25}>25 por página</option>
                  <option value={50}>50 por página</option>
                  <option value={100}>100 por página</option>
                  <option value={250}>250 por página</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center space-x-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Anterior
              </button>
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={i}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-1 text-sm font-medium rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                      pageNum === currentPage
                        ? 'bg-blue-600 text-white border border-blue-600 dark:bg-blue-700 dark:border-blue-700'
                        : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || totalPages === 0}
                className="px-2 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Próximo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.motorista && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu({ ...contextMenu, visible: false })}
          actions={[
            {
              icon: <FileText size={16} />,
              label: 'Visualizar Documentos',
              onClick: () => handleViewUnifiedModal(contextMenu.motorista!),
              color: 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors'
            },
            {
              icon: <MessageCircle size={16} />,
              label: 'Iniciar Chat',
              onClick: () => handleStartChat(contextMenu.motorista!),
              color: 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors',
              disabled: !contextMenu.motorista?.telefone
            },
            {
              icon: <Trash2 size={16} />,
              label: 'Excluir Agregado',
              onClick: () => handleDelete(contextMenu.motorista!),
              color: 'text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors'
            }
          ]}
        />
      )}

      <DocumentViewer
        isOpen={isDocumentViewerOpen}
        onClose={() => setIsDocumentViewerOpen(false)}
        documento={selectedDocumento.documento}
        nome={selectedDocumento.nome}
        cpf={selectedDocumento.cpf}
        email={selectedDocumento.email}
        telefone={selectedDocumento.telefone}
        dt_nascimento={selectedDocumento.dt_nascimento}
        endereco={selectedDocumento.endereco}
        veiculo={selectedDocumento.veiculo}
        isAgregado={true}
      />

      <AgregadoDetailView
        isOpen={isAgregadoDetailOpen}
        onClose={() => setIsAgregadoDetailOpen(false)}
        agregado={selectedDocumento.agregado as unknown as Motorista}
        documento={selectedDocumento.documento}
        veiculo={selectedDocumento.veiculo}
        endereco={selectedDocumento.endereco}
      />

      <UnifiedAgregadoModal
        isOpen={isUnifiedModalOpen}
        onClose={() => setIsUnifiedModalOpen(false)}
        agregado={selectedMotorista as unknown as Motorista}
        onSuccess={fetchMotoristas}
      />

      <AddAgregadoModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchMotoristas}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este agregado? Esta ação não pode ser desfeita."
        itemData={selectedMotorista ? [
          { label: "Nome", value: selectedMotorista.nome },
          { label: "CPF", value: formatCPF(selectedMotorista.cpf) },
          { label: "Email", value: selectedMotorista.email || 'Não informado' },
          { label: "Função", value: selectedMotorista.funcao }
        ] : []}
      />

      <BulkActionsModal
        isOpen={isBulkStatusModalOpen}
        onClose={() => setIsBulkStatusModalOpen(false)}
        selectedItems={selectedItems}
        actionType="status"
        onSuccess={fetchMotoristas}
      />

      <BulkActionsModal
        isOpen={isBulkClientModalOpen}
        onClose={() => setIsBulkClientModalOpen(false)}
        selectedItems={selectedItems}
        actionType="client"
        onSuccess={fetchMotoristas}
        clientes={clientes}
      />

      <MassMessageModal
        isOpen={isMassMessageModalOpen}
        onClose={() => setIsMassMessageModalOpen(false)}
        numbers={motoristas
          .filter(m => selectedItems.has(m.motorista_id))
          .map(m => m.telefone?.toString() || '')
          .filter(num => num !== '')}
      />
    </div>
  );
};

export default AgregadosLista;