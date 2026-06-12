import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, FolderPlus, Trash2, Search, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCurrentAccount } from '../../hooks/useCurrentAccount';
import type { Contato, Grupo, MembroGrupo } from './lib/painelTypes';
import { buscarContatos } from './lib/painelEdge';
import { buscarGrupos, criarGrupo, removerGrupo } from './lib/painelGroups';

const GruposTab = () => {
  const { companyId } = useCurrentAccount();

  const [contatos, setContatos] = useState<Contato[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [buscaContato, setBuscaContato] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);
      const [cts, grps] = await Promise.all([
        buscarContatos(),
        buscarGrupos(companyId ?? null),
      ]);
      setContatos(cts);
      setGrupos(grps);
    } catch (e) {
      console.error('Erro ao carregar grupos/contatos:', e);
      setErro('Erro ao carregar dados. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }, [companyId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const contatosFiltrados = useMemo(() => {
    const q = buscaContato.trim().toLowerCase();
    if (!q) return contatos;
    return contatos.filter(
      (c) => c.nome.toLowerCase().includes(q) || c.telefone.toLowerCase().includes(q),
    );
  }, [contatos, buscaContato]);

  const toggleContato = (id: string) => {
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || selecionados.length === 0 || salvando) return;
    if (!companyId) {
      toast.error('Empresa não identificada.');
      return;
    }
    const membros: MembroGrupo[] = selecionados
      .map((id) => contatos.find((c) => c.id === id))
      .filter((c): c is Contato => Boolean(c))
      .map((c) => ({ id: c.id, nome: c.nome, telefone: c.telefone || undefined }));

    try {
      setSalvando(true);
      const novo = await criarGrupo(companyId, nome.trim(), membros);
      setGrupos((prev) => [novo, ...prev]);
      setNome('');
      setSelecionados([]);
      toast.success('Grupo criado com sucesso');
    } catch (err) {
      console.error('Erro ao criar grupo:', err);
      toast.error('Erro ao criar grupo');
    } finally {
      setSalvando(false);
    }
  };

  const handleRemover = async (id: string) => {
    try {
      await removerGrupo(id);
      setGrupos((prev) => prev.filter((g) => g.id !== id));
      toast.success('Grupo removido');
    } catch (err) {
      console.error('Erro ao remover grupo:', err);
      toast.error('Erro ao remover grupo');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Form criar grupo */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 h-fit">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
          <FolderPlus className="w-5 h-5 text-blue-600" />
          Criar grupo
        </h2>
        <form onSubmit={handleCriar} className="space-y-3">
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
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Filtrar contatos..."
                value={buscaContato}
                onChange={(e) => setBuscaContato(e.target.value)}
                className="w-full pl-10 pr-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            {carregando ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-4 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
              </div>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                {contatosFiltrados.map((c) => (
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
                    <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
                      {c.nome}
                      {c.telefone && (
                        <span className="text-gray-400"> · {c.telefone}</span>
                      )}
                    </span>
                  </label>
                ))}
                {contatosFiltrados.length === 0 && (
                  <p className="text-sm text-gray-400 py-2 text-center">Nenhum contato.</p>
                )}
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={!nome.trim() || selecionados.length === 0 || salvando}
            className="w-full py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            {salvando ? 'Salvando...' : `Criar grupo (${selecionados.length})`}
          </button>
        </form>
      </div>

      {/* Lista de grupos */}
      <div className="lg:col-span-2 space-y-2">
        {erro ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 text-center text-red-600 dark:text-red-400">
            {erro}
          </div>
        ) : carregando ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando grupos...
          </div>
        ) : grupos.length === 0 ? (
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
                  <span className="text-xs text-gray-400">({g.membros.length})</span>
                </div>
                <button
                  onClick={() => handleRemover(g.id)}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  aria-label="Remover grupo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {g.membros.map((m) => (
                  <span
                    key={m.id}
                    className="px-2 py-0.5 rounded-full text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  >
                    {m.nome}
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
