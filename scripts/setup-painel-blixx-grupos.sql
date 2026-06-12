-- =====================================================
-- Painel de Controle Blixx — Tabela de Grupos de contatos
-- Rode este SQL no SQL Editor do Supabase (idempotente).
-- =====================================================

-- Grupos de contatos do Painel de Controle Blixx (multi-tenant via company_id).
-- Os contatos vêm do WiseApp/Chatwoot (sistema externo), então guardamos um
-- snapshot dos membros em JSONB: [{ "id": "83476", "nome": "...", "telefone": "..." }].
CREATE TABLE IF NOT EXISTS public.painel_blixx_grupos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  integer REFERENCES public.company(company_id),
  nome        text NOT NULL,
  contatos    jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS painel_blixx_grupos_company_idx
  ON public.painel_blixx_grupos(company_id);

-- RLS: mesmo padrão dos demais módulos Blixx (leitura/escrita liberada para anon,
-- isolamento feito por company_id na query do frontend).
ALTER TABLE public.painel_blixx_grupos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read painel_blixx_grupos"   ON public.painel_blixx_grupos;
DROP POLICY IF EXISTS "auth insert painel_blixx_grupos" ON public.painel_blixx_grupos;
DROP POLICY IF EXISTS "auth update painel_blixx_grupos" ON public.painel_blixx_grupos;
DROP POLICY IF EXISTS "auth delete painel_blixx_grupos" ON public.painel_blixx_grupos;

CREATE POLICY "auth read painel_blixx_grupos"
  ON public.painel_blixx_grupos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth insert painel_blixx_grupos"
  ON public.painel_blixx_grupos FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "auth update painel_blixx_grupos"
  ON public.painel_blixx_grupos FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete painel_blixx_grupos"
  ON public.painel_blixx_grupos FOR DELETE TO anon, authenticated USING (true);
