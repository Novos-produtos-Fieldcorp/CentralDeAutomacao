-- =====================================================
-- JPD Transportes — CNPJ, Operação e Data do lançamento nos abastecimentos
-- Rode este SQL no SQL Editor do Supabase (uma única vez).
-- =====================================================

ALTER TABLE public.homedometro_abastecimento_jpd
  ADD COLUMN IF NOT EXISTS cnpj             text,
  ADD COLUMN IF NOT EXISTS operacao         text,
  ADD COLUMN IF NOT EXISTS data_lancamento  date;

CREATE INDEX IF NOT EXISTS homedometro_abastecimento_operacao_idx
  ON public.homedometro_abastecimento_jpd(operacao);

-- =====================================================
-- FIM.
-- =====================================================
