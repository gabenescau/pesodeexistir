-- ============================================================================
-- Fixes from the Supabase Database Linter (Security category)
-- ----------------------------------------------------------------------------
-- 0010 security_definer_view            -> public_profiles: security_invoker
-- 0011 function_search_path_mutable     -> touch_updated_at: fixed search_path
-- 0025 public_bucket_allows_listing     -> drop broad SELECT on public buckets
-- 0028/0029 anon/authenticated can execute SECURITY DEFINER functions
-- 0008 rls_enabled_no_policy            -> api_rate_limits: service_role policy
--
-- Re-aplica grants/revokes explicitos porque o banco de producao divergiu do
-- 0001_full.sql (anon ainda executava funcoes definidas com SECURITY DEFINER).
-- Todos os statements sao idempotentes.
-- ============================================================================

-- ============================================================================
-- 1. VIEW public_profiles — sem SECURITY DEFINER
-- ----------------------------------------------------------------------------
-- Com security_invoker = true a view roda com as permissoes do usuario que
-- consulta, entao o RLS das tabelas de origem passa a valer. O WHERE original
-- (private_profile / auth.uid()) continua aplicando.
-- ============================================================================
ALTER VIEW public.public_profiles SET (security_invoker = true);

-- ============================================================================
-- 2. touch_updated_at — fixa search_path mutavel
-- ============================================================================
ALTER FUNCTION public.touch_updated_at() SET search_path = '';

-- ============================================================================
-- 3. Buckets publicos — remover SELECT amplo (permite listagem de arquivos)
-- ----------------------------------------------------------------------------
-- avatars e publico e o app le via URL publica direta (getPublicUrl) —
-- nao precisa da policy de SELECT. Escrita continua restrita
-- (avatars_insert/update/delete_own).
-- NOTA: o bucket `covers` mantem o SELECT amplo de proposito: o app gera
-- URLs assinadas de capas no cliente (createSignedUrlMap) e o linter nao o
-- sinaliza (bucket nao e publico no projeto).
-- ============================================================================
DROP POLICY IF EXISTS "avatars_select" ON storage.objects;

-- ============================================================================
-- 4. Funcoes SECURITY DEFINER — restringir EXECUTE
-- ============================================================================

-- 4.1 check_api_rate_limit: usada somente pelo service role (API serverless).
REVOKE ALL ON FUNCTION public.check_api_rate_limit(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_api_rate_limit(text, text, integer, integer) TO service_role;

-- 4.2 current_role: chamada dentro de policies de RLS TO authenticated
--     (weekly_releases_admin e suggestions_update_owner_admin usam
--     current_role() = 'editor'), entao authenticated PRECISA manter EXECUTE.
--     Anon nao usa em nenhuma policy — remove do PUBLIC/anon.
REVOKE ALL ON FUNCTION public.current_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_role() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_role() TO authenticated;

-- 4.3 handle_new_user: trigger em auth.users, executado pelo auth service.
--     Sem PUBLIC — o trigger continua funcionando com grant para o role que
--     dispara os eventos de auth.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

-- 4.4 is_admin: continua executavel por authenticated porque e usada dentro
--     de policies de RLS (ex.: *_admin). Remove do PUBLIC (ano). O aviso de
--     "authenticated" e intencional e necessario para o RLS funcionar.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 4.5 rls_auto_enable: helper que nao esta no 0001_full.sql (resto de setup).
--     Nada no app chama. Remove acesso PUBLIC/authenticated. Guarda com DO
--     para o script rodar tambem em bancos novos onde a funcao nao existe.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rls_auto_enable' AND pronamespace = 'public'::regnamespace) THEN
    REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;
  END IF;
END;
$$;

-- ============================================================================
-- 5. api_rate_limits — RLS habilitado sem policies
-- ----------------------------------------------------------------------------
-- Tabela interna do rate limit (inserida so pelo SECURITY DEFINER
-- check_api_rate_limit, que roda como owner/bypassrls). Policy explicita para
-- service_role documenta a intencao e fecha o aviso do linter. anon e
-- authenticated seguem sem nenhum acesso (revogados no 0001).
-- ============================================================================
DROP POLICY IF EXISTS "api_rate_limits_service_role" ON public.api_rate_limits;
CREATE POLICY "api_rate_limits_service_role" ON public.api_rate_limits
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
