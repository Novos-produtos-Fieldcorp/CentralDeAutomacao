// Script para fazer deploy das funções Supabase
// Este script pode ser executado para verificar e deployar as funções

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando funções Supabase...');

// Verificar se as funções existem
const functionsDir = path.join(__dirname, 'supabase', 'functions');
const syncAllMotoristasDir = path.join(functionsDir, 'sync-all-motoristas');
const syncMotoristasBulkDir = path.join(functionsDir, 'sync-motoristas-bulk');

console.log('📁 Diretório de funções:', functionsDir);
console.log('📁 Função sync-all-motoristas:', syncAllMotoristasDir);
console.log('📁 Função sync-motoristas-bulk:', syncMotoristasBulkDir);

// Verificar se os diretórios existem
const functions = [
  { name: 'sync-all-motoristas', path: syncAllMotoristasDir },
  { name: 'sync-motoristas-bulk', path: syncMotoristasBulkDir }
];

functions.forEach(func => {
  if (fs.existsSync(func.path)) {
    const indexPath = path.join(func.path, 'index.ts');
    if (fs.existsSync(indexPath)) {
      console.log(`✅ Função ${func.name} encontrada: ${indexPath}`);
      
      // Verificar se o arquivo tem conteúdo
      const content = fs.readFileSync(indexPath, 'utf8');
      if (content.length > 100) {
        console.log(`   📄 Tamanho do arquivo: ${content.length} caracteres`);
        console.log(`   🔧 Status: Pronta para deploy`);
      } else {
        console.log(`   ⚠️  Arquivo muito pequeno, pode estar vazio`);
      }
    } else {
      console.log(`❌ Arquivo index.ts não encontrado em ${func.name}`);
    }
  } else {
    console.log(`❌ Diretório ${func.name} não encontrado`);
  }
});

console.log('\n📋 Instruções para deploy:');
console.log('1. Instale o Supabase CLI: https://github.com/supabase/cli#install-the-cli');
console.log('2. Faça login: supabase login');
console.log('3. Link do projeto: supabase link --project-ref jnwocajxsgkgiixwyxkl');
console.log('4. Deploy das funções: supabase functions deploy');
console.log('\n🔗 Links úteis:');
console.log('- Supabase CLI: https://github.com/supabase/cli');
console.log('- Documentação: https://supabase.com/docs/guides/functions');
console.log('- Seu projeto: https://jnwocajxsgkgiixwyxkl.supabase.co');

console.log('\n🚀 Alternativa: Deploy via Dashboard');
console.log('1. Acesse: https://supabase.com/dashboard/project/jnwocajxsgkgiixwyxkl');
console.log('2. Vá em Edge Functions');
console.log('3. Clique em "Create a new function"');
console.log('4. Nome: sync-all-motoristas');
console.log('5. Cole o conteúdo do arquivo supabase/functions/sync-all-motoristas/index.ts');
