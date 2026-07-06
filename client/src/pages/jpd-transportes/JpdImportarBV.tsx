import React, { useState } from 'react';
import { X, Upload, FileUp, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadToJpdBucket } from './uploadJpd';

interface Props {
  onClose: () => void;
  // Recebe o JSON extraído pelo n8n (chaves = colunas do BV) para pré-preencher o form.
  onExtracted: (dados: Record<string, any>) => void;
}

const JpdImportarBV: React.FC<Props> = ({ onClose, onExtracted }) => {
  const [file, setFile] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    if (!file) {
      toast.error('Selecione um arquivo');
      return;
    }
    setEnviando(true);
    try {
      const url = await uploadToJpdBucket(file, 'bv');
      const res = await fetch('/api/jpd/ocr/bv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha na leitura do arquivo');
      }
      const dados = await res.json();
      toast.success('Arquivo lido! Revise os dados do BV.');
      onExtracted(dados || {});
    } catch (err: any) {
      toast.error(err.message || 'Erro ao ler arquivo');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Importar BV</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Envie a imagem ou PDF do Boletim de Viagem. O sistema fará a leitura
            automática e abrirá o formulário pré-preenchido para você revisar.
          </p>

          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-4 py-8 cursor-pointer hover:border-blue-400">
            <FileUp className="w-8 h-8 text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {file ? file.name : 'Clique para selecionar um arquivo'}
            </span>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={enviando}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md text-sm hover:bg-gray-200 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={enviar}
            disabled={enviando || !file}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-60"
          >
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {enviando ? 'Lendo arquivo...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default JpdImportarBV;
