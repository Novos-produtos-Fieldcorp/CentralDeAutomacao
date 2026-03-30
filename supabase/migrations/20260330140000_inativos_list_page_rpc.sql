-- Listagem paginada de inativos (motorista.ativo = false) com busca, função e filtro de marcadores no banco.
-- Evita carregar milhares de linhas no cliente e evita centenas de requests em associacao_tags.
-- Retorna JSON { total_count, rows } para total correto mesmo quando rows vem vazio (página além do fim ou zero resultados).

create or replace function public.inativos_list_page(
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
      m.motorista_id,
      m.nome as nome_motorista,
      m.cpf,
      m.telefone,
      m.email,
      m.funcao,
      m.st_cadastro,
      m.ativo,
      m.data_cadastro
    from motorista m
    where
      m.company_id = p_company_id
      and m.ativo is false
      and (p_funcao = 'todos' or m.funcao = p_funcao)
      and (
        coalesce(trim(p_search), '') = ''
        or m.nome ilike '%' || trim(p_search) || '%'
        or m.cpf ilike '%' || trim(p_search) || '%'
        or (
          m.telefone is not null
          and m.telefone::text ilike '%' || trim(p_search) || '%'
        )
      )
      and (
        p_tag_mode = 'none'
        or coalesce(cardinality(p_tag_ids), 0) = 0
        or (
          p_tag_mode = 'contains'
          and exists (
            select 1
            from associacao_tags at
            where
              at.motorista_id = m.motorista_id
              and at.tag_id = any (p_tag_ids)
          )
        )
        or (
          p_tag_mode = 'not_contains'
          and not exists (
            select 1
            from associacao_tags at
            where
              at.motorista_id = m.motorista_id
              and at.tag_id = any (p_tag_ids)
          )
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

comment on function public.inativos_list_page(integer, text, text, bigint[], text, integer, integer)
  is 'Pagina motoristas inativos com busca (nome/cpf/telefone), funcao e filtro por marcadores (contains/not_contains). Retorna { total_count, rows }.';

grant execute on function public.inativos_list_page(integer, text, text, bigint[], text, integer, integer)
  to anon, authenticated;

-- Acelera filtros por empresa + inativos e joins por marcador
create index if not exists idx_motorista_company_ativo_cadastro
  on public.motorista (company_id, ativo, data_cadastro desc nulls last)
  where ativo is false;

create index if not exists idx_associacao_tags_tag_motorista
  on public.associacao_tags (tag_id, motorista_id);
