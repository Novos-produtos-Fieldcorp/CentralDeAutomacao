-- =====================================================
-- Dados fictícios de exemplo para company_id=2 (Fieldcorp, "conta 01")
-- 20 registros por automação, claramente marcados como "Exemplo"
-- para não serem confundidos com dados reais.
-- Gerado em 2026-09-25.
-- =====================================================

BEGIN;

-- 1) MOTORISTAS (20 novos, servem de "ator" para as demais automações)
WITH novos_motoristas AS (
  INSERT INTO public.motorista (
    cpf, dt_nascimento, genero, telefone, email, funcao, nome,
    origem_usuario, st_cadastro, company_id, data_cadastro, ativo, area_atuacao
  )
  SELECT
    '000.000.0' || lpad(n::text, 2, '0') || '-00',
    date '1985-01-01' + (n * 137) * interval '1 day',
    CASE WHEN n % 2 = 0 THEN 'Masculino' ELSE 'Feminino' END,
    (11900000000 + n)::numeric,
    'motorista.exemplo' || lpad(n::text, 2, '0') || '@exemplo.com',
    'Motorista',
    'Motorista Exemplo ' || lpad(n::text, 2, '0'),
    'mock',
    'Cadastrado',
    2,
    current_date - ((20 - n) * 3),
    true,
    'Regional'
  FROM generate_series(1, 20) AS n
  RETURNING motorista_id
)
SELECT * INTO TEMP TABLE tmp_motoristas FROM novos_motoristas;

-- referência numerada (1..20) para casar 1:1 com as outras automações
CREATE TEMP TABLE tmp_motoristas_n AS
SELECT motorista_id, row_number() OVER () AS n FROM tmp_motoristas;

-- veículos e clientes reais da conta, para variar as FKs das automações abaixo
CREATE TEMP TABLE tmp_veiculos_n AS
SELECT veiculo_id, row_number() OVER () AS n
FROM (SELECT veiculo_id FROM public.veiculo WHERE company_id = 2 ORDER BY veiculo_id LIMIT 20) v;

CREATE TEMP TABLE tmp_clientes_n AS
SELECT cliente_id, row_number() OVER () AS n
FROM (SELECT cliente_id FROM public.cliente WHERE company_id = 2 ORDER BY cliente_id) c;

CREATE TEMP TABLE tmp_grupos_n AS
SELECT id AS grupo_id, row_number() OVER () AS n
FROM (SELECT id FROM public.grupo_resumo WHERE company_id = 2 ORDER BY id) g;

-- 2) CHECKLIST (20)
INSERT INTO public.checklist (
  data, hora, quilometragem, observacoes, id_tipo_checklist,
  veiculo_id, motorista_id, company_id, status
)
SELECT
  current_date - ((20 - m.n)::int * 2),
  ('08:00:00'::time + (m.n || ' minutes')::interval),
  100000 + (m.n * 137),
  'Exemplo de checklist gerado como dado fictício de demonstração.',
  ((m.n - 1) % 2) + 1,
  v.veiculo_id,
  m.motorista_id,
  2,
  true
FROM tmp_motoristas_n m
JOIN tmp_veiculos_n v ON v.n = ((m.n - 1) % (SELECT count(*) FROM tmp_veiculos_n)) + 1;

-- 3) HODÔMETRO (20)
INSERT INTO public.hodometro (
  data, hora, hod_informado, hod_lido, trip_lida, km_rodado,
  verificacao, comparacao_leitura, motorista_id, veiculo_id, cliente_id, company_id
)
SELECT
  current_date - ((20 - m.n)::int * 2),
  ('09:00:00'::time + (m.n || ' minutes')::interval),
  (100000 + m.n * 120)::text,
  (100000 + m.n * 120)::text,
  (m.n * 15)::text,
  (m.n * 15)::double precision,
  true,
  true,
  m.motorista_id,
  v.veiculo_id,
  c.cliente_id,
  2
FROM tmp_motoristas_n m
JOIN tmp_veiculos_n v ON v.n = ((m.n - 1) % (SELECT count(*) FROM tmp_veiculos_n)) + 1
JOIN tmp_clientes_n c ON c.n = ((m.n - 1) % (SELECT count(*) FROM tmp_clientes_n)) + 1;

-- 4) RESUMO / envio_resumo (20, distribuídos pelos grupos já existentes da conta)
INSERT INTO public.envio_resumo (
  grupo_id, company_id, data_envio, status, mensagem, tipo
)
SELECT
  g.grupo_id,
  2,
  current_date - ((20 - gs.n)::int * 1),
  true,
  'Exemplo de resumo gerado como dado fictício de demonstração ' || gs.n || '.',
  'grupo'
FROM generate_series(1, 20) AS gs(n)
JOIN tmp_grupos_n g ON g.n = ((gs.n - 1) % (SELECT count(*) FROM tmp_grupos_n)) + 1;

-- 5) TAGS (20)
INSERT INTO public.tag (nome, company_id, cor, limite_max)
SELECT
  'Tag Exemplo ' || lpad(n::text, 2, '0'),
  2,
  (ARRAY['#4F46E5','#059669','#DC2626','#D97706','#0891B2'])[((n - 1) % 5) + 1],
  (n * 5)::numeric
FROM generate_series(1, 20) AS n;

-- 6) COMPROVANTE (20)
INSERT INTO public.comprovante (company_id, motorista_id, cliente_id)
SELECT
  2,
  m.motorista_id,
  c.cliente_id
FROM tmp_motoristas_n m
JOIN tmp_clientes_n c ON c.n = ((m.n - 1) % (SELECT count(*) FROM tmp_clientes_n)) + 1;

-- 7) BOMBA DE GASOLINA (20)
INSERT INTO public.bomba_gasolina (
  data, hora, litro_informado, litro_lido, preco_informado, preco_lido,
  comparacao_leitura, motorista_id, veiculo_id, cliente_id, company_id
)
SELECT
  current_date - ((20 - m.n)::int * 2),
  ('10:00:00'::time + (m.n || ' minutes')::interval),
  (m.n * 3)::text,
  (m.n * 3)::text,
  (5.89)::text,
  (5.89)::text,
  true,
  m.motorista_id,
  v.veiculo_id,
  c.cliente_id,
  2
FROM tmp_motoristas_n m
JOIN tmp_veiculos_n v ON v.n = ((m.n - 1) % (SELECT count(*) FROM tmp_veiculos_n)) + 1
JOIN tmp_clientes_n c ON c.n = ((m.n - 1) % (SELECT count(*) FROM tmp_clientes_n)) + 1;

-- 8) MINUTA (20)
INSERT INTO public.minuta (
  minuta_informada, minuta_lida, romaneio, company_id, motorista_id, veiculo_id, hora, data
)
SELECT
  'MIN-EXEMPLO-' || lpad(m.n::text, 3, '0'),
  'MIN-EXEMPLO-' || lpad(m.n::text, 3, '0'),
  'ROM-EXEMPLO-' || lpad(m.n::text, 3, '0'),
  2,
  m.motorista_id,
  v.veiculo_id,
  to_char('09:00:00'::time + (m.n || ' minutes')::interval, 'HH24:MI:SS'),
  to_char(current_date - ((20 - m.n)::int * 2), 'YYYY-MM-DD')
FROM tmp_motoristas_n m
JOIN tmp_veiculos_n v ON v.n = ((m.n - 1) % (SELECT count(*) FROM tmp_veiculos_n)) + 1;

COMMIT;
