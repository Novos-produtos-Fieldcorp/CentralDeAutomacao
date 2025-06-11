import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Trash2, FileText, Filter, ChevronDown, MessageSquare, Users, Building2, Phone, MessageCircle } from 'lucide-react';
import { useCompanyData } from '../../hooks/useCompanyData';
import { supabase } from '../../lib/supabase';
import type { Motorista } from '../../types/database';
import DocumentViewer from '../../components/DocumentViewer';
import toast from 'react-hot-toast';
import { formatCPF, formatPhone } from '../../utils/format';
import AddMotoristaModal from '../../components/AddMotoristaModal';
import DocumentUploadModal from '../../components/DocumentUploadModal';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import BulkActionsModal from '../../components/BulkActionsModal';
import BulkDeleteConfirmationModal from '../../components/BulkDeleteConfirmationModal';
import MassMessageModal from '../../components/MassMessageModal';
import LoadingSpinner from '../../components/LoadingSpinner';
import ScrollableTableIndicator from '../../components/ScrollableTableIndicator';
import ContextMenu from '../../components/ContextMenu';
import { useFloatingChat } from '../../hooks/useFloatingChat';

interface MotoristaWithAddress extends Omit<Motorista, 'telefone' | 'cidade' | 'estado'> {
  telefone: string | number;
  cidade: string;
  estado: string;
  cidadeLowerCase: string;
}

const MotoristasLista = () => {
  const { query, companyId } = useCompanyData();
  const { startChat } = useFloatingChat();
  const [motoristas, setMotoristas] = useState<MotoristaWithAddress[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<number>(0);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ startDate: string | null; endDate: string | null }>({
    startDate: null,
    endDate: null
  });
  const [cities, setCities] = useState<{ cidade: string; estado: { sigla_estado: string } }[]>([]);
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDocumentUploadModalOpen, setIsDocumentUploadModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedMotorista, setSelectedMotorista] = useState<MotoristaWithAddress | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false);
  const [isBulkClientModalOpen, setIsBulkClientModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isMassMessageModalOpen, setIsMassMessageModalOpen] = useState(false);
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
  }>({ documento: null, nome: '', endereco: null, veiculo: null });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [allMotoristas, setAllMotoristas] = useState<MotoristaWithAddress[]>([]);

  useEffect(() => {
    if (companyId) {
      fetchMotoristas();
      fetchClientes();
      fetchCities();
    }
  }, [companyId, searchTerm, phoneSearch, selectedStatus, selectedCity, selectedClient, currentPage, pageSize, dateRange]);

  const fetchMotoristas = async () => {
    try {
      if (currentPage === 1 && !searchTerm && !phoneSearch && !selectedStatus && !selectedCity && !selectedClient) {
        setLoading(true);
      } else {
        setIsSearching(true);
      }
      
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      
      let query = supabase
        .from('vw_motoristas_completo')
        .select('*', { count: 'exact' })
        .eq('company_id', companyId)
        .eq('funcao', 'Motorista');

      if (dateRange.startDate && dateRange.endDate) {
        query = query
          .gte('data_cadastro', dateRange.startDate)
          .lte('data_cadastro', dateRange.endDate);
      }

      // Apply search filter if provided
      if (searchTerm) {
        query = query.or(`nome_motorista.ilike.%${searchTerm}%,cpf.ilike.%${searchTerm}%`);
      }

      // Apply phone filter if provided
      if (phoneSearch) {
        query = query.ilike('telefone', `%${phoneSearch}%`);
      }

      // Apply status filter if selected
      if (selectedStatus) {
        query = query.eq('st_cadastro', selectedStatus);
      }

      // Apply city filter if selected
      if (selectedCity) {
        query = query.ilike('nome_cidade', selectedCity);
      }

      // Apply client filter if selected
      if (selectedClient) {
        query = query.eq('cliente_id', selectedClient);
      }

      // Execute the query
      const { data, error, count } = await query
        .order('data_cadastro', { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Process the data - map view fields to component fields
      const motoristasData = (data || []).map(motorista => ({
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
        nome_cliente: motorista.nome_cliente
      })) as MotoristaWithAddress[];

      // Update total count based on filtered data
      setTotalCount(count || 0);
      setTotalPages(Math.max(1, Math.ceil((count || 0) / pageSize)));

      setMotoristas(motoristasData);
      
      // Fetch all motoristas for select all functionality
      const { data: allData } = await supabase
        .from('vw_motoristas_completo')
        .select('motorista_id')
        .eq('company_id', companyId)
        .eq('funcao', 'Motorista');

      if (allData) {
        setAllMotoristas(allData as unknown as MotoristaWithAddress[]);
      }
    } catch (error) {
      console.error('Error fetching motoristas:', error);
      toast.error('Erro ao carregar motoristas');
    } finally {
      setLoading(false);
      setIsSearching(false);
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
      // First, get all unique cities from motoristas
      const { data: motoristasData, error: motoristasError } = await supabase
        .from('vw_motoristas_completo')
        .select('nome_cidade, sigla_estado')
        .eq('company_id', companyId)
        .eq('funcao', 'Motorista')
        .not('nome_cidade', 'is', null);

      if (motoristasError) throw motoristasError;

      // Create a map to ensure uniqueness by city name
      const uniqueCitiesMap = new Map();
      
      if (motoristasData) {
        motoristasData.forEach(item => {
          if (item.nome_cidade) {
            // Use city name as key to ensure uniqueness
            const key = item.nome_cidade.toLowerCase();
            if (!uniqueCitiesMap.has(key)) {
              uniqueCitiesMap.set(key, {
                cidade: item.nome_cidade,
                estado: { sigla_estado: item.sigla_estado || '' }
              });
            }
          }
        });
      }
      
      // Convert map to array and sort by city name
      const uniqueCities = Array.from(uniqueCitiesMap.values())
        .sort((a, b) => a.cidade.localeCompare(b.cidade));
      
      setCities(uniqueCities);
    } catch (error) {
      console.error('Error fetching cities:', error);
      toast.error('Erro ao carregar cidades');
    }
  };

  const handleViewDocument = async (motorista: MotoristaWithAddress) => {
    try {
      setSelectedDocumento({
        documento: null,
        nome: motorista.nome,
        cpf: motorista.cpf,
        email: motorista.email,
        telefone: motorista.telefone?.toString(),
        dt_nascimento: motorista.dt_nascimento,
        endereco: null,
        veiculo: null
      });
      
      setIsDocumentViewerOpen(true);

      const [documentoResponse, enderecoResponse] = await Promise.all([
        supabase.from('documento_motorista')
          .select('*')
          .eq('motorista_id', motorista.motorista_id)
          .limit(1)
          .single(),
        supabase.from('end_motorista')
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
          .eq('st_end', true)
          .limit(1)
          .single()
      ]);

      if (documentoResponse.error && documentoResponse.error.code !== 'PGRST116') {
        throw new Error(`Erro ao buscar documentos: ${documentoResponse.error.message}`);
      }
      if (enderecoResponse.error && enderecoResponse.error.code !== 'PGRST116') {
        throw new Error(`Erro ao buscar endereço: ${enderecoResponse.error.message}`);
      }

      setSelectedDocumento({
        documento: documentoResponse.data,
        nome: motorista.nome,
        cpf: motorista.cpf,
        email: motorista.email,
        telefone: motorista.telefone?.toString(),
        dt_nascimento: motorista.dt_nascimento,
        endereco: enderecoResponse.data,
        veiculo: null
      });
    } catch (error) {
      console.error('Erro ao carregar documentos:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar documentos');
      setIsDocumentViewerOpen(false);
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
      toast.success('Motorista excluído com sucesso');
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting motorista:', error);
      toast.error('Erro ao excluir motorista');
    }
  };

  const handleUploadDocument = (motorista: MotoristaWithAddress) => {
    setSelectedMotorista(motorista);
    setIsDocumentUploadModalOpen(true);
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
    } catch (error) {
      console.error('Error updating status:', error);
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

  const handleContextMenu = (e: React.MouseEvent, motorista: MotoristaWithAddress) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      motorista,
    });
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

  const handleBulkDelete = async () => {
    try {
      // Delete all selected items
      for (const id of selectedItems) {
        const { error } = await query('motorista')
          .delete()
          .eq('motorista_id', id);

        if (error) throw error;
      }

      // Update the list
      setMotoristas(motoristas.filter(m => !selectedItems.has(m.motorista_id)));
      toast.success(`${selectedItems.size} motorista${selectedItems.size !== 1 ? 's' : ''} excluído${selectedItems.size !== 1 ? 's' : ''} com sucesso`);
      
      // Reset selection
      setSelectedItems(new Set());
      setSelectAll(false);
      setIsBulkDeleteModalOpen(false);
    } catch (error) {
      console.error('Error deleting motoristas:', error);
      toast.error('Erro ao excluir motoristas');
    }
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
              <button
                onClick={() => setIsBulkDeleteModalOpen(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 
                        focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 
                        transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-5 h-5" />
                Excluir
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
            Adicionar Motorista
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row gap-4 w-full">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Buscar por nome ou CPF..."
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

          <div className="relative flex-1">
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

          <div className="relative flex-1">
            <select
              value={selectedCity}
              onChange={handleCityChange}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 appearance-none"
            >
              <option value="">Todas as cidades</option>
              {cities.map((city, index) => (
                <option key={index} value={city.cidade}>
                  {city.cidade} ({city.estado.sigla_estado})
                </option>
              ))}
            </select>
            <Filter className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <ChevronDown className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>

          <div className="relative flex-1">
            <select
              value={selectedClient}
              onChange={handleClientChange}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 appearance-none"
            >
              <option value="0">Todos os clientes</option>
              {clientes.map((cliente) => (
                <option key={cliente.cliente_id} value={cliente.cliente_id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
            <Building2 className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <ChevronDown className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>

          <div className="relative flex-1">
            <select
              value={selectedStatus}
              onChange={handleStatusChange}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 appearance-none"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Users className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <ChevronDown className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
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
                              onClick={() => handleStartChat(motorista)}
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
                          className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-0 focus:ring-2 focus:ring-blue-500"
                        >
                          {statusOptions.filter(option => option.value).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={motorista.cliente_id || ''}
                          onChange={(e) => updateCliente(motorista.motorista_id, e.target.value ? Number(e.target.value) : null)}
                          className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-0 focus:ring-2 focus:ring-blue-500"
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
                        <div className="flex items-center justify-end space-x-3">
                          <button
                            onClick={() => handleViewDocument(motorista)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                            title="Visualizar Documentos"
                          >
                            <FileText size={18} />
                          </button>
                          <button
                            onClick={() => handleUploadDocument(motorista)}
                            className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 transition-colors"
                            title="Enviar Documentos"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="17 8 12 3 7 8"></polyline>
                              <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(motorista)}
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
              onClick: () => handleViewDocument(contextMenu.motorista!),
              color: 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors'
            },
            {
              icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>,
              label: 'Enviar Documentos',
              onClick: () => handleUploadDocument(contextMenu.motorista!),
              color: 'text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 transition-colors'
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
              label: 'Excluir Motorista',
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
      />

      <AddMotoristaModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchMotoristas}
      />

      <DocumentUploadModal
        isOpen={isDocumentUploadModalOpen}
        onClose={() => setIsDocumentUploadModalOpen(false)}
        motorista_id={selectedMotorista?.motorista_id || 0}
        nome={selectedMotorista?.nome || ''}
        onUploadSuccess={fetchMotoristas}
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
          { label: "Status", value: selectedMotorista.st_cadastro }
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

      <BulkDeleteConfirmationModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        title="Confirmar Exclusão em Massa"
        message="Tem certeza que deseja excluir todos os motoristas selecionados? Esta ação não pode ser desfeita."
        itemCount={selectedItems.size}
        itemType="motorista"
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

export default MotoristasLista;