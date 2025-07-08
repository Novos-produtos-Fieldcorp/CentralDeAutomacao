import React, { useState, useEffect } from 'react';
import { X, Truck, User, MapPin, Phone, CreditCard, FileText, Camera, 
  CheckCircle2, XCircle, ExternalLink, Home, Edit2, Users, ShieldAlert, MessageSquare } from 'lucide-react';
import type { 
  DocumentoMotorista, 
  Veiculo, 
  DocumentoVeiculo, 
  Motorista,
  PessoaFisicaDonoVeiculo,
  PessoaJuridicaDonoVeiculo
} from '../types/database';
import { formatCPF, formatPhone, formatDate, formatCEP } from '../utils/format';
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

interface UnifiedAgregadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  motorista: Motorista | null;
  onSuccess?: () => void;
}

const UnifiedAgregadoModal = ({ isOpen, onClose, motorista, onSuccess }: UnifiedAgregadoModalProps) => {
  const [activeTab, setActiveTab] = useState<'details' | 'documents' | 'ajudantes' | 'gestao-risco' | 'comentarios'>('details');
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
  const [hasComentario, setHasComentario] = useState(false);

  useEffect(() => {
    if (isOpen && motorista) {
      fetchAgregadoDetails();
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

      // Check if has comentario
      const { data: comentarioData, error: comentarioError } = await supabase
        .from('motorista')
        .select('comentario')
        .eq('motorista_id', motorista.motorista_id)
        .single();

      if (comentarioError) throw comentarioError;
      setHasComentario(!!comentarioData?.comentario);
    } catch (error) {
      console.error('Error fetching agregado details:', error);
      toast.error('Erro ao carregar detalhes do agregado');
    }
  };

  if (!isOpen || !motorista) return null;

  // Ensure we have the motorista data
  // Use nome_motorista if available (from the view), otherwise fall back to nome
  const nome = motorista.nome_motorista || motorista.nome || '';
  const cpf = motorista.cpf || '';

  const openDocumentInNewTab = (url: string | null) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
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
                    <Truck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex flex-col">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {nome}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Agregado • {formatCPF(cpf)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 
                           rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X size={24} />
                </button>
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
                    {hasComentario && (
                      <span className="ml-1.5 px-1.5 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
                        1
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
                            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2 flex items-center">
                              {documento?.foto_cnh ? (
                                <div className="flex items-center">
                                  <button
                                    onClick={() => openDocumentInNewTab(documento.foto_cnh)}
                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                                  >
                                    <FileText className="w-5 h-5 mr-2" />
                                    {isPdf(documento.foto_cnh) ? 'Ver PDF' : 'Ver Imagem'}
                                  </button>
                                  {!isPdf(documento.foto_cnh) && (
                                    <div className="ml-4 w-16 h-16 rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
                                      <img 
                                        src={documento.foto_cnh} 
                                        alt="CNH Preview" 
                                        className="w-full h-full object-cover cursor-pointer"
                                        onClick={() => setActiveDocument(documento.foto_cnh)}
                                      />
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-500 dark:text-gray-400">Não enviado</span>
                              )}
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
                                    onClick={() => openDocumentInNewTab(veiculo.documento_veiculo[0].foto_crv)}
                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                                  >
                                    <FileText className="w-5 h-5 mr-2" />
                                    {isPdf(veiculo.documento_veiculo[0].foto_crv) ? 'Ver PDF' : 'Ver Imagem'}
                                  </button>
                                  {!isPdf(veiculo.documento_veiculo[0].foto_crv) && (
                                    <div className="ml-4 w-16 h-16 rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
                                      <img 
                                        src={veiculo.documento_veiculo[0].foto_crv} 
                                        alt="CRV Preview" 
                                        className="w-full h-full object-cover cursor-pointer"
                                        onClick={() => setActiveDocument(veiculo.documento_veiculo[0].foto_crv)}
                                      />
                                    </div>
                                  )}
                                </div>
                              </dd>
                            </div>
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
                    fetchAgregadoDetails();
                    onSuccess?.();
                  }}
                />
              ) : (
                <ComentariosTab 
                  motorista_id={motorista.motorista_id}
                  onUpdateSuccess={() => {
                    fetchAgregadoDetails();
                    onSuccess?.();
                  }}
                />
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
        veiculo_id={veiculo?.veiculo_id}
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
          onSuccess={() => {
            setIsEditAjudanteModalOpen(false);
            setSelectedAjudante(null);
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
