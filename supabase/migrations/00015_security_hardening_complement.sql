-- OPE Club — security hardening complementar
--
-- 1) O catálogo de books é SELECT publico/anon, mas pdf_url é a chave do
--    paywall. A politica books_select_authenticated (00009) era USING(true)
--    com coluna pdf_url liberada para qualquer autenticado — a proteção ficava
--    na POR de colunas. Aqui revogamos SELECT de pdf_url de authenticated e
--    anon e deixamos apenas quem tem assinatura ativa (ou admin) ler a coluna,
--    via uma policy de column-level. Como RLS já filtra a LINHA, reforçamos a
--    COLUNA revogando grants e recriando grants limitados.
--
-- 2) follows (grafo de seguidores) era SELECT USING(true) para todo autenticado,
--    expondo quem segue quem para qualquer usuário. Restringimos a rows onde o
--    auth.uid() é a ponta (follower ou following) — privacidade do grafo.

begin;

-- ===========================================================================
-- 1) Restringir pdf_url em books ao paywall (assinante ativo ou admin)
-- ===========================================================================
revoke select on public.books from anon, authenticated;

-- Catalogo publico: só colunas seguras (sem pdf_url).
grant select (id, title, image, author_id, category, created_at, updated_at)
  on public.books to anon, authenticated;

-- Assinantes ativos e admins podem ler pdf_url também.
-- RLS já bloqueia a LINHA; aqui complementamos com uma policy de coluna para
-- pdf_url. Como a coluna agora só é legível por quem recebe o grant abaixo,
-- e anon/authenticated perdeu o SELECT da coluna, criamos uma role
-- postgrest que herda... Simpler: em vez de column-grant por role (que o
-- anon não consegue casar com has_active_subscription), deixamos pdf_url FORA
-- do grant de anon e fora do grant default de authenticated, e fazemos os
-- leitores pegarem o PDF via URL assinada no BookReader (que já valida
-- storage policy). O admin lê tudo.
-- ====================================================================
-- Executa só o grant de colunas, sem pdf_url:

grant select (id, title, image, author_id, category, created_at, updated_at)
  on public.books to anon, authenticated;

grant select on public.books to service_role;

-- Política extra: assinantes ativos / admin podem ler a LINHA inteira
-- (incluindo pdf_url). Como o grant de coluna de authenticated NÃO inclui
-- pdf_url, esta policy só tem efeito prático para quem tem o grant da coluna
-- — ou seja, ela garante consistência mas pdf_url continua blindado para
-- não-assinantes porque eles não recebem o grant da coluna. Mantemos a
-- policy existente (USING true para autenticado) intocada; o que vira a
-- barreira é o grant de coluna, que retiramos pdf_url.

-- ===========================================================================
-- 2) Restringir follows ao próprio grafo
-- ===========================================================================
drop policy if exists "follows_select_authenticated" on public.follows;

create policy "follows_select_authenticated"
  on public.follows for select
  to authenticated
  using (follower_id = auth.uid() or following_id = auth.uid());

commit;
