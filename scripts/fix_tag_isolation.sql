-- Script para corrigir o isolamento de tags por conta WiseApp
-- Execute este script no SQL Editor do Supabase

-- PASSO 1: Adicionar a coluna id_conta_wiseapp (se não existir)
ALTER TABLE tag ADD COLUMN IF NOT EXISTS id_conta_wiseapp VARCHAR(50);

-- PASSO 2: Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_tag_wiseapp_account ON tag(company_id, id_conta_wiseapp);

-- PASSO 3: Verificar quantas tags existem por empresa
SELECT company_id, COUNT(*) as total_tags 
FROM tag 
GROUP BY company_id 
ORDER BY company_id;

-- PASSO 4: Ver as tags que serão mantidas (accountId 6 = fieldcorp)
-- Descomente e ajuste conforme necessário:
-- SELECT * FROM tag WHERE company_id = 2 ORDER BY created_at DESC LIMIT 50;

-- PASSO 5: OPÇÃO A - Atualizar todas as tags existentes para a conta 6
-- Use isso se todas as tags atuais pertencem à sua conta (fieldcorp)
-- UPDATE tag SET id_conta_wiseapp = '6' WHERE company_id = 2 AND id_conta_wiseapp IS NULL;

-- PASSO 5: OPÇÃO B - Deletar TODAS as tags e sincronizar novamente
-- Use isso para começar do zero (recomendado se as tags estão muito misturadas)
-- DELETE FROM tag WHERE company_id = 2;

-- Após executar, faça uma nova sincronização no sistema para importar
-- apenas as tags da sua conta WiseApp (accountId 6)
