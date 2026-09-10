import React, { useCallback, useEffect, useState } from 'react';
import { Route as RouteIcon, Fuel, BedDouble, PackageCheck, AlertTriangle, Gauge } from 'lucide-react';
import toast from 'react-hot-toast';
import { dionizioApi } from './api';
import { fmtBRL, fmtNum, upperPlaca } from './format';

type Dashboard = {
  kpis: {
    total_viagens: number;
    total_km: number;
    total_frete: number;
    total_abastecimento: number;
    total_hoteis: number;
    total_descargas: number;
    total_gasto: number;
    ocorrencias_abertas: number;
  };
  por_veiculo: { placa: string; viagens: number; km: number; frete: number }[];
  por_motorista: { motorista: string; viagens: number; frete: number }[];
  viagens_em_andamento: any[];
  ocorrencias_pendentes: any[];
};

const EMPTY: Dashboard = {
  kpis: { total_viagens: 0, total_km: 0, total_frete: 0, total_abastecimento: 0, total_hoteis: 0, total_descargas: 0, total_gasto: 0, ocorrencias_abertas: 0 },
  por_veiculo: [],
  por_motorista: [],
  viagens_em_andamento: [],
  ocorrencias_pendentes: [],
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

const DionizioDashboard = () => {
  const [filtros, setFiltros] = useState({ de: '', ate: '' });
  const [data, setData] = useState<Dashboard>(EMPTY);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtros.de) params.set('from', filtros.de);
      if (filtros.ate) params.set('to', filtros.ate);
      const qs = params.toString();
      setData(await dionizioApi.get(`/dashboard${qs ? `?${qs}` : ''}`));
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar dashboard');
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    load();
  }, [load]);

  const { kpis } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">De</label>
          <input type="date" className={inputCls} value={filtros.de} onChange={(e) => setFiltros((f) => ({ ...f, de: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Até</label>
          <input type="date" className={inputCls} value={filtros.ate} onChange={(e) => setFiltros((f) => ({ ...f, ate: e.target.value }))} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard icon={RouteIcon} label="Viagens" value={kpis.total_viagens} color="bg-blue-600" />
        <KpiCard icon={Gauge} label="Km Rodado" value={fmtNum(kpis.total_km)} color="bg-indigo-600" />
        <KpiCard icon={Fuel} label="Abastecimento" value={fmtBRL(kpis.total_abastecimento)} color="bg-orange-500" />
        <KpiCard icon={BedDouble} label="Hotéis" value={fmtBRL(kpis.total_hoteis)} color="bg-purple-600" />
        <KpiCard icon={PackageCheck} label="Descargas" value={fmtBRL(kpis.total_descargas)} color="bg-teal-600" />
        <KpiCard icon={AlertTriangle} label="Ocorrências Abertas" value={kpis.ocorrencias_abertas} color="bg-red-600" />
        <KpiCard icon={RouteIcon} label="Frete Total" value={fmtBRL(kpis.total_frete)} color="bg-green-600" />
        <KpiCard icon={Fuel} label="Gasto Total (Abast. + Hotel + Descarga)" value={fmtBRL(kpis.total_gasto)} color="bg-gray-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-3">Resumo por Veículo</h3>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase">
                <th className="py-1">Placa</th>
                <th className="py-1">Viagens</th>
                <th className="py-1">Km</th>
                <th className="py-1">Frete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.por_veiculo.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-3 text-center text-gray-400">
                    Sem dados no período
                  </td>
                </tr>
              ) : (
                data.por_veiculo.map((v) => (
                  <tr key={v.placa}>
                    <td className="py-1.5 font-medium">{upperPlaca(v.placa)}</td>
                    <td className="py-1.5">{v.viagens}</td>
                    <td className="py-1.5">{fmtNum(v.km)}</td>
                    <td className="py-1.5">{fmtBRL(v.frete)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-3">Resumo por Motorista</h3>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase">
                <th className="py-1">Motorista</th>
                <th className="py-1">Viagens</th>
                <th className="py-1">Frete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.por_motorista.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-3 text-center text-gray-400">
                    Sem dados no período
                  </td>
                </tr>
              ) : (
                data.por_motorista.map((m) => (
                  <tr key={m.motorista}>
                    <td className="py-1.5 font-medium">{m.motorista}</td>
                    <td className="py-1.5">{m.viagens}</td>
                    <td className="py-1.5">{fmtBRL(m.frete)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {data.ocorrencias_pendentes.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" /> Ocorrências pendentes
          </h3>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
            {data.ocorrencias_pendentes.map((o: any) => (
              <li key={o.id} className="py-2 flex justify-between">
                <span>
                  <span className="font-medium">{o.tipo_evento}</span> — {upperPlaca(o.dionizio_veiculos?.placa) || '—'}
                </span>
                <span className="text-gray-500 dark:text-gray-400">{o.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading && <p className="text-sm text-gray-400 text-center">Atualizando...</p>}
    </div>
  );
};

export default DionizioDashboard;
