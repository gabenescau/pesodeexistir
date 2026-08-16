# LEITURA - Optimization State

## Auditoria

- Programa: Master Autonomous Optimization Program
- Fase atual: 0 - discovery e auditoria read-only
- Data: 2026-08-10
- Commit auditado: 85727c3f36f2db0b7d5ac4585899a0ae891f6954
- Escopo: login, cadastro, rotas, biblioteca, leitor, comunidade, perfil, planos, Stripe, loja, missoes, indicacoes, temporadas, sugestoes, suporte, admin, banco, RLS, Storage, infraestrutura, Git e qualidade.
- Regra de seguranca: nenhum arquivo de producao ou migration foi alterado nesta fase.

## Evidencia coletada

- `npm.cmd test`: 12 testes passaram.
- `npm.cmd run lint`: passou com 16 warnings.
- `npm.cmd run build`: passou; 5.378 modulos transformados.
- Bundle: PDF worker 1.262 kB, BookReader 442 kB, icons 326 kB, CSS 160 kB, entry JS 277 kB (valores minificados aproximados reportados pelo Vite).
- `npm.cmd audit --omit=dev --json`: 0 vulnerabilidades no conjunto de producao.
- `npm.cmd audit --json`: 8 vulnerabilidades transitivas no conjunto completo: 6 high e 2 moderate.
- Scanner Ruflo `security scan --depth full`: excedeu 120 segundos; nao e considerado como aprovado.
- Ruflo `system_health`: runtime local reportou score 33/unhealthy por memory/config ausentes; MCP iniciou, mas o estado do Ruflo nao deve ser confundido com a saude do SaaS.
- Historico Git: `.env` foi adicionado em `ffbfaf8d` e removido em `f6e844a0`. Credenciais que tenham existido nesse arquivo devem ser rotacionadas/revogadas.
- `supabase/config.toml`: nao encontrado no checkout; aplicacao das migrations no banco remoto nao foi confirmada.

## Estado

### Concluido

- Inventario da stack e arquitetura.
- Mapa de rotas e superfices de API.
- Revisao de Auth, RBAC, RLS, Storage, pagamentos, uploads e cache.
- Revisao estatica de entradas, renderizacao HTML, chamadas diretas ao Supabase e variaveis de ambiente.
- Revisao de dependencias, scripts, testes, build e historico Git.
- Relatorio de descoberta e roadmap priorizado criados nesta fase.

### Pendente

- Confirmar schema/RLS/Storage reais no projeto Supabase remoto.
- Executar testes com contas reais: anonimo, usuario sem plano, Leitor, Pensador, admin, editor e conta com assinatura PIX.
- Reproduzir checkout, webhook, cancelamento, upgrade/downgrade e renovacao com Stripe Test Mode.
- Testar mobile e desktop em navegador real, inclusive cada rota, modal, input e fluxo de erro.
- Autorizar Fase 1 antes de alterar codigo, migrations ou dependencias.

## Principais riscos abertos

- `AUTHZ-01`: paywall social esta somente na UI; as policies base permitem escrita social para qualquer `authenticated`.
- `AUTH-01`: token Supabase e acessivel a JavaScript em `sessionStorage`.
- `AUTH-02`: rate limit de login/cadastro depende do painel Supabase e nao foi confirmado; lockout do frontend e bypassavel.
- `ACCOUNT-01`: exclusao de conta usa Admin API no browser e engole o erro.
- `PAY-01`: checkout nao reserva estado pendente de forma atomica e a chave de idempotencia muda a cada minuto.
- `PAY-02`: falha do webhook marca e apaga o registro de idempotencia, permitindo reprocessamento apos efeitos parciais.
- `DB-01`: o estado remoto das migrations, grants e policies nao foi confirmado.
- `PERF-01`: DataContext carrega colecoes inteiras e usa `select(*)` em varias tabelas.
- `SUPPLY-01`: audit completo encontrou vulnerabilidades transitivas em dependencias de desenvolvimento.
- `OPS-01`: nao ha evidencia de CI, observabilidade, backup testado ou restore documentado.

## Decisoes desta fase

- Nao corrigir automaticamente. O programa mestre exige gate humano depois de discovery.
- Nao remover arquivos, dependencias ou migrations por busca simples.
- Nao criar migration corretiva antes de confirmar o schema remoto.
- Tratar `public/_headers` como configuracao potencialmente divergente ate confirmar se o deploy usa esse formato.
- Tratar documentos AbacatePay/Cakto como legado e drift, pois o runtime atual usa Stripe.

## Metricas baseline

- Paginas em `src/app/pages`: 30 arquivos.
- Controles interativos encontrados estaticamente em `src`: 546 ocorrencias de botoes, inputs, forms e handlers.
- `AdminPage.jsx`: 3.079 linhas.
- `DataContext.jsx`: 1.287 linhas.
- `PostCard.jsx`: 404 linhas.
- Testes proprios: 4 arquivos, 12 assertions executadas pelo runner atual.
- CI versionado: nenhum workflow detectado em `.github/workflows`.

## Arquivos alterados nesta auditoria

- `LEITURA — OPTIMIZATION STATE.md`
- `LEITURA — DISCOVERY REPORT.md`
- `LEITURA — PRIORITIZED ROADMAP.md`

Nenhum arquivo de aplicacao foi alterado. As alteracoes pre-existentes em `.gitignore` e `AGENTS.md` foram preservadas.

## Proximo passo

Apresentar os tres artefatos ao responsavel. Apos autorizacao explicita, iniciar Fase 1 com correcao de credenciais historicas, exclusao de conta por endpoint server-only, enforcement server/database do entitlement social e validacao das migrations remotas.
