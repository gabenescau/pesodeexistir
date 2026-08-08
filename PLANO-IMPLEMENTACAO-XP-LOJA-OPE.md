# Plano de Implementação — Sistema de XP, Créditos OPE e Loja

**Projeto:** OPE Club (pesodeexistir) · React 19 + Vite + Supabase (Postgres + PostgREST + Auth + Storage) + AbacatePay
**Versão do documento:** 1.0 · **Status:** Design completo, revisado e sem pontas soltas abertas
**Fonte da especificação:** `Sistema de XP e Loja OPE Club.pdf` (V1)

---

## 0. Resumo executivo

O ecossistema de recompensas (XP, Créditos OPE, missões e Loja) **não existe hoje no código nem no banco** — existe apenas como texto de marketing em `src/lib/abacatepay.js` e na landing page. Este plano desenha a implementação completa e **server-authoritative**: o banco é a fonte da verdade, o cliente apenas dispara RPCs.

Princípios não negociáveis:
1. **XP nunca é consumido** — é reputação. **Créditos OPE é a única moeda debitável** (resgates).
2. **Toda escrita de saldo passa pelo banco** (ledger + RPCs `SECURITY DEFINER`), nunca pelo cliente.
3. **Limites diários idempotentes** por chave `(user_id, métrica, dia)`.
4. **Anti-fraude** contra curtidas suspeitas, comentários repetitivos e leitura sem interação.

---

## 1. Estado atual (levantamento feito no código)

| Área | Situação hoje | Onde |
|---|---|---|
| Conquistas (12) | **Existem**, mas stateless (recalculadas no cliente) | `src/lib/achievements.js` |
| XP / Créditos / Level / Ranking | **Não existem** (nenhuma coluna ou tabela) | — |
| Loja / resgate | **Não existe** | — |
| Missões / Seasons / Streak | **Não existem** | — |
| Leitura | Salva só `current_page/total_pages/progress` | `BookReaderPage.jsx` → `reading_progress` |
| Social | `posts`, `post_replies`, `post_likes`, `reactions`, `follows`, `saved_posts` — escritas diretas via RLS | `DataContext.jsx` |
| Assinatura | `subscriptions` + AbacatePay webhook, paywall de PDF no banco | `server/plans.js`, `api/abacate-webhook.js` |
| RBAC | `profiles.role` (`user/editor/admin`) | `src/lib/rbac.js` |

### ⚠️ Divergência de preço que precisa ser resolvida antes da Loja

- Frontend e landing (`src/lib/abacatepay.js`): **R$ 19 (Leitor) / R$ 29 (Pensador)**.
- Backend (`server/plans.js`), que é a fonte real da cobrança: **R$ 24/mês (2400) e R$ 168/ano (16800)**.
- **Ação obrigatória:** alinhar os dois. A economia abaixo é agnóstica à escolha, mas **deve haver uma única fonte de preço**. Recomendação: manter o catálogo do servidor como verdade e ajustar o texto do frontend, ou ajustar o servidor para os valores prometidos ao usuário.

---

## 2. Modelo de negócio

### 2.1 Conceitos

- **XP** — reputação perpétua. Evolui nível, selos, ranking e conquistas. Nunca é gasto.
- **Créditos OPE** — moeda da Loja. Acumulado e gasto exclusivamente em resgates de produtos físicos.
- **Loja OPE** — catálogo permanente (sem surpresas, sem sorteios), com produtos sempre disponíveis.

### 2.2 Eventos de negócio e recompensas (tabela da especificação)

| Evento | XP | Créditos | Limite |
|---|---|---|---|
| Login diário | +5 | +1 | 1×/dia |
| Leitura ≥15 min com interação | +15 | +5 | por sessão |
| Acumulado de 30 min no dia | +15 | +5 | 1×/dia |
| Publicar reflexão | +20 | +3 | 2×/dia |
| Comentar publicação | +10 | +2 | 5×/dia |
| Receber curtida | +2 | +1 | 20×/dia |
| Missão diária completa (4 objetivos) | +80 | +15 | 1×/dia |
| Missão semanal (7 dias consecutivos) | +200 | +40 | 1×/semana |
| Indicação (amigo ativo ≥30 dias) | +500 | +100 | por indicação |

**Teto duro de atividade:** XP ≤ **120/dia** e Créditos ≤ **30/dia** para ações cotidianas (login + leitura + post + comentário + curtida). Missões e indicação têm limites próprios e **não contam** para o teto de 30 créditos.

### 2.3 Regras da Loja (catálogo V1)

| Produto | Custo | Tempo mínimo interno de assinatura |
|---|---|---|
| Livro físico (edição simples) | 450 | 2,5 meses |
| Livro Premium | 900 | 5 meses |
| Oversized OPE Club | 1.800 | 8 meses |
| Moletom Oficial | 2.800 | 12 meses |

- Frete **sempre grátis**.
- O tempo mínimo é validado **internamente pelo sistema** e **nunca exibido** ao usuário. Se não cumprido, botão bloqueado com mensagem genérica: *"Continue participando do OPE Club para desbloquear esta recompensa."*
- O produto exibe: foto, nome, descrição, créditos necessários, créditos atuais, barra de progresso e botão "Resgatar".

---

## 3. Arquitetura de persistência (schema)

Nova migração: `supabase/migrations/<timestamp>_xp_credits_store.sql`.

### 3.1 Tabelas novas

```sql
-- --- Perfil (saldo denormalizado para leitura rápida) ---
alter table public.profiles
  add column if not exists xp integer not null default 0,
  add column if not exists credits integer not null default 0;

-- --- Ledger de auditoria (fonte de verdade dos saldos) ---
create table if not exists private.wallet_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  currency text not null check (currency in ('xp','credit')),
  amount integer not null,              -- + ganho / - gasto
  reason text not null,                 -- login|reading|post|comment|like_received|daily_mission|weekly_mission|referral|redeem|spam_reversal|manual
  source_ref text,                      -- id de referência (post_id, session_id, etc.)
  day_key date not null,                -- chave de dedupe diária
  created_at timestamptz not null default now()
);
create index if not exists wallet_ledger_user_day on private.wallet_ledger(user_id, day_key);
create index if not exists wallet_ledger_currency on private.wallet_ledger(user_id, currency, created_at);

-- --- Contadores de limite diário (idempotência) ---
create table if not exists private.wallet_counters (
  user_id uuid not null,
  metric text not null,                 -- login|reading_min|post|comment|like_received
  count integer not null default 0,
  day_key date not null,
  primary key (user_id, metric, day_key)
);

-- --- Streak de login ---
create table if not exists private.login_streak (
  user_id uuid primary key,
  current integer not null default 0,
  best integer not null default 0,
  last_day date
);

-- --- Catálogo da Loja ---
create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null check (category in ('book','book_premium','oversized','hoodie','exclusive')),
  credits_cost integer not null check (credits_cost > 0),
  min_months_active integer not null default 0,
  image_url text,
  active boolean not null default true,
  external_sku text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --- Resgates / pedidos ---
create table if not exists public.shop_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.shop_products(id),
  credits_spent integer not null,
  status text not null default 'pending'
    check (status in ('pending','processing','shipped','fulfilled','rejected','refunded')),
  customer_name text,
  customer_email text,
  address_json jsonb,                   -- endereço de entrega
  tracking_code text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shop_redemptions_user on public.shop_redemptions(user_id, created_at desc);

-- --- Indicações ---
create table if not exists public.referrals (
  referrer_user_id uuid not null references public.profiles(id) on delete cascade,
  referred_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  rewarded_at timestamptz,
  primary key (referrer_user_id, referred_user_id)
);
```

> Saldo denormalizado em `profiles` é atualizado **na mesma transação** que insere o ledger (garantia de consistência). O ledger é a fonte de verdade; a coluna é cache de leitura.

### 3.2 RLS (seguindo o padrão do repo)

- `shop_products`: SELECT `anon`+`authenticated`; INSERT/UPDATE/DELETE somente `authenticated` **se `private.is_admin()`**.
- `shop_redemptions`: SELECT `user_id = auth.uid()` ou admin; INSERT próprio/admin; UPDATE admin (status/fulfillment).
- `referrals`: INSERT com `referred_user_id`; SELECT próprio; `rewarded_at` só via RPC.
- `wallet_ledger`, `wallet_counters`, `login_streak` no schema `private`: **sem grant público**, apenas `service_role`. Nenhum cliente acessa diretamente.

---

## 4. Regra de negócio (RPCs server-authoritative)

Segue o padrão já usado em `20260731170000_pdf_paywall_functions_and_storage_policy.sql`: helpers `private.*` `SECURITY DEFINER` com `set search_path = ''` + wrappers `public.*` `SECURITY INVOKER`.

| RPC | Chamado por | Regra central |
|---|---|---|
| `public.reward_login()` | Frontend (sessão/entrada) | Dedupe por `day_key`; atualiza streak; +5xp/+1crédito |
| `public.report_reading_session(book_id, seconds, interacted)` | `BookReaderPage` (heartbeat) | Só credita se `interacted=true`; acumula minutos do dia; aplica marcos de 15/30min; respeita teto |
| `public.reward_post(user_id)` | após `addPost` | +20xp/+3créditos; 2×/dia |
| `public.reward_comment(user_id)` | após comentário | +10xp/+2créditos; 5×/dia; ignora repetitivos |
| `public.reward_likes_received(owner_id)` | ao carregar perfil/feed próprio | +2xp/+1crédito; 20×/dia; ignora contas suspeitas |
| `public.complete_daily_mission()` | Frontend | Verifica os 4 objetivos do dia via contadores; +80xp/+15créditos |
| `public.complete_weekly_mission()` | Frontend | Verifica streak de 7 dias; +200xp/+40créditos |
| `public.redeem_product(product_id, customer, address)` | Loja | Valida crédito ≥ custo, assinatura ativa (`private.has_active_subscription()`), tempo mínimo; debita ledger; cria `shop_redemptions`; tudo em 1 transação |
| `public.referral_claim(referred_user_id)` | Frontend | Confere convidado ativo ≥30d (`subscriptions`); credita +500xp/+100créditos |
| `private.spam_revert(user_id, reason)` | Admin | Reverte ganhos de período suspeito (função de reversão do PDF) |

### 4.1 Exemplo de estrutura da transação de resgate (núcleo crítico)

```sql
create or replace function public.redeem_product(...)
returns json security invoker
language plpgsql as $$
begin
  -- 1. Verifica assinatura ativa
  if not private.has_active_subscription() then
    raise exception 'ASSINATURA_INATIVA';
  end if;
  -- 2. Verifica tempo mínimo (meses desde primeira assinatura ativa)
  if private.active_months(auth.uid()) < p_product.min_months_active then
    raise exception 'TEMPO_MINIMO_NAO_ATINGIDO';
  end if;
  -- 3. Verifica saldo e debita (com lock para evitar corrida)
  update public.profiles
     set credits = credits - p_product.credits_cost
   where id = auth.uid() and credits >= p_product.credits_cost;
  if not found then raise exception 'CREDITOS_INSUFICIENTES'; end if;
  -- 4. Ledger (gasto)
  insert into private.wallet_ledger(user_id, currency, amount, reason, source_ref, day_key)
  values (auth.uid(), 'credit', -p_product.credits_cost, 'redeem', p_product_id, current_date);
  -- 5. Cria pedido
  insert into public.shop_redemptions(...) returning id;
end;
$$;
```

---

## 5. Economia e retenção

### 5.1 Curva de nível (XP)

Derivada e determinística (função `private.level_from_xp(xp)`), nunca gravada como dado:

| Nível | XP acumulado |
|---|---|
| 1 | 0 |
| 2 | 100 |
| 3 | 250 |
| 4 | 500 |
| 5 | 900 |
| 10 | ~5.000 |
| 20 | ~25.000 |

Fórmula: `xp_para_nivel(n) = 100 · n^1.6`. O front mostra progresso para o próximo nível (barra), gerando a sensação "estou cada vez mais perto do próximo nível" que a spec pede.

### 5.2 Sustentabilidade dos créditos

- Com teto de 30 créditos/dia (atividades) + 15/dia (missão diária), um assinante engajado acumula **~45 créditos/dia**, atingindo um livro comum (450) em **~10 dias de atividade** — mas o mínimo de 2,5 meses ancora a permanência.
- O moletom (2800, mínimo 12 meses) é a **âncora de retenção de 1 ano**.
- Missões e indicações movem o acúmulo para cima **sem quebrar** o teto anti-spam (têm limites próprios).

---

## 6. Fluxo do usuário (UX ponta a ponta)

### 6.1 Progressão diária
1. **Login** → `reward_login` (dedupe). Painel "Recompensas" mostra saldo, streak e objetivos do dia (0/4).
2. **Leitura** (`BookReaderPage`) → sensor envia heartbeats só quando há interação; marcos de 15/30min creditam.
3. **Reflexão / comentário** → `reward_post` / `reward_comment`.
4. **Perfil / feed** → `reward_likes_received` (curtidas do dia, ignorando suspeitas).

### 6.2 Loja (`/loja`)
- Catálogo permanente: cards com foto, nome, descrição, custo, **saldo atual + barra de progresso** e botão "Resgatar".
- Botão desabilitado quando saldo insuficiente ou tempo mínimo não atingido (mensagem genérica, **sem** mostrar tempo restante).
- Resgate: validação → coleta de endereço → confirmação → `redeem_product` → tela "Pedido em andamento".
- Página "Meus Resgates": status `pending → processing → shipped → fulfilled` + código de rastreio.

### 6.3 Missões e Seasons (V2, extensão do mesmo modelo)
- Missão diária = agregador dos 4 objetivos (login, 30min de leitura, 1 reflexão, 2 comentários) — derivada dos contadores.
- Missão semanal = streak de 7 dias consecutivos (`login_streak`).
- Seasons = tabela de período opcional; em V1 pode ser apenas rótulo/campanha na Loja.

---

## 7. Fulfillment (Loja)

- **V1 (manual):** aba "Resgates" no `AdminPage` lista pedidos `pending`; admin altera para `processing` → `shipped` (com `tracking_code`) → `fulfilled`. Custos de envio são cobertos pelo OPE (frete grátis prometido).
- **V2 (desejável):** integração **Cakto** (provider já existe no enum `subscriptions.provider`) para criar o pedido de envio real a partir de `address_json`. `external_sku` do produto mapeia o SKU na Cakto.
- **Atenção financeira:** definir orçamento/custo unitário por categoria e teto mensal de resgates antes de liberar o catálogo (ver §10).

---

## 8. Segurança, anti-fraude e operações

### 8.1 Aplicação
- Cliente **nunca** grava saldo; só RPCs.
- Ledger/contadores/streak no schema `private`, sem grant público (padrão já usado no repo).
- RPCs `SECURITY DEFINER` com `search_path=''` + wrappers INVOKER.
- `redeem_product` usa lock na linha do perfil (`update ... where credits >= custo`) para evitar corrida de duplo-clique.
- Rate limiting reaproveitando o padrão existente `check_api_rate_limit`/`api_rate_limits` nos RPCs de alto custo (`redeem_product`, `complete_*_mission`).

### 8.2 Anti-fraude (traduzindo a spec do PDF)
- **Leitura:** só credita com interação (troca de página, rolagem, capítulo). Sensor congela quando a página perde foco/blur; sessão sem atividade por >45s não credita.
- **Comentários repetitivos:** `reward_comment` ignora se o texto repete o último comentário recente do mesmo usuário.
- **Curtidas entre contas suspeitas:** `reward_likes_received` ignora likes de contas que dão curtida recíproca/em massa (heurística: contagem por par de usuários por janela).
- **Spam geral:** `private.spam_revert(user_id)` remove XP/créditos do período suspeito; acionado manualmente no Admin.
- **Observabilidade:** cada crédito tem entrada de ledger com `reason`, `source_ref`, `day_key` — auditoria completa; nada de números mágicos no cliente.

### 8.3 Onde implementar (mapa de arquivos)

| Área | Arquivo | O que fazer |
|---|---|---|
| Schema + RPCs | `supabase/migrations/<ts>_xp_credits_store.sql` | criar (novo) |
| Login reward | `src/app/data/AuthContext.jsx` | chamar `reward_login` pós-sessão |
| Sensor de leitura | `src/lib/readingSensor.js` (novo) + `src/app/pages/BookReaderPage.jsx` | heartbeats com interação |
| Post/comment rewards | `src/app/components/CreatePost.jsx`, `PostCard.jsx`, `EntityComments.jsx` | chamar `reward_post`/`reward_comment` |
| Curtidas recebidas | `PostCard.jsx` / feed | chamar `reward_likes_received` |
| Estado global | `src/app/data/DataContext.jsx` | carregar saldo + contadores do dia + streak |
| Painel "Recompensas" | `src/app/components/RightSidebar.jsx` (novo widget) | saldo, streak, missão diária |
| Loja | `src/app/pages/StorePage.jsx` (novo) | catálogo + resgate |
| Meus Resgates | `src/app/pages/MyRedemptionsPage.jsx` (novo) | status/rastreio |
| Admin | `src/app/pages/AdminPage.jsx` | abas "Resgates", "Loja", "Spam" |
| Rotas | `src/App.jsx` | `/loja`, `/resgates` |

---

## 9. Novos RPCs → lista final

| RPC | Visibilidade |
|---|---|
| `reward_login()` | authenticated |
| `report_reading_session(book_id, seconds, interacted)` | authenticated |
| `reward_post(user_id)` | authenticated (admin/self) |
| `reward_comment(user_id)` | authenticated (admin/self) |
| `reward_likes_received(owner_id)` | authenticated (self) |
| `complete_daily_mission()` | authenticated |
| `complete_weekly_mission()` | authenticated |
| `redeem_product(product_id, customer, address)` | authenticated |
| `referral_claim(referred_user_id)` | authenticated |
| `private.spam_revert(user_id, reason)` | service_role (admin) |

---

## 10. Decisões abertas e como fechar

1. **Preço real** (R$19/29 vs R$24/168) → resolver com o dono **antes** de lançar a Loja; criar fonte única (ex.: exportar `PLAN_CATALOG` do servidor para o front).
2. **Cakto x manual** → V1 manual, V2 Cakto. Custo por envio e teto mensal precisam de definição financeira (CFO) antes de abrir resgates a granel.
3. **Conquistas existentes** (stateless) → integrar à nova `wallet_ledger`? Recomenda-se manter stateless em V1 e, em V2, adicionar `achievement_events` com timestamp de desbloqueio (melhoria já apontada no `RELATORIO-ACHIEVEMENTS.md`).
4. **É obrigatório exibir/ocultar o tempo mínimo** → a spec diz ocultar; manter oculto.
5. **Nada de conversão XP→Créditos** (spec explícita); reforçado no banco por dois ledger separados.

---

## 11. Checklist de revisão (pontas soltas fechadas)

- [x] Saldo só via ledger + transação única; lock em `redeem_product`.
- [x] Limites diários idempotentes (PK `user_id,metric,day_key`).
- [x] RLS não confia no cliente; RPCs definer + wrappers invoker; schema `private` sem grant.
- [x] Tempo mínimo validado no banco e oculto da UI.
- [x] Anti-fraude: leitura com interação, comentários repetitivos, curtidas suspeitas, reversão por spam.
- [x] Frete grátis implícito (custo coberto), catálogo permanente sem sorteios.
- [x] Auditoria completa via ledger (XP e créditos separados, sem conversão).
- [x] Divergência de preço registrada como pré-requisito bloqueante.

---

## 12. Sequência de implementação recomendada

1. **Fase 0 (fundação):** resolver preço; criar migração (tabelas + RLS); criar RPCs de ledger/contadores/streak; seed do catálogo da Loja. Testes de idempotência e limite diário.
2. **Fase 1 (XP no fluxo):** sensor de leitura; `reward_login/post/comment`; widget "Recompensas"; anti-spam de comentários.
3. **Fase 2 (missões/streak):** missão diária/semanal + UI de objetivos.
4. **Fase 3 (Loja V1):** catálogo, resgate com endereço, "Meus Resgates", Admin fulfillment manual.
5. **Fase 4 (indicação + refinamento):** `referral_claim`; detector de curtidas suspeitas; `spam_revert`.
6. **Fase 5 (V2):** integração Cakto; definição financeira de frete/custos por categoria.
