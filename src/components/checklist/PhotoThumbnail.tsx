import React, { useState, useEffect } from 'react';
import { Camera, Loader2, Download, X } from 'lucide-react';

interface PhotoThumbnailProps {
  url: string;
  label: string;
}

export const PhotoThumbnail = React.memo(({ url, label }: PhotoThumbnailProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const imageRef = React.useRef<HTMLImageElement>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(false);

    if (imageRef.current?.complete) {
      setIsLoading(false);
    }
  }, [url]);

  const handleLoad = () => {
    setIsLoading(false);
    setError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setError(true);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Create a temporary anchor element
    const link = document.createElement('a');
    link.href = url;
    
    // Extract filename from URL or use a default name
    const filename = url.split('/').pop() || `foto-${label.toLowerCase().replace(/\s+/g, '-')}.jpg`;
    link.download = filename;
    
    // Append to the document, click it, and remove it
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openLightbox = () => {
    setShowLightbox(true);
  };

  const closeLightbox = () => {
    setShowLightbox(false);
  };

  return (
    <>
      <div className="space-y-2">
        <div className="text-sm font-medium text-gray-900 dark:text-white">
          {label}
        </div>
        <div 
          className="relative aspect-video w-full bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden group cursor-pointer shadow-md"
          onClick={openLightbox}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          )}
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
              <Camera className="w-8 h-8 mb-2" />
              <span className="text-sm">Erro ao carregar imagem</span>
            </div>
          ) : (
            <>
              <img
                ref={imageRef}
                src={url}
                alt={label}
                loading="lazy"
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                  isLoading ? 'opacity-0' : 'opacity-100'
                }`}
                onLoad={handleLoad}
                onError={handleError}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 dark:group-hover:bg-black/20 transition-colors duration-200" />
              
              {/* Download button - only visible on hover */}
              <button 
                onClick={handleDownload}
                className="absolute bottom-2 right-2 p-2 bg-white/80 dark:bg-gray-800/80 rounded-full 
                         shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200
                         hover:bg-white dark:hover:bg-gray-700"
                title="Baixar foto"
              >
                <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Lightbox/Popup */}
      {showLightbox && (
        <div 
          className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <div 
            className="relative max-w-5xl w-full max-h-[90vh] bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-md border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {label}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownload}
                  className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Baixar foto"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={closeLightbox}
                  className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="relative h-[calc(90vh-80px)] bg-gray-100 dark:bg-gray-700">
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                </div>
              )}
              <img
                src={url}
                alt={label}
                className="w-full h-full object-contain"
                onLoad={handleLoad}
                onError={handleError}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
});