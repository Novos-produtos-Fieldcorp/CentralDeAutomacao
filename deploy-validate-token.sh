#!/bin/bash

echo "🚀 Deploy da Edge Function: validate-wiseapp-token"
echo ""
echo "Este script vai fazer o deploy da função para o Supabase."
echo ""

# Verificar se já está logado
echo "Verificando se está logado no Supabase..."
npx supabase projects list > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Você precisa fazer login primeiro!"
    echo ""
    echo "Execute: npx supabase login"
    echo ""
    echo "Isso vai abrir o navegador para você autorizar."
    exit 1
fi

echo "✅ Logado no Supabase!"
echo ""

# Verificar se o projeto está linkado
echo "Verificando link do projeto..."
if [ ! -f ".supabase/config.toml" ]; then
    echo ""
    echo "🔗 Linkando projeto..."
    npx supabase link --project-ref jnwocajxsgkgiixwyxkl
    
    if [ $? -ne 0 ]; then
        echo ""
        echo "❌ Erro ao linkar projeto!"
        exit 1
    fi
fi

echo "✅ Projeto linkado!"
echo ""

# Fazer deploy da função
echo "📦 Fazendo deploy da função validate-wiseapp-token..."
npx supabase functions deploy validate-wiseapp-token

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deploy realizado com sucesso!"
    echo ""
    echo "🔍 Para ver os logs:"
    echo "   npx supabase functions logs validate-wiseapp-token"
    echo ""
    echo "🌐 Ou acesse:"
    echo "   https://supabase.com/dashboard/project/jnwocajxsgkgiixwyxkl/functions/validate-wiseapp-token/logs"
    echo ""
else
    echo ""
    echo "❌ Erro no deploy!"
    echo ""
    echo "Tente manualmente:"
    echo "1. npx supabase login"
    echo "2. npx supabase link --project-ref jnwocajxsgkgiixwyxkl"
    echo "3. npx supabase functions deploy validate-wiseapp-token"
    exit 1
fi
