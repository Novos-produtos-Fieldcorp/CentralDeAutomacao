import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { PackageCheck, Plus, Trash2, Pencil, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { dionizioApi } from './api';
import { fmtBRL, fmtDate, upperPlaca } from './format';
import DionizioDescargaForm from './DionizioDescargaForm';

const DionizioDescargas = () => {
  const [searchParams] = useSearchParams();
  const viagemId = searchParams.get('viagem_id');
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const path = viagemId ? `/descargas?viagem_id=${viagemId}` : '/descargas';
      setRegistros(await dionizioApi.get(path));
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar descargas');
    } finally {
      setLoading(false);
    }
  }, [viagemId]);

  useEffect(() => {
    load();
  }, [load]);

  const excluir = async (id: number) => {
    if (!confirm('Excluir esta descarga/entrega?')) return;
    try {
      await dionizioApi.del(`/descargas/${id}`);
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
            <PackageCheck className="w-5 h-5 text-blue-600" /> Descargas / Entregas
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {viagemId ? (
              <span className="inline-flex items-center gap-2">
                Filtrando pela viagem #{viagemId}
                <Link to="/dionizio-transportes/descargas" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                  <X className="w-3 h-3" /> limpar filtro
                </Link>
              </span>
            ) : (
              'Registros de descarga vinculados às viagens'
            )}
          </p>
        </div>
        <button
          onClick={() => {
            setEditando(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md"
        >
          <Plus className="w-4 h-4" /> Nova Descarga
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              {['Data', 'Viagem', 'Local', 'Tipo de Carga', 'Nº Carga', 'Nº Nota', 'Pagamento', 'Valor', ''].map((h) => (
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
                  Nenhuma descarga registrada
                </td>
              </tr>
            ) : (
              registros.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3">{fmtDate(r.data_descarga)}</td>
                  <td className="px-4 py-3">{r.dionizio_viagens?.referencia || `#${r.viagem_id}`}</td>
                  <td className="px-4 py-3">{r.local_descarga}</td>
                  <td className="px-4 py-3">{r.tipo_carga}</td>
                  <td className="px-4 py-3">{r.numero_carga || '—'}</td>
                  <td className="px-4 py-3">{r.numero_nota || '—'}</td>
                  <td className="px-4 py-3">{r.tipo_pagamento || '—'}</td>
                  <td className="px-4 py-3">{fmtBRL(r.valor_descarga)}</td>
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
        <DionizioDescargaForm
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          onSaved={load}
          registro={editando}
          viagemIdFixo={viagemId ? Number(viagemId) : null}
        />
      )}
    </div>
  );
};

export default DionizioDescargas;
