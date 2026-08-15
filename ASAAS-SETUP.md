# Asaas no OPE Club

## Modelo usado

O OPE Club usa o Checkout hospedado do Asaas com `chargeTypes: ["DETACHED"]`.
Cada compra e um pagamento unico em BRL e o acesso e concedido por `durationDays`
do catalogo do servidor. O checkout oferece Pix e cartao de credito.

Este fluxo nao cria renovacao automatica. Por isso, um pagamento ja concluido
nao e tratado como assinatura recorrente e nao e "cancelado" localmente. O
cancelamento oficial implementado e `POST /v3/checkouts/{id}/cancel`, usado para
checkouts ainda pendentes. Reembolso de pagamento concluido deve seguir o fluxo
de reembolso do Asaas e ser implementado separadamente, com regra financeira
definida.

## Variaveis da Vercel

Configure em Production e Preview conforme o ambiente:

```text
ASAAS_ENVIRONMENT=production
ASAAS_API_KEY=<access_token_da_conta_asaas>
ASAAS_API_BASE_URL=https://api.asaas.com/v3
ASAAS_WEBHOOK_TOKEN=<token_aleatorio_com_mais_de_24_caracteres>
APP_URL=https://app.pesodeexistir.online
```

Para sandbox, use:

```text
ASAAS_ENVIRONMENT=sandbox
ASAAS_API_BASE_URL=https://api-sandbox.asaas.com/v3
```

Nunca use prefixo `VITE_` ou `NEXT_PUBLIC_` nessas variaveis. A chave e o
token ficam somente nas Serverless Functions.

## Webhook no Asaas

Crie um webhook de Checkout apontando para:

```text
https://app.pesodeexistir.online/api/asaas-webhook
```

Use o mesmo valor de `ASAAS_WEBHOOK_TOKEN` como Authentication Token e ative:

```text
CHECKOUT_CREATED
CHECKOUT_CANCELED
CHECKOUT_EXPIRED
CHECKOUT_PAID
```

O endpoint valida o header `asaas-access-token`, grava o `id` do evento com
unicidade e confirma o pagamento consultando o Checkout no Asaas antes de
alterar a assinatura local.

## Fases

### Fase 1: checkout seguro

Concluida no codigo: catalogo de planos no servidor, checkout hospedado,
idempotencia, rate limit, valor conferido e URL de retorno sem segredo.

### Fase 2: confirmacao e cancelamento

Concluida no codigo: webhook idempotente, sincronizacao server-side de
`CHECKOUT_PAID`, `CHECKOUT_CANCELED` e `CHECKOUT_EXPIRED`, alem do cancelamento
oficial de checkout pendente.

### Fase 3: operacao

Depois do deploy: executar `supabase db push`, configurar as variaveis, criar o
webhook e testar sandbox com Pix e cartao. So depois mudar `ASAAS_ENVIRONMENT`
para `production` e usar a chave de producao.

### Fase 4: retirada do legado

Manter a Stripe antiga somente enquanto houver assinantes Stripe ativos.
Depois de cancelar/migrar o ultimo assinante, remover as rotas, secrets,
cron e dependencia Stripe em uma mudanca separada.
