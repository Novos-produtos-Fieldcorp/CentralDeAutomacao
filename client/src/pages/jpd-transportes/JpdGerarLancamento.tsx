import React, { useState } from 'react';
import { X, Upload, FileUp, Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadToJpdBucket } from './uploadJpd';
import { ABAST_COLS } from './jpdAbastecimentoCols';
import { useVeiculos } from './useVeiculos';
import { useMotoristas } from './useMotoristas';
import JpdCreatableSelect, { Option } from './JpdCreatableSelect';
import { capitalizeNome } from './format';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

const inputCls =
  'border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-white w-full';

const toFormValue = (v: any) => (v === null || v === undefined ? '' : String(v));

const JpdGerarLancamento: React.FC<Props> = ({ onClose, onSaved }) => {
  const [etapa, setEtapa] = useState<'upload' | 'revisao'>('upload');
  const [hodometroFile, setHodometroFile] = useState<File | null>(null);
  const [comprovanteFile, setComprovanteFile] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const placas = useVeiculos();
  const { motoristas, adicionar: adicionarMotorista } = useMotoristas();

  const criarMotorista = async (nome: string): Promise<Option> => {
    const res = await fetch('/api/jpd/motoristas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha ao criar motorista');
    }
    const criado = await res.json();
    adicionarMotorista(criado);
    return { value: String(criado.id), label: capitalizeNome(criado.nome) };
  };

  const enviar = async () => {
    if (!hodometroFile || !comprovanteFile) {
      toast.error('Selecione as duas fotos');
      return;
    }
    setProcessando(true);
    try {
      const [hodometroUrl, comprovanteUrl] = await Promise.all([
        uploadToJpdBucket(hodometroFile, 'hodometro'),
        uploadToJpdBucket(comprovanteFile, 'comprovante'),
      ]);
      const res = await fetch('/api/jpd/ocr/lancamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hodometro_url: hodometroUrl, comprovante_url: comprovanteUrl }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha na leitura das imagens');
      }
      const dados = await res.json();
      const d: Record<string, any> = {};
      for (const c of ABAST_COLS) d[c.key] = toFormValue(dados?.[c.key]);
      setDraft(d);
      setEtapa('revisao');
      toast.success('Imagens lidas! Revise o lançamento.');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao ler imagens');
    } finally {
      setProcessando(false);
    }
  };

  const confirmar = async () => {
    setProcessando(true);
    try {
      const res = await fetch('/api/jpd/abastecimentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao salvar');
      }
      toast.success('Lançamento criado');
      onSaved();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setProcessando(false);
    }
  };

  const setField = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const fileInput = (label: string, file: File | null, onPick: (f: File | null) => void) => (
    <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-4 py-6 cursor-pointer hover:border-blue-400">
      <FileUp className="w-6 h-6 text-gray-400" />
      <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{label}</span>
      <span className="text-xs text-gray-500 dark:text-gray-400 text-center">
        {file ? file.name : 'Clique para selecionar'}
      </span>
      <input
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] || null)}
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            {etapa === 'upload' ? 'Gerar lançamento' : 'Revisar lançamento'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {etapa === 'upload' ? (
          <>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Envie a foto do hodômetro e a foto do comprovante de abastecimento.
                O sistema fará a leitura automática e abrirá o lançamento pré-preenchido.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {fileInput('Foto do hodômetro', hodometroFile, setHodometroFile)}
                {fileInput('Foto do comprovante', comprovanteFile, setComprovanteFile)}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={processando}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md text-sm hover:bg-gray-200 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={enviar}
                disabled={processando || !hodometroFile || !comprovanteFile}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {processando ? 'Lendo imagens...' : 'Enviar'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {ABAST_COLS.map((c) => (
                  <label key={c.key} className="flex flex-col text-xs text-gray-600 dark:text-gray-300">
                    <span className="mb-1">{c.label}</span>
                    {c.key === 'placa' ? (
                      <JpdCreatableSelect
                        value={draft[c.key] ?? ''}
                        onChange={(v) => setField(c.key, v)}
                        options={placas}
                        createLabel="+ Criar nova placa"
                        newPlaceholder="Digite a nova placa"
                        className={inputCls}
                      />
                    ) : c.key === 'motorista_id' ? (
                      <JpdCreatableSelect
                        value={draft[c.key] ?? ''}
                        onChange={(v) => setField(c.key, v)}
                        options={motoristas.map((m) => ({ value: String(m.id), label: capitalizeNome(m.nome) }))}
                        createLabel="+ Criar novo motorista"
                        newPlaceholder="Digite o nome do motorista"
                        className={inputCls}
                        onCreate={criarMotorista}
                      />
                    ) : (
                      <input
                        type={c.type === 'number' ? 'number' : 'text'}
                        step={c.type === 'number' ? 'any' : undefined}
                        value={draft[c.key] ?? ''}
                        onChange={(e) => setField(c.key, e.target.value)}
                        className={inputCls}
                      />
                    )}
                  </label>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEtapa('upload')}
                disabled={processando}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md text-sm hover:bg-gray-200 disabled:opacity-60"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={confirmar}
                disabled={processando}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {processando ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default JpdGerarLancamento;
