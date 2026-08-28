# 🚀 Como Fazer Deploy da Edge Function no Supabase

## Problema Atual
A validação de token funciona localmente mas retorna **404 em produção** porque a Edge Function ainda não foi deployada no Supabase.

**Erro:**
```
POST https://jnwocajxsgkgiixwyxkl.supabase.co/functions/v1/api/wiseapp/validate-token 404 (Not Found)
```

---

## ✅ Solução: Deploy via CLI (Método Recomendado)

### Passo 1: Login no Supabase
```bash
npx supabase login
```
Isso abrirá seu navegador para autorizar.

### Passo 2: Deploy da Edge Function
```bash
npx supabase functions deploy api --project-ref jnwocajxsgkgiixwyxkl
```

### Passo 3: Verificar Deploy
```bash
npx supabase functions list --project-ref jnwocajxsgkgiixwyxkl
```

Você deve ver a função `api` listada como **deployed**.

### Passo 4: Testar
Acesse: `https://jnwocajxsgkgiixwyxkl.supabase.co/functions/v1/api/health`

Deve retornar:
```json
{
  "status": "OK",
  "timestamp": "2025-10-27...",
  "environment": "supabase-edge",
  "version": "2.0.0"
}
```

---

## 🌐 Alternativa: Deploy via Interface Web do Supabase

Se o método CLI não funcionar, você pode fazer **upload manual** pela interface:

### Passo 1: Acessar Edge Functions no Supabase
1. Vá para: https://supabase.com/dashboard/project/jnwocajxsgkgiixwyxkl
2. Clique em **Edge Functions** no menu lateral
3. Clique em **Create a new function**

### Passo 2: Criar/Atualizar a Função `api`
- **Nome da função**: `api`
- **Código**: Copie TODO o conteúdo do arquivo `supabase/functions/api/index.ts` deste projeto

### Passo 3: Configurar Variáveis de Ambiente
Certifique-se de que estas variáveis estão configuradas:
- `SUPABASE_URL`: https://jnwocajxsgkgiixwyxkl.supabase.co
- `SUPABASE_SERVICE_ROLE_KEY`: (sua chave de service role)

### Passo 4: Deploy
Clique em **Deploy function**

### Passo 5: Verificar
Teste o endpoint de health: `https://jnwocajxsgkgiixwyxkl.supabase.co/functions/v1/api/health`

---

## 🔍 Como Saber se Funcionou

### ✅ Sinais de Sucesso:
1. **Health check responde**: `/functions/v1/api/health` retorna JSON
2. **Não mais 404**: `/functions/v1/api/wiseapp/validate-token` aceita requisições POST
3. **Frontend funciona**: Modal de token WiseApp valida e salva sem erros

### ❌ Sinais de Falha:
1. **404 persiste**: Edge Function não está deployada
2. **500 Internal Error**: Código tem erro ou variáveis de ambiente faltando
3. **CORS error**: Headers CORS não configurados (já está correto no código)

---

## 📝 Estrutura da Edge Function

```
supabase/
└── functions/
    └── api/
        └── index.ts  <-- Este arquivo precisa ser deployado
```

**Importante**: A Edge Function `api` contém TODAS as rotas da API, incluindo:
- `/wiseapp/validate-token` (validação de token)
- `/wiseapp/sync-motoristas` (sincronização)
- `/wiseapp/:companyId/tags` (gerenciamento de tags)
- E muitas outras...

---

## 🐛 Troubleshooting

### Problema: "supabase command not found"
**Solução**: Use `npx supabase` em vez de `supabase`

### Problema: "Project ref not found"
**Solução**: Certifique-se de estar logado com `npx supabase login`

### Problema: "Permission denied"
**Solução**: Verifique se sua conta tem permissão de Owner/Admin no projeto Supabase

### Problema: Deploy bem-sucedido mas ainda 404
**Solução**: 
1. Aguarde 1-2 minutos (propagação)
2. Limpe cache do navegador
3. Faça hard refresh (Ctrl+Shift+R)
4. Verifique se o nome da função é exatamente `api` (case-sensitive)

---

## 🎯 Próximos Passos Após Deploy

1. ✅ Testar validação de token no modal WiseApp
2. ✅ Verificar sincronização de motoristas
3. ✅ Confirmar que tags funcionam corretamente
4. ✅ Fazer um deploy final no Netlify (opcional, se houver mudanças no frontend)

---

**Dúvidas?** Execute o deploy e me avise qualquer erro que aparecer!
