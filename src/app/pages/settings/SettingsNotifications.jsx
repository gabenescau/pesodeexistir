import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bell, Globe, Heart, Mail, User } from "@/lib/icons";
import { SettingsLayout, SettingsSection, SettingsToggle } from "../../components/SettingsLayout";
import { useAuth } from "../../data/AuthContext";
import { useData } from "../../data/DataContext";
import { toast } from "@/lib/toast";

const LOCAL_KEY = "ope_notification_prefs";

const DEFAULTS = {
  push_likes: true,
  push_comments: true,
  push_releases: true,
  email_digest: false,
  inapp_sounds: true,
};

function loadLocal() {
  if (typeof localStorage === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function NotifRow({ title, description, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[var(--text-primary)]">{title}</p>
        {description ? <p className="truncate text-[11px] text-[var(--text-muted)]">{description}</p> : null}
      </div>
      <SettingsToggle value={value} onChange={onChange} />
    </div>
  );
}

export function SettingsNotifications() {
  const [, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { profile, updateProfilePreferences } = useData();
  const [privacy, setPrivacy] = useState({
    private_profile: false,
    reading_activity: true,
    show_online_status: true,
  });
  const [savingKey, setSavingKey] = useState("");
  const [prefs, setPrefs] = useState(DEFAULTS);

  useEffect(() => {
    setPrefs(loadLocal());
  }, []);

  useEffect(() => {
    if (!profile) return;
    setPrivacy({
      private_profile: Boolean(profile.private_profile),
      reading_activity: profile.reading_activity !== false,
      show_online_status: profile.show_online_status !== false,
    });
  }, [profile]);

  function persistLocal(next) {
    setPrefs(next);
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(next)); } catch {}
  }

  function togglePref(key) {
    const next = { ...prefs, [key]: !prefs[key] };
    persistLocal(next);
  }

  async function togglePrivacy(key) {
    if (!user?.id || savingKey) return;
    const previous = privacy;
    const next = { ...privacy, [key]: !privacy[key] };
    setPrivacy(next);
    setSavingKey(key);
    try {
      await updateProfilePreferences(user.id, { [key]: next[key] });
    } catch (err) {
      setPrivacy(previous);
      toast.error(err?.message || "Nao foi possivel salvar.");
    } finally {
      setSavingKey("");
    }
  }

  return (
    <SettingsLayout
      title="Notificacoes e privacidade"
      subtitle="O que voce recebe e o que os outros veem"
      onBack={() => setSearchParams({})}
    >
      <SettingsSection icon={Bell} label="Notificacoes push">
        <NotifRow
          title="Curtidas em posts"
          description="Avisar quando alguem curtir"
          value={prefs.push_likes}
          onChange={() => togglePref("push_likes")}
        />
        <NotifRow
          title="Comentarios e respostas"
          description="Novos comentarios nas suas publicacoes"
          value={prefs.push_comments}
          onChange={() => togglePref("push_comments")}
        />
        <NotifRow
          title="Lancamentos da semana"
          description="Quando um livro novo for lancado"
          value={prefs.push_releases}
          onChange={() => togglePref("push_releases")}
        />
      </SettingsSection>

      <SettingsSection icon={Mail} label="Email">
        <NotifRow
          title="Resumo semanal"
          description="Um email por semana com destaques"
          value={prefs.email_digest}
          onChange={() => togglePref("email_digest")}
        />
      </SettingsSection>

      <SettingsSection icon={Globe} label="Privacidade">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--text-primary)]">Perfil privado</p>
            <p className="truncate text-[11px] text-[var(--text-muted)]">Apenas seguidores veem seu perfil.</p>
          </div>
          <SettingsToggle
            value={privacy.private_profile}
            disabled={savingKey === "private_profile"}
            onChange={() => togglePrivacy("private_profile")}
          />
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Heart className="size-4 shrink-0 text-[var(--text-muted)]" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--text-primary)]">Mostrar atividade de leitura</p>
              <p className="truncate text-[11px] text-[var(--text-muted)]">Exibe o que voce esta lendo.</p>
            </div>
          </div>
          <SettingsToggle
            value={privacy.reading_activity}
            disabled={savingKey === "reading_activity"}
            onChange={() => togglePrivacy("reading_activity")}
          />
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <User className="size-4 shrink-0 text-[var(--text-muted)]" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--text-primary)]">Mostrar status online</p>
              <p className="truncate text-[11px] text-[var(--text-muted)]">Outros veem quando voce esta ativo.</p>
            </div>
          </div>
          <SettingsToggle
            value={privacy.show_online_status}
            disabled={savingKey === "show_online_status"}
            onChange={() => togglePrivacy("show_online_status")}
          />
        </div>
      </SettingsSection>
    </SettingsLayout>
  );
}
