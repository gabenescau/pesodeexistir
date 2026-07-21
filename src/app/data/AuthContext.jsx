import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseReady } from "./supabase";
import { getSupabaseErrorMessage } from "@/lib/supabase-error";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseReady()) {
      setUser(null);
      setSession(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    async function loadProfile(userId) {
      if (!userId) {
        setProfile(null);
        return null;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.warn("Perfil não encontrado no Supabase:", error.message);
        setProfile(null);
        return null;
      }

      setProfile(data);
      return data;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      loadProfile(session?.user?.id).finally(() => setLoading(false));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      loadProfile(session?.user?.id);
    });

    return () => subscription?.unsubscribe();
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
