import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Plus, Trash2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { dionizioApi } from './api';
import { fmtDate, upperPlaca, STATUS_OCORRENCIA, GRAVIDADE_OCORRENCIA } from './format';
import DionizioOcorrenciaForm from './DionizioOcorrenciaForm';

const Badge = ({ map, value }: { map: Record<string, { label: string; className: string }>; value: string }) => {
  const cfg = map[value] || { label: value || '—', className: 'bg-gray-100 text-gray-600' };
  return <span className={`px-2 py-1 text-xs font-medium rounded-full ${cfg.className}`}>{cfg.label}</span>;
};

const DionizioOcorrencias = () => {
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRegistros(await dionizioApi.get('/ocorrencias'));
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar ocorrências');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const excluir = async (id: number) => {
    if (!confirm('Excluir esta ocorrência?')) return;
    try {
      await dionizioApi.del(`/ocorrencias/${id}`);
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
            <AlertTriangle className="w-5 h-5 text-blue-600" /> Ocorrências
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Avarias, acidentes e demais eventos com os veículos</p>
        </div>
        <button
          onClick={() => {
            setEditando(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md"
        >
          <Plus className="w-4 h-4" /> Registrar Evento
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              {['Data', 'Tipo', 'Veículo', 'Gravidade', 'Status', 'Descrição', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                  Carregando...
                </td>
              </tr>
            ) : registros.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                  Nenhuma ocorrência registrada
                </td>
              </tr>
            ) : (
              registros.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3">{fmtDate(r.data)}</td>
                  <td className="px-4 py-3 font-medium">{r.tipo_evento}</td>
                  <td className="px-4 py-3">{upperPlaca(r.dionizio_veiculos?.placa) || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge map={GRAVIDADE_OCORRENCIA} value={r.gravidade} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge map={STATUS_OCORRENCIA} value={r.status} />
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate" title={r.descricao_detalhada}>
                    {r.descricao_detalhada}
                  </td>
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

      {showForm && <DionizioOcorrenciaForm isOpen={showForm} onClose={() => setShowForm(false)} onSaved={load} registro={editando} />}
    </div>
  );
};

export default DionizioOcorrencias;
