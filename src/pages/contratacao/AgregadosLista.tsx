import React, { useEffect, useState, useRef, useCallback } from 'react';
import { FileText, Edit2, Trash2, Search, Phone, Filter, MapPin, Plus, Eye, Store, UserMinus, MessageCircle, MessageSquare, Users, Building2, Truck, Upload, FilePen } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { supabase } from '../../lib/supabase';
import type { Motorista, Cliente, DocumentoMotorista } from '../../types/database';
import DocumentViewer from '../../components/DocumentViewer';
import toast from 'react-hot-toast';
import { formatCPF, formatPhone } from '../../utils/format';
import LoadingSpinner from '../../components/LoadingSpinner';
import ScrollableTableIndicator from '../../components/ScrollableTableIndicator';
import ContextMenu from '../../components/ContextMenu';
import EditMotoristaModal from '../../components/EditMotoristaModal';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import { useFloatingChat } from '../../hooks/useFloatingChat';
import BulkActionsModal from '../../components/BulkActionsModal';
import AddAgregadoModal from '../../components/AddAgregadoModal';
import MassMessageModal from '../../components/MassMessageModal';
import DocumentUploadModal from '../../components/DocumentUploadModal';
import { useDateRange } from '../../hooks/useDateRange';
import PeriodSelector from '../../components/hodometros/PeriodSelector';
import UnifiedAgregadoModal from '../../components/UnifiedAgregadoModal';

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
  veiculo?: Array<{
    veiculo_id: number;
    placa: string;
    status_veiculo: string;
    marca: string;
    tipologia: string;
    ano: number;
    combustivel: string;
    peso: number;
    cubagem: number;
    possui_rastreador: boolean;
    marca_rastreador: string;
    cor: string;
    tipo: string;
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
}

interface City {
  cidade: string;
  estado: {
    sigla_estado: string;
  };
}

interface UnifiedAgregadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  agregado: MotoristaWithAddress | null;
  onSuccess: () => void;
}

interface EditMotoristaModalProps {
  isOpen: boolean;
  onClose: () => void;
  motorista: MotoristaWithAddress | null;
  onUpdate: () => void;
}

interface DocumentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  documento: DocumentoMotorista | null;
  nome: string;
  cpf: string;
  email?: string;
  telefone?: string;
  dt_nascimento?: string;
  endereco?: string;
  st_cadastro?: string;
}

const AgregadosLista = () => {
  const { query, companyId } = useCompanyData();
  const { startChat } = useFloatingChat();
  const [motoristas, setMotoristas] = useState<MotoristaWithAddress[]>([]);
  const [allMotoristas, setAllMotoristas] = useState<MotoristaWithAddress[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [debouncedPhoneSearch, setDebouncedPhoneSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedVehicleType, setSelectedVehicleType] = useState('');
  const [vehicleTypes, setVehicleTypes] = useState<string[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [funcaoFilter, setFuncaoFilter] = useState<'todos' | 'Motorista' | 'Agregado'>('Agregado');
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [isUnifiedModalOpen, setIsUnifiedModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDocumentUploadModalOpen, setIsDocumentUploadModalOpen] = useState(false);
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
    agregado?: Motorista | null;
    st_cadastro?: string;
  }>({ documento: null, nome: '', endereco: null, veiculo: null });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const { periodType, dateRange, updatePeriod, setDateRange } = useDateRange('all');

  const clientColors = [
    'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  ];

  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const phoneTimeoutRef = useRef<NodeJS.Timeout>();

  // Update debounced values when search terms change
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 800);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  useEffect(() => {
    if (phoneTimeoutRef.current) {
      clearTimeout(phoneTimeoutRef.current);
    }
    phoneTimeoutRef.current = setTimeout(() => {
      setDebouncedPhoneSearch(phoneSearch);
    }, 500);

    return () => {
      if (phoneTimeoutRef.current) {
        clearTimeout(phoneTimeoutRef.current);
      }
    };
  }, [phoneSearch]);

  // Separate useEffect for initial data loading
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        await Promise.all([
          fetchCities(),
          fetchVehicleTypes(),
          fetchClientes()
        ]);
      } catch (error) {
        toast.error('Erro ao carregar dados iniciais');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  useEffect(() => {
    const fetchMotoristasData = async () => {
      try {
        await fetchMotoristas();
      } catch (error) {
        toast.error('Erro ao carregar motoristas');
      }
    };

    fetchMotoristasData();
  }, [currentPage, pageSize, dateRange, debouncedSearchTerm, debouncedPhoneSearch, selectedStatus, selectedCity, selectedVehicleType, selectedClient]);

  const fetchMotoristas = useCallback(async () => {
    try {
      // Only show loading on initial load or when changing pages
      if (currentPage === 1 && !debouncedSearchTerm && !debouncedPhoneSearch && !selectedStatus && !selectedCity && !selectedVehicleType && !selectedClient) {
        setLoading(true);
      }
      
      // Calculate pagination parameters
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      
      // Build the base query
      let query = supabase
        .from('vw_agregados_completo')
        .select('*')
        .eq('company_id', companyId)
        .eq('funcao', 'Agregado');

      // Apply date range filter if dates are selected
      if (dateRange.startDate && dateRange.endDate) {
        query = query
          .gte('data_cadastro', dateRange.startDate)
          .lte('data_cadastro', dateRange.endDate);
      }

      // Apply search filter if provided
      if (debouncedSearchTerm) {
        query = query.or(
          `nome_motorista.ilike.%${debouncedSearchTerm}%,` +
          `cpf.ilike.%${debouncedSearchTerm}%,` +
          `placa.ilike.%${debouncedSearchTerm}%,` +
          `marca_veiculo.ilike.%${debouncedSearchTerm}%`
        );
      }

      // Apply status filter if selected
      if (selectedStatus) {
        query = query.eq('st_cadastro', selectedStatus);
      }

      // Apply city filter if selected
      if (selectedCity) {
        query = query.ilike('nome_cidade', selectedCity);
      }

      // Apply vehicle type filter if selected
      if (selectedVehicleType) {
        query = query.eq('tipologia', selectedVehicleType);
      }

      // Apply client filter if selected
      if (selectedClient) {
        query = query.eq('cliente_id', selectedClient);
      }

      // Log the filter values and query
      console.log('Filter values:', {
        searchTerm: debouncedSearchTerm,
        status: selectedStatus,
        city: selectedCity,
        vehicleType: selectedVehicleType,
        client: selectedClient,
        dateRange: dateRange
      });

      // Execute the query
      const { data, error, count } = await query.order('data_cadastro', { ascending: false });

      if (error) {
        console.error('Query error:', error);
        throw error;
      }

      // Log the raw data returned
      console.log('Raw data returned:', data);

      // Check for duplicates in raw data
      const motoristaIds = data?.map(m => m.motorista_id) || [];
      const duplicates = motoristaIds.filter((id, index) => motoristaIds.indexOf(id) !== index);
      if (duplicates.length > 0) {
        console.log('Found duplicate motorista_ids:', duplicates);
        console.log('Duplicate entries:', data?.filter(m => duplicates.includes(m.motorista_id)));
      }

      // Process the data - map view fields to component fields
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
        veiculo: motorista.veiculo_id ? [{
          veiculo_id: motorista.veiculo_id,
          placa: motorista.placa,
          status_veiculo: motorista.status_veiculo,
          marca: motorista.marca_veiculo,
          tipologia: motorista.tipologia,
          ano: motorista.ano,
          combustivel: motorista.combustivel,
          peso: motorista.peso,
          cubagem: motorista.cubagem,
          possui_rastreador: motorista.possui_rastreador,
          marca_rastreador: motorista.marca_rastreador,
          cor: motorista.cor,
          tipo: motorista.tipo
        }] : []
      })) as unknown as MotoristaWithAddress[];

      // Log the processed data
      console.log('Processed data:', motoristasData);

      // Apply phone filter on frontend
      if (debouncedPhoneSearch) {
        const phoneSearchLower = debouncedPhoneSearch.toLowerCase().replace(/[()\-\s]/g, '');
        motoristasData = motoristasData.filter(motorista => {
          const phoneStr = motorista.telefone?.toString().replace(/[()\-\s]/g, '') || '';
          return phoneStr.toLowerCase().includes(phoneSearchLower);
        });
      }

      // Log the final filtered data
      console.log('Final filtered data:', motoristasData);

      // Update total count based on filtered data
      const filteredCount = motoristasData.length;
      setTotalCount(filteredCount);
      setTotalPages(Math.max(1, Math.ceil(filteredCount / pageSize)));

      // Apply pagination
      const paginatedData = motoristasData.slice(from, to + 1);
      setMotoristas(paginatedData);
      
      // Fetch all motoristas for select all functionality
      const { data: allData } = await supabase
        .from('vw_agregados_completo')
        .select('motorista_id')
        .eq('company_id', companyId)
        .eq('funcao', 'Agregado');
      
      if (allData) {
        const uniqueAllIds = [...new Set(allData.map(item => item.motorista_id))];
        setAllMotoristas(uniqueAllIds.map(id => ({ motorista_id: id })) as MotoristaWithAddress[]);
      }
    } catch (error) {
      console.error('Error fetching motoristas:', error);
      toast.error('Erro ao carregar motoristas');
      setMotoristas([]);
      setAllMotoristas([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange, debouncedSearchTerm, debouncedPhoneSearch, selectedStatus, selectedCity, selectedVehicleType, selectedClient, currentPage, pageSize, companyId]);

  const fetchCities = async () => {
    try {
      const { data, error } = await supabase
        .from('vw_agregados_completo')
        .select(`
          nome_cidade,
          sigla_estado
        `)
        .eq('company_id', companyId)
        .eq('funcao', 'Agregado')
        .not('nome_cidade', 'is', null)
        .not('nome_cidade', 'eq', '')
        .order('nome_cidade');

      if (error) throw error;
      
      // Get unique cities with their states
      const uniqueCities = new Map<string, { cidade: string; estado: { sigla_estado: string } }>();
      
      data?.forEach((item: any) => {
        if (!item.nome_cidade || !item.sigla_estado) return;
        
        const key = `${item.nome_cidade}-${item.sigla_estado}`;
        if (!uniqueCities.has(key)) {
          uniqueCities.set(key, {
            cidade: item.nome_cidade,
            estado: {
              sigla_estado: item.sigla_estado
            }
          });
        }
      });
      
      // Convert map to array
      const citiesArray = Array.from(uniqueCities.values());
      setCities(citiesArray);
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
        .not('tipologia', 'is', null)
        .not('tipologia', 'eq', '')
        .order('tipologia');

      if (error) {
        throw error;
      }
      
      // Get unique tipologias and sort them
      const uniqueTypes = [...new Set(data?.map((v: { tipologia: string }) => v.tipologia) || [])].sort();
      setVehicleTypes(uniqueTypes);
    } catch (error) {
      toast.error('Erro ao carregar tipos de veículos');
    }
  };

  const fetchClientes = async () => {
    try {
      const { data, error } = await supabase
        .from('cliente')
        .select('*')
        .eq('st_cliente', true)
        .eq('company_id', companyId)
        .not('nome', 'is', null)
        .not('nome', 'eq', '')
        .order('nome');

      if (error) {
        throw error;
      }
      
      setClientes(data as Cliente[]);
    } catch (error) {
      toast.error('Erro ao carregar clientes');
    }
  };

  const handleStartChat = (motorista: MotoristaWithAddress) => {
    if (motorista.telefone) {
      startChat(motorista.telefone.toString());
    } else {
      toast.error('Este motorista não possui telefone cadastrado');
    }
  };

  const handleOpenMassMessageModal = () => {
    const selectedNumbers = motoristas
      .filter(m => selectedItems.has(m.motorista_id))
      .map(m => m.telefone?.toString() || '')
      .filter(num => num !== '');
    
    if (selectedNumbers.length === 0) {
      toast.error('Selecione pelo menos um motorista com telefone cadastrado');
      return;
    }
    
    setIsMassMessageModalOpen(true);
  };

  const handleViewAgregadoDetail = (motorista: MotoristaWithAddress | null) => {
    if (motorista) {
      setSelectedMotorista(motorista);
      setIsUnifiedModalOpen(true);
    }
  };

  const handleUploadDocuments = (motorista: MotoristaWithAddress) => {
    setSelectedMotorista(motorista);
    setIsDocumentUploadModalOpen(true);
  };

  const handleEdit = (motorista: MotoristaWithAddress) => {
    setSelectedMotorista(motorista);
    setIsEditModalOpen(true);
  };

  const handleDelete = (motorista: MotoristaWithAddress) => {
    setSelectedMotorista(motorista);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedMotorista) return;

    try {
      const { error } = await supabase.from('motorista')
        .delete()
        .eq('motorista_id', selectedMotorista.motorista_id);

      if (error) throw error;

      setMotoristas(motoristas.filter(m => m.motorista_id !== selectedMotorista.motorista_id));
      toast.success('Motorista excluído com sucesso');
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting motorista:', error);
      toast.error('Erro ao excluir motorista');
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
    setCurrentPage(1); // Reset to first page when changing page size
  };

  const handleFilterChange = (filterType: string, value: string) => {
    setCurrentPage(1); // Reset to first page on filter change
    
    switch (filterType) {
      case 'search':
        setSearchTerm(value);
        break;
      case 'phone':
        setPhoneSearch(value);
        break;
      case 'vehicleType':
        setSelectedVehicleType(value);
        break;
      case 'status':
        setSelectedStatus(value);
        break;
      case 'city':
        setSelectedCity(value);
        break;
      case 'client':
        setSelectedClient(value);
        break;
    }
  };

  const statusOptions = [
    { value: '', label: 'Todos os status' },
    { value: 'cadastrado', label: 'Cadastrado' },
    { value: 'qualificado', label: 'Qualificado' },
    { value: 'documentacao', label: 'Documentação' },
    { value: 'contrato_enviado', label: 'Contrato Enviado' },
    { value: 'contratado', label: 'Contratado' },
    { value: 'repescagem', label: 'Repescagem' },
    { value: 'rejeitado', label: 'Rejeitado' }
  ];

  const getStatusStyle = (status: string) => {
    const baseStyle = "px-3 py-1 rounded-full text-sm font-medium";
    const normalizedStatus = status.toLowerCase();
    
    switch (normalizedStatus) {
      case 'cadastrado':
        return `${baseStyle} bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200`;
      case 'qualificado':
        return `${baseStyle} bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200`;
      case 'documentacao':
        return `${baseStyle} bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200`;
      case 'contrato_enviado':
        return `${baseStyle} bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200`;
      case 'contratado':
        return `${baseStyle} bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`;
      case 'repescagem':
        return `${baseStyle} bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200`;
      case 'rejeitado':
        return `${baseStyle} bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200`;
      default:
        return baseStyle;
    }
  };

  const updateStatus = async (motorista_id: number, newStatus: string) => {
    try {
      const { error } = await supabase.from('motorista')
        .update({ st_cadastro: newStatus })
        .eq('motorista_id', motorista_id);

      if (error) throw error;

      setMotoristas(prev => prev.map(m => 
        m.motorista_id === motorista_id ? { ...m, st_cadastro: newStatus } : m
      ));
      
      toast.success('Status atualizado com sucesso');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const updateCliente = async (motorista_id: number, cliente_id: number | null) => {
    try {
      const { error } = await supabase.from('motorista')
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
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
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
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por nome, CPF, placa, marca ou modelo..."
              value={searchTerm}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 
                       dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 
                       focus:border-blue-500 text-gray-900 dark:text-gray-100"
            />
            <Search 
              className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 cursor-pointer" 
            />
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por telefone..."
              value={phoneSearch}
              onChange={(e) => handleFilterChange('phone', e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 
                       dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 
                       focus:border-blue-500 text-gray-900 dark:text-gray-100"
            />
            <Phone 
              className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 cursor-pointer" 
            />
          </div>

          <div className="relative">
            <select
              value={selectedVehicleType}
              onChange={(e) => handleFilterChange('vehicleType', e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none"
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

          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none"
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
              onChange={(e) => handleFilterChange('city', e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none"
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
              value={selectedClient}
              onChange={(e) => handleFilterChange('client', e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none"
            >
              <option value="">Todos os clientes</option>
              {clientes.map((cliente) => (
                <option key={cliente.cliente_id} value={cliente.cliente_id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
            <Store className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
          <div className="flex gap-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                    transition-colors flex items-center gap-2"
            title="Adicionar Agregado"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
        </div>
        {/* Period Selector */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <PeriodSelector
            periodType={periodType}
            dateRange={dateRange}
            onPeriodChange={updatePeriod}
            onDateRangeChange={setDateRange}
          />
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
            <div ref={tableContainerRef as React.RefObject<HTMLDivElement>} className="overflow-x-auto w-full">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"></th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Contato</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">CPF</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Veículo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Cidade</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Cliente</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {motoristas.map((motorista, index) => (
                    <tr 
                      key={`${motorista.motorista_id}-${motorista.cpf}-${index}`}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${
                        selectedItems.has(motorista.motorista_id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                      onClick={() => handleViewAgregadoDetail(motorista)}
                      onContextMenu={(e) => handleContextMenu(e, motorista)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
                        <div className="text-sm text-gray-900 dark:text-white">{motorista.cidade}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{motorista.estado?.sigla_estado || ''}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={motorista.st_cadastro}
                          onChange={(e) => {
                            e.stopPropagation();
                            updateStatus(motorista.motorista_id, e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className={getStatusStyle(motorista.st_cadastro)}
                        >
                          {statusOptions.filter(option => option.value).map(option => (
                            <option 
                              key={option.value} 
                              value={option.value}
                              className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={motorista.cliente_id || ''}
                          onChange={(e) => {
                            e.stopPropagation();
                            updateCliente(motorista.motorista_id, e.target.value ? Number(e.target.value) : null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                            motorista.cliente_id ?
                              clientColors[motorista.cliente_id % clientColors.length] :
                              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                          }`}
                        >
                          <option value="">Sem cliente</option>
                          {clientes.map((cliente, index) => (
                            <option 
                              key={cliente.cliente_id} 
                              value={cliente.cliente_id}
                              className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            >
                              {cliente.nome}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewAgregadoDetail(motorista);
                            }}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            title="Gerenciar Agregado"
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Scroll indicators */}
            <ScrollableTableIndicator 
              containerRef={tableContainerRef as React.RefObject<HTMLDivElement>}
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
                // Calculate page numbers to show (always show 5 pages if possible)
                let pageNum;
                if (totalPages <= 5) {
                  // If 5 or fewer pages, show all
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  // If near the start, show first 5 pages
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  // If near the end, show last 5 pages
                  pageNum = totalPages - 4 + i;
                } else {
                  // Otherwise show 2 before and 2 after current page
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
              icon: <FilePen size={16} />,
              label: 'Gerenciar Agregado',
              onClick: () => contextMenu.motorista && handleViewAgregadoDetail(contextMenu.motorista),
              color: 'text-blue-600 dark:text-blue-400'
            },
            {
              icon: <MessageCircle size={16} />,
              label: 'Iniciar Chat',
              onClick: () => contextMenu.motorista && handleStartChat(contextMenu.motorista),
              color: 'text-blue-600 dark:text-blue-400',
              disabled: !contextMenu.motorista?.telefone
            },
            {
              icon: <Edit2 size={16} />,
              label: 'Editar Motorista',
              onClick: () => contextMenu.motorista && handleEdit(contextMenu.motorista),
              color: 'text-yellow-500 dark:text-yellow-400'
            },
            {
              icon: <Trash2 size={16} />,
              label: 'Excluir Motorista',
              onClick: () => contextMenu.motorista && handleDelete(contextMenu.motorista),
              color: 'text-red-600 dark:text-red-400'
            }
          ]}
        />
      )}

      {/* Unified Modal */}
      <UnifiedAgregadoModal
        isOpen={isUnifiedModalOpen}
        onClose={() => setIsUnifiedModalOpen(false)}
        agregado={selectedMotorista as unknown as Motorista}
        onSuccess={fetchMotoristas}
      />

      <EditMotoristaModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        motorista={selectedMotorista}
        onUpdate={fetchMotoristas}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este motorista? Esta ação não pode ser desfeita."
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

      <AddAgregadoModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchMotoristas}
      />
      
      <MassMessageModal
        isOpen={isMassMessageModalOpen}
        onClose={() => setIsMassMessageModalOpen(false)}
        numbers={motoristas
          .filter(m => selectedItems.has(m.motorista_id))
          .map(m => m.telefone?.toString() || '')
          .filter(num => num !== '')}
      />

      <DocumentUploadModal
        isOpen={isDocumentUploadModalOpen}
        onClose={() => setIsDocumentUploadModalOpen(false)}
        motorista_id={selectedMotorista?.motorista_id || 0}
        nome={selectedMotorista?.nome || ''}
        onUploadSuccess={fetchMotoristas}
      />

      <DocumentViewer
        isOpen={isDocumentViewerOpen}
        onClose={() => setIsDocumentViewerOpen(false)}
        documento={selectedMotorista?.documento_motorista || null}
        nome={selectedMotorista?.nome || ''}
        cpf={selectedMotorista?.cpf}
        email={selectedMotorista?.email}
        telefone={selectedMotorista?.telefone?.toString()}
        dt_nascimento={selectedMotorista?.dt_nascimento}
        endereco={{
          logradouro: {
            logradouro: selectedMotorista?.cidade || '',
            nr_cep: '',
            bairro: {
              bairro: '',
              cidade: {
                cidade: selectedMotorista?.cidade || '',
                estado: {
                  sigla_estado: selectedMotorista?.estado?.sigla_estado || ''
                }
              }
            }
          }
        }}
        st_cadastro={selectedMotorista?.st_cadastro}
      />
    </div>
  );
};

export default AgregadosLista;