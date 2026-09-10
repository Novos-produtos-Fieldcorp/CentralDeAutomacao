import React, { useCallback, useEffect, useState } from 'react';
import { Fuel, Plus, Trash2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { dionizioApi } from './api';
import { fmtBRL, fmtDate, fmtNum, upperPlaca } from './format';
import DionizioAbastecimentoForm from './DionizioAbastecimentoForm';

const DionizioAbastecimentos = () => {
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRegistros(await dionizioApi.get('/abastecimentos'));
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar abastecimentos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const excluir = async (id: number) => {
    if (!confirm('Excluir este abastecimento?')) return;
    try {
      await dionizioApi.del(`/abastecimentos/${id}`);
      toast.success('Excluído com sucesso');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao excluir');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <Fuel className="w-5 h-5 text-blue-600" /> Abastecimento
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Monitore todos os abastecimentos da frota</p>
        </div>
        <button
          onClick={() => {
            setEditando(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md"
        >
          <Plus className="w-4 h-4" /> Novo Abastecimento
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              {['Data', 'Veículo', 'Combustível', 'Km', 'Litros', 'Valor Total', 'R$/L', 'Km/L', 'Local', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-gray-400">
                  Carregando...
                </td>
              </tr>
            ) : registros.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-gray-400">
                  Nenhum abastecimento registrado
                </td>
              </tr>
            ) : (
              registros.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3">{fmtDate(r.data_abastecimento)}</td>
                  <td className="px-4 py-3 font-medium">{upperPlaca(r.dionizio_veiculos?.placa)}</td>
                  <td className="px-4 py-3">{r.tipo_combustivel || '—'}</td>
                  <td className="px-4 py-3">{fmtNum(r.quilometragem_atual)}</td>
                  <td className="px-4 py-3">{fmtNum(r.litros)}</td>
                  <td className="px-4 py-3">{fmtBRL(r.valor_total)}</td>
                  <td className="px-4 py-3">{r.preco_por_litro != null ? Number(r.preco_por_litro).toFixed(3) : '—'}</td>
                  <td className="px-4 py-3">{r.media_por_km != null ? Number(r.media_por_km).toFixed(2) : '—'}</td>
                  <td className="px-4 py-3">{r.local_abastecimento}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => {
                        setEditando(r);
                        setShowForm(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 mr-3"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => excluir(r.id)} className="text-red-600 hover:text-red-800">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <DionizioAbastecimentoForm
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          onSaved={load}
          registro={editando}
        />
      )}
    </div>
  );
};

export default DionizioAbastecimentos;
