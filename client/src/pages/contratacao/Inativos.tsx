import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Search,
  User,
  Truck,
  XCircle,
  Loader2,
  Edit2,
  Tag,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useCompanyData } from "../../hooks/useCompanyData";
import LoadingSpinner from "../../components/LoadingSpinner";
import BulkActionsModal from "../../components/BulkActionsModal";
import toast from "react-hot-toast";
import { formatCPF, formatPhone } from "../../utils/format";
import type { Cliente } from "../../types/database";

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

  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [isBulkActionsModalOpen, setIsBulkActionsModalOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<
    "status" | "client" | "tags"
  >("tags");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [tagFilterMode, setTagFilterMode] = useState<
    "contains" | "not_contains"
  >("contains");
  const [motoristaTags, setMotoristaTags] = useState<{
    [key: number]: any[];
  }>({});
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  const { data: tags = [] } = useQuery({
    queryKey: ["inativos-tags", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("tag")
        .select("*")
        .eq("company_id", companyId)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const loadMotoristaTags = useCallback(async (motoristaIds: number[]) => {
    if (motoristaIds.length === 0) {
      setMotoristaTags({});
      return;
    }

    const associations: any[] = [];
    const chunkSize = 50;

    for (let i = 0; i < motoristaIds.length; i += chunkSize) {
      const chunk = motoristaIds.slice(i, i + chunkSize);
      try {
        const { data: chunkAssociations, error: chunkError } = await supabase
          .from("associacao_tags")
          .select(
            `
            motorista_id,
            tag:tag_id (
              id,
              nome,
              cor,
              company_id,
              limite_max,
              created_at,
              updated_at
            )
          `,
          )
          .in("motorista_id", chunk);

        if (chunkError) continue;
        if (chunkAssociations) associations.push(...chunkAssociations);
      } catch {
        continue;
      }
    }

    const newMotoristaTags: { [key: number]: any[] } = {};
    motoristaIds.forEach((id) => {
      newMotoristaTags[id] = [];
    });

    associations.forEach((association: any) => {
      if (association.tag && association.motorista_id) {
        newMotoristaTags[association.motorista_id].push(association.tag);
      }
    });

    setMotoristaTags(newMotoristaTags);
  }, []);

  const fetchInativos = useCallback(async (opts?: { silent?: boolean }) => {
    if (!companyId) return;

    try {
      if (!opts?.silent) setLoading(true);

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

      const map = new Map<number, InativoItem>();
      data.forEach((item) => {
        if (!map.has(item.motorista_id)) {
          map.set(item.motorista_id, item);
        }
      });

      const list = Array.from(map.values());
      setItems(list);

      const ids = list
        .map((m) => m.motorista_id)
        .filter((id): id is number => typeof id === "number");
      await loadMotoristaTags(ids);
    } catch (error) {
      console.error("Erro ao carregar inativos:", error);
      toast.error("Erro ao carregar inativos");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [companyId, loadMotoristaTags]);

  const fetchClientes = useCallback(async () => {
    if (!companyId) return;
    try {
      const { data, error } = await supabase
        .from("cliente")
        .select("*")
        .eq("company_id", companyId)
        .order("nome");

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error("Erro ao carregar clientes:", error);
    }
  }, [companyId]);

  useEffect(() => {
    fetchInativos();
  }, [fetchInativos]);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        tagDropdownRef.current &&
        !tagDropdownRef.current.contains(e.target as Node)
      ) {
        setShowTagDropdown(false);
      }
    };
    if (showTagDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showTagDropdown]);

  const activeFilterCount =
    (funcaoFilter !== "todos" ? 1 : 0) + (tagFilter.length > 0 ? 1 : 0);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (funcaoFilter !== "todos" && item.funcao !== funcaoFilter) {
        return false;
      }

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchSearch =
          (item.nome_motorista || "").toLowerCase().includes(term) ||
          (item.cpf || "").toLowerCase().includes(term) ||
          String(item.telefone || "").includes(term);
        if (!matchSearch) return false;
      }

      if (tagFilter.length > 0) {
        const motoristaId = item.motorista_id;
        const motoristaTagsList = motoristaTags[motoristaId] || [];
        const motoristaTagIds = motoristaTagsList.map((tag: any) =>
          tag.id.toString(),
        );

        if (tagFilterMode === "contains") {
          if (!tagFilter.some((tagId) => motoristaTagIds.includes(tagId))) {
            return false;
          }
        } else if (
          tagFilter.some((tagId) => motoristaTagIds.includes(tagId))
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    items,
    funcaoFilter,
    searchTerm,
    tagFilter,
    tagFilterMode,
    motoristaTags,
  ]);

  const selectAll =
    filteredItems.length > 0 &&
    filteredItems.every((i) => selectedItems.has(i.motorista_id));

  const handleSelectItem = (id: number) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    const ids = filteredItems.map((i) => i.motorista_id);
    if (ids.length === 0) return;
    const allSelected = ids.every((id) => selectedItems.has(id));
    if (allSelected) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(ids));
    }
  };

  const handleBulkAction = (type: "status" | "client" | "tags") => {
    setBulkActionType(type);
    setIsBulkActionsModalOpen(true);
  };

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
      setSelectedItems((prev) => {
        const next = new Set(prev);
        next.delete(item.motorista_id);
        return next;
      });

      toast.success("Motorista/agregado reativado com sucesso");
    } catch (error) {
      console.error("Erro ao reativar motorista/agregado:", error);
      toast.error("Erro ao reativar motorista/agregado");
    } finally {
      setUpdatingId(null);
    }
  };

  const hasActiveFilters = () => activeFilterCount > 0;

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <XCircle className="w-6 h-6 text-red-500" />
          Inativos
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {selectedItems.size > 0 && (
            <span className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 rounded-full text-sm">
              {selectedItems.size} selecionado
              {selectedItems.size !== 1 ? "s" : ""}
            </span>
          )}
          {selectedItems.size > 0 && (
            <>
              <button
                type="button"
                onClick={() => handleBulkAction("status")}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center gap-2 text-sm"
              >
                <Edit2 className="w-4 h-4" />
                Atualizar Status
              </button>
              <button
                type="button"
                onClick={() => handleBulkAction("client")}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center gap-2 text-sm"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                Atribuir Cliente
              </button>
              <button
                type="button"
                onClick={() => handleBulkAction("tags")}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors flex items-center gap-2 text-sm"
              >
                <Tag className="w-4 h-4" />
                Adicionar Marcador
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
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
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ×
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowFilters((prev) => !prev)}
                className={`inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                  showFilters || hasActiveFilters()
                    ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
                }`}
              >
                <Search size={16} />
                Filtros
                {activeFilterCount > 0 && (
                  <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
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

              <div className="flex flex-wrap gap-3 items-start">
                <span className="text-sm text-gray-700 dark:text-gray-300 pt-2">
                  Marcadores:
                </span>
                <div className="relative" ref={tagDropdownRef}>
                  <button
                    type="button"
                    className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 h-9"
                    onClick={() => setShowTagDropdown((v) => !v)}
                  >
                    <Tag className="h-4 w-4" />
                    <span>
                      {tagFilter.length === 0
                        ? "Marcadores"
                        : `Marcadores (${tagFilter.length})`}
                    </span>
                  </button>

                  {showTagDropdown && (
                    <div
                      className="absolute z-50 mt-1 bg-white dark:bg-gray-700 shadow-xl rounded-md py-1 border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto w-72"
                      style={{ left: 0, top: "100%" }}
                    >
                      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Filtro de marcadores
                          </span>
                          <button
                            type="button"
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTagFilter([]);
                            }}
                          >
                            Limpar
                          </button>
                        </div>
                        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-md p-1">
                          <button
                            type="button"
                            className={`flex-1 text-xs px-2 py-1 rounded transition-colors ${
                              tagFilterMode === "contains"
                                ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                                : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setTagFilterMode("contains");
                            }}
                          >
                            Contém
                          </button>
                          <button
                            type="button"
                            className={`flex-1 text-xs px-2 py-1 rounded transition-colors ${
                              tagFilterMode === "not_contains"
                                ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                                : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setTagFilterMode("not_contains");
                            }}
                          >
                            Não contém
                          </button>
                        </div>
                      </div>
                      {tags.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                          Nenhum marcador cadastrado.
                        </p>
                      ) : (
                        tags.map((tag: any) => (
                          <div
                            key={tag.id}
                            className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600"
                          >
                            <label className="flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 mr-2"
                                checked={tagFilter.includes(tag.id.toString())}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setTagFilter([
                                      ...tagFilter,
                                      tag.id.toString(),
                                    ]);
                                  } else {
                                    setTagFilter(
                                      tagFilter.filter(
                                        (id) => id !== tag.id.toString(),
                                      ),
                                    );
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full shrink-0"
                                  style={{
                                    backgroundColor: tag.cor || "#3B82F6",
                                  }}
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-200">
                                  {tag.nome}
                                </span>
                              </div>
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <input
            type="checkbox"
            checked={selectAll}
            onChange={handleSelectAll}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            aria-label="Selecionar todos os inativos visíveis"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {selectedItems.size > 0
              ? `${selectedItems.size} selecionado${selectedItems.size !== 1 ? "s" : ""}`
              : `Selecionar todos (${filteredItems.length} registro${filteredItems.length !== 1 ? "s" : ""})`}
          </span>
        </div>
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th className="px-4 py-3 w-10" aria-hidden />
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
                  colSpan={7}
                  className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  Nenhum motorista/agregado inativo encontrado.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr
                  key={item.motorista_id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-900/40 ${
                    selectedItems.has(item.motorista_id)
                      ? "bg-blue-50 dark:bg-blue-900/20"
                      : ""
                  }`}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.motorista_id)}
                      onChange={() => handleSelectItem(item.motorista_id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      aria-label={`Selecionar ${item.nome_motorista || "registro"}`}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    <span className="inline-flex items-center gap-2">
                      {item.funcao === "Agregado" ? (
                        <Truck className="w-4 h-4 text-green-500 shrink-0" />
                      ) : (
                        <User className="w-4 h-4 text-blue-500 shrink-0" />
                      )}
                      {item.nome_motorista || "Sem nome"}
                    </span>
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

      <BulkActionsModal
        isOpen={isBulkActionsModalOpen}
        onClose={() => setIsBulkActionsModalOpen(false)}
        selectedItems={selectedItems}
        actionType={bulkActionType}
        onSuccess={() => {
          void fetchInativos({ silent: true });
          setSelectedItems(new Set());
        }}
        clientes={clientes}
      />
    </div>
  );
};

export default Inativos;
