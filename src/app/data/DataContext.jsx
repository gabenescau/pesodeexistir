import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { isSupabaseReady } from "./supabase";
import { loadContent } from "./contentLoader";
import { pickCurrentSubscription } from "@/lib/subscription";
import {
  invalidateSupabaseQueryCache,
} from "@/lib/supabase-query";
import { releaseStatus } from "@/lib/releases";
import { LIBRARY_BUCKETS, removeLibraryFile } from "@/lib/library-media";
import { useAuth } from "./AuthContext";
import { POST_IMAGE_BUCKET } from "@/lib/social";
import { sanitizePlainText, sanitizeSingleLine } from "@/lib/sanitize";
import { authenticatedApiPost } from "@/lib/authenticated-api";
import { loadPublicCatalog } from "@/lib/catalog-api";
import { loadCommunityFeed } from "@/lib/community-api";
import { loadReadingProgress, saveReadingProgress } from "@/lib/reading-api";
import { communityWrite } from "@/lib/community-write-api";
import { loadMySubscriptions } from "@/lib/subscription-api";
import { loadAccountState } from "@/lib/account-api";
import { accountWrite } from "@/lib/account-write-api";
import { loadAdminBootstrap, adminWrite } from "@/lib/admin-api";
import {
  normalizeAuthors,
  normalizeBooks,
} from "./domains/catalog";
import { buildPostViewModels } from "./domains/community";

const CATALOG_PAGE_SIZE = 48;
const AUTHOR_PAGE_SIZE = 48;
const POST_PAGE_SIZE = 20;

function takePage(result, pageSize, loadAll = false) {
  const rows = result?.error || !Array.isArray(result?.data) ? [] : result.data;
  if (loadAll) return { rows, hasMore: false };
  return {
    rows: rows.slice(0, pageSize),
    hasMore: rows.length > pageSize,
  };
}

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
  const [booksHasMore, setBooksHasMore] = useState(false);
  const [authorsHasMore, setAuthorsHasMore] = useState(false);
  const [postsHasMore, setPostsHasMore] = useState(false);
  const [booksLoadingMore, setBooksLoadingMore] = useState(false);
  const [authorsLoadingMore, setAuthorsLoadingMore] = useState(false);
  const [postsLoadingMore, setPostsLoadingMore] = useState(false);
  const booksOffsetRef = useRef(0);
  const authorsOffsetRef = useRef(0);
  const postsOffsetRef = useRef(0);

  const isSupabase = isSupabaseReady();

  useEffect(() => {
    if (!isSupabase) {
      setBooks(content.books || []);
      setAuthors(content.authors || []);
      setBooksHasMore(false);
      setAuthorsHasMore(false);
      setPostsHasMore(false);
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
      booksOffsetRef.current = 0;
      authorsOffsetRef.current = 0;
      postsOffsetRef.current = 0;
      setBooksHasMore(false);
      setAuthorsHasMore(false);
      setPostsHasMore(false);
      setBooksLoadingMore(false);
      setAuthorsLoadingMore(false);
      setPostsLoadingMore(false);
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

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const currentUserId = user?.id;
        const currentProfile = authProfile || null;
        const isCurrentAdmin = isAdmin || currentProfile?.role === "admin";
        const isCurrentContentManager =
          isCurrentAdmin || currentProfile?.role === "editor";
        const emptyResult = { data: [], error: null };
        const publicCatalogPromise = !isCurrentContentManager
          ? loadPublicCatalog()
            .then((data) => ({ data, error: null }))
            .catch((error) => ({ data: null, error }))
          : Promise.resolve({ data: null, error: null });
        const publicCommunityPromise = !isCurrentAdmin
          ? loadCommunityFeed()
            .then((data) => ({ data, error: null }))
            .catch((error) => ({ data: null, error }))
          : Promise.resolve({ data: null, error: null });
        const accountStatePromise = currentUserId
          ? loadAccountState().then((data) => ({ data, error: null })).catch((error) => ({ data: null, error }))
          : Promise.resolve({ data: null, error: null });
        const adminBootstrapPromise = isCurrentContentManager
          ? loadAdminBootstrap().then((data) => ({ data, error: null })).catch((error) => ({ data: null, error }))
          : Promise.resolve({ data: null, error: null });
        const adminData = (key) => adminBootstrapPromise.then((result) => ({
          data: result.data?.[key] || [],
          error: result.error,
        }));

      // Admin le a tabela inteira (role, gestao de assinaturas). O email agora
      // mora em user_emails (fora de profiles), so visivel para admin — e
      // buscado em separado e mesclado abaixo. Usuario comum le a view
      // public_profiles: id/nome/@/avatar/bio de quem nao e privado, o
      // suficiente para o feed sem vazar email de ninguem.
      const [
        booksRes,
        adminBookAssetsRes,
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
        isCurrentContentManager
          ? adminData("books")
          : publicCatalogPromise.then((result) => ({
              data: result.data?.books || [],
              error: result.error,
            })),
        isCurrentContentManager
          ? adminData("adminBookAssets")
          : Promise.resolve(emptyResult),
        isCurrentContentManager
          ? adminData("authors")
          : publicCatalogPromise.then((result) => ({
              data: result.data?.authors || [],
              error: result.error,
            })),
        currentUserId
          ? loadReadingProgress()
              .then((data) => ({ data, error: null }))
              .catch((error) => ({ data: [], error }))
          : Promise.resolve(emptyResult),
        isCurrentAdmin
          ? adminData("subscriptions")
          : currentUserId
            ? loadMySubscriptions()
              .then((data) => ({ data, error: null }))
              .catch((error) => ({ data: [], error }))
            : Promise.resolve(emptyResult),
        isCurrentAdmin
          ? adminData("profiles")
          : currentUserId
            ? publicCommunityPromise.then((result) => ({
                data: result.data?.profiles || [],
                error: result.error,
              }))
            : Promise.resolve({ data: currentProfile ? [currentProfile] : [], error: null }),
        isCurrentAdmin
          ? adminData("emails")
          : Promise.resolve(emptyResult),
        currentUserId
          ? isCurrentAdmin
            ? adminData("posts")
            : publicCommunityPromise.then((result) => ({
                data: result.data?.posts || [],
                error: result.error,
              }))
          : Promise.resolve(emptyResult),
        currentUserId
          ? isCurrentContentManager
            ? adminData("releases")
            : publicCatalogPromise.then((result) => ({
                data: result.data?.weeklyReleases || [],
                error: result.error,
              }))
          : Promise.resolve(emptyResult),
        currentUserId
          ? publicCommunityPromise.then((result) => ({ data: result.data?.follows || [], error: result.error }))
          : Promise.resolve(emptyResult),
        currentUserId
          ? publicCommunityPromise.then((result) => ({ data: result.data?.savedPosts || [], error: result.error }))
          : Promise.resolve(emptyResult),
        currentUserId
          ? isCurrentContentManager
            ? adminData("categories")
            : publicCatalogPromise.then((result) => ({
                data: result.data?.categories || [],
                error: result.error,
              }))
          : Promise.resolve(emptyResult),
        isCurrentContentManager
          ? adminData("bookFavorites")
          : accountStatePromise.then((result) => ({ data: result.data?.bookFavorites || [], error: result.error })),
        isCurrentContentManager
          ? adminData("authorFavorites")
          : accountStatePromise.then((result) => ({ data: result.data?.authorFavorites || [], error: result.error })),
        isCurrentContentManager
          ? adminData("ratings")
          : publicCatalogPromise.then((result) => ({
              data: result.data?.ratings || [],
              error: result.error,
            })),
        isCurrentContentManager
          ? adminData("myRatings")
          : accountStatePromise.then((result) => ({ data: result.data?.myRatings || [], error: result.error })),
      ]);

      const publicCatalog = await publicCatalogPromise;
      const publicCommunity = await publicCommunityPromise;
      if (cancelled) return;

      const adminAssetsByBookId = new Map(
        (adminBookAssetsRes.error ? [] : adminBookAssetsRes.data || [])
          .filter((asset) => asset?.book_id)
          .map((asset) => [asset.book_id, asset])
      );
      const booksWithAdminAssets =
        isCurrentContentManager && !adminBookAssetsRes.error
        ? (booksRes.data || []).map((book) => ({
            ...book,
            ...(adminAssetsByBookId.get(book.id) || null),
          }))
        : booksRes.data;
      const booksResult = { ...booksRes, data: booksWithAdminAssets };
      const booksPage = takePage(
        booksResult,
        CATALOG_PAGE_SIZE,
        isCurrentContentManager
      );
      const authorsPage = takePage(
        authorsRes,
        AUTHOR_PAGE_SIZE,
        isCurrentContentManager
      );
      const postsPage = takePage(postsRes, POST_PAGE_SIZE, isCurrentAdmin);
      booksOffsetRef.current = booksPage.rows.length;
      authorsOffsetRef.current = authorsPage.rows.length;
      postsOffsetRef.current = postsPage.rows.length;
      setBooksHasMore(!booksResult.error && booksPage.hasMore);
      setAuthorsHasMore(!authorsRes.error && authorsPage.hasMore);
      setPostsHasMore(!postsRes.error && postsPage.hasMore);

      const postIds = postsPage.rows.map((post) => post.id);
      const [postLikesRes, pollRes] = !isCurrentAdmin
        ? [
            { data: publicCommunity?.data?.likes || [], error: publicCommunity?.error || null },
            { data: publicCommunity?.data?.polls || [], error: publicCommunity?.error || null },
          ]
        : postIds.length > 0
          ? [await adminData("postLikes"), await adminData("polls")]
          : [emptyResult, emptyResult];
      const pollIds = pollRes.error ? [] : (pollRes.data || []).map((poll) => poll.id);
      const pollVotesRes = !isCurrentAdmin
        ? { data: publicCommunity?.data?.votes || [], error: publicCommunity?.error || null }
        : pollIds.length > 0
          ? await adminData("votes")
          : emptyResult;

      const accountState = await accountStatePromise;

      // Colecoes + itens. RLS ja filtra (publicas + proprias). Fetched so
      // quando o usuario esta logado; sem usuario, cache fica vazio.
      const collectionsRes = accountState.error
        ? emptyResult
        : { data: accountState.data?.collections || [], error: null };
      const collectionItemsRes = accountState.error
        ? emptyResult
        : { data: accountState.data?.collectionItems || [], error: null };
      if (!collectionsRes.error) setCollections(collectionsRes.data || []);
      if (!collectionItemsRes.error) setCollectionItems(collectionItemsRes.data || []);

      const coverUrlMap = isCurrentContentManager
        ? new Map(Object.entries(await adminWrite("signed-media", {
            bucket: LIBRARY_BUCKETS.covers,
            paths: [
              ...booksPage.rows.map((book) => book.image_path),
              ...authorsPage.rows.map((author) => author.image_path),
            ],
          })))
        : new Map(Object.entries(publicCatalog?.data?.coverUrls || {}));
      if (cancelled) return;
      const ratingsByBook = (ratingsRes.error ? [] : ratingsRes.data || []).reduce((acc, r) => {
        acc[r.book_id] = { sum: r.rating_sum || 0, count: r.rating_count || 0 };
        return acc;
      }, {});
      let normalizedBooks = [];

      if (!booksResult.error) {
        normalizedBooks = normalizeBooks(booksPage.rows, {
          progress: progressRes.error ? [] : progressRes.data || [],
          ratingsByBook,
          coverUrlMap,
          localBooks: content.books || [],
        });
        setBooks(normalizedBooks);
      }
      else setBooks([]);

      if (!authorsRes.error) {
        setAuthors(normalizeAuthors(authorsPage.rows, {
          coverUrlMap,
          localAuthors: content.authors || [],
        }));
      }
      else setAuthors([]);

      if (!postsRes.error) {
        const postImageUrlMap = isCurrentAdmin
          ? new Map(Object.entries(await adminWrite("signed-media", {
              bucket: POST_IMAGE_BUCKET,
              paths: postsPage.rows.flatMap((post) => post.image_paths || []),
            })))
          : new Map(Object.entries(publicCommunity?.data?.imageUrls || {}));
        setPosts(buildPostViewModels(postsPage.rows, {
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
        setMyCounts(accountState.error
          ? { comments: 0, reactions: 0 }
          : (accountState.data?.myCounts || { comments: 0, reactions: 0 }));
      } else {
        setMyCounts({ comments: 0, reactions: 0 });
      }
      } catch (err) {
        if (!cancelled) console.warn("Erro ao carregar dados do Supabase:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      // Impede que uma resposta da conta anterior sobrescreva a nova sessao.
      // Tambem evita setState depois que a tela raiz foi desmontada.
      cancelled = true;
    };
  }, [
    isSupabase,
    authLoading,
    user?.id,
    authProfile?.id,
    authProfile?.updated_at,
    isAdmin,
    content.books,
    content.authors,
  ]);

  const loadMoreBooks = useCallback(async () => {
    if (!isSupabase || !user?.id || !booksHasMore || booksLoadingMore) return false;
    setBooksLoadingMore(true);
    try {
      const offset = booksOffsetRef.current;
      const catalogResult = await loadPublicCatalog({
        only: "books",
        booksOffset: offset,
      }).then((data) => ({ data, error: null })).catch((error) => ({ data: null, error }));
      const result = {
        data: catalogResult.data?.books || [],
        error: catalogResult.error,
      };
      if (result?.error) return false;

      const page = takePage(result, CATALOG_PAGE_SIZE);
      booksOffsetRef.current = offset + page.rows.length;
      setBooksHasMore(page.hasMore);
      if (page.rows.length === 0) return false;

      const bookIds = page.rows.map((book) => book.id).filter(Boolean);
      const [progressRows] = await Promise.all([
        loadReadingProgress(null, bookIds).catch(() => []),
      ]);
      const coverUrlMap = new Map(Object.entries(catalogResult.data?.coverUrls || {}));
      const ratingsByBook = (catalogResult.data?.ratings || []).filter((rating) => bookIds.includes(rating.book_id)).reduce((acc, rating) => {
        acc[rating.book_id] = { sum: rating.rating_sum || 0, count: rating.rating_count || 0 };
        return acc;
      }, {});
      const normalized = normalizeBooks(page.rows, {
        progress: (progressRows || []).filter((row) => bookIds.includes(row.book_id)),
        ratingsByBook,
        coverUrlMap,
        localBooks: content.books || [],
      });
      setBooks((previous) => {
        const knownIds = new Set(previous.map((book) => book.id));
        return [...previous, ...normalized.filter((book) => !knownIds.has(book.id))];
      });
      return true;
    } finally {
      setBooksLoadingMore(false);
    }
  }, [isSupabase, user?.id, isAdmin, booksHasMore, booksLoadingMore, content.books]);

  const loadMoreAuthors = useCallback(async () => {
    if (!isSupabase || !user?.id || !authorsHasMore || authorsLoadingMore) return false;
    setAuthorsLoadingMore(true);
    try {
      const offset = authorsOffsetRef.current;
      const catalogResult = await loadPublicCatalog({
        only: "authors",
        authorsOffset: offset,
      }).then((data) => ({ data, error: null })).catch((error) => ({ data: null, error }));
      const result = {
        data: catalogResult.data?.authors || [],
        error: catalogResult.error,
      };
      if (result?.error) return false;

      const page = takePage(result, AUTHOR_PAGE_SIZE);
      authorsOffsetRef.current = offset + page.rows.length;
      setAuthorsHasMore(page.hasMore);
      if (page.rows.length === 0) return false;

      const coverUrlMap = new Map(Object.entries(catalogResult.data?.coverUrls || {}));
      const normalized = normalizeAuthors(page.rows, {
        coverUrlMap,
        localAuthors: content.authors || [],
      });
      setAuthors((previous) => {
        const knownIds = new Set(previous.map((author) => author.id));
        return [...previous, ...normalized.filter((author) => !knownIds.has(author.id))];
      });
      return true;
    } finally {
      setAuthorsLoadingMore(false);
    }
  }, [isSupabase, user?.id, authorsHasMore, authorsLoadingMore, content.authors]);

  const loadMorePosts = useCallback(async () => {
    if (!isSupabase || !user?.id || !postsHasMore || postsLoadingMore) return false;
    setPostsLoadingMore(true);
    try {
      const offset = postsOffsetRef.current;
      const communityResult = !isAdmin
        ? await loadCommunityFeed({ offset })
            .then((data) => ({ data, error: null }))
            .catch((error) => ({ data: null, error }))
        : null;
      const adminPage = isAdmin
        ? await adminWrite("posts-page", { offset, limit: POST_PAGE_SIZE })
        : null;
      const result = !isAdmin
        ? { data: communityResult?.data?.posts || [], error: communityResult?.error }
        : { data: adminPage?.posts || [], error: null };
      if (result?.error) return false;

      const page = takePage(result, POST_PAGE_SIZE);
      postsOffsetRef.current = offset + page.rows.length;
      setPostsHasMore(page.hasMore);
      if (page.rows.length === 0) return false;

      const [likesRes, pollsRes] = !isAdmin
        ? [
            { data: communityResult?.data?.likes || [], error: communityResult?.error || null },
            { data: communityResult?.data?.polls || [], error: communityResult?.error || null },
          ]
        : [
            { data: adminPage?.likes || [], error: null },
            { data: adminPage?.polls || [], error: null },
          ];
      const votesRes = !isAdmin
        ? { data: communityResult?.data?.votes || [], error: communityResult?.error || null }
        : { data: adminPage?.votes || [], error: null };
      const imageUrlMap = !isAdmin
        ? new Map(Object.entries(communityResult?.data?.imageUrls || {}))
        : new Map(Object.entries(adminPage?.imageUrls || {}));
      const newPosts = buildPostViewModels(page.rows, {
        profiles,
        books,
        likes: likesRes.error ? [] : likesRes.data || [],
        polls: pollsRes.error ? [] : pollsRes.data || [],
        votes: votesRes.error ? [] : votesRes.data || [],
        imageUrlMap,
        currentUserId: user.id,
      });
      setPosts((previous) => {
        const knownIds = new Set(previous.map((post) => post.id));
        return [...previous, ...newPosts.filter((post) => !knownIds.has(post.id))];
      });
      return true;
    } finally {
      setPostsLoadingMore(false);
    }
  }, [isSupabase, user?.id, isAdmin, postsHasMore, postsLoadingMore, profiles, books]);

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
      const inserted = await adminWrite("author-create", payload);
      if (inserted) {
        invalidateSupabaseQueryCache("catalog:authors");
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
      await adminWrite("author-update", { id, ...{
        name: sanitizeSingleLine(data.name, 120),
        theme: sanitizeSingleLine(data.theme, 120),
        era: sanitizeSingleLine(data.era, 80),
        bio: sanitizePlainText(data.bio, 3000),
        image: data.image || null,
        imagePath: data.imagePath || null,
      }});

      invalidateSupabaseQueryCache("catalog:authors");

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
      await adminWrite("author-delete", { id });
      invalidateSupabaseQueryCache("catalog:authors");
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
      const inserted = await adminWrite("book-create", { ...payload, authorId: payload.author_id, imagePath: payload.image_path, pdfPath: payload.pdf_path, pdfFile: payload.pdf_url });
      if (inserted) {
        invalidateSupabaseQueryCache("catalog:books");
        setBooks(prev => [{
          ...inserted,
          image: data.previewImage || data.image || "",
          authorId: inserted.author_id,
          authorName: inserted.authors?.name || "",
          author: inserted.authors?.name || "",
          pdfFile: data.pdfPath || data.pdfFile || "",
          pdf_path: data.pdfPath || null,
          pdf_url: data.pdfFile || null,
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
      await adminWrite("book-update", { id, ...{
        title: sanitizeSingleLine(data.title, 180),
        image: data.image || null,
        image_path: data.imagePath || null,
        pdf_url: data.pdfFile || null,
        pdf_path: data.pdfPath || null,
        author_id: data.authorId || null,
        category: sanitizeSingleLine(data.category, 80) || null,
        bio: sanitizePlainText(data.bio, 20000) || null,
        authorId: data.authorId || null,
        imagePath: data.imagePath || null,
        pdfPath: data.pdfPath || null,
        pdfFile: data.pdfFile || null,
      }});

      invalidateSupabaseQueryCache("catalog:books");

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
      await adminWrite("book-delete", { id });
      invalidateSupabaseQueryCache("catalog:books");
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
      const userId = user?.id;

      if (userId) {
        await saveReadingProgress({
          bookId,
          currentPage: books.find((book) => book.id === bookId)?.totalPages
            || books.find((book) => book.id === bookId)?.currentPage
            || 1,
          totalPages: books.find((book) => book.id === bookId)?.totalPages || null,
          completed: true,
        });
      }
    }

    setBooks(prev => prev.map(book => book.id === bookId ? { ...book, progress: 100 } : book));
  }, [isSupabase, books, user?.id]);

  const updateReadingProgress = useCallback(async (bookId, { currentPage = 1, totalPages = null }) => {
    if (!bookId) return;

    const safeTotal = Number(totalPages || 0);
    const safePage = Math.max(1, Number(currentPage || 1));
    const progress = safeTotal > 0 ? Math.min(100, Math.max(0, Math.round((safePage / safeTotal) * 100))) : 0;

    if (isSupabase) {
      const userId = user?.id;

      if (userId) {
        await saveReadingProgress({
          bookId,
          currentPage: safePage,
          totalPages: safeTotal || null,
        });
      }
    }

    setBooks(prev => prev.map(book => book.id === bookId ? {
      ...book,
      currentPage: safePage,
      totalPages: safeTotal || book.totalPages || null,
      progress,
    } : book));
  }, [isSupabase, user?.id]);

  // POSTS CRUD
  const addPost = useCallback(async (post) => {
    if (!post.userId) {
      throw new Error("Você precisa estar logado para publicar.");
    }

    if (isSupabase) {
      const inserted = await communityWrite("create_post", {
        text: sanitizePlainText(post.text, 5000),
        tag: sanitizeSingleLine(post.tag, 80) || null,
        bookId: post.bookId,
        imagePaths: post.imagePaths || [],
        poll: post.poll || null,
      });
      let poll = null;
      if (inserted && post.poll?.question && post.poll?.options?.length >= 2) {
        poll = {
          question: sanitizeSingleLine(post.poll.question, 180),
          options: post.poll.options.map((label, index) => ({ id: `local-${index}`, label: sanitizeSingleLine(label, 120), votes: 0 })),
          totalVotes: 0,
          myVote: null,
        };
      }
      if (inserted) {
        const imageUrlMap = await communityWrite("sign_post_media", { paths: inserted.image_paths || [] });
        setPosts(prev => [{
          ...inserted,
          images: [
            ...(inserted.image_paths || []).map((path) => imageUrlMap?.[path]).filter(Boolean),
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
      return inserted;
    }
    throw new Error("Supabase não configurado: post não foi salvo.");
  }, [isSupabase, authProfile]);

  const deletePost = useCallback(async (id) => {
    if (isSupabase) {
      await communityWrite("delete_post", { postId: id });
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
    const data = await adminWrite("weekly-create", {
      bookId,
      releaseDate,
      note: sanitizePlainText(note, 1000),
      visible,
    });
    invalidateSupabaseQueryCache("catalog:weekly-releases");
    setWeeklyReleases((prev) => [...prev, data].sort((a, b) => new Date(a.release_date) - new Date(b.release_date)));
    return data;
  }, [isSupabase]);

  const toggleWeeklyReleaseVisibility = useCallback(async (id, visible) => {
    if (!isSupabase || !id) return;
    setWeeklyReleases((prev) => prev.map((item) => item.id === id ? { ...item, visible } : item));
    try {
      await adminWrite("weekly-update", { id, visible });
    } catch (error) {
      setWeeklyReleases((prev) => prev.map((item) => item.id === id ? { ...item, visible: !visible } : item));
      throw error;
    }
    invalidateSupabaseQueryCache("catalog:weekly-releases");
  }, [isSupabase]);

  // CATEGORIES CRUD — categorias dinamimicas gerenciadas pelo admin.
  const addCategory = useCallback(async (name) => {
    const cleanName = sanitizeSingleLine(name, 80);
    if (!cleanName) return null;
    if (isSupabase) {
      const data = await adminWrite("category-create", { name: cleanName });
      if (data) {
        invalidateSupabaseQueryCache("catalog:categories");
        setCategories(prev => [...prev, data].sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name)));
        return data;
      }
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
      const updated = await adminWrite("category-update", { id, ...payload });
      invalidateSupabaseQueryCache("catalog:categories");
      setCategories(prev => prev.map(c => c.id === id ? updated : c));
    } else {
      setCategories(prev => prev.map(c => c.id === id ? { ...c, ...payload } : c));
    }
  }, [isSupabase]);

  const deleteCategory = useCallback(async (id) => {
    if (isSupabase) {
      await adminWrite("category-delete", { id });
      invalidateSupabaseQueryCache("catalog:categories");
    }
    setCategories(prev => prev.filter(c => c.id !== id));
  }, [isSupabase]);

  // FAVORITOS — livros e autores. Estado otimista, rollback em erro.
  const favoriteBook = useCallback(async (bookId) => {
    const currentUserId = user?.id;
    if (!isSupabase || !currentUserId || !bookId) return;
    const jaFav = bookFavorites.includes(bookId);
    setBookFavorites((prev) => jaFav ? prev : [...prev, bookId]);
    try {
      await accountWrite("toggle_book_favorite", { bookId, enabled: true });
    } catch (error) {
      setBookFavorites((prev) => prev.filter((b) => b !== bookId));
      throw error;
    }
  }, [isSupabase, user?.id, bookFavorites]);

  const unfavoriteBook = useCallback(async (bookId) => {
    const currentUserId = user?.id;
    if (!isSupabase || !currentUserId || !bookId) return;
    setBookFavorites((prev) => prev.filter((b) => b !== bookId));
    try {
      await accountWrite("toggle_book_favorite", { bookId, enabled: false });
    } catch (error) {
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
    try {
      await accountWrite("toggle_author_favorite", { authorId, enabled: true });
    } catch (error) {
      setAuthorFavorites((prev) => prev.filter((a) => a !== authorId));
      throw error;
    }
  }, [isSupabase, user?.id, authorFavorites]);

  const unfavoriteAuthor = useCallback(async (authorId) => {
    const currentUserId = user?.id;
    if (!isSupabase || !currentUserId || !authorId) return;
    setAuthorFavorites((prev) => prev.filter((a) => a !== authorId));
    try {
      await accountWrite("toggle_author_favorite", { authorId, enabled: false });
    } catch (error) {
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
    try {
      await accountWrite("rate_book", { bookId, rating: nota });
    } catch (error) {
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
    await adminWrite("weekly-delete", { id });
    invalidateSupabaseQueryCache("catalog:weekly-releases");
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

    const result = await authenticatedApiPost("/api/auth?action=update-profile", payload);
    const data = result?.profile || result;

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

    let error = null;
    try {
      await communityWrite("toggle_follow", { targetId, enabled: true });
    } catch (cause) { error = cause; }

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

    let error = null;
    try {
      await communityWrite("toggle_follow", { targetId, enabled: false });
    } catch (cause) { error = cause; }

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

    let error = null;
    try {
      await communityWrite("toggle_save", { postId, enabled: !jaSalvo });
    } catch (cause) { error = cause; }

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

    const data = await accountWrite("create_collection", {
      name: trimmedName,
      description: String(description || "").trim() || null,
      isPublic: Boolean(isPublic),
    });
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

    try {
      await accountWrite("update_collection", { collectionId: id, ...allowed, isPublic: allowed.is_public });
    } catch (error) {
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

    try {
      await accountWrite("delete_collection", { collectionId: id });
    } catch (error) {
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

    const data = await accountWrite("add_collection_item", { collectionId, itemType, itemId, position });
    if (data) setCollectionItems((prev) => [...prev, data]);
    return data;
  }, [isSupabase, user?.id, collectionItems]);

  const removeCollectionItem = useCallback(async (itemId) => {
    const currentUserId = user?.id;
    if (!isSupabase || !currentUserId || !itemId) return;
    const anterior = collectionItems;
    setCollectionItems((prev) => prev.filter((i) => i.id !== itemId));

    try {
      await accountWrite("remove_collection_item", { itemId });
    } catch (error) {
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
      booksHasMore, authorsHasMore, postsHasMore,
      booksLoadingMore, authorsLoadingMore, postsLoadingMore,
      loadMoreBooks, loadMoreAuthors, loadMorePosts,
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
