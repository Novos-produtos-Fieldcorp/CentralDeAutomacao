  import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
  import { Search, Edit2, FileText, MessageCircle, Filter, ChevronDown, X, User, Loader2, MapPin, FilePen, Truck, Plus, ArrowLeftRight, XCircle, AlertTriangle, Tag, CheckCircle, Calendar } from 'lucide-react';
  import WhatsAppAvatar from '../../components/WhatsAppAvatar';
  import AddAgregadoModal from '../../components/AddAgregadoModal';
  import { useCompanyData } from '../../hooks/useCompanyData';
  import { useQuery } from '@tanstack/react-query';
  import type { Motorista, MotoristaWithAddress, DocumentoMotorista, EnderecoMotorista, Veiculo } from '../../types/database';
  import { formatCPF, formatPhone, formatDate } from '../../utils/format';
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
  import { useAuth } from '../../context/AuthContext';
  import { useWiseAppAccess } from '../../context/WiseAppAccessContext';
  import { usePagination } from '../../hooks/usePagination';
  import Pagination from '../../components/Pagination';
  import ScrollableTableIndicator from '../../components/ScrollableTableIndicator';
  import ContextMenu from '../../components/ContextMenu';
  import UnifiedAgregadoModal from '../../components/UnifiedAgregadoModal';
  import { TableDropdown } from '../../components/TableDropdown';
import { WiseAppBulkSyncPanel } from '../../components/WiseAppSyncButton';
import { API_BASE_URL } from '@/lib/api-config';
import FilterTags from '../../components/FilterTags';

interface AgregadosListaProps {
  onSuccess?: () => void;
}

// Interface para a view de contratados
export interface ViewContratado {
  motorista_id?: number;
  nome_motorista?: string;
  nome?: string;
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
  foto_whatsapp?: string | null;
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
  // Campos de endereço do join com as tabelas de endereço
  end_motorista?: Array<{
    id_end_motorista: number;
    id_motorista: number;
    id_logradouro: number;
    nr_end: number | null;
    ds_complemento_end: string | null;
    st_end: boolean | null;
    logradouro?: {
      id_logradouro: number;
      nr_cep: string | null;
      logradouro: string | null;
      bairro?: {
        id_bairro: number;
        bairro: string | null;
        cidade?: {
          id_cidade: number;
          cidade: string;
          estado?: {
            id_estado: number;
            sigla_estado: string;
            estado: string;
          };
        };
      };
    };
  }>;
}

const checkVehicleTypeMatch = (motorista: ViewContratado, filters: string[]): boolean => {
  // Função auxiliar de normalização (igual à usada no filtro)
  const normalizeType = (type: string | undefined | null): string | null => {
    if (!type || typeof type !== 'string') return null;
    
    let normalized = type.trim().toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    
    const typeMapping: Record<string, string> = {
      'CAMINHAO': 'CAMINHÃO',
      'CAMINHAO 3/4': 'CAMINHÃO 3/4',
      'FURGAO': 'FURGÃO',
      'MOTOCICLETA': 'MOTO',
      'MOTORCYCLE': 'MOTO',
      'TRACTOR': 'TRATOR',
      'AUTOMOVEL': 'AUTOMOVEL',
      'UTILITARIO': 'UTILITARIO'
    };
    
    return typeMapping[normalized] || normalized;
  };

  // Check direct properties first (tipologia and tipo) - usando normalização
  const normalizedMotorTipologia = normalizeType(motorista.tipologia);
  const normalizedMotorTipo = normalizeType(motorista.tipo);
  
  if (
    (normalizedMotorTipologia && filters.includes(normalizedMotorTipologia)) ||
    (normalizedMotorTipo && filters.includes(normalizedMotorTipo))
  ) {
    return true;
  }
  
  // Check veiculo array if it exists (tipologia and tipo fields) - usando normalização
  if (motorista.veiculo && motorista.veiculo.length > 0) {
    return motorista.veiculo.some((veiculo: { tipologia?: string; tipo?: string }) => {
      const normalizedVeiculoTipologia = normalizeType(veiculo.tipologia);
      const normalizedVeiculoTipo = normalizeType(veiculo.tipo);
      
      return (
        (normalizedVeiculoTipologia && filters.includes(normalizedVeiculoTipologia)) ||
        (normalizedVeiculoTipo && filters.includes(normalizedVeiculoTipo))
      );
    });
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
  const { accountId } = useAuth();
  const { token: wiseAppToken } = useWiseAppAccess();
  const [contratados, setContratados] = useState<ViewContratado[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [ativoFilter, setAtivoFilter] = useState<string>('');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [showCidadeDropdown, setShowCidadeDropdown] = useState(false);
  const [showTipoVeiculoDropdown, setShowTipoVeiculoDropdown] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [tagFilterMode, setTagFilterMode] = useState<'contains' | 'not_contains'>('contains');
  
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const cidadeDropdownRef = useRef<HTMLDivElement>(null);
  const clienteDropdownRef = useRef<HTMLDivElement>(null);
  const tipoVeiculoDropdownRef = useRef<HTMLDivElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  const [isDocumentUploadOpen, setIsDocumentUploadOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkActionsModalOpen, setIsBulkActionsModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isMassMessageModalOpen, setIsMassMessageModalOpen] = useState(false);
  const [isUnifiedAgregadoModalOpen, setIsUnifiedAgregadoModalOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'status' | 'client' | 'tags'>('status');
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
    
    // Função para controlar que apenas um dropdown fique aberto
    const closeAllDropdowns = () => {
      setShowStatusDropdown(false);
      setShowClienteDropdown(false);
      setShowCidadeDropdown(false);
      setShowTipoVeiculoDropdown(false);
      setShowTagDropdown(false);
      setCidadeSearchTerm(''); // Limpa o termo de busca das cidades
    };

    const toggleDropdown = (dropdownType: string) => {
      closeAllDropdowns();
      switch(dropdownType) {
        case 'status':
          setShowStatusDropdown(true);
          break;
        case 'cliente':
          setShowClienteDropdown(true);
          break;
        case 'cidade':
          setShowCidadeDropdown(true);
          setCidadeSearchTerm(''); // Limpa o termo de busca ao abrir
          break;
        case 'tipoVeiculo':
          setShowTipoVeiculoDropdown(true);
          break;
        case 'tag':
          setShowTagDropdown(true);
          break;
      }
    };
    
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

  // Buscar tags do Supabase

  // Carregar tags individuais dos motoristas - versão otimizada em lote
  const fetchMotoristaTags = async (motoristas: ViewContratado[]) => {
    try {
      const motoristaIds = motoristas
        .map(m => m.motorista_id)
        .filter((id): id is number => id !== undefined && id !== null);
      
      if (motoristaIds.length === 0) {
        setMotoristaTags({});
        return;
      }

      // Buscar todas as associações em chunks para evitar erro 414 (URL muito longa)
      const chunkSize = 50; // Limite seguro para evitar URLs muito longas com associacao_tags
      const associations = [];
      
      // Fetching tags for motoristas in chunks
      
      for (let i = 0; i < motoristaIds.length; i += chunkSize) {
        const chunk = motoristaIds.slice(i, i + chunkSize);
        
        try {
          const { data: chunkAssociations, error: chunkError } = await supabase
            .from('associacao_tags')
            .select(`
              motorista_id,
              tag:tag_id (
                id,
                nome,
                cor,
                company_id,
                limite_max,
                created_at,
                updated_at
              )
            `)
            .in('motorista_id', chunk);
          
          if (chunkError) {
            // Error fetching chunk, continuing with next
            continue; // Continue com próximo chunk
          }
          
          if (chunkAssociations) {
            associations.push(...chunkAssociations);
          }
        } catch (chunkError) {
          // Error in chunk processing
        }
      }
      
      const error = null; // Reset error since we handled chunks individually
      
      if (error) throw error;

      // Organizar por motorista_id
      const newMotoristaTags: { [key: number]: any[] } = {};
      
      // Inicializar todos os motoristas com array vazio
      motoristaIds.forEach(id => {
        newMotoristaTags[id] = [];
      });
      
      // Preencher com as tags encontradas
      associations?.forEach((association: any) => {
        if (association.tag && association.motorista_id) {
          newMotoristaTags[association.motorista_id].push(association.tag);
        }
      });
      
      setMotoristaTags(newMotoristaTags);
    } catch (error) {
      console.error('Erro ao carregar marcadores dos agregados:', error);
      toast.error('Erro ao carregar marcadores dos agregados');
    }
  };

  // Verificar limite de associados por tag
  const checkTagLimit = async (tagId: number): Promise<{ canAdd: boolean; currentCount: number; limit: number | null }> => {
    try {
      // Buscar informações da tag
      const { data: tagData, error: tagError } = await supabase
        .from('tag')
        .select('limite_max')
        .eq('id', tagId)
        .single();

      if (tagError) throw tagError;

      const limit = tagData?.limite_max;
      if (!limit) {
        return { canAdd: true, currentCount: 0, limit: null };
      }

      // Contar associados atuais da tag
      const { count, error: countError } = await supabase
        .from('associacao_tags')
        .select('*', { count: 'exact', head: true })
        .eq('tag_id', tagId);

      if (countError) throw countError;

      const currentCount = count || 0;
      const canAdd = currentCount < limit;

      return { canAdd, currentCount, limit };
    } catch (error) {
      console.error('Erro ao verificar limite da tag:', error);
      return { canAdd: true, currentCount: 0, limit: null };
    }
  };

  // Adicionar marcador a um motorista
  const handleAddTag = async (motoristaId: number | undefined, tagId: number) => {
    if (!motoristaId) return;
    
    setUpdatingMotoristaTag(motoristaId);
    try {
      // Verificar limite antes de adicionar
      const { canAdd, currentCount, limit } = await checkTagLimit(tagId);
      
      if (!canAdd) {
        toast.error(`Limite máximo de ${limit} associados atingido para este marcador. Atual: ${currentCount}`);
        return;
      }

      // Verificar se a associação já existe (ignora erros RLS)
      let existingAssociation = null;
      try {
        const { data } = await supabase
          .from('associacao_tags')
          .select('id')
          .eq('motorista_id', motoristaId)
          .eq('tag_id', tagId)
          .single();
        existingAssociation = data;
      } catch (error: any) {
        // Ignorar erros RLS (406/PGRST301) - continuar com a operação
        if (error?.code === 'PGRST301' || error?.status === 406) {
          // RLS error ignored, continuing with tag association
        } else {
          console.warn('Error checking existing association (non-critical):', error);
        }
      }
      
      if (existingAssociation) {
        toast.error('Marcador já está associado a este agregado');
        return;
      }

      const { error } = await supabase
        .from('associacao_tags')
        .insert({
          motorista_id: motoristaId,
          tag_id: tagId
        });

      if (error) throw error;

      // Buscar a tag completa para atualizar o estado local
      const { data: tagData, error: tagError } = await supabase
        .from('tag')
        .select('*')
        .eq('id', tagId)
        .single();
      
      if (tagError) throw tagError;

      // Atualizar estado local
      if (tagData) {
        setMotoristaTags(prev => ({
          ...prev,
          [motoristaId]: [...(prev[motoristaId] || []), tagData]
        }));
      }

      // Fechar dropdown
      setTagDropdownOpen(prev => ({ ...prev, [motoristaId]: false }));
      
      // Sincronizar com WiseApp se disponível
      if (accountId && wiseAppToken) {
        try {
          await syncTagWithWiseApp(motoristaId, tagData);
        } catch (wiseAppError) {
          console.error('Erro ao sincronizar com WiseApp:', wiseAppError);
          // Não falhar a operação se o WiseApp falhar
        }
      }
      
      // Verificar se atingiu o limite após adicionar
      const { canAdd: canStillAdd, currentCount: newCount, limit: tagLimit } = await checkTagLimit(tagId);
      if (!canStillAdd && tagLimit) {
        toast.error(`Atenção: Marcador "${tagData.nome}" atingiu o limite máximo de ${tagLimit} associados!`);
      } else {
        toast.success('Marcador adicionado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao adicionar marcador:', error);
      toast.error('Erro ao adicionar marcador');
    } finally {
      setUpdatingMotoristaTag(null);
    }
  };

  // Remover tag de um motorista
  const handleRemoveTag = async (motoristaId: number | undefined, tagId: number) => {
    if (!motoristaId) return;
    
    try {
      // Buscar dados da tag para remoção
      const tagToRemove = motoristaTags[motoristaId]?.find((tag: any) => tag.id === tagId);
      
      // Remover da base de dados local (ignora erros RLS)
      const { error } = await supabase
        .from('associacao_tags')
        .delete()
        .eq('motorista_id', motoristaId)
        .eq('tag_id', tagId);

      // Ignorar erros RLS mas ainda mostrar outros erros
      if (error && error.code !== 'PGRST301') {
        throw error;
      } else if (error) {
        // RLS error ignored during tag removal
      }

      // Atualizar estado local
      setMotoristaTags(prev => ({
        ...prev,
        [motoristaId]: (prev[motoristaId] || []).filter((tag: any) => tag.id !== tagId)
      }));
      
      // Sincronizar remoção se disponível
      if (accountId && wiseAppToken && tagToRemove) {
        try {
          await removeTagFromWiseApp(motoristaId, tagToRemove);
        } catch (wiseAppError) {
          console.error('Erro ao remover tag:', wiseAppError);
          // Não falhar a operação local
        }
      }
      
      toast.success('Marcador removido com sucesso!');
    } catch (error) {
      console.error('Erro ao remover marcador:', error);
      toast.error('Erro ao remover marcador');
    }
  };

  // Função para abrir/fechar dropdown de tags com carregamento lazy
  const handleToggleTagDropdown = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const isOpening = !showTagDropdown;
    setShowTagDropdown(isOpening);
    
    // Carregar tags dos motoristas apenas quando abrir o dropdown pela primeira vez
    if (isOpening && Object.keys(motoristaTags).length === 0 && contratados.length > 0) {
      await fetchMotoristaTags(contratados);
    }
  };

  // Fechar dropdown quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const isClickInside = Object.values(motoristaTagDropdownRefs.current).some(ref => 
        ref && ref.contains(event.target as Node)
      );
      
      if (!isClickInside) {
        setTagDropdownOpen({});
        setTagDropdownPosition({});
        setTagSearchTerm({});
      }
    };

    const handleScroll = (event: Event) => {
      // Só fechar dropdown se for scroll da janela principal, não scroll interno de elementos
      if (event.target === document || event.target === document.documentElement || event.target === document.body) {
        setTagDropdownOpen({});
        setTagDropdownPosition({});
        setTagSearchTerm({});
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
    const [clienteFilter, setClienteFilter] = useState<string[]>([]);
    const [cidadeFilter, setCidadeFilter] = useState<string[]>([]);
    const [cidades, setCidades] = useState<string[]>([]);
    const [tipoVeiculoFilter, setTipoVeiculoFilter] = useState<string[]>([]);
    const [tiposVeiculo, setTiposVeiculo] = useState<string[]>([]);
    const [cidadeSearchTerm, setCidadeSearchTerm] = useState<string>('');

    const tableContainerRef = useRef<HTMLDivElement>(null);
    


    // Efeito para fechar dropdowns ao clicar fora deles
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        
        if (showStatusDropdown && statusDropdownRef.current && !statusDropdownRef.current.contains(target)) {
          setShowStatusDropdown(false);
        }
        if (showClienteDropdown && clienteDropdownRef.current && !clienteDropdownRef.current.contains(target)) {
          setShowClienteDropdown(false);
        }
        if (showCidadeDropdown && cidadeDropdownRef.current && !cidadeDropdownRef.current.contains(target)) {
          setShowCidadeDropdown(false);
          setCidadeSearchTerm(''); // Limpa o termo de busca ao fechar
        }
        if (showTipoVeiculoDropdown && tipoVeiculoDropdownRef.current && !tipoVeiculoDropdownRef.current.contains(target)) {
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

  // Query para buscar tags da empresa
  const { data: tags = [], isLoading: tagsLoading } = useQuery<any[]>({
    queryKey: ['local-tags', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from('tag')
        .select('*')
        .eq('company_id', companyId)
        .order('nome');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });
  
  const [motoristaTags, setMotoristaTags] = useState<{ [key: number]: any[] }>({});
  const [tagDropdownOpen, setTagDropdownOpen] = useState<{ [key: number]: boolean }>({});
  const [tagDropdownPosition, setTagDropdownPosition] = useState<{[key: number]: {top: number, left: number, width: number}}>({});
  const [updatingMotoristaTag, setUpdatingMotoristaTag] = useState<number | null>(null);
  const [tagSearchTerm, setTagSearchTerm] = useState<{[key: number]: string}>({});

  // Função para sincronizar tag via proxy backend
  const syncTagWithWiseApp = async (motoristaId: number, tagData: any) => {
    if (!companyId) return;
    
    try {
      // 1. Buscar todas as tags existentes
      const labelsResponse = await fetch(`${API_BASE_URL}/wiseapp/${companyId}/labels`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'wiseapp-account-id': accountId || '',
          'wiseapp-token': wiseAppToken || ''
        }
      });

      if (!labelsResponse.ok) {
        // Erro ao buscar tags
        return;
      }

      const labels = await labelsResponse.json();
      const existingTag = labels.find((label: any) => 
        label.name.toLowerCase() === tagData.nome.toLowerCase()
      );

      if (!existingTag) {
        // Tag não encontrada
        return;
      }

      // 2. Buscar o motorista para obter o telefone
      const motorista = contratados.find(m => m.motorista_id === motoristaId);
      if (!motorista?.telefone) {
        console.warn('Telefone do motorista não encontrado para sincronização');
        return;
      }

      // 3. Buscar o contato pelo telefone (sem +55 como funciona na individual)
      const phoneStr = String(motorista.telefone);
      const formattedPhone = phoneStr.replace(/^\+55/, ''); // Remove +55 se existir
      
      const searchContactResponse = await fetch(`${API_BASE_URL}/wiseapp/${companyId}/contacts/search?phone=${formattedPhone}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'wiseapp-account-id': accountId || '',
          'wiseapp-token': wiseAppToken || ''
        }
      });

      if (!searchContactResponse.ok) {
        // Erro ao buscar contato
        return;
      }

      const contactData = await searchContactResponse.json();
      const contactId = contactData.payload?.[0]?.id || contactData[0]?.id;

      if (!contactId) {
        // Contato não encontrado
        return;
      }

      // 4. Aplicar a tag existente ao contato específico
      const applyTagResponse = await fetch(`${API_BASE_URL}/wiseapp/${companyId}/contacts/${contactId}/labels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'wiseapp-account-id': accountId || '',
          'wiseapp-token': wiseAppToken || ''
        },
        body: JSON.stringify({
          tagId: existingTag.id,
          tagName: existingTag.name
        })
      });

      if (applyTagResponse.ok) {
        // Tag aplicada com sucesso
      } else {
        const errorText = await applyTagResponse.text();
        console.error(`Erro ao aplicar tag ao contato: ${applyTagResponse.status} - ${errorText}`);
      }

    } catch (error) {
      // Erro não crítico na sincronização
    }
  };

  // Função para remover tag via proxy backend
  const removeTagFromWiseApp = async (motoristaId: number, tagData: any) => {
    if (!companyId) return;
    
    try {
      // 1. Buscar o motorista para obter o telefone
      const motorista = contratados.find(m => m.motorista_id === motoristaId);
      if (!motorista?.telefone) {
        console.warn('Telefone do motorista não encontrado para remoção da tag');
        return;
      }

      // 2. Buscar o contato pelo telefone (sem +55 como funciona na individual)
      const phoneStr = String(motorista.telefone);
      const formattedPhone = phoneStr.replace(/^\+55/, ''); // Remove +55 se existir
      
      const searchContactResponse = await fetch(`${API_BASE_URL}/wiseapp/${companyId}/contacts/search?phone=${formattedPhone}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'wiseapp-account-id': accountId || '',
          'wiseapp-token': wiseAppToken || ''
        }
      });

      if (!searchContactResponse.ok) {
        // Erro ao buscar contato
        return;
      }

      const contactData = await searchContactResponse.json();
      const contactId = contactData.payload?.[0]?.id || contactData[0]?.id;

      if (!contactId) {
        // Contato não encontrado
        return;
      }

      // 3. Buscar labels atuais do contato
      const getLabelsResponse = await fetch(`${API_BASE_URL}/wiseapp/${companyId}/contacts/${contactId}/labels`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'wiseapp-account-id': accountId || '',
          'wiseapp-token': wiseAppToken || ''
        }
      });

      if (!getLabelsResponse.ok) {
        console.warn(`Erro ao buscar labels do contato: ${getLabelsResponse.status}`);
        return;
      }

      const labelsData = await getLabelsResponse.json();
      const currentLabels = labelsData.payload || [];
      
      // 4. Remover a tag específica das labels (preservando as outras)
      const updatedLabels = currentLabels.filter((label: string) => 
        label.toLowerCase() !== tagData.nome.toLowerCase()
      );

      // 5. Aplicar as labels atualizadas (sem a tag removida)
      const updateLabelsResponse = await fetch(`${API_BASE_URL}/wiseapp/${companyId}/contacts/${contactId}/labels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'wiseapp-account-id': accountId || '',
          'wiseapp-token': wiseAppToken || ''
        },
        body: JSON.stringify({
          labels: updatedLabels
        })
      });

      if (updateLabelsResponse.ok) {
        // Tag removida com sucesso
      } else {
        const errorText = await updateLabelsResponse.text();
        console.error(`Erro ao remover tag do contato: ${updateLabelsResponse.status} - ${errorText}`);
      }

    } catch (error) {
      // Erro não crítico
    }
  };

  const motoristaTagDropdownRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
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
      fetchTiposVeiculoFromTable();
    }, [dateFilter, customDateRange]);

    // Carregar tags dos agregados automaticamente quando a lista de contratados mudar
    useEffect(() => {
      if (contratados && contratados.length > 0) {
        fetchMotoristaTags(contratados);
      }
    }, [contratados]);


    // Sistema de aplicação automática de tags
    useEffect(() => {
      if (tags.length > 0 && contratados.length > 0 && Object.keys(motoristaTags).length > 0) {
        applyAutomaticTags();
      }
    }, [tags, contratados, motoristaTags]);

    const applyAutomaticTags = async () => {
      const vipTag = tags.find(tag => tag.nome.toLowerCase().includes('vip'));
      if (vipTag) {
        for (const agregado of contratados) {
          const hasVeiculo = agregado.veiculo_id && agregado.placa;
          const alreadyHasTag = motoristaTags[agregado.motorista_id || 0]?.some((tag: any) => tag.id === vipTag.id);
          
          if (hasVeiculo && !alreadyHasTag && agregado.motorista_id) {
            await handleAddTag(agregado.motorista_id, vipTag.id);
          }
        }
      }
      
      // Critério 2: Aplicar tag "Novo" para agregados cadastrados nos últimos 7 dias
      const novoTag = tags.find(tag => tag.nome.toLowerCase().includes('novo'));
      if (novoTag) {
        for (const agregado of contratados) {
          const cadastroDate = new Date(agregado.data_cadastro || '');
          const daysSinceCadastro = (Date.now() - cadastroDate.getTime()) / (1000 * 60 * 60 * 24);
          const alreadyHasTag = motoristaTags[agregado.motorista_id || 0]?.some((tag: any) => tag.id === novoTag.id);
          
          if (daysSinceCadastro <= 7 && !alreadyHasTag && agregado.motorista_id) {
            await handleAddTag(agregado.motorista_id, novoTag.id);
          }
        }
      }
      
      // Critério 3: Aplicar tag "Experiente" para agregados com mais de 6 meses
      const experienteTag = tags.find(tag => tag.nome.toLowerCase().includes('experiente'));
      if (experienteTag) {
        for (const agregado of contratados) {
          const cadastroDate = new Date(agregado.data_cadastro || '');
          const daysSinceCadastro = (Date.now() - cadastroDate.getTime()) / (1000 * 60 * 60 * 24);
          const alreadyHasTag = motoristaTags[agregado.motorista_id || 0]?.some((tag: any) => tag.id === experienteTag.id);
          
          if (daysSinceCadastro > 180 && !alreadyHasTag && agregado.motorista_id) {
            await handleAddTag(agregado.motorista_id, experienteTag.id);
          }
        }
      }
    };


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

    // Função para buscar cidades dos agregados de forma mais simples
    const fetchCidadesAgregados = async () => {
      try {
        // Buscar todas as cidades únicas diretamente da tabela cidade
        const { data: cidadesData, error } = await supabase
          .from('cidade')
          .select('cidade')
          .order('cidade');
          
        if (error) {
          console.error('Erro ao buscar cidades:', error);
          return;
        }
        
        const cidadesUnicas = cidadesData?.map(c => c.cidade).filter(Boolean) || [];
        console.log('✅ Cidades encontradas para filtro:', cidadesUnicas);
        setCidades(cidadesUnicas);
      } catch (error) {
        console.error('Erro ao buscar cidades:', error);
      }
    };


    const fetchContratados = async () => {
      try {
        setLoading(true);
        // Buscar os agregados da view vw_agregados_completo que já inclui dados de endereço
        let query = supabase
          .from('vw_agregados_completo')
          .select('*')
          .eq('company_id', companyId)
          .eq('funcao', 'Agregado');

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
        // Processing function values from data
        // Data processing completed

        // Extract unique cities from contratados - buscar separadamente
        const uniqueCities = new Set<string>();
        
        // Buscar cidades disponíveis para o filtro
        console.log('🏙️ Buscando cidades para filtro...');
        await fetchCidadesAgregados();
        
        // Extrair cidades únicas dos dados carregados da view
        const cidadesUnicas = new Set<string>();
        data?.forEach(motorista => {
          if (motorista.nome_cidade) {
            cidadesUnicas.add(motorista.nome_cidade);
          }
        });
        
        // Atualizar a lista de cidades com as cidades encontradas nos dados
        const cidadesEncontradas = Array.from(cidadesUnicas).sort();
        if (cidadesEncontradas.length > 0) {
          setCidades(cidadesEncontradas);
          console.log('✅ Cidades encontradas nos dados:', cidadesEncontradas);
        }
        
        // Primeiro, vamos buscar os status ativos dos motoristas e suas fotos
        // motoristaIds já foi declarado acima
        let ativosStatus: Record<number, boolean> = {};
        let fotosWhatsApp: Record<number, string | null> = {};
        
        if (motoristaIds.length > 0) {
          try {
            // Dividir em chunks para evitar URLs muito longas
            const chunkSize = 100; // Limite seguro para evitar URLs muito longas
            const chunks = [];
            for (let i = 0; i < motoristaIds.length; i += chunkSize) {
              chunks.push(motoristaIds.slice(i, i + chunkSize));
            }
            
            // Buscar dados em chunks
            const allMotoristas = [];
            for (const chunk of chunks) {
              const { data: motoristas, error: motoristasError } = await supabase
                .from('motorista')
                .select('motorista_id, ativo, foto_whatsapp')
                .in('motorista_id', chunk);
                
              if (motoristasError) {
                console.error('Erro ao buscar status dos motoristas (chunk):', motoristasError);
                continue; // Continue com o próximo chunk
              }
              
              if (motoristas) {
                allMotoristas.push(...motoristas);
              }
            }
            
            // Criar um mapa de motorista_id para status ativo e fotos
            allMotoristas.forEach(m => {
              ativosStatus[m.motorista_id] = m.ativo === true;
              fotosWhatsApp[m.motorista_id] = m.foto_whatsapp || null;
            });
            
          } catch (error) {
            console.error('Erro ao buscar status dos motoristas:', error);
            // Continue sem os dados de status se houver erro
          }
        }
        
        // Processar os dados com os status ativos e fotos
        const processedData = data?.map(motorista => {
          const ativo = ativosStatus[motorista.motorista_id] === true;
          const foto_whatsapp = fotosWhatsApp[motorista.motorista_id] || null;
          return {
            ...motorista,
            ativo: ativo,
            foto_whatsapp: foto_whatsapp
          };
        }) || [];

        // Agrupar ajudantes por motorista_id
        const agregadosAgrupadosMap = new Map();
        processedData.forEach(agregado => {
          // Cities will be loaded separately
          // No city extraction needed here anymore
          
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

        // As cidades já foram carregadas pela função separada
        // Não precisamos fazer nada aqui

        setContratados(agregadosAgrupados);
        
        // Tags serão carregadas apenas quando necessário (filtro, ações em massa, etc.)
        // Para melhor performance, não carregar automaticamente
      } catch (error) {
        console.error('Error fetching contratados:', error);
        toast.error('Erro ao carregar contratados');
      } finally {
        setLoading(false);
      }
    };

    // Função para buscar tipos únicos de veículos diretamente da tabela veiculo
    const fetchTiposVeiculoFromTable = async () => {
      try {
        // Usar companyId do hook useCompanyData
        if (!companyId) {
          // Company ID not found - cannot filter vehicle types
          return;
        }

        const { data, error } = await supabase
          .from('veiculo')
          .select('tipo, tipologia')
          .eq('status_veiculo', true) // Apenas veículos ativos
          .eq('company_id', companyId); // Filtrar pela empresa atual

        if (error) {
          console.error('Erro ao buscar tipos de veículos:', error);
          return;
        }

        // Processing vehicle data for company
        // Vehicle records retrieved

        // Lista canônica de tipos válidos - apenas categorias gerais de veículos
        const VALID_VEHICLE_TYPES = [
          'FIORINO', 'VAN', 'CAMINHÃO', 'CAMINHÃO 3/4', 'HR', 'CAVALO', 'PASSEIO', 
          'FURGÃO', 'OUTROS', 'DUCATO', 'DOBLO', 'H100', 'BESTA', 'BOXER',
          'CAMINHONETE', 'CARRETA', 'MOTO', 'VUC', 'AUTOMOVEL', 'UTILITARIO',
          'KOMBI', 'TRACTOR', 'PICKUP', 'MOTORCYCLE'
        ];
        
        // Função para normalizar tipo de veículo
        const normalizeVehicleType = (type: string): string | null => {
          if (!type || typeof type !== 'string') return null;
          
          const normalized = type.trim().toUpperCase();
          
          // Mapear algumas variações comuns
          const typeMapping: Record<string, string> = {
            'CAMINHAO': 'CAMINHÃO',
            'FURGAO': 'FURGÃO',
            'MOTOCICLETA': 'MOTO',
            'MOTORCYCLE': 'MOTO',
            'TRACTOR': 'TRATOR',
            'AUTOMÓVEL': 'AUTOMOVEL',
            'UTILITÁRIO': 'UTILITARIO'
          };
          
          const mappedType = typeMapping[normalized] || normalized;
          
          return VALID_VEHICLE_TYPES.includes(mappedType) ? mappedType : null;
        };

        const uniqueVehicleTypes = new Set<string>();
        const debugInfo = { 
          tipo: [] as string[], 
          tipologia: [] as string[], 
          rejeitados: [] as string[] 
        };
        
        data?.forEach(veiculo => {
          // Processar campo tipo
          const normalizedTipo = normalizeVehicleType(veiculo.tipo);
          if (normalizedTipo) {
            uniqueVehicleTypes.add(normalizedTipo);
            debugInfo.tipo.push(normalizedTipo);
          } else if (veiculo.tipo) {
            debugInfo.rejeitados.push(`tipo: ${veiculo.tipo}`);
          }
          
          // Processar campo tipologia
          const normalizedTipologia = normalizeVehicleType(veiculo.tipologia);
          if (normalizedTipologia) {
            uniqueVehicleTypes.add(normalizedTipologia);
            debugInfo.tipologia.push(normalizedTipologia);
          } else if (veiculo.tipologia) {
            debugInfo.rejeitados.push(`tipologia: ${veiculo.tipologia}`);
          }
        });

        const tipologiasFiltradas = Array.from(uniqueVehicleTypes).sort();
        setTiposVeiculo(tipologiasFiltradas);
        
        // Vehicle types processing completed for company
        // Debug info: rejected types processed
        
      } catch (error) {
        console.error('Erro ao buscar tipos de veículos:', error);
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
    const toggleFilterOption = (filterType: 'status' | 'cliente' | 'cidade' | 'tipoVeiculo' | 'tag', value: string | null | undefined) => {
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
        case 'tag':
          setTagFilter(prev => 
            prev.includes(value) 
              ? prev.filter(v => v !== value) 
              : [...prev, value]
          );
          break;
      }
    };
    
    const clearFilter = (filterType: 'status' | 'cliente' | 'cidade' | 'tipoVeiculo' | 'tag') => {
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
        case 'tag':
          setTagFilter([]);
          setTagFilterMode('contains');
          break;
      }
    };
    
    const getFilterButtonText = (filterType: 'status' | 'cliente' | 'cidade' | 'tipoVeiculo' | 'tag') => {
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
        },
        tag: { 
          label: 'Marcadores', 
          filter: tagFilter,
          allText: tagFilterMode === 'contains' ? 'Contém marcadores' : 'Não contém marcadores'
        }
      };
      
      const { filter, allText } = filterMap[filterType];
      
      if (filter.length === 0) return allText;
      if (filterType === 'tag') {
        const modeText = tagFilterMode === 'contains' ? 'Contém' : 'Não contém';
        if (filter.length === 1) {
          const tagName = tags.find(t => t.id.toString() === filter[0])?.nome || filter[0];
          return `${modeText}: ${tagName}`;
        }
        return `${modeText}: ${filter.length} marcador${filter.length !== 1 ? 'es' : ''}`;
      }
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
        for (const id of Array.from(selectedItems)) {
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

    const handleBulkAction = (type: 'status' | 'client' | 'tags') => {
      setBulkActionType(type);
      setIsBulkActionsModalOpen(true);
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
        
        // Update the local state
        setContratados(prev => 
          prev.map(m => 
            m.motorista_id === motorista.motorista_id 
              ? { ...m, st_cadastro: newStatus } 
              : m
          )
        );
        toast.success('Status atualizado com sucesso');
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
      // Usar diretamente o campo nome_cidade da view vw_agregados_completo
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
      const motoristaCidade = getMotoristaCity(motorista);
      const cidadeMatch = cidadeFilter.length === 0 || 
        (motoristaCidade && cidadeFilter.includes(motoristaCidade));
      
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
      
      // Lógica para filtro de tags (multiseleção)
      let tagMatch = true;
      if (tagFilter.length > 0) {
        const motoristaId = motorista.motorista_id;
        if (motoristaId) {
          const motoristaTagsList = motoristaTags[motoristaId] || [];
          const motoristaTagIds = motoristaTagsList.map((tag: any) => tag.id.toString());
          
          if (tagFilterMode === 'contains') {
            // Modo "contém": motorista deve ter pelo menos uma das tags selecionadas
            tagMatch = tagFilter.some(tagId => motoristaTagIds.includes(tagId));
          } else {
            // Modo "não contém": motorista NÃO deve ter nenhuma das tags selecionadas
            tagMatch = !tagFilter.some(tagId => motoristaTagIds.includes(tagId));
          }
          
        } else {
          // Se não tem ID, no modo "contém" não passa, no modo "não contém" passa
          tagMatch = tagFilterMode === 'not_contains';
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
        tagMatch &&
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
                  onClick={() => handleBulkAction('tags')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 
                          focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 
                          transition-colors flex items-center gap-2"
                >
                  <Tag className="w-5 h-5" />
                  Adicionar Marcador
                </button>
                <button
                  onClick={handleMassMessage}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                          transition-colors flex items-center gap-2"
                >
                  <MessageCircle className="w-5 h-5" />
                  Enviar Campanha
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

        <div className="bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-750 p-6 rounded-xl shadow-lg border border-gray-200/70 dark:border-gray-700/70 backdrop-blur-sm">
          {/* Ações */}
          <div className="flex justify-end items-center mb-4">
            <div className="flex items-center gap-2">
              {/* Contador de filtros ativos */}
              {(statusFilter.length > 0 || cidadeFilter.length > 0 || clienteFilter.length > 0 || 
                ativoFilter !== '' || tipoVeiculoFilter.length > 0 || dateFilter !== 'all') && (
                <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs">
                  <Filter className="w-3 h-3" />
                  <span>{[statusFilter.length > 0 ? 1 : 0, cidadeFilter.length > 0 ? 1 : 0, clienteFilter.length > 0 ? 1 : 0, ativoFilter !== '' ? 1 : 0, tipoVeiculoFilter.length > 0 ? 1 : 0, dateFilter !== 'all' ? 1 : 0].reduce((a, b) => a + b, 0)}</span>
                </div>
              )}
              
              {/* Botão limpar filtros */}
              {(statusFilter.length > 0 || cidadeFilter.length > 0 || clienteFilter.length > 0 || 
                ativoFilter !== '' || tipoVeiculoFilter.length > 0 || dateFilter !== 'all' || searchTerm) && (
                <button
                  onClick={() => {
                    setStatusFilter([]);
                    setCidadeFilter([]);
                    setClienteFilter([]);
                    setAtivoFilter('');
                    setTipoVeiculoFilter([]);
                    setDateFilter('all');
                    setSearchTerm('');
                  }}
                  className="flex items-center gap-1 px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                >
                  <X className="w-3 h-3" />
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* Campo de busca inteligente */}
          <div className="mb-4">
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center">
                <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Buscar por nome, CPF, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-12 py-3.5 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm group-focus-within:shadow-md"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-4 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Tags - Filtros aplicados como tags removíveis */}
          <FilterTags
            statusFilter={statusFilter}
            ativoFilter={ativoFilter === 'active' ? 'true' : ativoFilter === 'inactive' ? 'false' : ''}
            clienteFilter={clienteFilter}
            cidadeFilter={cidadeFilter}
            tagFilter={tagFilter}
            tipoVeiculoFilter={tipoVeiculoFilter}
            dateFilter={dateFilter}
            customDateRange={customDateRange}
            onRemoveStatus={(status) => {
              setStatusFilter(statusFilter.filter(s => s !== status));
            }}
            onRemoveAtivo={() => {
              setAtivoFilter('');
            }}
            onRemoveCliente={(clienteId) => {
              setClienteFilter(clienteFilter.filter(c => c !== clienteId));
            }}
            onRemoveCidade={(cidade) => {
              setCidadeFilter(cidadeFilter.filter(c => c !== cidade));
            }}
            onRemoveTag={(tagId) => {
              setTagFilter(tagFilter.filter(t => t !== tagId));
            }}
            onRemoveTipoVeiculo={(tipo) => {
              setTipoVeiculoFilter(tipoVeiculoFilter.filter(t => t !== tipo));
            }}
            onRemoveDate={() => {
              setDateFilter('all');
            }}
            onClearAll={() => {
              setStatusFilter([]);
              setCidadeFilter([]);
              setClienteFilter([]);
              setAtivoFilter('');
              setTagFilter([]);
              setTipoVeiculoFilter([]);
              setDateFilter('all');
            }}
            clientes={clientes}
            tags={tags}
            cidades={cidades}
            tiposVeiculo={tiposVeiculo}
          />

          {/* Filtros modernos */}
          <div className="flex flex-wrap gap-3 items-center justify-between mb-4 relative z-[100]">
            <div className="flex flex-wrap gap-2">
              {/* Status Filter */}
              <div className="relative" style={{ position: 'relative' }}>
                <div className="relative group" ref={statusDropdownRef}>
                  <button
                    type="button"
                    className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9 w-auto"
                    onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  >
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      <span>
                        {statusFilter.length === 0 ? 'Status' : `Status (${statusFilter.length})`}
                      </span>
                    </div>
                  </button>

                  {showStatusDropdown && (
                    <div 
                      className="bg-white dark:bg-gray-700 shadow-2xl rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto w-64 animate-in slide-in-from-bottom-2 fade-in duration-200"
                      style={{ 
                        position: 'absolute',
                        bottom: '100%',
                        left: 0,
                        marginBottom: '4px',
                        zIndex: 999999
                      }}>
                      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Selecionar status</span>
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
                        <div key={value} className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 mr-2"
                              checked={statusFilter.includes(value)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setStatusFilter([...statusFilter, value]);
                                } else {
                                  setStatusFilter(statusFilter.filter(s => s !== value));
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-200">{label}</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>



              {/* Cliente Filter */}
              <div className="relative" style={{ position: 'relative' }}>
                <div className="relative group" ref={clienteDropdownRef}>
                  <button
                    type="button"
                    className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9 w-auto"
                    onClick={() => setShowClienteDropdown(!showClienteDropdown)}
                  >
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                      </svg>
                      <span>
                        {clienteFilter.length === 0 ? 'Cliente' : `Cliente (${clienteFilter.length})`}
                      </span>
                    </div>
                  </button>
                  {showClienteDropdown && (
                    <div 
                      className="bg-white dark:bg-gray-700 shadow-xl rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto w-64 animate-in slide-in-from-bottom-2 fade-in duration-200"
                      style={{ 
                        position: 'absolute',
                        bottom: '100%',
                        left: 0,
                        marginBottom: '4px',
                        zIndex: 999999
                      }}>
                      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Selecionar clientes</span>
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
                      </div>
                      <div className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 mr-2"
                            checked={clienteFilter.includes('sem_cliente')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setClienteFilter([...clienteFilter, 'sem_cliente']);
                              } else {
                                setClienteFilter(clienteFilter.filter(id => id !== 'sem_cliente'));
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
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 mr-2"
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
              </div>

              {/* Cidade Filter */}
              <div className="relative" style={{ position: 'relative' }}>
                <div className="relative group" ref={cidadeDropdownRef}>
                  <button
                    type="button"
                    className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9 w-auto"
                    onClick={() => setShowCidadeDropdown(!showCidadeDropdown)}
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>
                        {cidadeFilter.length === 0 ? 'Cidade' : `Cidade (${cidadeFilter.length})`}
                      </span>
                    </div>
                  </button>

                  {showCidadeDropdown && (
                    <div 
                      className="bg-white dark:bg-gray-700 shadow-xl rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-48 overflow-y-auto w-64 animate-in slide-in-from-bottom-2 fade-in duration-200"
                      style={{ 
                        position: 'absolute',
                        bottom: '100%',
                        left: 0,
                        marginBottom: '4px',
                        zIndex: 999999
                      }}>
                      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Selecionar cidades</span>
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
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Pesquisar cidade..."
                            value={cidadeSearchTerm}
                            onChange={(e) => setCidadeSearchTerm(e.target.value)}
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                      {cidades
                        .filter((cidade): cidade is string => cidade != null)
                        .filter((cidade) => 
                          cidadeSearchTerm === '' || 
                          cidade.toLowerCase().includes(cidadeSearchTerm.toLowerCase())
                        )
                        .map((cidade) => (
                          <div key={cidade} className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                            <label className="flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 mr-2"
                                checked={cidadeFilter.includes(cidade)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setCidadeFilter([...cidadeFilter, cidade]);
                                  } else {
                                    setCidadeFilter(cidadeFilter.filter(c => c !== cidade));
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-200">{cidade}</span>
                            </label>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              </div>

              {/* Tipo Veículo Filter */}
              <div className="relative" style={{ position: 'relative' }}>
                <div className="relative group" ref={tipoVeiculoDropdownRef}>
                  <button
                    type="button"
                    className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9 w-auto"
                    onClick={() => setShowTipoVeiculoDropdown(!showTipoVeiculoDropdown)}
                  >
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      <span>
                        {tipoVeiculoFilter.length === 0 ? 'Veículo' : `Veículo (${tipoVeiculoFilter.length})`}
                      </span>
                    </div>
                  </button>

                  {showTipoVeiculoDropdown && (
                    <div 
                      className="bg-white dark:bg-gray-700 shadow-xl rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto w-64 animate-in slide-in-from-bottom-2 fade-in duration-200"
                      style={{ 
                        position: 'absolute',
                        bottom: '100%',
                        left: 0,
                        marginBottom: '4px',
                        zIndex: 999999
                      }}>
                      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Selecionar tipos</span>
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
                      </div>
                      <div className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 mr-2"
                            checked={tipoVeiculoFilter.includes('sem_veiculo')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setTipoVeiculoFilter([...tipoVeiculoFilter, 'sem_veiculo']);
                              } else {
                                setTipoVeiculoFilter(tipoVeiculoFilter.filter(t => t !== 'sem_veiculo'));
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-200">Sem veículo</span>
                        </label>
                      </div>
                      {tiposVeiculo.map((tipo) => (
                        <div key={tipo} className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 mr-2"
                              checked={tipoVeiculoFilter.includes(tipo)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTipoVeiculoFilter([...tipoVeiculoFilter, tipo]);
                                } else {
                                  setTipoVeiculoFilter(tipoVeiculoFilter.filter(t => t !== tipo));
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-200">{tipo}</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Tag Filter */}
              <div className="relative" style={{ position: 'relative' }}>
                <div className="relative group" ref={tagDropdownRef}>
                  <button
                    type="button"
                    className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9 w-auto"
                    onClick={handleToggleTagDropdown}
                  >
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      <span>
                        {tagFilter.length === 0 ? 'Marcadores' : `Marcadores (${tagFilter.length})`}
                      </span>
                    </div>
                  </button>

                  {showTagDropdown && (
                    <div 
                      className="bg-white dark:bg-gray-700 shadow-xl rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto w-72 animate-in slide-in-from-bottom-2 fade-in duration-200"
                      style={{ 
                        position: 'absolute',
                        bottom: '100%',
                        left: 0,
                        marginBottom: '4px',
                        zIndex: 999999
                      }}>
                      {/* Header com abas */}
                      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Filtro de marcadores</span>
                          <button 
                            type="button" 
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTagFilter([]);
                            }}
                          >
                            Limpar
                          </button>
                        </div>
                        
                        {/* Abas Contém / Não Contém */}
                        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-md p-1">
                          <button
                            type="button"
                            className={`flex-1 text-xs px-2 py-1 rounded transition-colors ${
                              tagFilterMode === 'contains'
                                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setTagFilterMode('contains');
                            }}
                          >
                            Contém
                          </button>
                          <button
                            type="button"
                            className={`flex-1 text-xs px-2 py-1 rounded transition-colors ${
                              tagFilterMode === 'not_contains'
                                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setTagFilterMode('not_contains');
                            }}
                          >
                            Não contém
                          </button>
                        </div>
                      </div>
                      {tags.map((tag) => (
                        <div key={tag.id} className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600">
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 mr-2"
                              checked={tagFilter.includes(tag.id.toString())}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTagFilter([...tagFilter, tag.id.toString()]);
                                } else {
                                  setTagFilter(tagFilter.filter(id => id !== tag.id.toString()));
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: tag.cor || '#3B82F6' }}
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-200">{tag.nome}</span>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Status Ativo Filter */}
              <div className="relative z-[30]">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10">
                  <CheckCircle className="h-4 w-4 text-gray-400" />
                </div>
                <select
                  value={ativoFilter}
                  onChange={(e) => setAtivoFilter(e.target.value)}
                  className="px-3 py-2 pl-10 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none pr-3 h-9 w-[110px]"
                >
                  <option value="">Ativo</option>
                  <option value="active">Ativo (Sim)</option>
                  <option value="inactive">Ativo (Não)</option>
                </select>
              </div>

              {/* Período Filter */}
              <div className="relative z-[20]">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10">
                  <Calendar className="h-4 w-4 text-gray-400" />
                </div>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-3 py-2 pl-10 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none pr-3 h-9 w-[120px]"
                >
                  <option value="all">Período</option>
                  <option value="today">Hoje</option>
                  <option value="2days">2 dias</option>
                  <option value="15days">15 dias</option>
                  <option value="30days">30 dias</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>

            </div>
            
            {/* Botão Novo Agregado */}
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Agregado</span>
            </button>
          </div>
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

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 relative">
          <div className="overflow-visible">
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
            
            <div className="overflow-x-auto">
              <div ref={tableContainerRef} className="w-full">
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Marcadores</th>
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
                        } ${
                          motorista.ativo === false ? 'opacity-50 bg-gray-100/50 dark:bg-gray-900/50' : ''
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
                            <div className="flex-shrink-0">
                              <WhatsAppAvatar 
                                photoUrl={motorista.foto_whatsapp}
                                name={motorista.nome}
                                size="md"
                              />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {motorista.nome || ''}
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
                                onClick={() => startChat(motorista.telefone?.toString() || '', motorista.nome || '', motorista.motorista_id)}
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
                          <div className="relative">
                            {/* Tags atuais */}
                            <div className="flex flex-wrap gap-1 mb-2">
                              {motorista.motorista_id && motoristaTags[motorista.motorista_id]?.map((tag: any) => (
                                <span
                                  key={tag.id}
                                  className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full cursor-pointer hover:opacity-75 group text-gray-900 dark:text-white"
                                  style={{
                                    backgroundColor: tag.cor + '30',
                                    border: `1px solid ${tag.cor}50`
                                  }}
                                  title="Clique para remover este marcador"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveTag(motorista.motorista_id, tag.id);
                                  }}
                                >
                                  {tag.nome}
                                  <X className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </span>
                              ))}
                            </div>

                            {/* Botão para adicionar marcadores */}
                            <div 
                              className="relative inline-block"
                              ref={(el) => {
                                if (motorista.motorista_id) {
                                  motoristaTagDropdownRefs.current[motorista.motorista_id] = el;
                                }
                              }}
                            >
                              <button
                                type="button"
                                className="inline-flex items-center justify-center w-6 h-6 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 border border-dashed border-gray-300 dark:border-gray-600 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (motorista.motorista_id) {
                                    const isOpening = !tagDropdownOpen[motorista.motorista_id];
                                    
                                    if (isOpening) {
                                      // Calcular posição do dropdown e limpar campo de pesquisa
                                      const buttonElement = e.currentTarget as HTMLElement;
                                      const rect = buttonElement.getBoundingClientRect();
                                      setTagDropdownPosition(prev => ({
                                        ...prev,
                                        [motorista.motorista_id!]: {
                                          top: rect.bottom + 4, // Usar posição direta, sem window.scrollY
                                          left: rect.left,      // Usar posição direta, sem window.scrollX
                                          width: 256 // w-64 = 256px
                                        }
                                      }));
                                      setTagSearchTerm(prev => ({
                                        ...prev,
                                        [motorista.motorista_id!]: ''
                                      }));
                                    }
                                    
                                    setTagDropdownOpen(prev => ({
                                      ...prev,
                                      [motorista.motorista_id!]: isOpening
                                    }));
                                  }
                                }}
                                disabled={updatingMotoristaTag === motorista.motorista_id}
                              >
                                {updatingMotoristaTag === motorista.motorista_id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Tag className="w-3 h-3" />
                                )}
                              </button>

                              {/* Dropdown de tags disponíveis - usando createPortal para z-index correto */}
                              {motorista.motorista_id && tagDropdownOpen[motorista.motorista_id] && tagDropdownPosition[motorista.motorista_id] && 
                                createPortal(
                                  <div 
                                    className="bg-white dark:bg-gray-700 shadow-xl rounded-md py-2 border border-gray-200 dark:border-gray-600 max-h-48 overflow-y-auto"
                                    style={{
                                      position: 'fixed',
                                      top: tagDropdownPosition[motorista.motorista_id].top,
                                      left: tagDropdownPosition[motorista.motorista_id].left,
                                      width: tagDropdownPosition[motorista.motorista_id].width,
                                      zIndex: 9999
                                    }}
                                  >
                                    <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                                      <input
                                        type="text"
                                        placeholder="Buscar marcadores..."
                                        className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        value={tagSearchTerm[motorista.motorista_id!] || ''}
                                        onChange={(e) => setTagSearchTerm(prev => ({
                                          ...prev,
                                          [motorista.motorista_id!]: e.target.value
                                        }))}
                                        autoFocus
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      {tags
                                        .filter(tag => {
                                          const notAdded = !motorista.motorista_id || !motoristaTags[motorista.motorista_id]?.some((mt: any) => mt.id === tag.id);
                                          const searchTerm = tagSearchTerm[motorista.motorista_id!] || '';
                                          const matchesSearch = !searchTerm || tag.nome.toLowerCase().includes(searchTerm.toLowerCase());
                                          return notAdded && matchesSearch;
                                        })
                                        .map((tag) => (
                                        <div
                                          key={tag.id}
                                          className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer select-none"
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (motorista.motorista_id && tag.id) {
                                              handleAddTag(motorista.motorista_id, tag.id);
                                              // Fechar dropdown e limpar pesquisa após adicionar marcador
                                              setTimeout(() => {
                                                setTagDropdownOpen(prev => ({ ...prev, [motorista.motorista_id!]: false }));
                                                setTagDropdownPosition(prev => {
                                                  const newState = { ...prev };
                                                  delete newState[motorista.motorista_id!];
                                                  return newState;
                                                });
                                                setTagSearchTerm(prev => ({ ...prev, [motorista.motorista_id!]: '' }));
                                              }, 100);
                                            }
                                          }}
                                        >
                                          <div
                                            className="w-3 h-3 rounded-full flex-shrink-0 mr-2"
                                            style={{ backgroundColor: tag.cor }}
                                          />
                                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                                            {tag.nome}
                                          </span>
                                        </div>
                                      ))}
                                      {tags.filter(tag => {
                                        const notAdded = !motorista.motorista_id || !motoristaTags[motorista.motorista_id]?.some((mt: any) => mt.id === tag.id);
                                        const searchTerm = tagSearchTerm[motorista.motorista_id!] || '';
                                        const matchesSearch = !searchTerm || tag.nome.toLowerCase().includes(searchTerm.toLowerCase());
                                        return notAdded && matchesSearch;
                                      }).length === 0 && (
                                        <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                                          {tagSearchTerm[motorista.motorista_id!] ? 'Nenhum marcador encontrado' : 'Todos os marcadores já foram adicionados'}
                                        </div>
                                      )}
                                    </div>
                                  </div>,
                                  document.body
                                )
                              }
                            </div>
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

        {/* WiseApp Bulk Sync Panel - positioned fixed in top right */}
        <WiseAppBulkSyncPanel 
          onTagsSync={() => {
            if (contratados && contratados.length > 0) {
              fetchMotoristaTags(contratados);
            }
          }}
        />

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
                icon: <MessageCircle size={16} />,
                label: 'Iniciar Chat',
                onClick: () => startChat(contextMenu.motorista!.telefone?.toString() || '', contextMenu.motorista!.nome_motorista || '', contextMenu.motorista!.motorista_id),
                color: 'text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300',
                disabled: !contextMenu.motorista!.telefone
              }
            ]}
          />
        )}

        {/* Modals */}
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
          onSuccess={() => {
            fetchContratados();
            // Recarregar tags imediatamente após operação em massa
            if (contratados && contratados.length > 0) {
              fetchMotoristaTags(contratados);
            }
          }}
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
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Confirmar alteração de função
                </h2>
                <button
                  onClick={() => setRoleChangeModal(prev => ({ ...prev, isOpen: false }))}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  disabled={roleChangeModal.isLoading}
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-center mb-4">
                  <div className="bg-yellow-100 dark:bg-yellow-900 p-3 rounded-full">
                    <AlertTriangle className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                  </div>
                </div>
                
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
                          ? 'Ao transformar em Agregado, o registro será ativado automaticamente.'
                          : 'Ao transformar em Motorista, o registro será ativado automaticamente.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setRoleChangeModal(prev => ({ ...prev, isOpen: false }))}
                    disabled={roleChangeModal.isLoading}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleRoleChangeConfirm}
                    disabled={roleChangeModal.isLoading}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {roleChangeModal.isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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