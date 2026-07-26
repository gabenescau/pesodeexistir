-- OPE Club — correção de duas falhas críticas de segurança
--
-- CRÍTICO 1 — Escalação de privilégio para admin:
--   `grant select, insert, update on public.profiles to authenticated` dava
--   UPDATE em TODAS as colunas, e a policy profiles_update_own_or_admin só
--   verifica a LINHA (auth.uid() = id), não a COLUNA. Qualquer usuário logado
--   podia fazer PATCH /rest/v1/profiles?id=eq.<proprio_id> {"role":"admin"}
--   e virar admin: criar/apagar livros, ler o email de todos os usuários,
--   ver os payloads de pagamento e se dar assinatura vitalícia de graça.
--
-- CRÍTICO 2 — Paywall completamente contornável:
--   O bucket `pdfs` era público e a tabela `books` entrega `pdf_url` para
--   anônimos. Qualquer pessoa lia a lista de livros com a chave anon (que é
--   pública no bundle JS) e baixava todos os PDFs sem login e sem pagar.
--   Verificado: download de 876 KB com HTTP 200 e zero autenticação.

-- =====================================================================
-- 1) CRÍTICO 1 — Impede que o usuário altere o próprio `role`
-- =====================================================================
-- Grant por coluna: `role` fica de fora, então o PostgREST recusa a escrita.
revoke update on public.profiles from authenticated;

grant update (name, avatar, bio, theme, email,
              private_profile, reading_activity, show_online_status)
  on public.profiles to authenticated;

-- Defesa em profundidade: mesmo que alguém re-conceda o grant no futuro,
-- o trigger barra a troca de role por quem não é admin.
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() nulo = service_role ou SQL Editor: administração legítima.
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Alteracao de role nao permitida.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_change on public.profiles;
create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row
  execute function public.prevent_role_change();

-- =====================================================================
-- 2) CRÍTICO 2 — Fecha o paywall
-- =====================================================================
-- Espelha no banco a mesma regra que o front usa em src/lib/subscription.js.
create or replace function public.has_active_subscription()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions
    where user_id = (select auth.uid())
      and lower(status) in (
        'active', 'past_due', 'trialing', 'paid', 'approved',
        'authorized', 'complete', 'completed', 'succeeded'
      )
      and (current_period_end is null or current_period_end >= now())
  );
$$;

revoke all on function public.has_active_subscription() from public;
grant execute on function public.has_active_subscription() to authenticated;

-- O bucket deixa de ser público: sem isso, a URL do objeto sozinha já basta
-- para baixar o arquivo, independente de qualquer policy.
update storage.buckets set public = false where id = 'pdfs';

drop policy if exists "pdfs_select_public" on storage.objects;
drop policy if exists "pdfs_select_subscribers" on storage.objects;

-- Só assinante ativo (ou admin) lê os PDFs, e apenas via URL assinada.
create policy "pdfs_select_subscribers" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pdfs'
    and (public.has_active_subscription() or public.is_admin())
  );

-- =====================================================================
-- 3) Tira o pdf_url das mãos de quem não está logado
-- =====================================================================
-- O catálogo continua visível para anônimos (capa, título, autor), mas o
-- caminho do arquivo não é mais entregue na vitrine.
drop policy if exists "books_select_public" on public.books;

create policy "books_select_authenticated" on public.books
  for select to authenticated
  using (true);

create policy "books_select_anon_catalog" on public.books
  for select to anon
  using (true);

revoke select on public.books from anon;
grant select (id, title, image, author_id, progress, created_at, updated_at)
  on public.books to anon;
