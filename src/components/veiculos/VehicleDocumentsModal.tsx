import React, { useState } from 'react';
import { X, FileText, Camera, ExternalLink, Upload, Loader2 } from 'lucide-react';
import type { DocumentoVeiculo } from '../../types/database';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface VehicleDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  documento: DocumentoVeiculo | null;
  placa: string;
  marca: string;
  tipo: string;
  veiculo_id?: number;
  onUploadSuccess?: () => void;
}

const VehicleDocumentsModal = ({ isOpen, onClose, documento, placa, marca, tipo, veiculo_id, onUploadSuccess }: VehicleDocumentsModalProps) => {
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(documento?.foto_crv || null);

  if (!isOpen) return null;

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
    if (!file || !veiculo_id) return;
    
    try {
      setUploading(true);
      
      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${veiculo_id}_crv_${Date.now()}.${fileExt}`;

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
      if (documento) {
        // Update existing record
        const { error } = await supabase
          .from('documento_veiculo')
          .update({ foto_crv: publicUrl })
          .eq('id_documento_veiculo', documento.id_documento_veiculo);
          
        if (error) throw error;
      } else if (veiculo_id) {
        // Create new record
        const { error } = await supabase
          .from('documento_veiculo')
          .insert({ 
            veiculo_id, 
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
          <div className="relative bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full shadow-xl">
            <div className="border-b border-gray-200 dark:border-gray-700">
              <div className="p-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Documentos do Veículo
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Vehicle Basic Info */}
              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Placa</span>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white uppercase">{placa}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Marca</span>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{marca}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Modelo</span>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{tipo}</p>
                  </div>
                </div>
              </div>

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
                {veiculo_id && (
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
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VehicleDocumentsModal;