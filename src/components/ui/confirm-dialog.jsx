import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

// useConfirmDialog: hook que retorna uma funcao `ask(options)` que abre o
// AlertDialog e devolve uma Promise<boolean>. Resolve true se o usuario
// confirmar, false se cancelar. Substitui o window.confirm() nativo (que
// nao combina com o design system e nao funciona bem em mobile).
//
// Uso:
//   const confirm = useConfirmDialog();
//   if (await confirm({ title: "Apagar?", description: "...", danger: true })) {
//     await deleteItem();
//   }
export function useConfirmDialog() {
  const [state, setState] = React.useState({
    open: false,
    options: null,
    resolver: null,
  });

  const ask = React.useCallback((options) => {
    return new Promise((resolve) => {
      setState({ open: true, options, resolver: resolve });
    });
  }, []);

  function close(result) {
    if (state.resolver) state.resolver(result);
    setState({ open: false, options: null, resolver: null });
  }

  const dialog = state.options ? (
    <AlertDialog
      open={state.open}
      onOpenChange={(open) => {
        if (!open) close(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.options.title}</AlertDialogTitle>
          {state.options.description ? (
            <AlertDialogDescription>{state.options.description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        {state.options.body ? (
          <div className="text-sm text-[var(--text-secondary)]">{state.options.body}</div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogClose onClick={() => close(false)}>
            {state.options.cancelLabel || "Cancelar"}
          </AlertDialogClose>
          <AlertDialogAction
            danger={state.options.danger}
            loading={state.options.loading}
            onClick={() => close(true)}
          >
            {state.options.confirmLabel || "Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null;

  return { ask, dialog };
}

// Variante "danger" do botao: vermelho para acoes destrutivas
function DangerButton(props) {
  return (
    <Button
      className="min-h-10 border border-red-500/30 bg-red-500/15 text-red-300 hover:bg-red-500/25"
      {...props}
    />
  );
}

// Botao de acao do AlertDialog com suporte a danger + loading
export function ConfirmAction({ danger, loading, children, ...rest }) {
  if (danger) {
    return (
      <AlertDialogAction
        render={
          <Button
            className="min-h-10 border border-red-500/30 bg-red-500/15 text-red-300 hover:bg-red-500/25"
            disabled={loading}
          />
        }
        {...rest}
      >
        {loading ? "Aguarde..." : children}
      </AlertDialogAction>
    );
  }
  return (
    <AlertDialogAction
      render={
        <Button
          className="min-h-10 bg-[var(--text-primary)] text-[var(--bg-card)] hover:opacity-90"
          disabled={loading}
        />
      }
      {...rest}
    >
      {loading ? "Aguarde..." : children}
    </AlertDialogAction>
  );
}

export { DangerButton };
