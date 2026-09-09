import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import JpdConsumoCards, { Consumo } from './JpdConsumoCards';
import JpdAbastecimentos from './JpdAbastecimentos';
import JpdGerarLancamento from './JpdGerarLancamento';
import JpdFiltros, { EMPTY_FILTROS, JpdFiltrosValue } from './JpdFiltros';
import { fmtBRL, fmtNum, capitalizeNome } from './format';

type Resumo = {
  placa: string;
  viagens: number;
  faturado: number;
  frete: number;
  km: number;
  combustivel: number;
  ultimo_bv: string;
  operacoes: string[];
};
type EmAndamento = {
  id: number;
  placa: string;
  motorista: string;
  origem: string;
  destinatario: string;
  data: string;
};

const linkCls = 'text-blue-600 dark:text-blue-400 hover:underline font-medium';

const JpdVeiculos = () => {
  const [resumo, setResumo] = useState<Resumo[]>([]);
  const [emAndamento, setEmAndamento] = useState<EmAndamento[]>([]);
  const [consumo, setConsumo] = useState<Consumo | null>(null);
  const [loading, setLoading] = useState(false);
  const [aba, setAba] = useState<'resumo' | 'lancamentos'>('resumo');
  const [showGerar, setShowGerar] = useState(false);
  const [lancKey, setLancKey] = useState(0);
  const [filtros, setFiltros] = useState<JpdFiltrosValue>(EMPTY_FILTROS);

  const resumoFiltrado = useMemo(() => {
    const termo = filtros.busca.trim().toLowerCase();
    return resumo.filter((v) => {
      if (filtros.placa && v.placa !== filtros.placa) return false;
      if (filtros.operacao && !(v.operacoes || []).includes(filtros.operacao)) return false;
      if (termo && !String(v.placa).toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [resumo, filtros.placa, filtros.operacao, filtros.busca]);

  const emAndamentoFiltrado = useMemo(() => {
    const termo = filtros.busca.trim().toLowerCase();
    return emAndamento.filter((v) => {
      if (filtros.placa && v.placa !== filtros.placa) return false;
      if (filtros.motorista && v.motorista !== filtros.motorista) return false;
      if (termo) {
        const alvo = [v.placa, v.motorista, v.origem, v.destinatario]
          .map((x) => (x == null ? '' : String(x).toLowerCase()))
          .join(' ');
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [emAndamento, filtros.placa, filtros.motorista, filtros.busca]);

  const load = useCallback(async (f: JpdFiltrosValue) => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (f.placa) p.set('f_placa', f.placa);
      if (f.motorista) p.set('f_motorista', f.motorista);
      if (f.busca.trim()) p.set('f_busca', f.busca.trim());
      const qs = p.toString();
      const res = await fetch(`/api/jpd/veiculos${qs ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error('Falha ao carregar veículos');
      const json = await res.json();
      setResumo(json.resumo || []);
      setEmAndamento(json.em_andamento || []);
      setConsumo(json.consumo || null);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar veículos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Debounce (por causa do campo de texto Busca) e refetch quando os filtros mudam,
    // para recalcular os cards de "Consumo da frota" no backend.
    const t = setTimeout(() => load(filtros), 300);
    return () => clearTimeout(t);
  }, [load, filtros.placa, filtros.motorista, filtros.busca]);

  const subTabCls = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-sm font-medium ${
      active
        ? 'bg-blue-600 text-white'
        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200'
    }`;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400 font-semibold">Frota</p>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Veículos</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Clique em uma placa para ver todas as viagens daquele veículo.
        </p>
      </div>

      <JpdConsumoCards consumo={consumo} title="Consumo da frota" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button className={subTabCls(aba === 'resumo')} onClick={() => setAba('resumo')}>
            Resumo
          </button>
          <button className={subTabCls(aba === 'lancamentos')} onClick={() => setAba('lancamentos')}>
            Lançamentos
          </button>
        </div>
        <button
          onClick={() => setShowGerar(true)}
          className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-600 text-white rounded-md text-sm hover:bg-emerald-700"
        >
          <Upload className="w-4 h-4" /> Gerar lançamento
        </button>
      </div>

      {aba === 'lancamentos' ? (
        <JpdAbastecimentos key={lancKey} />
      ) : (
      <>
      <JpdFiltros value={filtros} onChange={setFiltros} campos={['placa', 'motorista', 'operacao', 'busca']} />
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-2">
          Viagens em andamento
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            {emAndamentoFiltrado.length}
          </span>
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Viagens com BV mas sem data de descarga preenchida.</p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              <tr>
                <th className="px-3 py-2 text-left">Placa</th>
                <th className="px-3 py-2 text-left">Motorista</th>
                <th className="px-3 py-2 text-left">Origem</th>
                <th className="px-3 py-2 text-left">Destinatário</th>
                <th className="px-3 py-2 text-left">Data da carga</th>
              </tr>
            </thead>
            <tbody className="text-gray-800 dark:text-gray-200">
              {emAndamentoFiltrado.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                    {loading ? 'Carregando...' : 'Nenhuma viagem em andamento.'}
                  </td>
                </tr>
              ) : (
                emAndamentoFiltrado.map((v) => (
                  <tr key={v.id} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-3 py-2">
                      <Link to={`/jpd-transportes/veiculos/${encodeURIComponent(v.placa)}`} className={linkCls}>
                        {v.placa}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{capitalizeNome(v.motorista)}</td>
                    <td className="px-3 py-2">{v.origem}</td>
                    <td className="px-3 py-2">{v.destinatario}</td>
                    <td className="px-3 py-2">{v.data}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Resumo por veículo</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
              <tr>
                <th className="px-3 py-2 text-left">Placa</th>
                <th className="px-3 py-2 text-left">Viagens</th>
                <th className="px-3 py-2 text-left">Valor faturado</th>
                <th className="px-3 py-2 text-left">KM total</th>
                <th className="px-3 py-2 text-left">Combustível JPD</th>
                <th className="px-3 py-2 text-left">Último BV</th>
              </tr>
            </thead>
            <tbody className="text-gray-800 dark:text-gray-200">
              {resumoFiltrado.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                    {loading ? 'Carregando...' : 'Nenhum veículo com fretes lançados.'}
                  </td>
                </tr>
              ) : (
                resumoFiltrado.map((v) => (
                  <tr key={v.placa} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-3 py-2">
                      <Link to={`/jpd-transportes/veiculos/${encodeURIComponent(v.placa)}`} className={linkCls}>
                        {v.placa}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{v.viagens}</td>
                    <td className="px-3 py-2">{fmtBRL(v.faturado)}</td>
                    <td className="px-3 py-2">{fmtNum(v.km)}</td>
                    <td className="px-3 py-2">{fmtBRL(v.combustivel)}</td>
                    <td className="px-3 py-2">{v.ultimo_bv}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {showGerar && (
        <JpdGerarLancamento
          onClose={() => setShowGerar(false)}
          onSaved={() => {
            setShowGerar(false);
            load(filtros);
            setLancKey((k) => k + 1); // força recarga da tabela de Lançamentos
          }}
        />
      )}
    </div>
  );
};

export default JpdVeiculos;
