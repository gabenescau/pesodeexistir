-- ============================================================================
-- Limpa a funcao orfã public.prevent_self_role_escalation do banco de producao.
-- ----------------------------------------------------------------------------
-- [LINTER 0029] authenticated ainda tem EXECUTE em public.prevent_self_role_escalation()
-- no projeto remoto. Essa funcao veio de uma migracao antiga (protect_profile_role)
-- que foi reescrita e substituida pela linhagem atual em
-- 20260731163000_block_role_escalation.sql, que usa public.guard_profile_role_change()
-- com REVOKE colunar em profiles.role como camada primaria.
--
-- A funcao antiga nao existe mais no repositorio (nao e criada por nenhuma
-- migracao atual): e orfa no banco, mantendo grants vazados para o linter.
-- Esta migracao remove o trigger e a funcao antigos. Em ambientes novos
-- (onde ela nunca foi criada) e um no-op seguro.
--
-- Idempotente.
-- ============================================================================

begin;

-- 1. Drop do trigger antigo (se ainda existir em producao) para liberar a
--    dependencia da funcao.
drop trigger if exists trg_profiles_role_guard on public.profiles;

-- 2. Drop da funcao orfa.
drop function if exists public.prevent_self_role_escalation();

commit;