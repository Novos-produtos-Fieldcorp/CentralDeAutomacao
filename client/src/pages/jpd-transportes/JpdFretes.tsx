import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, Truck, CalendarClock, AlertCircle, FileUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCurrentAccount } from '../../hooks/useCurrentAccount';
import JpdFreteForm from './JpdFreteForm';
import JpdImportarBV from './JpdImportarBV';
import JpdFiltros, { EMPTY_FILTROS, JpdFiltrosValue } from './JpdFiltros';
import { fmtBRL, hojeISO, capitalizeNome } from './format';

type Frete = Record<string, any>;

type StatusVeiculo = 'em_viagem' | 'a_viajar' | 'pendente';

// Situação derivada de um BV (mesma regra do backend em jpd.js GET /veiculos).
const statusDoBv = (f: Frete, hoje: string): StatusVeiculo | null => {
  if (f.data_da_carga && !f.data_da_descarga) {
    return String(f.data_da_carga) > hoje ? 'a_viajar' : 'em_viagem';
  }
  return null;
};
const isPendente = (f: Frete) => !f.situacao_do_bv || f.situacao_do_bv === 'pendente';

const JpdFretes = () => {
  const { companyId } = useCurrentAccount();
  const [fretes, setFretes] = useState<Frete[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState<Frete | null>(null);
  const [filtros, setFiltros] = useState<JpdFiltrosValue>(EMPTY_FILTROS);
  const [statusFiltro, setStatusFiltro] = useState<StatusVeiculo | null>(null);

  const hoje = hojeISO();

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const url = new URL('/api/jpd/fretes', window.location.origin);
      if (filtros.placa) url.searchParams.set('placa', filtros.placa);
      if (filtros.motorista) url.searchParams.set('motorista', filtros.motorista);
      if (filtros.de) url.searchParams.set('from', filtros.de);
      if (filtros.ate) url.searchParams.set('to', filtros.ate);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('Falha ao carregar boletins');
      setFretes(await res.json());
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [companyId, filtros.placa, filtros.motorista, filtros.de, filtros.ate]);

  useEffect(() => {
    load();
  }, [load]);

  // Contagens de situação por veículo (sobre os BVs carregados).
  const contagens = useMemo(() => {
    let em_viagem = 0;
    let a_viajar = 0;
    let pendente = 0;
    for (const f of fretes) {
      const s = statusDoBv(f, hoje);
      if (s === 'em_viagem') em_viagem += 1;
      else if (s === 'a_viajar') a_viajar += 1;
      if (isPendente(f)) pendente += 1;
    }
    return { em_viagem, a_viajar, pendente };
  }, [fretes, hoje]);

  // Filtro final: status (bloco clicado) + busca livre client-side.
  const filtrados = useMemo(() => {
    const termo = filtros.busca.trim().toLowerCase();
    return fretes.filter((f) => {
      if (statusFiltro === 'pendente' && !isPendente(f)) return false;
      if (statusFiltro && statusFiltro !== 'pendente' && statusDoBv(f, hoje) !== statusFiltro) return false;
      if (termo) {
        const alvo = [
          f.numero_do_bv, f.origem, f.destinatario, f.motorista, f.placa_do_carro,
          f.situacao_do_bv, f.numero_do_cte,
        ]
          .map((v) => (v == null ? '' : String(v).toLowerCase()))
          .join(' ');
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [fretes, filtros.busca, statusFiltro, hoje]);

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

  const toggleStatus = (s: StatusVeiculo) => setStatusFiltro((cur) => (cur === s ? null : s));

  const cardCls = (active: boolean, color: string) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg shadow-md text-left transition ring-2 ${
      active ? `${color} ring-current` : 'bg-white dark:bg-gray-800 ring-transparent hover:ring-gray-300 dark:hover:ring-gray-600'
    }`;

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
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md text-sm hover:bg-emerald-700"
          >
            <FileUp className="w-4 h-4" /> Importar BV
          </button>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> Novo BV
          </button>
        </div>
      </div>

      {/* Situação dos veículos (clique para filtrar a lista) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => toggleStatus('em_viagem')}
          className={cardCls(statusFiltro === 'em_viagem', 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300')}
        >
          <Truck className="w-6 h-6 text-emerald-500" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Veículos em viagem</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{contagens.em_viagem}</p>
          </div>
        </button>
        <button
          onClick={() => toggleStatus('a_viajar')}
          className={cardCls(statusFiltro === 'a_viajar', 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300')}
        >
          <CalendarClock className="w-6 h-6 text-sky-500" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Veículos a viajar</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{contagens.a_viajar}</p>
          </div>
        </button>
        <button
          onClick={() => toggleStatus('pendente')}
          className={cardCls(statusFiltro === 'pendente', 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300')}
        >
          <AlertCircle className="w-6 h-6 text-amber-500" />
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Veículos pendentes</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{contagens.pendente}</p>
          </div>
        </button>
      </div>

      <JpdFiltros value={filtros} onChange={setFiltros} periodoLabel="Data da carga" />

      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            <tr>
              <th className="px-3 py-2 text-left">BV</th>
              <th className="px-3 py-2 text-left">Data carga</th>
              <th className="px-3 py-2 text-left">Data descarga</th>
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
                <td colSpan={11} className="px-3 py-6 text-center text-gray-500">
                  Carregando...
                </td>
              </tr>
            ) : filtrados.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-gray-500">
                  Nenhum boletim de viagem encontrado.
                </td>
              </tr>
            ) : (
              filtrados.map((f) => (
                <tr key={f.id} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-3 py-2">{f.numero_do_bv || '—'}</td>
                  <td className="px-3 py-2">{f.data_da_carga || '—'}</td>
                  <td className="px-3 py-2">{f.data_da_descarga || '—'}</td>
                  <td className="px-3 py-2">{f.origem || '—'}</td>
                  <td className="px-3 py-2">{f.destinatario || '—'}</td>
                  <td className="px-3 py-2">{capitalizeNome(f.motorista) || '—'}</td>
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

      {showImport && (
        <JpdImportarBV
          onClose={() => setShowImport(false)}
          onExtracted={(dados) => {
            setShowImport(false);
            // Objeto sem `id` => JpdFreteForm abre em modo criação, pré-preenchido.
            setEditing(dados);
            setShowForm(true);
          }}
        />
      )}
    </div>
  );
};

export default JpdFretes;
