import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Save, AlertTriangle, Fuel } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { ABAST_COLS } from './jpdAbastecimentoCols';

const inputCls =
  'border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-white w-full';

const toFormValue = (v: any) => (v === null || v === undefined ? '' : String(v));

const FormularioAbastecimentoPublico: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [registro, setRegistro] = useState<Record<string, any> | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!id) return;
    (async () => {
      setCarregando(true);
      setErro(null);
      try {
        const res = await fetch(`/api/jpd/abastecimentos/${id}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Lançamento não encontrado');
        }
        const data = await res.json();
        setRegistro(data);
        const d: Record<string, any> = {};
        for (const c of ABAST_COLS) d[c.key] = toFormValue(data?.[c.key]);
        d.revised = !!data?.revised;
        setDraft(d);
      } catch (e: any) {
        setErro(e.message || 'Erro ao carregar lançamento');
      } finally {
        setCarregando(false);
      }
    })();
  }, [id]);

  const setField = (k: string, v: any) => setDraft((d) => ({ ...d, [k]: v }));

  const salvar = async () => {
    if (!id || !registro) return;
    setSalvando(true);
    try {
      const payload = { ...registro, ...draft };
      const res = await fetch(`/api/jpd/abastecimentos/${id}/enviar-formulario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao salvar');
      }
      toast.success('Formulário enviado com sucesso!');
      setSalvo(true);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Toaster />
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
          <Fuel className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            Revisão de lançamento de abastecimento
          </h3>
        </div>

        {carregando ? (
          <div className="p-10 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : erro ? (
          <div className="p-10 flex flex-col items-center justify-center gap-2 text-center text-gray-600 dark:text-gray-300">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            <p>{erro}</p>
          </div>
        ) : salvo ? (
          <div className="p-10 flex flex-col items-center justify-center gap-2 text-center text-gray-600 dark:text-gray-300">
            <p className="text-sm">Obrigado! As informações foram enviadas e já podem ser fechadas nesta página.</p>
          </div>
        ) : (
          <>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs text-gray-500 dark:text-gray-400">
                <div>ID: {registro?.id}</div>
                <div>Frete vinculado: {registro?.frete_id ?? '—'}</div>
                <div>Criado em: {registro?.created_at ? new Date(registro.created_at).toLocaleString('pt-BR') : '—'}</div>
                <div>Atualizado em: {registro?.updated_at ? new Date(registro.updated_at).toLocaleString('pt-BR') : '—'}</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {ABAST_COLS.map((c) => (
                  <label key={c.key} className="flex flex-col text-xs text-gray-600 dark:text-gray-300">
                    <span className="mb-1">{c.label}</span>
                    <input
                      type={c.type === 'number' ? 'number' : 'text'}
                      step={c.type === 'number' ? 'any' : undefined}
                      value={draft[c.key] ?? ''}
                      onChange={(e) => setField(c.key, e.target.value)}
                      className={inputCls}
                    />
                  </label>
                ))}
                <label className="flex flex-col text-xs text-gray-600 dark:text-gray-300 justify-end">
                  <span className="inline-flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      checked={!!draft.revised}
                      onChange={(e) => setField('revised', e.target.checked)}
                    />
                    Revisado
                  </span>
                </label>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                type="button"
                onClick={salvar}
                disabled={salvando}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FormularioAbastecimentoPublico;
