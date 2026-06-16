-- Tabela de agendamentos de automações do Painel de Controle Blixx.
-- (referência/documentação — aplicada manualmente no SQL Editor)
--
-- Schema-base fornecido + colunas de agendamento. As colunas
-- session/chatid/typebotsessionid eram NOT NULL sem default e não fazem
-- sentido para um agendamento, então recebem DEFAULT '' para permitir
-- inserir agendamentos sem elas.
create table if not exists public.blixx_automacoes (
  id serial not null,
  session character varying(50) not null default '',
  chatid character varying(80) not null default '',
  typebotsessionid character varying(80) not null default '',
  created_at timestamp without time zone not null default now(),
  is_active boolean null default false,
  -- colunas de agendamento
  company_id integer null,
  automacao_name text null,                  -- typebot_name enviado no payload
  data_inicio date null,                     -- YYYY-MM-DD (Brasília)
  horario varchar(5) null,                   -- HH:mm em UTC (padrão grupo_resumo)
  contatos jsonb null default '[]'::jsonb,   -- [{ id, name, phone }]
  disparado_em timestamp without time zone null,
  constraint blixx_automacoes_pkey primary key (id)
) TABLESPACE pg_default;

create index if not exists idx_blixx_automacoes_ativo on public.blixx_automacoes (is_active);
create index if not exists idx_blixx_automacoes_company on public.blixx_automacoes (company_id);

-- RLS: mesmo padrão dos demais módulos Blixx (leitura/escrita liberada para anon,
-- isolamento feito por company_id na query do frontend). Sem isto o insert pelo
-- frontend (role anon) retorna 401 Unauthorized.
alter table public.blixx_automacoes enable row level security;

drop policy if exists "auth read blixx_automacoes"   on public.blixx_automacoes;
drop policy if exists "auth insert blixx_automacoes" on public.blixx_automacoes;
drop policy if exists "auth update blixx_automacoes" on public.blixx_automacoes;
drop policy if exists "auth delete blixx_automacoes" on public.blixx_automacoes;

create policy "auth read blixx_automacoes"
  on public.blixx_automacoes for select to anon, authenticated using (true);
create policy "auth insert blixx_automacoes"
  on public.blixx_automacoes for insert to anon, authenticated with check (true);
create policy "auth update blixx_automacoes"
  on public.blixx_automacoes for update to anon, authenticated using (true) with check (true);
create policy "auth delete blixx_automacoes"
  on public.blixx_automacoes for delete to anon, authenticated using (true);
