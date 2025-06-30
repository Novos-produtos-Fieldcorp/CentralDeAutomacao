import React, { useState, useEffect } from 'react';
import { X, User, Phone, MapPin, FileText, CheckCircle2, XCircle, Camera, Loader2, ExternalLink, Upload, Save, Edit2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCPF, formatPhone, formatDate, formatCEP } from '../utils/format';
import type { Motorista, DocumentoMotorista } from '../types/database';
import DocumentoMotoristaForm from './DocumentoMotoristaForm';
import DocumentUploader from './DocumentUploader';
import toast from 'react-hot-toast';
import EditMotoristaModal from './EditMotoristaModal';

interface UnifiedMotoristaModalProps {
  isOpen: boolean;
  onClose: () => void;
  motorista?: Motorista | null;
  onSuccess?: () => void;
}

const UnifiedMotoristaModal: React.FC<UnifiedMotoristaModalProps> = ({
  isOpen,
  onClose,
  motorista,
  onSuccess
}) => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'gestao-risco'>('details');
  const [documento, setDocumento] = useState<DocumentoMotorista | null>(null);
  const [endereco, setEndereco] = useState<any>(null);
  const [isEditingDocuments, setIsEditingDocuments] = useState(false);
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);
  const [activeDocument, setActiveDocument] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Gestão de Risco data
  const [grEmpresas, setGrEmpresas] = useState<any[]>([]);
  const [grStatuses, setGrStatuses] = useState<any[]>([]);
  const [grData, setGrData] = useState<any | null>(null);
  const [isEditingGr, setIsEditingGr] = useState(false);
  const [savingGr, setSavingGr] = useState(false);
  const [grFormData, setGrFormData] = useState({
    empresa_id: '',
    status_id: '',
    motivo: ''
  });

  useEffect(() => {
    if (isOpen && motorista) {
      fetchMotoristaDetails();
      fetchGestaoRiscoData();
    }
  }, [isOpen, motorista]);

  const fetchMotoristaDetails = async () => {
    if (!motorista) return;
    
    try {
      setLoading(true);
      
      // Fetch documento
      const { data: documentoData, error: documentoError } = await supabase
        .from('documento_motorista')
        .select('*')
        .eq('motorista_id', motorista.motorista_id)
        .maybeSingle();
        
      if (documentoError && documentoError.code !== 'PGRST116') throw documentoError;
      setDocumento(documentoData);
      
      // Fetch endereco
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
                estado (*)
              )
            )
          )
        `)
        .eq('id_motorista', motorista.motorista_id)
        .maybeSingle();
        
      if (enderecoError && enderecoError.code !== 'PGRST116') throw enderecoError;
      setEndereco(enderecoData);
      
    } catch (error) {
      console.error('Error fetching motorista details:', error);
      toast.error('Erro ao carregar detalhes do motorista');
    } finally {
      setLoading(false);
    }
  };

  const fetchGestaoRiscoData = async () => {
    if (!motorista) return;
    
    try {
      // Fetch empresas
      const { data: empresasData, error: empresasError } = await supabase
        .from('gr_empresa')
        .select('*')
        .order('nome');
        
      if (empresasError) throw empresasError;
      setGrEmpresas(empresasData || []);
      
      // Fetch statuses
      const { data: statusesData, error: statusesError } = await supabase
        .from('gr_status')
        .select('*')
        .order('id');
        
      if (statusesError) throw statusesError;
      setGrStatuses(statusesData || []);
      
      // Fetch GR data for this motorista
      const { data: grData, error: grError } = await supabase
        .from('gr_motorista')
        .select(`
          *,
          empresa:empresa_id (id, nome),
          status:status_id (id, status)
        `)
        .eq('motorista_id', motorista.motorista_id)
        .maybeSingle();
        
      if (grError && grError.code !== 'PGRST116') throw grError;
      
      setGrData(grData);
      
      if (grData) {
        setGrFormData({
          empresa_id: grData.empresa_id.toString(),
          status_id: grData.status_id.toString(),
          motivo: grData.motivo || ''
        });
      } else {
        setGrFormData({
          empresa_id: '',
          status_id: '',
          motivo: ''
        });
      }
    } catch (error) {
      console.error('Error fetching gestao risco data:', error);
      toast.error('Erro ao carregar dados de gestão de risco');
    }
  };

  const handleSaveGestaoRisco = async () => {
    if (!motorista) return;
    
    try {
      setSavingGr(true);
      
      if (!grFormData.empresa_id || !grFormData.status_id) {
        toast.error('Empresa e Status são obrigatórios');
        return;
      }
      
      if (grData) {
        // Update existing record
        const { error } = await supabase
          .from('gr_motorista')
          .update({
            empresa_id: parseInt(grFormData.empresa_id),
            status_id: parseInt(grFormData.status_id),
            motivo: grFormData.motivo,
            updated_at: new Date().toISOString()
          })
          .eq('id', grData.id);
          
        if (error) throw error;
      } else {
        // Create new record
        const { error } = await supabase
          .from('gr_motorista')
          .insert({
            motorista_id: motorista.motorista_id,
            empresa_id: parseInt(grFormData.empresa_id),
            status_id: parseInt(grFormData.status_id),
            motivo: grFormData.motivo
          });
          
        if (error) throw error;
      }
      
      toast.success('Dados de gestão de risco salvos com sucesso');
      fetchGestaoRiscoData();
      setIsEditingGr(false);
    } catch (error) {
      console.error('Error saving gestao risco data:', error);
      toast.error('Erro ao salvar dados de gestão de risco');
    } finally {
      setSavingGr(false);
    }
  };
  
  if (!isOpen || !motorista) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal Container */}
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl w-full max-w-5xl shadow-xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
            {/* Header */}
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
                      Motorista • {formatCPF(motorista.cpf)}
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
                  Detalhes
                </button>
                <button
                  onClick={() => setActiveTab('gestao-risco')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'gestao-risco'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  Gestão de Risco
                </button>
              </nav>
            </div>

            {/* Content */}
            <div className="p-6 space-y-8">
              {activeTab === 'details' && (
                <>
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
                      </dl>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'gestao-risco' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      Gestão de Risco
                    </h3>
                    {!isEditingGr && (
                      <button
                        onClick={() => setIsEditingGr(true)}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <Edit2 className="w-4 h-4 mr-1" />
                        {grData ? 'Editar' : 'Adicionar'}
                      </button>
                    )}
                  </div>
                  
                  {isEditingGr ? (
                    <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg p-6">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Empresa *
                          </label>
                          <select
                            value={grFormData.empresa_id}
                            onChange={(e) => setGrFormData(prev => ({ ...prev, empresa_id: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            required
                          >
                            <option value="">Selecione uma empresa</option>
                            {grEmpresas.map(empresa => (
                              <option key={empresa.id} value={empresa.id}>
                                {empresa.nome}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Status *
                          </label>
                          <select
                            value={grFormData.status_id}
                            onChange={(e) => setGrFormData(prev => ({ ...prev, status_id: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            required
                          >
                            <option value="">Selecione um status</option>
                            {grStatuses.map(status => (
                              <option key={status.id} value={status.id}>
                                {status.status}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Motivo
                          </label>
                          <textarea
                            value={grFormData.motivo}
                            onChange={(e) => setGrFormData(prev => ({ ...prev, motivo: e.target.value }))}
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                        
                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <button
                            type="button"
                            onClick={() => setIsEditingGr(false)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                            disabled={savingGr}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveGestaoRisco}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            disabled={savingGr || !grFormData.empresa_id || !grFormData.status_id}
                          >
                            {savingGr ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Salvando...
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4" />
                                Salvar
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : grData ? (
                    <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
                      <div className="px-4 py-5 sm:px-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                          Informações de Gestão de Risco
                        </h3>
                      </div>
                      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:p-0">
                        <dl className="sm:divide-y sm:divide-gray-200 dark:sm:divide-gray-700">
                          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              Empresa
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                              {grData.empresa?.nome || 'Não informada'}
                            </dd>
                          </div>
                          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              Status
                            </dt>
                            <dd className="mt-1 text-sm sm:mt-0 sm:col-span-2">
                              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                grData.status?.status === 'Aprovado' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                                  : grData.status?.status === 'Reprovado'
                                    ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                                    : grData.status?.status === 'Pendente'
                                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200'
                                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                              }`}>
                                {grData.status?.status || 'Não informado'}
                              </span>
                            </dd>
                          </div>
                          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              Motivo
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                              {grData.motivo || 'Não informado'}
                            </dd>
                          </div>
                          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              Data de Atualização
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 sm:mt-0 sm:col-span-2">
                              {grData.updated_at ? formatDate(grData.updated_at) : 'Não informada'}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg p-6 text-center">
                      <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        Sem informações de gestão de risco
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Este motorista ainda não possui informações de gestão de risco cadastradas.
                      </p>
                      <button
                        onClick={() => setIsEditingGr(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar Informações
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {isEditModalOpen && motorista && (
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
    </div>
  );
};

export default UnifiedMotoristaModal;