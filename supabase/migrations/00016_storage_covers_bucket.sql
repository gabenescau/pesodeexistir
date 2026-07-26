-- OPE Club — cria bucket de storage para capas de livros (covers)
--
-- O AdminPage faz upload de imagens de capa para o bucket `covers`
-- (AdminPage.jsx handleImageUpload -> supabase.storage.from("covers")),
-- mas esse bucket nunca foi criado no Supabase. Sem ele, o upload
-- "funciona" no código mas falha no banco, e a imagem some.

begin;

-- Bucket público de capas (se já existir, apenas garante public=true)
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do update
set public = excluded.public;

-- Leitura pública: qualquer um vê as imagens (anon + authenticated)
drop policy if exists "covers_select_public" on storage.objects;

create policy "covers_select_public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'covers');

-- Escrita: só admin pode inserir/atualizar/remover
drop policy if exists "covers_insert_admin" on storage.objects;
drop policy if exists "covers_update_admin" on storage.objects;
drop policy if exists "covers_delete_admin" on storage.objects;

create policy "covers_insert_admin"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'covers'
    and private.is_admin()
  );

create policy "covers_update_admin"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'covers'
    and private.is_admin()
  )
  with check (
    bucket_id = 'covers'
    and private.is_admin()
  );

create policy "covers_delete_admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'covers'
    and private.is_admin()
  );

-- Se no futuro quiser upload de fotos de autores no storage também,
-- basta adicionar um bucket `authors` com políticas espelhadas aqui.
-- Por enquanto autores usam URLs externas no campo `image` da tabela authors.

commit;
