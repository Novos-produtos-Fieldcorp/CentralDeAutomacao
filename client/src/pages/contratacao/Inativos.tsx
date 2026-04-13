import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronDown,
  Filter,
  Search,
  User,
  Truck,
  X,
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

  const clearAllFilters = () => {
    setSearchTerm("");
    setFuncaoFilter("todos");
    setTagFilter([]);
    setTagFilterMode("contains");
    setShowTagDropdown(false);
  };

  const getFuncaoFilterLabel = () => {
    switch (funcaoFilter) {
      case "Motorista":
        return "Somente motoristas";
      case "Agregado":
        return "Somente agregados";
      default:
        return "Todas as funções";
    }
  };

  const getTagName = (tagId: string) => {
    const tag = tags.find((item: any) => item.id.toString() === tagId);
    return tag?.nome || `Marcador ${tagId}`;
  };

  const getTagColor = (tagId: string) => {
    const tag = tags.find((item: any) => item.id.toString() === tagId);
    return tag?.cor || "#3B82F6";
  };

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

      <div className="search-section-surface p-6">
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Buscar por nome, CPF ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-10 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="search-toolbar-meta mb-4">
          <div className="search-toolbar-summary">
            {hasActiveFilters() && (
              <div className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                <Filter className="h-3 w-3" />
                <span>{activeFilterCount}</span>
              </div>
            )}
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {totalCount} inativo{totalCount !== 1 ? "s" : ""} encontrado
              {totalCount !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="search-toolbar-summary">
            {(hasActiveFilters() || searchTerm) && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="flex items-center gap-1 rounded-md px-3 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              >
                <X className="h-3 w-3" />
                Limpar busca e filtros
              </button>
            )}
          </div>
        </div>

        {hasActiveFilters() && (
          <div className="filter-tags-panel mb-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  Filtros ativos
                </span>
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-100 px-2 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  {activeFilterCount}
                </span>
              </div>
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1.5 self-start rounded-lg bg-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
              >
                <X className="h-3 w-3" />
                <span>Limpar todos</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {funcaoFilter !== "todos" && (
                <div className="filter-tags-chip bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300">
                  {funcaoFilter === "Motorista" ? (
                    <User className="h-3 w-3" />
                  ) : (
                    <Truck className="h-3 w-3" />
                  )}
                  <span className="filter-tags-chip-label">
                    Função: {getFuncaoFilterLabel()}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFuncaoFilter("todos")}
                    className="rounded-sm p-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {tagFilter.map((tagId) => (
                <div
                  key={tagId}
                  className="filter-tags-chip bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: getTagColor(tagId) }}
                  />
                  <span className="filter-tags-chip-label">
                    {tagFilterMode === "contains" ? "Marcador" : "Exclui"}: {getTagName(tagId)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setTagFilter((prev) => prev.filter((id) => id !== tagId))
                    }
                    className="rounded-sm p-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="search-toolbar-row relative">
          <div className="search-filter-grid">
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 search-filter-icon-funcao" />
              <select
                value={funcaoFilter}
                onChange={(e) =>
                  setFuncaoFilter(
                    e.target.value as "todos" | "Motorista" | "Agregado",
                  )
                }
                className="search-filter-select"
              >
                <option value="todos">Todas as funções</option>
                <option value="Motorista">Somente motoristas</option>
                <option value="Agregado">Somente agregados</option>
              </select>
            </div>

            <div className="relative" ref={tagDropdownRef}>
              <button
                type="button"
                className="search-filter-trigger w-full justify-between pl-10 pr-3"
                onClick={() => setShowTagDropdown((prev) => !prev)}
              >
                <span className="truncate">
                  {tagFilter.length === 0
                    ? "Marcadores"
                    : `Marcadores (${tagFilter.length})`}
                </span>
                <ChevronDown
                  className={`ml-2 h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${
                    showTagDropdown ? "transform rotate-180" : ""
                  }`}
                />
              </button>
              <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 search-filter-icon-tag" />

              {showTagDropdown && (
                <div className="absolute z-[var(--z-layer-page-dropdown)] mt-1 max-h-64 w-72 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-600 dark:bg-gray-700">
                  <div className="border-b border-gray-200 px-3 py-2 dark:border-gray-600">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Filtro de marcadores
                      </span>
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTagFilter([]);
                        }}
                      >
                        Limpar
                      </button>
                    </div>
                    <div className="flex rounded-md bg-gray-100 p-1 dark:bg-gray-800">
                      <button
                        type="button"
                        className={`flex-1 rounded px-2 py-1 text-xs transition-colors ${
                          tagFilterMode === "contains"
                            ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-white"
                            : "text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
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
                        className={`flex-1 rounded px-2 py-1 text-xs transition-colors ${
                          tagFilterMode === "not_contains"
                            ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-white"
                            : "text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
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
                        <label className="flex cursor-pointer items-center">
                          <input
                            type="checkbox"
                            className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                            checked={tagFilter.includes(tag.id.toString())}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setTagFilter([...tagFilter, tag.id.toString()]);
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
                              className="h-3 w-3 shrink-0 rounded-full"
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

          <div className="search-toolbar-actions">
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
              Página atual: {items.length} registro{items.length !== 1 ? "s" : ""}
            </div>
          </div>
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
