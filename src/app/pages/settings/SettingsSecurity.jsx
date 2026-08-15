import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Lock, LogOut, Monitor, Shield, Smartphone } from "@/lib/icons";
import { SettingsLayout, SettingsRow, SettingsSection, SettingsToggle } from "../../components/SettingsLayout";
import { useAuth } from "../../data/AuthContext";
import { isSupabaseReady, supabase } from "../../data/supabase";
import { validateStrongPassword } from "@/lib/sanitize";
import { toast } from "@/lib/toast";

const REMEMBER_KEY = "ope_remember_login";

function detectDevice() {
  if (typeof navigator === "undefined") return { label: "Este dispositivo", kind: "monitor" };
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return { label: "Celular", kind: "smartphone" };
  if (/Mac|Windows|Linux/i.test(ua)) return { label: "Computador", kind: "monitor" };
  return { label: "Este dispositivo", kind: "monitor" };
}

export function SettingsSecurity() {
  const [, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [signingOutOthers, setSigningOutOthers] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(REMEMBER_KEY);
    if (stored !== null) setRemember(stored === "1");
  }, []);

  function toggleRemember() {
    const next = !remember;
    setRemember(next);
    localStorage.setItem(REMEMBER_KEY, next ? "1" : "0");
    toast.success(next ? "Login lembrado neste navegador." : "Login nao sera lembrado.");
  }

  async function handleUpdatePassword(e) {
    e.preventDefault();
    if (!isSupabaseReady() || savingPwd) return;
    try {
      validateStrongPassword(newPassword);
    } catch (err) {
      toast.error(err.message);
      return;
    }
    setSavingPwd(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      toast.success("Senha atualizada.");
    } catch (err) {
      toast.error(err?.message || "Nao foi possivel atualizar a senha.");
    } finally {
      setSavingPwd(false);
    }
  }

  async function handleSignOutOthers() {
    if (signingOutOthers) return;
    setSigningOutOthers(true);
    try {
      if (isSupabaseReady()) {
        // Mantem a sessao atual; encerra as outras.
        await supabase.auth.signOut({ scope: "others" });
      }
      toast.success("Outras sessoes foram encerradas.");
    } catch (err) {
      toast.error(err?.message || "Nao foi possivel encerrar outras sessoes.");
    } finally {
      setSigningOutOthers(false);
    }
  }

  const device = detectDevice();
  const DeviceIcon = device.kind === "smartphone" ? Smartphone : Monitor;

  return (
    <SettingsLayout
      title="Seguranca"
      subtitle="Senha, dispositivos e sessoes"
      onBack={() => setSearchParams({})}
    >
      <SettingsSection icon={Lock} label="Senha">
        <form onSubmit={handleUpdatePassword} className="px-4 py-3 sm:px-5">
          <label className="mb-1 block text-[11px] text-[var(--text-muted)]">Nova senha</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimo 12 caracteres"
              autoComplete="new-password"
              className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--bg-page)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-mint)]"
            />
            <button
              type="submit"
              disabled={savingPwd || newPassword.length < 12}
              className="rounded-full bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-card)] disabled:opacity-40"
            >
              {savingPwd ? "Salvando..." : "Atualizar"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-[var(--text-muted)]">
            Use letras, numeros e simbolos. Minimo 12 caracteres.
          </p>
        </form>
      </SettingsSection>

      <SettingsSection icon={Shield} label="Login">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Lembrar login</p>
            <p className="text-[11px] text-[var(--text-muted)]">Mantem voce conectado neste navegador.</p>
          </div>
          <SettingsToggle value={remember} onChange={toggleRemember} />
        </div>
      </SettingsSection>

      <SettingsSection icon={DeviceIcon} label="Sessoes ativas">
        <SettingsRow
          icon={DeviceIcon}
          title={`${device.label} (este)`}
          description={user?.email ? `Conectado como ${user.email}` : "Sessao atual"}
        />
        <SettingsRow
          icon={LogOut}
          title="Encerrar outras sessoes"
          description="Desconecta todos os outros dispositivos"
          onClick={handleSignOutOthers}
          danger
          right={signingOutOthers ? <span className="text-[11px] text-[var(--text-muted)]">...</span> : null}
        />
      </SettingsSection>
    </SettingsLayout>
  );
}
