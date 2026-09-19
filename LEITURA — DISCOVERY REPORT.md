# LEITURA - Discovery Report

## A. Resumo executivo

O produto e uma SPA React/Vite para clube de leitura, com Supabase Auth/Postgres/Storage/RLS no backend de dados, Vercel Functions para operacoes privilegiadas e Stripe v22 para cobranca. A base ja possui boas defesas: chaves secretas nao sao prefixadas para o bundle Vite, API server-side valida o token Supabase, catalogo de planos e precos vem do servidor, webhook Stripe exige assinatura de corpo bruto, existe ledger de idempotencia, CORS da API nao usa wildcard, limite de payload e rate limit de API foram implementados, e o renderizador de texto nao usa `dangerouslySetInnerHTML`.

O nivel de risco ainda e alto para uma abertura sem restricoes porque a autorizacao de recurso pago nao e coerente em todas as camadas. O bloqueio de social pago aparece em `SubscriptionGuard` e componentes React, mas as policies da migration inicial permitem insert de posts, respostas, likes, comentarios e enquetes para todo usuario autenticado. Isso e um bypass de regra de negocio quando a assinatura e requisito real. O banco remoto tambem nao pode ser considerado conforme enquanto nao houver evidencia de que todas as migrations foram aplicadas.

Outros riscos relevantes: token de sessao acessivel ao JavaScript em `sessionStorage`; login/cadastro sem rate limit verificavel no servidor do projeto; exclusao de conta quebrada e enganosa; concorrencia entre checkouts; webhook sem estado transacional de retry; carregamento global de tabelas sem limite funcional; dependencias transitivas vulneraveis no conjunto de desenvolvimento; historico Git com `.env`; ausencia de E2E, CI e observabilidade operacional comprovada.

Conclusao: adequado para beta controlado com contas e limites monitorados, mas nao recomendado para producao aberta antes da Fase 1 e Fase 2 do roadmap.

## B. Stack identificada

| Area | Evidencia |
| --- | --- |
| Frontend | React 19.2.7, Vite 8.1.1/8.1.5 instalada, React Router DOM 7.18.2, Tailwind CSS 4 |
| Runtime | Node.js para scripts e Vercel Functions em `api/` |
| Backend | Route handlers serverless em JavaScript; `server/` contem clientes e regras server-side |
| Banco | Supabase Postgres via PostgREST; sem ORM/query builder |
| Auth | Supabase Auth; token enviado como Bearer pelo browser para API |
| Storage | Supabase Storage: `avatars`, `covers`, `pdfs`, `post-media` |
| Pagamentos | Stripe: Checkout, subscriptions, portal, PIX one-time, webhook |
| PDF | `pdfjs-dist` com worker no bundle |
| UI | Base UI, componentes locais, Phosphor Icons, Motion, Tailwind |
| Testes | Node test runner; 4 arquivos; sem E2E de navegador detectado |
| Deploy | Vercel, `vercel.json`, variaveis server/client separadas por prefixo |
| Observabilidade | `console.info/error`, request id e audit log textual; nenhum provedor de error tracking confirmado |
| ORM/cache/fila | Nao identificado |

## C. Arquitetura atual e fluxo de dados

```text
Browser React/Vite
  |-- Supabase public key -> Auth/PostgREST/Storage/RLS
  |-- Bearer access token -> /api/*
  |                         |-- valida token no Supabase Auth
  |                         |-- valida role/ownership/rate limit
  |                         |-- usa SUPABASE_SECRET_KEY e Stripe secret
  |-- Stripe Checkout hospedado <- /api/stripe-checkout
Stripe webhook -> /api/stripe-webhook -> ledger -> Supabase subscriptions
```

O app usa `DataContext` como agregador global de livros, autores, posts, perfis, assinaturas, follows, favoritos, polls, colecoes e recompensas. A maioria das mutacoes de conteudo e feita diretamente pelo browser usando a chave publica e depende de RLS. Operacoes sensiveis de billing e admin usam Functions server-side, mas catalogo/admin tambem possui muitas chamadas diretas no componente `AdminPage`.

## D. Mapa de rotas e superfices

Rotas identificadas em `src/app/AppShell.jsx`: inicio/comunidade, biblioteca, autores, livro/:id, ler/:id, autor/:id, explorar, ranking, lancamentos, sugestoes, notificacoes, loja, loja/produto/:id, missoes, indicacoes, seasons, meus-resgates, suporte, minha-lista, post/:id, planos, perfil, perfil/:id, configuracoes e admin.

- `SubscriptionGuard` protege quase todas as rotas do app e bypassa admin.
- `AdminGuard` depende do role carregado no perfil e de `canManageContent`.
- `/app/planos` nao exige assinatura para permitir compra/gestao.
- `/app/suporte` nao esta sob assinatura.
- Perfil publico nao exige assinatura.
- Nao foi encontrado um `ProtectedRoute` separado; a protecao esta distribuida no shell e guards.

Foram encontradas 546 ocorrencias estaticas de controles/handlers em `src`. Isso e inventario, nao prova de funcionamento. Nao houve credenciais de teste nem navegador autenticado para executar todos os caminhos nesta Fase 0.

## E. Auditoria de seguranca

### SEC-01 - CRITICO - credencial historica em Git

- Categoria: secrets/supply chain
- Arquivo: historico Git; `.env` adicionado em `ffbfaf8d`, removido em `f6e844a0`
- Problema: um `.env` real existiu no historico. O checkout atual ignora `.env.local` e somente versiona `.env.example`, mas apagar o arquivo atual nao apaga blobs antigos.
- Impacto: tokens antigos podem continuar recuperaveis por qualquer pessoa com acesso ao repositorio; Supabase, Stripe, webhook e rate-limit secrets podem permitir acesso ou fraude se ainda ativos.
- Verificacao: `git log --all --name-status -- .env .env.local '.env.*'`; auditar o blob historico sem imprimir valores.
- Correcao: revogar/rotacionar toda credencial que ja esteve no blob; depois avaliar limpeza de historico com politica de backup e force-push controlado.
- Prioridade: P0, antes de producao aberta.

### AUTH-01 - ALTO - token de sessao legivel por JavaScript

- Categoria: auth/session
- Arquivos: `src/app/data/supabase.js:19-39`, `src/lib/authenticated-api.js:3-20`
- Problema: Supabase Auth persiste o access token em `sessionStorage`; qualquer XSS futuro ou dependencia comprometida no mesmo origin pode le-lo e envia-lo como Bearer.
- Impacto: roubo de sessao dentro da validade do token. A superficie e menor que `localStorage`, mas nao e equivalente a cookie HttpOnly.
- Evidencia positiva: nao foi encontrado XSS armazenado; `RichText` compoe texto React e nao usa `dangerouslySetInnerHTML`.
- Correcao: avaliar arquitetura SSR/BFF com cookie HttpOnly, Secure, SameSite e CSRF; ou manter SPA com CSP rigorosa, dependencias atualizadas e threat model aceito. Nao copiar token para cookie via JS, pois isso nao o torna HttpOnly.
- Prioridade: P1.

### AUTH-02 - ALTO - rate limit de login/cadastro nao verificavel

- Categoria: brute force/abuse
- Arquivo: `src/components/auth-page.jsx:51-64`
- Problema: lockout de 5 tentativas e apenas estado React; o atacante pode chamar Supabase Auth diretamente. A defesa real depende de Auth Rate Limits/CAPTCHA no painel, sem evidencia no repositorio.
- Impacto: brute force, abuso de signup e custo operacional.
- Verificacao: confirmar limites de Auth, CAPTCHA/Turnstile, confirmação de email e alertas no projeto Supabase.
- Correcao: habilitar limites server-side, CAPTCHA adaptativo e testes de abuso; nao confiar no lockout client-side.
- Prioridade: P1.

### AUTHZ-01 - ALTO - entitlement social apenas na interface

- Categoria: broken access control/business logic
- Arquivos: `src/app/components/SubscriptionGuard.jsx:101-129`, `src/app/components/CreatePost.jsx`, `src/app/components/PostCard.jsx`, `supabase/migrations/0001_full.sql:585-709`
- Problema: a UI calcula `canUsePaidSocialFeatures`, mas as policies `posts_insert_own`, `post_replies_insert_own`, `post_likes_insert_own`, `book_page_comments_write_own`, `post_polls_write_post_owner` e `post_poll_votes_own` exigem somente `authenticated`/ownership.
- Impacto: usuario sem plano pode chamar PostgREST diretamente e criar/interagir com conteudo pago; a regra de negocio e bypassavel sem alterar o frontend.
- Verificacao: com conta autenticada sem assinatura, executar insert minimo em cada tabela no SQL/API e observar se RLS permite.
- Correcao: definir entitlement numa funcao privada segura ou RPC server-authoritative, aplicar a condicao nas policies e testar anon/sem plano/Leitor/Pensador/admin/editor. Nao confiar em campo enviado pelo cliente.
- Prioridade: P0 se social pago for requisito comercial.

### AUTHZ-02 - ALTO - superficie de perfil publico historicamente ampla

- Categoria: data exposure/RLS drift
- Arquivo: `supabase/migrations/0001_full.sql:513-529`
- Problema: a migration inicial cria `profiles_select` com `USING (true)` para anon/authenticated e concede SELECT em `profiles`; a view `public_profiles` filtra campos, mas o estado final remoto nao foi confirmado e o grant/policy de tabela depende das migrations posteriores.
- Impacto: se o banco remoto estiver somente na migration inicial, campos de perfil que deveriam ser privados podem ser enumerados.
- Verificacao: no Supabase SQL Editor, consultar policies/grants reais e comparar com `20260731180000_fix_supabase_linter_view_and_function_grants.sql`.
- Correcao: negar leitura direta de `profiles` para anon, usar view invoker com lista explicita de campos e manter leitura do proprio perfil/admin por policy minima.
- Prioridade: P1.

### ACCOUNT-01 - ALTO - exclusao de conta nao exclui a conta

- Categoria: funcionalidade/privacidade
- Arquivo: `src/app/pages/settings/SettingsAccount.jsx:40-58`
- Problema: o browser chama `supabase.auth.admin.deleteUser(user.id)` com chave publica; a Admin API exige service role. O erro e engolido, a sessao e encerrada e a mensagem indica que o usuario deve contatar suporte.
- Impacto: o usuario acredita que solicitou exclusao, mas os dados permanecem. Isso conflita com a promessa da UI e com o fluxo de direitos LGPD descrito no cadastro.
- Correcao: endpoint server-only autenticado que valida o proprio usuario, agenda/executa exclusao com service key, cancela billing, registra auditoria e retorna estado claro; ou remover o botao ate o fluxo existir.
- Prioridade: P1.

### AUTH-03 - MEDIO - protecao de configuracao depende de UX

- Categoria: fail-closed/configuration
- Arquivos: `src/app/data/supabase.js:8-17`, `src/components/auth-page.jsx:70-74`
- Problema: sem credenciais publicas o app exibe aviso e o submit navega para modo local. O `AuthContext` nao injeta usuario falso, entao nao e acesso autenticado confirmado, mas o fluxo mascara uma configuracao de producao quebrada.
- Impacto: deploy sem env pode parecer funcional, gerar pedidos/favoritos locais e dificultar detectar incidente.
- Correcao: build/deploy check que falha em producao sem env; modo local explicitamente somente desenvolvimento e sem mutacoes de negocio.
- Prioridade: P1.

### UPLOAD-01 - MEDIO - upload confia em validacao client-side

- Categoria: upload/storage
- Arquivos: `src/app/components/CreatePost.jsx:35-53`, `src/lib/library-media.js:1-70`, migrations de Storage
- Problema: MIME/tamanho sao validados no browser e enviados diretamente ao Storage. Nao foi encontrada validacao de magic bytes, sanitizacao server-side ou pipeline para rejeitar arquivos com conteudo divergente do MIME declarado.
- Impacto: arquivos malformados, custos e risco para consumidores de imagem/PDF; Storage policy limita caminho e bucket, mas nao substitui validacao de conteudo.
- Correcao: validar tipo real em endpoint/Edge Function, impor limites no bucket, remover SVG, usar nomes gerados, scan opcional e URLs assinadas com curta validade.
- Prioridade: P1 para PDFs e post-media.

### PAY-01 - ALTO - concorrencia de checkout e reserva incompleta

- Categoria: pagamentos/idempotencia
- Arquivos: `api/stripe-checkout.js:43-127`, `server/stripe.js:144-187`, `supabase/migrations/20260810000000_stripe_billing.sql:28-42`
- Problema: duas requisicoes concorrentes podem passar pela verificacao de assinatura ativa antes de qualquer estado pendente local; a chave `checkoutIdempotencyKey` inclui um bucket de minuto, e muda quando o minuto muda. O codigo expira sessoes Stripe depois da leitura, mas nao existe lock/reserva atomica por usuario/plano/metodo.
- Impacto: multiplas sessoes, cobranca/PIX duplicado, corrida entre webhook e sessao de retorno e erros de unique constraint na ativacao.
- Verificacao: disparar duas requisicoes simultaneas para planos/metodos diferentes em Stripe Test Mode e acompanhar sessoes, webhook e rows.
- Correcao: criar uma reserva idempotente server-side com chave deterministica e unique constraint; transicionar pending/paid/expired; resolver concorrencia no banco e no webhook.
- Prioridade: P0 antes de billing aberto.

### PAY-02 - ALTO - retry do webhook nao tem transacao de negocio comprovada

- Categoria: webhook/idempotencia
- Arquivo: `api/stripe-webhook.js:75-94`
- Problema: em erro o evento e marcado `failed` e imediatamente apagado. Se uma operacao de negocio tiver sido parcialmente concluida antes da falha, o replay pode executar novamente sem uma transacao unica que cubra ledger e subscription.
- Impacto: estados duplicados ou inconsistentes em falhas parciais.
- Correcao: manter ledger failed com backoff/lease, processar em transacao/RPC idempotente, guardar resultado e tratar replay conscientemente; nao apagar evidencia.
- Prioridade: P1.

### PAY-03 - MEDIO - estado de pending update incompleto

- Categoria: Stripe lifecycle
- Arquivos: `api/stripe-webhook.js:103-112`, `api/stripe-change-plan.js:66-84`, `STRIPE-SETUP.md`
- Problema: existe tratamento para `customer.subscription.pending_update_applied`, mas nao para `customer.subscription.pending_update_expired`.
- Impacto: uma troca de plano que expira pode deixar metadados de solicitacao ou UI em estado intermediario.
- Correcao: tratar evento de expiracao, limpar requested plan e testar upgrade/downgrade, falha de cobranca e retry.
- Prioridade: P1.

### PAY-04 - MEDIO - estado local pode divergir apos cancelamento

- Categoria: billing consistency
- Arquivo: `api/cancel-subscription.js:53-90`
- Problema: primeiro chama Stripe e depois atualiza Supabase; falha de rede entre as duas etapas deixa o provider cancelado e banco ainda ativo ate webhook/reconciliacao.
- Impacto: janela de entitlement incorreto e mensagens confusas.
- Correcao: state machine com provider id, webhook obrigatório, job de reconciliacao e endpoint de consulta que exibe estado pending.
- Prioridade: P1.

### API-01 - MEDIO - superficie API sem limite uniforme comprovado

- Categoria: abuse/rate limit
- Arquivos: `api/*.js`, `server/supabase.js:200-284`
- Problema: billing tem `enforceRateLimit`, mas o rate limit real depende da RPC remota e nao foi confirmado no banco. Supabase Auth e PostgREST direto nao passam por essa camada. Funcoes administrativas no browser tambem dependem de RLS.
- Impacto: abuso de Auth/PostgREST e limites diferentes entre superficies.
- Correcao: confirmar RPC, aplicar limites de Auth/Supabase, proteger endpoints de alto custo e criar testes de 429/fail-closed.
- Prioridade: P1.

### API-02 - BAIXO - delete de sugestao pode retornar sucesso falso

- Categoria: API correctness
- Arquivo: `api/admin-suggestion.js`
- Problema: a operacao de delete nao comprova que uma linha foi encontrada/alterada.
- Impacto: admin recebe sucesso mesmo com id inexistente ou estado ja removido.
- Correcao: exigir `Prefer: return=representation` ou count e retornar 404 quando apropriado.
- Prioridade: P3.

### API-03 - BAIXO - health endpoint revela prefixo de commit

- Categoria: information disclosure
- Arquivo: `api/health.js`
- Problema: resposta publica inclui os primeiros 12 caracteres de `VERCEL_GIT_COMMIT_SHA`.
- Impacto: baixo; facilita correlacionar release e procurar codigo publico.
- Correcao: remover em producao ou exigir monitor tokenizado se nao for requisito operacional.
- Prioridade: P3.

### DB-01 - ALTO - migrations remotas nao confirmadas

- Categoria: database drift
- Arquivos: `supabase/migrations/*`, ausencia de `supabase/config.toml`
- Problema: o repositorio contem migrations posteriores que corrigem grants, RLS, roles, Storage e Stripe, mas nao ha prova no checkout de que foram aplicadas no projeto remoto. Os erros anteriores de 403 e RLS sao sinais de drift historico.
- Impacto: ambiente ativo pode operar com policy antiga, permitir dados indevidos ou bloquear fluxos legitimos.
- Correcao: vincular projeto Supabase em ambiente seguro, executar `supabase migration list`, comparar schema remoto e aplicar migrations com backup/rollback planejado. Nunca rodar SQL gerado sem revisar dependencias.
- Prioridade: P0.

### DB-02 - MEDIO - policies e grants de RLS devem ser testados por papel

- Categoria: RLS/authorization
- Arquivos: `supabase/migrations/0001_full.sql:519-709`, `20260731170001_version_rbac_editor_and_grants.sql`
- Problema: o schema mistura policies antigas e novas, funcoes publicas wrappers e helpers privados; a conformidade depende da ordem completa das migrations. A policy base de posts/social e ampla para authenticated.
- Impacto: acesso indevido ou regressao ao aplicar migration fora de ordem.
- Correcao: testes SQL com `set role`/JWT claims ou projeto efemero para anon, authenticated, user, editor e admin; adicionar verificacoes de grants e functions ao CI.
- Prioridade: P1.

### DB-03 - MEDIO - indices de algumas FKs/consultas sao incompletos

- Categoria: performance/Postgres
- Arquivo: `supabase/migrations/0001_full.sql:267-473`
- Problema: ha indices bons para posts/replies/likes, mas `saved_posts.post_id`, `post_polls.post_id` ja tem unique, `post_poll_votes.option_id` e algumas colunas de lookup devem ser conferidas contra queries reais. A migration nao demonstra uma revisao sistematica de FKs em tabelas adicionadas depois.
- Impacto: deletes/joins e contagens podem degradar com crescimento.
- Correcao: comparar `pg_stat_user_indexes`, `EXPLAIN`, FKs e filtros; adicionar somente indices medidos.
- Prioridade: P2.

### PERF-01 - ALTO - DataContext carrega o banco inteiro

- Categoria: performance/scalability
- Arquivos: `src/app/data/DataContext.jsx:128-261`, `src/lib/supabase-query.js:25-49`
- Problema: a inicializacao carrega livros, autores, posts, perfis, releases, follows, saves, categorias, favoritos, ratings, likes, polls, votos e colecoes. `runSupabaseQueryAll` pagina por offset ate terminar, com page size 1.000; varios selects usam `*`.
- Impacto: TTFB e memoria crescem com o numero de usuarios/livros/posts; mobile recebe dados que a tela nao usa e o cliente pode ser usado para exfiltrar uma tabela publica inteira.
- Correcao: endpoints/queries por tela, colunas explicitas, cursor pagination, limits, cache/revalidation e carregamento sob demanda. Medir antes/depois.
- Prioridade: P1.

### PERF-02 - MEDIO - bundle de PDF e icones pesa no mobile

- Categoria: frontend performance
- Arquivos: build Vite; `BookReaderPage.jsx`, imports de `src/lib/icons.jsx`
- Problema: PDF worker ~1.26 MB, leitor ~442 kB e icons ~326 kB minificados; entry e CSS tambem sao relevantes.
- Impacto: LCP/INP piores em conexoes moveis e custo de dados.
- Correcao: lazy load comprovado por rota, importar icones sob demanda, worker separado/CDN quando seguro e medir Lighthouse/mobile.
- Prioridade: P2.

### SUPPLY-01 - ALTO - dependencias transitivas vulneraveis no conjunto completo

- Categoria: supply chain
- Arquivo: `package-lock.json`; arvore de `shadcn@4.16.0`
- Problema: `npm audit --json` encontrou: `brace-expansion` high, `fast-uri` high, `hono` moderate, `ip-address` high, `js-yaml` high, `nanoid` high, `postcss` moderate e `undici` high. Todas sao transitivas de `shadcn`/ferramentas de build; o audit de producao isolado reportou zero.
- Impacto: risco principalmente no ambiente de desenvolvimento/CI; pode virar risco de supply chain se ferramentas processarem entrada nao confiavel.
- Correcao: atualizar `shadcn` e lockfile com changelog/testes, remover CLI de runtime se nao necessaria, fixar CI com audit e revisar overrides. Nao usar `npm audit fix --force` sem teste.
- Prioridade: P1 para CI, P2 para runtime.

### CODE-01 - MEDIO - arquivos gigantes e warnings acumulados

- Categoria: maintainability
- Arquivos: `AdminPage.jsx` 3.079 linhas, `DataContext.jsx` 1.287, `sidebar.jsx` 668; 16 warnings no lint
- Problema: responsabilidades de UI, CRUD, billing, recompensas e admin estao concentradas. Ha imports/estados nao usados, chave duplicada `Trophy` em `src/lib/icons.jsx:81` e duas ocorrencias de `new Array`.
- Impacto: regressao dificil de isolar e mudancas com grande blast radius.
- Correcao: remover apenas itens confirmados, quebrar por bounded context depois de testes, manter um unico integration owner para manifests.
- Prioridade: P2.

### TEST-01 - ALTO - ausencia de testes de contrato e navegador

- Categoria: quality/release
- Arquivos: `tests/*`
- Problema: apenas 4 arquivos/12 testes; nao ha E2E para login, cadastro, RLS, cada papel, checkout, webhook, cancelamento, upgrade/downgrade, Storage ou mobile.
- Impacto: erros como 403, checkout preso, modal quebrado e falhas de webhook chegam a producao sem gate.
- Correcao: Vitest/Node para regras, Postgres/Supabase efemero para RLS, Stripe fixtures/test clocks e Playwright para rotas e fluxos criticos.
- Prioridade: P1.

### OPS-01 - ALTO - release e operacao sem evidencia suficiente

- Categoria: DevOps/observability
- Arquivos: `.github/workflows` sem arquivos detectados, `vercel.json`, `api/health.js`
- Problema: nao foi confirmada CI, alerta de erro, SLO, backup/restaure testado, job de reconciliacao Stripe ou monitoramento de falha de webhook. Logs existem, mas apenas no console da Function.
- Impacto: regressao, perda de eventos, indisponibilidade e incidentes sem deteccao.
- Correcao: CI lint/test/build/audit, Sentry/Logtail com redaction, alertas Stripe/Supabase/Vercel, health real, backup PITR e restore drill.
- Prioridade: P1.

### CONFIG-01 - MEDIO - headers duplicados e CSP divergente

- Categoria: infrastructure/browser security
- Arquivos: `vercel.json`, `public/_headers`, `vite.config.js`
- Problema: `vercel.json` define CSP e HSTS, enquanto `public/_headers` define outra CSP com `script-src 'unsafe-inline'`, fontes externas e CORS comentado. Nao esta confirmado se `_headers` e aplicado pela Vercel; as duas fontes criam drift.
- Impacto: a politica efetiva pode ser mais fraca ou diferente do esperado; `style-src unsafe-inline` continua presente na politica Vercel.
- Correcao: escolher uma fonte de headers compatível com o deploy, testar headers no dominio real e endurecer CSP gradualmente com report-only.
- Prioridade: P1.

### PRIV-01 - MEDIO - LGPD sem ciclo completo demonstrado

- Categoria: privacy/data lifecycle
- Arquivos: `src/components/auth-page.jsx:92-103`, `src/app/pages/settings/SettingsAccount.jsx`, migrations de profiles/user_emails
- Problema: cadastro registra consentimento em metadata, mas nao foi encontrada tabela versionada de consentimento, exportacao de dados, exclusao efetiva, retencao, revogacao de marketing ou fluxo de titular.
- Impacto: dificuldade de provar consentimento e cumprir solicitacoes; requer revisao juridica, nao e conclusao legal automatica.
- Correcao: definir inventario/dados, base legal, retention, export/delete server-only, trilha de consentimento versionada e processo de atendimento.
- Prioridade: P1.

### DOC-01 - BAIXO/MEDIO - drift de documentacao e provider

- Categoria: maintainability/operations
- Arquivos: `RELATORIO-AUDITORIA.md`, `PLANO-IMPLEMENTACAO-XP-LOJA-OPE.md`, `supabase/migrations/0001_full.sql`, `STRIPE-SETUP.md`
- Problema: runtime atual e Stripe, mas varios docs e comentarios ainda descrevem AbacatePay/Cakto. Isso dificulta operar migrations e responder incidentes.
- Impacto: configuracao errada, migration desnecessaria e diagnostico equivocado.
- Correcao: marcar legado, atualizar runbooks e definir fonte oficial de arquitetura.
- Prioridade: P2.

## F. Bugs e comportamentos a confirmar

1. Exclusao de conta aparenta sempre terminar apenas em logout.
2. `SubscribePage` confirma checkout por polling/endpoint de sessao; webhook e retorno podem concorrer e precisam de teste de idempotencia.
3. `customer.subscription.pending_update_expired` nao e tratado.
4. `CheckoutModal` tem fallback local de pedidos quando Supabase esta indisponivel; isso pode criar estado de loja que nao existe no backend.
5. Varios `catch(() => {})` escondem falhas de rewards, cleanup, referral e refresh; isso reduz observabilidade e pode deixar UI inconsistente.
6. Comentarios e respostas carregam `select(*)` sem pagina por post.
7. A UI usa campos de perfil para selo/verificacao; a regra deve vir de funcao/view protegida e nunca de um campo que o cliente possa forjar.
8. O modo sem env precisa ser bloqueado em producao para evitar falso positivo operacional.

## G. O que esta correto ou positivo

- `vite.config.js` limita `envPrefix` a `VITE_`/`NEXT_PUBLIC_`; secrets server-only nao entram no bundle por prefixo.
- `server/supabase.js` faz CORS por allowlist e rejeita origem desconhecida.
- API rejeita payload acima de 32 KB e gera request id.
- Logs redigem Bearer, JWT, email e CPF em mensagens de erro.
- `stripe-webhook.js` usa corpo bruto e `constructEvent`, limita payload a 1 MB e possui ledger.
- Precos/Price IDs sao validados no servidor contra catalogo.
- RLS esta habilitado no schema versionado e helpers privados usam `search_path=''` em migrations recentes.
- `RichText` nao injeta HTML.
- Build, lint e testes existentes passam, embora lint tenha warnings.

## H. Limites da auditoria

- NAO FOI POSSIVEL CONFIRMAR PELO CODIGO o estado real do projeto Supabase remoto, policies efetivas, grants, buckets, Auth Rate Limits, CAPTCHA, leaked-password protection, PITR/backup ou dados reais. Isso exige acesso ao dashboard/CLI do projeto.
- NAO FOI POSSIVEL testar todos os botoes e inputs em navegador autenticado nesta fase; o inventario estatico encontrou 546 ocorrencias, mas nao substitui E2E.
- O scanner Ruflo completo expirou em 120 segundos; o resultado nao deve ser interpretado como clean.
- As vulnerabilidades do `npm audit` incluem dependencias de desenvolvimento/transitivas; a explorabilidade no app publicado precisa ser confirmada por caminho de uso.

## I. Top 10 problemas/oportunidades com impacto estimado

Os impactos abaixo sao hipoteses de planejamento, nao metricas observadas.

| Ordem | Item | Resultado esperado | Estimativa de impacto |
| --- | --- | --- | --- |
| 1 | Corrigir secrets historicos | Reduzir risco de takeover/fraude | Evita incidente potencial de impacto total; nao ha percentual honesto sem inventario dos blobs |
| 2 | Enforcement social server/DB | Impedir uso sem plano | Remove bypass direto de PostgREST; impacto comercial depende da conversao e dos beneficios pagos |
| 3 | Reserva/idempotencia de checkout | Evitar duplicidade e estados presos | Reduz falhas de cobranca proporcionalmente ao volume de retries/concorrrencia; medir com teste de carga |
| 4 | Reconciliaçao Stripe/webhook | Recuperar eventos perdidos | Diminui tempo de divergencia provider/banco; medir por idade de eventos |
| 5 | RLS remoto versionado/testado | Fechar drift de autorizacao | Reduz superficie de dados e 403 regressivos; validar em projeto efemero |
| 6 | Paginaçao por tela | Melhorar mobile | Pode reduzir payload inicial em ordens de grandeza quando tabelas crescerem; medir bytes/TTFB |
| 7 | Testes E2E de billing/auth | Bloquear regressao antes do deploy | Aumenta cobertura dos caminhos de maior risco; alvo inicial 10-15 fluxos criticos |
| 8 | Corrigir exclusao de conta/LGPD | Dar resultado verdadeiro ao titular | Remove promessa falsa; medir tempo de atendimento e sucesso de delete |
| 9 | Atualizar toolchain transitiva | Reduzir supply-chain risk | Zera os 8 avisos atuais se as correcoes forem compativeis; validar lockfile |
| 10 | CI/observabilidade/backup restore | Reduzir MTTR e incerteza | Permite detectar falhas de build/webhook; definir SLO apos instrumentacao |

## J. Score baseline

| Dimensao | Nota | Justificativa |
| --- | ---: | --- |
| Seguranca | 5/10 | Boas defesas server-side, mas secrets historicos e entitlement social bypassavel |
| Arquitetura | 6/10 | SPA + Functions funciona, mas contextos estao concentrados |
| Codigo | 5/10 | Build passa; arquivos gigantes, drift e 16 warnings |
| Backend | 6/10 | Auth/rate/CORS/webhook existem; faltam transacoes e reconciliacao completa |
| Frontend | 6/10 | Rotas lazy e sanitizacao visual; muito estado global e fallback local |
| Banco | 5/10 | RLS/migrations existem, mas estado remoto e ordem efetiva nao confirmados |
| Performance | 4/10 | Bundle e DataContext pesados para mobile |
| Testes | 2/10 | 12 testes, sem E2E/RLS/payment contract |
| Observabilidade | 3/10 | request id/audit console, sem alerta/error tracking comprovado |
| Escalabilidade | 4/10 | Supabase pode servir beta, mas full-table load vira gargalo |
| Manutenibilidade | 4/10 | Admin/DataContext excessivamente grandes e provider legado em docs |
| Infraestrutura | 5/10 | Vercel headers e env documentados; sem CI/restore drill comprovado |
| Privacidade | 5/10 | texto e consentimento inicial existem; ciclo de vida incompleto |
| Geral | 5/10 | base promissora para beta fechado; gate de seguranca/operacao ainda aberto |
