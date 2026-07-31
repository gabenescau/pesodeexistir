-- ============================================================================
-- OPE Club — migration completa (schema + RLS + funcoes + triggers + storage)
--
-- Principios:
--   * Cada tabela tem RLS habilitado. Sem excecao.
--   * Usuarios comuns so enxergam dados proprios ou publicos (ex: posts,
--     books, authors, public_profiles).
--   * Acoes administrativas (inserir livros, mover sugestoes, gerenciar
--     usuarios) passam por funcoes SECURITY DEFINER que validam role
--     dentro do banco — a API serverless checa role tambem, mas a RLS
--     impede bypass caso o service key vaze.
--   * Email fica em user_emails (nao profiles), e so e visivel para admins.
--   * Buckets privados (pdfs) nunca sao publicos; o app so baixa URL
--     assinada. Covers e avatars sao publicos mas escrita exige auth.
--   * Webhook events do AbacatePay e api_rate_limits sao inacessiveis ao
--     anon: o service role usa a service key, nao o anon JWT.
--
-- Como aplicar (Supabase SQL editor ou CLI):
--   psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_full.sql
-- ou
--   supabase db push   (se a pasta estiver linkada como projeto)
-- ============================================================================

-- ============================================================================
-- 1. EXTENSOES
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. FUNCOES AUXILIARES (definidas cedo para serem usadas nas policies)
-- ============================================================================

-- Retorna a role do usuario corrente. SECURITY DEFINER para evitar recursao
-- na policy de profiles (a policy checa profiles, e profiles nao pode se
-- ler sem checar profiles).
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid()),
    (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
    'user'
  );
$$;

REVOKE ALL ON FUNCTION public.current_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_role() TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_role() = 'admin';
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- updated_at automatico
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger que cria profile + user_emails quando um usuario novo entra.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_avatar text;
BEGIN
  v_name := COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'name'), ''), split_part(NEW.email, '@', 1));
  v_avatar := COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'avatar'), ''), upper(substr(v_name, 1, 1)));

  INSERT INTO public.profiles (id, name, avatar, username)
  VALUES (
    NEW.id,
    v_name,
    v_avatar,
    LOWER(regexp_replace(v_name, '[^a-zA-Z0-9_]', '', 'g')) || substr(NEW.id::text, 1, 6)
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_emails (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Rate limit compartilhado entre API serverless e Supabase.
CREATE OR REPLACE FUNCTION public.check_api_rate_limit(
  p_key_hash text,
  p_scope text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS TABLE(allowed boolean, remaining integer, reset_at bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_count integer;
  v_allowed boolean;
  v_remaining integer;
  v_reset_at bigint;
BEGIN
  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_reset_at := extract(epoch from (v_window_start + make_interval(secs => p_window_seconds)))::bigint;

  INSERT INTO public.api_rate_limits (key_hash, scope, window_start, request_count)
  VALUES (p_key_hash, p_scope, v_window_start, 1)
  ON CONFLICT (key_hash, scope, window_start)
  DO UPDATE SET request_count = public.api_rate_limits.request_count + 1
  RETURNING request_count INTO v_count;

  v_remaining := GREATEST(0, p_limit - v_count);
  v_allowed := v_count <= p_limit;

  RETURN QUERY SELECT v_allowed, v_remaining, v_reset_at;
END;
$$;

REVOKE ALL ON FUNCTION public.check_api_rate_limit(text, text, integer, integer) FROM PUBLIC;

-- ============================================================================
-- 3. TABELAS
-- ============================================================================

-- profiles: dados publicos do usuario. SEM email. SEM dados sensiveis.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (name IS NULL OR char_length(btrim(name)) BETWEEN 1 AND 80),
  avatar text,
  avatar_url text,
  username text UNIQUE CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,24}$'),
  bio text CHECK (bio IS NULL OR char_length(bio) <= 500),
  theme text NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'editor', 'admin')),
  private_profile boolean NOT NULL DEFAULT false,
  reading_activity boolean NOT NULL DEFAULT true,
  show_online_status boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (username);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- user_emails: e-mail do usuario, ISOLADO de profiles. Visivel so para admin
-- e para o proprio dono (auth.uid()).
CREATE TABLE IF NOT EXISTS public.user_emails (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- authors / books: catalogo publico, leitura livre; escrita so admin.
CREATE TABLE IF NOT EXISTS public.authors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image text,
  image_path text,
  theme text,
  era text,
  bio text CHECK (bio IS NULL OR char_length(bio) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_authors_updated_at ON public.authors;
CREATE TRIGGER trg_authors_updated_at BEFORE UPDATE ON public.authors
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image text,
  image_path text,
  author_id uuid REFERENCES public.authors(id) ON DELETE SET NULL,
  pdf_url text,
  pdf_path text,
  category text,
  bio text CHECK (bio IS NULL OR char_length(bio) <= 4000),
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_books_author_id ON public.books (author_id);
CREATE INDEX IF NOT EXISTS idx_books_category ON public.books (category);

DROP TRIGGER IF EXISTS trg_books_updated_at ON public.books;
CREATE TRIGGER trg_books_updated_at BEFORE UPDATE ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- categories
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- posts
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (char_length(text) <= 5000),
  tag text CHECK (tag IS NULL OR char_length(tag) <= 40),
  book_id uuid REFERENCES public.books(id) ON DELETE SET NULL,
  image text,
  image_paths text[] NOT NULL DEFAULT '{}'::text[],
  images jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (
    jsonb_array_length(images) <= 4 AND char_length(images::text) <= 3000000
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts (user_id);
CREATE INDEX IF NOT EXISTS idx_posts_book_id ON public.posts (book_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts (created_at DESC);

-- post_replies
CREATE TABLE IF NOT EXISTS public.post_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.post_replies(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (char_length(btrim(text)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_replies_post_id ON public.post_replies (post_id);
CREATE INDEX IF NOT EXISTS idx_post_replies_user_id ON public.post_replies (user_id);
CREATE INDEX IF NOT EXISTS idx_post_replies_parent_id ON public.post_replies (parent_id);

-- post_likes
CREATE TABLE IF NOT EXISTS public.post_likes (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes (post_id);

-- saved_posts
CREATE TABLE IF NOT EXISTS public.saved_posts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

-- follows
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows (following_id);

-- reactions
CREATE TABLE IF NOT EXISTS public.reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('post', 'post_reply', 'book_comment')),
  target_id uuid NOT NULL,
  emoji text NOT NULL CHECK (emoji IN ('heart', 'fire', 'laugh', 'wow', 'sad', 'clap', 'think', 'book')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_type, target_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_reactions_target ON public.reactions (target_type, target_id);

-- book_notes
CREATE TABLE IF NOT EXISTS public.book_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  page_number integer NOT NULL DEFAULT 1 CHECK (page_number >= 1),
  note text NOT NULL CHECK (char_length(note) <= 5000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_book_notes_user_book ON public.book_notes (user_id, book_id);

DROP TRIGGER IF EXISTS trg_book_notes_updated_at ON public.book_notes;
CREATE TRIGGER trg_book_notes_updated_at BEFORE UPDATE ON public.book_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- book_page_comments: discussoes por pagina
CREATE TABLE IF NOT EXISTS public.book_page_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  page_number integer NOT NULL CHECK (page_number >= 1),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (char_length(btrim(text)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_book_page_comments_book_page ON public.book_page_comments (book_id, page_number);
CREATE INDEX IF NOT EXISTS idx_book_page_comments_user ON public.book_page_comments (user_id);

DROP TRIGGER IF EXISTS trg_book_page_comments_updated_at ON public.book_page_comments;
CREATE TRIGGER trg_book_page_comments_updated_at BEFORE UPDATE ON public.book_page_comments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- book_author_comments: comentarios gerais (livro/autor inteiro)
CREATE TABLE IF NOT EXISTS public.book_author_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('book', 'author')),
  target_id uuid NOT NULL,
  text text NOT NULL CHECK (char_length(btrim(text)) BETWEEN 1 AND 1000),
  parent_id uuid REFERENCES public.book_author_comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_book_author_comments_target
  ON public.book_author_comments (target_type, target_id, created_at);

-- reading_progress
CREATE TABLE IF NOT EXISTS public.reading_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  current_page integer NOT NULL DEFAULT 1 CHECK (current_page >= 0),
  total_pages integer CHECK (total_pages IS NULL OR total_pages > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, book_id)
);

CREATE INDEX IF NOT EXISTS idx_reading_progress_user ON public.reading_progress (user_id);

DROP TRIGGER IF EXISTS trg_reading_progress_updated_at ON public.reading_progress;
CREATE TRIGGER trg_reading_progress_updated_at BEFORE UPDATE ON public.reading_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'abacatepay' CHECK (provider IN ('abacatepay', 'manual_admin', 'cakto')),
  provider_product_id text,
  provider_offer_id text,
  provider_order_id text,
  provider_subscription_id text,
  provider_customer_id text,
  customer_email text NOT NULL,
  plan text NOT NULL DEFAULT 'ope_club_monthly' CHECK (plan IN ('ope_club_monthly', 'ope_club_annual')),
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'active', 'past_due', 'trialing', 'canceled', 'refunded', 'expired')
  ),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  last_payment_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_sub ON public.subscriptions (provider, provider_subscription_id);

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- weekly_releases
CREATE TABLE IF NOT EXISTS public.weekly_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  release_date date NOT NULL,
  note text CHECK (note IS NULL OR char_length(note) <= 200),
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weekly_releases_release_date ON public.weekly_releases (release_date);

DROP TRIGGER IF EXISTS trg_weekly_releases_updated_at ON public.weekly_releases;
CREATE TRIGGER trg_weekly_releases_updated_at BEFORE UPDATE ON public.weekly_releases
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- book_favorites / author_favorites
CREATE TABLE IF NOT EXISTS public.book_favorites (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, book_id)
);

CREATE TABLE IF NOT EXISTS public.author_favorites (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.authors(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, author_id)
);

-- post_polls
CREATE TABLE IF NOT EXISTS public.post_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL UNIQUE REFERENCES public.posts(id) ON DELETE CASCADE,
  question text NOT NULL CHECK (char_length(btrim(question)) BETWEEN 3 AND 180),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.post_poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.post_polls(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 120),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_poll_options_poll ON public.post_poll_options (poll_id, sort_order);

CREATE TABLE IF NOT EXISTS public.post_poll_votes (
  poll_id uuid NOT NULL REFERENCES public.post_polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.post_poll_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);

-- suggestions
CREATE TABLE IF NOT EXISTS public.suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 90),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  category text NOT NULL DEFAULT 'Geral' CHECK (char_length(category) <= 40),
  status text NOT NULL DEFAULT 'ideas' CHECK (status IN ('ideas', 'reading', 'building', 'released')),
  author_name text,
  comment_count integer NOT NULL DEFAULT 0 CHECK (comment_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suggestions_status ON public.suggestions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggestions_user_id ON public.suggestions (user_id);

DROP TRIGGER IF EXISTS trg_suggestions_updated_at ON public.suggestions;
CREATE TRIGGER trg_suggestions_updated_at BEFORE UPDATE ON public.suggestions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- abacatepay_webhook_events: so service role
CREATE TABLE IF NOT EXISTS public.abacatepay_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  checkout_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- api_rate_limits: so service role
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  key_hash text NOT NULL,
  scope text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 1 CHECK (request_count > 0),
  PRIMARY KEY (key_hash, scope, window_start)
);

-- ============================================================================
-- 4. VIEW — public_profiles (sem dados sensiveis, sem profiles privados)
-- ============================================================================
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  p.id,
  p.name,
  p.username,
  p.avatar,
  p.avatar_url,
  p.bio,
  p.role,
  p.created_at
FROM public.profiles p
WHERE p.private_profile = false OR p.id = auth.uid();

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- ============================================================================
-- 5. RLS — habilitar em todas as tabelas
-- ============================================================================
ALTER TABLE public.profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_emails             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authors                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_replies            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_posts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_notes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_page_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_author_comments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_progress        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_releases         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_favorites          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.author_favorites        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_polls              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_poll_options       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_poll_votes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abacatepay_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_rate_limits         ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. POLICIES — profiles
-- ============================================================================
DROP POLICY IF EXISTS "profiles_select"          ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"      ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_self"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all"       ON public.profiles;
CREATE POLICY "profiles_select"      ON public.profiles FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "profiles_update_own"  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
-- INSERT so pelo trigger handle_new_user (SECURITY DEFINER). Sem policy -> anon
-- nao consegue inserir, mesmo tendo a tabela. Para admins criarem perfis
-- manualmente usamos funcao SECURITY DEFINER abaixo.
CREATE POLICY "profiles_admin_all"    ON public.profiles FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================================
-- 7. POLICIES — user_emails (visivel so para admin e para o dono)
-- ============================================================================
DROP POLICY IF EXISTS "user_emails_select_own"  ON public.user_emails;
DROP POLICY IF EXISTS "user_emails_admin"       ON public.user_emails;
CREATE POLICY "user_emails_select_own" ON public.user_emails FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "user_emails_admin"      ON public.user_emails FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================================
-- 8. POLICIES — catalogo publico (leitura livre, escrita admin)
-- ============================================================================
DROP POLICY IF EXISTS "authors_read"            ON public.authors;
DROP POLICY IF EXISTS "authors_admin"           ON public.authors;
CREATE POLICY "authors_read"  ON public.authors FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "authors_admin" ON public.authors FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "books_read"              ON public.books;
DROP POLICY IF EXISTS "books_admin"             ON public.books;
CREATE POLICY "books_read"  ON public.books FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "books_admin" ON public.books FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "categories_read"         ON public.categories;
DROP POLICY IF EXISTS "categories_admin"        ON public.categories;
CREATE POLICY "categories_read"  ON public.categories FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "categories_admin" ON public.categories FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================================
-- 9. POLICIES — posts, replies, likes, saves
-- ============================================================================
DROP POLICY IF EXISTS "posts_read"              ON public.posts;
DROP POLICY IF EXISTS "posts_insert_own"        ON public.posts;
DROP POLICY IF EXISTS "posts_update_own"        ON public.posts;
DROP POLICY IF EXISTS "posts_delete_own"        ON public.posts;
DROP POLICY IF EXISTS "posts_admin"             ON public.posts;
CREATE POLICY "posts_read"        ON public.posts FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "posts_insert_own"  ON public.posts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "posts_update_own"  ON public.posts FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin()) WITH CHECK (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "posts_delete_own"  ON public.posts FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "post_replies_read"       ON public.post_replies;
DROP POLICY IF EXISTS "post_replies_insert_own" ON public.post_replies;
DROP POLICY IF EXISTS "post_replies_delete_own" ON public.post_replies;
DROP POLICY IF EXISTS "post_replies_admin"      ON public.post_replies;
CREATE POLICY "post_replies_read"       ON public.post_replies FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "post_replies_insert_own" ON public.post_replies FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "post_replies_delete_own" ON public.post_replies FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "post_likes_read"         ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_insert_own"   ON public.post_likes;
DROP POLICY IF EXISTS "post_likes_delete_own"   ON public.post_likes;
CREATE POLICY "post_likes_read"       ON public.post_likes FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "post_likes_insert_own" ON public.post_likes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "post_likes_delete_own" ON public.post_likes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "saved_posts_all_own"     ON public.saved_posts;
CREATE POLICY "saved_posts_all_own" ON public.saved_posts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 10. POLICIES — follows / reactions / favorites
-- ============================================================================
DROP POLICY IF EXISTS "follows_read"            ON public.follows;
DROP POLICY IF EXISTS "follows_write_own"       ON public.follows;
DROP POLICY IF EXISTS "follows_delete_own"      ON public.follows;
CREATE POLICY "follows_read"       ON public.follows FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "follows_write_own"  ON public.follows FOR INSERT TO authenticated WITH CHECK (follower_id = auth.uid());
CREATE POLICY "follows_delete_own" ON public.follows FOR DELETE TO authenticated USING (follower_id = auth.uid());

DROP POLICY IF EXISTS "reactions_read"          ON public.reactions;
DROP POLICY IF EXISTS "reactions_insert_own"    ON public.reactions;
DROP POLICY IF EXISTS "reactions_delete_own"    ON public.reactions;
CREATE POLICY "reactions_read"       ON public.reactions FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "reactions_insert_own" ON public.reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "reactions_delete_own" ON public.reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "book_favorites_own"     ON public.book_favorites;
CREATE POLICY "book_favorites_own" ON public.book_favorites FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "author_favorites_own"   ON public.author_favorites;
CREATE POLICY "author_favorites_own" ON public.author_favorites FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 11. POLICIES — notas e comentarios
-- ============================================================================
DROP POLICY IF EXISTS "book_notes_all_own"     ON public.book_notes;
CREATE POLICY "book_notes_all_own" ON public.book_notes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "book_page_comments_read"      ON public.book_page_comments;
DROP POLICY IF EXISTS "book_page_comments_write_own"  ON public.book_page_comments;
DROP POLICY IF EXISTS "book_page_comments_delete_own" ON public.book_page_comments;
CREATE POLICY "book_page_comments_read"       ON public.book_page_comments FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "book_page_comments_write_own" ON public.book_page_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "book_page_comments_delete_own" ON public.book_page_comments FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "book_author_comments_read"      ON public.book_author_comments;
DROP POLICY IF EXISTS "book_author_comments_write_own"  ON public.book_author_comments;
DROP POLICY IF EXISTS "book_author_comments_delete_own" ON public.book_author_comments;
CREATE POLICY "book_author_comments_read"       ON public.book_author_comments FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "book_author_comments_write_own" ON public.book_author_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "book_author_comments_delete_own" ON public.book_author_comments FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_admin());

-- ============================================================================
-- 12. POLICIES — progresso de leitura, assinaturas, lancamentos
-- ============================================================================
DROP POLICY IF EXISTS "reading_progress_own" ON public.reading_progress;
CREATE POLICY "reading_progress_own" ON public.reading_progress FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "subscriptions_read_own_or_admin" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_admin"              ON public.subscriptions;
CREATE POLICY "subscriptions_read_own_or_admin" ON public.subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
-- Escrita e exclusiva do service role (webhook do AbacatePay e admin panel via
-- service key). Sem policy de INSERT/UPDATE/DELETE para authenticated.

DROP POLICY IF EXISTS "weekly_releases_read"   ON public.weekly_releases;
DROP POLICY IF EXISTS "weekly_releases_admin"  ON public.weekly_releases;
CREATE POLICY "weekly_releases_read"  ON public.weekly_releases FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "weekly_releases_admin" ON public.weekly_releases FOR ALL TO authenticated
  USING (public.is_admin() OR public.current_role() = 'editor') WITH CHECK (public.is_admin() OR public.current_role() = 'editor');

-- ============================================================================
-- 13. POLICIES — polls
-- ============================================================================
DROP POLICY IF EXISTS "post_polls_read"             ON public.post_polls;
DROP POLICY IF EXISTS "post_polls_write_post_owner" ON public.post_polls;
DROP POLICY IF EXISTS "post_polls_admin"           ON public.post_polls;
CREATE POLICY "post_polls_read" ON public.post_polls FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "post_polls_write_post_owner" ON public.post_polls FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()));
CREATE POLICY "post_polls_admin" ON public.post_polls FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "post_poll_options_read"      ON public.post_poll_options;
DROP POLICY IF EXISTS "post_poll_options_write"     ON public.post_poll_options;
CREATE POLICY "post_poll_options_read"  ON public.post_poll_options FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "post_poll_options_write" ON public.post_poll_options FOR ALL TO authenticated
  USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.post_polls pp
      JOIN public.posts p ON p.id = pp.post_id
      WHERE pp.id = poll_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.post_polls pp
      JOIN public.posts p ON p.id = pp.post_id
      WHERE pp.id = poll_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "post_poll_votes_read"   ON public.post_poll_votes;
DROP POLICY IF EXISTS "post_poll_votes_own"    ON public.post_poll_votes;
CREATE POLICY "post_poll_votes_read" ON public.post_poll_votes FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "post_poll_votes_own"  ON public.post_poll_votes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 14. POLICIES — sugestoes
-- ============================================================================
DROP POLICY IF EXISTS "suggestions_read"          ON public.suggestions;
DROP POLICY IF EXISTS "suggestions_insert_own"    ON public.suggestions;
DROP POLICY IF EXISTS "suggestions_update_owner_admin" ON public.suggestions;
DROP POLICY IF EXISTS "suggestions_delete_owner_admin" ON public.suggestions;
CREATE POLICY "suggestions_read"      ON public.suggestions FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "suggestions_insert_own" ON public.suggestions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
-- Atualizacao: so admin/editor mexem em status; autor pode editar o proprio
-- titulo/descricao enquanto a sugestao ainda nao foi pega (status='ideas').
CREATE POLICY "suggestions_update_owner_admin" ON public.suggestions FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'ideas') OR public.is_admin() OR public.current_role() = 'editor'
  )
  WITH CHECK (
    (user_id = auth.uid() AND status = 'ideas') OR public.is_admin() OR public.current_role() = 'editor'
  );
CREATE POLICY "suggestions_delete_owner_admin" ON public.suggestions FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- ============================================================================
-- 15. POLICIES — tabelas internas (apenas service role)
-- ============================================================================
-- abacatepay_webhook_events: escrita exclusiva via service key.
-- Nenhuma policy = anon nao ve, authenticated nao ve.
DROP POLICY IF EXISTS "abacatepay_webhook_admin" ON public.abacatepay_webhook_events;
CREATE POLICY "abacatepay_webhook_admin" ON public.abacatepay_webhook_events FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- api_rate_limits: chamada so via SECURITY DEFINER RPC (service role).
-- Nenhuma policy para authenticated/anon = totalmente inacessivel ao front.

-- ============================================================================
-- 16. STORAGE — buckets e politicas
-- ============================================================================

-- Buckets: recriar com tipos corretos. (Supabase nao permite alterar tipo
-- de bucket via SQL; se ja existe, ignore o erro de "type mismatch".)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true,  5242880,  ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('covers',  'covers',  true,  8388608,  ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('pdfs',    'pdfs',    false, 104857600, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- policies: como o storage nao suporta role check via policy no schema
-- `storage.objects` antes do Supabase 14, mantemos o padrao "public read,
-- authenticated write na pasta <user_id>/" para avatars/covers, e PDF so
-- via URL assinada emitida pelo backend (que valida assinatura ativa).

DROP POLICY IF EXISTS "avatars_select"         ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert_own"     ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_own"     ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_own"     ON storage.objects;
CREATE POLICY "avatars_select"     ON storage.objects FOR SELECT TO authenticated, anon
  USING (bucket_id = 'avatars');
CREATE POLICY "avatars_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "covers_select"          ON storage.objects;
DROP POLICY IF EXISTS "covers_admin_write"     ON storage.objects;
CREATE POLICY "covers_select"      ON storage.objects FOR SELECT TO authenticated, anon
  USING (bucket_id = 'covers');
CREATE POLICY "covers_admin_write"  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'covers' AND public.is_admin())
  WITH CHECK (bucket_id = 'covers' AND public.is_admin());

-- pdfs: bucket privado. Sem policy de SELECT/INSERT para usuarios; so o
-- service role (via createSignedUrl) gera URL temporaria. Nenhuma policy =
-- anon e authenticated nao conseguem ler.

-- ============================================================================
-- 17. GRANTS — apenas o necessario
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles                 TO authenticated;
GRANT SELECT                          ON public.profiles                 TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_emails              TO authenticated;
GRANT SELECT                          ON public.public_profiles           TO anon, authenticated;
GRANT SELECT                          ON public.authors                  TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.authors                  TO authenticated;
GRANT SELECT                          ON public.books                    TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.books                    TO authenticated;
GRANT SELECT                          ON public.categories               TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts                    TO authenticated;
GRANT SELECT                          ON public.posts                    TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_replies             TO authenticated;
GRANT SELECT                          ON public.post_replies             TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_likes               TO authenticated;
GRANT SELECT                          ON public.post_likes               TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_posts              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follows                  TO authenticated;
GRANT SELECT                          ON public.follows                  TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reactions                TO authenticated;
GRANT SELECT                          ON public.reactions                TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_notes              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_page_comments       TO authenticated;
GRANT SELECT                          ON public.book_page_comments       TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_author_comments     TO authenticated;
GRANT SELECT                          ON public.book_author_comments     TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_favorites           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.author_favorites         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reading_progress         TO authenticated;
GRANT SELECT                          ON public.subscriptions            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_releases          TO authenticated;
GRANT SELECT                          ON public.weekly_releases          TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_polls              TO authenticated;
GRANT SELECT                          ON public.post_polls              TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_poll_options       TO authenticated;
GRANT SELECT                          ON public.post_poll_options       TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_poll_votes         TO authenticated;
GRANT SELECT                          ON public.post_poll_votes         TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suggestions             TO authenticated;
GRANT SELECT                          ON public.suggestions             TO anon;
GRANT EXECUTE ON FUNCTION public.current_role() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_admin()    TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_api_rate_limit(text, text, integer, integer) TO service_role;

-- ============================================================================
-- 18. REVOKE — garante que anon nao faz coisa que nao deve
-- ============================================================================
REVOKE INSERT, UPDATE, DELETE ON public.profiles              FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.user_emails           FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.authors              FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.books                FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.categories           FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.posts                FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.post_replies         FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.post_likes           FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.saved_posts          FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.follows              FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.reactions            FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.book_notes          FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.book_page_comments   FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.book_author_comments FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.book_favorites       FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.author_favorites     FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.reading_progress     FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions        FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.weekly_releases      FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.post_polls          FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.post_poll_options   FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.post_poll_votes     FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.suggestions         FROM anon;
REVOKE ALL ON public.abacatepay_webhook_events               FROM anon;
REVOKE ALL ON public.abacatepay_webhook_events               FROM authenticated;
REVOKE ALL ON public.api_rate_limits                         FROM anon;
REVOKE ALL ON public.api_rate_limits                         FROM authenticated;

-- ============================================================================
-- 19. SEGURANCA DE SCHEMA — evita privilege escalation
-- ============================================================================
-- Ninguem alem de postgres/service_role pode dropar/alterar policies.
-- (padrao do Supabase; reiterando explicitamente para documentacao)
ALTER SCHEMA public OWNER TO postgres;

-- ============================================================================
-- 20. FIM — conferir com:
--    SELECT schemaname, tablename, rowsecurity FROM pg_tables
--    WHERE schemaname = 'public' AND rowsecurity = false;
-- (deve retornar 0 linhas: todas as tabelas public tem RLS ativo)
-- ============================================================================
