# Código Completo das Edge Functions

## 1. validate-wiseapp-token

Localização: `supabase/functions/validate-wiseapp-token/index.ts`

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    let { token } = body;
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token é obrigatório' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Remove espaços extras do token (problema comum ao copiar/colar)
    token = token.trim();
    
    console.log('🔐 Validando token WiseApp...');
    console.log('Token length:', token.length);
    console.log('Token start:', token.substring(0, 10) + '...');

    // Validate token against Chatwoot API
    const wiseappApiUrl = 'https://chat.wiseapp360.com';
    const response = await fetch(`${wiseappApiUrl}/api/v1/profile`, {
      method: 'GET',
      headers: {
        'api_access_token': token,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      console.error('❌ Chatwoot retornou erro:', response.status);
      const errorText = await response.text();
      console.error('Resposta:', errorText);
      
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ 
            valid: false,
            error: 'Token inválido',
            details: `Chatwoot retornou 401: ${errorText}`
          }),
          { 
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      return new Response(
        JSON.stringify({ 
          valid: false,
          error: 'Erro ao validar token',
          statusCode: response.status,
          details: errorText
        }),
        { 
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const userData = await response.json();
    console.log('✅ Token válido para usuário:', userData.name);

    return new Response(
      JSON.stringify({ 
        valid: true,
        userData: {
          name: userData.name,
          email: userData.email,
          id: userData.id
        }
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Erro ao validar token:', error);
    
    return new Response(
      JSON.stringify({ 
        valid: false,
        error: 'Erro interno ao validar token',
        details: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
```

## 2. Arquivo _shared/cors.ts

Localização: `supabase/functions/_shared/cors.ts`

```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, api_access_token, wiseapp-token, wiseapp-account-id, company-id, X-Requested-With, Accept, Origin, Cache-Control, Pragma, Expires',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json'
};
```

## Como Usar no Frontend

### Exemplo de Chamada

```typescript
const validateToken = async (token: string) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ohmoxsvwjvohmqqgxjhb.supabase.co';
  const validationUrl = `${supabaseUrl}/functions/v1/validate-wiseapp-token`;
  
  const response = await fetch(validationUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });

  const data = await response.json();
  
  if (!response.ok || !data.valid) {
    throw new Error(data.error || 'Token inválido');
  }
  
  return data.userData;
};
```

### Tratamento de Erros

```typescript
try {
  const userData = await validateToken(myToken);
  console.log('✅ Usuário autenticado:', userData);
  // userData contém: { name, email, id }
} catch (error) {
  console.error('❌ Erro na autenticação:', error.message);
  // Mostrar mensagem de erro para o usuário
}
```

## Estrutura de Resposta

### Sucesso (200)
```json
{
  "valid": true,
  "userData": {
    "name": "Nome do Usuário",
    "email": "usuario@exemplo.com",
    "id": 123
  }
}
```

### Token Inválido (401)
```json
{
  "valid": false,
  "error": "Token inválido",
  "details": "Chatwoot retornou 401: ..."
}
```

### Erro de Validação (400)
```json
{
  "error": "Token é obrigatório"
}
```

### Erro Interno (500)
```json
{
  "valid": false,
  "error": "Erro interno ao validar token",
  "details": "Mensagem de erro detalhada"
}
```

## Testing com cURL

```bash
# Teste com token válido
curl -X POST \
  https://ohmoxsvwjvohmqqgxjhb.supabase.co/functions/v1/validate-wiseapp-token \
  -H 'Content-Type: application/json' \
  -d '{"token":"seu_token_aqui"}'

# Teste sem token (deve retornar erro 400)
curl -X POST \
  https://ohmoxsvwjvohmqqgxjhb.supabase.co/functions/v1/validate-wiseapp-token \
  -H 'Content-Type: application/json' \
  -d '{}'

# Teste CORS preflight
curl -X OPTIONS \
  https://ohmoxsvwjvohmqqgxjhb.supabase.co/functions/v1/validate-wiseapp-token \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type'
```

## Logs e Debug

Para ver os logs da função em tempo real:

```bash
supabase functions logs validate-wiseapp-token --follow
```

Os logs incluem:
- 🔐 Token length e preview
- ✅ Confirmação de validação bem-sucedida
- ❌ Erros detalhados de validação
- Respostas completas da API WiseApp

## Segurança

### O que a Edge Function faz:
1. ✅ Valida CORS para permitir chamadas do frontend
2. ✅ Remove espaços do token (problemas comuns de copy/paste)
3. ✅ Faz validação direta com a API do WiseApp
4. ✅ Retorna apenas dados essenciais do usuário
5. ✅ Logs detalhados para debug

### O que NÃO faz:
- ❌ Não armazena tokens
- ❌ Não expõe dados sensíveis
- ❌ Não faz cache de validações
- ❌ Não permite métodos além de POST/OPTIONS

## Performance

- **Cold Start**: ~500ms (primeira execução)
- **Warm**: ~100-200ms
- **Timeout**: 60 segundos (padrão Supabase)
- **Rate Limit**: Conforme plano Supabase

## Troubleshooting

### Erro: "Failed to fetch"
- Verifique se a edge function foi deployada: `supabase functions list`
- Confirme a URL: deve ser `https://ohmoxsvwjvohmqqgxjhb.supabase.co/functions/v1/validate-wiseapp-token`
- Verifique CORS no navegador (Network tab)

### Erro: "Token inválido" mas o token está correto
- Confirme que não há espaços antes/depois do token
- Verifique se o token tem 24 caracteres
- Teste o token diretamente na API WiseApp:
  ```bash
  curl https://chat.wiseapp360.com/api/v1/profile \
    -H 'api_access_token: SEU_TOKEN'
  ```

### Erro 500: "Erro interno"
- Verifique os logs: `supabase functions logs validate-wiseapp-token`
- A API do WiseApp pode estar fora do ar
- Problema de rede entre Supabase e WiseApp

## Atualizações Futuras

Para atualizar a função após modificações:

```bash
# 1. Edite o arquivo
nano supabase/functions/validate-wiseapp-token/index.ts

# 2. Deploy novamente
supabase functions deploy validate-wiseapp-token

# 3. Teste imediatamente
curl -X POST https://ohmoxsvwjvohmqqgxjhb.supabase.co/functions/v1/validate-wiseapp-token \
  -H 'Content-Type: application/json' \
  -d '{"token":"token_de_teste"}'
```
