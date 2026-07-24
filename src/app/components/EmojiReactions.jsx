import { useEffect, useState } from "react";
import { SmilePlus } from "lucide-react";
import { useAuth } from "@/app/data/AuthContext";
import { isSupabaseReady, supabase } from "@/app/data/supabase";

// Mesma lista do CHECK constraint em public.reactions (migration 00011).
// Mudar aqui sem mudar la faz o insert voltar 23514.
export const EMOJIS = ["❤️", "🔥", "😂", "😮", "😢", "👏", "🤔", "📖"];

function agrupar(reacoes, meuId) {
  const mapa = new Map();
  for (const reacao of reacoes) {
    const atual = mapa.get(reacao.emoji) || { emoji: reacao.emoji, total: 0, minha: false };
    atual.total += 1;
    if (reacao.user_id === meuId) atual.minha = true;
    mapa.set(reacao.emoji, atual);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}

export function EmojiReactions({ targetType, targetId, reacoesIniciais = null }) {
  const { user } = useAuth();
  const [reacoes, setReacoes] = useState(reacoesIniciais || []);
  const [carregado, setCarregado] = useState(Boolean(reacoesIniciais));
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (reacoesIniciais) {
      setReacoes(reacoesIniciais);
      setCarregado(true);
    }
  }, [reacoesIniciais]);

  useEffect(() => {
    let ativo = true;
    if (carregado || !isSupabaseReady() || !targetId) return undefined;

    supabase
      .from("reactions")
      .select("user_id, emoji")
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .then(({ data, error }) => {
        if (!ativo || error) return;
        setReacoes(data || []);
        setCarregado(true);
      });

    return () => {
      ativo = false;
    };
  }, [targetType, targetId, carregado]);

  async function alternar(emoji) {
    if (!user?.id || ocupado) return;
    const jaTenho = reacoes.some((item) => item.emoji === emoji && item.user_id === user.id);
    const anterior = reacoes;

    setAberto(false);
    setReacoes((atual) =>
      jaTenho
        ? atual.filter((item) => !(item.emoji === emoji && item.user_id === user.id))
        : [...atual, { user_id: user.id, emoji }]
    );

    if (!isSupabaseReady()) return;
    setOcupado(true);
    try {
      if (jaTenho) {
        const { error } = await supabase
          .from("reactions")
          .delete()
          .eq("user_id", user.id)
          .eq("target_type", targetType)
          .eq("target_id", targetId)
          .eq("emoji", emoji);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reactions").insert({
          user_id: user.id,
          target_type: targetType,
          target_id: targetId,
          emoji,
        });
        // 23505 = ja existia (clique duplo / outra aba): estado otimista ja esta certo.
        if (error && error.code !== "23505") throw error;
      }
    } catch {
      setReacoes(anterior);
    } finally {
      setOcupado(false);
    }
  }

  const grupos = agrupar(reacoes, user?.id);

  return (
    <div className="relative flex flex-wrap items-center gap-1.5">
      {grupos.map((grupo) => (
        <button
          key={grupo.emoji}
          type="button"
          onClick={() => alternar(grupo.emoji)}
          className={`flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition-colors ${
            grupo.minha
              ? "border-[#c78359]/50 bg-[#c78359]/12 text-[#c78359]"
              : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)]"
          }`}
          aria-label={`Reagir com ${grupo.emoji}`}
        >
          <span className="text-sm leading-none">{grupo.emoji}</span>
          <span>{grupo.total}</span>
        </button>
      ))}

      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        className="flex size-7 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
        aria-label="Adicionar reação"
        aria-expanded={aberto}
      >
        <SmilePlus className="size-4" />
      </button>

      {aberto && (
        <>
          <button
            type="button"
            aria-label="Fechar seletor de emoji"
            onClick={() => setAberto(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute bottom-9 left-0 z-20 flex max-w-[min(20rem,80vw)] flex-wrap gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-2 shadow-[0_18px_45px_rgba(0,0,0,.28)]">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => alternar(emoji)}
                className="flex size-9 items-center justify-center rounded-lg text-lg transition-colors hover:bg-[var(--hover-overlay)]"
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
