# 🚀 Quick Start - Edge Functions

Guia rápido para fazer deploy das Edge Functions do Supabase.

## ⚡ Deploy Rápido (3 passos)

### 1. Instalar Supabase CLI
```bash
npm install -g supabase
```

### 2. Fazer Login
```bash
supabase login
```

### 3. Deploy
```bash
# Opção A: Usar o script automático (recomendado)
./deploy-edge-functions.sh all

# Opção B: Deploy manual
supabase link --project-ref jnwocajxsgkgiixwyxkl
supabase functions deploy validate-wiseapp-token
```

## ✅ Verificar se Funcionou

Teste a função com curl:

```bash
curl -X POST \
  https://jnwocajxsgkgiixwyxkl.supabase.co/functions/v1/validate-wiseapp-token \
  -H 'Content-Type: application/json' \
  -d '{"token":"GfvESPVDsmgQEjsZa3NGPuDa"}'
```

Resposta esperada:
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

## 📋 Comandos do Script

```bash
# Listar funções disponíveis
./deploy-edge-functions.sh list

# Deploy de todas as funções
./deploy-edge-functions.sh all

# Deploy de uma função específica
./deploy-edge-functions.sh validate-wiseapp-token

# Ver logs de uma função
./deploy-edge-functions.sh logs validate-wiseapp-token

# Testar uma função
./deploy-edge-functions.sh test validate-wiseapp-token
```

## 🔍 Troubleshooting

### Erro: "Supabase CLI não encontrado"
```bash
npm install -g supabase
```

### Erro: "Não autenticado"
```bash
supabase login
```

### Erro: "Permission denied"
```bash
chmod +x deploy-edge-functions.sh
```

### Edge function não responde
```bash
# Ver logs
supabase functions logs validate-wiseapp-token

# Redeploy
./deploy-edge-functions.sh validate-wiseapp-token
```

## 📚 Documentação Completa

- `DEPLOY_EDGE_FUNCTIONS.md` - Guia completo de deploy
- `EDGE_FUNCTIONS_CODE.md` - Código-fonte e exemplos
- `supabase/functions/` - Código das edge functions

## 🎯 Próximos Passos

Após o deploy bem-sucedido:

1. ✅ A autenticação WiseApp funcionará automaticamente
2. ✅ Não precisa mais validar tokens manualmente
3. ✅ Sistema pronto para produção

## 💡 Dicas

- Use `./deploy-edge-functions.sh all` para atualizar tudo de uma vez
- Sempre verifique os logs após deploy: `./deploy-edge-functions.sh logs nome-da-funcao`
- Teste localmente antes do deploy: `supabase functions serve validate-wiseapp-token`

## 🆘 Precisa de Ajuda?

Consulte a documentação completa em:
- `DEPLOY_EDGE_FUNCTIONS.md`
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
