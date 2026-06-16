-- =========================================================
-- Tabelas Blixx (account_id = 53) - agregados e veiculos
-- Campos "foto" guardam a URL publica do bucket 'imagensdocs'.
-- Rodar manualmente no SQL Editor do Supabase.
-- =========================================================

-- 1) motorista_blixx
CREATE TABLE IF NOT EXISTS public.motorista_blixx (
  motorista_blixx_id            bigserial PRIMARY KEY,
  cpf                           text,
  dt_nascimento                 date,
  genero                        text,
  telefone                      bigint,
  email                         text,
  nome                          text,
  funcao                        text DEFAULT 'Agregado',
  st_cadastro                   text DEFAULT 'Cadastrado',
  ativo                         boolean DEFAULT true,
  company_id                    integer REFERENCES public.company(company_id),
  data_cadastro                 date DEFAULT now(),
  -- documentos (URL no storage 'imagensdocs')
  cnh                           text,
  comprovante_residencia        text,
  certificado_tdd               text,
  certificado_tar               text,
  exame_toxicologico            text,
  -- contato de emergencia
  nome_contato_emergencia       text,
  telefone_contato_emergencia   text,
  parentesco_contato_emergencia text,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_motorista_blixx_company_id
  ON public.motorista_blixx (company_id);
CREATE INDEX IF NOT EXISTS idx_motorista_blixx_company_ativo
  ON public.motorista_blixx (company_id, ativo);
CREATE INDEX IF NOT EXISTS idx_motorista_blixx_cpf
  ON public.motorista_blixx (cpf);

-- 2) veiculo_blixx
CREATE TABLE IF NOT EXISTS public.veiculo_blixx (
  veiculo_blixx_id           bigserial PRIMARY KEY,
  placa                      text,
  status_veiculo             boolean DEFAULT true,
  marca                      text,
  tipologia                  text,
  ano                        text,
  combustivel                text,
  peso                       text,
  cubagem                    text,
  cor                        text,
  tipo                       text,
  bau                        text,
  motorista_blixx_id         bigint REFERENCES public.motorista_blixx(motorista_blixx_id) ON DELETE SET NULL,
  company_id                 integer REFERENCES public.company(company_id),
  -- rastreamento
  possui_rastreador          boolean DEFAULT false,
  marca_rastreador           text,
  marca_rastreador_principal text,
  id_rastreador_principal    text,
  id_rastreador_3s           text,
  id_rastreador_t4s          text,
  possui_omnilink            boolean DEFAULT false,
  ficha_ativacao_omnilink    text,
  -- documentos (URL no storage 'imagensdocs')
  crlv                       text,
  antt                       text,
  documento_proprietario     text,
  nome_proprietario          text,
  telefone_proprietario      text,
  -- seguranca (fotos = URL no storage)
  telas_janela               text,
  trava_bau_traseiro         text,
  bloqueio_porta_lateral     text,
  possui_protetor_estribo    boolean DEFAULT false,
  protetor_estribo           text,
  possui_trava_quinta_roda   boolean DEFAULT false,
  trava_quinta_roda          text,
  veiculo_blindado           boolean DEFAULT false,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_veiculo_blixx_company_id
  ON public.veiculo_blixx (company_id);
CREATE INDEX IF NOT EXISTS idx_veiculo_blixx_company_status
  ON public.veiculo_blixx (company_id, status_veiculo);
CREATE INDEX IF NOT EXISTS idx_veiculo_blixx_motorista
  ON public.veiculo_blixx (motorista_blixx_id);
CREATE INDEX IF NOT EXISTS idx_veiculo_blixx_placa_lower
  ON public.veiculo_blixx (lower(placa));

-- 3) RLS (mesmo padrao permissivo das tabelas blixx existentes)
ALTER TABLE public.motorista_blixx ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculo_blixx   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blixx rw motorista_blixx" ON public.motorista_blixx;
CREATE POLICY "blixx rw motorista_blixx"
  ON public.motorista_blixx FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "blixx rw veiculo_blixx" ON public.veiculo_blixx;
CREATE POLICY "blixx rw veiculo_blixx"
  ON public.veiculo_blixx FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.motorista_blixx IS 'Agregados Blixx (account_id 53) com documentos e contato de emergencia.';
COMMENT ON TABLE public.veiculo_blixx   IS 'Veiculos Blixx (account_id 53) com rastreadores, documentos e itens de seguranca.';
