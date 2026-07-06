// Netlify Function — JPD Transportes
// Atende todas as rotas /api/jpd/* (redirect em netlify.toml e _redirects).
// Equivalente em produção das rotas Express em server/routes.ts.
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, wiseapp-token, wiseapp-account-id, X-Requested-With, Accept, Origin, Cache-Control, Pragma, Expires, apikey, x-client-info, api_access_token",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD",
  "Content-Type": "application/json",
};

const json = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });

// Placas são sempre normalizadas para minúsculas (sem espaços nas pontas),
// garantindo unicidade em jpd_veiculos e casamento com a FK.
const normalizePlaca = (v) => {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  return s === "" ? null : s;
};

// Garante que a placa exista na tabela mestra jpd_veiculos (cria se faltar),
// evitando violação da FK ao salvar fretes/abastecimentos.
async function ensureVeiculo(placa) {
  const p = normalizePlaca(placa);
  if (!p) return;
  await supabase
    .from("jpd_veiculos")
    .upsert({ placa: p }, { onConflict: "placa", ignoreDuplicates: true });
}

// Nomes de motorista são normalizados para minúsculas (sem espaços duplicados
// nem nas pontas). O frontend capitaliza só para exibição.
const normalizeNome = (v) => {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase().replace(/\s+/g, " ");
  return s === "" ? null : s;
};

// Garante que o motorista exista na tabela mestra motoristas_jpd (cria se faltar).
async function ensureMotorista(nome) {
  const n = normalizeNome(nome);
  if (!n) return;
  await supabase
    .from("motoristas_jpd")
    .upsert({ nome: n }, { onConflict: "nome", ignoreDuplicates: true });
}

// ---- Colunas do CSV (espelham exemplo.csv / tabela jpd_fretes) ----
const FRETE_COLS = [
  "origem", "destinatario", "motorista", "placa_do_carro", "numero_do_bv", "total_km",
  "data_do_bv", "data_da_carga", "data_da_descarga", "valor_do_frete", "outras_receitas",
  "abastecimento_pago_pela_jpd", "abastecimento_descontado_do_frete", "demais_despesas",
  "seguros", "aluguel", "pneus", "parcela_pneus", "plano_manutencao_ipva", "faltas_em_litros",
  "faltas_abonadas_rs", "faltas_cobradas_rs", "data_do_faturamento", "valor_faturado",
  "numero_do_cte", "situacao_do_bv",
  // Custos de abastecimento
  "fornecedor", "combustivel", "litros", "valor_unitario", "valor_bruto", "desconto", "arla",
];
const NUMERIC_COLS = new Set([
  "total_km", "valor_do_frete", "outras_receitas", "abastecimento_pago_pela_jpd",
  "abastecimento_descontado_do_frete", "demais_despesas", "seguros", "aluguel", "pneus",
  "parcela_pneus", "plano_manutencao_ipva", "faltas_em_litros", "faltas_abonadas_rs",
  "faltas_cobradas_rs", "valor_faturado",
  "litros", "valor_unitario", "valor_bruto", "desconto", "arla",
]);

function buildFreteRow(body) {
  const row = {};
  for (const col of FRETE_COLS) {
    if (!(col in (body || {}))) continue;
    let v = body[col];
    if (v === "" || v === undefined) v = null;
    if (v !== null && NUMERIC_COLS.has(col)) {
      const n = Number(v);
      v = Number.isFinite(n) ? n : null;
    }
    if (col === "placa_do_carro") v = normalizePlaca(v);
    if (col === "motorista") v = normalizeNome(v);
    row[col] = v;
  }
  return row;
}

// ---- Colunas dos lançamentos de abastecimento (homedometro_abastecimento_jpd) ----
const ABAST_COLS = [
  "hodometro", "placa", "fornecedor", "combustivel", "litros",
  "valor_unitario", "valor_bruto", "desconto", "arla",
];
const ABAST_NUMERIC = new Set([
  "hodometro", "litros", "valor_unitario", "valor_bruto", "desconto", "arla",
]);

function buildAbastecimentoRow(body) {
  const row = {};
  for (const col of ABAST_COLS) {
    if (!(col in (body || {}))) continue;
    let v = body[col];
    if (v === "" || v === undefined) v = null;
    if (v !== null && ABAST_NUMERIC.has(col)) {
      const n = Number(v);
      v = Number.isFinite(n) ? n : null;
    }
    if (col === "placa") v = normalizePlaca(v);
    row[col] = v;
  }
  return row;
}

// Extrai o sub-path depois de "jpd" -> ex.: "fretes", "fretes/123", "dashboard", "export.xlsx"
function subPath(event) {
  let p = "";
  if (event.pathParameters && event.pathParameters.splat) {
    p = event.pathParameters.splat;
  } else {
    const raw = (event.path || event.rawUrl || "").split("?")[0];
    p = raw
      .replace(/^.*\/\.netlify\/functions\/jpd\/?/, "")
      .replace(/^.*\/api\/jpd\/?/, "");
  }
  return p.replace(/^\/+|\/+$/g, "");
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS, body: "" };

  const method = event.httpMethod;
  const sub = subPath(event);
  const qs = event.queryStringParameters || {};
  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch (_) {
    body = {};
  }
  const segs = sub.split("/").filter(Boolean); // ex.: ["fretes","123"]

  try {
    // ---------- FRETES (CRUD) ----------
    if (segs[0] === "fretes") {
      const id = segs[1] ? Number(segs[1]) : null;

      if (method === "GET" && !id) {
        let q = supabase.from("jpd_fretes").select("*")
          .order("data_da_carga", { ascending: false });
        if (qs.from) q = q.gte("data_da_carga", qs.from);
        if (qs.to) q = q.lte("data_da_carga", qs.to);
        if (qs.motorista) q = q.eq("motorista", qs.motorista);
        if (qs.placa) q = q.eq("placa_do_carro", qs.placa);
        if (qs.situacao) q = q.eq("situacao_do_bv", qs.situacao);
        // BVs em aberto (para o seletor de vínculo de abastecimento)
        // != 'pago' sozinho exclui NULL no Postgres; incluímos os sem situação definida.
        if (qs.abertos) q = q.or("situacao_do_bv.is.null,situacao_do_bv.neq.pago");
        const { data, error } = await q;
        if (error) return json(500, { error: error.message });
        const fretes = data || [];

        // Anexa a soma dos abastecimentos vinculados (por frete_id) a cada BV.
        const num = (v) => (v == null ? 0 : Number(v) || 0);
        const { data: lancs } = await supabase
          .from("homedometro_abastecimento_jpd")
          .select("frete_id, litros, valor_bruto, desconto, arla")
          .not("frete_id", "is", null);
        const agg = {};
        for (const l of lancs || []) {
          const k = l.frete_id;
          agg[k] = agg[k] || { abast_count: 0, abast_litros: 0, abast_valor_bruto: 0, abast_desconto: 0, abast_arla: 0 };
          agg[k].abast_count += 1;
          agg[k].abast_litros += num(l.litros);
          agg[k].abast_valor_bruto += num(l.valor_bruto);
          agg[k].abast_desconto += num(l.desconto);
          agg[k].abast_arla += num(l.arla);
        }
        const withAgg = fretes.map((f) => ({
          ...f,
          ...(agg[f.id] || { abast_count: 0, abast_litros: 0, abast_valor_bruto: 0, abast_desconto: 0, abast_arla: 0 }),
        }));
        return json(200, withAgg);
      }

      if (method === "POST" && !id) {
        const row = buildFreteRow(body);
        await ensureVeiculo(row.placa_do_carro);
        await ensureMotorista(row.motorista);
        const { data, error } = await supabase.from("jpd_fretes").insert(row).select().single();
        if (error) return json(500, { error: error.message });
        return json(200, data);
      }

      if (method === "PUT" && id) {
        const row = { ...buildFreteRow(body), updated_at: new Date().toISOString() };
        if ("placa_do_carro" in row) await ensureVeiculo(row.placa_do_carro);
        if ("motorista" in row) await ensureMotorista(row.motorista);
        const { data, error } = await supabase.from("jpd_fretes").update(row).eq("id", id).select().single();
        if (error) return json(500, { error: error.message });
        return json(200, data);
      }

      if (method === "DELETE" && id) {
        const { error } = await supabase.from("jpd_fretes").delete().eq("id", id);
        if (error) return json(500, { error: error.message });
        return json(200, { success: true });
      }
    }

    // ---------- DASHBOARD ----------
    if (segs[0] === "dashboard" && method === "GET") {
      let q = supabase.from("jpd_fretes").select("*");
      if (qs.from) q = q.gte("data_da_carga", qs.from);
      if (qs.to) q = q.lte("data_da_carga", qs.to);
      const { data: fretes, error } = await q;
      if (error) return json(500, { error: error.message });

      const num = (v) => (v == null ? 0 : Number(v) || 0);
      const rows = fretes || [];
      const total_viagens = rows.length;
      const total_frete = rows.reduce((s, r) => s + num(r.valor_do_frete), 0);
      const total_faturado = rows.reduce((s, r) => s + num(r.valor_faturado), 0);
      const total_km = rows.reduce((s, r) => s + num(r.total_km), 0);
      const custos = {
        demais_despesas: rows.reduce((s, r) => s + num(r.demais_despesas), 0),
        seguros: rows.reduce((s, r) => s + num(r.seguros), 0),
        abastecimento_jpd: rows.reduce((s, r) => s + num(r.abastecimento_pago_pela_jpd), 0),
        pneus: rows.reduce((s, r) => s + num(r.pneus), 0),
      };
      const total_custos = custos.demais_despesas + custos.seguros + custos.abastecimento_jpd + custos.pneus;

      const bySituacao = {};
      const byMotorista = {};
      const byVeiculo = {};
      for (const r of rows) {
        const s = (r.situacao_do_bv || "sem_status").toString();
        bySituacao[s] = (bySituacao[s] || 0) + 1;
        const m = r.motorista || "—";
        const p = r.placa_do_carro || "—";
        byMotorista[m] = byMotorista[m] || { motorista: m, viagens: 0, valor: 0 };
        byMotorista[m].viagens += 1;
        byMotorista[m].valor += num(r.valor_do_frete);
        byVeiculo[p] = byVeiculo[p] || { placa: p, viagens: 0, valor: 0 };
        byVeiculo[p].viagens += 1;
        byVeiculo[p].valor += num(r.valor_faturado);
      }

      return json(200, {
        kpis: { total_viagens, total_frete, total_faturado, total_custos, total_km },
        custos: [
          { label: "Demais despesas", value: custos.demais_despesas },
          { label: "Seguros", value: custos.seguros },
          { label: "Abastecimento JPD", value: custos.abastecimento_jpd },
          { label: "Pneus", value: custos.pneus },
        ],
        situacao_bvs: Object.entries(bySituacao).map(([label, value]) => ({ label, value })),
        por_motorista: Object.values(byMotorista).sort((a, b) => b.valor - a.valor),
        por_veiculo: Object.values(byVeiculo).sort((a, b) => b.valor - a.valor),
      });
    }

    // ---------- EXPORT (CSV — abre no Excel) ----------
    if (segs[0] && segs[0].indexOf("export") === 0 && method === "GET") {
      let q = supabase.from("jpd_fretes").select("*")
        .order("data_da_carga", { ascending: true });
      if (qs.from) q = q.gte("data_da_carga", qs.from);
      if (qs.to) q = q.lte("data_da_carga", qs.to);
      const { data, error } = await q;
      if (error) return json(500, { error: error.message });

      const headersCsv = [
        ["ORIGEM", "origem"], ["DESTINATÁRIO", "destinatario"], ["MOTORISTA", "motorista"],
        ["PLACA DO CARRO", "placa_do_carro"], ["Número do BV", "numero_do_bv"], ["Total KM", "total_km"],
        ["DATA DO BV", "data_do_bv"], ["DATA DA CARGA", "data_da_carga"], ["DATA DA DESCARGA", "data_da_descarga"],
        ["VALOR DO FRETE", "valor_do_frete"], ["OUTRAS RECEITAS", "outras_receitas"],
        ["ABASTECIMENTO PAGO PELA JPD", "abastecimento_pago_pela_jpd"],
        ["ABASTECIMENTO DESCONTADO DO FRETE", "abastecimento_descontado_do_frete"],
        ["DEMAIS DESPESAS", "demais_despesas"], ["SEGUROS", "seguros"], ["ALUGUEL", "aluguel"],
        ["PNEUS", "pneus"], ["PARCELA PNEUS", "parcela_pneus"], ["PLANO MANUTENÇÃO + IPVA", "plano_manutencao_ipva"],
        ["FALTAS EM LITROS", "faltas_em_litros"], ["FALTAS ABONADAS EM R$", "faltas_abonadas_rs"],
        ["FALTAS COBRADAS EM R$", "faltas_cobradas_rs"], ["DATA DO FATURAMENTO", "data_do_faturamento"],
        ["VALOR FATURADO", "valor_faturado"], ["NÚMERO DO CTE", "numero_do_cte"], ["SITUAÇÃO DO BV", "situacao_do_bv"],
      ];
      const esc = (v) => {
        if (v == null) return "";
        const s = String(v);
        return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      };
      const sep = ";"; // pt-BR Excel usa ; como separador
      const lines = [headersCsv.map((h) => h[0]).join(sep)];
      for (const r of data || []) lines.push(headersCsv.map((h) => esc(r[h[1]])).join(sep));
      const csv = "﻿" + lines.join("\r\n"); // BOM p/ acentos no Excel

      return {
        statusCode: 200,
        headers: {
          ...CORS,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="jpd_fretes_${Date.now()}.csv"`,
        },
        body: csv,
      };
    }

    // ---------- VEICULOS (agregado por placa a partir de jpd_fretes) ----------
    if (segs[0] === "veiculos" && method === "GET") {
      const { data: fretes, error } = await supabase.from("jpd_fretes").select("*");
      if (error) return json(500, { error: error.message });
      const { data: abasts } = await supabase.from("homedometro_abastecimento_jpd").select("*");
      const num = (v) => (v == null ? 0 : Number(v) || 0);
      const rows = fretes || [];
      const lancamentos = abasts || [];

      // Calcula métricas de consumo para um conjunto de viagens + lançamentos
      const calcConsumo = (viagensArr, lancArr) => {
        const km = viagensArr.reduce((s, r) => s + num(r.total_km), 0);
        const litros = lancArr.reduce((s, l) => s + num(l.litros), 0);
        const dias = new Set(viagensArr.map((r) => r.data_da_carga).filter(Boolean)).size;
        const gasto_combustivel = lancArr.reduce((s, l) => s + (num(l.valor_bruto) - num(l.desconto)), 0);
        const arla_total = lancArr.reduce((s, l) => s + num(l.arla), 0);
        return {
          km_por_litro: litros > 0 ? km / litros : 0,
          media_km_diaria: dias > 0 ? km / dias : 0,
          total_leituras: lancArr.length,
          litros_totais: litros,
          gasto_combustivel,
          custo_medio_litro: litros > 0 ? gasto_combustivel / litros : 0,
          custo_extra_arla: arla_total,
        };
      };

      // Detalhe de uma placa específica
      if (qs.placa) {
        const viagens = rows
          .filter((r) => (r.placa_do_carro || "") === qs.placa)
          .sort((a, b) => String(b.data_da_carga || "").localeCompare(String(a.data_da_carga || "")));
        const lancPlaca = lancamentos.filter((l) => (l.placa || "") === qs.placa);
        const resumo = {
          placa: qs.placa,
          viagens: viagens.length,
          faturado: viagens.reduce((s, r) => s + num(r.valor_faturado), 0),
          frete: viagens.reduce((s, r) => s + num(r.valor_do_frete), 0),
          km: viagens.reduce((s, r) => s + num(r.total_km), 0),
          combustivel: viagens.reduce((s, r) => s + num(r.abastecimento_pago_pela_jpd), 0),
        };
        const consumo = calcConsumo(viagens, lancPlaca);
        return json(200, { resumo, viagens, consumo });
      }

      // Lista agregada de veículos
      const byPlaca = {};
      for (const r of rows) {
        const p = r.placa_do_carro || "—";
        byPlaca[p] = byPlaca[p] || {
          placa: p, viagens: 0, faturado: 0, frete: 0, km: 0, combustivel: 0,
          ultimo_bv: "", _ultima_data: "",
        };
        const v = byPlaca[p];
        v.viagens += 1;
        v.faturado += num(r.valor_faturado);
        v.frete += num(r.valor_do_frete);
        v.km += num(r.total_km);
        v.combustivel += num(r.abastecimento_pago_pela_jpd);
        const d = String(r.data_da_carga || r.data_do_bv || "");
        if (r.numero_do_bv && d >= v._ultima_data) {
          v.ultimo_bv = r.numero_do_bv;
          v._ultima_data = d;
        }
      }
      const resumo = Object.values(byPlaca)
        .map(({ _ultima_data, ...rest }) => {
          const viagensPlaca = rows.filter((r) => (r.placa_do_carro || "—") === rest.placa);
          const lancPlaca = lancamentos.filter((l) => (l.placa || "") === rest.placa);
          return {
            ...rest,
            ultimo_bv: rest.ultimo_bv || "(pendente)",
            consumo: calcConsumo(viagensPlaca, lancPlaca),
          };
        })
        .sort((a, b) => b.faturado - a.faturado);

      // Consumo global (todos os veículos)
      const consumo = calcConsumo(rows, lancamentos);

      // Viagens "em andamento" = tem BV mas ainda sem data de descarga
      const em_andamento = rows
        .filter((r) => r.numero_do_bv && !r.data_da_descarga)
        .map((r) => ({
          id: r.id,
          placa: r.placa_do_carro || "—",
          motorista: r.motorista || "—",
          origem: r.origem || "—",
          destinatario: r.destinatario || "—",
          data: r.data_da_carga || r.data_do_bv || "—",
        }));

      // Situação por datas do BV (hoje vem do cliente via ?hoje=YYYY-MM-DD).
      const hoje = qs.hoje || "";
      const mapBv = (r) => ({
        id: r.id,
        placa: r.placa_do_carro || "—",
        motorista: r.motorista || "—",
        origem: r.origem || "—",
        destinatario: r.destinatario || "—",
        numero_do_bv: r.numero_do_bv || "—",
        situacao_do_bv: r.situacao_do_bv || "",
        data_da_carga: r.data_da_carga || "",
        data_da_descarga: r.data_da_descarga || "",
      });
      // Em viagem: tem data de carga (<= hoje) e ainda sem descarga
      const em_viagem = rows
        .filter((r) => r.data_da_carga && !r.data_da_descarga && (!hoje || String(r.data_da_carga) <= hoje))
        .map(mapBv);
      // A viajar: data de carga no futuro (> hoje) e sem descarga
      const a_viajar = rows
        .filter((r) => r.data_da_carga && !r.data_da_descarga && hoje && String(r.data_da_carga) > hoje)
        .map(mapBv);
      // Pendentes: situação 'pendente' ou sem situação definida
      const pendentes = rows
        .filter((r) => !r.situacao_do_bv || r.situacao_do_bv === "pendente")
        .map(mapBv);

      return json(200, { resumo, em_andamento, consumo, em_viagem, a_viajar, pendentes });
    }

    // ---------- DOCUMENTS ----------
    if (segs[0] === "documents") {
      const id = segs[1] ? Number(segs[1]) : null;

      if (method === "GET" && !id) {
        let q = supabase.from("jpd_documents").select("*")
          .order("created_at", { ascending: false });
        if (qs.status) q = q.eq("status", qs.status);
        const { data, error } = await q;
        if (error) return json(500, { error: error.message });
        return json(200, data || []);
      }

      if (method === "GET" && id) {
        const { data: doc, error: dErr } = await supabase.from("jpd_documents").select("*").eq("id", id).single();
        if (dErr) return json(404, { error: dErr.message });
        const { data: ext } = await supabase.from("jpd_extractions").select("*")
          .eq("document_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
        return json(200, { document: doc, extraction: ext, file_url: null });
      }

      // POST /documents/:id/reject
      if (method === "POST" && id && segs[2] === "reject") {
        const { error } = await supabase.from("jpd_documents")
          .update({ status: "rejected", updated_at: new Date().toISOString() }).eq("id", id);
        if (error) return json(500, { error: error.message });
        return json(200, { success: true });
      }
    }

    // ---------- EXTRACTIONS ----------
    if (segs[0] === "extractions") {
      const id = segs[1] ? Number(segs[1]) : null;

      if (method === "PUT" && id) {
        const { fields } = body || {};
        if (!fields || typeof fields !== "object") return json(400, { error: "fields obrigatorio" });
        const { data, error } = await supabase.from("jpd_extractions")
          .update({ fields, updated_at: new Date().toISOString() }).eq("id", id).select().single();
        if (error) return json(500, { error: error.message });
        return json(200, data);
      }

      // POST /extractions/:id/approve
      if (method === "POST" && id && segs[2] === "approve") {
        const { data: ext, error: eErr } = await supabase.from("jpd_extractions").select("*").eq("id", id).single();
        if (eErr) return json(404, { error: eErr.message });
        const { data: doc, error: dErr } = await supabase.from("jpd_documents").select("*").eq("id", ext.document_id).single();
        if (dErr) return json(404, { error: dErr.message });
        const f = ext.fields || {};
        const freightRow = buildFreteRow(f);
        await ensureVeiculo(freightRow.placa_do_carro);
        await ensureMotorista(freightRow.motorista);
        const { error: fErr } = await supabase.from("jpd_fretes").insert(freightRow);
        if (fErr) return json(500, { error: fErr.message });
        await supabase.from("jpd_documents").update({ status: "approved", updated_at: new Date().toISOString() }).eq("id", doc.id);

        if (f.motorista) {
          const { data: existing } = await supabase.from("jpd_drivers").select("id")
            .eq("company_id", doc.company_id).eq("nome", f.motorista).maybeSingle();
          if (!existing) await supabase.from("jpd_drivers").insert({ company_id: doc.company_id, nome: f.motorista });
        }
        if (f.placa_do_carro) {
          const { data: existing } = await supabase.from("jpd_vehicles").select("id")
            .eq("company_id", doc.company_id).eq("placa", f.placa_do_carro).maybeSingle();
          if (!existing) await supabase.from("jpd_vehicles").insert({ company_id: doc.company_id, placa: f.placa_do_carro });
        }
        return json(200, { success: true });
      }
    }

    // ---------- OPCOES (dropdowns de placa/motorista a partir das tabelas mestras) ----------
    if (segs[0] === "opcoes" && method === "GET") {
      const { data: veics } = await supabase.from("jpd_veiculos").select("placa").order("placa");
      const { data: mots } = await supabase.from("motoristas_jpd").select("nome").order("nome");
      const uniqSorted = (arr) =>
        Array.from(new Set((arr || []).map((x) => x).filter((x) => x != null && String(x).trim() !== "")))
          .sort((a, b) => String(a).localeCompare(String(b)));
      return json(200, {
        veiculos: uniqSorted((veics || []).map((v) => v.placa)),
        motoristas: uniqSorted((mots || []).map((m) => m.nome)),
      });
    }

    // ---------- ABASTECIMENTOS (lançamentos de hodômetro/combustível) ----------
    if (segs[0] === "abastecimentos") {
      const id = segs[1] ? Number(segs[1]) : null;

      if (method === "GET" && !id) {
        let q = supabase.from("homedometro_abastecimento_jpd").select("*")
          .order("created_at", { ascending: false });
        if (qs.placa) q = q.eq("placa", qs.placa);
        if (qs.frete_id) q = q.eq("frete_id", Number(qs.frete_id));
        if (qs.from) q = q.gte("created_at", qs.from);
        if (qs.to) q = q.lte("created_at", qs.to);
        const { data, error } = await q;
        if (error) return json(500, { error: error.message });
        return json(200, data || []);
      }

      if (method === "POST" && !id) {
        const row = buildAbastecimentoRow(body);
        await ensureVeiculo(row.placa);
        const { data, error } = await supabase.from("homedometro_abastecimento_jpd").insert(row).select().single();
        if (error) return json(500, { error: error.message });
        return json(200, data);
      }

      // POST /abastecimentos/:id/vincular  body { frete_id }
      // Vários abastecimentos podem apontar para o mesmo BV: gravamos apenas
      // frete_id no lançamento (sem copiar/sobrescrever custos no jpd_fretes).
      // Os custos do BV passam a ser a SOMA dos lançamentos vinculados (ver GET /fretes).
      if (method === "POST" && id && segs[2] === "vincular") {
        const frete_id = Number(body && body.frete_id);
        if (!Number.isFinite(frete_id)) return json(400, { error: "frete_id obrigatorio" });
        const { data, error } = await supabase.from("homedometro_abastecimento_jpd")
          .update({ frete_id, updated_at: new Date().toISOString() }).eq("id", id).select().single();
        if (error) return json(500, { error: error.message });
        return json(200, data);
      }

      if (method === "PUT" && id) {
        const row = { ...buildAbastecimentoRow(body), updated_at: new Date().toISOString() };
        if ("placa" in row) await ensureVeiculo(row.placa);
        const { data, error } = await supabase.from("homedometro_abastecimento_jpd")
          .update(row).eq("id", id).select().single();
        if (error) return json(500, { error: error.message });
        return json(200, data);
      }

      if (method === "DELETE" && id) {
        const { error } = await supabase.from("homedometro_abastecimento_jpd").delete().eq("id", id);
        if (error) return json(500, { error: error.message });
        return json(200, { success: true });
      }
    }

    return json(404, { error: "Rota JPD não encontrada", method, sub });
  } catch (err) {
    console.error("Erro na função JPD:", err);
    return json(500, { error: err.message || "Erro interno" });
  }
};
