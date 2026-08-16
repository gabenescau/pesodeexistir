# LEITURA - Prioritized Roadmap

Este roadmap segue a regra da auditoria: primeiro evidenciar e testar, depois alterar o menor numero de arquivos possivel. Nenhuma fase abaixo esta autorizada automaticamente por este documento.

## Gate atual

Fase 0 concluida no commit `85727c3f36f2db0b7d5ac4585899a0ae891f6954`.

Antes da Fase 1, obter:

- autorizacao explicita para alterar codigo e migrations;
- acesso/confirmacao do projeto Supabase remoto e ambiente Stripe Test Mode;
- contas de teste: anonimo, sem plano, Leitor, Pensador, admin, editor e PIX pago;
- backup/PITR confirmado antes de SQL;
- janela para rotacionar credenciais historicas e invalidar sessoes.

## FASE 1 - Emergencial (P0)

### 1.1 Revogar e rotacionar credenciais historicas

- Inventariar o `.env` antigo sem expor valores.
- Rotacionar Supabase secret/service key, Stripe secret, Stripe webhook secret e rate-limit secret.
- Revogar chaves antigas e invalidar sessoes se necessario.
- Decidir limpeza de historico Git com backup e force-push controlado.
- Validar que nenhum secret aparece no bundle, logs, docs ou artifacts.

### 1.2 Confirmar banco remoto antes de qualquer SQL

- Rodar `supabase migration list` com projeto correto.
- Comparar policies, grants, funcoes, views e buckets reais.
- Fazer backup/PITR e registrar snapshot.
- Aplicar somente migrations revisadas, em ordem, sem colar um monolito no SQL Editor.

### 1.3 Fechar bypass de entitlement social

- Especificar quais recursos exigem Leitor/Pensador e quais sao abertos.
- Criar helper privado com `search_path=''` e policy/RPC server-authoritative.
- Bloquear insert/update/delete direto sem entitlement.
- Testar anon, sem plano, plano ativo, expirado, admin e editor.

### 1.4 Corrigir exclusao de conta

- Criar endpoint server-only autenticado para a propria conta.
- Cancelar assinatura Stripe e registrar estado.
- Apagar/anonymizar dados conforme politica aprovada.
- Usar service key somente no server e retornar estado real.
- Testar reautenticacao, conta com posts, uploads, assinatura e pedidos.

### Saida da Fase 1

- Nenhuma credencial antiga valida.
- RLS remoto reproduzido por testes de papel.
- Sem bypass de recurso pago.
- Exclusao nao promete sucesso falso.
- Evidencia anexada em CI/log de auditoria.

## FASE 2 - Seguranca e autorizacao (P1)

1. Habilitar e confirmar Auth Rate Limits, CAPTCHA/Turnstile, confirmacao de email e leaked-password protection no Supabase.
2. Definir politica de sessao: manter SPA/sessionStorage com risco aceito ou migrar para BFF/SSR com cookies HttpOnly, Secure e SameSite; incluir CSRF.
3. Revisar `profiles_select`, `public_profiles`, grants e views; remover leitura direta de campos sensiveis.
4. Revisar todas as RPCs SECURITY DEFINER: schema privado, `search_path=''`, EXECUTE somente para roles necessarios.
5. Endurecer upload por tipo real, tamanho, path, Storage policies e URLs assinadas.
6. Uniformizar rate limits de APIs, Auth, PostgREST e endpoints admin; manter fail-closed sem escape de producao.
7. Escolher uma fonte de headers. Testar CSP efetiva no dominio, remover drift de `public/_headers` e reduzir `unsafe-inline` quando a UI permitir.
8. Remover do health publico o commit SHA ou justificar com threat model.

## FASE 3 - Bugs e billing (P1)

1. Criar reserva/ledger de checkout deterministico por usuario e plano/metodo.
2. Tornar webhook transacional/idempotente; manter failed events para retry controlado.
3. Tratar `customer.subscription.pending_update_expired` e todos os eventos habilitados no Dashboard.
4. Implementar reconciliacao Stripe periodica ou acionada por admin, com diferenca provider/banco.
5. Testar retorno do Checkout sem webhook, webhook antes do retorno, replay, timeout, 409, PIX pending/paid/expired e cancelamento.
6. Remover fallbacks de negocio em localStorage quando o deploy e producao; manter mock somente em build dev explicito.
7. Corrigir erros silenciosos em rewards, referral, cleanup e refresh; mostrar estado recuperavel ao usuario.

## FASE 4 - Arquitetura e limites (P1/P2)

1. Separar dominios: auth/profile, catalog/library, community, rewards/store, billing e admin.
2. Reduzir `DataContext` para providers menores ou queries por tela.
3. Concentrar mutacoes privilegiadas em `api/`/server; manter direct Supabase apenas para operações com policy minima e beneficio claro.
4. Criar schemas de entrada compartilhados entre browser e Functions, sem confiar no tipo client.
5. Definir contratos de resposta, erros e request id para todos os endpoints.
6. Registrar decision records para limites de plano e status de assinatura.

## FASE 5 - Limpeza e dependencias (P2)

1. Corrigir os 16 warnings de lint.
2. Remover apenas imports/estados/exports confirmados como mortos.
3. Atualizar `shadcn`/transitivas para corrigir `brace-expansion`, `fast-uri`, `hono`, `ip-address`, `js-yaml`, `nanoid`, `postcss` e `undici`; revisar lockfile e build.
4. Marcar ou reescrever docs AbacatePay/Cakto obsoletos, preservando historico quando necessario.
5. Remover arquivos temporarios/logs locais do fluxo de deploy sem apagar alteracoes do usuario.
6. Dividir arquivos gigantes somente depois de testes de caracterizacao.

## FASE 6 - Performance e escalabilidade (P2)

1. Medir payload, TTFB, LCP, INP, CLS e numero de requests em 375/390/430/768/1280/1440/1920 px.
2. Trocar full-table loads por queries de tela com colunas explicitas, limit/cursor e filtros server-side.
3. Paginar feed, comentarios, catalogo, autores, sugestoes, notificacoes, loja e admin.
4. Remover N+1 e joins desnecessarios; usar indices confirmados por `EXPLAIN`/estatisticas.
5. Lazy-load PDF worker, admin, loja e icon sets; repetir build e comparar bytes.
6. Definir cache/revalidation sem cachear dados privados ou billing.
7. Fazer teste de carga controlado em endpoints e queries antes de estimar capacidade para 1k/10k/100k usuarios.

## FASE 7 - Qualidade, operacao e produto (P1/P2/P3)

### Testes

- Unit: planos, entitlements, sanitize, RBAC, idempotency, status mapping.
- Integration: RLS por papel, Storage, Auth, RPCs e migrations.
- Billing: Stripe fixtures, Test Clocks, webhook signature/replay, cancelamento, upgrade/downgrade e PIX.
- E2E: cadastro/login/logout, senha/email, perfil/avatar, biblioteca/leitor, post/comentario/like/poll, sugestoes, loja, planos, admin.
- Acessibilidade: teclado, foco, labels, dialog close, contraste e leitor de tela.
- Mobile: sem scroll horizontal, toque, upload e modais em 375/390/430 px.

### Observabilidade/infra

- CI bloqueando lint/test/build/audit e migrations nao revisadas.
- Error tracking e logs estruturados com redaction.
- Alertas para webhook failed, fila/reconciliacao, 5xx, 429, RLS denied e checkout abandonado.
- Health check sem segredo, SLO/SLI e runbook de incidente.
- Backup automatico, PITR e restore drill documentado.

### Privacidade/produto

- Inventario de dados e terceiros, retention e descarte.
- Consentimento versionado e marketing revogavel.
- Exportacao/exclusao da conta funcional.
- SEO/metadata/robots/sitemap e acessibilidade revisados por rota.
- Instrumentar funil: landing -> cadastro -> primeiro livro -> primeiro post -> checkout -> ativacao -> retencao; separar fatos de hipoteses.

## Ordem de execucao recomendada

1. Rotacionar secrets e confirmar banco remoto.
2. Corrigir entitlement e exclusao de conta.
3. Endurecer Auth/RLS/Storage/rate limits.
4. Corrigir ledger/concorrencia/reconciliacao Stripe.
5. Criar testes de contrato e E2E dos caminhos acima.
6. Adicionar CI/observabilidade/backup restore.
7. Corrigir dependencias e warnings.
8. Medir e otimizar full-table loads/bundle.
9. Atualizar docs e fazer release gate.

## Criterio de release

Nao publicar em escala aberta enquanto qualquer item P0 estiver aberto, enquanto RLS remoto nao tiver snapshot/teste, enquanto checkout/webhook nao tiver teste de replay/concorrencia, ou enquanto uma credencial historica continuar valida. A publicacao deve ser autorizada por um gate separado depois das evidencias, nao pelo agente que implementa.
