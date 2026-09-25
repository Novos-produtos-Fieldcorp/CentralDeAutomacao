-- =====================================================
-- Soft delete para jpd_fretes: em vez de apagar a linha na
-- hora, "Excluir" só marca deleted_at. A linha fica recuperável
-- por 30 dias (purga automática lazy no próprio endpoint de
-- exclusão), evitando perda definitiva por bug ou clique errado.
-- =====================================================

ALTER TABLE public.jpd_fretes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_jpd_fretes_deleted_at
  ON public.jpd_fretes(deleted_at)
  WHERE deleted_at IS NOT NULL;
