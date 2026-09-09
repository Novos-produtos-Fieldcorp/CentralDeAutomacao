import React, { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { capitalizeNome } from './format';
import { OPERACOES } from './jpdEnums';

export type JpdFiltrosValue = {
  placa: string;
  motorista: string;
  operacao: string;
  de: string;
  ate: string;
  busca: string;
};

export const EMPTY_FILTROS: JpdFiltrosValue = { placa: '', motorista: '', operacao: '', de: '', ate: '', busca: '' };

type Campo = 'placa' | 'motorista' | 'operacao' | 'periodo' | 'busca';

interface Props {
  value: JpdFiltrosValue;
  onChange: (v: JpdFiltrosValue) => void;
  /** Quais campos exibir; padrão: todos. */
  campos?: Campo[];
  /** Rótulo do período (ex.: "Data da carga", "Lançamento"). */
  periodoLabel?: string;
}

const inputCls =
  'border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-white';

const JpdFiltros: React.FC<Props> = ({
  value,
  onChange,
  campos = ['placa', 'motorista', 'periodo', 'busca'],
  periodoLabel = 'Período',
}) => {
  const [opcoes, setOpcoes] = useState<{ veiculos: string[]; motoristas: string[] }>({
    veiculos: [],
    motoristas: [],
  });

  const precisaOpcoes = campos.includes('placa') || campos.includes('motorista');

  useEffect(() => {
    if (!precisaOpcoes) return;
    (async () => {
      try {
        const res = await fetch('/api/jpd/opcoes');
        if (res.ok) setOpcoes(await res.json());
      } catch {
        /* opções vazias */
      }
    })();
  }, [precisaOpcoes]);

  const set = (k: keyof JpdFiltrosValue, v: string) => onChange({ ...value, [k]: v });

  const temFiltro = campos.some((c) =>
    c === 'periodo' ? value.de || value.ate : value[c as keyof JpdFiltrosValue],
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-wrap items-end gap-3">
      {campos.includes('placa') && (
        <label className="flex flex-col text-xs text-gray-600 dark:text-gray-300">
          <span className="mb-1">Placa</span>
          <select value={value.placa} onChange={(e) => set('placa', e.target.value)} className={inputCls}>
            <option value="">Todas</option>
            {opcoes.veiculos.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      )}

      {campos.includes('motorista') && (
        <label className="flex flex-col text-xs text-gray-600 dark:text-gray-300">
          <span className="mb-1">Motorista</span>
          <select value={value.motorista} onChange={(e) => set('motorista', e.target.value)} className={inputCls}>
            <option value="">Todos</option>
            {opcoes.motoristas.map((m) => (
              <option key={m} value={m}>
                {capitalizeNome(m)}
              </option>
            ))}
          </select>
        </label>
      )}

      {campos.includes('operacao') && (
        <label className="flex flex-col text-xs text-gray-600 dark:text-gray-300">
          <span className="mb-1">Operação</span>
          <select value={value.operacao} onChange={(e) => set('operacao', e.target.value)} className={inputCls}>
            <option value="">Todas</option>
            {OPERACOES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      )}

      {campos.includes('periodo') && (
        <>
          <label className="flex flex-col text-xs text-gray-600 dark:text-gray-300">
            <span className="mb-1">{periodoLabel} — de</span>
            <input type="date" value={value.de} onChange={(e) => set('de', e.target.value)} className={inputCls} />
          </label>
          <label className="flex flex-col text-xs text-gray-600 dark:text-gray-300">
            <span className="mb-1">Até</span>
            <input type="date" value={value.ate} onChange={(e) => set('ate', e.target.value)} className={inputCls} />
          </label>
        </>
      )}

      {campos.includes('busca') && (
        <label className="flex flex-col text-xs text-gray-600 dark:text-gray-300 flex-1 min-w-[180px]">
          <span className="mb-1">Busca</span>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={value.busca}
              onChange={(e) => set('busca', e.target.value)}
              placeholder="Digite para buscar..."
              className={`${inputCls} w-full pl-8`}
            />
          </div>
        </label>
      )}

      {temFiltro && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTROS)}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md text-sm hover:bg-gray-200"
        >
          <X className="w-4 h-4" /> Limpar
        </button>
      )}
    </div>
  );
};

export default JpdFiltros;
