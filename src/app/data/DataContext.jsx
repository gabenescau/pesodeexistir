import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { supabase, isSupabaseReady } from "./supabase";
import { loadContent } from "./contentLoader";
import { pickCurrentSubscription } from "@/lib/subscription";
import { runSupabaseQuery } from "@/lib/supabase-query";
import { releaseStatus } from "@/lib/releases";
import { handleDoPerfil } from "@/lib/mentions";
import { useAuth } from "./AuthContext";

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const content = loadContent();
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

      const booksRes = await runSupabaseQuery(
        () => supabase.from("books").select("*, authors(name)").order("created_at", { ascending: false }),
        "carregar livros"
      );
      const authorsRes = await runSupabaseQuery(
        () => supabase.from("authors").select("*").order("name"),
        "carregar autores"
      );
      const progressRes = currentUserId
        ? await runSupabaseQuery(
            () => supabase.from("reading_progress").select("*").eq("user_id", currentUserId),
            "carregar progresso"
          )
        : { data: [], error: null };
      const subsRes = isCurrentAdmin
        ? await runSupabaseQuery(
            () => supabase.from("subscriptions").select("*").order("created_at", { ascending: false }),
            "carregar assinaturas"
          )
        : currentUserId
          ? await runSupabaseQuery(
              () => supabase.from("subscriptions").select("*").eq("user_id", currentUserId).order("created_at", { ascending: false }),
              "carregar assinatura atual"
            )
          : { data: [], error: null };
      // Admin le a tabela inteira (role, gestao de assinaturas). O email agora
      // mora em user_emails (fora de profiles), so visivel para admin — e
      // buscado em separado e mesclado abaixo. Usuario comum le a view
      // public_profiles: id/nome/@/avatar/bio de quem nao e privado, o
      // suficiente para o feed sem vazar email de ninguem.
      const profilesRes = isCurrentAdmin
        ? await runSupabaseQuery(
            () => supabase.from("profiles").select("*").order("created_at", { ascending: false }),
            "carregar perfis"
          )
        : currentUserId
          ? await runSupabaseQuery(
              () => supabase.from("public_profiles").select("*"),
              "carregar perfis publicos"
            )
          : { data: currentProfile ? [currentProfile] : [], error: null };
      const emailsRes = isCurrentAdmin
        ? await runSupabaseQuery(
            () => supabase.from("user_emails").select("user_id, email"),
            "carregar emails"
          )
        : { data: [], error: null };
      const postsRes = currentUserId
        ? await runSupabaseQuery(
            () => supabase.from("posts").select("*").order("created_at", { ascending: false }),
            "carregar posts"
          )
        : { data: [], error: null };
      const releasesRes = currentUserId
        ? await runSupabaseQuery(
            () => supabase.from("weekly_releases").select("*, books(*, authors(name))").order("release_date", { ascending: true }),
            "carregar lancamentos"
          )
        : { data: [], error: null };
      const followsRes = currentUserId
        ? await runSupabaseQuery(
            () => supabase.from("follows").select("follower_id, following_id"),
            "carregar seguidores"
          )
        : { data: [], error: null };
      const savedRes = currentUserId
        ? await runSupabaseQuery(
            () => supabase.from("saved_posts").select("post_id"),
            "carregar posts salvos"
          )
        : { data: [], error: null };

      if (!booksRes.error) {
        const progressList = progressRes.error ? [] : progressRes.data || [];
        setBooks(booksRes.data.map(b => {
          const userProgress = progressList.find(item => item.book_id === b.id);
          return {
            ...b,
            authorId: b.author_id,
            authorName: b.authors?.name || "",
            author: b.authors?.name || "",
            pdfFile: b.pdf_url,
            progress: userProgress?.progress ?? 0,
            currentPage: userProgress?.current_page ?? 1,
            totalPages: userProgress?.total_pages ?? null,
          };
        }));
      }
      else setBooks([]);

      if (!authorsRes.error) setAuthors(authorsRes.data);
      else setAuthors([]);

      if (!postsRes.error) {
        const profileList = profilesRes.error ? [] : profilesRes.data || [];
        const bookList = booksRes.error ? [] : booksRes.data || [];
        setPosts(postsRes.data.map(p => {
          const postProfile = profileList.find(profile => profile.id === p.user_id);
          const postBook = bookList.find(book => book.id === p.book_id);
          return {
            ...p,
            images: p.images || (p.image ? [p.image] : []),
            author: postProfile?.name || p.author || "Leitor",
            // Handle vem de profiles.username. Antes vinha de email.split("@"),
            // o que publicava a parte local do email de todo mundo no feed.
            handle: handleDoPerfil(postProfile),
            avatar: postProfile?.avatar || p.avatar || "L",
            book: postBook ? {
              ...postBook,
              author: postBook.authors?.name || "",
            } : null,
            likes: p.likes || 0,
            replies: p.replies || 0,
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
  }, [isSupabase, authLoading, user?.id, authProfile?.id, authProfile?.role, isAdmin]);

  // AUTHORS CRUD
  const addAuthor = useCallback(async (data) => {
    if (isSupabase) {
      const { data: inserted, error } = await supabase.from("authors").insert(data).select().single();
      if (error) throw error;
      if (inserted) { setAuthors(prev => [...prev, inserted]); return inserted.id; }
      return null;
    }
    const id = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const finalId = authors.find(a => a.id === id) ? `${id}-${Date.now()}` : id;
    const author = { ...data, id: finalId };
    setAuthors(prev => [...prev, author]);
    return finalId;
  }, [isSupabase, authors]);

  const updateAuthor = useCallback(async (id, data) => {
    if (isSupabase) {
      const { error } = await supabase.from("authors").update(data).eq("id", id);
      if (error) throw error;
    }
    setAuthors(prev => prev.map(a => a.id === id ? { ...a, ...data } : a));
  }, [isSupabase]);

  const deleteAuthor = useCallback(async (id) => {
    if (isSupabase) {
      const { error } = await supabase.from("authors").delete().eq("id", id);
      if (error) throw error;
    }
    setAuthors(prev => prev.filter(a => a.id !== id));
    setBooks(prev => prev.map(b => b.author_id === id || b.authorId === id ? { ...b, author_id: null, authorId: null, authorName: "" } : b));
  }, [isSupabase]);

  // BOOKS CRUD
  const addBook = useCallback(async (data) => {
    const payload = { title: data.title, image: data.image, pdf_url: data.pdfFile, author_id: data.authorId, category: data.category || null };
    if (isSupabase) {
      const { data: inserted, error } = await supabase.from("books").insert(payload).select("*, authors(name)").single();
      if (error) throw error;
      if (!error && inserted) {
        setBooks(prev => [{ ...inserted, authorId: inserted.author_id, authorName: inserted.authors?.name || "", author: inserted.authors?.name || "", pdfFile: inserted.pdf_url }, ...prev]);
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
    if (isSupabase) {
      const { error } = await supabase.from("books").update({
        title: data.title,
        image: data.image,
        pdf_url: data.pdfFile,
        author_id: data.authorId,
        category: data.category || null,
      }).eq("id", id);
      if (error) throw error;
    }
    setBooks(prev => prev.map(b => b.id === id ? { ...b, ...data, author_id: data.authorId, pdf_url: data.pdfFile } : b));
  }, [isSupabase]);

  const deleteBook = useCallback(async (id) => {
    if (isSupabase) {
      const { error } = await supabase.from("books").delete().eq("id", id);
      if (error) throw error;
    }
    setBooks(prev => prev.filter(b => b.id !== id));
  }, [isSupabase]);

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
        text: post.text,
        tag: post.tag,
        book_id: post.bookId,
        images: post.images || [],
      }).select("*").single();
      if (error) throw error;
      if (inserted) {
        setPosts(prev => [{
          ...inserted,
          images: inserted.images || [],
          author: post.author || "Você",
          avatar: post.avatar || "V",
          replies: 0,
          likes: 0,
        }, ...prev]);
      }
      return;
    }
    throw new Error("Supabase não configurado: post não foi salvo.");
  }, [isSupabase]);

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
      const { error } = await supabase.from("subscriptions").update({ status: "canceled" }).eq("id", id);
      if (error) { console.error("Erro ao cancelar assinatura:", error.message); return; }
    }
    setSubscription(prev => prev && prev.id === id ? { ...prev, status: "canceled" } : prev);
  }, [isSupabase]);

  const upsertUserSubscription = useCallback(async ({ userId, email, plan = "ope_club_monthly", status = "active", durationDays = 30 }) => {
    if (!isSupabase || !userId) return null;

    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + Number(durationDays || 30));

    const payload = {
      user_id: userId,
      customer_email: email || "",
      plan,
      status,
      current_period_start: now.toISOString(),
      current_period_end: end.toISOString(),
      provider: "manual_admin",
      metadata: { source: "admin_panel", duration_days: Number(durationDays || 30) },
      updated_at: now.toISOString(),
    };

    const existing = pickCurrentSubscription(subscriptions, userId);
    const query = existing
      ? supabase.from("subscriptions").update(payload).eq("id", existing.id).select().single()
      : supabase.from("subscriptions").insert(payload).select().single();

    const { data, error } = await query;
    if (error) {
      console.error("Erro ao salvar assinatura:", error.message);
      return null;
    }

    const currentUserId = user?.id;

    setSubscriptions((prev) => {
      const others = prev.filter((sub) => sub.id !== data.id);
      return [data, ...others];
    });
    setSubscription((prev) => userId === currentUserId || prev?.user_id === userId ? data : prev);
    return data;
  }, [isSupabase, subscriptions, user?.id]);

  const updateUserSubscriptionDuration = useCallback(async ({ userId, durationDays = 30 }) => {
    if (!isSupabase || !userId) return null;

    const existing = pickCurrentSubscription(subscriptions, userId);
    if (!existing) return null;

    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + Number(durationDays || 30));

    const payload = {
      current_period_start: existing.current_period_start || now.toISOString(),
      current_period_end: end.toISOString(),
      metadata: {
        ...(existing.metadata || {}),
        source: existing.provider || "manual_admin",
        duration_days: Number(durationDays || 30),
      },
      updated_at: now.toISOString(),
    };

    const { data, error } = await supabase
      .from("subscriptions")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();

    if (error) throw error;

    setSubscriptions((prev) => prev.map((sub) => sub.id === data.id ? data : sub));
    setSubscription((prev) => prev?.id === data.id ? data : prev);
    return data;
  }, [isSupabase, subscriptions]);

  const addWeeklyRelease = useCallback(async ({ bookId, releaseDate, note }) => {
    if (!isSupabase) return null;
    const { data, error } = await supabase
      .from("weekly_releases")
      .insert({
        book_id: bookId,
        release_date: releaseDate,
        note: note || "",
      })
      .select("*, books(*, authors(name))")
      .single();

    if (error) throw error;
    setWeeklyReleases((prev) => [...prev, data].sort((a, b) => new Date(a.release_date) - new Date(b.release_date)));
    return data;
  }, [isSupabase]);

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

    const { error } = await supabase
      .from("subscriptions")
      .update({
        status: "canceled",
        canceled_at: new Date().toISOString(),
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) {
      console.error("Erro ao remover plano:", error.message);
      return;
    }

    setSubscriptions((prev) => prev.map((sub) => sub.id === existing.id ? { ...sub, status: "canceled" } : sub));
    setSubscription((prev) => prev?.id === existing.id ? { ...prev, status: "canceled" } : prev);
  }, [isSupabase, subscriptions]);

  const updateProfilePreferences = useCallback(async (userId, preferences) => {
    if (!isSupabase || !userId) return null;

    const payload = {
      ...preferences,
      updated_at: new Date().toISOString(),
    };

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
      followUser, unfollowUser, isFollowing, toggleSavedPost,
      isBookReleased, getReleaseStatus, getUserMetrics,
      addBook, updateBook, deleteBook, markBookCompleted, updateReadingProgress,
      addAuthor, updateAuthor, deleteAuthor,
      addPost, deletePost,
      cancelSubscription,
      upsertUserSubscription, updateUserSubscriptionDuration, removeUserSubscription,
      addWeeklyRelease, deleteWeeklyRelease,
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
