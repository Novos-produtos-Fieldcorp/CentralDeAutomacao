#!/bin/bash

echo "🚀 Deploy da Edge Function 'api' para Supabase"
echo "=============================================="
echo ""

PROJECT_REF="jnwocajxsgkgiixwyxkl"

# Verificar se Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI não encontrado. Tentando com npx..."
    SUPABASE_CMD="npx supabase"
else
    SUPABASE_CMD="supabase"
fi

echo "📝 Verificando login..."
$SUPABASE_CMD projects list --project-ref $PROJECT_REF 2>/dev/null

if [ $? -ne 0 ]; then
    echo "❌ Você não está logado ou não tem acesso ao projeto."
    echo ""
    echo "Execute primeiro:"
    echo "  $SUPABASE_CMD login"
    echo ""
    exit 1
fi

echo "✅ Login verificado!"
echo ""

echo "📦 Fazendo deploy da Edge Function 'api'..."
$SUPABASE_CMD functions deploy api --project-ref $PROJECT_REF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deploy realizado com sucesso!"
    echo ""
    echo "🔍 Testando health check..."
    sleep 2
    
    HEALTH_URL="https://${PROJECT_REF}.supabase.co/functions/v1/api/health"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" "$HEALTH_URL")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ Health check passou!"
        echo "📊 Resposta: $BODY"
        echo ""
        echo "🎉 Edge Function está funcionando!"
        echo ""
        echo "🔗 Endpoints disponíveis:"
        echo "  - Health: $HEALTH_URL"
        echo "  - Validate Token: https://${PROJECT_REF}.supabase.co/functions/v1/api/wiseapp/validate-token"
        echo ""
        echo "✅ Agora teste no seu site Netlify!"
    else
        echo "⚠️  Health check retornou código $HTTP_CODE"
        echo "📊 Resposta: $BODY"
        echo ""
        echo "Aguarde alguns segundos e tente novamente:"
        echo "  curl $HEALTH_URL"
    fi
else
    echo ""
    echo "❌ Falha no deploy!"
    echo ""
    echo "Possíveis soluções:"
    echo "1. Certifique-se de estar logado: $SUPABASE_CMD login"
    echo "2. Verifique suas permissões no projeto Supabase"
    echo "3. Tente fazer upload manual pela interface web"
    echo ""
    exit 1
fi
