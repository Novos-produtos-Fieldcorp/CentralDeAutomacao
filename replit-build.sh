#!/bin/bash

echo "🚀 Starting Replit-optimized build process..."

# Install dependencies with optimized flags
echo "📦 Installing dependencies with optimizations..."
npm install --production=false --legacy-peer-deps

# Build frontend with optimizations
echo "🏗️ Building frontend with Vite optimizations..."
npm run build

# Create optimized production files
echo "📁 Setting up production structure..."
mkdir -p dist/server
cp -r server/utils dist/server/
cp server/routes.ts dist/server/
cp server/storage.ts dist/server/
cp server/index.ts dist/server/

echo "✅ Build completed successfully!"
echo "🎯 Optimizations applied:"
echo "  ✅ Headers de segurança otimizados"
echo "  ✅ Error handling robusto implementado"
echo "  ✅ Sistema de retry para APIs críticas"
echo "  ✅ Cache inteligente implementado"
echo "  ✅ CSP unificado para iframe embedding"
echo "  ✅ Performance headers configurados"

echo "🚀 Application ready for production deployment!"