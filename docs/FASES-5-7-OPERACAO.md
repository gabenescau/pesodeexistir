# Fases 5–7 — Limpeza, Performance e Operacao

## Aplicado no repositorio

- Lint sem warnings e teste/build executave por `npm run check`.
- Curtidas de sugestoes removidas do `localStorage` e persistidas em
  `suggestion_likes`, com chave primaria por sugestao/usuario e RLS de leitura,
  insercao e exclusao somente do proprio usuario.
- Contagens de curtidas expostas por view agregada e API autenticada em
  `/api/suggestion-likes`; o browser nao envia `user_id` confiavel para decidir
  a identidade, pois a Function usa a sessao validada.
- Tela de sugestoes usa selecao explicita de colunas e o cliente HTTP comum.
- Loja e resgates tambem usam selecoes explicitas, reduzindo payload e evitando
  expor colunas futuras por acidente.
- Requests privilegiados continuam protegidos por rate limit, request id,
  respostas seguras e service role somente no servidor.
- O health check agora marca a aplicacao como degradada quando Supabase, Stripe
  ou o cron de reconciliacao nao estao configurados, sem devolver os valores.
- Assets estaticos e chunks pesados continuam separados pelo build Vite; o PDF
  worker e a pagina de leitura nao entram no chunk inicial.

## Migration da Fase 5

Depois de backup/PITR confirmado, execute:

```text
supabase/migrations/20260810500000_phase5_suggestion_likes.sql
```

Ela e aditiva e nao remove curtidas existentes porque a tabela ainda nao era a
fonte persistente. O endpoint de curtida deve ser publicado junto com o build.

## O que exige ambiente remoto

Nao e possivel confirmar apenas pelo workspace:

- vulnerabilidades atuais do registry npm quando o endpoint de auditoria esta
  indisponivel;
- tamanho real das tabelas, `EXPLAIN`, TTFB, LCP, INP e CLS em producao;
- Auth Rate Limits, leaked-password protection, CAPTCHA/Turnstile, PITR e
  restore drill do projeto Supabase;
- cron, webhook Stripe, alertas e variaveis da Vercel em Production;
- policies efetivas depois da migration no projeto remoto.

## Gate recomendado antes de publicar

1. Aplicar a migration em staging e testar curtida, descurtida e concorrencia.
2. Rodar `npm audit --omit=dev` com acesso ao registry e revisar breaking
   changes antes de alterar o lockfile.
3. Medir as rotas mobile e catalogar queries lentas com `EXPLAIN ANALYZE`.
4. Confirmar backup/PITR e executar restauração de teste.
5. Testar Stripe webhook replay, checkout concorrente e reconciliação.
