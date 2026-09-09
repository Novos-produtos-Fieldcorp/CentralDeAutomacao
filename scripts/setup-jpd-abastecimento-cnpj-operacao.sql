-- =====================================================
-- JPD Transportes — CNPJ e Operação nos lançamentos de abastecimento
-- Rode este SQL no SQL Editor do Supabase (uma única vez).
-- =====================================================

ALTER TABLE public.homedometro_abastecimento_jpd
  ADD COLUMN IF NOT EXISTS cnpj      text,
  ADD COLUMN IF NOT EXISTS operacao  text;

CREATE INDEX IF NOT EXISTS homedometro_abastecimento_operacao_idx
  ON public.homedometro_abastecimento_jpd(operacao);

-- =====================================================
-- FIM.
-- =====================================================
