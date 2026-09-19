-- ============================================================================
-- Limpa os avisos restantes do Supabase Database Linter:
--   0028_anon_security_definer_function_executable
--   0029_authenticated_security_definer_function_executable
--
-- Motivo dos avisos: no 0001_full.sql apenas se fez
--   REVOKE ALL ... FROM PUBLIC;
-- mas os default privileges do Supabase concedem EXECUTE direto a
-- anon/authenticated para funcoes novas, entao os grants sobreviveram.
--
-- Remediacao (por funcao, idempotente):
--   check_api_rate_limit -> Option 1 (revogar de anon/authenticated; so
--     service_role continua, pois o servidor server/supabase.js a chama).
--   handle_new_user      -> Option 1 (so supabase_auth_admin; trigger do auth).
--   is_admin             -> Option 2 (SECURITY INVOKER): continua funcionando
--     nas policies pois delega a current_role(), que e SECURITY DEFINER.
--   current_role         -> precisa continuar SECURITY DEFINER (evita recursao
--     ao ler public.profiles dentro das policies de profiles) e precisa de
--     EXECUTE para authenticated (usada em policies, ex. linha 716/771/774 do
--     0001_full.sql). Revogamos apenas de anon/PUBLIC. O aviso 0029 que
--     sobrar para current_role e INTENCIONAL -> suprimir no dashboard.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. check_api_rate_limit(text, text, integer, integer)
--    Chamada apenas pelo server (Vercel) com service key.
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.check_api_rate_limit(text, text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_api_rate_limit(text, text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_api_rate_limit(text, text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_api_rate_limit(text, text, integer, integer) TO service_role;

-- ----------------------------------------------------------------------------
-- 2. handle_new_user()
--    Trigger AFTER INSERT em auth.users. Executada como owner (SECURITY
--    DEFINER), mas o grant fica apenas em supabase_auth_admin, que e o
--    role que dispara o trigger de auth.
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
  END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 3. is_admin()
--    Vira SECURITY INVOKER: a escalacao de privilegio (ler public.profiles) e
--    feita pela current_role() (SECURITY DEFINER), que ela chama internamente.
--    O linter ignora funcoes SECURITY INVOKER, entao os avisos 0028/0029
--    somem sem perder a funcionalidade nas policies.
-- ----------------------------------------------------------------------------
ALTER FUNCTION public.is_admin() SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. current_role()
--    Continua SECURITY DEFINER (intencional: evita recursao infinita na RLS
--    de public.profiles, ja que lê a propria tabela profiles). Continua com
--    EXECUTE para authenticated (necessario pelas policies e pela is_admin).
--    Somente o grant para anon/PUBLIC e removido.
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.current_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_role() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_role() TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. Hardening: evita que funcoes novas criadas em migrations futuras sejam
--    automaticamente expostas a anon/authenticated pelos default privileges.
--    (As funcoes deste projeto recebem grants explicitos, entao nao quebra.)
-- ----------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM authenticated;
