import { useState } from "react";
import {
  Camera, Heart, MessageCircle, BookOpen, Users,
  Trophy, PenLine, Clock, Bookmark, TrendingUp,
} from "lucide-react";
import { useAuth } from "@/app/data/AuthContext";
import { useData } from "@/app/data/DataContext";
import { supabase, isSupabaseReady } from "@/app/data/supabase";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

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
  const { posts, books } = useData();
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState({
    name: authProfile?.name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Visitante",
    handle: user?.email?.split("@")[0] || "visitante",
    bio: authProfile?.bio || "Leitor de filosofia e literatura.",
    avatar: authProfile?.avatar || user?.user_metadata?.avatar_url || null,
  });
  const [editName, setEditName] = useState(profile.name);
  const [editBio, setEditBio] = useState(profile.bio);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const achievements = [];
  const readingStats = [];

  const userPosts = posts.filter(p => p.user_id === user?.id);
  const stats = [
    { label: "Livros", value: books.length, icon: BookOpen },
    { label: "Publicações", value: userPosts.length, icon: MessageCircle },
    { label: "Seguidores", value: 0, icon: Users },
    { label: "Seguindo", value: 0, icon: Users },
  ];

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_AVATAR_BYTES) {
      setSaveError("A imagem precisa ter no máximo 2 MB.");
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
    if (!isSupabaseReady() || !user?.id) {
      setProfile({ ...profile, name: editName, bio: editBio, avatar: avatarPreview || profile.avatar });
      setEditing(false);
      return;
    }

    setSaving(true);
    setSaveError("");

    try {
      let avatarUrl = profile.avatar;

      if (avatarFile) {
        const ext = (avatarFile.name.split(".").pop() || "png").toLowerCase();
        const filePath = `${user.id}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, avatarFile, {
            cacheControl: "3600",
            contentType: avatarFile.type || "image/png",
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
        avatarUrl = data.publicUrl;
      }

      const nextProfile = { ...profile, name: editName, bio: editBio, avatar: avatarUrl };

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        email: user.email,
        name: nextProfile.name,
        bio: nextProfile.bio,
        avatar: nextProfile.avatar,
      });

      if (profileError) throw profileError;

      // Apenas o nome vai para o user_metadata: ele é embutido em todo JWT.
      // Guardar imagem aqui estoura o limite de header do HTTP/2 e derruba
      // todas as requisições autenticadas.
      const { error: authError } = await supabase.auth.updateUser({
        data: { name: nextProfile.name },
      });

      if (authError) throw authError;

      setProfile(nextProfile);
      setAvatarFile(null);
      setAvatarPreview(null);
      setEditing(false);
    } catch (err) {
      setSaveError(err?.message || "Não foi possível salvar o perfil.");
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditName(profile.name);
    setEditBio(profile.bio);
    setAvatarFile(null);
    setAvatarPreview(null);
    setSaveError("");
    setEditing(false);
  };

  return (
    <div className="space-y-8 md:space-y-10">
      <Card className="p-5 md:p-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="relative group">
            <div className="size-20 sm:size-24 rounded-full bg-gradient-to-br from-[var(--border)] to-[var(--bg-card-hover)] flex items-center justify-center text-2xl sm:text-3xl font-bold text-[var(--text-primary)] border-2 border-[var(--border)] overflow-hidden">
              {(avatarPreview || profile.avatar) && !avatarBroken ? (
                <img src={avatarPreview || profile.avatar} alt="" className="w-full h-full object-cover" onError={() => setAvatarBroken(true)} />
              ) : (
                profile.name.charAt(0)
              )}
            </div>
            {editing && (
              <label className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="size-5 text-white" />
                <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
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
                  placeholder="Seu nome"
                  className="w-full bg-[var(--bg-canvas)] border border-[var(--border)] rounded-[6px] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)] transition-colors"
                />
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Sua bio"
                  rows={3}
                  className="w-full bg-[var(--bg-canvas)] border border-[var(--border)] rounded-[6px] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)] transition-colors resize-none"
                />
                {saveError && (
                  <p className="text-sm" style={{ color: "var(--text-danger, #ef4444)" }}>{saveError}</p>
                )}
                <div className="flex gap-2 pt-1 justify-center sm:justify-start">
                  <button onClick={saveProfile} disabled={saving} className="px-5 py-2 rounded-[100px] bg-[var(--text-primary)] text-[var(--bg-card)] text-sm font-medium hover:opacity-90 transition-all disabled:opacity-60">
                    {saving ? "Salvando..." : "Salvar"}
                  </button>
                  <button onClick={cancelEdit} disabled={saving} className="px-5 py-2 rounded-[100px] border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all disabled:opacity-60">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-xl sm:text-2xl font-[600] text-[var(--text-primary)]">{profile.name}</h1>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>@{profile.handle}</p>
                <p className="text-sm mt-2 max-w-md leading-relaxed" style={{ color: "var(--text-secondary)" }}>{profile.bio}</p>
                <button
                  onClick={() => setEditing(true)}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-[100px] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all"
                >
                  <PenLine className="size-3.5" />
                  Editar perfil
                </button>
              </>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="p-4 sm:p-5 text-center hover:border-[var(--border-strong)] transition-all duration-200">
              <p className="text-xl sm:text-2xl font-[600] text-[var(--text-primary)]">{s.value}</p>
              <div className="flex items-center justify-center gap-1.5 mt-1.5">
                <Icon className="size-3" style={{ color: "var(--text-muted)" }} />
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{s.label}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-5">
            <Trophy className="size-4" style={{ color: "var(--text-muted)" }} />
            <h3 className="text-sm font-[600] text-[var(--text-primary)]">Conquistas</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {achievements.map((a) => {
              const Icon = a.icon;
              return (
                <div key={a.label} className="rounded-[8px] border border-[var(--border)] bg-[var(--hover-overlay)] p-3.5 text-center hover:border-[var(--border-strong)] transition-all duration-200">
                  <Icon className="size-5 mx-auto" style={{ color: a.color }} strokeWidth={1.5} />
                  <p className="text-xs font-medium text-[var(--text-primary)] mt-2">{a.label}</p>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{a.desc}</p>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="size-4" style={{ color: "var(--text-muted)" }} />
            <h3 className="text-sm font-[600] text-[var(--text-primary)]">Estatísticas</h3>
          </div>
          <div className="space-y-3.5">
            {readingStats.map((s) => (
              <div key={s.label} className="flex items-center justify-between text-sm">
                <span style={{ color: "var(--text-secondary)" }}>{s.label}</span>
                <span className="font-medium text-[var(--text-primary)]">{s.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <section>
        <h3 className="text-sm font-[600] text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <Clock className="size-4" style={{ color: "var(--text-muted)" }} />
          Últimas publicações
        </h3>
        <div className="space-y-3">
          {userPosts.slice(0, 5).map((p, i) => (
            <Card key={p.id || i} className="p-4 hover:border-[var(--border-strong)] transition-all duration-200">
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>&ldquo;{p.text}&rdquo;</p>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--border)]">
                <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  <Heart className="size-3.5" strokeWidth={1.5} /> {p.likes || 0}
                </span>
                <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  <MessageCircle className="size-3.5" strokeWidth={1.5} /> {p.replies || 0}
                </span>
                {p.book && (
                  <span className="flex items-center gap-1.5 text-xs ml-auto" style={{ color: "var(--text-muted)" }}>
                    <Bookmark className="size-3.5" strokeWidth={1.5} /> {p.book.title || p.book}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
