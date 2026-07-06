import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Save, X, Link2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import JpdVincularBV from './JpdVincularBV';
import JpdFiltros, { EMPTY_FILTROS, JpdFiltrosValue } from './JpdFiltros';
import { ABAST_COLS as COLS } from './jpdAbastecimentoCols';

type Abastecimento = Record<string, any>;

const inputCls =
  'border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 dark:text-white w-full';

const toFormValue = (v: any) => (v === null || v === undefined ? '' : String(v));
const fmt = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v));

const JpdAbastecimentos = () => {
  const [rows, setRows] = useState<Abastecimento[]>([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<Abastecimento>({});
  const [vincularId, setVincularId] = useState<number | null>(null);
  const [filtros, setFiltros] = useState<JpdFiltrosValue>(EMPTY_FILTROS);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL('/api/jpd/abastecimentos', window.location.origin);
      if (filtros.placa) url.searchParams.set('placa', filtros.placa);
      if (filtros.de) url.searchParams.set('from', filtros.de);
      if (filtros.ate) url.searchParams.set('to', filtros.ate);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('Falha ao carregar lançamentos');
      setRows(await res.json());
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [filtros.placa, filtros.de, filtros.ate]);

  useEffect(() => {
    load();
  }, [load]);

  const filtrados = useMemo(() => {
    const termo = filtros.busca.trim().toLowerCase();
    if (!termo) return rows;
    return rows.filter((r) =>
      [r.id, r.placa, r.fornecedor, r.combustivel, r.hodometro, r.frete_id]
        .map((v) => (v == null ? '' : String(v).toLowerCase()))
        .join(' ')
        .includes(termo),
    );
  }, [rows, filtros.busca]);

  const startEdit = (r: Abastecimento) => {
    const d: Abastecimento = {};
    for (const c of COLS) d[c.key] = toFormValue(r[c.key]);
    setDraft(d);
    setEditId(r.id);
  };

  const startNew = () => {
    const d: Abastecimento = {};
    for (const c of COLS) d[c.key] = '';
    setDraft(d);
    setEditId('new');
  };

  const cancel = () => {
    setEditId(null);
    setDraft({});
  };

  const save = async () => {
    try {
      const isNew = editId === 'new';
      const url = isNew ? '/api/jpd/abastecimentos' : `/api/jpd/abastecimentos/${editId}`;
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao salvar');
      }
      toast.success('Lançamento salvo');
      cancel();
      load();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm('Excluir este lançamento?')) return;
    try {
      const res = await fetch(`/api/jpd/abastecimentos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao excluir');
      toast.success('Lançamento excluído');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir');
    }
  };

  const setField = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Lançamentos de abastecimento</h3>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md text-sm hover:bg-gray-200"
          >
            <RefreshCw className="w-4 h-4" /> Atualizar
          </button>
          <button
            onClick={startNew}
            disabled={editId === 'new'}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-60"
          >
            <Plus className="w-4 h-4" /> Novo lançamento
          </button>
        </div>
      </div>

      <div className="mb-3">
        <JpdFiltros
          value={filtros}
          onChange={setFiltros}
          campos={['placa', 'periodo', 'busca']}
          periodoLabel="Lançamento"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            <tr>
              <th className="px-3 py-2 text-left whitespace-nowrap">ID</th>
              {COLS.map((c) => (
                <th key={c.key} className="px-3 py-2 text-left whitespace-nowrap">
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2 text-left">BV vinculado</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="text-gray-800 dark:text-gray-200">
            {editId === 'new' && (
              <tr className="border-t border-gray-100 dark:border-gray-700 bg-blue-50/50 dark:bg-blue-900/10">
                <td className="px-3 py-1 text-gray-400">novo</td>
                {COLS.map((c) => (
                  <td key={c.key} className="px-2 py-1">
                    <input
                      type={c.type === 'number' ? 'number' : 'text'}
                      step={c.type === 'number' ? 'any' : undefined}
                      value={draft[c.key] ?? ''}
                      onChange={(e) => setField(c.key, e.target.value)}
                      className={inputCls}
                    />
                  </td>
                ))}
                <td className="px-3 py-1 text-gray-400">—</td>
                <td className="px-3 py-1 text-right whitespace-nowrap">
                  <button onClick={save} className="inline-flex items-center gap-1 text-green-600 hover:underline mr-3">
                    <Save className="w-4 h-4" /> Salvar
                  </button>
                  <button onClick={cancel} className="inline-flex items-center gap-1 text-gray-500 hover:underline">
                    <X className="w-4 h-4" /> Cancelar
                  </button>
                </td>
              </tr>
            )}

            {loading ? (
              <tr>
                <td colSpan={COLS.length + 3} className="px-3 py-6 text-center text-gray-500">
                  Carregando...
                </td>
              </tr>
            ) : filtrados.length === 0 && editId !== 'new' ? (
              <tr>
                <td colSpan={COLS.length + 3} className="px-3 py-6 text-center text-gray-500">
                  Nenhum lançamento encontrado.
                </td>
              </tr>
            ) : (
              filtrados.map((r) =>
                editId === r.id ? (
                  <tr key={r.id} className="border-t border-gray-100 dark:border-gray-700 bg-blue-50/50 dark:bg-blue-900/10">
                    <td className="px-3 py-1 font-mono text-xs">#{r.id}</td>
                    {COLS.map((c) => (
                      <td key={c.key} className="px-2 py-1">
                        <input
                          type={c.type === 'number' ? 'number' : 'text'}
                          step={c.type === 'number' ? 'any' : undefined}
                          value={draft[c.key] ?? ''}
                          onChange={(e) => setField(c.key, e.target.value)}
                          className={inputCls}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-1">{r.frete_id ? `#${r.frete_id}` : '—'}</td>
                    <td className="px-3 py-1 text-right whitespace-nowrap">
                      <button onClick={save} className="inline-flex items-center gap-1 text-green-600 hover:underline mr-3">
                        <Save className="w-4 h-4" /> Salvar
                      </button>
                      <button onClick={cancel} className="inline-flex items-center gap-1 text-gray-500 hover:underline">
                        <X className="w-4 h-4" /> Cancelar
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={r.id}
                    className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer"
                    onClick={() => startEdit(r)}
                  >
                    <td className="px-3 py-2 font-mono text-xs">#{r.id}</td>
                    {COLS.map((c) => (
                      <td key={c.key} className="px-3 py-2 whitespace-nowrap">
                        {fmt(r[c.key])}
                      </td>
                    ))}
                    <td className="px-3 py-2">{r.frete_id ? `#${r.frete_id}` : '—'}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => startEdit(r)}
                        className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline mr-3"
                      >
                        <Pencil className="w-4 h-4" /> Editar
                      </button>
                      <button
                        onClick={() => setVincularId(r.id)}
                        className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline mr-3"
                      >
                        <Link2 className="w-4 h-4" /> Vincular a um BV
                      </button>
                      <button
                        onClick={() => remove(r.id)}
                        className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 hover:underline"
                      >
                        <Trash2 className="w-4 h-4" /> Excluir
                      </button>
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>

      {vincularId != null && (
        <JpdVincularBV
          abastecimentoId={vincularId}
          onClose={() => setVincularId(null)}
          onLinked={() => {
            setVincularId(null);
            load();
          }}
        />
      )}
    </div>
  );
};

export default JpdAbastecimentos;
