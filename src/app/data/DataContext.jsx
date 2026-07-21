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

      const [booksRes, authorsRes, postsRes, subsRes] = await Promise.all([
        supabase.from("books").select("*, authors(name)").order("created_at", { ascending: false }),
        supabase.from("authors").select("*").order("name"),
        supabase.from("posts").select("*").order("created_at", { ascending: false }),
        supabase.from("subscriptions").select("*").order("started_at", { ascending: false }),
      ]);

      if (!booksRes.error) setBooks(booksRes.data.map(b => ({ ...b, authorName: b.authors?.name || "", author: b.authors?.name || "" })));
      else setBooks([]);

      if (!authorsRes.error) setAuthors(authorsRes.data);
      else setAuthors([]);

      if (!postsRes.error) setPosts(postsRes.data.map(p => ({
        ...p,
        images: p.images || (p.image ? [p.image] : []),
        author: p.author || "Leitor",
        avatar: p.avatar || "L",
        book: null,
        likes: p.likes || 0,
        replies: p.replies || 0,
      })));
      else setPosts([]);

      if (!subsRes.error) {
        const list = subsRes.data || [];
        setSubscriptions(list);
        setSubscription(list.find((sub) => sub.user_id === currentUserId) || list[0] || null);
      } else {
        setSubscriptions([]);
        setSubscription(null);
      }

      setLoading(false);
    }

    load();
  }, []);

  // AUTHORS CRUD
  const addAuthor = useCallback(async (data) => {
    if (isSupabase) {
      const { data: inserted, error } = await supabase.from("authors").insert(data).select().single();
      if (!error && inserted) { setAuthors(prev => [...prev, inserted]); return inserted.id; }
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
      if (error) { console.error("Erro ao atualizar autor:", error.message); return; }
    }
    setAuthors(prev => prev.map(a => a.id === id ? { ...a, ...data } : a));
  }, [isSupabase]);

  const deleteAuthor = useCallback(async (id) => {
    if (isSupabase) {
      const { error } = await supabase.from("authors").delete().eq("id", id);
      if (error) { console.error("Erro ao deletar autor:", error.message); return; }
    }
    setAuthors(prev => prev.filter(a => a.id !== id));
    setBooks(prev => prev.map(b => b.author_id === id || b.authorId === id ? { ...b, author_id: null, authorId: null, authorName: "" } : b));
  }, [isSupabase]);

  // BOOKS CRUD
  const addBook = useCallback(async (data) => {
    const payload = { title: data.title, image: data.image, pdf_url: data.pdfFile, author_id: data.authorId };
    if (isSupabase) {
      const { data: inserted, error } = await supabase.from("books").insert(payload).select("*, authors(name)").single();
      if (!error && inserted) {
        setBooks(prev => [{ ...inserted, authorName: inserted.authors?.name || "", author: inserted.authors?.name || "" }, ...prev]);
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
      if (error) { console.error("Erro ao atualizar livro:", error.message); return; }
    }
    setBooks(prev => prev.map(b => b.id === id ? { ...b, ...data } : b));
  }, [isSupabase]);

  const deleteBook = useCallback(async (id) => {
    if (isSupabase) {
      const { error } = await supabase.from("books").delete().eq("id", id);
      if (error) { console.error("Erro ao deletar livro:", error.message); return; }
    }
    setBooks(prev => prev.filter(b => b.id !== id));
  }, [isSupabase]);

  // POSTS CRUD
  const addPost = useCallback(async (post) => {
    if (isSupabase) {
      const { data: inserted, error } = await supabase.from("posts").insert({
        user_id: post.userId,
        text: post.text,
        tag: post.tag,
        book_id: post.bookId,
        images: post.images || [],
      }).select("*").single();
      if (!error && inserted) {
        setPosts(prev => [{
          ...inserted,
          images: inserted.images || [],
          author: "Você",
          avatar: "?",
          replies: 0,
          likes: 0,
        }, ...prev]);
      }
      return;
    }
    console.warn("Supabase não configurado: post não foi salvo.");
  }, [isSupabase, posts]);

  const deletePost = useCallback(async (id) => {
    if (isSupabase) {
      const { error } = await supabase.from("posts").delete().eq("id", id);
      if (error) { console.error("Erro ao deletar post:", error.message); return; }
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
      books, authors, posts, subscription, subscriptions, profile, loading,
      addBook, updateBook, deleteBook,
      addAuthor, updateAuthor, deleteAuthor,
      addPost, deletePost,
      cancelSubscription,
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
