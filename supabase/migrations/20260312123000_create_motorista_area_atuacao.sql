-- Tabela relacional para múltiplas áreas de atuação por motorista (agregado)

create table if not exists public.motorista_area_atuacao (
  id serial primary key,
  motorista_id integer not null references public.motorista(motorista_id) on delete cascade,
  company_id integer,
  area text not null,
  created_at timestamp with time zone default now(),
  unique (motorista_id, area)
);

