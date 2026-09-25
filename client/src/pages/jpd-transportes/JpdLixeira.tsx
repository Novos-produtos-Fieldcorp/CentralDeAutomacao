import React, { useEffect, useState } from 'react';
import { X, Undo2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtBRL, capitalizeNome, upperPlaca, fmtDataBR } from './format';

type Frete = Record<string, any>;

interface Props {
  onClose: () => void;
  onRestored: () => void;
}

// Lixeira de BVs excluídos: ficam recuperáveis por 30 dias antes de serem
// apagados definitivamente (purga automática no backend).
const JpdLixeira: React.FC<Props> = ({ onClose, onRestored }) => {
  const [fretes, setFretes] = useState<Frete[]>([]);
  const [loading, setLoading] = useState(false);
  const [restaurandoId, setRestaurandoId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/jpd/fretes/lixeira', { cache: 'no-store' });
      if (!res.ok) throw new Error('Falha ao carregar lixeira');
      setFretes(await res.json());
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar lixeira');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const restaurar = async (id: number) => {
    setRestaurandoId(id);
    try {
      const res = await fetch(`/api/jpd/fretes/${id}/restaurar`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao restaurar');
      }
      toast.success('Boletim restaurado');
      setFretes((prev) => prev.filter((f) => f.id !== id));
      onRestored();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao restaurar');
    } finally {
      setRestaurandoId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Lixeira</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Boletins excluídos ficam aqui por 30 dias antes de serem apagados definitivamente.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          {loading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Carregando...</p>
          ) : fretes.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum boletim na lixeira.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-gray-600 dark:text-gray-300">
                  <tr>
                    <th className="text-left py-2">BV</th>
                    <th className="text-left py-2">Motorista</th>
                    <th className="text-left py-2">Placa</th>
                    <th className="text-left py-2">Valor frete</th>
                    <th className="text-left py-2">Excluído em</th>
                    <th className="text-right py-2">Ação</th>
                  </tr>
                </thead>
                <tbody className="text-gray-800 dark:text-gray-200">
                  {fretes.map((f) => (
                    <tr key={f.id} className="border-t border-gray-100 dark:border-gray-700">
                      <td className="py-2">{f.numero_do_bv || '—'}</td>
                      <td className="py-2">{f.motorista ? capitalizeNome(f.motorista) : '—'}</td>
                      <td className="py-2 font-mono">{f.placa_do_carro ? upperPlaca(f.placa_do_carro) : '—'}</td>
                      <td className="py-2">{fmtBRL(f.valor_do_frete)}</td>
                      <td className="py-2">{fmtDataBR(f.deleted_at)}</td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => restaurar(f.id)}
                          disabled={restaurandoId === f.id}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-md text-xs hover:bg-blue-700 disabled:opacity-60"
                        >
                          <Undo2 className="w-3.5 h-3.5" /> Restaurar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JpdLixeira;
