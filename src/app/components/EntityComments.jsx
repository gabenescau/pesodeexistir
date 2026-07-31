import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Send, Trash2 } from "@/lib/icons";
import { useAuth } from "@/app/data/AuthContext";
import { useData } from "@/app/data/DataContext";
import { isSupabaseReady, supabase } from "@/app/data/supabase";
import { handleDoPerfil } from "@/lib/mentions";
import { sanitizePlainText } from "@/lib/sanitize";
import { toast } from "@/lib/toast";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";

const LIMITE_TEXTO = 1000;

function tempoRelativo(iso) {
  if (!iso) return "agora";
  const diff = Date.now() - new Date(iso).getTime();
  const minutos = Math.floor(diff / 60000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 30) return `${dias} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

function Avatar({ src, fallback }) {
  const [quebrada, setQuebrada] = useState(false);
  const ehImagem = !quebrada && (src?.startsWith?.("http") || src?.startsWith?.("data:"));

  return (
    <div className="size-8 shrink-0 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--hover-overlay)] text-xs font-semibold text-[var(--text-primary)]">
      {ehImagem ? (
        <img src={src} alt="" className="h-full w-full object-cover" onError={() => setQuebrada(true)} />
      ) : (
        <div className="flex h-full w-full items-center justify-center">{fallback || "L"}</div>
      )}
    </div>
  );
}

// Comentarios de uma entidade (livro ou autor). Reaproveita a tabela
// `post_replies` (que ja existe) criando um "post ancora" lazy por entidade,
// com tag `entity-thread:book:UUID` ou `entity-thread:author:UUID`. A politica
// de SELECT do feed ja filtra `tag LIKE 'entity-thread:%'` para que o post
// nao apareca na comunidade. Isso evita precisar de migration nova no
// Supabase: usa so tabelas e policies que ja existem.
export function EntityComments({ targetType, targetId, emptyMessage = "Seja o primeiro a comentar." }) {
  const { user, isAdmin } = useAuth();
  const { profiles } = useData();
  const confirm = useConfirmDialog();
  const [threadPostId, setThreadPostId] = useState(null);
  const [comentarios, setComentarios] = useState([]);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const perfil = (userId) => profiles.find((p) => p.id === userId);

  // Busca (ou cria) o post ancora desta entidade. Cacheia em localStorage
  // para nao re-checar o banco em toda navegacao.
  const ensureThread = useCallback(async () => {
    if (!isSupabaseReady() || !user?.id || !targetId) return null;
    const tag = `entity-thread:${targetType}:${targetId}`;
    const cacheKey = `ope:thread:${tag}`;

    try {
      const cached = window.localStorage.getItem(cacheKey);
      if (cached) {
        setThreadPostId(cached);
        return cached;
      }
    } catch {
      // localStorage bloqueado: segue para a busca no banco.
    }

    const { data: existente, error: errBusca } = await supabase
      .from("posts")
      .select("id")
      .eq("tag", tag)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (errBusca) throw errBusca;
    if (existente?.id) {
      try { window.localStorage.setItem(cacheKey, existente.id); } catch { /* ignore */ }
      setThreadPostId(existente.id);
      return existente.id;
    }

    const { data: criado, error: errCria } = await supabase
      .from("posts")
      .insert({
        user_id: user.id,
        text: `[thread] Discussao sobre ${targetType === "book" ? "este livro" : "este autor"}`,
        tag,
      })
      .select("id")
      .single();
    if (errCria) throw errCria;
    try { window.localStorage.setItem(cacheKey, criado.id); } catch { /* ignore */ }
    setThreadPostId(criado.id);
    return criado.id;
  }, [user?.id, targetId, targetType]);

  const carregar = useCallback(async () => {
    if (!isSupabaseReady() || !user?.id) {
      setComentarios([]);
      setCarregando(false);
      return;
    }
    setCarregando(true);
    const id = await ensureThread();
    if (!id) {
      setComentarios([]);
      setCarregando(false);
      return;
    }
    const { data, error } = await supabase
      .from("post_replies")
      .select("*")
      .eq("post_id", id)
      .order("created_at", { ascending: true });
    if (error) {
      setComentarios([]);
    } else {
      setComentarios(data || []);
    }
    setErro("");
    setCarregando(false);
  }, [ensureThread, user?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function publicar() {
    const conteudo = sanitizePlainText(texto, LIMITE_TEXTO);
    if (!conteudo || enviando) return;
    if (!user?.id) {
      setErro("Entre na sua conta para comentar.");
      return;
    }
    setEnviando(true);
    setErro("");
    try {
      const id = threadPostId || (await ensureThread());
      if (!id) throw new Error("Nao foi possivel abrir a discussao desta entidade.");
      const { data, error } = await supabase
        .from("post_replies")
        .insert({ post_id: id, user_id: user.id, text: conteudo, parent_id: null })
        .select()
        .single();
      if (error) throw error;
      setComentarios((atual) => [...atual, data]);
      setTexto("");
      toast.success("Comentario publicado.");
    } catch (err) {
      const message = err?.message || "Nao foi possivel publicar o comentario.";
      setErro(message);
      toast.error(message);
    } finally {
      setEnviando(false);
    }
  }

  async function apagar(id) {
    const ok = await confirm.ask({
      title: "Apagar comentario?",
      description: "Este comentario sera removido permanentemente.",
      confirmLabel: "Apagar",
      danger: true,
    });
    if (!ok) return;
    const anterior = comentarios;
    setComentarios((atual) => atual.filter((item) => item.id !== id));
    const { error } = await supabase
      .from("post_replies")
      .delete()
      .eq("id", id);
    if (error) {
      setComentarios(anterior);
      toast.error("Nao foi possivel apagar o comentario.");
    } else {
      toast.success("Comentario removido.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="size-4 text-[var(--text-muted)]" />
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Comentarios ({comentarios.length})
        </h3>
      </div>

      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-3">
        <textarea
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
          maxLength={LIMITE_TEXTO}
          rows={2}
          placeholder="Deixe um comentario..."
          className="w-full resize-none bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-placeholder)]"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[10px] text-[var(--text-muted)]">
            {texto.length}/{LIMITE_TEXTO}
          </span>
          <button
            type="button"
            onClick={publicar}
            disabled={!texto.trim() || enviando}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--text-primary)] px-4 text-xs font-medium text-[var(--bg-card)] disabled:opacity-40"
          >
            <Send className="size-3.5" />
            {enviando ? "Enviando..." : "Comentar"}
          </button>
        </div>
        {erro && <p className="mt-2 text-xs text-red-400">{erro}</p>}
      </div>

      {carregando ? (
        <p className="text-xs text-[var(--text-muted)]">Carregando comentarios...</p>
      ) : comentarios.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-[var(--border)] p-6 text-center text-xs text-[var(--text-muted)]">
          {emptyMessage}
        </p>
      ) : (
        <ul className="space-y-3">
          {comentarios.map((comentario) => {
            const autor = perfil(comentario.user_id);
            const podeApagar = isAdmin || comentario.user_id === user?.id;
            return (
              <li
                key={comentario.id}
                className="flex gap-3 rounded-[10px] border border-[var(--border)] bg-[var(--bg-card)] p-3"
              >
                <Link to={`/app/perfil/${comentario.user_id}`} className="shrink-0">
                  <Avatar
                    src={autor?.avatar}
                    fallback={autor?.name?.charAt(0).toUpperCase() || comentario.user_id?.charAt(0).toUpperCase() || "L"}
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Link
                      to={`/app/perfil/${comentario.user_id}`}
                      className="font-medium text-[var(--text-primary)] hover:underline"
                    >
                      {autor?.name || "Leitor"}
                    </Link>
                    <span className="text-[var(--text-muted)]">@{handleDoPerfil(autor)}</span>
                    <span className="text-[var(--text-muted)]">· {tempoRelativo(comentario.created_at)}</span>
                    {podeApagar && (
                      <button
                        type="button"
                        onClick={() => apagar(comentario.id)}
                        className="ml-auto shrink-0 text-[var(--text-muted)] hover:text-red-400"
                        aria-label="Apagar comentario"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--text-secondary)]">
                    {comentario.text}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {confirm.dialog}
    </div>
  );
}
