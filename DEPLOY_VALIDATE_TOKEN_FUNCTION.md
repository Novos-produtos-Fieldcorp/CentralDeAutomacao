# Deploy da Função de Validação de Token WiseApp

## 🎯 Objetivo
Deploy da Supabase Edge Function que valida tokens WiseApp para resolver o problema de CORS no Netlify.

## 📦 Função Criada
- **Localização**: `supabase/functions/validate-wiseapp-token/index.ts`
- **Endpoint**: `https://ohmoxsvwjvohmqqgxjhb.supabase.co/functions/v1/validate-wiseapp-token`
- **Método**: POST
- **Corpo**: `{ "token": "seu_token_aqui" }`

## 🚀 Como Fazer o Deploy

### Opção 1: Via Supabase CLI (Recomendado)

```bash
# 1. Se ainda não tem o Supabase CLI instalado:
npm install -g supabase

# 2. Fazer login no Supabase
supabase login

# 3. Linkar o projeto
supabase link --project-ref ohmoxsvwjvohmqqgxjhb

# 4. Deploy apenas da função validate-wiseapp-token
supabase functions deploy validate-wiseapp-token

# Ou fazer deploy de todas as funções
supabase functions deploy
```

### Opção 2: Via Dashboard do Supabase (Mais Simples)

1. Acesse o Dashboard do Supabase:
   - URL: https://supabase.com/dashboard/project/ohmoxsvwjvohmqqgxjhb
   
2. Vá para **Edge Functions** no menu lateral

3. Clique em **"Create a new function"** ou **"Deploy a new function"**

4. Configure:
   - **Nome**: `validate-wiseapp-token`
   - **Método**: Copiar o código do arquivo `supabase/functions/validate-wiseapp-token/index.ts`

5. Clique em **Deploy**

6. Aguarde alguns segundos para a função ficar ativa

## ✅ Como Testar

Após o deploy, você pode testar com:

```bash
curl -X POST \
  https://ohmoxsvwjvohmqqgxjhb.supabase.co/functions/v1/validate-wiseapp-token \
  -H "Content-Type: application/json" \
  -d '{"token": "SEU_TOKEN_WISEAPP_AQUI"}'
```

Resposta esperada para token válido:
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

Resposta esperada para token inválido:
```json
{
  "valid": false,
  "error": "Token inválido"
}
```

## 🔍 Verificar se a Função Está Ativa

1. Acesse: https://supabase.com/dashboard/project/ohmoxsvwjvohmqqgxjhb/functions
2. Procure por `validate-wiseapp-token`
3. Status deve estar como **"Active"**

## 🎉 Após o Deploy

1. Faça um novo deploy no Netlify (pode ser automático se conectado ao Git)
2. Acesse seu site no Netlify
3. Tente adicionar/validar um token WiseApp
4. O erro de CORS não deve mais aparecer!

## 📝 Observações

- A função já está configurada com CORS apropriado
- Não é necessário configurar nada no Netlify
- A validação acontece: Frontend → Supabase Edge Function → Chatwoot API
- Sem CORS porque Supabase Edge Function faz a requisição servidor-para-servidor

## 🐛 Troubleshooting

### Se aparecer erro 404:
- Verifique se a função foi deployada corretamente
- Confirme que está usando a URL correta: `https://ohmoxsvwjvohmqqgxjhb.supabase.co/functions/v1/validate-wiseapp-token`

### Se aparecer erro de autenticação:
- Verifique se o token WiseApp é válido
- Teste o token diretamente na API do Chatwoot

### Para ver logs da função:
```bash
supabase functions logs validate-wiseapp-token
```

Ou acesse o Dashboard → Edge Functions → validate-wiseapp-token → Logs
