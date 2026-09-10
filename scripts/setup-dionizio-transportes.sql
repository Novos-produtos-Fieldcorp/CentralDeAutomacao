-- =====================================================
-- Dionizio Transportes — Setup completo do banco de dados
-- Rode este SQL no SQL Editor do Supabase (uma única vez).
--
-- Cria os cadastros mestres (motoristas, veículos, clientes) e as
-- tabelas transacionais (viagens, abastecimentos, hotéis, ocorrências,
-- descargas/entregas), todas prefixadas com "dionizio_".
--
-- Padrão idêntico ao usado no painel JPD Transportes:
-- RLS desabilitada (acesso via backend com service role, ver
-- server/routes.ts e netlify/functions/dionizio.js).
-- =====================================================

-- =====================================================
-- 1) CADASTROS MESTRES
-- =====================================================

-- 1.1) Motoristas
CREATE TABLE IF NOT EXISTS public.dionizio_motoristas (
  id           serial PRIMARY KEY,
  nome         text NOT NULL,
  cpf          text,
  cnh          text,
  cnh_validade date,
  telefone     text,
  status       text NOT NULL DEFAULT 'ativo', -- ativo | inativo
  created_at   timestamp DEFAULT now(),
  updated_at   timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS dionizio_motoristas_nome_uk
  ON public.dionizio_motoristas (lower(trim(nome)));

-- 1.2) Veículos (placas)
CREATE TABLE IF NOT EXISTS public.dionizio_veiculos (
  id         serial PRIMARY KEY,
  placa      text NOT NULL UNIQUE, -- sempre normalizada em minúsculas
  modelo     text,
  ano        integer,
  status     text NOT NULL DEFAULT 'ativo', -- ativo | inativo
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- 1.3) Clientes (usado no select opcional de "Cliente" na Viagem)
CREATE TABLE IF NOT EXISTS public.dionizio_clientes (
  id         serial PRIMARY KEY,
  nome       text NOT NULL,
  cnpj       text,
  created_at timestamp DEFAULT now()
);

-- =====================================================
-- 2) VIAGENS (entidade central)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.dionizio_viagens (
  id                       serial PRIMARY KEY,
  referencia               text, -- ex: VG-2026-001, opcional/autogerado no frontend
  origem                   text NOT NULL,
  destino                  text,
  cliente_id               integer REFERENCES public.dionizio_clientes(id) ON DELETE SET NULL,
  data_saida               date NOT NULL,
  data_retorno             date NOT NULL,
  horario_saida            time,
  horario_retorno          time,
  necessita_pernoite       boolean NOT NULL DEFAULT false,
  veiculo_id               integer NOT NULL REFERENCES public.dionizio_veiculos(id) ON UPDATE CASCADE,
  motorista_id             integer NOT NULL REFERENCES public.dionizio_motoristas(id) ON UPDATE CASCADE,
  km_inicial               numeric,
  km_final                 numeric,
  km_total_estimado        numeric,
  necessita_ajudante       boolean NOT NULL DEFAULT false,
  base_frete               numeric NOT NULL DEFAULT 0,
  custo_ajudante           numeric NOT NULL DEFAULT 0,
  custo_pernoite           numeric NOT NULL DEFAULT 0,
  frete_total              numeric NOT NULL DEFAULT 0, -- calculado no backend: base_frete + custo_ajudante + custo_pernoite
  numero_pessoas           integer NOT NULL DEFAULT 1,
  entregas_estimadas       integer NOT NULL DEFAULT 0,
  entregas_realizadas      integer NOT NULL DEFAULT 0,
  observacoes              text,
  status                   text NOT NULL DEFAULT 'planejada', -- planejada | em_andamento | concluida | cancelada
  comprovante_canhoto_url  text,
  created_at               timestamp DEFAULT now(),
  updated_at               timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dionizio_viagens_veiculo_idx ON public.dionizio_viagens (veiculo_id);
CREATE INDEX IF NOT EXISTS dionizio_viagens_motorista_idx ON public.dionizio_viagens (motorista_id);
CREATE INDEX IF NOT EXISTS dionizio_viagens_status_idx ON public.dionizio_viagens (status);

-- =====================================================
-- 3) ABASTECIMENTOS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.dionizio_abastecimentos (
  id                  serial PRIMARY KEY,
  veiculo_id          integer NOT NULL REFERENCES public.dionizio_veiculos(id) ON UPDATE CASCADE,
  data_abastecimento  date NOT NULL,
  tipo_combustivel    text, -- ex: Diesel S10, Diesel Comum, Arla, Gasolina
  quilometragem_atual numeric NOT NULL,
  litros              numeric NOT NULL,
  valor_total         numeric NOT NULL,
  preco_por_litro     numeric, -- calculado: valor_total / litros
  media_por_km        numeric, -- calculado: km rodado desde o abastecimento anterior / litros
  local_abastecimento text NOT NULL,
  nota_fiscal_url     text,
  created_at          timestamp DEFAULT now(),
  updated_at          timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dionizio_abastecimentos_veiculo_idx ON public.dionizio_abastecimentos (veiculo_id);

-- =====================================================
-- 4) HOTÉIS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.dionizio_hoteis (
  id                 serial PRIMARY KEY,
  data               date NOT NULL,
  veiculo_id         integer NOT NULL REFERENCES public.dionizio_veiculos(id) ON UPDATE CASCADE,
  motorista_id       integer NOT NULL REFERENCES public.dionizio_motoristas(id) ON UPDATE CASCADE,
  local              text NOT NULL,
  nome_hotel         text NOT NULL,
  cnpj_hotel         text,
  quantidade_pessoas integer NOT NULL DEFAULT 1,
  nome_ajudante      text,
  valor_hotel        numeric NOT NULL,
  observacoes        text,
  created_at         timestamp DEFAULT now(),
  updated_at         timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dionizio_hoteis_veiculo_idx ON public.dionizio_hoteis (veiculo_id);
CREATE INDEX IF NOT EXISTS dionizio_hoteis_motorista_idx ON public.dionizio_hoteis (motorista_id);

-- =====================================================
-- 5) OCORRÊNCIAS / EVENTOS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.dionizio_ocorrencias (
  id                   serial PRIMARY KEY,
  tipo_evento          text NOT NULL, -- ex: Avaria, Acidente, Multa, Manutenção
  data                 date NOT NULL,
  veiculo_id           integer REFERENCES public.dionizio_veiculos(id) ON UPDATE CASCADE,
  gravidade            text, -- baixa | media | alta
  status               text NOT NULL DEFAULT 'pendente', -- pendente | em_andamento | resolvido
  descricao_detalhada  text NOT NULL,
  observacoes_gerais   text,
  fotos                jsonb NOT NULL DEFAULT '[]'::jsonb, -- array de URLs do bucket dionizio-uploads
  created_at           timestamp DEFAULT now(),
  updated_at           timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dionizio_ocorrencias_veiculo_idx ON public.dionizio_ocorrencias (veiculo_id);
CREATE INDEX IF NOT EXISTS dionizio_ocorrencias_status_idx ON public.dionizio_ocorrencias (status);

-- =====================================================
-- 6) DESCARGAS / ENTREGAS (vinculadas a uma viagem)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.dionizio_descargas (
  id                        serial PRIMARY KEY,
  viagem_id                 integer NOT NULL REFERENCES public.dionizio_viagens(id) ON DELETE CASCADE,
  veiculo_id                integer REFERENCES public.dionizio_veiculos(id) ON UPDATE CASCADE,
  data_descarga             date NOT NULL,
  horario                   time,
  local_descarga            text NOT NULL,
  tipo_carga                text NOT NULL,
  numero_carga              text,
  numero_nota               text,
  tipo_pagamento            text,
  valor_descarga            numeric NOT NULL,
  comprovante_pagamento_url text,
  recibo_nota_fiscal_url    text,
  observacoes               text,
  created_at                timestamp DEFAULT now(),
  updated_at                timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dionizio_descargas_viagem_idx ON public.dionizio_descargas (viagem_id);

-- =====================================================
-- 7) ACESSO POR EMPRESA (tabela "company")
-- =====================================================

ALTER TABLE public.company
  ADD COLUMN IF NOT EXISTS dionizio_transportes_access boolean DEFAULT false;

-- =====================================================
-- 8) RLS — mesmo padrão do painel JPD (acesso via service role no backend)
-- =====================================================

ALTER TABLE public.dionizio_motoristas    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dionizio_veiculos      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dionizio_clientes      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dionizio_viagens       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dionizio_abastecimentos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dionizio_hoteis        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dionizio_ocorrencias   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dionizio_descargas     DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- FIM. Confira no Table Editor que todas as tabelas "dionizio_*" foram
-- criadas e que a coluna "dionizio_transportes_access" existe em "company".
-- =====================================================
