import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Heart, Lightbulb, MessageSquare, Plus, Send, Trash2, X } from "@/lib/icons";
import { useAuth } from "@/app/data/AuthContext";
import { supabase, isSupabaseReady } from "../data/supabase";
import { sanitizePlainText, sanitizeSingleLine } from "@/lib/sanitize";
import { toast } from "@/lib/toast";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";

const columns = [
  { id: "ideas", title: "Ideias da comunidade", accent: "#9ca3af" },
  { id: "reading", title: "Em avaliacao", accent: "#facc15" },
  { id: "building", title: "Em preparo", accent: "#0f766e" },
  { id: "released", title: "Publicado", accent: "#84cc16" },
];

const categoryOptions = ["Biblioteca", "Comunidade", "Leitura", "Planos", "Perfil"];

// Likes por sessao (localStorage). Servidor-sync pede migration nova;
// ate la, o contador reflete quantas pessoas *neste navegador* curtiram.
const LIKES_STORAGE_KEY = "ope:suggestion-likes";
function carregarLikes() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(LIKES_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}
function salvarLikes(mapa) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LIKES_STORAGE_KEY, JSON.stringify(mapa));
  } catch {
    // localStorage bloqueado: ignora.
  }
}

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

function statusIndex(status) {
  return Math.max(0, columns.findIndex((column) => column.id === status));
}

function SuggestionCard({ suggestion, canManage, onMove, onDelete, onLike, liked, likeCount, moving }) {
  const index = statusIndex(suggestion.status);
  const author = suggestion.author_name || "Leitor";

  return (
    <article className="rounded-[8px] border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--text-primary)]">{suggestion.title}</p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">{author} · {suggestion.category || "Geral"}</p>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--hover-overlay)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
          #{String(suggestion.id).slice(0, 4)}
        </span>
      </div>

      {suggestion.description && (
        <p className="line-clamp-4 text-sm leading-6 text-[var(--text-secondary)]">{suggestion.description}</p>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <MessageSquare className="size-3.5" />
            {suggestion.comment_count || 0}
          </span>
          <button
            type="button"
            onClick={() => onLike(suggestion)}
            aria-pressed={liked}
            aria-label={liked ? "Tirar curtida" : "Curtir"}
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors ${
              liked
                ? "bg-[#c78359]/10 text-[#c78359]"
                : "text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Heart className="size-3.5" weight={liked ? "fill" : "regular"} />
            <span className="text-xs font-medium">{likeCount || 0}</span>
          </button>
        </div>

        {canManage && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Mover para a coluna anterior"
              disabled={moving || index === 0}
              onClick={() => onMove(suggestion, columns[index - 1].id)}
              className="flex size-8 items-center justify-center rounded-[6px] border border-[var(--border)] text-[var(--text-secondary)] disabled:opacity-40"
            >
              <ArrowLeft className="size-4" />
            </button>
            <button
              type="button"
              title="Mover para a proxima coluna"
              disabled={moving || index === columns.length - 1}
              onClick={() => onMove(suggestion, columns[index + 1].id)}
              className="flex size-8 items-center justify-center rounded-[6px] border border-[var(--border)] text-[var(--text-secondary)] disabled:opacity-40"
            >
              <ArrowRight className="size-4" />
            </button>
            <button
              type="button"
              title="Excluir sugestao"
              disabled={moving}
              onClick={() => onDelete(suggestion)}
              className="flex size-8 items-center justify-center rounded-[6px] border border-[var(--border)] text-red-400 transition-colors hover:border-red-500/40 hover:bg-red-500/10 disabled:opacity-40"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function SuggestionForm({ open, onClose, onCreated }) {
  const { user, profile } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(categoryOptions[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function submit() {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError("");

    try {
      if (!isSupabaseReady()) throw new Error("Supabase nao configurado.");
      const cleanTitle = sanitizeSingleLine(title, 90);
      const cleanDescription = sanitizePlainText(description, 500);
      if (!cleanTitle) throw new Error("Digite um titulo para a sugestao.");
      const payload = {
        user_id: user.id,
        title: cleanTitle,
        description: cleanDescription,
        category: categoryOptions.includes(category) ? category : categoryOptions[0],
        status: "ideas",
        author_name: profile?.name || user?.user_metadata?.name || "Leitor",
      };
      const { data, error: insertError } = await supabase
        .from("suggestions")
        .insert(payload)
        .select("*")
        .single();
      if (insertError) throw insertError;
      onCreated(data);
      setTitle("");
      setDescription("");
      setCategory(categoryOptions[0]);
      onClose();
    } catch (err) {
      setError(err?.message || "Nao foi possivel enviar a sugestao.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center">
      <div className="w-full max-w-lg rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Nova sugestao</h2>
            <p className="text-sm text-[var(--text-muted)]">Conte o que melhoraria sua leitura no OPE Club.</p>
          </div>
          <button type="button" onClick={onClose} className="flex size-9 items-center justify-center rounded-[8px] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)]">
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-3">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={90}
            placeholder="Ex: lista de leitura por tema"
            className="h-11 w-full rounded-[8px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-placeholder)]"
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={500}
            rows={5}
            placeholder="Descreva sua ideia em poucas linhas"
            className="w-full resize-none rounded-[8px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-placeholder)]"
          />
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-11 w-full rounded-[8px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3 text-sm text-[var(--text-primary)] outline-none"
          >
            {categoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="h-11 rounded-full border border-[var(--border)] px-5 text-sm text-[var(--text-secondary)]">
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || !title.trim()}
            onClick={submit}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--text-primary)] px-5 text-sm font-medium text-[var(--bg-card)] disabled:opacity-50"
          >
            <Send className="size-4" />
            {saving ? "Enviando..." : "Enviar sugestao"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SuggestionsPage() {
  const { canManageContent } = useAuth();
  const confirm = useConfirmDialog();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [movingId, setMovingId] = useState("");
  const [error, setError] = useState("");
  const [likes, setLikes] = useState(() => carregarLikes());

  function toggleLike(suggestion) {
    setLikes((atual) => {
      const prox = { ...atual };
      const liked = !!prox[suggestion.id];
      if (liked) {
        delete prox[suggestion.id];
      } else {
        prox[suggestion.id] = true;
      }
      salvarLikes(prox);
      return prox;
    });
  }

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        if (!isSupabaseReady()) throw new Error("Supabase nao configurado.");
        const { data, error: queryError } = await supabase
          .from("suggestions")
          .select("*")
          .order("created_at", { ascending: false });
        if (queryError) throw queryError;
        if (alive) setSuggestions(data || []);
      } catch (err) {
        if (alive) setError(err?.message || "Nao foi possivel carregar sugestoes.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  const byColumn = useMemo(() => {
    const grouped = Object.fromEntries(columns.map((column) => [column.id, []]));
    suggestions.forEach((suggestion) => {
      const key = grouped[suggestion.status] ? suggestion.status : "ideas";
      grouped[key].push(suggestion);
    });
    return grouped;
  }, [suggestions]);

  async function moveSuggestion(suggestion, status) {
    if (!canManageContent || !status || suggestion.status === status) return;
    setMovingId(suggestion.id);
    setError("");
    try {
      const updated = await authenticatedApiPost("/api/admin-suggestion", {
        action: "move",
        suggestionId: suggestion.id,
        status,
      });
      setSuggestions((current) => current.map((item) => item.id === updated.id ? updated : item));
      toast.success("Sugestao movida para a nova coluna.");
    } catch (err) {
      const message = err?.message || "Nao foi possivel mover a sugestao.";
      setError(message);
      toast.error(message);
    } finally {
      setMovingId("");
    }
  }

  async function deleteSuggestion(suggestion) {
    if (!canManageContent) return;
    const ok = await confirm.ask({
      title: "Excluir sugestao?",
      description: `Excluir a sugestao "${suggestion.title}"? Essa acao nao pode ser desfeita.`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    setMovingId(suggestion.id);
    setError("");
    try {
      await authenticatedApiPost("/api/admin-suggestion", {
        action: "delete",
        suggestionId: suggestion.id,
      });
      setSuggestions((current) => current.filter((item) => item.id !== suggestion.id));
      toast.success("Sugestao excluida.");
    } catch (err) {
      const message = err?.message || "Nao foi possivel excluir a sugestao.";
      setError(message);
      toast.error(message);
    } finally {
      setMovingId("");
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[24px] font-[600] leading-[32px] tracking-[-0.96px] text-[var(--text-primary)]">Sugestoes</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Ideias da comunidade para melhorar leitura, biblioteca e experiencia do clube.</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--text-primary)] px-5 text-sm font-medium text-[var(--bg-card)] sm:w-auto"
        >
          <Plus className="size-4" />
          Adicionar sugestao
        </button>
      </div>

      {error && <p className="rounded-[8px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>}

      <div className="grid gap-3 lg:grid-cols-4">
        {columns.map((column) => (
          <section key={column.id} className="min-w-0 rounded-[10px] bg-[var(--hover-overlay)] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-6 w-1 rounded-full" style={{ background: column.accent }} />
                <h2 className="truncate text-sm font-semibold text-[var(--text-primary)]">{column.title}</h2>
              </div>
              <span className="rounded-full bg-[var(--bg-card)] px-2 py-0.5 text-xs text-[var(--text-muted)]">{byColumn[column.id]?.length || 0}</span>
            </div>

            <div className="space-y-3">
              {loading ? (
                <div className="rounded-[8px] border border-[var(--border)] bg-[var(--bg-card)] p-4 text-sm text-[var(--text-muted)]">Carregando...</div>
              ) : byColumn[column.id]?.length ? (
                byColumn[column.id].map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    canManage={canManageContent}
                    moving={movingId === suggestion.id}
                    onMove={moveSuggestion}
                    onDelete={deleteSuggestion}
                    onLike={toggleLike}
                    liked={!!likes[suggestion.id]}
                    likeCount={(suggestion.like_count || 0) + (likes[suggestion.id] ? 1 : 0)}
                  />
                ))
              ) : (
                <div className="rounded-[8px] border border-dashed border-[var(--border)] p-4 text-center text-sm text-[var(--text-muted)]">
                  <Lightbulb className="mx-auto mb-2 size-5" />
                  Nenhuma sugestao aqui.
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      <SuggestionForm
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(suggestion) => setSuggestions((current) => [suggestion, ...current])}
      />
      {confirm.dialog}
    </div>
  );
}
