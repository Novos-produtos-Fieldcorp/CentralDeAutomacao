import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCurrentAccount } from '../../hooks/useCurrentAccount';
import JpdFreteForm from './JpdFreteForm';
import JpdConsumoCards, { Consumo } from './JpdConsumoCards';

type Frete = Record<string, any>;
type Resumo = { placa: string; viagens: number; faturado: number; frete: number; km: number; combustivel: number };

const fmtBRL = (n: any) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = (n: any) => (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

const Kpi = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    <p className="text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
  </div>
);

const JpdVeiculoDetalhe = () => {
  const { placa = '' } = useParams<{ placa: string }>();
  const { companyId } = useCurrentAccount();
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [viagens, setViagens] = useState<Frete[]>([]);
  const [consumo, setConsumo] = useState<Consumo | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Frete | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/jpd/veiculos?placa=${encodeURIComponent(placa)}`);
      if (!res.ok) throw new Error('Falha ao carregar viagens');
      const json = await res.json();
      setResumo(json.resumo || null);
      setViagens(json.viagens || []);
      setConsumo(json.consumo || null);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar viagens');
    } finally {
      setLoading(false);
    }
  }, [placa]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Excluir esta viagem?')) return;
    try {
      const res = await fetch(`/api/jpd/fretes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao excluir');
      toast.success('Viagem excluída');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 font-semibold">
            Detalhe da frota
          </p>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Veículo {placa}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {loading ? 'Carregando...' : `${viagens.length} viagem(ns) registrada(s).`}
          </p>
        </div>
        <Link
          to="/jpd-transportes/veiculos"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md text-sm hover:bg-gray-200"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
      </div>

      {resumo && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Kpi label="Viagens" value={String(resumo.viagens)} />
          <Kpi label="Valor faturado" value={fmtBRL(resumo.faturado)} />
          <Kpi label="KM total" value={fmtNum(resumo.km)} />
          <Kpi label="Combustível JPD" value={fmtBRL(resumo.combustivel)} />
        </div>
      )}

      <JpdConsumoCards consumo={consumo} title="Consumo do veículo" />

      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            <tr>
              <th className="px-3 py-2 text-left">BV</th>
              <th className="px-3 py-2 text-left">Data carga</th>
              <th className="px-3 py-2 text-left">Motorista</th>
              <th className="px-3 py-2 text-left">Origem</th>
              <th className="px-3 py-2 text-left">Destinatário</th>
              <th className="px-3 py-2 text-left">Valor frete</th>
              <th className="px-3 py-2 text-left">Faturado</th>
              <th className="px-3 py-2 text-left">Situação</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="text-gray-800 dark:text-gray-200">
            {viagens.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                  {loading ? 'Carregando...' : 'Nenhuma viagem para esta placa.'}
                </td>
              </tr>
            ) : (
              viagens.map((v) => (
                <tr key={v.id} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-3 py-2">{v.numero_do_bv || '(pendente)'}</td>
                  <td className="px-3 py-2">{v.data_da_carga || '—'}</td>
                  <td className="px-3 py-2">{v.motorista || '—'}</td>
                  <td className="px-3 py-2">{v.origem || '—'}</td>
                  <td className="px-3 py-2">{v.destinatario || '—'}</td>
                  <td className="px-3 py-2">{fmtBRL(v.valor_do_frete)}</td>
                  <td className="px-3 py-2">{fmtBRL(v.valor_faturado)}</td>
                  <td className="px-3 py-2">{v.situacao_do_bv || '—'}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => {
                        setEditing(v);
                        setShowForm(true);
                      }}
                      className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline mr-3"
                    >
                      <Pencil className="w-4 h-4" /> Editar
                    </button>
                    <button
                      onClick={() => handleDelete(v.id)}
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

export default JpdVeiculoDetalhe;
