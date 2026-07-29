-- OPE Club + AbacatePay
-- Rode no SQL Editor do Supabase.
-- Mantem a decisao de assinatura no banco/backend, nao no front-end.

create extension if not exists pgcrypto;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_email text,
  plan text not null default 'ope_club_monthly',
  status text not null default 'pending',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  provider text not null default 'manual_admin',
  provider_customer_id text,
  provider_subscription_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions
  add column if not exists customer_email text,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists canceled_at timestamptz,
  add column if not exists provider text not null default 'manual_admin',
  add column if not exists provider_customer_id text,
  add column if not exists provider_subscription_id text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.subscriptions
  drop constraint if exists subscriptions_status_check;

alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in ('pending', 'active', 'past_due', 'trialing', 'canceled', 'refunded', 'expired'));

alter table public.subscriptions
  drop constraint if exists subscriptions_plan_check;

alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (plan in ('ope_club_monthly', 'ope_club_annual'));

create index if not exists subscriptions_user_id_idx
  on public.subscriptions(user_id);

create index if not exists subscriptions_current_period_end_idx
  on public.subscriptions(current_period_end desc);

create index if not exists subscriptions_checkout_id_idx
  on public.subscriptions((metadata->>'checkout_id'));

-- Uma conta pode manter historico cancelado/expirado, mas so pode ter um fluxo
-- de assinatura aberto. A API atualiza a linha pending em novas tentativas.
alter table public.subscriptions
  drop constraint if exists unique_active_subscription;

drop index if exists public.unique_active_subscription;

create unique index unique_active_subscription
  on public.subscriptions(user_id)
  where status in ('pending', 'active', 'past_due', 'trialing');

create table if not exists public.abacatepay_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  checkout_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.abacatepay_webhook_events enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_select_own_or_admin" on public.subscriptions;
create policy "subscriptions_select_own_or_admin"
on public.subscriptions
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Assinaturas sao alteradas somente pelas APIs server-side usando service_role.
-- Nem mesmo o frontend de um administrador decide status, prazo ou plano.
drop policy if exists "subscriptions_admin_insert" on public.subscriptions;
drop policy if exists "subscriptions_admin_update" on public.subscriptions;
drop policy if exists "subscriptions_admin_delete" on public.subscriptions;

drop policy if exists "abacatepay_webhook_events_admin_select" on public.abacatepay_webhook_events;
create policy "abacatepay_webhook_events_admin_select"
on public.abacatepay_webhook_events
for select
to authenticated
using (public.is_admin());

-- O service role da API ignora RLS e e quem deve inserir eventos de webhook.
-- Usuarios comuns nao recebem policy de insert/update/delete nesta tabela.

-- Biblioteca privada: as tabelas guardam apenas o caminho do arquivo.
-- O binario fica no Supabase Storage, que e a area apropriada e segura para
-- imagens e PDFs. Nunca salve base64 ou binarios grandes nas tabelas.
alter table public.books
  add column if not exists image_path text,
  add column if not exists pdf_path text;

alter table public.authors
  add column if not exists image_path text;

alter table public.books enable row level security;
alter table public.authors enable row level security;

-- Ao apagar um autor, os livros permanecem no catalogo sem autor vinculado.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select c.conname
    from pg_constraint c
    join pg_class source_table on source_table.oid = c.conrelid
    join pg_namespace source_schema on source_schema.oid = source_table.relnamespace
    where c.contype = 'f'
      and source_schema.nspname = 'public'
      and source_table.relname = 'books'
      and pg_get_constraintdef(c.oid) ilike 'foreign key (author_id)%'
  loop
    execute format('alter table public.books drop constraint %I', constraint_row.conname);
  end loop;
end
$$;

alter table public.books alter column author_id drop not null;
alter table public.books
  add constraint books_author_id_fkey
  foreign key (author_id) references public.authors(id) on delete set null;

-- Recupera arquivos enviados por versoes antigas, que gravavam URL publica.
update public.books
set image_path = split_part(image, '/storage/v1/object/public/covers/', 2)
where image_path is null
  and image like '%/storage/v1/object/public/covers/%';

update public.books
set pdf_path = split_part(pdf_url, '/storage/v1/object/public/pdfs/', 2)
where pdf_path is null
  and pdf_url like '%/storage/v1/object/public/pdfs/%';

update public.authors
set image_path = split_part(image, '/storage/v1/object/public/covers/', 2)
where image_path is null
  and image like '%/storage/v1/object/public/covers/%';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'covers',
  'covers',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pdfs',
  'pdfs',
  false,
  52428800,
  array['application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.has_active_subscription()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = auth.uid()
      and s.status = 'active'
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;

create or replace function public.can_read_book_pdf(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or (
      public.has_active_subscription()
      and exists (
        select 1
        from public.books b
        where b.pdf_path = object_name
          and not exists (
            select 1
            from public.weekly_releases wr
            where wr.book_id = b.id
              and coalesce(wr.visible, true)
              and wr.release_date > current_date
          )
      )
    );
$$;

-- Somente administradores alteram o catalogo. A decisao fica no banco.
drop policy if exists "books_authenticated_select" on public.books;
create policy "books_authenticated_select"
on public.books for select to authenticated
using (true);

drop policy if exists "books_admin_insert" on public.books;
create policy "books_admin_insert"
on public.books for insert to authenticated
with check (public.is_admin());

drop policy if exists "books_admin_update" on public.books;
create policy "books_admin_update"
on public.books for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "books_admin_delete" on public.books;
create policy "books_admin_delete"
on public.books for delete to authenticated
using (public.is_admin());

drop policy if exists "authors_admin_insert" on public.authors;
drop policy if exists "authors_authenticated_select" on public.authors;
create policy "authors_authenticated_select"
on public.authors for select to authenticated
using (true);

create policy "authors_admin_insert"
on public.authors for insert to authenticated
with check (public.is_admin());

drop policy if exists "authors_admin_update" on public.authors;
create policy "authors_admin_update"
on public.authors for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "authors_admin_delete" on public.authors;
create policy "authors_admin_delete"
on public.authors for delete to authenticated
using (public.is_admin());

-- Capas e fotos: leitura autenticada por URL assinada; escrita somente admin.
-- Remove regras antigas desses dois buckets para nao deixar uma URL publica ou
-- um usuario comum contornar as novas regras.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        coalesce(qual, '') ilike '%covers%'
        or coalesce(with_check, '') ilike '%covers%'
        or coalesce(qual, '') ilike '%pdfs%'
        or coalesce(with_check, '') ilike '%pdfs%'
      )
  loop
    execute format('drop policy if exists %I on storage.objects', policy_row.policyname);
  end loop;
end
$$;

drop policy if exists "covers_authenticated_read" on storage.objects;
create policy "covers_authenticated_read"
on storage.objects for select to authenticated
using (bucket_id = 'covers');

drop policy if exists "covers_admin_insert" on storage.objects;
create policy "covers_admin_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'covers'
  and public.is_admin()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "covers_admin_update" on storage.objects;
create policy "covers_admin_update"
on storage.objects for update to authenticated
using (bucket_id = 'covers' and public.is_admin())
with check (bucket_id = 'covers' and public.is_admin());

drop policy if exists "covers_admin_delete" on storage.objects;
create policy "covers_admin_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'covers' and public.is_admin());

-- PDF: o Storage confirma plano ativo, data de lancamento e vinculo ao livro.
drop policy if exists "pdfs_authorized_read" on storage.objects;
create policy "pdfs_authorized_read"
on storage.objects for select to authenticated
using (bucket_id = 'pdfs' and public.can_read_book_pdf(name));

drop policy if exists "pdfs_admin_insert" on storage.objects;
create policy "pdfs_admin_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'pdfs'
  and public.is_admin()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "pdfs_admin_update" on storage.objects;
create policy "pdfs_admin_update"
on storage.objects for update to authenticated
using (bucket_id = 'pdfs' and public.is_admin())
with check (bucket_id = 'pdfs' and public.is_admin());

drop policy if exists "pdfs_admin_delete" on storage.objects;
create policy "pdfs_admin_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'pdfs' and public.is_admin());

-- Sugestoes / roadmap da comunidade.
create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  category text not null default 'Geral',
  status text not null default 'ideas',
  author_name text,
  comment_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suggestions_status_check check (status in ('ideas', 'reading', 'building', 'released')),
  constraint suggestions_title_length check (char_length(trim(title)) between 3 and 90),
  constraint suggestions_description_length check (char_length(description) <= 500)
);

alter table public.suggestions
  add column if not exists category text not null default 'Geral',
  add column if not exists author_name text,
  add column if not exists comment_count integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists suggestions_status_created_at_idx
  on public.suggestions(status, created_at desc);

create index if not exists suggestions_user_id_idx
  on public.suggestions(user_id);

alter table public.suggestions enable row level security;

drop policy if exists "suggestions_authenticated_select" on public.suggestions;
create policy "suggestions_authenticated_select"
on public.suggestions for select to authenticated
using (true);

drop policy if exists "suggestions_owner_insert" on public.suggestions;
create policy "suggestions_owner_insert"
on public.suggestions for insert to authenticated
with check (
  user_id = auth.uid()
  and status = 'ideas'
);

drop policy if exists "suggestions_owner_update_text" on public.suggestions;
drop policy if exists "suggestions_admin_update" on public.suggestions;
create policy "suggestions_admin_update"
on public.suggestions for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "suggestions_admin_delete" on public.suggestions;
create policy "suggestions_admin_delete"
on public.suggestions for delete to authenticated
using (public.is_admin());
