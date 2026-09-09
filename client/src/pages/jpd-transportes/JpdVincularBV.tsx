import React, { useEffect, useState } from 'react';
import { X, Link2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import JpdFreteForm from './JpdFreteForm';
import { upperPlaca } from './format';

type Frete = Record<string, any>;

interface Props {
  abastecimentoId: number;
  onClose: () => void;
  onLinked: () => void;
}

const JpdVincularBV: React.FC<Props> = ({ abastecimentoId, onClose, onLinked }) => {
  const [bvs, setBvs] = useState<Frete[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkingId, setLinkingId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/jpd/fretes?abertos=1');
        if (!res.ok) throw new Error('Falha ao carregar BVs em aberto');
        setBvs(await res.json());
      } catch (err: any) {
        toast.error(err.message || 'Erro ao carregar BVs');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const vincular = async (frete_id: number) => {
    setLinkingId(frete_id);
    try {
      const res = await fetch(`/api/jpd/abastecimentos/${abastecimentoId}/vincular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frete_id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao vincular');
      }
      toast.success('Lançamento vinculado ao BV');
      onLinked();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao vincular');
    } finally {
      setLinkingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Vincular a um BV em aberto</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs hover:bg-blue-700"
            >
              <Plus className="w-3.5 h-3.5" /> Criar BV
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                <tr>
                  <th className="px-3 py-2 text-left">BV</th>
                  <th className="px-3 py-2 text-left">Data carga</th>
                  <th className="px-3 py-2 text-left">Motorista</th>
                  <th className="px-3 py-2 text-left">Placa</th>
                  <th className="px-3 py-2 text-left">Situação</th>
                  <th className="px-3 py-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="text-gray-800 dark:text-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                      Carregando...
                    </td>
                  </tr>
                ) : bvs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                      Nenhum BV em aberto.
                    </td>
                  </tr>
                ) : (
                  bvs.map((b) => (
                    <tr key={b.id} className="border-t border-gray-100 dark:border-gray-700">
                      <td className="px-3 py-2">{b.numero_do_bv || '(pendente)'}</td>
                      <td className="px-3 py-2">{b.data_da_carga || '—'}</td>
                      <td className="px-3 py-2">{b.motorista || '—'}</td>
                      <td className="px-3 py-2">{upperPlaca(b.placa_do_carro) || '—'}</td>
                      <td className="px-3 py-2">{b.situacao_do_bv || '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => vincular(b.id)}
                          disabled={linkingId === b.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs hover:bg-blue-700 disabled:opacity-60"
                        >
                          <Link2 className="w-3.5 h-3.5" /> {linkingId === b.id ? 'Vinculando...' : 'Vincular'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showCreateForm && (
        <JpdFreteForm
          companyId={null}
          onClose={() => setShowCreateForm(false)}
          onSaved={(saved) => {
            setShowCreateForm(false);
            vincular(saved.id);
          }}
        />
      )}
    </div>
  );
};

export default JpdVincularBV;
