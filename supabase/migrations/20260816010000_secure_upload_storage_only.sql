-- Keep Storage writes behind the secure-upload Edge Function.
-- The function validates the signed ticket, file signature, dimensions and
-- PDF active content before using the service role to write the object.

begin;

do $policy_cleanup$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
      from pg_policies
     where schemaname = 'storage'
       and tablename = 'objects'
       and cmd in ('INSERT', 'UPDATE', 'ALL')
       and (
         coalesce(qual, '') ilike any (array[
           '%avatars%', '%covers%', '%post-media%', '%shop-media%', '%pdfs%'
         ])
         or coalesce(with_check, '') ilike any (array[
           '%avatars%', '%covers%', '%post-media%', '%shop-media%', '%pdfs%'
         ])
       )
  loop
    execute format('drop policy if exists %I on storage.objects', policy_row.policyname);
  end loop;
end
$policy_cleanup$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp','image/gif']),
  ('covers', 'covers', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif']),
  ('post-media', 'post-media', false, 5242880, array['image/jpeg','image/png','image/webp','image/gif']),
  ('shop-media', 'shop-media', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif']),
  ('pdfs', 'pdfs', false, 52428800, array['application/pdf'])
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

commit;
