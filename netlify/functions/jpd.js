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
  // Impede o navegador de servir dados velhos do cache (ex.: frete deletado
  // reaparecendo na lista após o refetch). API sempre fresca.
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
};

const json = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });

// Webhooks n8n de leitura automática (OCR). Recebem { url } (link público no
// bucket Supabase jpd-uploads) e devolvem JSON com chaves = colunas do BV/lançamento.
const N8N_WEBHOOKS = {
  bv: "https://n8nqp.wiseapp360.com/webhook/leitor-arquivos",
  hodometro: "https://n8nqp.wiseapp360.com/webhook/leitorHodometro",
  comprovante: "https://n8nqp.wiseapp360.com/webhook/leitor-comprovante",
  salvarFormulario: "https://n8nqp.wiseapp360.com/webhook/salvar-formulario",
};

// Chama um webhook n8n com { url } e retorna o JSON extraído. Lança em falha.
async function chamarWebhookN8n(webhookUrl, fileUrl) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: fileUrl }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Webhook respondeu ${res.status}${txt ? `: ${txt.slice(0, 200)}` : ""}`);
  }
  const data = await res.json().catch(() => ({}));
  // n8n às vezes devolve [{...}] em vez de {...}: normaliza para objeto.
  return Array.isArray(data) ? (data[0] || {}) : (data || {});
}

// Converte data "DD/MM/YYYY" (formato do webhook) para "YYYY-MM-DD" (input date).
// Retorna null se não casar o formato esperado.
const brToISO = (v) => {
  if (v == null) return null;
  const m = String(v).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

// Traduz a resposta do webhook de leitura de BV para as chaves que o
// formulário de frete espera (JpdFreteForm). O webhook aninha os dados em
// `dados_limpos` e usa nomes diferentes; sem esta tradução nada preenche.
const mapBvOcr = (raw) => {
  const clean = (raw && raw.dados_limpos) || raw || {};
  const out = {};
  const set = (key, val) => {
    if (val !== null && val !== undefined && val !== "") out[key] = val;
  };
  set("numero_do_bv", clean.numero_autorizacao);
  set("data_do_bv", brToISO(clean.data));
  set("motorista", normalizeNome(clean.motorista));
  set("placa_do_carro", normalizePlaca(clean.placa_cavalo));
  set("total_km", clean.km_total);
  set("combustivel", clean.produto);
  // viagens: 1º bloco (perna vazia) define a origem; 2º bloco (perna cheia)
  // define o destino do frete.
  const viagens = Array.isArray(clean.viagens) ? clean.viagens : [];
  if (viagens[0]) set("origem", viagens[0].origem);
  if (viagens[1]) set("destinatario", viagens[1].destino);
  return out;
};

// Traduz as respostas dos webhooks de hodômetro e comprovante para as chaves
// que o form de lançamento (JpdGerarLancamento / ABAST_COLS) espera. Cada
// webhook aninha os dados de forma diferente: hodômetro em `output`,
// comprovante em `dados_limpos`.
const mapLancamentoOcr = (hodo, comp) => {
  const h = (hodo && hodo.output) || hodo || {};
  const c = (comp && comp.dados_limpos) || comp || {};
  const out = {};
  const set = (key, val) => {
    if (val !== null && val !== undefined && val !== "") out[key] = val;
  };
  set("hodometro", h.kilometragem);
  set("fornecedor", c.fornecedor);
  set("cnpj", c.cnpj);
  set("combustivel", c.combustivel);
  set("litros", c.litros);
  set("valor_unitario", c.valor_unitario);
  set("valor_bruto", c.valor_bruto);
  set("desconto", c.desconto);
  set("arla", c.arla);
  return out;
};

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

// ---- Exclusão de placa/motorista com vínculos ----
// Nunca em cascata silenciosa: o DELETE sem `acao` responde 409 com os vínculos e o
// usuário escolhe entre reatribuir a outro cadastro ou excluir os itens vinculados.
const FRETE_VINCULO_COLS = "id, numero_do_bv, data_do_bv, motorista, placa_do_carro, situacao_do_bv, deleted_at";
const ABAST_VINCULO_COLS = "id, created_at, placa, motorista_id, fornecedor, litros, frete_id";

// Anexa numero_do_bv aos lançamentos que apontam para um BV, para exibir no modal de vínculos.
async function comNumeroBv(abastecimentos) {
  const ids = Array.from(new Set((abastecimentos || []).map((a) => a.frete_id).filter((x) => x != null)));
  if (!ids.length) return abastecimentos || [];
  const { data } = await supabase.from("jpd_fretes").select("id, numero_do_bv").in("id", ids);
  const num = {};
  for (const f of data || []) num[f.id] = f.numero_do_bv;
  return abastecimentos.map((a) => ({ ...a, numero_do_bv: a.frete_id != null ? num[a.frete_id] || null : null }));
}

// Apaga definitivamente BVs (inclusive os da lixeira, que ainda seguram a FK) e
// desvincula qualquer abastecimento que apontava para eles.
async function apagarFretes(ids) {
  if (!ids.length) return null;
  const r1 = await supabase.from("homedometro_abastecimento_jpd").update({ frete_id: null }).in("frete_id", ids);
  if (r1.error) return r1.error;
  const r2 = await supabase.from("jpd_fretes").delete().in("id", ids);
  return r2.error || null;
}

// Resolve o que fazer com os vínculos antes de apagar o cadastro mestre.
// `cfg`: { fretesQuery, abastQuery, reatribuirFretes(novo), reatribuirAbast(novo) }
async function resolverVinculos(acao, cfg) {
  if (acao === "reatribuir") {
    const e1 = await cfg.reatribuirFretes();
    if (e1) return e1;
    return await cfg.reatribuirAbast();
  }
  if (acao === "excluir") {
    const { data: fr, error: ef } = await cfg.fretesQuery();
    if (ef) return ef;
    const ea = await cfg.apagarAbast();
    if (ea) return ea;
    return await apagarFretes((fr || []).map((f) => f.id));
  }
  return null;
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
// motorista_id referencia motoristas_jpd(id) — diferente de jpd_fretes.motorista,
// que referencia motoristas_jpd(nome). O id é resolvido no frontend (seleção ou
// criação do motorista) antes de chegar aqui.
const ABAST_COLS = [
  "hodometro", "placa", "motorista_id", "fornecedor", "cnpj", "combustivel", "litros",
  "valor_unitario", "valor_bruto", "desconto", "arla", "operacao", "frete_id", "data_lancamento",
];
const ABAST_NUMERIC = new Set([
  "hodometro", "motorista_id", "litros", "valor_unitario", "valor_bruto", "desconto", "arla", "frete_id",
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
      const id = segs[1] && segs[1] !== "lixeira" ? Number(segs[1]) : null;

      // GET /fretes/lixeira — BVs excluídos nos últimos 30 dias (recuperáveis)
      if (segs[1] === "lixeira" && method === "GET") {
        const { data, error } = await supabase
          .from("jpd_fretes")
          .select("*")
          .not("deleted_at", "is", null)
          .order("deleted_at", { ascending: false });
        if (error) return json(500, { error: error.message });
        return json(200, data || []);
      }

      // POST /fretes/:id/restaurar — desfaz a exclusão (só funciona dentro dos 30 dias)
      if (id && segs[2] === "restaurar" && method === "POST") {
        const { data, error } = await supabase
          .from("jpd_fretes")
          .update({ deleted_at: null })
          .eq("id", id)
          .not("deleted_at", "is", null)
          .select()
          .maybeSingle();
        if (error) return json(500, { error: error.message });
        if (!data) return json(404, { error: "Boletim não está na lixeira (ou já foi purgado após 30 dias)." });
        return json(200, data);
      }

      if (method === "GET" && !id) {
        let q = supabase.from("jpd_fretes").select("*")
          .is("deleted_at", null)
          .order("data_do_bv", { ascending: false });
        if (qs.from) q = q.gte("data_do_bv", qs.from);
        if (qs.to) q = q.lte("data_do_bv", qs.to);
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

      if (method === "PUT" && id && !segs[2]) {
        const row = { ...buildFreteRow(body), updated_at: new Date().toISOString() };
        if ("placa_do_carro" in row) await ensureVeiculo(row.placa_do_carro);
        if ("motorista" in row) await ensureMotorista(row.motorista);
        const { data, error } = await supabase.from("jpd_fretes").update(row).eq("id", id).is("deleted_at", null).select().maybeSingle();
        if (error) return json(500, { error: error.message });
        if (!data) return json(404, { error: "Boletim não encontrado — pode já ter sido excluído. Atualize a lista." });
        return json(200, data);
      }

      // Apaga definitivamente (e desvincula abastecimentos) os BVs marcados
      // como excluídos há mais de 30 dias. Chamado de forma "preguiçosa" a
      // cada DELETE, para não depender de um cron separado.
      if (method === "DELETE" && id && !segs[2]) {
        const RETENCAO_LIXEIRA_DIAS = 30;
        const limite = new Date(Date.now() - RETENCAO_LIXEIRA_DIAS * 24 * 60 * 60 * 1000).toISOString();

        const { data, error } = await supabase
          .from("jpd_fretes")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", id)
          .is("deleted_at", null)
          .select()
          .maybeSingle();
        if (error) return json(500, { error: error.message });
        if (!data) return json(404, { error: "Boletim não encontrado — pode já ter sido excluído." });

        const { data: antigos } = await supabase.from("jpd_fretes").select("id").lt("deleted_at", limite);
        const idsAntigos = (antigos || []).map((r) => r.id);
        if (idsAntigos.length) {
          await supabase.from("homedometro_abastecimento_jpd").update({ frete_id: null }).in("frete_id", idsAntigos);
          await supabase.from("jpd_fretes").delete().in("id", idsAntigos);
        }

        return json(200, { success: true });
      }

      // ---------- Observações do BV (histórico empilhado) ----------
      if (id && segs[2] === "observacoes" && method === "GET") {
        const { data, error } = await supabase
          .from("jpd_frete_observacoes")
          .select("*")
          .eq("frete_id", id)
          .order("created_at", { ascending: false });
        if (error) return json(500, { error: error.message });
        return json(200, data || []);
      }

      if (id && segs[2] === "observacoes" && method === "POST") {
        const observacao = String(body?.observacao || "").trim();
        if (!observacao) return json(400, { error: "observacao obrigatória" });
        const { data, error } = await supabase
          .from("jpd_frete_observacoes")
          .insert({ frete_id: id, observacao })
          .select()
          .single();
        if (error) return json(500, { error: error.message });
        return json(200, data);
      }

      if (id && segs[2] === "observacoes" && segs[3] && method === "PUT") {
        const obsId = Number(segs[3]);
        const observacao = String(body?.observacao || "").trim();
        if (!observacao) return json(400, { error: "observacao obrigatória" });
        const { data, error } = await supabase
          .from("jpd_frete_observacoes")
          .update({ observacao })
          .eq("id", obsId)
          .select()
          .maybeSingle();
        if (error) return json(500, { error: error.message });
        if (!data) return json(404, { error: "Observação não encontrada — pode já ter sido excluída." });
        return json(200, data);
      }

      if (id && segs[2] === "observacoes" && segs[3] && method === "DELETE") {
        const obsId = Number(segs[3]);
        const { error } = await supabase.from("jpd_frete_observacoes").delete().eq("id", obsId);
        if (error) return json(500, { error: error.message });
        return json(200, { success: true });
      }
    }

    // ---------- DASHBOARD ----------
    if (segs[0] === "dashboard" && method === "GET") {
      let q = supabase.from("jpd_fretes").select("*").is("deleted_at", null);
      if (qs.from) q = q.gte("data_do_bv", qs.from);
      if (qs.to) q = q.lte("data_do_bv", qs.to);
      if (qs.motorista) q = q.eq("motorista", qs.motorista);
      if (qs.situacao) q = q.eq("situacao_do_bv", qs.situacao);
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
      const byVeiculoSituacao = {};
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
        byVeiculo[p].valor += num(r.valor_do_frete);
        if (s === "A Carregar" || s === "Em viagem") {
          byVeiculoSituacao[p] = byVeiculoSituacao[p] || { placa: p, motorista: "", a_carregar: 0, em_viagem: 0 };
          if (s === "A Carregar") byVeiculoSituacao[p].a_carregar += 1;
          else byVeiculoSituacao[p].em_viagem += 1;
        }
      }

      // Monitoramento por veículo: lista TODOS os veículos cadastrados, com ou sem
      // status. Quem não tem BV "A Carregar"/"Em viagem" fica como aguardando programação.
      // O motorista exibido é o do BV ativo mais recente (ou, na falta, do último BV).
      // `motorista` (padrão do veículo) só existe após rodar setup-jpd-veiculos-motorista-padrao.sql;
      // se a coluna ainda não existir, cai para a lista só com placas.
      let veicsCad = null;
      {
        const r = await supabase.from("jpd_veiculos").select("placa, motorista");
        veicsCad = r.error ? (await supabase.from("jpd_veiculos").select("placa")).data : r.data;
      }
      const motoristaPadrao = {};
      for (const v of veicsCad || []) if (v.motorista) motoristaPadrao[v.placa] = v.motorista;
      const { data: todosFretes } = await supabase
        .from("jpd_fretes")
        .select("id, placa_do_carro, motorista, data_do_bv, situacao_do_bv")
        .is("deleted_at", null);
      const ativo = (r) => r.situacao_do_bv === "A Carregar" || r.situacao_do_bv === "Em viagem";
      const motoristaPorPlaca = {};
      const rankPlaca = {};
      for (const r of todosFretes || []) {
        if (!r.placa_do_carro || !r.motorista) continue;
        // Ativo tem prioridade; dentro do grupo, o mais recente (data do BV, depois id).
        const rank = `${ativo(r) ? 1 : 0}|${String(r.data_do_bv || "")}|${String(r.id).padStart(12, "0")}`;
        if (rank > (rankPlaca[r.placa_do_carro] || "")) {
          rankPlaca[r.placa_do_carro] = rank;
          motoristaPorPlaca[r.placa_do_carro] = r.motorista;
        }
      }
      for (const v of veicsCad || []) {
        byVeiculoSituacao[v.placa] = byVeiculoSituacao[v.placa] || { placa: v.placa, motorista: "", a_carregar: 0, em_viagem: 0 };
      }
      const por_veiculo_situacao = Object.values(byVeiculoSituacao)
        .map((v) => ({
          ...v,
          motorista: motoristaPorPlaca[v.placa] || motoristaPadrao[v.placa] || "",
          aguardando_programacao: v.a_carregar + v.em_viagem === 0,
        }))
        .sort(
          (a, b) =>
            b.a_carregar + b.em_viagem - (a.a_carregar + a.em_viagem) ||
            String(a.placa).localeCompare(String(b.placa))
        );

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
        por_veiculo_situacao,
      });
    }

    // ---------- EXPORT (CSV — abre no Excel) ----------
    if (segs[0] && segs[0].indexOf("export") === 0 && method === "GET") {
      let q = supabase.from("jpd_fretes").select("*")
        .is("deleted_at", null)
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
    // PUT /veiculos/:placa  body { placa } -> renomeia (propaga via ON UPDATE CASCADE)
    if (segs[0] === "veiculos" && segs[1] && method === "PUT") {
      const placaAtual = normalizePlaca(decodeURIComponent(segs[1]));
      const update = {};
      if (body && body.placa !== undefined) {
        const novaPlaca = normalizePlaca(body.placa);
        if (!novaPlaca) return json(400, { error: "placa obrigatória" });
        update.placa = novaPlaca;
      }
      if (body && "operacao" in body) update.operacao = body.operacao || null;
      if (body && "motorista" in body) {
        // Motorista padrão do veículo (vazio limpa o vínculo).
        const nomeMot = normalizeNome(body.motorista);
        if (nomeMot) await ensureMotorista(nomeMot);
        update.motorista = nomeMot;
      }
      const { data, error } = await supabase
        .from("jpd_veiculos")
        .update(update)
        .eq("placa", placaAtual)
        .select()
        .single();
      if (error) return json(500, { error: error.message });
      return json(200, data);
    }

    // DELETE /veiculos/:placa[?acao=reatribuir&para=<placa>|excluir]
    // Sem `acao`, só exclui se não houver vínculo (409 caso contrário).
    if (segs[0] === "veiculos" && segs[1] && method === "DELETE") {
      const placaAtual = normalizePlaca(decodeURIComponent(segs[1]));
      const acao = qs.acao || "";
      if (acao === "reatribuir") {
        const nova = normalizePlaca(qs.para);
        if (!nova || nova === placaAtual) return json(400, { error: "Escolha outra placa para vincular." });
        await ensureVeiculo(nova);
      }
      const errVinc = await resolverVinculos(acao, {
        fretesQuery: () => supabase.from("jpd_fretes").select("id").eq("placa_do_carro", placaAtual),
        apagarAbast: async () =>
          (await supabase.from("homedometro_abastecimento_jpd").delete().eq("placa", placaAtual)).error,
        reatribuirFretes: async () =>
          (await supabase.from("jpd_fretes").update({ placa_do_carro: normalizePlaca(qs.para) }).eq("placa_do_carro", placaAtual)).error,
        reatribuirAbast: async () =>
          (await supabase.from("homedometro_abastecimento_jpd").update({ placa: normalizePlaca(qs.para) }).eq("placa", placaAtual)).error,
      });
      if (errVinc) return json(500, { error: errVinc.message });
      const { error } = await supabase.from("jpd_veiculos").delete().eq("placa", placaAtual);
      if (error) {
        if (error.code === "23503") {
          const { data: fretes } = await supabase.from("jpd_fretes").select(FRETE_VINCULO_COLS)
            .eq("placa_do_carro", placaAtual).order("data_do_bv", { ascending: false });
          const { data: abastecimentos } = await supabase.from("homedometro_abastecimento_jpd")
            .select(ABAST_VINCULO_COLS).eq("placa", placaAtual).order("created_at", { ascending: false });
          return json(409, {
            error: "Placa está em uso em boletins ou lançamentos.",
            detalhe: error.message,
            vinculos: { fretes: fretes || [], abastecimentos: await comNumeroBv(abastecimentos) },
          });
        }
        return json(500, { error: error.message });
      }
      return json(200, { success: true });
    }

    if (segs[0] === "veiculos" && method === "GET") {
      const { data: fretes, error } = await supabase.from("jpd_fretes").select("*");
      if (error) return json(500, { error: error.message });
      const { data: abasts } = await supabase.from("homedometro_abastecimento_jpd").select("*");
      const { data: veiculosCad } = await supabase.from("jpd_veiculos").select("placa, operacao");
      const num = (v) => (v == null ? 0 : Number(v) || 0);
      const rows = fretes || [];
      const lancamentos = abasts || [];
      const operacaoPorPlaca = {};
      for (const v of veiculosCad || []) operacaoPorPlaca[v.placa] = v.operacao || null;

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
            // Operação vinculada diretamente ao veículo (jpd_veiculos.operacao).
            operacao: operacaoPorPlaca[rest.placa] || null,
            // Operações que já tiveram algum lançamento de abastecimento para esta placa
            // (derivado, mantido para referência histórica).
            operacoes: Array.from(new Set(lancPlaca.map((l) => l.operacao).filter(Boolean))),
          };
        })
        .sort((a, b) => b.faturado - a.faturado);

      // Consumo dos cards: recalcula sobre o conjunto filtrado (f_placa/f_motorista/f_busca)
      // quando houver filtro na lista. Sem filtro, mantém o agregado global.
      // Usa nomes f_* para não colidir com ?placa= (branch de detalhe acima).
      const fPlaca = qs.f_placa || "";
      const fMotorista = qs.f_motorista || "";
      const fBusca = (qs.f_busca || "").trim().toLowerCase();
      let consumoRows = rows;
      let consumoLanc = lancamentos;
      if (fPlaca || fMotorista || fBusca) {
        const fretesFiltrados = rows.filter((r) => {
          if (fPlaca && (r.placa_do_carro || "") !== fPlaca) return false;
          if (fMotorista && (r.motorista || "") !== fMotorista) return false;
          if (fBusca) {
            const alvo = [r.placa_do_carro, r.motorista, r.origem, r.destinatario]
              .map((x) => (x == null ? "" : String(x).toLowerCase()))
              .join(" ");
            if (!alvo.includes(fBusca)) return false;
          }
          return true;
        });
        const placasScope = new Set(fretesFiltrados.map((r) => r.placa_do_carro || "—"));
        consumoRows = fretesFiltrados;
        consumoLanc = lancamentos.filter((l) => placasScope.has(l.placa || "—"));
      }

      // Consumo (global sem filtro, ou filtrado por f_*)
      const consumo = calcConsumo(consumoRows, consumoLanc);

      // Viagens "em andamento" = situação do BV é "Em viagem"
      const em_andamento = rows
        .filter((r) => r.situacao_do_bv === "Em viagem")
        .map((r) => ({
          id: r.id,
          placa: r.placa_do_carro || "—",
          motorista: r.motorista || "—",
          origem: r.origem || "—",
          destinatario: r.destinatario || "—",
          data: r.data_da_carga || "—",
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

    // ---------- HODOMETRO (leituras + resumo agregado) ----------
    // Fonte: coluna `hodometro` de homedometro_abastecimento_jpd (por placa).
    // KM rodado = soma das diferenças positivas entre leituras consecutivas.
    if (segs[0] === "hodometro" && method === "GET") {
      const from = qs.from || "";
      const to = qs.to || "";
      const { data: abasts, error } = await supabase
        .from("homedometro_abastecimento_jpd")
        .select("id, placa, hodometro, created_at, frete_id");
      if (error) return json(500, { error: error.message });
      const { data: fretes } = await supabase
        .from("jpd_fretes")
        .select("id, motorista, placa_do_carro, data_da_carga");

      const motoristaByFrete = {};
      const motoristaByPlaca = {};
      const ultimaDataPlaca = {};
      for (const f of fretes || []) {
        if (f.id != null && f.motorista) motoristaByFrete[String(f.id)] = f.motorista;
        const p = f.placa_do_carro || "";
        const d = String(f.data_da_carga || "");
        if (p && f.motorista && d >= (ultimaDataPlaca[p] || "")) {
          motoristaByPlaca[p] = f.motorista;
          ultimaDataPlaca[p] = d;
        }
      }

      const dateOnly = (iso) => (iso ? String(iso).slice(0, 10) : "");
      let leituras = (abasts || []).map((a) => {
        const placa = a.placa || "";
        const motorista =
          (a.frete_id != null && motoristaByFrete[String(a.frete_id)]) ||
          motoristaByPlaca[placa] ||
          null;
        return {
          id: a.id,
          placa,
          hodometro: a.hodometro == null ? null : Number(a.hodometro),
          data: a.created_at || null,
          motorista,
        };
      });
      if (from || to) {
        leituras = leituras.filter((l) => {
          const d = dateOnly(l.data);
          if (from && d < from) return false;
          if (to && d > to) return false;
          return true;
        });
      }

      const byPlaca = {};
      for (const l of leituras) {
        if (!l.placa || l.hodometro == null || l.hodometro <= 0) continue;
        (byPlaca[l.placa] ||= []).push(l);
      }
      let total_km = 0;
      const dailyKm = {};
      const kmByPlaca = {};
      for (const placa of Object.keys(byPlaca)) {
        const arr = byPlaca[placa].sort((a, b) => String(a.data).localeCompare(String(b.data)));
        for (let i = 1; i < arr.length; i++) {
          const diff = arr[i].hodometro - arr[i - 1].hodometro;
          if (diff <= 0) continue;
          total_km += diff;
          const dia = dateOnly(arr[i].data);
          dailyKm[dia] = (dailyKm[dia] || 0) + diff;
          kmByPlaca[placa] = (kmByPlaca[placa] || 0) + diff;
        }
      }
      const por_dia = Object.entries(dailyKm)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([dia, km]) => ({ dia, km: Math.round(km) }));
      const por_veiculo = Object.entries(kmByPlaca)
        .map(([placa, km]) => ({ placa, km: Math.round(km) }))
        .sort((a, b) => b.km - a.km);
      const diasComKm = por_dia.filter((d) => d.km > 0).length;
      const media_diaria = diasComKm > 0 ? total_km / diasComKm : 0;

      return json(200, {
        leituras,
        resumo: {
          total_km: Math.round(total_km),
          media_diaria: Math.round(media_diaria),
          por_dia,
          por_veiculo,
        },
      });
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

    // ---------- MOTORISTAS (tabela mestra motoristas_jpd, com id) ----------
    // Usada pelo campo motorista_id do lançamento de abastecimento — diferente
    // de /opcoes (que devolve só nomes, para o campo texto motorista de jpd_fretes).
    if (segs[0] === "motoristas") {
      const motoristaId = segs[1] ? Number(segs[1]) : null;

      if (method === "GET" && !motoristaId) {
        const { data, error } = await supabase.from("motoristas_jpd").select("id, nome").order("nome");
        if (error) return json(500, { error: error.message });
        return json(200, data || []);
      }

      // POST /motoristas  body { nome } -> cria (ou reaproveita) o motorista e devolve { id, nome }
      if (method === "POST" && !motoristaId) {
        const nome = normalizeNome(body && body.nome);
        if (!nome) return json(400, { error: "nome obrigatório" });
        const { data, error } = await supabase
          .from("motoristas_jpd")
          .upsert({ nome }, { onConflict: "nome" })
          .select("id, nome")
          .single();
        if (error) return json(500, { error: error.message });
        return json(200, data);
      }

      // PUT /motoristas/:id  body { nome } -> renomeia (propaga para jpd_fretes via ON UPDATE CASCADE)
      if (method === "PUT" && motoristaId) {
        const nome = normalizeNome(body && body.nome);
        if (!nome) return json(400, { error: "nome obrigatório" });
        const { data, error } = await supabase
          .from("motoristas_jpd")
          .update({ nome })
          .eq("id", motoristaId)
          .select("id, nome")
          .single();
        if (error) return json(500, { error: error.message });
        return json(200, data);
      }

      // DELETE /motoristas/:id[?acao=reatribuir&para=<id>|excluir]
      if (method === "DELETE" && motoristaId) {
        const acao = qs.acao || "";
        const { data: atual } = await supabase.from("motoristas_jpd").select("id, nome").eq("id", motoristaId).maybeSingle();
        let novo = null;
        if (acao === "reatribuir") {
          const paraId = Number(qs.para);
          if (!Number.isFinite(paraId) || paraId === motoristaId) {
            return json(400, { error: "Escolha outro motorista para vincular." });
          }
          const { data } = await supabase.from("motoristas_jpd").select("id, nome").eq("id", paraId).maybeSingle();
          if (!data) return json(404, { error: "Motorista de destino não encontrado." });
          novo = data;
        }
        if (acao && atual) {
          const errVinc = await resolverVinculos(acao, {
            fretesQuery: () => supabase.from("jpd_fretes").select("id").eq("motorista", atual.nome),
            apagarAbast: async () =>
              (await supabase.from("homedometro_abastecimento_jpd").delete().eq("motorista_id", motoristaId)).error,
            reatribuirFretes: async () => {
              // Motorista padrão dos veículos também migra (coluna opcional: erro ignorado se não existir).
              await supabase.from("jpd_veiculos").update({ motorista: novo.nome }).eq("motorista", atual.nome);
              return (await supabase.from("jpd_fretes").update({ motorista: novo.nome }).eq("motorista", atual.nome)).error;
            },
            reatribuirAbast: async () =>
              (await supabase.from("homedometro_abastecimento_jpd").update({ motorista_id: novo.id }).eq("motorista_id", motoristaId)).error,
          });
          if (errVinc) return json(500, { error: errVinc.message });
        }
        const { error } = await supabase.from("motoristas_jpd").delete().eq("id", motoristaId);
        if (error) {
          if (error.code === "23503") {
            const { data: fretes } = await supabase.from("jpd_fretes").select(FRETE_VINCULO_COLS)
              .eq("motorista", atual ? atual.nome : "").order("data_do_bv", { ascending: false });
            const { data: abastecimentos } = await supabase.from("homedometro_abastecimento_jpd")
              .select(ABAST_VINCULO_COLS).eq("motorista_id", motoristaId).order("created_at", { ascending: false });
            return json(409, {
              error: "Motorista está em uso em boletins ou lançamentos.",
              detalhe: error.message,
              vinculos: { fretes: fretes || [], abastecimentos: await comNumeroBv(abastecimentos) },
            });
          }
          return json(500, { error: error.message });
        }
        return json(200, { success: true });
      }
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
        const rows = data || [];
        const motoristaIds = Array.from(new Set(rows.map((r) => r.motorista_id).filter((id2) => id2 != null)));
        let nomeById = {};
        if (motoristaIds.length) {
          const { data: mots } = await supabase.from("motoristas_jpd").select("id, nome").in("id", motoristaIds);
          for (const m of mots || []) nomeById[String(m.id)] = m.nome;
        }
        const freteIds = Array.from(new Set(rows.map((r) => r.frete_id).filter((id2) => id2 != null)));
        let numeroByFrete = {};
        if (freteIds.length) {
          const { data: fretes } = await supabase.from("jpd_fretes").select("id, numero_do_bv").in("id", freteIds);
          for (const f of fretes || []) numeroByFrete[String(f.id)] = f.numero_do_bv;
        }
        return json(200, rows.map((r) => ({
          ...r,
          motorista_nome: r.motorista_id != null ? (nomeById[String(r.motorista_id)] ?? null) : null,
          numero_do_bv: r.frete_id != null ? (numeroByFrete[String(r.frete_id)] ?? null) : null,
        })));
      }

      if (method === "GET" && id && !segs[2]) {
        const { data, error } = await supabase
          .from("homedometro_abastecimento_jpd")
          .select("*")
          .eq("id", id)
          .single();
        if (error) return json(404, { error: error.message });
        return json(200, data);
      }

      // POST /abastecimentos/:id/enviar-formulario  body = objeto completo editado
      // Usado pelo formulário público de revisão (link enviado pelo n8n): persiste
      // a revisão na própria tabela e encaminha o payload editado ao n8n, no mesmo
      // formato recebido (array com um objeto), para o fluxo continuar lá.
      if (method === "POST" && id && segs[2] === "enviar-formulario") {
        const row = {
          ...buildAbastecimentoRow(body),
          revised: body && "revised" in body ? body.revised : true,
          updated_at: new Date().toISOString(),
        };
        if ("placa" in row) await ensureVeiculo(row.placa);
        const { data, error } = await supabase
          .from("homedometro_abastecimento_jpd")
          .update(row)
          .eq("id", id)
          .select()
          .single();
        if (error) return json(500, { error: error.message });

        try {
          const res = await fetch(N8N_WEBHOOKS.salvarFormulario, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify([{ ...body, ...data }]),
          });
          if (!res.ok) {
            const txt = await res.text().catch(() => "");
            throw new Error(`Webhook respondeu ${res.status}${txt ? `: ${txt.slice(0, 200)}` : ""}`);
          }
        } catch (e) {
          return json(502, { error: `Falha ao enviar ao n8n: ${e.message}` });
        }
        return json(200, { success: true });
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
          .update({ frete_id, updated_at: new Date().toISOString() }).eq("id", id).select().maybeSingle();
        if (error) return json(500, { error: error.message });
        if (!data) return json(404, { error: "Lançamento não encontrado — pode já ter sido excluído." });
        return json(200, data);
      }

      if (method === "PUT" && id) {
        const row = { ...buildAbastecimentoRow(body), updated_at: new Date().toISOString() };
        if ("placa" in row) await ensureVeiculo(row.placa);
        const { data, error } = await supabase.from("homedometro_abastecimento_jpd")
          .update(row).eq("id", id).select().maybeSingle();
        if (error) return json(500, { error: error.message });
        if (!data) return json(404, { error: "Lançamento não encontrado — pode já ter sido excluído." });
        return json(200, data);
      }

      if (method === "DELETE" && id) {
        const { error } = await supabase.from("homedometro_abastecimento_jpd").delete().eq("id", id);
        if (error) return json(500, { error: error.message });
        return json(200, { success: true });
      }
    }

    // ---------- OCR (leitura automática via n8n) ----------
    if (segs[0] === "ocr") {
      // POST /ocr/bv  body { url } -> dados de um Boletim de Viagem
      if (segs[1] === "bv" && method === "POST") {
        const url = body && body.url;
        if (!url) return json(400, { error: "url do arquivo obrigatória" });
        try {
          const dados = await chamarWebhookN8n(N8N_WEBHOOKS.bv, url);
          return json(200, mapBvOcr(dados));
        } catch (e) {
          return json(502, { error: `Falha na leitura do arquivo: ${e.message}` });
        }
      }

      // POST /ocr/lancamento  body { hodometro_url, comprovante_url }
      // Lê hodômetro e comprovante em paralelo e mescla (hodômetro tem prioridade).
      if (segs[1] === "lancamento" && method === "POST") {
        const hodometroUrl = body && body.hodometro_url;
        const comprovanteUrl = body && body.comprovante_url;
        if (!hodometroUrl || !comprovanteUrl) {
          return json(400, { error: "hodometro_url e comprovante_url obrigatórios" });
        }
        try {
          const [hodo, comp] = await Promise.all([
            chamarWebhookN8n(N8N_WEBHOOKS.hodometro, hodometroUrl),
            chamarWebhookN8n(N8N_WEBHOOKS.comprovante, comprovanteUrl),
          ]);
          return json(200, mapLancamentoOcr(hodo, comp));
        } catch (e) {
          return json(502, { error: `Falha na leitura das imagens: ${e.message}` });
        }
      }
    }

    return json(404, { error: "Rota JPD não encontrada", method, sub });
  } catch (err) {
    console.error("Erro na função JPD:", err);
    return json(500, { error: err.message || "Erro interno" });
  }
};
