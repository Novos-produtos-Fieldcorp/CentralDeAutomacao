import React, { useState, useRef, useEffect } from 'react';
import { X, User, MapPin, PenTool as Tool, FileText, CheckCircle2, XCircle, Camera, Loader2, ExternalLink, Upload, Phone, Mail, Calendar, CreditCard, Info, UserCircle, Home, Edit2, Save, Plus, Trash2, FilePen } from 'lucide-react';
import type { DocumentoMotorista, Veiculo, DocumentoVeiculo, Motorista, PessoaFisicaDonoVeiculo, PessoaJuridicaDonoVeiculo } from '../types/database';
import { formatCPF, formatPhone, formatDate, formatCEP } from '../utils/format';
import DocumentoMotoristaForm from './DocumentoMotoristaForm';
import DocumentUploader from './DocumentUploader';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import EditMotoristaModal from './EditMotoristaModal';
import AddAjudanteModal from './AddAjudanteModal';
import EditAjudanteModal from './EditAjudanteModal';

interface UnifiedMotoristaModalProps {
  isOpen: boolean;
  onClose: () => void;
  motorista?: Motorista | null;
  onSuccess?: () => void;
}

const UnifiedMotoristaModal = ({ isOpen, onClose, motorista, onSuccess }: UnifiedMotoristaModalProps) => {
  const [activeTab, setActiveTab] = useState<'details' | 'documents' | 'ajudantes'>('details');
  const [loading, setLoading] = useState(true);
  const [documento, setDocumento] = useState<DocumentoMotorista | null>(null);
  const [endereco, setEndereco] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDocumentFormOpen, setIsDocumentFormOpen] = useState(false);
  const [activeDocument, setActiveDocument] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [motoristaData, setMotoristaData] = useState<Motorista | null>(null);
  const [ajudantes, setAjudantes] = useState<any[]>([]);
  const [isAddAjudanteModalOpen, setIsAddAjudanteModalOpen] = useState(false);
  const [isEditAjudanteModalOpen, setIsEditAjudanteModalOpen] = useState(false);
  const [selectedAjudanteId, setSelectedAjudanteId] = useState<number | null>(null);
  const [deletingAjudante, setDeletingAjudante] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && motorista) {
      setMotoristaData(motorista);
      fetchMotoristaDetails();
    }
  }, [isOpen, motorista]);

  const fetchMotoristaDetails = async () => {
    if (!motorista) return;
    
    try {
      setLoading(true);
      
      // Fetch documento_motorista
      const { data: documentoData, error: documentoError } = await supabase
        .from('documento_motorista')
        .select('*')
        .eq('motorista_id', motorista.motorista_id)
        .maybeSingle();

      if (documentoError && documentoError.code !== 'PGRST116') {
        throw documentoError;
      }

      setDocumento(documentoData);

      // Fetch endereco
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

      if (enderecoError && enderecoError.code !== 'PGRST116') {
        throw enderecoError;
      }

      setEndereco(enderecoData);
      
      // Fetch ajudantes if they exist
      const { data: ajudantesData, error: ajudantesError } = await supabase
        .from('documento_ajudante')
        .select(`
          *,
          cnh_ajudante(*),
          rg_ajudante(*),
          end_ajudante(
            nr_end,
            ds_complemento_end,
            logradouro(
              logradouro,
              nr_cep,
              bairro(
                bairro,
                cidade(
                  cidade,
                  estado(sigla_estado)
                )
              )
            )
          )
        `)
        .eq('motorista_id', motorista.motorista_id);
        
      if (ajudantesError && ajudantesError.code !== 'PGRST116') {
        throw ajudantesError;
      }
      
      setAjudantes(ajudantesData || []);
      
      // Fetch updated motorista data
      const { data: updatedMotorista, error: motoristaError } = await supabase
        .from('motorista')
        .select('*')
        .eq('motorista_id', motorista.motorista_id)
        .single();
        
      if (motoristaError) {
        throw motoristaError;
      }
      
      setMotoristaData(updatedMotorista);
    } catch (error) {
      console.error('Error fetching motorista details:', error);
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

  const handleDocumentUpload = async (file: File, documentType: string) => {
    if (!motorista || !file) return;
    
    try {
      setUploading(true);
      
      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${motorista.motorista_id}_${documentType}_${Date.now()}.${fileExt}`;

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
        console.error('Upload error:', uploadError);
        throw new Error(`Erro ao fazer upload: ${uploadError.message}`);
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('imagensdocs')
        .getPublicUrl(fileName);

      // Update the appropriate document record
      if (documentType === 'cnh' || documentType === 'comprovante_residencia') {
        // Update documento_motorista
        const updateData: any = {};
        if (documentType === 'cnh') {
          updateData.foto_cnh = publicUrl;
        } else {
          updateData.foto_comprovante_residencia = publicUrl;
        }

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
              motorista_id: motorista.motorista_id, 
              ...updateData 
            });
            
          if (error) throw error;
        }
      }
      
      toast.success('Documento enviado com sucesso');
      fetchMotoristaDetails(); // Refresh data
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar documento');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAjudante = async (ajudanteId: number) => {
    try {
      setDeletingAjudante(ajudanteId);
      
      const { error } = await supabase
        .from('documento_ajudante')
        .delete()
        .eq('id_ajudante', ajudanteId);
        
      if (error) throw error;
      
      toast.success('Ajudante removido com sucesso');
      fetchMotoristaDetails(); // Refresh data
    } catch (error) {
      console.error('Error deleting ajudante:', error);
      toast.error('Erro ao remover ajudante');
    } finally {
      setDeletingAjudante(null);
    }
  };

  const handleEditAjudante = (ajudanteId: number) => {
    setSelectedAjudanteId(ajudanteId);
    setIsEditAjudanteModalOpen(true);
  };

  if (!isOpen || !motorista) return null;

  // Use motoristaData for rendering to ensure we show the most up-to-date information
  const displayData = motoristaData || motorista;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal Container */}
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative bg-white dark:bg-gray-800 rounded-lg w-full max-w-5xl shadow-xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
              <div className="p-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex flex-col">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {displayData.nome}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Motorista • {formatCPF(displayData.cpf)}
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
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`flex items-center px-6 py-3 text-sm font-medium border-b-2 transition-all duration-200
                            ${activeTab === 'details'
                              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`}
                >
                  <User className="w-5 h-5 mr-2" />
                  Detalhes
                </button>
                <button
                  onClick={() => setActiveTab('documents')}
                  className={`flex items-center px-6 py-3 text-sm font-medium border-b-2 transition-all duration-200
                            ${activeTab === 'documents'
                              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`}
                >
                  <FileText className="w-5 h-5 mr-2" />
                  Documentos
                </button>
                <button
                  onClick={() => setActiveTab('ajudantes')}
                  className={`flex items-center px-6 py-3 text-sm font-medium border-b-2 transition-all duration-200
                            ${activeTab === 'ajudantes'
                              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`}
                >
                  <UserCircle className="w-5 h-5 mr-2" />
                  Ajudantes
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : (
              <div className="p-6">
                {activeTab === 'details' && (
                  <div className="space-y-6">
                    {/* Personal Information */}
                    <section className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700 relative">
                      <div className="absolute top-6 right-6">
                        <button
                          onClick={() => setIsEditModalOpen(true)}
                          className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 
                                   dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 
                                   rounded-lg transition-colors flex items-center gap-1 w-auto"
                        >
                          <Edit2 className="w-4 h-4" />
                          Editar
                        </button>
                      </div>
                      
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <User className="w-5 h-5 text-gray-400" />
                        Informações Pessoais
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Nome</div>
                            <div className="text-base text-gray-900 dark:text-white break-words">
                              {displayData.nome}
                            </div>
                          </div>
                          
                          <div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">CPF</div>
                            <div className="text-base text-gray-900 dark:text-white break-words">
                              {formatCPF(displayData.cpf)}
                            </div>
                          </div>
                          
                          <div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Data de Nascimento</div>
                            <div className="text-base text-gray-900 dark:text-white break-words">
                              {displayData.dt_nascimento ? formatDate(displayData.dt_nascimento) : 'Não informada'}
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Telefone</div>
                            <div className="text-base text-gray-900 dark:text-white break-words">
                              {displayData.telefone ? formatPhone(displayData.telefone.toString()) : 'Não informado'}
                            </div>
                          </div>
                          
                          <div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</div>
                            <div className="text-base text-gray-900 dark:text-white break-words">
                              {displayData.email || 'Não informado'}
                            </div>
                          </div>
                          
                          <div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</div>
                            <div className="text-base text-gray-900 dark:text-white break-words capitalize">
                              {displayData.st_cadastro.replace('_', ' ')}
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>
                    
                    {/* Address */}
                    <section className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-gray-400" />
                        Endereço
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Logradouro</div>
                            <div className="text-base text-gray-900 dark:text-white break-words">
                              {endereco?.logradouro?.logradouro ? 
                                `${endereco.logradouro.logradouro}, ${endereco.nr_end || 'S/N'}` : 
                                'Não informado'
                              }
                            </div>
                          </div>
                          
                          <div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Complemento</div>
                            <div className="text-base text-gray-900 dark:text-white break-words">
                              {endereco?.ds_complemento_end || 'Não informado'}
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Bairro</div>
                            <div className="text-base text-gray-900 dark:text-white break-words">
                              {endereco?.logradouro?.bairro?.bairro || 'Não informado'}
                            </div>
                          </div>
                          
                          <div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">CEP</div>
                            <div className="text-base text-gray-900 dark:text-white break-words">
                              {endereco?.logradouro?.nr_cep ? formatCEP(endereco.logradouro.nr_cep) : 'Não informado'}
                            </div>
                          </div>
                          
                          <div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Cidade/Estado</div>
                            <div className="text-base text-gray-900 dark:text-white break-words">
                              {endereco?.logradouro?.bairro?.cidade?.cidade && endereco?.logradouro?.bairro?.cidade?.estado?.sigla_estado ? 
                                `${endereco.logradouro.bairro.cidade.cidade}/${endereco.logradouro.bairro.cidade.estado.sigla_estado}` : 
                                'Não informado'
                              }
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                )}

                {activeTab === 'documents' && (
                  <div className="space-y-6">                   
                    {/* CNH Section */}
                    <section className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-gray-400" />
                      Carteira Nacional de Habilitação (CNH)
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setIsDocumentFormOpen(true)}
                          className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 
                                   dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 
                                   rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Edit2 className="w-4 h-4" />
                          Editar
                        </button>
                      </div>
                    </div>                     
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Número da CNH</div>
                            <div className="text-base text-gray-900 dark:text-white break-words">
                              {documento?.nr_registro_cnh || 'Não informado'}
                            </div>
                          </div>
                          
                          <div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Categoria</div>
                            <div className="text-base text-gray-900 dark:text-white break-words">
                              {documento?.categoria_cnh || 'Não informada'}
                            </div>
                          </div>
                          
                          <div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Validade</div>
                            <div className="text-base text-gray-900 dark:text-white break-words">
                              {documento?.validade_cnh ? formatDate(documento.validade_cnh) : 'Não informada'}
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Nome da Mãe</div>
                            <div className="text-base text-gray-900 dark:text-white break-words">
                              {documento?.nome_mae || 'Não informado'}
                            </div>
                          </div>
                          
                          <div>
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Nome do Pai</div>
                            <div className="text-base text-gray-900 dark:text-white break-words">
                              {documento?.nome_pai || 'Não informado'}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* CNH Document Upload */}
                      <div className="mt-6">
                        <div className="flex justify-between items-center mb-2">
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            CNH
                          </div>
                          {documento?.foto_cnh && (
                            <button
                              onClick={() => openDocumentInNewTab(documento.foto_cnh)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-xs"
                            >
                              <ExternalLink size={14} />
                              Abrir em nova aba
                            </button>
                          )}
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
                        
                        {/* Upload Button */}
                        <div className="mt-4">
                          <input
                            type="file"
                            id="cnh-upload"
                            className="hidden"
                            accept="image/jpeg,image/png,image/jpg,application/pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleDocumentUpload(file, 'cnh');
                              }
                            }}
                          />
                          <label
                            htmlFor="cnh-upload"
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                                     transition-colors inline-flex items-center gap-2 cursor-pointer"
                          >
                            {uploading ? (
                              <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Enviando...
                              </>
                            ) : (
                              <>
                                <Upload className="w-5 h-5" />
                                {documento?.foto_cnh ? 'Atualizar CNH' : 'Enviar CNH'}
                              </>
                            )}
                          </label>
                        </div>
                      </div>
                    </section>
                    
                    {/* Comprovante de Residência Section */}
                    <section className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Home className="w-5 h-5 text-gray-400" />
                        Comprovante de Residência
                      </h3>
                      
                      <div className="flex justify-between items-center mb-2">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Comprovante
                        </div>
                        {documento?.foto_comprovante_residencia && (
                          <button
                            onClick={() => openDocumentInNewTab(documento.foto_comprovante_residencia)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-xs"
                          >
                            <ExternalLink size={14} />
                            Abrir em nova aba
                          </button>
                        )}
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
                      
                      {/* Upload Button */}
                      <div className="mt-4">
                        <input
                          type="file"
                          id="comprovante-upload"
                          className="hidden"
                          accept="image/jpeg,image/png,image/jpg,application/pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleDocumentUpload(file, 'comprovante_residencia');
                            }
                          }}
                        />
                        <label
                          htmlFor="comprovante-upload"
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                                   transition-colors inline-flex items-center gap-2 cursor-pointer"
                        >
                          {uploading ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <Upload className="w-5 h-5" />
                              {documento?.foto_comprovante_residencia ? 'Atualizar Comprovante' : 'Enviar Comprovante'}
                            </>
                          )}
                        </label>
                      </div>
                    </section>
                  </div>
                )}

                {activeTab === 'ajudantes' && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <UserCircle className="w-5 h-5 text-gray-400" />
                        Ajudantes
                      </h3>
                      <button
                        onClick={() => setIsAddAjudanteModalOpen(true)}
                        className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 
                                 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 
                                 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar Ajudante
                      </button>
                    </div>
                    
                    {ajudantes.length > 0 ? (
                      <div className="grid grid-cols-1 gap-4">
                        {ajudantes.map((ajudante) => (
                          <div key={ajudante.id_ajudante} className="bg-white dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                                  <UserCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                  <h4 className="text-base font-medium text-gray-900 dark:text-white">
                                    {ajudante.nome || 'Nome não informado'}
                                  </h4>
                                  <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {ajudante.cpf ? formatCPF(ajudante.cpf.toString()) : 'CPF não informado'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEditAjudante(ajudante.id_ajudante)}
                                  className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                  title="Editar ajudante"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => handleDeleteAjudante(ajudante.id_ajudante)}
                                  disabled={deletingAjudante === ajudante.id_ajudante}
                                  className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Remover ajudante"
                                >
                                  {deletingAjudante === ajudante.id_ajudante ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 size={16} />
                                  )}
                                </button>
                              </div>
                            </div>
                            
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                              {ajudante.telefone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm text-gray-600 dark:text-gray-300">
                                    {formatPhone(ajudante.telefone)}
                                  </span>
                                </div>
                              )}
                              {ajudante.genero && (
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm text-gray-600 dark:text-gray-300">
                                    {ajudante.genero === 'M' ? 'Masculino' : ajudante.genero === 'F' ? 'Feminino' : ajudante.genero}
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            {/* CNH Information */}
                            {ajudante.cnh_ajudante && ajudante.cnh_ajudante.length > 0 && (
                              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Informações da CNH
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                  {ajudante.cnh_ajudante[0].nr_registro && (
                                    <div>
                                      <span className="text-gray-500 dark:text-gray-400">Número: </span>
                                      <span className="text-gray-700 dark:text-gray-300">{ajudante.cnh_ajudante[0].nr_registro}</span>
                                    </div>
                                  )}
                                  {ajudante.cnh_ajudante[0].categoria && (
                                    <div>
                                      <span className="text-gray-500 dark:text-gray-400">Categoria: </span>
                                      <span className="text-gray-700 dark:text-gray-300">{ajudante.cnh_ajudante[0].categoria}</span>
                                    </div>
                                  )}
                                  {ajudante.cnh_ajudante[0].foto_cnh && (
                                    <div className="md:col-span-2 mt-1">
                                      <button
                                        onClick={() => openDocumentInNewTab(ajudante.cnh_ajudante[0].foto_cnh)}
                                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs flex items-center gap-1"
                                      >
                                        <FileText size={12} />
                                        Ver CNH
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {/* Address Information */}
                            {ajudante.end_ajudante && ajudante.end_ajudante.length > 0 && ajudante.end_ajudante[0].logradouro && (
                              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  Endereço
                                </h5>
                                <div className="text-xs text-gray-600 dark:text-gray-300">
                                  {ajudante.end_ajudante[0].logradouro.logradouro}, {ajudante.end_ajudante[0].nr_end || 'S/N'}
                                  {ajudante.end_ajudante[0].ds_complemento_end && `, ${ajudante.end_ajudante[0].ds_complemento_end}`}
                                  <br />
                                  {ajudante.end_ajudante[0].logradouro.bairro?.bairro}, {ajudante.end_ajudante[0].logradouro.nr_cep && formatCEP(ajudante.end_ajudante[0].logradouro.nr_cep)}
                                  <br />
                                  {ajudante.end_ajudante[0].logradouro.bairro?.cidade?.cidade}/{ajudante.end_ajudante[0].logradouro.bairro?.cidade?.estado?.sigla_estado}
                                </div>
                              </div>
                            )}
                            
                            {/* Comprovante de Residência */}
                            {ajudante.comprovante_residencia && (
                              <div className="mt-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Comprovante de Residência
                                  </span>
                                  <button
                                    onClick={() => openDocumentInNewTab(ajudante.comprovante_residencia)}
                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs flex items-center gap-1"
                                  >
                                    <ExternalLink size={12} />
                                    Ver documento
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
                        <UserCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-500 dark:text-gray-400">
                          Nenhum ajudante cadastrado para este motorista
                        </p>
                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                          Clique em "Adicionar Ajudante" para cadastrar um novo ajudante
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* Footer with standardized buttons */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-6">
              <div className="flex justify-end gap-4">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 
                           focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-300 
                           dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <EditMotoristaModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        motorista={motorista}
        onUpdate={() => {
          fetchMotoristaDetails();
          if (onSuccess) onSuccess();
        }}
      />

      {/* Document Form Modal */}
      <DocumentoMotoristaForm
        isOpen={isDocumentFormOpen}
        onClose={() => setIsDocumentFormOpen(false)}
        motorista_id={motorista.motorista_id}
        onSuccess={() => {
          fetchMotoristaDetails();
          setIsDocumentFormOpen(false);
          if (onSuccess) onSuccess();
        }}
      />

      {/* Add Ajudante Modal */}
      <AddAjudanteModal
        isOpen={isAddAjudanteModalOpen}
        onClose={() => setIsAddAjudanteModalOpen(false)}
        motorista_id={motorista.motorista_id}
        onSuccess={() => {
          fetchMotoristaDetails();
          if (onSuccess) onSuccess();
        }}
      />

      {/* Edit Ajudante Modal */}
      {selectedAjudanteId && (
        <EditAjudanteModal
          isOpen={isEditAjudanteModalOpen}
          onClose={() => setIsEditAjudanteModalOpen(false)}
          ajudanteId={selectedAjudanteId}
          onSuccess={() => {
            fetchMotoristaDetails();
            if (onSuccess) onSuccess();
          }}
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