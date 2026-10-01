-- =====================================================
-- JPD Transportes — Motorista padrão do veículo (jpd_veiculos.motorista)
-- Rode este SQL no SQL Editor do Supabase (uma única vez).
--
-- Permite vincular um motorista a uma placa mesmo sem BV lançado. O Dashboard
-- ("Monitoramento de BV por veículo") usa este nome quando a placa não tem
-- motorista em nenhum BV. Referencia motoristas_jpd(nome):
--  - renomear o motorista propaga para o veículo (ON UPDATE CASCADE);
--  - excluir o motorista apenas limpa o campo (ON DELETE SET NULL).
-- =====================================================

ALTER TABLE public.jpd_veiculos ADD COLUMN IF NOT EXISTS motorista text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jpd_veiculos_motorista_fk') THEN
    ALTER TABLE public.jpd_veiculos
      ADD CONSTRAINT jpd_veiculos_motorista_fk
      FOREIGN KEY (motorista) REFERENCES public.motoristas_jpd(nome)
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

-- =====================================================
-- FIM. Confira no Table Editor que a coluna "motorista" foi criada em jpd_veiculos.
-- =====================================================
