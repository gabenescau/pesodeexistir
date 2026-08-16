import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { isSupabaseReady } from "./supabase";
import { authApi } from "@/lib/auth-api";
import { normalizeEmail } from "@/lib/sanitize";
import { hasPermission, normalizeRole, PERMISSIONS, ROLES } from "@/lib/rbac";
import { rewardApi } from "@/lib/rewards";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // Evita recarregar o perfil a cada evento de auth (TOKEN_REFRESHED, foco da aba,
  // re-emissao de sessao): so recarrega quando o id do usuario muda de fato, e
  // nunca dispara duas cargas ao mesmo tempo.
  const loadedProfileIdRef = useRef(null);
  const loadingProfileRef = useRef(false);
  const refreshSessionRef = useRef(async () => {});

  useEffect(() => {
    if (!isSupabaseReady()) {
      // Sem o Supabase configurado, nenhum usuario e criado localmente.
      // Um mock admin poderia mascarar uma configuracao quebrada e virar uma
      // porta de entrada se o servidor local fosse exposto acidentalmente.
      setLoading(false);
      return;
    }

    let active = true;

    async function loadProfile(userId, authUser = null) {
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
      let data = null;
      let error = null;
      try {
        const result = await authApi.profile();
        data = result?.profile || null;
      } catch (profileError) {
        error = profileError;
      }
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

      const referralCode = authUser?.user_metadata?.referral_code;
      if (referralCode) {
        rewardApi.registerReferral(referralCode).catch((error) => {
          // O RPC e idempotente: codigo invalido ou indicacao ja registrada
          // nao pode impedir o login.
          console.warn("Falha ao registrar indicacao pendente:", error?.message || error);
        });
      }

      // Registra o XP/Creditos de login de forma idempotente (o servidor
      // deduplica por dia). Fire-and-forget: nunca bloqueia a sessao, mas deixa
      // evidencia no console para o suporte diagnosticar falhas de recompensa.
      rewardApi.rewardLogin().catch((error) => {
        console.warn("Falha ao registrar recompensa de login:", error?.message || error);
      });
    }

    async function restoreSession() {
      const session = await authApi.session();
      if (!active) return;
      const authenticatedUser = session?.user || null;
      setUser(authenticatedUser);
      await loadProfile(authenticatedUser?.id, authenticatedUser);
      if (active) setLoading(false);
    }

    refreshSessionRef.current = restoreSession;

    restoreSession().catch((error) => {
      if (!active) return;
      console.warn("Nao foi possivel restaurar a sessao:", error.message || error);
      setUser(null);
      setProfile(null);
      setLoading(false);
    });

    // Refresh the server-owned cookie session before the short-lived access
    // token expires. No token is written to browser storage.
    const refreshTimer = window.setInterval(() => {
      restoreSession().catch(() => {});
    }, 45 * 60 * 1000);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      refreshSessionRef.current = async () => {};
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
      throw new Error("Supabase não está configurado. Verifique a integração Supabase no painel da Vercel.");
    }

    await authApi.login(normalizeEmail(email), password);
    await refreshSessionRef.current();
  }, []);

  const logout = useCallback(async () => {
    if (isSupabaseReady()) {
      await authApi.logout();
    }
    setUser(null);
    setProfile(null);
  }, []);

  const role = normalizeRole(profile?.role);
  const isAdmin = role === ROLES.ADMIN;
  const isEditor = role === ROLES.EDITOR;
  const can = (permission) => hasPermission(role, permission);
  const canManageContent = can(PERMISSIONS.MANAGE_CONTENT);

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      isAuthenticated: !!user,
      isAdmin,
      isEditor,
      role,
      can,
      canManageContent,
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
