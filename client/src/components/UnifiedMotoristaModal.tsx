import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, User, MapPin, FileText, ExternalLink, Edit2, Users, ShieldAlert, MessageSquare, Tag 
} from 'lucide-react';
import type { 
  DocumentoMotorista, 
  Motorista,
  DocumentoAjudante,
  RgAjudante
} from '../types/database';
import { formatCPF, formatPhone, formatDate, formatCEP, formatCNPJ } from '../utils/format';
import DocumentoMotoristaForm from './DocumentoMotoristaForm';
import { supabase } from '../lib/supabase';
import EditMotoristaModal from './EditMotoristaModal';
import UnifiedAjudanteModal from './UnifiedAjudanteModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import GestaoRiscoTab from './GestaoRiscoTab';
import ComentariosTab from './ComentariosTab';
import { MotoristaTagsManager } from './MotoristaTagsManager';
import { toast } from 'sonner';
import WhatsAppAvatar from './WhatsAppAvatar';

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

  const [activeTab, setActiveTab] = useState<'details' | 'documents' | 'ajudantes' | 'gestao-risco' | 'comentarios' | 'tags'>('details');
  

  const [isEditingDocuments, setIsEditingDocuments] = useState(false);
  

  

  const [activeDocument, setActiveDocument] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [endereco, setEndereco] = useState<any>(null);
  const [isAjudanteModalOpen, setIsAjudanteModalOpen] = useState(false);
  const [ajudanteModalMode, setAjudanteModalMode] = useState<'add' | 'edit'>('add');
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
  
  // Função para controlar mudanças no isInitializedRef
  const setInitializedRef = (value: boolean) => {
    isInitializedRef.current = value;
  };
  const currentMotoristaIdRef = useRef<number | null>(null);
  




  useEffect(() => {
    if (isOpen && motorista) {
      const motoristaId = motorista.motorista_id;
      
      // Só inicializar se for um motorista diferente ou primeira vez
      if (!isInitializedRef.current || currentMotoristaIdRef.current !== motoristaId) {
        currentMotoristaIdRef.current = motoristaId;
        setInitializedRef(true);
        
        fetchEndereco();
        fetchDocumentCount();
        fetchDocumentoMotorista();
        fetchAjudantesCount();
        fetchGestaoRiscoCount();
        fetchComentariosCount();
        fetchProprietarioVeiculo();
      }
    } else if (!isOpen) {
      setInitializedRef(false);
      currentMotoristaIdRef.current = null;
      setActiveTab('details');
    }
  }, [isOpen, motorista?.motorista_id]);
  


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
        .select(`
          *,
          rg_ajudante (
            id_rg_ajudante,
            nr_rg,
            data_emissao,
            orgao_expedidor,
            filiacao,
            foto_rg
          ),
          cnh_ajudante (
            id_cnh_ajudante,
            nr_registro,
            categoria,
            nome_pai,
            nome_mae,
            foto_cnh
          )
        `, { count: 'exact' })
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
    setAjudanteModalMode('edit');
    setIsAjudanteModalOpen(true);
  };

  const handleAddAjudante = () => {
    setSelectedAjudante(null);
    setAjudanteModalMode('add');
    setIsAjudanteModalOpen(true);
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

  const handleAjudanteSuccess = async () => {
    setIsAjudanteModalOpen(false);
    setSelectedAjudante(null);
    await fetchAjudantes();
    onSuccess?.();
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
                  <WhatsAppAvatar 
                    photoUrl={motorista?.foto_whatsapp}
                    name={nome}
                    size="lg"
                  />
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
                    setActiveTab('comentarios');
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
                <button
                  type="button"
                  onClick={() => setActiveTab('tags')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'tags'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <Tag className="w-4 h-4" />
                    Marcadores
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
                                  {formatCNPJ(proprietarioVeiculo.pessoaJuridica?.cnpj)}
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
                      onClick={handleAddAjudante}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      data-testid="button-add-ajudante"
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Adicionar Ajudante
                    </button>
                  </div>
                  
                  {ajudantes.length > 0 ? (
                    <div className="space-y-6">
                        {ajudantes.map((ajudante) => (
                          <div key={ajudante.id_ajudante} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                            {/* Header com nome e ações */}
                            <div className="white:bg-white dark:bg-gray-750 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                    <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                  </div>
                                  <div className="ml-4">
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                                      {ajudante.nome}
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                      Ajudante
                                    </p>
                                  </div>
                                </div>
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleEditAjudante(ajudante)}
                                    className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                  >
                                    <Edit2 className="w-4 h-4 mr-2" />
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAjudante(ajudante)}
                                    className="inline-flex items-center px-3 py-2 border border-red-300 dark:border-red-600 shadow-sm text-sm font-medium rounded-md text-red-700 dark:text-red-200 bg-white dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                  >
                                    <X className="w-4 h-4 mr-2" />
                                    Excluir
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Informações detalhadas */}
                            <div className="px-6 py-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {/* Informações Pessoais */}
                                <div>
                                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3 border-b border-gray-200 dark:border-gray-700 pb-1">
                                    Informações Pessoais
                                  </h4>
                                  <div className="space-y-2">
                                    <div>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 block">CPF</span>
                                      <span className="text-sm text-gray-900 dark:text-white">
                                        {ajudante.cpf ? formatCPF(ajudante.cpf.toString()) : 'Não informado'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 block">Telefone</span>
                                      <span className="text-sm text-gray-900 dark:text-white">
                                        {ajudante.telefone || 'Não informado'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 block">Gênero</span>
                                      <span className="text-sm text-gray-900 dark:text-white">
                                        {ajudante.genero === 'M' ? 'Masculino' : ajudante.genero === 'F' ? 'Feminino' : 'Não informado'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Documentação */}
                                <div>
                                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3 border-b border-gray-200 dark:border-gray-700 pb-1">
                                    Documentação
                                  </h4>
                                  <div className="space-y-2">
                                    <div>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 block">RG</span>
                                      <span className="text-sm text-gray-900 dark:text-white">
                                        {ajudante.rg_ajudante?.[0]?.nr_rg || 'Não informado'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 block">Órgão Expedidor</span>
                                      <span className="text-sm text-gray-900 dark:text-white">
                                        {ajudante.rg_ajudante?.[0]?.orgao_expedidor || 'Não informado'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 block">Data de Emissão</span>
                                      <span className="text-sm text-gray-900 dark:text-white">
                                        {ajudante.rg_ajudante?.[0]?.data_emissao ? new Date(ajudante.rg_ajudante?.[0]?.data_emissao).toLocaleDateString('pt-BR') : 'Não informado'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Filiação */}
                                <div>
                                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3 border-b border-gray-200 dark:border-gray-700 pb-1">
                                    Filiação
                                  </h4>
                                  <div className="space-y-2">
                                    <div>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 block">Nome do Pai</span>
                                      <span className="text-sm text-gray-900 dark:text-white">
                                        {ajudante.cnh_ajudante?.[0]?.nome_pai || 'Não informado'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 block">Nome da Mãe</span>
                                      <span className="text-sm text-gray-900 dark:text-white">
                                        {ajudante.cnh_ajudante?.[0]?.nome_mae || 'Não informado'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Endereço */}
                              {(ajudante.logradouro_ajudante || ajudante.nr_cep_ajudante || ajudante.nome_cidade_ajudante) && (
                                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                                    Endereço
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 block">Logradouro</span>
                                      <span className="text-sm text-gray-900 dark:text-white">
                                        {ajudante.logradouro_ajudante || 'Não informado'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 block">Número</span>
                                      <span className="text-sm text-gray-900 dark:text-white">
                                        {ajudante.nr_end_ajudante || 'Não informado'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 block">Complemento</span>
                                      <span className="text-sm text-gray-900 dark:text-white">
                                        {ajudante.ds_complemento_end_ajudante || 'Não informado'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 block">CEP</span>
                                      <span className="text-sm text-gray-900 dark:text-white">
                                        {ajudante.nr_cep_ajudante || 'Não informado'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 block">Bairro</span>
                                      <span className="text-sm text-gray-900 dark:text-white">
                                        {ajudante.nome_bairro_ajudante || 'Não informado'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 block">Cidade</span>
                                      <span className="text-sm text-gray-900 dark:text-white">
                                        {ajudante.nome_cidade_ajudante || 'Não informado'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 block">Estado</span>
                                      <span className="text-sm text-gray-900 dark:text-white">
                                        {ajudante.nome_estado_ajudante || 'Não informado'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Documentos */}
                              {(ajudante.foto_rg || ajudante.comprovante_residencia || ajudante.rg_ajudante?.[0]?.foto_rg) && (
                                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                                    Documentos
                                  </h4>
                                  <div className="flex flex-wrap gap-3">
                                    {/* RG */}
                                    {(ajudante.foto_rg || ajudante.rg_ajudante?.[0]?.foto_rg) && (
                                      <button
                                        onClick={() => setActiveDocument(ajudante.foto_rg || ajudante.rg_ajudante?.[0]?.foto_rg)}
                                        className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                      >
                                        <FileText className="w-4 h-4 mr-2" />
                                        Ver RG
                                      </button>
                                    )}
                                    
                                    {/* CNH */}
                                    {ajudante.cnh_ajudante?.[0]?.foto_cnh && (
                                      <button
                                        onClick={() => setActiveDocument(ajudante.cnh_ajudante[0].foto_cnh)}
                                        className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                      >
                                        <FileText className="w-4 h-4 mr-2" />
                                        Ver CNH
                                      </button>
                                    )}
                                    
                                    {/* Comprovante de Residência */}
                                    {ajudante.comprovante_residencia && (
                                      <button
                                        onClick={() => setActiveDocument(ajudante.comprovante_residencia)}
                                        className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                      >
                                        <FileText className="w-4 h-4 mr-2" />
                                        Ver Comprovante de Residência
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  ): (
                    <div className="text-center py-12">
                      <Users className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                        Nenhum ajudante encontrado
                      </h3>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Use o botão "Adicionar Ajudante" no cabeçalho para começar.
                      </p>
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
                <ComentariosTab 
                  motorista_id={motorista.motorista_id}
                  onUpdateSuccess={() => {
                    fetchComentariosCount();
                  }}
                />
              ) : activeTab === 'tags' ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      Gerenciar Marcadores
                    </h3>
                  </div>
                  
                  <MotoristaTagsManager 
                    motoristaId={motorista.motorista_id}
                    companyId={motorista.company_id || 2}
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

      <UnifiedAjudanteModal
        isOpen={isAjudanteModalOpen}
        onClose={() => {
          setIsAjudanteModalOpen(false);
          setSelectedAjudante(null);
        }}
        mode={ajudanteModalMode}
        motorista_id={motorista.motorista_id}
        ajudante={selectedAjudante}
        onSuccess={handleAjudanteSuccess}
      />

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