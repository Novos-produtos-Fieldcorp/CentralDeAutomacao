import React, { useState, useEffect } from 'react';
import { X, Loader2, User, MapPin, Phone, Mail, Calendar, CreditCard, FileText, Camera, CheckCircle2, XCircle, ExternalLink, Upload, Save, Edit2, Plus, Truck, Home, Clock, AlertTriangle } from 'lucide-react';
import type { Motorista, DocumentoMotorista, Veiculo } from '../types/database';
import { formatCPF, formatPhone, formatDate, formatCEP } from '../utils/format';
import DocumentoMotoristaForm from './DocumentoMotoristaForm';
import DocumentUploader from './DocumentUploader';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface UnifiedMotoristaModalProps {
  isOpen: boolean;
  onClose: () => void;
  motorista: Motorista;
  onSuccess?: () => void;
}

const UnifiedMotoristaModal: React.FC<UnifiedMotoristaModalProps> = ({
  isOpen,
  onClose,
  motorista,
  onSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'documents' | 'gr'>('details');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documento, setDocumento] = useState<DocumentoMotorista | null>(null);
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);
  const [endereco, setEndereco] = useState<any | null>(null);
  const [isEditingDocuments, setIsEditingDocuments] = useState(false);
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);
  const [activeDocument, setActiveDocument] = useState<string | null>(null);
  const { companyId } = useAuth();

  useEffect(() => {
    if (isOpen && motorista) {
      fetchMotoristaDetails();
    }
  }, [isOpen, motorista]);

  const fetchMotoristaDetails = async () => {
    if (!motorista || !motorista.motorista_id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Fetch documento
      const { data: documentoData, error: documentoError } = await supabase
        .from('documento_motorista')
        .select('*')
        .eq('motorista_id', motorista.motorista_id)
        .maybeSingle();
      
      if (documentoError && documentoError.code !== 'PGRST116') {
        throw documentoError;
      }
      
      setDocumento(documentoData || null);
      
      // Fetch endereço
      const { data: enderecoData, error: enderecoError } = await supabase
        .from('end_motorista')
        .select(`
          *,
          logradouro (
            *,
            bairro (
              *,
              cidade (
                *,
                estado (
                  *
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
      
      setEndereco(enderecoData || null);
      
      // Fetch veículo (only for motoristas, not for agregados)
      if (motorista.funcao !== 'Agregado') {
        const { data: veiculoData, error: veiculoError } = await supabase
          .from('veiculo')
          .select('*')
          .eq('motorista_id', motorista.motorista_id)
          .eq('status_veiculo', true)
          .maybeSingle();
        
        if (veiculoError && veiculoError.code !== 'PGRST116') {
          throw veiculoError;
        }
        
        setVeiculo(veiculoData || null);
      }
    } catch (error) {
      console.error('Error fetching motorista details:', error);
      setError('Erro ao carregar detalhes do motorista');
      toast.error('Erro ao carregar detalhes do motorista');
    } finally {
      setLoading(false);
    }
  };

  const openDocumentInNewTab = (url: string | null) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const isPdf = (url: string | null) => url?.toLowerCase().endsWith('.pdf');

  if (!isOpen || !motorista) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal Container */}
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl w-full max-w-5xl shadow-xl max-h-[90vh] overflow-y-auto">
            {/* Header - Fixed */}
            <div className="border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
              <div className="p-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex flex-col">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {motorista.nome}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {motorista.funcao} • {formatCPF(motorista.cpf)}
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
              
              {/* Tabs */}
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
                  <button
                    onClick={() => setActiveTab('details')}
                    className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-all duration-200
                              ${activeTab === 'details'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`}
                  >
                    <User className="w-5 h-5 mr-2" />
                    Detalhes
                  </button>
                  <button
                    onClick={() => setActiveTab('documents')}
                    className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-all duration-200
                              ${activeTab === 'documents'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`}
                  >
                    <FileText className="w-5 h-5 mr-2" />
                    Documentos
                  </button>
                  <button
                    onClick={() => setActiveTab('gr')}
                    className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-all duration-200
                              ${activeTab === 'gr'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`}
                  >
                    <AlertTriangle className="w-5 h-5 mr-2" />
                    Gestão de Risco
                  </button>
                </nav>
              </div>
            </div>

            {/* Content - Scrollable */}
            <div className="p-6">
              {activeTab === 'details' && (
                <DetailsTab 
                  motorista={motorista} 
                  endereco={endereco} 
                  veiculo={veiculo} 
                />
              )}
              
              {activeTab === 'documents' && (
                <DocumentsTab 
                  motorista={motorista}
                  documento={documento}
                  veiculo={veiculo}
                  isEditingDocuments={isEditingDocuments}
                  setIsEditingDocuments={setIsEditingDocuments}
                  isUploadingDocuments={isUploadingDocuments}
                  setIsUploadingDocuments={setIsUploadingDocuments}
                  activeDocument={activeDocument}
                  setActiveDocument={setActiveDocument}
                  openDocumentInNewTab={openDocumentInNewTab}
                  isPdf={isPdf}
                  onSuccess={() => {
                    fetchMotoristaDetails();
                    if (onSuccess) onSuccess();
                  }}
                />
              )}
              
              {activeTab === 'gr' && (
                <GestaoRiscoTab 
                  motorista={motorista}
                  onSuccess={() => {
                    fetchMotoristaDetails();
                    if (onSuccess) onSuccess();
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DetailsTab: React.FC<{
  motorista: Motorista;
  endereco: any | null;
  veiculo: Veiculo | null;
}> = ({ motorista, endereco, veiculo }) => {
  return (
    <div className="space-y-6">
      {/* Personal Information */}
      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
            Informações Pessoais
          </h3>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:p-0">
          <dl className="sm:divide-y sm:divide-gray-200 dark:sm:divide-gray-700">
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Nome Completo
              </dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                {motorista.nome}
              </dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                CPF
              </dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                {formatCPF(motorista.cpf)}
              </dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Data de Nascimento
              </dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                {motorista.dt_nascimento ? formatDate(motorista.dt_nascimento) : 'Não informado'}
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
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Status
              </dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                  {motorista.st_cadastro.charAt(0).toUpperCase() + motorista.st_cadastro.slice(1).replace(/_/g, ' ')}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Address Information */}
      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
            Endereço
          </h3>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:p-0">
          {endereco ? (
            <dl className="sm:divide-y sm:divide-gray-200 dark:sm:divide-gray-700">
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Logradouro
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                  {endereco.logradouro?.logradouro}, {endereco.nr_end || 'S/N'}
                  {endereco.ds_complemento_end && ` - ${endereco.ds_complemento_end}`}
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Bairro
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                  {endereco.logradouro?.bairro?.bairro || 'Não informado'}
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Cidade/UF
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                  {endereco.logradouro?.bairro?.cidade?.cidade || 'Não informada'}/{endereco.logradouro?.bairro?.cidade?.estado?.sigla_estado || ''}
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  CEP
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                  {endereco.logradouro?.nr_cep ? formatCEP(endereco.logradouro.nr_cep) : 'Não informado'}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="px-4 py-5 sm:px-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Nenhum endereço cadastrado
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Vehicle Information (only for Agregados) */}
      {motorista.funcao === 'Agregado' && veiculo && (
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
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
                  Rastreador
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                  {veiculo.possui_rastreador ? (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                      Sim - {veiculo.marca_rastreador || 'Marca não informada'}
                    </span>
                  ) : (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200">
                      Não
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
};

const DocumentsTab: React.FC<{
  motorista: Motorista;
  documento: DocumentoMotorista | null;
  veiculo: Veiculo | null;
  isEditingDocuments: boolean;
  setIsEditingDocuments: (value: boolean) => void;
  isUploadingDocuments: boolean;
  setIsUploadingDocuments: (value: boolean) => void;
  activeDocument: string | null;
  setActiveDocument: (value: string | null) => void;
  openDocumentInNewTab: (url: string) => void;
  isPdf: (url: string | null) => boolean;
  onSuccess: () => void;
}> = ({
  motorista,
  documento,
  veiculo,
  isEditingDocuments,
  setIsEditingDocuments,
  isUploadingDocuments,
  setIsUploadingDocuments,
  activeDocument,
  setActiveDocument,
  openDocumentInNewTab,
  isPdf,
  onSuccess
}) => {
  return (
    <div className="space-y-6">
      {isEditingDocuments ? (
        <DocumentoMotoristaForm
          isOpen={isEditingDocuments}
          onClose={() => setIsEditingDocuments(false)}
          motorista_id={motorista.motorista_id}
          onSuccess={() => {
            setIsEditingDocuments(false);
            onSuccess();
          }}
        />
      ) : (
        <>
          <div className="flex justify-end">
            <button
              onClick={() => setIsEditingDocuments(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                       transition-colors flex items-center gap-2"
            >
              <Edit2 className="w-5 h-5" />
              Editar Documentos
            </button>
          </div>
          
          <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Informações da CNH
              </h3>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:p-0">
              <dl className="sm:divide-y sm:divide-gray-200 dark:sm:divide-gray-700">
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Número da CNH
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                    {documento?.nr_registro_cnh || 'Não informado'}
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Categoria
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                    {documento?.categoria_cnh || 'Não informada'}
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Validade
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                    {documento?.validade_cnh ? formatDate(documento.validade_cnh) : 'Não informada'}
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    UF
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                    {documento?.uf_cnh || 'Não informada'}
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Nome do Pai
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                    {documento?.nome_pai || 'Não informado'}
                  </dd>
                </div>
                <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Nome da Mãe
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                    {documento?.nome_mae || 'Não informado'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CNH Document */}
            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                  CNH
                </h3>
                {documento?.foto_cnh && (
                  <button
                    onClick={() => openDocumentInNewTab(documento.foto_cnh)}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-sm"
                  >
                    <ExternalLink size={16} />
                    Abrir em nova aba
                  </button>
                )}
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                {documento?.foto_cnh ? (
                  <div className="relative aspect-[1.414] w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                    {isPdf(documento.foto_cnh) ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <FileText className="w-12 h-12 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500 mb-4">Documento PDF</p>
                        <button
                          onClick={() => setActiveDocument(documento.foto_cnh)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"
                        >
                          <FileText size={16} />
                          Visualizar PDF
                        </button>
                      </div>
                    ) : (
                      <img
                        src={documento.foto_cnh}
                        alt="CNH"
                        className="absolute inset-0 w-full h-full object-contain cursor-pointer"
                        onClick={() => setActiveDocument(documento.foto_cnh)}
                      />
                    )}
                  </div>
                ) : (
                  <div className="aspect-[1.414] w-full flex flex-col items-center justify-center gap-3 bg-gray-100 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                    <Camera className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                    <div className="text-center">
                      <p className="text-gray-500 dark:text-gray-400 font-medium">CNH não cadastrada</p>
                      <p className="text-sm text-gray-400 dark:text-gray-500">
                        Clique em "Editar Documentos" para adicionar
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Comprovante de Residência */}
            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                  Comprovante de Residência
                </h3>
                {documento?.foto_comprovante_residencia && (
                  <button
                    onClick={() => openDocumentInNewTab(documento.foto_comprovante_residencia)}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-sm"
                  >
                    <ExternalLink size={16} />
                    Abrir em nova aba
                  </button>
                )}
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                {documento?.foto_comprovante_residencia ? (
                  <div className="relative aspect-[1.414] w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                    {isPdf(documento.foto_comprovante_residencia) ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <FileText className="w-12 h-12 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500 mb-4">Documento PDF</p>
                        <button
                          onClick={() => setActiveDocument(documento.foto_comprovante_residencia)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"
                        >
                          <FileText size={16} />
                          Visualizar PDF
                        </button>
                      </div>
                    ) : (
                      <img
                        src={documento.foto_comprovante_residencia}
                        alt="Comprovante de Residência"
                        className="absolute inset-0 w-full h-full object-contain cursor-pointer"
                        onClick={() => setActiveDocument(documento.foto_comprovante_residencia)}
                      />
                    )}
                  </div>
                ) : (
                  <div className="aspect-[1.414] w-full flex flex-col items-center justify-center gap-3 bg-gray-100 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                    <Camera className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                    <div className="text-center">
                      <p className="text-gray-500 dark:text-gray-400 font-medium">Comprovante não cadastrado</p>
                      <p className="text-sm text-gray-400 dark:text-gray-500">
                        Clique em "Editar Documentos" para adicionar
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Vehicle Documents (only for Agregados) */}
          {motorista.funcao === 'Agregado' && veiculo && (
            <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Documentos do Veículo
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
                </dl>
              </div>
            </div>
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
        </>
      )}
    </div>
  );
};

const GestaoRiscoTab: React.FC<{
  motorista: Motorista;
  onSuccess: () => void;
}> = ({ motorista, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [grStatus, setGrStatus] = useState<string>('');
  const [grStatusOptions, setGrStatusOptions] = useState<{id: number; status: string}[]>([]);
  const [grEntries, setGrEntries] = useState<{id: number; status: string; data: string}[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const { companyId } = useAuth();

  useEffect(() => {
    fetchGrStatusOptions();
    fetchGrEntries();
  }, [motorista.motorista_id]);

  const fetchGrStatusOptions = async () => {
    try {
      const { data, error } = await supabase
        .from('gr_status')
        .select('*')
        .order('id', { ascending: true });
      
      if (error) throw error;
      setGrStatusOptions(data || []);
    } catch (error) {
      console.error('Error fetching GR status options:', error);
      toast.error('Erro ao carregar opções de status de GR');
    }
  };

  const fetchGrEntries = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('motorista_gr')
        .select(`
          id,
          gr_status_id,
          data,
          gr_status (
            id,
            status
          )
        `)
        .eq('motorista_id', motorista.motorista_id)
        .order('data', { ascending: false });
      
      if (error) throw error;
      
      // Format the data for display
      const formattedEntries = (data || []).map(entry => ({
        id: entry.id,
        status: entry.gr_status?.status || 'Status desconhecido',
        data: formatDate(entry.data)
      }));
      
      setGrEntries(formattedEntries);
    } catch (error) {
      console.error('Error fetching GR entries:', error);
      toast.error('Erro ao carregar entradas de Gestão de Risco');
    } finally {
      setLoading(false);
    }
  };

  const handleAddGrStatus = async () => {
    if (!grStatus) {
      toast.error('Selecione um status');
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('motorista_gr')
        .insert({
          motorista_id: motorista.motorista_id,
          gr_status_id: parseInt(grStatus),
          data: new Date().toISOString().split('T')[0],
          company_id: companyId
        });
      
      if (error) throw error;
      
      toast.success('Status de GR adicionado com sucesso');
      setGrStatus('');
      setShowAddForm(false);
      fetchGrEntries();
      onSuccess();
    } catch (error) {
      console.error('Error adding GR status:', error);
      toast.error('Erro ao adicionar status de GR');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Gestão de Risco
        </h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                   transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Adicionar Gestão de Risco
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h4 className="text-base font-medium text-gray-900 dark:text-white mb-4">
            Adicionar Status de GR
          </h4>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={grStatus}
                onChange={(e) => setGrStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">Selecione um status</option>
                {grStatusOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.status}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddGrStatus}
                disabled={loading || !grStatus}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GR Entries List */}
      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
            Histórico de Gestão de Risco
          </h3>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700">
          {loading ? (
            <div className="p-6 flex justify-center">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : grEntries.length > 0 ? (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {grEntries.map((entry) => (
                <li key={entry.id} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Clock className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {entry.status}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {entry.data}
                        </p>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-5 sm:px-6 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Nenhum registro de Gestão de Risco encontrado
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UnifiedMotoristaModal;