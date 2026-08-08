-- ============================================================================
-- M3 — [GRAVE] Admin com fonte unica de verdade (profiles.role)
-- ----------------------------------------------------------------------------
-- Antes: public.current_role() caia para `auth.users.raw_app_meta_data->>'role'`
-- quando profiles nao tinha role. Como app_metadata e gravado a parte (painel
-- do Supabase), duas fontes podiam contradizer e dificultar auditar quem
-- promoveu quem. O front e as APIs serverless ja checavam profiles.role EM
-- PARALELO com app_metadata.role (corrigido em codigo nesta rodada).
--
-- Esta migration remove o fallback para app_metadata, deixando `profiles.role`
-- como unica fonte de verdade dentro do banco tambem. O schema `private` e as
-- policies de storage (M2) ja dependem so de profiles.role.
--
-- NOTA: current_role() precisa continuar SECURITY DEFINER — policies de RLS
-- de `profiles` (e de sugestoes/editor em 0001_full) a chamam, e sem definer
-- haveria recursao de policy. O aviso do linter (0029) e intencional.
-- Idempotente.
-- ============================================================================

begin;

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'user'
  );
$$;

revoke all on function public.current_role() from public;
revoke execute on function public.current_role() from anon;
grant execute on function public.current_role() to authenticated;

commit;
