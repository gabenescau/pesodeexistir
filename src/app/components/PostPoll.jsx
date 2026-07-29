import { useMemo, useState } from "react";
import { useAuth } from "@/app/data/AuthContext";
import { isSupabaseReady, supabase } from "@/app/data/supabase";

export function PostPoll({ poll }) {
  const { user } = useAuth();
  const [currentPoll, setCurrentPoll] = useState(poll);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const totalVotes = currentPoll?.totalVotes || 0;
  const voted = Boolean(currentPoll?.myVote);

  const options = useMemo(() => currentPoll?.options || [], [currentPoll]);

  async function vote(optionId) {
    if (!user?.id || busy || voted || !currentPoll?.id) return;
    const previous = currentPoll;
    setBusy(true);
    setError("");
    setCurrentPoll((value) => ({
      ...value,
      myVote: optionId,
      totalVotes: (value.totalVotes || 0) + 1,
      options: value.options.map((option) =>
        option.id === optionId ? { ...option, votes: (option.votes || 0) + 1 } : option
      ),
    }));

    try {
      if (!isSupabaseReady()) return;
      const { error: insertError } = await supabase
        .from("post_poll_votes")
        .insert({ poll_id: currentPoll.id, option_id: optionId, user_id: user.id });
      if (insertError && insertError.code !== "23505") throw insertError;
    } catch (err) {
      setCurrentPoll(previous);
      setError(err?.message || "Nao foi possivel votar.");
    } finally {
      setBusy(false);
    }
  }

  if (!currentPoll) return null;

  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--hover-overlay)] p-3">
      <p className="mb-3 text-sm font-semibold text-[var(--text-primary)]">{currentPoll.question}</p>
      <div className="space-y-2">
        {options.map((option) => {
          const percent = totalVotes > 0 ? Math.round(((option.votes || 0) / totalVotes) * 100) : 0;
          const selected = currentPoll.myVote === option.id;
          return (
            <button
              key={option.id}
              type="button"
              disabled={busy || voted}
              onClick={() => vote(option.id)}
              className={`relative min-h-11 w-full overflow-hidden rounded-[8px] border px-3 text-left text-sm transition-colors ${
                selected
                  ? "border-[#c78359]/50 text-[var(--text-primary)]"
                  : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
              }`}
            >
              {voted && (
                <span
                  className={`absolute inset-y-0 left-0 ${selected ? "bg-[#c78359]/35" : "bg-[var(--border)]/35"}`}
                  style={{ width: `${percent}%` }}
                />
              )}
              <span className="relative flex items-center justify-between gap-3">
                <span className="min-w-0 break-words">{option.label}</span>
                {voted && <span className="shrink-0 tabular-nums text-[var(--text-muted)]">{percent}%</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        {totalVotes} voto{totalVotes === 1 ? "" : "s"}{voted ? " · voce votou" : ""}
      </p>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
