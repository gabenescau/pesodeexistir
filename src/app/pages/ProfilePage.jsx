import { useState } from "react";
import {
  Camera, MessageCircle, BookOpen, Users,
  PenLine, Clock, Bookmark,
} from "@/lib/icons";
import { HeartIcon } from "@/components/heart-icon";
import { useAuth } from "@/app/data/AuthContext";
import { useData } from "@/app/data/DataContext";
import { isSupabaseReady } from "@/app/data/supabase";
import { handleDoPerfil } from "@/lib/mentions";
import {
  PROFILE_LIMITS,
  storagePathFromPublicUrl,
  validateAvatarFile,
  validateProfileInput,
} from "@/lib/profile";
import { AchievementsPanel } from "../components/AchievementsPanel";
import { UserTitlePill } from "../components/UserTitlePill";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { secureUpload } from "@/lib/secure-upload";
import { removeLibraryFile } from "@/lib/library-media";
import { authApi } from "@/lib/auth-api";

function Card({ className, children, ...props }) {
  return (
    <div
      className={`rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] ${className || ""}`}
      style={{ boxShadow: "var(--shadow-sm)" }}
      {...props}
    >
      {children}
    </div>
  );
}

export function ProfilePage() {
  const { user, profile: authProfile } = useAuth();
  const { posts, books, followerCounts, followingCounts, getUserMetrics } = useData();
  const metrics = getUserMetrics(user?.id);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState({
    name: authProfile?.name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Visitante",
    // O handle publico vem de profiles.username; o email nunca vai para a tela.
    handle: handleDoPerfil(authProfile),
    bio: authProfile?.bio || "Leitor de filosofia e literatura.",
    avatar: authProfile?.avatar || user?.user_metadata?.avatar_url || null,
  });
  const [editName, setEditName] = useState(profile.name);
  const [editHandle, setEditHandle] = useState(profile.handle);
  const [editBio, setEditBio] = useState(profile.bio);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const userPosts = posts.filter(p => p.user_id === user?.id);
  const stats = [
    { label: "Livros", value: books.length, icon: BookOpen },
    { label: "Publicações", value: userPosts.length, icon: MessageCircle },
    { label: "Seguidores", value: followerCounts[user?.id] || 0, icon: Users },
    { label: "Seguindo", value: followingCounts[user?.id] || 0, icon: Users },
  ];

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      validateAvatarFile(file);
    } catch (error) {
      setSaveError(error.message);
      e.target.value = "";
      return;
    }

    setSaveError("");
    setAvatarBroken(false);
    setAvatarFile(file);

    // O data URL serve apenas como pré-visualização na tela. Ele nunca é
    // persistido: quem vai para o banco é a URL do arquivo no Storage.
    const reader = new FileReader();
    reader.onload = (event) => setAvatarPreview(event.target.result);
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    let validated;
    try {
      validated = validateProfileInput({
        name: editName,
        handle: editHandle,
        bio: editBio,
      });
    } catch (error) {
      setSaveError(error.message);
      return;
    }

    if (!isSupabaseReady() || !user?.id) {
      setProfile({ ...profile, ...validated, avatar: avatarPreview || profile.avatar });
      setEditing(false);
      return;
    }

    setSaving(true);
    setSaveError("");

    let uploadedPath = null;
    try {
      let avatarUrl = profile.avatar;

      if (avatarFile) {
        validateAvatarFile(avatarFile);
        uploadedPath = await secureUpload({
          file: avatarFile,
          bucket: "avatars",
          kind: "avatar",
        });

        avatarUrl = `${import.meta.env.NEXT_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/${uploadedPath}`;
      }

      const nextProfile = { ...profile, ...validated, avatar: avatarUrl };

      // email nao entra mais aqui: mora em user_emails, preenchido pelo trigger
      // de cadastro. profiles ficou sem coluna sensivel. Usamos update (e nao
      // upsert) porque a policy de INSERT exige service role: o trigger
      // handle_new_user garante que a linha ja existe para todo auth.uid().
      await authApi.updateProfile({
        name: nextProfile.name,
        username: nextProfile.handle,
        bio: nextProfile.bio,
        avatar: nextProfile.avatar,
        avatar_url: nextProfile.avatar,
        updated_at: new Date().toISOString(),
      });
      // Apenas o nome vai para o user_metadata: ele é embutido em todo JWT.
      // Guardar imagem aqui estoura o limite de header do HTTP/2 e derruba
      // todas as requisições autenticadas.
      await authApi.updateUser({ data: { name: nextProfile.name } }).catch((authError) => {
        console.warn("Perfil salvo; nao foi possivel sincronizar o nome no Auth:", authError.message);
      });

      const previousAvatarPath = storagePathFromPublicUrl(profile.avatar, "avatars");
      if (uploadedPath && previousAvatarPath && previousAvatarPath !== uploadedPath) {
        await removeLibraryFile("avatars", previousAvatarPath).catch((removeError) => {
          console.warn("Avatar antigo nao removido:", removeError.message);
        });
      }

      setProfile(nextProfile);
      setAvatarFile(null);
      setAvatarPreview(null);
      setEditing(false);
    } catch (err) {
      if (uploadedPath) {
        await removeLibraryFile("avatars", uploadedPath).catch(() => {});
      }
      setSaveError(err?.message || "Não foi possível salvar o perfil.");
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditName(profile.name);
    setEditHandle(profile.handle);
    setEditBio(profile.bio);
    setAvatarFile(null);
    setAvatarPreview(null);
    setSaveError("");
    setEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Header do Perfil */}
      <Card className="p-5 sm:p-6 rounded-[14px]">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="relative group shrink-0">
            <div className="size-20 sm:size-24 rounded-full bg-[var(--bg-canvas)] flex items-center justify-center text-2xl sm:text-3xl font-bold text-[var(--text-primary)] border border-[var(--border)] overflow-hidden">
              {(avatarPreview || profile.avatar) && !avatarBroken ? (
                <img src={avatarPreview || profile.avatar} alt="" className="w-full h-full object-cover" onError={() => setAvatarBroken(true)} />
              ) : (
                profile.name.charAt(0)
              )}
            </div>
            {editing && (
              <label className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="size-5 text-white" />
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} className="hidden" />
              </label>
            )}
          </div>

          <div className="flex-1 text-center sm:text-left min-w-0 w-full">
            {editing ? (
              <div className="space-y-3 max-w-md mx-auto sm:mx-0">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={PROFILE_LIMITS.name}
                  placeholder="Seu nome"
                  className="w-full bg-[var(--bg-canvas)] border border-[var(--border)] rounded-[8px] px-3.5 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)] transition-colors"
                />
                <div className="flex items-center gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3.5 py-2 focus-within:border-[var(--border-strong)]">
                  <span className="text-sm text-[var(--text-muted)]">@</span>
                  <input
                    type="text"
                    value={editHandle}
                    onChange={(e) => setEditHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    placeholder="seu_usuario"
                    maxLength={24}
                    className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none"
                  />
                </div>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  maxLength={PROFILE_LIMITS.bio}
                  placeholder="Sua bio"
                  rows={3}
                  className="w-full bg-[var(--bg-canvas)] border border-[var(--border)] rounded-[8px] px-3.5 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)] transition-colors resize-none"
                />
                {saveError && (
                  <p className="text-xs text-red-400">{saveError}</p>
                )}
                <div className="flex gap-2 pt-1 justify-center sm:justify-start">
                  <button onClick={saveProfile} disabled={saving} className="px-4 py-2 rounded-[8px] bg-[var(--text-primary)] text-[var(--bg-card)] text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-60">
                    {saving ? "Salvando..." : "Salvar"}
                  </button>
                  <button onClick={cancelEdit} disabled={saving} className="px-4 py-2 rounded-[8px] border border-[var(--border)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-60">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">{profile.name}</h1>
                  {(authProfile?.verified || authProfile?.is_verified || authProfile?.role === "admin") && <VerifiedBadge className="size-5 text-[var(--text-primary)]" />}
                  <UserTitlePill userId={user?.id} />
                </div>
                <p className="text-xs text-[var(--text-muted)]">@{profile.handle}</p>
                <p className="text-sm mt-2 max-w-md leading-relaxed text-[var(--text-secondary)]">{profile.bio}</p>
                <button
                  onClick={() => setEditing(true)}
                  className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[8px] border border-[var(--border)] text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] transition-colors"
                >
                  <PenLine className="size-3.5" />
                  Editar Perfil
                </button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="p-4 text-center rounded-[14px] hover:border-[var(--border-strong)] transition-all">
              <p className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">{s.value}</p>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <Icon className="size-3 text-[var(--text-muted)]" />
                <p className="text-xs text-[var(--text-muted)]">{s.label}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Conquistas / Selos */}
      <AchievementsPanel metrics={metrics} />

      {/* Últimas Publicações */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Clock className="size-4 text-[var(--text-muted)]" />
          Últimas Publicações
        </h3>
        <div className="space-y-3">
          {userPosts.slice(0, 5).map((p, i) => (
            <Card key={p.id || i} className="p-4 rounded-[14px] hover:border-[var(--border-strong)] transition-all">
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">&ldquo;{p.text}&rdquo;</p>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--border)]">
                <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <HeartIcon className="size-3.5" /> {p.likes || 0}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <MessageCircle className="size-3.5" strokeWidth={1.5} /> {p.replies || 0}
                </span>
                {p.book && (
                  <span className="flex items-center gap-1.5 text-xs ml-auto text-[var(--text-muted)]">
                    <Bookmark className="size-3.5" strokeWidth={1.5} /> {p.book.title || p.book}
                  </span>
                )}
              </div>
            </Card>
          ))}
          {userPosts.length === 0 && (
            <p className="text-xs text-[var(--text-muted)] py-4 text-center">Nenhuma publicação realizada ainda.</p>
          )}
        </div>
      </section>
    </div>
  );
}
