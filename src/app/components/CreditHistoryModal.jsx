import { useState, useEffect } from "react";
import { X, Clock, Plus, Minus } from "@/lib/icons";
import { useRewards } from "@/app/data/RewardsContext";

export function CreditHistoryModal({ isOpen, onClose }) {
  const { wallet } = useRewards();
  const credits = wallet?.credits ?? 0;

  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    try {
      const stored = localStorage.getItem("ope_credit_history_dev");
      if (stored) {
        setHistory(JSON.parse(stored));
      } else {
        const initialLog = [
          {
            id: "tx-1",
            amount: 15,
            type: "earn",
            title: "Missão diária concluída",
            date: "06/08/2026",
          },
          {
            id: "tx-2",
            amount: 5,
            type: "earn",
            title: "Leitura diária de 15 minutos",
            date: "06/08/2026",
          },
          {
            id: "tx-3",
            amount: 1,
            type: "earn",
            title: "Login diário",
            date: "06/08/2026",
          },
          {
            id: "tx-4",
            amount: -450,
            type: "spend",
            title: 'Resgate de "Livro Físico - Edição OPE"',
            date: "04/08/2026",
          },
          {
            id: "tx-5",
            amount: 50,
            type: "earn",
            title: "Indicação confirmada (Amigo Assinante)",
            date: "02/08/2026",
          },
        ];
        setHistory(initialLog);
        localStorage.setItem("ope_credit_history_dev", JSON.stringify(initialLog));
      }
    } catch {}
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative my-auto w-full max-w-md overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl">
        
        {/* Header do Modal — padrão App */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-primary)]">
            Histórico de Créditos
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-[6px] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Resumo do Saldo */}
        <div className="border-b border-[var(--border)] bg-[var(--bg-canvas)] p-4 sm:p-5 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Saldo Atual
          </p>
          <p className="mt-1 text-3xl font-bold text-[var(--text-primary)] tracking-tight">
            {credits} <span className="text-xs font-normal text-[var(--text-muted)]">créditos</span>
          </p>
        </div>

        {/* Lista de Transações */}
        <div className="max-h-[55vh] overflow-y-auto divide-y divide-[var(--border)] p-2">
          {history.length === 0 ? (
            <p className="py-8 text-center text-xs text-[var(--text-muted)]">Nenhuma movimentação registrada.</p>
          ) : (
            history.map((item) => {
              const isEarn = item.amount > 0;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-[8px] hover:bg-[var(--hover-overlay)] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex size-7 shrink-0 items-center justify-center rounded-full border ${
                      isEarn
                        ? "border-[var(--border)] bg-[var(--hover-overlay)] text-[var(--text-primary)]"
                        : "border-[var(--border)] bg-[var(--bg-canvas)] text-[var(--text-muted)]"
                    }`}>
                      {isEarn ? <Plus className="size-3.5" /> : <Minus className="size-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-medium text-[var(--text-primary)] truncate">{item.title}</h4>
                      <p className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                        <Clock className="size-3" /> {item.date}
                      </p>
                    </div>
                  </div>

                  <span className={`text-xs font-semibold shrink-0 ${isEarn ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
                    {isEarn ? `+${item.amount}` : item.amount}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé */}
        <div className="border-t border-[var(--border)] p-3 bg-[var(--bg-card)]">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-[8px] bg-[var(--text-primary)] py-2 text-xs font-semibold text-[var(--bg-card)] hover:opacity-90 transition-opacity"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
