-- =====================================================
-- JPD Transportes — Abastecimento + ajustes no Boletim de Viagem
-- Rode este SQL no SQL Editor do Supabase (uma única vez).
-- =====================================================

-- 1) Novos campos de custo no boletim de viagem (jpd_fretes)
ALTER TABLE public.jpd_fretes
  ADD COLUMN IF NOT EXISTS fornecedor      text,
  ADD COLUMN IF NOT EXISTS combustivel     text,
  ADD COLUMN IF NOT EXISTS litros          numeric,
  ADD COLUMN IF NOT EXISTS valor_unitario  numeric,
  ADD COLUMN IF NOT EXISTS valor_bruto     numeric,
  ADD COLUMN IF NOT EXISTS desconto        numeric,
  ADD COLUMN IF NOT EXISTS arla            numeric;

-- 2) Remover dependência de company_id e document_id
--    (os dados deixam de ser separados por empresa)
ALTER TABLE public.jpd_fretes DROP COLUMN IF EXISTS company_id;
ALTER TABLE public.jpd_fretes DROP COLUMN IF EXISTS document_id;

-- 3) Nova tabela de lançamentos de abastecimento
CREATE TABLE IF NOT EXISTS public.homedometro_abastecimento_jpd (
  id              serial PRIMARY KEY,
  hodometro       numeric,
  placa           text,            -- liga a veiculo.placa
  fornecedor      text,
  combustivel     text,
  litros          numeric,
  valor_unitario  numeric,
  valor_bruto     numeric,
  desconto        numeric,
  arla            numeric,
  frete_id        integer REFERENCES public.jpd_fretes(id), -- BV vinculado (null = não vinculado)
  created_at      timestamp DEFAULT now(),
  updated_at      timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS homedometro_abastecimento_placa_idx
  ON public.homedometro_abastecimento_jpd(placa);
CREATE INDEX IF NOT EXISTS homedometro_abastecimento_frete_idx
  ON public.homedometro_abastecimento_jpd(frete_id);

-- Acesso via Netlify Function com service role
ALTER TABLE public.homedometro_abastecimento_jpd DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- FIM.
-- =====================================================
