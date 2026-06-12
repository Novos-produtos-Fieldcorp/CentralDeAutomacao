import { useMemo, useState } from 'react';
import { Search, UserPlus, Phone, Mail, Trash2 } from 'lucide-react';
import type { Contato } from './lib/painelTypes';
import { CONTATOS_EXEMPLO } from './lib/painelMock';

const ContatosTab = () => {
  const [contatos, setContatos] = useState<Contato[]>(CONTATOS_EXEMPLO);
  const [busca, setBusca] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return contatos;
    return contatos.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        c.telefone.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q),
    );
  }, [contatos, busca]);

  const criarContato = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !telefone.trim()) return;
    const novo: Contato = {
      id: `c-${contatos.length + 1}-${nome.slice(0, 3)}`,
      nome: nome.trim(),
      telefone: telefone.trim(),
      email: email.trim() || undefined,
      criadoEm: new Date().toISOString().slice(0, 10),
    };
    setContatos((prev) => [novo, ...prev]);
    setNome('');
    setTelefone('');
    setEmail('');
  };

  const removerContato = (id: string) => {
    setContatos((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Form criar contato */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 h-fit">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
          <UserPlus className="w-5 h-5 text-blue-600" />
          Criar contato
        </h2>
        <form onSubmit={criarContato} className="space-y-3">
          <input
            type="text"
            placeholder="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <input
            type="text"
            placeholder="Telefone"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <input
            type="email"
            placeholder="E-mail (opcional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            type="submit"
            disabled={!nome.trim() || !telefone.trim()}
            className="w-full py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Adicionar contato
          </button>
        </form>
      </div>

      {/* Busca + lista */}
      <div className="lg:col-span-2 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar contatos..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {filtrados.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 text-center text-gray-500 dark:text-gray-400">
            Nenhum contato encontrado.
          </div>
        ) : (
          <div className="space-y-2">
            {filtrados.map((c) => (
              <div
                key={c.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{c.nome}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400 mt-1">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" /> {c.telefone}
                    </span>
                    {c.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" /> {c.email}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removerContato(c.id)}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  aria-label="Remover contato"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContatosTab;
