-- =====================================================
-- Corrige URLs de Storage que ainda apontam para o projeto
-- Supabase ANTIGO (jnwocajxsgkgiixwyxkl) após a migração para
-- o projeto NOVO (syyxfoixmnvrdodqycpx).
--
-- Mapeadas via varredura de todas as colunas text/varchar/jsonb
-- do schema public em busca do domínio antigo (2026-09-22).
-- Não inclui "vw_agregados_completo" (VIEW derivada de
-- documento_motorista e pessoa_fisica_dono_veiculo — corrige
-- sozinha quando as tabelas base forem atualizadas).
-- =====================================================

BEGIN;

UPDATE public.bomba_gasolina             SET foto_bomba                   = replace(foto_bomba,                   'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE foto_bomba                   LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.cnh_ajudante               SET foto_cnh                     = replace(foto_cnh,                     'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE foto_cnh                     LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.comprovante                SET foto_comprovante             = replace(foto_comprovante,             'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE foto_comprovante             LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.documento_ajudante         SET comprovante_residencia       = replace(comprovante_residencia,       'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE comprovante_residencia       LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.documento_motorista        SET foto_cnh                     = replace(foto_cnh,                     'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE foto_cnh                     LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.documento_motorista        SET foto_comprovante_residencia  = replace(foto_comprovante_residencia,  'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE foto_comprovante_residencia  LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.documento_veiculo          SET foto_crv                     = replace(foto_crv,                     'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE foto_crv                     LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.foto_checklist             SET foto_avaria                  = replace(foto_avaria,                  'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE foto_avaria                  LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.foto_checklist             SET foto_avaria2                 = replace(foto_avaria2,                 'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE foto_avaria2                 LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.foto_checklist             SET foto_bateria                 = replace(foto_bateria,                 'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE foto_bateria                 LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.foto_checklist             SET foto_carrinho_carga          = replace(foto_carrinho_carga,          'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE foto_carrinho_carga          LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.foto_checklist             SET foto_chavederoda             = replace(foto_chavederoda,             'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE foto_chavederoda             LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.foto_checklist             SET foto_dianteira               = replace(foto_dianteira,               'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE foto_dianteira               LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.foto_checklist             SET foto_estepe                  = replace(foto_estepe,                  'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE foto_estepe                  LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.foto_checklist             SET foto_hodometro               = replace(foto_hodometro,               'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE foto_hodometro               LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.foto_checklist             SET foto_lateral_direita         = replace(foto_lateral_direita,         'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE foto_lateral_direita         LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.foto_checklist             SET foto_lateral_esquerda        = replace(foto_lateral_esquerda,        'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE foto_lateral_esquerda        LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.foto_checklist             SET foto_macaco                  = replace(foto_macaco,                  'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE foto_macaco                  LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.foto_checklist             SET foto_oleo                    = replace(foto_oleo,                    'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE foto_oleo                    LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.foto_checklist             SET foto_pneu_dianteiro_direito  = replace(foto_pneu_dianteiro_direito,  'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE foto_pneu_dianteiro_direito  LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.foto_checklist             SET foto_pneu_dianteiro_esquerdo = replace(foto_pneu_dianteiro_esquerdo, 'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE foto_pneu_dianteiro_esquerdo  LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.foto_checklist             SET foto_pneu_traseiro_direito   = replace(foto_pneu_traseiro_direito,   'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE foto_pneu_traseiro_direito   LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.foto_checklist             SET foto_pneu_traseiro_esquerdo  = replace(foto_pneu_traseiro_esquerdo,  'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE foto_pneu_traseiro_esquerdo  LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.foto_checklist             SET foto_traseira                = replace(foto_traseira,                'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE foto_traseira                LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.foto_checklist             SET foto_triangulo               = replace(foto_triangulo,               'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE foto_triangulo               LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.hodometro                  SET foto_hodometro               = replace(foto_hodometro,               'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE foto_hodometro               LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.minuta                     SET foto_minuta                  = replace(foto_minuta,                  'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE foto_minuta                  LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.pessoa_fisica_dono_veiculo SET comprovante_residencia       = replace(comprovante_residencia,       'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE comprovante_residencia       LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.pessoa_fisica_dono_veiculo SET foto_documento               = replace(foto_documento,               'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE foto_documento               LIKE '%jnwocajxsgkgiixwyxkl%';
UPDATE public.romaneio                   SET foto_romaneio                = replace(foto_romaneio,                'jnwocajxsgkgiixwyxkl', 'syyxfoixmnvrdodqycpx') WHERE foto_romaneio                LIKE '%jnwocajxsgkgiixwyxkl%';

COMMIT;

-- Conferência: deve retornar 0 linhas em todas (exceto a view derivada,
-- que se corrige sozinha e não precisa ser checada aqui).
-- select count(*) from bomba_gasolina where foto_bomba like '%jnwocajxsgkgiixwyxkl%';
