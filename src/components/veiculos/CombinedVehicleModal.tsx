import React, { useState } from 'react';
import { X, Truck, MapPin, PenTool as Tool, FileText, CheckCircle2, XCircle, Camera, Loader2, ExternalLink, Upload } from 'lucide-react';
import type { Veiculo, DocumentoVeiculo } from '../../types/database';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface CombinedVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  veiculo: Veiculo | null;
  onUploadSuccess?: () => void;
}

const CombinedVehicleModal = ({ isOpen, onClose, veiculo, onUploadSuccess }: CombinedVehicleModalProps) => {
  const [activeTab, setActiveTab] = useState<'details' | 'documents'>('details');
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(veiculo?.documento_veiculo?.[0]?.foto_crv || null);

  if (!isOpen || !veiculo) return null;

  const openDocumentInNewTab = (url: string | null) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const isPdf = (url: string | null) => url?.toLowerCase().endsWith('.pdf');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Check file size (max 15MB)
    if (selectedFile.size > 15 * 1024 * 1024) {
      toast.error('O arquivo é muito grande. Tamanho máximo: 15MB');
      return;
    }

    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(selectedFile.type)) {
      toast.error('Tipo de arquivo inválido. Use JPEG, PNG ou PDF');
      return;
    }

    setFile(selectedFile);
  };

  const uploadDocument = async () => {
    if (!file || !veiculo.veiculo_id) return;
    
    try {
      setUploading(true);
      
      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${veiculo.veiculo_id}_crv_${Date.now()}.${fileExt}`;

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

      // Update preview
      setPreviewUrl(publicUrl);
      
      // Update or create documento_veiculo record
      const existingDoc = veiculo.documento_veiculo?.[0];
      if (existingDoc) {
        // Update existing record
        const { error } = await supabase
          .from('documento_veiculo')
          .update({ foto_crv: publicUrl })
          .eq('id_documento_veiculo', existingDoc.id_documento_veiculo);
          
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
      
      toast.success('Documento enviado com sucesso');
      if (onUploadSuccess) onUploadSuccess();
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar documento');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl max-w-5xl w-full shadow-xl">
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <div className="p-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Truck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {veiculo.placa.toUpperCase()} - {veiculo.marca} {veiculo.tipo}
                  </h2>
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
              <nav className="flex space-x-8 px-6" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-all duration-200
                            ${activeTab === 'details'
                              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}`}
                >
                  <Truck className="w-5 h-5 mr-2" />
                  Detalhes do Veículo
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
              </nav>
            </div>

            {/* Content */}
            <div className="p-6 space-y-8 max-h-[calc(100vh-12rem)] overflow-y-auto">
              {activeTab === 'details' && (
                <>
                  {/* Basic Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Vehicle Info */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Truck className="w-5 h-5 text-gray-400" />
                        Informações do Veículo
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Placa</span>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white uppercase">{veiculo.placa || 'Não informada'}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Marca</span>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">{veiculo.marca || 'Não informada'}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Modelo</span>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">{veiculo.tipo || 'Não informado'}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Ano</span>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">{veiculo.ano || 'Não informado'}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Cor</span>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">{veiculo.cor || 'Não informada'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Technical Specs */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Tool className="w-5 h-5 text-gray-400" />
                        Especificações Técnicas
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Tipologia</span>
                          <p className="text-base text-gray-900 dark:text-white">{veiculo.tipologia || 'Não informada'}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Combustível</span>
                          <p className="text-base text-gray-900 dark:text-white">{veiculo.combustivel || 'Não informado'}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Peso</span>
                          <p className="text-base text-gray-900 dark:text-white">{veiculo.peso ? `${veiculo.peso} kg` : 'Não informado'}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Cubagem</span>
                          <p className="text-base text-gray-900 dark:text-white">{veiculo.cubagem ? `${veiculo.cubagem} m³` : 'Não informada'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tracking Info */}
                  <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-gray-400" />
                      Rastreamento
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Status do Rastreador</span>
                        <div className="mt-2">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            veiculo.possui_rastreador
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}>
                            {veiculo.possui_rastreador ? (
                              <>
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Instalado
                              </>
                            ) : (
                              <>
                                <XCircle className="w-4 h-4 mr-2" />
                                Não Instalado
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                      
                      {veiculo.possui_rastreador && veiculo.marca_rastreador && (
                        <div>
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Marca do Rastreador</span>
                          <p className="text-base text-gray-900 dark:text-white mt-1">{veiculo.marca_rastreador}</p>
                        </div>
                      )}
                      
                      {/* Add placeholder content when rastreador is false to maintain layout */}
                      {!veiculo.possui_rastreador && (
                        <div>
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Observação</span>
                          <p className="text-base text-gray-900 dark:text-white mt-1">Veículo sem rastreador instalado</p>
                        </div>
                      )}
                      
                      {/* Add placeholder content when rastreador is true but no brand */}
                      {veiculo.possui_rastreador && !veiculo.marca_rastreador && (
                        <div>
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Marca do Rastreador</span>
                          <p className="text-base text-gray-900 dark:text-white mt-1">Não informada</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'documents' && (
                <div className="space-y-6">
                  {/* CRV Document */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        CRV Digital
                      </h3>
                      {previewUrl && (
                        <button
                          onClick={() => openDocumentInNewTab(previewUrl)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-sm"
                        >
                          <ExternalLink size={16} />
                          Abrir em nova aba
                        </button>
                      )}
                    </div>
                    
                    {previewUrl ? (
                      <div className="relative aspect-[1.414] w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                        {isPdf(previewUrl) ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <FileText className="w-12 h-12 text-gray-400 mb-2" />
                            <p className="text-sm text-gray-500 mb-4">Documento PDF</p>
                            <button
                              onClick={() => openDocumentInNewTab(previewUrl)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-2"
                            >
                              <ExternalLink size={16} />
                              Abrir PDF
                            </button>
                          </div>
                        ) : (
                          <img
                            src={previewUrl}
                            alt="CRV do veículo"
                            className="absolute inset-0 w-full h-full object-contain cursor-pointer"
                            onClick={() => openDocumentInNewTab(previewUrl)}
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

                    {/* Upload Section */}
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Enviar novo documento
                        </h4>
                      </div>
                      
                      <div className="flex items-end gap-3">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Selecione um arquivo
                          </label>
                          <input
                            type="file"
                            onChange={handleFileChange}
                            accept="image/jpeg,image/png,image/jpg,application/pdf"
                            className="block w-full text-sm text-gray-900 dark:text-gray-100
                                   file:mr-4 file:py-2 file:px-4
                                   file:rounded-md file:border-0
                                   file:text-sm file:font-medium
                                   file:bg-blue-50 file:text-blue-700
                                   dark:file:bg-blue-900/20 dark:file:text-blue-300
                                   hover:file:bg-blue-100 dark:hover:file:bg-blue-900/30
                                   border border-gray-300 dark:border-gray-600 rounded-lg
                                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            JPEG, PNG ou PDF (máx. 15MB)
                          </p>
                        </div>
                        
                        <button
                          onClick={uploadDocument}
                          disabled={!file || uploading}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                                 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                                 flex items-center gap-2"
                        >
                          {uploading ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <Upload className="w-5 h-5" />
                              Enviar
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CombinedVehicleModal;