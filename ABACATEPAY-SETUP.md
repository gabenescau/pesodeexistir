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
NEXT_PUBLIC_SITE_URL
```

`SUPABASE_SERVICE_ROLE_KEY` e `ABACATEPAY_API_KEY` sao privadas e nunca podem
usar o prefixo `VITE_`.

O backend usa diretamente a chave publica HMAC oficial publicada pela
AbacatePay. Nao cadastre uma chave HMAC propria na Vercel.

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
checkout.completed
checkout.refunded
checkout.disputed
checkout.lost
subscription.completed
subscription.trial_started
subscription.renewed
subscription.cancelled
```

O endpoint valida o secret da URL, a assinatura `X-Webhook-Signature` em
HMAC-SHA256/base64 e a idempotencia pelo ID do evento.

O webhook deve ser criado no mesmo ambiente da chave configurada na Vercel:
chave Dev recebe eventos Dev; chave de producao recebe eventos reais.

## 4. PIX e cartao

- PIX usa o checkout hospedado `POST /checkouts/create` com `methods: ["PIX"]`.
  E um pagamento unico; o webhook libera 30 ou 365 dias e a renovacao e manual.
- Cartao usa `POST /subscriptions/create` com `methods: ["CARD"]` e renovacao
  automatica.

Se a API responder `CARD is not available for this store`, solicite a
habilitacao de cartao para a loja no suporte da AbacatePay. Essa permissao
pertence a conta e nao pode ser ativada pela API do projeto.

## 5. Produtos e assinaturas

Os produtos sao criados automaticamente:

- cartao mensal: `ope_club_monthly_subscription_v1`, ciclo `MONTHLY`;
- cartao anual: `ope_club_annual_subscription_v1`, ciclo `ANNUALLY`;
- PIX mensal: `ope_club_monthly_subscription_v1_pix_one_time`, sem ciclo;
- PIX anual: `ope_club_annual_subscription_v1_pix_one_time`, sem ciclo.

O cartao usa `POST /subscriptions/create`. O cancelamento usa
`POST /subscriptions/cancel` quando a assinatura remota ja foi ativada.
Upgrade e downgrade usam `POST /subscriptions/change-plan` e entram em vigor
no proximo ciclo de cobranca. No PIX comum nao existe cobranca futura para
cancelar; cancelar no app apenas encerra o acesso local.

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
- PIX pago sem liberar acesso: confira se o webhook recebeu
  `checkout.completed`.
- Cartao pago sem liberar acesso: confira se o webhook recebeu
  `subscription.completed`.
- Assinatura sem `subs_...`: sincronize o checkout no painel e corrija o
  webhook; cancelamento e troca oficial exigem o ID remoto da assinatura.
