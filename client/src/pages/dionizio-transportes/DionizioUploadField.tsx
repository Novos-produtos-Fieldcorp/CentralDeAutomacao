import React, { useRef, useState } from 'react';
import { Camera, Loader2, Upload, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadToDionizioBucket } from './upload';

interface Props {
  label: string;
  value: string | null;
  onChange: (url: string) => void;
  prefix: string;
  accept?: string;
  variant?: 'dropzone' | 'camera';
  required?: boolean;
}

// Campo de upload único (documento ou foto). Reaproveitado em todos os
// modais do módulo (NFe de abastecimento, comprovante do canhoto, fotos de
// ocorrência, comprovantes de descarga).
const DionizioUploadField: React.FC<Props> = ({ label, value, onChange, prefix, accept = 'image/*,.pdf', variant = 'dropzone', required }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo maior que 10MB');
      return;
    }
    setEnviando(true);
    try {
      const url = await uploadToDionizioBucket(file, prefix);
      onChange(url);
      toast.success('Arquivo enviado');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar arquivo');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {variant === 'camera' ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={enviando}
          className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-md py-3 text-sm text-gray-600 dark:text-gray-300 hover:border-blue-400 disabled:opacity-60"
        >
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : value ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Camera className="w-4 h-4" />}
          {enviando ? 'Enviando...' : value ? 'Foto enviada — trocar' : 'Tirar foto'}
        </button>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className="cursor-pointer flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-md py-6 text-sm text-gray-500 dark:text-gray-400 hover:border-blue-400"
        >
          {enviando ? <Loader2 className="w-5 h-5 animate-spin" /> : value ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <Upload className="w-5 h-5" />}
          <span>{enviando ? 'Enviando...' : value ? 'Arquivo enviado — clique para trocar' : 'Clique para adicionar arquivos ou arraste aqui'}</span>
          <span className="text-xs text-gray-400">PDF, JPG ou PNG, máx. 10MB</span>
        </div>
      )}
    </div>
  );
};

export default DionizioUploadField;
