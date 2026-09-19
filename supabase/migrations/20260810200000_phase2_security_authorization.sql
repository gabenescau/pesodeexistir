-- Fase 2: seguranca, autorizacao, RPCs e Storage.
-- Aplicar depois das migrations da Fase 1.

begin;

-- Rate limit server-side: somente as Functions Vercel usam esta RPC com
-- service_role. O navegador nunca deve conseguir escolher chave, limite ou
-- escopo diretamente.
create or replace function public.check_api_rate_limit(
  p_key_hash text,
  p_scope text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, remaining integer, reset_at bigint)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_window_start timestamptz;
  v_count integer;
  v_reset_at bigint;
begin
  if p_key_hash is null or p_key_hash !~ '^[a-f0-9]{64}$'
     or p_scope is null or p_scope !~ '^[a-z0-9:_-]{1,64}$'
     or p_limit is null or p_limit < 1 or p_limit > 10000
     or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'RATE_LIMIT_ARGUMENTS_INVALIDOS';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  v_reset_at := extract(
    epoch from (v_window_start + make_interval(secs => p_window_seconds))
  )::bigint;

  insert into public.api_rate_limits (key_hash, scope, window_start, request_count)
  values (p_key_hash, p_scope, v_window_start, 1)
  on conflict (key_hash, scope, window_start)
  do update set request_count = public.api_rate_limits.request_count + 1
  returning request_count into v_count;

  return query
  select v_count <= p_limit,
         greatest(0, p_limit - v_count),
         v_reset_at;
end;
$function$;

revoke all on function public.check_api_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.check_api_rate_limit(text, text, integer, integer)
  to service_role;

-- Todo SECURITY DEFINER precisa ter search_path imutavel. O revoke de anon
-- evita que funcoes antigas do schema public sejam expostas pelo PostgREST.
do $definer_hardening$
declare
  function_row record;
begin
  for function_row in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prosecdef
      and n.nspname in ('public', 'private')
  loop
    execute format('alter function %s set search_path = %L', function_row.signature, '');
    execute format('revoke execute on function %s from public, anon', function_row.signature);
  end loop;
end;
$definer_hardening$;

-- RPCs que o cliente autenticado usa continuam disponíveis para authenticated;
-- a própria funcao valida auth.uid(), ownership ou admin antes de alterar dados.
do $api_rpc_grants$
declare
  function_row record;
begin
  for function_row in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'current_role', 'list_public_profiles', 'redeem_product',
        'create_shop_order', 'referral_claim', 'get_my_referral_code',
        'register_referral', 'spam_revert', 'admin_list_referrals',
        'admin_confirm_referral', 'admin_cancel_referral',
        'reward_login', 'report_reading_session', 'reward_post',
        'reward_comment', 'reward_likes_received',
        'complete_daily_mission', 'complete_weekly_mission',
        'wallet_state', 'monthly_ranking'
      )
  loop
    execute format('grant execute on function %s to authenticated, service_role', function_row.signature);
  end loop;
end;
$api_rpc_grants$;

-- Nunca exponha tabelas internas pelo papel anon/authenticated.
do $internal_grants$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'api_rate_limits', 'stripe_webhook_events', 'billing_checkout_attempts',
    'user_emails', 'subscriptions', 'orders', 'shop_redemptions'
  ] loop
    if to_regclass('public.' || relation_name) is not null then
      execute format('alter table public.%I enable row level security', relation_name);
      execute format('revoke all on table public.%I from public, anon', relation_name);
    end if;
  end loop;
end;
$internal_grants$;

grant all on table public.api_rate_limits to service_role;
grant all on table public.stripe_webhook_events to service_role;
grant all on table public.billing_checkout_attempts to service_role;

-- Grupos de defaults nao devem reabrir EXECUTE quando novas funcoes forem
-- criadas no schema exposto. Cada RPC publica deve conceder explicitamente.
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;

-- Limites reais no Storage. Bucket publico nao significa upload publico.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152,
    array['image/jpeg','image/png','image/webp','image/gif']),
  ('covers', 'covers', true, 8388608,
    array['image/jpeg','image/png','image/webp','image/gif']),
  ('pdfs', 'pdfs', false, 104857600, array['application/pdf']),
  ('post-media', 'post-media', false, 5242880,
    array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Extensao + pasta do usuario reduzem uploads acidentais e path traversal.
-- O limite de MIME/tamanho tambem e aplicado no registro do bucket acima.
drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'gif')
);

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'gif')
);

drop policy if exists "covers_admin_write" on storage.objects;
create policy "covers_admin_write" on storage.objects for all to authenticated
using (bucket_id = 'covers' and (select public.can_manage_content()))
with check (
  bucket_id = 'covers'
  and (select public.can_manage_content())
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'gif')
);

drop policy if exists content_managers_insert_library_files on storage.objects;
create policy content_managers_insert_library_files on storage.objects
for insert to authenticated
with check (
  bucket_id in ('covers', 'pdfs')
  and (select public.can_manage_content())
  and (
    (bucket_id = 'pdfs' and lower(storage.extension(name)) = 'pdf')
    or (bucket_id = 'covers' and lower(storage.extension(name)) in ('jpg','jpeg','png','webp','gif'))
  )
);

drop policy if exists content_managers_update_library_files on storage.objects;
create policy content_managers_update_library_files on storage.objects
for update to authenticated
using (bucket_id in ('covers', 'pdfs') and (select public.can_manage_content()))
with check (
  bucket_id in ('covers', 'pdfs')
  and (select public.can_manage_content())
  and (
    (bucket_id = 'pdfs' and lower(storage.extension(name)) = 'pdf')
    or (bucket_id = 'covers' and lower(storage.extension(name)) in ('jpg','jpeg','png','webp','gif'))
  )
);

drop policy if exists "post_media_insert_own" on storage.objects;
create policy "post_media_insert_own" on storage.objects for insert to authenticated
with check (
  bucket_id = 'post-media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'gif')
);

drop policy if exists "post_media_update_own" on storage.objects;
create policy "post_media_update_own" on storage.objects for update to authenticated
using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text)
with check (
  bucket_id = 'post-media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'gif')
);

commit;
