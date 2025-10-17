import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ohmoxsvwjvohmqqgxjhb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obW94c3Z3anZvaG1xcWd4amhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NzI5MDUsImV4cCI6MjA1MjQ0ODkwNX0.AfDIRYUm98kZaYfi70ut0bzyvX995-Xz609Yp_seijQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTags() {
  console.log('🔍 Testando estrutura de tags no Supabase...\n');

  // 1. Buscar companies
  console.log('📊 Companies:');
  const { data: companies } = await supabase
    .from('company')
    .select('company_id, nome_company, id_conta_wiseapp')
    .order('company_id');
  console.table(companies);

  // 2. Buscar tags (nome correto: "tag" minúsculo)
  console.log('\n🏷️ Tags (todas - primeiras 20):');
  const { data: allTags, error: tagsError } = await supabase
    .from('tag')
    .select('id, nome, company_id')
    .order('company_id, nome')
    .limit(20);
  if (tagsError) console.log('Erro:', tagsError.message);
  else console.table(allTags);

  // 2b. Buscar tags da company 5 (id_conta_wiseapp=20)
  console.log('\n🏷️ Tags da Company 5 (id_conta_wiseapp=20):');
  const { data: company5Tags, error: c5Error } = await supabase
    .from('tag')
    .select('id, nome, company_id')
    .eq('company_id', 5)
    .order('nome');
  if (c5Error) console.log('Erro:', c5Error.message);
  else if (!company5Tags || company5Tags.length === 0) console.log('❌ Nenhuma tag encontrada para company 5');
  else console.table(company5Tags);

  // 3. Buscar tokens wiseapp - múltiplos registros (sem company_id)
  console.log('\n🔑 Tokens WiseApp (todos para account 20):');
  const { data: tokens, error: tokensError } = await supabase
    .from('wiseapp_acesso')
    .select('wiseapp_acesso_id, email, id_conta_wiseapp, created_at')
    .eq('id_conta_wiseapp', 20)
    .order('created_at', { ascending: false });
  if (tokensError) console.log('Erro:', tokensError.message);
  else if (!tokens || tokens.length === 0) console.log('❌ Nenhum token encontrado para account 20');
  else console.table(tokens);

  // 4. Testar busca com account_id = 20
  console.log('\n🔍 Buscando token para account_id=20:');
  const { data: token20, error: tokenError } = await supabase
    .from('wiseapp_acesso')
    .select('*')
    .eq('id_conta_wiseapp', 20)
    .single();
  
  if (tokenError) {
    console.log('❌ Erro:', tokenError.message);
  } else {
    console.log('✅ Token encontrado:', token20);
  }

  // 5. Buscar company com id_conta_wiseapp = 20
  console.log('\n🔍 Buscando company com id_conta_wiseapp=20:');
  const { data: company20, error: compError } = await supabase
    .from('company')
    .select('*')
    .eq('id_conta_wiseapp', '20')
    .single();
  
  if (compError) {
    console.log('❌ Erro:', compError.message);
  } else {
    console.log('✅ Company encontrada:', company20);
  }
}

testTags().catch(console.error);
