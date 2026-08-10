import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { supabase, isSupabaseReady } from "./supabase";
import { loadContent } from "./contentLoader";
import { pickCurrentSubscription } from "@/lib/subscription";
import { runSupabaseQuery, runSupabaseQueryAll } from "@/lib/supabase-query";
import { releaseStatus } from "@/lib/releases";
import { createSignedUrlMap, LIBRARY_BUCKETS, removeLibraryFile } from "@/lib/library-media";
import { useAuth } from "./AuthContext";
import { POST_IMAGE_BUCKET } from "@/lib/social";
import { sanitizePlainText, sanitizeSingleLine } from "@/lib/sanitize";
import { authenticatedApiPost } from "@/lib/authenticated-api";
import {
  AUTHOR_SELECT,
  BOOK_SELECT,
  WEEKLY_RELEASE_SELECT,
  normalizeAuthors,
  normalizeBooks,
} from "./domains/catalog";
import { POST_SELECT, buildPostViewModels } from "./domains/community";

const DataContext = createContext(null);

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
  const [bookRatingStats, setBookRatingStats] = useState({});
  const [myBookRatings, setMyBookRatings] = useState([]);
  // Colecoes publicas (visiveis para todos) + as do proprio usuario. RLS faz o
  // filtro no servidor; aqui e so cache em memoria + CRUD otimista.
  const [collections, setCollections] = useState([]);
  const [collectionItems, setCollectionItems] = useState([]);
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
      setCollections([]);
      setCollectionItems([]);
      setMyCounts({ comments: 0, reactions: 0 });
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      try {
        const currentUserId = user?.id;
        const currentProfileRes = currentUserId && !authProfile
          ? await runSupabaseQuery(
              () => supabase.from("profiles").select("id,name,avatar,avatar_url,username,bio,theme,role,private_profile,reading_activity,show_online_status,xp,credits,referral_code,created_at,updated_at").eq("id", currentUserId).maybeSingle(),
              "carregar perfil atual"
            )
          : { data: authProfile || null, error: null };
        const currentProfile = currentProfileRes.error ? null : currentProfileRes.data;
        const isCurrentAdmin = isAdmin || currentProfile?.role === "admin";
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
        ratingsRes,
        myRatingsRes,
      ] = await Promise.all([
        runSupabaseQueryAll(
          () => supabase.from("books").select(BOOK_SELECT).order("created_at", { ascending: false }),
          "carregar livros",
          { maxRows: 2000, maxPages: 8 }
        ),
        runSupabaseQueryAll(
          () => supabase.from("authors").select(AUTHOR_SELECT).order("name"),
          "carregar autores",
          { maxRows: 1000, maxPages: 4 }
        ),
        currentUserId
          ? runSupabaseQuery(
              () => supabase.from("reading_progress").select("book_id,progress,current_page,total_pages,updated_at").eq("user_id", currentUserId).limit(5000),
              "carregar progresso"
            )
          : Promise.resolve(emptyResult),
        isCurrentAdmin
          ? runSupabaseQuery(
              () => supabase.from("subscriptions").select("id,user_id,plan,status,provider,provider_product_id,provider_subscription_id,provider_customer_id,provider_order_id,customer_email,current_period_start,current_period_end,cancel_at_period_end,canceled_at,last_payment_at,metadata,created_at,updated_at").order("created_at", { ascending: false }).limit(1000),
              "carregar assinaturas"
            )
          : currentUserId
            ? runSupabaseQuery(
                () => supabase.from("subscriptions").select("id,user_id,plan,status,provider,provider_product_id,provider_subscription_id,provider_customer_id,provider_order_id,customer_email,current_period_start,current_period_end,cancel_at_period_end,canceled_at,last_payment_at,metadata,created_at,updated_at").eq("user_id", currentUserId).order("created_at", { ascending: false }).limit(20),
                "carregar assinatura atual"
              )
            : Promise.resolve(emptyResult),
        isCurrentAdmin
          ? runSupabaseQuery(
              () => supabase.from("profiles").select("id,name,avatar,avatar_url,username,bio,theme,role,private_profile,reading_activity,show_online_status,xp,credits,referral_code,created_at,updated_at").order("created_at", { ascending: false }).limit(1000),
              "carregar perfis"
            )
          : currentUserId
            ? runSupabaseQuery(
                () => supabase.rpc("list_public_profiles", { p_ids: null }),
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
          ? runSupabaseQueryAll(
              () => supabase
                .from("posts")
                .select(POST_SELECT)
                .order("created_at", { ascending: false }),
              "carregar posts",
              { maxRows: 200, maxPages: 4, pageSize: 100 }
            )
          : Promise.resolve(emptyResult),
        currentUserId
          ? runSupabaseQuery(
          () => supabase.from("weekly_releases").select(WEEKLY_RELEASE_SELECT).order("release_date", { ascending: true }).limit(100),
              "carregar lancamentos"
            )
          : Promise.resolve(emptyResult),
        currentUserId
          ? runSupabaseQuery(
              () => supabase.from("follows").select("follower_id, following_id").limit(5000),
              "carregar seguidores"
            )
          : Promise.resolve(emptyResult),
        currentUserId
          ? runSupabaseQuery(
              () => supabase.from("saved_posts").select("post_id").limit(5000),
              "carregar posts salvos"
            )
          : Promise.resolve(emptyResult),
        currentUserId
          ? runSupabaseQuery(
              () => supabase.from("categories").select("id,name,sort_order,created_at,updated_at").order("sort_order").order("name").limit(200),
              "carregar categorias"
            )
          : Promise.resolve(emptyResult),
        currentUserId
          ? runSupabaseQuery(
              () => supabase.from("book_favorites").select("book_id").limit(5000),
              "carregar livros favoritos"
            )
          : Promise.resolve(emptyResult),
        currentUserId
          ? runSupabaseQuery(
              () => supabase.from("author_favorites").select("author_id").limit(5000),
              "carregar autores favoritos"
            )
          : Promise.resolve(emptyResult),
        runSupabaseQuery(
          () => supabase.from("book_ratings_public").select("book_id, rating_sum, rating_count").limit(2000),
          "carregar notas dos livros"
        ),
        currentUserId
          ? runSupabaseQuery(
              () => supabase.from("book_ratings").select("book_id, rating").eq("user_id", currentUserId).limit(5000),
              "carregar minha nota dos livros"
            )
          : Promise.resolve(emptyResult),
      ]);

      const postIds = postsRes.error ? [] : (postsRes.data || []).map((post) => post.id);
      const [postLikesRes, pollRes] = postIds.length > 0
        ? await Promise.all([
            runSupabaseQuery(
              () => supabase.from("post_likes").select("post_id,user_id").in("post_id", postIds).limit(5000),
              "carregar curtidas dos posts"
            ),
            runSupabaseQuery(
              () => supabase.from("post_polls").select("id,post_id,question,created_at,post_poll_options(id,poll_id,label,sort_order)").in("post_id", postIds).limit(200),
              "carregar enquetes"
            ),
          ])
        : [emptyResult, emptyResult];
      const pollIds = pollRes.error ? [] : (pollRes.data || []).map((poll) => poll.id);
      const pollVotesRes = pollIds.length > 0
        ? await runSupabaseQuery(
            () => supabase.from("post_poll_votes").select("poll_id,option_id,user_id").in("poll_id", pollIds).limit(10000),
            "carregar votos das enquetes"
          )
        : emptyResult;

      // Colecoes + itens. RLS ja filtra (publicas + proprias). Fetched so
      // quando o usuario esta logado; sem usuario, cache fica vazio.
      const collectionsRes = currentUserId
        ? await runSupabaseQuery(
            () => supabase.from("collections").select("id,user_id,name,description,cover_path,is_public,created_at,updated_at").order("created_at", { ascending: false }).limit(200),
            "carregar colecoes"
          )
        : emptyResult;
      const collectionItemIds = collectionsRes.error
        ? []
        : (collectionsRes.data || []).map((c) => c.id);
      const collectionItemsRes = collectionItemIds.length > 0
        ? await runSupabaseQuery(
            () => supabase.from("collection_items").select("id,collection_id,item_type,item_id,position,created_at").in("collection_id", collectionItemIds).limit(2000),
            "carregar itens das colecoes"
          )
        : emptyResult;
      if (!collectionsRes.error) setCollections(collectionsRes.data || []);
      if (!collectionItemsRes.error) setCollectionItems(collectionItemsRes.data || []);

      const coverUrlMap = await createSignedUrlMap(
        LIBRARY_BUCKETS.covers,
        [
          ...(booksRes.data || []).map((book) => book.image_path),
          ...(authorsRes.data || []).map((author) => author.image_path),
        ]
      );
      const ratingsByBook = (ratingsRes.error ? [] : ratingsRes.data || []).reduce((acc, r) => {
        acc[r.book_id] = { sum: r.rating_sum || 0, count: r.rating_count || 0 };
        return acc;
      }, {});
      let normalizedBooks = [];

      if (!booksRes.error) {
        normalizedBooks = normalizeBooks(booksRes.data, {
          progress: progressRes.error ? [] : progressRes.data || [],
          ratingsByBook,
          coverUrlMap,
          localBooks: content.books || [],
        });
        setBooks(normalizedBooks);
      }
      else setBooks([]);

      if (!authorsRes.error) {
        setAuthors(normalizeAuthors(authorsRes.data, {
          coverUrlMap,
          localAuthors: content.authors || [],
        }));
      }
      else setAuthors([]);

      if (!postsRes.error) {
        const postImageUrlMap = await createSignedUrlMap(
          POST_IMAGE_BUCKET,
          (postsRes.data || []).flatMap((post) => post.image_paths || [])
        );
        setPosts(buildPostViewModels(postsRes.data, {
          profiles: profilesRes.error ? [] : profilesRes.data || [],
          books: normalizedBooks,
          likes: postLikesRes.error ? [] : postLikesRes.data || [],
          polls: pollRes.error ? [] : pollRes.data || [],
          votes: pollVotesRes.error ? [] : pollVotesRes.data || [],
          imageUrlMap: postImageUrlMap,
          currentUserId,
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
      setBookRatingStats(
        (ratingsRes.error ? [] : ratingsRes.data || []).reduce((acc, r) => {
          acc[r.book_id] = { sum: r.rating_sum || 0, count: r.rating_count || 0 };
          return acc;
        }, {})
      );
      setMyBookRatings(myRatingsRes.error ? [] : (myRatingsRes.data || []));

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
      } catch (err) {
        console.warn("Erro ao carregar dados do Supabase:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [
    isSupabase,
    authLoading,
    user?.id,
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
      bio: sanitizePlainText(data.bio, 20000) || null,
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
        bio: sanitizePlainText(data.bio, 20000) || null,
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
      const updated = await authenticatedApiPost("/api/cancel-subscription", {
        subscriptionId: id,
      });
      setSubscriptions((prev) => prev.map((sub) => sub.id === updated.id ? updated : sub));
      setSubscription((prev) => prev?.id === updated.id ? updated : prev);
      return updated;
    }
    setSubscription(prev => prev && prev.id === id ? { ...prev, status: "canceled" } : prev);
  }, [isSupabase]);

  const upsertUserSubscription = useCallback(async ({ userId, email, plan = "ope_club_leitor_monthly", durationDays = 30 }) => {
    if (!isSupabase || !userId) return null;
    const data = await authenticatedApiPost("/api/admin-subscription", {
      action: "grant",
      userId,
      email,
      plan,
      durationDays: Number(durationDays),
    });
    setSubscriptions((prev) => [data, ...prev.filter((s) => s.id !== data.id)]);
    if (userId === user?.id) setSubscription(data);
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
    if (userId === user?.id) setSubscription(data);
    return data;
  }, [isSupabase, user?.id]);

  const removeUserSubscription = useCallback(async (userId) => {
    if (!isSupabase || !userId) return;
    const current = pickCurrentSubscription(subscriptions, userId);
    if (!current?.id) throw new Error("Usuario nao possui assinatura para remover.");
    const updated = await authenticatedApiPost("/api/cancel-subscription", {
      subscriptionId: current.id,
      immediate: true,
    });
    setSubscriptions((prev) => prev.map((sub) => sub.id === updated.id ? updated : sub));
    if (userId === user?.id) setSubscription(updated);
    return updated;
  }, [isSupabase, subscriptions, user?.id]);

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

  // NOTAS — 1 a 5 por usuario/livro. Estado otimista, rollback em erro.
  const myBookRating = useCallback(
    (bookId) => myBookRatings.find((r) => r.book_id === bookId)?.rating || 0,
    [myBookRatings]
  );

  const rateBook = useCallback(async (bookId, rating) => {
    const currentUserId = user?.id;
    if (!isSupabase || !currentUserId || !bookId) return;
    const nota = Math.max(1, Math.min(5, Math.round(Number(rating) || 0)));
    const anterior = myBookRatings.find((r) => r.book_id === bookId)?.rating;
    const nova = anterior ? nota - anterior : nota;
    const incremento = anterior ? 0 : 1;
    setBookRatingStats((prev) => {
      const atual = prev[bookId] || { sum: 0, count: 0 };
      return {
        ...prev,
        [bookId]: { sum: atual.sum + nova, count: atual.count + incremento },
      };
    });
    setMyBookRatings((prev) => [
      ...prev.filter((r) => r.book_id !== bookId),
      { book_id: bookId, rating: nota },
    ]);
    const { error } = await supabase
      .from("book_ratings")
      .upsert({ user_id: currentUserId, book_id: bookId, rating: nota }, { onConflict: "user_id, book_id" });
    if (error) {
      setBookRatingStats((prev) => {
        const atual = prev[bookId] || { sum: 0, count: 0 };
        return {
          ...prev,
          [bookId]: { sum: atual.sum - nova, count: atual.count - incremento },
        };
      });
      setMyBookRatings((prev) =>
        anterior
          ? [...prev.filter((r) => r.book_id !== bookId), { book_id: bookId, rating: anterior }]
          : prev.filter((r) => r.book_id !== bookId)
      );
      throw error;
    }
  }, [isSupabase, user?.id, myBookRatings]);

  const deleteWeeklyRelease = useCallback(async (id) => {
    if (!isSupabase || !id) return;
    const { error } = await supabase.from("weekly_releases").delete().eq("id", id);
    if (error) throw error;
    setWeeklyReleases((prev) => prev.filter((item) => item.id !== id));
  }, [isSupabase]);

  const updateProfilePreferences = useCallback(async (userId, preferences) => {
    if (!isSupabase || !userId) return null;

    const payload = { updated_at: new Date().toISOString() };
    for (const key of ["private_profile", "reading_activity", "show_online_status"]) {
      if (typeof preferences?.[key] === "boolean") payload[key] = preferences[key];
    }
    if (typeof preferences?.email === "string") {
      throw new Error("Troca de email deve passar por updateUser (auth) — o email vive em user_emails, nao em profiles.");
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

  // COLECOES ---------------------------------------------------------------
  // CRUD basico com atualizacao otimista. O RLS do banco garante que so o
  // dono altera; a UI confia no user?.id.
  const createCollection = useCallback(async ({ name, description, isPublic = true }) => {
    const currentUserId = user?.id;
    if (!isSupabase || !currentUserId) throw new Error("Faca login para criar uma colecao.");

    const trimmedName = String(name || "").trim();
    if (!trimmedName) throw new Error("Dê um nome para a colecao.");

    const insertPayload = {
      user_id: currentUserId,
      name: trimmedName,
      description: String(description || "").trim() || null,
      is_public: Boolean(isPublic),
    };

    const { data, error } = await supabase
      .from("collections")
      .insert(insertPayload)
      .select("*")
      .single();
    if (error) throw error;
    if (data) setCollections((prev) => [data, ...prev]);
    return data;
  }, [isSupabase, user?.id]);

  const updateCollection = useCallback(async (id, patch) => {
    const currentUserId = user?.id;
    if (!isSupabase || !currentUserId || !id) return;
    const allowed = {};
    if (typeof patch.name === "string") allowed.name = patch.name.trim();
    if ("description" in patch) allowed.description = patch.description ? String(patch.description).trim() : null;
    if (typeof patch.isPublic === "boolean") allowed.is_public = patch.isPublic;
    if (Object.keys(allowed).length === 0) return;

    const anterior = collections.find((c) => c.id === id);
    setCollections((prev) => prev.map((c) => c.id === id ? { ...c, ...allowed, is_public: allowed.is_public ?? c.is_public } : c));

    const { error } = await supabase.from("collections").update(allowed).eq("id", id);
    if (error) {
      if (anterior) setCollections((prev) => prev.map((c) => c.id === id ? anterior : c));
      throw error;
    }
  }, [isSupabase, user?.id, collections]);

  const deleteCollection = useCallback(async (id) => {
    const currentUserId = user?.id;
    if (!isSupabase || !currentUserId || !id) return;
    const anterior = collections;
    setCollections((prev) => prev.filter((c) => c.id !== id));
    setCollectionItems((prev) => prev.filter((item) => item.collection_id !== id));

    const { error } = await supabase.from("collections").delete().eq("id", id);
    if (error) {
      setCollections(anterior);
      throw error;
    }
  }, [isSupabase, user?.id, collections]);

  const addCollectionItem = useCallback(async (collectionId, itemType, itemId) => {
    const currentUserId = user?.id;
    if (!isSupabase || !currentUserId || !collectionId) throw new Error("Colecao invalida.");
    if (itemType !== "book" && itemType !== "author") throw new Error("Tipo invalido.");

    // Ja existe? retorna sem inserir (constraint UNIQUE no banco).
    const jaExiste = collectionItems.some(
      (i) => i.collection_id === collectionId && i.item_type === itemType && i.item_id === itemId
    );
    if (jaExiste) return null;

    const position = collectionItems.filter((i) => i.collection_id === collectionId).length;

    const insertPayload = { collection_id: collectionId, item_type: itemType, item_id: itemId, position };
    const { data, error } = await supabase
      .from("collection_items")
      .insert(insertPayload)
      .select("*")
      .single();
    if (error) throw error;
    if (data) setCollectionItems((prev) => [...prev, data]);
    return data;
  }, [isSupabase, user?.id, collectionItems]);

  const removeCollectionItem = useCallback(async (itemId) => {
    const currentUserId = user?.id;
    if (!isSupabase || !currentUserId || !itemId) return;
    const anterior = collectionItems;
    setCollectionItems((prev) => prev.filter((i) => i.id !== itemId));

    const { error } = await supabase.from("collection_items").delete().eq("id", itemId);
    if (error) {
      setCollectionItems(anterior);
      throw error;
    }
  }, [isSupabase, user?.id, collectionItems]);

  // Colecoes de um usuario especifico (para o perfil publico).
  const collectionsByUser = useCallback(
    (userId) => collections.filter((c) => c.user_id === userId),
    [collections]
  );

  // Itens de uma colecao, ordenados pela posicao.
  const getCollectionItems = useCallback(
    (collectionId) => collectionItems
      .filter((i) => i.collection_id === collectionId)
      .sort((a, b) => (a.position || 0) - (b.position || 0)),
    [collectionItems]
  );

  // Contagem de itens por colecao (para o card no perfil).
  const collectionItemCount = useCallback(
    (collectionId) => collectionItems.filter((i) => i.collection_id === collectionId).length,
    [collectionItems]
  );

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
      categories, bookFavorites, authorFavorites, bookRatingStats,
      collections, collectionItems,
      followUser, unfollowUser, isFollowing, toggleSavedPost,
      toggleFavoriteBook, isFavoriteBook,
      toggleFavoriteAuthor, isFavoriteAuthor,
      rateBook, myBookRating,
      isBookReleased, getReleaseStatus, getUserMetrics,
      addBook, updateBook, deleteBook, markBookCompleted, updateReadingProgress,
      addAuthor, updateAuthor, deleteAuthor,
      addPost, deletePost,
      cancelSubscription,
      upsertUserSubscription, updateUserSubscriptionDuration, removeUserSubscription,
      addWeeklyRelease, deleteWeeklyRelease, toggleWeeklyReleaseVisibility,
      addCategory, updateCategory, deleteCategory,
      updateProfilePreferences,
      createCollection, updateCollection, deleteCollection,
      addCollectionItem, removeCollectionItem,
      collectionsByUser, getCollectionItems, collectionItemCount,
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
