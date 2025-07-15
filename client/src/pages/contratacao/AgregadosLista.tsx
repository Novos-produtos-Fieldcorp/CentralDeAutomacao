  import React, { useState, useEffect, useRef } from 'react';
  import { Search, Edit2, FileText, MessageCircle, Filter, ChevronDown, X, User, Loader2, MapPin, FilePen, Truck, Plus, ArrowLeftRight, XCircle, AlertTriangle } from 'lucide-react';
  import AddAgregadoModal from '../../components/AddAgregadoModal';
  import { useCompanyData } from '../../hooks/useCompanyData';
  import type { Motorista, MotoristaWithAddress, DocumentoMotorista, EnderecoMotorista, Veiculo } from '../../types/database';
  import { formatCPF, formatPhone, formatDate } from '../../utils/format';
  import DocumentViewer from '../../components/DocumentViewer';
  import DocumentUploadModal from '../../components/DocumentUploadModal';
  import EditMotoristaModal from '../../components/EditMotoristaModal';
  import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
  import BulkActionsModal from '../../components/BulkActionsModal';
  import BulkDeleteConfirmationModal from '../../components/BulkDeleteConfirmationModal';
  import MassMessageModal from '../../components/MassMessageModal';
  import toast from 'react-hot-toast';
  import { useFloatingChat } from '../../hooks/useFloatingChat';
  import { supabase } from '../../lib/supabase';
  import LoadingSpinner from '../../components/LoadingSpinner';
  import { usePagination } from '../../hooks/usePagination';
  import Pagination from '../../components/Pagination';
  import ScrollableTableIndicator from '../../components/ScrollableTableIndicator';
  import ContextMenu from '../../components/ContextMenu';
  import UnifiedAgregadoModal from '../../components/UnifiedAgregadoModal';
  import { TableDropdown } from '../../components/TableDropdown';

interface AgregadosListaProps {
  onSuccess?: () => void;
}

// Interface para a view de contratados
export interface ViewContratado {
  motorista_id?: number;
  nome_motorista?: string;
  cpf?: string;
  dt_nascimento?: string;
  genero?: string;
  telefone?: string | number | null;
  email?: string | null;
  funcao?: string;
  origem_usuario?: string;
  st_cadastro?: string | null;
  autorizacao_lgpd?: string;
  company_id?: number;
  data_cadastro?: string;
  cliente_id?: number | null;
  conversation_id?: string;
  ativo?: boolean;
  nr_end?: number | null;
  ds_complemento_end?: string | null;
  st_end?: boolean | null;
  id_end_motorista?: number | null;
  logradouro?: string | null;
  nr_cep?: string | null;
  nome_bairro?: string | null;
  nome_cidade?: string | null | undefined;
  nome_estado?: string | null;
  sigla_estado?: string | null;
  veiculo_id?: number | null;
  placa?: string | null;
  status_veiculo?: boolean | null;
  marca?: string | null;
  tipologia?: string | null;
  veiculo?: Array<{
    placa: string;
    tipologia: string;
    marca?: string;
    tipo_veiculo?: string;
    tipo?: string;
  }>;
  ano?: string | null;
  combustivel?: string | null;
  peso?: string | null;
  cubagem?: string | null;
  possui_rastreador?: boolean | null;
  marca_rastreador?: string | null;
  cor?: string | null;
  tipo_veiculo?: string | null;
  tipo?: string | null;
  ajudantes?: string[];
}

const checkVehicleTypeMatch = (motorista: ViewContratado, filters: string[]): boolean => {
  // Check direct properties first
  if (
    (motorista.tipo_veiculo && filters.includes(motorista.tipo_veiculo)) ||
    (motorista.tipo && filters.includes(motorista.tipo)) ||
    (motorista.tipologia && filters.includes(motorista.tipologia))
  ) {
    return true;
  }
  
  // Check veiculo array if it exists
  if (motorista.veiculo && motorista.veiculo.length > 0) {
    return motorista.veiculo.some((veiculo: { tipo_veiculo?: string; tipo?: string; tipologia?: string }) => 
      (veiculo.tipo_veiculo && filters.includes(veiculo.tipo_veiculo)) ||
      (veiculo.tipo && filters.includes(veiculo.tipo)) ||
      (veiculo.tipologia && filters.includes(veiculo.tipologia))
    );
  }

  return false;
};

// Status options for dropdown
const STATUS_OPTIONS = [
  { value: 'Cadastrado', label: 'Cadastrado', color: 'bg-gray-100 dark:bg-gray-700' },
  { value: 'qualificado', label: 'Qualificado', color: 'bg-blue-100 dark:bg-blue-900/30' },
  { value: 'documentacao', label: 'Documentação', color: 'bg-yellow-100 dark:bg-yellow-900/30' },
  { value: 'contrato_enviado', label: 'Contrato Enviado', color: 'bg-purple-100 dark:bg-purple-900/30' },
  { value: 'contratado', label: 'Contratado', color: 'bg-green-100 dark:bg-green-900/30' },
  { value: 'repescagem', label: 'Repescagem', color: 'bg-orange-100 dark:bg-orange-900/30' },
  { value: 'gestao_risco', label: 'Gestão de Risco', color: 'bg-rose-100 dark:bg-rose-900/30' },
  { value: 'rejeitado', label: 'Rejeitado', color: 'bg-red-100 dark:bg-red-900/30' }
];

const Contratados = ({ onSuccess }: AgregadosListaProps) => {
  const { query, companyId } = useCompanyData();
  const { startChat } = useFloatingChat();
  const [contratados, setContratados] = useState<ViewContratado[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [ativoFilter, setAtivoFilter] = useState<string>('');
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [showCidadeDropdown, setShowCidadeDropdown] = useState(false);
  const [showTipoVeiculoDropdown, setShowTipoVeiculoDropdown] = useState(false);
  const [isDocumentUploadOpen, setIsDocumentUploadOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkActionsModalOpen, setIsBulkActionsModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isMassMessageModalOpen, setIsMassMessageModalOpen] = useState(false);
  const [isUnifiedAgregadoModalOpen, setIsUnifiedAgregadoModalOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'status' | 'client'>('status');
  const [selectedMotorista, setSelectedMotorista] = useState<ViewContratado | null>(null);
  const [selectAll, setSelectAll] = useState(false);
  const [documento] = useState<DocumentoMotorista | null>(null);
  
  // Matches the type expected by DocumentViewer component
  interface EnderecoState {
    logradouro?: {
      logradouro?: string | null;
      nr_cep?: string | null;
      bairro?: {
        bairro?: string | null;
        cidade?: {
          cidade?: string | null;
          estado?: {
            sigla_estado?: string | null;
          } | null;
        } | null;
      } | null;
    } | null;
    nr_end?: number | null;
    ds_complemento_end?: string | null;
  }
    

    const [endereco, setEndereco] = useState<EnderecoState | null>(null);
    
    // Atualiza o endereco quando o selectedMotorista mudar
    useEffect(() => {
      if (selectedMotorista) {
        // Initialize enderecoData with the correct type
        const enderecoData: EnderecoState = {};
        
        // Only add properties if they exist and are not null/undefined
        if (selectedMotorista.logradouro || selectedMotorista.nr_cep) {
          const logradouro: EnderecoState['logradouro'] = {};
          
          if (selectedMotorista.logradouro) logradouro.logradouro = selectedMotorista.logradouro;
          if (selectedMotorista.nr_cep) logradouro.nr_cep = selectedMotorista.nr_cep;

          if (selectedMotorista.nome_bairro || selectedMotorista.nome_cidade || selectedMotorista.sigla_estado) {
            logradouro.bairro = {};
            
            if (selectedMotorista.nome_bairro) logradouro.bairro.bairro = selectedMotorista.nome_bairro;
            
            const cidade: NonNullable<NonNullable<EnderecoState['logradouro']>['bairro']>['cidade'] = {};
            if (selectedMotorista.nome_cidade) cidade.cidade = selectedMotorista.nome_cidade;
            
            if (selectedMotorista.sigla_estado) {
              cidade.estado = {
                sigla_estado: selectedMotorista.sigla_estado
              };
            }
            
            if (Object.keys(cidade).length > 0) {
              logradouro.bairro.cidade = cidade;
            }
          }
          
          if (Object.keys(logradouro).length > 0) {
            enderecoData.logradouro = logradouro;
          }
        }

        if (selectedMotorista.nr_end !== undefined && selectedMotorista.nr_end !== null) {
          enderecoData.nr_end = selectedMotorista.nr_end;
        }
        
        if (selectedMotorista.ds_complemento_end) {
          enderecoData.ds_complemento_end = selectedMotorista.ds_complemento_end;
        }

        // Only set endereco if we have data, otherwise set to null
        setEndereco(Object.keys(enderecoData).length > 0 ? enderecoData : null);
      } else {
        setEndereco(null);
      }
    }, [selectedMotorista]);
    
    const [clientes, setClientes] = useState<any[]>([]);
    const [clienteFilter, setClienteFilter] = useState<string[]>([]);
    const [cidadeFilter, setCidadeFilter] = useState<string[]>([]);
    const [cidades, setCidades] = useState<string[]>([]);
    const [tipoVeiculoFilter, setTipoVeiculoFilter] = useState<string[]>([]);
    const [tiposVeiculo, setTiposVeiculo] = useState<string[]>([]);
    const tableContainerRef = useRef<HTMLDivElement>(null);
    


    // Efeito para fechar dropdowns ao clicar fora deles
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (showStatusDropdown && !(event.target as HTMLElement).closest('#status-dropdown')) {
          setShowStatusDropdown(false);
        }
        if (showClienteDropdown && !(event.target as HTMLElement).closest('#cliente-dropdown')) {
          setShowClienteDropdown(false);
        }
        if (showCidadeDropdown && !(event.target as HTMLElement).closest('#cidade-dropdown')) {
          setShowCidadeDropdown(false);
        }
        if (showTipoVeiculoDropdown && !(event.target as HTMLElement).closest('#tipo-veiculo-dropdown')) {
          setShowTipoVeiculoDropdown(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [showStatusDropdown, showClienteDropdown, showCidadeDropdown, showTipoVeiculoDropdown]);
    
    const [contextMenu, setContextMenu] = useState<{
      visible: boolean;
      x: number;
      y: number;
      motorista: ViewContratado | null;
    }>({
      visible: false,
      x: 0,
      y: 0,
      motorista: null,
    });
    
    const [isUnifiedModalOpen, setIsUnifiedModalOpen] = useState(false);

    const convertToMotorista = (contratado: ViewContratado): MotoristaWithAddress | null => {
      if (!contratado) return null;
      
      const motoristaBase: Motorista = {
        motorista_id: contratado.motorista_id || 0,
        cpf: contratado.cpf || '',
        dt_nascimento: contratado.dt_nascimento || '',
        genero: contratado.genero || '',
        telefone: contratado.telefone ? Number(contratado.telefone) : null,
        email: contratado.email || null,
        funcao: contratado.funcao || '',
        nome: contratado.nome_motorista || 'Nome não informado',
        origem_usuario: contratado.origem_usuario || '',
        st_cadastro: contratado.st_cadastro || 'cadastrado',
        autorizacao_lgpd: contratado.autorizacao_lgpd || '',
        company_id: contratado.company_id || 0,
        data_cadastro: contratado.data_cadastro || new Date().toISOString(),
        cliente_id: contratado.cliente_id || 0,
        ativo: contratado.ativo || false,
        conversation_id: contratado.conversation_id || undefined,
        cidade: contratado.nome_cidade || undefined,
        documento_motorista: [],
        documento_ajudante: []
      };
      
      // Criando o objeto de endereço se houver informações disponíveis
      const endereco: EnderecoMotorista | undefined = 
        (contratado.logradouro || contratado.nr_cep || contratado.nome_bairro || contratado.nome_cidade || contratado.sigla_estado)
          ? {
              id_end_motorista: contratado.id_end_motorista || 0,
              nr_end: contratado.nr_end || null,
              ds_complemento_end: contratado.ds_complemento_end || null,
              st_end: contratado.st_end || null,
              logradouro: contratado.logradouro || null,
              nr_cep: contratado.nr_cep || null,
              bairro: contratado.nome_bairro || null,
              cidade: contratado.nome_cidade || null,
              estado: contratado.nome_estado || null,
              sigla_estado: contratado.sigla_estado || null
            }
          : undefined;
      
      // Criando o objeto de veículo se houver informações disponíveis
      const veiculo: Veiculo | undefined = contratado.veiculo_id || contratado.placa || contratado.tipo_veiculo
        ? {
            veiculo_id: contratado.veiculo_id || 0,
            placa: contratado.placa || '',
            status_veiculo: contratado.status_veiculo || false,
            marca: contratado.marca || '',
            tipo: contratado.tipo_veiculo || '',
            tipologia: contratado.tipologia || '',
            ano: contratado.ano || '',
            combustivel: contratado.combustivel || '',
            peso: contratado.peso || '',
            cubagem: contratado.cubagem || '',
            possui_rastreador: contratado.possui_rastreador || false,
            marca_rastreador: contratado.marca_rastreador || '',
            motorista_id: contratado.motorista_id || 0,
            cor: contratado.cor || '',
          }
        : undefined;
      
      // Retornando o objeto MotoristaWithAddress
      return {
        ...motoristaBase,
        ...(endereco && { endereco }),
        ...(veiculo && { veiculo })
      };
    };

    const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
    const [statusDropdownOpen, setStatusDropdownOpen] = useState<number | null>(null);
    const [clienteDropdownOpen, setClienteDropdownOpen] = useState<number | null>(null);
    const [updatingCliente, setUpdatingCliente] = useState<number | null>(null);
    const [dateFilter, setDateFilter] = useState<string>('all');
    const [showAddModal, setShowAddModal] = useState<boolean>(false);
    const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [roleChangeModal, setRoleChangeModal] = useState<{
    isOpen: boolean;
    motorista: ViewContratado | null;
    newRole: 'Motorista' | 'Agregado' | null;
    isLoading: boolean;
  }>({
    isOpen: false,
    motorista: null,
    newRole: null,
    isLoading: false,
  });
    const [customDateRange, setCustomDateRange] = useState<{
      startDate: string;
      endDate: string;
    }>({
      startDate: '',
      endDate: '',
    });

    useEffect(() => {
      fetchContratados();
      fetchClientes();
    }, [dateFilter, customDateRange]);

    useEffect(() => {
      // Close context menu when clicking anywhere
      const handleClick = () => {
        if (contextMenu.visible) {
          setContextMenu({ ...contextMenu, visible: false });
        }
        
        // Close any open status dropdown
        if (statusDropdownOpen !== null) {
          setStatusDropdownOpen(null);
        }
        
        // Close any open cliente dropdown
        if (clienteDropdownOpen !== null) {
          setClienteDropdownOpen(null);
        }
      };

      document.addEventListener('click', handleClick);
      return () => {
        document.removeEventListener('click', handleClick);
      };
    }, [contextMenu.visible, statusDropdownOpen, clienteDropdownOpen]);

    const handleRoleChangeConfirm = async () => {
      if (!roleChangeModal.motorista || !roleChangeModal.newRole) return;
      
      try {
        setRoleChangeModal(prev => ({ ...prev, isLoading: true }));
        
        const { error } = await supabase
          .from('motorista')
          .update({ funcao: roleChangeModal.newRole })
          .eq('motorista_id', roleChangeModal.motorista.motorista_id);

        if (error) throw error;

        // Atualiza o estado local
        setContratados(prev => 
          prev.map(m => 
            m.motorista_id === roleChangeModal.motorista?.motorista_id 
              ? { ...m, funcao: roleChangeModal.newRole as 'Motorista' | 'Agregado' } 
              : m
          )
        );

        toast.success(
          `Função alterada com sucesso para ${roleChangeModal.newRole === 'Motorista' ? 'Motorista' : 'Agregado'}!`,
          { duration: 3000 }
        );
        
        // Se estiver em uma visualização filtrada, atualiza a lista
        if (searchTerm) {
          fetchContratados();
        }
        
        // Fecha o modal
        setRoleChangeModal({ isOpen: false, motorista: null, newRole: null, isLoading: false });
      } catch (error) {
        console.error('Erro ao alterar função:', error);
        toast.error(
          <div className="flex items-center space-x-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <span>Erro ao alterar função do motorista</span>
          </div>,
          { duration: 3000 }
        );
        setRoleChangeModal(prev => ({ ...prev, isLoading: false }));
      }
    };

    const openRoleChangeModal = (motorista: ViewContratado, newRole: 'Motorista' | 'Agregado') => {
      setRoleChangeModal({
        isOpen: true,
        motorista,
        newRole,
        isLoading: false
      });
    };

    const fetchContratados = async () => {
      try {
        setLoading(true);
        // Buscar os agregados da view específica
        let query = supabase
          .from('vw_agregados_completo')
          .select('*')
          .eq('company_id', companyId);

        // Apply date filter
        if (dateFilter !== 'all') {
          const today = new Date();
          let startDate = new Date();
          
          if (dateFilter === 'today') {
            // Today only
            startDate = new Date(today.setHours(0, 0, 0, 0));
            query = query.gte('data_cadastro', startDate.toISOString().split('T')[0]);
            query = query.lte('data_cadastro', new Date().toISOString().split('T')[0]);
          } else if (dateFilter === '2days') {
            // Last 2 days
            startDate.setDate(today.getDate() - 2);
            query = query.gte('data_cadastro', startDate.toISOString().split('T')[0]);
          } else if (dateFilter === '15days') {
            // Last 15 days
            startDate.setDate(today.getDate() - 15);
            query = query.gte('data_cadastro', startDate.toISOString().split('T')[0]);
          } else if (dateFilter === '30days') {
            // Last 30 days
            startDate.setDate(today.getDate() - 30);
            query = query.gte('data_cadastro', startDate.toISOString().split('T')[0]);
          } else if (dateFilter === 'custom' && customDateRange.startDate && customDateRange.endDate) {
            // Custom date range
            query = query.gte('data_cadastro', customDateRange.startDate);
            query = query.lte('data_cadastro', customDateRange.endDate);
          }
        }

        // Order by data_cadastro (newest first)
        query = query.order('data_cadastro', { ascending: false });

        const { data, error } = await query;

        if (error) throw error;

        // Log para debug dos valores de funcao
        console.log('Valores de funcao encontrados:', [...new Set(data?.map(item => item.funcao))]);
        console.log('Dados completos:', data);

        // Extract unique cities from contratados - only include non-null/undefined city names
        const uniqueCities = new Set<string>();
        const uniqueVehicleTypes = new Set<string>();
        
        // Primeiro, vamos buscar os status ativos dos motoristas
        const motoristaIds = data?.map(m => m.motorista_id) || [];
        let ativosStatus: Record<number, boolean> = {};
        
        if (motoristaIds.length > 0) {
          const { data: motoristas, error: motoristasError } = await supabase
            .from('motorista')
            .select('motorista_id, ativo')
            .in('motorista_id', motoristaIds);
            
          if (motoristasError) {
            console.error('Erro ao buscar status dos motoristas:', motoristasError);
          } else {
            // Criar um mapa de motorista_id para status ativo
            motoristas?.forEach(m => {
              ativosStatus[m.motorista_id] = m.ativo === true;
            });
          }
        }
        
        // Processar os dados com os status ativos
        const processedData = data?.map(motorista => {
          const ativo = ativosStatus[motorista.motorista_id] === true;
          return {
            ...motorista,
            ativo: ativo
          };
        }) || [];

        // Agrupar ajudantes por motorista_id
        const agregadosAgrupadosMap = new Map();
        processedData.forEach(agregado => {
          // Extract cities and vehicle types while processing data
          if (agregado.nome_cidade && typeof agregado.nome_cidade === 'string') {
            uniqueCities.add(agregado.nome_cidade);
          }
          
          // Extract vehicle types from different fields
          if (agregado.tipologia && typeof agregado.tipologia === 'string') {
            uniqueVehicleTypes.add(agregado.tipologia);
          }
          if (agregado.tipo && typeof agregado.tipo === 'string') {
            uniqueVehicleTypes.add(agregado.tipo);
          }
          if (agregado.tipo_veiculo && typeof agregado.tipo_veiculo === 'string') {
            uniqueVehicleTypes.add(agregado.tipo_veiculo);
          }
          
          if (!agregadosAgrupadosMap.has(agregado.motorista_id)) {
            agregadosAgrupadosMap.set(agregado.motorista_id, {
              ...agregado,
              ajudantes: agregado.nome_ajudante ? [agregado.nome_ajudante] : [],
            });
          } else {
            const existente = agregadosAgrupadosMap.get(agregado.motorista_id);
            if (agregado.nome_ajudante && !existente.ajudantes.includes(agregado.nome_ajudante)) {
              existente.ajudantes.push(agregado.nome_ajudante);
            }
          }
        });
        const agregadosAgrupados = Array.from(agregadosAgrupadosMap.values());

        // Filter out null or undefined values before setting the state
        setCidades(Array.from(uniqueCities).filter((c): c is string => c != null).sort());
        setTiposVeiculo(Array.from(uniqueVehicleTypes).sort());

        setContratados(agregadosAgrupados);
      } catch (error) {
        console.error('Error fetching contratados:', error);
        toast.error('Erro ao carregar contratados');
      } finally {
        setLoading(false);
      }
    };

    // Cores padrão para os clientes (apenas fundo, sem borda)
    const defaultClientColors = [
      'bg-blue-100 dark:bg-blue-900/30',
      'bg-green-100 dark:bg-green-900/30',
      'bg-yellow-100 dark:bg-yellow-900/30',
      'bg-red-100 dark:bg-red-900/30',
      'bg-purple-100 dark:bg-purple-900/30',
      'bg-pink-100 dark:bg-pink-900/30',
      'bg-indigo-100 dark:bg-indigo-900/30',
    ];

    const fetchClientes = async () => {
      try {
        const { data, error } = await supabase
          .from('cliente')
          .select('*')
          .eq('company_id', companyId)
          .eq('st_cliente', true)
          .order('nome');

        if (error) throw error;

        // Adiciona uma cor a cada cliente
        const clientesComCor = (data || []).map((cliente, index) => ({
          ...cliente,
          cor: defaultClientColors[index % defaultClientColors.length] || 'bg-gray-100 dark:bg-gray-700',
        }));

        setClientes(clientesComCor);
      } catch (error) {
        console.error('Error fetching clientes:', error);
        toast.error('Erro ao carregar clientes');
      }
    };

    const handleViewDocument = async (motorista: ViewContratado) => {
      try {
        setSelectedMotorista(motorista);
        setIsUnifiedAgregadoModalOpen(true);
      } catch (error) {
        console.error('Error opening agregado details:', error);
        toast.error('Erro ao abrir detalhes do agregado');
      }
    };

    const handleUploadDocument = (motorista: ViewContratado) => {
      setSelectedMotorista(motorista);
      setIsDocumentUploadOpen(true);
    };

    const handleEdit = (motorista: ViewContratado) => {
      setSelectedMotorista(motorista);
      setIsUnifiedModalOpen(true);
    };



    const confirmDelete = async () => {
      if (!selectedMotorista) return;

      try {
        const { error } = await query('motorista')
          .delete()
          .eq('motorista_id', selectedMotorista.motorista_id);

        if (error) throw error;

        setContratados(contratados.filter(m => m.motorista_id !== selectedMotorista.motorista_id));
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
      setSelectAll(newSelectedItems.size === filteredContratados.length);
    };
    
    // Funções para manipular filtros de múltipla seleção
    const toggleFilterOption = (filterType: 'status' | 'cliente' | 'cidade' | 'tipoVeiculo', value: string | null | undefined) => {
      // Skip if value is null or undefined
      if (value == null) return;
      switch (filterType) {
        case 'status':
          setStatusFilter(prev => 
            prev.includes(value) 
              ? prev.filter(v => v !== value) 
              : [...prev, value]
          );
          break;
        case 'cliente':
          setClienteFilter(prev => 
            prev.includes(value) 
              ? prev.filter(v => v !== value) 
              : [...prev, value]
          );
          break;
        case 'cidade':
          setCidadeFilter(prev => 
            prev.includes(value) 
              ? prev.filter(v => v !== value) 
              : [...prev, value]
          );
          break;
        case 'tipoVeiculo':
          setTipoVeiculoFilter(prev => 
            prev.includes(value) 
              ? prev.filter(v => v !== value) 
              : [...prev, value]
          );
          break;
      }
    };
    
    const clearFilter = (filterType: 'status' | 'cliente' | 'cidade' | 'tipoVeiculo') => {
      switch (filterType) {
        case 'status':
          setStatusFilter([]);
          break;
        case 'cliente':
          setClienteFilter([]);
          break;
        case 'cidade':
          setCidadeFilter([]);
          break;
        case 'tipoVeiculo':
          setTipoVeiculoFilter([]);
          break;
      }
    };
    
    const getFilterButtonText = (filterType: 'status' | 'cliente' | 'cidade' | 'tipoVeiculo') => {
      const filterMap = {
        status: { 
          label: 'Status', 
          filter: statusFilter,
          allText: 'Todos os status'
        },
        cliente: { 
          label: 'Cliente', 
          filter: clienteFilter,
          allText: 'Todos os clientes'
        },
        cidade: { 
          label: 'Cidade', 
          filter: cidadeFilter,
          allText: 'Todas as cidades'
        },
        tipoVeiculo: { 
          label: 'Tipo de Veículo', 
          filter: tipoVeiculoFilter,
          allText: 'Todos os tipos de veículo'
        }
      };
      
      const { filter, allText } = filterMap[filterType];
      
      if (filter.length === 0) return allText;
      if (filter.length === 1) {
        if (filter[0] === 'sem_cliente') return 'Sem cliente';
        if (filter[0] === 'sem_veiculo') return 'Sem veículo';
        return `${filter[0]}`;
      }
      return `${filter.length} selecionado(s)`;
    };

    const handleSelectAll = () => {
      if (selectAll) {
        setSelectedItems(new Set());
      } else {
        setSelectedItems(new Set(filteredContratados.map(m => m.motorista_id || 0)));
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
        setContratados(contratados.filter(m => !selectedItems.has(m.motorista_id || 0)));
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

    const handleBulkAction = (type: 'status' | 'client') => {
      setBulkActionType(type);
      setIsBulkActionsModalOpen(true);
    };

    const handleBulkUpdateTreinamento = async (marcar: boolean) => {
      if (selectedItems.size === 0) {
        toast.error('Selecione pelo menos um motorista');
        return;
      }

      try {
        const newDate = marcar ? new Date().toISOString().split('T')[0] : null;
        
        // Atualiza no banco de dados
        const { error } = await supabase
          .from('motorista_eventos_cliente')
          .upsert(
            Array.from(selectedItems).map(id => ({
              motorista_id: id,
              treinamento: marcar,
              treinamento_data: newDate
            })),
            { onConflict: 'motorista_id' }
          );

        if (error) throw error;

        // Atualiza o estado local
        setContratados(prev =>
          prev.map(motorista =>
            selectedItems.has(motorista.motorista_id!)
              ? {
                  ...motorista,
                  treinamento: marcar,
                  treinamento_data: newDate
                }
              : motorista
          )
        );

        toast.success(`Treinamento ${marcar ? 'marcado' : 'desmarcado'} em massa com sucesso`);
      } catch (error) {
        console.error('Erro ao atualizar treinamento em massa:', error);
        toast.error('Erro ao atualizar treinamento');
      }
    };

    const handleBulkUpdateIntegracao = async (marcar: boolean) => {
      if (selectedItems.size === 0) {
        toast.error('Selecione pelo menos um motorista');
        return;
      }

      try {
        const newDate = marcar ? new Date().toISOString().split('T')[0] : null;
        
        // Atualiza no banco de dados
        const { error } = await supabase
          .from('motorista_eventos_cliente')
          .upsert(
            Array.from(selectedItems).map(id => ({
              motorista_id: id,
              integracao: marcar,
              integracao_data: newDate
            })),
            { onConflict: 'motorista_id' }
          );

        if (error) throw error;

        // Atualiza o estado local
        setContratados(prev =>
          prev.map(motorista =>
            selectedItems.has(motorista.motorista_id!)
              ? {
                  ...motorista,
                  integracao: marcar,
                  integracao_data: newDate
                }
              : motorista
          )
        );

        toast.success(`Integração Interna ${marcar ? 'marcada' : 'desmarcada'} em massa com sucesso`);
      } catch (error) {
        console.error('Erro ao atualizar integração em massa:', error);
        toast.error('Erro ao atualizar integração');
      }
    };

    const handleMassMessage = () => {
      setIsMassMessageModalOpen(true);
    };

    const handleContextMenu = (e: React.MouseEvent, motorista: ViewContratado) => {
      e.preventDefault();
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        motorista,
      });
    };

    const toggleStatusDropdown = (e: React.MouseEvent, motoristaId: number) => {
      e.stopPropagation();
      if (statusDropdownOpen === motoristaId) {
        setStatusDropdownOpen(null);
      } else {
        setStatusDropdownOpen(motoristaId);
      }
    };

    const toggleClienteDropdown = (e: React.MouseEvent, motoristaId: number) => {
      e.stopPropagation();
      if (clienteDropdownOpen === motoristaId) {
        setClienteDropdownOpen(null);
      } else {
        setClienteDropdownOpen(motoristaId);
      }
    };

    const handleUpdateStatus = async (e: React.MouseEvent | null, motorista: ViewContratado, newStatus: string) => {
      if (e) e.stopPropagation();
      try {
        setUpdatingStatus(motorista.motorista_id || 0);
        
        // Update the status in the database
        const { error } = await supabase
          .from('motorista')
          .update({ st_cadastro: newStatus })
          .eq('motorista_id', motorista.motorista_id || 0);
          
        if (error) throw error;
        
        // If the new status is not 'contratado', remove from the list
        if (newStatus !== 'contratado') {
          setContratados(prev => prev.filter(m => m.motorista_id !== motorista.motorista_id));
          toast.success(`Status atualizado para ${newStatus.replace('_', ' ')}. Motorista removido da lista.`);
        } else {
          // Update the local state
          setContratados(prev => 
            prev.map(m => 
              m.motorista_id === motorista.motorista_id 
                ? { ...m, st_cadastro: newStatus } 
                : m
            )
          );
          toast.success(`Status atualizado para ${newStatus.replace('_', ' ')}`);
        }
      } catch (error) {
        console.error('Error updating status:', error);
        toast.error('Erro ao atualizar status');
      } finally {
        setUpdatingStatus(null);
        setStatusDropdownOpen(null);
      }
    };

    const handleUpdateCliente = async (e: React.MouseEvent | null, motorista: ViewContratado, clienteId: number | null) => {
      if (e) e.stopPropagation();
      try {
        setUpdatingCliente(motorista.motorista_id || 0);
        
        // Update the cliente_id in the database
        const { error } = await supabase
          .from('motorista')
          .update({ cliente_id: clienteId })
          .eq('motorista_id', motorista.motorista_id || 0);
          
        if (error) throw error;
        
        // Update the local state
        setContratados(prev => 
          prev.map(m => 
            m.motorista_id === motorista.motorista_id 
              ? { 
                  ...m, 
                  cliente_id: clienteId,
                  cliente: clienteId 
                    ? clientes.find(c => c.cliente_id === clienteId) 
                    : null
                } 
              : m
          )
        );
        
        toast.success(clienteId ? 'Cliente atualizado com sucesso' : 'Cliente removido com sucesso');
      } catch (error) {
        console.error('Error updating cliente:', error);
        toast.error('Erro ao atualizar cliente');
      } finally {
        setUpdatingCliente(null);
        setClienteDropdownOpen(null);
      }
    };

    const handleToggleStatus = async (e: React.MouseEvent, motorista: ViewContratado) => {
      e.stopPropagation();
      try {
        setUpdatingStatus(motorista.motorista_id || 0);
        
        // Update the ativo status in the database (toggle it)
        const newAtivo = !motorista.ativo;
        
        const { error } = await supabase
          .from('motorista')
          .update({ ativo: newAtivo })
          .eq('motorista_id', motorista.motorista_id || 0);
          
        if (error) throw error;
        
        // Update the local state
        setContratados(prev => 
          prev.map(m => 
            m.motorista_id === motorista.motorista_id 
              ? { ...m, ativo: newAtivo } 
              : m
          )
        );
        
        toast.success(`Motorista ${newAtivo ? 'ativado' : 'desativado'} com sucesso`);
      } catch (error) {
        console.error('Error updating ativo status:', error);
        toast.error('Erro ao atualizar status do motorista');
      } finally {
        setUpdatingStatus(null);
      }
    };

    const getMotoristaCity = (motorista: ViewContratado): string => {
      return motorista.nome_cidade ?? '';
    };

    const filteredContratados = contratados.filter((motorista): boolean => {
      const searchLower = searchTerm.toLowerCase();
      
      // Lógica para filtro de status (multiseleção)
      const statusMatch = statusFilter.length === 0 || 
        (motorista.st_cadastro && statusFilter.includes(motorista.st_cadastro));
      
      // Lógica para filtro de cliente (multiseleção)
      let clienteMatch = true;
      if (clienteFilter.length > 0) {
        if (clienteFilter.includes('sem_cliente')) {
          // Se 'sem_cliente' está selecionado, inclui registros sem cliente
          clienteMatch = motorista.cliente_id === null || motorista.cliente_id === undefined;
        } else {
          // Verifica se o cliente do motorista está na lista de clientes selecionados
          clienteMatch = motorista.cliente_id !== null && 
            motorista.cliente_id !== undefined &&
            clienteFilter.includes(motorista.cliente_id.toString());
        }
        
        // Se 'sem_cliente' está selecionado junto com outros clientes, combina os resultados
        if (clienteFilter.includes('sem_cliente') && clienteFilter.length > 1) {
          clienteMatch = clienteMatch || (motorista.cliente_id === null || motorista.cliente_id === undefined);
        }
      }
      
      // Lógica para filtro de cidade (multiseleção)
      const cidadeMatch = cidadeFilter.length === 0 || 
        (motorista.nome_cidade != null && cidadeFilter.includes(motorista.nome_cidade));
      
      // Lógica para filtro de tipo de veículo (multiseleção)
      let tipoVeiculoMatch = true;
      if (tipoVeiculoFilter.length > 0) {
        // Check for 'sem_veiculo' filter
        if (tipoVeiculoFilter.includes('sem_veiculo')) {
          tipoVeiculoMatch = !motorista.veiculo || motorista.veiculo.length === 0;
          
          // If other filters are also selected, we need to check them too
          if (tipoVeiculoFilter.length > 1) {
            const hasMatchingVehicle = checkVehicleTypeMatch(motorista, tipoVeiculoFilter.filter(t => t !== 'sem_veiculo'));
            tipoVeiculoMatch = tipoVeiculoMatch || hasMatchingVehicle;
          }
        } else {
          // Check vehicle type against filters
          tipoVeiculoMatch = checkVehicleTypeMatch(motorista, tipoVeiculoFilter);
        }
      }
      
      const ativoMatch = ativoFilter === '' ? true : 
                        ativoFilter === 'active' ? motorista.ativo === true : 
                        ativoFilter === 'inactive' ? motorista.ativo === false : true;
      
      const searchMatch = Boolean(
        (motorista.nome_motorista && motorista.nome_motorista.toLowerCase().includes(searchLower)) ||
        (motorista.cpf && motorista.cpf.includes(searchLower)) ||
        (typeof motorista.email === 'string' && motorista.email.toLowerCase().includes(searchLower)) ||
        (motorista.telefone && motorista.telefone.toString().includes(searchLower))
      );
      
      return Boolean(
        statusMatch &&
        clienteMatch &&
        cidadeMatch &&
        tipoVeiculoMatch &&
        ativoMatch &&
        searchMatch
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
    } = usePagination({
      data: filteredContratados,
      initialPageSize: 10
    });

    if (loading) {
      return <LoadingSpinner />;
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
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleBulkAction('status')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                            transition-colors flex items-center gap-2"
                  >
                    <Edit2 className="w-5 h-5" />
                    Atualizar Status
                  </button>
                  
                  <button
                    onClick={() => handleBulkUpdateIntegracao(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 
                            focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 
                            transition-colors flex items-center gap-2"
                    title="Marcar Integração Interna"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check-circle">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <path d="m9 11 3 3L22 4"/>
                    </svg>
                    Int. Interna
                  </button>
                  
                  <button
                    onClick={() => handleBulkUpdateTreinamento(true)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 
                            focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 
                            transition-colors flex items-center gap-2"
                    title="Marcar Treinamento Cliente"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-graduation-cap">
                      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                      <path d="M6 12v5c3 3 9 1 9-1v-5"/>
                    </svg>
                    Treinamento
                  </button>
                </div>
                <button
                  onClick={() => handleBulkAction('client')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                          transition-colors flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                  Atribuir Cliente
                </button>
                <button
                  onClick={handleMassMessage}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                          transition-colors flex items-center gap-2"
                >
                  <MessageCircle className="w-5 h-5" />
                  Enviar Mensagem
                </button>
                <button
                  onClick={() => setIsBulkDeleteModalOpen(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 
                          focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 
                          transition-colors flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18"></path>
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                  </svg>
                  Excluir
                </button>
              </>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar por nome, CPF, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="relative" id="status-dropdown">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  className="w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-left flex items-center justify-between"
                >
                  <span className="truncate">
                    {getFilterButtonText('status')}
                  </span>
                  <div className="absolute inset-y-0 right-2 flex items-center">
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showStatusDropdown ? 'transform rotate-180' : ''}`} />
                  </div>
                </button>
                <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                {statusFilter.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearFilter('status');
                    }}
                    className="absolute right-9 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 z-10 p-1"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {showStatusDropdown && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-48 overflow-y-auto">
                  <div className="px-3 py-1.5 flex justify-between items-center border-b border-gray-200 dark:border-gray-600">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Selecione os status</span>
                    <button 
                      type="button" 
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStatusFilter([]);
                      }}
                    >
                      Limpar
                    </button>
                  </div>
                  {[
                    { value: 'cadastrado', label: 'Cadastrado' },
                    { value: 'qualificado', label: 'Qualificado' },
                    { value: 'documentacao', label: 'Documentação' },
                    { value: 'gestao_risco', label: 'Gestão de Risco' },
                    { value: 'contrato_enviado', label: 'Contrato Enviado' },
                    { value: 'contratado', label: 'Contratado' },
                    { value: 'repescagem', label: 'Repescagem' },
                    { value: 'rejeitado', label: 'Rejeitado' }
                  ].map(({ value, label }) => (
                    <div key={value} className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer flex items-center">
                      <input
                        type="checkbox"
                        id={`status-${value}`}
                        checked={statusFilter.includes(value)}
                        onChange={() => toggleFilterOption('status', value)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <label htmlFor={`status-${value}`} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        {label}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <select
                value={ativoFilter}
                onChange={(e) => setAtivoFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none"
              >
                <option value="">Todos (Ativos/Inativos)</option>
                <option value="active">Somente Ativos</option>
                <option value="inactive">Somente Inativos</option>
              </select>
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </div>
          
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative" id="cliente-dropdown">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowClienteDropdown(!showClienteDropdown)}
                  className="w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-left flex items-center justify-between"
                >
                  <span className="truncate">
                    {getFilterButtonText('cliente')}
                  </span>
                  <div className="absolute inset-y-0 right-2 flex items-center">
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showClienteDropdown ? 'transform rotate-180' : ''}`} />
                  </div>
                </button>
                <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                {clienteFilter.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearFilter('cliente');
                    }}
                    className="absolute right-9 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 z-10 p-1"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {showClienteDropdown && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-48 overflow-y-auto">
                  <div className="px-3 py-1.5 flex justify-between items-center border-b border-gray-200 dark:border-gray-600">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Selecione os clientes</span>
                    <button 
                      type="button" 
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setClienteFilter([]);
                      }}
                    >
                      Limpar
                    </button>
                  </div>
                  <div className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer flex items-center">
                    <input
                      type="checkbox"
                      id="cliente-sem_cliente"
                      checked={clienteFilter.includes('sem_cliente')}
                      onChange={() => toggleFilterOption('cliente', 'sem_cliente')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <label htmlFor="cliente-sem_cliente" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                      Sem cliente
                    </label>
                  </div>
                  {clientes.map(cliente => (
                    <div key={cliente.cliente_id} className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer flex items-center">
                      <input
                        type="checkbox"
                        id={`cliente-${cliente.cliente_id}`}
                        checked={clienteFilter.includes(cliente.cliente_id.toString())}
                        onChange={() => toggleFilterOption('cliente', cliente.cliente_id.toString())}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <label htmlFor={`cliente-${cliente.cliente_id}`} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        {cliente.nome}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="relative" id="cidade-dropdown">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCidadeDropdown(!showCidadeDropdown)}
                  className="w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-left flex items-center justify-between"
                >
                  <span className="truncate">
                    {getFilterButtonText('cidade')}
                  </span>
                  <div className="absolute inset-y-0 right-2 flex items-center">
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showCidadeDropdown ? 'transform rotate-180' : ''}`} />
                  </div>
                </button>
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                {cidadeFilter.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearFilter('cidade');
                    }}
                    className="absolute right-9 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 z-10 p-1"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {showCidadeDropdown && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-48 overflow-y-auto">
                  <div className="px-3 py-1.5 flex justify-between items-center border-b border-gray-200 dark:border-gray-600">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Selecione as cidades</span>
                    <button 
                      type="button" 
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCidadeFilter([]);
                      }}
                    >
                      Limpar
                    </button>
                  </div>
                  {cidades
                    .filter((cidade): cidade is string => cidade != null)
                    .map((cidade, index) => (
                      <div key={index} className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer flex items-center">
                        <input
                          type="checkbox"
                          id={`cidade-${index}`}
                          checked={cidadeFilter.includes(cidade)}
                          onChange={() => toggleFilterOption('cidade', cidade)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <label htmlFor={`cidade-${index}`} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                          {cidade}
                        </label>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>

            <div className="relative" id="tipo-veiculo-dropdown">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTipoVeiculoDropdown(!showTipoVeiculoDropdown)}
                  className="w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-left flex items-center justify-between"
                >
                  <span className="truncate">
                    {getFilterButtonText('tipoVeiculo')}
                  </span>
                  <div className="absolute inset-y-0 right-2 flex items-center">
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showTipoVeiculoDropdown ? 'transform rotate-180' : ''}`} />
                  </div>
                </button>
                <Truck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                {tipoVeiculoFilter.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearFilter('tipoVeiculo');
                    }}
                    className="absolute right-9 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 z-10 p-1"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {showTipoVeiculoDropdown && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-48 overflow-y-auto">
                  <div className="px-3 py-1.5 flex justify-between items-center border-b border-gray-200 dark:border-gray-600">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Selecione os tipos de veículo</span>
                    <button 
                      type="button" 
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTipoVeiculoFilter([]);
                      }}
                    >
                      Limpar
                    </button>
                  </div>
                  <div className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer flex items-center">
                    <input
                      type="checkbox"
                      id="tipo-veiculo-sem_veiculo"
                      checked={tipoVeiculoFilter.includes('sem_veiculo')}
                      onChange={() => toggleFilterOption('tipoVeiculo', 'sem_veiculo')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <label htmlFor="tipo-veiculo-sem_veiculo" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                      Sem veículo
                    </label>
                  </div>
                  {tiposVeiculo.map((tipo, index) => (
                    <div key={index} className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer flex items-center">
                      <input
                        type="checkbox"
                        id={`tipo-veiculo-${index}`}
                        checked={tipoVeiculoFilter.includes(tipo)}
                        onChange={() => toggleFilterOption('tipoVeiculo', tipo)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <label htmlFor={`tipo-veiculo-${index}`} className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        {tipo}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none truncate"
              >
                <option value="all">Todos os períodos</option>
                <option value="today">Hoje</option>
                <option value="2days">Últimos 2 dias</option>
                <option value="15days">Últimos 15 dias</option>
                <option value="30days">Último mês</option>
                <option value="custom">Personalizado</option>
              </select>
              <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center justify-center"
              aria-label="Novo Agregado"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {dateFilter === 'custom' && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Data inicial
                </label>
                <input
                  type="date"
                  value={customDateRange.startDate}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Data final
                </label>
                <input
                  type="date"
                  value={customDateRange.endDate}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          )}
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">CPF</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Contato</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Cliente</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Cidade</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Veículo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Data Cadastro</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {paginatedData.map((motorista, index) => (
                      <tr 
                        key={`agregado-${motorista.motorista_id || ''}-${motorista.cpf || ''}-${index}`}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                          selectedItems.has(motorista.motorista_id || 0) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                        onContextMenu={(e) => handleContextMenu(e, motorista)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedItems.has(motorista.motorista_id || 0)}
                            onChange={() => handleSelectItem(motorista.motorista_id || 0)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                              {motorista.funcao === 'Motorista' ? (
                                <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              ) : (
                                <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              )}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {motorista.nome_motorista || ''}
                                {motorista.ajudantes && motorista.ajudantes.length > 0 && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Ajudantes: {motorista.ajudantes.join(', ')}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {formatCPF(motorista.cpf || '')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {motorista.telefone ? formatPhone(motorista.telefone.toString()) : '-'}
                            </div>
                            {motorista.telefone && (
                              <button
                                onClick={() => startChat(motorista.telefone?.toString() || '', motorista.nome_motorista || '')}
                                className="ml-2 p-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 rounded-full hover:bg-green-50 dark:hover:bg-green-900/20"
                                title="Iniciar chat"
                              >
                                <MessageCircle size={16} />
                              </button>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {motorista.email || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="relative">
                            <TableDropdown
                              value={motorista.st_cadastro || 'cadastrado'}
                              options={STATUS_OPTIONS}
                              onSelect={(value) => handleUpdateStatus(null, motorista, value as string)}
                              placeholder="Selecionar Status"
                              disabled={updatingStatus === motorista.motorista_id}
                              buttonClassName={
                                motorista.st_cadastro === 'contratado' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' :
                                motorista.st_cadastro === 'rejeitado' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200' :
                                motorista.st_cadastro === 'documentacao' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200' :
                                motorista.st_cadastro === 'qualificado' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' :
                                motorista.st_cadastro === 'contrato_enviado' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200' :
                                motorista.st_cadastro === 'repescagem' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200' :
                                motorista.st_cadastro === 'gestao_risco' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200' :
                                motorista.st_cadastro === 'cadastrado' || motorista.st_cadastro === 'Cadastrado' ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200' :
                                'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                              }
                            />
                            
                            {updatingStatus === motorista.motorista_id && (
                              <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 rounded-full">
                                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="relative">
                            <TableDropdown
                              value={motorista.cliente_id}
                              options={[
                                { value: null, label: 'Sem cliente', color: 'bg-gray-100 dark:bg-gray-700' },
                                ...clientes.map(cliente => ({
                                  value: cliente.cliente_id,
                                  label: cliente.nome,
                                  color: cliente.cor || 'bg-gray-100 dark:bg-gray-700'
                                }))
                              ]}
                              onSelect={(value) => handleUpdateCliente(null, motorista, value === null ? null : value as number)}
                              placeholder="Selecionar Cliente"
                              disabled={updatingCliente === motorista.motorista_id}
                              buttonClassName={
                                motorista.cliente_id 
                                  ? clientes.find(c => c.cliente_id === motorista.cliente_id)?.cor || 
                                    'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200'
                                  : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200'
                              }
                            />
                            
                            {updatingCliente === motorista.motorista_id && (
                              <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 rounded-full">
                                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {getMotoristaCity(motorista) || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {motorista.placa ? (
                              <div>
                                <div className="font-medium">{motorista.placa}</div>
                                {motorista.tipologia && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {motorista.tipologia}
                                  </div>
                                )}
                              </div>
                            ) : (
                              '-'
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {formatDate(motorista.data_cadastro)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-3">
                            <button
                              onClick={() => handleViewDocument(motorista)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                              title="Visualizar"
                            >
                              <FilePen size={18} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openRoleChangeModal(motorista, motorista.funcao === 'Motorista' ? 'Agregado' : 'Motorista');
                              }}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                              title={motorista.funcao === 'Motorista' ? 'Transformar em Agregado' : 'Transformar em Motorista'}
                            >
                              <ArrowLeftRight size={18} />
                            </button>
                            <button
                              onClick={(e) => handleToggleStatus(e, motorista)}
                              disabled={updatingStatus === motorista.motorista_id}
                              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                motorista.ativo 
                                  ? 'bg-green-500 dark:bg-green-600' 
                                  : 'bg-gray-200 dark:bg-gray-700'
                              } ${updatingStatus === motorista.motorista_id ? 'opacity-50 cursor-not-allowed' : ''}`}
                              role="switch"
                              aria-checked={motorista.ativo}
                              title={motorista.ativo ? "Desativar motorista" : "Ativar motorista"}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  motorista.ativo ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                              {updatingStatus === motorista.motorista_id && (
                                <Loader2 
                                  className="absolute inset-0 m-auto w-4 h-4 text-white animate-spin" 
                                />
                              )}
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
          </div>
          
          {filteredContratados.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                Nenhum contratado encontrado
              </p>
            </div>
          ) : (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={totalItems}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
        </div>

        {/* Context Menu */}
        {contextMenu.visible && contextMenu.motorista && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu({ ...contextMenu, visible: false })}
            actions={[
              {
                icon: <User size={16} />,
                label: 'Visualizar Detalhes' as const satisfies string,
                onClick: () => handleViewDocument(contextMenu.motorista!),
                color: 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300'
              },
              {
                icon: <Edit2 size={16} />,
                label: 'Editar Motorista',
                onClick: () => handleEdit(contextMenu.motorista!),
                color: 'text-yellow-500 hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300'
              },
              {
                icon: <FileText size={16} />,
                label: 'Gerenciar Documentos',
                onClick: () => handleUploadDocument(contextMenu.motorista!),
                color: 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300'
              },
              {
                icon: <MessageCircle size={16} />,
                label: 'Iniciar Chat',
                onClick: () => startChat(contextMenu.motorista!.telefone?.toString() || '', contextMenu.motorista!.nome_motorista || ''),
                color: 'text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300',
                disabled: !contextMenu.motorista!.telefone
              }
            ]}
          />
        )}

        {/* Modals */}
        <UnifiedAgregadoModal
          isOpen={isUnifiedModalOpen}
          onClose={() => setIsUnifiedModalOpen(false)}
          motorista={selectedMotorista ? convertToMotorista(selectedMotorista) : null}
          onSuccess={fetchContratados}
        />

        <DocumentViewer
          isOpen={isDocumentViewerOpen}
          onClose={() => setIsDocumentViewerOpen(false)}
          documento={documento}
          nome={selectedMotorista?.nome_motorista || ''}
          cpf={selectedMotorista?.cpf}
          email={selectedMotorista?.email || undefined}
          telefone={selectedMotorista?.telefone?.toString()}
          dt_nascimento={selectedMotorista?.dt_nascimento}
          endereco={endereco || undefined}
          st_cadastro={selectedMotorista?.st_cadastro || 'cadastrado'}
        />

        <DocumentUploadModal
          isOpen={isDocumentUploadOpen}
          onClose={() => setIsDocumentUploadOpen(false)}
          motorista_id={selectedMotorista?.motorista_id || 0}
          nome={selectedMotorista?.nome_motorista || ''}
          onUploadSuccess={fetchContratados}
        />

        <EditMotoristaModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          motorista={selectedMotorista ? (() => {
            const motoristaWithAddress: MotoristaWithAddress = {
              ...selectedMotorista as unknown as Motorista,
              nome: selectedMotorista.nome_motorista || '',
              endereco: {
                id_end_motorista: selectedMotorista.id_end_motorista || 0,
                nr_end: selectedMotorista.nr_end ?? null,
                ds_complemento_end: selectedMotorista.ds_complemento_end ?? null,
                st_end: selectedMotorista.st_end ?? null,
                logradouro: selectedMotorista.logradouro ?? null,
                nr_cep: selectedMotorista.nr_cep ?? null,
                bairro: selectedMotorista.nome_bairro ?? null,
                cidade: selectedMotorista.nome_cidade ?? null,
                estado: selectedMotorista.nome_estado ?? null,
                sigla_estado: selectedMotorista.sigla_estado ?? null
              },
              veiculo: selectedMotorista.veiculo_id ? {
                veiculo_id: selectedMotorista.veiculo_id,
                placa: selectedMotorista.placa || '',
                status_veiculo: selectedMotorista.status_veiculo || false,
                marca: selectedMotorista.marca || '',
                tipologia: selectedMotorista.tipologia || '',
                ano: selectedMotorista.ano || '',
                combustivel: selectedMotorista.combustivel || '',
                peso: selectedMotorista.peso || '',
                cubagem: selectedMotorista.cubagem || '',
                possui_rastreador: selectedMotorista.possui_rastreador || false,
                marca_rastreador: selectedMotorista.marca_rastreador || '',
                motorista_id: selectedMotorista.motorista_id || 0,
                cor: selectedMotorista.cor || '',
                tipo: selectedMotorista.tipo || ''
              } : undefined
            };
            return motoristaWithAddress;
          })() : null}
          onUpdate={fetchContratados}
        />

        <DeleteConfirmationModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={confirmDelete}
          title="Excluir Motorista"
          message={`Tem certeza que deseja excluir o motorista ${selectedMotorista?.nome_motorista || ''}?`}
        />

        {selectedMotorista && (
          <UnifiedAgregadoModal
            isOpen={isUnifiedAgregadoModalOpen}
            onClose={() => setIsUnifiedAgregadoModalOpen(false)}
            motorista={{
              ...selectedMotorista,
              motorista_id: selectedMotorista.motorista_id || 0,
              nome: selectedMotorista.nome_motorista || '',
              cpf: selectedMotorista.cpf || '',
              telefone: selectedMotorista.telefone ? Number(selectedMotorista.telefone) : null,
              email: selectedMotorista.email || null,
              dt_nascimento: selectedMotorista.dt_nascimento || '',
              genero: selectedMotorista.genero || '',
              funcao: selectedMotorista.funcao || '',
              origem_usuario: selectedMotorista.origem_usuario || '',
              st_cadastro: selectedMotorista.st_cadastro || 'cadastrado',
              autorizacao_lgpd: selectedMotorista.autorizacao_lgpd || 'N',
              company_id: selectedMotorista.company_id || 0,
              data_cadastro: selectedMotorista.data_cadastro || new Date().toISOString(),
              cliente_id: selectedMotorista.cliente_id || 0,
              ativo: selectedMotorista.ativo || false,
// Ensure all required properties are included with proper types
              conversation_id: selectedMotorista.conversation_id || ''
            }}
          />
        )}

        <BulkActionsModal
          isOpen={isBulkActionsModalOpen}
          onClose={() => setIsBulkActionsModalOpen(false)}
          selectedItems={selectedItems}
          actionType={bulkActionType}
          onSuccess={fetchContratados}
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
          numbers={Array.from(selectedItems)
            .map(id => {
              const motorista = contratados.find(m => m.motorista_id === id);
              return motorista?.telefone ? motorista.telefone.toString() : '';
            })
            .filter(Boolean)}
        />

        {/* Add Agregado Modal */}
        <AddAgregadoModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            // Refresh the list after successful addition
            fetchContratados();
            if (onSuccess) onSuccess();
          }}
        />

        {/* Role Change Confirmation Modal */}
        {roleChangeModal.isOpen && roleChangeModal.motorista && roleChangeModal.newRole && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center justify-center mb-4">
                  <div className="bg-yellow-100 dark:bg-yellow-900 p-3 rounded-full">
                    <AlertTriangle className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                  </div>
                </div>
                
                <h3 className="text-lg font-medium text-gray-900 dark:text-white text-center mb-2">
                  Confirmar alteração de função
                </h3>
                
                <p className="text-sm text-gray-600 dark:text-gray-300 text-center mb-6">
                  Tem certeza que deseja transformar <span className="font-semibold">{roleChangeModal.motorista.nome_motorista}</span> em um <span className="font-semibold">{roleChangeModal.newRole}</span>?
                </p>

                <div className="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 dark:border-yellow-500 p-4 mb-6">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <AlertTriangle className="h-5 w-5 text-yellow-400 dark:text-yellow-300" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        {roleChangeModal.newRole === 'Agregado' 
                          ? 'Ao transformar em Agregado, o motorista não aparecerá mais na lista de motoristas ativos.'
                          : 'Ao transformar em Motorista, o registro será ativado automaticamente.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setRoleChangeModal(prev => ({ ...prev, isOpen: false }))}
                    disabled={roleChangeModal.isLoading}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleRoleChangeConfirm}
                    disabled={roleChangeModal.isLoading}
                    className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                      roleChangeModal.isLoading ? 'pl-10' : ''
                    }`}
                  >
                    {roleChangeModal.isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin inline-block" />
                        Alterando...
                      </>
                    ) : (
                      'Confirmar Alteração'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  export default Contratados;