import React, { useState } from 'react';
import { Download, Truck, DollarSign, Receipt, TrendingDown } from 'lucide-react';

const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const MOCK = {
  kpis: { viagens: 128, valor_frete: 482300, valor_faturado: 511450, custos: 192870 },
  situacao_bvs: [
    { label: 'pago', value: 74 },
    { label: 'pendente', value: 38 },
    { label: 'em_analise', value: 12 },
    { label: 'sem_status', value: 4 },
  ],
  custos: [
    { label: 'Demais despesas', value: 48220 },
    { label: 'Seguros', value: 22110 },
    { label: 'Abastecimento JPD', value: 91430 },
    { label: 'Pneus', value: 18770 },
  ],
  motoristas: [
    { motorista: 'Rafael Soares', viagens: 22, valor: 98420 },
    { motorista: 'Lucas Andrade', viagens: 18, valor: 81300 },
    { motorista: 'Marcos Vinicius', viagens: 16, valor: 74150 },
    { motorista: 'João Pereira', viagens: 14, valor: 62880 },
    { motorista: 'Anderson Lima', viagens: 11, valor: 49700 },
  ],
  veiculos: [
    { placa: 'JZ447-2', viagens: 24, valor: 112330 },
    { placa: 'LM404-3', viagens: 19, valor: 88910 },
    { placa: 'QPR1A23', viagens: 17, valor: 79420 },
    { placa: 'RKT5B89', viagens: 13, valor: 61180 },
    { placa: 'SBV7C12', viagens: 10, valor: 44560 },
  ],
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
  const [filters, setFilters] = useState({
    de: '2026-05-01',
    ate: '2026-05-22',
    motorista: 'Rafael Soares',
    placa: 'JZ447-2',
    situacao: 'pendente',
  });

  const set = (k: string, v: string) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 font-semibold">
            Operação e faturamento
          </p>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Dashboard operacional JPD</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
            Acompanhe documentos recebidos, revisões pendentes e consolidação dos fretes.
          </p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
          <Download className="w-4 h-4" /> Exportar Excel
        </button>
      </div>

      <form
        onSubmit={(e) => e.preventDefault()}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-wrap items-end gap-3"
      >
        <label className="flex flex-col text-xs text-gray-600 dark:text-gray-300">
          <span className="mb-1">De</span>
          <input type="date" value={filters.de} onChange={(e) => set('de', e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col text-xs text-gray-600 dark:text-gray-300">
          <span className="mb-1">Até</span>
          <input type="date" value={filters.ate} onChange={(e) => set('ate', e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col text-xs text-gray-600 dark:text-gray-300">
          <span className="mb-1">Motorista</span>
          <select value={filters.motorista} onChange={(e) => set('motorista', e.target.value)} className={inputCls}>
            <option>Todos</option>
            <option>Rafael Soares</option>
            <option>Lucas Andrade</option>
          </select>
        </label>
        <label className="flex flex-col text-xs text-gray-600 dark:text-gray-300">
          <span className="mb-1">Placa</span>
          <select value={filters.placa} onChange={(e) => set('placa', e.target.value)} className={inputCls}>
            <option>Todos</option>
            <option>JZ447-2</option>
            <option>LM404-3</option>
          </select>
        </label>
        <label className="flex flex-col text-xs text-gray-600 dark:text-gray-300">
          <span className="mb-1">Situação BV</span>
          <select value={filters.situacao} onChange={(e) => set('situacao', e.target.value)} className={inputCls}>
            <option>Todos</option>
            <option>pago</option>
            <option>pendente</option>
          </select>
        </label>
        <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
          Filtrar
        </button>
        <button
          type="button"
          onClick={() => setFilters({ de: '', ate: '', motorista: 'Todos', placa: 'Todos', situacao: 'Todos' })}
          className="px-4 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md text-sm hover:bg-gray-200"
        >
          Limpar
        </button>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Truck} label="Viagens" value={MOCK.kpis.viagens} color="bg-blue-500" />
        <KpiCard icon={DollarSign} label="Valor do frete" value={fmtBRL(MOCK.kpis.valor_frete)} color="bg-emerald-500" />
        <KpiCard icon={Receipt} label="Valor faturado" value={fmtBRL(MOCK.kpis.valor_faturado)} color="bg-violet-500" />
        <KpiCard icon={TrendingDown} label="Custos" value={fmtBRL(MOCK.kpis.custos)} color="bg-rose-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Situação dos BVs</h3>
          <ul className="space-y-2">
            {MOCK.situacao_bvs.map((s) => (
              <li
                key={s.label}
                className="flex justify-between items-center px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-md text-sm"
              >
                <strong className="text-gray-800 dark:text-gray-100">{s.label}</strong>
                <span className="text-gray-600 dark:text-gray-300">{s.value}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Custos principais</h3>
          <ul className="space-y-2">
            {MOCK.custos.map((c) => (
              <li
                key={c.label}
                className="flex justify-between items-center px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-md text-sm"
              >
                <span className="text-gray-700 dark:text-gray-200">{c.label}</span>
                <span className="font-medium text-gray-900 dark:text-white">{fmtBRL(c.value)}</span>
              </li>
            ))}
          </ul>
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
              {MOCK.motoristas.map((m) => (
                <tr key={m.motorista} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="py-2">{m.motorista}</td>
                  <td className="py-2">{m.viagens}</td>
                  <td className="py-2">{fmtBRL(m.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
            Veículos com maior faturamento
          </h3>
          <table className="min-w-full text-sm">
            <thead className="text-gray-600 dark:text-gray-300">
              <tr>
                <th className="text-left py-2">Placa</th>
                <th className="text-left py-2">Viagens</th>
                <th className="text-left py-2">Valor faturado</th>
              </tr>
            </thead>
            <tbody className="text-gray-800 dark:text-gray-200">
              {MOCK.veiculos.map((v) => (
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
