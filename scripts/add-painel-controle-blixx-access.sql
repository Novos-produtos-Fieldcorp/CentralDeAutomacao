-- =====================================================
-- Painel de Controle Blixx — Flag de acesso na tabela company
-- Rode este SQL no SQL Editor do Supabase (idempotente).
-- =====================================================

-- 1) Cria a coluna de acesso (default = false: ninguém vê o módulo até ser liberado)
ALTER TABLE public.company
  ADD COLUMN IF NOT EXISTS painel_controle_blixx_access boolean DEFAULT false;

COMMENT ON COLUMN public.company.painel_controle_blixx_access
  IS 'Access control flag to enable Painel de Controle Blixx module (boolean)';

-- 2) Garante valor não-nulo nas linhas já existentes
UPDATE public.company
  SET painel_controle_blixx_access = false
  WHERE painel_controle_blixx_access IS NULL;

-- 3) Ativar para uma empresa específica — troque <COMPANY_ID> pelo company_id desejado.
-- UPDATE public.company
--   SET painel_controle_blixx_access = true
--   WHERE company_id = <COMPANY_ID>;
