# 🔧 COMO RECALCULAR KM_RODADO NO SUPABASE - PASSO A PASSO

## ⚠️ IMPORTANTE: Execute isso AGORA no Supabase

### Passo 1: Acesse o Supabase SQL Editor
1. Abra seu projeto no Supabase: https://supabase.com
2. Vá em **SQL Editor** (menu lateral esquerdo)
3. Clique em **+ New query** para criar uma nova consulta

### Passo 2: Copie e Cole o SQL
1. Abra o arquivo: `supabase/recalcular_km_rodado.sql`
2. **Copie TODO o conteúdo** do arquivo
3. **Cole** no editor SQL do Supabase

### Passo 3: Execute o Script
1. Clique no botão **RUN** (ou pressione Ctrl+Enter / Cmd+Enter)
2. Aguarde a execução (pode levar alguns segundos/minutos dependendo da quantidade de dados)
3. Você verá o resultado mostrando quantos registros foram atualizados por empresa

### Passo 4: Verifique os Resultados
A query final mostra os últimos 20 registros atualizados. Confira se os valores de `km_rodado` estão corretos.

## ✅ O Que o Script Faz

1. **Cria uma função SQL** chamada `recompute_km_rodado()`
2. **Recalcula km_rodado** de TODOS os registros de hodômetro
3. **Respeita a configuração** `calculo_um_por_dia` de cada empresa:
   - **TRUE (intra-day)**: km_rodado = última leitura do dia - primeira leitura do dia
   - **FALSE (inter-day)**: km_rodado = leitura atual - última leitura do dia anterior
4. **Trata casos especiais**:
   - Valores negativos são zerados (reset de hodômetro)
   - Diferencia automóveis (hod_lido) de ciclomotores (trip_lida)

## 🔄 Depois de Executar

Após executar o SQL no Supabase:
1. Recarregue a página do aplicativo (F5)
2. Os valores de km_rodado agora estarão corretos
3. A função fica salva no banco para uso futuro

## 📞 Problemas?

Se encontrar algum erro:
- Copie a mensagem de erro
- Me envie para que eu possa ajustar o SQL
