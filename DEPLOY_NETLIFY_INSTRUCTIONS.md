# Deploy no Netlify - Instruções

## Configuração Necessária

### 1. Build Settings
- **Build command**: `npm run build`
- **Publish directory**: `dist/public`
- **Functions directory**: `netlify/functions`

### 2. Environment Variables
Configure no painel do Netlify (copie do arquivo .env):
```
VITE_SUPABASE_URL=https://ohmoxsvwjvohmqqgxjhb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obW94c3Z3anZvaG1xcWd4amhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NzI5MDUsImV4cCI6MjA1MjQ0ODkwNX0.AfDIRYUm98kZaYfi70ut0bzyvX995-Xz609Yp_seijQ
VITE_CHAT_API_URL=https://chat.wiseapp360.com
VITE_CHAT_API_KEY=njMJg35ahX5D4FWPCprXabca
VITE_CHAT_ACCOUNT_ID=123456s
```

### 3. Funcionalidades Suportadas
✅ Autenticação dinâmica por account_id  
✅ Sistema completo de vagas  
✅ Proxy WiseApp/Chatwoot para chat  
✅ Criação inline de unidades, operações e status  
✅ Isolamento de dados por empresa  
✅ Suporte para iframe embedding  

### 4. Rotas da API
- `/api/company/by-account/:accountId` - Buscar empresa por account_id
- `/api/vagas/dashboard/:accountId` - Dashboard de vagas
- `/api/vagas/:accountId` - Listar vagas
- `/api/vagas` - Criar/editar vagas
- `/api/clientes/:accountId` - Listar clientes
- `/api/unidades/:accountId` - Listar unidades
- `/api/operacoes/:accountId` - Listar operações
- `/api/status-vagas/:accountId` - Listar status
- `/api/api/v1/*` - Proxy para WiseApp API

### 5. Teste
Após o deploy, teste com:
- `https://seu-site.netlify.app/?account_id=6`
- `https://seu-site.netlify.app/?account_id=20`
- `https://seu-site.netlify.app/vagas?account_id=1`

Cada account_id carregará os dados da empresa correspondente automaticamente.