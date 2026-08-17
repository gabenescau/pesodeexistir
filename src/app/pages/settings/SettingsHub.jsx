import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Bell, Camera, ChevronRight, CreditCard, Eye, Hash, HelpCircleIcon,
  ChartLine, Info, LogOut, Moon, PenLine, Shield, Smartphone, Sun, Trash2, User, Wallet,
} from "@/lib/icons";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "../../data/AuthContext";
import { useData } from "../../data/DataContext";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { handleDoPerfil } from "@/lib/mentions";
import { VerifiedBadge } from "../../components/VerifiedBadge";
import { UserTitlePill } from "../../components/UserTitlePill";
import { isActiveSubscription } from "@/lib/subscription";
import { isSupabaseReady } from "../../data/supabase";
import { authenticatedApiPost } from "@/lib/authenticated-api";
import { toast } from "@/lib/toast";
import { useState } from "react";

function HubRow({ icon: Icon, title, description, onClick, danger, right }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--hover-overlay)] sm:px-5 ${
        danger ? "text-red-400" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
          danger ? "bg-red-500/10 text-red-400" : "bg-[var(--hover-overlay)] text-[var(--text-muted)]"
        }`}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className={`truncate text-sm font-medium ${danger ? "text-red-400" : "text-[var(--text-primary)]"}`}>{title}</p>
          {description ? <p className="truncate text-[11px] text-[var(--text-muted)]">{description}</p> : null}
        </div>
      </div>
      {right ?? <ChevronRight className={`size-4 shrink-0 ${danger ? "text-red-400/60" : "text-[var(--border-strong)]"}`} />}
    </button>
  );
}

function Group({ label, children }) {
  return (
    <section className="overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)]" style={{ boxShadow: "var(--shadow-sm)" }}>
      {label ? (
        <header className="px-4 pb-1 pt-3 sm:px-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</h2>
        </header>
      ) : null}
      <div className="mt-1 divide-y divide-[var(--border)]">{children}</div>
    </section>
  );
}

export function SettingsHub() {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const { theme } = useTheme();
  const { user, logout, isAdmin } = useAuth();
  const { profile, subscription, collections } = useData();
  const confirm = useConfirmDialog();
  const [deletingAccount, setDeletingAccount] = useState(false);

  const go = (aba) => setSearchParams({ aba });
  const nome = profile?.name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Visitante";
  const handle = handleDoPerfil(profile);
  const avatar = profile?.avatar_url || profile?.avatar;
  const email = user?.email;
  const isVerified = Boolean(profile?.verified || profile?.is_verified || profile?.role === "admin");
  const active = isActiveSubscription(subscription);
  const minhasColecoes = collections.filter((c) => c.user_id === user?.id).length;

  async function handleLogout() {
    const ok = await confirm.ask({
      title: "Sair da conta?",
      description: "Voce precisara entrar novamente para acessar o OPE Club.",
      confirmLabel: "Sair",
      danger: false,
    });
    if (!ok) return;
    await logout();
    navigate("/");
  }

  async function handleDeleteAccount() {
    const ok = await confirm.ask({
      title: "Excluir sua conta?",
      description: "Acao irreversivel. Seus dados, publicacoes e leituras serao apagados permanentemente.",
      confirmLabel: "Excluir permanentemente",
      danger: true,
    });
    if (!ok) return;
    if (!isSupabaseReady() || !user?.id || deletingAccount) {
      toast.error("Nao foi possivel validar sua sessao. Entre novamente e tente outra vez.");
      return;
    }

    setDeletingAccount(true);
    try {
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
    <div className="mx-auto w-full max-w-2xl pb-24 lg:pb-8">
      {/* Cabecalho */}
      <div className="flex items-center justify-between px-1 pb-3">
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary)]">Configuracoes</h1>
      </div>

      {/* Cartao de perfil (igual as referencias) */}
      <section className="overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)]" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center gap-4 p-4 sm:p-5">
          <div className="size-14 shrink-0 overflow-hidden rounded-full border-2 border-[var(--border)] bg-[var(--hover-overlay)] text-lg font-bold text-[var(--text-primary)] sm:size-16">
            {avatar ? (
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">{nome.charAt(0).toUpperCase()}</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate text-base font-semibold text-[var(--text-primary)]">{nome}</p>
              {isVerified ? <VerifiedBadge className="size-4 text-[var(--accent-mint)]" /> : null}
              <UserTitlePill userId={user?.id} />
            </div>
            <p className="truncate text-xs text-[var(--text-muted)]">@{handle}</p>
            {email ? <p className="truncate text-[11px] text-[var(--text-muted)]">{email}</p> : null}
          </div>
          <button
            onClick={() => go("perfil")}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
          >
            <PenLine className="size-3.5" /> Editar
          </button>
        </div>
      </section>

      <div className="mt-5 space-y-5 sm:mt-6 sm:space-y-6">
        {/* CONTA */}
        <Group label="Conta">
          <HubRow icon={Camera} title="Informacoes pessoais" description="Nome, @handle, bio e foto" onClick={() => go("perfil")} />
          <HubRow icon={User} title="Email e senha" description="Como voce entra no app" onClick={() => go("conta")} />
          <HubRow icon={CreditCard} title="Assinatura" description={active ? "Plano ativo" : isAdmin ? "Acesso admin" : "Sem assinatura"} onClick={() => go("assinatura")} />
          <HubRow icon={ChartLine} title="Retrospectiva" description={active ? "Sua jornada mensal e anual" : "Exclusiva para assinantes"} onClick={() => go("retrospectiva")} />
          <HubRow icon={Hash} title="Minhas colecoes" description={`${minhasColecoes} ${minhasColecoes === 1 ? "colecao" : "colecoes"}`} onClick={() => go("colecoes")} />
        </Group>

        {/* PREFERENCIAS */}
        <Group label="Preferencias">
          <HubRow
            icon={theme === "dark" ? Sun : Moon}
            title="Aparencia"
            description={`Modo ${theme === "dark" ? "escuro" : "claro"}`}
            onClick={() => go("aparencia")}
          />
          <HubRow icon={Bell} title="Notificacoes" description="Push, email e atualizacoes" onClick={() => go("notificacoes")} />
          <HubRow icon={Eye} title="Privacidade" description="Perfil, atividade e status online" onClick={() => go("notificacoes")} />
        </Group>

        {/* SEGURANCA */}
        <Group label="Seguranca">
          <HubRow icon={Shield} title="Senha e login" description="Alterar senha e metodos de entrada" onClick={() => go("seguranca")} />
          <HubRow icon={Smartphone} title="Dispositivos conectados" description="Sessoes ativas e saida remota" onClick={() => go("seguranca")} />
        </Group>

        {/* SUPORTE */}
        <Group label="Suporte">
          <HubRow icon={HelpCircleIcon} title="Ajuda" description="FAQ, contato e termos" onClick={() => go("ajuda")} />
          <HubRow icon={Info} title="Sobre o OPE Club" description="Versao e informacoes" onClick={() => go("ajuda")} />
        </Group>

        {/* SAIR */}
        <Group>
          <HubRow icon={LogOut} title="Sair da conta" description="Encerrar a sessao atual" onClick={handleLogout} />
        </Group>

        {/* ZONA DE PERIGO */}
        <section className="overflow-hidden rounded-[12px] border border-red-900/30 bg-red-950/[0.04]">
          <header className="flex items-center gap-2 px-4 pt-3 sm:px-5">
            <Trash2 className="size-3.5 text-red-400" />
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-red-400">Zona de perigo</h2>
          </header>
          <div className="mt-1 divide-y divide-red-900/20">
            <HubRow
              icon={Trash2}
              title={deletingAccount ? "Excluindo conta..." : "Excluir conta"}
              description="Acao permanente e irreversivel"
              onClick={handleDeleteAccount}
              danger
            />
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--hover-overlay)] text-[var(--text-muted)]">
                  <Wallet className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">Baixar meus dados</p>
                  <p className="truncate text-[11px] text-[var(--text-muted)]">Exporta um JSON com seu perfil e posts</p>
                </div>
              </div>
              <button className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]">
                Em breve
              </button>
            </div>
          </div>
        </section>
      </div>

      {confirm.dialog}
    </div>
  );
}
