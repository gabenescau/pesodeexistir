# Fase 3 - Bugs e Billing

## Aplicado no codigo

- `billing_checkout_attempts` funciona como reserva deterministica por usuario,
  plano e metodo (`CARD` ou `PIX`). Um checkout aberto para outro plano/metodo
  retorna `409` e nao e expirado silenciosamente.
- A reivindicacao de uma tentativa valida proprietario, plano, metodo e status.
  Um `attemptId` de outra conta retorna `403`; uma tentativa incompatível retorna
  `409`.
- O webhook Stripe usa o ledger `stripe_webhook_events` por RPC transacional:
  `claim_stripe_webhook_event`, `finish_stripe_webhook_event` e
  `fail_stripe_webhook_event`. Dois workers concorrentes nao processam o mesmo
  evento; eventos falhos permanecem como `failed` para retry controlado.
- `customer.subscription.pending_update_applied` e
  `customer.subscription.pending_update_expired` sincronizam o estado e limpam
  `requested_plan`, `change_mode` e `changed_at`.
- `invoice.payment_action_required` e tratado como estado de cobranca pendente
  (`past_due`) em vez de ser ignorado.
- Upgrade/downgrade manual e cancelamento de assinaturas `manual_admin` ou
  pendentes agora exigem papel `admin`.
- A reconciliacao Stripe pagina assinaturas locais, usa `user_id` local quando
  a metadata remota antiga nao tem esse campo, marca assinaturas removidas no
  Stripe como canceladas e continua processando as demais linhas mesmo quando
  uma falha ocorre.
- Em producao, fallbacks de negocio locais foram fechados para autenticacao,
  catalogo de loja e pedidos. Falhas de carteira/indicacoes agora aparecem como
  estado recuperavel na interface.

## Migration obrigatoria

Aplicar em ordem, com backup/PITR confirmado:

```text
supabase/migrations/20260810400000_phase4_schema_compatibility.sql
supabase/migrations/20260810300000_phase3_billing_concurrency.sql
```

A migration de compatibilidade deve ser executada primeiro em bancos que ja
existiam ou que retornaram `column does not exist`. Ela cria/completa somente as
colunas da ledger e da reserva de checkout; nao apaga dados. Em seguida,
execute novamente a Fase 3 para recriar as RPCs atomicas.

Em um banco novo, a migration de billing base ja cria `last_error`, mas a
compatibilidade continua segura e idempotente. O webhook falha fechado enquanto
essas RPCs nao existirem, para nao processar um evento sem idempotencia
transacional.

## Configuracao manual do Stripe

No Dashboard Stripe, em **Developers > Webhooks**, o endpoint de producao deve
ser:

```text
https://pesodeexistir.online/api/stripe-webhook
```

Use o `Signing secret` desse endpoint em `STRIPE_WEBHOOK_SECRET` na Vercel.
Marque os eventos usados pelo codigo:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.pending_update_applied`
- `customer.subscription.pending_update_expired`
- `invoice.paid`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `invoice.payment_action_required`

O Dashboard Stripe e a fonte de verdade da lista de eventos habilitados; essa
parte nao pode ser configurada por commit no repositorio.

## Reconciliacao

O endpoint `/api/cron-reconcile-stripe` deve ser chamado por um cron da Vercel
com `Authorization: Bearer $CRON_SECRET`. O `vercel.json` ja agenda a execucao
horaria. O cron nao substitui o webhook: ele corrige divergencias e registra
quantidades reconciliadas, removidas e falhas na resposta protegida.

## Testes aplicados

- Idempotencia de checkout para a mesma tentativa.
- Conflito por outro usuario e por plano/metodo diferente.
- Limpeza de metadata de upgrade/downgrade.
- Suite existente de sanitizacao, RBAC, CORS, limites de payload e paginacao.
- `node --check` em todas as Functions e modulos Stripe alterados.
- Migration de compatibilidade para schemas legados que usam
  `error_message` em vez de `last_error`.

## Limites que exigem ambiente remoto

Nao e possivel confirmar neste workspace a execucao da migration no projeto
Supabase remoto, a entrega real do webhook pelo Stripe ou o cron da Vercel.
Depois de aplicar a migration, envie um evento de teste/retry pelo Dashboard e
confirme que a linha em `stripe_webhook_events` passa por `processing` ->
`processed`; para falha, confirme `failed` e o reenvio posterior.
