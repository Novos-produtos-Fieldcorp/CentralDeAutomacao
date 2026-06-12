import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Clock, Trash2, Users, User, Loader2 } from 'lucide-react';
import { useCurrentAccount } from '../../hooks/useCurrentAccount';
import type { Agendamento, Automacao, Contato, Grupo } from './lib/painelTypes';
import { buscarAutomacoes, buscarContatos } from './lib/painelEdge';
import { buscarGrupos } from './lib/painelGroups';

const AgendamentosTab = () => {
  const { companyId } = useCurrentAccount();

  const [automacoes, setAutomacoes] = useState<Automacao[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Agendamentos ainda locais — rota de atribuir/iniciar automação será integrada depois.
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [automacaoId, setAutomacaoId] = useState('');
  const [contatoIds, setContatoIds] = useState<string[]>([]);
  const [grupoIds, setGrupoIds] = useState<string[]>([]);
  const [dataInicio, setDataInicio] = useState('');
  const [horarioInicio, setHorarioInicio] = useState('');

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);
      const [autos, cts, grps] = await Promise.all([
        buscarAutomacoes(),
        buscarContatos(),
        buscarGrupos(companyId ?? null),
      ]);
      setAutomacoes(autos);
      setContatos(cts);
      setGrupos(grps);
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

  const criarAgendamento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeSalvar) return;
    const novo: Agendamento = {
      id: `ag-${agendamentos.length + 1}`,
      automacaoId,
      contatoIds,
      grupoIds,
      dataInicio,
      horarioInicio,
      criadoEm: new Date().toISOString().slice(0, 10),
    };
    setAgendamentos((prev) => [novo, ...prev]);
    setAutomacaoId('');
    setContatoIds([]);
    setGrupoIds([]);
    setDataInicio('');
    setHorarioInicio('');
  };

  const removerAgendamento = (id: string) => {
    setAgendamentos((prev) => prev.filter((a) => a.id !== id));
  };

  const nomeAutomacao = (id: string) => automacoes.find((a) => a.id === id)?.nome ?? id;
  const nomeContato = (id: string) => contatos.find((c) => c.id === id)?.nome ?? id;
  const nomeGrupo = (id: string) => grupos.find((g) => g.id === id)?.nome ?? id;

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
              disabled={!podeSalvar}
              className="w-full py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
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
          agendamentos.map((ag) => (
            <div key={ag.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <CalendarClock className="w-5 h-5 text-blue-600 shrink-0" />
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {nomeAutomacao(ag.automacaoId)}
                  </p>
                  <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    <Clock className="w-3.5 h-3.5" />
                    {ag.dataInicio ? `${ag.dataInicio.split('-').reverse().join('/')} ` : ''}
                    {ag.horarioInicio}
                  </span>
                </div>
                <button
                  onClick={() => removerAgendamento(ag.id)}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  aria-label="Remover agendamento"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {ag.grupoIds.map((id) => (
                  <span
                    key={id}
                    className="px-2 py-0.5 rounded-full text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 flex items-center gap-1"
                  >
                    <Users className="w-3 h-3" /> {nomeGrupo(id)}
                  </span>
                ))}
                {ag.contatoIds.map((id) => (
                  <span
                    key={id}
                    className="px-2 py-0.5 rounded-full text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex items-center gap-1"
                  >
                    <User className="w-3 h-3" /> {nomeContato(id)}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AgendamentosTab;
