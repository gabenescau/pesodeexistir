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
  check (status in ('pending', 'active', 'past_due', 'canceled', 'refunded', 'expired'));

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

drop policy if exists "subscriptions_admin_insert" on public.subscriptions;
create policy "subscriptions_admin_insert"
on public.subscriptions
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "subscriptions_admin_update" on public.subscriptions;
create policy "subscriptions_admin_update"
on public.subscriptions
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "subscriptions_admin_delete" on public.subscriptions;
create policy "subscriptions_admin_delete"
on public.subscriptions
for delete
to authenticated
using (public.is_admin());

drop policy if exists "abacatepay_webhook_events_admin_select" on public.abacatepay_webhook_events;
create policy "abacatepay_webhook_events_admin_select"
on public.abacatepay_webhook_events
for select
to authenticated
using (public.is_admin());

-- O service role da API ignora RLS e e quem deve inserir eventos de webhook.
-- Usuarios comuns nao recebem policy de insert/update/delete nesta tabela.
