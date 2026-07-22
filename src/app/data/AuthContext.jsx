import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase, isSupabaseReady } from "./supabase";
import { getSupabaseErrorMessage } from "@/lib/supabase-error";
import { runSupabaseQuery } from "@/lib/supabase-query";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // Evita recarregar o perfil a cada evento de auth (TOKEN_REFRESHED, foco da aba,
  // re-emissao de sessao): so recarrega quando o id do usuario muda de fato, e
  // nunca dispara duas cargas ao mesmo tempo.
  const loadedProfileIdRef = useRef(null);
  const loadingProfileRef = useRef(false);

  useEffect(() => {
    if (!isSupabaseReady()) {
      setUser(null);
      setSession(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    let active = true;

    async function loadProfile(userId) {
      if (!userId) {
        loadedProfileIdRef.current = null;
        setProfile(null);
        return;
      }

      // Ja carregado para este usuario, ou uma carga em andamento: nao repete.
      if (loadedProfileIdRef.current === userId || loadingProfileRef.current) {
        return;
      }

      loadingProfileRef.current = true;
      const { data, error } = await runSupabaseQuery(
        () => supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle(),
        "carregar perfil"
      );
      loadingProfileRef.current = false;

      if (!active) return;

      if (error) {
        // Nao marca como carregado: permite nova tentativa num proximo evento.
        console.warn("Falha ao carregar perfil no Supabase:", error.message || error);
        setProfile(null);
        return;
      }

      loadedProfileIdRef.current = userId;
      setProfile(data);
    }

    async function restoreSession() {
      const { data: { session } } = await supabase.auth.getSession();

      // getSession() apenas le o localStorage: uma sessao de conta ja apagada,
      // ou com token invalidado no servidor, continua parecendo valida aqui e
      // o app entra "logado" sem conseguir carregar nada. getUser() bate no
      // servidor de auth e revela isso.
      if (session) {
        const { error: userError } = await supabase.auth.getUser();

        // Desloga apenas quando o servidor rejeita o token de fato. Falha de
        // rede nao pode derrubar a sessao de quem so esta sem conexao.
        if (userError?.status === 401 || userError?.status === 403) {
          await supabase.auth.signOut();
          if (!active) return;
          loadedProfileIdRef.current = null;
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
      }

      if (!active) return;
      setSession(session);
      setUser(session?.user ?? null);
      await loadProfile(session?.user?.id);
      if (active) setLoading(false);
    }

    restoreSession().catch((error) => {
      if (!active) return;
      console.warn("Nao foi possivel restaurar a sessao:", error.message || error);
      setSession(null);
      setUser(null);
      setProfile(null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      setSession(session);
      setUser(session?.user ?? null);

      const nextUserId = session?.user?.id ?? null;

      if (event === "SIGNED_OUT" || !nextUserId) {
        loadedProfileIdRef.current = null;
        setProfile(null);
        return;
      }

      // So recarrega quando troca de usuario; ignora TOKEN_REFRESHED e as
      // re-emissoes disparadas ao voltar o foco para a aba.
      if (nextUserId !== loadedProfileIdRef.current) {
        loadProfile(nextUserId);
      }
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email, password) => {
    if (!email || !email.includes("@")) {
      throw new Error("Digite um email válido.");
    }
    if (!password) {
      throw new Error("Digite sua senha.");
    }
    if (!isSupabaseReady()) {
      throw new Error("Supabase não está configurado. Verifique SUPABASE_URL e SUPABASE_ANON_KEY no Vercel ou use VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(getSupabaseErrorMessage(error));
  }, []);

  const logout = useCallback(async () => {
    if (isSupabaseReady()) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    setProfile(null);
  }, []);

  const isAdmin = isSupabaseReady()
    ? profile?.role === "admin" || session?.user?.app_metadata?.role === "admin"
    : user?.role === 'admin';

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      loading,
      isAuthenticated: !!user,
      isAdmin,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
