# Solução para Acesso a Inboxes no Netlify

## Problema Identificado
No Netlify, as rotas de inbox do ChatWoot estavam sendo bloqueadas porque a função serverless `api.mjs` estava fazendo proxy direto para o WiseApp sem implementar a validação de tokens e company_id que existe no backend local.

## Solução Implementada

### 1. Rota Específica para Inboxes
Implementada rota específica `/chatwoot/inboxes/:companyId` no arquivo `netlify/functions/api.mjs` que:
- Busca o token WiseApp correto da tabela `wiseapp_acesso` usando o `company_id`
- Valida se o `account_id` corresponde à empresa especificada
- Faz a requisição autenticada para o ChatWoot com o token correto
- Inclui tratamento de erros específicos (401, 403, 404)
- Adiciona metadata de cache às respostas

### 2. Rota para Tokens WiseApp
Adicionada rota `/wiseapp-token/:companyId` para buscar tokens específicos por empresa.

### 3. Segurança e Validação
- Validação de `company_id` e `account_id` antes de fazer requisições
- Busca de tokens específicos da empresa na base de dados
- Tratamento de erros detalhado para diferentes cenários
- Headers de autenticação corretos (`api_access_token`)

## Como Usar
1. As rotas agora funcionam corretamente no Netlify
2. Cada empresa acessa apenas seus próprios inboxes
3. Tokens são buscados automaticamente da base de dados
4. Cache implementado para melhor performance

## Arquivos Modificados
- `netlify/functions/api.mjs` - Implementação das rotas específicas
- Mantida compatibilidade com proxy WiseApp para outras rotas

## Próximos Passos
Após deploy no Netlify, as caixas de entrada do chat funcionarão corretamente com filtros por empresa e autenticação adequada.