import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/data/AuthContext";
import { loadRetrospective } from "@/lib/retrospective-api";
import { RetrospectiveModal } from "./RetrospectiveModal";

function seenKey(snapshot) {
  return snapshot?.kind && snapshot?.start ? `ope:retrospective:${snapshot.kind}:${snapshot.start}` : "";
}

export function RetrospectivePrompt() {
  const { user, loading } = useAuth();
  const loadedUserRef = useRef(null);
  const [data, setData] = useState(null);
  const [initialKind, setInitialKind] = useState("month");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading || !user?.id || loadedUserRef.current === user.id) return;
    loadedUserRef.current = user.id;
    let active = true;
    loadRetrospective()
      .then((snapshot) => {
        if (!active) return;
        if (snapshot?.allowed === false) return;
        const candidates = [snapshot?.month, snapshot?.year].filter((item) => item?.hasData);
        const unseen = candidates.find((item) => {
          const key = seenKey(item);
          return key && window.localStorage.getItem(key) !== "1";
        });
        if (!unseen) return;
        setData(snapshot);
        setInitialKind(unseen.kind || "month");
        setOpen(true);
      })
      .catch(() => {
        // A retrospectiva e complementar e nunca deve impedir o carregamento do app.
      });
    return () => { active = false; };
  }, [loading, user?.id]);

  function close() {
    [data?.month, data?.year].forEach((item) => {
      const key = seenKey(item);
      if (key && item?.hasData) window.localStorage.setItem(key, "1");
    });
    setOpen(false);
  }

  return <RetrospectiveModal data={data} initialKind={initialKind} open={open} onClose={close} />;
}
