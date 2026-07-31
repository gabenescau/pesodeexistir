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

### Fase 2 — Segurança e robustez (1ª semana pós-Fase 1)
4. **M4** — corrigir fluxo de email (gravar em `user_emails`).
5. **M5** — CSP restrita no `vercel.json`.
6. **M6** — remover `webhookSecret` da query string.
7. **M7** — `RATE_LIMIT_FAIL_CLOSED=true` em produção.
8. **M9** — migrar `local-sql/` para migrations versionadas.

### Fase 3 — Privacidade, escala e operação (2ª–3ª semana)
9. **M8** — view agregada de ratings (sem `user_id` exposto; agregação no banco).
10. **M10** — recriar `.env.example` com placeholders.
11. **M11** — revisar ciclo de vida do PIX (expiração/recompra).
12. **M14** — alertas de observabilidade (webhook, 429, pagamentos).

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
- **Aplicação remota** das migrations e testes manuais (§9) e testes de integração das policies (Fase 4).
