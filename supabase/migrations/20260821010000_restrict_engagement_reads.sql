-- Leitura direta das tabelas de engajamento restrita ao proprio usuario.
--
-- Contexto: qualquer conta autenticada conseguia SELECT em TODAS as linhas
-- de post_likes, post_poll_votes, follows e reactions — incluindo user_id
-- alheio (quem curtiu/votou/segiu o que). Como o cadastro e aberto, isso
-- permitia raspagem e desanonimizacao do engajamento.
--
-- Por que e seguro para o app: 100% das leituras do frontend passam pelo
-- backend (/api/* -> server/* com service_role, que bypassa RLS). Nao ha
-- nenhum `.from()` direto em src/ (verificado por grep). O servidor
-- continua mascarando user_id alheio no feed (server/community.js).
--
-- Regra nova: cada usuario autenticado le apenas as proprias linhas.
-- Anonimos nao tem SELECT (sem policy = negado; antes ja nao tinham desde
-- a migration 20260810100000_phase1).
-- Inserts/deletes com has_social_access() NAO sao tocados aqui.
--
-- Aplicar com: supabase db push  (ou rode este arquivo no SQL editor).

DROP POLICY IF EXISTS "post_likes_read_authenticated" ON public.post_likes;
CREATE POLICY "post_likes_read_own" ON public.post_likes
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "post_poll_votes_read_authenticated" ON public.post_poll_votes;
CREATE POLICY "post_poll_votes_read_own" ON public.post_poll_votes
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "follows_read_authenticated" ON public.follows;
CREATE POLICY "follows_read_own_or_involved" ON public.follows
  FOR SELECT TO authenticated
  USING (
    follower_id = (select auth.uid())
    OR following_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "reactions_read_authenticated" ON public.reactions;
CREATE POLICY "reactions_read_own" ON public.reactions
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Verificacao pos-deploy: como anonimo, estas queries devem retornar 0 linhas
-- ou erro de permissao; como usuario logado, apenas as proprias linhas:
--   SELECT count(*) FROM public.post_likes;
--   SELECT count(*) FROM public.follows;
-- ---------------------------------------------------------------------------
