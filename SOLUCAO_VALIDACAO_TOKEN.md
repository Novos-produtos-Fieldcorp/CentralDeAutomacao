# ✅ Solução Completa: Validação de Token WiseApp (CORS)

## 🎯 Problema
Após deploy no Netlify, a validação do token WiseApp retornava erro 404 porque:
- Netlify é hosting estático (SPA)
- Rotas backend `/api/*` não existem no build do Netlify
- Redirect catch-all (`/*` → `/index.html`) captura todas as rotas, incluindo APIs

## 🔧 Solução Implementada

### 1. **Ambiente de Desenvolvimento (Local - Replit)**
- ✅ Rota backend Express: `/api/validate-wiseapp-token`
- ✅ Funciona perfeitamente no ambiente local
- ✅ Backend faz proxy para evitar CORS

### 2. **Ambiente de Produção (Netlify)**
- ✅ Supabase Edge Function criada
- ✅ Endpoint: `https://ohmoxsvwjvohmqqgxjhb.supabase.co/functions/v1/validate-wiseapp-token`
- ✅ Frontend detecta automaticamente o ambiente

## 📁 Arquivos Criados/Modificados

### Novo: Supabase Edge Function
```
supabase/functions/validate-wiseapp-token/index.ts
```

### Modificado: Frontend
```
client/src/components/WiseAppTokenModal.tsx
```
- Agora usa Supabase Edge Function em produção
- Usa rota Express em desenvolvimento

## 🚀 Como Funciona

### Fluxo de Validação:

```
┌──────────────┐
│   Frontend   │
│   (Netlify)  │
└──────┬───────┘
       │
       │ POST { "token": "..." }
       │
       ▼
┌─────────────────────────┐
│  Supabase Edge Function │
│ validate-wiseapp-token  │
└──────────┬──────────────┘
           │
           │ GET /api/v1/profile
           │ Header: api_access_token
           │
           ▼
    ┌──────────────────┐
    │  Chatwoot API    │
    │ (WiseApp360.com) │
    └──────────────────┘
```

### Resposta:
```json
// Token Válido
{
  "valid": true,
  "userData": {
    "name": "Nome do Usuário",
    "email": "email@exemplo.com",
    "id": 123
  }
}

// Token Inválido
{
  "valid": false,
  "error": "Token inválido"
}
```

## ⚙️ Para Fazer o Deploy

### Passo 1: Deploy da Supabase Edge Function

**Opção A - Via CLI (Recomendado):**
```bash
# Instalar Supabase CLI (se ainda não tem)
npm install -g supabase

# Login
supabase login

# Linkar projeto
supabase link --project-ref ohmoxsvwjvohmqqgxjhb

# Deploy
supabase functions deploy validate-wiseapp-token
```

**Opção B - Via Dashboard (Mais Simples):**
1. Acesse: https://supabase.com/dashboard/project/ohmoxsvwjvohmqqgxjhb
2. Edge Functions → Create a new function
3. Nome: `validate-wiseapp-token`
4. Cole o código de `supabase/functions/validate-wiseapp-token/index.ts`
5. Deploy

### Passo 2: Verificar o Deploy

Teste com curl:
```bash
curl -X POST \
  https://ohmoxsvwjvohmqqgxjhb.supabase.co/functions/v1/validate-wiseapp-token \
  -H "Content-Type: application/json" \
  -d '{"token": "SEU_TOKEN_REAL"}'
```

### Passo 3: Deploy no Netlify (Automático)

Se seu repositório está conectado ao Netlify:
- O push para o Git acionará um novo build automaticamente
- ✅ Pronto! O sistema já deve funcionar

Se não está conectado:
- Faça push das alterações para seu repositório
- Ou faça deploy manual: `npm run build` e suba a pasta `dist/public`

## ✅ Checklist de Validação

Após o deploy, verifique:

- [ ] Supabase Edge Function está ativa
  - Dashboard: https://supabase.com/dashboard/project/ohmoxsvwjvohmqqgxjhb/functions
  - Status: "Active"

- [ ] Frontend carrega sem erros
  - Acesse: https://fix-credentials--centralautomacoes.netlify.app
  - Abra DevTools (F12) → Console
  - Não deve ter erros de CORS

- [ ] Validação de token funciona
  - Tente adicionar um token inválido → Deve mostrar "Token inválido"
  - Adicione um token válido → Deve aceitar e salvar

## 🎉 Resultado Esperado

### ✅ Token Válido:
1. Usuário cola o token
2. Frontend chama Supabase Edge Function
3. Edge Function valida com Chatwoot
4. Retorna dados do usuário
5. Sistema salva no banco: `wiseapp_acesso`
6. Modal fecha
7. ✅ Usuário autenticado com sucesso!

### ❌ Token Inválido:
1. Usuário cola token errado
2. Frontend chama Supabase Edge Function
3. Edge Function valida com Chatwoot
4. Chatwoot retorna 401 (Unauthorized)
5. Frontend mostra: "Token inválido. Por favor, verifique..."
6. Usuário pode tentar novamente

## 🐛 Troubleshooting

### Erro: "404 Not Found" em produção
**Causa**: Supabase Edge Function não foi deployada
**Solução**: Siga o Passo 1 acima para fazer deploy

### Erro: CORS mesmo após deploy
**Causa**: Edge Function não tem CORS configurado
**Solução**: A função já está configurada com CORS. Verifique se fez deploy corretamente.

### Erro: "Network request failed"
**Causa**: URL da Supabase está incorreta
**Solução**: Verifique se `VITE_SUPABASE_URL` está configurada corretamente no Netlify:
- URL: `https://ohmoxsvwjvohmqqgxjhb.supabase.co`

### Para ver logs da função:
```bash
supabase functions logs validate-wiseapp-token
```

Ou no Dashboard → Edge Functions → validate-wiseapp-token → Logs Tab

## 📝 Observações Importantes

1. **Sem necessidade de mudanças no Netlify**: 
   - Não precisa configurar serverless functions no Netlify
   - Tudo é resolvido via Supabase Edge Functions

2. **Funciona em ambos os ambientes**:
   - ✅ Desenvolvimento (Replit): usa rota Express
   - ✅ Produção (Netlify): usa Supabase Edge Function

3. **Segurança**:
   - Token nunca é exposto no frontend
   - Validação acontece servidor-para-servidor
   - CORS configurado corretamente

4. **Performance**:
   - Edge Functions rodam globalmente (próximo ao usuário)
   - Latência baixa
   - Escalável automaticamente

## 📚 Documentação Relacionada

- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase CLI](https://github.com/supabase/cli)
- [Netlify SPA Redirects](https://docs.netlify.com/routing/redirects/rewrites-proxies/)
- [Chatwoot API](https://www.chatwoot.com/docs/product/channels/api/client-apis)
