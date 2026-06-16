-- =========================================================
-- Views/RPC Blixx (account_id = 53)
-- Expoem os MESMOS nomes de coluna das views atuais
-- (vw_agregados_completo / vw_contratados_completo / inativos_list_page),
-- para que o frontend apenas troque a fonte quando accountId === '53'.
-- Colunas inexistentes nas tabelas blixx sao expostas como NULL.
-- Rodar manualmente no SQL Editor do Supabase (apos criar as tabelas).
-- =========================================================

-- ---------------------------------------------------------
-- vw_agregados_blixx
-- ---------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_agregados_blixx AS
SELECT
  mb.motorista_blixx_id            AS motorista_id,
  mb.nome                          AS nome_motorista,
  mb.cpf,
  mb.dt_nascimento,
  mb.genero,
  mb.telefone,
  mb.email,
  mb.funcao,
  NULL::text                       AS origem_usuario,
  mb.st_cadastro,
  NULL::text                       AS autorizacao_lgpd,
  mb.company_id,
  mb.data_cadastro,
  NULL::integer                    AS cliente_id,
  NULL::text                       AS conversation_id,
  mb.ativo,
  NULL::text                       AS foto_whatsapp,
  -- endereco (nao disponivel nas tabelas blixx)
  NULL::text                       AS nr_end,
  NULL::text                       AS ds_complemento_end,
  NULL::boolean                    AS st_end,
  NULL::bigint                     AS id_end_motorista,
  NULL::text                       AS logradouro,
  NULL::text                       AS nr_cep,
  NULL::text                       AS nome_bairro,
  NULL::text                       AS nome_cidade,
  NULL::text                       AS nome_estado,
  NULL::text                       AS sigla_estado,
  -- veiculo
  vb.veiculo_blixx_id              AS veiculo_id,
  vb.placa,
  vb.status_veiculo,
  vb.marca                         AS marca_veiculo,
  vb.tipologia,
  vb.ano,
  vb.combustivel,
  vb.peso,
  vb.cubagem,
  vb.possui_rastreador,
  vb.marca_rastreador,
  vb.cor,
  vb.tipo,
  vb.bau,
  -- ajudante (nao disponivel)
  NULL::bigint                     AS id_ajudante,
  NULL::text                       AS nome_ajudante,
  NULL::text                       AS cpf_ajudante,
  NULL::text                       AS telefone_ajudante,
  NULL::text                       AS genero_ajudante,
  NULL::text                       AS comprovante_residencia,
  -- gestao de risco (nao disponivel)
  NULL::bigint                     AS gr_motorista_id,
  NULL::text                       AS gr_motorista_motivo,
  NULL::text                       AS empresa_motorista,
  NULL::text                       AS status_motorista,
  NULL::text                       AS area
FROM public.motorista_blixx mb
LEFT JOIN public.veiculo_blixx vb
  ON vb.motorista_blixx_id = mb.motorista_blixx_id
WHERE mb.funcao = 'Agregado'::text;

COMMENT ON VIEW public.vw_agregados_blixx IS 'Agregados Blixx (account 53) com aliases compativeis com vw_agregados_completo.';

-- ---------------------------------------------------------
-- vw_contratados_blixx (sem filtro fixo de funcao; UI aplica st_cadastro/funcao)
-- ---------------------------------------------------------
CREATE OR REPLACE VIEW public.vw_contratados_blixx AS
SELECT
  mb.motorista_blixx_id  AS motorista_id,
  mb.nome                AS nome_motorista,
  mb.cpf,
  mb.dt_nascimento,
  mb.genero,
  mb.telefone,
  mb.email,
  mb.funcao,
  mb.st_cadastro,
  mb.company_id,
  mb.data_cadastro,
  mb.ativo,
  NULL::integer          AS cliente_id,
  NULL::text             AS nome_cidade,
  vb.veiculo_blixx_id    AS veiculo_id,
  vb.placa,
  vb.status_veiculo,
  vb.marca               AS marca_veiculo,
  vb.tipologia,
  vb.tipo,
  vb.bau
FROM public.motorista_blixx mb
LEFT JOIN public.veiculo_blixx vb
  ON vb.motorista_blixx_id = mb.motorista_blixx_id;

COMMENT ON VIEW public.vw_contratados_blixx IS 'Contratados Blixx (account 53) com aliases compativeis com vw_contratados_completo.';

-- ---------------------------------------------------------
-- inativos_list_page_blixx (mesma assinatura da inativos_list_page;
-- filtro de marcadores e no-op pois blixx nao usa associacao_tags)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inativos_list_page_blixx(
  p_company_id integer,
  p_search text default '',
  p_funcao text default 'todos',
  p_tag_ids bigint[] default array[]::bigint[],
  p_tag_mode text default 'none',
  p_limit integer default 50,
  p_offset integer default 0
)
returns json
language plpgsql
stable
set search_path = public
as $$
declare
  result json;
  lim int := greatest(coalesce(p_limit, 50), 1);
  off int := greatest(coalesce(p_offset, 0), 0);
begin
  with filtered as (
    select
      mb.motorista_blixx_id as motorista_id,
      mb.nome as nome_motorista,
      mb.cpf,
      mb.telefone,
      mb.email,
      mb.funcao,
      mb.st_cadastro,
      mb.ativo,
      mb.data_cadastro
    from motorista_blixx mb
    where
      mb.company_id = p_company_id
      and mb.ativo is false
      and (p_funcao = 'todos' or mb.funcao = p_funcao)
      and (
        coalesce(trim(p_search), '') = ''
        or mb.nome ilike '%' || trim(p_search) || '%'
        or mb.cpf ilike '%' || trim(p_search) || '%'
        or (
          mb.telefone is not null
          and mb.telefone::text ilike '%' || trim(p_search) || '%'
        )
      )
  ),
  page_rows as (
    select
      f.motorista_id,
      f.nome_motorista,
      f.cpf,
      f.telefone,
      f.email,
      f.funcao,
      f.st_cadastro,
      f.ativo
    from filtered f
    order by f.data_cadastro desc nulls last, f.motorista_id desc
    limit lim
    offset off
  )
  select json_build_object(
    'total_count', (select (count(*)::bigint) from filtered),
    'rows', coalesce(
      (select json_agg(row_to_json(p)) from page_rows p),
      '[]'::json
    )
  )
  into result;

  return result;
end;
$$;

comment on function public.inativos_list_page_blixx(integer, text, text, bigint[], text, integer, integer)
  is 'Pagina agregados inativos Blixx (account 53). Mesma assinatura de inativos_list_page; filtro de marcadores e ignorado.';

grant execute on function public.inativos_list_page_blixx(integer, text, text, bigint[], text, integer, integer)
  to anon, authenticated;
