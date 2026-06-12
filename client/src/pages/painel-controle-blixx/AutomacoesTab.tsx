import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Zap, RefreshCw, Loader2 } from 'lucide-react';
import type { Automacao } from './lib/painelTypes';
import { buscarAutomacoes } from './lib/painelEdge';

const AutomacoesTab = () => {
  const [automacoes, setAutomacoes] = useState<Automacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);
      const dados = await buscarAutomacoes();
      setAutomacoes(dados);
    } catch (e) {
      console.error('Erro ao buscar automações:', e);
      setErro('Erro ao carregar automações. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return automacoes;
    return automacoes.filter(
      (a) =>
        a.nome.toLowerCase().includes(q) ||
        (a.descricao ?? '').toLowerCase().includes(q),
    );
  }, [automacoes, busca]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar automações..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <button
          onClick={carregar}
          disabled={carregando}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          aria-label="Recarregar"
        >
          <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {carregando ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" /> Carregando automações...
        </div>
      ) : erro ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 text-center text-red-600 dark:text-red-400">
          {erro}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 text-center text-gray-500 dark:text-gray-400">
          Nenhuma automação encontrada.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtradas.map((a) => (
            <div key={a.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/30">
                  <Zap className="w-5 h-5 text-amber-500" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{a.nome || '—'}</h3>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AutomacoesTab;
