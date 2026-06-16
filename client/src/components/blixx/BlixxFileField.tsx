import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Camera, X, Loader2, FileText, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

interface BlixxFileFieldProps {
  /** Identificador curto do campo, usado no nome do arquivo (ex.: 'cnh', 'crlv'). */
  field: string;
  /** Prefixo do nome do arquivo (ex.: company_id ou placa) para evitar colisões. */
  prefix?: string | number;
  label: string;
  value?: string | null;
  onChange: (url: string) => void;
}

// Campo de upload generico para os campos "foto" das tabelas Blixx.
// Reaproveita o bucket 'imagensdocs' e o mesmo padrao de upload do DocumentUploader.
const BlixxFileField: React.FC<BlixxFileFieldProps> = ({ field, prefix = 'blixx', label, value, onChange }) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null);
  const isPdf = previewUrl?.toLowerCase().endsWith('.pdf');

  const uploadDocument = async (file: File) => {
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `blixx_${prefix}_${field}_${Date.now()}.${fileExt}`;

      let fileToUpload: File = file;
      if (fileExt?.toLowerCase() === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
        fileToUpload = new File([blob], fileName, { type: 'application/pdf' });
      }

      const { error: uploadError } = await supabase.storage
        .from('imagensdocs')
        .upload(fileName, fileToUpload, {
          cacheControl: '3600',
          upsert: true,
          contentType: fileExt?.toLowerCase() === 'pdf' ? 'application/pdf' : undefined,
        });

      if (uploadError) throw new Error(`Erro ao fazer upload: ${uploadError.message}`);

      const { data: { publicUrl } } = supabase.storage
        .from('imagensdocs')
        .getPublicUrl(fileName);

      setPreviewUrl(publicUrl);
      onChange(publicUrl);
      toast.success('Arquivo enviado com sucesso');
    } catch (error) {
      console.error('Error uploading blixx file:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar arquivo');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error('O arquivo é muito grande. Tamanho máximo: 15MB');
      return;
    }
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast.error('Tipo de arquivo inválido. Use JPEG, PNG ou PDF');
      return;
    }
    uploadDocument(file);
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    onChange('');
  };

  const openInNewTab = () => {
    if (previewUrl) window.open(previewUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      {previewUrl ? (
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-2 bg-white dark:bg-gray-800">
          {isPdf ? <FileText className="w-5 h-5 text-gray-400" /> : (
            <img src={previewUrl} alt={field} className="w-10 h-10 object-cover rounded" />
          )}
          <button type="button" onClick={openInNewTab} className="flex-1 text-left text-sm text-blue-600 dark:text-blue-400 truncate flex items-center gap-1">
            <ExternalLink size={14} /> Visualizar
          </button>
          <button type="button" onClick={handleRemove} className="p-1 text-red-500 hover:text-red-700" title="Remover">
            <X size={16} />
          </button>
        </div>
      ) : (
        <div>
          <input
            type="file"
            id={`blixx-file-${field}`}
            onChange={handleFileChange}
            className="sr-only"
            accept="image/jpeg,image/png,image/jpg,application/pdf"
            disabled={uploading}
          />
          <label
            htmlFor={`blixx-file-${field}`}
            className={`flex items-center justify-center gap-2 w-full h-16 rounded-md cursor-pointer border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 ${uploading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
            {uploading ? 'Enviando...' : 'Clique para enviar'}
          </label>
        </div>
      )}
    </div>
  );
};

export default BlixxFileField;
