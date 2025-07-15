# Deploy no Netlify

## Pré-requisitos

1. Conta no Netlify (https://netlify.com)
2. Repositório do projeto no GitHub/GitLab/Bitbucket
3. Variáveis de ambiente configuradas

## Configuração das Variáveis de Ambiente

No painel do Netlify, vá em **Site Settings > Environment Variables** e adicione:

```
DATABASE_URL=sua_url_do_banco_postgresql
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
VITE_CHAT_API_URL=sua_url_da_api_de_chat
VITE_CHAT_ACCOUNT_ID=seu_id_da_conta_de_chat
NODE_ENV=production
```

## Configuração de Build

O projeto já está configurado com:
- **Build Command**: `npm run build`
- **Publish Directory**: `dist/public`
- **Functions Directory**: `netlify/functions`

## Estrutura de Arquivos

```
netlify.toml              # Configuração principal do Netlify
netlify/functions/api.js  # Função serverless para API
public/_redirects         # Redirecionamentos de rotas
```

## Passos para Deploy

1. **Conectar repositório**:
   - Acesse o painel do Netlify
   - Clique em "New site from Git"
   - Selecione seu repositório

2. **Configurar build**:
   - Build command: `npm run build`
   - Publish directory: `dist/public`
   - Functions directory: `netlify/functions`

3. **Adicionar variáveis de ambiente**:
   - Vá em Site Settings > Environment Variables
   - Adicione todas as variáveis listadas acima

4. **Deploy**:
   - Clique em "Deploy site"
   - Aguarde o build completar

## Funcionalidades Serverless

O projeto utiliza Netlify Functions para:
- Conexão com banco de dados PostgreSQL
- APIs RESTful
- Autenticação e autorização
- Integração com Supabase

## Monitoramento

- **Logs**: Disponíveis no painel do Netlify
- **Analytics**: Métricas de uso e performance
- **Error Tracking**: Monitoramento de erros em tempo real

## Domínio Personalizado

Para usar um domínio personalizado:
1. Vá em Site Settings > Domain Management
2. Adicione seu domínio
3. Configure os DNS records conforme instruções

## Troubleshooting

### Erro de Build
- Verifique se todas as dependências estão instaladas
- Confirme as variáveis de ambiente
- Veja os logs de build no painel

### Erro de Função
- Verifique a sintaxe em `netlify/functions/api.js`
- Confirme a configuração do banco de dados
- Teste localmente com `netlify dev`

### Erro de Roteamento
- Verifique o arquivo `_redirects`
- Confirme a configuração no `netlify.toml`