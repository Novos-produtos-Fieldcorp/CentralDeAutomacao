import { useState, useEffect } from 'react';
import { X, Truck, User, FileText, ExternalLink, Edit2, Users, ShieldAlert, MessageSquare, Tag } from 'lucide-react';
import type { 
  DocumentoMotorista, 
  Veiculo, 
  Motorista
} from '../types/database';
import { formatCPF, formatPhone, formatDate, formatCEP } from '../utils/format';
import { consultarCpfApi } from '../utils/cpfService';
import DocumentoMotoristaForm from './DocumentoMotoristaForm';
import DocumentUploader from './DocumentUploader';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import EditMotoristaModal from './EditMotoristaModal';
import AddAjudanteModal from './AddAjudanteModal';
import EditAjudanteModal from './EditAjudanteModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import GestaoRiscoTab from './GestaoRiscoTab';
import ComentariosTab from './ComentariosTab';
import EditVeiculoModal from './veiculos/EditVeiculoModal';
import WhatsAppAvatar from './WhatsAppAvatar';
import { MotoristaTagsManager } from './MotoristaTagsManager';

interface UnifiedAgregadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  motorista: Motorista | null;
  onSuccess?: () => void;
}

const UnifiedAgregadoModal = ({ isOpen, onClose, motorista, onSuccess }: UnifiedAgregadoModalProps) => {
  const [activeTab, setActiveTab] = useState<'details' | 'documents' | 'ajudantes' | 'gestao-risco' | 'comentarios' | 'tags'>('details');
  const [isEditingDocuments, setIsEditingDocuments] = useState(false);
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);
  const [activeDocument, setActiveDocument] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddAjudanteModalOpen, setIsAddAjudanteModalOpen] = useState(false);
  const [isEditAjudanteModalOpen, setIsEditAjudanteModalOpen] = useState(false);
  const [isDeleteAjudanteModalOpen, setIsDeleteAjudanteModalOpen] = useState(false);
  const [selectedAjudante, setSelectedAjudante] = useState<any>(null);
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);
  const [documento, setDocumento] = useState<DocumentoMotorista | null>(null);
  const [endereco, setEndereco] = useState<any>(null);
  const [ajudantes, setAjudantes] = useState<any[]>([]);
  const [documentCount, setDocumentCount] = useState(0);
  const [ajudantesCount, setAjudantesCount] = useState(0);
  const [gestaoRiscoCount, setGestaoRiscoCount] = useState(0);
  const [comentarioCount, setComentarioCount] = useState(0);
  const [isEditVeiculoModalOpen, setIsEditVeiculoModalOpen] = useState(false);
  const [proprietarioVeiculo, setProprietarioVeiculo] = useState<any>(null);

  useEffect(() => {
    if (isOpen && motorista) {
      console.log('UnifiedAgregadoModal aberto para:', motorista.nome);
      fetchAgregadoDetails();
      fetchProprietarioVeiculo();
    }
  }, [isOpen, motorista]);

  const fetchAgregadoDetails = async () => {
    if (!motorista) return;

    try {
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

      if (veiculoError) throw veiculoError;
      setVeiculo(veiculoData);
      
      // Fetch gestão de risco
      try {
        const { data: grData, error: grError } = await supabase
          .from('gr_motorista')
          .select(`
            *,
            empresa:empresa_id(id, nome),
            status:status_id(id, status)
          `)
          .eq('motorista_id', motorista.motorista_id)
          .order('id', { ascending: false }) // Ordena pelo ID em ordem decrescente
          .limit(1) // Limita a 1 resultado
          .maybeSingle();
          
        if (grError) {
          console.error('Erro ao buscar dados de gestão de risco:', grError);
          throw grError;
        }
        
        console.log('Dados de gestão de risco encontrados:', grData);
        
        // Atualiza o objeto motorista com os dados de gestão de risco
        if (grData) {
          motorista.gr_motorista_id = grData.id;
          motorista.gr_motorista_motivo = grData.motivo || null;
          motorista.empresa_motorista = grData.empresa?.nome || null;
          motorista.status_motorista = grData.status?.status || null;
          
          console.log('Dados de gestão de risco atualizados no motorista:', {
            gr_motorista_id: motorista.gr_motorista_id,
            motivo: motorista.gr_motorista_motivo,
            empresa: motorista.empresa_motorista,
            status: motorista.status_motorista
          });
        } else {
          console.log('Nenhum dado de gestão de risco encontrado para o motorista:', motorista.motorista_id);
        }
      } catch (error) {
        console.error('Erro ao processar dados de gestão de risco:', error);
      }

      // Fetch documento
      const { data: documentoData, error: documentoError } = await supabase
        .from('documento_motorista')
        .select('*')
        .eq('motorista_id', motorista.motorista_id)
        .maybeSingle();

      if (documentoError) throw documentoError;
      setDocumento(documentoData);

      // Fetch endereco
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

      // Fetch ajudantes
      const { data: ajudantesData, error: ajudantesError } = await supabase
        .from('documento_ajudante')
        .select(`
          *,
          cnh_ajudante (*),
          rg_ajudante (*),
          end_ajudante (
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
          )
        `)
        .eq('motorista_id', motorista.motorista_id);

      if (ajudantesError) throw ajudantesError;
      setAjudantes(ajudantesData || []);
      setAjudantesCount(ajudantesData?.length || 0);

      // Count documents
      let docCount = 0;
      if (documentoData?.foto_cnh) docCount++;
      if (documentoData?.foto_comprovante_residencia) docCount++;
      if (veiculoData?.documento_veiculo?.[0]?.foto_crv) docCount++;
      setDocumentCount(docCount);

      // Count gestao de risco
      const { count: grCount, error: grCountError } = await supabase
        .from('gr_motorista')
        .select('id', { count: 'exact', head: true })
        .eq('motorista_id', motorista.motorista_id);

      if (grCountError) throw grCountError;
      setGestaoRiscoCount(grCount || 0);

      // Get comment count
      const { count: comentarioCount, error: comentarioError } = await supabase
        .from('comentario')
        .select('*', { count: 'exact', head: true })
        .eq('id_motorista', motorista.motorista_id);

      if (comentarioError) throw comentarioError;
      setComentarioCount(comentarioCount || 0);
    } catch (error) {
      console.error('Error fetching agregado details:', error);
      toast.error('Erro ao carregar detalhes do agregado');
    }
  };

  const fetchProprietarioVeiculo = async () => {
    if (!motorista) return;

    console.log('=== INICIANDO BUSCA PROPRIETÁRIO VEÍCULO (AGREGADO MODAL) ===');
    console.log('motorista.motorista_id:', motorista.motorista_id);

    try {
      // Primeiro buscar o veículo do motorista
      const { data: veiculoData, error: veiculoError } = await supabase
        .from('veiculo')
        .select('veiculo_id')
        .eq('motorista_id', motorista.motorista_id)
        .maybeSingle();

      console.log('Veículo encontrado:', { veiculoData, veiculoError });

      if (veiculoError) throw veiculoError;
      if (!veiculoData) {
        console.log('Nenhum veículo encontrado para este motorista');
        return;
      }

      // Buscar documento do veículo
      const { data: documentoVeiculo, error: docError } = await supabase
        .from('documento_veiculo')
        .select('id_documento_veiculo')
        .eq('veiculo_id', veiculoData.veiculo_id)
        .maybeSingle();

      console.log('Documento veículo encontrado:', { documentoVeiculo, docError });

      if (docError) throw docError;
      if (!documentoVeiculo) {
        console.log('Nenhum documento de veículo encontrado');
        return;
      }

      // Buscar proprietário pessoa física usando id_documento_veiculo
      const { data: pessoaFisica, error: pfError } = await supabase
        .from('pessoa_fisica_dono_veiculo')
        .select('*')
        .eq('id_documento_veiculo', documentoVeiculo.id_documento_veiculo)
        .limit(1)
        .maybeSingle();

      console.log('Pessoa física encontrada:', { pessoaFisica, pfError });

      // Buscar proprietário pessoa jurídica usando id_documento_veiculo
      const { data: pessoaJuridica, error: pjError } = await supabase
        .from('pessoa_juridica_dono_veiculo')
        .select('*')
        .eq('id_documento_veiculo', documentoVeiculo.id_documento_veiculo)
        .maybeSingle();

      console.log('Pessoa jurídica encontrada:', { pessoaJuridica, pjError });

      if (pfError) console.error('Erro ao buscar pessoa física:', pfError);
      if (pjError) console.error('Erro ao buscar pessoa jurídica:', pjError);

      // Se encontrou dados de proprietário, configurar o estado
      if (pessoaFisica || pessoaJuridica) {
        const proprietario = {
          pessoaFisica,
          pessoaJuridica,
          veiculo_id: veiculoData.veiculo_id
        };
        console.log('Proprietário configurado:', proprietario);
        setProprietarioVeiculo(proprietario);
      } else {
        console.log('Nenhum proprietário encontrado');
        setProprietarioVeiculo(null);
      }

    } catch (error) {
      console.error('Erro na busca do proprietário:', error);
      setProprietarioVeiculo(null);
    }
  };

  if (!isOpen || !motorista) return null;

  // Ensure we have the motorista data
  // Use nome_motorista if nome is not available (for backward compatibility)
  const nome = motorista.nome || (motorista as any).nome_motorista || '';
  const cpf = motorista.cpf || '';

  const openDocumentInNewTab = (url: string | null | undefined) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      toast.error('Documento não disponível');
    }
  };

  const isPdf = (url: string | null) => url?.toLowerCase().endsWith('.pdf');

  const handleEditAjudante = (ajudante: any) => {
    setSelectedAjudante(ajudante);
    setIsEditAjudanteModalOpen(true);
  };

  const handleDeleteAjudante = (ajudante: any) => {
    setSelectedAjudante(ajudante);
    setIsDeleteAjudanteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedAjudante) return;
    
    try {
      // Delete the ajudante from the database
      const { error: deleteError } = await supabase
        .from('documento_ajudante')
        .delete()
        .eq('id_ajudante', selectedAjudante.id_ajudante);
      
      if (deleteError) throw deleteError;
      
      // Update local state to remove the deleted ajudante
      setAjudantes(prevAjudantes => 
        prevAjudantes.filter(a => a.id_ajudante !== selectedAjudante.id_ajudante)
      );
      
      // Update the count
      setAjudantesCount(prevCount => Math.max(0, prevCount - 1));
      
      toast.success('Ajudante excluído com sucesso!');
      setIsDeleteAjudanteModalOpen(false);
      setSelectedAjudante(null);
      onSuccess?.();
    } catch (error) {
      console.error('Erro ao excluir ajudante:', error);
      toast.error('Erro ao excluir ajudante');
    }
  };

  const handleAjudanteUpdated = async () => {
    await fetchAgregadoDetails();
    toast.success('Ajudante atualizado com sucesso');
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
              <div className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-4">
                    <WhatsAppAvatar 
                      photoUrl={motorista?.foto_whatsapp}
                      name={nome}
                      size="lg"
                    />
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {nome}
                      </h1>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Agregado • {formatCPF(cpf)}
                      </p>
                      
                      {/* Vehicle Info */}
                      {veiculo && (
                        <div className="mt-4 flex items-center gap-2">
                          <div className="text-sm bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-md">
                            <span className="font-medium">Veículo: </span>
                            <span className="text-gray-700 dark:text-gray-300">
                              {veiculo.marca} {veiculo.modelo} • {veiculo.placa}
                            </span>
                          </div>
                          <button
                            onClick={() => setIsEditVeiculoModalOpen(true)}
                            className="p-1 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 
                                      rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            title="Editar Veículo"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={onClose}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 
                              rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="-mb-px flex space-x-8 px-6">
                <button
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
                  onClick={() => setActiveTab('ajudantes')}
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
                  onClick={() => setActiveTab('comentarios')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'comentarios'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <MessageSquare className="w-4 h-4" />
                    Comentários
                    {comentarioCount > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                        {comentarioCount}
                      </span>
                    )}
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('tags')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'tags'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <Tag className="w-4 h-4" />
                    Tags
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
                        {/* Endereço */}
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Endereço
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                            {endereco && endereco.logradouro ? (
                              <span>
                                {endereco.logradouro.logradouro || ''}
                                {endereco.nr_end ? `, ${endereco.nr_end}` : ''}
                                {endereco.ds_complemento_end ? `, ${endereco.ds_complemento_end}` : ''}<br />
                                {endereco.logradouro.bairro?.bairro || ''}
                                {endereco.logradouro.bairro?.cidade ? `, ${endereco.logradouro.bairro.cidade.cidade}` : ''}
                                {endereco.logradouro.bairro?.cidade?.estado ? ` - ${endereco.logradouro.bairro.cidade.estado.sigla_estado}` : ''}<br />
                                {endereco.logradouro.nr_cep ? `CEP: ${formatCEP(endereco.logradouro.nr_cep)}` : ''}
                              </span>
                            ) : (
                              <span className="text-gray-500 dark:text-gray-400">Não informado</span>
                            )}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  {/* Vehicle Information */}
                  {veiculo && (
                    <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                      <div className="px-4 py-5 sm:px-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                          Veículo
                        </h3>
                      </div>
                      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:p-0">
                        <dl className="sm:divide-y sm:divide-gray-200 dark:sm:divide-gray-700">
                          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              Placa
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                              {veiculo.placa.toUpperCase()}
                            </dd>
                          </div>
                          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              Marca/Modelo
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                              {veiculo.marca} {veiculo.tipo}
                            </dd>
                          </div>
                          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              Ano
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                              {veiculo.ano || 'Não informado'}
                            </dd>
                          </div>
                          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              Tipologia
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                              {veiculo.tipologia || 'Não informada'}
                            </dd>
                          </div>
                          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              Cor
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                              {veiculo.cor || 'Não informada'}
                            </dd>
                          </div>
                          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              Combustível
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                              {veiculo.combustivel || 'Não informado'}
                            </dd>
                          </div>
                          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              Peso
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                              {veiculo.peso ? `${veiculo.peso} kg` : 'Não informado'}
                            </dd>
                          </div>
                          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              Cubagem
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                              {veiculo.cubagem ? `${veiculo.cubagem} m³` : 'Não informada'}
                            </dd>
                          </div>
                          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              Rastreador
                            </dt>
                            <dd className="mt-1 text-sm sm:mt-0 sm:col-span-2">
                              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                veiculo.possui_rastreador
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                              }`}>
                                {veiculo.possui_rastreador ? 'Sim' : 'Não'}
                              </span>
                              {veiculo.possui_rastreador && veiculo.marca_rastreador && (
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                  Marca: {veiculo.marca_rastreador}
                                </p>
                              )}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  )}
                </div>
              ) : activeTab === 'documents' ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      Documentos
                    </h3>
                    <div className="flex space-x-2">
                      {isEditingDocuments || isUploadingDocuments ? (
                        <button
                          onClick={() => {
                            setIsEditingDocuments(false);
                            setIsUploadingDocuments(false);
                          }}
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
                        fetchAgregadoDetails();
                        onSuccess?.();
                      }}
                    />
                  ) : isUploadingDocuments ? (
                    <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg p-6">
                      <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                        Enviar Documentos
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <DocumentUploader
                          documentType="cnh"
                          motorista_id={motorista.motorista_id}
                          onUploadComplete={() => {
                            toast.success('Documento enviado com sucesso');
                            fetchAgregadoDetails();
                            onSuccess?.();
                          }}
                          label="CNH"
                        />
                        <DocumentUploader
                          documentType="comprovante_residencia"
                          motorista_id={motorista.motorista_id}
                          onUploadComplete={() => {
                            toast.success('Documento enviado com sucesso');
                            fetchAgregadoDetails();
                            onSuccess?.();
                          }}
                          label="Comprovante de Residência"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                      <div className="px-4 py-5 sm:px-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                          Documentos do Agregado
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
                                  {documento?.foto_cnh || motorista.foto_cnh ? (
                                    <div className="flex items-center">
                                      <button
                                        onClick={() => openDocumentInNewTab(documento?.foto_cnh || motorista.foto_cnh || null)}
                                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                                      >
                                        <FileText className="w-5 h-5 mr-2" />
                                        {isPdf(documento?.foto_cnh || motorista.foto_cnh || null) ? 'Ver PDF' : 'Ver Imagem'}
                                      </button>
                                      {!isPdf(documento?.foto_cnh || motorista.foto_cnh || null) && (documento?.foto_cnh || motorista.foto_cnh) && (
                                        <div className="ml-4 w-16 h-16 rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
                                          <img 
                                            src={documento?.foto_cnh || motorista.foto_cnh || ''} 
                                            alt="CNH Preview" 
                                            className="w-full h-full object-cover cursor-pointer"
                                            onClick={() => setActiveDocument(documento?.foto_cnh || motorista.foto_cnh || null)}
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
                                      {documento?.nr_registro_cnh || motorista.nr_registro_cnh || motorista.nr_registro || 'Não informado'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="block text-xs text-gray-500 dark:text-gray-400">Categoria</span>
                                    <span className="block font-semibold text-gray-900 dark:text-white">
                                      {documento?.categoria_cnh || motorista.categoria_cnh || motorista.categoria || 'Não informado'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="block text-xs text-gray-500 dark:text-gray-400">Validade</span>
                                    <span className="block font-semibold text-gray-900 dark:text-white">
                                      {documento?.validade_cnh ? formatDate(documento.validade_cnh) : 
                                       motorista.validade_cnh ? formatDate(motorista.validade_cnh) : 'Não informado'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="block text-xs text-gray-500 dark:text-gray-400">UF</span>
                                    <span className="block font-semibold text-gray-900 dark:text-white">
                                      {documento?.uf_cnh || motorista.uf_cnh || 'Não informado'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="block text-xs text-gray-500 dark:text-gray-400">Nome do Pai</span>
                                    <span className="block font-semibold text-gray-900 dark:text-white">
                                      {documento?.nome_pai || motorista.dm_nome_pai || motorista.nome_pai || 'Não informado'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="block text-xs text-gray-500 dark:text-gray-400">Nome da Mãe</span>
                                    <span className="block font-semibold text-gray-900 dark:text-white">
                                      {documento?.nome_mae || motorista.dm_nome_mae || motorista.nome_mae || 'Não informado'}
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
                              {documento?.foto_comprovante_residencia ? (
                                <div className="flex items-center">
                                  <button
                                    onClick={() => openDocumentInNewTab(documento.foto_comprovante_residencia)}
                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                                  >
                                    <FileText className="w-5 h-5 mr-2" />
                                    {isPdf(documento.foto_comprovante_residencia) ? 'Ver PDF' : 'Ver Imagem'}
                                  </button>
                                  {!isPdf(documento.foto_comprovante_residencia) && (
                                    <div className="ml-4 w-16 h-16 rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
                                      <img 
                                        src={documento.foto_comprovante_residencia} 
                                        alt="Comprovante Preview" 
                                        className="w-full h-full object-cover cursor-pointer"
                                        onClick={() => setActiveDocument(documento.foto_comprovante_residencia)}
                                      />
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-500 dark:text-gray-400">Não enviado</span>
                              )}
                            </dd>
                          </div>
                          {veiculo?.documento_veiculo?.[0]?.foto_crv && (
                            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                CRV do Veículo
                              </dt>
                              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2 flex items-center">
                                <div className="flex items-center">
                                  <button
                                    onClick={() => openDocumentInNewTab(veiculo.documento_veiculo?.[0]?.foto_crv || '')}
                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                                  >
                                    <FileText className="w-5 h-5 mr-2" />
                                    {veiculo.documento_veiculo?.[0]?.foto_crv 
                                      ? (isPdf(veiculo.documento_veiculo[0].foto_crv) ? 'Ver PDF' : 'Ver Imagem')
                                      : 'Nenhum documento disponível'}
                                  </button>
                                  {veiculo.documento_veiculo?.[0]?.foto_crv && !isPdf(veiculo.documento_veiculo[0].foto_crv) && (
                                    <div className="ml-4 w-16 h-16 rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
                                      <img 
                                        src={veiculo.documento_veiculo[0].foto_crv} 
                                        alt="CRV Preview" 
                                        className="w-full h-full object-cover cursor-pointer"
                                        onClick={() => veiculo.documento_veiculo?.[0]?.foto_crv && setActiveDocument(veiculo.documento_veiculo[0].foto_crv)}
                                      />
                                    </div>
                                  )}
                                </div>
                              </dd>
                            </div>
                          )}
                          
                          {/* Seção do Proprietário do Veículo */}
                          {proprietarioVeiculo && (
                            <>
                              <div className="bg-gray-50 dark:bg-gray-800 px-4 py-5 sm:px-6">
                                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                                  Informações do Proprietário do Veículo
                                </h4>
                              </div>
                              
                              {proprietarioVeiculo.pessoaFisica && (
                                <>
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
                                      {proprietarioVeiculo.pessoaFisica.cpf || 'Não informado'}
                                    </dd>
                                  </div>
                                  <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                      RG
                                    </dt>
                                    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                                      {proprietarioVeiculo.pessoaFisica.nr_rg || 'Não informado'}
                                    </dd>
                                  </div>
                                  <div className="bg-gray-50 dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                      Órgão Expedidor
                                    </dt>
                                    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                                      {proprietarioVeiculo.pessoaFisica.orgao_expedidor || 'Não informado'}
                                    </dd>
                                  </div>
                                  <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                      Nome da Mãe
                                    </dt>
                                    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                                      {proprietarioVeiculo.pessoaFisica.nome_mae || 'Não informado'}
                                    </dd>
                                  </div>
                                  <div className="bg-gray-50 dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                      Nome do Pai
                                    </dt>
                                    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                                      {proprietarioVeiculo.pessoaFisica.nome_pai || 'Não informado'}
                                    </dd>
                                  </div>
                                  {proprietarioVeiculo.pessoaFisica.foto_documento && (
                                    <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                        Documento (RG/CNH)
                                      </dt>
                                      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2 flex items-center">
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
                                      </dd>
                                    </div>
                                  )}
                                  {proprietarioVeiculo.pessoaFisica.comprovante_residencia && (
                                    <div className="bg-gray-50 dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                        Comprovante de Residência
                                      </dt>
                                      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2 flex items-center">
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
                                      </dd>
                                    </div>
                                  )}
                                </>
                              )}
                              
                              {proprietarioVeiculo.pessoaJuridica && (
                                <>
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
                                      {proprietarioVeiculo.pessoaJuridica.cnpj || 'Não informado'}
                                    </dd>
                                  </div>
                                  <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                      Inscrição Estadual
                                    </dt>
                                    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                                      {proprietarioVeiculo.pessoaJuridica.inscricao_estadual || 'Não informado'}
                                    </dd>
                                  </div>
                                  {proprietarioVeiculo.pessoaJuridica.comprovante_residencia && (
                                    <div className="bg-gray-50 dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                        Comprovante de Endereço
                                      </dt>
                                      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2 flex items-center">
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
                                      </dd>
                                    </div>
                                  )}
                                </>
                              )}
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
                    <div className="space-y-6">
                        {ajudantes.map((ajudante) => (
                          <div key={ajudante.id_ajudante} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                            {/* Header com nome e ações */}
                            <div className="dark:bg-gray-750 px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-[#1f2937]">
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
                                        {ajudante.nr_rg || 'Não informado'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 block">Órgão Expedidor</span>
                                      <span className="text-sm text-gray-900 dark:text-white">
                                        {ajudante.orgao_expedidor || 'Não informado'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 block">Data de Emissão</span>
                                      <span className="text-sm text-gray-900 dark:text-white">
                                        {ajudante.data_emissao ? new Date(ajudante.data_emissao).toLocaleDateString('pt-BR') : 'Não informado'}
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
                                        {ajudante.nome_pai || 'Não informado'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-xs text-gray-500 dark:text-gray-400 block">Nome da Mãe</span>
                                      <span className="text-sm text-gray-900 dark:text-white">
                                        {ajudante.nome_mae || 'Não informado'}
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
                              {(ajudante.foto_rg || ajudante.comprovante_residencia) && (
                                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                                    Documentos
                                  </h4>
                                  <div className="flex flex-wrap gap-3">
                                    {ajudante.foto_rg && (
                                      <button
                                        onClick={() => setActiveDocument(ajudante.foto_rg)}
                                        className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-xs font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                      >
                                        <FileText className="w-4 h-4 mr-2" />
                                        Ver RG
                                      </button>
                                    )}
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
                    fetchAgregadoDetails();
                    onSuccess?.();
                  }}
                />
              ) : activeTab === 'comentarios' ? (
                <ComentariosTab 
                  motorista_id={motorista.motorista_id}
                  onUpdateSuccess={() => {
                    fetchAgregadoDetails();
                    onSuccess?.();
                  }}
                />
              ) : (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Gerenciar Marcadores</h3>
                  </div>
                  
                  <MotoristaTagsManager 
                    motoristaId={motorista.motorista_id}
                    companyId={motorista.company_id || 1}
                  />
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
            fetchAgregadoDetails();
            onSuccess?.();
          }}
        />
      )}
      <AddAjudanteModal
        isOpen={isAddAjudanteModalOpen}
        onClose={() => setIsAddAjudanteModalOpen(false)}
        motorista_id={motorista.motorista_id}
        onSuccess={() => {
          setIsAddAjudanteModalOpen(false);
          fetchAgregadoDetails();
          onSuccess?.();
        }}
      />
      {isEditAjudanteModalOpen && selectedAjudante && (
        <EditAjudanteModal
          isOpen={isEditAjudanteModalOpen}
          onClose={() => {
            setIsEditAjudanteModalOpen(false);
            setSelectedAjudante(null);
          }}
          ajudante={selectedAjudante}
          onSuccess={handleAjudanteUpdated}
        />
      )}
      {veiculo && (
        <EditVeiculoModal
          isOpen={isEditVeiculoModalOpen}
          onClose={() => setIsEditVeiculoModalOpen(false)}
          veiculo={veiculo}
          onUpdate={() => {
            fetchAgregadoDetails();
            onSuccess?.();
          }}
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

export default UnifiedAgregadoModal;
