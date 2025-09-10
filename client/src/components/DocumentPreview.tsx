import { useState } from 'react';
import { Eye, Upload, Loader2, X, ExternalLink, FileText, ImageIcon } from 'lucide-react';

interface DocumentPreviewProps {
  documentUrl?: string | null;
  isUploading?: boolean;
  onUpload: (file: File) => void;
  onPreview?: (url: string) => void;
  onRemove?: () => void;
  label: string;
  acceptedTypes?: string;
  maxSize?: number; // in MB
  showRemoveButton?: boolean;
  className?: string;
  'data-testid'?: string;
}

const DocumentPreview = ({
  documentUrl,
  isUploading = false,
  onUpload,
  onPreview,
  onRemove,
  label,
  acceptedTypes = "image/*,.pdf",
  maxSize = 5,
  showRemoveButton = true,
  className = "",
  'data-testid': testId
}: DocumentPreviewProps) => {
  const [dragOver, setDragOver] = useState(false);
  
  const isImageFile = (url: string) => {
    return url.toLowerCase().match(/\.(jpeg|jpg|png|gif|webp)$/);
  };
  
  const isPDFFile = (url: string) => {
    return url.toLowerCase().includes('.pdf');
  };
  
  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    
    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      alert(`O arquivo é muito grande. Tamanho máximo: ${maxSize}MB`);
      return;
    }
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      alert('Tipo de arquivo inválido. Use JPEG, PNG, GIF, WebP ou PDF');
      return;
    }
    
    onUpload(file);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };
  
  const openInNewTab = () => {
    if (documentUrl) {
      window.open(documentUrl, '_blank', 'noopener,noreferrer');
    }
  };
  
  return (
    <div className={`space-y-3 ${className}`}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      
      {/* Preview Area */}
      {documentUrl && !isUploading ? (
        <div className="relative group">
          {/* Document Preview */}
          <div className="relative bg-gray-50 dark:bg-gray-800/50 border-2 border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
            {isImageFile(documentUrl) ? (
              <img
                src={documentUrl}
                alt={label}
                className="w-full h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => onPreview?.(documentUrl)}
                data-testid={testId ? `${testId}-preview-image` : undefined}
              />
            ) : isPDFFile(documentUrl) ? (
              <div 
                className="w-full h-48 flex flex-col items-center justify-center bg-red-50 dark:bg-red-900/20 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                onClick={() => onPreview?.(documentUrl)}
                data-testid={testId ? `${testId}-preview-pdf` : undefined}
              >
                <FileText className="w-16 h-16 text-red-500 mb-2" />
                <span className="text-sm font-medium text-red-700 dark:text-red-300">PDF</span>
                <span className="text-xs text-red-600 dark:text-red-400 mt-1">Clique para visualizar</span>
              </div>
            ) : (
              <div 
                className="w-full h-48 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-700 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                onClick={() => onPreview?.(documentUrl)}
                data-testid={testId ? `${testId}-preview-file` : undefined}
              >
                <ImageIcon className="w-16 h-16 text-gray-400 mb-2" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Documento</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">Clique para visualizar</span>
              </div>
            )}
            
            {/* Action Buttons Overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => onPreview?.(documentUrl)}
                className="p-2 bg-white/90 hover:bg-white text-gray-700 rounded-lg transition-colors shadow-lg"
                title="Visualizar documento"
                data-testid={testId ? `${testId}-view-button` : undefined}
              >
                <Eye className="w-5 h-5" />
              </button>
              
              <button
                type="button"
                onClick={openInNewTab}
                className="p-2 bg-white/90 hover:bg-white text-gray-700 rounded-lg transition-colors shadow-lg"
                title="Abrir em nova aba"
                data-testid={testId ? `${testId}-external-button` : undefined}
              >
                <ExternalLink className="w-5 h-5" />
              </button>
              
              {showRemoveButton && onRemove && (
                <button
                  type="button"
                  onClick={onRemove}
                  className="p-2 bg-red-500/90 hover:bg-red-500 text-white rounded-lg transition-colors shadow-lg"
                  title="Remover documento"
                  data-testid={testId ? `${testId}-remove-button` : undefined}
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Upload Area */
        <div
          className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragOver
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          } ${isUploading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => {
            if (!isUploading) {
              document.getElementById(`file-input-${label.replace(/\s+/g, '-').toLowerCase()}`)?.click();
            }
          }}
          data-testid={testId ? `${testId}-upload-area` : undefined}
        >
          <input
            id={`file-input-${label.replace(/\s+/g, '-').toLowerCase()}`}
            type="file"
            accept={acceptedTypes}
            onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
            className="hidden"
            data-testid={testId ? `${testId}-file-input` : undefined}
          />
          
          {isUploading ? (
            <div className="flex flex-col items-center">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Enviando...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Upload className="w-12 h-12 text-gray-400 mb-2" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Clique ou arraste para enviar
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {acceptedTypes.includes('image') && 'Imagens '}
                {acceptedTypes.includes('.pdf') && 'PDF '}
                até {maxSize}MB
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentPreview;