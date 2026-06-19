-- =====================================================
-- Painel de Controle Blixx — Corrige RLS/grants da tabela real de contatos.
-- A migration anterior criou "blixx_contatos_automacao" (nome errado); a tabela
-- real é "blixx_contato_automacoes" e estava sem política de leitura para anon,
-- fazendo o lookup de contact_id retornar vazio (id "" no webhook).
-- Rode este SQL no SQL Editor do Supabase (idempotente).
-- =====================================================

alter table public.blixx_contato_automacoes enable row level security;

-- Privilégios de tabela (PostgREST exige além da policy).
grant select, insert, update, delete on public.blixx_contato_automacoes to anon, authenticated;

drop policy if exists "auth read blixx_contato_automacoes"   on public.blixx_contato_automacoes;
drop policy if exists "auth insert blixx_contato_automacoes" on public.blixx_contato_automacoes;
drop policy if exists "auth update blixx_contato_automacoes" on public.blixx_contato_automacoes;
drop policy if exists "auth delete blixx_contato_automacoes" on public.blixx_contato_automacoes;

create policy "auth read blixx_contato_automacoes"
  on public.blixx_contato_automacoes for select to anon, authenticated using (true);
create policy "auth insert blixx_contato_automacoes"
  on public.blixx_contato_automacoes for insert to anon, authenticated with check (true);
create policy "auth update blixx_contato_automacoes"
  on public.blixx_contato_automacoes for update to anon, authenticated using (true) with check (true);
create policy "auth delete blixx_contato_automacoes"
  on public.blixx_contato_automacoes for delete to anon, authenticated using (true);
