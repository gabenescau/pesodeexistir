-- M1 — [CRITICO] Escalada de privilegio para admin via RLS de profiles
--
-- Fecha a escalada de role em duas camadas:
--   1. REVOKE colunar: `authenticated` (incl. admins) nao pode mais fazer
--      UPDATE na coluna `role` via PostgREST / SQL direto, mesmo com a
--      policy `profiles_admin_all` FOR ALL. (Privilegio de coluna sobrepoe
--      o privilegio de tabela no PostgreSQL.)
--   2. Trigger de guarda: impede troca de role por auto-update, como defesa
--      em profundidade caso um novo GRANT colunar apareca no futuro.
--
-- Apos esta migration, mudanca de role so e possivel:
--   * por funcao SECURITY DEFINER chamada por um admin autenticado (JWT com
--     uid cujo profiles.role = 'admin'), ou
--   * server-side (service_role / postgres, auth.uid() = null).
-- Idempotente — pode rodar mais de uma vez.

begin;

revoke update (role) on public.profiles from authenticated;

create or replace function public.guard_profile_role_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    -- server-side (migracoes/backfill/service_role) nao leva JWT -> auth.uid()
    -- e null e nao deve ser bloqueado. Autenticado (JWT) precisa ser admin.
    if auth.uid() is not null and not exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'admin'
    ) then
      raise exception 'profile_role_change_denied'
        using errcode = 'P0001',
              hint = 'Apenas administradores podem alterar a coluna role.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_role_change on public.profiles;
create trigger guard_profile_role_change
  before update of role on public.profiles
  for each row
  execute function public.guard_profile_role_change();

commit;
