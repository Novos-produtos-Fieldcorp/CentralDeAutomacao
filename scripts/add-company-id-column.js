import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são necessários");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function addCompanyIdColumn() {
  console.log("🔧 Adicionando coluna company_id à tabela wiseapp_acesso...");

  try {
    // Usar o endpoint RPC do Supabase para executar SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: `
        ALTER TABLE public.wiseapp_acesso 
        ADD COLUMN IF NOT EXISTS company_id integer 
        REFERENCES public.company(company_id);
      `
    });

    if (error) {
      console.error("❌ Erro ao adicionar coluna:", error);
      
      // Tentar método alternativo - verificar se a coluna já existe
      console.log("\n🔍 Verificando se a coluna já existe...");
      const { data: columns, error: checkError } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'wiseapp_acesso')
        .eq('column_name', 'company_id');

      if (checkError) {
        console.error("❌ Erro ao verificar coluna:", checkError);
      } else if (columns && columns.length > 0) {
        console.log("✅ A coluna company_id já existe!");
      } else {
        console.log("❌ A coluna company_id NÃO existe e não foi possível criá-la automaticamente.");
        console.log("\n📋 Execute este SQL manualmente no Supabase SQL Editor:");
        console.log("ALTER TABLE public.wiseapp_acesso ADD COLUMN company_id integer REFERENCES public.company(company_id);");
      }
    } else {
      console.log("✅ Coluna company_id adicionada com sucesso!");
      console.log("Resultado:", data);
    }
  } catch (err) {
    console.error("❌ Erro:", err.message);
    console.log("\n📋 Execute este SQL manualmente no Supabase SQL Editor:");
    console.log("ALTER TABLE public.wiseapp_acesso ADD COLUMN company_id integer REFERENCES public.company(company_id);");
  }
}

addCompanyIdColumn();
