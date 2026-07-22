-- OPE Club — corrige o JWT gigante que derrubava TODAS as requisições
--
-- CAUSA RAIZ do ERR_HTTP2_PROTOCOL_ERROR / ERR_CONNECTION_RESET:
-- O ProfilePage gravava a imagem do avatar em base64 (data:image/...) dentro de
-- auth.users.raw_user_meta_data.avatar_url. O Supabase embute o user_metadata
-- dentro do access token (JWT), então o token passou a ter dezenas de KB.
-- Esse JWT vai no header "Authorization" de toda requisição autenticada, e o
-- HTTP/2 tem limite de tamanho de header (SETTINGS_MAX_HEADER_LIST_SIZE, ~16KB
-- na borda da Cloudflare). Ao estourar o limite, o servidor derruba a stream —
-- o navegador reporta ERR_HTTP2_PROTOCOL_ERROR / ERR_CONNECTION_RESET.
--
-- O código já foi corrigido para subir o avatar ao Storage e gravar só a URL.
-- Esta migration limpa os dados que já ficaram inchados.

-- =====================================================================
-- 1) Remove imagens base64 do metadata de auth (a correção que destrava)
-- =====================================================================
update auth.users
set raw_user_meta_data = raw_user_meta_data - 'avatar_url'
where raw_user_meta_data ->> 'avatar_url' like 'data:%';

-- Segurança extra: qualquer outro valor absurdamente grande no metadata
-- também derruba o JWT. Remove avatar_url com mais de 500 caracteres.
update auth.users
set raw_user_meta_data = raw_user_meta_data - 'avatar_url'
where length(coalesce(raw_user_meta_data ->> 'avatar_url', '')) > 500;

-- =====================================================================
-- 2) Limpa base64 gravado na tabela profiles
--    (não quebra HTTP, mas deixa cada leitura de perfil pesadíssima,
--     já que o app faz select=* em profiles)
-- =====================================================================
update public.profiles
set avatar = null,
    updated_at = now()
where avatar like 'data:%';

-- =====================================================================
-- 3) Bucket público de avatares
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "avatars_select_public" on storage.objects;
drop policy if exists "avatars_insert_own" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;

-- Leitura pública (as fotos aparecem para todo mundo no feed).
create policy "avatars_select_public" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'avatars');

-- Cada usuário só escreve dentro da própria pasta: avatars/<user_id>/arquivo.
-- É por isso que o app monta o caminho como `${user.id}/${Date.now()}.${ext}`.
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
