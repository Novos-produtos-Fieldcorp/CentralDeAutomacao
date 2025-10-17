// ⛔ DESABILITADO - Sistema usa APENAS Supabase direto
// Este arquivo seria para migrations no banco local do Replit
// Mantido aqui apenas para referência, mas NÃO É USADO

/*
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
*/

// Sistema configurado para usar EXCLUSIVAMENTE Supabase
console.warn('⚠️ Drizzle config desabilitado - Sistema usa APENAS Supabase');
export default {};
