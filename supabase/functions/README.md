# Supabase Edge Functions

Este diretório contém todas as Edge Functions do Supabase para o projeto de gestão de frota.

## 📁 Estrutura

```
functions/
├── _shared/              # Código compartilhado entre funções
│   └── cors.ts          # Configuração CORS
├── validate-wiseapp-token/  # Validação de tokens WiseApp
├── proxy-download/      # Proxy para downloads do WiseApp
├── proxy-wiseapp/       # Proxy genérico para API WiseApp
├── group-summary-cron/  # Cron para resumos de grupo
├── manual-summary-trigger/  # Trigger manual de resumos
├── sync-all-motoristas/ # Sincronização completa de motoristas
└── sync-motoristas-bulk/    # Sincronização em lote
```

## 🚀 Deploy Rápido

```bash
# Do diretório raiz do projeto
./deploy-edge-functions.sh all
```

## 📝 Funções Disponíveis

### 1. validate-wiseapp-token ⭐
**Endpoint**: `/functions/v1/validate-wiseapp-token`  
**Método**: POST  
**Descrição**: Valida tokens de acesso do WiseApp/Chatwoot

**Payload**:
```json
{
  "token": "seu_token_aqui"
}
```

**Resposta**:
```json
{
  "valid": true,
  "userData": {
    "name": "Nome",
    "email": "email@exemplo.com",
    "id": 123
  }
}
```

### 2. proxy-download
**Endpoint**: `/functions/v1/proxy-download`  
**Método**: POST  
**Descrição**: Proxy para download de arquivos do WiseApp, contornando CORS

### 3. proxy-wiseapp
**Endpoint**: `/functions/v1/proxy-wiseapp`  
**Método**: POST/GET  
**Descrição**: Proxy genérico para chamadas à API do WiseApp

### 4. group-summary-cron
**Endpoint**: `/functions/v1/group-summary-cron`  
**Método**: POST  
**Descrição**: Função cron para envio automático de resumos de grupo

### 5. manual-summary-trigger
**Endpoint**: `/functions/v1/manual-summary-trigger`  
**Método**: POST  
**Descrição**: Dispara manualmente o envio de resumos

### 6. sync-all-motoristas
**Endpoint**: `/functions/v1/sync-all-motoristas`  
**Método**: POST  
**Descrição**: Sincroniza todos os motoristas com WiseApp

### 7. sync-motoristas-bulk
**Endpoint**: `/functions/v1/sync-motoristas-bulk`  
**Método**: POST  
**Descrição**: Sincronização em lote de motoristas

## 🛠️ Desenvolvimento

### Instalar Supabase CLI

```bash
npm install -g supabase
```

### Login

```bash
supabase login
```

### Link com o Projeto

```bash
supabase link --project-ref jnwocajxsgkgiixwyxkl
```

### Servir Localmente

```bash
# Servir uma função específica
supabase functions serve validate-wiseapp-token

# Testar localmente
curl -X POST http://localhost:54321/functions/v1/validate-wiseapp-token \
  -H 'Content-Type: application/json' \
  -d '{"token":"teste"}'
```

### Deploy

```bash
# Deploy de uma função
supabase functions deploy validate-wiseapp-token

# Deploy de todas
./deploy-edge-functions.sh all
```

### Ver Logs

```bash
# Logs em tempo real
supabase functions logs validate-wiseapp-token --follow

# Ou usando o script
./deploy-edge-functions.sh logs validate-wiseapp-token
```

## 📚 Documentação

- [QUICK_START_EDGE_FUNCTIONS.md](../../QUICK_START_EDGE_FUNCTIONS.md) - Início rápido
- [DEPLOY_EDGE_FUNCTIONS.md](../../DEPLOY_EDGE_FUNCTIONS.md) - Guia completo de deploy
- [EDGE_FUNCTIONS_CODE.md](../../EDGE_FUNCTIONS_CODE.md) - Código e exemplos

## 🔧 Configuração CORS

Todas as funções usam o arquivo `_shared/cors.ts` para configuração CORS:

```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '...',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json'
};
```

## 🧪 Testing

### Testar validate-wiseapp-token

```bash
# Produção
curl -X POST \
  https://jnwocajxsgkgiixwyxkl.supabase.co/functions/v1/validate-wiseapp-token \
  -H 'Content-Type: application/json' \
  -d '{"token":"GfvESPVDsmgQEjsZa3NGPuDa"}'

# Local
curl -X POST \
  http://localhost:54321/functions/v1/validate-wiseapp-token \
  -H 'Content-Type: application/json' \
  -d '{"token":"GfvESPVDsmgQEjsZa3NGPuDa"}'
```

## 🔐 Secrets

Para configurar secrets nas edge functions:

```bash
# Definir secret
supabase secrets set MY_SECRET=valor

# Listar secrets
supabase secrets list

# Usar no código
const mySecret = Deno.env.get('MY_SECRET')
```

## 📊 Monitoramento

### Métricas

- Dashboard: [Supabase Dashboard](https://app.supabase.com/project/jnwocajxsgkgiixwyxkl/functions)
- Logs: `supabase functions logs <nome>`
- Status: `supabase functions list`

### Performance

- **Cold Start**: ~500ms
- **Warm Execution**: ~100-200ms
- **Timeout**: 60 segundos
- **Rate Limit**: Conforme plano Supabase

## ⚠️ Importante

1. **Custos**: Edge functions têm custos baseados em execuções
2. **Limites**: Respeite os rate limits do plano
3. **Segurança**: Nunca commite secrets no código
4. **CORS**: Já configurado para aceitar qualquer origem (*)

## 🐛 Troubleshooting

### Função não responde
```bash
# Ver logs
supabase functions logs validate-wiseapp-token

# Redeploy
supabase functions deploy validate-wiseapp-token
```

### CORS Error
- Verifique se OPTIONS é permitido
- Confirme headers CORS em `_shared/cors.ts`

### 500 Internal Error
- Verifique logs detalhados
- Teste localmente primeiro
- Confirme que todas as dependências estão corretas

## 📞 Suporte

- [Supabase Docs](https://supabase.com/docs/guides/functions)
- [Deno Deploy](https://deno.com/deploy)
- [GitHub Issues](https://github.com/supabase/supabase/issues)
