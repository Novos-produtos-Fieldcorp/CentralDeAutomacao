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

// ---- Colunas do CSV (espelham exemplo.csv / tabela jpd_fretes) ----
const FRETE_COLS = [
  "document_id",
  "origem", "destinatario", "motorista", "placa_do_carro", "numero_do_bv", "total_km",
  "data_do_bv", "data_da_carga", "data_da_descarga", "valor_do_frete", "outras_receitas",
  "abastecimento_pago_pela_jpd", "abastecimento_descontado_do_frete", "demais_despesas",
  "seguros", "aluguel", "pneus", "parcela_pneus", "plano_manutencao_ipva", "faltas_em_litros",
  "faltas_abonadas_rs", "faltas_cobradas_rs", "data_do_faturamento", "valor_faturado",
  "numero_do_cte", "situacao_do_bv",
];
const NUMERIC_COLS = new Set([
  "total_km", "valor_do_frete", "outras_receitas", "abastecimento_pago_pela_jpd",
  "abastecimento_descontado_do_frete", "demais_despesas", "seguros", "aluguel", "pneus",
  "parcela_pneus", "plano_manutencao_ipva", "faltas_em_litros", "faltas_abonadas_rs",
  "faltas_cobradas_rs", "valor_faturado", "document_id",
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
    row[col] = v;
  }
  return row;
}

function companyIdFrom(qs, body) {
  const raw = (qs && qs.company_id) || (body && body.company_id);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
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
        const company_id = companyIdFrom(qs, body);
        if (!company_id) return json(400, { error: "company_id obrigatorio" });
        let q = supabase.from("jpd_fretes").select("*").eq("company_id", company_id)
          .order("data_da_carga", { ascending: false });
        if (qs.from) q = q.gte("data_da_carga", qs.from);
        if (qs.to) q = q.lte("data_da_carga", qs.to);
        if (qs.motorista) q = q.eq("motorista", qs.motorista);
        if (qs.placa) q = q.eq("placa_do_carro", qs.placa);
        if (qs.situacao) q = q.eq("situacao_do_bv", qs.situacao);
        const { data, error } = await q;
        if (error) return json(500, { error: error.message });
        return json(200, data || []);
      }

      if (method === "POST" && !id) {
        const company_id = companyIdFrom(qs, body);
        if (!company_id) return json(400, { error: "company_id obrigatorio" });
        const row = { ...buildFreteRow(body), company_id };
        const { data, error } = await supabase.from("jpd_fretes").insert(row).select().single();
        if (error) return json(500, { error: error.message });
        return json(200, data);
      }

      if (method === "PUT" && id) {
        const row = { ...buildFreteRow(body), updated_at: new Date().toISOString() };
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
      const company_id = companyIdFrom(qs, body);
      if (!company_id) return json(400, { error: "company_id obrigatorio" });
      let q = supabase.from("jpd_fretes").select("*").eq("company_id", company_id);
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
      const company_id = companyIdFrom(qs, body);
      if (!company_id) return json(400, { error: "company_id obrigatorio" });
      let q = supabase.from("jpd_fretes").select("*").eq("company_id", company_id)
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

    // ---------- DOCUMENTS ----------
    if (segs[0] === "documents") {
      const id = segs[1] ? Number(segs[1]) : null;

      if (method === "GET" && !id) {
        const company_id = companyIdFrom(qs, body);
        if (!company_id) return json(400, { error: "company_id obrigatorio" });
        let q = supabase.from("jpd_documents").select("*").eq("company_id", company_id)
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
        const freightRow = {
          company_id: doc.company_id,
          document_id: doc.id,
          ...buildFreteRow(f),
        };
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

    return json(404, { error: "Rota JPD não encontrada", method, sub });
  } catch (err) {
    console.error("Erro na função JPD:", err);
    return json(500, { error: err.message || "Erro interno" });
  }
};
