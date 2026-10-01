import React, { useCallback, useEffect, useState } from 'react';
import { Search, X, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { capitalizeNome, upperPlaca } from './format';
import { OPERACOES } from './jpdEnums';
import JpdExcluirVinculos from './JpdExcluirVinculos';
import { AcaoExclusao, TipoCadastro, Vinculos, VinculosError, excluirCadastro } from './jpdCadastro';

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

  // Motoristas com id: a exclusão/reatribuição no backend é feita por id.
  const [motoristasId, setMotoristasId] = useState<{ id: number; nome: string }[]>([]);
  const [exclusao, setExclusao] = useState<{ tipo: TipoCadastro; valor: string; vinculos: Vinculos } | null>(null);

  const precisaOpcoes = campos.includes('placa') || campos.includes('motorista');

  const carregarOpcoes = useCallback(async () => {
    try {
      const [resOpc, resMot] = await Promise.all([fetch('/api/jpd/opcoes'), fetch('/api/jpd/motoristas')]);
      if (resOpc.ok) setOpcoes(await resOpc.json());
      if (resMot.ok) setMotoristasId(await resMot.json());
    } catch {
      /* opções vazias */
    }
  }, []);

  useEffect(() => {
    if (precisaOpcoes) carregarOpcoes();
  }, [precisaOpcoes, carregarOpcoes]);

  // Placa: o valor do filtro é a placa; motorista: o valor é o nome (a API usa o id).
  const idDoCadastro = (tipo: TipoCadastro, valor: string) =>
    tipo === 'placa' ? valor : String(motoristasId.find((m) => m.nome === valor)?.id ?? '');

  const executarExclusao = async (tipo: TipoCadastro, valor: string, acao?: AcaoExclusao) => {
    let acaoApi = acao;
    if (acao?.acao === 'reatribuir' && tipo === 'motorista') {
      acaoApi = { acao: 'reatribuir', para: idDoCadastro('motorista', acao.para) };
    }
    await excluirCadastro(tipo, idDoCadastro(tipo, valor), acaoApi);
    setExclusao(null);
    onChange({ ...value, [tipo]: '' });
    carregarOpcoes();
  };

  const excluirSelecionado = async (tipo: TipoCadastro) => {
    const valor = value[tipo];
    const rotulo = tipo === 'placa' ? upperPlaca(valor) : capitalizeNome(valor);
    if (!window.confirm(`Excluir "${rotulo}"? Isso remove o cadastro.`)) return;
    try {
      await executarExclusao(tipo, valor);
      toast.success('Excluído');
    } catch (err: any) {
      if (err instanceof VinculosError) setExclusao({ tipo, valor, vinculos: err.vinculos });
      else toast.error(err.message || 'Erro ao excluir');
    }
  };

  const lixeiraBtn = (tipo: TipoCadastro) =>
    value[tipo] ? (
      <button
        type="button"
        onClick={() => excluirSelecionado(tipo)}
        className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400"
        title={tipo === 'placa' ? 'Excluir placa' : 'Excluir motorista'}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    ) : null;

  const set = (k: keyof JpdFiltrosValue, v: string) => onChange({ ...value, [k]: v });

  const temFiltro = campos.some((c) =>
    c === 'periodo' ? value.de || value.ate : value[c as keyof JpdFiltrosValue],
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-wrap items-end gap-3">
      {campos.includes('placa') && (
        <label className="flex flex-col text-xs text-gray-600 dark:text-gray-300">
          <span className="mb-1">Placa</span>
          <div className="flex items-center">
            <select value={value.placa} onChange={(e) => set('placa', e.target.value)} className={inputCls}>
              <option value="">Todas</option>
              {opcoes.veiculos.map((p) => (
                <option key={p} value={p}>
                  {upperPlaca(p)}
                </option>
              ))}
            </select>
            {lixeiraBtn('placa')}
          </div>
        </label>
      )}

      {campos.includes('motorista') && (
        <label className="flex flex-col text-xs text-gray-600 dark:text-gray-300">
          <span className="mb-1">Motorista</span>
          <div className="flex items-center">
            <select value={value.motorista} onChange={(e) => set('motorista', e.target.value)} className={inputCls}>
              <option value="">Todos</option>
              {opcoes.motoristas.map((m) => (
                <option key={m} value={m}>
                  {capitalizeNome(m)}
                </option>
              ))}
            </select>
            {lixeiraBtn('motorista')}
          </div>
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

      {exclusao && (
        <JpdExcluirVinculos
          tipo={exclusao.tipo}
          rotulo={exclusao.tipo === 'placa' ? upperPlaca(exclusao.valor) : capitalizeNome(exclusao.valor)}
          vinculos={exclusao.vinculos}
          destinos={(exclusao.tipo === 'placa' ? opcoes.veiculos : opcoes.motoristas)
            .filter((x) => x !== exclusao.valor)
            .map((x) => ({ value: x, label: exclusao.tipo === 'placa' ? upperPlaca(x) : capitalizeNome(x) }))}
          onConfirmar={(acao) => executarExclusao(exclusao.tipo, exclusao.valor, acao)}
          onClose={() => setExclusao(null)}
        />
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
