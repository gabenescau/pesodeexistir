# AbacatePay - configuracao de producao

## 1. Supabase

Execute todo o arquivo `supabase-abacatepay.sql` no SQL Editor. Ele:

- corrige o indice `unique_active_subscription`;
- permite historico de assinaturas canceladas e expiradas;
- mantem apenas uma assinatura pendente ou ativa por usuario;
- bloqueia escrita direta de assinaturas pelo frontend;
- configura as politicas de acesso do catalogo e dos arquivos.

## 2. Variaveis da Vercel

Cadastre em Production, Preview e Development:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
ABACATEPAY_API_KEY
ABACATEPAY_WEBHOOK_SECRET
ABACATEPAY_WEBHOOK_PUBLIC_KEY
NEXT_PUBLIC_SITE_URL
```

`SUPABASE_SERVICE_ROLE_KEY` e `ABACATEPAY_API_KEY` sao privadas e nunca podem
usar o prefixo `VITE_`.

Use em `ABACATEPAY_WEBHOOK_PUBLIC_KEY` a chave publica HMAC publicada na pagina
"Webhooks > Verificacao e Seguranca" da documentacao oficial.

As rotas da pasta `api/` sao publicadas automaticamente como Vercel Serverless
Functions. Nao crie Edge Function, cron ou funcao manual no painel da Vercel.
Depois de alterar variaveis, faca um novo deploy para todas entrarem em vigor.

## 3. Webhook da AbacatePay

Cadastre o endpoint:

```text
https://SEU-DOMINIO.com/api/abacate-webhook?webhookSecret=O_MESMO_VALOR_DE_ABACATEPAY_WEBHOOK_SECRET
```

Eventos:

```text
subscription.completed
subscription.trial_started
subscription.renewed
subscription.cancelled
checkout.refunded
checkout.disputed
checkout.lost
```

O endpoint valida o secret da URL, a assinatura `X-Webhook-Signature` em
HMAC-SHA256/base64 e a idempotencia pelo ID do evento.

O webhook deve ser criado no mesmo ambiente da chave configurada na Vercel:
chave Dev recebe eventos Dev; chave de producao recebe eventos reais.

## 4. Cartao

O checkout envia `methods: ["PIX", "CARD"]`. Se a API responder
`CARD is not available for this store`, solicite a habilitacao de cartao para
a loja no painel ou suporte da AbacatePay. Essa permissao pertence a conta e
nao pode ser ativada pela API do projeto.

## 5. Produtos e assinaturas

Os produtos sao criados automaticamente:

- `ope_club_monthly_subscription_v1`, ciclo `MONTHLY`;
- `ope_club_annual_subscription_v1`, ciclo `ANNUALLY`.

O checkout usa `POST /subscriptions/create`. O cancelamento usa
`POST /subscriptions/cancel` quando a assinatura remota ja foi ativada.
Upgrade e downgrade usam `POST /subscriptions/change-plan` e entram em vigor
no proximo ciclo de cobranca.

A chave da AbacatePay precisa destas permissoes:

```text
PRODUCT:CREATE
PRODUCT:READ
CUSTOMER:CREATE
CUSTOMER:READ
CHECKOUT:CREATE
CHECKOUT:READ
SUBSCRIPTION:CREATE
SUBSCRIPTION:DELETE
```

## 6. Diagnostico

- Produto criado mas nao encontrado: confirme que a Vercel usa a mesma chave
  e o mesmo ambiente da loja onde o produto aparece.
- HTTP 403: recrie ou ajuste a chave com as permissoes acima.
- Checkout pago sem liberar acesso: confira se o webhook pertence ao mesmo
  ambiente, se os secrets coincidem e se recebeu `subscription.completed`.
- Assinatura sem `subs_...`: sincronize o checkout no painel e corrija o
  webhook; cancelamento e troca oficial exigem o ID remoto da assinatura.
