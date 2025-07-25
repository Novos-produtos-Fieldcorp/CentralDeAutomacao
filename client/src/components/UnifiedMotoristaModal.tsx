import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, User, MapPin, FileText, ExternalLink, Edit2, Users, ShieldAlert, MessageSquare 
} from 'lucide-react';
import type { 
  DocumentoMotorista, 
  Motorista,
  DocumentoAjudante
} from '../types/database';
import { formatCPF, formatPhone, formatDate, formatCEP } from '../utils/format';
import DocumentoMotoristaForm from './DocumentoMotoristaForm';
import { supabase } from '../lib/supabase';
import EditMotoristaModal from './EditMotoristaModal';
import AddAjudanteModal from './AddAjudanteModal';
import EditAjudanteModal from './EditAjudanteModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import GestaoRiscoTab from './GestaoRiscoTab';
import ComentariosTab from './ComentariosTab';
import { toast } from 'sonner';

interface UnifiedMotoristaModalProps {
  isOpen: boolean;
  onClose: () => void;
  motorista: Motorista | null;
  onSuccess?: () => void;
}

const UnifiedMotoristaModal = ({ 
  isOpen, 
  onClose, 
  motorista, 
  onSuccess 
}: UnifiedMotoristaModalProps) => {

  const [activeTab, setActiveTab] = useState<'details' | 'documents' | 'ajudantes' | 'gestao-risco' | 'comentarios'>('details');
  
  // Debug: rastrear mudanças no activeTab
  useEffect(() => {
    console.log('ActiveTab mudou para:', activeTab);
    if (activeTab === 'comentarios') {
      console.log('Aba comentários ativada - vamos rastrear reloads');
      
      // Interceptar qualquer tentativa de reload
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        console.log('ALERT: Página tentando recarregar!!!');
        e.preventDefault();
        e.returnValue = '';
        return '';
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [activeTab]);
  const [isEditingDocuments, setIsEditingDocuments] = useState(false);
  

  

  const [activeDocument, setActiveDocument] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [endereco, setEndereco] = useState<any>(null);
  const [isAddAjudanteModalOpen, setIsAddAjudanteModalOpen] = useState(false);
  const [isEditAjudanteModalOpen, setIsEditAjudanteModalOpen] = useState(false);
  const [documentoMotorista, setDocumentoMotorista] = useState<DocumentoMotorista | null>(null);
  const [isDeleteAjudanteModalOpen, setIsDeleteAjudanteModalOpen] = useState(false);
  const [selectedAjudante, setSelectedAjudante] = useState<DocumentoAjudante | null>(null);
  const [documentCount, setDocumentCount] = useState(0);
  const [ajudantesCount, setAjudantesCount] = useState(0);
  const [gestaoRiscoCount, setGestaoRiscoCount] = useState(0);
  const [comentariosCount, setComentariosCount] = useState(0);
  const [ajudantes, setAjudantes] = useState<DocumentoAjudante[]>([]);
  const [proprietarioVeiculo, setProprietarioVeiculo] = useState<any>(null);
  const isInitializedRef = useRef(false);
  
  // 🔍 DEBUGGING: Criar uma função proxy para detectar mudanças no isInitializedRef
  const setInitializedRef = (value: boolean, reason: string) => {
    console.log(`🔧 MUDANDO isInitializedRef de ${isInitializedRef.current} para ${value} - RAZÃO: ${reason}`);
    const stack = new Error().stack;
    console.log('📍 Stack trace:', stack);
    isInitializedRef.current = value;
  };
  const currentMotoristaIdRef = useRef<number | null>(null);
  
  // Debug: rastrear mudanças nas props que causam re-inicialização
  useEffect(() => {
    console.log('Props mudaram:', { 
      isOpen, 
      motoristaId: motorista?.motorista_id, 
      isInitializedRef: isInitializedRef.current,
      activeTab 
    });
  }, [isOpen, motorista, activeTab]);



  useEffect(() => {
    if (isOpen && motorista) {
      const motoristaId = motorista.motorista_id;
      
      // Só inicializar se for um motorista diferente ou primeira vez
      if (!isInitializedRef.current || currentMotoristaIdRef.current !== motoristaId) {
        console.log('MODAL INICIALIZANDO - fetchando dados para motorista:', motoristaId);
        console.log('activeTab atual durante inicialização:', activeTab);
        
        currentMotoristaIdRef.current = motoristaId;
        setInitializedRef(true, 'Modal inicializando');
        
        console.log('🚀 PULANDO FETCH FUNCTIONS PARA TESTE - focando só no activeTab');
        // fetchEndereco();
        // fetchDocumentCount();
        // fetchDocumentoMotorista();
        // fetchAjudantesCount();
        // fetchGestaoRiscoCount();
        // fetchComentariosCount();
        // fetchProprietarioVeiculo();
        
        console.log('✅ INICIALIZACAO COMPLETA - PRESERVANDO activeTab:', activeTab);
      } else {
        console.log('Modal já inicializado para motorista:', motoristaId, 'activeTab:', activeTab);
      }
    } else if (!isOpen) {
      console.log('Modal fechando - resetando estado');
      setInitializedRef(false, 'Modal fechando');
      currentMotoristaIdRef.current = null;
      setActiveTab('details');
    }
  }, [isOpen, motorista?.motorista_id]);
  
  // useEffect separado apenas para modal aberto - resetar tab apenas na primeira abertura
  useEffect(() => {
    if (isOpen && motorista && activeTab === 'details') {
      // Só resetar para details se ainda estiver em details (primeira abertura)
      console.log('Modal aberto - mantendo aba details');
    }
  }, [isOpen, motorista]);

  const fetchEndereco = async () => {
    if (!motorista) return;
    
    try {
      // Use the address data from the view if available
      if (motorista.logradouro || motorista.nome_cidade || motorista.sigla_estado) {
        setEndereco({
          logradouro: {
            logradouro: motorista.logradouro,
            nr_cep: motorista.nr_cep,
            bairro: {
              bairro: motorista.nome_bairro,
              cidade: {
                cidade: motorista.nome_cidade,
                estado: {
                  sigla_estado: motorista.sigla_estado
                }
              }
            }
          },
          nr_end: motorista.nr_end,
          ds_complemento_end: motorista.ds_complemento_end
        });
      } else {
        // Fallback to fetching from end_motorista if view data is not available
        const { data: enderecoArr, error: enderecoError } = await supabase
          .from('end_motorista')
          .select(`
            *,
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
          .limit(1);

        if (enderecoError) throw enderecoError;
        setEndereco(enderecoArr && enderecoArr.length > 0 ? enderecoArr[0] : null);
      }
    } catch (error) {
      console.error('Error fetching address:', error);
    }
  };

  const fetchDocumentoMotorista = async () => {
    if (!motorista) return;
    
    try {
      const { data, error } = await supabase
        .from('documento_motorista')
        .select(`
          id_documento_motorista,
          foto_cnh,
          foto_comprovante_residencia,
          motorista_id,
          uf_cnh,
          validade_cnh,
          nr_registro_cnh,
          categoria_cnh,
          nome_pai,
          nome_mae
        `)
        .eq('motorista_id', motorista.motorista_id)
        .maybeSingle();

      if (error) throw error;
      
      setDocumentoMotorista(data);
    } catch (error) {
      console.error('Error fetching driver document:', error);
    }
  };

  const fetchDocumentCount = async () => {
    if (!motorista) return;
    
    try {
      // Count documents from documento_motorista
      const { data: documentoData, error: documentoError } = await supabase
        .from('documento_motorista')
        .select('foto_cnh, foto_comprovante_residencia')
        .eq('motorista_id', motorista.motorista_id)
        .maybeSingle();
        
      if (documentoError) throw documentoError;
      
      let count = 0;
      if (documentoData?.foto_cnh) count++;
      if (documentoData?.foto_comprovante_residencia) count++;
      
      setDocumentCount(count);
    } catch (error) {
      console.error('Error fetching document count:', error);
    }
  };

  const fetchAjudantes = async () => {
    if (!motorista) return;
    
    try {
      const { data, error, count } = await supabase
        .from('documento_ajudante')
        .select('*', { count: 'exact' })
        .eq('motorista_id', motorista.motorista_id)
        .order('nome', { ascending: true });
        
      if (error) throw error;
      
      setAjudantes(data || []);
      setAjudantesCount(count || 0);
    } catch (error) {
      console.error('Erro ao carregar ajudantes:', error);
      toast.error('Erro ao carregar a lista de ajudantes');
    }
  };

  const fetchAjudantesCount = async () => {
    if (!motorista) return;
    
    try {
      const { count, error } = await supabase
        .from('documento_ajudante')
        .select('id_ajudante', { count: 'exact', head: true })
        .eq('motorista_id', motorista.motorista_id);
        
      if (error) throw error;
      
      setAjudantesCount(count || 0);
    } catch (error) {
      console.error('Error fetching ajudantes count:', error);
    }
  };

  const fetchGestaoRiscoCount = async () => {
    if (!motorista) return;
    
    try {
      const { count, error } = await supabase
        .from('gr_motorista')
        .select('id', { count: 'exact', head: true })
        .eq('motorista_id', motorista.motorista_id);
        
      if (error) throw error;
      
      setGestaoRiscoCount(count || 0);
    } catch (error) {
      console.error('Error fetching gestao risco count:', error);
    }
  };

  const fetchComentariosCount = async () => {
    if (!motorista) return;

    try {
      const { count, error } = await supabase
        .from('comentario')
        .select('id', { count: 'exact', head: true })
        .eq('id_motorista', motorista.motorista_id);
        
      if (error) throw error;
      
      setComentariosCount(count || 0);
    } catch (error) {
      console.error('Error fetching comentarios count:', error);
      setComentariosCount(0);
    }
  };

  const fetchProprietarioVeiculo = async () => {
    if (!motorista) return;

    try {
      // Verificar se o motorista já tem veiculo_id
      let veiculoId = (motorista as any).veiculo_id;
      
      if (!veiculoId) {
        // Se não tem veiculo_id direto, buscar na tabela veiculo
        const { data: veiculo, error: veiculoError } = await supabase
          .from('veiculo')
          .select('veiculo_id')
          .eq('motorista_id', motorista.motorista_id)
          .maybeSingle();
        
        if (veiculoError) throw veiculoError;
        if (!veiculo) {
          return;
        }
        
        veiculoId = veiculo.veiculo_id;
      }

      // Buscar documento do veículo
      const { data: documentoVeiculo, error: docError } = await supabase
        .from('documento_veiculo')
        .select('*')
        .eq('veiculo_id', veiculoId)
        .maybeSingle();

      if (docError) throw docError;
      if (!documentoVeiculo) {
        return;
      }

      // Buscar dados da pessoa física
      const { data: pessoaFisica, error: pfError } = await supabase
        .from('pessoa_fisica_dono_veiculo')
        .select('*')
        .eq('id_documento_veiculo', documentoVeiculo.id_documento_veiculo)
        .maybeSingle();

      // Buscar dados da pessoa jurídica
      const { data: pessoaJuridica, error: pjError } = await supabase
        .from('pessoa_juridica_dono_veiculo')
        .select('*')
        .eq('id_documento_veiculo', documentoVeiculo.id_documento_veiculo)
        .maybeSingle();

      if (pfError && pfError.code !== 'PGRST116') throw pfError;
      if (pjError && pjError.code !== 'PGRST116') throw pjError;

      // Estruturar dados do proprietário
      const proprietario = {
        documentoVeiculo,
        pessoaFisica: pessoaFisica || null,
        pessoaJuridica: pessoaJuridica || null,
        tipo: pessoaFisica ? 'fisica' : pessoaJuridica ? 'juridica' : null
      };

      setProprietarioVeiculo(proprietario);
    } catch (error) {
      console.error('Error fetching proprietario veiculo:', error);
      setProprietarioVeiculo(null);
    }
  };

  if (!isOpen || !motorista) return null;

  // Ensure we have the motorista data
  const nome = motorista.nome || '';
  const cpf = motorista.cpf || '';

  const openDocumentInNewTab = (url: string | null) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const isPdf = (url: string | null) => url?.toLowerCase().endsWith('.pdf');

  const handleEditAjudante = (ajudante: DocumentoAjudante) => {
    setSelectedAjudante(ajudante);
    setIsEditAjudanteModalOpen(true);
  };

  const handleDeleteAjudante = async (ajudante: DocumentoAjudante) => {
    if (!confirm('Tem certeza que deseja excluir este ajudante? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      // First delete any related records in cnh_ajudante
      const { error: cnhError } = await supabase
        .from('cnh_ajudante')
        .delete()
        .eq('id_ajudante', ajudante.id_ajudante);

      if (cnhError) throw cnhError;

      // Then delete the ajudante
      const { error: deleteError } = await supabase
        .from('documento_ajudante')
        .delete()
        .eq('id_ajudante', ajudante.id_ajudante);

      if (deleteError) throw deleteError;

      // Update the list of ajudantes
      await fetchAjudantes();
      toast.success('Ajudante excluído com sucesso');
    } catch (error) {
      console.error('Erro ao excluir ajudante:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir ajudante');
    }
  };

  const handleAjudanteAdded = async () => {
    await fetchAjudantes();
    toast.success('Ajudante adicionado com sucesso');
  };

  const handleAjudanteUpdated = async () => {
    await fetchAjudantes();
    toast.success('Ajudante atualizado com sucesso');
  };



  const handleDeleteConfirm = async () => {
    if (!selectedAjudante) return;
    
    try {
      // Add your delete logic here
      toast.success('Ajudante excluído com sucesso!');
      setIsDeleteAjudanteModalOpen(false);
      setSelectedAjudante(null);
      onSuccess?.();
    } catch (error) {
      console.error('Erro ao excluir ajudante:', error);
      toast.error('Erro ao excluir ajudante');
    }
  };
  
  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal Container */}
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div 
            className="relative bg-white dark:bg-gray-800 rounded-2xl w-full max-w-5xl shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
              <div className="p-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex flex-col">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {nome}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Motorista • {formatCPF(cpf)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="-mb-px flex space-x-8 px-6">
                <button
                  type="button"
                  onClick={() => setActiveTab('details')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'details'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    Detalhes
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('documents')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'documents'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <FileText className="w-4 h-4" />
                    Documentos
                    {documentCount > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                        {documentCount}
                      </span>
                    )}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('ajudantes');
                    if (motorista) fetchAjudantes();
                  }}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'ajudantes'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    Ajudantes
                    {ajudantesCount > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                        {ajudantesCount}
                      </span>
                    )}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('gestao-risco')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'gestao-risco'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <ShieldAlert className="w-4 h-4" />
                    Gestão de Risco
                    {gestaoRiscoCount > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                        {gestaoRiscoCount}
                      </span>
                    )}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Comentários clicado! activeTab atual:', activeTab);
                    console.log('isInitializedRef antes do clique:', isInitializedRef.current);
                    setActiveTab('comentarios');
                    console.log('setActiveTab chamado para comentarios');
                    console.log('isInitializedRef depois do setActiveTab:', isInitializedRef.current);
                  }}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'comentarios'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <MessageSquare className="w-4 h-4" />
                    Comentários
                    {comentariosCount > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                        {comentariosCount}
                      </span>
                    )}
                  </div>
                </button>
              </nav>
            </div>

            {/* Content */}
            <div className="p-6">
              {activeTab === 'details' ? (
                <div className="space-y-6">
                  {/* Personal Information */}
                  <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                    <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                      <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                        Informações Pessoais
                      </h3>
                      <button
                        onClick={() => setIsEditModalOpen(true)}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <Edit2 className="w-4 h-4 mr-1" />
                        Editar
                      </button>
                    </div>
                    <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:p-0">
                      <dl className="sm:divide-y sm:divide-gray-200 dark:sm:divide-gray-700">
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Nome Completo
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                            {nome}
                          </dd>
                        </div>
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            CPF
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                            {formatCPF(cpf)}
                          </dd>
                        </div>
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Data de Nascimento
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                            {motorista.dt_nascimento ? formatDate(motorista.dt_nascimento) : 'Não informada'}
                          </dd>
                        </div>
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Telefone
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                            {motorista.telefone ? formatPhone(motorista.telefone.toString()) : 'Não informado'}
                          </dd>
                        </div>
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            E-mail
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                            {motorista.email || 'Não informado'}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  {/* Address Information */}
                  <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                    <div className="px-4 py-5 sm:px-6">
                      <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-gray-400" />
                        Endereço
                      </h3>
                    </div>
                    <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:p-0">
                      <dl className="sm:divide-y sm:divide-gray-200 dark:sm:divide-gray-700">
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Logradouro
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                            {endereco?.logradouro?.logradouro ? 
                              `${endereco.logradouro.logradouro}, ${endereco.nr_end || 'S/N'}${endereco.ds_complemento_end ? ` - ${endereco.ds_complemento_end}` : ''}` 
                              : 'Não informado'}
                          </dd>
                        </div>
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Complemento
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                            {endereco?.ds_complemento_end || 'Não informado'}
                          </dd>
                        </div>
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Bairro
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                            {endereco?.logradouro?.bairro?.bairro || 'Não informado'}
                          </dd>
                        </div>
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Cidade/Estado
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                            {endereco?.logradouro?.bairro?.cidade?.cidade && endereco?.logradouro?.bairro?.cidade?.estado?.sigla_estado ? 
                              `${endereco.logradouro.bairro.cidade.cidade}/${endereco.logradouro.bairro.cidade.estado.sigla_estado}` : 
                              'Não informado'
                            }
                          </dd>
                        </div>
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            CEP
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                            {endereco?.logradouro?.nr_cep ? formatCEP(endereco.logradouro.nr_cep) : 'Não informado'}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'documents' ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      Documentos
                    </h3>
                    <div className="flex space-x-2">
                      {isEditingDocuments ? (
                        <button
                          onClick={() => setIsEditingDocuments(false)}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                        >
                          Cancelar
                        </button>
                      ) : (
                        <button
                          onClick={() => setIsEditingDocuments(true)}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          Editar e Enviar Documentos
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditingDocuments ? (
                    <DocumentoMotoristaForm
                      isOpen={true}
                      onClose={() => setIsEditingDocuments(false)}
                      motorista_id={motorista.motorista_id}
                      onSuccess={() => {
                        setIsEditingDocuments(false);
                        fetchDocumentCount();
                        onSuccess?.();
                      }}
                    />
                  ) : (
                    <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                      <div className="px-4 py-5 sm:px-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                          Documentos do Motorista
                        </h3>
                      </div>
                      <div className="border-t border-gray-200 dark:border-gray-700">
                        <dl>
                          <div className="bg-gray-50 dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              CNH
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-4">
                                  {motorista.foto_cnh || documentoMotorista?.foto_cnh ? (
                                    <div className="flex items-center">
                                      <button
                                        onClick={() => openDocumentInNewTab(motorista.foto_cnh || documentoMotorista?.foto_cnh || null)}
                                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                                      >
                                        <FileText className="w-5 h-5 mr-2" />
                                        {isPdf(motorista.foto_cnh || documentoMotorista?.foto_cnh || null) ? 'Ver PDF' : 'Ver Imagem'}
                                      </button>
                                      {!isPdf(motorista.foto_cnh || documentoMotorista?.foto_cnh || null) && (motorista.foto_cnh || documentoMotorista?.foto_cnh) && (
                                        <div className="ml-4 w-16 h-16 rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
                                          <img 
                                            src={motorista.foto_cnh || documentoMotorista?.foto_cnh || ''} 
                                            alt="CNH Preview" 
                                            className="w-full h-full object-cover cursor-pointer"
                                            onClick={() => setActiveDocument(motorista.foto_cnh || documentoMotorista?.foto_cnh || null)}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-gray-500 dark:text-gray-400">Não enviado</span>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                  <div>
                                    <span className="block text-xs text-gray-500 dark:text-gray-400">Número da CNH</span>
                                    <span className="block font-semibold text-gray-900 dark:text-white">
                                      {documentoMotorista?.nr_registro_cnh || motorista.nr_registro_cnh || motorista.nr_registro || 'Não informado'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="block text-xs text-gray-500 dark:text-gray-400">Categoria</span>
                                    <span className="block font-semibold text-gray-900 dark:text-white">
                                      {documentoMotorista?.categoria_cnh || motorista.categoria_cnh || motorista.categoria || 'Não informado'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="block text-xs text-gray-500 dark:text-gray-400">Validade</span>
                                    <span className="block font-semibold text-gray-900 dark:text-white">
                                      {documentoMotorista?.validade_cnh ? formatDate(documentoMotorista.validade_cnh) : motorista.validade_cnh ? formatDate(motorista.validade_cnh) : 'Não informado'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="block text-xs text-gray-500 dark:text-gray-400">UF</span>
                                    <span className="block font-semibold text-gray-900 dark:text-white">
                                      {documentoMotorista?.uf_cnh || motorista.uf_cnh || 'Não informado'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="block text-xs text-gray-500 dark:text-gray-400">Nome do Pai</span>
                                    <span className="block font-semibold text-gray-900 dark:text-white">
                                      {documentoMotorista?.nome_pai || motorista.dm_nome_pai || motorista.nome_pai || 'Não informado'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="block text-xs text-gray-500 dark:text-gray-400">Nome da Mãe</span>
                                    <span className="block font-semibold text-gray-900 dark:text-white">
                                      {documentoMotorista?.nome_mae || motorista.dm_nome_mae || motorista.nome_mae || 'Não informado'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </dd>
                          </div>
                          <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              Comprovante de Residência
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2 flex items-center">
                              {documentoMotorista?.foto_comprovante_residencia ? (
                                <div className="flex items-center">
                                  <button
                                    onClick={() => openDocumentInNewTab(documentoMotorista?.foto_comprovante_residencia || null)}
                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                                  >
                                    <FileText className="w-5 h-5 mr-2" />
                                    {isPdf(documentoMotorista?.foto_comprovante_residencia || null) ? 'Ver PDF' : 'Ver Imagem'}
                                  </button>
                                  {!isPdf(documentoMotorista?.foto_comprovante_residencia || null) && documentoMotorista?.foto_comprovante_residencia && (
                                    <div className="ml-4 w-16 h-16 rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
                                      <img 
                                        src={documentoMotorista.foto_comprovante_residencia}
                                        alt="Comprovante Preview" 
                                        className="w-full h-full object-cover cursor-pointer"
                                        onClick={() => setActiveDocument(documentoMotorista.foto_comprovante_residencia)}
                                      />
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-500 dark:text-gray-400">Não enviado</span>
                              )}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  )}

                  {/* Seção Proprietário do Veículo - apenas para agregados */}
                  {motorista.funcao === 'Agregado' && proprietarioVeiculo && (proprietarioVeiculo.pessoaFisica || proprietarioVeiculo.pessoaJuridica) && (
                    <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg mt-6">
                      <div className="px-4 py-5 sm:px-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                          Proprietário do Veículo
                        </h3>
                        <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                          Informações do proprietário do veículo do agregado.
                        </p>
                      </div>
                      <div className="border-t border-gray-200 dark:border-gray-700">
                        <dl>
                          {proprietarioVeiculo.tipo === 'fisica' && proprietarioVeiculo.pessoaFisica && (
                            <>
                              <div className="bg-gray-50 dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                  Tipo de Proprietário
                                </dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                                  Pessoa Física
                                </dd>
                              </div>
                              <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                  Nome Completo
                                </dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                                  {proprietarioVeiculo.pessoaFisica.nome || 'Não informado'}
                                </dd>
                              </div>
                              <div className="bg-gray-50 dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                  CPF
                                </dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                                  {proprietarioVeiculo.pessoaFisica.cpf ? formatCPF(proprietarioVeiculo.pessoaFisica.cpf.toString()) : 'Não informado'}
                                </dd>
                              </div>
                              <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                  RG/CNH
                                </dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                                  {proprietarioVeiculo.pessoaFisica.foto_documento ? (
                                    <div className="flex items-center">
                                      <button
                                        onClick={() => openDocumentInNewTab(proprietarioVeiculo.pessoaFisica.foto_documento)}
                                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                                      >
                                        <FileText className="w-5 h-5 mr-2" />
                                        {isPdf(proprietarioVeiculo.pessoaFisica.foto_documento) ? 'Ver PDF' : 'Ver Imagem'}
                                      </button>
                                      {!isPdf(proprietarioVeiculo.pessoaFisica.foto_documento) && (
                                        <div className="ml-4 w-16 h-16 rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
                                          <img 
                                            src={proprietarioVeiculo.pessoaFisica.foto_documento}
                                            alt="Documento Preview" 
                                            className="w-full h-full object-cover cursor-pointer"
                                            onClick={() => setActiveDocument(proprietarioVeiculo.pessoaFisica.foto_documento)}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-gray-500 dark:text-gray-400">Não enviado</span>
                                  )}
                                </dd>
                              </div>
                              <div className="bg-gray-50 dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                  Comprovante de Residência
                                </dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                                  {proprietarioVeiculo.pessoaFisica.comprovante_residencia ? (
                                    <div className="flex items-center">
                                      <button
                                        onClick={() => openDocumentInNewTab(proprietarioVeiculo.pessoaFisica.comprovante_residencia)}
                                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                                      >
                                        <FileText className="w-5 h-5 mr-2" />
                                        {isPdf(proprietarioVeiculo.pessoaFisica.comprovante_residencia) ? 'Ver PDF' : 'Ver Imagem'}
                                      </button>
                                      {!isPdf(proprietarioVeiculo.pessoaFisica.comprovante_residencia) && (
                                        <div className="ml-4 w-16 h-16 rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
                                          <img 
                                            src={proprietarioVeiculo.pessoaFisica.comprovante_residencia}
                                            alt="Comprovante Preview" 
                                            className="w-full h-full object-cover cursor-pointer"
                                            onClick={() => setActiveDocument(proprietarioVeiculo.pessoaFisica.comprovante_residencia)}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-gray-500 dark:text-gray-400">Não enviado</span>
                                  )}
                                </dd>
                              </div>
                            </>
                          )}

                          {proprietarioVeiculo.tipo === 'juridica' && proprietarioVeiculo.pessoaJuridica && (
                            <>
                              <div className="bg-gray-50 dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                  Tipo de Proprietário
                                </dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                                  Pessoa Jurídica
                                </dd>
                              </div>
                              <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                  Razão Social
                                </dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                                  {proprietarioVeiculo.pessoaJuridica.razao_social || 'Não informado'}
                                </dd>
                              </div>
                              <div className="bg-gray-50 dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                  CNPJ
                                </dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                                  {proprietarioVeiculo.pessoaJuridica.cnpj ? proprietarioVeiculo.pessoaJuridica.cnpj.toString().replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : 'Não informado'}
                                </dd>
                              </div>
                              <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                  Comprovante de Residência
                                </dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                                  {proprietarioVeiculo.pessoaJuridica.comprovante_residencia ? (
                                    <div className="flex items-center">
                                      <button
                                        onClick={() => openDocumentInNewTab(proprietarioVeiculo.pessoaJuridica.comprovante_residencia)}
                                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                                      >
                                        <FileText className="w-5 h-5 mr-2" />
                                        {isPdf(proprietarioVeiculo.pessoaJuridica.comprovante_residencia) ? 'Ver PDF' : 'Ver Imagem'}
                                      </button>
                                      {!isPdf(proprietarioVeiculo.pessoaJuridica.comprovante_residencia) && (
                                        <div className="ml-4 w-16 h-16 rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
                                          <img 
                                            src={proprietarioVeiculo.pessoaJuridica.comprovante_residencia}
                                            alt="Comprovante Preview" 
                                            className="w-full h-full object-cover cursor-pointer"
                                            onClick={() => setActiveDocument(proprietarioVeiculo.pessoaJuridica.comprovante_residencia)}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-gray-500 dark:text-gray-400">Não enviado</span>
                                  )}
                                </dd>
                              </div>
                            </>
                          )}
                        </dl>
                      </div>
                    </div>
                  )}
                </div>
              ) : activeTab === 'ajudantes' ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      Ajudantes
                    </h3>
                    <button
                      onClick={() => setIsAddAjudanteModalOpen(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Adicionar Ajudante
                    </button>
                  </div>
                  
                  {ajudantes.length > 0 ? (
                    <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                        {ajudantes.map((ajudante) => (
                          <li key={ajudante.id_ajudante} className="px-4 py-4 sm:px-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                  <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="ml-4">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {ajudante.nome}
                                  </p>
                                  <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {ajudante.cpf ? formatCPF(ajudante.cpf.toString()) : 'CPF não informado'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleEditAjudante(ajudante)}
                                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                  <Edit2 className="w-4 h-4 mr-1" />
                                  Editar
                                </button>
                                <button
                                  onClick={() => handleDeleteAjudante(ajudante)}
                                  className="inline-flex items-center px-3 py-1.5 border border-red-300 dark:border-red-600 shadow-sm text-xs font-medium rounded-md text-red-700 dark:text-red-200 bg-white dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Excluir
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Users className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                        Nenhum ajudante encontrado
                      </h3>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Adicione um novo ajudante para começar.
                      </p>
                      <div className="mt-6">
                        <button
                          onClick={() => setIsAddAjudanteModalOpen(true)}
                          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <Edit2 className="-ml-1 mr-2 h-5 w-5" />
                          Adicionar Ajudante
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : activeTab === 'gestao-risco' ? (
                <GestaoRiscoTab 
                  motorista_id={motorista.motorista_id}
                  gr_motorista_id={motorista.gr_motorista_id}
                  gr_motorista_motivo={motorista.gr_motorista_motivo}
                  empresa_motorista={motorista.empresa_motorista}
                  status_motorista={motorista.status_motorista}
                  onUpdateSuccess={() => {
                    fetchGestaoRiscoCount();
                    onSuccess?.();
                  }}
                />
              ) : activeTab === 'comentarios' ? (
                <div>
                  <p style={{color: 'red', fontSize: '18px', fontWeight: 'bold'}}>
                    DEBUG: Aba comentários ativada! activeTab = {activeTab}
                  </p>
                  <ComentariosTab 
                    motorista_id={motorista.motorista_id}
                    onUpdateSuccess={() => {
                      console.log('🎯 ComentariosTab onUpdateSuccess chamado - SEM onSuccess');
                      fetchComentariosCount();
                      // Removido temporariamente para testar: onSuccess?.();
                    }}
                  />
                </div>
              ) : (
                <div>
                  <p style={{color: 'blue', fontSize: '18px', fontWeight: 'bold'}}>
                    DEBUG: Aba não reconhecida! activeTab = {activeTab}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {isEditModalOpen && (
        <EditMotoristaModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          motorista={motorista}
          onUpdate={() => {
            setIsEditModalOpen(false);
            onSuccess?.();
          }}
        />
      )}

      {isAddAjudanteModalOpen && motorista && (
        <AddAjudanteModal
          isOpen={isAddAjudanteModalOpen}
          onClose={() => setIsAddAjudanteModalOpen(false)}
          motorista_id={motorista.motorista_id}
          onSuccess={handleAjudanteAdded}
        />
      )}

      {isEditAjudanteModalOpen && selectedAjudante && (
        <EditAjudanteModal
          isOpen={isEditAjudanteModalOpen}
          onClose={() => setIsEditAjudanteModalOpen(false)}
          ajudante={selectedAjudante}
          onSuccess={handleAjudanteUpdated}
        />
      )}

      {isDeleteAjudanteModalOpen && selectedAjudante && (
        <DeleteConfirmationModal
          isOpen={isDeleteAjudanteModalOpen}
          onClose={() => {
            setIsDeleteAjudanteModalOpen(false);
            setSelectedAjudante(null);
          }}
          onConfirm={handleDeleteConfirm}
          title="Excluir Ajudante"
          message={`Tem certeza que deseja excluir o ajudante "${selectedAjudante.nome}"? Esta ação não pode ser desfeita.`}
        />
      )}

      {/* Full-screen document viewer */}
      {activeDocument && (
        <div 
          className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
          onClick={() => setActiveDocument(null)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Visualização do Documento
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openDocumentInNewTab(activeDocument)}
                  className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Abrir em nova aba"
                >
                  <ExternalLink size={20} />
                </button>
                <button
                  onClick={() => setActiveDocument(null)}
                  className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="relative h-[calc(90vh-80px)]">
              {isPdf(activeDocument) ? (
                <iframe 
                  src={`${activeDocument}#toolbar=1`} 
                  className="w-full h-full" 
                  title="PDF Viewer"
                />
              ) : (
                <img
                  src={activeDocument}
                  alt="Documento"
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedMotoristaModal;