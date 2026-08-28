#!/bin/bash

# Script para Deploy de Edge Functions do Supabase
# Uso: ./deploy-edge-functions.sh [função] ou ./deploy-edge-functions.sh all

set -e  # Parar em caso de erro

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configurações
PROJECT_REF="jnwocajxsgkgiixwyxkl"
SUPABASE_URL="https://jnwocajxsgkgiixwyxkl.supabase.co"

echo -e "${GREEN}🚀 Deploy de Edge Functions do Supabase${NC}"
echo ""

# Verificar se Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI não encontrado!${NC}"
    echo -e "${YELLOW}Instale com: npm install -g supabase${NC}"
    exit 1
fi

# Verificar se está autenticado
echo -e "${YELLOW}🔐 Verificando autenticação...${NC}"
if ! supabase projects list &> /dev/null; then
    echo -e "${RED}❌ Não autenticado!${NC}"
    echo -e "${YELLOW}Faça login com: supabase login${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Autenticado${NC}"

# Verificar/criar link com o projeto
echo -e "${YELLOW}🔗 Verificando link com o projeto...${NC}"
if [ ! -f ".supabase/config.json" ]; then
    echo -e "${YELLOW}Criando link com o projeto $PROJECT_REF...${NC}"
    supabase link --project-ref $PROJECT_REF
fi
echo -e "${GREEN}✅ Projeto linkado${NC}"
echo ""

# Lista de funções disponíveis
FUNCTIONS=(
    "validate-wiseapp-token"
    "proxy-download"
    "proxy-wiseapp"
    "group-summary-cron"
    "manual-summary-trigger"
    "sync-all-motoristas"
    "sync-motoristas-bulk"
)

# Função para deploy individual
deploy_function() {
    local func=$1
    echo -e "${YELLOW}📦 Deploying $func...${NC}"
    
    if supabase functions deploy $func; then
        echo -e "${GREEN}✅ $func deployada com sucesso!${NC}"
        echo -e "   URL: ${SUPABASE_URL}/functions/v1/$func"
        return 0
    else
        echo -e "${RED}❌ Erro ao deployar $func${NC}"
        return 1
    fi
}

# Processar argumentos
if [ $# -eq 0 ] || [ "$1" == "all" ]; then
    echo -e "${GREEN}📋 Deploying todas as edge functions...${NC}"
    echo ""
    
    SUCCESS=0
    FAILED=0
    
    for func in "${FUNCTIONS[@]}"; do
        if deploy_function $func; then
            ((SUCCESS++))
        else
            ((FAILED++))
        fi
        echo ""
    done
    
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ Sucesso: $SUCCESS funções${NC}"
    if [ $FAILED -gt 0 ]; then
        echo -e "${RED}❌ Falhas: $FAILED funções${NC}"
    fi
    echo ""
    
elif [ "$1" == "list" ]; then
    echo -e "${GREEN}📋 Funções disponíveis:${NC}"
    for func in "${FUNCTIONS[@]}"; do
        echo -e "  - $func"
    done
    echo ""
    echo -e "${YELLOW}Para deployar uma função específica:${NC}"
    echo -e "  ./deploy-edge-functions.sh nome-da-funcao"
    echo ""
    echo -e "${YELLOW}Para deployar todas:${NC}"
    echo -e "  ./deploy-edge-functions.sh all"
    echo ""
    
elif [ "$1" == "logs" ]; then
    if [ -z "$2" ]; then
        echo -e "${RED}❌ Especifique o nome da função${NC}"
        echo -e "${YELLOW}Uso: ./deploy-edge-functions.sh logs nome-da-funcao${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}📜 Logs de $2:${NC}"
    supabase functions logs $2
    
elif [ "$1" == "test" ]; then
    if [ -z "$2" ]; then
        echo -e "${RED}❌ Especifique o nome da função${NC}"
        echo -e "${YELLOW}Uso: ./deploy-edge-functions.sh test nome-da-funcao${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}🧪 Testando $2...${NC}"
    echo -e "${YELLOW}URL: ${SUPABASE_URL}/functions/v1/$2${NC}"
    echo ""
    
    # Exemplo de teste para validate-wiseapp-token
    if [ "$2" == "validate-wiseapp-token" ]; then
        echo -e "${YELLOW}Exemplo de teste com token:${NC}"
        echo ""
        echo "curl -X POST \\"
        echo "  ${SUPABASE_URL}/functions/v1/$2 \\"
        echo "  -H 'Content-Type: application/json' \\"
        echo "  -d '{\"token\":\"seu_token_aqui\"}'"
        echo ""
    fi
    
else
    # Deploy de função específica
    if [[ " ${FUNCTIONS[@]} " =~ " $1 " ]]; then
        deploy_function $1
        
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}✅ Deploy concluído!${NC}"
        echo ""
        echo -e "${YELLOW}Para ver os logs:${NC}"
        echo -e "  ./deploy-edge-functions.sh logs $1"
        echo ""
        echo -e "${YELLOW}Para testar:${NC}"
        echo -e "  ./deploy-edge-functions.sh test $1"
        echo ""
    else
        echo -e "${RED}❌ Função '$1' não encontrada${NC}"
        echo ""
        echo -e "${YELLOW}Funções disponíveis:${NC}"
        for func in "${FUNCTIONS[@]}"; do
            echo -e "  - $func"
        done
        echo ""
        exit 1
    fi
fi

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Processo concluído!${NC}"
echo ""
echo -e "${YELLOW}💡 Comandos úteis:${NC}"
echo -e "  ./deploy-edge-functions.sh list        # Listar funções"
echo -e "  ./deploy-edge-functions.sh all         # Deploy de todas"
echo -e "  ./deploy-edge-functions.sh logs <nome> # Ver logs"
echo -e "  ./deploy-edge-functions.sh test <nome> # Testar função"
echo ""
