import { useMemo, useState } from 'react';
import { Search, Zap } from 'lucide-react';
import { AUTOMACOES_EXEMPLO } from './lib/painelMock';

const AutomacoesTab = () => {
  const [busca, setBusca] = useState('');

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return AUTOMACOES_EXEMPLO;
    return AUTOMACOES_EXEMPLO.filter(
      (a) =>
        a.nome.toLowerCase().includes(q) ||
        (a.descricao ?? '').toLowerCase().includes(q),
    );
  }, [busca]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar automações..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      {filtradas.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 text-center text-gray-500 dark:text-gray-400">
          Nenhuma automação encontrada.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtradas.map((a) => (
            <div key={a.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/30">
                  <Zap className="w-5 h-5 text-amber-500" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{a.nome}</h3>
              </div>
              {a.descricao && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{a.descricao}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AutomacoesTab;
