# Instruções de Deploy para Netlify

## Passo a Passo Completo

### 1. Preparação do Repositório

1. **Faça commit de todos os arquivos**:
   ```bash
   git add .
   git commit -m "Adiciona configuração para deploy Netlify"
   git push origin main
   ```

### 2. Configuração no Netlify

1. **Acesse https://netlify.com e faça login**
2. **Clique em "New site from Git"**
3. **Conecte seu repositório** (GitHub/GitLab/Bitbucket)
4. **Configure as seguintes opções**:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist/public`
   - **Functions directory**: `netlify/functions`

### 3. Variáveis de Ambiente

Vá em **Site settings > Environment variables** e adicione:

```
DATABASE_URL=postgresql://user:password@host:port/database
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_CHAT_API_URL=https://your-chat-api.com
VITE_CHAT_ACCOUNT_ID=your-account-id
NODE_ENV=production
```

### 4. Deploy Manual (Alternativa)

Se preferir fazer deploy manual:

1. **Execute o build**:
   ```bash
   npm run build
   ```

2. **Instale Netlify CLI**:
   ```bash
   npm install -g netlify-cli
   ```

3. **Faça login**:
   ```bash
   netlify login
   ```

4. **Deploy**:
   ```bash
   netlify deploy --prod --dir=dist/public --functions=netlify/functions
   ```

### 5. Verificação Pós-Deploy

Após o deploy, teste:

1. **Acesse sua URL do Netlify**
2. **Teste as rotas**:
   - `/` - Página inicial
   - `/contratacao/motoristas` - Lista de motoristas
   - `/contratacao/agregados` - Lista de agregados
   - `/contratacao/contratados` - Lista de contratados

3. **Teste as APIs**:
   - `GET /api/health` - Health check
   - `GET /api/motoristas` - Lista de motoristas
   - `GET /api/agregados` - Lista de agregados
   - `GET /api/clientes` - Lista de clientes

### 6. Monitoramento

- **Logs**: Netlify Dashboard > Functions
- **Analytics**: Netlify Dashboard > Analytics
- **Deploys**: Netlify Dashboard > Deploys

### 7. Domínio Personalizado (Opcional)

1. **Vá em Site settings > Domain management**
2. **Clique em "Add custom domain"**
3. **Configure os DNS records**:
   - Para domínio raiz: A record para `75.2.60.5`
   - Para subdomain: CNAME para `your-site.netlify.app`

### 8. Troubleshooting

#### Build Falha
- Verifique se todas as dependências estão no `package.json`
- Confirme as variáveis de ambiente
- Veja os logs detalhados no Netlify

#### Função não Funciona
- Verifique `netlify/functions/api.js`
- Confirme `DATABASE_URL` nas variáveis de ambiente
- Teste localmente com `netlify dev`

#### Roteamento não Funciona
- Verifique `netlify.toml`
- Confirme `public/_redirects`
- Teste redirecionamentos manualmente

### 9. Arquivos Importantes

- ✅ `netlify.toml` - Configuração principal
- ✅ `netlify/functions/api.js` - Função serverless
- ✅ `netlify/functions/package.json` - Dependências da função
- ✅ `public/_redirects` - Redirecionamentos
- ✅ `build-netlify.js` - Script de build customizado
- ✅ `DEPLOY_NETLIFY.md` - Documentação completa

### 10. Comandos Úteis

```bash
# Testar localmente
netlify dev

# Build local
npm run build

# Deploy preview
netlify deploy --dir=dist/public --functions=netlify/functions

# Deploy produção
netlify deploy --prod --dir=dist/public --functions=netlify/functions

# Ver logs
netlify logs

# Abrir dashboard
netlify open
```

---

## ✅ Checklist Final

- [ ] Repositório atualizado com arquivos de configuração
- [ ] Variáveis de ambiente configuradas no Netlify
- [ ] Build command: `npm run build`
- [ ] Publish directory: `dist/public`
- [ ] Functions directory: `netlify/functions`
- [ ] Deploy realizado com sucesso
- [ ] Aplicação funcionando corretamente
- [ ] APIs respondendo
- [ ] Banco de dados conectado