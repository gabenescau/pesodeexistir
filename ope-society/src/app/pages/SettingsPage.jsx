import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Camera,
  ChevronRight,
  CircleCheck,
  CreditCard,
  Eye,
  Globe,
  Lock,
  LogOut,
  Mail,
  Moon,
  Shield,
  Sun,
  Trash2,
  User,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useData } from "@/app/data/DataContext";
import { useAuth } from "@/app/data/AuthContext";
import { supabase, isSupabaseReady } from "@/app/data/supabase";
import { isActiveSubscription } from "@/lib/subscription";

const planFeatures = [
  "Acesso completo à biblioteca",
  "Comunidade exclusiva de leitores",
  "Grupos de leitura",
  "Participação em eventos ao vivo",
  "Leitura offline",
  "Sem anúncios",
  "Suporte prioritário",
];

const statusLabels = {
  active: { text: "Ativo", color: "var(--accent-mint)" },
  past_due: { text: "Pagamento pendente", color: "#f59e0b" },
  canceled: { text: "Cancelado", color: "var(--text-muted)" },
  expired: { text: "Expirado", color: "var(--text-muted)" },
  pending: { text: "Pendente", color: "#f59e0b" },
  refunded: { text: "Reembolsado", color: "var(--text-muted)" },
  chargeback: { text: "Contestado", color: "#ef4444" },
};

function Section({ icon: Icon, label, children, className = "" }) {
  return (
    <section className={`overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] ${className}`} style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center gap-2 px-5 pb-3 pt-5 md:px-6">
        <Icon className="size-4 text-[var(--text-muted)]" />
        <h2 className="text-[12px] font-[400] uppercase tracking-[0.6px] text-[var(--text-secondary)]">
          {label}
        </h2>
      </div>
      {children}
    </section>
  );
}

function Toggle({ value, onChange, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChange}
      className={`relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors disabled:opacity-60 ${
        value ? "bg-[var(--text-primary)]" : "bg-[var(--border)]"
      }`}
    >
      <span
        className={`absolute left-0.5 top-0.5 size-[22px] rounded-full border border-[var(--border-strong)] bg-[var(--bg-card)] transition-transform ${
          value ? "translate-x-[18px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function AccountRow({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center justify-between px-5 py-4 text-left transition-colors hover:bg-[var(--hover-overlay)] md:px-6"
    >
      <div className="flex items-center gap-3">
        <Icon className="size-[18px] text-[var(--text-muted)]" />
        <span className="text-sm text-[var(--text-primary)]">{label}</span>
      </div>
      <ChevronRight className="size-4 text-[var(--border-strong)]" />
    </button>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { theme, toggle: toggleTheme } = useTheme();
  const { user, logout, isAdmin } = useAuth();
  const { subscription, profile, cancelSubscription, updateProfilePreferences } = useData();
  const [privacy, setPrivacy] = useState({
    private_profile: false,
    reading_activity: true,
    show_online_status: true,
  });
  const [savingPreference, setSavingPreference] = useState("");
  const [preferenceError, setPreferenceError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [accountPanel, setAccountPanel] = useState("");
  const [newEmail, setNewEmail] = useState(user?.email || "");
  const [newPassword, setNewPassword] = useState("");
  const [accountMessage, setAccountMessage] = useState("");

  useEffect(() => {
    if (!profile) return;
    setPrivacy({
      private_profile: Boolean(profile.private_profile),
      reading_activity: profile.reading_activity !== false,
      show_online_status: profile.show_online_status !== false,
    });
  }, [profile]);

  const active = isActiveSubscription(subscription);
  const statusInfo = isAdmin && !subscription
    ? { text: "Admin", color: "#c78359" }
    : statusLabels[subscription?.status] || { text: "Desconhecido", color: "var(--text-muted)" };

  async function handleCancel() {
    if (!subscription || cancelling) return;
    setCancelling(true);
    await cancelSubscription(subscription.id);
    setCancelling(false);
  }

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  async function togglePreference(key) {
    if (!user?.id || savingPreference) return;
    const previous = privacy;
    const next = { ...privacy, [key]: !privacy[key] };
    setPrivacy(next);
    setSavingPreference(key);
    setPreferenceError("");

    try {
      await updateProfilePreferences(user.id, { [key]: next[key] });
    } catch (err) {
      setPrivacy(previous);
      setPreferenceError(err?.message || "Não foi possível salvar a preferência.");
    } finally {
      setSavingPreference("");
    }
  }

  async function handleUpdateEmail() {
    if (!isSupabaseReady() || !newEmail.includes("@")) return;
    setAccountMessage("");
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    if (error) {
      setAccountMessage(error.message);
      return;
    }
    if (user?.id) {
      await updateProfilePreferences(user.id, { email: newEmail.trim() });
    }
    setAccountMessage("Confira seu email para confirmar a alteração.");
  }

  async function handleUpdatePassword() {
    if (!isSupabaseReady() || newPassword.length < 6) {
      setAccountMessage("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    setAccountMessage("");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setAccountMessage(error.message);
      return;
    }
    setNewPassword("");
    setAccountMessage("Senha atualizada com sucesso.");
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 md:space-y-10">
      <div>
        <h1 className="text-[24px] font-[600] leading-[32px] tracking-[-0.96px] text-[var(--text-primary)]">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Gerencie sua conta, plano e preferências no OPE Club.
        </p>
      </div>

      <Section icon={CreditCard} label="Plano atual">
        <div className="px-5 pb-6 md:px-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <span className="block text-[20px] font-[600] leading-[28px] tracking-[-0.6px] text-[var(--text-primary)]">
                OPE Club
              </span>
              <span className="mt-1 block text-[12px] font-[400] uppercase tracking-[0.6px] text-[var(--text-muted)]">
                {active ? "R$ 27,00 / mês" : isAdmin ? "Acesso administrativo" : "Sem assinatura ativa"}
              </span>
              {subscription?.current_period_end && (
                <span className="mt-1 block text-xs text-[var(--text-muted)]">
                  Válido até {new Date(subscription.current_period_end).toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>

            {(subscription || isAdmin) && (
              <span
                className="rounded-[6px] px-3 py-1 text-[12px] font-[400] uppercase tracking-[0.6px]"
                style={{ color: statusInfo.color, background: `${statusInfo.color}15` }}
              >
                {statusInfo.text}
              </span>
            )}
          </div>

          {!active && !isAdmin && (
            <div className="mb-5 flex items-start gap-3 rounded-[8px] p-4" style={{ background: "var(--hover-overlay)" }}>
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-[var(--text-muted)]" />
              <div>
                <p className="text-sm font-[500] text-[var(--text-primary)]">Você ainda não tem uma assinatura</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Assine o OPE Club para acessar a biblioteca completa e a comunidade.</p>
              </div>
            </div>
          )}

          {(active || isAdmin) && (
            <ul className="mb-5 space-y-2.5">
              {planFeatures.map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                  <CircleCheck className="size-4 shrink-0 text-[var(--accent-mint)]" strokeWidth={1.5} />
                  {feature}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-3">
            {active ? (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="rounded-[100px] border border-[var(--border)] px-5 py-[10px] text-[14px] font-[500] leading-[20px] text-[var(--text-primary)] transition-all hover:border-[var(--border-strong)] disabled:opacity-50"
              >
                {cancelling ? "Cancelando..." : "Cancelar assinatura"}
              </button>
            ) : isAdmin ? (
              <button
                onClick={() => navigate("/app/admin")}
                className="rounded-[100px] bg-[var(--text-primary)] px-5 py-[10px] text-[14px] font-[500] leading-[20px] text-[var(--bg-card)] transition-all hover:opacity-90"
              >
                Abrir painel admin
              </button>
            ) : (
              <button
                onClick={() => navigate("/assinar")}
                className="rounded-[100px] bg-[var(--text-primary)] px-5 py-[10px] text-[14px] font-[500] leading-[20px] text-[var(--bg-card)] transition-all hover:opacity-90"
              >
                Assinar agora
              </button>
            )}
          </div>
        </div>
      </Section>

      <Section icon={User} label="Conta">
        <div className="divide-y divide-[var(--border)]">
          <AccountRow icon={Camera} label="Editar perfil e foto" onClick={() => navigate("/app/perfil")} />
          <AccountRow icon={Mail} label="Alterar email" onClick={() => { setAccountPanel(accountPanel === "email" ? "" : "email"); setAccountMessage(""); }} />
          <AccountRow icon={Lock} label="Alterar senha" onClick={() => { setAccountPanel(accountPanel === "password" ? "" : "password"); setAccountMessage(""); }} />
          <AccountRow icon={Shield} label="Dados da conta" onClick={() => { setAccountPanel(accountPanel === "data" ? "" : "data"); setAccountMessage(""); }} />
          <AccountRow icon={LogOut} label="Sair da conta" onClick={handleLogout} />
        </div>
        {accountPanel && (
          <div className="border-t border-[var(--border)] px-5 py-4 md:px-6">
            {accountPanel === "email" && (
              <div className="space-y-3">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  placeholder="novo@email.com"
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-placeholder)]"
                />
                <button onClick={handleUpdateEmail} className="rounded-full bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-card)]">
                  Enviar confirmação
                </button>
              </div>
            )}

            {accountPanel === "password" && (
              <div className="space-y-3">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Nova senha"
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-placeholder)]"
                />
                <button onClick={handleUpdatePassword} className="rounded-full bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-card)]">
                  Atualizar senha
                </button>
              </div>
            )}

            {accountPanel === "data" && (
              <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                <p><span className="text-[var(--text-muted)]">ID:</span> {user?.id}</p>
                <p><span className="text-[var(--text-muted)]">Email:</span> {user?.email}</p>
                <p><span className="text-[var(--text-muted)]">Cargo:</span> {isAdmin ? "admin" : profile?.role || "user"}</p>
                <p><span className="text-[var(--text-muted)]">Status do plano:</span> {active ? "ativo" : isAdmin ? "admin" : "sem plano"}</p>
              </div>
            )}

            {accountMessage && <p className="mt-3 text-xs text-[var(--text-muted)]">{accountMessage}</p>}
          </div>
        )}
      </Section>

      <Section icon={Eye} label="Privacidade">
        <div className="divide-y divide-[var(--border)]">
          {[
            { key: "private_profile", label: "Perfil privado", icon: Globe },
            { key: "reading_activity", label: "Mostrar atividade de leitura", icon: Eye },
            { key: "show_online_status", label: "Mostrar status online", icon: User },
          ].map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between px-5 py-4 md:px-6">
              <div className="flex items-center gap-3">
                <Icon className="size-[18px] text-[var(--text-muted)]" />
                <span className="text-sm text-[var(--text-primary)]">{label}</span>
              </div>
              <Toggle value={privacy[key]} disabled={savingPreference === key} onChange={() => togglePreference(key)} />
            </div>
          ))}
          {savingPreference && <p className="px-5 py-3 text-xs text-[var(--text-muted)] md:px-6">Salvando preferência...</p>}
          {preferenceError && <p className="px-5 py-3 text-xs text-red-400 md:px-6">{preferenceError}</p>}
        </div>
      </Section>

      <Section icon={theme === "dark" ? Sun : Moon} label="Aparência">
        <div className="divide-y divide-[var(--border)]">
          <div className="flex items-center justify-between px-5 py-4 md:px-6">
            <div className="flex items-center gap-3">
              {theme === "dark" ? <Sun className="size-[18px] text-[var(--text-muted)]" /> : <Moon className="size-[18px] text-[var(--text-muted)]" />}
              <span className="text-sm text-[var(--text-primary)]">Modo {theme === "dark" ? "claro" : "escuro"}</span>
            </div>
            <Toggle value={theme === "dark"} onChange={toggleTheme} />
          </div>
        </div>
      </Section>

      <div className="overflow-hidden rounded-[12px] border border-red-900/20 bg-red-950/[0.04]">
        <div className="flex items-center gap-2 px-5 pb-3 pt-5 md:px-6">
          <Trash2 className="size-4 text-red-400" />
          <h2 className="text-[12px] font-[400] uppercase tracking-[0.6px] text-red-400">Zona de perigo</h2>
        </div>
        <div className="px-5 pb-6 md:px-6">
          <p className="mb-4 text-sm leading-relaxed text-[var(--text-secondary)]">
            Excluir sua conta removerá permanentemente seu perfil, publicações e dados. Esta ação não pode ser desfeita.
          </p>
          <div className="flex flex-wrap gap-3">
            <button className="flex items-center gap-2 rounded-[100px] border border-red-900/30 px-5 py-[10px] text-[14px] font-[500] leading-[20px] text-red-400 transition-all hover:border-red-700/50 hover:bg-red-950/20">
              <Trash2 className="size-4" />
              Excluir conta
            </button>
            <button className="rounded-[100px] border border-[var(--border)] px-5 py-[10px] text-[14px] font-[500] leading-[20px] text-[var(--text-secondary)] transition-all hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]">
              Baixar meus dados
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
