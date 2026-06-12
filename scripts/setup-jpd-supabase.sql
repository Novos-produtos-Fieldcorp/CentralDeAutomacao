-- =====================================================
-- JPD Transportes — Setup completo no Supabase
-- Rode este SQL no SQL Editor do Supabase (uma única vez).
-- =====================================================

-- 1) Flag de acesso na tabela company
ALTER TABLE public.company
  ADD COLUMN IF NOT EXISTS jpd_transportes_access boolean DEFAULT false;

-- 2) Tabela de documentos ingeridos (PDF / imagem)
CREATE TABLE IF NOT EXISTS public.jpd_documents (
  id            serial PRIMARY KEY,
  company_id    integer REFERENCES public.company(company_id),
  filename      text NOT NULL,
  file_path     text,
  mime_type     text,
  document_type text,
  status        text DEFAULT 'pending',
  raw_text      text,
  source        text DEFAULT 'upload',
  created_at    timestamp DEFAULT now(),
  updated_at    timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jpd_documents_company_idx ON public.jpd_documents(company_id);
CREATE INDEX IF NOT EXISTS jpd_documents_status_idx  ON public.jpd_documents(status);

-- 3) Extracoes automaticas (snapshot pre-aprovacao + edicoes do operador)
CREATE TABLE IF NOT EXISTS public.jpd_extractions (
  id          serial PRIMARY KEY,
  document_id integer REFERENCES public.jpd_documents(id) ON DELETE CASCADE,
  fields      jsonb,
  confidence  real DEFAULT 0,
  alerts      jsonb,
  created_at  timestamp DEFAULT now(),
  updated_at  timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jpd_extractions_doc_idx ON public.jpd_extractions(document_id);

-- 4) Master data
CREATE TABLE IF NOT EXISTS public.jpd_drivers (
  id         serial PRIMARY KEY,
  company_id integer REFERENCES public.company(company_id),
  nome       text NOT NULL,
  cpf        text,
  telefone   text,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.jpd_vehicles (
  id         serial PRIMARY KEY,
  company_id integer REFERENCES public.company(company_id),
  placa      text NOT NULL,
  modelo     text,
  created_at timestamp DEFAULT now()
);

-- 5) Fretes aprovados (dados consolidados pos-revisao humana)
CREATE TABLE IF NOT EXISTS public.jpd_freights (
  id                  serial PRIMARY KEY,
  company_id          integer REFERENCES public.company(company_id),
  document_id         integer REFERENCES public.jpd_documents(id),
  bv                  text,
  data_emissao        date,
  data_viagem         date,
  data_retorno        date,
  motorista_nome      text,
  motorista_cpf       text,
  placa_cavalo        text,
  placa_carreta       text,
  cliente             text,
  origem              text,
  destino             text,
  km_saida            numeric,
  km_chegada          numeric,
  km_rodado           numeric,
  valor_frete         numeric,
  valor_pedagio       numeric,
  valor_combustivel   numeric,
  litros_combustivel  numeric,
  valor_adiantamento  numeric,
  valor_descarga      numeric,
  valor_seguro        numeric,
  valor_comissao      numeric,
  valor_liquido       numeric,
  observacoes         text,
  status              text DEFAULT 'aprovado',
  approved_by         text,
  created_at          timestamp DEFAULT now(),
  updated_at          timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jpd_freights_company_idx ON public.jpd_freights(company_id);
CREATE INDEX IF NOT EXISTS jpd_freights_viagem_idx  ON public.jpd_freights(data_viagem);

-- 6) Bucket de storage para PDFs/imagens
INSERT INTO storage.buckets (id, name, public)
VALUES ('jpd-documents', 'jpd-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 7) Habilita o modulo JPD Transportes para a primeira company (edite o company_id conforme necessario)
-- UPDATE public.company SET jpd_transportes_access = true WHERE company_id = 1;

-- =====================================================
-- FIM. Confira no Table Editor que as tabelas jpd_* foram criadas.
-- =====================================================
