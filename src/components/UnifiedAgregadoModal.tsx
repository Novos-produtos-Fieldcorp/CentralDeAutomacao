import React, { useState, useEffect } from 'react';
import { X, Truck, User, MapPin, Phone, Mail, Calendar, CreditCard, FileText, Info, Camera, CheckCircle2, XCircle, ExternalLink, Edit2, Home, Upload, Loader2, Tabs, TabsList, TabsTrigger, TabsContent } from 'lucide-react';
import type { DocumentoMotorista, Veiculo, DocumentoVeiculo, Motorista, DocumentoAjudante, PessoaFisicaDonoVeiculo, PessoaJuridicaDonoVeiculo } from '../types/database';
import { formatCPF, formatPhone, formatDate, formatCEP } from '../utils/format';
import DocumentoMotoristaForm from './DocumentoMotoristaForm';
import DocumentUploader from './DocumentUploader';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

interface UnifiedAgregadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  agregado?: Motorista | null;
  onSuccess?: () => void;
}

const UnifiedAgregadoModal = ({ isOpen, onClose, agregado, onSuccess }: UnifiedAgregadoModalProps) => {
  const [activeTab, setActiveTab] = useState<'info' | 'docs' | 'vehicle'>('info');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeDocument, setActiveDocument] = useState<string | null>(null);
  
  // Data states
  const [documento, setDocumento] = useState<DocumentoMotorista | null>(null);
  const [veiculo, setVeiculo] = useState<(Veiculo & {
    documento_veiculo: (DocumentoVeiculo & {
      pessoa_fisica_dono_veiculo?: PessoaFisicaDonoVeiculo;
      pessoa_juridica_dono_veiculo?: PessoaJuridicaDonoVeiculo;
    })[];
  }) | null>(null);
  const [endereco, setEndereco] = useState<{
    logradouro?: {
      logradouro?: string;
      nr_cep?: string;
      bairro?: {
        bairro?: string;
        cidade?: {
          cidade?: string;
          estado?: {
            sigla_estado?: string;
          };
        };
      };
    };
    nr_end?: number;
    ds_complemento_end?: string;
  } | null>(null);
  const [documento_ajudante, setDocumentoAjudante] = useState<DocumentoAjudante | null>(null);
  
  // Document upload states
  const [uploadingCNH, setUploadingCNH] = useState(false);
  const [uploadingComprovante, setUploadingComprovante] = useState(false);
  const [uploadingCRV, setUploadingCRV] = useState(false);
  
  // Edit mode states
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editFormData, setEditFormData] = useState({
    nome: '',
    cpf: '',
    email: '',
    telefone: '',
    dt_nascimento: '',
    genero: '',
    st_cadastro: ''
  });

  useEffect(() => {
    if (isOpen && agregado) {
      fetchAgregadoDetails();
      
      // Initialize edit form data
      setEditFormData({
        nome: agregado.nome || '',
        cpf: agregado.cpf || '',
        email: agregado.email || '',
        telefone: agregado.telefone?.toString() || '',
        dt_nascimento: agregado.dt_nascimento ? new Date(agregado.dt_nascimento).toISOString().split('T')[0] : '',
        genero: agregado.genero || '',
        st_cadastro: agregado.st_cadastro || 'cadastrado'
      });
    }
  }, [isOpen, agregado]);

  const fetchAgregadoDetails = async () => {
    if (!agregado) return;
    
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [documentoResponse, enderecoResponse, veiculoResponse, ajudanteResponse] = await Promise.all([
        // Fetch documento_motorista
        supabase
          .from('documento_motorista')
          .select('*')
          .eq('motorista_id', agregado.motorista_id)
          .maybeSingle(),
          
        // Fetch endereco
        supabase
          .from('end_motorista')
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
          .eq('id_motorista', agregado.motorista_id)
          .maybeSingle(),
          
        // Fetch veiculo with documento_veiculo
        supabase
          .from('veiculo')
          .select(`
            *,
            documento_veiculo (
              *,
              pessoa_fisica_dono_veiculo (*),
              pessoa_juridica_dono_veiculo (*)
            )
          `)
          .eq('motorista_id', agregado.motorista_id)
          .eq('status_veiculo', true)
          .maybeSingle(),
          
        // Fetch documento_ajudante
        supabase
          .from('documento_ajudante')
          .select(`
            *,
            cnh_ajudante (*)
          `)
          .eq('veiculo_id', agregado.veiculo?.[0]?.veiculo_id)
          .maybeSingle()
      ]);

      // Handle errors
      if (documentoResponse.error && documentoResponse.error.code !== 'PGRST116') {
        throw documentoResponse.error;
      }
      if (enderecoResponse.error && enderecoResponse.error.code !== 'PGRST116') {
        throw enderecoResponse.error;
      }
      if (veiculoResponse.error && veiculoResponse.error.code !== 'PGRST116') {
        throw veiculoResponse.error;
      }
      if (ajudanteResponse.error && ajudanteResponse.error.code !== 'PGRST116') {
        throw ajudanteResponse.error;
      }

      // Set data states
      setDocumento(documentoResponse.data);
      setEndereco(enderecoResponse.data);
      setVeiculo(veiculoResponse.data);
      setDocumentoAjudante(ajudanteResponse.data);
      
    } catch (error) {
      console.error('Erro ao carregar dados do agregado:', error);
      toast.error('Erro ao carregar dados do agregado');
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

  const handleDocumentUpload = async (file: File, type: 'cnh' | 'comprovante' | 'crv') => {
    if (!agregado || !file) return;
    
    try {
      // Set loading state based on document type
      if (type === 'cnh') setUploadingCNH(true);
      if (type === 'comprovante') setUploadingComprovante(true);
      if (type === 'crv') setUploadingCRV(true);
      
      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${agregado.motorista_id}_${type}_${Date.now()}.${fileExt}`;
      
      // For PDF files, we need to convert to base64 and then to blob to ensure proper MIME type
      let fileToUpload = file;
      if (fileExt?.toLowerCase() === 'pdf') {
        // Convert to base64 and back to blob to ensure proper MIME type
        const reader = new FileReader();
        const dataPromise = new Promise<Blob>((resolve, reject) => {
          reader.onload = () => {
            try {
              // Create a new blob with the correct MIME type
              const blob = new Blob([reader.result as ArrayBuffer], { type: 'application/pdf' });
              resolve(blob);
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = reject;
          reader.readAsArrayBuffer(file);
        });
        
        fileToUpload = await dataPromise;
      }

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('imagensdocs')
        .upload(fileName, fileToUpload, {
          cacheControl: '3600',
          upsert: true,
          contentType: fileExt?.toLowerCase() === 'pdf' ? 'application/pdf' : undefined
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('imagensdocs')
        .getPublicUrl(fileName);

      // Update the appropriate document record
      if (type === 'cnh' || type === 'comprovante') {
        // Update documento_motorista
        const updateData: any = {};
        if (type === 'cnh') updateData.foto_cnh = publicUrl;
        if (type === 'comprovante') updateData.foto_comprovante_residencia = publicUrl;
        
        if (documento) {
          // Update existing record
          const { error } = await supabase
            .from('documento_motorista')
            .update(updateData)
            .eq('id_documento_motorista', documento.id_documento_motorista);
            
          if (error) throw error;
        } else {
          // Create new record
          const { error } = await supabase
            .from('documento_motorista')
            .insert({ 
              motorista_id: agregado.motorista_id,
              ...updateData
            });
            
          if (error) throw error;
        }
        
        // Update local state
        setDocumento(prev => prev ? { ...prev, ...updateData } : { motorista_id: agregado.motorista_id, ...updateData } as DocumentoMotorista);
      } else if (type === 'crv' && veiculo) {
        // Update documento_veiculo
        if (veiculo.documento_veiculo && veiculo.documento_veiculo.length > 0) {
          // Update existing record
          const { error } = await supabase
            .from('documento_veiculo')
            .update({ foto_crv: publicUrl })
            .eq('id_documento_veiculo', veiculo.documento_veiculo[0].id_documento_veiculo);
            
          if (error) throw error;
        } else {
          // Create new record
          const { error } = await supabase
            .from('documento_veiculo')
            .insert({ 
              veiculo_id: veiculo.veiculo_id,
              foto_crv: publicUrl
            });
            
          if (error) throw error;
        }
        
        // Update local state
        setVeiculo(prev => {
          if (!prev) return null;
          
          const updatedDocumentos = prev.documento_veiculo && prev.documento_veiculo.length > 0
            ? prev.documento_veiculo.map(doc => ({ ...doc, foto_crv: publicUrl }))
            : [{ id_documento_veiculo: 0, veiculo_id: prev.veiculo_id, foto_crv: publicUrl } as DocumentoVeiculo];
            
          return {
            ...prev,
            documento_veiculo: updatedDocumentos
          };
        });
      }
      
      toast.success('Documento enviado com sucesso');
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error(`Erro ao enviar ${type}:`, error);
      toast.error(`Erro ao enviar ${type === 'cnh' ? 'CNH' : type === 'comprovante' ? 'comprovante de residência' : 'CRV'}`);
    } finally {
      // Reset loading state
      if (type === 'cnh') setUploadingCNH(false);
      if (type === 'comprovante') setUploadingComprovante(false);
      if (type === 'crv') setUploadingCRV(false);
    }
  };

  const handleSaveInfo = async () => {
    if (!agregado) return;
    
    try {
      setSubmitting(true);
      
      // Update motorista record
      const { error } = await supabase
        .from('motorista')
        .update(editFormData)
        .eq('motorista_id', agregado.motorista_id);
        
      if (error) throw error;
      
      toast.success('Informações atualizadas com sucesso');
      setIsEditingInfo(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Erro ao atualizar informações:', error);
      toast.error('Erro ao atualizar informações');
    } finally {
      setSubmitting(false);
    }
  };

  const statusOptions = [
    { value: 'cadastrado', label: 'Cadastrado' },
    { value: 'qualificado', label: 'Qualificado' },
    { value: 'documentacao', label: 'Documentação' },
    { value: 'contrato_enviado', label: 'Contrato Enviado' },
    { value: 'contratado', label: 'Contratado' },
    { value: 'repescagem', label: 'Repescagem' },
    { value: 'rejeitado', label: 'Rejeitado' }
  ];

  if (!isOpen || !agregado) return null;

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
                      {agregado.nome}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Agregado • {formatCPF(agregado.cpf)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              
              {/* Tabs */}
              <div className="px-6 pb-0">
                <div className="flex space-x-4 border-b border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setActiveTab('info')}
                    className={`py-3 px-1 font-medium text-sm border-b-2 transition-colors ${
                      activeTab === 'info' 
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <User size={18} />
                      <span>Informações</span>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setActiveTab('docs')}
                    className={`py-3 px-1 font-medium text-sm border-b-2 transition-colors ${
                      activeTab === 'docs' 
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText size={18} />
                      <span>Documentos</span>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setActiveTab('vehicle')}
                    className={`py-3 px-1 font-medium text-sm border-b-2 transition-colors ${
                      activeTab === 'vehicle' 
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Truck size={18} />
                      <span>Veículo</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Informações Pessoais Tab */}
                  {activeTab === 'info' && (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <User className="w-5 h-5 text-gray-400" />
                          Informações Pessoais
                        </h3>
                        {!isEditingInfo ? (
                          <button
                            onClick={() => setIsEditingInfo(true)}
                            className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800/30 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-1.5"
                          >
                            <Edit2 size={14} />
                            Editar
                          </button>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setIsEditingInfo(false)}
                              className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 dark:text-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700 transition-colors"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={handleSaveInfo}
                              disabled={submitting}
                              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                            >
                              {submitting ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  Salvando...
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 size={14} />
                                  Salvar
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {isEditingInfo ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Nome
                            </label>
                            <input
                              type="text"
                              value={editFormData.nome}
                              onChange={(e) => setEditFormData(prev => ({ ...prev, nome: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              CPF
                            </label>
                            <input
                              type="text"
                              value={editFormData.cpf}
                              onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, '');
                                if (value.length <= 11) {
                                  setEditFormData(prev => ({ ...prev, cpf: value }));
                                }
                              }}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              maxLength={11}
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Email
                            </label>
                            <input
                              type="email"
                              value={editFormData.email}
                              onChange={(e) => setEditFormData(prev => ({ ...prev, email: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Telefone
                            </label>
                            <input
                              type="tel"
                              value={editFormData.telefone}
                              onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, '');
                                setEditFormData(prev => ({ ...prev, telefone: value }));
                              }}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Data de Nascimento
                            </label>
                            <input
                              type="date"
                              value={editFormData.dt_nascimento}
                              onChange={(e) => setEditFormData(prev => ({ ...prev, dt_nascimento: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Status
                            </label>
                            <select
                              value={editFormData.st_cadastro}
                              onChange={(e) => setEditFormData(prev => ({ ...prev, st_cadastro: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            >
                              {statusOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div className="overflow-hidden">
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Nome</div>
                              <div className="text-base text-gray-900 dark:text-white break-words">
                                {agregado.nome}
                              </div>
                            </div>
                            
                            <div className="overflow-hidden">
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">CPF</div>
                              <div className="text-base text-gray-900 dark:text-white break-words">
                                {formatCPF(agregado.cpf)}
                              </div>
                            </div>
                            
                            <div className="overflow-hidden">
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Data de Nascimento</div>
                              <div className="text-base text-gray-900 dark:text-white break-words">
                                {agregado.dt_nascimento ? formatDate(agregado.dt_nascimento) : 'Não informada'}
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            <div className="overflow-hidden">
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Telefone</div>
                              <div className="text-base text-gray-900 dark:text-white break-words">
                                {agregado.telefone ? formatPhone(agregado.telefone.toString()) : 'Não informado'}
                              </div>
                            </div>
                            
                            <div className="overflow-hidden">
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</div>
                              <div className="text-base text-gray-900 dark:text-white break-words">
                                {agregado.email || 'Não informado'}
                              </div>
                            </div>
                            
                            <div className="overflow-hidden">
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</div>
                              <div className="text-base text-gray-900 dark:text-white break-words capitalize">
                                {agregado.st_cadastro.replace('_', ' ')}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Endereço */}
                      <div className="mt-8">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-gray-400" />
                          Endereço
                        </h3>
                        
                        <div className="space-y-4">
                          <div className="overflow-hidden">
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Logradouro</div>
                            <div className="text-base text-gray-900 dark:text-white break-words">
                              {endereco?.logradouro?.logradouro ? 
                                `${endereco.logradouro.logradouro}, ${endereco.nr_end || 'S/N'}` : 
                                'Não informado'
                              }
                            </div>
                          </div>
                          
                          <div className="overflow-hidden">
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Complemento</div>
                            <div className="text-base text-gray-900 dark:text-white break-words">
                              {endereco?.ds_complemento_end || 'Não informado'}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="overflow-hidden">
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Bairro</div>
                              <div className="text-base text-gray-900 dark:text-white break-words">
                                {endereco?.logradouro?.bairro?.bairro || 'Não informado'}
                              </div>
                            </div>
                            
                            <div className="overflow-hidden">
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">CEP</div>
                              <div className="text-base text-gray-900 dark:text-white break-words">
                                {endereco?.logradouro?.nr_cep ? formatCEP(endereco.logradouro.nr_cep) : 'Não informado'}
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="overflow-hidden">
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Cidade</div>
                              <div className="text-base text-gray-900 dark:text-white break-words">
                                {endereco?.logradouro?.bairro?.cidade?.cidade || 'Não informada'}
                              </div>
                            </div>
                            
                            <div className="overflow-hidden">
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Estado</div>
                              <div className="text-base text-gray-900 dark:text-white break-words">
                                {endereco?.logradouro?.bairro?.cidade?.estado?.sigla_estado || 'Não informado'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Documentos Tab */}
                  {activeTab === 'docs' && (
                    <div className="space-y-8">
                      {/* CNH Section */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-gray-400" />
                            Carteira Nacional de Habilitação (CNH)
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
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Número da CNH</div>
                                <div className="text-base text-gray-900 dark:text-white">
                                  {documento?.nr_registro_cnh || 'Não informado'}
                                </div>
                              </div>
                              
                              <div>
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Categoria</div>
                                <div className="text-base text-gray-900 dark:text-white">
                                  {documento?.categoria_cnh || 'Não informada'}
                                </div>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Validade</div>
                                <div className="text-base text-gray-900 dark:text-white">
                                  {documento?.validade_cnh ? formatDate(documento.validade_cnh) : 'Não informada'}
                                </div>
                              </div>
                              
                              <div>
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">UF</div>
                                <div className="text-base text-gray-900 dark:text-white">
                                  {documento?.uf_cnh || 'Não informada'}
                                </div>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-4">
                              <div>
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Nome da Mãe</div>
                                <div className="text-base text-gray-900 dark:text-white">
                                  {documento?.nome_mae || 'Não informado'}
                                </div>
                              </div>
                              
                              <div>
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Nome do Pai</div>
                                <div className="text-base text-gray-900 dark:text-white">
                                  {documento?.nome_pai || 'Não informado'}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div>
                            <div className="mb-2">
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                                CNH Digital
                              </div>
                              
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
                                      Faça o upload da CNH para visualizá-la aqui
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            <div className="mt-4">
                              <div className="relative">
                                <input
                                  type="file"
                                  id="file-cnh"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleDocumentUpload(file, 'cnh');
                                  }}
                                  className="sr-only"
                                  accept="image/jpeg,image/png,image/jpg,application/pdf"
                                  disabled={uploadingCNH}
                                />
                                <label
                                  htmlFor="file-cnh"
                                  className={`flex items-center justify-center w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors ${
                                    uploadingCNH ? 'opacity-70 cursor-not-allowed' : ''
                                  }`}
                                >
                                  {uploadingCNH ? (
                                    <>
                                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                      Enviando...
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="w-5 h-5 mr-2" />
                                      Enviar CNH
                                    </>
                                  )}
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Comprovante de Residência */}
                      <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <Home className="w-5 h-5 text-gray-400" />
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
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <div className="mb-2">
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                                Comprovante Digital
                              </div>
                              
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
                                      Faça o upload do comprovante para visualizá-lo aqui
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            <div className="mt-4">
                              <div className="relative">
                                <input
                                  type="file"
                                  id="file-comprovante"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleDocumentUpload(file, 'comprovante');
                                  }}
                                  className="sr-only"
                                  accept="image/jpeg,image/png,image/jpg,application/pdf"
                                  disabled={uploadingComprovante}
                                />
                                <label
                                  htmlFor="file-comprovante"
                                  className={`flex items-center justify-center w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors ${
                                    uploadingComprovante ? 'opacity-70 cursor-not-allowed' : ''
                                  }`}
                                >
                                  {uploadingComprovante ? (
                                    <>
                                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                      Enviando...
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="w-5 h-5 mr-2" />
                                      Enviar Comprovante
                                    </>
                                  )}
                                </label>
                              </div>
                            </div>
                          </div>
                          
                          <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                              Endereço Registrado
                            </h4>
                            
                            <div className="space-y-2">
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                <span className="font-medium">Logradouro:</span> {endereco?.logradouro?.logradouro ? 
                                  `${endereco.logradouro.logradouro}, ${endereco.nr_end || 'S/N'}` : 
                                  'Não informado'
                                }
                              </p>
                              
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                <span className="font-medium">Complemento:</span> {endereco?.ds_complemento_end || 'Não informado'}
                              </p>
                              
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                <span className="font-medium">Bairro:</span> {endereco?.logradouro?.bairro?.bairro || 'Não informado'}
                              </p>
                              
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                <span className="font-medium">CEP:</span> {endereco?.logradouro?.nr_cep ? formatCEP(endereco.logradouro.nr_cep) : 'Não informado'}
                              </p>
                              
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                <span className="font-medium">Cidade/UF:</span> {
                                  endereco?.logradouro?.bairro?.cidade?.cidade && endereco?.logradouro?.bairro?.cidade?.estado?.sigla_estado ? 
                                  `${endereco.logradouro.bairro.cidade.cidade}/${endereco.logradouro.bairro.cidade.estado.sigla_estado}` : 
                                  'Não informado'
                                }
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Veículo Tab */}
                  {activeTab === 'vehicle' && (
                    <div className="space-y-8">
                      {/* Informações do Veículo */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <Truck className="w-5 h-5 text-gray-400" />
                          Informações do Veículo
                        </h3>
                        
                        {veiculo ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <div className="overflow-hidden">
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Placa</div>
                                <div className="text-lg font-semibold text-gray-900 dark:text-white uppercase">
                                  {veiculo.placa}
                                </div>
                              </div>
                              
                              <div className="overflow-hidden">
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Marca/Modelo</div>
                                <div className="text-base text-gray-900 dark:text-white">
                                  {veiculo.marca} {veiculo.tipo}
                                </div>
                              </div>
                              
                              <div className="overflow-hidden">
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Ano</div>
                                <div className="text-base text-gray-900 dark:text-white">
                                  {veiculo.ano || 'Não informado'}
                                </div>
                              </div>
                              
                              <div className="overflow-hidden">
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Cor</div>
                                <div className="text-base text-gray-900 dark:text-white">
                                  {veiculo.cor || 'Não informada'}
                                </div>
                              </div>
                            </div>
                            
                            <div className="space-y-4">
                              <div className="overflow-hidden">
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Tipologia</div>
                                <div className="text-base text-gray-900 dark:text-white uppercase">
                                  {veiculo.tipologia || 'Não informada'}
                                </div>
                              </div>
                              
                              <div className="overflow-hidden">
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Combustível</div>
                                <div className="text-base text-gray-900 dark:text-white">
                                  {veiculo.combustivel || 'Não informado'}
                                </div>
                              </div>
                              
                              <div className="overflow-hidden">
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Peso</div>
                                <div className="text-base text-gray-900 dark:text-white">
                                  {veiculo.peso ? `${veiculo.peso} kg` : 'Não informado'}
                                </div>
                              </div>
                              
                              <div className="overflow-hidden">
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Cubagem</div>
                                <div className="text-base text-gray-900 dark:text-white">
                                  {veiculo.cubagem ? `${veiculo.cubagem} m³` : 'Não informada'}
                                </div>
                              </div>
                            </div>
                            
                            <div className="md:col-span-2">
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Rastreador</div>
                              <div className="flex items-center gap-2 mt-1">
                                {veiculo.possui_rastreador ? (
                                  <>
                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                    <span className="text-base text-gray-900 dark:text-white">
                                      Instalado - {veiculo.marca_rastreador || 'Marca não informada'}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-5 h-5 text-red-500" />
                                    <span className="text-base text-gray-900 dark:text-white">
                                      Não instalado
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            
                            {/* Vehicle Owner Information */}
                            <div className="md:col-span-2 overflow-hidden">
                              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Proprietário do Veículo</div>
                              <div className="text-base text-gray-900 dark:text-white break-words">
                                {veiculo.documento_veiculo?.[0]?.pessoa_fisica_dono_veiculo ? (
                                  <>
                                    <div>{veiculo.documento_veiculo[0].pessoa_fisica_dono_veiculo.nome_dono_veiculo}</div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                      Pessoa Física {veiculo.documento_veiculo[0].pessoa_fisica_dono_veiculo.nr_rg ? `• RG: ${veiculo.documento_veiculo[0].pessoa_fisica_dono_veiculo.nr_rg}` : ''}
                                    </div>
                                  </>
                                ) : veiculo.documento_veiculo?.[0]?.pessoa_juridica_dono_veiculo ? (
                                  <>
                                    <div>{veiculo.documento_veiculo[0].pessoa_juridica_dono_veiculo.razao_social}</div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                      Pessoa Jurídica {veiculo.documento_veiculo[0].pessoa_juridica_dono_veiculo.cnpj ? `• CNPJ: ${veiculo.documento_veiculo[0].pessoa_juridica_dono_veiculo.cnpj}` : ''}
                                      {veiculo.documento_veiculo[0].pessoa_juridica_dono_veiculo.inscricao_estadual ? ` • IE: ${veiculo.documento_veiculo[0].pessoa_juridica_dono_veiculo.inscricao_estadual}` : ''}
                                    </div>
                                  </>
                                ) : (
                                  'Não informado'
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-8">
                            <Truck className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
                            <p className="text-gray-500 dark:text-gray-400 text-center">
                              Nenhum veículo associado a este agregado
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {/* CRV Document */}
                      {veiculo && (
                        <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                              <FileText className="w-5 h-5 text-gray-400" />
                              CRV Digital
                            </h3>
                            {veiculo.documento_veiculo?.[0]?.foto_crv && (
                              <button
                                onClick={() => openDocumentInNewTab(veiculo.documento_veiculo[0].foto_crv)}
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-sm"
                              >
                                <ExternalLink size={16} />
                                Abrir em nova aba
                              </button>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              {veiculo.documento_veiculo?.[0]?.foto_crv ? (
                                <div className="relative aspect-[1.414] w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                                  {isPdf(veiculo.documento_veiculo[0].foto_crv) ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                      <FileText className="w-12 h-12 text-gray-400 mb-2" />
                                      <p className="text-sm text-gray-500 mb-4">Documento PDF</p>
                                      <button
                                        onClick={() => setActiveDocument(veiculo.documento_veiculo[0].foto_crv)}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"
                                      >
                                        <FileText size={16} />
                                        Visualizar PDF
                                      </button>
                                    </div>
                                  ) : (
                                    <img
                                      src={veiculo.documento_veiculo[0].foto_crv}
                                      alt="CRV do veículo"
                                      className="absolute inset-0 w-full h-full object-contain cursor-pointer"
                                      onClick={() => setActiveDocument(veiculo.documento_veiculo[0].foto_crv)}
                                    />
                                  )}
                                </div>
                              ) : (
                                <div className="aspect-[1.414] w-full flex flex-col items-center justify-center gap-3 bg-gray-100 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                                  <Camera className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                                  <div className="text-center">
                                    <p className="text-gray-500 dark:text-gray-400 font-medium">CRV não cadastrado</p>
                                    <p className="text-sm text-gray-400 dark:text-gray-500">
                                      Faça o upload do CRV para visualizá-lo aqui
                                    </p>
                                  </div>
                                </div>
                              )}
                              
                              <div className="mt-4">
                                <div className="relative">
                                  <input
                                    type="file"
                                    id="file-crv"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleDocumentUpload(file, 'crv');
                                    }}
                                    className="sr-only"
                                    accept="image/jpeg,image/png,image/jpg,application/pdf"
                                    disabled={uploadingCRV}
                                  />
                                  <label
                                    htmlFor="file-crv"
                                    className={`flex items-center justify-center w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors ${
                                      uploadingCRV ? 'opacity-70 cursor-not-allowed' : ''
                                    }`}
                                  >
                                    {uploadingCRV ? (
                                      <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Enviando...
                                      </>
                                    ) : (
                                      <>
                                        <Upload className="w-5 h-5 mr-2" />
                                        Enviar CRV
                                      </>
                                    )}
                                  </label>
                                </div>
                              </div>
                            </div>
                            
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                Informações do Veículo
                              </h4>
                              
                              <div className="space-y-2">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  <span className="font-medium">Placa:</span> {veiculo.placa.toUpperCase()}
                                </p>
                                
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  <span className="font-medium">Marca/Modelo:</span> {veiculo.marca} {veiculo.tipo}
                                </p>
                                
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  <span className="font-medium">Ano:</span> {veiculo.ano || 'Não informado'}
                                </p>
                                
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  <span className="font-medium">Tipologia:</span> {veiculo.tipologia || 'Não informada'}
                                </p>
                                
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  <span className="font-medium">Combustível:</span> {veiculo.combustivel || 'Não informado'}
                                </p>
                                
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  <span className="font-medium">Rastreador:</span> {veiculo.possui_rastreador ? 'Sim' : 'Não'}
                                  {veiculo.possui_rastreador && veiculo.marca_rastreador && ` (${veiculo.marca_rastreador})`}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Helper Information */}
                      {documento_ajudante && (
                        <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <User className="w-5 h-5 text-gray-400" />
                            Informações do Ajudante
                          </h3>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <div className="overflow-hidden">
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Nome</div>
                                <div className="text-base text-gray-900 dark:text-white">
                                  {documento_ajudante.nome || 'Não informado'}
                                </div>
                              </div>
                              
                              <div className="overflow-hidden">
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">CPF</div>
                                <div className="text-base text-gray-900 dark:text-white">
                                  {documento_ajudante.cpf ? formatCPF(documento_ajudante.cpf.toString()) : 'Não informado'}
                                </div>
                              </div>
                            </div>
                            
                            {/* CNH do Ajudante */}
                            {documento_ajudante.cnh_ajudante && documento_ajudante.cnh_ajudante.length > 0 && (
                              <div className="space-y-4">
                                <div className="overflow-hidden">
                                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Número da CNH</div>
                                  <div className="text-base text-gray-900 dark:text-white">
                                    {documento_ajudante.cnh_ajudante[0].nr_registro || 'Não informado'}
                                  </div>
                                </div>
                                
                                <div className="overflow-hidden">
                                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Categoria</div>
                                  <div className="text-base text-gray-900 dark:text-white">
                                    {documento_ajudante.cnh_ajudante[0].categoria || 'Não informada'}
                                  </div>
                                </div>
                                
                                {documento_ajudante.cnh_ajudante[0].foto_cnh && (
                                  <div className="mt-2">
                                    <button
                                      onClick={() => setActiveDocument(documento_ajudante.cnh_ajudante[0].foto_cnh)}
                                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-sm"
                                    >
                                      <FileText size={14} />
                                      Ver CNH do Ajudante
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      
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