create table if not exists notas (
  id uuid primary key default gen_random_uuid(),
  contenido text not null,
  categoria text not null default 'general',
  resuelta boolean not null default false,
  created_at timestamptz not null default now()
);

alter table notas enable row level security;
create policy "service role full access" on notas for all using (true) with check (true);
