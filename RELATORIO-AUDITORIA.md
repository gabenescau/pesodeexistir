# Relatório de Auditoria Técnica — OPE Society (pré-produção)

**Data:** 31/07/2026 · **Escopo:** revisão estática completa (código, SQL/RLS, APIs serverless, pagamentos, configuração, dependências) — sem alteração de produção.
**Limites respeitados:** nenhuma chamada destrutiva; análise 100% por leitura de código e repositório.

---

## 1. Resumo executivo

O produto é um **clube de leitura com assinatura (OPE Club)** sobre uma base Vite + React (SPA) + Supabase (Postgres/RLS/Storage/Auth) + Vercel Functions (paywall e gestão de cobrança via AbacatePay). A base é **notavelmente boa**: RLS habilitado em todas as tabelas, funções `SECURITY DEFINER` restringidas, webhook com assinatura HMAC + idempotência, rate limiting com chave hash, logs com redação de segredos e sem `dangerouslySetInnerHTML`. Isso coloca o projeto acima da média de SaaS pequenos em maturidade de segurança.

**Há, porém, 1 achado CRÍTICO e 2 graves** que precisam de correção **antes** de qualquer lançamento maior:

1. **[CRÍTICO] Escalada de privilégio → virar admin** via RLS de `profiles` (ver M1).
2. **[GRAVE] Paywall de leitura (PDFs) depende de UI e de uma função/policy que não existem no schema versionado** (ver M2) — ou o leitor está quebrado para todos, ou o conteúdo pago não está protegido de verdade no servidor.
3. **[GRAVE] Controle de acesso "administrativo" com verificação duplicada e divergente** entre app_metadata e tabela profiles, somado ao item 1.

**Nota geral:** ~7.1/10. Com M1, M2 e M3 resolvidos, sobe para ~8.6/10.

> **Status (atualização 31/07/2026):** M1–M10 corrigidos nesta revisão (ver §10).
> Falta apenas **aplicar** as migrations no projeto remoto via `supabase db push`
> e validar manualmente (ver §9). M11–M14 permanecem abertos (fase 3/4).
>
> **Status (atualização 09/08/2026 — Fase 2 da revisão: economia/gamificação, migration `20260731210000_xp_credits_store.sql`):** novo escopo auditado (XP/créditos, loja de resgate, recompensas, wallet). M15 (anti-padrão `private.award_both`) e M16 (grant de créditos do admin quebrado) adicionados; M17 (RLS de subscriptions sem INSERT/UPDATE) documentado. Design geral do sistema de recompensas é sólido (`redeem_product` DEFINER com rate-limit + exigência de assinatura/meses ativos + débito com row-lock); os pontos fracos são anti-padrão de grants e peças de front/backend mortas (ver §5 M15–M17 e §10b).

---

## 2. Stack e arquitetura

| Camada | Tecnologia |
|---|---|
| Frontend | Vite 8.1.5 + React 19.2.7 (SPA, JS puro, sem TypeScript) |
| Rotas | React Router DOM 7.18.2 (`/app/*`, lazy loading) |
| Estilo | Tailwind 4 + shadcn + @base-ui + motion |
| Dados | Supabase JS 2.111.0 (PostgREST + Auth + Storage) |
| Backend | Vercel Functions (`api/*.js`), sem Express |
| Pagamentos | AbacatePay v2 (cartão = assinatura recorrente; PIX = acesso único) |
| PDF | pdfjs-dist (renderização client-side) |
| Infra | Vercel + Supabase (hosted) |

**Arquitetura de dados:** catálogo público (books/authors/categories) legível por anon; conteúdo social (posts, likes, follows, notas, comentários) por usuário autenticado com RLS; assinaturas e webhooks **somente service role**; e-mails isolados em `user_emails` (fora de `profiles`).

**Contornos de confiança:**
- O cliente usa **apenas** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`/`VITE_SUPABASE_PUBLISHABLE_KEY` (fallback `VITE_SUPABASE_ANON_KEY` só em DEV). Nenhum segredo de service role chega ao bundle (`envPrefix` em `vite.config.js`).
- O servidor (Vercel Functions) usa `SUPABASE_SECRET_KEY`/`ABACATEPAY_API_KEY`/`ABACATEPAY_WEBHOOK_SECRET` — só server-side.
- Storage: `avatars`/`covers` públicos (escrita autenticada/restrita), `pdfs` e `post-media` privados (URLs assinadas).

---

## 3. Mapa do código

### Frontend (`src/`)
- `src/app/AppShell.jsx` — rotas e guards (SubscriptionGuard nas rotas de conteúdo, AdminGuard em /app/admin).
- `src/app/data/AuthContext.jsx` — sessão via `supabase.auth`, perfil, RBAC.
- `src/app/data/DataContext.jsx` — estado global (books, posts, ratings, assinaturas, admin).
- `src/app/data/supabase.js` — cliente anon-only, sessão em `sessionStorage`.
- `src/app/pages/*` — páginas (Biblioteca, Explorar, Autor, Livro, Leitor, Lançamentos, Admin, Configurações…).
- `src/lib/` — sanitize, rbac, subscription, recommendations, library-media, releases, mentions, supabase-query/error.
- `src/components/ui/*` — kit shadcn.

### Backend (`api/` + `server/`)
- `api/health.js` — health check de env.
- `api/create-checkout.js` — cria reserva `pending`, produto/cliente na AbacatePay, checkout PIX (hosted) ou cartão (assinatura). Preço vem do `server/plans.js`, **nunca do frontend**.
- `api/subscription-action.js` — sync (reconciliação com a AbacatePay), change_plan (upgrade/downgrade).
- `api/cancel-subscription.js` — cancelamento (próprio usuário ou admin; com chamada de cancelamento remoto).
- `api/admin-subscription.js` — grant manual / set_duration (somente admin).
- `api/admin-suggestion.js` — mover/excluir sugestões (permissão `suggestions:manage`).
- `api/abacate-webhook.js` — recebe eventos da AbacatePay (assinatura HMAC + idempotência).
- `server/supabase.js` — helpers: auth via `auth/v1/user`, service-role fetch, CORS, rate limit via RPC, logs, helpers de subscription.
- `server/abacatepay.js` — cliente da API v2 (products, customers, checkouts, subscriptions).
- `server/plans.js` — catálogo de planos (preço, ciclo) — **fonte de verdade de preço**.
- `server/webhook-security.js` — HMAC-SHA256 + `timingSafeEqual`.

### Banco (`supabase/migrations/`)
- `0001_full.sql` — schema completo + RLS + funções + triggers + storage.
- `20260731152553_add_post_media_bucket_and_policies.sql` — bucket de imagens de posts.
- `20260731153400_fix_database_linter_security_issues.sql` — fixes do linter (view invoker, search_path, grants).
- `20260731154049_fix_security_definer_function_execute_grants.sql` — revoga EXECUTE de anon/authenticated.
- `20260731155832_add_book_ratings.sql` — notas 1–5 com RLS (novo, **não aplicado ainda**).

### Outros
- `local-sql/*.sql` — scripts manuais aplicados no dashboard (RBAC editor, permissões) — **fora de migrations** (risco de drift).
- `content/` — conteúdo local de fallback (20 autores) usado quando Supabase não está configurado.
- `tests/` — 5 arquivos de teste (`node --test`): plans, profile, sanitize-rbac, server-security, webhook-security (17 testes, todos passando).

---

## 4. Pontos fortes confirmados

- RLS habilitado em todas as tabelas públicas (conferido `0001_full.sql` seção 5).
- Funções `SECURITY DEFINER` com grants explícitos; `REVOKE EXECUTE` de anon/authenticated em `check_api_rate_limit`; default privileges endurecidos.
- `current_role()`/`is_admin()` usam `SET search_path` fixo.
- Webhook: `bodyParser:false`, limite 1 MB, assinatura HMAC com `timingSafeEqual`, idempotência via `abacatepay_webhook_events` (`on_conflict event_id` + `ignore-duplicates`), retry-friendly (500 quando assinatura local não achada).
- Rate limit compartilhado (API + RPC `check_api_rate_limit`), com hash HMAC da chave, janela fixa, headers `RateLimit-*`/`Retry-After`; limite por usuário + por IP.
- UUID validado em todos os IDs de rota (`requireUuid`) — mitiga IDOR/enumeração.
- Ownership checado: cancel-subscription e subscription-action só permitem dono ou admin.
- Admin: `requireAdmin`/`requirePermission` server-side + RLS admin no banco (defesa em profundidade).
- Preço e ciclo definidos no servidor (`plans.js`); produto validado contra o catálogo (`validateCatalogProduct`) antes do checkout.
- Sem XSS: `sanitize.js` remove controles, bidi e `< >`; RichText renderiza como texto React; nenhum `dangerouslySetInnerHTML` no app.
- Logs com redação de Bearer/JWT/e-mail/CPF; `X-Request-Id` em todas as respostas.
- Headers de segurança no Vercel (HSTS, nosniff, Referrer-Policy, Permissions-Policy); SPA com cache-control correto (index no-store, assets imutáveis).
- Sessão em `sessionStorage` (não persiste entre abas) + limpeza de tokens antigos de localStorage.
- Senha mínima 12 com 4 classes (client-side; Supabase também valida).
- `book_ratings`: média agregada **sem** expor `user_id` (revisão recente aplicada).

---

## 5. Matriz de risco (priorizada)

### M1 — [CRÍTICO] Escalada de privilégio para `admin` via RLS de `profiles`
- **Onde:** `supabase/migrations/0001_full.sql:574-575`
- **Problema:** a policy `profiles_update_own` é `USING (id = auth.uid()) WITH CHECK (id = auth.uid())`. Ela permite ao usuário atualizar **qualquer coluna** da própria linha — incluindo `role`. Não há trigger que impeça mudança de `role` (só existe `touch_updated_at`).
- **Exploração:** `PATCH /rest/v1/profiles?id=eq.<meu_id>  { "role": "admin" }` → `requireAdmin`/`is_admin()`/`AdminGuard` passam a valer → acesso a /app/admin, admin-subscription, todos os dados de usuários e assinaturas.
- **Correção sugerida (Fase 1):** policy mais restrita + trigger de guarda:
  - Adicionar coluna/flag auditável e impedir troca de role por auto-update. Ex.: trigger `BEFORE UPDATE` que `RAISE EXCEPTION` se `NEW.role IS DISTINCT FROM OLD.role` e `auth.uid()` não for admin de fato (usar `current_role()`), OU revogar `UPDATE` de `role` e forçar mudança de role por função `SECURITY DEFINER` (admin-only).
  - Alternativa mínima: `REVOKE UPDATE(role) ON profiles FROM authenticated;` (RLS não faz coluna, mas GRANT colunar resolve).

### M2 — [GRAVE] Paywall de leitura sem enforcement server-side real
- **Onde:** `src/app/pages/BookReaderPage.jsx:41-71`, `src/lib/releases.js:1-3`, `0001_full.sql` (storage `pdfs`, seção 16), comentários que citam `public.is_book_released()` (migration "00011") e "policy que valida assinatura ativa".
- **Problema:** (a) o bloqueio de leitura é decidido no cliente (`release.liberado` + `SubscriptionGuard` que só **borra a tela**); (b) o bucket `pdfs` **não tem nenhuma policy de SELECT no migrations** e a função `is_book_released()` citada no código **não existe** no schema versionado — provavelmente foi criada à mão no dashboard (drift) ou falta aplicar; (c) `createSignedUrl` no cliente depende de policy de storage; sem ela, **todos** (inclusive assinantes) falham; se existir uma policy ampla, **qualquer logado** (ou anon) gera URL de PDF pago.
- **Correção sugerida (Fase 1):**
  1. Criar migration com `is_book_released(book_id)` + policy de storage `pdfs` `FOR SELECT TO authenticated USING (bucket_id='pdfs' AND is_book_released(book_id) AND has_active_subscription(auth.uid()))`.
  2. Criar/validar `has_active_subscription()` (SECURITY DEFINER, search_path fixo).
  3. **Fechar a fonte da verdade:** guardar `pdf_path`/storage path e nunca servir `pdf_url` pública de PDF.
  4. Após isso, o `SubscriptionGuard` vira apenas camada de UX (aceitável).

### M3 — [GRAVE] Admin via `app_metadata.role` sem verificação de fonte
- **Onde:** `server/supabase.js:319,330`, `AuthContext.jsx:162-165`, `cancel-subscription.js:37`, `subscription-action.js:21-23`.
- **Problema:** `user.app_metadata.role === "admin"` é aceito como admin **em paralelo** com `profiles.role`. `app_metadata` é setado por admin no dashboard do Supabase, mas se algum fluxo (ou o item M1) permitir que `profiles.role` seja alterado pelo usuário, as duas fontes se contradizem e abrem o caminho para admin. Além disso, a dupla checagem dificulta auditar quem promoveu quem.
- **Correção sugerida (Fase 2):** definir **uma única fonte de verdade** (tabela `profiles.role`) e tratar `app_metadata` apenas como cache de leitura; auditar promoções via `logAuditEvent`.

### M4 — [MÉDIO] Reescrita de email quebra (coluna inexistente)
- **Onde:** `DataContext.jsx:1031-1033` (`payload.email` para `profiles`) + `SettingsPage.jsx:221`.
- **Problema:** `profiles` **não tem coluna `email`** (email mora em `user_emails`). O fluxo de troca de email faz `supabase.auth.updateUser` (ok) e depois `update profiles set email=...` → erro do PostgREST; a mensagem "Confira seu email…" não é exibida e o painel pode parecer quebrado.
- **Correção sugerida (Fase 2):** gravar em `user_emails` (RPC `SECURITY DEFINER` ou policy própria do dono); ou remover o segundo passo e depender só do `updateUser` + trigger.

### M5 — [MÉDIO] Sem CSP (Content-Security-Policy)
- **Onde:** `vercel.json` (headers).
- **Problema:** não há CSP. Como não há XSS por `dangerouslySetInnerHTML`, o risco atual é baixo, mas CSP é a defesa mais barata contra futuras regressões (ex.: marcação em bio/título).
- **Correção sugerida (Fase 2):** CSP restrita (default-src 'self'; script-src 'self'; connect-src para *.supabase.co e api.abacatepay.com; img-src https: data: blob:; worker-src blob: para pdfjs; frame-ancestors 'none').

### M6 — [MÉDIO] `webhookSecret` via query string
- **Onde:** `api/abacate-webhook.js:251` (`req.query.webhookSecret`).
- **Problema:** o segredo vai na URL; pode vazar em logs de proxy/CDN. A assinatura HMAC (header) já autentica o evento; o query param é redundante.
- **Correção sugerida (Fase 2):** remover o query param e manter só `x-webhook-signature` + o segredo usado como chave do HMAC.

### M7 — [MÉDIO] Rate-limit abre quando o RPC falha (fail-open)
- **Onde:** `server/supabase.js:287-305`.
- **Problema:** se `check_api_rate_limit` falhar (migration atrasada), o rate limit abre — decisão documentada, mas contrária ao princípio fail-closed para endpoints de pagamento.
- **Correção sugerida (Fase 2):** setar `RATE_LIMIT_FAIL_CLOSED=true` em produção (a env já existe), ou limitar o fail-open a endpoints não críticos.

### M8 — [MÉDIO] `book_ratings` expõe avaliação individual (user_id legível)
- **Onde:** `20260731155832_add_book_ratings.sql:21`.
- **Problema:** policy `SELECT USING (true)` para anon permite ler `user_id`, `book_id`, `rating` — dá para inferir quem avaliou o quê (LGPD/minimização). O front usa apenas a agregação, mas a policy libera a linha inteira.
- **Correção sugerida (Fase 3):** view/sem agregada que exponha apenas `book_id, avg, count` (ou restringir colunas via view `security_invoker`). Agregação no front em tabela inteira também escala mal — preferir `select book_id, count(*), avg(rating) group by` ou RPC.

### M9 — [MÉDIO] Drift entre `local-sql/` e migrations
- **Onde:** `local-sql/*.sql` (RBAC editor, permissões, grants).
- **Problema:** aplicados manualmente no dashboard; não estão no histórico de migrations. Um ambiente novo/recuperação não reproduz o mesmo estado → políticas divergentes entre prod e staging.
- **Correção sugerida (Fase 2):** versionar como migrations reais (idempotentes) e usar `supabase db push`/CLI.

### M10 — [MÉDIO] `.env.example` removido do repositório
- **Onde:** commit `459b9bd8` (deletou `.env.example`); `.gitignore` mantém `!.env.example`, mas o arquivo não existe.
- **Problema:** onboard de dev novo fica às cegas; risco de alguém copiar `.env.local` (com chave real) como exemplo.
- **Correção sugerida (Fase 3):** recriar `.env.example` **com placeholders** (nunca valores reais) e adicionar checagem no build.

### M11 — [BAIXO] Ajuste no plano PIX (acesso único) — sem renew
- **Onde:** `api/create-checkout.js` (billing_mode one_time), `server/abacatepay.js:194-219`.
- **Observação:** PIX vira `status active` com `current_period_end` (30/365 dias) e **não renova**; o `subscription-action` impede upgrade/downgrade desse modo ("na proxima renovacao") mas como não há renovação, usuário PIX fica "preso" até expirar. Verificar UX/expectativa.
- **Correção sugerida (Fase 3):** permitir que PIX expire e ofereça recompra; ou converter PIX em assinatura no vencimento.

### M12 — [BAIXO] Cover bucket com SELECT amplo mantido (documentado)
- **Onde:** `20260731153400:37` e `0001_full.sql:824-828`.
- **Observação:** mantido de propósito (URLs assinadas de capas). O linter não acusa porque o bucket não é "public". Aceitável; apenas registrado.

### M13 — [BAIXO] `content/` local como fallback pode divergir do banco
- **Onde:** `contentLoader.js`.
- **Observação:** quando Supabase não está configurado, o app usa conteúdo local; ok para DEV/preview, mas em produção a env de chave publishable estará sempre presente — garantir que nenhuma rota dependa do fallback.

### M14 — [BAIXO] Revisão de observabilidade
- **Observação:** logs são `console.info/error` (Vercel). Não há alertas configurados para: falhas de webhook em sequência, picos de 429, pagamento confirmado sem atualização de assinatura. Recomenda-se alertas no painel da Vercel/Supabase.

### M15 — [ALTO · defensa em profundidade] `private.award_both` executa por `authenticated` sem guarda interna
- **Onde:** `20260731210000_xp_credits_store.sql:37` (`grant usage on schema private to authenticated`), `:964-978` (loop de `grant execute ... to authenticated` nos helpers privados, incluindo `award_both`, `bump_counter`, `get_counter`, `day_activity_totals`, `can_target`), `:310-354` (`award_both`).
- **Problema:** `private.award_both(p_user_id, p_xp, p_credits, p_reason, p_source_ref, p_skip_cap)` é `SECURITY DEFINER search_path=''` e **não valida** quem chama: não há `auth.uid()`, nem `can_target`, nem `is_admin` dentro da função (só checa `p_user_id is null`). Ela insere direto em `private.wallet_ledger` e faz `update profiles set xp=..., credits=...`. O grant a `authenticated` existe porque os RPCs públicos `reward_post`, `reward_comment`, `reward_likes_received` e `report_reading_session` são `SECURITY INVOKER` e dependem do grant para chamar os helpers privados. Consequência: **se o schema `private` for exposto ao PostgREST** (por exemplo, alguém adicionar `db-schemas = "public, private"` no `config.toml`, hoje inexistente no repositório), qualquer usuário autenticado cunha XP/créditos ilimitados para si (ou para outro, via `p_user_id`) com `p_skip_cap=true` — sem rate-limit nem cap.
- **Explorabilidade atual:** **baixa** — o cliente só chama `supabase.rpc(name, args)` com schema default `public` (verificado em `src/app/data/supabase.js` e `src/lib/rewards.js:43-50`) e não há `config.toml` no repo, então `private` não é exposto via API hoje. O risco é **latente + desenho** (regressão de configuração viraria escalada), e ainda assim viola least-privilege: `authenticated` não deveria ter `EXECUTE` em helpers de escrita.
- **Correção sugerida (Fase 1B):**
  1. Converter os RPCs públicos de recompensa (`reward_post`, `reward_comment`, `reward_likes_received`, `report_reading_session`) para `SECURITY DEFINER` (como `redeem_product`/`reward_login` já são) — eles já fazem `can_target`/`auth.uid()` internamente, então manteriam a autorização.
  2. `REVOKE EXECUTE ... FROM authenticated` nos helpers privados de escrita (`award_both`, `bump_counter`, `get_counter`, `day_activity_totals` etc.), mantendo só `service_role` e o owner.
  3. Como redundância, adicionar guarda no corpo de `award_both`: `if not private.can_target(p_user_id) then return false; end if;` e validar `p_skip_cap` (só admin/sem pular caps para auto-grant).

### M16 — [MÉDIO · funcional] Grant manual de créditos/XP do admin não funciona
- **Onde:** `src/app/pages/AdminPage.jsx:397-464` (`handleAddCredits`), `src/app/data/RewardsContext.jsx:226-231` (`addCredits`), `src/app/pages/RankingPage.jsx:21`, `src/app/components/MonthlyRanking.jsx:22`.
- **Problema:** o admin panel tenta `upsert` em `user_wallets` (tabela que **não existe** em nenhuma migration — conferido via grep no repo) e depois chama `addCredits`, que é só simulação local (`// Simula adicao de creditos localmente`). O `console.warn` cai em catch silencioso + toast de sucesso **falso**; RankingPage/MonthlyRanking também referenciam `user_wallets`. Não existe RPC de grant (o único RPC admin é `spam_revert`). Ou seja: o admin **não consegue** ajustar saldo pela UI — funcionalidade morta que ainda parece funcionar.
- **Correção sugerida (Fase 3):** criar RPC `SECURITY DEFINER` admin-only `private.admin_grant(user_id, xp, credits, reason)` (com `is_admin()` + `logAuditEvent`) e fazer o AdminPage chamá-lo; remover a simulação local e as refs a `user_wallets`.

### M17 — [MÉDIO · funcional] RLS de `subscriptions` só tem SELECT; fallbacks do front são código morto
- **Onde:** `0001_full.sql` (policy `subscriptions_read_own_or_admin`), `src/app/data/DataContext.jsx:808-907` (fallbacks de insert/update subscription), `api/admin-subscription.js:140` (actions só `grant`/`set_duration`).
- **Problema:** sem policy de INSERT/UPDATE/DELETE para `authenticated`, qualquer escrita de subscription via cliente falha (só service_role escreve). Os fallbacks de criação/atualização no DataContext nunca funcionam (segurança OK — UX quebrada/enganosa). No endpoint admin, ações como `cancel`/`remove` retornam 400 "Acao invalida" — não há como cancelar assinatura pelo painel (só grant/set_duration), o que força caminho manual.
- **Correção sugerida (Fase 3):** remover os fallbacks mortos do DataContext (ou torná-los service-role server-side), e expor cancel/revoke via endpoint admin (chamando a AbacatePay, como já faz `cancel-subscription.js`).

### M18 — [BAIXO · observação] `redeem_product` não expõe estoque/limite de produto
- **Onde:** `20260731210000_xp_credits_store.sql:734+`.
- **Observação:** validação é sólida (rate-limit `md5(v_uid||':redeem')`, produto ativo, `has_active_subscription()`, `active_months >= min_months_active`, débito com row-lock). Não há conceito de estoque finito nem de limite por usuário além do débito de créditos — ok para digital; registrar como melhoria se houver itens físicos.

---

## 6. Scores por área (0–10)

| Área | Score | Comentário |
|---|---|---|
| Segurança de dados / RLS | 9.0 | M1 (escalada) e M8 (ratings) corrigidos; RLS + helpers versionados |
| Segurança da API serverless | 8.8 | Auth por endpoint, UUID, ownership, rate limit fail-closed (M7) |
| Pagamentos & webhooks | 8.8 | Preço server-side, HMAC, idempotência; query param removido (M6) |
| Paywall / proteção de conteúdo | 8.5 | M2: enforcement no banco (policy de storage `pdfs`); leitura precisa de teste manual |
| Configuração / deploy / headers | 8.5 | CSP (M5), migrations versionadas (M9), .env.example (M10) |
| Frontend (XSS / sanitização) | 9.0 | Muito sólido |
| Dependências | 7.5 | react-router com aviso de CSRF RSC (não aplicável a SPA; ver nota) |
| Observabilidade / auditoria | 7.5 | Logs estruturados e redigidos; faltam alertas (M14) |
| LGPD / privacidade | 7.5 | M8 corrigido; cookies/consentimento a revisar |
| Testes | 6.0 | 17 testes de unidades de segurança; sem testes de integração das APIs/RLS |
| **Geral** | **8.7** | M1–M10 corrigidos; pendente aplicação remota + M11–M14 |

---

## 7. Plano de fases

### Fase 1 — Bloqueadores (antes de lançar / imediatamente)
1. **M1** — bloquear escalada de role (trigger + revoke colunar de `role`).
2. **M2** — criar `is_book_released()` + `has_active_subscription()` + policy de storage `pdfs`; versionar em migration; remover dependência de function manual no dashboard.
3. **M3** — fonte única de verdade para admin (`profiles.role`) + auditoria de promoções.

### Fase 1B — Economia/recompensas (junto da Fase 1, na migration do XP)
4. **M15** — tornar RPCs de recompensa `SECURITY DEFINER`; revogar `EXECUTE` de `authenticated` nos helpers privados; guarda `can_target` dentro de `award_both` (ver §5).

### Fase 2 — Segurança e robustez (1ª semana pós-Fase 1)
5. **M4** — corrigir fluxo de email (gravar em `user_emails`).
6. **M5** — CSP restrita no `vercel.json`.
7. **M6** — remover `webhookSecret` da query string.
8. **M7** — `RATE_LIMIT_FAIL_CLOSED=true` em produção.
9. **M9** — migrar `local-sql/` para migrations versionadas.

### Fase 3 — Privacidade, escala e operação (2ª–3ª semana)
10. **M8** — view agregada de ratings (sem `user_id` exposto; agregação no banco).
11. **M10** — recriar `.env.example` com placeholders.
12. **M11** — revisar ciclo de vida do PIX (expiração/recompra).
13. **M14** — alertas de observabilidade (webhook, 429, pagamentos).
14. **M16** — RPC admin de grant de créditos/XP + remover `user_wallets` e a simulação local.
15. **M17** — limpar fallbacks mortos de subscriptions no DataContext; expor cancel/revoke no endpoint admin.

### Fase 4 — Qualidade contínua
13. Testes de integração das policies (ex.: role escalation, assinante vs. não assinante lendo PDF).
14. Supabase Database Linter + `supabase db push` como gate de CI.
15. Revisão de LGPD/consentimento de cookies (já há texto no auth-page; formalizar policy).
16. Considerar MFA/step-up para admin.

---

## 8. Roadmap sugerido

- **Dia 0–2:** Fase 1 (M1, M2, M3) + aplicar migrations pendentes (`20260731152553`, `20260731153400`, `20260731154049`, `20260731155832`).
- **Dia 3–7:** Fase 2.
- **Dia 8–21:** Fase 3.
- **Contínuo:** Fase 4; rodar `npm audit` em cada release.

---

## 9. Itens que precisam de confirmação manual (fora do alcance do código)

- **Aplicar as migrations novas no projeto remoto:** `supabase db push` (ou SQL Editor) para, na ordem: `20260731163000` (M1), `20260731170000` (M2), `20260731170001` (M9), `20260731171000` (M3), `20260731172000` (M4), `20260731173000` (M8) — além das pendentes `20260731152553`, `20260731153400`, `20260731154049`, `20260731155832`.
- **Teste manual de leitura de PDF:** após aplicar M2, confirmar que assinante ativo lê livro lançado, não-assinante recebe erro, e livro com `weekly_releases` futura ainda bloqueado.
- **Teste manual de role:** confirmar que `PATCH /rest/v1/profiles` com `role: "admin"` falha (REVOKE colunar + trigger M1) e que admins/editors ainda editam catálogo (M9).
- **Deploy:** redeploy da Vercel com as novas envs (`.env.example` é o guia); `RATE_LIMIT_FAIL_OPEN` só se quiser reabrir manualmente (M7 agora é fail-closed por default).
- **Supabase Database Linter + `supabase init`/`db push` como gate de CI** (item de Fase 4).
- **Leaked password protection (HaveIBeenPwned):** ligar manualmente em *Authentication → Providers → Email → Prevent password leaks* (requer plano Pro; não há SQL — ver §11).

---

## 10. Fixes aplicados nesta revisão (31/07/2026)

Todos os itens abaixo passam em `npm run check` (lint + 17 testes + build).

### Migrations novas (`supabase/migrations/`)

| Migration | Achado | Resumo |
|---|---|---|
| `20260731163000_block_role_escalation.sql` | **M1** | `REVOKE UPDATE(role)` de `authenticated` em `profiles` + trigger `guard_profile_role_change` (`BEFORE UPDATE OF role`) que só deixa trocar role por admin autenticado ou server-side (sem JWT). |
| `20260731170000_pdf_paywall_functions_and_storage_policy.sql` | **M2** | Schema `private` + helpers `SECURITY DEFINER` (`is_admin`, `has_active_subscription`, `profile_is_verified`, `can_read_book_pdf`, `is_book_released`, `is_pdf_object_released`, `search_path=''`) + wrappers públicos `SECURITY INVOKER` + policy de SELECT no bucket `pdfs` (`pdfs_select_released`: admin OU assinante ativo E livro liberado). |
| `20260731170001_version_rbac_editor_and_grants.sql` | **M9** | Versiona `local-sql/` (RBAC editor + `can_manage_content` + policies `content_managers_*` + storage `covers`/`pdfs` + GRANTs do PostgREST). Correção: buckets reais (`covers`/`pdfs`) em vez de `book-pdfs`/`authors`. |
| `20260731171000_admin_single_source_of_truth.sql` | **M3** | `current_role()` sem fallback para `raw_app_meta_data->>'role'` — única fonte de verdade é `profiles.role`. |
| `20260731172000_sync_user_email_on_change.sql` | **M4** | Trigger `on_auth_user_email_changed` em `auth.users` espelha troca de email em `user_emails` (padrão do `handle_new_user`). |
| `20260731173000_public_ratings_aggregate_view.sql` | **M8** | View `book_ratings_public(book_id, rating_count, rating_sum)` (sem `user_id`); policy de leitura de `book_ratings` vira owner-only; anon perde SELECT na tabela. |
| `20260731180000_fix_supabase_linter_view_and_function_grants.sql` | **Linter** | View vira `SECURITY INVOKER` (agregado via `private.book_ratings_summary`); revoga `EXECUTE` de `sync_user_email_on_change` para anon/authenticated; policies de `weekly_releases`/`suggestions` trocam `current_role()` por `can_manage_content()` e `current_role()` perde EXECUTE. |

### Código

| Arquivo | Achado | Mudança |
|---|---|---|
| `server/supabase.js` | M3, M7 | `requireAdmin`/`requirePermission` só usam `profiles.role`; rate limit **fail-closed por default** (`RATE_LIMIT_FAIL_OPEN` é o escape). |
| `api/cancel-subscription.js`, `api/subscription-action.js` | M3 | Removida checagem de `app_metadata.role`. |
| `src/app/data/AuthContext.jsx`, `src/app/data/DataContext.jsx` | M3 | `role`/`isCurrentAdmin` só de `profile.role`; dep removida. |
| `src/app/data/DataContext.jsx` | M8 | Lê a view `book_ratings_public` (agregação no banco); shape `{sum,count}` mantido. |
| `src/app/data/DataContext.jsx`, `src/app/pages/SettingsPage.jsx` | M4 | Email não é mais gravado em `profiles`; troca depende de `updateUser` + trigger. |
| `api/abacate-webhook.js` | M6 | Removido `webhookSecret` da query string (mantém `x-webhook-signature` + chave pública HMAC). |
| `vercel.json` | M5 | CSP restrita (`default-src 'self'`, `connect-src *.supabase.co`, `img-src https: data: blob:`, `worker-src blob:` etc.). |
| `.env.example` | M10 | Recriado com placeholders (nunca valores reais). |

### Ainda abertos

- **M11** (PIX `one_time` sem renew — decisão de produto), **M12** (documentado, mantido), **M13** (`content/` fallback local), **M14** (alertas de observabilidade).
- **M15** (grants de helpers privados / `award_both`), **M16** (grant de créditos do admin), **M17** (fallbacks mortos de subscriptions), **M18** (estoque de produto — observação).
- **Aplicação remota** das migrations e testes manuais (§9) e testes de integração das policies (Fase 4).

---

## 10b. Fase 2 da revisão — economia/gamificação (09/08/2026)

Escopo: migration `20260731210000_xp_credits_store.sql` (XP/créditos, loja, recompensas, wallet) + camada de dados do front. Leitura completa confirmada do M13 (helpers `private.*`, RPCs públicos, `redeem_product`, grants 958-1040).

### O que está **correto** no desenho

| Área | Verificado |
|---|---|
| `redeem_product` | `SECURITY DEFINER search_path=''`; rate-limit `md5(v_uid\|\|':redeem')` (10/60s); produto precisa `active` + `has_active_subscription()` + `active_months >= min_months_active`; débito com row-lock (`update ... where id=v_uid and credits>=cost`). |
| `reward_login` | DEFINER, `auth.uid()`, award 5/1, `bump_counter` 1x/dia. |
| `reward_comment` / `reward_likes_received` | INVOKER mas com `can_target(p_user_id)` + contadores anti-spam (`>= 5`, `is_repetitive_comment`, `least(likes_received_today,20)`). |
| `wallet_state_core` | snapshot DEFINER (xp/credits/level/streak/today/missions) — só leitura. |
| Loja de créditos | `insert/update/delete on shop_products` para `authenticated` com policy `with check (is_admin())` (linha 159) — barreira real. |
| RPC admin | único é `spam_revert` (recalcula do ledger); sem RPC de grant. |
| `current_role()` (M3) | sem fallback de `app_metadata` — única fonte é `profiles.role`. |

### O que está **fraco** (M15–M18, detalhes em §5)

- **M15 (ALTO, latente):** grants de helpers privados a `authenticated` são efeito colateral dos RPCs INVOKER. Não explorável via API hoje (schema `private` não exposto; cliente usa só schema `public`), mas viraria escalada de XP/créditos se `config.toml` passar a expor `private`. Converter RPCs de recompensa para DEFINER elimina o grant e o risco.
- **M16 (MÉDIO):** grant manual de créditos/XP na UI é código morto (`user_wallets` não existe; `addCredits` é simulação local; sucesso falso).
- **M17 (MÉDIO):** RLS de `subscriptions` só leitura → fallbacks de escrita no DataContext nunca rodam; endpoint admin não tem ação de cancel/revoke.
- **M18 (BAIXO):** sem estoque finito em `redeem_product` (ok para digital; nota para físico).

---

## 11. Supabase Database Linter — achados e remediação (31/07/2026)

Achados do **Database Security Advisor** no projeto remoto e o status após a migration `20260731180000_fix_supabase_linter_view_and_function_grants.sql`.

| # | Check | Objeto | Status |
|---|---|---|---|
| 1 | `0010_security_definer_view` (ERROR) | `public.book_ratings_public` (SECURITY DEFINER burlava RLS) | **Corrigido** — view virou `SECURITY INVOKER`; a agregação passou para `private.book_ratings_summary()` (SECURITY DEFINER fora do schema exposto na API), e a leitura direta de `book_ratings` segue owner-only. |
| 2 | `0028_anon_security_definer_function_executable` (WARN) | `public.sync_user_email_on_change()` | **Corrigido** — revogado `EXECUTE` de `public`/`anon`/`authenticated` (trigger function não precisa de grant público; fica só `supabase_auth_admin`). |
| 3 | `0029_authenticated_security_definer_function_executable` (WARN) | `public.sync_user_email_on_change()` | **Corrigido** — mesmo revoke acima. |
| 4 | `0029_authenticated_security_definer_function_executable` (WARN) | `public.current_role()` | **Corrigido** — as 3 policies que a chamavam (0001_full: `weekly_releases_admin`, `suggestions_update_owner_admin`) agora usam `public.can_manage_content()` (SECURITY INVOKER); `current_role()` perdeu `EXECUTE` para anon/authenticated. |
| 5 | `auth_leaked_password_protection` (WARN) | Setting de Auth (HaveIBeenPwned) | **Manual** — ligar em *Authentication → Providers → Email → Prevent password leaks* (plano Pro). Sem SQL; não entra em migration. |

**Pendências pós-remoção:**
- Re-rodar o Security Advisor após aplicar a migration e confirmar que os itens 1–4 sumiram; o item 5 só some após o toggle manual no dashboard.
- Validação extra do fluxo de ratings no front: a view continua expondo apenas `{book_id, rating_sum, rating_count}` (shape usado em `DataContext.jsx:228`).
