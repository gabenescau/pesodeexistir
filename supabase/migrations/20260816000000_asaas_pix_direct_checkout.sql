begin;

alter table public.billing_checkout_attempts
  add column if not exists provider_customer_id text;

alter table public.billing_checkout_attempts
  drop constraint if exists billing_checkout_attempts_payment_method_check;

alter table public.billing_checkout_attempts
  add constraint billing_checkout_attempts_payment_method_check
  check (payment_method in ('CARD', 'PIX', 'ASAAS_CHECKOUT'));

create index if not exists billing_checkout_attempts_provider_customer_idx
  on public.billing_checkout_attempts(provider, provider_customer_id)
  where provider_customer_id is not null;

comment on column public.billing_checkout_attempts.provider_checkout_id is
  'Identificador do recurso Asaas: checkout hospedado ou cobranca Pix, conforme payment_method.';

commit;
