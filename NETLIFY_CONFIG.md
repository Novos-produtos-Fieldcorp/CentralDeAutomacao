# Configurações Necessárias no Netlify

## Variáveis de Ambiente (Environment Variables)

No painel do Netlify, vá em **Site settings > Environment variables** e adicione:

### Banco de Dados
- `DATABASE_URL` = (sua URL do Supabase completa com senha)

### Função de Chat (se necessário)
- `WISEAPP_API_URL` = `https://chat.wiseapp360.com`

## Build Settings

- **Build command**: `npm run build`
- **Publish directory**: `dist/public`
- **Functions directory**: `netlify/functions`

## Verificação de Logs

Para debugar problemas:

1. Vá em **Functions** no painel do Netlify
2. Clique na função `api`
3. Veja os logs em tempo real
4. Procure pelos logs que adicionamos:
   - "Netlify Function - Raw path"
   - "Netlify Proxy - Full URL"
   - "Netlify Proxy - API Token found"

## Teste da Função

Você pode testar se a função está funcionando acessando:
- `https://seu-site.netlify.app/api/health` (deve retornar status OK)

## Problemas Comuns

1. **Headers de CORS**: Já configurados na função
2. **Content-Type**: Deve retornar `application/json` para rotas da API
3. **Redirects**: Ordem no netlify.toml é importante (mais específicos primeiro)

## Debug

Se as caixas de entrada não aparecem:
1. Abra o Developer Tools (F12)
2. Vá na aba Network
3. Procure pela requisição para `/api/api/v1/accounts/X/inboxes`
4. Verifique se retorna JSON e não HTML