# Stripe production setup

## Vercel environment variables

Configure these for Production and Preview when appropriate:

- `STRIPE_SECRET_KEY`: secret or restricted Stripe API key (`sk_live_...` or `rk_live_...`).
- `STRIPE_WEBHOOK_SECRET`: signing secret (`whsec_...`) from the production webhook.
- `STRIPE_PRICE_LEITOR_MONTHLY`: recurring monthly Price ID in BRL.
- `STRIPE_PRICE_LEITOR_ANNUAL`: recurring yearly Price ID in BRL.
- `STRIPE_PRICE_PENSADOR_MONTHLY`: recurring monthly Price ID in BRL.
- `STRIPE_PRICE_PENSADOR_ANNUAL`: recurring yearly Price ID in BRL.
- `APP_URL`: `https://pesodeexistir.online`.
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`.
- `RATE_LIMIT_SECRET`: at least 32 random bytes; keep server-only.
- `CORS_ALLOWED_ORIGINS`: comma-separated production origins.

Never expose `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` or `SUPABASE_SECRET_KEY` with a `VITE_` prefix.

## Stripe Dashboard

1. Activate Card in **Settings > Payment methods** in the same Stripe mode used by the configured key.
2. Create a webhook at `https://pesodeexistir.online/api/stripe-webhook`.
3. Subscribe it to:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.pending_update_applied`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Copy that endpoint's signing secret to `STRIPE_WEBHOOK_SECRET`.
5. Configure the Customer Portal so card customers can update their payment method and view invoices.

Test keys must only use test Prices and live keys must only use live Prices.

## Supabase

Run the Stripe billing migrations before enabling production checkout. The webhook depends on `stripe_webhook_events` and the checkout concurrency tables.
