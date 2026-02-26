import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ScrollText,
  Search,
  Filter,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronUp,
  Gauge,
  ClipboardCheck,
  Users,
  Truck,
  AlertTriangle,
  Clock,
  Calendar,
  Activity,
  Eye,
  RotateCcw,
  UserCircle,
  ShieldAlert,
  Smartphone,
  Lock,
  Fuel,
  ArrowUpRight,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useCurrentAccount } from "../hooks/useCurrentAccount";
import { useModuleAccess } from "../hooks/useModuleAccess";
import { format, subDays, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type LogType =
  | "hodometro"
  | "checklist"
  | "motorista"
  | "veiculo"
  | "status_motorista";

type ActorType = "motorista" | "admin" | "sistema";

interface AuditLog {
  id: string;
  type: LogType;
  action: string;
  description: string;
  motoristaNome?: string;
  motoristaId?: number;
  veiculoPlaca?: string;
  timestamp: string;
  actor: string;
  actorType: ActorType;
  meta?: Record<string, any>;
}

// ─── Config visual por tipo ────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  LogType,
  {
    label: string;
    icon: React.ElementType;
    color: string;
    bg: string;
    border: string;
    badgeBg: string;
    badgeText: string;
    moduleKey: keyof ReturnType<typeof useModuleAccess>["moduleAccess"] | null;
  }
> = {
  hodometro: {
    label: "Hodômetro",
    icon: Gauge,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800",
    badgeBg: "bg-blue-100 dark:bg-blue-900/40",
    badgeText: "text-blue-700 dark:text-blue-300",
    moduleKey: "hodometros",
  },
  checklist: {
    label: "Checklist",
    icon: ClipboardCheck,
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-900/20",
    border: "border-green-200 dark:border-green-800",
    badgeBg: "bg-green-100 dark:bg-green-900/40",
    badgeText: "text-green-700 dark:text-green-300",
    moduleKey: "checklist",
  },
  motorista: {
    label: "Motorista",
    icon: Users,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-900/20",
    border: "border-purple-200 dark:border-purple-800",
    badgeBg: "bg-purple-100 dark:bg-purple-900/40",
    badgeText: "text-purple-700 dark:text-purple-300",
    moduleKey: "motoristas",
  },
  veiculo: {
    label: "Veículo",
    icon: Truck,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-900/20",
    border: "border-orange-200 dark:border-orange-800",
    badgeBg: "bg-orange-100 dark:bg-orange-900/40",
    badgeText: "text-orange-700 dark:text-orange-300",
    moduleKey: "veiculos",
  },
  status_motorista: {
    label: "Gestão de Risco",
    icon: ShieldAlert,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-900/20",
    border: "border-red-200 dark:border-red-800",
    badgeBg: "bg-red-100 dark:bg-red-900/40",
    badgeText: "text-red-700 dark:text-red-300",
    moduleKey: "motoristas",
  },
};

// ─── Config visual por ator ───────────────────────────────────────────────────

const ACTOR_CONFIG: Record<ActorType, { icon: React.ElementType; label: string; cls: string }> = {
  motorista: {
    icon: Smartphone,
    label: "Via App (Motorista)",
    cls: "text-blue-500 dark:text-blue-400",
  },
  admin: {
    icon: UserCircle,
    label: "Administrador",
    cls: "text-purple-500 dark:text-purple-400",
  },
  sistema: {
    icon: Activity,
    label: "Sistema",
    cls: "text-gray-400 dark:text-gray-500",
  },
};

// ─── Checklist type labels ──────────────────────────────────────────────────

const CHECKLIST_TYPE_LABELS: Record<number, string> = {
  1: "Mensal",
  2: "Semanal",
  3: "Manutenção",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (dateStr: string) => {
  try {
    const parsed = parseISO(dateStr);
    if (!isValid(parsed)) return dateStr;
    return format(parsed, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return dateStr;
  }
};

const parseTimestamp = (dateStr: string, timeStr?: string): string => {
  if (!timeStr) return dateStr;
  return `${dateStr}T${timeStr}`;
};

// ─── Componente ─────────────────────────────────────────────────────────────

// ─── URL de destino por tipo de log ──────────────────────────────────────────

const getLogUrl = (log: AuditLog): string | null => {
  switch (log.type) {
    case "hodometro":
      return "/hodometros/relatorio";
    case "checklist": {
      const tipo = (log.meta?.tipo as string | undefined) ?? "";
      if (tipo === "Semanal") return "/checklist/semanal";
      if (tipo === "Manutenção") return "/checklist/manutencao";
      return "/checklist/mensal";
    }
    case "motorista":
    case "status_motorista":
      return "/motoristas/lista";
    case "veiculo":
      return "/veiculos/agregados";
    default:
      return null;
  }
};

// ─── Componente ─────────────────────────────────────────────────────────────

const Logs: React.FC = () => {
  const navigate = useNavigate();
  const { companyId } = useCurrentAccount();
  const { moduleAccess, loading: moduleLoading } = useModuleAccess();

  // Tipos habilitados conforme módulos
  const enabledTypes = (Object.keys(TYPE_CONFIG) as LogType[]).filter((type) => {
    const mk = TYPE_CONFIG[type].moduleKey;
    return mk === null || moduleAccess[mk];
  });

  // Estados
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filtered, setFiltered] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<LogType>>(new Set());
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [sortDesc, setSortDesc] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  // Inicializa selectedTypes quando módulos carregam
  useEffect(() => {
    if (!moduleLoading) {
      setSelectedTypes(new Set(enabledTypes));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleLoading]);

  // ── Busca de dados ──────────────────────────────────────────────────────

  const fetchLogs = useCallback(async () => {
    if (!companyId || moduleLoading) return;
    setLoading(true);

    try {
      const allLogs: AuditLog[] = [];

      // ── 0. Pré-busca: IDs e nomes dos motoristas da empresa ───────────
      const { data: companyMotoristas } = await supabase
        .from("motorista")
        .select("motorista_id, nome")
        .eq("company_id", companyId);

      const companyMotoristaIds = (companyMotoristas || []).map((m: any) => m.motorista_id as number);
      const motoristaNameMap: Record<number, string> = {};
      (companyMotoristas || []).forEach((m: any) => {
        motoristaNameMap[m.motorista_id] = m.nome;
      });

      // ── 1. Hodômetros (somente se módulo habilitado) ───────────────────
      if (moduleAccess.hodometros) {
        const { data: hodometros } = await supabase
          .from("hodometro")
          .select(
            "id_hodometro, data, hora, hod_informado, hod_lido, km_rodado, verificacao, comparacao_leitura, motorista_id, veiculo_id, motorista(nome), veiculo(placa), bomba_gasolina!bomba_gasolina_hodometro_id_fkey(preco_lido, preco_informado, litro_lido, litro_informado)"
          )
          .eq("company_id", companyId)
          .gte("data", dateFrom)
          .lte("data", dateTo)
          .order("data", { ascending: false })
          .order("hora", { ascending: false });

        (hodometros || []).forEach((h: any) => {
          const motNome = h.motorista?.nome ?? "—";
          // bomba_gasolina pode vir como array (relação 1-para-muitos) ou objeto
          const bombaRaw = h.bomba_gasolina;
          const bomba: any = Array.isArray(bombaRaw)
            ? (bombaRaw[0] ?? null)
            : (bombaRaw ?? null);
          const temBomba = bomba && (bomba.litro_lido || bomba.preco_lido);

          // Monta partes da descrição
          const descParts = [
            `Hodômetro: ${h.hod_informado ?? "—"} km`,
            `Lido: ${h.hod_lido ?? "—"} km`,
            `KM rodado: ${h.km_rodado ?? "—"} km`,
            h.verificacao ? "Verificado" : "Pendente",
          ];
          if (temBomba) {
            if (bomba.litro_lido) descParts.push(`Litros: ${bomba.litro_lido} L`);
            if (bomba.preco_lido) descParts.push(`Valor: R$ ${bomba.preco_lido}`);
          }

          const meta: Record<string, any> = {
            hod_informado: h.hod_informado ? `${h.hod_informado} km` : undefined,
            hod_lido: h.hod_lido ? `${h.hod_lido} km` : undefined,
            km_rodado: h.km_rodado ? `${h.km_rodado} km` : undefined,
            verificado: h.verificacao,
            comparacao_leitura: h.comparacao_leitura,
          };
          if (bomba) {
            if (bomba.litro_lido) meta["litros lidos"] = `${bomba.litro_lido} L`;
            if (bomba.litro_informado) meta["litros informado"] = `${bomba.litro_informado} L`;
            if (bomba.preco_lido) meta["valor (lido)"] = `R$ ${bomba.preco_lido}`;
            if (bomba.preco_informado) meta["valor (informado)"] = `R$ ${bomba.preco_informado}`;
          }

          allLogs.push({
            id: `hod_${h.id_hodometro}`,
            type: "hodometro",
            action: "Leitura de Hodômetro",
            description: descParts.join(" | "),
            motoristaNome: motNome,
            motoristaId: h.motorista_id,
            veiculoPlaca: h.veiculo?.placa,
            timestamp: parseTimestamp(h.data, h.hora),
            actor: motNome,
            actorType: "motorista",
            meta,
          });
        });
      }

      // ── 2. Checklists (somente se módulo habilitado) ───────────────────
      if (moduleAccess.checklist) {
        const { data: checklists } = await supabase
          .from("checklist")
          .select(
            "checklist_id, data, hora, quilometragem, status, id_tipo_checklist, observacoes, motorista_id, veiculo_id, motorista(nome), veiculo(placa)"
          )
          .eq("company_id", companyId)
          .gte("data", dateFrom)
          .lte("data", dateTo)
          .order("data", { ascending: false })
          .order("hora", { ascending: false });

        (checklists || []).forEach((c: any) => {
          const tipo = CHECKLIST_TYPE_LABELS[c.id_tipo_checklist] ?? `Tipo ${c.id_tipo_checklist}`;
          const statusLabel = c.status ? "Aprovado" : "Reprovado";
          const motNome = c.motorista?.nome ?? "—";
          allLogs.push({
            id: `chk_${c.checklist_id}`,
            type: "checklist",
            action: `Checklist ${tipo} — ${statusLabel}`,
            description: `Checklist ${tipo} realizado | KM: ${c.quilometragem ?? "—"}${c.observacoes ? ` | Obs: ${c.observacoes}` : ""}`,
            motoristaNome: motNome,
            motoristaId: c.motorista_id,
            veiculoPlaca: c.veiculo?.placa,
            timestamp: parseTimestamp(c.data, c.hora),
            actor: motNome,
            actorType: "motorista",
            meta: {
              tipo,
              resultado: statusLabel,
              quilometragem: c.quilometragem,
              observacoes: c.observacoes,
            },
          });
        });
      }

      // ── 3. Motoristas cadastrados (somente se módulo habilitado) ───────
      if (moduleAccess.motoristas) {
        const { data: motoristasView } = await supabase
          .from("vw_motoristas_completo")
          .select("*")
          .eq("company_id", companyId)
          .gte("data_cadastro", dateFrom)
          .lte("data_cadastro", dateTo)
          .order("data_cadastro", { ascending: false });

        (motoristasView || []).forEach((m: any) => {
          const nome = m.nome_motorista ?? m.nome ?? "—";
          const origemBruta: string = (m.origem_usuario ?? "").toString().toLowerCase();
          // Determina ator e tipo com base na origem de cadastro
          let actorLabel = "Administrador";
          let actorKind: ActorType = "admin";
          if (origemBruta.includes("app") || origemBruta.includes("wise") || origemBruta.includes("chatbot")) {
            actorLabel = origemBruta || "Aplicativo";
            actorKind = "motorista";
          } else if (origemBruta && origemBruta !== "") {
            actorLabel = m.origem_usuario;
            actorKind = "admin";
          }
          allLogs.push({
            id: `mot_${m.motorista_id}`,
            type: "motorista",
            action: "Cadastro de Motorista",
            description: `${nome} | CPF: ${m.cpf ?? "—"} | Função: ${m.funcao ?? "—"} | Status: ${m.st_cadastro ?? "—"}${m.origem_usuario ? ` | Origem: ${m.origem_usuario}` : ""}`,
            motoristaNome: nome,
            motoristaId: m.motorista_id,
            timestamp: m.data_cadastro,
            actor: actorLabel,
            actorType: actorKind,
            meta: {
              cpf: m.cpf,
              funcao: m.funcao,
              st_cadastro: m.st_cadastro,
              origem: m.origem_usuario || undefined,
            },
          });
        });

        // ── 4. Gestão de Risco — sem filtro de data (estado persistente) ──
        if (companyMotoristaIds.length > 0) {
          const { data: grMotoristas } = await supabase
            .from("gr_motorista")
            .select(
              "id, motorista_id, motivo, created_at, empresa:empresa_id(id, nome), status:status_id(id, status)"
            )
            .in("motorista_id", companyMotoristaIds)
            .order("created_at", { ascending: false });

          (grMotoristas || []).forEach((g: any) => {
            const nomeMot = motoristaNameMap[g.motorista_id] ?? "—";
            const empresaNome = g.empresa?.nome ?? "—";
            const statusNome = g.status?.status ?? "—";
            allLogs.push({
              id: `gr_mot_${g.id}`,
              type: "status_motorista",
              action: "Restrição de Gestão de Risco",
              description: `${nomeMot} | Empresa GR: ${empresaNome} | Status: ${statusNome}${g.motivo ? ` | Motivo: ${g.motivo}` : ""}`,
              motoristaNome: nomeMot,
              motoristaId: g.motorista_id,
              timestamp: g.created_at,
              actor: "Administrador",
              actorType: "admin",
              meta: {
                empresa_gr: empresaNome,
                status_gr: statusNome,
                motivo: g.motivo,
              },
            });
          });
        }
      }

      // ── 5. Veículos cadastrados (somente se módulo habilitado) ─────────
      if (moduleAccess.veiculos) {
        const { data: veiculos } = await supabase
          .from("veiculo")
          .select("veiculo_id, placa, marca, status_veiculo")
          .eq("company_id", companyId)
          .order("veiculo_id", { ascending: false });

        (veiculos || []).forEach((v: any) => {
          allLogs.push({
            id: `vei_${v.veiculo_id}`,
            type: "veiculo",
            action: "Veículo Registrado",
            description: `Placa: ${v.placa} | Marca: ${v.marca ?? "—"} | Status: ${v.status_veiculo ? "Ativo" : "Inativo"}`,
            veiculoPlaca: v.placa,
            timestamp: new Date("2000-01-01").toISOString(),
            actor: "Administrador",
            actorType: "admin",
            meta: {
              placa: v.placa,
              marca: v.marca,
              status: v.status_veiculo ? "Ativo" : "Inativo",
            },
          });
        });
      }

      setLogs(allLogs);
    } catch (err) {
      console.error("Erro ao buscar logs:", err);
    } finally {
      setLoading(false);
    }
  }, [companyId, dateFrom, dateTo, moduleAccess, moduleLoading]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // ── Filtro/busca ────────────────────────────────────────────────────────

  useEffect(() => {
    let result = logs.filter((l) => selectedTypes.has(l.type));

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.description.toLowerCase().includes(q) ||
          l.motoristaNome?.toLowerCase().includes(q) ||
          l.veiculoPlaca?.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.actor.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      const da = new Date(a.timestamp).getTime();
      const db = new Date(b.timestamp).getTime();
      return sortDesc ? db - da : da - db;
    });

    setFiltered(result);
    setPage(1);
  }, [logs, search, selectedTypes, sortDesc]);

  // ── Toggle tipo ─────────────────────────────────────────────────────────

  const toggleType = (type: LogType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  // ── Exportar CSV ────────────────────────────────────────────────────────

  const exportCSV = () => {
    const header = ["Data/Hora", "Tipo", "Ação", "Realizado por", "Tipo Ator", "Motorista", "Veículo", "Descrição"];
    const rows = filtered.map((l) => [
      formatDate(l.timestamp),
      TYPE_CONFIG[l.type].label,
      l.action,
      l.actor,
      ACTOR_CONFIG[l.actorType].label,
      l.motoristaNome ?? "",
      l.veiculoPlaca ?? "",
      `"${l.description.replace(/"/g, '""')}"`,
    ]);
    const csv = [header, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria_${format(new Date(), "yyyyMMdd_HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Paginação ───────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Estatísticas (somente módulos habilitados) ──────────────────────────

  const statCards = [
    { label: "Total", value: filtered.length, icon: Activity, color: "text-gray-600 dark:text-gray-300", bg: "bg-gray-100 dark:bg-gray-700", always: true },
    { label: "Hodômetros", value: filtered.filter((l) => l.type === "hodometro").length, icon: Gauge, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/40", always: false, module: "hodometros" as const },
    { label: "Checklists", value: filtered.filter((l) => l.type === "checklist").length, icon: ClipboardCheck, color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/40", always: false, module: "checklist" as const },
    { label: "Motoristas", value: filtered.filter((l) => l.type === "motorista").length, icon: Users, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/40", always: false, module: "motoristas" as const },
    { label: "Veículos", value: filtered.filter((l) => l.type === "veiculo").length, icon: Truck, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900/40", always: false, module: "veiculos" as const },
    { label: "Gestão de Risco", value: filtered.filter((l) => l.type === "status_motorista").length, icon: ShieldAlert, color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/40", always: false, module: "motoristas" as const },
  ].filter((s) => s.always || moduleAccess[s.module!]);

  const colCount = statCards.length;

  // ─────────────────────────────────────────────────────────────────────────
  if (!moduleLoading && !moduleAccess.logs) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full">
          <ScrollText className="w-10 h-10 text-slate-400 dark:text-slate-500" />
        </div>
        <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300">
          Acesso não habilitado
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm">
          O módulo de Logs não está habilitado para esta conta. Entre em contato com o administrador.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <ScrollText className="w-6 h-6 text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Logs de Auditoria</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Histórico completo de ações do sistema
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLogs()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Legenda de atores */}
      <div className="flex flex-wrap gap-3">
        {(Object.entries(ACTOR_CONFIG) as [ActorType, typeof ACTOR_CONFIG[ActorType]][]).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1.5">
            <cfg.icon className={`w-3.5 h-3.5 ${cfg.cls}`} />
            <span className="font-medium">{cfg.label}</span>
          </div>
        ))}
      </div>

      {/* Cards de Estatísticas — lado a lado */}
      <div className="flex gap-4 flex-wrap">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="flex-1 min-w-[140px] bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3"
          >
            <div className={`p-2 rounded-lg ${s.bg} shrink-0`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-800 dark:text-white">{s.value}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros + lista */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">

        {/* Barra de busca */}
        <div className="p-4 flex flex-wrap gap-3 items-center border-b border-gray-100 dark:border-gray-700">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por motorista, veículo, ator, ação…"
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-200 placeholder-gray-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-200"
            />
            <span className="text-gray-400 text-sm">até</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-200"
            />
          </div>

          <button
            onClick={() => setSortDesc((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            {sortDesc ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            {sortDesc ? "Mais recentes" : "Mais antigos"}
          </button>

          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${
              showFilters
                ? "bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300"
                : "text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600"
            }`}
          >
            <Filter className="w-4 h-4" />
            Tipos
          </button>
        </div>

        {/* Filtro por tipo — somente módulos habilitados */}
        {showFilters && (
          <div className="px-4 py-3 flex flex-wrap gap-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
            {enabledTypes.map((type) => {
              const cfg = TYPE_CONFIG[type];
              const active = selectedTypes.has(type);
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                    active
                      ? `${cfg.badgeBg} ${cfg.badgeText} ${cfg.border}`
                      : "bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600"
                  }`}
                >
                  <cfg.icon className="w-3.5 h-3.5" />
                  {cfg.label}
                  {active && (
                    <span className="ml-1 font-bold">
                      {filtered.filter((l) => l.type === type).length}
                    </span>
                  )}
                </button>
              );
            })}
            <button
              onClick={() => setSelectedTypes(new Set(enabledTypes))}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Selecionar todos
            </button>
          </div>
        )}

        {/* Aviso de módulos sem acesso */}
        {(Object.keys(TYPE_CONFIG) as LogType[]).some(
          (type) => {
            const mk = TYPE_CONFIG[type].moduleKey;
            return mk !== null && !moduleAccess[mk];
          }
        ) && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            Alguns módulos não estão disponíveis para sua conta. Logs relacionados não são exibidos.
          </div>
        )}

        {/* Lista de logs */}
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">Carregando logs de auditoria…</p>
            </div>
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <ScrollText className="w-12 h-12 text-gray-300 dark:text-gray-600" />
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Nenhum log encontrado</p>
              <p className="text-gray-400 dark:text-gray-500 text-xs">Ajuste os filtros ou o intervalo de datas</p>
            </div>
          ) : (
            paginated.map((log) => {
              const cfg = TYPE_CONFIG[log.type];
              const actorCfg = ACTOR_CONFIG[log.actorType];
              const isExpanded = expandedId === log.id;

              const logUrl = getLogUrl(log);

              return (
                <div key={log.id} className={`transition-colors ${cfg.bg} hover:brightness-95`}>
                  <div
                    className="flex items-start gap-4 px-5 py-3.5 cursor-pointer select-none"
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  >
                    {/* Ícone tipo */}
                    <div className={`mt-0.5 p-2 rounded-lg border ${cfg.border} bg-white dark:bg-gray-800 shrink-0`}>
                      <cfg.icon className={`w-4 h-4 ${cfg.color}`} />
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full ${cfg.badgeBg} ${cfg.badgeText}`}>
                          {cfg.label}
                        </span>
                        <span className="text-sm font-semibold text-gray-800 dark:text-white">
                          {log.action}
                        </span>
                      </div>

                      <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                        {log.description}
                      </p>

                      {/* Metadados da linha */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500 dark:text-gray-400">

                        {/* Quem fez — destaque */}
                        <span className="flex items-center gap-1">
                          <span className="text-gray-400 dark:text-gray-500">Realizado por:</span>
                          <span className={`flex items-center gap-1 font-semibold ${actorCfg.cls}`}>
                            <actorCfg.icon className="w-3.5 h-3.5" />
                            {log.actor}
                          </span>
                        </span>

                        {/* Veículo */}
                        {log.veiculoPlaca && (
                          <span className="flex items-center gap-1">
                            <Truck className="w-3 h-3" />
                            {log.veiculoPlaca}
                          </span>
                        )}

                        {/* Data/hora */}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(log.timestamp)}
                        </span>
                      </div>
                    </div>

                    {/* Ações direita: expandir + abrir página */}
                    <div className="shrink-0 flex items-center gap-2 mt-0.5">
                      {/* Botão Abrir página */}
                      {logUrl && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(logUrl);
                          }}
                          title="Abrir página do registro"
                          className={`flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md border transition-colors ${cfg.badgeBg} ${cfg.badgeText} ${cfg.border} hover:opacity-80`}
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          Abrir
                        </button>
                      )}
                      {/* Expandir detalhes */}
                      {log.meta && Object.keys(log.meta).length > 0 && (
                        <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
                          <Eye className="w-3.5 h-3.5" />
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Detalhes expandidos */}
                  {isExpanded && log.meta && Object.keys(log.meta).length > 0 && (
                    <div className="px-5 pb-4 pt-0">
                      <div className="ml-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                          Detalhes do evento
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                          {Object.entries(log.meta)
                            .filter(([, v]) => v !== null && v !== undefined && v !== "")
                            .map(([k, v]) => (
                              <div key={k} className="bg-gray-50 dark:bg-gray-700 rounded-md px-3 py-2">
                                <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                                  {k.replace(/_/g, " ")}
                                </p>
                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mt-0.5 truncate">
                                  {typeof v === "boolean" ? (v ? "Sim" : "Não") : String(v)}
                                </p>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Paginação */}
        {!loading && filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Exibindo{" "}
              <span className="font-medium text-gray-700 dark:text-gray-200">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}
              </span>{" "}
              de{" "}
              <span className="font-medium text-gray-700 dark:text-gray-200">{filtered.length}</span>{" "}
              registros
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Anterior
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 text-sm rounded-lg border transition-colors ${
                      p === page
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Próxima
              </button>
            </div>
          </div>
        )}

        {/* Rodapé */}
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            Última atualização: {format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Logs;
