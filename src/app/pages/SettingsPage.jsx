import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, Smartphone, Eye, Globe, Moon, Mail, Lock,
  Trash2, ChevronRight, CreditCard, User, Shield,
  CircleCheck, Sun, AlertCircle,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useData } from "@/app/data/DataContext";
import { isActiveSubscription } from "@/lib/subscription";

const planFeatures = [
  "Acesso completo à biblioteca",
  "Comunidade exclusiva de leitores",
  "Grupos de leitura (clubes)",
  "Participação em eventos ao vivo",
  "Leitura offline",
  "Sem anúncios",
  "Suporte prioritário",
];

const statusLabels = {
  active: { text: "Ativo", color: "#1ea64a" },
  past_due: { text: "Pagamento pendente", color: "#f59e0b" },
  canceled: { text: "Cancelado", color: "var(--text-muted)" },
  expired: { text: "Expirado", color: "var(--text-muted)" },
  pending: { text: "Pendente", color: "#f59e0b" },
  refunded: { text: "Reembolsado", color: "var(--text-muted)" },
  chargeback: { text: "Contestado", color: "#ef4444" },
};

function Section({ icon: Icon, label, children, className = "" }) {
  return (
    <div className={`rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden ${className}`} style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="px-5 md:px-6 pt-5 pb-3 flex items-center gap-2">
        <Icon className="size-4" style={{ color: "var(--text-muted)" }} />
        <h2 className="text-[12px] font-[400] uppercase tracking-[0.6px]" style={{ color: "var(--text-secondary)" }}>
          {label}
        </h2>
      </div>
      {children}
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={onChange}
      className={`relative w-[44px] h-[26px] rounded-full transition-colors shrink-0 ${
        value ? "bg-[var(--text-primary)]" : "bg-[var(--border)]"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 size-[22px] rounded-full bg-[var(--bg-card)] border border-[var(--border-strong)] transition-transform ${
          value ? "translate-x-[18px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export function SettingsPage() {
  const { subscription, cancelSubscription } = useData();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState({ email: true, push: true, replies: false, events: true });
  const [privacity, setPrivacity] = useState({ privateProfile: false, readingActivity: true, showOnlineStatus: true });
  const { theme, toggle: toggleTheme } = useTheme();
  const [cancelling, setCancelling] = useState(false);

  const toggle = (obj, setter, key) => setter({ ...obj, [key]: !obj[key] });

  const active = isActiveSubscription(subscription);
  const statusInfo = statusLabels[subscription?.status] || { text: "Desconhecido", color: "var(--text-muted)" };

  async function handleCancel() {
    if (!subscription || cancelling) return;
    setCancelling(true);
    await cancelSubscription(subscription.id);
    setCancelling(false);
  }

  return (
    <div className="space-y-8 md:space-y-10 max-w-2xl mx-auto w-full">
      <div>
        <h1 className="text-[24px] font-[600] leading-[32px] tracking-[-0.96px] text-[var(--text-primary)]">
          Configurações
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Gerencie sua conta, plano e preferências no OPE Club.
        </p>
      </div>

      <Section icon={CreditCard} label="Plano atual">
        <div className="px-5 md:px-6 pb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className="text-[20px] font-[600] leading-[28px] tracking-[-0.6px] text-[var(--text-primary)] block">
                OPE Club
              </span>
              <span className="text-[12px] font-[400] tracking-[0.6px] uppercase mt-1 block" style={{ color: "var(--text-muted)" }}>
                {subscription ? "R$ 27,00 / mês" : "Sem assinatura ativa"}
              </span>
            </div>
            {subscription && (
              <span
                className="text-[12px] font-[400] uppercase tracking-[0.6px] px-3 py-1 rounded-[6px]"
                style={{ color: statusInfo.color, background: `${statusInfo.color}15` }}
              >
                {statusInfo.text}
              </span>
            )}
          </div>

          {!subscription && (
            <div className="mb-5 p-4 rounded-[8px] flex items-start gap-3" style={{ background: "var(--hover-overlay)" }}>
              <AlertCircle className="size-4 mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} />
              <div>
                <p className="text-sm font-[500] text-[var(--text-primary)]">Você ainda não tem uma assinatura</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Assine o OPE Club para acessar a biblioteca completa e a comunidade.</p>
              </div>
            </div>
          )}

          {subscription && (
            <>
              <ul className="space-y-2.5 mb-5">
                {planFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                    {active ? (
                      <CircleCheck className="size-4 text-[#1ea64a] shrink-0" strokeWidth={1.5} />
                    ) : (
                      <CircleCheck className="size-4 shrink-0" style={{ color: "var(--text-muted)" }} strokeWidth={1.5} />
                    )}
                    {f}
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-3">
                {active ? (
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="px-5 py-[10px] rounded-[100px] border border-[var(--border)] text-[var(--text-primary)] text-[14px] font-[500] leading-[20px] hover:border-[var(--border-strong)] transition-all disabled:opacity-50"
                  >
                    {cancelling ? "Cancelando..." : "Cancelar assinatura"}
                  </button>
                ) : (
                  <button
                    onClick={() => navigate("/assinar")}
                    className="px-5 py-[10px] rounded-[100px] bg-[var(--text-primary)] text-[var(--bg-card)] text-[14px] font-[500] leading-[20px] hover:opacity-90 transition-all"
                  >
                    Assinar agora
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </Section>

      <Section icon={User} label="Conta">
        <div className="divide-y divide-[var(--border)]">
          {[
            { icon: Mail, label: "Alterar email" },
            { icon: Lock, label: "Alterar senha" },
            { icon: Shield, label: "Dados da conta" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center justify-between px-5 md:px-6 py-4 cursor-pointer hover:bg-[var(--hover-overlay)] transition-colors group">
              <div className="flex items-center gap-3">
                <Icon className="size-[18px]" style={{ color: "var(--text-muted)" }} />
                <span className="text-sm text-[var(--text-primary)]">{label}</span>
              </div>
              <ChevronRight className="size-4" style={{ color: "var(--border-strong)" }} />
            </div>
          ))}
        </div>
      </Section>

      <Section icon={Bell} label="Notificações">
        <div className="divide-y divide-[var(--border)]">
          {[
            { key: "email", label: "Notificações por email", icon: Mail },
            { key: "push", label: "Notificações push", icon: Smartphone },
            { key: "replies", label: "Respostas e menções", icon: Bell },
            { key: "events", label: "Eventos e novidades", icon: Eye },
          ].map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between px-5 md:px-6 py-4">
              <div className="flex items-center gap-3">
                <Icon className="size-[18px]" style={{ color: "var(--text-muted)" }} />
                <span className="text-sm text-[var(--text-primary)]">{label}</span>
              </div>
              <Toggle value={notifs[key]} onChange={() => toggle(notifs, setNotifs, key)} />
            </div>
          ))}
        </div>
      </Section>

      <Section icon={Eye} label="Privacidade">
        <div className="divide-y divide-[var(--border)]">
          {[
            { key: "privateProfile", label: "Perfil privado", icon: Globe },
            { key: "readingActivity", label: "Mostrar atividade de leitura", icon: Eye },
            { key: "showOnlineStatus", label: "Mostrar status online", icon: User },
          ].map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between px-5 md:px-6 py-4">
              <div className="flex items-center gap-3">
                <Icon className="size-[18px]" style={{ color: "var(--text-muted)" }} />
                <span className="text-sm text-[var(--text-primary)]">{label}</span>
              </div>
              <Toggle value={privacity[key]} onChange={() => toggle(privacity, setPrivacity, key)} />
            </div>
          ))}
        </div>
      </Section>

      <Section icon={theme === "dark" ? Sun : Moon} label="Aparência">
        <div className="divide-y divide-[var(--border)]">
          <div className="flex items-center justify-between px-5 md:px-6 py-4">
            <div className="flex items-center gap-3">
              {theme === "dark" ? <Sun className="size-[18px]" style={{ color: "var(--text-muted)" }} /> : <Moon className="size-[18px]" style={{ color: "var(--text-muted)" }} />}
              <span className="text-sm text-[var(--text-primary)]">Modo {theme === "dark" ? "claro" : "escuro"}</span>
            </div>
            <Toggle value={theme === "dark"} onChange={toggleTheme} />
          </div>
        </div>
      </Section>

      <div className="rounded-[12px] border border-red-900/20 bg-red-950/[0.04] overflow-hidden">
        <div className="px-5 md:px-6 pt-5 pb-3 flex items-center gap-2">
          <Trash2 className="size-4 text-red-400" />
          <h2 className="text-[12px] font-[400] text-red-400 uppercase tracking-[0.6px]">Zona de perigo</h2>
        </div>
        <div className="px-5 md:px-6 pb-6">
          <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
            Excluir sua conta removerá permanentemente seu perfil, publicações e dados.
            Esta ação não pode ser desfeita.
          </p>
          <div className="flex flex-wrap gap-3">
            <button className="px-5 py-[10px] rounded-[100px] border border-red-900/30 text-red-400 text-[14px] font-[500] leading-[20px] hover:bg-red-950/20 hover:border-red-700/50 transition-all flex items-center gap-2">
              <Trash2 className="size-4" />
              Excluir conta
            </button>
            <button className="px-5 py-[10px] rounded-[100px] border border-[var(--border)] text-[var(--text-secondary)] text-[14px] font-[500] leading-[20px] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all">
              Baixar meus dados
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
