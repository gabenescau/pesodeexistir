import { useState } from "react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

const RAZOES = [
  { id: "preco", label: "Esta caro demais", emoji: "$" },
  { id: "uso", label: "Nao estou usando o suficiente", emoji: "-" },
  { id: "conteudo", label: "Nao encontrei livros que queria", emoji: "*" },
  { id: "tecnico", label: "Problemas tecnicos no app", emoji: "!" },
  { id: "alternativa", label: "Vou usar outra plataforma", emoji: ">" },
  { id: "outro", label: "Outro motivo", emoji: "?" },
];

// CancelSurvey: dialog de cancelamento de assinatura. Primeiro pergunta
// o motivo (para o admin entender e melhorar o produto), depois pede
// confirmacao final. Devolve uma Promise<{ confirmado: boolean, motivo: string|null }>
// para o caller decidir o que fazer.
export function useCancelSurvey() {
  const [state, setState] = useState({ open: false, resolver: null, etapa: "motivo", motivo: null, outro: "" });

  const perguntar = () =>
    new Promise((resolve) => {
      setState({ open: true, resolver: resolve, etapa: "motivo", motivo: null, outro: "" });
    });

  function fechar(resultado) {
    if (state.resolver) state.resolver(resultado);
    setState({ open: false, resolver: null, etapa: "motivo", motivo: null, outro: "" });
  }

  function escolherMotivo(id) {
    if (id === "outro") {
      setState((s) => ({ ...s, etapa: "outro", motivo: "outro" }));
    } else {
      setState((s) => ({ ...s, etapa: "confirmar", motivo: id }));
    }
  }

  function confirmar(observacoes) {
    const motivoFinal = state.motivo === "outro"
      ? (observacoes?.trim() || "outro (sem detalhes)")
      : state.motivo;
    fechar({ confirmado: true, motivo: motivoFinal, observacoes: observacoes?.trim() || null });
    toast.success("Cancelamento registrado. Sentiremos sua falta!");
  }

  const dialog = state.open ? (
    <AlertDialog open={state.open} onOpenChange={(open) => { if (!open) fechar({ confirmado: false, motivo: null }); }}>
      <AlertDialogContent>
        {state.etapa === "motivo" && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Antes de cancelar...</AlertDialogTitle>
              <AlertDialogDescription>
                Pode nos contar o motivo? Sua resposta ajuda a gente a melhorar o OPE Club.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {RAZOES.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => escolherMotivo(r.id)}
                    className="flex w-full items-center gap-3 rounded-[8px] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-left text-sm text-[var(--text-primary)] transition-colors hover:border-[var(--accent-mint)] hover:bg-[var(--hover-overlay)]"
                  >
                    <span className="flex size-6 items-center justify-center rounded-full bg-[var(--hover-overlay)] text-[10px] font-bold text-[var(--accent-mint)]">
                      {r.emoji}
                    </span>
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
            <AlertDialogFooter>
              <AlertDialogClose>Manter assinatura</AlertDialogClose>
            </AlertDialogFooter>
          </>
        )}

        {state.etapa === "outro" && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Conta um pouco mais</AlertDialogTitle>
              <AlertDialogDescription>
                Escreva em uma frase o que poderiamos ter feito diferente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <textarea
              value={state.outro}
              onChange={(event) => setState((s) => ({ ...s, outro: event.target.value }))}
              rows={4}
              maxLength={500}
              placeholder="O que poderiamos ter feito diferente?"
              className="w-full resize-none rounded-[8px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-placeholder)]"
            />
            <AlertDialogFooter>
              <AlertDialogClose onClick={() => setState((s) => ({ ...s, etapa: "motivo" }))}>
                Voltar
              </AlertDialogClose>
              <Button
                type="button"
                onClick={() => setState((s) => ({ ...s, etapa: "confirmar" }))}
                disabled={!state.outro.trim()}
                className="min-h-10 bg-[var(--text-primary)] text-[var(--bg-card)] disabled:opacity-40"
              >
                Continuar
              </Button>
            </AlertDialogFooter>
          </>
        )}

        {state.etapa === "confirmar" && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar cancelamento?</AlertDialogTitle>
              <AlertDialogDescription>
                Sua assinatura continuara ativa ate o fim do ciclo atual ja pago. Depois disso o
                acesso a biblioteca e a comunidade sera limitado.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--hover-overlay)] p-3 text-sm text-[var(--text-secondary)]">
              <span className="text-[var(--text-muted)]">Motivo informado: </span>
              <span className="font-medium text-[var(--text-primary)]">
                {RAZOES.find((r) => r.id === state.motivo)?.label || state.outro || "Outro"}
              </span>
            </div>
            <AlertDialogFooter>
              <AlertDialogClose onClick={() => setState((s) => ({ ...s, etapa: "motivo" }))}>
                Voltar
              </AlertDialogClose>
              <Button
                type="button"
                onClick={() => confirmar(state.outro)}
                className="min-h-10 border border-red-500/30 bg-red-500/15 text-red-300 hover:bg-red-500/25"
              >
                Confirmar cancelamento
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  ) : null;

  return { perguntar, dialog };
}
