#!/usr/bin/env node
/**
 * Setup automatico do JPD Transportes no Supabase.
 *
 * Faz duas coisas:
 *   1) Executa o SQL em scripts/setup-jpd-supabase.sql (cria tabelas + flag de acesso).
 *   2) Cria o bucket privado "jpd-documents" no Storage.
 *
 * Pre-requisitos no .env:
 *   - VITE_SUPABASE_URL (ou SUPABASE_URL)
 *   - SUPABASE_SERVICE_ROLE_KEY  <-- precisa ser a service_role, NAO a anon
 *
 * Uso:
 *   node scripts/setup-jpd-supabase.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_PATH = resolve(__dirname, "setup-jpd-supabase.sql");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("ERRO: defina VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function execSqlViaRest(sql) {
  // Tenta usar a função `exec_sql` (se existir). Caso contrário, retorna um aviso para rodar manual.
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`exec_sql falhou (${resp.status}): ${txt}`);
  }
  return resp.json();
}

async function main() {
  console.log(`\n=== JPD Transportes — Setup Supabase ===`);
  console.log(`URL: ${SUPABASE_URL}\n`);

  // 1) SQL — DDL das tabelas
  const sql = readFileSync(SQL_PATH, "utf8");
  console.log("[1/2] Aplicando DDL (tabelas + flag de acesso)...");
  try {
    await execSqlViaRest(sql);
    console.log("      OK — DDL aplicado via RPC exec_sql.\n");
  } catch (err) {
    console.warn("      Nao foi possivel executar via RPC.");
    console.warn("      Motivo:", err.message);
    console.warn("\n      ACAO MANUAL: abra o SQL Editor do Supabase e cole o conteudo de:");
    console.warn(`        ${SQL_PATH}\n`);
  }

  // 2) Storage bucket
  console.log("[2/2] Criando bucket 'jpd-documents' (privado)...");
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) {
    console.error("      Falha ao listar buckets:", listErr.message);
  } else if (buckets?.some((b) => b.name === "jpd-documents")) {
    console.log("      Bucket ja existe — ignorando.\n");
  } else {
    const { error: createErr } = await supabase.storage.createBucket("jpd-documents", {
      public: false,
      fileSizeLimit: 25 * 1024 * 1024, // 25 MB
      allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg", "image/jpg"],
    });
    if (createErr) console.error("      Erro:", createErr.message);
    else console.log("      OK — bucket criado.\n");
  }

  console.log("=== Concluido ===");
  console.log("Proximos passos:");
  console.log("  - Habilite o modulo na company desejada:");
  console.log("      UPDATE company SET jpd_transportes_access = true WHERE company_id = <ID>;");
  console.log("  - Suba o servico Python:  npm run dev:jpd-service");
  console.log("  - Suba o Express + Vite:  npm run dev\n");
}

main().catch((err) => {
  console.error("ERRO FATAL:", err);
  process.exit(1);
});
