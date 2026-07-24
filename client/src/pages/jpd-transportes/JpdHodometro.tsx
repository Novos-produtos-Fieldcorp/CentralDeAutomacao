import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  TrendingUp, Calendar, ChevronDown, BarChart2, Truck, LayoutDashboard, ClipboardList,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtNum, capitalizeNome } from './format';
import { useDateRange } from '../../hooks/useDateRange';

type Leitura = {
  id: number;
  placa: string;
  hodometro: number | null;
  data: string | null; // ISO timestamp (created_at)
  motorista: string | null;
};

type Resumo = {
  total_km: number;
  media_diaria: number;
  por_dia: { dia: string; km: number }[];
  por_veiculo: { placa: string; km: number }[];
};

const dateOnly = (iso: string | null) => (iso ? String(iso).slice(0, 10) : '');
const ddmm = (isoDate: string) => (isoDate ? `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}` : '');

// Rótulos do seletor de período (casam com os tipos de useDateRange).
const PERIODOS: { type: '30days' | '15days' | '1day' | 'all'; label: string }[] = [
  { type: '30days', label: '30 dias' },
  { type: '15days', label: '15 dias' },
  { type: '1day', label: 'Hoje' },
  { type: 'all', label: 'Tudo' },
];

const cardBase =
  'bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg transition-all duration-300 transform hover:-translate-y-1';
const panelBase =
  'bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700';

const EmptyState: React.FC<{ icon: React.ReactNode; msg?: string }> = ({ icon, msg }) => (
  <div className="flex flex-col items-center justify-center h-60 bg-gray-50 dark:bg-gray-700 rounded-2xl shadow">
    <div className="text-gray-400 dark:text-gray-600 mb-4">{icon}</div>
    <p className="text-gray-400">{msg || 'Nenhum dado disponível para o período selecionado'}</p>
  </div>
);

const ChartTooltip = ({ active, payload, label, suffix }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
        <p className="text-sm text-blue-600 dark:text-blue-400">
          {`${Number(payload[0].value).toLocaleString('pt-BR')}${suffix || ''}`}
        </p>
      </div>
    );
  }
  return null;
};

const JpdHodometro: React.FC = () => {
  const [leituras, setLeituras] = useState<Leitura[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sub, setSub] = useState<'dashboard' | 'leituras'>('dashboard');
  const { periodType, dateRange, updatePeriod } = useDateRange('30days');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (periodType !== 'all') {
        p.set('from', dateRange.startDate);
        p.set('to', dateRange.endDate);
      }
      const qs = p.toString();
      const res = await fetch(`/api/jpd/hodometro${qs ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error('Falha ao carregar hodômetro');
      const json = await res.json();
      setLeituras(json.leituras || []);
      setResumo(json.resumo || null);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar hodômetro');
    } finally {
      setLoading(false);
    }
  }, [periodType, dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    load();
  }, [load]);

  const periodoLabel = PERIODOS.find((p) => p.type === periodType)?.label || 'Período';

  const dailyData = useMemo(
    () => (resumo?.por_dia || []).map((d) => ({ ...d, formattedDate: ddmm(d.dia) })),
    [resumo],
  );
  const veiculoData = resumo?.por_veiculo || [];

  // Se há leituras no período mas nenhuma quilometragem calculada, é porque
  // falta a 2ª leitura crescente da mesma placa (km = diferença entre leituras).
  const kmEmptyMsg =
    leituras.length > 0
      ? 'É preciso ao menos 2 leituras da mesma placa no período (com hodômetro crescente) para calcular a quilometragem.'
      : undefined;

  const leiturasOrdenadas = useMemo(
    () => [...leituras].sort((a, b) => String(b.data).localeCompare(String(a.data))),
    [leituras],
  );

  const subTabCls = (active: boolean) =>
    `flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
      active
        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
    }`;

  const blue = 'rgba(59, 130, 246, 0.75)';
  const purple = 'rgba(139, 92, 246, 0.75)';

  return (
    <div className="space-y-6">
      {/* Sub-abas */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-6">
          <button className={subTabCls(sub === 'dashboard')} onClick={() => setSub('dashboard')}>
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </button>
          <button className={subTabCls(sub === 'leituras')} onClick={() => setSub('leituras')}>
            <ClipboardList className="w-4 h-4" /> Leituras
          </button>
        </nav>
      </div>

      {/* Seletor de período (aplica a ambas as sub-abas) */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative z-[40]">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9"
          >
            <Calendar className="h-4 w-4" />
            <span>{periodoLabel}</span>
            <ChevronDown className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute mt-1 w-40 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg overflow-hidden">
              {PERIODOS.map((p) => (
                <button
                  key={p.type}
                  onClick={() => {
                    updatePeriod(p.type);
                    setMenuOpen(false);
                  }}
                  className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 ${
                    p.type === periodType ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {loading && <span className="text-sm text-gray-400">Carregando…</span>}
      </div>

      {sub === 'dashboard' ? (
        <>
          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className={cardBase}>
              <div className="flex flex-col items-center text-center">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-2xl mb-3">
                  <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">Total de Quilômetros</h3>
                <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                  {fmtNum(resumo?.total_km ?? 0)}
                </p>
              </div>
            </div>
            <div className={cardBase}>
              <div className="flex flex-col items-center text-center">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-2xl mb-3">
                  <Calendar className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">Média Diária</h3>
                <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">
                  {fmtNum(resumo?.media_diaria ?? 0)} km
                </p>
              </div>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quilometragem Diária */}
            <div className={panelBase}>
              <div className="mb-6 flex items-center gap-2">
                <BarChart2 className="text-blue-500 w-5 h-5" />
                <h3 className="text-lg font-bold text-black dark:text-white">Quilometragem Diária</h3>
              </div>
              {dailyData.length === 0 ? (
                <EmptyState icon={<BarChart2 className="w-12 h-12" />} msg={kmEmptyMsg} />
              ) : (
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#9CA3AF" opacity={0.15} />
                      <XAxis dataKey="formattedDate" angle={-45} textAnchor="end" height={50} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                      <Tooltip content={<ChartTooltip suffix=" km" />} />
                      <Bar dataKey="km" radius={[4, 4, 0, 0]} fill={blue} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Quilometragem por Veículo */}
            <div className={panelBase}>
              <h3 className="text-lg font-medium text-black dark:text-white mb-6 flex items-center gap-2">
                <Truck className="text-purple-500 dark:text-purple-400 w-5 h-5" />
                Quilometragem por Veículo
              </h3>
              {veiculoData.length === 0 ? (
                <EmptyState icon={<Truck className="w-12 h-12" />} msg={kmEmptyMsg} />
              ) : (
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={veiculoData} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#9CA3AF" opacity={0.15} />
                      <XAxis type="number" stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="placa" width={90} stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                      <Tooltip content={<ChartTooltip suffix=" km" />} />
                      <Bar dataKey="km" radius={[0, 4, 4, 0]}>
                        {veiculoData.map((_, i) => (
                          <Cell key={i} fill={purple} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Sub-aba Leituras */
        <div className={panelBase}>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
            Leituras de hodômetro
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                <tr>
                  <th className="px-3 py-2 text-left">Data</th>
                  <th className="px-3 py-2 text-left">Placa</th>
                  <th className="px-3 py-2 text-left">Motorista</th>
                  <th className="px-3 py-2 text-left">Hodômetro</th>
                </tr>
              </thead>
              <tbody className="text-gray-800 dark:text-gray-200">
                {leiturasOrdenadas.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                      {loading ? 'Carregando...' : 'Nenhuma leitura no período selecionado.'}
                    </td>
                  </tr>
                ) : (
                  leiturasOrdenadas.map((l) => (
                    <tr key={l.id} className="border-t border-gray-100 dark:border-gray-700">
                      <td className="px-3 py-2 whitespace-nowrap">{dateOnly(l.data) || '—'}</td>
                      <td className="px-3 py-2 font-medium">{l.placa || '—'}</td>
                      <td className="px-3 py-2">{capitalizeNome(l.motorista) || '—'}</td>
                      <td className="px-3 py-2">{l.hodometro == null ? '—' : fmtNum(l.hodometro)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default JpdHodometro;
