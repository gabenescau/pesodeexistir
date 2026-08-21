import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/data/AuthContext";
import { useData } from "@/app/data/DataContext";
import { isActiveSubscription } from "@/lib/subscription";
import { Info, X } from "@/lib/icons";

const NUDGE_COOLDOWN_MS = 12 * 60 * 60 * 1000;
const NEW_ACCOUNT_WINDOW_MS = 30 * 60 * 1000;

function readStorage(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch {
    // Storage restrictions must not break navigation.
  }
}

function isNewAccount(user, profile) {
  const createdAt = profile?.created_at || user?.created_at;
  const timestamp = createdAt ? new Date(createdAt).getTime() : Number.NaN;
  return Number.isFinite(timestamp) && Date.now() - timestamp >= 0 && Date.now() - timestamp < NEW_ACCOUNT_WINDOW_MS;
}

function getRouteNudge(pathname) {
  if (pathname.startsWith("/app/livro/") || pathname.startsWith("/app/ler/")) {
    return { key: "book", message: "Gostou desta leitura? Um plano ativo libera o acervo completo e sincroniza seu progresso." };
  }
  if (pathname === "/app/biblioteca") {
    return { key: "library", message: "Encontre sua próxima leitura. Assinantes acessam a biblioteca completa e acumulam créditos." };
  }
  if (pathname === "/app/loja" || pathname.startsWith("/app/loja/")) {
    return { key: "store", message: "Sua leitura pode virar créditos para trocar por livros e itens na Loja OPE." };
  }
  if (pathname === "/app/explorar" || pathname.startsWith("/app/autor/")) {
    return { key: "discover", message: "Descobertas melhores ficam ainda mais completas com leitura, missões e retrospectiva do plano." };
  }
  if (pathname === "/app/inicio") {
    return { key: "community", message: "A comunidade é aberta. Com um plano, sua participação também desbloqueia missões e créditos." };
  }
  return null;
}

export function ConversionNudges() {
  const { user, profile, isAdmin, loading: authLoading } = useAuth();
  const { subscription, loading: dataLoading } = useData();
  const location = useLocation();
  const navigate = useNavigate();
  const timerRef = useRef(null);
  const closeButtonRef = useRef(null);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    window.clearTimeout(timerRef.current);
    setModal(null);
    if (authLoading || dataLoading || !user?.id || isAdmin) return undefined;
    // A assinatura e a fonte de verdade para esta mensagem. Nao mostre a
    // conversao enquanto o usuario tem um plano ativo, inclusive no welcome.
    if (isActiveSubscription(subscription)) return undefined;
    if (location.pathname === "/app/planos" || location.pathname === "/app/configuracoes") return undefined;

    const userKey = user.id;
    const routeNudge = getRouteNudge(location.pathname);
    const welcomeKey = `ope:nudge:${userKey}:welcome`;
    const isWelcome = isNewAccount(user, profile) && !readStorage(window.localStorage, welcomeKey);
    const candidate = isWelcome
      ? { key: "welcome", message: "Bem-vindo ao OPE Club. Assinando, você libera a leitura completa, missões e créditos." }
      : routeNudge;
    if (!candidate) return undefined;
    const now = Date.now();
    const lastKey = `ope:nudge:${userKey}:last`;
    const lastShown = Number(
      readStorage(window.localStorage, lastKey) || readStorage(window.sessionStorage, lastKey) || 0
    );
    const seenKey = `ope:nudge:${userKey}:${candidate.key}`;
    if (now - lastShown < NUDGE_COOLDOWN_MS) return undefined;
    if (readStorage(window.sessionStorage, seenKey)) return undefined;

    timerRef.current = window.setTimeout(() => {
      writeStorage(window.localStorage, lastKey, String(Date.now()));
      writeStorage(window.sessionStorage, lastKey, String(Date.now()));
      writeStorage(window.sessionStorage, seenKey, "1");
      if (candidate.key === "welcome") writeStorage(window.localStorage, seenKey, "1");
      setModal(candidate);
    }, candidate.key === "welcome" ? 1800 : 3200);

    return () => window.clearTimeout(timerRef.current);
  }, [authLoading, dataLoading, isAdmin, location.pathname, navigate, profile, subscription, user]);

  useEffect(() => {
    if (!modal) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") setModal(null);
    }

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [modal]);

  if (!modal) return null;

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center p-5 sm:p-6">
      <button
        type="button"
        aria-label="Fechar mensagem"
        onClick={() => setModal(null)}
        className="absolute inset-0 cursor-default bg-black/75 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="conversion-nudge-message"
        className="relative w-full max-w-[25rem] overflow-hidden rounded-[20px] border border-white/[0.12] bg-[#080808] px-6 py-6 text-left shadow-[0_24px_80px_rgba(0,0,0,0.5)] sm:px-7 sm:py-7"
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={() => setModal(null)}
          aria-label="Fechar mensagem"
          className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]"
        >
          <X className="size-5" />
        </button>

        <div className="flex items-start gap-4 pr-6">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[var(--accent-mint)]/30 bg-[var(--accent-mint)]/10 text-[var(--accent-mint)]">
            <Info className="size-5" weight="fill" />
          </div>
          <p id="conversion-nudge-message" className="pt-1 text-[15px] font-medium leading-7 text-white/90">
            {modal.message}
          </p>
        </div>

        <div className="mt-5 pl-[3.75rem]">
          <button
            type="button"
            onClick={() => {
              setModal(null);
              navigate("/app/planos");
            }}
            className="text-[15px] font-semibold text-[var(--accent-mint)] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)] focus-visible:ring-offset-4 focus-visible:ring-offset-[#080808]"
          >
            Ver planos
          </button>
        </div>
      </div>
    </div>
  );
}
