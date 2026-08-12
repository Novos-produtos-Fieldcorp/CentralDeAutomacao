-- =====================================================
-- JPD Transportes — Motorista no lançamento de abastecimento
-- Rode este SQL no SQL Editor do Supabase (uma única vez).
--
-- Permite selecionar/criar o motorista na tela "Revisar lançamento"
-- (Gerar lançamento), igual já acontece com a placa. Nomes referenciam a
-- tabela mestra motoristas_jpd (mesma usada pelos fretes).
-- =====================================================

-- 1) Nova coluna
ALTER TABLE public.homedometro_abastecimento_jpd
  ADD COLUMN IF NOT EXISTS motorista text;

-- 2) Normaliza valores já existentes para minúsculas (para casar com a FK)
UPDATE public.homedometro_abastecimento_jpd
  SET motorista = lower(trim(motorista))
  WHERE motorista IS NOT NULL AND motorista <> lower(trim(motorista));

-- 3) Chave estrangeira real (idempotente). ON UPDATE CASCADE propaga
--    correções de nome feitas em motoristas_jpd.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'homedometro_abast_motorista_fk') THEN
    ALTER TABLE public.homedometro_abastecimento_jpd
      ADD CONSTRAINT homedometro_abast_motorista_fk
      FOREIGN KEY (motorista) REFERENCES public.motoristas_jpd(nome)
      ON UPDATE CASCADE;
  END IF;
END $$;

-- =====================================================
-- FIM. Confira no Table Editor que a coluna motorista foi criada em
-- homedometro_abastecimento_jpd.
-- =====================================================
