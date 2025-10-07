# Deploy das Funções Supabase

## Status Atual
✅ **Função `sync-all-motoristas` criada e pronta para deploy**
✅ **Função `sync-motoristas-bulk` criada e pronta para deploy**
❌ **Funções não estão deployadas no Supabase (causando erro CORS)**

## Solução Temporária
O sistema está configurado para usar o backend Express que já está funcionando, evitando o erro CORS.

## Para Deploy das Funções Supabase

### Opção 1: Via Supabase CLI (Recomendado)

1. **Instalar Supabase CLI**:
   ```bash
   # Windows (PowerShell)
   winget install Supabase.CLI
   
   # Ou via Scoop
   scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
   scoop install supabase
   ```

2. **Login no Supabase**:
   ```bash
   supabase login
   ```

3. **Link do projeto**:
   ```bash
   supabase link --project-ref ohmoxsvwjvohmqqgxjhb
   ```

4. **Deploy das funções**:
   ```bash
   supabase functions deploy sync-all-motoristas
   supabase functions deploy sync-motoristas-bulk
   ```

### Opção 2: Via Dashboard Supabase

1. **Acesse**: https://supabase.com/dashboard/project/ohmoxsvwjvohmqqgxjhb
2. **Vá em**: Edge Functions
3. **Clique em**: "Create a new function"
4. **Configure**:
   - Nome: `sync-all-motoristas`
   - Cole o conteúdo de: `supabase/functions/sync-all-motoristas/index.ts`
5. **Repita para**: `sync-motoristas-bulk`

### Opção 3: Script Automatizado

Execute o script de verificação:
```bash
node deploy-supabase-functions.cjs
```

## Após o Deploy

Quando as funções estiverem deployadas, você pode:

1. **Atualizar para usar Supabase**:
   - Mude `createApiUrl` de `api-config` para `api-config-supabase`
   - URLs mudarão de `/api/wiseapp/sync-all-motoristas` para `/functions/v1/sync-all-motoristas`

2. **Verificar funcionamento**:
   - Teste a sincronização
   - Verifique os logs no Supabase Dashboard

## URLs das Funções

- **sync-all-motoristas**: `https://ohmoxsvwjvohmqqgxjhb.supabase.co/functions/v1/sync-all-motoristas`
- **sync-motoristas-bulk**: `https://ohmoxsvwjvohmqqgxjhb.supabase.co/functions/v1/sync-motoristas-bulk`

## Configuração Atual

O sistema está configurado para usar o backend Express que funciona perfeitamente:
- ✅ Sem erro CORS
- ✅ Sincronização completa
- ✅ Relatórios detalhados
- ✅ Tratamento de erro robusto

## Próximos Passos

1. **Imediato**: Sistema funciona com backend Express
2. **Futuro**: Deploy das funções Supabase quando necessário
3. **Opcional**: Migração gradual para Supabase Functions
