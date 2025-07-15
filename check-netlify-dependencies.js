#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Verificando dependências para deploy no Netlify...\n');

// Ler package.json principal
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

// Dependências críticas para Netlify
const criticalDeps = {
  build: [
    'vite',
    'esbuild',
    'typescript',
    'tsx'
  ],
  frontend: [
    'react',
    'react-dom',
    '@vitejs/plugin-react'
  ],
  backend: [
    '@neondatabase/serverless',
    'drizzle-orm',
    'pg'
  ],
  styling: [
    'tailwindcss',
    'autoprefixer',
    'postcss'
  ]
};

// Dependências que podem causar problemas no Netlify
const problematicDeps = [
  'express',
  'express-session',
  'passport',
  'passport-local',
  'connect-pg-simple',
  'memorystore',
  'ws'
];

// Dependências que são seguras para Netlify
const safeForNetlify = [
  '@radix-ui/*',
  'react-*',
  'lucide-react',
  '@tanstack/react-query',
  'tailwind*',
  'clsx',
  'zod',
  'date-fns',
  'framer-motion',
  'axios'
];

let issues = [];
let warnings = [];

console.log('📦 Verificando dependências críticas:');
Object.entries(criticalDeps).forEach(([category, deps]) => {
  console.log(`\n${category.toUpperCase()}:`);
  deps.forEach(dep => {
    const inDeps = packageJson.dependencies?.[dep];
    const inDevDeps = packageJson.devDependencies?.[dep];
    const exists = inDeps || inDevDeps;
    
    if (exists) {
      console.log(`✅ ${dep} - ${inDeps ? 'production' : 'development'}`);
    } else {
      console.log(`❌ ${dep} - AUSENTE`);
      issues.push(`Dependência crítica ausente: ${dep}`);
    }
  });
});

console.log('\n⚠️  Verificando dependências problemáticas para Netlify:');
problematicDeps.forEach(dep => {
  if (packageJson.dependencies?.[dep]) {
    console.log(`🚨 ${dep} - Pode causar problemas no Netlify`);
    warnings.push(`${dep} é uma dependência de servidor que não funcionará no Netlify`);
  }
});

console.log('\n🔧 Verificando configuração do build:');
const buildScript = packageJson.scripts?.build;
if (buildScript) {
  console.log(`✅ Build script: ${buildScript}`);
  
  // Verificar se o build produz os arquivos corretos
  if (buildScript.includes('vite build')) {
    console.log('✅ Vite build configurado');
  } else {
    issues.push('Build script não usa Vite');
  }
} else {
  issues.push('Script de build não encontrado');
}

console.log('\n📁 Verificando estrutura de arquivos:');
const requiredFiles = [
  'vite.config.ts',
  'tailwind.config.ts',
  'tsconfig.json',
  'index.html'
];

requiredFiles.forEach(file => {
  if (fs.existsSync(path.join(__dirname, file))) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - AUSENTE`);
    issues.push(`Arquivo necessário ausente: ${file}`);
  }
});

console.log('\n🔌 Verificando funções do Netlify:');
const functionsPackage = path.join(__dirname, 'netlify/functions/package.json');
if (fs.existsSync(functionsPackage)) {
  const funcPkg = JSON.parse(fs.readFileSync(functionsPackage, 'utf8'));
  console.log('✅ Package.json das funções existe');
  
  // Verificar dependências das funções
  const functionDeps = ['pg', '@neondatabase/serverless'];
  functionDeps.forEach(dep => {
    if (funcPkg.dependencies?.[dep]) {
      console.log(`✅ Função dependency: ${dep}`);
    } else {
      console.log(`❌ Função dependency: ${dep} - AUSENTE`);
      issues.push(`Dependência das funções ausente: ${dep}`);
    }
  });
} else {
  issues.push('Package.json das funções não encontrado');
}

console.log('\n📊 Verificando compatibilidade Node.js:');
const nodeVersion = packageJson.engines?.node;
if (nodeVersion) {
  console.log(`✅ Node.js version especificada: ${nodeVersion}`);
} else {
  console.log('⚠️  Node.js version não especificada');
  warnings.push('Recomendado especificar versão do Node.js em engines');
}

console.log('\n🌐 Verificando configuração de environment:');
const envFile = path.join(__dirname, '.env.production');
if (fs.existsSync(envFile)) {
  console.log('✅ .env.production existe');
} else {
  console.log('⚠️  .env.production não encontrado');
  warnings.push('Arquivo .env.production ajudaria na configuração');
}

console.log('\n🚀 Verificando otimizações para produção:');
const optimizations = {
  'Tree shaking': buildScript?.includes('vite build'),
  'Minification': true, // Vite faz por padrão
  'Code splitting': true, // Vite faz por padrão
  'Asset optimization': true // Vite faz por padrão
};

Object.entries(optimizations).forEach(([opt, enabled]) => {
  const status = enabled ? '✅' : '❌';
  console.log(`${status} ${opt}`);
});

// Verificar tamanho das dependências
console.log('\n📐 Analisando tamanho das dependências:');
const heavyDeps = [
  'jspdf',
  'jspdf-autotable',
  'html2canvas',
  'xlsx',
  'framer-motion'
];

heavyDeps.forEach(dep => {
  if (packageJson.dependencies?.[dep]) {
    console.log(`⚠️  ${dep} - Dependência pesada (considere lazy loading)`);
    warnings.push(`${dep} é uma dependência pesada, considere carregamento sob demanda`);
  }
});

// Relatório final
console.log('\n' + '='.repeat(60));
console.log('📋 RELATÓRIO FINAL');
console.log('='.repeat(60));

if (issues.length === 0) {
  console.log('🎉 Todas as dependências estão prontas para o Netlify!');
} else {
  console.log(`❌ ${issues.length} problema(s) encontrado(s):`);
  issues.forEach((issue, i) => {
    console.log(`   ${i + 1}. ${issue}`);
  });
}

if (warnings.length > 0) {
  console.log(`\n⚠️  ${warnings.length} aviso(s):`);
  warnings.forEach((warning, i) => {
    console.log(`   ${i + 1}. ${warning}`);
  });
}

console.log('\n🔧 RECOMENDAÇÕES:');
console.log('1. Remover dependências de servidor (express, passport, etc.)');
console.log('2. Usar apenas @neondatabase/serverless para banco de dados');
console.log('3. Implementar lazy loading para dependências pesadas');
console.log('4. Adicionar engines.node ao package.json');
console.log('5. Testar build localmente antes do deploy');

console.log('\n📝 PRÓXIMOS PASSOS:');
if (issues.length === 0) {
  console.log('✅ Projeto pronto para deploy no Netlify');
  console.log('✅ Execute: npm run build');
  console.log('✅ Faça deploy no Netlify');
} else {
  console.log('❌ Resolva os problemas listados acima');
  console.log('❌ Execute este script novamente');
}

process.exit(issues.length > 0 ? 1 : 0);