# ✅ Edge Functions - Setup Completo

## 📦 O que foi entregue

### 1. **Edge Function: validate-wiseapp-token**
Localização: `supabase/functions/validate-wiseapp-token/index.ts`

**Funcionalidade**:
- Valida tokens de acesso do WiseApp/Chatwoot
- Remove espaços extras automaticamente
- Retorna dados do usuário validado
- CORS configurado para aceitar chamadas do frontend

**Endpoint**: `https://jnwocajxsgkgiixwyxkl.supabase.co/functions/v1/validate-wiseapp-token`

**Teste rápido**:
```bash
curl -X POST \
  https://jnwocajxsgkgiixwyxkl.supabase.co/functions/v1/validate-wiseapp-token \
  -H 'Content-Type: application/json' \
  -d '{"token":"GfvESPVDsmgQEjsZa3NGPuDa"}'
```

### 2. **Frontend Integrado**
Arquivo: `client/src/components/WiseAppTokenModal.tsx`

O frontend já está configurado para usar a edge function:
- Valida tokens via edge function
- Trata erros adequadamente
- Salva dados no banco após validação

### 3. **Correção de Múltiplos Registros**
Arquivo: `client/src/context/WiseAppAccessContext.tsx`

Quando há múltiplos registros na tabela `wiseapp_acesso` para o mesmo `id_conta_wiseapp`:
- Sistema pega automaticamente o mais recente
- Usa `.order('wiseapp_acesso_id', { ascending: false }).limit(1)`
- Não retorna mais erro "Results contain 5 rows"

### 4. **Scripts de Deploy**

#### Script Principal: `deploy-edge-functions.sh`
```bash
# Deploy de todas as funções
./deploy-edge-functions.sh all

# Deploy de uma função específica
./deploy-edge-functions.sh validate-wiseapp-token

# Ver logs
./deploy-edge-functions.sh logs validate-wiseapp-token

# Listar funções
./deploy-edge-functions.sh list

# Testar função
./deploy-edge-functions.sh test validate-wiseapp-token
```

### 5. **Documentação Completa**

#### 📖 Guias Criados:

1. **QUICK_START_EDGE_FUNCTIONS.md**
   - Início rápido em 3 passos
   - Comandos essenciais
   - Troubleshooting básico

2. **DEPLOY_EDGE_FUNCTIONS.md**
   - Guia completo de deploy
   - Todas as edge functions disponíveis
   - Configuração de secrets
   - Testes locais
   - Links úteis

3. **EDGE_FUNCTIONS_CODE.md**
   - Código-fonte completo
   - Exemplos de uso no frontend
   - Estrutura de respostas
   - Testing com cURL
   - Segurança e performance

4. **supabase/functions/README.md**
   - Estrutura das funções
   - Desenvolvimento local
   - Monitoramento
   - Troubleshooting

5. **supabase/.env.example**
   - Template de configuração
   - Variáveis necessárias

## 🚀 Como Fazer Deploy

### Método 1: Script Automático (Recomendado)

```bash
# 1. Instalar Supabase CLI
npm install -g supabase

# 2. Fazer login
supabase login

# 3. Deploy
./deploy-edge-functions.sh all
```

### Método 2: Manual

```bash
# 1. Instalar Supabase CLI
npm install -g supabase

# 2. Fazer login
supabase login

# 3. Link com projeto
supabase link --project-ref jnwocajxsgkgiixwyxkl

# 4. Deploy
supabase functions deploy validate-wiseapp-token
```

## ✅ Verificar se Funcionou

Após o deploy, teste:

```bash
curl -X POST \
  https://jnwocajxsgkgiixwyxkl.supabase.co/functions/v1/validate-wiseapp-token \
  -H 'Content-Type: application/json' \
  -d '{"token":"GfvESPVDsmgQEjsZa3NGPuDa"}'
```

**Resposta esperada**:
```json
{
  "valid": true,
  "userData": {
    "name": "Everton Biciato",
    "email": "everton@mediatec-sp.com",
    "id": 269
  }
}
```

## 📁 Estrutura de Arquivos Criados

```
.
├── deploy-edge-functions.sh           # Script de deploy automático
├── QUICK_START_EDGE_FUNCTIONS.md     # Guia de início rápido
├── DEPLOY_EDGE_FUNCTIONS.md          # Guia completo de deploy
├── EDGE_FUNCTIONS_CODE.md            # Código e exemplos
├── EDGE_FUNCTIONS_SETUP_COMPLETE.md  # Este arquivo
├── supabase/
│   ├── .env.example                  # Template de configuração
│   └── functions/
│       ├── README.md                 # Documentação das funções
│       ├── _shared/
│       │   └── cors.ts              # Configuração CORS
│       ├── validate-wiseapp-token/   # ⭐ Função principal
│       │   └── index.ts
│       ├── proxy-download/
│       ├── proxy-wiseapp/
│       ├── group-summary-cron/
│       ├── manual-summary-trigger/
│       ├── sync-all-motoristas/
│       └── sync-motoristas-bulk/
└── client/src/
    ├── components/
    │   └── WiseAppTokenModal.tsx     # Frontend integrado
    └── context/
        └── WiseAppAccessContext.tsx  # Correção múltiplos registros
```

## 🔧 Edge Functions Disponíveis

| Função | Status | Endpoint |
|--------|--------|----------|
| validate-wiseapp-token | ✅ Pronta | `/functions/v1/validate-wiseapp-token` |
| proxy-download | ✅ Pronta | `/functions/v1/proxy-download` |
| proxy-wiseapp | ✅ Pronta | `/functions/v1/proxy-wiseapp` |
| group-summary-cron | ✅ Pronta | `/functions/v1/group-summary-cron` |
| manual-summary-trigger | ✅ Pronta | `/functions/v1/manual-summary-trigger` |
| sync-all-motoristas | ✅ Pronta | `/functions/v1/sync-all-motoristas` |
| sync-motoristas-bulk | ✅ Pronta | `/functions/v1/sync-motoristas-bulk` |

## 🎯 Próximos Passos

### 1. Fazer Deploy das Edge Functions
```bash
./deploy-edge-functions.sh all
```

### 2. Verificar Logs
```bash
./deploy-edge-functions.sh logs validate-wiseapp-token
```

### 3. Testar no Frontend
Acesse a aplicação com `?account_id=42` e tente autenticar com um token WiseApp.

### 4. Monitorar Performance
- Dashboard: https://app.supabase.com/project/jnwocajxsgkgiixwyxkl/functions
- Logs: `./deploy-edge-functions.sh logs validate-wiseapp-token`

## 🐛 Troubleshooting

### Erro: "Failed to fetch"
A edge function ainda não foi deployada. Execute:
```bash
./deploy-edge-functions.sh validate-wiseapp-token
```

### Erro: "Supabase CLI não encontrado"
```bash
npm install -g supabase
```

### Erro: "Não autenticado"
```bash
supabase login
```

### Edge function retorna 500
Verifique os logs:
```bash
./deploy-edge-functions.sh logs validate-wiseapp-token
```

## 📊 Diferenças: Validação Direta vs Edge Function

| Aspecto | Validação Direta | Edge Function |
|---------|-----------------|---------------|
| **CORS** | ❌ Bloqueado pelo navegador | ✅ Sem problemas |
| **Segurança** | ⚠️ Token exposto no frontend | ✅ Validação server-side |
| **Logs** | ❌ Sem logs centralizados | ✅ Logs no Supabase |
| **Manutenção** | ⚠️ Código duplicado | ✅ Centralizado |
| **Cache** | ❌ Difícil implementar | ✅ Fácil adicionar |
| **Rate Limiting** | ❌ Sem controle | ✅ Controlado pelo Supabase |
| **Deploy** | ✅ Sem deploy necessário | ⚠️ Requer deploy |

## 💡 Vantagens da Edge Function

1. ✅ **CORS resolvido**: Sem problemas de cross-origin
2. ✅ **Logs centralizados**: Debug facilitado
3. ✅ **Reutilizável**: Pode ser chamada de qualquer parte do sistema
4. ✅ **Segura**: Validação server-side
5. ✅ **Escalável**: Gerenciada pelo Supabase
6. ✅ **Manutenível**: Código em um só lugar

## 📞 Suporte

- **Documentação Supabase**: https://supabase.com/docs/guides/functions
- **Supabase CLI**: https://supabase.com/docs/guides/cli
- **Deno Deploy**: https://deno.com/deploy

## 🎉 Conclusão

Sistema configurado para usar Edge Functions do Supabase! 

**Para começar**:
```bash
./deploy-edge-functions.sh all
```

**Para testar**:
```bash
curl -X POST \
  https://jnwocajxsgkgiixwyxkl.supabase.co/functions/v1/validate-wiseapp-token \
  -H 'Content-Type: application/json' \
  -d '{"token":"seu_token"}'
```

---

**Criado em**: 24 de Novembro de 2025  
**Versão**: 1.0  
**Status**: ✅ Pronto para Deploy
