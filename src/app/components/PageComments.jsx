import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { useAuth } from "@/app/data/AuthContext";
import { useData } from "@/app/data/DataContext";
import { isSupabaseReady, supabase } from "@/app/data/supabase";
import { handleDoPerfil } from "@/lib/mentions";
import { EmojiReactions } from "./EmojiReactions";
import { RichText } from "./RichText";
import { UserTitlePill } from "./UserTitlePill";

const LIMITE_TEXTO = 2000;

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

// Discussao presa a UMA pagina do livro: cada pagina tem a sua conversa.
export function PageComments({ bookId, pageNumber }) {
  const { user, isAdmin } = useAuth();
  const { profiles } = useData();
  const [comentarios, setComentarios] = useState([]);
  const [reacoesPorComentario, setReacoesPorComentario] = useState({});
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!isSupabaseReady() || !bookId || !pageNumber) {
      setComentarios([]);
      setCarregando(false);
      return;
    }

    setCarregando(true);
    const { data, error } = await supabase
      .from("book_page_comments")
      .select("*")
      .eq("book_id", bookId)
      .eq("page_number", pageNumber)
      .order("created_at", { ascending: true });

    if (error) {
      setErro("Não foi possível carregar os comentários desta página.");
      setComentarios([]);
      setCarregando(false);
      return;
    }

    setComentarios(data || []);
    setErro("");
    setCarregando(false);

    // Uma consulta so para as reacoes de todos os comentarios da pagina,
    // em vez de uma por comentario.
    const ids = (data || []).map((item) => item.id);
    if (ids.length === 0) {
      setReacoesPorComentario({});
      return;
    }

    const { data: reacoes } = await supabase
      .from("reactions")
      .select("target_id, user_id, emoji")
      .eq("target_type", "book_comment")
      .in("target_id", ids);

    const agrupadas = {};
    for (const reacao of reacoes || []) {
      (agrupadas[reacao.target_id] ||= []).push(reacao);
    }
    setReacoesPorComentario(agrupadas);
  }, [bookId, pageNumber]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function publicar() {
    const conteudo = texto.trim();
    if (!conteudo || enviando) return;

    if (!user?.id) {
      setErro("Entre na sua conta para comentar.");
      return;
    }

    setEnviando(true);
    setErro("");
    try {
      const { data, error } = await supabase
        .from("book_page_comments")
        .insert({ book_id: bookId, page_number: pageNumber, user_id: user.id, text: conteudo })
        .select()
        .single();

      if (error) throw error;
      setComentarios((atual) => [...atual, data]);
      setTexto("");
    } catch (err) {
      setErro(err?.message || "Não foi possível publicar seu comentário.");
    } finally {
      setEnviando(false);
    }
  }

  async function apagar(id) {
    const anterior = comentarios;
    setComentarios((atual) => atual.filter((item) => item.id !== id));
    const { error } = await supabase.from("book_page_comments").delete().eq("id", id);
    if (error) {
      setComentarios(anterior);
      setErro("Não foi possível apagar o comentário.");
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl">
      <header className="flex items-center justify-between gap-2 pb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <MessageCircle className="size-4" />
          Comentários da página {pageNumber}
        </h2>
        <span className="text-xs text-[var(--text-muted)]">{comentarios.length}</span>
      </header>

      <div className="flex items-end gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-2">
        <textarea
          value={texto}
          maxLength={LIMITE_TEXTO}
          onChange={(event) => setTexto(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) publicar();
          }}
          rows={2}
          placeholder={`O que você achou desta página? Use @ para marcar alguém`}
          className="min-h-11 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-placeholder)]"
        />
        <button
          type="button"
          onClick={publicar}
          disabled={!texto.trim() || enviando}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--bg-card)] disabled:opacity-40"
          aria-label="Publicar comentário"
        >
          <Send className="size-4" />
        </button>
      </div>

      {erro && <p className="mt-2 text-xs text-red-400">{erro}</p>}

      <div className="mt-4 space-y-3">
        {carregando && <p className="text-xs text-[var(--text-muted)]">Carregando comentários...</p>}

        {!carregando && comentarios.length === 0 && (
          <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-xs text-[var(--text-muted)]">
            Nenhum comentário nesta página ainda. Seja o primeiro.
          </p>
        )}

        {comentarios.map((comentario) => {
          const perfil = profiles.find((item) => item.id === comentario.user_id);
          const nome = perfil?.name || "Leitor";
          const podeApagar = isAdmin || comentario.user_id === user?.id;

          return (
            <article key={comentario.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
              <div className="flex items-start gap-3">
                <Avatar src={perfil?.avatar} fallback={nome.charAt(0).toUpperCase()} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <Link
                      to={`/app/perfil/${comentario.user_id}`}
                      className="truncate text-sm font-medium text-[var(--text-primary)] hover:underline"
                    >
                      {nome}
                    </Link>
                    <UserTitlePill userId={comentario.user_id} />
                    <span className="truncate text-xs text-[var(--text-muted)]">@{handleDoPerfil(perfil)}</span>
                    <span className="text-xs text-[var(--text-muted)]">· {tempoRelativo(comentario.created_at)}</span>
                  </div>

                  <RichText
                    text={comentario.text}
                    className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--text-secondary)]"
                  />

                  <div className="mt-2">
                    <EmojiReactions
                      targetType="book_comment"
                      targetId={comentario.id}
                      reacoesIniciais={reacoesPorComentario[comentario.id] || []}
                    />
                  </div>
                </div>

                {podeApagar && (
                  <button
                    type="button"
                    onClick={() => apagar(comentario.id)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-400"
                    aria-label="Apagar comentário"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
