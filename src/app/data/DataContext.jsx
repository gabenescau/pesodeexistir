import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { supabase, isSupabaseReady } from "./supabase";
import { loadContent } from "./contentLoader";
import { pickCurrentSubscription } from "@/lib/subscription";
import { runSupabaseQuery } from "@/lib/supabase-query";
import { releaseStatus } from "@/lib/releases";
import { handleDoPerfil } from "@/lib/mentions";
import { createSignedUrlMap, LIBRARY_BUCKETS, removeLibraryFile } from "@/lib/library-media";
import { useAuth } from "./AuthContext";
import { POST_IMAGE_BUCKET } from "@/lib/social";
import { normalizeEmail, sanitizePlainText, sanitizeSingleLine } from "@/lib/sanitize";

const DataContext = createContext(null);

async function authenticatedApiPost(path, payload) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error("Sua sessao expirou. Entre novamente.");

  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  if (!body.success) throw new Error(body.error || "Nao foi possivel concluir a operacao.");
  return body.data;
}

function firstFilled(...values) {
  return values.find((value) => typeof value === "string" && value.trim()) || "";
}

function normalizeAssetUrl(value, folder) {
  const raw = firstFilled(value);
  if (!raw) return "";
  if (/^(https?:|data:|blob:|\/)/i.test(raw)) return raw;
  if (raw.startsWith(`${folder}/`)) return `/${raw}`;
  if (/^[^/]+\.(png|jpe?g|webp|gif|svg)$/i.test(raw)) return `/${folder}/${raw}`;
  return raw;
}

export function DataProvider({ children }) {
  const content = useMemo(() => loadContent(), []);
  const { user, profile: authProfile, isAdmin, loading: authLoading } = useAuth();

  const [books, setBooks] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [posts, setPosts] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [profile, setProfile] = useState(null);
  const [weeklyReleases, setWeeklyReleases] = useState([]);
  const [follows, setFollows] = useState([]);
  const [savedPostIds, setSavedPostIds] = useState([]);
  const [categories, setCategories] = useState([]);
  const [bookFavorites, setBookFavorites] = useState([]);
  const [authorFavorites, setAuthorFavorites] = useState([]);
  // Contagens do proprio usuario que nao vem nas listas ja carregadas
  // (comentarios e reacoes que ele escreveu). Alimentam as conquistas.
  const [myCounts, setMyCounts] = useState({ comments: 0, reactions: 0 });
  const [loading, setLoading] = useState(true);

  const isSupabase = isSupabaseReady();

  useEffect(() => {
    if (!isSupabase) {
      setBooks(content.books || []);
      setAuthors(content.authors || []);
      setLoading(false);
      return;
    }

    if (authLoading) {
      return;
    }

    if (!user?.id) {
      setBooks(content.books || []);
      setAuthors(content.authors || []);
      setPosts([]);
      setSubscription(null);
      setSubscriptions([]);
      setProfiles([]);
      setProfile(null);
      setWeeklyReleases([]);
      setFollows([]);
      setSavedPostIds([]);
      setCategories([]);
      setBookFavorites([]);
      setAuthorFavorites([]);
      setMyCounts({ comments: 0, reactions: 0 });
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);

      const currentUserId = user?.id;
      const currentProfileRes = currentUserId && !authProfile
        ? await runSupabaseQuery(
            () => supabase.from("profiles").select("*").eq("id", currentUserId).maybeSingle(),
            "carregar perfil atual"
          )
        : { data: authProfile || null, error: null };
      const currentProfile = currentProfileRes.error ? null : currentProfileRes.data;
      const isCurrentAdmin = isAdmin || currentProfile?.role === "admin" || user?.app_metadata?.role === "admin";
      const emptyResult = { data: [], error: null };

      // Admin le a tabela inteira (role, gestao de assinaturas). O email agora
      // mora em user_emails (fora de profiles), so visivel para admin — e
      // buscado em separado e mesclado abaixo. Usuario comum le a view
      // public_profiles: id/nome/@/avatar/bio de quem nao e privado, o
      // suficiente para o feed sem vazar email de ninguem.
      const [
        booksRes,
        authorsRes,
        progressRes,
        subsRes,
        profilesRes,
        emailsRes,
        postsRes,
        releasesRes,
        followsRes,
        savedRes,
        categoriesRes,
        bookFavRes,
        authorFavRes,
      ] = await Promise.all([
        runSupabaseQuery(
          () => supabase.from("books").select("*, authors(name)").order("created_at", { ascending: false }),
          "carregar livros"
        ),
        runSupabaseQuery(
          () => supabase.from("authors").select("*").order("name"),
          "carregar autores"
        ),
        currentUserId
          ? runSupabaseQuery(
              () => supabase.from("reading_progress").select("*").eq("user_id", currentUserId),
              "carregar progresso"
            )
          : Promise.resolve(emptyResult),
        isCurrentAdmin
          ? runSupabaseQuery(
              () => supabase.from("subscriptions").select("*").order("created_at", { ascending: false }),
              "carregar assinaturas"
            )
          : currentUserId
            ? runSupabaseQuery(
                () => supabase.from("subscriptions").select("*").eq("user_id", currentUserId).order("created_at", { ascending: false }),
                "carregar assinatura atual"
              )
            : Promise.resolve(emptyResult),
        isCurrentAdmin
          ? runSupabaseQuery(
              () => supabase.from("profiles").select("*").order("created_at", { ascending: false }),
              "carregar perfis"
            )
          : currentUserId
            ? runSupabaseQuery(
                () => supabase.from("public_profiles").select("*"),
                "carregar perfis publicos"
              )
            : Promise.resolve({ data: currentProfile ? [currentProfile] : [], error: null }),
        isCurrentAdmin
          ? runSupabaseQuery(
              () => supabase.from("user_emails").select("user_id, email"),
              "carregar emails"
            )
          : Promise.resolve(emptyResult),
        currentUserId
          ? runSupabaseQuery(
              () => supabase
                .from("posts")
                .select("*")
                .not("tag", "like", "entity-thread:%")
                .order("created_at", { ascending: false })
                .limit(100),
              "carregar posts"
            )
          : Promise.resolve(emptyResult),
        currentUserId
          ? runSupabaseQuery(
              () => supabase.from("weekly_releases").select("*, books(*, authors(name))").order("release_date", { ascending: true }),
              "carregar lancamentos"
            )
          : Promise.resolve(emptyResult),
        currentUserId
          ? runSupabaseQuery(
              () => supabase.from("follows").select("follower_id, following_id"),
              "carregar seguidores"
            )
          : Promise.resolve(emptyResult),
        currentUserId
          ? runSupabaseQuery(
              () => supabase.from("saved_posts").select("post_id"),
              "carregar posts salvos"
            )
          : Promise.resolve(emptyResult),
        currentUserId
          ? runSupabaseQuery(
              () => supabase.from("categories").select("*").order("sort_order").order("name"),
              "carregar categorias"
            )
          : Promise.resolve(emptyResult),
        currentUserId
          ? runSupabaseQuery(
              () => supabase.from("book_favorites").select("book_id"),
              "carregar livros favoritos"
            )
          : Promise.resolve(emptyResult),
        currentUserId
          ? runSupabaseQuery(
              () => supabase.from("author_favorites").select("author_id"),
              "carregar autores favoritos"
            )
          : Promise.resolve(emptyResult),
      ]);

      const postIds = postsRes.error ? [] : (postsRes.data || []).map((post) => post.id);
      const [postLikesRes, pollRes] = postIds.length > 0
        ? await Promise.all([
            runSupabaseQuery(
              () => supabase.from("post_likes").select("post_id,user_id").in("post_id", postIds),
              "carregar curtidas dos posts"
            ),
            runSupabaseQuery(
              () => supabase.from("post_polls").select("*, post_poll_options(*)").in("post_id", postIds),
              "carregar enquetes"
            ),
          ])
        : [emptyResult, emptyResult];
      const pollIds = pollRes.error ? [] : (pollRes.data || []).map((poll) => poll.id);
      const pollVotesRes = pollIds.length > 0
        ? await runSupabaseQuery(
            () => supabase.from("post_poll_votes").select("poll_id,option_id,user_id").in("poll_id", pollIds),
            "carregar votos das enquetes"
          )
        : emptyResult;

      const localBookById = new Map((content.books || []).map((book) => [book.id, book]));
      const localBookByTitle = new Map((content.books || []).map((book) => [book.title, book]));
      const localAuthorById = new Map((content.authors || []).map((author) => [author.id, author]));
      const localAuthorByName = new Map((content.authors || []).map((author) => [author.name, author]));
      const coverUrlMap = await createSignedUrlMap(
        LIBRARY_BUCKETS.covers,
        [
          ...(booksRes.data || []).map((book) => book.image_path),
          ...(authorsRes.data || []).map((author) => author.image_path),
        ]
      );
      let normalizedBooks = [];

      if (!booksRes.error) {
        const progressList = progressRes.error ? [] : progressRes.data || [];
        normalizedBooks = booksRes.data.map(b => {
          const userProgress = progressList.find(item => item.book_id === b.id);
          const localBook = localBookById.get(b.id) || localBookByTitle.get(b.title) || {};
          return {
            ...b,
            authorId: b.author_id,
            authorName: b.authors?.name || "",
            author: b.authors?.name || "",
            image: normalizeAssetUrl(
              firstFilled(coverUrlMap.get(b.image_path), b.image, b.image_url, b.cover_url, b.cover, b.thumbnail_url, localBook.image),
              "livros"
            ),
            pdfFile: firstFilled(b.pdf_path, b.pdf_url),
            progress: userProgress?.progress ?? 0,
            currentPage: userProgress?.current_page ?? 1,
            totalPages: userProgress?.total_pages ?? null,
          };
        });
        setBooks(normalizedBooks);
      }
      else setBooks([]);

      if (!authorsRes.error) {
        setAuthors((authorsRes.data || []).map((author) => {
          const localAuthor = localAuthorById.get(author.id) || localAuthorByName.get(author.name) || {};
          return {
            ...author,
            image: normalizeAssetUrl(
              firstFilled(coverUrlMap.get(author.image_path), author.image, author.image_url, author.avatar_url, author.photo_url, localAuthor.image),
              "autores"
            ),
          };
        }));
      }
      else setAuthors([]);

      if (!postsRes.error) {
        const profileList = profilesRes.error ? [] : profilesRes.data || [];
        const bookList = normalizedBooks.length > 0 ? normalizedBooks : [];
        const likes = postLikesRes.error ? [] : postLikesRes.data || [];
        const likesByPost = likes.reduce((acc, like) => {
          (acc[like.post_id] ||= []).push(like);
          return acc;
        }, {});
        const votes = pollVotesRes.error ? [] : pollVotesRes.data || [];
        const votesByPoll = votes.reduce((acc, vote) => {
          (acc[vote.poll_id] ||= []).push(vote);
          return acc;
        }, {});
        const pollsByPost = new Map((pollRes.error ? [] : pollRes.data || []).map((poll) => {
          const pollVotes = votesByPoll[poll.id] || [];
          const options = (poll.post_poll_options || [])
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map((option) => ({
              ...option,
              votes: pollVotes.filter((vote) => vote.option_id === option.id).length,
            }));
          return [poll.post_id, {
            ...poll,
            options,
            totalVotes: pollVotes.length,
            myVote: pollVotes.find((vote) => vote.user_id === currentUserId)?.option_id || null,
          }];
        }));
        const postImageUrlMap = await createSignedUrlMap(
          POST_IMAGE_BUCKET,
          (postsRes.data || []).flatMap((post) => post.image_paths || [])
        );
        setPosts(postsRes.data.map(p => {
          const postProfile = profileList.find(profile => profile.id === p.user_id);
          const postBook = bookList.find(book => book.id === p.book_id);
          const postLikes = likesByPost[p.id] || [];
          return {
            ...p,
            images: [
              ...(p.image_paths || []).map((path) => postImageUrlMap.get(path)).filter(Boolean),
              ...(p.images || (p.image ? [p.image] : [])),
            ],
            author: postProfile?.name || p.author || "Leitor",
            // Handle vem de profiles.username. Antes vinha de email.split("@"),
            // o que publicava a parte local do email de todo mundo no feed.
            handle: handleDoPerfil(postProfile),
            avatar: firstFilled(postProfile?.avatar, postProfile?.avatar_url, p.avatar) || "L",
            authorProfile: postProfile || null,
            verified: Boolean(postProfile?.verified || postProfile?.is_verified || postProfile?.role === "admin"),
            book: postBook ? {
              ...postBook,
              author: postBook.authors?.name || "",
            } : null,
            likedByMe: postLikes.some((like) => like.user_id === currentUserId),
            likes: postLikes.length || p.likes || 0,
            replies: p.replies || 0,
            poll: pollsByPost.get(p.id) || null,
          };
        }));
      }
      else setPosts([]);

      if (!subsRes.error) {
        const list = subsRes.data || [];
        const currentSubscription = pickCurrentSubscription(list, currentUserId);
        setSubscriptions(list);
        setSubscription(currentSubscription);
      } else {
        setSubscriptions([]);
        setSubscription(null);
      }

      if (!profilesRes.error) {
        let list = profilesRes.data || [];
        // So o admin recebe emailsRes preenchido; mescla email por id.
        if (!emailsRes.error && (emailsRes.data || []).length > 0) {
          const emailPorId = new Map((emailsRes.data || []).map((item) => [item.user_id, item.email]));
          list = list.map((item) => ({ ...item, email: emailPorId.get(item.id) || item.email || "" }));
        }
        setProfiles(list);
        setProfile(currentProfile || list.find((item) => item.id === currentUserId) || null);
      } else {
        setProfiles([]);
        setProfile(currentProfile);
      }

      if (!releasesRes.error) setWeeklyReleases(releasesRes.data || []);
      else setWeeklyReleases([]);

      setFollows(followsRes.error ? [] : (followsRes.data || []));

      setSavedPostIds(savedRes.error ? [] : (savedRes.data || []).map((item) => item.post_id));

      setCategories(categoriesRes.error ? [] : (categoriesRes.data || []));
      setBookFavorites(bookFavRes.error ? [] : (bookFavRes.data || []).map((item) => item.book_id));
      setAuthorFavorites(authorFavRes.error ? [] : (authorFavRes.data || []).map((item) => item.author_id));

      if (currentUserId) {
        // head:true => so o total, sem trazer as linhas. Barato o suficiente
        // para rodar junto do carregamento inicial.
        const [reacoesCount, replyCount, pageCommentCount] = await Promise.all([
          runSupabaseQuery(() => supabase.from("reactions").select("id", { count: "exact", head: true }).eq("user_id", currentUserId), "contar reacoes"),
          runSupabaseQuery(() => supabase.from("post_replies").select("id", { count: "exact", head: true }).eq("user_id", currentUserId), "contar respostas"),
          runSupabaseQuery(() => supabase.from("book_page_comments").select("id", { count: "exact", head: true }).eq("user_id", currentUserId), "contar comentarios"),
        ]);
        setMyCounts({
          reactions: reacoesCount.count || 0,
          comments: (replyCount.count || 0) + (pageCommentCount.count || 0),
        });
      } else {
        setMyCounts({ comments: 0, reactions: 0 });
      }

      setLoading(false);
    }

    load();
  }, [
    isSupabase,
    authLoading,
    user?.id,
    user?.app_metadata?.role,
    authProfile,
    isAdmin,
    content.books,
    content.authors,
  ]);

  // AUTHORS CRUD
  const addAuthor = useCallback(async (data) => {
    if (isSupabase) {
      const payload = {
        name: sanitizeSingleLine(data.name, 120),
        theme: sanitizeSingleLine(data.theme, 120),
        era: sanitizeSingleLine(data.era, 80),
        bio: sanitizePlainText(data.bio, 3000),
        image: data.image || null,
        image_path: data.imagePath || null,
      };
      const { data: inserted, error } = await supabase.from("authors").insert(payload).select().single();
      if (error) throw error;
      if (inserted) {
        setAuthors(prev => [...prev, { ...inserted, image: data.previewImage || data.image || "" }]);
        return inserted.id;
      }
      return null;
    }
    const id = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const finalId = authors.find(a => a.id === id) ? `${id}-${Date.now()}` : id;
    const author = { ...data, id: finalId };
    setAuthors(prev => [...prev, author]);
    return finalId;
  }, [isSupabase, authors]);

  const updateAuthor = useCallback(async (id, data) => {
    const previous = authors.find((author) => author.id === id);
    if (isSupabase) {
      const { error } = await supabase.from("authors").update({
        name: sanitizeSingleLine(data.name, 120),
        theme: sanitizeSingleLine(data.theme, 120),
        era: sanitizeSingleLine(data.era, 80),
        bio: sanitizePlainText(data.bio, 3000),
        image: data.image || null,
        image_path: data.imagePath || null,
      }).eq("id", id);
      if (error) throw error;

      if (previous?.image_path && previous.image_path !== data.imagePath) {
        await removeLibraryFile(LIBRARY_BUCKETS.covers, previous.image_path).catch((cleanupError) => {
          console.error("Falha ao remover imagem antiga do autor:", cleanupError);
        });
      }
    }
    setAuthors(prev => prev.map(a => a.id === id ? {
      ...a,
      ...data,
      image: data.previewImage || data.image || "",
      image_path: data.imagePath || null,
    } : a));
  }, [isSupabase, authors]);

  const deleteAuthor = useCallback(async (id) => {
    const author = authors.find((item) => item.id === id);
    if (isSupabase) {
      const { error } = await supabase.from("authors").delete().eq("id", id);
      if (error) throw error;
      if (author?.image_path) {
        await removeLibraryFile(LIBRARY_BUCKETS.covers, author.image_path).catch((cleanupError) => {
          console.error("Falha ao remover imagem do autor:", cleanupError);
        });
      }
    }
    setAuthors(prev => prev.filter(a => a.id !== id));
    setBooks(prev => prev.map(b => b.author_id === id || b.authorId === id ? { ...b, author_id: null, authorId: null, authorName: "" } : b));
  }, [isSupabase, authors]);

  // BOOKS CRUD
  const addBook = useCallback(async (data) => {
    const payload = {
      title: sanitizeSingleLine(data.title, 180),
      image: data.image || null,
      image_path: data.imagePath || null,
      pdf_url: data.pdfFile || null,
      pdf_path: data.pdfPath || null,
      author_id: data.authorId || null,
      category: sanitizeSingleLine(data.category, 80) || null,
    };
    if (isSupabase) {
      const { data: inserted, error } = await supabase.from("books").insert(payload).select("*, authors(name)").single();
      if (error) throw error;
      if (!error && inserted) {
        setBooks(prev => [{
          ...inserted,
          image: data.previewImage || data.image || "",
          authorId: inserted.author_id,
          authorName: inserted.authors?.name || "",
          author: inserted.authors?.name || "",
          pdfFile: inserted.pdf_path || inserted.pdf_url,
        }, ...prev]);
        return inserted.id;
      }
      return null;
    }
    const id = data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const finalId = books.find(b => b.id === id) ? `${id}-${Date.now()}` : id;
    const authorObj = authors.find(a => a.id === data.authorId);
    setBooks(prev => [{ ...data, id: finalId, authorName: authorObj?.name || "", pdfFile: data.pdfFile }, ...prev]);
    return finalId;
  }, [isSupabase, books, authors]);

  const updateBook = useCallback(async (id, data) => {
    const previous = books.find((book) => book.id === id);
    if (isSupabase) {
      const { error } = await supabase.from("books").update({
        title: sanitizeSingleLine(data.title, 180),
        image: data.image || null,
        image_path: data.imagePath || null,
        pdf_url: data.pdfFile || null,
        pdf_path: data.pdfPath || null,
        author_id: data.authorId || null,
        category: sanitizeSingleLine(data.category, 80) || null,
      }).eq("id", id);
      if (error) throw error;

      await Promise.allSettled([
        previous?.image_path && previous.image_path !== data.imagePath
          ? removeLibraryFile(LIBRARY_BUCKETS.covers, previous.image_path)
          : Promise.resolve(),
        previous?.pdf_path && previous.pdf_path !== data.pdfPath
          ? removeLibraryFile(LIBRARY_BUCKETS.pdfs, previous.pdf_path)
          : Promise.resolve(),
      ]);
    }
    setBooks(prev => prev.map(b => b.id === id ? {
      ...b,
      ...data,
      image: data.previewImage || data.image || "",
      author_id: data.authorId || null,
      image_path: data.imagePath || null,
      pdf_path: data.pdfPath || null,
      pdf_url: data.pdfFile || null,
      pdfFile: data.pdfPath || data.pdfFile || "",
    } : b));
  }, [isSupabase, books]);

  const deleteBook = useCallback(async (id) => {
    const book = books.find((item) => item.id === id);
    if (isSupabase) {
      const { error } = await supabase.from("books").delete().eq("id", id);
      if (error) throw error;
      await Promise.allSettled([
        book?.image_path ? removeLibraryFile(LIBRARY_BUCKETS.covers, book.image_path) : Promise.resolve(),
        book?.pdf_path ? removeLibraryFile(LIBRARY_BUCKETS.pdfs, book.pdf_path) : Promise.resolve(),
      ]);
    }
    setBooks(prev => prev.filter(b => b.id !== id));
  }, [isSupabase, books]);

  const markBookCompleted = useCallback(async (bookId) => {
    if (!bookId) return;

    if (isSupabase) {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (userId) {
        const { error } = await supabase
          .from("reading_progress")
          .upsert({
            user_id: userId,
            book_id: bookId,
            progress: 100,
            current_page: books.find(book => book.id === bookId)?.totalPages || books.find(book => book.id === bookId)?.currentPage || 1,
            total_pages: books.find(book => book.id === bookId)?.totalPages || null,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,book_id" });

        if (error) throw error;
      }
    }

    setBooks(prev => prev.map(book => book.id === bookId ? { ...book, progress: 100 } : book));
  }, [isSupabase, books]);

  const updateReadingProgress = useCallback(async (bookId, { currentPage = 1, totalPages = null }) => {
    if (!bookId) return;

    const safeTotal = Number(totalPages || 0);
    const safePage = Math.max(1, Number(currentPage || 1));
    const progress = safeTotal > 0 ? Math.min(100, Math.max(0, Math.round((safePage / safeTotal) * 100))) : 0;

    if (isSupabase) {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (userId) {
        const { error } = await supabase
          .from("reading_progress")
          .upsert({
            user_id: userId,
            book_id: bookId,
            current_page: safePage,
            total_pages: safeTotal || null,
            progress,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,book_id" });

        if (error) throw error;
      }
    }

    setBooks(prev => prev.map(book => book.id === bookId ? {
      ...book,
      currentPage: safePage,
      totalPages: safeTotal || book.totalPages || null,
      progress,
    } : book));
  }, [isSupabase]);

  // POSTS CRUD
  const addPost = useCallback(async (post) => {
    if (!post.userId) {
      throw new Error("Você precisa estar logado para publicar.");
    }

    if (isSupabase) {
      const { data: inserted, error } = await supabase.from("posts").insert({
        user_id: post.userId,
        text: sanitizePlainText(post.text, 5000),
        tag: sanitizeSingleLine(post.tag, 80) || null,
        book_id: post.bookId,
        images: post.images || [],
        image_paths: post.imagePaths || [],
      }).select("*").single();
      if (error) throw error;
      let poll = null;
      if (inserted && post.poll?.question && post.poll?.options?.length >= 2) {
        const { data: insertedPoll, error: pollError } = await supabase
          .from("post_polls")
          .insert({ post_id: inserted.id, question: sanitizeSingleLine(post.poll.question, 240) })
          .select("*")
          .single();
        if (pollError) {
          await supabase.from("posts").delete().eq("id", inserted.id);
          throw pollError;
        }

        const { data: insertedOptions, error: optionsError } = await supabase
          .from("post_poll_options")
          .insert(post.poll.options.map((label, index) => ({
            poll_id: insertedPoll.id,
            label: sanitizeSingleLine(label, 120),
            sort_order: index,
          })))
          .select("*");
        if (optionsError) {
          await supabase.from("posts").delete().eq("id", inserted.id);
          throw optionsError;
        }

        poll = {
          ...insertedPoll,
          options: (insertedOptions || []).map((option) => ({ ...option, votes: 0 })),
          totalVotes: 0,
          myVote: null,
        };
      }
      if (inserted) {
        const imageUrlMap = await createSignedUrlMap(POST_IMAGE_BUCKET, inserted.image_paths || []);
        setPosts(prev => [{
          ...inserted,
          images: [
            ...(inserted.image_paths || []).map((path) => imageUrlMap.get(path)).filter(Boolean),
            ...(inserted.images || []),
          ],
          author: post.author || "Você",
          avatar: post.avatar || "V",
          authorProfile: authProfile || null,
          verified: Boolean(authProfile?.verified || authProfile?.is_verified || authProfile?.role === "admin"),
          replies: 0,
          likes: 0,
          likedByMe: false,
          poll,
        }, ...prev]);
      }
      return;
    }
    throw new Error("Supabase não configurado: post não foi salvo.");
  }, [isSupabase, authProfile]);

  const deletePost = useCallback(async (id) => {
    if (isSupabase) {
      const { error } = await supabase.from("posts").delete().eq("id", id);
      if (error) throw error;
    }
    setPosts(prev => prev.filter(p => p.id !== id));
  }, [isSupabase]);

  // SUBSCRIPTIONS
  const cancelSubscription = useCallback(async (id) => {
    if (isSupabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error("Sua sessao expirou. Entre novamente para cancelar.");
      }

      const res = await fetch("/api/cancel-subscription", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subscriptionId: id }),
      });
      const body = await res.json();

      if (!body.success) {
        throw new Error(body.error || "Erro ao cancelar assinatura.");
      }

      const updated = body.data;
      setSubscriptions((prev) => prev.map((sub) => sub.id === updated.id ? updated : sub));
      setSubscription((prev) => prev?.id === updated.id ? updated : prev);
      return updated;
    }
    setSubscription(prev => prev && prev.id === id ? { ...prev, status: "canceled" } : prev);
  }, [isSupabase]);

  const upsertUserSubscription = useCallback(async ({ userId, email, plan = "ope_club_monthly", status = "active", durationDays = 30 }) => {
    if (!isSupabase || !userId) return null;
    if (status !== "active") throw new Error("O painel manual somente concede acesso ativo.");
    const data = await authenticatedApiPost("/api/admin-subscription", {
      action: "grant",
      userId,
      email,
      plan: plan === "ope_club_annual" ? "annual" : "monthly",
      durationDays: Number(durationDays),
    });

    const currentUserId = user?.id;

    setSubscriptions((prev) => {
      const others = prev.filter((sub) => sub.id !== data.id);
      return [data, ...others];
    });
    setSubscription((prev) => userId === currentUserId || prev?.user_id === userId ? data : prev);
    return data;
  }, [isSupabase, user?.id]);

  const updateUserSubscriptionDuration = useCallback(async ({ userId, durationDays = 30 }) => {
    if (!isSupabase || !userId) return null;
    const data = await authenticatedApiPost("/api/admin-subscription", {
      action: "set_duration",
      userId,
      durationDays: Number(durationDays),
    });

    setSubscriptions((prev) => prev.map((sub) => sub.id === data.id ? data : sub));
    setSubscription((prev) => prev?.id === data.id ? data : prev);
    return data;
  }, [isSupabase]);

  const changeSubscriptionPlan = useCallback(async (id, plan) => {
    if (!isSupabase || !id) return null;
    const data = await authenticatedApiPost("/api/subscription-action", {
      action: "change_plan",
      subscriptionId: id,
      plan,
    });
    setSubscriptions((prev) => prev.map((sub) => sub.id === data.id ? data : sub));
    setSubscription((prev) => prev?.id === data.id ? data : prev);
    return data;
  }, [isSupabase]);

  const syncSubscription = useCallback(async (id) => {
    if (!isSupabase || !id) return null;
    const data = await authenticatedApiPost("/api/subscription-action", {
      action: "sync",
      subscriptionId: id,
    });
    setSubscriptions((prev) => prev.map((sub) => sub.id === data.id ? data : sub));
    setSubscription((prev) => prev?.id === data.id ? data : prev);
    return data;
  }, [isSupabase]);

  const addWeeklyRelease = useCallback(async ({ bookId, releaseDate, note, visible = true }) => {
    if (!isSupabase) return null;
    const { data, error } = await supabase
      .from("weekly_releases")
      .insert({
        book_id: bookId,
        release_date: releaseDate,
        note: sanitizePlainText(note, 1000),
        visible,
      })
      .select("*, books(*, authors(name))")
      .single();

    if (error) throw error;
    setWeeklyReleases((prev) => [...prev, data].sort((a, b) => new Date(a.release_date) - new Date(b.release_date)));
    return data;
  }, [isSupabase]);

  const toggleWeeklyReleaseVisibility = useCallback(async (id, visible) => {
    if (!isSupabase || !id) return;
    setWeeklyReleases((prev) => prev.map((item) => item.id === id ? { ...item, visible } : item));
    const { error } = await supabase.from("weekly_releases").update({ visible }).eq("id", id);
    if (error) {
      setWeeklyReleases((prev) => prev.map((item) => item.id === id ? { ...item, visible: !visible } : item));
      throw error;
    }
  }, [isSupabase]);

  // CATEGORIES CRUD — categorias dinamimicas gerenciadas pelo admin.
  const addCategory = useCallback(async (name) => {
    const cleanName = sanitizeSingleLine(name, 80);
    if (!cleanName) return null;
    if (isSupabase) {
      const { data, error } = await supabase.from("categories").insert({ name: cleanName }).select().single();
      if (error) throw error;
      if (data) { setCategories(prev => [...prev, data].sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name))); return data; }
      return null;
    }
    const cat = { id: `cat-${Date.now()}`, name: cleanName, sort_order: 0 };
    setCategories(prev => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)));
    return cat;
  }, [isSupabase]);

  const updateCategory = useCallback(async (id, data) => {
    const payload = {
      name: sanitizeSingleLine(data?.name, 80),
      updated_at: new Date().toISOString(),
    };
    if (!payload.name) throw new Error("Digite o nome da categoria.");
    if (isSupabase) {
      const { data: updated, error } = await supabase.from("categories").update(payload).eq("id", id).select().single();
      if (error) throw error;
      setCategories(prev => prev.map(c => c.id === id ? updated : c));
    } else {
      setCategories(prev => prev.map(c => c.id === id ? { ...c, ...payload } : c));
    }
  }, [isSupabase]);

  const deleteCategory = useCallback(async (id) => {
    if (isSupabase) {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    }
    setCategories(prev => prev.filter(c => c.id !== id));
  }, [isSupabase]);

  // FAVORITOS — livros e autores. Estado otimista, rollback em erro.
  const favoriteBook = useCallback(async (bookId) => {
    const currentUserId = user?.id;
    if (!isSupabase || !currentUserId || !bookId) return;
    const jaFav = bookFavorites.includes(bookId);
    setBookFavorites((prev) => jaFav ? prev : [...prev, bookId]);
    const { error } = await supabase.from("book_favorites").insert({ user_id: currentUserId, book_id: bookId });
    if (error && error.code !== "23505") {
      setBookFavorites((prev) => prev.filter((b) => b !== bookId));
      throw error;
    }
  }, [isSupabase, user?.id, bookFavorites]);

  const unfavoriteBook = useCallback(async (bookId) => {
    const currentUserId = user?.id;
    if (!isSupabase || !currentUserId || !bookId) return;
    setBookFavorites((prev) => prev.filter((b) => b !== bookId));
    const { error } = await supabase.from("book_favorites").delete().eq("user_id", currentUserId).eq("book_id", bookId);
    if (error) {
      setBookFavorites((prev) => prev.includes(bookId) ? prev : [...prev, bookId]);
      throw error;
    }
  }, [isSupabase, user?.id]);

  const toggleFavoriteBook = useCallback(async (bookId) => {
    if (bookFavorites.includes(bookId)) return unfavoriteBook(bookId);
    return favoriteBook(bookId);
  }, [bookFavorites, favoriteBook, unfavoriteBook]);

  const isFavoriteBook = useCallback((bookId) => bookFavorites.includes(bookId), [bookFavorites]);

  const favoriteAuthor = useCallback(async (authorId) => {
    const currentUserId = user?.id;
    if (!isSupabase || !currentUserId || !authorId) return;
    const jaFav = authorFavorites.includes(authorId);
    setAuthorFavorites((prev) => jaFav ? prev : [...prev, authorId]);
    const { error } = await supabase.from("author_favorites").insert({ user_id: currentUserId, author_id: authorId });
    if (error && error.code !== "23505") {
      setAuthorFavorites((prev) => prev.filter((a) => a !== authorId));
      throw error;
    }
  }, [isSupabase, user?.id, authorFavorites]);

  const unfavoriteAuthor = useCallback(async (authorId) => {
    const currentUserId = user?.id;
    if (!isSupabase || !currentUserId || !authorId) return;
    setAuthorFavorites((prev) => prev.filter((a) => a !== authorId));
    const { error } = await supabase.from("author_favorites").delete().eq("user_id", currentUserId).eq("author_id", authorId);
    if (error) {
      setAuthorFavorites((prev) => prev.includes(authorId) ? prev : [...prev, authorId]);
      throw error;
    }
  }, [isSupabase, user?.id]);

  const toggleFavoriteAuthor = useCallback(async (authorId) => {
    if (authorFavorites.includes(authorId)) return unfavoriteAuthor(authorId);
    return favoriteAuthor(authorId);
  }, [authorFavorites, favoriteAuthor, unfavoriteAuthor]);

  const isFavoriteAuthor = useCallback((authorId) => authorFavorites.includes(authorId), [authorFavorites]);

  const deleteWeeklyRelease = useCallback(async (id) => {
    if (!isSupabase || !id) return;
    const { error } = await supabase.from("weekly_releases").delete().eq("id", id);
    if (error) throw error;
    setWeeklyReleases((prev) => prev.filter((item) => item.id !== id));
  }, [isSupabase]);

  const removeUserSubscription = useCallback(async (userId) => {
    if (!isSupabase || !userId) return;
    const existing = pickCurrentSubscription(subscriptions, userId);
    if (!existing) return;
    return cancelSubscription(existing.id);
  }, [cancelSubscription, isSupabase, subscriptions]);

  const updateProfilePreferences = useCallback(async (userId, preferences) => {
    if (!isSupabase || !userId) return null;

    const payload = { updated_at: new Date().toISOString() };
    for (const key of ["private_profile", "reading_activity", "show_online_status"]) {
      if (typeof preferences?.[key] === "boolean") payload[key] = preferences[key];
    }
    if (typeof preferences?.email === "string") {
      payload.email = normalizeEmail(preferences.email);
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;

    setProfile(data);
    setProfiles((prev) => prev.map((item) => item.id === userId ? { ...item, ...data } : item));
    return data;
  }, [isSupabase]);

  // SOCIAL — seguir / salvar
  // `follows` e a fonte unica: quem eu sigo e quantos seguidores cada perfil
  // tem saem dele, entao o otimismo do clique nao pode dessincronizar nada.
  const following = useMemo(
    () => follows.filter((item) => item.follower_id === user?.id).map((item) => item.following_id),
    [follows, user?.id]
  );

  const followerCounts = useMemo(
    () => follows.reduce((acc, item) => {
      acc[item.following_id] = (acc[item.following_id] || 0) + 1;
      return acc;
    }, {}),
    [follows]
  );

  const followingCounts = useMemo(
    () => follows.reduce((acc, item) => {
      acc[item.follower_id] = (acc[item.follower_id] || 0) + 1;
      return acc;
    }, {}),
    [follows]
  );

  const followUser = useCallback(async (targetId) => {
    const currentUserId = user?.id;
    if (!isSupabase || !currentUserId || !targetId || targetId === currentUserId) return;

    const novo = { follower_id: currentUserId, following_id: targetId };
    setFollows((prev) =>
      prev.some((item) => item.follower_id === currentUserId && item.following_id === targetId)
        ? prev
        : [...prev, novo]
    );

    const { error } = await supabase.from("follows").insert(novo);

    // 23505 = ja seguia (clique duplo / outra aba): o estado otimista ja bate.
    if (error && error.code !== "23505") {
      setFollows((prev) => prev.filter((item) => !(item.follower_id === currentUserId && item.following_id === targetId)));
      throw error;
    }
  }, [isSupabase, user?.id]);

  const unfollowUser = useCallback(async (targetId) => {
    const currentUserId = user?.id;
    if (!isSupabase || !currentUserId || !targetId) return;

    const anterior = follows;
    setFollows((prev) => prev.filter((item) => !(item.follower_id === currentUserId && item.following_id === targetId)));

    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", currentUserId)
      .eq("following_id", targetId);

    if (error) {
      setFollows(anterior);
      throw error;
    }
  }, [isSupabase, user?.id, follows]);

  const isFollowing = useCallback((targetId) => following.includes(targetId), [following]);

  const toggleSavedPost = useCallback(async (postId) => {
    const currentUserId = user?.id;
    if (!isSupabase || !currentUserId || !postId) return;

    const jaSalvo = savedPostIds.includes(postId);
    setSavedPostIds((prev) => jaSalvo ? prev.filter((id) => id !== postId) : [...prev, postId]);

    const { error } = jaSalvo
      ? await supabase.from("saved_posts").delete().eq("user_id", currentUserId).eq("post_id", postId)
      : await supabase.from("saved_posts").insert({ user_id: currentUserId, post_id: postId });

    if (error && error.code !== "23505") {
      setSavedPostIds((prev) => jaSalvo ? [...prev, postId] : prev.filter((id) => id !== postId));
      throw error;
    }
  }, [isSupabase, user?.id, savedPostIds]);

  // HELPERS
  const getBooksByAuthor = useCallback((authorId) => {
    return books.filter(b => (b.author_id || b.authorId) === authorId);
  }, [books]);

  const getAuthorById = useCallback((id) => {
    return authors.find(a => a.id === id) || null;
  }, [authors]);

  const getBookById = useCallback((id) => {
    return books.find(b => b.id === id) || null;
  }, [books]);

  // Espelho do public.is_book_released() — o banco e quem realmente barra a
  // URL assinada; aqui e so para a tela nao oferecer o que vai falhar.
  const getReleaseStatus = useCallback(
    (bookId) => releaseStatus(bookId, weeklyReleases),
    [weeklyReleases]
  );

  const isBookReleased = useCallback(
    (bookId) => releaseStatus(bookId, weeklyReleases).liberado,
    [weeklyReleases]
  );

  // Metricas cruas para o sistema de conquistas. Livros lidos/concluidos,
  // comentarios e reacoes so existem para o usuario logado (o progresso e as
  // contagens sao dele); para outros perfis, valem posts/seguidores/seguindo.
  const getUserMetrics = useCallback((userId) => {
    const ehUsuarioAtual = userId === user?.id;
    return {
      posts: posts.filter((p) => p.user_id === userId).length,
      followers: followerCounts[userId] || 0,
      followingCount: followingCounts[userId] || 0,
      completed: ehUsuarioAtual ? books.filter((b) => Number(b.progress || 0) >= 100).length : 0,
      reading: ehUsuarioAtual ? books.filter((b) => Number(b.progress || 0) > 0).length : 0,
      comments: ehUsuarioAtual ? myCounts.comments : 0,
      reactions: ehUsuarioAtual ? myCounts.reactions : 0,
      saved: ehUsuarioAtual ? savedPostIds.length : 0,
    };
  }, [user?.id, posts, followerCounts, followingCounts, books, myCounts, savedPostIds]);

  return (
    <DataContext.Provider value={{
      books, authors, posts, subscription, subscriptions, profiles, profile, weeklyReleases, loading,
      follows, following, followerCounts, followingCounts, savedPostIds,
      categories, bookFavorites, authorFavorites,
      followUser, unfollowUser, isFollowing, toggleSavedPost,
      toggleFavoriteBook, isFavoriteBook,
      toggleFavoriteAuthor, isFavoriteAuthor,
      isBookReleased, getReleaseStatus, getUserMetrics,
      addBook, updateBook, deleteBook, markBookCompleted, updateReadingProgress,
      addAuthor, updateAuthor, deleteAuthor,
      addPost, deletePost,
      cancelSubscription, changeSubscriptionPlan, syncSubscription,
      upsertUserSubscription, updateUserSubscriptionDuration, removeUserSubscription,
      addWeeklyRelease, deleteWeeklyRelease, toggleWeeklyReleaseVisibility,
      addCategory, updateCategory, deleteCategory,
      updateProfilePreferences,
      getBooksByAuthor, getAuthorById, getBookById,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
