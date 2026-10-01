import React, { useEffect, useState } from 'react';
import { Loader2, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtDataBR, fmtDataHoraBR, upperPlaca, capitalizeNome } from './format';
import { AcaoExclusao, TipoCadastro, Vinculos, VinculosError } from './jpdCadastro';

export type DestinoOption = { value: string; label: string };

interface Props {
  tipo: TipoCadastro;
  /** Texto já formatado do item que será excluído (ex.: "SKK2J31", "João Silva"). */
  rotulo: string;
  vinculos: Vinculos;
  /** Identificador do item na API (placa minúscula ou id do motorista); fica fora dos destinos por linha. */
  apiId: string;
  /** Destinos para "vincular todos de uma vez" (valores no formato esperado por `onConfirmar`). */
  destinos: DestinoOption[];
  /** Sem `acao`: exclui só o cadastro (quando todos os vínculos já foram movidos). */
  onConfirmar: (acao?: AcaoExclusao) => Promise<void>;
  onClose: () => void;
}

type Destinos = { placas: string[]; motoristas: { id: number; nome: string }[] };

const inputCls =
  'border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-white';
const miniSelCls =
  'border border-gray-300 dark:border-gray-600 rounded-md px-1.5 py-0.5 text-xs bg-white dark:bg-gray-700 dark:text-white';

const JpdExcluirVinculos: React.FC<Props> = ({ tipo, rotulo, vinculos, apiId, destinos, onConfirmar, onClose }) => {
  const [fretes, setFretes] = useState(vinculos.fretes);
  const [abasts, setAbasts] = useState(vinculos.abastecimentos);
  const [para, setPara] = useState('');
  const [executando, setExecutando] = useState<'reatribuir' | 'excluir' | 'final' | null>(null);
  const [linhaDestino, setLinhaDestino] = useState<Record<string, string>>({});
  const [movendo, setMovendo] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState('');
  const [lista, setLista] = useState<Destinos>({ placas: [], motoristas: [] });
  const nomeTipo = tipo === 'placa' ? 'placa' : 'motorista';

  // Destinos por linha: carregados aqui para termos placa/nome e id de cada opção.
  useEffect(() => {
    (async () => {
      try {
        const [rOpc, rMot] = await Promise.all([fetch('/api/jpd/opcoes'), fetch('/api/jpd/motoristas')]);
        const opc = rOpc.ok ? await rOpc.json() : { veiculos: [] };
        const mots = rMot.ok ? await rMot.json() : [];
        setLista({ placas: opc.veiculos || [], motoristas: mots });
      } catch {
        /* sem opções por linha; as ações em lote continuam disponíveis */
      }
    })();
  }, []);

  const opcoesLinha: DestinoOption[] =
    tipo === 'placa'
      ? lista.placas.filter((p) => p !== apiId).map((p) => ({ value: p, label: upperPlaca(p) }))
      : lista.motoristas.filter((m) => String(m.id) !== apiId).map((m) => ({ value: String(m.id), label: capitalizeNome(m.nome) }));

  const nomeMotorista = (id: any) => {
    const m = lista.motoristas.find((x) => String(x.id) === String(id));
    return m ? capitalizeNome(m.nome) : '—';
  };

  // Falha ao excluir: se o servidor devolveu os vínculos atuais, atualiza as listas
  // (o que sobrou) e mostra o motivo original do banco.
  const tratarFalha = (err: any) => {
    if (err instanceof VinculosError) {
      setFretes(err.vinculos.fretes);
      setAbasts(err.vinculos.abastecimentos);
      setDetalhe(err.detalhe || err.message);
    } else {
      toast.error(err.message || 'Erro ao excluir');
    }
  };

  const executar = async (acao: AcaoExclusao) => {
    setExecutando(acao.acao);
    try {
      await onConfirmar(acao);
    } catch (err: any) {
      tratarFalha(err);
    } finally {
      setExecutando(null);
    }
  };

  const excluirTudo = () => {
    const total = fretes.length + abasts.length;
    if (
      !window.confirm(
        `Excluir "${rotulo}" e também ${total} item(ns) vinculado(s)? Os BVs e lançamentos serão apagados definitivamente.`,
      )
    )
      return;
    executar({ acao: 'excluir' });
  };

  // Move um único BV/lançamento para outra placa/motorista.
  const moverLinha = async (kind: 'frete' | 'abast', id: number) => {
    const key = `${kind}:${id}`;
    const destino = linhaDestino[key];
    if (!destino) return;
    let body: Record<string, any>;
    if (tipo === 'placa') {
      body = kind === 'frete' ? { placa_do_carro: destino } : { placa: destino };
    } else {
      const m = lista.motoristas.find((x) => String(x.id) === destino);
      if (!m) return;
      body = kind === 'frete' ? { motorista: m.nome } : { motorista_id: m.id };
    }
    setMovendo(key);
    try {
      const res = await fetch(`/api/jpd/${kind === 'frete' ? 'fretes' : 'abastecimentos'}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao vincular');
      }
      if (kind === 'frete') setFretes((cur) => cur.filter((f) => f.id !== id));
      else setAbasts((cur) => cur.filter((a) => a.id !== id));
      toast.success('Vínculo atualizado');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao vincular');
    } finally {
      setMovendo(null);
    }
  };

  const excluirCadastroFinal = async () => {
    setExecutando('final');
    try {
      await onConfirmar();
    } catch (err: any) {
      tratarFalha(err);
    } finally {
      setExecutando(null);
    }
  };

  const seletorLinha = (kind: 'frete' | 'abast', id: number) => {
    const key = `${kind}:${id}`;
    return (
      <div className="flex items-center gap-1">
        <select
          value={linhaDestino[key] || ''}
          onChange={(e) => setLinhaDestino((cur) => ({ ...cur, [key]: e.target.value }))}
          disabled={!!movendo || !!executando}
          className={miniSelCls}
        >
          <option value="">{tipo === 'placa' ? 'Nova placa' : 'Novo motorista'}</option>
          {opcoesLinha.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => moverLinha(kind, id)}
          disabled={!linhaDestino[key] || !!movendo || !!executando}
          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {movendo === key && <Loader2 className="w-3 h-3 animate-spin" />}
          Vincular
        </button>
      </div>
    );
  };

  const th = 'px-2 py-1 text-left font-medium';
  const td = 'px-2 py-1';
  const restantes = fretes.length + abasts.length;
  const alvo = nomeTipo === 'placa' ? 'outra placa' : 'outro motorista';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-base font-semibold text-gray-800 dark:text-white">
              {restantes > 0
                ? `Não é possível excluir ${nomeTipo === 'placa' ? 'a placa' : 'o motorista'} "${rotulo}" ainda`
                : `Pronto para excluir "${rotulo}"`}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {restantes > 0
                ? `Ele possui vínculos. Vincule cada item a ${alvo} (ou todos de uma vez), ou exclua o item junto com os vínculos.`
                : 'Todos os vínculos foram movidos. Agora é possível excluir o cadastro.'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0" title="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 text-sm text-gray-800 dark:text-gray-200">
          {detalhe && (
            <div className="rounded-md border border-rose-300 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-700 p-3 text-xs text-rose-700 dark:text-rose-300">
              <p className="font-semibold mb-1">O banco ainda bloqueia a exclusão:</p>
              <p className="break-words">{detalhe}</p>
              {restantes === 0 && (
                <p className="mt-1">
                  Nenhum BV ou lançamento foi encontrado — outro cadastro ainda referencia este item (veja a restrição acima).
                </p>
              )}
            </div>
          )}
          {fretes.length > 0 && (
            <div>
              <p className="font-semibold mb-1">Boletins de viagem ({fretes.length})</p>
              <div className="overflow-x-auto max-h-60 overflow-y-auto border border-gray-100 dark:border-gray-700 rounded-md">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    <tr>
                      <th className={th}>BV</th>
                      <th className={th}>Data do BV</th>
                      <th className={th}>Placa</th>
                      <th className={th}>Motorista</th>
                      <th className={th}>Situação</th>
                      <th className={th}>Vincular a {alvo}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fretes.map((f) => (
                      <tr key={f.id} className="border-t border-gray-100 dark:border-gray-700">
                        <td className={td}>{f.numero_do_bv || `#${f.id}`}</td>
                        <td className={td}>{fmtDataBR(f.data_do_bv) || '—'}</td>
                        <td className={td}>{upperPlaca(f.placa_do_carro) || '—'}</td>
                        <td className={td}>{capitalizeNome(f.motorista) || '—'}</td>
                        <td className={td}>{f.situacao_do_bv || '—'}</td>
                        <td className={td}>
                          {f.deleted_at ? (
                            <span className="text-gray-500">Na lixeira — use as opções abaixo</span>
                          ) : (
                            seletorLinha('frete', f.id)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {abasts.length > 0 && (
            <div>
              <p className="font-semibold mb-1">Lançamentos de abastecimento ({abasts.length})</p>
              <div className="overflow-x-auto max-h-60 overflow-y-auto border border-gray-100 dark:border-gray-700 rounded-md">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    <tr>
                      <th className={th}>Lançado em</th>
                      <th className={th}>BV vinculado</th>
                      <th className={th}>Placa</th>
                      <th className={th}>Motorista</th>
                      <th className={th}>Fornecedor</th>
                      <th className={th}>Vincular a {alvo}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {abasts.map((a) => (
                      <tr key={a.id} className="border-t border-gray-100 dark:border-gray-700">
                        <td className={td}>{fmtDataHoraBR(a.created_at) || '—'}</td>
                        <td className={td}>{a.numero_do_bv || (a.frete_id ? `#${a.frete_id}` : '—')}</td>
                        <td className={td}>{upperPlaca(a.placa) || '—'}</td>
                        <td className={td}>{nomeMotorista(a.motorista_id)}</td>
                        <td className={td}>{a.fornecedor || '—'}</td>
                        <td className={td}>{seletorLinha('abast', a.id)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {restantes > 0 && (
            <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3 space-y-2">
              <p className="font-semibold">
                Vincular todos a {alvo} e excluir "{rotulo}"
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={para}
                  onChange={(e) => setPara(e.target.value)}
                  disabled={!!executando || !!movendo}
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
                  disabled={!para || !!executando || !!movendo}
                  className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-60"
                >
                  {executando === 'reatribuir' && <Loader2 className="w-4 h-4 animate-spin" />}
                  Vincular todos e excluir
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-between gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          {restantes > 0 ? (
            <button
              onClick={excluirTudo}
              disabled={!!executando || !!movendo}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-rose-600 text-white rounded-md text-sm hover:bg-rose-700 disabled:opacity-60"
            >
              {executando === 'excluir' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Excluir {nomeTipo === 'placa' ? 'a placa' : 'o motorista'} e os vínculos
            </button>
          ) : (
            <button
              onClick={excluirCadastroFinal}
              disabled={!!executando}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-rose-600 text-white rounded-md text-sm hover:bg-rose-700 disabled:opacity-60"
            >
              {executando === 'final' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Excluir {nomeTipo === 'placa' ? 'a placa' : 'o motorista'}
            </button>
          )}
          <button
            onClick={onClose}
            disabled={!!executando || !!movendo}
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
