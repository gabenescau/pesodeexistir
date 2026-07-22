import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/app/data/AuthContext";
import { getCurrentSubscription, isActiveSubscription } from "@/lib/subscription";

export function SubscriptionGuard({ children }) {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [state, setState] = useState("loading");

  useEffect(() => {
    if (authLoading) {
      setState("loading");
      return;
    }

    if (!user) {
      setState("unauthenticated");
      return;
    }

    if (isAdmin) {
      setState("active");
      return;
    }

    let cancelled = false;

    getCurrentSubscription(user.id).then((sub) => {
      if (cancelled) return;
      if (isActiveSubscription(sub)) {
        setState("active");
      } else {
        setState("inactive");
      }
    });

    return () => { cancelled = true; };
  }, [user, isAdmin, authLoading]);

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="size-6 border-2 border-[var(--border)] border-t-[var(--text-primary)] rounded-full animate-spin" />
      </div>
    );
  }

  if (state === "unauthenticated" || state === "inactive") {
    return <Navigate to="/assinar" replace />;
  }

  return children;
}
