import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Truck, DollarSign, Receipt, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCurrentAccount } from '../../hooks/useCurrentAccount';
import { fmtBRL, hojeISO, capitalizeNome } from './format';

type DashboardData = {
  kpis: { total_viagens: number; total_frete: number; total_faturado: number; total_custos: number; total_km: number };
  custos: { label: string; value: number }[];
  situacao_bvs: { label: string; value: number }[];
  por_motorista: { motorista: string; viagens: number; valor: number }[];
  por_veiculo: { placa: string; viagens: number; valor: number }[];
};

const EMPTY: DashboardData = {
  kpis: { total_viagens: 0, total_frete: 0, total_faturado: 0, total_custos: 0, total_km: 0 },
  custos: [],
  situacao_bvs: [],
  por_motorista: [],
  por_veiculo: [],
};

const KpiCard = ({ icon: Icon, label, value, color }: any) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex items-center gap-3">
    <div className={`p-3 rounded-lg ${color}`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  </div>
);

const inputCls =
  'border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-white';

const JpdDashboard = () => {
  const { companyId } = useCurrentAccount();
  const [filters, setFilters] = useState({ de: '', ate: '' });
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [placas, setPlacas] = useState<string[]>([]);
  const [placaSel, setPlacaSel] = useState('');
  const [veiculo, setVeiculo] = useState<{ resumo: any; viagens: any[] } | null>(null);

  const set = (k: string, v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const hoje = hojeISO();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/jpd/opcoes');
        if (res.ok) {
          const j = await res.json();
          setPlacas(j.veiculos || []);
        }
      } catch {
        /* ignora */
      }
    })();
  }, []);

  useEffect(() => {
    if (!placaSel) {
      setVeiculo(null);
      return;
    }
    (async () => {
      try {
        const url = new URL('/api/jpd/veiculos', window.location.origin);
        url.searchParams.set('placa', placaSel);
        const res = await fetch(url.toString());
        if (res.ok) setVeiculo(await res.json());
      } catch {
        setVeiculo(null);
      }
    })();
  }, [placaSel]);

  // Situação do veículo selecionado, derivada das viagens (mesma regra do backend).
  const situacaoVeiculo = useMemo(() => {
    const viagens = veiculo?.viagens || [];
    let em_viagem = 0;
    let a_viajar = 0;
    let pendente = 0;
    for (const v of viagens) {
      if (v.data_da_carga && !v.data_da_descarga) {
        if (String(v.data_da_carga) > hoje) a_viajar += 1;
        else em_viagem += 1;
      }
      if (!v.situacao_do_bv || v.situacao_do_bv === 'pendente') pendente += 1;
    }
    return { em_viagem, a_viajar, pendente, total: viagens.length };
  }, [veiculo, hoje]);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const url = new URL('/api/jpd/dashboard', window.location.origin);
      url.searchParams.set('company_id', String(companyId));
      if (filters.de) url.searchParams.set('from', filters.de);
      if (filters.ate) url.searchParams.set('to', filters.ate);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('Falha ao carregar dashboard');
      const json = await res.json();
      setData({ ...EMPTY, ...json });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar dashboard');
    } finally {
      setLoading(false);
    }
  }, [companyId, filters.de, filters.ate]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const handleExport = () => {
    if (!companyId) return;
    const url = new URL('/api/jpd/export.xlsx', window.location.origin);
    url.searchParams.set('company_id', String(companyId));
    if (filters.de) url.searchParams.set('from', filters.de);
    if (filters.ate) url.searchParams.set('to', filters.ate);
    window.location.href = url.toString();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 font-semibold">
            Operação e faturamento
          </p>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Dashboard operacional JPD</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
            Acompanhe fretes lançados, faturamento e custos consolidados.
          </p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          <Download className="w-4 h-4" /> Exportar Excel
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-wrap items-end gap-3"
      >
        <label className="flex flex-col text-xs text-gray-600 dark:text-gray-300">
          <span className="mb-1">De (data da carga)</span>
          <input type="date" value={filters.de} onChange={(e) => set('de', e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col text-xs text-gray-600 dark:text-gray-300">
          <span className="mb-1">Até</span>
          <input type="date" value={filters.ate} onChange={(e) => set('ate', e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col text-xs text-gray-600 dark:text-gray-300">
          <span className="mb-1">Situação por placa</span>
          <select value={placaSel} onChange={(e) => setPlacaSel(e.target.value)} className={inputCls}>
            <option value="">Selecione uma placa</option>
            {placas.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
          Filtrar
        </button>
        <button
          type="button"
          onClick={() => {
            setFilters({ de: '', ate: '' });
            load();
          }}
          className="px-4 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md text-sm hover:bg-gray-200"
        >
          Limpar
        </button>
        {loading && <span className="text-xs text-gray-500">Carregando...</span>}
      </form>

      {placaSel && veiculo && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
            Situação do veículo <span className="font-mono">{placaSel}</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="px-3 py-2 rounded-md bg-emerald-50 dark:bg-emerald-900/30">
              <p className="text-xs text-gray-500 dark:text-gray-400">Em viagem</p>
              <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">{situacaoVeiculo.em_viagem}</p>
            </div>
            <div className="px-3 py-2 rounded-md bg-sky-50 dark:bg-sky-900/30">
              <p className="text-xs text-gray-500 dark:text-gray-400">A viajar</p>
              <p className="text-lg font-semibold text-sky-700 dark:text-sky-300">{situacaoVeiculo.a_viajar}</p>
            </div>
            <div className="px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-900/30">
              <p className="text-xs text-gray-500 dark:text-gray-400">Pendentes</p>
              <p className="text-lg font-semibold text-amber-700 dark:text-amber-300">{situacaoVeiculo.pendente}</p>
            </div>
            <div className="px-3 py-2 rounded-md bg-gray-50 dark:bg-gray-700/50">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total de viagens</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{situacaoVeiculo.total}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                <tr>
                  <th className="px-3 py-2 text-left">BV</th>
                  <th className="px-3 py-2 text-left">Data carga</th>
                  <th className="px-3 py-2 text-left">Data descarga</th>
                  <th className="px-3 py-2 text-left">Situação</th>
                </tr>
              </thead>
              <tbody className="text-gray-800 dark:text-gray-200">
                {(veiculo.viagens || []).slice(0, 10).map((v: any) => (
                  <tr key={v.id} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-3 py-2">{v.numero_do_bv || '—'}</td>
                    <td className="px-3 py-2">{v.data_da_carga || '—'}</td>
                    <td className="px-3 py-2">{v.data_da_descarga || '—'}</td>
                    <td className="px-3 py-2">{v.situacao_do_bv || '—'}</td>
                  </tr>
                ))}
                {(veiculo.viagens || []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                      Nenhuma viagem para esta placa.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Truck} label="Viagens" value={data.kpis.total_viagens} color="bg-blue-500" />
        <KpiCard icon={DollarSign} label="Valor do frete" value={fmtBRL(data.kpis.total_frete)} color="bg-emerald-500" />
        <KpiCard icon={Receipt} label="Valor faturado" value={fmtBRL(data.kpis.total_faturado)} color="bg-violet-500" />
        <KpiCard icon={TrendingDown} label="Custos" value={fmtBRL(data.kpis.total_custos)} color="bg-rose-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Situação dos BVs</h3>
          {data.situacao_bvs.length === 0 ? (
            <p className="text-sm text-gray-500">Sem dados.</p>
          ) : (
            <ul className="space-y-2">
              {data.situacao_bvs.map((s) => (
                <li
                  key={s.label}
                  className="flex justify-between items-center px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-md text-sm"
                >
                  <strong className="text-gray-800 dark:text-gray-100">{s.label}</strong>
                  <span className="text-gray-600 dark:text-gray-300">{s.value}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Custos principais</h3>
          {data.custos.length === 0 ? (
            <p className="text-sm text-gray-500">Sem dados.</p>
          ) : (
            <ul className="space-y-2">
              {data.custos.map((c) => (
                <li
                  key={c.label}
                  className="flex justify-between items-center px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-md text-sm"
                >
                  <span className="text-gray-700 dark:text-gray-200">{c.label}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{fmtBRL(c.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
            Motoristas com maior valor de frete
          </h3>
          <table className="min-w-full text-sm">
            <thead className="text-gray-600 dark:text-gray-300">
              <tr>
                <th className="text-left py-2">Motorista</th>
                <th className="text-left py-2">Viagens</th>
                <th className="text-left py-2">Valor frete</th>
              </tr>
            </thead>
            <tbody className="text-gray-800 dark:text-gray-200">
              {data.por_motorista.slice(0, 10).map((m) => (
                <tr key={m.motorista} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="py-2">{capitalizeNome(m.motorista)}</td>
                  <td className="py-2">{m.viagens}</td>
                  <td className="py-2">{fmtBRL(m.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Veículos com maior faturamento</h3>
          <table className="min-w-full text-sm">
            <thead className="text-gray-600 dark:text-gray-300">
              <tr>
                <th className="text-left py-2">Placa</th>
                <th className="text-left py-2">Viagens</th>
                <th className="text-left py-2">Valor faturado</th>
              </tr>
            </thead>
            <tbody className="text-gray-800 dark:text-gray-200">
              {data.por_veiculo.slice(0, 10).map((v) => (
                <tr key={v.placa} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="py-2">{v.placa}</td>
                  <td className="py-2">{v.viagens}</td>
                  <td className="py-2">{fmtBRL(v.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default JpdDashboard;
