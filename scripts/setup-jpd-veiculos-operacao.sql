-- =====================================================
-- JPD Transportes — Vínculo placa ↔ operação (jpd_veiculos.operacao)
-- Rode este SQL no SQL Editor do Supabase (uma única vez).
--
-- Antes desta coluna, a "operação" de um veículo era apenas derivada dos
-- lançamentos de abastecimento (homedometro_abastecimento_jpd.operacao).
-- Agora passa a existir um vínculo persistido diretamente no veículo,
-- editável na aba Veículos > Resumo por veículo.
-- =====================================================

ALTER TABLE public.jpd_veiculos ADD COLUMN IF NOT EXISTS operacao text;

-- =====================================================
-- FIM. Confira no Table Editor que a coluna "operacao" foi criada em jpd_veiculos.
-- =====================================================
