import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase, isSupabaseReady } from "./supabase";
import { getSupabaseErrorMessage } from "@/lib/supabase-error";
import { runSupabaseQuery } from "@/lib/supabase-query";
import { normalizeEmail } from "@/lib/sanitize";
import { hasPermission, normalizeRole, PERMISSIONS, ROLES } from "@/lib/rbac";
import { rewardApi } from "@/lib/rewards";

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
      // Em modo de desenvolvimento, se o Supabase não estiver configurado,
      // injetamos um usuário admin mockado para permitir testar o app localmente.
      if (import.meta.env.DEV) {
        setUser({
          id: "mock-admin-id",
          email: "admin@pesodeexistir.online",
        });
        setProfile({
          id: "mock-admin-id",
          name: "Admin Local (Dev)",
          username: "admin",
          role: "admin",
          xp: 9999,
          credits: 9999,
        });
      }
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
      const { data, error } = await runSupabaseQuery(
        () => supabase
          .from("profiles")
          .select("id,name,avatar,avatar_url,username,bio,theme,role,private_profile,reading_activity,show_online_status,xp,credits,referral_code,created_at,updated_at")
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
      const { data: { session } } = await supabase.auth.getSession();

      // getSession() le o storage de sessao configurado no cliente. Uma conta
      // apagada ou com token invalidado ainda pode parecer valida localmente e
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
      await loadProfile(session?.user?.id, session?.user);
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
        loadProfile(nextUserId, session?.user);
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
      throw new Error("Supabase não está configurado. Verifique a integração Supabase no painel da Vercel.");
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
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

  const role = normalizeRole(profile?.role);
  const isAdmin = role === ROLES.ADMIN;
  const isEditor = role === ROLES.EDITOR;
  const can = (permission) => hasPermission(role, permission);
  const canManageContent = can(PERMISSIONS.MANAGE_CONTENT);

  return (
    <AuthContext.Provider value={{
      user,
      session,
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
