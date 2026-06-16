-- =====================================================
-- Painel de Controle Blixx — Cadastro próprio de contatos da automação
-- Tabela independente (sem FK para agendamento). O webhook busca-contatos
-- continua sendo consultado normalmente onde já é usado hoje.
-- Rode este SQL no SQL Editor do Supabase (idempotente).
-- =====================================================

create table if not exists public.blixx_contatos_automacao (
  id serial primary key,
  contact_id character varying(80) null,
  name text null,
  phone character varying(30) null
);

-- RLS: mesmo padrão dos demais módulos Blixx (leitura/escrita liberada para anon).
alter table public.blixx_contatos_automacao enable row level security;

drop policy if exists "auth read blixx_contatos_automacao"   on public.blixx_contatos_automacao;
drop policy if exists "auth insert blixx_contatos_automacao" on public.blixx_contatos_automacao;
drop policy if exists "auth update blixx_contatos_automacao" on public.blixx_contatos_automacao;
drop policy if exists "auth delete blixx_contatos_automacao" on public.blixx_contatos_automacao;

create policy "auth read blixx_contatos_automacao"
  on public.blixx_contatos_automacao for select to anon, authenticated using (true);
create policy "auth insert blixx_contatos_automacao"
  on public.blixx_contatos_automacao for insert to anon, authenticated with check (true);
create policy "auth update blixx_contatos_automacao"
  on public.blixx_contatos_automacao for update to anon, authenticated using (true) with check (true);
create policy "auth delete blixx_contatos_automacao"
  on public.blixx_contatos_automacao for delete to anon, authenticated using (true);
