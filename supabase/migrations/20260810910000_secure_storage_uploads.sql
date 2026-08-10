-- Uploads passam pela Edge Function secure-upload, que valida a assinatura
-- real dos bytes e autoriza o proprietario/admin no servidor.

begin;

-- O cliente continua podendo ler/remover seus objetos permitidos, mas nunca
-- escolhe livremente o content-type ou grava bytes direto no Storage.
drop policy if exists "avatars_insert_own" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "covers_admin_write" on storage.objects;
drop policy if exists "covers_admin_insert_v2" on storage.objects;
drop policy if exists "covers_admin_update_v2" on storage.objects;
drop policy if exists content_managers_insert_library_files on storage.objects;
drop policy if exists content_managers_update_library_files on storage.objects;
drop policy if exists "post_media_insert_own" on storage.objects;
drop policy if exists "post_media_update_own" on storage.objects;

-- Os buckets privados nunca devem liberar leitura anonima. Avatar continua
-- publico por compatibilidade visual, mas agora so recebe bytes validados.
update storage.buckets
   set allowed_mime_types = case id
     when 'avatars' then array['image/jpeg','image/png','image/webp','image/gif']::text[]
     when 'covers' then array['image/jpeg','image/png','image/webp','image/gif']::text[]
     when 'post-media' then array['image/jpeg','image/png','image/webp','image/gif']::text[]
     when 'pdfs' then array['application/pdf']::text[]
     else allowed_mime_types
   end,
   file_size_limit = case id
     when 'avatars' then 2097152
     when 'covers' then 5242880
     when 'post-media' then 5242880
     when 'pdfs' then 52428800
     else file_size_limit
   end
 where id in ('avatars','covers','post-media','pdfs');

commit;
