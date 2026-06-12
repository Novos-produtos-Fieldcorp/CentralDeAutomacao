import { useState } from 'react';
import { Users, FolderPlus, Trash2 } from 'lucide-react';
import type { Grupo } from './lib/painelTypes';
import { CONTATOS_EXEMPLO } from './lib/painelMock';

const GruposTab = () => {
  const contatos = CONTATOS_EXEMPLO;
  const [grupos, setGrupos] = useState<Grupo[]>([
    { id: 'g1', nome: 'Equipe SP', contatoIds: ['c1', 'c2'], criadoEm: '2026-06-05' },
  ]);
  const [nome, setNome] = useState('');
  const [selecionados, setSelecionados] = useState<string[]>([]);

  const toggleContato = (id: string) => {
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const criarGrupo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || selecionados.length === 0) return;
    const novo: Grupo = {
      id: `g-${grupos.length + 1}-${nome.slice(0, 3)}`,
      nome: nome.trim(),
      contatoIds: selecionados,
      criadoEm: new Date().toISOString().slice(0, 10),
    };
    setGrupos((prev) => [novo, ...prev]);
    setNome('');
    setSelecionados([]);
  };

  const removerGrupo = (id: string) => {
    setGrupos((prev) => prev.filter((g) => g.id !== id));
  };

  const nomeContato = (id: string) => contatos.find((c) => c.id === id)?.nome ?? id;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Form criar grupo */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 h-fit">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
          <FolderPlus className="w-5 h-5 text-blue-600" />
          Criar grupo
        </h2>
        <form onSubmit={criarGrupo} className="space-y-3">
          <input
            type="text"
            placeholder="Nome do grupo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              Selecione os contatos
            </p>
            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
              {contatos.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selecionados.includes(c.id)}
                    onChange={() => toggleContato(c.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-800 dark:text-gray-200">{c.nome}</span>
                </label>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={!nome.trim() || selecionados.length === 0}
            className="w-full py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Criar grupo ({selecionados.length})
          </button>
        </form>
      </div>

      {/* Lista de grupos */}
      <div className="lg:col-span-2 space-y-2">
        {grupos.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 text-center text-gray-500 dark:text-gray-400">
            Nenhum grupo criado ainda.
          </div>
        ) : (
          grupos.map((g) => (
            <div key={g.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <Users className="w-5 h-5 text-blue-600 shrink-0" />
                  <p className="font-medium text-gray-900 dark:text-white truncate">{g.nome}</p>
                  <span className="text-xs text-gray-400">({g.contatoIds.length})</span>
                </div>
                <button
                  onClick={() => removerGrupo(g.id)}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  aria-label="Remover grupo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {g.contatoIds.map((id) => (
                  <span
                    key={id}
                    className="px-2 py-0.5 rounded-full text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  >
                    {nomeContato(id)}
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

export default GruposTab;
