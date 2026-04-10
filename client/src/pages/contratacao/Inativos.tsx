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
import Pagination from "../../components/Pagination";
import toast from "react-hot-toast";
import { formatCPF, formatPhone } from "../../utils/format";
import type { Cliente } from "../../types/database";
import {
  getListRefreshSkeletonPreset,
  default as ListRefreshSkeleton,
} from "../../components/contratacao/ListRefreshSkeleton";

const inativosSkeletonPreset = getListRefreshSkeletonPreset("inativos");

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

const DEFAULT_PAGE_SIZE = 50;

const Inativos: React.FC = () => {
  const { companyId } = useCompanyData();
  const [items, setItems] = useState<InativoItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const firstFetchRef = useRef(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [serverPage, setServerPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

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
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  const tagFilterSig = useMemo(
    () => [...tagFilter].sort().join("|"),
    [tagFilter],
  );

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

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setServerPage(0);
  }, [debouncedSearch, funcaoFilter, tagFilterMode, tagFilterSig]);

  const fetchPage = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!companyId) return;

      const showFullSpinner = firstFetchRef.current && !opts?.silent;

      try {
        if (showFullSpinner) setLoading(true);
        else if (!opts?.silent) setListLoading(true);

        const tagIds = tagFilter
          .map((id) => Number(id))
          .filter((n) => !Number.isNaN(n));

        const pTagMode =
          tagIds.length === 0
            ? "none"
            : tagFilterMode === "contains"
              ? "contains"
              : "not_contains";

        const { data, error } = await supabase.rpc("inativos_list_page", {
          p_company_id: companyId,
          p_search: debouncedSearch.trim(),
          p_funcao: funcaoFilter,
          p_tag_ids: tagIds,
          p_tag_mode: pTagMode,
          p_limit: pageSize,
          p_offset: serverPage * pageSize,
        });

        if (error) throw error;

        const payload = data as {
          total_count?: number | string;
          rows?: unknown;
        } | null;

        const rowsRaw = Array.isArray(payload?.rows) ? payload.rows : [];
        const mapped: InativoItem[] = rowsRaw.map((r: any) => ({
          motorista_id: r.motorista_id,
          nome_motorista: r.nome_motorista ?? null,
          cpf: r.cpf ?? null,
          telefone: r.telefone ?? null,
          email: r.email ?? null,
          funcao: r.funcao ?? null,
          st_cadastro: r.st_cadastro ?? null,
          ativo: r.ativo ?? null,
        }));

        setItems(mapped);
        const tc = payload?.total_count;
        setTotalCount(
          typeof tc === "number" ? tc : tc != null ? Number(tc) : 0,
        );
      } catch (error) {
        console.error("Erro ao carregar inativos:", error);
        toast.error("Erro ao carregar inativos");
        setItems([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
        setListLoading(false);
        firstFetchRef.current = false;
      }
    },
    [
      companyId,
      debouncedSearch,
      funcaoFilter,
      tagFilter,
      tagFilterMode,
      serverPage,
      pageSize,
    ],
  );

  useEffect(() => {
    void fetchPage();
  }, [fetchPage]);

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

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize) || 1);
  const currentPage = serverPage + 1;

  const selectAll =
    items.length > 0 &&
    items.every((i) => selectedItems.has(i.motorista_id));

  const handleSelectItem = (id: number) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    const ids = items.map((i) => i.motorista_id);
    if (ids.length === 0) return;
    const allSelected = ids.every((id) => selectedItems.has(id));
    if (allSelected) {
      setSelectedItems((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedItems((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });
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

      setSelectedItems((prev) => {
        const next = new Set(prev);
        next.delete(item.motorista_id);
        return next;
      });

      toast.success("Motorista/agregado reativado com sucesso");
      void fetchPage({ silent: true });
    } catch (error) {
      console.error("Erro ao reativar motorista/agregado:", error);
      toast.error("Erro ao reativar motorista/agregado");
    } finally {
      setUpdatingId(null);
    }
  };

  const hasActiveFilters = () => activeFilterCount > 0;

  const handlePageChange = (page1: number) => setServerPage(page1 - 1);
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setServerPage(0);
  };

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

      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectAll}
              onChange={handleSelectAll}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              aria-label="Selecionar todos desta página"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selectedItems.size > 0
                ? `${selectedItems.size} selecionado${selectedItems.size !== 1 ? "s" : ""}`
                : `Nesta página: ${items.length} · Total: ${totalCount}`}
            </span>
          </div>
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
            {listLoading ? (
              <ListRefreshSkeleton {...inativosSkeletonPreset} />
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  Nenhum motorista/agregado inativo encontrado.
                </td>
              </tr>
            ) : (
              items.map((item) => (
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
        {!listLoading && totalCount > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalCount}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </div>

      <BulkActionsModal
        isOpen={isBulkActionsModalOpen}
        onClose={() => setIsBulkActionsModalOpen(false)}
        selectedItems={selectedItems}
        actionType={bulkActionType}
        onSuccess={() => {
          void fetchPage({ silent: true });
          setSelectedItems(new Set());
        }}
        clientes={clientes}
      />
    </div>
  );
};

export default Inativos;
