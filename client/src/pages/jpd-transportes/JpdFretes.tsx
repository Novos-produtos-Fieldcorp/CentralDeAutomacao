import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCurrentAccount } from '../../hooks/useCurrentAccount';
import JpdFreteForm from './JpdFreteForm';

type Frete = Record<string, any>;

const fmtBRL = (n: any) =>
  n == null || n === '' ? '—' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const JpdFretes = () => {
  const { companyId } = useCurrentAccount();
  const [fretes, setFretes] = useState<Frete[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Frete | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/jpd/fretes`);
      if (!res.ok) throw new Error('Falha ao carregar boletins');
      setFretes(await res.json());
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Excluir este frete?')) return;
    try {
      const res = await fetch(`/api/jpd/fretes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao excluir');
      toast.success('Frete excluído');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir');
    }
  };

  const openNew = () => {
    setEditing(null);
    setShowForm(true);
  };
  const openEdit = (f: Frete) => {
    setEditing(f);
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 font-semibold">
            Lançamentos
          </p>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Boletim de Viagem</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Cadastre e edite os boletins de viagem com todos os campos do BV.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md text-sm hover:bg-gray-200"
          >
            <RefreshCw className="w-4 h-4" /> Atualizar
          </button>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> Novo BV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            <tr>
              <th className="px-3 py-2 text-left">BV</th>
              <th className="px-3 py-2 text-left">Data carga</th>
              <th className="px-3 py-2 text-left">Origem</th>
              <th className="px-3 py-2 text-left">Destinatário</th>
              <th className="px-3 py-2 text-left">Motorista</th>
              <th className="px-3 py-2 text-left">Placa</th>
              <th className="px-3 py-2 text-left">Valor frete</th>
              <th className="px-3 py-2 text-left">Faturado</th>
              <th className="px-3 py-2 text-left">Situação</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="text-gray-800 dark:text-gray-200">
            {loading ? (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-gray-500">
                  Carregando...
                </td>
              </tr>
            ) : fretes.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-gray-500">
                  Nenhum boletim de viagem cadastrado.
                </td>
              </tr>
            ) : (
              fretes.map((f) => (
                <tr key={f.id} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-3 py-2">{f.numero_do_bv || '—'}</td>
                  <td className="px-3 py-2">{f.data_da_carga || '—'}</td>
                  <td className="px-3 py-2">{f.origem || '—'}</td>
                  <td className="px-3 py-2">{f.destinatario || '—'}</td>
                  <td className="px-3 py-2">{f.motorista || '—'}</td>
                  <td className="px-3 py-2">{f.placa_do_carro || '—'}</td>
                  <td className="px-3 py-2">{fmtBRL(f.valor_do_frete)}</td>
                  <td className="px-3 py-2">{fmtBRL(f.valor_faturado)}</td>
                  <td className="px-3 py-2">{f.situacao_do_bv || '—'}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => openEdit(f)}
                      className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline mr-3"
                    >
                      <Pencil className="w-4 h-4" /> Editar
                    </button>
                    <button
                      onClick={() => handleDelete(f.id)}
                      className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 hover:underline"
                    >
                      <Trash2 className="w-4 h-4" /> Excluir
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <JpdFreteForm
          companyId={companyId}
          initial={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
};

export default JpdFretes;
