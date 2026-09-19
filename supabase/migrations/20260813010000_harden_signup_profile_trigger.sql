-- Evita que nomes longos ou sem caracteres ASCII quebrem o cadastro.
-- A trigger roda dentro do INSERT de auth.users: qualquer violacao aqui vira
-- um erro 500 no /auth/v1/signup e impede a conta de ser criada.
begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_name text;
  v_avatar text;
  v_base_username text;
  v_username text;
  v_email text;
begin
  v_email := coalesce(nullif(btrim(new.email), ''), '');
  v_name := left(
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(btrim(split_part(v_email, '@', 1)), ''),
      'Membro OPE'
    ),
    80
  );
  v_avatar := left(
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'avatar'), ''),
      upper(substr(v_name, 1, 1)),
      'M'
    ),
    255
  );

  -- username tem limite de 24 caracteres. O hash do UUID evita colisao
  -- mesmo quando varios usuarios usam o mesmo nome.
  v_base_username := lower(regexp_replace(v_name, '[^a-zA-Z0-9_]', '', 'g'));
  if v_base_username = '' then
    v_base_username := 'user';
  end if;
  v_username := left(v_base_username, 11) || '_' || substr(md5(new.id::text), 1, 12);

  insert into public.profiles (id, name, avatar, username)
  values (new.id, v_name, v_avatar, v_username)
  on conflict (id) do nothing;

  insert into public.user_emails (user_id, email)
  values (new.id, v_email)
  on conflict (user_id) do update
    set email = excluded.email,
        updated_at = now();

  return new;
end;
$function$;

-- O trigger e chamado pelo servico interno do Supabase Auth, nunca pelo
-- frontend. O bloco torna o grant compatvel com projetos onde o role existe.
revoke all on function public.handle_new_user() from public, anon, authenticated;
do $grant$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.handle_new_user() to supabase_auth_admin;
  end if;
end
$grant$;

notify pgrst, 'reload schema';
commit;
