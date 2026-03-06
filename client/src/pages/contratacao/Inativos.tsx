import React, { useEffect, useState } from "react";
import { Search, User, Truck, XCircle, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useCompanyData } from "../../hooks/useCompanyData";
import LoadingSpinner from "../../components/LoadingSpinner";
import toast from "react-hot-toast";
import { formatCPF, formatPhone } from "../../utils/format";

interface InativoItem {
  motorista_id: number;
  nome_motorista: string | null;
  cpf: string | null;
  telefone: string | number | null;
  email: string | null;
  funcao: string | null;
  st_cadastro: string | null;
  ativo: boolean | null;
}

const Inativos: React.FC = () => {
  const { companyId } = useCompanyData();
  const [items, setItems] = useState<InativoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [funcaoFilter, setFuncaoFilter] = useState<
    "todos" | "Motorista" | "Agregado"
  >("todos");
  const [showFilters, setShowFilters] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    const fetchInativos = async () => {
      if (!companyId) return;

      try {
        setLoading(true);

        const [motoristasRes, agregadosRes] = await Promise.all([
          supabase
            .from("vw_motoristas_completo")
            .select(
              "motorista_id, nome_motorista, cpf, telefone, email, funcao, st_cadastro, ativo",
            )
            .eq("company_id", companyId)
            .eq("ativo", false),
          supabase
            .from("vw_agregados_completo")
            .select(
              "motorista_id, nome_motorista, cpf, telefone, email, funcao, st_cadastro, ativo",
            )
            .eq("company_id", companyId)
            .eq("ativo", false),
        ]);

        if (motoristasRes.error) throw motoristasRes.error;
        if (agregadosRes.error) throw agregadosRes.error;

        const data: InativoItem[] = [
          ...(motoristasRes.data || []),
          ...(agregadosRes.data || []),
        ];

        // Remover duplicados por motorista_id
        const map = new Map<number, InativoItem>();
        data.forEach((item) => {
          if (!map.has(item.motorista_id)) {
            map.set(item.motorista_id, item);
          }
        });

        setItems(Array.from(map.values()));
      } catch (error) {
        console.error("Erro ao carregar inativos:", error);
        toast.error("Erro ao carregar inativos");
      } finally {
        setLoading(false);
      }
    };

    fetchInativos();
  }, [companyId]);

  const filteredItems = items.filter((item) => {
    if (funcaoFilter !== "todos" && item.funcao !== funcaoFilter) {
      return false;
    }

    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (item.nome_motorista || "").toLowerCase().includes(term) ||
      (item.cpf || "").toLowerCase().includes(term) ||
      String(item.telefone || "").includes(term)
    );
  });

  const handleReativar = async (item: InativoItem) => {
    try {
      setUpdatingId(item.motorista_id);

      const { error } = await supabase
        .from("motorista")
        .update({ ativo: true })
        .eq("motorista_id", item.motorista_id);

      if (error) throw error;

      setItems((prev) =>
        prev.filter((m) => m.motorista_id !== item.motorista_id),
      );

      toast.success("Motorista/agregado reativado com sucesso");
    } catch (error) {
      console.error("Erro ao reativar motorista/agregado:", error);
      toast.error("Erro ao reativar motorista/agregado");
    } finally {
      setUpdatingId(null);
    }
  };

  const hasActiveFilters = () => funcaoFilter !== "todos";

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <XCircle className="w-6 h-6 text-red-500" />
          Inativos
        </h2>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            {/* Search bar - mesmo padrão de Contratados */}
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Buscar por nome, CPF ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              />
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ×
                </button>
              )}
            </div>

            {/* Botão de filtros - mesmo padrão visual (simplificado) */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters((prev) => !prev)}
                className={`inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                  showFilters || hasActiveFilters()
                    ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                <Search size={16} />
                Filtros
                {hasActiveFilters() && (
                  <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                    1
                  </span>
                )}
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap gap-3 items-center">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Função:
                </span>
                <div className="inline-flex rounded-md shadow-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setFuncaoFilter("todos")}
                    className={`px-3 py-1.5 text-xs font-medium ${
                      funcaoFilter === "todos"
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-100"
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setFuncaoFilter("Motorista")}
                    className={`px-3 py-1.5 text-xs font-medium border-l border-gray-200 dark:border-gray-700 ${
                      funcaoFilter === "Motorista"
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-100"
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    Motoristas
                  </button>
                  <button
                    type="button"
                    onClick={() => setFuncaoFilter("Agregado")}
                    className={`px-3 py-1.5 text-xs font-medium border-l border-gray-200 dark:border-gray-700 ${
                      funcaoFilter === "Agregado"
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-100"
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    Agregados
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Nome
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                CPF
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Telefone
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Função
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredItems.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  Nenhum motorista/agregado inativo encontrado.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr
                  key={item.motorista_id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-900/40"
                >
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    {item.funcao === "Agregado" ? (
                      <Truck className="w-4 h-4 text-green-500" />
                    ) : (
                      <User className="w-4 h-4 text-blue-500" />
                    )}
                    {item.nome_motorista || "Sem nome"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                    {item.cpf ? formatCPF(item.cpf) : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                    {item.telefone ? formatPhone(String(item.telefone)) : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                    {item.funcao || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200">
                      {item.st_cadastro || "N/D"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <button
                      type="button"
                      onClick={() => handleReativar(item)}
                      disabled={updatingId === item.motorista_id}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        item.ativo
                          ? "bg-green-500 dark:bg-green-600"
                          : "bg-gray-200 dark:bg-gray-700"
                      } ${
                        updatingId === item.motorista_id
                          ? "opacity-60 cursor-not-allowed"
                          : ""
                      }`}
                      role="switch"
                      aria-checked={!!item.ativo}
                      title={
                        item.ativo
                          ? "Desativar motorista/agregado"
                          : "Reativar motorista/agregado"
                      }
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          item.ativo ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                      {updatingId === item.motorista_id && (
                        <Loader2 className="absolute inset-0 m-auto w-3 h-3 text-white animate-spin" />
                      )}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Inativos;
