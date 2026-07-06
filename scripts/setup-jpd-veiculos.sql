-- =====================================================
-- JPD Transportes — Tabela mestra de veículos (jpd_veiculos)
-- Rode este SQL no SQL Editor do Supabase (uma única vez).
--
-- Regra: placas sempre em MINÚSCULAS e ÚNICAS (evita duplicar por
-- diferença de caixa). jpd_fretes.placa_do_carro e
-- homedometro_abastecimento_jpd.placa passam a referenciar esta tabela.
-- =====================================================

-- 1) Tabela mestra
CREATE TABLE IF NOT EXISTS public.jpd_veiculos (
  id         serial PRIMARY KEY,
  placa      text NOT NULL UNIQUE,
  created_at timestamp DEFAULT now()
);

-- 2) Normaliza as placas já existentes para minúsculas (para casar com a FK)
UPDATE public.jpd_fretes
  SET placa_do_carro = lower(trim(placa_do_carro))
  WHERE placa_do_carro IS NOT NULL AND placa_do_carro <> lower(trim(placa_do_carro));

UPDATE public.homedometro_abastecimento_jpd
  SET placa = lower(trim(placa))
  WHERE placa IS NOT NULL AND placa <> lower(trim(placa));

-- 3) Seed: registra todas as placas já usadas em fretes e abastecimentos
INSERT INTO public.jpd_veiculos (placa)
SELECT DISTINCT lower(trim(placa_do_carro))
  FROM public.jpd_fretes
  WHERE placa_do_carro IS NOT NULL AND trim(placa_do_carro) <> ''
ON CONFLICT (placa) DO NOTHING;

INSERT INTO public.jpd_veiculos (placa)
SELECT DISTINCT lower(trim(placa))
  FROM public.homedometro_abastecimento_jpd
  WHERE placa IS NOT NULL AND trim(placa) <> ''
ON CONFLICT (placa) DO NOTHING;

-- 4) Chaves estrangeiras reais (idempotente). ON UPDATE CASCADE propaga
--    renomeações de placa para as tabelas filhas.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jpd_fretes_placa_fk') THEN
    ALTER TABLE public.jpd_fretes
      ADD CONSTRAINT jpd_fretes_placa_fk
      FOREIGN KEY (placa_do_carro) REFERENCES public.jpd_veiculos(placa)
      ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'homedometro_abast_placa_fk') THEN
    ALTER TABLE public.homedometro_abastecimento_jpd
      ADD CONSTRAINT homedometro_abast_placa_fk
      FOREIGN KEY (placa) REFERENCES public.jpd_veiculos(placa)
      ON UPDATE CASCADE;
  END IF;
END $$;

-- 5) Acesso via Netlify Function com service role (RLS desligada)
ALTER TABLE public.jpd_veiculos DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- FIM. Confira no Table Editor que a tabela jpd_veiculos foi criada
-- e que as placas foram normalizadas.
-- =====================================================
