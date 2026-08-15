-- ============================================================================
-- M4 — [MEDIO] Troca de email passa por auth + sync em user_emails
-- ----------------------------------------------------------------------------
-- Antes: o front tentava `update profiles set email = ...` (coluna inexistente)
-- apos o updateUser — PostgREST retornava erro e a mensagem "Confira seu
-- email..." nunca aparecia. O email vive em user_emails (nao em profiles).
--
-- Fix:
--   1. O cliente agora depende so do supabase.auth.updateUser (SettingsPage).
--   2. Este trigger espelha a mudanca de email de auth.users em user_emails,
--      mantendo o mesmo padrao do handle_new_user (ON CONFLICT upsert).
--   3. O fluxo de preferences em profiles ignora email (guard no DataContext).
--
-- Idempotente.
-- ============================================================================

begin;

create or replace function public.sync_user_email_on_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_emails (user_id, email, updated_at)
  values (new.id, new.email, now())
  on conflict (user_id)
  do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  execute function public.sync_user_email_on_change();

commit;
