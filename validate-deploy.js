#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Validando arquivos para deploy no Netlify...\n');

const requiredFiles = [
  'netlify.toml',
  'netlify/functions/api.js',
  'netlify/functions/package.json',
  'public/_redirects',
  'package.json',
  'vite.config.ts',
  'tailwind.config.ts'
];

const optionalFiles = [
  '.env.production',
  'DEPLOY_NETLIFY.md',
  'deploy-instructions.md',
  'build-netlify.js'
];

let allValid = true;

// Verificar arquivos obrigatórios
console.log('📋 Verificando arquivos obrigatórios:');
requiredFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, file));
  const status = exists ? '✅' : '❌';
  console.log(`${status} ${file}`);
  if (!exists) allValid = false;
});

// Verificar arquivos opcionais
console.log('\n📋 Verificando arquivos opcionais:');
optionalFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, file));
  const status = exists ? '✅' : '⚠️';
  console.log(`${status} ${file}`);
});

// Verificar conteúdo do netlify.toml
console.log('\n🔧 Verificando configuração do netlify.toml:');
try {
  const netlifyConfig = fs.readFileSync(path.join(__dirname, 'netlify.toml'), 'utf8');
  
  const checks = [
    { check: netlifyConfig.includes('publish = "dist/public"'), msg: 'Publish directory configurado' },
    { check: netlifyConfig.includes('command = "npm run build"'), msg: 'Build command configurado' },
    { check: netlifyConfig.includes('directory = "netlify/functions"'), msg: 'Functions directory configurado' },
    { check: netlifyConfig.includes('[[redirects]]'), msg: 'Redirects configurados' }
  ];

  checks.forEach(({ check, msg }) => {
    const status = check ? '✅' : '❌';
    console.log(`${status} ${msg}`);
    if (!check) allValid = false;
  });
} catch (error) {
  console.log('❌ Erro ao ler netlify.toml');
  allValid = false;
}

// Verificar package.json
console.log('\n📦 Verificando package.json:');
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  
  const requiredScripts = ['build', 'dev'];
  const requiredDeps = ['vite', 'react', 'react-dom'];
  
  requiredScripts.forEach(script => {
    const exists = packageJson.scripts && packageJson.scripts[script];
    const status = exists ? '✅' : '❌';
    console.log(`${status} Script "${script}" existe`);
    if (!exists) allValid = false;
  });

  requiredDeps.forEach(dep => {
    const exists = (packageJson.dependencies && packageJson.dependencies[dep]) || 
                   (packageJson.devDependencies && packageJson.devDependencies[dep]);
    const status = exists ? '✅' : '❌';
    console.log(`${status} Dependência "${dep}" existe`);
    if (!exists) allValid = false;
  });
} catch (error) {
  console.log('❌ Erro ao ler package.json');
  allValid = false;
}

// Verificar função da API
console.log('\n🔌 Verificando função da API:');
try {
  const apiFunction = fs.readFileSync(path.join(__dirname, 'netlify/functions/api.js'), 'utf8');
  
  const checks = [
    { check: apiFunction.includes('exports.handler'), msg: 'Handler exportado' },
    { check: apiFunction.includes('Access-Control-Allow-Origin'), msg: 'CORS configurado' },
    { check: apiFunction.includes('DATABASE_URL'), msg: 'Configuração de banco' },
    { check: apiFunction.includes('/health'), msg: 'Health check implementado' }
  ];

  checks.forEach(({ check, msg }) => {
    const status = check ? '✅' : '❌';
    console.log(`${status} ${msg}`);
    if (!check) allValid = false;
  });
} catch (error) {
  console.log('❌ Erro ao ler netlify/functions/api.js');
  allValid = false;
}

// Verificar redirects
console.log('\n🔄 Verificando redirects:');
try {
  const redirects = fs.readFileSync(path.join(__dirname, 'public/_redirects'), 'utf8');
  
  const checks = [
    { check: redirects.includes('/api/*'), msg: 'Redirect para API' },
    { check: redirects.includes('/*'), msg: 'Redirect para SPA' },
    { check: redirects.includes('200'), msg: 'Status code 200' }
  ];

  checks.forEach(({ check, msg }) => {
    const status = check ? '✅' : '❌';
    console.log(`${status} ${msg}`);
    if (!check) allValid = false;
  });
} catch (error) {
  console.log('❌ Erro ao ler public/_redirects');
  allValid = false;
}

// Resultado final
console.log('\n' + '='.repeat(50));
if (allValid) {
  console.log('🎉 Todos os arquivos estão configurados corretamente!');
  console.log('✅ Projeto pronto para deploy no Netlify');
  console.log('\n📝 Próximos passos:');
  console.log('1. Faça commit das alterações');
  console.log('2. Conecte o repositório no Netlify');
  console.log('3. Configure as variáveis de ambiente');
  console.log('4. Execute o deploy');
  process.exit(0);
} else {
  console.log('❌ Alguns arquivos precisam ser corrigidos');
  console.log('⚠️  Resolva os problemas antes do deploy');
  process.exit(1);
}