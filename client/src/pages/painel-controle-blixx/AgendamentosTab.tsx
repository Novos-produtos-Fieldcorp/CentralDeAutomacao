import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Clock, Trash2, User, Loader2, Play } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCurrentAccount } from '../../hooks/useCurrentAccount';
import type { Agendamento, AgendamentoContato, Automacao, Contato, Grupo } from './lib/painelTypes';
import { buscarAutomacoes, buscarContatos, dispararAutomacao } from './lib/painelEdge';
import { buscarGrupos } from './lib/painelGroups';
import {
  buscarAgendamentos,
  cancelarAgendamento,
  criarAgendamento as criarAgendamentoDb,
  removerAgendamento as removerAgendamentoDb,
} from './lib/painelAgendamentos';

const INTERVALO_ENTRE_CONTATOS_MS = 3000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Progresso {
  atual: number;
  total: number;
}

const AgendamentosTab = () => {
  const { companyId } = useCurrentAccount();

  const [automacoes, setAutomacoes] = useState<Automacao[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Progresso de disparo por agendamento (botão Start).
  const [progresso, setProgresso] = useState<Record<string, Progresso>>({});

  const [automacaoId, setAutomacaoId] = useState('');
  const [contatoIds, setContatoIds] = useState<string[]>([]);
  const [grupoIds, setGrupoIds] = useState<string[]>([]);
  const [dataInicio, setDataInicio] = useState('');
  const [horarioInicio, setHorarioInicio] = useState('');

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);
      const [autos, cts, grps, ags] = await Promise.all([
        buscarAutomacoes(),
        buscarContatos(),
        buscarGrupos(companyId ?? null),
        buscarAgendamentos(companyId ?? null),
      ]);
      setAutomacoes(autos);
      setContatos(cts);
      setGrupos(grps);
      setAgendamentos(ags);
    } catch (e) {
      console.error('Erro ao carregar dados de agendamento:', e);
      setErro('Erro ao carregar dados. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }, [companyId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const toggle = (
    id: string,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const podeSalvar =
    automacaoId !== '' &&
    dataInicio !== '' &&
    horarioInicio !== '' &&
    (contatoIds.length > 0 || grupoIds.length > 0);

  // Expande grupos selecionados em seus membros + contatos individuais num
  // único array de { id, name, phone }, sem duplicados por id.
  const montarContatos = (): AgendamentoContato[] => {
    const mapa = new Map<string, AgendamentoContato>();
    for (const gid of grupoIds) {
      const g = grupos.find((x) => x.id === gid);
      g?.membros.forEach((m) => {
        if (!mapa.has(m.id)) {
          mapa.set(m.id, { id: m.id, name: m.nome, phone: m.telefone ?? '' });
        }
      });
    }
    for (const cid of contatoIds) {
      const c = contatos.find((x) => x.id === cid);
      if (c && !mapa.has(c.id)) {
        mapa.set(c.id, { id: c.id, name: c.nome, phone: c.telefone });
      }
    }
    return Array.from(mapa.values());
  };

  const criarAgendamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeSalvar || salvando) return;
    const automacaoName = automacoes.find((a) => a.id === automacaoId)?.nome ?? '';
    const lista = montarContatos();
    if (lista.length === 0) {
      toast.error('Nenhum contato válido selecionado.');
      return;
    }
    try {
      setSalvando(true);
      await criarAgendamentoDb({
        companyId: companyId ?? null,
        automacaoName,
        contatos: lista,
        dataInicio,
        horario: horarioInicio,
      });
      toast.success('Agendamento criado!');
      setAutomacaoId('');
      setContatoIds([]);
      setGrupoIds([]);
      setDataInicio('');
      setHorarioInicio('');
      await carregar();
    } catch (err) {
      console.error('Erro ao criar agendamento:', err);
      toast.error('Erro ao criar agendamento.');
    } finally {
      setSalvando(false);
    }
  };

  const removerAgendamento = async (id: string) => {
    try {
      await removerAgendamentoDb(id);
      setAgendamentos((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error('Erro ao remover agendamento:', err);
      toast.error('Erro ao remover agendamento.');
    }
  };

  // Botão Start: dispara imediatamente (3s por contato, com barra de progresso)
  // e cancela o agendamento (is_active = false) para o cron não disparar de novo.
  const iniciarAgora = async (ag: Agendamento) => {
    if (progresso[ag.id]) return; // já em andamento
    const total = ag.contatos.length;
    if (total === 0) {
      toast.error('Agendamento sem contatos.');
      return;
    }
    setProgresso((p) => ({ ...p, [ag.id]: { atual: 0, total } }));
    let enviados = 0;
    for (let i = 0; i < total; i++) {
      const c = ag.contatos[i];
      try {
        await dispararAutomacao(c, ag.automacaoName);
        enviados++;
      } catch (err) {
        console.error('Erro ao disparar para', c.name, err);
      }
      setProgresso((p) => ({ ...p, [ag.id]: { atual: i + 1, total } }));
      if (i < total - 1) await sleep(INTERVALO_ENTRE_CONTATOS_MS);
    }
    try {
      await cancelarAgendamento(ag.id);
    } catch (err) {
      console.error('Erro ao cancelar agendamento:', err);
    }
    setProgresso((p) => {
      const next = { ...p };
      delete next[ag.id];
      return next;
    });
    toast.success(`Automação disparada para ${enviados}/${total} contato(s).`);
    await carregar();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Form de agendamento */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 h-fit lg:col-span-1">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
          <CalendarClock className="w-5 h-5 text-blue-600" />
          Novo agendamento
        </h2>
        {carregando ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : erro ? (
          <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>
        ) : (
          <form onSubmit={criarAgendamento} className="space-y-4">
            {/* Automação */}
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                Automação
              </label>
              <select
                value={automacaoId}
                onChange={(e) => setAutomacaoId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Selecione...</option>
                {automacoes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Data e horário de início */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Data de início
                </label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Horário
                </label>
                <input
                  type="time"
                  value={horarioInicio}
                  onChange={(e) => setHorarioInicio(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Grupos */}
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Grupos</p>
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                {grupos.length === 0 && (
                  <p className="text-sm text-gray-400">Nenhum grupo criado.</p>
                )}
                {grupos.map((g) => (
                  <label
                    key={g.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={grupoIds.includes(g.id)}
                      onChange={() => toggle(g.id, grupoIds, setGrupoIds)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{g.nome}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Contatos */}
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Contatos</p>
              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {contatos.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={contatoIds.includes(c.id)}
                      onChange={() => toggle(c.id, contatoIds, setContatoIds)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{c.nome}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={!podeSalvar || salvando}
              className="w-full py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
              Agendar
            </button>
          </form>
        )}
      </div>

      {/* Lista de agendamentos */}
      <div className="lg:col-span-2 space-y-2">
        {agendamentos.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 text-center text-gray-500 dark:text-gray-400">
            Nenhum agendamento criado. Escolha uma automação, os contatos/grupos e o horário de início.
          </div>
        ) : (
          agendamentos.map((ag) => {
            const prog = progresso[ag.id];
            const emProgresso = !!prog;
            const pct = prog && prog.total > 0 ? Math.round((prog.atual / prog.total) * 100) : 0;
            return (
              <div key={ag.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <CalendarClock className="w-5 h-5 text-blue-600 shrink-0" />
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {ag.automacaoName}
                    </p>
                    <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      <Clock className="w-3.5 h-3.5" />
                      {ag.dataInicio ? `${ag.dataInicio.split('-').reverse().join('/')} ` : ''}
                      {ag.horario} UTC
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${
                        ag.isActive
                          ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {ag.isActive ? 'Agendado' : 'Disparado'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {ag.isActive && (
                      <button
                        onClick={() => iniciarAgora(ag)}
                        disabled={emProgresso}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label="Disparar agora"
                      >
                        {emProgresso ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        Start
                      </button>
                    )}
                    <button
                      onClick={() => removerAgendamento(ag.id)}
                      disabled={emProgresso}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                      aria-label="Remover agendamento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Barra de progresso do disparo */}
                {emProgresso && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <span>Enviando automação...</span>
                      <span>
                        {prog.atual}/{prog.total}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div
                        className="h-full bg-green-600 transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 mt-2">
                  {ag.contatos.map((c) => (
                    <span
                      key={c.id}
                      className="px-2 py-0.5 rounded-full text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex items-center gap-1"
                    >
                      <User className="w-3 h-3" /> {c.name}
                    </span>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AgendamentosTab;
