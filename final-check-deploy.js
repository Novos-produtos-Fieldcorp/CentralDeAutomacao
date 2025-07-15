#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 VERIFICAÇÃO FINAL PARA DEPLOY NETLIFY');
console.log('='.repeat(50));

let allReady = true;

// 1. Verificar arquivos essenciais
console.log('\n📁 ARQUIVOS ESSENCIAIS:');
const essentialFiles = [
  'index.html',
  'netlify.toml',
  'netlify/functions/api.js',
  'netlify/functions/package.json',
  'public/_redirects',
  'package.json',
  'vite.config.ts'
];

essentialFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allReady = false;
});

// 2. Verificar dependências críticas
console.log('\n📦 DEPENDÊNCIAS CRÍTICAS:');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const criticalDeps = ['react', 'react-dom', 'vite', '@neondatabase/serverless', 'drizzle-orm', 'pg'];

criticalDeps.forEach(dep => {
  const exists = packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep];
  console.log(`${exists ? '✅' : '❌'} ${dep}`);
  if (!exists) allReady = false;
});

// 3. Verificar configuração Netlify
console.log('\n🌐 CONFIGURAÇÃO NETLIFY:');
const netlifyConfig = fs.readFileSync(path.join(__dirname, 'netlify.toml'), 'utf8');
const configs = [
  { name: 'Build command', check: netlifyConfig.includes('command = "npm run build"') },
  { name: 'Publish directory', check: netlifyConfig.includes('publish = "dist/public"') },
  { name: 'Functions directory', check: netlifyConfig.includes('directory = "netlify/functions"') },
  { name: 'Redirects', check: netlifyConfig.includes('[[redirects]]') }
];

configs.forEach(config => {
  console.log(`${config.check ? '✅' : '❌'} ${config.name}`);
  if (!config.check) allReady = false;
});

// 4. Verificar função API
console.log('\n🔌 FUNÇÃO API:');
const apiFunction = fs.readFileSync(path.join(__dirname, 'netlify/functions/api.js'), 'utf8');
const apiChecks = [
  { name: 'Handler exportado', check: apiFunction.includes('export const handler') },
  { name: 'CORS configurado', check: apiFunction.includes('Access-Control-Allow-Origin') },
  { name: 'Database connection', check: apiFunction.includes('neon(') },
  { name: 'Health check', check: apiFunction.includes('/health') }
];

apiChecks.forEach(check => {
  console.log(`${check.check ? '✅' : '❌'} ${check.name}`);
  if (!check.check) allReady = false;
});

// 5. Verificar build
console.log('\n🔧 CONFIGURAÇÃO DE BUILD:');
const buildChecks = [
  { name: 'Script build existe', check: packageJson.scripts?.build },
  { name: 'Vite configurado', check: fs.existsSync(path.join(__dirname, 'vite.config.ts')) },
  { name: 'Tailwind configurado', check: fs.existsSync(path.join(__dirname, 'tailwind.config.ts')) },
  { name: 'TypeScript configurado', check: fs.existsSync(path.join(__dirname, 'tsconfig.json')) }
];

buildChecks.forEach(check => {
  console.log(`${check.check ? '✅' : '❌'} ${check.name}`);
  if (!check.check) allReady = false;
});

// 6. Verificar estrutura de diretórios
console.log('\n📂 ESTRUTURA DE DIRETÓRIOS:');
const dirs = [
  { name: 'client/src', path: 'client/src' },
  { name: 'server', path: 'server' },
  { name: 'shared', path: 'shared' },
  { name: 'netlify/functions', path: 'netlify/functions' },
  { name: 'public', path: 'public' }
];

dirs.forEach(dir => {
  const exists = fs.existsSync(path.join(__dirname, dir.path));
  console.log(`${exists ? '✅' : '❌'} ${dir.name}`);
  if (!exists) allReady = false;
});

// 7. Verificar variáveis de ambiente
console.log('\n🔐 TEMPLATE DE VARIÁVEIS:');
const envFile = path.join(__dirname, '.env.production');
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf8');
  const envVars = [
    'DATABASE_URL',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_CHAT_API_URL',
    'VITE_CHAT_ACCOUNT_ID',
    'NODE_ENV'
  ];
  
  envVars.forEach(envVar => {
    const exists = envContent.includes(envVar);
    console.log(`${exists ? '✅' : '❌'} ${envVar}`);
  });
} else {
  console.log('❌ Arquivo .env.production não encontrado');
}

// 8. Verificar dependências problemáticas (apenas aviso)
console.log('\n⚠️  DEPENDÊNCIAS DE SERVIDOR (não afetam deploy):');
const serverDeps = ['express', 'passport', 'ws', 'express-session'];
serverDeps.forEach(dep => {
  const exists = packageJson.dependencies?.[dep];
  if (exists) {
    console.log(`🔶 ${dep} - presente mas não afeta deploy`);
  }
});

// Resultado final
console.log('\n' + '='.repeat(50));
console.log('📊 RESULTADO FINAL');
console.log('='.repeat(50));

if (allReady) {
  console.log('🎉 PROJETO 100% PRONTO PARA DEPLOY!');
  console.log('');
  console.log('🚀 PRÓXIMOS PASSOS:');
  console.log('1. Commit e push do código');
  console.log('2. Conectar repositório no Netlify');
  console.log('3. Configurar variáveis de ambiente');
  console.log('4. Executar deploy');
  console.log('');
  console.log('📝 COMANDOS ÚTEIS:');
  console.log('   git add .');
  console.log('   git commit -m "Configuração completa para Netlify"');
  console.log('   git push origin main');
  console.log('');
  console.log('🌐 NETLIFY DASHBOARD:');
  console.log('   https://app.netlify.com/sites');
  console.log('');
  console.log('✅ STATUS: PRONTO PARA PRODUÇÃO');
} else {
  console.log('❌ EXISTEM PROBLEMAS QUE PRECISAM SER RESOLVIDOS');
  console.log('');
  console.log('🔧 EXECUTE:');
  console.log('   node validate-deploy.js');
  console.log('   node check-netlify-dependencies.js');
}

process.exit(allReady ? 0 : 1);