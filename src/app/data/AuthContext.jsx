import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseReady } from "./supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseReady()) {
      const stored = localStorage.getItem("ope-auth");
      if (stored) {
        try { setUser(JSON.parse(stored)); } catch {}
      }
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const login = useCallback(async (email) => {
    if (!email || !email.includes("@")) {
      // Fallback: local mode
      const userData = { id: email, email, name: email.split("@")[0], avatar: email.charAt(0).toUpperCase() };
      setUser(userData);
      localStorage.setItem("ope-auth", JSON.stringify(userData));
      return;
    }
    if (isSupabaseReady()) {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
    } else {
      const userData = { id: email, email, name: email.split("@")[0], avatar: email.charAt(0).toUpperCase() };
      setUser(userData);
      localStorage.setItem("ope-auth", JSON.stringify(userData));
    }
  }, []);

  const logout = useCallback(async () => {
    if (isSupabaseReady()) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    localStorage.removeItem("ope-auth");
  }, []);

  const isAdmin = isSupabaseReady()
    ? session?.user?.app_metadata?.role === 'admin'
    : user?.role === 'admin';

  return (
    <AuthContext.Provider value={{
      user,
      session,
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
