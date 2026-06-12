-- =====================================================
-- Blixx Grupos — Setup completo no Supabase (banco da Central)
-- Rode este SQL no SQL Editor do Supabase (uma única vez).
-- ATENÇÃO: o passo 6 (ALTER PUBLICATION) não é idempotente —
-- se rodar de novo, comente aquela linha.
-- =====================================================

-- 1) Flag de acesso na tabela company
ALTER TABLE public.company
  ADD COLUMN IF NOT EXISTS blixx_grupos_access boolean DEFAULT false;

COMMENT ON COLUMN public.company.blixx_grupos_access IS 'Access control flag to enable Blixx Grupos module (boolean)';

-- 2) Grupos do WhatsApp (multi-tenant via company_id)
CREATE TABLE IF NOT EXISTS public.blixx_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  integer REFERENCES public.company(company_id),
  wa_chat_id  text NOT NULL,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- wa_chat_id único por empresa (o n8n faz upsert por wa_chat_id + company_id)
CREATE UNIQUE INDEX IF NOT EXISTS blixx_groups_company_wachat_idx
  ON public.blixx_groups(company_id, wa_chat_id);
CREATE INDEX IF NOT EXISTS blixx_groups_company_idx
  ON public.blixx_groups(company_id);

-- 3) Motoristas dos grupos
CREATE TABLE IF NOT EXISTS public.blixx_drivers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid REFERENCES public.blixx_groups(id) ON DELETE SET NULL,
  name        text NOT NULL,
  phone       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS blixx_drivers_group_id_idx
  ON public.blixx_drivers(group_id);

-- 4) Mensagens
CREATE TABLE IF NOT EXISTS public.blixx_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   uuid NOT NULL REFERENCES public.blixx_drivers(id) ON DELETE CASCADE,
  type        text NOT NULL DEFAULT 'text',
  body        text,
  has_media   boolean NOT NULL DEFAULT false,
  sent_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS blixx_messages_driver_sent_at_idx
  ON public.blixx_messages(driver_id, sent_at DESC);

-- 5) RLS — a central acessa o Supabase com a anon key (auth próprio WiseApp, não Supabase Auth),
--    então a leitura precisa ser liberada para o role `anon`. O isolamento por empresa é feito
--    na query (.eq('company_id', ...)), não na RLS. Escrita continua só via service_role (n8n / edge functions).
ALTER TABLE public.blixx_groups   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blixx_drivers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blixx_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read blixx_groups"   ON public.blixx_groups;
DROP POLICY IF EXISTS "auth read blixx_drivers"  ON public.blixx_drivers;
DROP POLICY IF EXISTS "auth read blixx_messages" ON public.blixx_messages;

CREATE POLICY "auth read blixx_groups"
  ON public.blixx_groups   FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth read blixx_drivers"
  ON public.blixx_drivers  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auth read blixx_messages"
  ON public.blixx_messages FOR SELECT TO anon, authenticated USING (true);

-- 6) Realtime: replicar INSERTs em blixx_messages para o painel ao vivo
--    (necessário para o painel atualizar sem reload; policy acima também é pré-requisito)
ALTER PUBLICATION supabase_realtime ADD TABLE public.blixx_messages;

-- 7) Ativar o módulo Blixx Grupos para a company (edite o company_id conforme necessário)
UPDATE public.company SET blixx_grupos_access = true WHERE company_id = 1;

-- =====================================================
-- FIM. Confira no Table Editor que as tabelas blixx_* foram criadas
-- e que a company desejada ficou com blixx_grupos_access = true.
-- =====================================================
