import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Mail, Shield, Trash2, User } from "@/lib/icons";
import { SettingsLayout, SettingsRow, SettingsSection } from "../../components/SettingsLayout";
import { useAuth } from "../../data/AuthContext";
import { useData } from "../../data/DataContext";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { isSupabaseReady } from "../../data/supabase";
import { authApi } from "@/lib/auth-api";
import { authenticatedApiPost } from "@/lib/authenticated-api";
import { toast } from "@/lib/toast";
import { isActiveSubscription } from "@/lib/subscription";

export function SettingsAccount() {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const { user, logout, isAdmin } = useAuth();
  const { profile, subscription } = useData();
  const confirm = useConfirmDialog();
  const [newEmail, setNewEmail] = useState(user?.email || "");
  const [savingEmail, setSavingEmail] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const active = isActiveSubscription(subscription);

  async function handleUpdateEmail(e) {
    e.preventDefault();
    if (!isSupabaseReady() || !newEmail.includes("@") || savingEmail) return;
    if (newEmail.trim() === user?.email) {
      toast.info("Esse ja e o seu email atual.");
      return;
    }
    setSavingEmail(true);
    try {
      await authApi.updateUser({ email: newEmail.trim() });
      toast.success("Confira seu email para confirmar a troca.");
    } catch (err) {
      toast.error(err?.message || "Nao foi possivel atualizar o email.");
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleDelete() {
    const ok = await confirm.ask({
      title: "Excluir sua conta?",
      description: "Esta acao e permanente. Seus dados, publicacoes e leituras serao apagados.",
      confirmLabel: "Excluir permanentemente",
      danger: true,
    });
    if (!ok) return;
    setDeletingAccount(true);
    try {
      if (!isSupabaseReady() || !user?.id) throw new Error("Sessao indisponivel");
      await authenticatedApiPost("/api/delete-account", { confirmation: "DELETE_ACCOUNT" });
      await logout();
      toast.success("Sua conta foi excluida permanentemente.");
      navigate("/entrar", { replace: true });
    } catch (error) {
      toast.error(error?.message || "Nao foi possivel excluir a conta. Tente novamente em instantes.");
    } finally {
      setDeletingAccount(false);
    }
  }

  return (
    <SettingsLayout
      title="Email e senha"
      subtitle="Como voce entra no OPE Club"
      onBack={() => setSearchParams({})}
    >
      {/* Email */}
      <SettingsSection icon={Mail} label="Email">
        <form onSubmit={handleUpdateEmail} className="px-4 py-3 sm:px-5">
          <label className="mb-1 block text-[11px] text-[var(--text-muted)]">Endereco de email</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="voce@email.com"
              className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--bg-page)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-mint)]"
            />
            <button
              type="submit"
              disabled={savingEmail || newEmail === user?.email}
              className="rounded-full bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-card)] disabled:opacity-40"
            >
              {savingEmail ? "Enviando..." : "Trocar"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-[var(--text-muted)]">
            Voce recebera um link de confirmacao no novo email.
          </p>
        </form>
      </SettingsSection>

      {/* Dados da conta */}
      <SettingsSection icon={User} label="Dados da conta">
        <SettingsRow title="ID da conta" description={user?.id} />
        <SettingsRow title="Cargo" description={isAdmin ? "admin" : profile?.role || "user"} />
        <SettingsRow title="Status do plano" description={active ? "ativo" : isAdmin ? "admin" : "sem plano"} />
        <SettingsRow title="Membro desde" description={profile?.created_at ? new Date(profile.created_at).toLocaleDateString("pt-BR") : "—"} />
      </SettingsSection>

      {/* Zona de perigo */}
      <section className="overflow-hidden rounded-[12px] border border-red-900/30 bg-red-950/[0.04]">
        <header className="flex items-center gap-2 border-b border-red-900/20 px-4 py-3 sm:px-5">
          <Trash2 className="size-3.5 text-red-400" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-red-400">Zona de perigo</h2>
        </header>
        <SettingsRow
          icon={Shield}
          title={deletingAccount ? "Excluindo conta..." : "Excluir conta"}
          description="Acao permanente e irreversivel"
          onClick={handleDelete}
          danger
        />
      </section>

      {confirm.dialog}
    </SettingsLayout>
  );
}
