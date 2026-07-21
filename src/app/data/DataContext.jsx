import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, isSupabaseReady } from "./supabase";
import { loadContent } from "./contentLoader";

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const content = loadContent();

  const [books, setBooks] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [posts, setPosts] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const isSupabase = isSupabaseReady();

  useEffect(() => {
    if (!isSupabase) {
      setBooks(content.books || []);
      setAuthors(content.authors || []);
      setLoading(false);
      return;
    }

    async function load() {
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id;

      const [booksRes, authorsRes, postsRes, subsRes, profilesRes] = await Promise.all([
        supabase.from("books").select("*, authors(name)").order("created_at", { ascending: false }),
        supabase.from("authors").select("*").order("name"),
        supabase.from("posts").select("*").order("created_at", { ascending: false }),
        supabase.from("subscriptions").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      ]);

      if (!booksRes.error) setBooks(booksRes.data.map(b => ({
        ...b,
        authorId: b.author_id,
        authorName: b.authors?.name || "",
        author: b.authors?.name || "",
        pdfFile: b.pdf_url,
      })));
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
            handle: postProfile?.email?.split("@")[0] || postProfile?.name?.toLowerCase().replace(/\s+/g, "_") || "leitor",
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
        setSubscriptions(list);
        setSubscription(list.find((sub) => sub.user_id === currentUserId) || list[0] || null);
      } else {
        setSubscriptions([]);
        setSubscription(null);
      }

      if (!profilesRes.error) setProfiles(profilesRes.data || []);
      else setProfiles([]);

      setLoading(false);
    }

    load();
  }, []);

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
    const payload = { title: data.title, image: data.image, pdf_url: data.pdfFile, author_id: data.authorId };
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

    const existing = subscriptions.find((sub) => sub.user_id === userId);
    const query = existing
      ? supabase.from("subscriptions").update(payload).eq("id", existing.id).select().single()
      : supabase.from("subscriptions").insert(payload).select().single();

    const { data, error } = await query;
    if (error) {
      console.error("Erro ao salvar assinatura:", error.message);
      return null;
    }

    setSubscriptions((prev) => {
      const others = prev.filter((sub) => sub.id !== data.id && sub.user_id !== userId);
      return [data, ...others];
    });
    setSubscription((prev) => prev?.user_id === userId ? data : prev);
    return data;
  }, [isSupabase, subscriptions]);

  const removeUserSubscription = useCallback(async (userId) => {
    if (!isSupabase || !userId) return;
    const existing = subscriptions.find((sub) => sub.user_id === userId);
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

  return (
    <DataContext.Provider value={{
      books, authors, posts, subscription, subscriptions, profiles, profile, loading,
      addBook, updateBook, deleteBook,
      addAuthor, updateAuthor, deleteAuthor,
      addPost, deletePost,
      cancelSubscription,
      upsertUserSubscription, removeUserSubscription,
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
