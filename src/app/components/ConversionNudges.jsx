import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/data/AuthContext";
import { useData } from "@/app/data/DataContext";
import { isActiveSubscription } from "@/lib/subscription";
import { toast } from "@/lib/toast";

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

  useEffect(() => {
    window.clearTimeout(timerRef.current);
    if (authLoading || dataLoading || !user?.id || isAdmin || isActiveSubscription(subscription)) return undefined;
    if (location.pathname === "/app/planos" || location.pathname === "/app/configuracoes") return undefined;

    const userKey = user.id;
    const routeNudge = getRouteNudge(location.pathname);
    const welcomeKey = `ope:nudge:${userKey}:welcome`;
    const candidate = isNewAccount(user, profile) && !readStorage(window.localStorage, welcomeKey)
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
      toast.info(candidate.message, {
        duration: 6500,
        action: { label: "Ver planos", onClick: () => navigate("/app/planos") },
      });
    }, candidate.key === "welcome" ? 1800 : 3200);

    return () => window.clearTimeout(timerRef.current);
  }, [authLoading, dataLoading, isAdmin, location.pathname, navigate, profile, subscription, user]);

  return null;
}
