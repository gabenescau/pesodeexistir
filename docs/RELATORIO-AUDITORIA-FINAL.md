# RELATÓRIO DE AUDITORIA — OPE Club (Multi-agente, 2026-08-10)

> Consolidado a partir de 5 agentes de auditoria + verificação manual.
> HEAD auditado: `85727c3f` (feat: integrate secure Stripe checkout and billing)
> Stack: Express + PostgreSQL/Supabase (RLS) + React (Vite) + Stripe.
> Leia junto: `LEITURA — DISCOVERY REPORT.md`, `LEITURA — PRIORITIZED ROADMAP.md`.

---

## 0. Resumo executivo

| Área | Veredito | Topo achado |
|------|----------|-------------|
| Backend/API | ⚠️ Requer ação | Escalonamento de plano por `price_id` + XFF spoofable + leak de erro |
| Stripe/Billing | 🔴 Crítico | Nenhuma transição `active→expired` no sync; clientes legacy bloqueados |
| Banco/RLS | ⚠️ Requer ação | `private.award_both` com EXECUTE p/ authenticated; pedidos sem idempotência |
| Frontend | ⚠️ Requer ação | Débito duplo em retry no checkout; erro de insert engolido |
| Marketing/Funil | 🟡 Oportunidade | `/assinar` atrás de login; CSP quebra Google Fonts |
| Dependências | 🟡 Manutenção | 6 vulns dev-only (prod 0); `motion` 2 majors atrás |

**Bom (preservar):** RLS habilitado em todas as tabelas sensíveis; paywall de PDF com
enforcement no banco (storage policy + `has_active_subscription` SECURITY DEFINER);
ledger de XP/creditos server-authoritative; `search_path=''` nos helpers; webhook
Stripe com assinatura verificada; `.env.local` fora do git.

---

## 1. Backend / API Security

### 1.1 🔴 CRÍTICO — Escalonamento de plano via `price_id` (`api/stripe-change-plan.js`)
- O endpoint aceita `price_id` do client sem conferir se ele pertence ao plano
  solicitado. `server/stripe.js` deriva o plano a partir do preço, então um usuário
  pode enviar `price_id` de outro plano (ex.: Pensador em vez de Leitor) e obter o
  tier maior sem pagar a diferença.
- **Fix:** derivar `plan` do `price_id` no servidor (já acontece) e **validar no
  servidor** que o preço pertence ao catálogo permitido para o plano alvo; nunca
  confiar em um campo `plan` vindo do client. Retornar `403` em mismatch.

### 1.2 🟠 ALTO — IP spoofable via `X-Forwarded-For` (`server/supabase.js:209`)
- `XFF` é aceito sem validação de confiança do proxy. Um atacante pode forjar o IP
  e contornar rate-limit / geofencing / auditoria.
- **Fix:** só confiar em `XFF` vindo de proxy conhecido (ou usar `app.set('trust proxy', 1)` +
  ler o último hop, não o primeiro).

### 1.3 🟠 ALTO — Vazamento de detalhe de erro (`server/supabase.js:150-152`)
- Mensagens de erro internas (código/stacks do Supabase) são devolvidas ao client.
- **Fix:** mapear erros internos para mensagens genéricas + log server-side com o
  código real.

### 1.4 🟠 ALTO — Middlewares administrativos sem rate limit / sem auditoria
- Endpoints de admin (`admin-subscription`, `stripe-*`, painel) sem throttle ou
  log de auditoria estruturado. Força bruta de sessão de admin e difícil rastreio.
- **Fix:** rate limit por usuário+rota em rotas admin; registrar `user_id`, `ação`,
  `ip` (confiável), `ts` em tabela de auditoria.

---

## 2. Stripe / Billing (camada nova, commit 85727c3f)

### 2.1 🔴 CRÍTICO — Nenhuma transição `active → expired` no sync
- `stripe-sync`/webhook aplica atualizações, mas não há job que degrade assinaturas
  cujo `current_period_end` passou. Usuário que cancela o cartão permanece `active`
  na DB para sempre (paywall de PDF liberado) até intervenção manual.
- **Fix:** job agendado (pg_cron / worker) que marca `expired` quando
  `current_period_end < now()`; o `has_active_subscription()` já respeita a data,
  então o gate de PDF fecha sozinho — o problema é o status na DB e o que a UI lê.

### 2.2 🔴 CRÍTICO — Dupla trava de recompra para clientes legacy
- Clientes antigos (AbacatePay) têm `subscriptions` com status aprovado/ativo e
  planos `ope_club_*`. A camada Stripe exige `status IN (active, trialing)` para
  "já assinante", mas nunca migrou `ope_club_*` → `leitor/pensador`. Resultado:
  usuário legado fica **bloqueado de comprar** (parece ativo) e **sem tier Stripe**
  → paywall aberto mas sem faturamento. Deadlock de billing.
- **Fix:** migration de dados mapeando `ope_club_*` → `leitor` com o `tier`
  correspondente, ou regra de elegibilidade que trate legacy como não-bloqueante.

### 2.3 🟠 ALTO — Duas fontes de verdade para o plano (`plan` vs `tier`)
- A migration `20260810000000_stripe_billing.sql` congela `subscriptions.plan` em
  `('leitor','pensador')` criado pelo client (fluxo manual) enquanto a paywall usa
  `subscriptions.tier` (`admin/pensador/leitor`) que **ninguém define** na camada
  Stripe. Risco de paywall vazada ou tier errado dependendo de qual coluna a rota
  de leitura usa.
- **Fix:** escolher uma única coluna canônica (`tier`), e a camada Stripe passa a
  gravar o tier derivado do price; `plan` vira legado read-only.

### 2.4 🟡 MÉDIO — Webhook sem dedupe de aplicação
- `stripe_webhook_events.event_id` é UNIQUE (bom para idempotência de registro),
  mas a **aplicação** da mudança em `subscriptions` não é protegida por
  `WHERE event_id NOT EXISTS` no mesmo fluxo — replay de evento pode aplicar
  duas vezes.
- **Fix:** transação única `INSERT ... ON CONFLICT DO NOTHING RETURNING id`; só
  aplica a mutação quando o insert retornou linha.

---

## 3. Banco / RLS (Supabase)

Design geral forte: ledger em `private`, wrappers `public.*` SECURITY INVOKER,
`search_path=''`, RLS em tudo, storage gate de PDF no banco. Problemas:

### 3.1 🟠 ALTO — `private.award_both` com EXECUTE para `authenticated`
- Migration `20260731210000_xp_credits_store.sql:971-977` concede
  `execute on function private.award_both ... to authenticated, service_role`.
- `award_both` é SECURITY DEFINER e **não checa `can_target` nem `auth.uid()`**,
  e aceita `p_skip_cap boolean`. Hoje `private` não está no `exposed_schemas`
  (sem `config.toml` → default só `public`), então não é chamável via REST —
  **porém** qualquer futura exposição do schema (ou acesso SQL direto) permite
  cunhar XP/creditos ilimitados em qualquer `user_id`.
- **Fix:** remover `award_both`, `can_target`, `get_counter` do grant a
  `authenticated` (deixar só `service_role`); reforçar `can_target` dentro do
  próprio `award_both` como defesa em profundidade.

### 3.2 🟠 ALTO — `redeem_product` sem idempotência
- Migration XP/Loja: o RPC debita créditos e cria resgate sem chave de idempotência.
  Retry de rede/front duplica o resgate (confirma o achado de frontend 4.1).
- **Fix:** aceitar `p_idempotency_key` (ex.: UUID gerado pelo client), com
  `ON CONFLICT (idempotency_key) DO NOTHING` retornando o resgate original.

### 3.3 🟠 ALTO — `public.orders`: INSERT anônimo com status/valor arbitrários
- Migration `20260809040000_orders.sql` + `..._fix_orders_insert_policy.sql`:
  qualquer `anon` pode inserir ordem com `status IN ('pending','delivered','completed')`
  e `real_price` definido pelo client. → Pedidos falsos no painel admin, preço
  manipulado (se `real_price` virar a base de cobrança).
- **Fix:** remover `anon` do INSERT (só `authenticated`); não permitir `status`
  pré-definido pelo client (default `pending`, mudança só por RPC admin); o valor
  monetário de ordens reais deve vir de um RPC que valida contra o catálogo.

### 3.4 🟡 MÉDIO — `public.orders` sem `user_id` / RLS por dono
- Ordens não têm FK para o usuário; "meus pedidos" e o painel não conseguem provar
  propriedade. RLS de SELECT é ampla.

### 3.5 🟡 MÉDIO — Recompensa de referral alta com `p_skip_cap=true`
- `award_both(..., 500, 100, 'referral', ..., true)` — 500 XP + 100 creditos
  por indicação, fora do teto diário. Mitigado por exigir 30 dias de assinatura
  ativa do indicado, mas o valor é alto. Considerar teto mensal de indicações.

### 3.6 ✅ OK (validado)
- `subscriptions` com RLS só `service_role` na camada Stripe; policies legadas
  removidas.
- `user_emails` isolado de `profiles`; só dono/admin; e-mail não vaza.
- Storage `pdfs`: policy SELECT só admin ou assinante ativo de livro liberado
  (`can_read_book_pdf` SECURITY DEFINER).
- `profiles` RLS sem exposição de e-mail.

---

## 4. Frontend

### 4.1 🟠 ALTO — Débito duplo em retry no checkout (`CheckoutModal`)
- O fluxo de checkout (create-checkout → insert de ordem) pode rodar duas vezes em
  retry de clique/rede. Combinado com 3.2 (sem idempotência no RPC), gera dupla
  cobrança/resgate.
- **Fix:** desabilitar botão durante submit + idempotency key no insert.

### 4.2 🟠 ALTO — Erro de INSERT engolido sem feedback
- Em `CheckoutModal.jsx` (e em outros writes) o erro do `supabase.insert` é
  logado/ignorado sem feedback ao usuário → "sucesso" falso, usuário acha que
  assinou e não assinou.
- **Fix:** capturar erro, exibir toast/estado de erro, não marcar sucesso em falha.

### 4.3 🟡 MÉDIO — Diretriz de segurança em componentes
- Alguns componentes fazem checks de RLS/role no client como se fossem controle de
  segurança. É só UX; **o controle real está no banco** (ok por design). Documentar
  no `AGENTS.md` para não dar falsa sensação de segurança em futuros PRs.

---

## 5. Marketing / Funil

### 5.1 🟡 — Sem landing pública; `/assinar` atrás de login
- Não existe página de vendas pública; checkout só acessível após cadastro. Meta:
  adicionar landing pública com pricing (planos Leitor/Pensador) + link para login.

### 5.2 🟡 — CSP conflitante quebra Google Fonts
- Duas policies de CSP em disputa (uma bloqueia `fonts.googleapis.com/gstatic`).
  Resultado: fonte de fallback. Escolher uma única CSP (a mais restritiva) e
  permitir fontes explicitamente.

### 5.3 🟡 — SEO/OG básico ausente
- `index.html` sem OG tags e description na maioria das rotas. Baixo custo, ganho
  em conversão/landing.

---

## 6. Dependências / Build

- `npm audit --omit=dev` → **0 vulnerabilidades** em produção (44 deps prod).
- `npm audit` total → 6 vulns **dev-only** (4 low, 2 high): `esbuild` (high), etc.
  Não bloqueia release, mas atualizar em dev.
- `motion` 2 majors atrás da estável.
- `npm run check` não roda typecheck real (só lint/format). Adicionar `tsc --noEmit`.
- Sem campo `engines` no `package.json`.
- `npm test` → **12/12 passando** (verificado, incluindo `tests/plans.test.js`
  sincronizado com o catálogo novo: 19.000/22.800).

---

## 7. Segredos / Repo (verificado manualmente)

- ✅ `.env.local` existe em disco mas está no `.gitignore` (linha adicionada nesta
  sessão) — **não commitado**. Só `.env.example` está no git.
- ✅ HEAD = `85727c3f` (integração Stripe commitada).
- ⚠️ `.gitignore` foi modificado +9 linhas (opencode/, .claude-flow/data, .env.local)
  — mudança não commitada; `AGENTS.md` untracked.
- Arquivar os `LEITURA — *.md` da raiz em `docs/` para manter a raiz limpa (regra
  do AGENTS.md: nunca salvar na raiz).

---

## 8. Plano de ação priorizado

| Prioridade | Item | Ref |
|------------|------|-----|
| P0 | Job de transição `active→expired` no Stripe sync | 2.1 |
| P0 | Destravar recompra de clientes legacy (`ope_club_*` → tier) | 2.2 |
| P0 | Validar `price_id` ↔ plano no servidor | 1.1 |
| P1 | Remover grant `award_both`/helpers de `authenticated` | 3.1 |
| P1 | Idempotência em `redeem_product` + checkout (front) | 3.2 / 4.1 |
| P1 | Restringir INSERT de `orders` (só authenticated, status default) | 3.3 |
| P1 | Fechar XFF spoofing + error leak no `server/supabase.js` | 1.2 / 1.3 |
| P2 | Unificar `plan` vs `tier`; dedupe de webhook | 2.3 / 2.4 |
| P2 | Rate limit + auditoria em rotas admin | 1.4 |
| P2 | Feedback de erro em writes do front | 4.2 |
| P3 | Landing pública, CSP, OG tags | 5.x |
| P3 | Subir dev-deps (`motion`, esbuild), `engines`, `tsc --noEmit` | 6 |

---

*Gerado por auditoria multi-agente (researcher/architect/coder/tester/reviewer) com
verificação manual de evidências (git, migrations, RLS, npm audit, testes).*
