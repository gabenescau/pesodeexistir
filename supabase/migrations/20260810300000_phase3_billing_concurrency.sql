-- Fase 3: concorrencia, idempotencia e reconcilicao do billing Stripe.
-- Aplicar depois das migrations 20260810000000, 20260810100000,
-- 20260810110000 e 20260810200000.

begin;

-- Compatibilidade com tabelas legadas: a Fase 1 antiga criou error_message,
-- enquanto a tabela Stripe original usa last_error. A funcao abaixo depende
-- de last_error, portanto a coluna precisa existir antes da compilacao dela.
alter table if exists public.stripe_webhook_events
  add column if not exists last_error text;
create unique index if not exists stripe_webhook_events_event_id_uidx
  on public.stripe_webhook_events(event_id);

-- O endpoint nao pode decidir se dois workers podem processar o mesmo evento
-- com uma leitura seguida de PATCH. Esta funcao faz o claim em uma transacao
-- do Postgres e reaproveita somente eventos falhos ou travados ha mais de 10m.
create or replace function public.claim_stripe_webhook_event(
  p_event_id text,
  p_event_type text,
  p_subscription_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_existing public.stripe_webhook_events%rowtype;
  v_claimed boolean := false;
  v_inserted integer := 0;
begin
  if p_event_id is null or char_length(p_event_id) < 1 or char_length(p_event_id) > 255
     or p_event_type is null or char_length(p_event_type) < 1 or char_length(p_event_type) > 255 then
    raise exception 'STRIPE_WEBHOOK_EVENT_INVALIDO';
  end if;

  select * into v_existing
  from public.stripe_webhook_events
  where event_id = p_event_id
  for update;

  if not found then
    insert into public.stripe_webhook_events (
      event_id,
      event_type,
      subscription_id,
      status,
      attempt_count,
      last_attempt_at,
      updated_at
    ) values (
      p_event_id,
      p_event_type,
      nullif(left(p_subscription_id, 255), ''),
      'processing',
      1,
      now(),
      now()
    )
    on conflict (event_id) do nothing;

    get diagnostics v_inserted = row_count;
    v_claimed := v_inserted > 0;
    return jsonb_build_object('claimed', v_claimed);
  end if;

  if v_existing.status = 'processed' then
    return jsonb_build_object('claimed', false);
  end if;

  if v_existing.status = 'processing'
     and v_existing.last_attempt_at is not null
     and v_existing.last_attempt_at > now() - interval '10 minutes' then
    return jsonb_build_object('claimed', false);
  end if;

  update public.stripe_webhook_events
  set status = 'processing',
      attempt_count = coalesce(attempt_count, 0) + 1,
      last_attempt_at = now(),
      last_error = null,
      updated_at = now()
  where event_id = p_event_id;

  return jsonb_build_object('claimed', true);
end;
$function$;

create or replace function public.finish_stripe_webhook_event(p_event_id text)
returns boolean
language sql
security definer
set search_path = ''
as $function$
  update public.stripe_webhook_events
  set status = 'processed',
      processed_at = now(),
      last_error = null,
      updated_at = now()
  where event_id = p_event_id
    and status = 'processing'
  returning true;
$function$;

create or replace function public.fail_stripe_webhook_event(p_event_id text, p_error text)
returns boolean
language sql
security definer
set search_path = ''
as $function$
  update public.stripe_webhook_events
  set status = 'failed',
      last_error = left(coalesce(p_error, 'Erro desconhecido'), 500),
      updated_at = now()
  where event_id = p_event_id
    and status = 'processing'
  returning true;
$function$;

revoke all on function public.claim_stripe_webhook_event(text, text, text)
  from public, anon, authenticated;
revoke all on function public.finish_stripe_webhook_event(text)
  from public, anon, authenticated;
revoke all on function public.fail_stripe_webhook_event(text, text)
  from public, anon, authenticated;
grant execute on function public.claim_stripe_webhook_event(text, text, text) to service_role;
grant execute on function public.finish_stripe_webhook_event(text) to service_role;
grant execute on function public.fail_stripe_webhook_event(text, text) to service_role;

create index if not exists stripe_webhook_events_status_retry_idx
  on public.stripe_webhook_events(status, last_attempt_at);

comment on function public.claim_stripe_webhook_event(text, text, text) is
  'Server-only atomic claim for Stripe webhook processing; safe for concurrent retries.';

commit;
