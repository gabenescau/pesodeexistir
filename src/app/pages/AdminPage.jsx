import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../data/AuthContext";
import { useData } from "../data/DataContext";
import { isSupabaseReady, supabase } from "../data/supabase";
import { toast } from "@/lib/toast";
import { Plus, Trash2, Edit3, Check, Crown, BookOpen, Users, MessageSquare, ShieldAlert, Sparkles, FolderOpen, RefreshCw, ChartLine, Gift, Truck, Flag, Wallet, Package } from "@/lib/icons";
import { isActiveSubscription, pickCurrentSubscription } from "@/lib/subscription";
import { planInfoFromCode } from "@/lib/plans";
import {
  LIBRARY_BUCKETS,
  removeLibraryFile,
  uploadLibraryFile,
  validateLibraryFile,
} from "@/lib/library-media";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { BarChart, DonutChart, LineChart } from "@/components/ui/chart";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: ChartLine },
  { id: "users", label: "Usuários", icon: Users },
  { id: "creditos", label: "Créditos", icon: Wallet },
  { id: "pedidos", label: "Pedidos", icon: Package },
  { id: "subscriptions", label: "Assinaturas", icon: Crown },
  { id: "posts", label: "Posts", icon: MessageSquare },
  { id: "releases", label: "Lançamentos", icon: Sparkles },
  { id: "categories", label: "Categorias", icon: FolderOpen },
  { id: "books", label: "Livros", icon: BookOpen },
  { id: "authors", label: "Autores", icon: Users },
  { id: "resgates", label: "Resgates", icon: Truck },
  { id: "loja", label: "Loja", icon: Gift },
  { id: "indicacoes", label: "Indicações", icon: Users },
  { id: "seasons", label: "Seasons", icon: Sparkles },
  { id: "spam", label: "Spam", icon: Flag },
];

function getPageItems(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items = [1];
  for (let i = 2; i < total; i++) {
    if (Math.abs(i - current) <= 1) items.push(i);
    else if (items[items.length - 1] !== "ellipsis") items.push("ellipsis");
  }
  items.push(total);
  return items;
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function PaginationBar({ currentPage, totalPages, onPageChange }) {
  const safePage = Math.min(currentPage, totalPages);
  const pageItems = getPageItems(safePage, totalPages);
  return (
    <Pagination className="pt-1">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            render={<button type="button" />}
            disabled={safePage === 1}
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
          />
        </PaginationItem>
        {pageItems.map((item, index) =>
          item === "ellipsis" ? (
            <PaginationItem key={`ellipsis-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationLink
                render={<button type="button" />}
                isActive={item === safePage}
                onClick={() => onPageChange(item)}
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          )
        )}
        <PaginationItem>
          <PaginationNext
            render={<button type="button" />}
            disabled={safePage === totalPages}
            onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

function StatCard({ label, value, hint, icon: Icon }) {
  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
          {hint ? <p className="mt-1 text-[11px] text-[var(--text-muted)]">{hint}</p> : null}
        </div>
        {Icon ? (
          <span className="flex size-9 items-center justify-center rounded-[8px] bg-[var(--accent-mint)]/10 text-[var(--accent-mint)]">
            <Icon className="size-4" weight="bold" />
          </span>
        ) : null}
      </div>
    </div>
  );
}

function DashboardTab() {
  const { books, authors, posts, profiles, subscriptions, weeklyReleases, categories, bookFavorites, savedPostIds, myCounts } = useData();

  const totalUsers = profiles.length;
  const totalBooks = books.length;
  const totalAuthors = authors.length;
  const totalPosts = posts.length;
  const totalSubs = subscriptions.length;
  const monthlySubs = subscriptions.filter((sub) => planInfoFromCode(sub.plan)?.cycle === "monthly").length;
  const annualSubs = subscriptions.filter((sub) => planInfoFromCode(sub.plan)?.cycle === "annual").length;
  const activeSubs = subscriptions.filter((sub) => isActiveSubscription(sub)).length;
  const totalFavorites = bookFavorites.length;
  const totalSaved = savedPostIds.length;

  const postsPerTag = useMemo(() => {
    const map = new Map();
    for (const post of posts) {
      const tag = post.tag || "Outros";
      map.set(tag, (map.get(tag) || 0) + 1);
    }
    return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [posts]);

  const booksPerCategory = useMemo(() => {
    const map = new Map();
    for (const book of books) {
      const cat = book.category || "Outros";
      map.set(cat, (map.get(cat) || 0) + 1);
    }
    return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [books]);

  const engagement = useMemo(() => {
    const totalLikes = posts.reduce((sum, post) => sum + (post.likes || 0), 0);
    const totalReplies = posts.reduce((sum, post) => sum + (post.replies || 0), 0);
    return { totalLikes, totalReplies, myComments: myCounts?.comments || 0, myReactions: myCounts?.reactions || 0 };
  }, [posts, myCounts]);

  const postsLast7Days = useMemo(() => {
    const days = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - offset);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const count = posts.filter((post) => {
        const date = new Date(post.created_at || post.time || 0);
        return !Number.isNaN(date.getTime()) && date >= start && date < end;
      }).length;
      days.push({ label: start.toLocaleDateString("pt-BR", { weekday: "short" }), value: count });
    }
    return days;
  }, [posts]);

  const topAuthors = useMemo(() => {
    return [...authors]
      .sort((a, b) => (b.bookCount || 0) - (a.bookCount || 0))
      .slice(0, 5)
      .map((author) => ({ label: author.name, value: author.bookCount || 0 }));
  }, [authors]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Usuarios" value={totalUsers} hint={`${activeSubs} com assinatura ativa`} icon={Users} />
        <StatCard label="Livros" value={totalBooks} hint={`${totalAuthors} autores`} icon={BookOpen} />
        <StatCard label="Posts" value={totalPosts} hint={`${engagement.totalLikes} curtidas · ${engagement.totalReplies} respostas`} icon={MessageSquare} />
        <StatCard label="Assinaturas" value={totalSubs} hint={`${monthlySubs} mensal · ${annualSubs} anual`} icon={Crown} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Posts nos ultimos 7 dias</p>
              <p className="text-xs text-[var(--text-muted)]">Engajamento diario da comunidade</p>
            </div>
            <span className="text-xs text-[var(--text-muted)]">{engagement.totalLikes} curtidas totais</span>
          </div>
          <LineChart data={postsLast7Days} />
        </div>

        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Assinaturas por plano</p>
          <p className="text-xs text-[var(--text-muted)]">Distribuicao atual</p>
          <div className="mt-4 flex justify-center">
            <DonutChart
              data={[
                { label: "Mensal", value: monthlySubs },
                { label: "Anual", value: annualSubs },
              ]}
              label="ativas"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Posts por categoria</p>
          <p className="text-xs text-[var(--text-muted)]">Quais temas dao mais movimento na comunidade</p>
          <div className="mt-3">
            {postsPerTag.length ? <BarChart data={postsPerTag} /> : <p className="py-8 text-center text-xs text-[var(--text-muted)]">Sem dados ainda.</p>}
          </div>
        </div>
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Livros por categoria</p>
          <p className="text-xs text-[var(--text-muted)]">Acervo catalogado</p>
          <div className="mt-3">
            {booksPerCategory.length ? <BarChart data={booksPerCategory} /> : <p className="py-8 text-center text-xs text-[var(--text-muted)]">Sem dados ainda.</p>}
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4 lg:col-span-1">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Top autores</p>
          <p className="text-xs text-[var(--text-muted)]">Por numero de livros no acervo</p>
          <ul className="mt-3 space-y-2">
            {topAuthors.length ? topAuthors.map((author, index) => (
              <li key={author.label} className="flex items-center justify-between gap-3 text-xs">
                <span className="flex min-w-0 items-center gap-2 text-[var(--text-secondary)]">
                  <span className="flex size-6 items-center justify-center rounded-full bg-[var(--accent-mint)]/10 text-[10px] font-bold text-[var(--accent-mint)]">{index + 1}</span>
                  <span className="truncate">{author.label}</span>
                </span>
                <span className="font-medium text-[var(--text-primary)]">{author.value}</span>
              </li>
            )) : <li className="py-4 text-center text-xs text-[var(--text-muted)]">Sem dados ainda.</li>}
          </ul>
        </div>

        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Engajamento</p>
          <p className="text-xs text-[var(--text-muted)]">Soma de reacoes e comentarios</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-[10px] bg-[var(--hover-overlay)] py-4">
              <p className="text-2xl font-semibold text-[var(--text-primary)]">{engagement.totalLikes}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Curtidas</p>
            </div>
            <div className="rounded-[10px] bg-[var(--hover-overlay)] py-4">
              <p className="text-2xl font-semibold text-[var(--text-primary)]">{engagement.totalReplies}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Respostas</p>
            </div>
            <div className="rounded-[10px] bg-[var(--hover-overlay)] py-4">
              <p className="text-2xl font-semibold text-[var(--text-primary)]">{totalFavorites}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Livros favoritados</p>
            </div>
            <div className="rounded-[10px] bg-[var(--hover-overlay)] py-4">
              <p className="text-2xl font-semibold text-[var(--text-primary)]">{totalSaved}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Posts salvos</p>
            </div>
          </div>
        </div>

        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Lancamentos</p>
          <p className="text-xs text-[var(--text-muted)]">Novidades programadas e publicadas</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-[10px] bg-[var(--hover-overlay)] py-4">
              <p className="text-2xl font-semibold text-[var(--text-primary)]">{weeklyReleases.length}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Agendados</p>
            </div>
            <div className="rounded-[10px] bg-[var(--hover-overlay)] py-4">
              <p className="text-2xl font-semibold text-[var(--text-primary)]">{categories.length}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Categorias ativas</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, type = "text", className }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">{label}</label>
      {type === "textarea" ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3}
          className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)] resize-none" />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)]" />
      )}
    </div>
  );
}

function SubscriptionsTab() {
  const { subscriptions, cancelSubscription } = useData();
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");

  async function run(key, action) {
    setWorking(key);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(error?.message || "Nao foi possivel concluir a operacao.");
    } finally {
      setWorking("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">{subscriptions.length} assinaturas no total</p>
      </div>
      {message && <p className="text-sm text-red-400">{message}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[940px] text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)] uppercase tracking-wider">
              <th className="pb-3 pr-4 font-medium">Email</th>
              <th className="pb-3 pr-4 font-medium">Plano</th>
              <th className="pb-3 pr-4 font-medium">Origem</th>
              <th className="pb-3 pr-4 font-medium">Expira em</th>
              <th className="pb-3 pr-4 font-medium">Status</th>
              <th className="pb-3 pr-4 font-medium">Alteracao</th>
              <th className="pb-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map(s => (
              <tr key={s.id} className="border-b border-[var(--border)] hover:bg-[var(--hover-overlay)] transition-colors">
                <td className="py-3 pr-4 text-[var(--text-secondary)]">{s.customer_email || s.email || "Sem email"}</td>
                <td className="py-3 pr-4 text-[var(--text-primary)]">{planInfoFromCode(s.plan)?.tierLabel || s.plan || "OPE Club"}</td>
                <td className="py-3 pr-4 text-[var(--text-primary)]">{s.provider || "manual"}</td>
                <td className="py-3 pr-4 text-[var(--text-secondary)]">
                  {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString("pt-BR") : "-"}
                </td>
                <td className="py-3 pr-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    s.status === "active" ? "bg-[var(--accent-mint)]/10 text-[var(--accent-mint)]" : "bg-red-500/10 text-red-400"
                  }`}>
                    {s.status}
                  </span>
                </td>
                <td className="py-3 pr-4 text-xs text-[var(--text-secondary)]">
                  {s.metadata?.requested_plan
                    ? `${planInfoFromCode(s.metadata.requested_plan)?.tierLabel || "Novo plano"} solicitado`
                    : "-"}
                </td>
                <td className="py-3">
                  <div className="flex items-center justify-end gap-1">
                    {isActiveSubscription(s) && (
                      <button
                        type="button"
                        onClick={() => run(`cancel-${s.id}`, () => cancelSubscription(s.id))}
                        disabled={working === `cancel-${s.id}`}
                        className="px-2 py-1 text-xs text-red-400 transition-colors hover:text-red-300 disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsersTab() {
  const { profiles, subscriptions, upsertUserSubscription, updateUserSubscriptionDuration, removeUserSubscription } = useData();
  const [durationByUser, setDurationByUser] = useState({});
  const [planByUser, setPlanByUser] = useState({});
  const [savingUser, setSavingUser] = useState(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(profiles.length / pageSize));
  const visibleProfiles = profiles.slice((page - 1) * pageSize, page * pageSize);

  const getSub = (userId) => pickCurrentSubscription(subscriptions, userId);

  async function activate(profile) {
    setSavingUser(profile.id);
    setError("");
    try {
      await upsertUserSubscription({
        userId: profile.id,
        email: profile.email,
        plan: planByUser[profile.id] || "ope_club_leitor_monthly",
        status: "active",
        durationDays: durationByUser[profile.id] || 30,
      });
      toast.success(`Plano concedido com sucesso para ${profile.name || "o usuário"}!`);
    } catch (err) {
      setError(err?.message || "Não foi possível adicionar o plano.");
      toast.error(err?.message || "Não foi possível adicionar o plano.");
    } finally {
      setSavingUser(null);
    }
  }

  async function remove(profile) {
    setSavingUser(profile.id);
    setError("");
    try {
      await removeUserSubscription(profile.id);
      toast.success(`Plano de ${profile.name || "usuário"} removido.`);
    } catch (err) {
      setError(err?.message || "Não foi possível remover o plano.");
      toast.error(err?.message || "Não foi possível remover o plano.");
    } finally {
      setSavingUser(null);
    }
  }

  async function changeDuration(profile, days) {
    const sub = getSub(profile.id);
    if (!sub) return;
    setSavingUser(profile.id);
    setError("");
    try {
      await updateUserSubscriptionDuration({ userId: profile.id, durationDays: Number(days) });
      toast.success(`Duração atualizada para ${days} dias.`);
    } catch (err) {
      setError(err?.message || "Não foi possível alterar os dias.");
      toast.error(err?.message || "Não foi possível alterar os dias.");
    } finally {
      setSavingUser(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">{profiles.length} usuários cadastrados</p>
        <span className="text-xs text-[var(--text-muted)]">Página {page} de {totalPages}</span>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}

      <Table variant="card" className="min-w-[940px]">
        <TableHeader>
          <TableRow>
            <TableHead>Usuário</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Cargo & Tempo</TableHead>
            <TableHead>Plano Atual</TableHead>
            <TableHead>Dias Restantes / Expiração</TableHead>
            <TableHead>Novo Plano</TableHead>
            <TableHead>Duração</TableHead>
            <TableHead className="w-0 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleProfiles.map((profile) => {
              const sub = getSub(profile.id);
              const subPlanInfo = planInfoFromCode(sub?.plan);
              const active = isActiveSubscription(sub);
              const daysRemaining = sub?.current_period_end
                ? Math.max(0, Math.ceil((new Date(sub.current_period_end) - new Date()) / (1000 * 60 * 60 * 24)))
                : 0;

              const userCreatedAt = profile.created_at || profile.time;
              const daysOnPlatform = userCreatedAt
                ? Math.max(1, Math.floor((new Date() - new Date(userCreatedAt)) / (1000 * 60 * 60 * 24)))
                : 1;

              return (
                <TableRow key={profile.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--hover-overlay)] text-xs font-bold text-[var(--text-primary)]">
                        {profile.avatar?.startsWith("data:") || profile.avatar?.startsWith("http") ? (
                          <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
                        ) : (
                          profile.avatar || profile.name?.charAt(0) || "U"
                        )}
                      </div>
                      <span className="font-medium text-[var(--text-primary)]">{profile.name || "Sem nome"}</span>
                    </div>
                  </TableCell>
                  <TableCell>{profile.email || "Sem email"}</TableCell>
                  <TableCell>
                    <div className="text-xs">
                      <span className="capitalize font-semibold text-[var(--text-primary)]">{profile.role || "Membro"}</span>
                      <p className="text-[10px] text-[var(--text-muted)]">{daysOnPlatform} {daysOnPlatform === 1 ? "dia na plataforma" : "dias na plataforma"}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      active
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}>
                      {active
                        ? `${subPlanInfo?.tierLabel || "OPE Club"} ${subPlanInfo?.cycle === "annual" ? "Anual" : "Mensal"}`
                        : "Sem plano ativo"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {active && sub?.current_period_end ? (
                      <div className="text-xs">
                        <span className="font-semibold text-[var(--text-primary)]">{daysRemaining} dias restantes</span>
                        <p className="text-[10px] text-[var(--text-muted)]">Até {new Date(sub.current_period_end).toLocaleDateString("pt-BR")}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">Sem assinatura ativa</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <select
                      value={planByUser[profile.id] || "ope_club_leitor_monthly"}
                      onChange={(e) => setPlanByUser((prev) => ({ ...prev, [profile.id]: e.target.value }))}
                      className="rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-primary)] disabled:opacity-50"
                    >
                      <option value="ope_club_leitor_monthly">Leitor Mensal</option>
                      <option value="ope_club_leitor_annual">Leitor Anual</option>
                      <option value="ope_club_pensador_monthly">Pensador Mensal</option>
                      <option value="ope_club_pensador_annual">Pensador Anual</option>
                    </select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                    <select
                      value={durationByUser[profile.id] || 30}
                      onChange={(e) => setDurationByUser((prev) => ({ ...prev, [profile.id]: Number(e.target.value) }))}
                      className="rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-primary)] disabled:opacity-50"
                    >
                      <option value={7}>7 dias</option>
                      <option value={30}>30 dias</option>
                      <option value={90}>90 dias</option>
                      <option value={180}>180 dias</option>
                      <option value={365}>365 dias</option>
                    </select>
                    {active && sub?.provider === "manual_admin" && (
                      <button
                        type="button"
                        onClick={() => changeDuration(profile, durationByUser[profile.id] || 30)}
                        disabled={savingUser === profile.id}
                        className="rounded-[6px] border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] disabled:opacity-50"
                      >
                        Definir
                      </button>
                    )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <span
                        title="Créditos atuais do usuário (somente leitura)"
                        className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-400"
                      >
                        <Wallet className="size-3.5" />
                        {(profile.credits ?? 0).toLocaleString("pt-BR")}
                      </span>
                      <button
                        type="button"
                        onClick={() => activate(profile)}
                        disabled={savingUser === profile.id}
                        className="rounded-full bg-[var(--text-primary)] px-3 py-1.5 text-xs font-medium text-[var(--bg-card)] hover:opacity-90 disabled:opacity-50 transition-opacity"
                      >
                        {active ? "Renovar plano" : "Adicionar plano"}
                      </button>
                      {active && (
                        <button
                          type="button"
                          onClick={() => remove(profile)}
                          disabled={savingUser === profile.id}
                          className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
      {totalPages > 1 ? (
        <PaginationBar currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      ) : null}
    </div>
  );
}

// Kept as a compatibility reference while the refined surface is the default.
void UsersTab;

function UsersManagementTab() {
  const { profiles, subscriptions, upsertUserSubscription, updateUserSubscriptionDuration, removeUserSubscription } = useData();
  const [durationByUser, setDurationByUser] = useState({});
  const [planByUser, setPlanByUser] = useState({});
  const [savingUser, setSavingUser] = useState(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const confirm = useConfirmDialog();
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(profiles.length / pageSize));
  const visibleProfiles = profiles.slice((page - 1) * pageSize, page * pageSize);

  const getSub = (userId) => pickCurrentSubscription(subscriptions, userId);
  const getUserData = (profile) => {
    const sub = getSub(profile.id);
    const subPlanInfo = planInfoFromCode(sub?.plan);
    const active = isActiveSubscription(sub);
    const daysRemaining = sub?.current_period_end
      ? Math.max(0, Math.ceil((new Date(sub.current_period_end) - new Date()) / (1000 * 60 * 60 * 24)))
      : 0;
    const createdAt = profile.created_at || profile.time;
    const daysOnPlatform = createdAt
      ? Math.max(1, Math.floor((new Date() - new Date(createdAt)) / (1000 * 60 * 60 * 24)))
      : 1;
    return { sub, subPlanInfo, active, daysRemaining, daysOnPlatform };
  };

  function openPlanDialog(profile) {
    const data = getUserData(profile);
    setSelectedProfile(profile);
    setPlanByUser((prev) => ({ ...prev, [profile.id]: prev[profile.id] || data.sub?.plan || "ope_club_leitor_monthly" }));
    setDurationByUser((prev) => ({ ...prev, [profile.id]: prev[profile.id] || 30 }));
    setPlanDialogOpen(true);
  }

  async function activate(profile) {
    if (!profile) return false;
    setSavingUser(profile.id);
    setError("");
    try {
      await upsertUserSubscription({
        userId: profile.id,
        email: profile.email,
        plan: planByUser[profile.id] || "ope_club_leitor_monthly",
        status: "active",
        durationDays: durationByUser[profile.id] || 30,
      });
      toast.success(`Plano concedido para ${profile.name || "o usuario"}.`);
      return true;
    } catch (err) {
      setError(err?.message || "Nao foi possivel adicionar o plano.");
      toast.error(err?.message || "Nao foi possivel adicionar o plano.");
      return false;
    } finally {
      setSavingUser(null);
    }
  }

  async function remove(profile) {
    const ok = await confirm.ask({
      title: "Remover assinatura manual?",
      description: `O acesso de ${profile.name || "este usuario"} sera removido do plano manual atual.`,
      confirmLabel: "Remover plano",
      cancelLabel: "Manter plano",
      danger: true,
    });
    if (!ok) return;
    setSavingUser(profile.id);
    setError("");
    try {
      await removeUserSubscription(profile.id);
      toast.success(`Plano de ${profile.name || "usuario"} removido.`);
    } catch (err) {
      setError(err?.message || "Nao foi possivel remover o plano.");
      toast.error(err?.message || "Nao foi possivel remover o plano.");
    } finally {
      setSavingUser(null);
    }
  }

  async function changeDuration(profile, days) {
    const sub = getSub(profile.id);
    if (!sub || sub.provider !== "manual_admin") return;
    setSavingUser(profile.id);
    setError("");
    try {
      await updateUserSubscriptionDuration({ userId: profile.id, durationDays: Number(days) });
      toast.success(`Duracao atualizada para ${days} dias.`);
    } catch (err) {
      setError(err?.message || "Nao foi possivel alterar os dias.");
      toast.error(err?.message || "Nao foi possivel alterar os dias.");
    } finally {
      setSavingUser(null);
    }
  }

  function Avatar({ profile, size = "size-10" }) {
    const avatar = profile.avatar || profile.avatar_url || "";
    const isImage = avatar.startsWith("data:") || avatar.startsWith("http");
    return (
      <div className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--hover-overlay)] text-sm font-semibold text-[var(--text-primary)]`}>
        {isImage ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : (avatar || profile.name?.charAt(0) || "U")}
      </div>
    );
  }

  function PlanStatus({ data }) {
    return (
      <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-medium ${data.active ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-[var(--border)] bg-[var(--hover-overlay)] text-[var(--text-muted)]"}`}>
        {data.active ? `${data.subPlanInfo?.tierLabel || "OPE Club"} ${data.subPlanInfo?.cycle === "annual" ? "Anual" : "Mensal"}` : "Sem plano ativo"}
      </span>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="text-base font-semibold text-[var(--text-primary)]">Usuarios</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Gerencie acesso, plano manual e creditos sem editar dados sensiveis.</p></div>
        <span className="text-xs text-[var(--text-muted)]">{profiles.length} cadastrados · Pagina {page} de {totalPages}</span>
      </div>
      {error && <p role="alert" className="rounded-[10px] border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

      <div className="space-y-3 md:hidden">
        {visibleProfiles.map((profile) => {
          const data = getUserData(profile);
          return (
            <article key={profile.id} className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><Avatar profile={profile} /><div className="min-w-0"><p className="truncate font-medium text-[var(--text-primary)]">{profile.name || "Sem nome"}</p><p className="truncate text-xs text-[var(--text-muted)]">{profile.email || "Sem email"}</p></div></div><span className="rounded-full border border-[var(--border)] px-2 py-1 text-[11px] capitalize text-[var(--text-secondary)]">{profile.role || "membro"}</span></div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-y border-[var(--border)] py-3 text-xs"><div><p className="text-[var(--text-muted)]">Plano atual</p><div className="mt-1"><PlanStatus data={data} /></div></div><div><p className="text-[var(--text-muted)]">Creditos</p><p className="mt-1 font-semibold text-[var(--text-primary)]">{(profile.credits ?? 0).toLocaleString("pt-BR")}</p></div><div><p className="text-[var(--text-muted)]">Acesso</p><p className="mt-1 font-medium text-[var(--text-primary)]">{data.active ? `${data.daysRemaining} dias` : "Sem assinatura"}</p></div><div><p className="text-[var(--text-muted)]">Na plataforma</p><p className="mt-1 font-medium text-[var(--text-primary)]">{data.daysOnPlatform} {data.daysOnPlatform === 1 ? "dia" : "dias"}</p></div></div>
              <div className="mt-3 flex gap-2"><Button type="button" size="sm" className="flex-1 bg-[var(--text-primary)] text-[var(--bg-card)] hover:opacity-90" onClick={() => openPlanDialog(profile)} disabled={savingUser === profile.id}>{data.active ? "Gerenciar plano" : "Adicionar plano"}</Button>{data.active && <Button type="button" size="sm" variant="outline" className="border-red-500/30 text-red-300 hover:bg-red-500/10" onClick={() => remove(profile)} disabled={savingUser === profile.id}>Remover</Button>}</div>
            </article>
          );
        })}
      </div>

      <div className="hidden md:block"><Table variant="card"><TableHeader><TableRow><TableHead>Usuario</TableHead><TableHead>Plano atual</TableHead><TableHead>Acesso</TableHead><TableHead>Creditos</TableHead><TableHead className="text-right">Acoes</TableHead></TableRow></TableHeader><TableBody>{visibleProfiles.map((profile) => { const data = getUserData(profile); return <TableRow key={profile.id}><TableCell><div className="flex items-center gap-3"><Avatar profile={profile} size="size-9" /><div className="min-w-0"><p className="truncate font-medium text-[var(--text-primary)]">{profile.name || "Sem nome"}</p><p className="max-w-[220px] truncate text-xs text-[var(--text-muted)]">{profile.email || "Sem email"}</p></div></div></TableCell><TableCell><PlanStatus data={data} /></TableCell><TableCell><p className="text-sm font-medium text-[var(--text-primary)]">{data.active ? `${data.daysRemaining} dias restantes` : "Sem assinatura"}</p><p className="text-xs text-[var(--text-muted)]">{data.active && data.sub?.current_period_end ? `Ate ${new Date(data.sub.current_period_end).toLocaleDateString("pt-BR")}` : `${data.daysOnPlatform} dias na plataforma`}</p></TableCell><TableCell><span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--hover-overlay)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)]"><Wallet className="size-3.5" />{(profile.credits ?? 0).toLocaleString("pt-BR")}</span></TableCell><TableCell><div className="flex justify-end gap-2"><Button type="button" size="sm" className="bg-[var(--text-primary)] text-[var(--bg-card)] hover:opacity-90" onClick={() => openPlanDialog(profile)} disabled={savingUser === profile.id}>{data.active ? "Gerenciar" : "Adicionar plano"}</Button>{data.active && <Button type="button" size="sm" variant="outline" className="border-red-500/30 text-red-300 hover:bg-red-500/10" onClick={() => remove(profile)} disabled={savingUser === profile.id}>Remover</Button>}</div></TableCell></TableRow>; })}</TableBody></Table></div>

      {totalPages > 1 ? <PaginationBar currentPage={page} totalPages={totalPages} onPageChange={setPage} /> : null}

      <AlertDialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}><AlertDialogContent className="max-w-lg"><AlertDialogHeader><AlertDialogTitle>Gerenciar plano</AlertDialogTitle><AlertDialogDescription>{selectedProfile ? `Defina o acesso manual de ${selectedProfile.name || "este usuario"}.` : "Escolha o plano e a duracao."}</AlertDialogDescription></AlertDialogHeader>{selectedProfile && (() => { const data = getUserData(selectedProfile); return <div className="space-y-4 py-2"><div className="flex items-center gap-3 rounded-[10px] border border-[var(--border)] bg-[var(--hover-overlay)] p-3"><Avatar profile={selectedProfile} size="size-9" /><div className="min-w-0"><p className="truncate text-sm font-medium text-[var(--text-primary)]">{selectedProfile.name || "Sem nome"}</p><p className="truncate text-xs text-[var(--text-muted)]">{selectedProfile.email || "Sem email"}</p></div></div><label className="block text-sm font-medium text-[var(--text-secondary)]">Plano<select aria-label="Plano manual" value={planByUser[selectedProfile.id] || "ope_club_leitor_monthly"} onChange={(e) => setPlanByUser((prev) => ({ ...prev, [selectedProfile.id]: e.target.value }))} className="mt-1.5 h-10 w-full rounded-[8px] border border-[var(--border)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"><option value="ope_club_leitor_monthly">Leitor mensal</option><option value="ope_club_leitor_annual">Leitor anual</option><option value="ope_club_pensador_monthly">Pensador mensal</option><option value="ope_club_pensador_annual">Pensador anual</option></select></label><label className="block text-sm font-medium text-[var(--text-secondary)]">Duracao<select aria-label="Duracao do plano" value={durationByUser[selectedProfile.id] || 30} onChange={(e) => setDurationByUser((prev) => ({ ...prev, [selectedProfile.id]: Number(e.target.value) }))} className="mt-1.5 h-10 w-full rounded-[8px] border border-[var(--border)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"><option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option><option value={180}>180 dias</option><option value={365}>365 dias</option></select></label><p className="text-xs text-[var(--text-muted)]">{data.active && data.sub?.provider === "manual_admin" ? "O plano atual e manual. Voce pode renovar ou definir os dias restantes." : "A alteracao manual registra o acesso no painel sem alterar a cobranca da Stripe."}</p></div>; })()}<AlertDialogFooter><AlertDialogClose render={<Button type="button" variant="outline" />}>Cancelar</AlertDialogClose>{selectedProfile && getUserData(selectedProfile).active && getUserData(selectedProfile).sub?.provider === "manual_admin" ? <Button type="button" variant="outline" onClick={() => changeDuration(selectedProfile, durationByUser[selectedProfile.id] || 30)} disabled={savingUser === selectedProfile.id}>Definir dias</Button> : null}<Button type="button" className="bg-[var(--text-primary)] text-[var(--bg-card)] hover:opacity-90" onClick={async () => { const done = await activate(selectedProfile); if (done) setPlanDialogOpen(false); }} disabled={!selectedProfile || savingUser === selectedProfile?.id}>{savingUser === selectedProfile?.id ? "Salvando..." : "Salvar plano"}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
      {confirm.dialog}
    </div>
  );
}

function PostsTab() {
  const { posts, deletePost } = useData();
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(posts.length / pageSize));
  const start = (page - 1) * pageSize;
  const visible = posts.slice(start, start + pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">{posts.length} posts na comunidade</p>
        <span className="text-xs text-[var(--text-muted)]">Pagina {page} de {totalPages}</span>
      </div>
      <div className="space-y-3">
        {visible.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--text-muted)]">
            Nenhum post por aqui ainda.
          </p>
        ) : visible.map(p => (
          <div key={p.id} className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{p.author}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--hover-overlay)] text-[var(--text-muted)] border border-[var(--border)]">{p.tag}</span>
                  <span className="text-xs text-[var(--text-muted)]">{p.time}</span>
                </div>
                <p className="text-sm text-[var(--text-secondary)] line-clamp-2">{p.text}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-muted)]">
                  <span>{p.likes} curtidas</span>
                  <span>{p.replies} respostas</span>
                </div>
              </div>
              <button onClick={() => deletePost(p.id)}
                className="shrink-0 size-8 rounded-full flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-colors">
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      {totalPages > 1 ? (
        <PaginationBar currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      ) : null}
      {confirm.dialog}
    </div>
  );
}

function WeeklyReleasesTab() {
  const { books, weeklyReleases, addWeeklyRelease, deleteWeeklyRelease, toggleWeeklyReleaseVisibility } = useData();
  const [form, setForm] = useState({ bookId: "", releaseDate: "", note: "", visible: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const totalPages = Math.max(1, Math.ceil(weeklyReleases.length / pageSize));
  const visibleReleases = weeklyReleases.slice((page - 1) * pageSize, page * pageSize);

  async function handleSave() {
    if (!form.bookId || !form.releaseDate || saving) return;
    setSaving(true);
    setError("");
    try {
      await addWeeklyRelease({
        bookId: form.bookId,
        releaseDate: form.releaseDate,
        note: form.note,
        visible: form.visible,
      });
      setForm({ bookId: "", releaseDate: "", note: "", visible: true });
    } catch (err) {
      setError(err?.message || "Não foi possível salvar o lançamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Novo lançamento semanal</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Livro</label>
            <select
              value={form.bookId}
              onChange={(event) => setForm((prev) => ({ ...prev, bookId: event.target.value }))}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
            >
              <option value="">Selecione</option>
              {books.map((book) => (
                <option key={book.id} value={book.id}>{book.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Data de liberacao</label>
            <DatePicker
              value={form.releaseDate}
              onChange={(value) => setForm((prev) => ({ ...prev, releaseDate: value }))}
              placeholder="Escolher data"
            />
          </div>
          <FormField label="Observação" value={form.note} onChange={(value) => setForm((prev) => ({ ...prev, note: value }))} placeholder="Ex: estreia de sexta" />
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !form.bookId || !form.releaseDate}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-card)] disabled:opacity-50"
        >
          <Plus className="size-4" /> {saving ? "Salvando..." : "Adicionar lançamento"}
        </button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <div className="space-y-3">
        {visibleReleases.map((release) => {
          const book = release.books || books.find((item) => item.id === release.book_id);
          return (
            <div key={release.id} className="flex items-center gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <div className="h-16 w-11 shrink-0 overflow-hidden rounded-[6px] bg-[var(--hover-overlay)]">
                {book?.image ? <img src={book.image} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--text-primary)]">{book?.title || "Livro removido"}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Libera em {new Date(`${release.release_date}T00:00:00`).toLocaleDateString("pt-BR")}
                </p>
                {release.note && <p className="mt-1 text-xs text-[var(--text-secondary)]">{release.note}</p>}
              </div>
              <button
                onClick={() => toggleWeeklyReleaseVisibility(release.id, release.visible === false)}
                className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                  release.visible !== false ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                }`}
              >
                {release.visible === false ? "Oculto" : "Visível"}
              </button>
              <button
                onClick={() => deleteWeeklyRelease(release.id)}
                className="flex size-8 items-center justify-center rounded-full text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
      {totalPages > 1 ? (
        <PaginationBar currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      ) : null}
    </div>
  );
}

function BooksTab() {
  const { books, authors, addBook, updateBook, deleteBook, categories } = useData();
  const confirm = useConfirmDialog();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    title: "", authorId: "", image: "", imagePath: "", pdfFile: "", pdfPath: "", category: "", bio: "",
  });
  const [imageFile, setImageFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(books.length / pageSize));
  const visibleBooks = books.slice((page - 1) * pageSize, page * pageSize);

  function openNew() {
    setEditId(null);
    setForm({
      title: "", authorId: authors[0]?.id || "", image: "", imagePath: "", pdfFile: "", pdfPath: "", category: "", bio: "",
    });
    setImageFile(null);
    setPdfFile(null);
    setImagePreview("");
    setShowForm(true);
  }

  function openEdit(book) {
    setEditId(book.id);
    setForm({
      title: book.title,
      authorId: book.author_id || book.authorId || "",
      image: book.image_path ? "" : book.image || "",
      imagePath: book.image_path || "",
      pdfFile: book.pdf_path ? "" : book.pdf_url || "",
      pdfPath: book.pdf_path || "",
      category: book.category || "",
      bio: book.bio || "",
    });
    setImageFile(null);
    setPdfFile(null);
    setImagePreview(book.image || "");
    setShowForm(true);
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      validateLibraryFile(file, "pdf");
      setPdfFile(file);
      setForm((current) => ({ ...current, pdfFile: "", pdfPath: "" }));
      setError("");
    } catch (err) {
      setError(err?.message || "PDF inválido.");
      e.target.value = "";
    }
  }

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      validateLibraryFile(file, "image");
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setForm((current) => ({ ...current, image: "", imagePath: "" }));
      setError("");
    } catch (err) {
      setError(err?.message || "Imagem inválida.");
      e.target.value = "";
    }
  }

  async function handleSave() {
    if (!form.title.trim() || saving) return;
    setError("");
    setSaving(true);
    let uploadedImagePath = "";
    let uploadedPdfPath = "";

    try {
      if (!isSupabaseReady()) throw new Error("Supabase não configurado.");

      if (imageFile) {
        uploadedImagePath = await uploadLibraryFile({
          file: imageFile,
          bucket: LIBRARY_BUCKETS.covers,
          kind: "book-cover",
        });
      }
      if (pdfFile) {
        uploadedPdfPath = await uploadLibraryFile({
          file: pdfFile,
          bucket: LIBRARY_BUCKETS.pdfs,
          kind: "book-pdf",
        });
      }

      const payload = {
        ...form,
        imagePath: uploadedImagePath || form.imagePath,
        pdfPath: uploadedPdfPath || form.pdfPath,
        previewImage: imagePreview,
      };

      if (editId) {
        await updateBook(editId, payload);
      } else {
        await addBook(payload);
      }
      setShowForm(false);
      setEditId(null);
      setForm({
        title: "", authorId: "", image: "", imagePath: "", pdfFile: "", pdfPath: "", category: "", bio: "",
      });
      setImageFile(null);
      setPdfFile(null);
      setImagePreview("");
    } catch (err) {
      await Promise.allSettled([
        uploadedImagePath ? removeLibraryFile(LIBRARY_BUCKETS.covers, uploadedImagePath) : Promise.resolve(),
        uploadedPdfPath ? removeLibraryFile(LIBRARY_BUCKETS.pdfs, uploadedPdfPath) : Promise.resolve(),
      ]);
      setError(err?.message || "Não foi possível salvar o livro. Confira as permissões no Supabase.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(book) {
    const ok = await confirm.ask({
      title: "Remover livro?",
      description: `Remover "${book.title}" e seus arquivos do banco?`,
      confirmLabel: "Remover",
      danger: true,
    });
    if (!ok) return;
    setError("");
    try {
      await deleteBook(book.id);
    } catch (err) {
      setError(err?.message || "Não foi possível remover o livro.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">{books.length} livros cadastrados</p>
        <button onClick={openNew}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--text-primary)] text-[var(--bg-card)] text-sm font-medium hover:opacity-90 transition-all">
          <Plus className="size-4" /> Novo livro
        </button>
      </div>

      {showForm && (
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{editId ? "Editar" : "Novo"} livro</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Título" value={form.title} onChange={v => setForm(p => ({ ...p, title: v }))} placeholder="Crime e Castigo" />
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Autor</label>
              <select value={form.authorId} onChange={e => setForm(p => ({ ...p, authorId: e.target.value }))}
                className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]">
                <option value="">Selecione um autor</option>
                {authors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Capa do livro</label>
              <div className="flex items-center gap-3">
                <label className="flex h-[38px] cursor-pointer items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs text-[var(--text-muted)] hover:border-[var(--border-strong)] transition-colors">
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImageUpload} className="hidden" />
                  Selecionar imagem
                </label>
                {imagePreview && (
                  <button type="button" onClick={() => {
                    setImageFile(null);
                    setImagePreview("");
                    setForm((current) => ({ ...current, image: "", imagePath: "" }));
                  }} className="text-xs text-red-400">Remover</button>
                )}
              </div>
              {imagePreview && (
                <div className="mt-2 h-16 w-12 overflow-hidden rounded-[6px] border border-[var(--border)]">
                  <img src={imagePreview} alt="" className="h-full w-full object-cover" />
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Categoria</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]">
                <option value="">Sem categoria</option>
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Arquivo PDF</label>
              <div className="flex items-center gap-2">
                <label className="flex-1 flex items-center gap-2 px-3 py-2 rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text-muted)] cursor-pointer hover:border-[var(--border-strong)] transition-colors">
                  <input type="file" accept=".pdf,application/pdf" onChange={handleFileUpload} className="hidden" />
                  {pdfFile?.name || (form.pdfPath || form.pdfFile ? "PDF anexado" : "Selecionar PDF")}
                </label>
                {(pdfFile || form.pdfPath || form.pdfFile) && (
                  <button onClick={() => {
                    setPdfFile(null);
                    setForm((current) => ({ ...current, pdfFile: "", pdfPath: "" }));
                  }}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors shrink-0">
                    Remover
                  </button>
                )}
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">O PDF será enviado ao Supabase Storage e o leitor extrai o texto automaticamente.</p>
            </div>
          </div>
          <FormField
            label="Biografia / sinopse do livro"
            type="textarea"
            value={form.bio}
            onChange={(value) => setForm((prev) => ({ ...prev, bio: value }))}
            placeholder="Resumo, contexto ou por que este livro importa."
          />
          <div className="flex items-center gap-2 pt-2">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--text-primary)] text-[var(--bg-card)] text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50">
              <Check className="size-4" /> {saving ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={() => setShowForm(false)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">
              Cancelar
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visibleBooks.map(book => {
          const author = authors.find(a => a.id === (book.author_id || book.authorId));
          return (
            <div key={book.id} className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4 flex gap-3">
              <div className="w-12 h-16 rounded-[6px] overflow-hidden shrink-0 bg-[var(--hover-overlay)]">
                {book.image ? <img src={book.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-xs">Sem img</div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{book.title}</p>
                <p className="text-xs text-[var(--text-muted)]">{author?.name || book.authorName || "Sem autor"}</p>
                <div className="flex items-center gap-2 mt-1">
                  {book.progress != null && <p className="text-[10px] text-[var(--text-muted)]">{book.progress}% completo</p>}
                  {(book.pdf_url || book.pdfFile) && <span className="text-[10px] text-blue-400 font-medium">PDF</span>}
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button onClick={() => openEdit(book)} className="size-7 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] transition-all">
                  <Edit3 className="size-3.5" />
                </button>
                <button onClick={() => handleDelete(book)} className="size-7 rounded-full flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-all">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {totalPages > 1 ? (
        <PaginationBar currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      ) : null}
      {confirm.dialog}
    </div>
  );
}


function AuthorsTab() {
  const { authors, addAuthor, updateAuthor, deleteAuthor, getBooksByAuthor } = useData();
  const confirm = useConfirmDialog();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", theme: "", era: "", image: "", imagePath: "", bio: "" });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(authors.length / pageSize));
  const visibleAuthors = authors.slice((page - 1) * pageSize, page * pageSize);

  function openNew() {
    setEditId(null);
    setForm({ name: "", theme: "", era: "", image: "", imagePath: "", bio: "" });
    setImageFile(null);
    setImagePreview("");
    setShowForm(true);
  }

  function openEdit(author) {
    setEditId(author.id);
    setForm({
      name: author.name,
      theme: author.theme,
      era: author.era,
      image: author.image_path ? "" : author.image || "",
      imagePath: author.image_path || "",
      bio: author.bio || "",
    });
    setImageFile(null);
    setImagePreview(author.image || "");
    setShowForm(true);
  }

  function handleImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      validateLibraryFile(file, "image");
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setForm((current) => ({ ...current, image: "", imagePath: "" }));
      setError("");
    } catch (err) {
      setError(err?.message || "Imagem inválida.");
      event.target.value = "";
    }
  }

  async function handleSave() {
    if (!form.name.trim() || saving) return;
    setError("");
    setSaving(true);
    let uploadedImagePath = "";

    try {
      if (!isSupabaseReady()) throw new Error("Supabase não configurado.");
      if (imageFile) {
        uploadedImagePath = await uploadLibraryFile({
          file: imageFile,
          bucket: LIBRARY_BUCKETS.covers,
          kind: "author-photo",
        });
      }

      const payload = {
        ...form,
        imagePath: uploadedImagePath || form.imagePath,
        previewImage: imagePreview,
      };

      if (editId) {
        await updateAuthor(editId, payload);
      } else {
        await addAuthor(payload);
      }
      setShowForm(false);
      setEditId(null);
      setForm({ name: "", theme: "", era: "", image: "", imagePath: "", bio: "" });
      setImageFile(null);
      setImagePreview("");
    } catch (err) {
      if (uploadedImagePath) {
        await removeLibraryFile(LIBRARY_BUCKETS.covers, uploadedImagePath).catch(() => {});
      }
      setError(err?.message || "Não foi possível salvar o autor. Confira as permissões no Supabase.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(author) {
    const ok = await confirm.ask({
      title: "Remover autor?",
      description: `Remover "${author.name}" do banco? Os livros continuarão cadastrados sem autor.`,
      confirmLabel: "Remover",
      danger: true,
    });
    if (!ok) return;
    setError("");
    try {
      await deleteAuthor(author.id);
    } catch (err) {
      setError(err?.message || "Não foi possível remover o autor.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">{authors.length} autores cadastrados</p>
        <button onClick={openNew}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--text-primary)] text-[var(--bg-card)] text-sm font-medium hover:opacity-90 transition-all">
          <Plus className="size-4" /> Novo autor
        </button>
      </div>

      {showForm && (
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{editId ? "Editar" : "Novo"} autor</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Nome" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="Friedrich Nietzsche" />
            <FormField label="Corrente/Tema" value={form.theme} onChange={v => setForm(p => ({ ...p, theme: v }))} placeholder="Existencialismo" />
            <FormField label="Época" value={form.era} onChange={v => setForm(p => ({ ...p, era: v }))} placeholder="século XIX" />
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Foto do autor</label>
              <div className="flex items-center gap-3">
                <label className="flex h-[38px] cursor-pointer items-center rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs text-[var(--text-muted)] hover:border-[var(--border-strong)]">
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImageUpload} className="hidden" />
                  Selecionar imagem
                </label>
                {imagePreview && (
                  <button type="button" onClick={() => {
                    setImageFile(null);
                    setImagePreview("");
                    setForm((current) => ({ ...current, image: "", imagePath: "" }));
                  }} className="text-xs text-red-400">Remover</button>
                )}
              </div>
              {imagePreview && (
                <div className="mt-2 size-14 overflow-hidden rounded-[6px] border border-[var(--border)]">
                  <img src={imagePreview} alt="" className="h-full w-full object-cover" />
                </div>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Bio / frase famosa</label>
              <textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} placeholder="Frase ou biografia curta que aparece na página do autor..." rows={3}
                className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)] resize-none" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--text-primary)] text-[var(--bg-card)] text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50">
              <Check className="size-4" /> {saving ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={() => setShowForm(false)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">
              Cancelar
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {visibleAuthors.map(author => {
          const authorBooks = getBooksByAuthor(author.id);
          return (
            <div key={author.id} className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-12 rounded-[10px] overflow-hidden shrink-0 bg-[var(--hover-overlay)]">
                    {author.image ? <img src={author.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-xs">{author.name.charAt(0)}</div>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{author.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{author.theme} · {author.era}</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">{authorBooks.length} livros</p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(author)} className="size-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] transition-all">
                    <Edit3 className="size-3.5" />
                  </button>
                  <button onClick={() => handleDelete(author)} className="size-8 rounded-full flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-all">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
              {authorBooks.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[var(--border)]">
                  <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">Livros</p>
                  <div className="flex flex-wrap gap-1.5">
                    {authorBooks.map(b => (
                      <span key={b.id} className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--hover-overlay)] text-[var(--text-secondary)]">{b.title}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {totalPages > 1 ? (
        <PaginationBar currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      ) : null}
    </div>
  );
}

function CategoriesTab() {
  const { categories, addCategory, updateCategory, deleteCategory } = useData();
  const confirm = useConfirmDialog();
  const [nome, setNome] = useState("");
  const [editando, setEditando] = useState(null);
  const [editNome, setEditNome] = useState("");
  const [erro, setErro] = useState("");

  async function handleCriar() {
    const cleanName = nome.trim();
    if (!cleanName) return;
    if (categories.some((category) => category.name?.trim().toLocaleLowerCase() === cleanName.toLocaleLowerCase())) {
      setErro("Essa categoria ja existe.");
      return;
    }
    setErro("");
    try { await addCategory(cleanName); setNome(""); }
    catch (err) { setErro(err?.message || "Erro ao criar categoria."); }
  }

  async function handleSalvarEdicao() {
    const cleanName = editNome.trim();
    if (!cleanName || !editando) return;
    if (categories.some((category) => category.id !== editando.id && category.name?.trim().toLocaleLowerCase() === cleanName.toLocaleLowerCase())) {
      setErro("Essa categoria ja existe.");
      return;
    }
    setErro("");
    try { await updateCategory(editando.id, { name: cleanName }); setEditando(null); setEditNome(""); }
    catch (err) { setErro(err?.message || "Erro ao atualizar categoria."); }
  }

  async function handleExcluir(id) {
    const ok = await confirm.ask({
      title: "Remover categoria?",
      description: "Livros que a usam ficam sem categoria.",
      confirmLabel: "Remover",
      danger: true,
    });
    if (!ok) return;
    setErro("");
    try { await deleteCategory(id); }
    catch (err) { setErro(err?.message || "Erro ao remover categoria."); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Nova categoria</h3>
        <div className="flex gap-2">
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Existencialismo, Literatura..."
            className="h-10 flex-1 rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)]" />
          <button onClick={handleCriar} disabled={!nome.trim()}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-card)] disabled:opacity-50">
            <Plus className="size-4" /> Criar
          </button>
        </div>
        {erro && <p className="text-xs text-red-400">{erro}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {categories.map((cat) => (
          <div key={cat.id} className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
            {editando?.id === cat.id ? (
              <div className="flex gap-2">
                <input value={editNome} onChange={e => setEditNome(e.target.value)}
                  className="h-9 flex-1 rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]" />
                <button onClick={handleSalvarEdicao} className="rounded-full bg-[var(--text-primary)] px-3 py-1.5 text-xs font-medium text-[var(--bg-card)]">Salvar</button>
                <button onClick={() => { setEditando(null); setEditNome(""); }} className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)]">Cancelar</button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{cat.name}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">Ordem: {cat.sort_order}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => { setEditando(cat); setEditNome(cat.name); }} className="size-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] transition-all">
                    <Edit3 className="size-3.5" />
                  </button>
                  <button onClick={() => handleExcluir(cat.id)} className="size-8 rounded-full flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-all">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {categories.length === 0 && (
        <p className="text-sm text-[var(--text-muted)] text-center py-8">Nenhuma categoria cadastrada. Crie a primeira acima.</p>
      )}
      {confirm.dialog}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resgates: fila de pedidos da Loja com atualizacao de status/rastreio.
// ---------------------------------------------------------------------------
const REDEMPTION_STATUS = ["pending", "processing", "shipped", "fulfilled", "rejected", "refunded"];

function ResgatesTab() {
  const [redemptions, setRedemptions] = useState([]);
  const [productsById, setProductsById] = useState({});
  const [profilesById, setProfilesById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    if (!isSupabaseReady()) {
      setRedemptions([]);
      setProductsById({});
      setProfilesById({});
      setLoading(false);
      return;
    }
    try {
      const [redResult, prodResult, profResult, emailResult] = await Promise.all([
        supabase.from("shop_redemptions").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("shop_products").select("id, name, category, credits_cost"),
        supabase.from("profiles").select("id, name, username, avatar"),
        supabase.from("user_emails").select("user_id, email"),
      ]);
      if (redResult.error) throw redResult.error;
      if (prodResult.error) throw prodResult.error;
      if (profResult.error) throw profResult.error;
      if (emailResult.error) throw emailResult.error;
      const emailPorId = new Map((emailResult.data || []).map((e) => [e.user_id, e.email]));
      setRedemptions(redResult.data || []);
      setProductsById(Object.fromEntries((prodResult.data || []).map((p) => [p.id, p])));
      setProfilesById(Object.fromEntries((profResult.data || []).map((p) => [p.id, { ...p, email: emailPorId.get(p.id) || "" }])));
    } catch (err) {
      setError(err?.message || "Nao foi possivel carregar os resgates.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(id, patch) {
    setWorking(`${id}:${patch.status}`);
    setError("");
    try {
      const { error } = await supabase.from("shop_redemptions").update(patch).eq("id", id);
      if (error) throw error;
      await load();
    } catch (err) {
      setError(err?.message || "Nao foi possivel atualizar o resgate.");
    } finally {
      setWorking("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">{redemptions.length} resgates</p>
        <button type="button" onClick={load} className="flex items-center gap-1 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <RefreshCw className="size-3.5" /> Atualizar
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando...</p>
      ) : redemptions.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">Nenhum resgate ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)] uppercase tracking-wider">
                <th className="pb-3 pr-4 font-medium">Cliente</th>
                <th className="pb-3 pr-4 font-medium">Produto</th>
                <th className="pb-3 pr-4 font-medium">Créditos</th>
                <th className="pb-3 pr-4 font-medium">Data</th>
                <th className="pb-3 pr-4 font-medium">Endereço</th>
                <th className="pb-3 pr-4 font-medium">Rastreio</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {redemptions.map((r) => {
                const product = productsById[r.product_id];
                const profile = profilesById[r.user_id];
                return (
                  <tr key={r.id} className="border-b border-[var(--border)] hover:bg-[var(--hover-overlay)] transition-colors">
                    <td className="py-3 pr-4">
                      <p className="text-[var(--text-primary)]">{r.customer_name || profile?.name || "Sem nome"}</p>
                      <p className="text-xs text-[var(--text-muted)]">{r.customer_email || profile?.email}</p>
                    </td>
                    <td className="py-3 pr-4 text-[var(--text-primary)]">{product?.name || "Produto removido"}</td>
                    <td className="py-3 pr-4 text-[var(--text-secondary)]">{r.credits_spent}</td>
                    <td className="py-3 pr-4 text-[var(--text-secondary)]">{r.created_at ? new Date(r.created_at).toLocaleDateString("pt-BR") : "-"}</td>
                    <td className="py-3 pr-4 text-xs text-[var(--text-secondary)] max-w-[180px] truncate" title={r.address_json?.linha1 || JSON.stringify(r.address_json || {})}>
                      {r.address_json?.linha1 || "-"}
                    </td>
                    <td className="py-3 pr-4">
                      <input
                        defaultValue={r.tracking_code || ""}
                        placeholder="Código"
                        className="w-32 rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
                        onBlur={(event) => {
                          const value = event.target.value.trim();
                          if (value !== (r.tracking_code || "")) updateStatus(r.id, { tracking_code: value || null });
                        }}
                      />
                    </td>
                    <td className="py-3">
                      <select
                        value={r.status}
                        disabled={working === `${r.id}:${r.status}`}
                        onChange={(event) => updateStatus(r.id, { status: event.target.value })}
                        className="rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none"
                      >
                        {REDEMPTION_STATUS.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loja: CRUD simples do catalogo de produtos resgataveis.
// ---------------------------------------------------------------------------
const PRODUCT_CATEGORIES = [
  { id: "book", label: "Livro Físico" },
  { id: "book_premium", label: "Livro Premium" },
  { id: "hoodie", label: "Moletom" },
  { id: "oversized", label: "Oversized" },
  { id: "boxes", label: "Boxes" },
];

const CATEGORY_LABELS = {
  book: "Livro Físico",
  livro_fisico: "Livro Físico",
  book_premium: "Livro Premium",
  livro_premium: "Livro Premium",
  hoodie: "Moletom",
  moletom: "Moletom",
  oversized: "Oversized",
  boxes: "Boxes",
};

function LojaTab() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dropConfig, setDropConfig] = useState(() => {
    try {
      const saved = localStorage.getItem("ope_novo_drop_config");
      if (saved) return JSON.parse(saved);
    } catch {}
    return { active: true, productIds: [] };
  });

  function toggleDropActive() {
    setDropConfig((prev) => {
      const next = { ...prev, active: !prev.active };
      localStorage.setItem("ope_novo_drop_config", JSON.stringify(next));
      return next;
    });
  }

  function toggleDropProduct(productId) {
    setDropConfig((prev) => {
      const ids = prev.productIds || [];
      const exists = ids.includes(productId);
      const newIds = exists ? ids.filter((id) => id !== productId) : [...ids, productId];
      const next = { ...prev, productIds: newIds };
      localStorage.setItem("ope_novo_drop_config", JSON.stringify(next));
      return next;
    });
  }

  const INITIAL_FORM = {
    name: "",
    description: "",
    category: "book",
    credits_cost: 100,
    real_price: "",
    min_months_active: 0,
    stock: "",
    image_url: "",
    images: [],
    external_sku: "",
    active: true,
    season_id: "",
    early_access_at: "",
    public_release_at: "",
  };
  const [form, setForm] = useState(INITIAL_FORM);
  const [seasons, setSeasons] = useState([]);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [uploadingImages, setUploadingImages] = useState(false);
  const [variants, setVariants] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const confirm = useConfirmDialog();

  async function load() {
    setLoading(true);
    setError("");
    if (!isSupabaseReady()) {
      let local = [];
      try {
        const stored = localStorage.getItem("ope_shop_products_dev");
        if (stored) local = JSON.parse(stored);
      } catch {}
      if (!local || local.length < 5) {
        local = [
          {
            id: "prod-1",
            name: "Livro Físico - Edição OPE",
            description: "Edição física exclusiva impressa com acabamento de luxo e capa dura.",
            category: "book",
            credits_cost: 600,
            real_price: 60,
            min_months_active: 0,
            image_url: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80",
            images: [
              "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80",
              "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&q=80"
            ],
            external_sku: "BOOK-01",
            active: true
          },
          {
            id: "prod-2",
            name: "Livro Premium - Edição Especial Collector",
            description: "Encadernação em couro vegetal, corte dourado e estojo exclusivo.",
            category: "book_premium",
            credits_cost: 900,
            real_price: 90,
            min_months_active: 2,
            image_url: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&q=80",
            images: [
              "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&q=80",
              "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80"
            ],
            external_sku: "BOOK-PREM-01",
            active: true
          },
          {
            id: "prod-3",
            name: "Box Coleção Filosofia Clássica",
            description: "Box com 3 obras essenciais + marcador em metal + brinde exclusivo.",
            category: "boxes",
            credits_cost: 1400,
            real_price: 140,
            min_months_active: 3,
            image_url: "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=800&q=80",
            images: [
              "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=800&q=80",
              "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80"
            ],
            external_sku: "BOX-01",
            active: true
          },
          {
            id: "prod-4",
            name: "Camiseta Oversized OPE Club",
            description: "Camiseta oversized 100% algodão pima com estampa frontal minimalista.",
            category: "oversized",
            credits_cost: 2000,
            real_price: 189.90,
            min_months_active: 1,
            image_url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80",
            images: [
              "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80",
              "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&q=80"
            ],
            external_sku: "TSHIRT-01",
            active: true
          },
          {
            id: "prod-5",
            name: "Moletom Street OPE Club",
            description: "Moletom pesado com capuz duplo, bolso canguru e bordado de alta definição.",
            category: "hoodie",
            credits_cost: 2900,
            real_price: 289.90,
            min_months_active: 3,
            image_url: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80",
            images: [
              "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80",
              "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80"
            ],
            external_sku: "HOODIE-01",
            active: true
          }
        ];
        localStorage.setItem("ope_shop_products_dev", JSON.stringify(local));
      }
      setProducts(local);
      setSeasons([]);
      setLoading(false);
      return;
    }
    try {
      const productsResult = await supabase
        .from("shop_products")
        .select("*")
        .order("created_at", { ascending: false });
      if (productsResult.error) throw productsResult.error;
      const productRows = productsResult.data || [];
      let variantRows = [];
      if (productRows.length > 0) {
        const variantsResult = await supabase
          .from("shop_product_variants")
          .select("id,product_id,sku,size,color,stock,active")
          .in("product_id", productRows.map((item) => item.id))
          .order("created_at", { ascending: true });
        if (!variantsResult.error) variantRows = variantsResult.data || [];
        else if (!/schema cache|does not exist|relation/i.test(variantsResult.error.message || "")) throw variantsResult.error;
      }
      const variantsByProduct = variantRows.reduce((map, variant) => {
        const list = map.get(variant.product_id) || [];
        list.push(variant);
        map.set(variant.product_id, list);
        return map;
      }, new Map());
      setProducts(productRows.map((product) => ({ ...product, variants: variantsByProduct.get(product.id) || [] })));

      // Seasonal curation is optional. A missing/blocked season query must
      // never hide the independent store catalog.
      const seasonsResult = await supabase
        .from("seasons")
        .select("id,name,status,starts_on,ends_on")
        .order("created_at", { ascending: false });
      if (seasonsResult.error) {
        setSeasons([]);
        setError("Produtos carregados. A lista de seasons precisa ser sincronizada.");
      } else {
        setSeasons(seasonsResult.data || []);
      }
    } catch (err) {
      setError(err?.message || "Não foi possível carregar a loja.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const handleAddImage = (e) => {
    e?.preventDefault();
    const url = newImageUrl.trim();
    if (!url) return;
    const currentImages = Array.isArray(form.images) ? form.images : (form.image_url ? [form.image_url] : []);
    if (currentImages.includes(url)) {
      setNewImageUrl("");
      return;
    }
    const updated = [...currentImages, url];
    setForm((prev) => ({
      ...prev,
      images: updated,
      image_url: updated[0] || "",
    }));
    setNewImageUrl("");
  };

  async function handleUploadImages(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;
    setError("");
    setUploadingImages(true);
    try {
      const uploadedUrls = [];
      for (const file of files) {
        const path = await uploadLibraryFile({
          file,
          bucket: LIBRARY_BUCKETS.shopMedia,
          kind: "product-image",
        });
        const { data } = supabase.storage.from(LIBRARY_BUCKETS.shopMedia).getPublicUrl(path);
        if (!data?.publicUrl) throw new Error("Nao foi possivel gerar a imagem do produto.");
        uploadedUrls.push(data.publicUrl);
      }
      const currentImages = Array.isArray(form.images) ? form.images : [];
      const updated = [...currentImages, ...uploadedUrls].slice(0, 12);
      setForm((prev) => ({ ...prev, images: updated, image_url: updated[0] || "" }));
    } catch (err) {
      setError(err?.message || "Nao foi possivel enviar as imagens.");
    } finally {
      setUploadingImages(false);
    }
  }

  function addVariant() {
    setVariants((current) => [...current, { size: "", color: "", stock: 0, sku: "", active: true }]);
  }

  function updateVariant(index, field, value) {
    setVariants((current) => current.map((variant, i) => i === index ? { ...variant, [field]: value } : variant));
  }

  function removeVariant(index) {
    setVariants((current) => current.filter((_, i) => i !== index));
  }

  const handleRemoveImage = (index) => {
    const currentImages = Array.isArray(form.images) ? form.images : (form.image_url ? [form.image_url] : []);
    const updated = currentImages.filter((_, i) => i !== index);
    setForm((prev) => ({
      ...prev,
      images: updated,
      image_url: updated[0] || "",
    }));
  };

  const handleSetCoverImage = (index) => {
    if (index === 0) return;
    const currentImages = Array.isArray(form.images) ? form.images : (form.image_url ? [form.image_url] : []);
    const updated = [...currentImages];
    const [selected] = updated.splice(index, 1);
    updated.unshift(selected);
    setForm((prev) => ({
      ...prev,
      images: updated,
      image_url: updated[0] || "",
    }));
  };

  async function saveProduct(event) {
    event.preventDefault();
    setError("");
    const currentImages = Array.isArray(form.images) && form.images.length > 0
      ? form.images.filter(Boolean)
      : (form.image_url.trim() ? [form.image_url.trim()] : []);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category,
      credits_cost: Math.max(1, Number(form.credits_cost) || 1),
      real_price: Number(form.real_price) || 0,
      min_months_active: Math.max(0, Number(form.min_months_active) || 0),
      stock: form.stock === "" || form.stock === null ? null : Math.max(0, Number(form.stock) || 0),
      image_url: currentImages[0] || null,
      images: currentImages,
      external_sku: form.external_sku.trim() || null,
      active: Boolean(form.active),
      season_id: form.season_id || null,
      early_access_at: toIsoOrNull(form.early_access_at),
      public_release_at: toIsoOrNull(form.public_release_at),
    };
    if (!payload.name) { setError("Informe o nome do produto."); return; }

    if (!isSupabaseReady()) {
      let local = [];
      try {
        const stored = localStorage.getItem("ope_shop_products_dev");
        if (stored) local = JSON.parse(stored);
      } catch {}
      if (editingId) {
        local = local.map((p) => p.id === editingId ? { ...p, ...payload, variants } : p);
      } else {
        const newProduct = { ...payload, variants, id: `prod-${Date.now()}`, created_at: new Date().toISOString() };
        local.unshift(newProduct);
      }
      localStorage.setItem("ope_shop_products_dev", JSON.stringify(local));
      setForm(INITIAL_FORM);
      setEditingId(null);
      setVariants([]);
      await load();
      return;
    }

    try {
      let savedProductId = editingId;
      let { data: savedProduct, error } = editingId
        ? await supabase.from("shop_products").update(payload).eq("id", editingId).select("id").maybeSingle()
        : await supabase.from("shop_products").insert(payload).select("id").single();

      if (error && (error.message?.includes("column") || error.message?.includes("schema cache"))) {
        const fallbackPayload = { ...payload };
        if (error.message?.includes("'images'")) delete fallbackPayload.images;
        if (error.message?.includes("'real_price'")) delete fallbackPayload.real_price;
        if (error.message?.includes("season_id")) delete fallbackPayload.season_id;
        if (error.message?.includes("early_access_at")) delete fallbackPayload.early_access_at;
        if (error.message?.includes("public_release_at")) delete fallbackPayload.public_release_at;

        const res = editingId
          ? await supabase.from("shop_products").update(fallbackPayload).eq("id", editingId).select("id").maybeSingle()
          : await supabase.from("shop_products").insert(fallbackPayload).select("id").single();
        savedProduct = res.data;
        error = res.error;
      }

      if (error) throw error;
      savedProductId = savedProduct?.id || savedProductId;
      if (savedProductId) {
        const normalizedVariants = variants
          .map((variant) => ({
            ...(variant.id ? { id: variant.id } : {}),
            product_id: savedProductId,
            size: variant.size || null,
            color: variant.color?.trim() || null,
            stock: Math.max(0, Number(variant.stock) || 0),
            sku: variant.sku?.trim() || null,
            active: variant.active !== false,
          }))
          .filter((variant) => variant.size || variant.color);
        const { error: removeVariantsError } = await supabase.from("shop_product_variants").delete().eq("product_id", savedProductId);
        if (removeVariantsError && !/schema cache|does not exist|relation/i.test(removeVariantsError.message || "")) throw removeVariantsError;
        if (normalizedVariants.length > 0) {
          const { error: variantsError } = await supabase.from("shop_product_variants").insert(normalizedVariants.map(({ id: _id, ...variant }) => variant));
          if (variantsError && !/schema cache|does not exist|relation/i.test(variantsError.message || "")) throw variantsError;
        }
      }
      setForm(INITIAL_FORM);
      setEditingId(null);
      setVariants([]);
      await load();
    } catch (err) {
      setError(err?.message || "Não foi possível salvar o produto.");
    }
  }

  function startEdit(product) {
    setEditingId(product.id);
    let productImages = [];
    if (Array.isArray(product.images) && product.images.length > 0) {
      productImages = product.images;
    } else if (typeof product.images === "string" && product.images.startsWith("[")) {
      try { productImages = JSON.parse(product.images); } catch {}
    } else if (product.image_url) {
      productImages = [product.image_url];
    }
    setForm({
      name: product.name || "",
      description: product.description || "",
      category: product.category || "book",
      credits_cost: product.credits_cost || 100,
      real_price: product.real_price || "",
      min_months_active: product.min_months_active || 0,
      stock: product.stock ?? "",
      image_url: product.image_url || "",
      images: productImages,
      external_sku: product.external_sku || "",
      active: product.active !== false,
      season_id: product.season_id || "",
      early_access_at: toDateTimeLocal(product.early_access_at),
      public_release_at: toDateTimeLocal(product.public_release_at),
    });
    setVariants(Array.isArray(product.variants) ? product.variants.map((variant) => ({ ...variant })) : []);
  }

  async function toggleActive(product) {
    setError("");
    if (!isSupabaseReady()) {
      let local = JSON.parse(localStorage.getItem("ope_shop_products_dev") || "[]");
      local = local.map((p) => p.id === product.id ? { ...p, active: !p.active } : p);
      localStorage.setItem("ope_shop_products_dev", JSON.stringify(local));
      await load();
      return;
    }
    try {
      const { error } = await supabase.from("shop_products").update({ active: !product.active }).eq("id", product.id);
      if (error) throw error;
      await load();
    } catch (err) {
      setError(err?.message || "Não foi possível atualizar o produto.");
    }
  }

  async function removeProduct(product) {
    const ok = await confirm.ask({
      title: "Remover produto?",
      description: `"${product.name}" será removido do catálogo.`,
      confirmLabel: "Remover",
      danger: true,
    });
    if (!ok) return;
    setError("");
    if (!isSupabaseReady()) {
      let local = JSON.parse(localStorage.getItem("ope_shop_products_dev") || "[]");
      local = local.filter((p) => p.id !== product.id);
      localStorage.setItem("ope_shop_products_dev", JSON.stringify(local));
      await load();
      return;
    }
    try {
      const { error } = await supabase.from("shop_products").delete().eq("id", product.id);
      if (error) throw error;
      await load();
    } catch (err) {
      setError(err?.message || "Não foi possível remover o produto.");
    }
  }

  const inputClass = "w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)]";

  return (
    <div className="space-y-6">
      <form onSubmit={saveProduct} className="space-y-4 rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{editingId ? "Editar produto" : "Novo produto"}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input className={inputClass} placeholder="Nome do produto" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {PRODUCT_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
          <select className={inputClass} value={form.season_id} onChange={(e) => setForm({ ...form, season_id: e.target.value })}>
            <option value="">Sem season vinculada</option>
            {seasons.map((season) => <option key={season.id} value={season.id}>{season.name} ({season.status})</option>)}
          </select>
          <p className="sm:col-span-2 -mt-1 text-xs text-[var(--text-muted)]">A season e opcional. O produto continua na Loja; este campo apenas define em qual season ele aparece.</p>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            Acesso antecipado Pensador
            <input className={inputClass} type="datetime-local" value={form.early_access_at} onChange={(e) => setForm({ ...form, early_access_at: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            Liberar para todos
            <input className={inputClass} type="datetime-local" value={form.public_release_at} onChange={(e) => setForm({ ...form, public_release_at: e.target.value })} />
          </label>
          <p className="sm:col-span-2 -mt-1 text-xs text-[var(--text-muted)]">Deixe as duas datas vazias para publicar imediatamente. O acesso antecipado deve ser anterior à liberação pública.</p>
          <input className={inputClass} placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input className={inputClass} type="number" min="1" placeholder="Custo em créditos" value={form.credits_cost} onChange={(e) => setForm({ ...form, credits_cost: e.target.value })} />
          <input className={inputClass} type="number" min="0" step="0.01" placeholder="Preço em R$ (opcional, ex: 189.90)" value={form.real_price} onChange={(e) => setForm({ ...form, real_price: e.target.value })} />
          <input className={inputClass} type="number" min="0" step="0.5" placeholder="Mínimo de meses ativo" value={form.min_months_active} onChange={(e) => setForm({ ...form, min_months_active: e.target.value })} />
          <input className={inputClass} type="number" min="0" step="1" placeholder="Estoque (vazio = ilimitado)" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          <input className={inputClass} placeholder="SKU externo" value={form.external_sku} onChange={(e) => setForm({ ...form, external_sku: e.target.value })} />
        </div>

         <p className="text-[11px] text-[var(--text-muted)]">Regra: minimo de 10 creditos por R$1. Exemplo: R$60 = 600 creditos.</p>

         {/* Gerenciamento de Multi-imagens */}
        <div className="space-y-2.5 rounded-[8px] border border-[var(--border)] bg-[var(--bg-canvas)] p-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[var(--text-primary)]">
              Imagens do Produto ({form.images?.length || 0})
            </label>
            <span className="text-[11px] text-[var(--text-muted)]">A 1ª imagem será a capa principal</span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className={inputClass}
              placeholder="Cole a URL de uma imagem (ex: https://...)"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddImage(); } }}
            />
            <button
              type="button"
              onClick={handleAddImage}
              className="flex shrink-0 items-center gap-1 rounded-[6px] border border-[var(--border)] bg-[var(--hover-overlay)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
            >
              <Plus className="size-3.5" /> Adicionar imagem
            </button>
            <label className="flex shrink-0 cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-[var(--border)] bg-[var(--hover-overlay)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors">
              <Plus className="size-3.5" />
              {uploadingImages ? "Enviando..." : "Enviar arquivos"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                disabled={uploadingImages}
                onChange={handleUploadImages}
                className="sr-only"
              />
            </label>
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">Envie ate 12 imagens JPG, PNG, WebP ou GIF. A primeira imagem e a capa.</p>

          {/* Listagem de Thumbnails com Ações */}
          {form.images && form.images.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {form.images.map((imgUrl, idx) => (
                <div key={idx} className="group relative aspect-square overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--bg-card)]">
                  <img src={imgUrl} alt={`Preview ${idx + 1}`} className="h-full w-full object-cover" />
                  {idx === 0 ? (
                    <span className="absolute top-1.5 left-1.5 rounded bg-[var(--accent-mint)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--bg-card)] shadow-sm">
                      Capa
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetCoverImage(idx)}
                      className="absolute top-1.5 left-1.5 hidden group-hover:block rounded bg-[var(--bg-card)]/90 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--accent-mint)] hover:text-[var(--bg-card)] shadow-sm"
                      title="Definir como capa principal"
                    >
                      Tornar Capa
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-red-500 transition-colors"
                    title="Remover imagem"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-[8px] border border-[var(--border)] bg-[var(--bg-canvas)] p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-[var(--text-primary)]">Variacoes do produto</p>
              <p className="text-[11px] text-[var(--text-muted)]">Use para roupas. O estoque de cada tamanho/cor e separado.</p>
            </div>
            <button
              type="button"
              onClick={addVariant}
              className="inline-flex items-center justify-center gap-1 rounded-[6px] border border-[var(--border)] bg-[var(--hover-overlay)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--border-strong)]"
            >
              <Plus className="size-3.5" /> Adicionar variacao
            </button>
          </div>
          {variants.length === 0 ? (
            <p className="text-[11px] text-[var(--text-muted)]">Sem variacoes. O produto usara o estoque geral.</p>
          ) : (
            <div className="space-y-2">
              {variants.map((variant, index) => (
                <div key={variant.id || `new-${index}`} className="grid grid-cols-1 gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--bg-card)] p-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                  <select className={inputClass} value={variant.size || ""} onChange={(event) => updateVariant(index, "size", event.target.value)}>
                    <option value="">Tamanho</option>
                    {['PP', 'P', 'M', 'G', 'GG', 'XG', 'UNICO'].map((size) => <option key={size} value={size}>{size === 'UNICO' ? 'Unico' : size}</option>)}
                  </select>
                  <input className={inputClass} placeholder="Cor (ex: Preto)" value={variant.color || ""} onChange={(event) => updateVariant(index, "color", event.target.value)} />
                  <input className={inputClass} placeholder="SKU (opcional)" value={variant.sku || ""} onChange={(event) => updateVariant(index, "sku", event.target.value)} />
                  <input className={inputClass} type="number" min="0" step="1" placeholder="Estoque" value={variant.stock ?? 0} onChange={(event) => updateVariant(index, "stock", event.target.value)} />
                  <button type="button" onClick={() => removeVariant(index)} className="flex items-center justify-center rounded-[6px] border border-red-500/30 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10" title="Remover variacao">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Ativo no catálogo
          </label>
          <div className="flex gap-2">
            {editingId && (
              <button type="button" onClick={() => { setEditingId(null); setForm(INITIAL_FORM); setVariants([]); }} className="rounded-full border border-[var(--border)] px-4 py-2 text-xs text-[var(--text-secondary)]">
                Cancelar
              </button>
            )}
            <button type="submit" className="rounded-full bg-[var(--accent-mint)] px-4 py-2 text-xs font-semibold text-[var(--bg-card)]">
              {editingId ? "Salvar alterações" : "Criar produto"}
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>

      {/* Configuração da seção Novo Drop Disponível */}
      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Destaque "Novo Drop Disponível" na Loja</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Ative ou selecione quais produtos aparecerão no carrossel de destaques da Loja OPE.</p>
          </div>
          <button
            type="button"
            onClick={toggleDropActive}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              dropConfig.active
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "bg-[var(--hover-overlay)] text-[var(--text-muted)] border border-[var(--border)]"
            }`}
          >
            {dropConfig.active ? "Ativo na Loja ✓" : "Oculto na Loja"}
          </button>
        </div>

        {dropConfig.active && products.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[var(--border)]">
            <p className="text-xs font-medium text-[var(--text-secondary)]">
              Selecione os produtos para destacar no Drop (se nenhum for marcado, os produtos mais recentes serão exibidos automaticamente):
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {products.map((p) => {
                const isSelected = (dropConfig.productIds || []).includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleDropProduct(p.id)}
                    className={`rounded-[8px] border px-3 py-1.5 text-xs font-medium transition-all ${
                      isSelected
                        ? "border-[var(--text-primary)] bg-[var(--hover-overlay)] text-[var(--text-primary)] font-semibold shadow-sm"
                        : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    {isSelected ? "✓ " : ""}{p.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando...</p>
      ) : products.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">Nenhum produto cadastrado.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)] uppercase tracking-wider">
                <th className="pb-3 pr-4 font-medium">Produto</th>
                <th className="pb-3 pr-4 font-medium">Categoria</th>
                <th className="pb-3 pr-4 font-medium">Custo</th>
                <th className="pb-3 pr-4 font-medium">Mín. meses</th>
                <th className="pb-3 pr-4 font-medium">Estoque</th>
                <th className="pb-3 pr-4 font-medium">Ativo</th>
                <th className="pb-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const pImages = Array.isArray(p.images) && p.images.length > 0
                  ? p.images
                  : (typeof p.images === "string" && p.images.startsWith("[") ? (JSON.parse(p.images || "[]")) : (p.image_url ? [p.image_url] : []));
                return (
                  <tr key={p.id} className="border-b border-[var(--border)] hover:bg-[var(--hover-overlay)] transition-colors">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        {pImages.length > 0 ? (
                          <div className="relative w-10 h-14 shrink-0 overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--bg-canvas)] shadow-sm">
                            <img src={pImages[0]} alt="" className="h-full w-full object-cover" />
                            {pImages.length > 1 && (
                              <span className="absolute bottom-0.5 right-0.5 rounded-[4px] bg-[var(--bg-card)]/90 border border-[var(--border)] px-1 text-[9px] font-bold text-[var(--text-primary)]">
                                +{pImages.length - 1}
                              </span>
                            )}
                          </div>
                        ) : null}
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">{p.name}</p>
                          {p.description && <p className="max-w-[280px] truncate text-xs text-[var(--text-muted)]">{p.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-[var(--text-secondary)]">{CATEGORY_LABELS[p.category] || p.category}</td>
                    <td className="py-3 pr-4 text-[var(--text-secondary)]">{p.credits_cost}</td>
                    <td className="py-3 pr-4 text-[var(--text-secondary)]">{p.min_months_active}</td>
                    <td className="py-3 pr-4 text-[var(--text-secondary)]">{p.stock == null ? "Ilimitado" : p.stock}</td>
                    <td className="py-3 pr-4">
                      <button type="button" onClick={() => toggleActive(p)} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${p.active ? "bg-[var(--accent-mint)]/10 text-[var(--accent-mint)]" : "bg-[var(--hover-overlay)] text-[var(--text-muted)]"}`}>
                        {p.active ? "Sim" : "Não"}
                      </button>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => startEdit(p)} className="rounded-full border border-[var(--border)] p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]" title="Editar"><Edit3 className="size-4" /></button>
                        <button type="button" onClick={() => removeProduct(p)} className="rounded-full border border-[var(--border)] p-1.5 text-[var(--text-muted)] hover:text-red-400" title="Remover"><Trash2 className="size-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {confirm.dialog}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spam: reverte XP/creditos concedidos por atividade de um usuario (RPC).
// ---------------------------------------------------------------------------
function SpamTab() {
  const [userId, setUserId] = useState("");
  const [days, setDays] = useState(7);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  async function run() {
    if (!userId.trim()) { setMessage("Informe o ID do usuário."); return; }
    setWorking(true);
    setMessage("");
    try {
      const { data, error } = await supabase.rpc("spam_revert", { p_user_id: userId.trim(), p_days });
      if (error) throw error;
      const xpRev = Number(data?.xpReverted || 0);
      const crRev = Number(data?.creditsReverted || 0);
      setMessage(xpRev > 0 || crRev > 0
        ? `Revertidos ${xpRev} XP e ${crRev} créditos do usuário.`
        : "Nenhum registro encontrado para reverter no período.");
    } catch (err) {
      setMessage(err?.message || "Nao foi possivel executar a reversao.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Reverter atividade de spam</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Remove os créditos/XP concedidos por postagens e comentários duplicados de um usuário nos últimos N dias, recompensando novamente os autores legítimos das cópias.
        </p>
      </div>
      <div className="space-y-3 rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <input
          className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
          placeholder="ID do usuário (uuid)"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        <input
          type="number"
          min="1"
          max="90"
          className="w-32 rounded-[6px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
          placeholder="Dias (padrão 7)"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        />
        <button
          type="button"
          disabled={working}
          onClick={run}
          className="rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {working ? "Revertendo..." : "Reverter atividade"}
        </button>
        {message && <p className="text-sm text-[var(--text-secondary)]">{message}</p>}
      </div>
    </div>
  );
}

function IndicacoesTab() {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    if (!isSupabaseReady()) {
      setReferrals([]);
      setLoading(false);
      return;
    }
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_list_referrals");
      if (rpcError) throw rpcError;
      setReferrals(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || "Não foi possível carregar as indicações.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleApprove(r) {
    setWorking(r.id);
    setError("");
    try {
      const { error: rpcError } = await supabase.rpc("admin_confirm_referral", {
        p_referrer_user_id: r.referrer.id,
        p_referred_user_id: r.referred.id,
      });
      if (rpcError) throw rpcError;
      toast.success("Indicação confirmada. Recompensa aplicada.");
      await load();
    } catch (err) {
      setError(err?.message || "Não foi possível confirmar a indicação.");
    } finally {
      setWorking("");
    }
  }

  async function handleCancel(r) {
    setWorking(r.id);
    setError("");
    try {
      const { error: rpcError } = await supabase.rpc("admin_cancel_referral", {
        p_referrer_user_id: r.referrer.id,
        p_referred_user_id: r.referred.id,
      });
      if (rpcError) throw rpcError;
      toast.success("Indicação cancelada.");
      await load();
    } catch (err) {
      setError(err?.message || "Não foi possível cancelar a indicação.");
    } finally {
      setWorking("");
    }
  }

  const confirmed = referrals.filter((r) => r.status === "confirmed").length;
  const pending = referrals.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">{referrals.length} indicações</p>
        <button type="button" onClick={load} className="flex items-center gap-1 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <RefreshCw className="size-3.5" /> Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total de Indicações" value={referrals.length} icon={Users} />
        <StatCard label="Confirmadas" value={confirmed} icon={Check} />
        <StatCard label="Pendentes" value={pending} icon={RefreshCw} />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando...</p>
      ) : referrals.length === 0 ? (
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-10 text-center text-sm text-[var(--text-muted)]">
          Nenhuma indicação cadastrada ainda.
        </div>
      ) : (
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[var(--border)]">
                <TableHead className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">Quem Indicou</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">Quem Entrou</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">Data</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">Status</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-[var(--border)]">
              {referrals.map((r) => (
                <TableRow key={r.id} className="hover:bg-[var(--hover-overlay)] transition-colors">
                  <TableCell>
                    <div className="text-sm font-medium text-[var(--text-primary)]">{r.referrer?.name || "Sem nome"}</div>
                    <div className="text-xs text-[var(--text-muted)]">{r.referrer?.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium text-[var(--text-primary)]">{r.referred?.name || "Sem nome"}</div>
                    <div className="text-xs text-[var(--text-muted)]">{r.referred?.email}</div>
                  </TableCell>
                  <TableCell className="text-xs text-[var(--text-muted)]">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString("pt-BR") : "-"}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-[6px] border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      r.status === "confirmed"
                        ? "border-green-500/30 bg-green-500/10 text-green-400"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    }`}>
                      {r.status === "confirmed" ? "Confirmada" : "Pendente"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {r.status !== "confirmed" && (
                        <button
                          type="button"
                          disabled={working === r.id}
                          onClick={() => handleApprove(r)}
                          className="rounded-[8px] bg-[var(--text-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--bg-card)] hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                          Aprovar
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={working === r.id}
                        onClick={() => handleCancel(r)}
                        className="rounded-[8px] border border-[var(--border)] bg-[var(--hover-overlay)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function SeasonsTab() {
  const confirm = useConfirmDialog();
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", starts_on: "", ends_on: "", status: "active" });
  const [editForm, setEditForm] = useState({ name: "", description: "", starts_on: "", ends_on: "" });

  const STATUS_META = {
    draft: { label: "Rascunho", cls: "border-[var(--border)] bg-[var(--hover-overlay)] text-[var(--text-muted)]" },
    active: { label: "Ativa", cls: "border-green-500/30 bg-green-500/10 text-green-400" },
    archived: { label: "Arquivada", cls: "border-[var(--border)] bg-[var(--hover-overlay)] text-[var(--text-muted)]" },
  };

  async function load() {
    setLoading(true);
    setError("");
    if (!isSupabaseReady()) {
      setSeasons([]);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("seasons")
        .select("id, name, description, status, starts_on, ends_on, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setSeasons(data || []);
    } catch (err) {
      setError(err?.message || "Nao foi possivel carregar as seasons.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setWorking("create");
    setError("");
    supabase
      .from("seasons")
      .insert({
        name: form.name.trim(),
        description: form.description.trim() || null,
        status: form.status,
        starts_on: form.starts_on || null,
        ends_on: form.ends_on || null,
      })
      .then(async ({ error }) => {
        if (error) throw error;
        setForm({ name: "", description: "", starts_on: "", ends_on: "", status: "active" });
        await load();
      })
      .catch((err) => setError(err?.message || "Nao foi possivel criar a season."))
      .finally(() => setWorking(""));
  }

  function handleToggleStatus(season) {
    const next = season.status === "draft" ? "active" : season.status === "active" ? "archived" : "draft";
    setWorking(season.id);
    setError("");
    supabase
      .from("seasons")
      .update({ status: next })
      .eq("id", season.id)
      .then(async ({ error }) => {
        if (error) throw error;
        await load();
      })
      .catch((err) => setError(err?.message || "Nao foi possivel atualizar a season."))
      .finally(() => setWorking(""));
  }

  function startEdit(season) {
    setEditingId(season.id);
    setEditForm({
      name: season.name,
      description: season.description || "",
      starts_on: season.starts_on || "",
      ends_on: season.ends_on || "",
    });
  }

  function handleSaveEdit(season) {
    if (!editForm.name.trim()) return;
    setWorking(season.id);
    setError("");
    supabase
      .from("seasons")
      .update({
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        starts_on: editForm.starts_on || null,
        ends_on: editForm.ends_on || null,
      })
      .eq("id", season.id)
      .then(async ({ error }) => {
        if (error) throw error;
        setEditingId(null);
        await load();
      })
      .catch((err) => setError(err?.message || "Nao foi possivel salvar a season."))
      .finally(() => setWorking(""));
  }

  async function handleDelete(season) {
    const ok = await confirm.ask({
      title: "Excluir season?",
      description: `"${season.name}" sera removida permanentemente.`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    setWorking(season.id);
    setError("");
    try {
      const { error } = await supabase.from("seasons").delete().eq("id", season.id);
      if (error) throw error;
      await load();
    } catch (err) {
      setError(err?.message || "Nao foi possivel excluir a season.");
    } finally {
      setWorking("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">{seasons.length} seasons</p>
        <button type="button" onClick={load} className="flex items-center gap-1 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <RefreshCw className="size-3.5" /> Atualizar
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}

      <form onSubmit={handleCreate} className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Criar Nova Season</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            className="rounded-[6px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)]"
            placeholder="Nome da Season (ex: Season 1 Bukowski)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            type="date"
            className="rounded-[6px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
            value={form.starts_on}
            onChange={(e) => setForm({ ...form, starts_on: e.target.value })}
          />
          <input
            type="date"
            className="rounded-[6px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
            value={form.ends_on}
            onChange={(e) => setForm({ ...form, ends_on: e.target.value })}
          />
          <select
            className="rounded-[6px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            <option value="active">Ativa e visivel</option>
            <option value="draft">Rascunho</option>
          </select>
          <textarea
            className="rounded-[6px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)] sm:col-span-2"
            placeholder="Descricao da Season"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <button
          type="submit"
          disabled={!form.name.trim() || working === "create"}
          className="rounded-[8px] bg-[var(--text-primary)] px-4 py-2 text-xs font-semibold text-[var(--bg-card)] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Criar Season
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando...</p>
      ) : seasons.length === 0 ? (
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-10 text-center text-sm text-[var(--text-muted)]">
          Nenhuma season cadastrada ainda.
        </div>
      ) : (
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[var(--border)]">
                <TableHead className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">Season</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">Periodo</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">Status</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-[var(--border)]">
              {seasons.map((s) => {
                const meta = STATUS_META[s.status] || STATUS_META.draft;
                const editing = editingId === s.id;
                return (
                  <TableRow key={s.id} className="hover:bg-[var(--hover-overlay)] transition-colors">
                    <TableCell>
                      {editing ? (
                        <div className="space-y-2 min-w-[220px]">
                          <input
                            className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          />
                          <textarea
                            className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
                            rows={2}
                            value={editForm.description}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          />
                          <div className="flex gap-2">
                            <input
                              type="date"
                              className="rounded-[6px] border border-[var(--border)] bg-[var(--bg-canvas)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
                              value={editForm.starts_on}
                              onChange={(e) => setEditForm({ ...editForm, starts_on: e.target.value })}
                            />
                            <input
                              type="date"
                              className="rounded-[6px] border border-[var(--border)] bg-[var(--bg-canvas)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
                              value={editForm.ends_on}
                              onChange={(e) => setEditForm({ ...editForm, ends_on: e.target.value })}
                            />
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-medium text-[var(--text-primary)]">{s.name}</p>
                          {s.description && <p className="mt-0.5 text-xs text-[var(--text-muted)] line-clamp-2 max-w-md">{s.description}</p>}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-[var(--text-muted)]">
                      {s.starts_on || "?"} ate {s.ends_on || "?"}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-[6px] border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta.cls}`}>
                        {meta.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {editing ? (
                          <>
                            <button
                              type="button"
                              disabled={!editForm.name.trim() || working === s.id}
                              onClick={() => handleSaveEdit(s)}
                              className="rounded-[8px] bg-[var(--text-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--bg-card)] hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded-[8px] border border-[var(--border)] bg-[var(--hover-overlay)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={working === s.id}
                              onClick={() => handleToggleStatus(s)}
                              className={`rounded-[8px] px-3 py-1.5 text-xs font-semibold transition-opacity disabled:opacity-50 ${
                                s.status === "active"
                                  ? "border border-[var(--border)] bg-[var(--hover-overlay)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                  : "bg-[var(--text-primary)] text-[var(--bg-card)] hover:opacity-90"
                              }`}
                            >
                              {s.status === "draft" ? "Ativar" : s.status === "active" ? "Arquivar" : "Rascunho"}
                            </button>
                            <button
                              type="button"
                              onClick={() => startEdit(s)}
                              className="size-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] transition-all"
                              title="Editar"
                            >
                              <Edit3 className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(s)}
                              className="size-8 rounded-full flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-all"
                              title="Excluir"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {confirm.dialog}
    </div>
  );
}



// ── Aba Créditos ──────────────────────────────────────────────────────────────
const DAILY_MISSIONS = [
  { title: "Entrar no aplicativo", reward: 1 },
  { title: "Ler 30 minutos", reward: 10 },
  { title: "Publicar 1 reflexão", reward: 1 },
  { title: "Comentar em 2 publicações", reward: 1 },
  { title: "Bônus por concluir as 4 missões", reward: 2, isBonus: true },
];

function CreditsTab() {
  const { profiles, subscriptions } = useData();
  const [spentByUser, setSpentByUser] = useState({});

  useEffect(() => {
    let active = true;
    if (!isSupabaseReady()) {
      return;
    }
    supabase
      .from("shop_redemptions")
      .select("user_id, credits_spent")
      .then(({ data, error }) => {
        if (!active) return;
        const totals = {};
        if (!error && Array.isArray(data)) {
          for (const r of data) {
            totals[r.user_id] = (totals[r.user_id] || 0) + Number(r.credits_spent || 0);
          }
        }
        setSpentByUser(totals);
      });
    return () => { active = false; };
  }, []);

  const memberRows = useMemo(() => {
    return profiles.map((p) => {
      const sub = pickCurrentSubscription(subscriptions, p.id);
      const active = isActiveSubscription(sub);
      const joinedDate = p.created_at ? new Date(p.created_at) : null;
      const daysInClub = joinedDate
        ? Math.max(0, Math.floor((Date.now() - joinedDate.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;
      return {
        id: p.id,
        name: p.name || "Sem nome",
        email: p.email || "Sem email",
        avatar: p.avatar,
        xp: Number(p.xp || 0),
        credits: Number(p.credits || 0),
        totalSpent: spentByUser[p.id] || 0,
        daysInClub,
        plan: active ? (sub?.plan === "ope_club_annual" ? "Anual" : "Mensal") : "Sem plano",
        active,
      };
    });
  }, [profiles, subscriptions, spentByUser]);

  const rows = memberRows;

  const totalCreditsInSystem = rows.reduce((s, r) => s + r.credits, 0);
  const totalEarnedSystem = rows.reduce((s, r) => s + r.xp, 0);
  const totalSpentSystem = rows.reduce((s, r) => s + r.totalSpent, 0);
  const activeMembers = rows.filter((r) => r.active).length;

  return (
    <div className="space-y-6">

      {/* StatCards de Créditos */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Créditos em Circulação</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{totalCreditsInSystem.toLocaleString("pt-BR")}</p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">saldo total dos membros</p>
        </div>
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Total de XP</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{totalEarnedSystem.toLocaleString("pt-BR")}</p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">XP acumulado pelos membros</p>
        </div>
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Total Resgatado</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{totalSpentSystem.toLocaleString("pt-BR")}</p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">créditos trocados por produtos</p>
        </div>
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Membros Ativos</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{activeMembers}</p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">com plano ativo</p>
        </div>
      </div>

      {/* Progressão de Créditos — informação interna */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Missões e valores */}
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Estrutura de Missões Diárias</p>
            <p className="text-xs text-[var(--text-muted)]">Créditos emitidos por missão</p>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {DAILY_MISSIONS.map((m) => (
              <div key={m.title} className={`flex items-center justify-between px-4 py-3 ${m.isBonus ? "bg-[var(--hover-overlay)]" : ""}`}>
                <div>
                  <p className="text-sm text-[var(--text-primary)]">{m.title}</p>
                  {m.isBonus && (
                    <p className="text-[11px] text-[var(--text-muted)]">Ao concluir todas as 4 missões</p>
                  )}
                </div>
                <span className="text-sm font-semibold text-[var(--text-primary)]">+{m.reward} crédito{m.reward > 1 ? "s" : ""}</span>
              </div>
            ))}
            <div className="flex items-center justify-between bg-[var(--bg-canvas)] px-4 py-3">
              <p className="text-sm font-bold text-[var(--text-primary)]">Total por dia completo</p>
              <span className="text-sm font-bold text-[var(--text-primary)]">+8 créditos</span>
            </div>
          </div>
        </div>

        {/* Progressão mensal */}
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Progressão de Créditos</p>
            <p className="text-xs text-[var(--text-muted)]">Potencial de ganho por período</p>
          </div>
          <div className="divide-y divide-[var(--border)]">
            <div className="flex items-start justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Por dia</p>
                <p className="text-xs text-[var(--text-muted)]">4 missões + bônus</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-[var(--text-primary)]">8 créditos</p>
              </div>
            </div>
            <div className="flex items-start justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Por semana</p>
                <p className="text-xs text-[var(--text-muted)]">8 × 7 dias + bônus semanal (20)</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-[var(--text-primary)]">76 créditos</p>
                <p className="text-[11px] text-[var(--text-muted)]">56 diários + 20 bônus</p>
              </div>
            </div>
            <div className="flex items-start justify-between bg-[var(--hover-overlay)] px-4 py-3">
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">Por mês</p>
                <p className="text-xs text-[var(--text-muted)]">8 × 30 dias + 4 bônus semanais</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-[var(--text-primary)]">~320 créditos</p>
                <p className="text-[11px] text-[var(--text-muted)]">240 diários + ~80 em bônus</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela Detalhada de Membros */}
      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Créditos por Membro</p>
            <p className="text-xs text-[var(--text-muted)]">{rows.length} membros • saldo real de créditos e XP</p>
          </div>
        </div>

        {/* Header tabela */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-canvas)]">
                <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">Membro</th>
                <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">Plano</th>
                <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">Dias no Club</th>
                <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">XP</th>
                <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">Saldo Atual</th>
                <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">Total Gasto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((member) => (
                <tr key={member.id} className="hover:bg-[var(--hover-overlay)] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--hover-overlay)] text-xs font-bold text-[var(--text-primary)]">
                        {member.avatar?.startsWith("data:") || member.avatar?.startsWith("http") ? (
                          <img src={member.avatar} alt="" className="h-full w-full object-cover" />
                        ) : (
                          (member.name?.charAt(0) || "U").toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{member.name}</p>
                        <p className="text-[11px] text-[var(--text-muted)]">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-[6px] border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      member.active
                        ? "border-[var(--border)] bg-[var(--hover-overlay)] text-[var(--text-primary)]"
                        : "border-[var(--border)] bg-[var(--hover-overlay)] text-[var(--text-muted)]"
                    }`}>
                      {member.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{member.daysInClub}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">dias</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{member.xp.toLocaleString("pt-BR")}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">XP</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-bold text-[var(--text-primary)]">{member.credits.toLocaleString("pt-BR")}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">créditos</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm text-[var(--text-primary)]">{member.totalSpent.toLocaleString("pt-BR")}</p>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">Nenhum membro cadastrado ainda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PedidosTab() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function toLocal(r) {
    return {
      id: r.id,
      productName: r.product_name,
      productCategory: r.product_category,
      paymentMethod: r.payment_method,
      creditsCost: r.credits_cost,
      realPrice: r.real_price,
      quantity: r.quantity || 1,
      variant: r.variant_snapshot || null,
      customer: r.customer || {},
      address: r.address || {},
      status: r.status,
      createdAt: r.created_at,
    };
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      if (isSupabaseReady()) {
        const { data, error } = await supabase.rpc("admin_list_orders", { p_limit: 200 });
        if (error) throw error;
        setOrders((data || []).map(toLocal));
      } else {
        try {
          const saved = localStorage.getItem("ope_orders");
          const parsed = saved ? JSON.parse(saved) : [];
          setOrders(Array.isArray(parsed) ? parsed : []);
        } catch {
          setOrders([]);
        }
      }
    } catch (err) {
      setError(err?.message || "Não foi possível carregar os pedidos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const updateOrderStatus = async (id, newStatus) => {
    const optimistic = orders.map((o) => (o.id === id ? { ...o, status: newStatus } : o));
    setOrders(optimistic);
    if (isSupabaseReady()) {
      try {
        const { error } = await supabase.rpc("admin_update_order_status", {
          p_order_id: id,
          p_status: newStatus,
        });
        if (error) throw error;
      } catch {
        load();
      }
    } else {
      try {
        localStorage.setItem("ope_orders", JSON.stringify(optimistic));
      } catch {}
    }
  };

  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const completedCount = orders.filter((o) => o.status === "delivered" || o.status === "completed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-[var(--text-primary)]">Pedidos do Checkout</h3>
          <p className="text-xs text-[var(--text-muted)]">Leads e pedidos realizados na Loja (Créditos e Dinheiro Real R$)</p>
        </div>
        <div className="flex items-center gap-2">
          {error ? (
            <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400">
              {error}
            </span>
          ) : null}
          <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400">
            {pendingCount} pendentes
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total de Pedidos" value={orders.length} icon={Package} />
        <StatCard label="Pedidos Pendentes" value={pendingCount} icon={RefreshCw} />
        <StatCard label="Pedidos Entregues" value={completedCount} icon={Check} />
      </div>

      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[var(--border)]">
              <TableHead className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">Data / ID</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">Cliente (Lead)</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">Produto & Pagamento</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">Endereço de Entrega</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">Status</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-[var(--border)]">
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-xs text-[var(--text-muted)]">
                  Carregando pedidos…
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-xs text-[var(--text-muted)]">
                  Nenhum pedido no Crédito OPE ainda.
                </TableCell>
              </TableRow>
            ) : orders.map((o) => (
              <TableRow key={o.id} className="hover:bg-[var(--hover-overlay)] transition-colors">
                <TableCell>
                  <div className="text-xs font-medium text-[var(--text-primary)]">
                    {new Date(o.createdAt).toLocaleDateString("pt-BR")}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] truncate max-w-[90px]">{o.id}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">{o.customer?.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">{o.customer?.email}</div>
                  <div className="text-xs text-blue-400 font-mono mt-0.5">{o.customer?.phone}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm font-medium text-[var(--text-primary)]">{o.productName}</div>
                  <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {o.quantity || 1} unidade{Number(o.quantity || 1) === 1 ? "" : "s"}
                    {o.variant?.size ? ` · ${o.variant.size === "UNICO" ? "Unico" : o.variant.size}` : ""}
                    {o.variant?.color ? ` · ${o.variant.color}` : ""}
                  </div>
                  <div className="mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold">
                    {o.paymentMethod === "credits" ? (
                      <span className="text-blue-400">
                        {o.creditsCost} créditos
                      </span>
                    ) : (
                      <span className="text-green-400">
                        R$ {Number(o.realPrice || 0).toFixed(2)} (Dinheiro)
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-xs text-[var(--text-secondary)] max-w-[200px] leading-tight">
                    {o.address?.street}, {o.address?.number} {o.address?.complement ? `(${o.address.complement})` : ""}
                    <br />
                    <span className="text-[var(--text-muted)]">{o.address?.neighborhood} — {o.address?.city}/{o.address?.state} ({o.address?.cep})</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-[6px] border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    o.status === "delivered" || o.status === "completed"
                      ? "border-green-500/30 bg-green-500/10 text-green-400"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  }`}>
                    {o.status === "delivered" || o.status === "completed" ? "Entregue" : "Pendente"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {o.status !== "delivered" && o.status !== "completed" ? (
                    <button
                      type="button"
                      onClick={() => updateOrderStatus(o.id, "delivered")}
                      className="rounded-[8px] bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
                    >
                      Concluir / Entregue
                    </button>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">✓ Finalizado</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
export function AdminPage() {
  const { isAdmin, canManageContent } = useAuth();
  const allowedTabs = useMemo(
    () => isAdmin ? tabs : tabs.filter((tab) => !["users", "subscriptions"].includes(tab.id)),
    [isAdmin]
  );
  const [activeTab, setActiveTab] = useState(isAdmin ? "dashboard" : "posts");

  useEffect(() => {
    if (!allowedTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(allowedTabs[0]?.id || "posts");
    }
  }, [activeTab, allowedTabs]);

  if (!canManageContent) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <ShieldAlert className="size-12 text-[var(--text-muted)]" />
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Acesso restrito</h2>
        <p className="text-sm text-[var(--text-muted)] text-center max-w-sm">
          Apenas administradores podem acessar o painel. Se você é admin, certifique-se de que sua conta tem a permissão correta.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">Admin</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Gerencie usuários, assinaturas, posts, livros e autores.</p>
      </div>

      <div
        className="flex gap-0 overflow-x-auto border-b border-[var(--border)] pb-0"
        style={{ scrollbarWidth: "thin", scrollbarColor: "var(--border) transparent" }}
      >
        {allowedTabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                isActive ? "text-[var(--text-primary)] border-[var(--text-primary)]" : "text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]"
              }`}>
              {tab.label}
            </button>
          );
        })}
      </div>

      <div>
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "users" && <UsersTab />}
        {activeTab === "creditos" && <CreditsTab />}
        {activeTab === "pedidos" && <PedidosTab />}
        {activeTab === "subscriptions" && <UsersTab />}
        {activeTab === "posts" && <PostsTab />}
        {activeTab === "releases" && <WeeklyReleasesTab />}
        {activeTab === "categories" && <CategoriesTab />}
        {activeTab === "books" && <BooksTab />}
        {activeTab === "authors" && <AuthorsTab />}
        {activeTab === "creditos" && <CreditsTab />}
        {activeTab === "resgates" && <ResgatesTab />}
        {activeTab === "loja" && <LojaTab />}
        {activeTab === "indicacoes" && <IndicacoesTab />}
        {activeTab === "seasons" && <SeasonsTab />}
        {activeTab === "spam" && <SpamTab />}
      </div>
    </div>
  );
}
