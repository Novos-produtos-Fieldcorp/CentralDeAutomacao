-- =====================================================
-- JPD Transportes — Tabela jpd_fretes (espelha exemplo.csv)
-- Rode este SQL no SQL Editor do Supabase (uma única vez).
-- Cada coluna corresponde 1:1 a uma coluna do arquivo exemplo.csv.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.jpd_fretes (
  id                                  serial PRIMARY KEY,
  company_id                          integer REFERENCES public.company(company_id),
  document_id                         integer,                              -- link opcional ao documento de origem

  -- Colunas do CSV (na mesma ordem do arquivo)
  origem                              text,                                 -- ORIGEM
  destinatario                        text,                                 -- DESTINATÁRIO
  motorista                           text,                                 -- MOTORISTA
  placa_do_carro                      text,                                 -- PLACA DO CARRO (pode conter múltiplas placas)
  numero_do_bv                        text,                                 -- Número do BV
  total_km                            numeric,                              -- Total KM
  data_do_bv                          date,                                 -- DATA DO BV
  data_da_carga                       date,                                 -- DATA DA CARGA
  data_da_descarga                    date,                                 -- DATA DA DESCARGA
  valor_do_frete                      numeric,                              -- VALOR DO FRETE
  outras_receitas                     numeric,                              -- OUTRAS RECEITAS
  abastecimento_pago_pela_jpd         numeric,                              -- ABASTECIMENTO PAGO PELA JPD
  abastecimento_descontado_do_frete   numeric,                              -- ABASTECIMENTO DESCONTADO DO FRETE
  demais_despesas                     numeric,                              -- DEMAIS DESPESAS
  seguros                             numeric,                              -- SEGUROS
  aluguel                             numeric,                              -- ALUGUEL
  pneus                               numeric,                              -- PNEUS
  parcela_pneus                       numeric,                              -- PARCELA PNEUS
  plano_manutencao_ipva               numeric,                              -- PLANO MANUTENÇÃO + IPVA
  faltas_em_litros                    numeric,                              -- FALTAS EM LITROS
  faltas_abonadas_rs                  numeric,                              -- FALTAS ABONADAS EM R$
  faltas_cobradas_rs                  numeric,                              -- FALTAS COBRADAS EM R$
  data_do_faturamento                 date,                                 -- DATA DO FATURAMENTO
  valor_faturado                      numeric,                              -- VALOR FATURADO
  numero_do_cte                       text,                                 -- NÚMERO DO CTE
  situacao_do_bv                      text,                                 -- SITUAÇÃO DO BV

  created_at                          timestamp DEFAULT now(),
  updated_at                          timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jpd_fretes_company_idx ON public.jpd_fretes(company_id);
CREATE INDEX IF NOT EXISTS jpd_fretes_carga_idx   ON public.jpd_fretes(data_da_carga);

-- IMPORTANTE: o acesso é feito pelas Netlify Functions via service role (padrão das
-- demais tabelas jpd_*). Deixe a RLS DESLIGADA — se ligar sem policy, a function
-- recebe [] e a central não renderiza nada.
ALTER TABLE public.jpd_fretes DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- FIM. Confira no Table Editor que a tabela jpd_fretes foi criada.
-- =====================================================
