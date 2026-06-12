import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, UserPlus, Phone, Mail, RefreshCw, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Contato } from './lib/painelTypes';
import { buscarContatos, cadastrarContato } from './lib/painelEdge';

const ContatosTab = () => {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);
      const dados = await buscarContatos();
      setContatos(dados);
    } catch (e) {
      console.error('Erro ao buscar contatos:', e);
      setErro('Erro ao carregar contatos. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

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

  const criarContato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !telefone.trim() || salvando) return;
    try {
      setSalvando(true);
      await cadastrarContato({
        nome: nome.trim(),
        telefone: telefone.trim(),
        email: email.trim() || undefined,
      });
      toast.success('Contato cadastrado com sucesso');
      setNome('');
      setTelefone('');
      setEmail('');
      await carregar();
    } catch (err) {
      console.error('Erro ao cadastrar contato:', err);
      toast.error('Erro ao cadastrar contato');
    } finally {
      setSalvando(false);
    }
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
            disabled={!nome.trim() || !telefone.trim() || salvando}
            className="w-full py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            {salvando ? 'Salvando...' : 'Adicionar contato'}
          </button>
        </form>
      </div>

      {/* Busca + lista */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar contatos..."
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
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando contatos...
          </div>
        ) : erro ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 text-center text-red-600 dark:text-red-400">
            {erro}
          </div>
        ) : filtrados.length === 0 ? (
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
                  <p className="font-medium text-gray-900 dark:text-white truncate">{c.nome || '—'}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {c.telefone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" /> {c.telefone}
                      </span>
                    )}
                    {c.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" /> {c.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContatosTab;
