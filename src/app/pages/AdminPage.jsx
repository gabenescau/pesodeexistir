import { useState } from "react";
import { useAuth } from "../data/AuthContext";
import { useData } from "../data/DataContext";
import { supabase, isSupabaseReady } from "../data/supabase";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Plus, Trash2, Edit3, X, Check, Crown, BookOpen, Users, MessageSquare, FileText, ShieldAlert, Sparkles } from "lucide-react";
import { isActiveSubscription } from "@/lib/subscription";
import { CATEGORIES } from "@/lib/categories";

const tabs = [
  { id: "users", label: "Usuários", icon: Users },
  { id: "subscriptions", label: "Assinaturas", icon: Crown },
  { id: "posts", label: "Posts", icon: MessageSquare },
  { id: "releases", label: "Lançamentos", icon: Sparkles },
  { id: "books", label: "Livros", icon: BookOpen },
  { id: "authors", label: "Autores", icon: Users },
];

function FormField({ label, value, onChange, placeholder, type = "text", className }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{label}</label>
      {type === "textarea" ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3}
          className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)] resize-none" />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)]" />
      )}
    </div>
  );
}

function SubscriptionsTab() {
  const { subscriptions, cancelSubscription } = useData();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">{subscriptions.length} assinaturas no total</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)] uppercase tracking-wider">
              <th className="pb-3 pr-4 font-medium">Email</th>
              <th className="pb-3 pr-4 font-medium">Plano</th>
              <th className="pb-3 pr-4 font-medium">Origem</th>
              <th className="pb-3 pr-4 font-medium">Expira em</th>
              <th className="pb-3 pr-4 font-medium">Status</th>
              <th className="pb-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map(s => (
              <tr key={s.id} className="border-b border-[var(--border)] hover:bg-[var(--hover-overlay)] transition-colors">
                <td className="py-3 pr-4 text-[var(--text-secondary)]">{s.customer_email || s.email || "Sem email"}</td>
                <td className="py-3 pr-4 text-[var(--text-primary)]">{s.plan || "OPE Club"}</td>
                <td className="py-3 pr-4 text-[var(--text-primary)]">{s.provider || "manual"}</td>
                <td className="py-3 pr-4 text-[var(--text-secondary)]">
                  {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString("pt-BR") : "-"}
                </td>
                <td className="py-3 pr-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    s.status === "active" ? "bg-[var(--accent-mint)]/10 text-[var(--accent-mint)]" : "bg-red-500/10 text-red-400"
                  }`}>
                    {s.status === "active" ? "Ativa" : "Cancelada"}
                  </span>
                </td>
                <td className="py-3">
                  {s.status === "active" && (
                    <button onClick={() => cancelSubscription(s.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors">
                      Cancelar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsersTab() {
  const { profiles, subscriptions, upsertUserSubscription, updateUserSubscriptionDuration, removeUserSubscription } = useData();
  const [durationByUser, setDurationByUser] = useState({});
  const [savingUser, setSavingUser] = useState(null);

  const getSub = (userId) => subscriptions.find((sub) => sub.user_id === userId);

  async function activate(profile) {
    setSavingUser(profile.id);
    await upsertUserSubscription({
      userId: profile.id,
      email: profile.email,
      plan: "ope_club_monthly",
      status: "active",
      durationDays: durationByUser[profile.id] || 30,
    });
    setSavingUser(null);
  }

  async function remove(profile) {
    setSavingUser(profile.id);
    await removeUserSubscription(profile.id);
    setSavingUser(null);
  }

  async function changeDuration(profile, days) {
    setDurationByUser((prev) => ({ ...prev, [profile.id]: Number(days) }));
    const sub = getSub(profile.id);
    if (!sub) return;
    setSavingUser(profile.id);
    try {
      await updateUserSubscriptionDuration({ userId: profile.id, durationDays: Number(days) });
    } finally {
      setSavingUser(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">{profiles.length} usuários cadastrados</p>
      </div>

      <div className="overflow-x-auto rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)]">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wider text-[var(--text-muted)]">
              <th className="px-4 py-3 font-medium">Usuário</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Cargo</th>
              <th className="px-4 py-3 font-medium">Plano</th>
              <th className="px-4 py-3 font-medium">Expira em</th>
              <th className="px-4 py-3 font-medium">Duração</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => {
              const sub = getSub(profile.id);
              const active = isActiveSubscription(sub);
              return (
                <tr key={profile.id} className="border-b border-[var(--border)] last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--hover-overlay)] text-xs font-bold text-[var(--text-primary)]">
                        {profile.avatar?.startsWith("data:") || profile.avatar?.startsWith("http") ? (
                          <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
                        ) : (
                          profile.avatar || profile.name?.charAt(0) || "U"
                        )}
                      </div>
                      <span className="font-medium text-[var(--text-primary)]">{profile.name || "Sem nome"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{profile.email || "Sem email"}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{profile.role || "user"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-[var(--accent-mint)]/10 text-[var(--accent-mint)]" : "bg-[var(--hover-overlay)] text-[var(--text-muted)]"}`}>
                      {active ? "Ativo" : sub?.status || "Sem plano"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("pt-BR") : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={durationByUser[profile.id] || 30}
                      onChange={(e) => changeDuration(profile, e.target.value)}
                      className="rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-primary)]"
                    >
                      <option value={7}>7 dias</option>
                      <option value={30}>30 dias</option>
                      <option value={90}>90 dias</option>
                      <option value={180}>180 dias</option>
                      <option value={365}>365 dias</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => activate(profile)}
                        disabled={savingUser === profile.id}
                        className="rounded-full bg-[var(--text-primary)] px-3 py-1.5 text-xs font-medium text-[var(--bg-card)] disabled:opacity-50"
                      >
                        {active ? "Renovar" : "Adicionar plano"}
                      </button>
                      {sub && (
                        <button
                          onClick={() => remove(profile)}
                          disabled={savingUser === profile.id}
                          className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-red-400 disabled:opacity-50"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PostsTab() {
  const { posts, deletePost } = useData();
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">{posts.length} posts na comunidade</p>
      {posts.map(p => (
        <div key={p.id} className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-[var(--text-primary)]">{p.author}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--hover-overlay)] text-[var(--text-muted)] border border-[var(--border)]">{p.tag}</span>
                <span className="text-xs text-[var(--text-muted)]">{p.time}</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] line-clamp-2">{p.text}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-muted)]">
                <span>{p.likes} curtidas</span>
                <span>{p.replies} respostas</span>
              </div>
            </div>
            <button onClick={() => deletePost(p.id)}
              className="shrink-0 size-8 rounded-full flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function WeeklyReleasesTab() {
  const { books, weeklyReleases, addWeeklyRelease, deleteWeeklyRelease } = useData();
  const [form, setForm] = useState({ bookId: "", releaseDate: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!form.bookId || !form.releaseDate || saving) return;
    setSaving(true);
    setError("");
    try {
      await addWeeklyRelease({
        bookId: form.bookId,
        releaseDate: form.releaseDate,
        note: form.note,
      });
      setForm({ bookId: "", releaseDate: "", note: "" });
    } catch (err) {
      setError(err?.message || "Não foi possível salvar o lançamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Novo lançamento semanal</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Livro</label>
            <select
              value={form.bookId}
              onChange={(event) => setForm((prev) => ({ ...prev, bookId: event.target.value }))}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
            >
              <option value="">Selecione</option>
              {books.map((book) => (
                <option key={book.id} value={book.id}>{book.title}</option>
              ))}
            </select>
          </div>
          <FormField label="Data de liberação" type="date" value={form.releaseDate} onChange={(value) => setForm((prev) => ({ ...prev, releaseDate: value }))} />
          <FormField label="Observação" value={form.note} onChange={(value) => setForm((prev) => ({ ...prev, note: value }))} placeholder="Ex: estreia de sexta" />
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !form.bookId || !form.releaseDate}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-card)] disabled:opacity-50"
        >
          <Plus className="size-4" /> {saving ? "Salvando..." : "Adicionar lançamento"}
        </button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <div className="space-y-3">
        {weeklyReleases.map((release) => {
          const book = release.books || books.find((item) => item.id === release.book_id);
          return (
            <div key={release.id} className="flex items-center gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <div className="h-16 w-11 shrink-0 overflow-hidden rounded-[6px] bg-[var(--hover-overlay)]">
                {book?.image ? <img src={book.image} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--text-primary)]">{book?.title || "Livro removido"}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Libera em {new Date(`${release.release_date}T00:00:00`).toLocaleDateString("pt-BR")}
                </p>
                {release.note && <p className="mt-1 text-xs text-[var(--text-secondary)]">{release.note}</p>}
              </div>
              <button
                onClick={() => deleteWeeklyRelease(release.id)}
                className="flex size-8 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BooksTab() {
  const { books, authors, addBook, updateBook, deleteBook } = useData();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ title: "", authorId: "", image: "", pdfFile: "", category: "" });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  function openNew() {
    setEditId(null);
    setForm({ title: "", authorId: authors[0]?.id || "", image: "", pdfFile: "", category: "" });
    setShowForm(true);
  }

  function openEdit(book) {
    setEditId(book.id);
    setForm({ title: book.title, authorId: book.author_id || book.authorId || "", image: book.image || "", pdfFile: book.pdf_url || book.pdfFile || "", category: book.category || "" });
    setShowForm(true);
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") { alert("Selecione um arquivo PDF."); return; }
    if (!isSupabaseReady()) {
      setError("Supabase não está configurado. Não foi possível enviar o PDF.");
      return;
    }

    setError("");
    setUploading(true);

    try {
      const safeTitle = (form.title || file.name.replace(/\.pdf$/i, "livro"))
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "livro";
      const filePath = `books/${safeTitle}-${Date.now()}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("pdfs")
        .upload(filePath, file, {
          cacheControl: "3600",
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("pdfs").getPublicUrl(filePath);
      setForm(p => ({ ...p, pdfFile: data.publicUrl }));
    } catch (err) {
      setError(err?.message || "Não foi possível enviar o PDF para o Supabase Storage.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    setError("");
    try {
      if (editId) {
        await updateBook(editId, form);
      } else {
        await addBook(form);
      }
      setShowForm(false);
      setEditId(null);
      setForm({ title: "", authorId: "", image: "", pdfFile: "", category: "" });
    } catch (err) {
      setError(err?.message || "Não foi possível salvar o livro. Confira as permissões no Supabase.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">{books.length} livros cadastrados</p>
        <button onClick={openNew}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--text-primary)] text-[var(--bg-card)] text-sm font-medium hover:opacity-90 transition-all">
          <Plus className="size-4" /> Novo livro
        </button>
      </div>

      {showForm && (
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{editId ? "Editar" : "Novo"} livro</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Título" value={form.title} onChange={v => setForm(p => ({ ...p, title: v }))} placeholder="Crime e Castigo" />
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Autor</label>
              <select value={form.authorId} onChange={e => setForm(p => ({ ...p, authorId: e.target.value }))}
                className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]">
                <option value="">Selecione um autor</option>
                {authors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <FormField label="URL da imagem (capa)" value={form.image} onChange={v => setForm(p => ({ ...p, image: v }))} placeholder="/livros/capa.jpg" />
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Categoria</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]">
                <option value="">Sem categoria</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Arquivo PDF</label>
              <div className="flex items-center gap-2">
                <label className="flex-1 flex items-center gap-2 px-3 py-2 rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text-muted)] cursor-pointer hover:border-[var(--border-strong)] transition-colors">
                  <input type="file" accept=".pdf,application/pdf" onChange={handleFileUpload} className="hidden" />
                  {uploading ? "Carregando..." : form.pdfFile ? "PDF anexado" : "Selecionar PDF"}
                </label>
                {form.pdfFile && (
                  <button onClick={() => setForm(p => ({ ...p, pdfFile: "" }))}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors shrink-0">
                    Remover
                  </button>
                )}
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">O PDF será enviado ao Supabase Storage e aberto dentro do app.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--text-primary)] text-[var(--bg-card)] text-sm font-medium hover:opacity-90 transition-all">
              <Check className="size-4" /> Salvar
            </button>
            <button onClick={() => setShowForm(false)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">
              Cancelar
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {books.map(book => {
          const author = authors.find(a => a.id === (book.author_id || book.authorId));
          return (
            <div key={book.id} className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4 flex gap-3">
              <div className="w-12 h-16 rounded-[6px] overflow-hidden shrink-0 bg-[var(--hover-overlay)]">
                {book.image ? <img src={book.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-xs">Sem img</div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{book.title}</p>
                <p className="text-xs text-[var(--text-muted)]">{author?.name || book.authorName || "Sem autor"}</p>
                <div className="flex items-center gap-2 mt-1">
                  {book.progress != null && <p className="text-[10px] text-[var(--text-muted)]">{book.progress}% completo</p>}
                  {(book.pdf_url || book.pdfFile) && <span className="text-[10px] text-blue-400 font-medium">PDF</span>}
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button onClick={() => openEdit(book)} className="size-7 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] transition-all">
                  <Edit3 className="size-3.5" />
                </button>
                <button onClick={() => deleteBook(book.id)} className="size-7 rounded-full flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-all">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AuthorsTab() {
  const { authors, books, addAuthor, updateAuthor, deleteAuthor, getBooksByAuthor } = useData();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", theme: "", era: "", image: "" });
  const [error, setError] = useState("");

  function openNew() {
    setEditId(null);
    setForm({ name: "", theme: "", era: "", image: "" });
    setShowForm(true);
  }

  function openEdit(author) {
    setEditId(author.id);
    setForm({ name: author.name, theme: author.theme, era: author.era, image: author.image });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setError("");
    try {
      if (editId) {
        await updateAuthor(editId, form);
      } else {
        await addAuthor(form);
      }
      setShowForm(false);
      setEditId(null);
      setForm({ name: "", theme: "", era: "", image: "" });
    } catch (err) {
      setError(err?.message || "Não foi possível salvar o autor. Confira as permissões no Supabase.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">{authors.length} autores cadastrados</p>
        <button onClick={openNew}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--text-primary)] text-[var(--bg-card)] text-sm font-medium hover:opacity-90 transition-all">
          <Plus className="size-4" /> Novo autor
        </button>
      </div>

      {showForm && (
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{editId ? "Editar" : "Novo"} autor</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Nome" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="Friedrich Nietzsche" />
            <FormField label="Corrente/Tema" value={form.theme} onChange={v => setForm(p => ({ ...p, theme: v }))} placeholder="Existencialismo" />
            <FormField label="Época" value={form.era} onChange={v => setForm(p => ({ ...p, era: v }))} placeholder="século XIX" />
            <FormField label="URL da imagem" value={form.image} onChange={v => setForm(p => ({ ...p, image: v }))} placeholder="/autores/nietzsche.jpg" />
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--text-primary)] text-[var(--bg-card)] text-sm font-medium hover:opacity-90 transition-all">
              <Check className="size-4" /> Salvar
            </button>
            <button onClick={() => setShowForm(false)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">
              Cancelar
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {authors.map(author => {
          const authorBooks = getBooksByAuthor(author.id);
          return (
            <div key={author.id} className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-12 rounded-[10px] overflow-hidden shrink-0 bg-[var(--hover-overlay)]">
                    {author.image ? <img src={author.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-xs">{author.name.charAt(0)}</div>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{author.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{author.theme} · {author.era}</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">{authorBooks.length} livros</p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(author)} className="size-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] transition-all">
                    <Edit3 className="size-3.5" />
                  </button>
                  <button onClick={() => deleteAuthor(author.id)} className="size-8 rounded-full flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-all">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
              {authorBooks.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[var(--border)]">
                  <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">Livros</p>
                  <div className="flex flex-wrap gap-1.5">
                    {authorBooks.map(b => (
                      <span key={b.id} className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--hover-overlay)] text-[var(--text-secondary)]">{b.title}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdminPage() {
  const { isAdmin, user } = useAuth();
  const [activeTab, setActiveTab] = useState("users");

  const TabIcon = tabs.find(t => t.id === activeTab)?.icon || Crown;

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <ShieldAlert className="size-12 text-[var(--text-muted)]" />
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Acesso restrito</h2>
        <p className="text-sm text-[var(--text-muted)] text-center max-w-sm">
          Apenas administradores podem acessar o painel. Se você é admin, certifique-se de que sua conta tem a permissão correta.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">Admin</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Gerencie usuários, assinaturas, posts, livros e autores.</p>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-[var(--border)]" style={{ scrollbarWidth: "none" }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 shrink-0 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                isActive ? "text-[var(--text-primary)] border-[var(--text-primary)]" : "text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]"
              }`}>
              <Icon className="size-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div>
        {activeTab === "users" && <UsersTab />}
        {activeTab === "subscriptions" && <SubscriptionsTab />}
        {activeTab === "posts" && <PostsTab />}
        {activeTab === "releases" && <WeeklyReleasesTab />}
        {activeTab === "books" && <BooksTab />}
        {activeTab === "authors" && <AuthorsTab />}
      </div>
    </div>
  );
}
