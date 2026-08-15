-- ============================================================================
-- M13 — [ALTO] XP, Creditos OPE e Loja (sistema server-authoritative)
-- ----------------------------------------------------------------------------
-- Implementa o ecossistema de recompensas do PDF "Sistema de XP e Loja OPE
-- Club" (V1):
--
--   * XP ............ reputacao perpetua. Nunca e gasto. Evolui nivel/selo.
--   * Creditos OPE .. unica moeda debitalvel (resgates da Loja).
--   * Loja .......... catalogo permanente, frete gratis, tempo minimo de
--                     assinatura validado no banco e NUNCA exibido na UI.
--
-- Principios:
--   1. O banco e a fonte da verdade. O cliente so dispara RPCs; nunca grava
--      saldo. O ledger (private.wallet_ledger) e a verdade; `profiles.xp` e
--      `profiles.credits` sao cache de leitura atualizados na MESMA transacao.
--   2. Limites diarios idempotentes por chave (user_id, metric, day_key).
--   3. Teto duro de atividade: XP <= 120/dia e Creditos <= 30/dia para
--      acoes cotidianas (login, leitura, post, comentario, curtida). Missoes
--      e indicacao tem limites proprios e NAO contam para o teto.
--   4. Anti-fraude: leitura so credita com interacao; comentarios repetitivos
--      ignorados; curtidas reciproca/em massa ignoradas; spam_revert admin.
--
-- Padrao de seguranca (mesmo do repo): helpers `private.*` SECURITY DEFINER
-- com search_path='' + wrappers `public.*` SECURITY INVOKER. Tabelas internas
-- no schema `private` sem grant publico.
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. Schema privado (idempotente; ja existe via migracoes anteriores)
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1. Perfil: saldo denormalizado + codigo de indicacao
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists xp integer not null default 0,
  add column if not exists credits integer not null default 0,
  add column if not exists referral_code text;

-- ---------------------------------------------------------------------------
-- 2. Ledger (fonte de verdade) + contadores de limite + streak
-- ---------------------------------------------------------------------------
create table if not exists private.wallet_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  currency text not null check (currency in ('xp','credit')),
  amount integer not null,
  reason text not null check (reason in (
    'login','reading','post','comment','like_received',
    'daily_mission','weekly_mission','referral',
    'redeem','spam_reversal','manual'
  )),
  source_ref text,
  day_key date not null,
  created_at timestamptz not null default now()
);
create index if not exists wallet_ledger_user_day on private.wallet_ledger(user_id, day_key);
create index if not exists wallet_ledger_user_currency on private.wallet_ledger(user_id, currency, created_at);

create table if not exists private.wallet_counters (
  user_id uuid not null,
  metric text not null,
  count integer not null default 0,
  day_key date not null,
  primary key (user_id, metric, day_key)
);

create table if not exists private.login_streak (
  user_id uuid primary key,
  current integer not null default 0,
  best integer not null default 0,
  last_day date
);

revoke all on table private.wallet_ledger from public, anon, authenticated;
revoke all on table private.wallet_counters from public, anon, authenticated;
revoke all on table private.login_streak from public, anon, authenticated;
grant select, insert, update, delete on table private.wallet_ledger to service_role;
grant select, insert, update, delete on table private.wallet_counters to service_role;
grant select, insert, update, delete on table private.login_streak to service_role;

-- ---------------------------------------------------------------------------
-- 3. Loja e indicacoes (schema public, com RLS)
-- ---------------------------------------------------------------------------
create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null check (category in ('book','book_premium','boxes','oversized','hoodie','moletom','exclusive')),
  credits_cost integer not null check (credits_cost > 0),
  real_price numeric default 0,
  min_months_active numeric(4,1) not null default 0,
  image_url text,
  images jsonb default '[]'::jsonb,
  active boolean not null default true,
  external_sku text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shop_products_active on public.shop_products(active);

drop trigger if exists trg_shop_products_updated_at on public.shop_products;
create trigger trg_shop_products_updated_at before update on public.shop_products
  for each row execute function public.touch_updated_at();

create table if not exists public.shop_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.shop_products(id),
  credits_spent integer not null,
  status text not null default 'pending'
    check (status in ('pending','processing','shipped','fulfilled','rejected','refunded')),
  customer_name text,
  customer_email text,
  address_json jsonb,
  tracking_code text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shop_redemptions_user on public.shop_redemptions(user_id, created_at desc);

drop trigger if exists trg_shop_redemptions_updated_at on public.shop_redemptions;
create trigger trg_shop_redemptions_updated_at before update on public.shop_redemptions
  for each row execute function public.touch_updated_at();

create table if not exists public.referrals (
  referrer_user_id uuid not null references public.profiles(id) on delete cascade,
  referred_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  rewarded_at timestamptz,
  primary key (referrer_user_id, referred_user_id)
);

-- RLS ----------------------------------------------------------------------
alter table public.shop_products enable row level security;
alter table public.shop_redemptions enable row level security;
alter table public.referrals enable row level security;

-- Catalogo: leitura livre; escrita somente admin.
drop policy if exists "shop_products_read" on public.shop_products;
create policy "shop_products_read"
  on public.shop_products for select
  to anon, authenticated
  using (true);

drop policy if exists "shop_products_admin_write" on public.shop_products;
create policy "shop_products_admin_write"
  on public.shop_products for insert
  to authenticated
  with check ((select private.is_admin()));

drop policy if exists "shop_products_admin_update" on public.shop_products;
create policy "shop_products_admin_update"
  on public.shop_products for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "shop_products_admin_delete" on public.shop_products;
create policy "shop_products_admin_delete"
  on public.shop_products for delete
  to authenticated
  using ((select private.is_admin()));

-- Resgates: SELECT proprio ou admin. INSERT apenas via RPC redeem_product
-- (SECURITY DEFINER) — o cliente NAO insere resgate direto (evita bypass do
-- debito de creditos). UPDATE/DELETE admin.
drop policy if exists "shop_redemptions_read_own_or_admin" on public.shop_redemptions;
create policy "shop_redemptions_read_own_or_admin"
  on public.shop_redemptions for select
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "shop_redemptions_admin_update" on public.shop_redemptions;
create policy "shop_redemptions_admin_update"
  on public.shop_redemptions for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "shop_redemptions_admin_delete" on public.shop_redemptions;
create policy "shop_redemptions_admin_delete"
  on public.shop_redemptions for delete
  to authenticated
  using ((select private.is_admin()));

-- Indicacoes: INSERT registra o proprio convite (referred_user_id = auth.uid()).
-- rewarded_at so via RPC referral_claim. SELECT das proprias relacoes.
drop policy if exists "referrals_insert_own" on public.referrals;
create policy "referrals_insert_own"
  on public.referrals for insert
  to authenticated
  with check (referred_user_id = (select auth.uid()));

drop policy if exists "referrals_read_own" on public.referrals;
create policy "referrals_read_own"
  on public.referrals for select
  to authenticated
  using (
    referrer_user_id = (select auth.uid())
    or referred_user_id = (select auth.uid())
    or (select private.is_admin())
  );

-- Grants PostgREST (RLS decide as linhas). Sem INSERT em shop_redemptions:
-- resgate passa 100% pelo RPC.
grant select on public.shop_products to anon, authenticated;
grant insert, update, delete on public.shop_products to authenticated;

grant select, update, delete on public.shop_redemptions to authenticated;

grant select, insert on public.referrals to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Helpers privados (SECURITY DEFINER, search_path='')
-- ---------------------------------------------------------------------------

-- Curva de nivel deterministica: cumulative XP para alcancar o nivel.
-- xp_threshold(1)=0, (2)=100, (3)=~303, (4)=~580, (5)=~920... (100·n^1.6).
create or replace function private.xp_threshold(p_level integer)
returns bigint
language sql
immutable
security definer
set search_path = ''
as $function$
  select case
    when p_level <= 1 then 0
    else round(100 * power(p_level - 1, 1.6))::bigint
  end;
$function$;

create or replace function private.level_from_xp(p_xp bigint)
returns integer
language plpgsql
immutable
security definer
set search_path = ''
as $function$
declare
  v_level integer := 1;
begin
  while v_level < 200 and private.xp_threshold(v_level + 1) <= coalesce(p_xp, 0) loop
    v_level := v_level + 1;
  end loop;
  return v_level;
end;
$function$;

-- Totais de atividade do dia (respeitam o teto 120xp/30cr).
create or replace function private.day_activity_totals(p_user_id uuid, p_day date)
returns table (xp bigint, credits bigint)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    coalesce(sum(amount) filter (where currency = 'xp'), 0)::bigint,
    coalesce(sum(amount) filter (where currency = 'credit'), 0)::bigint
  from private.wallet_ledger
  where user_id = p_user_id
    and day_key = p_day
    and reason in ('login','reading','post','comment','like_received');
$function$;

-- Incrementa contador diario e devolve o novo valor.
create or replace function private.bump_counter(p_user_id uuid, p_metric text, p_day date, p_increment integer default 1)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer;
begin
  insert into private.wallet_counters(user_id, metric, count, day_key)
  values (p_user_id, p_metric, p_increment, p_day)
  on conflict (user_id, metric, day_key)
  do update set count = private.wallet_counters.count + excluded.count
  returning count into v_count;
  return v_count;
end;
$function$;

create or replace function private.get_counter(p_user_id uuid, p_metric text, p_day date)
returns integer
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce((
    select count from private.wallet_counters
    where user_id = p_user_id and metric = p_metric and day_key = p_day
  ), 0);
$function$;

-- Concede XP/creditos com ledger + saldo na mesma transacao. Aplica teto de
-- atividade quando p_skip_cap=false. Devia false se nada foi concedido.
create or replace function private.award_both(
  p_user_id uuid,
  p_xp integer,
  p_credits integer,
  p_reason text,
  p_source_ref text default null,
  p_skip_cap boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_day date := current_date;
  v_xp integer := coalesce(p_xp, 0);
  v_cr integer := coalesce(p_credits, 0);
  v_tot record;
begin
  if p_user_id is null then return false; end if;

  if not p_skip_cap then
    select * into v_tot from private.day_activity_totals(p_user_id, v_day);
    v_xp := least(v_xp, greatest(0, 120 - v_tot.xp));
    v_cr := least(v_cr, greatest(0, 30 - v_tot.credits));
  end if;

  if v_xp > 0 then
    insert into private.wallet_ledger(user_id, currency, amount, reason, source_ref, day_key)
    values (p_user_id, 'xp', v_xp, p_reason, p_source_ref, v_day);
  end if;
  if v_cr > 0 then
    insert into private.wallet_ledger(user_id, currency, amount, reason, source_ref, day_key)
    values (p_user_id, 'credit', v_cr, p_reason, p_source_ref, v_day);
  end if;

  if v_xp = 0 and v_cr = 0 then return false; end if;

  update public.profiles
     set xp = xp + v_xp,
         credits = credits + v_cr
   where id = p_user_id;
  return true;
end;
$function$;

-- Meses de assinatura ativa (para o tempo minimo da Loja).
create or replace function private.active_months(p_user_id uuid)
returns numeric(4,1)
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce((
    select floor(extract(epoch from (now() - min(coalesce(s.current_period_start, s.created_at)))) / 86400 / 30 * 10) / 10
    from public.subscriptions s
    where s.user_id = p_user_id
      and s.status = 'active'
      and (s.current_period_end is null or s.current_period_end > now())
  ), 0)::numeric(4,1);
$function$;

-- Quem pode ser alvo da recompensa: o proprio ou admin.
create or replace function private.can_target(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select auth.uid()) = p_user_id or private.is_admin();
$function$;

-- Comentario repetitivo (mesmo texto, mesmas 24h) -> ignora recompensa.
create or replace function private.is_repetitive_comment(p_user_id uuid, p_text text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.post_replies r
    where r.user_id = p_user_id
      and r.created_at > now() - interval '24 hours'
      and lower(btrim(r.text)) = lower(btrim(coalesce(p_text, '')))
  )
  or exists (
    select 1 from public.book_page_comments c
    where c.user_id = p_user_id
      and c.created_at > now() - interval '24 hours'
      and lower(btrim(c.text)) = lower(btrim(coalesce(p_text, '')))
  );
$function$;

-- Curtidas legitimas de hoje: exclui reciproca (24h) e curtiu em massa (>=5
-- posts do dono na ultima hora).
create or replace function private.likes_received_today(p_owner_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $function$
  select count(*)
  from public.post_likes pl
  join public.posts p on p.id = pl.post_id
  where p.user_id = p_owner_id
    and pl.user_id <> p_owner_id
    and pl.created_at >= current_date
    and not exists (
      select 1 from public.post_likes r
      join public.posts rp on rp.id = r.post_id
      where r.user_id = p_owner_id
        and rp.user_id = pl.user_id
        and r.created_at > now() - interval '24 hours'
    )
    and not exists (
      select 1 from (
        select m.user_id
        from public.post_likes m
        join public.posts mp on mp.id = m.post_id
        where mp.user_id = p_owner_id
          and m.created_at > now() - interval '1 hour'
        group by m.user_id
        having count(*) >= 5
      ) mass_liker
      where mass_liker.user_id = pl.user_id
    );
$function$;

-- Snapshot completo da carteira para a UI.
create or replace function private.wallet_state_core(p_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_profile public.profiles%rowtype;
  v_level integer;
  v_cur bigint;
  v_next bigint;
  v_streak record;
  v_today record;
  v_week_start date := date_trunc('week', current_date)::date;
begin
  select * into v_profile from public.profiles where id = p_uid;
  if v_profile.id is null then return null; end if;

  v_level := private.level_from_xp(v_profile.xp);
  v_cur := private.xp_threshold(v_level);
  v_next := private.xp_threshold(v_level + 1);

  select * into v_streak from private.login_streak where user_id = p_uid;
  select * into v_today from private.day_activity_totals(p_uid, current_date);

  return jsonb_build_object(
    'xp', v_profile.xp,
    'credits', v_profile.credits,
    'level', v_level,
    'levelXp', v_cur,
    'nextLevelXp', v_next,
    'levelProgress', case
      when v_next > v_cur then (v_profile.xp - v_cur)::float / (v_next - v_cur)
      else 1.0
    end,
    'streak', jsonb_build_object(
      'current', coalesce(v_streak.current, 0),
      'best', coalesce(v_streak.best, 0),
      'lastDay', coalesce(v_streak.last_day::text, null)
    ),
    'today', jsonb_build_object(
      'xp', v_today.xp,
      'credits', v_today.credits,
      'login', private.get_counter(p_uid, 'login', current_date),
      'readingSec', private.get_counter(p_uid, 'reading_sec', current_date),
      'reading15', private.get_counter(p_uid, 'reading_15min', current_date),
      'reading30', private.get_counter(p_uid, 'reading_30min', current_date),
      'post', private.get_counter(p_uid, 'post', current_date),
      'comment', private.get_counter(p_uid, 'comment', current_date),
      'likeReceived', private.get_counter(p_uid, 'like_received', current_date)
    ),
    'caps', jsonb_build_object('xp', 120, 'credits', 30),
    'missions', jsonb_build_object(
      'daily', jsonb_build_object(
        'done', private.get_counter(p_uid, 'daily_mission', current_date) >= 1,
        'objectives', jsonb_build_object(
          'login', private.get_counter(p_uid, 'login', current_date) >= 1,
          'reading30', private.get_counter(p_uid, 'reading_30min', current_date) >= 1,
          'post', private.get_counter(p_uid, 'post', current_date) >= 1,
          'comments', private.get_counter(p_uid, 'comment', current_date) >= 2
        )
      ),
      'weekly', jsonb_build_object(
        'done', private.get_counter(p_uid, 'weekly_mission', v_week_start) >= 1,
        'streakNeeded', 7
      )
    )
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- 5. RPCs publicos (SECURITY INVOKER) — a unica porta de escrita do cliente
-- ---------------------------------------------------------------------------

-- ============================ reward_login ================================
-- SECURITY DEFINER: grava em private.login_streak (sem grant publico).
create or replace function public.reward_login()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_day date := current_date;
  v_streak record;
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;

  -- Streak avanca uma vez por dia (dedupe pelo contador de login).
  if private.get_counter(v_uid, 'login', v_day) = 0 then
    insert into private.login_streak(user_id, current, best, last_day)
    values (v_uid, 1, 1, v_day)
    on conflict (user_id) do update set
      current = case
        when private.login_streak.last_day = v_day - 1 then private.login_streak.current + 1
        else 1
      end,
      best = greatest(
        private.login_streak.best,
        case when private.login_streak.last_day = v_day - 1 then private.login_streak.current + 1 else 1 end
      ),
      last_day = v_day
    returning current, best into v_streak;

    perform private.award_both(v_uid, 5, 1, 'login', null, false);
    perform private.bump_counter(v_uid, 'login', v_day);
  end if;

  return private.wallet_state_core(v_uid);
end;
$function$;

-- ========================= report_reading_session ==========================
-- Soma segundos interativos do dia. Marcos de 15min (+15/+5) e 30min (+15/+5)
-- concedidos uma vez por dia. Sem interacao (p_interacted=false) nao credita.
create or replace function public.report_reading_session(
  p_book_id uuid,
  p_seconds integer,
  p_interacted boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_day date := current_date;
  v_sec integer;
  v_total integer;
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;

  v_sec := greatest(0, least(coalesce(p_seconds, 0), 3600));
  if not coalesce(p_interacted, false) or v_sec = 0 then
    return private.wallet_state_core(v_uid);
  end if;

  v_total := private.bump_counter(v_uid, 'reading_sec', v_day, v_sec);

  if v_total >= 900 and private.get_counter(v_uid, 'reading_15min', v_day) = 0 then
    perform private.award_both(v_uid, 15, 5, 'reading', '15min', false);
    perform private.bump_counter(v_uid, 'reading_15min', v_day);
  end if;

  if v_total >= 1800 and private.get_counter(v_uid, 'reading_30min', v_day) = 0 then
    perform private.award_both(v_uid, 15, 5, 'reading', '30min', false);
    perform private.bump_counter(v_uid, 'reading_30min', v_day);
  end if;

  return private.wallet_state_core(v_uid);
end;
$function$;

-- =============================== reward_post ===============================
create or replace function public.reward_post(p_user_id uuid, p_source_ref text default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_day date := current_date;
begin
  if not private.can_target(p_user_id) then raise exception 'PERMISSAO_NEGADA'; end if;
  if private.get_counter(p_user_id, 'post', v_day) >= 2 then
    return private.wallet_state_core(p_user_id);
  end if;
  perform private.award_both(p_user_id, 20, 3, 'post', p_source_ref, false);
  perform private.bump_counter(p_user_id, 'post', v_day);
  return private.wallet_state_core(p_user_id);
end;
$function$;

-- ============================== reward_comment =============================
create or replace function public.reward_comment(p_user_id uuid, p_text text default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_day date := current_date;
begin
  if not private.can_target(p_user_id) then raise exception 'PERMISSAO_NEGADA'; end if;
  if private.get_counter(p_user_id, 'comment', v_day) >= 5 then
    return private.wallet_state_core(p_user_id);
  end if;
  if private.is_repetitive_comment(p_user_id, p_text) then
    return private.wallet_state_core(p_user_id);
  end if;
  perform private.award_both(p_user_id, 10, 2, 'comment', null, false);
  perform private.bump_counter(p_user_id, 'comment', v_day);
  return private.wallet_state_core(p_user_id);
end;
$function$;

-- ========================== reward_likes_received ==========================
-- Credita as curtidas legitimas do dia (ate 20). Idempotente: so concede o
-- delta entre o total legitimo e o que ja foi concedido.
create or replace function public.reward_likes_received(p_owner_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_day date := current_date;
  v_total bigint;
  v_rewarded integer;
  v_delta integer;
begin
  if not private.can_target(p_owner_id) then raise exception 'PERMISSAO_NEGADA'; end if;

  v_total := least(private.likes_received_today(p_owner_id), 20);
  v_rewarded := private.get_counter(p_owner_id, 'like_received', v_day);
  v_delta := (v_total - v_rewarded)::integer;
  if v_delta <= 0 then
    return private.wallet_state_core(p_owner_id);
  end if;

  perform private.award_both(p_owner_id, v_delta * 2, v_delta, 'like_received', null, false);
  perform private.bump_counter(p_owner_id, 'like_received', v_day, v_delta);
  return private.wallet_state_core(p_owner_id);
end;
$function$;

-- ========================== complete_daily_mission =========================
-- 4 objetivos: login, 30min de leitura, 1 reflexao, 2 comentarios.
create or replace function public.complete_daily_mission()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_day date := current_date;
  v_login integer := private.get_counter(v_uid, 'login', v_day);
  v_read30 integer := private.get_counter(v_uid, 'reading_30min', v_day);
  v_post integer := private.get_counter(v_uid, 'post', v_day);
  v_comment integer := private.get_counter(v_uid, 'comment', v_day);
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  if v_login < 1 or v_read30 < 1 or v_post < 1 or v_comment < 2 then
    return private.wallet_state_core(v_uid);
  end if;
  if private.get_counter(v_uid, 'daily_mission', v_day) >= 1 then
    return private.wallet_state_core(v_uid);
  end if;
  perform private.award_both(v_uid, 80, 15, 'daily_mission', null, true);
  perform private.bump_counter(v_uid, 'daily_mission', v_day);
  return private.wallet_state_core(v_uid);
end;
$function$;

-- ========================== complete_weekly_mission ========================
-- Streak de 7 dias consecutivos.
create or replace function public.complete_weekly_mission()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_week_start date := date_trunc('week', current_date)::date;
  v_streak record;
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  select * into v_streak from private.login_streak where user_id = v_uid;
  if coalesce(v_streak.current, 0) < 7 then
    return private.wallet_state_core(v_uid);
  end if;
  if private.get_counter(v_uid, 'weekly_mission', v_week_start) >= 1 then
    return private.wallet_state_core(v_uid);
  end if;
  perform private.award_both(v_uid, 200, 40, 'weekly_mission', null, true);
  perform private.bump_counter(v_uid, 'weekly_mission', v_week_start);
  return private.wallet_state_core(v_uid);
end;
$function$;

-- ============================== redeem_product =============================
-- Nucleo critico: valida assinatura ativa + tempo minimo + saldo (com lock),
-- debita, registra ledger e cria o pedido — tudo numa transacao.
-- SECURITY DEFINER: escreve em private.wallet_ledger e public.shop_redemptions
-- (que nao tem grant/INSERT policy); auth.uid() + is_admin() garantem o alvo.
create or replace function public.redeem_product(
  p_product_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_address jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_product public.shop_products%rowtype;
  v_redemption public.shop_redemptions%rowtype;
  v_ok boolean;
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;

  -- Rate limit anti-abuso (padrao existente do repo).
  if not (select allowed from public.check_api_rate_limit(
    md5(v_uid::text || ':redeem'), 'redeem', 10, 60
  )) then
    raise exception 'MUITAS_REQUISICOES';
  end if;

  select * into v_product from public.shop_products
  where id = p_product_id and active;

  if v_product.id is null then raise exception 'PRODUTO_NAO_ENCONTRADO'; end if;
  if not private.has_active_subscription() then raise exception 'ASSINATURA_INATIVA'; end if;
  if private.active_months(v_uid) < v_product.min_months_active then
    raise exception 'TEMPO_MINIMO_NAO_ATINGIDO';
  end if;

  -- Debito com lock na linha: evita corrida de duplo-clique.
  update public.profiles
     set credits = credits - v_product.credits_cost
   where id = v_uid and credits >= v_product.credits_cost
  returning true into v_ok;

  if coalesce(v_ok, false) = false then raise exception 'CREDITOS_INSUFICIENTES'; end if;

  insert into private.wallet_ledger(user_id, currency, amount, reason, source_ref, day_key)
  values (v_uid, 'credit', -v_product.credits_cost, 'redeem', v_product.id::text, current_date);

  insert into public.shop_redemptions(
    user_id, product_id, credits_spent, status,
    customer_name, customer_email, address_json
  )
  values (
    v_uid, v_product.id, v_product.credits_cost, 'pending',
    nullif(btrim(coalesce(p_customer_name, '')), ''),
    nullif(btrim(coalesce(p_customer_email, '')), ''),
    p_address
  )
  returning * into v_redemption;

  return jsonb_build_object(
    'redemption', to_jsonb(v_redemption),
    'wallet', private.wallet_state_core(v_uid)
  );
end;
$function$;

-- ============================== referral_claim =============================
-- O indicador (auth.uid()) reclama quando o convidado esteve ativo >=30 dias.
-- SECURITY DEFINER: atualiza public.referrals (sem UPDATE policy direto).
create or replace function public.referral_claim(p_referred_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_referral public.referrals%rowtype;
  v_min_start timestamptz;
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;

  select * into v_referral from public.referrals
  where referrer_user_id = v_uid and referred_user_id = p_referred_user_id;

  if v_referral.referred_user_id is null then raise exception 'INDICACAO_NAO_ENCONTRADA'; end if;
  if v_referral.rewarded_at is not null then
    return private.wallet_state_core(v_uid);
  end if;

  -- Convidado ativo: assinatura ativa com inicio ha >=30 dias.
  select min(coalesce(s.current_period_start, s.created_at)) into v_min_start
  from public.subscriptions s
  where s.user_id = p_referred_user_id
    and s.status = 'active'
    and (s.current_period_end is null or s.current_period_end > now());

  if v_min_start is null or v_min_start > now() - interval '30 days' then
    raise exception 'CONVIDADO_NAO_ATIVO_30D';
  end if;

  perform private.award_both(v_uid, 500, 100, 'referral', p_referred_user_id::text, true);

  update public.referrals
     set rewarded_at = now()
   where referrer_user_id = v_uid and referred_user_id = p_referred_user_id;

  return private.wallet_state_core(v_uid);
end;
$function$;

-- =========================== get_my_referral_code ==========================
-- SECURITY DEFINER: grava referral_code em public.profiles; o usuario comum
-- nao tem UPDATE nessa coluna (revogado abaixo).
create or replace function public.get_my_referral_code()
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_code text;
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;

  select referral_code into v_code from public.profiles where id = v_uid;
  if v_code is not null then return v_code; end if;

  v_code := substr(replace(v_uid::text, '-', ''), 1, 8);
  update public.profiles set referral_code = v_code where id = v_uid;
  return v_code;
end;
$function$;

-- ========================== register_referral ==============================
-- O convidado (auth.uid()) registra quem o indicou.
create or replace function public.register_referral(p_referrer_code text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_referrer uuid;
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  if nullif(btrim(coalesce(p_referrer_code, '')), '') is null then
    raise exception 'CODIGO_INVALIDO';
  end if;

  select id into v_referrer from public.profiles
  where referral_code = btrim(p_referrer_code) and id <> v_uid;

  if v_referrer is null then raise exception 'CODIGO_INVALIDO'; end if;

  insert into public.referrals(referrer_user_id, referred_user_id)
  values (v_referrer, v_uid)
  on conflict (referrer_user_id, referred_user_id) do nothing;

  return jsonb_build_object('ok', true);
end;
$function$;

-- ========================== spam_revert (admin) ============================
-- Reverte ganhos de atividade dos ultimos N dias e recalcula o saldo a partir
-- do ledger. Registra entries compensatorias de auditoria (spam_reversal).
-- SECURITY DEFINER: escreve em private.wallet_ledger (sem grant publico).
create or replace function public.spam_revert(p_user_id uuid, p_days integer default 7)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_xp bigint;
  v_cr bigint;
  v_day date := current_date;
begin
  if not private.is_admin() then raise exception 'PERMISSAO_NEGADA'; end if;
  p_days := greatest(1, least(coalesce(p_days, 7), 30));

  select
    coalesce(sum(amount) filter (where currency = 'xp' and amount > 0), 0)::bigint,
    coalesce(sum(amount) filter (where currency = 'credit' and amount > 0), 0)::bigint
  into v_xp, v_cr
  from private.wallet_ledger
  where user_id = p_user_id
    and created_at >= now() - (p_days || ' days')::interval
    and reason in ('login','reading','post','comment','like_received','daily_mission','weekly_mission');

  if v_xp > 0 then
    insert into private.wallet_ledger(user_id, currency, amount, reason, source_ref, day_key)
    values (p_user_id, 'xp', -v_xp::integer, 'spam_reversal', 'admin', v_day);
  end if;
  if v_cr > 0 then
    insert into private.wallet_ledger(user_id, currency, amount, reason, source_ref, day_key)
    values (p_user_id, 'credit', -v_cr::integer, 'spam_reversal', 'admin', v_day);
  end if;

  -- Recalcula saldo pelo ledger (fonte de verdade).
  update public.profiles p
     set xp = coalesce((select sum(amount) from private.wallet_ledger l
                        where l.user_id = p.id and l.currency = 'xp'), 0),
         credits = coalesce((select sum(amount) from private.wallet_ledger l
                             where l.user_id = p.id and l.currency = 'credit'), 0)
   where p.id = p_user_id;

  return jsonb_build_object('xpReverted', v_xp, 'creditsReverted', v_cr);
end;
$function$;

-- ============================== wallet_state ===============================
create or replace function public.wallet_state()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.wallet_state_core(auth.uid());
$function$;

-- ---------------------------------------------------------------------------
-- 6. Least privilege: grants dos RPCs publicos e helpers privados
-- ---------------------------------------------------------------------------
do $migration$
declare
  function_row record;
begin
  for function_row in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in (
        'xp_threshold','level_from_xp','day_activity_totals','bump_counter',
        'get_counter','award_both','active_months','can_target',
        'is_repetitive_comment','likes_received_today','wallet_state_core'
      )
  loop
    execute format('alter function %s set search_path = %L', function_row.signature, '');
    execute format('revoke all on function %s from public, anon, authenticated', function_row.signature);
    execute format('grant execute on function %s to authenticated, service_role', function_row.signature);
  end loop;
end
$migration$;

-- Publicos: so authenticated executa; revoga de public/anon.
do $migration$
declare
  function_row record;
begin
  for function_row in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'reward_login','report_reading_session','reward_post','reward_comment',
        'reward_likes_received','complete_daily_mission','complete_weekly_mission',
        'redeem_product','referral_claim','get_my_referral_code',
        'register_referral','spam_revert','wallet_state'
      )
  loop
    execute format('revoke all on function %s from public, anon', function_row.signature);
    execute format('grant execute on function %s to authenticated, service_role', function_row.signature);
  end loop;
end
$migration$;

-- ---------------------------------------------------------------------------
-- 6b. Seguranca: usuario autenticado NAO pode gravar saldo/codigo direto.
-- A migration adicionou xp/credits/referral_code em public.profiles, e a
-- policy profiles_update_own (0001_full.sql) ja dava UPDATE a propria linha.
-- Sem o revoke abaixo, qualquer cliente autenticado faria PATCH direto e
-- gravaria o proprio saldo, contornando o ledger RPC-authoritative.
-- Todas as escritas nessas colunas sao feitas por funcoes SECURITY DEFINER
-- acima (award_both/redeem_product/spam_revert/get_my_referral_code), que
-- rodam como owner e ignoram grants de coluna -> nao quebram.
-- ---------------------------------------------------------------------------
revoke update (xp, credits, referral_code) on public.profiles from authenticated;

-- ---------------------------------------------------------------------------
-- 7. Seed do catalogo (idempotente)
-- ---------------------------------------------------------------------------
insert into public.shop_products (name, description, category, credits_cost, min_months_active, image_url)
select 'Livro Fisico', 'Edicao simples do acervo, impressa e enviada para sua casa. Frete gratis.',
       'book', 450, 2.5, null
where not exists (select 1 from public.shop_products where name = 'Livro Fisico');

insert into public.shop_products (name, description, category, credits_cost, min_months_active, image_url)
select 'Livro Premium', 'Edicao premium com acabamento especial do acervo. Frete gratis.',
       'book_premium', 900, 5, null
where not exists (select 1 from public.shop_products where name = 'Livro Premium');

insert into public.shop_products (name, description, category, credits_cost, min_months_active, image_url)
select 'Oversized OPE Club', 'Camiseta oversized oficial da marca OPE Club. Frete gratis.',
       'oversized', 1800, 8, null
where not exists (select 1 from public.shop_products where name = 'Oversized OPE Club');

insert into public.shop_products (name, description, category, credits_cost, min_months_active, image_url)
select 'Moletom Oficial', 'Moletom oficial da OPE Club, edicao exclusiva. Frete gratis.',
       'hoodie', 2800, 12, null
where not exists (select 1 from public.shop_products where name = 'Moletom Oficial');

commit;
