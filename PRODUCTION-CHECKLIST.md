# Checklist de producao

## Antes do deploy

1. Rode `supabase-abacatepay.sql` e depois `supabase-production-hardening.sql`
   no SQL Editor do projeto correto.
2. Rode `npm run check`.
3. Confirme que Preview usa chaves de teste e Production usa chaves reais.
4. Nunca use `VITE_` ou `NEXT_PUBLIC_` em secret key, chave privada da
   AbacatePay, JWT secret ou segredo do webhook.
5. Rotacione qualquer credencial que ja tenha aparecido no historico Git.
6. No Supabase Auth, ative CAPTCHA e revise os limites de login/cadastro.

O repositorio teve um arquivo `.env` em commits antigos. Apagar o arquivo no
estado atual nao revoga as credenciais nem o remove de clones anteriores.
Confirme a rotacao de Supabase Secret/Service Role, AbacatePay API Key e
`ABACATEPAY_WEBHOOK_SECRET` antes da abertura publica.

## Variaveis privadas da Vercel

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
SUPABASE_JWT_SECRET
ABACATEPAY_API_KEY
ABACATEPAY_WEBHOOK_SECRET
RATE_LIMIT_SECRET
RATE_LIMIT_FAIL_CLOSED=true
```

## Variaveis publicas do bundle

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
```

As cinco primeiras variaveis Supabase normalmente sao criadas pela integracao
nativa da Vercel. `SUPABASE_JWT_SECRET` nao e consumida pelo frontend nem pelo
codigo atual; ela permanece privada porque faz parte da administracao do Auth.

`ABACATEPAY_WEBHOOK_PUBLIC_KEY` e opcional. O codigo possui como fallback a
chave publica oficial documentada pela AbacatePay.

## Verificacoes depois do deploy

1. Abra `/api/health` e confirme `status: ok`.
2. Teste login, edicao de perfil e upload de avatar JPG/PNG/WebP.
3. Teste PIX e cartao em ambiente de desenvolvimento da AbacatePay.
4. Reenvie um webhook e confirme resposta `200`; reenvie de novo e confirme
   idempotencia.
5. Teste acesso de usuario comum ao admin e alteracao direta de `profiles.role`.
6. Configure alerta externo para falha de `/api/health` e erros `5xx`.

## Operacao

- Ative backups/PITR do Supabase conforme o plano e teste uma restauracao.
- Revise logs da Vercel sem armazenar tokens, cookies, CPF ou payload financeiro.
- Apague registros antigos de `api_rate_limits` em uma rotina de manutencao:

```sql
delete from public.api_rate_limits
where window_start < now() - interval '2 days';
```

- Defina com assessoria juridica os prazos de retencao, exportacao e exclusao de
  dados pessoais para LGPD.
