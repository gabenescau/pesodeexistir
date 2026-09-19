# Fase 1: seguranca e escala

## Aplicacao obrigatoria

Rode no Supabase SQL Editor:

```text
supabase/migrations/20260810100000_phase1_security_and_billing.sql
```

A migration deve ser aplicada depois das migrations anteriores, especialmente
`20260810000000_stripe_billing.sql`. Ela:

As duas migrations agora fazem um preflight condicional do schema. Se o banco
remoto recebeu uma versao parcial das migrations antigas, colunas como
`subscriptions.status`, `subscriptions.user_id`, `orders.user_id` ou
`shop_redemptions.user_id` sao criadas antes de funcoes, indices e policies.
Isso evita o erro `42703` sem substituir ou apagar dados existentes.

- remove privilegios do papel `anon` nas tabelas do produto;
- limita perfis a propria linha ou administradores;
- troca a view de perfis por uma RPC com campos publicos explicitos;
- exige assinatura ativa para criar posts e interacoes;
- impede que `orders` seja criado sem usuario autenticado;
- cria reserva server-side de checkout por usuario;
- cria indices para entitlement, feed e interacoes;
- mantem falhas do webhook Stripe para retry/auditoria.

## Variaveis server-only

Configure na Vercel, em Production e Preview quando necessario:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_LEITOR_MONTHLY`
- `STRIPE_PRICE_LEITOR_ANNUAL`
- `STRIPE_PRICE_PENSADOR_MONTHLY`
- `STRIPE_PRICE_PENSADOR_ANNUAL`
- `APP_URL`
- `CRON_SECRET` para autenticar a Function de reconciliacao Stripe agendada
- `CORS_ALLOWED_ORIGINS` com os dominios oficiais separados por virgula

Somente `NEXT_PUBLIC_SUPABASE_URL` e a chave publishable/anon podem chegar ao
browser. Nunca use `SUPABASE_SECRET_KEY`, `STRIPE_SECRET_KEY` ou
`STRIPE_WEBHOOK_SECRET` com prefixo `NEXT_PUBLIC_`/`VITE_`.

## Modelo de escala adotado

- A Vercel executa as Functions horizontalmente; nao existe estado de memoria
  local usado como rate limit ou fonte de verdade.
- Rate limit e idempotencia ficam no Postgres, compartilhados entre instancias.
- Assets versionados sao cacheados pela CDN da Vercel; API e dados privados usam
  `no-store`.
- Consultas iniciais tem colunas explicitas e limites; o feed tem teto de 200
  posts por carga para nao transformar cada login em uma varredura ilimitada.
- Redis, Kafka e RabbitMQ nao foram adicionados como simulacao: eles exigem um
  servico provisionado, credenciais, fila de retry e monitoramento. A proxima
  fase pode introduzir Redis/Upstash para cache distribuido quando houver uma
  metrica que justifique o custo.

## Stripe

O endpoint de webhook deve receber tambem
`customer.subscription.pending_update_expired`. O banco registra o evento e nao
o apaga quando ocorre falha, permitindo o retry do Stripe e preservando auditoria.

## Reconciliacao agendada

A Vercel executa `/api/cron-reconcile-stripe` a cada hora. A Function consulta
assinaturas recorrentes no Stripe, sincroniza status/periodo e expira acessos
PIX vencidos e reservas de checkout expiradas. O endpoint exige o `CRON_SECRET`
gerenciado pela Vercel; ele nao deve ser colocado no bundle do navegador.

Depois de aplicar a migration da Fase 1, aplique tambem:

```text
supabase/migrations/20260810110000_phase1_followup_authorization_and_idempotency.sql
```
