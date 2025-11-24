# Deploy de Edge Functions do Supabase

Este documento explica como fazer o deploy das Edge Functions do Supabase necessárias para o projeto.

## Pré-requisitos

1. **Instalar Supabase CLI**:
   ```bash
   npm install -g supabase
   ```

2. **Fazer login no Supabase**:
   ```bash
   supabase login
   ```
   - Isso abrirá um navegador para você autorizar o acesso
   - Ou use um token de acesso: `supabase login --token YOUR_ACCESS_TOKEN`

3. **Linkar com o projeto Supabase**:
   ```bash
   supabase link --project-ref ohmoxsvwjvohmqqgxjhb
   ```
   - Você precisará confirmar o link quando solicitado

## Deploy das Edge Functions

### 1. Deploy da função de validação de token WiseApp

Esta função valida tokens do WiseApp/Chatwoot:

```bash
supabase functions deploy validate-wiseapp-token
```

### 2. Deploy de todas as edge functions disponíveis

Se quiser fazer deploy de todas as funções de uma vez:

```bash
# Deploy individual de cada função
supabase functions deploy proxy-download
supabase functions deploy proxy-wiseapp
supabase functions deploy group-summary-cron
supabase functions deploy manual-summary-trigger
supabase functions deploy sync-all-motoristas
supabase functions deploy sync-motoristas-bulk
supabase functions deploy validate-wiseapp-token
```

### 3. Verificar funções deployadas

Para listar todas as edge functions deployadas:

```bash
supabase functions list
```

### 4. Ver logs de uma função

Para debugar problemas:

```bash
supabase functions logs validate-wiseapp-token
```

## Edge Functions Disponíveis

### validate-wiseapp-token
**Descrição**: Valida tokens de acesso do WiseApp/Chatwoot  
**Método**: POST  
**Endpoint**: `https://ohmoxsvwjvohmqqgxjhb.supabase.co/functions/v1/validate-wiseapp-token`  
**Payload**:
```json
{
  "token": "seu_token_aqui"
}
```
**Resposta de Sucesso**:
```json
{
  "valid": true,
  "userData": {
    "name": "Nome do Usuário",
    "email": "email@exemplo.com",
    "id": 123
  }
}
```

### proxy-download
**Descrição**: Proxy para download de arquivos do WiseApp contornando CORS  
**Método**: POST  
**Endpoint**: `https://ohmoxsvwjvohmqqgxjhb.supabase.co/functions/v1/proxy-download`

### proxy-wiseapp
**Descrição**: Proxy genérico para chamadas à API do WiseApp  
**Método**: POST/GET  
**Endpoint**: `https://ohmoxsvwjvohmqqgxjhb.supabase.co/functions/v1/proxy-wiseapp`

### group-summary-cron
**Descrição**: Função cron para envio automático de resumos de grupo  
**Método**: POST  
**Endpoint**: `https://ohmoxsvwjvohmqqgxjhb.supabase.co/functions/v1/group-summary-cron`

### manual-summary-trigger
**Descrição**: Dispara manualmente o envio de resumos  
**Método**: POST  
**Endpoint**: `https://ohmoxsvwjvohmqqgxjhb.supabase.co/functions/v1/manual-summary-trigger`

### sync-all-motoristas
**Descrição**: Sincroniza todos os motoristas com WiseApp  
**Método**: POST  
**Endpoint**: `https://ohmoxsvwjvohmqqgxjhb.supabase.co/functions/v1/sync-all-motoristas`

### sync-motoristas-bulk
**Descrição**: Sincroniza motoristas em lote com WiseApp  
**Método**: POST  
**Endpoint**: `https://ohmoxsvwjvohmqqgxjhb.supabase.co/functions/v1/sync-motoristas-bulk`

## Variáveis de Ambiente (Secrets)

Algumas edge functions podem precisar de secrets. Para definir:

```bash
supabase secrets set MY_SECRET_NAME=my_secret_value
```

Para listar secrets configurados:

```bash
supabase secrets list
```

## Troubleshooting

### Erro: "Failed to link project"
- Verifique se o project-ref está correto: `ohmoxsvwjvohmqqgxjhb`
- Certifique-se de estar autenticado: `supabase login`

### Erro: "Permission denied"
- Verifique se sua conta tem permissões no projeto Supabase
- Tente fazer logout e login novamente

### Função não responde
- Verifique os logs: `supabase functions logs nome-da-funcao`
- Teste localmente: `supabase functions serve validate-wiseapp-token`

### CORS errors
- As funções já estão configuradas com CORS headers corretos
- Verifique se está usando o endpoint correto (https://...)

## Testando Localmente

Para testar uma função antes de fazer deploy:

```bash
# Iniciar servidor local de edge functions
supabase functions serve validate-wiseapp-token

# Em outro terminal, testar a função
curl -i --location --request POST 'http://localhost:54321/functions/v1/validate-wiseapp-token' \
  --header 'Content-Type: application/json' \
  --data '{"token":"seu_token_de_teste"}'
```

## Notas Importantes

1. **Custos**: Edge functions têm custos baseados em execuções. Verifique o plano do Supabase.
2. **Rate Limiting**: O Supabase pode ter rate limits. Configure adequadamente.
3. **Timeout**: Edge functions têm timeout padrão. Ajuste se necessário.
4. **Cold Starts**: A primeira execução pode ser mais lenta (cold start).

## Links Úteis

- [Documentação Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)
- [Deno Deploy](https://deno.com/deploy)
