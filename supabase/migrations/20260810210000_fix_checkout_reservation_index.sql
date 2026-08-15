begin;

-- Keep one open reservation per user. The API expires the old Stripe session
-- before creating a checkout for a different plan, so this guard remains
-- correct during retries and concurrent clicks.

update public.billing_checkout_attempts
   set status = 'expired',
       updated_at = now()
 where status = 'open'
   and expires_at is not null
   and expires_at <= now();

with ranked as (
  select attempt_id,
         row_number() over (
           partition by user_id
           order by created_at desc, attempt_id desc
         ) as row_number
    from public.billing_checkout_attempts
   where status = 'open'
), duplicates as (
  select attempt_id
    from ranked
   where row_number > 1
)
update public.billing_checkout_attempts attempt
   set status = 'expired',
       updated_at = now()
 where attempt.attempt_id in (select attempt_id from duplicates);

drop index if exists public.billing_open_checkout_user_uidx;
drop index if exists public.billing_open_checkout_pair_uidx;

create unique index if not exists billing_open_checkout_user_uidx
  on public.billing_checkout_attempts(user_id)
 where status = 'open';

create index if not exists billing_checkout_attempts_user_status_idx
  on public.billing_checkout_attempts(user_id, status, created_at desc);

commit;
