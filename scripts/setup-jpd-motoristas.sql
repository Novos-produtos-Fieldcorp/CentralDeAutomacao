-- =====================================================
-- JPD Transportes — Tabela mestra de motoristas (motoristas_jpd)
-- Rode este SQL no SQL Editor do Supabase (uma única vez).
--
-- Regra: nomes sempre em MINÚSCULAS e ÚNICOS (evita duplicar por
-- diferença de caixa). O frontend capitaliza para exibição.
-- jpd_fretes.motorista passa a referenciar esta tabela.
-- =====================================================

-- 1) Tabela mestra
CREATE TABLE IF NOT EXISTS public.motoristas_jpd (
  id         serial PRIMARY KEY,
  nome       text NOT NULL UNIQUE,
  created_at timestamp DEFAULT now()
);

-- 2) Normaliza os nomes já existentes para minúsculas (para casar com a FK)
UPDATE public.jpd_fretes
  SET motorista = lower(trim(motorista))
  WHERE motorista IS NOT NULL AND motorista <> lower(trim(motorista));

-- 3) Seed: registra todos os motoristas já usados nos fretes
INSERT INTO public.motoristas_jpd (nome)
SELECT DISTINCT lower(trim(motorista))
  FROM public.jpd_fretes
  WHERE motorista IS NOT NULL AND trim(motorista) <> ''
ON CONFLICT (nome) DO NOTHING;

-- 4) Chave estrangeira real (idempotente). ON UPDATE CASCADE propaga
--    correções de nome para os fretes.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jpd_fretes_motorista_fk') THEN
    ALTER TABLE public.jpd_fretes
      ADD CONSTRAINT jpd_fretes_motorista_fk
      FOREIGN KEY (motorista) REFERENCES public.motoristas_jpd(nome)
      ON UPDATE CASCADE;
  END IF;
END $$;

-- 5) Acesso via Netlify Function com service role (RLS desligada)
ALTER TABLE public.motoristas_jpd DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- FIM. Confira no Table Editor que a tabela motoristas_jpd foi criada
-- e que os nomes foram normalizados.
-- =====================================================
