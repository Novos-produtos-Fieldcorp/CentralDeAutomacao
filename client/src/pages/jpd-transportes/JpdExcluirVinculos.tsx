import React, { useState } from 'react';
import { Loader2, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtDataBR, fmtDataHoraBR, upperPlaca, capitalizeNome } from './format';
import { AcaoExclusao, TipoCadastro, Vinculos } from './jpdCadastro';

export type DestinoOption = { value: string; label: string };

interface Props {
  tipo: TipoCadastro;
  /** Texto já formatado do item que será excluído (ex.: "SKK2J31", "João Silva"). */
  rotulo: string;
  vinculos: Vinculos;
  /** Itens para os quais os vínculos podem ser transferidos (sem o item atual). */
  destinos: DestinoOption[];
  onConfirmar: (acao: AcaoExclusao) => Promise<void>;
  onClose: () => void;
}

const inputCls =
  'border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-white';

const JpdExcluirVinculos: React.FC<Props> = ({ tipo, rotulo, vinculos, destinos, onConfirmar, onClose }) => {
  const [para, setPara] = useState('');
  const [executando, setExecutando] = useState<'reatribuir' | 'excluir' | null>(null);
  const nomeTipo = tipo === 'placa' ? 'placa' : 'motorista';

  const executar = async (acao: AcaoExclusao) => {
    setExecutando(acao.acao);
    try {
      await onConfirmar(acao);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir');
    } finally {
      setExecutando(null);
    }
  };

  const excluirTudo = () => {
    const total = vinculos.fretes.length + vinculos.abastecimentos.length;
    if (
      !window.confirm(
        `Excluir "${rotulo}" e também ${total} item(ns) vinculado(s)? Os BVs e lançamentos serão apagados definitivamente.`,
      )
    )
      return;
    executar({ acao: 'excluir' });
  };

  const th = 'px-2 py-1 text-left font-medium';
  const td = 'px-2 py-1';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-base font-semibold text-gray-800 dark:text-white">
              Não é possível excluir {nomeTipo === 'placa' ? 'a placa' : 'o motorista'} "{rotulo}" ainda
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ele possui vínculos. Vincule-os a {nomeTipo === 'placa' ? 'outra placa' : 'outro motorista'} ou exclua
              o item junto com os vínculos.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0" title="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 text-sm text-gray-800 dark:text-gray-200">
          {vinculos.fretes.length > 0 && (
            <div>
              <p className="font-semibold mb-1">Boletins de viagem ({vinculos.fretes.length})</p>
              <div className="overflow-x-auto max-h-48 overflow-y-auto border border-gray-100 dark:border-gray-700 rounded-md">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    <tr>
                      <th className={th}>BV</th>
                      <th className={th}>Data do BV</th>
                      <th className={th}>{tipo === 'placa' ? 'Motorista' : 'Placa'}</th>
                      <th className={th}>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vinculos.fretes.map((f) => (
                      <tr key={f.id} className="border-t border-gray-100 dark:border-gray-700">
                        <td className={td}>{f.numero_do_bv || `#${f.id}`}</td>
                        <td className={td}>{fmtDataBR(f.data_do_bv) || '—'}</td>
                        <td className={td}>
                          {tipo === 'placa' ? capitalizeNome(f.motorista) || '—' : upperPlaca(f.placa_do_carro) || '—'}
                        </td>
                        <td className={td}>
                          {f.situacao_do_bv || '—'}
                          {f.deleted_at ? ' (na lixeira)' : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {vinculos.abastecimentos.length > 0 && (
            <div>
              <p className="font-semibold mb-1">Lançamentos de abastecimento ({vinculos.abastecimentos.length})</p>
              <div className="overflow-x-auto max-h-48 overflow-y-auto border border-gray-100 dark:border-gray-700 rounded-md">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    <tr>
                      <th className={th}>Lançado em</th>
                      <th className={th}>Placa</th>
                      <th className={th}>Fornecedor</th>
                      <th className={th}>Litros</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vinculos.abastecimentos.map((a) => (
                      <tr key={a.id} className="border-t border-gray-100 dark:border-gray-700">
                        <td className={td}>{fmtDataHoraBR(a.created_at) || '—'}</td>
                        <td className={td}>{upperPlaca(a.placa) || '—'}</td>
                        <td className={td}>{a.fornecedor || '—'}</td>
                        <td className={td}>{a.litros ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3 space-y-2">
            <p className="font-semibold">
              Vincular a {nomeTipo === 'placa' ? 'outra placa' : 'outro motorista'} e excluir "{rotulo}"
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={para}
                onChange={(e) => setPara(e.target.value)}
                disabled={!!executando}
                className={inputCls}
              >
                <option value="">Selecione {nomeTipo === 'placa' ? 'a placa' : 'o motorista'}</option>
                {destinos.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => executar({ acao: 'reatribuir', para })}
                disabled={!para || !!executando}
                className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {executando === 'reatribuir' && <Loader2 className="w-4 h-4 animate-spin" />}
                Vincular e excluir
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-between gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={excluirTudo}
            disabled={!!executando}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-rose-600 text-white rounded-md text-sm hover:bg-rose-700 disabled:opacity-60"
          >
            {executando === 'excluir' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Excluir {nomeTipo === 'placa' ? 'a placa' : 'o motorista'} e os vínculos
          </button>
          <button
            onClick={onClose}
            disabled={!!executando}
            className="px-4 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md text-sm hover:bg-gray-200"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default JpdExcluirVinculos;
