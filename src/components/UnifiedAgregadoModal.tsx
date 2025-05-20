import React, { useState, useEffect } from 'react';
import { X, Truck, MapPin, PenTool as Tool, FileText, CheckCircle2, XCircle, Camera, Loader2, ExternalLink, Upload, Phone, Mail, Calendar, CreditCard, Info, User, UserCircle, Home, Edit2 } from 'lucide-react';
import type { DocumentoMotorista, Veiculo, DocumentoVeiculo, Motorista, PessoaFisicaDonoVeiculo, PessoaJuridicaDonoVeiculo } from '../types/database';
import { formatCPF, formatPhone, formatDate, formatCEP } from '../utils/format';
import DocumentoMotoristaForm from './DocumentoMotoristaForm';
import DocumentUploader from './DocumentUploader';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import EditMotoristaModal from './EditMotoristaModal';

interface UnifiedAgregadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  agregado?: Motorista | null;
  onSuccess?: () => void;
}

const UnifiedAgregadoModal = ({ isOpen, onClose, agregado, onSuccess }: UnifiedAgregadoModalProps) => {
  const [activeTab, setActiveTab] = useState<'details' | 'documents' | 'vehicle'>('details');
  const [loading, setLoading] = useState(true);
  const [documento, setDocumento] = useState<DocumentoMotorista | null>(null);
  const [veiculo, setVeiculo] = useState<(Veiculo & {
    documento_veiculo: (DocumentoVeiculo & {
      pessoa_fisica_dono_veiculo?: PessoaFisicaDonoVeiculo;
      pessoa_juridica_dono_veiculo?: PessoaJuridicaDonoVeiculo;
    })[];
  }) | null>(null);
  const [endereco, setEndereco] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDocumentFormOpen, setIsDocumentFormOpen] = useState(false);
  const [activeDocument, setActiveDocument] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [agregadoData, setAgregadoData] = useState<Motorista | null>(null);

  useEffect(() => {
    if (isOpen && agregado) {
      setAgregadoData(agregado);
      fetchAgregadoDetails();
    }
  }, [isOpen, agregado]);

  const fetchAgregadoDetails = async () => {
    if (!agregado) return;
    
    try {
      setLoading(true);
      
      // Fetch documento_motorista
      const { data: documentoData, error: documentoError } = await supabase
        .from('documento_motorista')
        .select('*')
        .eq('motorista_id', agregado.motorista_id)
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
        .eq('id_motorista', agregado.motorista_id)
        .maybeSingle();

      if (enderecoError && enderecoError.code !== 'PGRST116') {
        throw enderecoError;
      }

      setEndereco(enderecoData);

      // Fetch veiculo
      const { data: veiculoData, error: veiculoError } = await supabase
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
        .limit(1)
        .maybeSingle();

      if (veiculoError && veiculoError.code !== 'PGRST116') {
        throw veiculoError;
      }

      setVeiculo(veiculoData);
      
      // Fetch updated agregado data
      const { data: updatedAgregado, error: agregadoError } = await supabase
        .from('motorista')
        .select('*')
        .eq('motorista_id', agregado.motorista_id)
        .single();
        
      if (agregadoError) {
        throw agregadoError;
      }
      
      setAgregadoData(updatedAgregado);
    } catch (error) {
      console.error('Error fetching agregado details:', error);
      toast.error('Erro ao carregar detalhes do agregado');
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
    if (!agregado || !file) return;
    
    try {
      setUploading(true);
      
      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${agregado.motorista_id}_${documentType}_${Date.now()}.${fileExt}`;

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
              motorista_id: agregado.motorista_id, 
              ...updateData 
            });
            
          if (error) throw error;
        }
      } else if (documentType === 'crv' && veiculo) {
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
      }
      
      toast.success('Documento enviado com sucesso');
      fetchAgregadoDetails(); // Refresh data
      
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

  if (!isOpen || !agregado) return null;

  // Use agregadoData for rendering to ensure we show the most up-to-date information
  const displayData = agregadoData || agregado;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal Container */}
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl w-full max-w-5xl shadow-xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
              <div className="p-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <Truck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex flex-col">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {displayData.nome}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Agregado • {formatCPF(displayData.cpf)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 
                             dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 
                             rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Edit2 className="w-4 h-4" />
                    Editar
                  </button>
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
                  onClick={() => setActiveTab('vehicle')}
                  className={`flex items-center px-6 py-3 text-sm font-medium border-b-2 transition-all duration-200
                            ${activeTab === 'vehicle'
                              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`}
                >
                  <Truck className="w-5 h-5 mr-2" />
                  Veículo
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
                    <section className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
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
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Documentos do Agregado
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setIsDocumentFormOpen(true)}
                          className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 
                                   dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 
                                   rounded-lg transition-colors flex items-center gap-1"
                        >
                          <FileText className="w-4 h-4" />
                          Editar Informações
                        </button>
                      </div>
                    </div>
                    
                    {/* CNH Section */}
                    <section className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-gray-400" />
                        Carteira Nacional de Habilitação (CNH)
                      </h3>
                      
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
                          Comprovante de Residência
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
                          {isPdf(documento.foto_comprovante_residencia)