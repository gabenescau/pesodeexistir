-- ============================================================================
-- Add post-media bucket + storage RLS policies
-- ----------------------------------------------------------------------------
-- Correcao do erro "new row violates row-level security policy" ao publicar
-- post com imagens: o bucket `post-media` nao existia no schema e nao havia
-- policy em `storage.objects` para ele, entao o upload (INSERT no storage)
-- era bloqueado pelo RLS. Segue o mesmo padrao do bucket `avatars`.
-- ============================================================================

-- Bucket: privado (imagens dos posts sao lidas via URL assinada pelo app,
-- padrao igual ao bucket `pdfs`). Bucket publico com SELECT amplo geraria o
-- aviso "Public Bucket Allows Listing" do database linter.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('post-media', 'post-media', false, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Se o bucket ja existir como publico (criado manualmente antes), forca privado.
UPDATE storage.buckets SET public = false WHERE id = 'post-media' AND public = true;

-- Policies: leitura para gerar URLs assinadas, escrita na pasta <user_id>/
-- (mesmo padrao de `avatars`). O caminho enviado pelo cliente e
-- `<user_id>/<nome>`.
DROP POLICY IF EXISTS "post_media_select"     ON storage.objects;
DROP POLICY IF EXISTS "post_media_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "post_media_update_own" ON storage.objects;
DROP POLICY IF EXISTS "post_media_delete_own" ON storage.objects;

CREATE POLICY "post_media_select"     ON storage.objects FOR SELECT TO authenticated, anon
  USING (bucket_id = 'post-media');

CREATE POLICY "post_media_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "post_media_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "post_media_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text);
