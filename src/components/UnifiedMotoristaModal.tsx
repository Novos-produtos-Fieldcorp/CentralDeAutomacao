import React, { useState, useEffect } from 'react';
import { 
  X, Truck, User, MapPin, Phone, CreditCard, FileText, Camera, 
  CheckCircle2, XCircle, ExternalLink, Home, Edit2, Users, ShieldAlert, MessageSquare 
} from 'lucide-react';
import type { 
  DocumentoMotorista, 
  Veiculo, 
  DocumentoVeiculo, 
  Motorista,
  PessoaFisicaDonoVeiculo,
  PessoaJuridicaDonoVeiculo
} from '../types/database';
import { formatCPF, formatPhone, formatDate, formatCEP } from '../utils/format';
import { supabase } from '../lib/supabase';
import DocumentoMotoristaForm from './DocumentoMotoristaForm';
import DocumentUploader from './DocumentUploader';
import toast from 'react-hot-toast';
import EditMotoristaModal from './EditMotoristaModal';
import AddAjudanteModal from './AddAjudanteModal';
import EditAjudanteModal from './EditAjudanteModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import GestaoRiscoTab from './GestaoRiscoTab';
import ComentariosTab from './ComentariosTab';

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
  const [isEditingDocuments, setIsEditingDocuments] = useState(false);
  const [activeDocument, setActiveDocument] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddAjudanteModalOpen, setIsAddAjudanteModalOpen] = useState(false);
  const [isEditAjudanteModalOpen, setIsEditAjudanteModalOpen] = useState(false);
  const [isDeleteAjudanteModalOpen, setIsDeleteAjudanteModalOpen] = useState(false);
  const [selectedAjudante, setSelectedAjudante] = useState<any>(null);
  const [documentCount, setDocumentCount] = useState(0);
  const [ajudantesCount, setAjudantesCount] = useState(0);
  const [gestaoRiscoCount, setGestaoRiscoCount] = useState(0);
  const [hasComentario, setHasComentario] = useState(false);

  useEffect(() => {
    if (isOpen && motorista) {
      fetchDocumentCount();
      fetchAjudantesCount();
      fetchGestaoRiscoCount();
      checkComentario();
    }
  }, [isOpen, motorista]);

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

  const checkComentario = async () => {
    if (!motorista) return;
    
    try {
      const { data, error } = await supabase
        .from('motorista')
        .select('comentario')
        .eq('motorista_id', motorista.motorista_id)
        .single();
        
      if (error) throw error;
      
      setHasComentario(!!data?.comentario);
    } catch (error) {
      console.error('Error checking comentario:', error);
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
                            {motorista.logradouro ? `${motorista.logradouro}, ${motorista.nr_end || 'S/N'}` : 'Não informado'}
                          </dd>
                        </div>
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Complemento
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                            {motorista.ds_complemento_end || 'Não informado'}
                          </dd>
                        </div>
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Bairro
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                            {motorista.nome_bairro || 'Não informado'}
                          </dd>
                        </div>
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Cidade/Estado
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                            {motorista.nome_cidade && motorista.sigla_estado ? 
                              `${motorista.nome_cidade}/${motorista.sigla_estado}` : 
                              'Não informado'
                            }
                          </dd>
                        </div>
                        <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            CEP
                          </dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                            {motorista.nr_cep ? formatCEP(motorista.nr_cep) : 'Não informado'}
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
                              {motorista.documento_motorista?.[0]?.foto_cnh ? (
                                <div className="flex items-center">
                                  <button
                                    onClick={() => openDocumentInNewTab(motorista.documento_motorista?.[0]?.foto_cnh || null)}
                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                                  >
                                    <FileText className="w-5 h-5 mr-2" />
                                    {isPdf(motorista.documento_motorista?.[0]?.foto_cnh || null) ? 'Ver PDF' : 'Ver Imagem'}
                                  </button>
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
                            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                              {motorista.documento_motorista?.[0]?.foto_comprovante_residencia ? (
                                <div className="flex items-center">
                                  <button
                                    onClick={() => openDocumentInNewTab(motorista.documento_motorista?.[0]?.foto_comprovante_residencia || null)}
                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                                  >
                                    <FileText className="w-5 h-5 mr-2" />
                                    {isPdf(motorista.documento_motorista?.[0]?.foto_comprovante_residencia || null) ? 'Ver PDF' : 'Ver Imagem'}
                                  </button>
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
                  
                  {motorista.documento_ajudante && motorista.documento_ajudante.length > 0 ? (
                    <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                        {motorista.documento_ajudante.map((ajudante) => (
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
              ) : (
                <ComentariosTab 
                  motorista_id={motorista.motorista_id}
                  onUpdateSuccess={() => {
                    checkComentario();
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
          fetchAjudantesCount();
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
            fetchAjudantesCount();
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

export default UnifiedMotoristaModal;