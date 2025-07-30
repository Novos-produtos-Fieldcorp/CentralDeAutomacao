# Deploy no Netlify - Instruções

## Configuração Necessária

### 1. Build Settings
- **Build command**: `npm run build`
- **Publish directory**: `dist/public`
- **Functions directory**: `netlify/functions`
- **Node.js version**: 18.x (configure no painel do Netlify)

### 2. Environment Variables
Configure no painel do Netlify (copie do arquivo .env):
```
VITE_SUPABASE_URL=https://ohmoxsvwjvohmqqgxjhb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obW94c3Z3anZvaG1xcWd4amhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY4NzI5MDUsImV4cCI6MjA1MjQ0ODkwNX0.AfDIRYUm98kZaYfi70ut0bzyvX995-Xz609Yp_seijQ
VITE_CHAT_API_URL=https://chat.wiseapp360.com
VITE_CHAT_API_KEY=njMJg35ahX5D4FWPCprXabca
VITE_CHAT_ACCOUNT_ID=123456s
```

### 3. Correções Aplicadas para Deploy
✅ Função convertida para ES Modules (.mjs)  
✅ Versão simplificada da função para evitar erros de bundling  
✅ Node.js 18.x especificado (.nvmrc + netlify.toml)  
✅ Package.json específico para funções  
✅ Corrigido problema de tipo de dados (removido parseInt)  
✅ Adicionados logs de debug para troubleshooting  
✅ Tratamento de erro melhorado para consultas vazias  
✅ **IMPORTANTE**: Sistema de detecção automática de ambiente  
✅ Frontend agora usa URLs dinâmicas (/.netlify/functions/api no Netlify)  

### 4. Funcionalidades Suportadas
✅ Autenticação dinâmica por account_id  
✅ Sistema completo de vagas  
✅ Proxy WiseApp/Chatwoot para chat  
✅ Criação inline de unidades, operações e status  
✅ Isolamento de dados por empresa  
✅ Suporte para iframe embedding  

### 5. Rotas da API
- `/api/company/by-account/:accountId` - Buscar empresa por account_id
- `/api/vagas/dashboard/:accountId` - Dashboard de vagas
- `/api/vagas/:accountId` - Listar vagas
- `/api/vagas` - Criar/editar vagas
- `/api/clientes/:accountId` - Listar clientes
- `/api/unidades/:accountId` - Listar unidades
- `/api/operacoes/:accountId` - Listar operações
- `/api/status-vagas/:accountId` - Listar status
- `/api/api/v1/*` - Proxy para WiseApp API

### 6. Configurações Adicionais no Netlify
**IMPORTANTE**: Configure manualmente no painel do Netlify:

#### Site Settings > Build & Deploy > Environment
- **Node.js version**: 18.x (selecione nas opções)
- **Package directory**: Deixe vazio

#### Site Settings > Functions
- **Functions directory**: `netlify/functions` (deve aparecer automaticamente)

#### Teste de Função
Após o deploy, teste se as funções estão funcionando:
- `https://seu-site.netlify.app/.netlify/functions/test`

### 7. Debugging
Se ainda houver erros, verifique os logs das funções no painel do Netlify:
- Site Settings > Functions > Function logs
- Procure por mensagens "Looking for company with account_id" e "Supabase query result"

### 8. Teste
Após o deploy, teste com:
- `https://seu-site.netlify.app/?account_id=6`
- `https://seu-site.netlify.app/?account_id=20`
- `https://seu-site.netlify.app/vagas?account_id=1`

### 9. Verificação de Dados
Os account_ids válidos no banco são:
- account_id=6 → Fox-e (company_id=1)
- account_id=20 → Entrega já (company_id=5)

Cada account_id carregará os dados da empresa correspondente automaticamente.