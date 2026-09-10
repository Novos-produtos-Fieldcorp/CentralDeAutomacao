// Netlify Function — Dionizio Transportes
// Atende todas as rotas /api/dionizio/* (redirect em netlify.toml).
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
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
};

const json = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });

function subPath(event) {
  let p = "";
  if (event.pathParameters && event.pathParameters.splat) {
    p = event.pathParameters.splat;
  } else {
    const raw = (event.path || event.rawUrl || "").split("?")[0];
    p = raw
      .replace(/^.*\/\.netlify\/functions\/dionizio\/?/, "")
      .replace(/^.*\/api\/dionizio\/?/, "");
  }
  return p.replace(/^\/+|\/+$/g, "");
}

const num = (v) => (v == null || v === "" ? null : Number(v) || 0);

async function calcAbastecimento(veiculo_id, kmAtual, litros, valorTotal, excludeId) {
  const preco_por_litro = litros > 0 ? valorTotal / litros : null;
  let media_por_km = null;
  let q = supabase
    .from("dionizio_abastecimentos")
    .select("quilometragem_atual")
    .eq("veiculo_id", veiculo_id)
    .lt("quilometragem_atual", kmAtual)
    .order("quilometragem_atual", { ascending: false })
    .limit(1);
  if (excludeId) q = q.neq("id", excludeId);
  const { data: anterior } = await q;
  const kmAnterior = anterior && anterior[0] ? Number(anterior[0].quilometragem_atual) : null;
  if (kmAnterior != null && litros > 0) {
    const kmRodado = kmAtual - kmAnterior;
    if (kmRodado > 0) media_por_km = kmRodado / litros;
  }
  return { preco_por_litro, media_por_km };
}

const buildAbastecimentoBase = (b) => ({
  veiculo_id: Number(b.veiculo_id),
  data_abastecimento: b.data_abastecimento,
  tipo_combustivel: b.tipo_combustivel || null,
  quilometragem_atual: Number(b.quilometragem_atual),
  litros: Number(b.litros),
  valor_total: Number(b.valor_total),
  local_abastecimento: b.local_abastecimento,
  nota_fiscal_url: b.nota_fiscal_url || null,
});

const buildHotelRow = (b) => ({
  data: b.data,
  veiculo_id: Number(b.veiculo_id),
  motorista_id: Number(b.motorista_id),
  local: b.local,
  nome_hotel: b.nome_hotel,
  cnpj_hotel: b.cnpj_hotel || null,
  quantidade_pessoas: Number(b.quantidade_pessoas) || 1,
  nome_ajudante: b.nome_ajudante || null,
  valor_hotel: Number(b.valor_hotel),
  observacoes: b.observacoes || null,
});

const buildOcorrenciaRow = (b) => ({
  tipo_evento: b.tipo_evento,
  data: b.data,
  veiculo_id: b.veiculo_id ? Number(b.veiculo_id) : null,
  gravidade: b.gravidade || null,
  status: b.status || "pendente",
  descricao_detalhada: b.descricao_detalhada,
  observacoes_gerais: b.observacoes_gerais || null,
  fotos: Array.isArray(b.fotos) ? b.fotos : [],
});

const buildViagemRow = (b) => {
  const base_frete = Number(b.base_frete) || 0;
  const custo_ajudante = Number(b.custo_ajudante) || 0;
  const custo_pernoite = Number(b.custo_pernoite) || 0;
  return {
    referencia: b.referencia || null,
    origem: b.origem,
    destino: b.destino || null,
    cliente_id: b.cliente_id ? Number(b.cliente_id) : null,
    data_saida: b.data_saida,
    data_retorno: b.data_retorno,
    horario_saida: b.horario_saida || null,
    horario_retorno: b.horario_retorno || null,
    necessita_pernoite: !!b.necessita_pernoite,
    veiculo_id: Number(b.veiculo_id),
    motorista_id: Number(b.motorista_id),
    km_inicial: num(b.km_inicial),
    km_final: num(b.km_final),
    km_total_estimado: num(b.km_total_estimado),
    necessita_ajudante: !!b.necessita_ajudante,
    base_frete,
    custo_ajudante,
    custo_pernoite,
    frete_total: base_frete + custo_ajudante + custo_pernoite,
    numero_pessoas: Number(b.numero_pessoas) || 1,
    entregas_estimadas: Number(b.entregas_estimadas) || 0,
    entregas_realizadas: Number(b.entregas_realizadas) || 0,
    observacoes: b.observacoes || null,
    status: b.status || "planejada",
    comprovante_canhoto_url: b.comprovante_canhoto_url || null,
  };
};

const buildDescargaRow = (b) => ({
  viagem_id: Number(b.viagem_id),
  veiculo_id: b.veiculo_id ? Number(b.veiculo_id) : null,
  data_descarga: b.data_descarga,
  horario: b.horario || null,
  local_descarga: b.local_descarga,
  tipo_carga: b.tipo_carga,
  numero_carga: b.numero_carga || null,
  numero_nota: b.numero_nota || null,
  tipo_pagamento: b.tipo_pagamento || null,
  valor_descarga: Number(b.valor_descarga),
  comprovante_pagamento_url: b.comprovante_pagamento_url || null,
  recibo_nota_fiscal_url: b.recibo_nota_fiscal_url || null,
  observacoes: b.observacoes || null,
});

const buildMotoristaRow = (b) => ({
  nome: String(b.nome || "").trim(),
  cpf: b.cpf || null,
  cnh: b.cnh || null,
  cnh_validade: b.cnh_validade || null,
  telefone: b.telefone || null,
  status: b.status || "ativo",
});

const buildVeiculoRow = (b) => ({
  placa: String(b.placa || "").trim().toLowerCase(),
  modelo: b.modelo || null,
  ano: b.ano ? Number(b.ano) : null,
  status: b.status || "ativo",
});

async function atualizaEntregasRealizadas(viagem_id) {
  if (!viagem_id) return;
  const { count } = await supabase
    .from("dionizio_descargas")
    .select("id", { count: "exact", head: true })
    .eq("viagem_id", viagem_id);
  await supabase.from("dionizio_viagens").update({ entregas_realizadas: count || 0 }).eq("id", viagem_id);
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
  const segs = sub.split("/").filter(Boolean);

  try {
    // ---------- ABASTECIMENTOS ----------
    if (segs[0] === "abastecimentos") {
      const id = segs[1] ? Number(segs[1]) : null;

      if (method === "GET" && !id) {
        let q = supabase.from("dionizio_abastecimentos").select("*, dionizio_veiculos(placa)").order("data_abastecimento", { ascending: false });
        if (qs.veiculo_id) q = q.eq("veiculo_id", Number(qs.veiculo_id));
        if (qs.from) q = q.gte("data_abastecimento", qs.from);
        if (qs.to) q = q.lte("data_abastecimento", qs.to);
        const { data, error } = await q;
        if (error) return json(500, { error: error.message });
        return json(200, data || []);
      }

      if (method === "POST" && !id) {
        const base = buildAbastecimentoBase(body);
        const calc = await calcAbastecimento(base.veiculo_id, base.quilometragem_atual, base.litros, base.valor_total);
        const { data, error } = await supabase.from("dionizio_abastecimentos").insert({ ...base, ...calc }).select().single();
        if (error) return json(500, { error: error.message });
        return json(200, data);
      }

      if (method === "PUT" && id) {
        const base = buildAbastecimentoBase(body);
        const calc = await calcAbastecimento(base.veiculo_id, base.quilometragem_atual, base.litros, base.valor_total, id);
        const { data, error } = await supabase
          .from("dionizio_abastecimentos")
          .update({ ...base, ...calc, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select()
          .single();
        if (error) return json(500, { error: error.message });
        return json(200, data);
      }

      if (method === "DELETE" && id) {
        const { error } = await supabase.from("dionizio_abastecimentos").delete().eq("id", id);
        if (error) return json(500, { error: error.message });
        return json(200, { success: true });
      }
    }

    // ---------- HOTÉIS ----------
    if (segs[0] === "hoteis") {
      const id = segs[1] ? Number(segs[1]) : null;

      if (method === "GET" && !id) {
        let q = supabase.from("dionizio_hoteis").select("*, dionizio_veiculos(placa), dionizio_motoristas(nome)").order("data", { ascending: false });
        if (qs.veiculo_id) q = q.eq("veiculo_id", Number(qs.veiculo_id));
        if (qs.motorista_id) q = q.eq("motorista_id", Number(qs.motorista_id));
        if (qs.from) q = q.gte("data", qs.from);
        if (qs.to) q = q.lte("data", qs.to);
        const { data, error } = await q;
        if (error) return json(500, { error: error.message });
        return json(200, data || []);
      }

      if (method === "POST" && !id) {
        const { data, error } = await supabase.from("dionizio_hoteis").insert(buildHotelRow(body)).select().single();
        if (error) return json(500, { error: error.message });
        return json(200, data);
      }

      if (method === "PUT" && id) {
        const row = { ...buildHotelRow(body), updated_at: new Date().toISOString() };
        const { data, error } = await supabase.from("dionizio_hoteis").update(row).eq("id", id).select().single();
        if (error) return json(500, { error: error.message });
        return json(200, data);
      }

      if (method === "DELETE" && id) {
        const { error } = await supabase.from("dionizio_hoteis").delete().eq("id", id);
        if (error) return json(500, { error: error.message });
        return json(200, { success: true });
      }
    }

    // ---------- OCORRÊNCIAS ----------
    if (segs[0] === "ocorrencias") {
      const id = segs[1] ? Number(segs[1]) : null;

      if (method === "GET" && !id) {
        let q = supabase.from("dionizio_ocorrencias").select("*, dionizio_veiculos(placa)").order("data", { ascending: false });
        if (qs.veiculo_id) q = q.eq("veiculo_id", Number(qs.veiculo_id));
        if (qs.status) q = q.eq("status", qs.status);
        if (qs.gravidade) q = q.eq("gravidade", qs.gravidade);
        const { data, error } = await q;
        if (error) return json(500, { error: error.message });
        return json(200, data || []);
      }

      if (method === "POST" && !id) {
        const { data, error } = await supabase.from("dionizio_ocorrencias").insert(buildOcorrenciaRow(body)).select().single();
        if (error) return json(500, { error: error.message });
        return json(200, data);
      }

      if (method === "PUT" && id) {
        const row = { ...buildOcorrenciaRow(body), updated_at: new Date().toISOString() };
        const { data, error } = await supabase.from("dionizio_ocorrencias").update(row).eq("id", id).select().single();
        if (error) return json(500, { error: error.message });
        return json(200, data);
      }

      if (method === "DELETE" && id) {
        const { error } = await supabase.from("dionizio_ocorrencias").delete().eq("id", id);
        if (error) return json(500, { error: error.message });
        return json(200, { success: true });
      }
    }

    // ---------- VIAGENS ----------
    if (segs[0] === "viagens") {
      const id = segs[1] ? Number(segs[1]) : null;

      if (method === "GET" && !id) {
        let q = supabase
          .from("dionizio_viagens")
          .select("*, dionizio_veiculos(placa), dionizio_motoristas(nome), dionizio_clientes(nome)")
          .order("data_saida", { ascending: false });
        if (qs.veiculo_id) q = q.eq("veiculo_id", Number(qs.veiculo_id));
        if (qs.motorista_id) q = q.eq("motorista_id", Number(qs.motorista_id));
        if (qs.status) q = q.eq("status", qs.status);
        if (qs.from) q = q.gte("data_saida", qs.from);
        if (qs.to) q = q.lte("data_saida", qs.to);
        const { data, error } = await q;
        if (error) return json(500, { error: error.message });
        return json(200, data || []);
      }

      if (method === "GET" && id) {
        const { data, error } = await supabase
          .from("dionizio_viagens")
          .select("*, dionizio_veiculos(placa), dionizio_motoristas(nome), dionizio_clientes(nome)")
          .eq("id", id)
          .single();
        if (error) return json(500, { error: error.message });
        return json(200, data);
      }

      if (method === "POST" && !id) {
        const { data, error } = await supabase.from("dionizio_viagens").insert(buildViagemRow(body)).select().single();
        if (error) return json(500, { error: error.message });
        return json(200, data);
      }

      if (method === "PUT" && id) {
        const row = { ...buildViagemRow(body), updated_at: new Date().toISOString() };
        const { data, error } = await supabase.from("dionizio_viagens").update(row).eq("id", id).select().single();
        if (error) return json(500, { error: error.message });
        return json(200, data);
      }

      if (method === "DELETE" && id) {
        const { error } = await supabase.from("dionizio_viagens").delete().eq("id", id);
        if (error) return json(500, { error: error.message });
        return json(200, { success: true });
      }
    }

    // ---------- DESCARGAS / ENTREGAS ----------
    if (segs[0] === "descargas") {
      const id = segs[1] ? Number(segs[1]) : null;

      if (method === "GET" && !id) {
        let q = supabase
          .from("dionizio_descargas")
          .select("*, dionizio_viagens(referencia), dionizio_veiculos(placa)")
          .order("data_descarga", { ascending: false });
        if (qs.viagem_id) q = q.eq("viagem_id", Number(qs.viagem_id));
        const { data, error } = await q;
        if (error) return json(500, { error: error.message });
        return json(200, data || []);
      }

      if (method === "POST" && !id) {
        const { data, error } = await supabase.from("dionizio_descargas").insert(buildDescargaRow(body)).select().single();
        if (error) return json(500, { error: error.message });
        await atualizaEntregasRealizadas(data.viagem_id);
        return json(200, data);
      }

      if (method === "PUT" && id) {
        const row = { ...buildDescargaRow(body), updated_at: new Date().toISOString() };
        const { data, error } = await supabase.from("dionizio_descargas").update(row).eq("id", id).select().single();
        if (error) return json(500, { error: error.message });
        return json(200, data);
      }

      if (method === "DELETE" && id) {
        const { data: existente } = await supabase.from("dionizio_descargas").select("viagem_id").eq("id", id).single();
        const { error } = await supabase.from("dionizio_descargas").delete().eq("id", id);
        if (error) return json(500, { error: error.message });
        if (existente) await atualizaEntregasRealizadas(existente.viagem_id);
        return json(200, { success: true });
      }
    }

    // ---------- MOTORISTAS ----------
    if (segs[0] === "motoristas") {
      const id = segs[1] ? Number(segs[1]) : null;

      if (method === "GET" && !id) {
        const { data, error } = await supabase.from("dionizio_motoristas").select("*").order("nome");
        if (error) return json(500, { error: error.message });
        return json(200, data || []);
      }

      if (method === "POST" && !id) {
        const row = buildMotoristaRow(body);
        if (!row.nome) return json(400, { error: "nome obrigatório" });
        const { data, error } = await supabase.from("dionizio_motoristas").insert(row).select().single();
        if (error) return json(500, { error: error.message });
        return json(200, data);
      }

      if (method === "PUT" && id) {
        const row = { ...buildMotoristaRow(body), updated_at: new Date().toISOString() };
        const { data, error } = await supabase.from("dionizio_motoristas").update(row).eq("id", id).select().single();
        if (error) return json(500, { error: error.message });
        return json(200, data);
      }

      if (method === "DELETE" && id) {
        const { error } = await supabase.from("dionizio_motoristas").delete().eq("id", id);
        if (error) {
          if (error.code === "23503") return json(409, { error: "Motorista está em uso em viagens ou hotéis; não é possível excluir." });
          return json(500, { error: error.message });
        }
        return json(200, { success: true });
      }
    }

    // ---------- VEÍCULOS ----------
    if (segs[0] === "veiculos") {
      const id = segs[1] ? Number(segs[1]) : null;

      if (method === "GET" && !id) {
        const { data, error } = await supabase.from("dionizio_veiculos").select("*").order("placa");
        if (error) return json(500, { error: error.message });
        return json(200, data || []);
      }

      if (method === "POST" && !id) {
        const row = buildVeiculoRow(body);
        if (!row.placa) return json(400, { error: "placa obrigatória" });
        const { data, error } = await supabase.from("dionizio_veiculos").insert(row).select().single();
        if (error) return json(500, { error: error.message });
        return json(200, data);
      }

      if (method === "PUT" && id) {
        const row = { ...buildVeiculoRow(body), updated_at: new Date().toISOString() };
        const { data, error } = await supabase.from("dionizio_veiculos").update(row).eq("id", id).select().single();
        if (error) return json(500, { error: error.message });
        return json(200, data);
      }

      if (method === "DELETE" && id) {
        const { error } = await supabase.from("dionizio_veiculos").delete().eq("id", id);
        if (error) {
          if (error.code === "23503") return json(409, { error: "Placa está em uso em viagens, abastecimentos ou hotéis; não é possível excluir." });
          return json(500, { error: error.message });
        }
        return json(200, { success: true });
      }
    }

    // ---------- CLIENTES ----------
    if (segs[0] === "clientes") {
      if (method === "GET") {
        const { data, error } = await supabase.from("dionizio_clientes").select("*").order("nome");
        if (error) return json(500, { error: error.message });
        return json(200, data || []);
      }

      if (method === "POST") {
        const nome = String((body && body.nome) || "").trim();
        if (!nome) return json(400, { error: "nome obrigatório" });
        const { data, error } = await supabase
          .from("dionizio_clientes")
          .insert({ nome, cnpj: (body && body.cnpj) || null })
          .select()
          .single();
        if (error) return json(500, { error: error.message });
        return json(200, data);
      }
    }

    // ---------- OPÇÕES (selects dos modais) ----------
    if (segs[0] === "opcoes" && method === "GET") {
      const [veiculos, motoristas, clientes] = await Promise.all([
        supabase.from("dionizio_veiculos").select("id, placa").eq("status", "ativo").order("placa"),
        supabase.from("dionizio_motoristas").select("id, nome").eq("status", "ativo").order("nome"),
        supabase.from("dionizio_clientes").select("id, nome").order("nome"),
      ]);
      return json(200, {
        veiculos: veiculos.data || [],
        motoristas: motoristas.data || [],
        clientes: clientes.data || [],
      });
    }

    // ---------- DASHBOARD ----------
    if (segs[0] === "dashboard" && method === "GET") {
      let viagensQ = supabase.from("dionizio_viagens").select("*, dionizio_veiculos(placa), dionizio_motoristas(nome)");
      if (qs.from) viagensQ = viagensQ.gte("data_saida", qs.from);
      if (qs.to) viagensQ = viagensQ.lte("data_saida", qs.to);
      const { data: viagens, error: viagensErr } = await viagensQ;
      if (viagensErr) return json(500, { error: viagensErr.message });

      let abastQ = supabase.from("dionizio_abastecimentos").select("valor_total, data_abastecimento");
      if (qs.from) abastQ = abastQ.gte("data_abastecimento", qs.from);
      if (qs.to) abastQ = abastQ.lte("data_abastecimento", qs.to);
      const { data: abastecimentos } = await abastQ;

      let hoteisQ = supabase.from("dionizio_hoteis").select("valor_hotel, data");
      if (qs.from) hoteisQ = hoteisQ.gte("data", qs.from);
      if (qs.to) hoteisQ = hoteisQ.lte("data", qs.to);
      const { data: hoteis } = await hoteisQ;

      let descargasQ = supabase.from("dionizio_descargas").select("valor_descarga, data_descarga");
      if (qs.from) descargasQ = descargasQ.gte("data_descarga", qs.from);
      if (qs.to) descargasQ = descargasQ.lte("data_descarga", qs.to);
      const { data: descargas } = await descargasQ;

      const { data: ocorrenciasPendentes } = await supabase
        .from("dionizio_ocorrencias")
        .select("*, dionizio_veiculos(placa)")
        .neq("status", "resolvido")
        .order("data", { ascending: false })
        .limit(10);

      const sum = (arr, key) => (arr || []).reduce((acc, r) => acc + (Number(r[key]) || 0), 0);

      const totalAbastecimento = sum(abastecimentos, "valor_total");
      const totalHoteis = sum(hoteis, "valor_hotel");
      const totalDescargas = sum(descargas, "valor_descarga");
      const totalFrete = sum(viagens, "frete_total");
      const totalKm = (viagens || []).reduce((acc, v) => {
        if (v.km_inicial != null && v.km_final != null) return acc + (Number(v.km_final) - Number(v.km_inicial));
        return acc + (Number(v.km_total_estimado) || 0);
      }, 0);

      const porVeiculo = {};
      for (const v of viagens || []) {
        const placa = (v.dionizio_veiculos && v.dionizio_veiculos.placa) || "—";
        if (!porVeiculo[placa]) porVeiculo[placa] = { placa, viagens: 0, km: 0, frete: 0 };
        porVeiculo[placa].viagens += 1;
        porVeiculo[placa].km += v.km_inicial != null && v.km_final != null ? Number(v.km_final) - Number(v.km_inicial) : Number(v.km_total_estimado) || 0;
        porVeiculo[placa].frete += Number(v.frete_total) || 0;
      }

      const porMotorista = {};
      for (const v of viagens || []) {
        const motorista = (v.dionizio_motoristas && v.dionizio_motoristas.nome) || "—";
        if (!porMotorista[motorista]) porMotorista[motorista] = { motorista, viagens: 0, frete: 0 };
        porMotorista[motorista].viagens += 1;
        porMotorista[motorista].frete += Number(v.frete_total) || 0;
      }

      return json(200, {
        kpis: {
          total_viagens: (viagens || []).length,
          total_km: totalKm,
          total_frete: totalFrete,
          total_abastecimento: totalAbastecimento,
          total_hoteis: totalHoteis,
          total_descargas: totalDescargas,
          total_gasto: totalAbastecimento + totalHoteis + totalDescargas,
          ocorrencias_abertas: (ocorrenciasPendentes || []).length,
        },
        por_veiculo: Object.values(porVeiculo).sort((a, b) => b.viagens - a.viagens),
        por_motorista: Object.values(porMotorista).sort((a, b) => b.viagens - a.viagens),
        viagens_em_andamento: (viagens || []).filter((v) => v.status === "em_andamento"),
        ocorrencias_pendentes: ocorrenciasPendentes || [],
      });
    }

    return json(404, { error: "Rota não encontrada" });
  } catch (err) {
    return json(500, { error: err.message || String(err) });
  }
};
