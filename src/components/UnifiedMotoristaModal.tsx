import React, { useState, useRef, useEffect } from 'react';
import { X, User, MapPin, FileText, Camera, Loader2, ExternalLink, Upload, Save, ArrowLeft, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { formatCPF, formatPhone } from '../utils/format';
import DocumentUploadModal from './DocumentUploadModal';

interface UnifiedMotoristaModalProps {
  isOpen: boolean;
  onClose: () => void;
  motorista: any;
  onSuccess?: () => void;
}

const UnifiedMotoristaModal = ({ isOpen, onClose, motorista, onSuccess }: UnifiedMotoristaModalProps) => {
  const [activeTab, setActiveTab] = useState<'details' | 'documents' | 'helpers'>('details');
  const [loading, setLoading] = useState(true);
  const [endereco, setEndereco] = useState<any | null>(null);
  const [documento, setDocumento] = useState<any | null>(null);
  const [ajudantes, setAjudantes] = useState<any[]>([]);
  const [isDocumentUploadModalOpen, setIsDocumentUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState<{cnh: boolean, comprovante: boolean}>({
    cnh: false,
    comprovante: false
  });
  const [activeDocument, setActiveDocument] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && motorista) {
      fetchMotoristaDetails();
    }
  }, [isOpen, motorista]);

  const fetchMotoristaDetails = async () => {
    if (!motorista) return;
    
    try {
      setLoading(true);
      
      // Fetch motorista details
      const { data: motoristaData, error: motoristaError } = await supabase
        .from('motorista')
        .select('*')
        .eq('motorista_id', motorista.motorista_id)
        .single();
      
      if (motoristaError) throw motoristaError;
      
      // Fetch address - Fixed column name from motorista_id to id_motorista
      const { data: enderecoData, error: enderecoError } = await supabase
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
        .eq('id_motorista', motorista.motorista_id)
        .maybeSingle();
      
      if (enderecoError && enderecoError.code !== 'PGRST116') throw enderecoError;
      setEndereco(enderecoData);
      
      // Fetch documents
      const { data: documentoData, error: documentoError } = await supabase
        .from('documento_motorista')
        .select('*')
        .eq('motorista_id', motorista.motorista_id)
        .maybeSingle();
      
      if (documentoError && documentoError.code !== 'PGRST116') throw documentoError;
      setDocumento(documentoData);
      
      // Fetch ajudantes
      const { data: ajudantesData, error: ajudantesError } = await supabase
        .from('documento_ajudante')
        .select(`
          *,
          cnh_ajudante(*),
          rg_ajudante(*),
          end_ajudante(nr_end, ds_complemento_end, logradouro(logradouro, nr_cep, bairro(bairro, cidade(cidade, estado(sigla_estado)))))
        `)
        .eq('motorista_id', motorista.motorista_id);
      
      if (ajudantesError) throw ajudantesError;
      setAjudantes(ajudantesData || []);
      
    } catch (error) {
      console.error('Error fetching motorista details:', error);
      toast.error('Erro ao carregar dados do motorista');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'cnh' | 'comprovante') => {
    const file = e.target.files?.[0];
    if (!file || !motorista) return;
    
    try {
      setUploading(prev => ({ ...prev, [type]: true }));
      
      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${motorista.motorista_id}_${type}_${Date.now()}.${fileExt}`;
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('imagensdocs')
        .upload(fileName, file);
        
      if (error) throw error;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('imagensdocs')
        .getPublicUrl(fileName);
      
      // Update the appropriate document record
      if (documento) {
        // Update existing record
        const updateData = type === 'cnh' 
          ? { foto_cnh: publicUrl } 
          : { foto_comprovante_residencia: publicUrl };
        
        const { error: updateError } = await supabase
          .from('documento_motorista')
          .update(updateData)
          .eq('id_documento_motorista', documento.id_documento_motorista);
        
        if (updateError) throw updateError;
      } else {
        // Create new record
        const insertData = {
          motorista_id: motorista.motorista_id,
          foto_cnh: type === 'cnh' ? publicUrl : null,
          foto_comprovante_residencia: type === 'comprovante' ? publicUrl : null
        };
        
        const { error: insertError } = await supabase
          .from('documento_motorista')
          .insert(insertData);
        
        if (insertError) throw insertError;
      }
      
      // Update local state
      setDocumento(prev => ({
        ...prev,
        [type === 'cnh' ? 'foto_cnh' : 'foto_comprovante_residencia']: publicUrl
      }));
      
      toast.success('Documento enviado com sucesso');
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Erro ao enviar arquivo');
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const openDocumentInNewTab = (url: string | null) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const isPdf = (url: string | null) => url?.toLowerCase().endsWith('.pdf');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay background */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose}></div>
      
      {/* Modal container */}
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl max-w-5xl w-full shadow-xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {motorista?.nome || 'Detalhes do Motorista'}
                </h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">• {motorista?.cpf ? formatCPF(motorista.cpf) : ''}</span>
              </div>
              <div className="flex items-center gap-4">
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
              <nav className="-mb-px flex" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm flex items-center justify-center
                            ${activeTab === 'details'
                              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`}
                >
                  <User className="w-5 h-5 mr-2" />
                  Detalhes
                </button>
                <button
                  onClick={() => setActiveTab('documents')}
                  className={`w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm flex items-center justify-center
                            ${activeTab === 'documents'
                              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`}
                >
                  <FileText className="w-5 h-5 mr-2" />
                  Documentos
                </button>
                <button
                  onClick={() => setActiveTab('helpers')}
                  className={`w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm flex items-center justify-center
                            ${activeTab === 'helpers'
                              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`}
                >
                  <Users className="w-5 h-5 mr-2" />
                  Ajudantes
                </button>
              </nav>
            </div>

            {/* Content - Scrollable */}
            <div className="overflow-y-auto flex-1">
              <div className="p-6">
                {loading ? (
                  <div className="flex justify-center items-center py-12">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Details Tab */}
                    {activeTab === 'details' && (
                      <div className="space-y-6">
                        {/* Personal Information */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <User className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                            Informações Pessoais
                          </h3>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Nome</p>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white">{motorista?.nome}</p>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">CPF</p>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white">{motorista?.cpf ? formatCPF(motorista.cpf) : '-'}</p>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Data de Nascimento</p>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white">{motorista?.dt_nascimento ? motorista.dt_nascimento : '-'}</p>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</p>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white capitalize">{motorista?.st_cadastro?.replace('_', ' ') || '-'}</p>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Telefone</p>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white">{motorista?.telefone ? formatPhone(motorista.telefone.toString()) : 'Não informado'}</p>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</p>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white">{motorista?.email || 'Não informado'}</p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Address Information */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                            Endereço
                          </h3>
                          
                          {endereco ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Logradouro</p>
                                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                                  {endereco.logradouro?.logradouro || 'Não informado'}
                                </p>
                              </div>
                              
                              <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Número</p>
                                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                                  {endereco.nr_end || 'Não informado'}
                                </p>
                              </div>
                              
                              <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Complemento</p>
                                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                                  {endereco.ds_complemento_end || 'Não informado'}
                                </p>
                              </div>
                              
                              <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Bairro</p>
                                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                                  {endereco.logradouro?.bairro?.bairro || 'Não informado'}
                                </p>
                              </div>
                              
                              <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">CEP</p>
                                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                                  {endereco.logradouro?.nr_cep || 'Não informado'}
                                </p>
                              </div>
                              
                              <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Cidade/Estado</p>
                                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                                  {endereco.logradouro?.bairro?.cidade?.cidade || 'Não informada'}/{endereco.logradouro?.bairro?.cidade?.estado?.sigla_estado || '-'}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum endereço cadastrado</p>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Documents Tab */}
                    {activeTab === 'documents' && (
                      <div className="space-y-6">
                        <div className="flex justify-end">
                          <button
                            onClick={() => setIsDocumentUploadModalOpen(true)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                                     transition-colors flex items-center gap-2"
                          >
                            <Upload className="w-5 h-5" />
                            Gerenciar Documentos
                          </button>
                        </div>
                        
                        {/* CNH Document */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                            CNH
                          </h3>
                          
                          {documento?.foto_cnh ? (
                            <div className="relative aspect-[1.414] w-full max-w-md bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                              {isPdf(documento.foto_cnh) ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                  <FileText className="w-12 h-12 text-gray-400 mb-2" />
                                  <p className="text-sm text-gray-500 mb-4">Documento PDF</p>
                                  <button
                                    onClick={() => openDocumentInNewTab(documento.foto_cnh)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"
                                  >
                                    <ExternalLink size={16} />
                                    Abrir PDF
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
                            <div className="relative">
                              <input
                                type="file"
                                id="file-cnh"
                                onChange={(e) => handleFileUpload(e, 'cnh')}
                                className="sr-only"
                                ref={fileInputRef}
                                accept="image/jpeg,image/png,image/jpg,application/pdf"
                              />
                              <label
                                htmlFor="file-cnh"
                                className="flex flex-col items-center justify-center w-full max-w-md aspect-[1.414] border-2 border-dashed rounded-lg cursor-pointer
                                          border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50
                                          hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                              >
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                  {uploading.cnh ? (
                                    <Loader2 className="w-10 h-10 text-gray-400 animate-spin mb-4" />
                                  ) : (
                                    <Camera className="w-10 h-10 text-gray-400 mb-4" />
                                  )}
                                  <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                                    <span className="font-semibold">Clique para enviar</span> ou arraste e solte
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    JPEG, PNG ou PDF (máx. 15MB)
                                  </p>
                                </div>
                              </label>
                            </div>
                          )}
                        </div>
                        
                        {/* Comprovante de Residência */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                            Comprovante de Residência
                          </h3>
                          
                          {documento?.foto_comprovante_residencia ? (
                            <div className="relative aspect-[1.414] w-full max-w-md bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                              {isPdf(documento.foto_comprovante_residencia) ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                  <FileText className="w-12 h-12 text-gray-400 mb-2" />
                                  <p className="text-sm text-gray-500 mb-4">Documento PDF</p>
                                  <button
                                    onClick={() => openDocumentInNewTab(documento.foto_comprovante_residencia)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"
                                  >
                                    <ExternalLink size={16} />
                                    Abrir PDF
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
                            <div className="relative">
                              <input
                                type="file"
                                id="file-comprovante"
                                onChange={(e) => handleFileUpload(e, 'comprovante')}
                                className="sr-only"
                                ref={fileInputRef}
                                accept="image/jpeg,image/png,image/jpg,application/pdf"
                              />
                              <label
                                htmlFor="file-comprovante"
                                className="flex flex-col items-center justify-center w-full max-w-md aspect-[1.414] border-2 border-dashed rounded-lg cursor-pointer
                                          border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50
                                          hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                              >
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                  {uploading.comprovante ? (
                                    <Loader2 className="w-10 h-10 text-gray-400 animate-spin mb-4" />
                                  ) : (
                                    <Camera className="w-10 h-10 text-gray-400 mb-4" />
                                  )}
                                  <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                                    <span className="font-semibold">Clique para enviar</span> ou arraste e solte
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    JPEG, PNG ou PDF (máx. 15MB)
                                  </p>
                                </div>
                              </label>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Helpers Tab */}
                    {activeTab === 'helpers' && (
                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                            <Users className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                            Ajudantes
                          </h3>
                        </div>
                        
                        {ajudantes.length > 0 ? (
                          <div className="grid grid-cols-1 gap-4">
                            {ajudantes.map((ajudante) => (
                              <div 
                                key={ajudante.id_ajudante}
                                className="bg-white dark:bg-gray-700 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-600"
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h4 className="text-base font-medium text-gray-900 dark:text-white">
                                      {ajudante.nome}
                                    </h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                      CPF: {formatCPF(ajudante.cpf)}
                                    </p>
                                    {ajudante.telefone && (
                                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        Telefone: {formatPhone(ajudante.telefone)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-500 dark:text-gray-400">
                              Nenhum ajudante cadastrado
                            </p>
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
      
      {/* Document Upload Modal */}
      <DocumentUploadModal
        isOpen={isDocumentUploadModalOpen}
        onClose={() => setIsDocumentUploadModalOpen(false)}
        motorista_id={motorista?.motorista_id}
        nome={motorista?.nome || ''}
        onUploadSuccess={() => {
          fetchMotoristaDetails();
          setIsDocumentUploadModalOpen(false);
        }}
      />
    </div>
  );
};

export default UnifiedMotoristaModal;