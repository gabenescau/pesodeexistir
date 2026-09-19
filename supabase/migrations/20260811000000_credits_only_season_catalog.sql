-- Season catalog and credits-only rewards.
-- XP remains as a legacy column for compatibility with old records/RPCs, but
-- no new XP is awarded or shown by the application.

begin;

alter table public.shop_products
  add column if not exists season_id uuid;

do $migration$
begin
  if to_regclass('public.seasons') is not null
     and not exists (
       select 1 from pg_constraint
        where conrelid = 'public.shop_products'::regclass
          and conname = 'shop_products_season_id_fkey'
     ) then
    alter table public.shop_products
      add constraint shop_products_season_id_fkey
      foreign key (season_id) references public.seasons(id) on delete set null;
  end if;
end
$migration$;

create index if not exists shop_products_season_active_lookup
  on public.shop_products(season_id, active, credits_cost);

-- Use a transparent baseline of R$0.10 per credit. Existing real-priced
-- products are raised to the baseline before the server-side guard is added.
update public.shop_products
   set credits_cost = greatest(credits_cost, ceil(coalesce(real_price, 0) * 10)::integer)
 where coalesce(real_price, 0) > 0;

alter table public.orders
  drop constraint if exists orders_real_price_required;
alter table public.orders
  add constraint orders_real_price_required
  check (payment_method <> 'real' or coalesce(real_price, 0) > 0);

create or replace function private.validate_shop_product_pricing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_real numeric := greatest(0, coalesce(new.real_price, 0));
  v_credits integer := greatest(1, coalesce(new.credits_cost, 0));
begin
  if char_length(btrim(coalesce(new.name, ''))) < 2 then
    raise exception 'NOME_PRODUTO_INVALIDO';
  end if;
  if v_real > 0 and v_credits < ceil(v_real * 10)::integer then
    raise exception 'CREDITOS_ABAIXO_DO_VALOR_MINIMO'
      using hint = 'Use pelo menos 10 creditos por real do preco em dinheiro.';
  end if;
  new.real_price := v_real;
  new.credits_cost := v_credits;
  return new;
end;
$function$;

drop trigger if exists trg_validate_shop_product_pricing on public.shop_products;
create trigger trg_validate_shop_product_pricing
before insert or update of name, real_price, credits_cost on public.shop_products
for each row execute function private.validate_shop_product_pricing();

revoke all on function private.validate_shop_product_pricing() from public, anon, authenticated;
grant execute on function private.validate_shop_product_pricing() to service_role;

-- The old reward entry points remain callable so existing clients do not
-- break, but the server ignores XP and applies a lower daily credit cap.
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
  v_cr integer := greatest(0, coalesce(p_credits, 0));
  v_tot record;
begin
  if p_user_id is null then return false; end if;

  if not p_skip_cap then
    select * into v_tot from private.day_activity_totals(p_user_id, v_day);
    v_cr := least(v_cr, greatest(0, 20 - v_tot.credits));
  end if;

  if v_cr <= 0 then return false; end if;

  insert into private.wallet_ledger(user_id, currency, amount, reason, source_ref, day_key)
  values (p_user_id, 'credit', v_cr, p_reason, p_source_ref, v_day);

  update public.profiles
     set credits = credits + v_cr
   where id = p_user_id;
  return true;
end;
$function$;

-- Public, intentionally limited leaderboard of current credit balances.
create or replace function private.credits_ranking(p_limit integer default 10)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 50);
  v_list jsonb;
  v_me jsonb;
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;

  with ranked as (
    select p.id, p.name, p.username, p.avatar, p.avatar_url, p.credits,
           row_number() over (order by p.credits desc, p.created_at asc, p.id) as rank
      from public.profiles p
     where coalesce(p.private_profile, false) = false or p.id = v_uid
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', id,
    'name', coalesce(nullif(name, ''), 'Membro OPE'),
    'handle', coalesce(username, ''),
    'avatar', coalesce(avatar_url, avatar, ''),
    'credits', credits,
    'rank', rank,
    'is_me', id = v_uid
  ) order by rank), '[]'::jsonb)
    into v_list
    from ranked
   where rank <= v_limit;

  with ranked as (
    select p.id, p.name, p.username, p.avatar, p.avatar_url, p.credits,
           row_number() over (order by p.credits desc, p.created_at asc, p.id) as rank
      from public.profiles p
     where coalesce(p.private_profile, false) = false or p.id = v_uid
  )
  select case when id is null then null else jsonb_build_object(
    'user_id', id,
    'name', coalesce(nullif(name, ''), 'Membro OPE'),
    'handle', coalesce(username, ''),
    'avatar', coalesce(avatar_url, avatar, ''),
    'credits', credits,
    'rank', rank,
    'is_me', true
  ) end into v_me
    from ranked where id = v_uid;

  return jsonb_build_object('list', v_list, 'me', v_me);
end;
$function$;

create or replace function public.credits_ranking(p_limit integer default 10)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.credits_ranking($1);
$function$;

revoke all on function public.credits_ranking(integer) from public, anon;
grant execute on function public.credits_ranking(integer) to authenticated, service_role;

commit;
