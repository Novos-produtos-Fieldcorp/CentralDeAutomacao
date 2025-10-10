# Sincronização de Contatos com WiseApp

Este documento explica como implementar e usar a sincronização de contatos com o WiseApp, seguindo a mesma lógica de token já existente para motoristas.

## Lógica de Token

A sincronização de contatos segue exatamente a mesma lógica de token da sincronização de motoristas:

### 1. Busca do Token
```typescript
// Busca token na tabela wiseapp_acesso
const { data: tokenDataArray, error: tokenError } = await supabase
  .from('wiseapp_acesso')
  .select('access_token_wiseapp, email, nome')
  .eq('company_id', companyId)
  .limit(1);
```

### 2. Validação do Token
```typescript
if (!token) {
  return new Response(JSON.stringify({ 
    error: "Token WiseApp não configurado para esta empresa",
    message: "Configure um token WiseApp válido antes de sincronizar contatos"
  }), { status: 401 });
}
```

### 3. Busca do Account ID
```typescript
// Busca account ID da empresa
const { data: companies, error: companyError } = await supabase
  .from("company")
  .select("id_conta_wiseapp")
  .eq("company_id", parseInt(companyId))
  .limit(1);
```

### 4. Uso do Token nas Chamadas
```typescript
// Todas as chamadas para WiseApp usam o token no header
const response = await fetch(wiseAppUrl, {
  headers: {
    'api_access_token': token,
    'Content-Type': 'application/json'
  }
});
```

## Endpoints Implementados

### Backend (Supabase Edge Function)
- **POST** `/api/wiseapp/sync-all-contacts` - Sincroniza todos os contatos

### Frontend (Hooks e Componentes)
- `useWiseAppContactsSync` - Hook para sincronização
- `WiseAppContactsSyncButton` - Componente de botão
- `WiseAppContactsSyncStatus` - Status de sincronização
- `WiseAppContactsBulkSyncPanel` - Painel de sincronização em lote

## Como Usar

### 1. Hook de Sincronização
```typescript
import { useWiseAppContactsSync } from '@/hooks/useWiseAppContactsSync';

function MyComponent() {
  const { 
    syncContato, 
    syncAllContatos, 
    isSyncing, 
    isBulkSyncing 
  } = useWiseAppContactsSync();

  const handleSync = async () => {
    await syncAllContatos();
  };

  return (
    <button onClick={handleSync} disabled={isBulkSyncing}>
      {isBulkSyncing ? 'Sincronizando...' : 'Sincronizar Contatos'}
    </button>
  );
}
```

### 2. Componente de Botão
```typescript
import { WiseAppContactsSyncButton } from '@/components/WiseAppContactsSyncButton';

function ContactsList() {
  return (
    <div>
      {/* Sincronização individual */}
      <WiseAppContactsSyncButton 
        contatoId={123} 
        variant="individual" 
      />
      
      {/* Sincronização em lote */}
      <WiseAppContactsSyncButton 
        variant="bulk" 
        size="lg" 
      />
    </div>
  );
}
```

### 3. Status de Sincronização
```typescript
import { WiseAppContactsSyncStatus } from '@/components/WiseAppContactsSyncButton';

function ContactItem({ contato }) {
  return (
    <div>
      <span>{contato.nome}</span>
      <WiseAppContactsSyncStatus 
        contatoId={contato.id} 
        syncStatus="success" 
        lastSyncAt={contato.lastSyncAt}
      />
    </div>
  );
}
```

## Fluxo de Sincronização

1. **Validação**: Verifica se token WiseApp está configurado
2. **Busca de Dados**: Obtém todos os contatos ativos com telefone
3. **Processamento**: Para cada contato:
   - Busca se já existe no WiseApp
   - Se existe: atualiza foto se necessário
   - Se não existe: cria novo contato
4. **Resultado**: Retorna estatísticas de sucesso/falha

## Estrutura de Dados

### Tabela `contato`
```sql
- contato_id (PK)
- nome
- telefone
- foto_whatsapp
- company_id
- ativo
```

### Tabela `wiseapp_acesso`
```sql
- company_id (FK)
- access_token_wiseapp
- email
- nome
```

### Tabela `company`
```sql
- company_id (PK)
- id_conta_wiseapp
```

## Tratamento de Erros

- **Token não configurado**: Retorna erro 401
- **Account ID não configurado**: Retorna erro 400
- **Contatos sem telefone**: Ignorados (não processados)
- **Falhas na API WiseApp**: Registradas nos erros
- **Serviço indisponível**: Notificação específica

## Notificações

O sistema exibe notificações toast para:
- ✅ Sucesso na sincronização
- ❌ Falhas individuais
- ⚠️ Serviço WiseApp indisponível
- ℹ️ Nenhum contato para sincronizar

## Exemplo Completo

Veja o arquivo `WiseAppContactsSyncExample.tsx` para um exemplo completo de uso de todos os componentes.
