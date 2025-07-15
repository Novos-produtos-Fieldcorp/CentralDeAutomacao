#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Iniciando build para Netlify...');

try {
  // 1. Executar build do Vite
  console.log('📦 Executando build do frontend...');
  execSync('npm run build', { stdio: 'inherit' });

  // 2. Verificar se o diretório dist/public existe
  const publicDir = path.join(__dirname, 'dist', 'public');
  if (!fs.existsSync(publicDir)) {
    throw new Error('Diretório dist/public não encontrado após build');
  }

  // 3. Copiar arquivos necessários para o deploy
  console.log('📋 Copiando arquivos de configuração...');
  
  // Copiar _redirects se existir
  const redirectsSource = path.join(__dirname, 'public', '_redirects');
  const redirectsTarget = path.join(publicDir, '_redirects');
  
  if (fs.existsSync(redirectsSource)) {
    fs.copyFileSync(redirectsSource, redirectsTarget);
    console.log('✅ Arquivo _redirects copiado');
  }

  // 4. Verificar se as funções existem
  const functionsDir = path.join(__dirname, 'netlify', 'functions');
  if (!fs.existsSync(functionsDir)) {
    throw new Error('Diretório netlify/functions não encontrado');
  }

  // 5. Verificar configuração do Netlify
  const netlifyConfig = path.join(__dirname, 'netlify.toml');
  if (!fs.existsSync(netlifyConfig)) {
    throw new Error('Arquivo netlify.toml não encontrado');
  }

  console.log('✅ Build concluído com sucesso!');
  console.log('📁 Arquivos prontos para deploy:');
  console.log(`   - Frontend: ${publicDir}`);
  console.log(`   - Funções: ${functionsDir}`);
  console.log(`   - Configuração: ${netlifyConfig}`);

} catch (error) {
  console.error('❌ Erro durante o build:', error.message);
  process.exit(1);
}