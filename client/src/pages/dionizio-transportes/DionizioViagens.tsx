import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Route as RouteIcon, Plus, Trash2, Pencil, PackageSearch } from 'lucide-react';
import toast from 'react-hot-toast';
import { dionizioApi } from './api';
import { fmtBRL, fmtDate, upperPlaca, STATUS_VIAGEM } from './format';
import DionizioViagemForm from './DionizioViagemForm';

const DionizioViagens = () => {
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRegistros(await dionizioApi.get('/viagens'));
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar viagens');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const excluir = async (id: number) => {
    if (!confirm('Excluir esta viagem? As descargas vinculadas também serão removidas.')) return;
    try {
      await dionizioApi.del(`/viagens/${id}`);
      toast.success('Excluída com sucesso');
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
            <RouteIcon className="w-5 h-5 text-blue-600" /> Viagens
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Controle de viagens, rotas e custos da frota</p>
        </div>
        <button
          onClick={() => {
            setEditando(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md"
        >
          <Plus className="w-4 h-4" /> Nova Viagem
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              {['Referência', 'Saída', 'Origem → Destino', 'Veículo', 'Motorista', 'Frete Total', 'Entregas', 'Status', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-gray-400">
                  Carregando...
                </td>
              </tr>
            ) : registros.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-gray-400">
                  Nenhuma viagem cadastrada
                </td>
              </tr>
            ) : (
              registros.map((r) => {
                const status = STATUS_VIAGEM[r.status] || { label: r.status, className: 'bg-gray-100 text-gray-600' };
                return (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 font-medium">{r.referencia || `#${r.id}`}</td>
                    <td className="px-4 py-3">{fmtDate(r.data_saida)}</td>
                    <td className="px-4 py-3">
                      {r.origem} {r.destino ? `→ ${r.destino}` : ''}
                    </td>
                    <td className="px-4 py-3">{upperPlaca(r.dionizio_veiculos?.placa)}</td>
                    <td className="px-4 py-3">{r.dionizio_motoristas?.nome || '—'}</td>
                    <td className="px-4 py-3">{fmtBRL(r.frete_total)}</td>
                    <td className="px-4 py-3">
                      {r.entregas_realizadas || 0}/{r.entregas_estimadas || 0}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${status.className}`}>{status.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link to={`/dionizio-transportes/descargas?viagem_id=${r.id}`} className="text-gray-500 hover:text-blue-600 mr-3 inline-flex" title="Ver descargas/entregas">
                        <PackageSearch className="w-4 h-4" />
                      </Link>
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
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showForm && <DionizioViagemForm isOpen={showForm} onClose={() => setShowForm(false)} onSaved={load} registro={editando} />}
    </div>
  );
};

export default DionizioViagens;
