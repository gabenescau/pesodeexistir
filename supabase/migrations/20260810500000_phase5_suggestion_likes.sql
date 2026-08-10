-- Fase 5: curtidas de sugestoes persistentes e protegidas por RLS.

begin;

create table if not exists public.suggestion_likes (
  suggestion_id uuid not null references public.suggestions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (suggestion_id, user_id)
);

alter table public.suggestion_likes enable row level security;
revoke all on table public.suggestion_likes from public, anon;
grant select, insert, delete on table public.suggestion_likes to authenticated;

drop policy if exists suggestion_likes_select_own on public.suggestion_likes;
create policy suggestion_likes_select_own
  on public.suggestion_likes for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists suggestion_likes_insert_own on public.suggestion_likes;
create policy suggestion_likes_insert_own
  on public.suggestion_likes for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists suggestion_likes_delete_own on public.suggestion_likes;
create policy suggestion_likes_delete_own
  on public.suggestion_likes for delete to authenticated
  using (user_id = (select auth.uid()));

create index if not exists suggestion_likes_user_idx
  on public.suggestion_likes(user_id, created_at desc);

create or replace view public.suggestion_like_counts
with (security_invoker = true)
as
select suggestion_id, count(*)::integer as like_count
from public.suggestion_likes
group by suggestion_id;

revoke all on public.suggestion_like_counts from public, anon;
grant select on public.suggestion_like_counts to authenticated, service_role;

commit;
