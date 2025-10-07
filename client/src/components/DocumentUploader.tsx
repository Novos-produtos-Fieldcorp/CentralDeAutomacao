import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, Upload, X, Loader2, FileText, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

interface DocumentUploaderProps {
  documentType: 'cnh' | 'rg' | 'comprovante_residencia';
  motorista_id: number;
  currentUrl?: string | null;
  onUploadComplete: (url: string) => void;
  label: string;
}

const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  documentType,
  motorista_id,
  currentUrl,
  onUploadComplete,
  label
}) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl || null);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const isPdf = previewUrl?.toLowerCase().endsWith('.pdf');

  const uploadDocument = async (file: File) => {
    try {
      setUploading(true);
      setError(null);

      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${motorista_id}_${documentType}_${Date.now()}.${fileExt}`;

      // For PDF files, we need to convert to base64 and then to blob to ensure proper MIME type
      let fileToUpload = file;
      if (fileExt?.toLowerCase() === 'pdf') {
        // Convert to ArrayBuffer then to a File with correct MIME type
        const reader = new FileReader();
        const dataPromise = new Promise<ArrayBuffer>((resolve, reject) => {
          reader.onload = () => {
            try {
              resolve(reader.result as ArrayBuffer);
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = reject;
          reader.readAsArrayBuffer(file);
        });

        const arrayBuffer = await dataPromise;
        const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
        // Create a File object so Supabase SDK accepts it as a file
        const pdfFile = new File([blob], fileName, { type: 'application/pdf' });
        fileToUpload = pdfFile as unknown as File;
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
      
      // Call the callback with the URL
      onUploadComplete(publicUrl);
      
      toast.success('Documento enviado com sucesso');
    } catch (error) {
      console.error('Error uploading document:', error);
      setError(error instanceof Error ? error.message : 'Erro ao enviar documento');
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar documento');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 15MB)
    if (file.size > 15 * 1024 * 1024) {
      setError('O arquivo é muito grande. Tamanho máximo: 15MB');
      toast.error('O arquivo é muito grande. Tamanho máximo: 15MB');
      return;
    }

    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setError('Tipo de arquivo inválido. Use JPEG, PNG ou PDF');
      toast.error('Tipo de arquivo inválido. Use JPEG, PNG ou PDF');
      return;
    }

    uploadDocument(file);
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    onUploadComplete('');
  };

  const openInNewTab = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const togglePreview = () => {
    setShowPreview(!showPreview);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      
      {previewUrl ? (
        <div className="relative">
          <div className="aspect-[1.414] w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
            {isPdf ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <FileText className="w-12 h-12 text-gray-400 mb-2" />
                <p className="text-sm text-gray-500 mb-4">Documento PDF</p>
                
                {showPreview ? (
                  <div className="absolute inset-0 bg-white">
                    <iframe 
                      src={`${previewUrl}#toolbar=0`} 
                      className="w-full h-full" 
                      title="PDF Preview"
                    />
                    <button
                      onClick={togglePreview}
                      className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-100"
                    >
                      <X size={20} className="text-gray-600" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={togglePreview}
                      className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center gap-1"
                    >
                      <FileText size={16} />
                      Visualizar
                    </button>
                    <button
                      onClick={openInNewTab}
                      className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm flex items-center gap-1"
                    >
                      <ExternalLink size={16} />
                      Abrir
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <img 
                  src={previewUrl} 
                  alt={`${documentType} preview`} 
                  className="absolute inset-0 w-full h-full object-contain cursor-pointer"
                  onClick={openInNewTab}
                />
                <div className="absolute bottom-2 right-2">
                  <button
                    onClick={openInNewTab}
                    className="p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                    title="Abrir em nova aba"
                  >
                    <ExternalLink size={16} />
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            onClick={handleRemove}
            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
            title="Remover documento"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="file"
            id={`file-${documentType}`}
            onChange={handleFileChange}
            className="sr-only"
            accept="image/jpeg,image/png,image/jpg,application/pdf"
            disabled={uploading}
          />
          <label
            htmlFor={`file-${documentType}`}
            className={`flex items-center justify-center gap-3 w-full max-w-[200px] h-36 rounded-md cursor-pointer px-3
                      ${error ? 'border border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20' : 
                      'border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'}
                      transition-colors ${uploading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center gap-3">
              {uploading ? (
                <>
                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Enviando...</p>
                </>
              ) : (
                <>
                  <Camera className="w-6 h-6 text-gray-400" />
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-700 dark:text-gray-200">Clique para enviar</span>
                    <span className="text-xs text-gray-400 dark:text-gray-400">JPEG, PNG ou PDF • máx. 15MB</span>
                  </div>
                </>
              )}
            </div>
          </label>
        </div>
      )}
    </div>
  );
};

export default DocumentUploader;