# AbacatePay - configuracao de producao

## 1. Supabase

Execute todo o arquivo `supabase-abacatepay.sql` no SQL Editor. Ele:

- corrige o indice `unique_active_subscription`;
- permite historico de assinaturas canceladas e expiradas;
- mantem apenas uma assinatura pendente ou ativa por usuario;
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
subscription.payment_failed
subscription.cancelled
checkout.refunded
checkout.disputed
checkout.lost
```

O endpoint valida o secret da URL, a assinatura `X-Webhook-Signature` em
HMAC-SHA256/base64 e a idempotencia pelo ID do evento.

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
