-- =====================================================
-- JPD Transportes — Seed de 2 documentos de teste
-- Rode no SQL Editor do Supabase.
-- AJUSTE o company_id na linha abaixo antes de executar.
-- =====================================================

DO $$
DECLARE
  -- >>>>>>>>>>>>>>  AJUSTE AQUI  <<<<<<<<<<<<<<
  v_company_id  integer := 1;   -- troque pelo company_id desejado
  v_doc1_id     integer;
  v_doc2_id     integer;
BEGIN
  -- =====================================================
  -- DOC 1: Autorizacao de Frete (PDF) — status PENDING
  -- =====================================================
  INSERT INTO public.jpd_documents (
    company_id, filename, file_path, mime_type, document_type, status, raw_text, source
  ) VALUES (
    v_company_id,
    'JZ447-2_2026.pdf',
    NULL,
    'application/pdf',
    'autorizacao_frete_pdf',
    'pending',
    'AUTORIZACAO DE FRETE - JZ447-2/2026
TRANSPORTADOR AGREGADO:JPD EMPREENDIMENTOS E TRANSPORTES LTDA M
Cliente: BINATURAL INDUSTRIA E COMERCIO LTDA
PLACA DA CARRETA: 15/04/2026 TRANSPREX
(BASE LEM) BARREIRAS/BA X (USINA BINATURAL) FORMOSA DO RIO PRETO/BA
TOTAL DO FRETE: 8.450,00  DATA/HORA 320',
    'upload'
  ) RETURNING id INTO v_doc1_id;

  INSERT INTO public.jpd_extractions (document_id, fields, confidence, alerts) VALUES (
    v_doc1_id,
    jsonb_build_object(
      'numero_do_bv', 'JZ447-2/2026',
      'data_do_bv', '2026-04-15',
      'data_da_carga', '2026-04-15',
      'data_da_descarga', NULL,
      'motorista', 'RAFAEL SOARES DA SILVA',
      'placa_do_carro', 'ABC1D23 / XYZ4E56',
      'origem', 'BASE LEM - BARREIRAS/BA',
      'destinatario', 'USINA BINATURAL - FORMOSA DO RIO PRETO/BA',
      'total_km', 320,
      'valor_do_frete', 8450.00,
      'outras_receitas', 0.0,
      'abastecimento_pago_pela_jpd', 1280.50,
      'abastecimento_descontado_do_frete', 0.0,
      'demais_despesas', 0.0,
      'seguros', 0.0,
      'aluguel', 0.0,
      'pneus', 0.0,
      'parcela_pneus', 0.0,
      'plano_manutencao_ipva', 0.0,
      'faltas_em_litros', 0.0,
      'faltas_abonadas_em_rs', 0.0,
      'faltas_cobradas_em_rs', 0.0,
      'data_do_faturamento', NULL,
      'valor_faturado', NULL,
      'numero_do_cte', NULL,
      'situacao_do_bv', 'pendente_faturamento'
    ),
    0.92,
    '[]'::jsonb
  );

  -- =====================================================
  -- DOC 2: Demonstrativo de Servico (PDF) — status PENDING
  -- =====================================================
  INSERT INTO public.jpd_documents (
    company_id, filename, file_path, mime_type, document_type, status, raw_text, source
  ) VALUES (
    v_company_id,
    'LM404-3.2026 - RAFAEL SOARES.pdf',
    NULL,
    'application/pdf',
    'demonstrativo_servico_pdf',
    'pending',
    'DEMONSTRATIVO DE PRESTACAO DE SERVICO
AGREGADO 22/04/2026 LM404-3/2026
RAFAEL SOARES DATAREFERENCIA FORNECIMENTO DE COMBUSTIVEL
ABC1D23 / XYZ4E56 / KLM7N89
BASE LEM - USINA BINATURAL 320,500
VALOR DO SERVICO 9.120,00
SEGURO DE CARGA 245,00
TOTAL DE CUSTO DA OPERACAO 1.430,75
1.560,30 TOTAL DE COMBUSTIVEL',
    'webhook'
  ) RETURNING id INTO v_doc2_id;

  INSERT INTO public.jpd_extractions (document_id, fields, confidence, alerts) VALUES (
    v_doc2_id,
    jsonb_build_object(
      'numero_do_bv', 'LM404-3/2026',
      'data_do_bv', '2026-04-22',
      'data_da_carga', '2026-04-22',
      'data_da_descarga', NULL,
      'motorista', 'RAFAEL SOARES',
      'placa_do_carro', 'ABC1D23 / XYZ4E56 / KLM7N89',
      'origem', 'BASE LEM',
      'destinatario', 'USINA BINATURAL',
      'total_km', 320.500,
      'valor_do_frete', 9120.00,
      'outras_receitas', 0.0,
      'abastecimento_pago_pela_jpd', 1560.30,
      'abastecimento_descontado_do_frete', 0.0,
      'demais_despesas', 1430.75,
      'seguros', 245.00,
      'aluguel', 0.0,
      'pneus', 0.0,
      'parcela_pneus', 0.0,
      'plano_manutencao_ipva', 0.0,
      'faltas_em_litros', 0.0,
      'faltas_abonadas_em_rs', 0.0,
      'faltas_cobradas_em_rs', 0.0,
      'data_do_faturamento', NULL,
      'valor_faturado', 9120.00,
      'numero_do_cte', NULL,
      'situacao_do_bv', 'processado'
    ),
    0.90,
    '[]'::jsonb
  );

  RAISE NOTICE 'Seed concluido. Documentos criados: % e %', v_doc1_id, v_doc2_id;
END $$;

-- Conferencia rapida (ajuste o company_id se necessario)
SELECT d.id, d.filename, d.document_type, d.status, d.source, e.confidence, d.created_at
FROM public.jpd_documents d
LEFT JOIN public.jpd_extractions e ON e.document_id = d.id
ORDER BY d.id DESC
LIMIT 5;
