import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../data/AuthContext";
import { useData } from "../data/DataContext";
import { isSupabaseReady } from "../data/supabase";
import { Plus, Trash2, Edit3, Check, Crown, BookOpen, Users, MessageSquare, ShieldAlert, Sparkles, FolderOpen, RefreshCw, ArrowUpDown, ChartLine } from "@/lib/icons";
import { isActiveSubscription, pickCurrentSubscription } from "@/lib/subscription";
import {
  LIBRARY_BUCKETS,
  removeLibraryFile,
  uploadLibraryFile,
  validateLibraryFile,
} from "@/lib/library-media";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DatePicker } from "@/components/ui/date-picker";
import { BarChart, DonutChart, LineChart } from "@/components/ui/chart";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: ChartLine },
  { id: "users", label: "UsuÃ¡rios", icon: Users },
  { id: "subscriptions", label: "Assinaturas", icon: Crown },
  { id: "posts", label: "Posts", icon: MessageSquare },
  { id: "releases", label: "LanÃ§amentos", icon: Sparkles },
  { id: "categories", label: "Categorias", icon: FolderOpen },
  { id: "books", label: "Livros", icon: BookOpen },
  { id: "authors", label: "Autores", icon: Users },
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
  const { books, authors, posts, profiles, subscriptions, weeklyReleases, categories, bookFavorites, authorFavorites, savedPostIds, myCounts } = useData();

  const totalUsers = profiles.length;
  const totalBooks = books.length;
  const totalAuthors = authors.length;
  const totalPosts = posts.length;
  const totalSubs = subscriptions.length;
  const monthlySubs = subscriptions.filter((sub) => sub.plan === "ope_club_monthly").length;
  const annualSubs = subscriptions.filter((sub) => sub.plan === "ope_club_annual").length;
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
        <StatCard label="Posts" value={totalPosts} hint={`${engagement.totalLikes} curtidas Â· ${engagement.totalReplies} respostas`} icon={MessageSquare} />
        <StatCard label="Assinaturas" value={totalSubs} hint={`${monthlySubs} mensal Â· ${annualSubs} anual`} icon={Crown} />
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
  const { subscriptions, cancelSubscription, changeSubscriptionPlan, syncSubscription } = useData();
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
                <td className="py-3 pr-4 text-[var(--text-primary)]">{s.plan || "OPE Club"}</td>
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
                  {s.metadata?.pending_plan
                    ? `${s.metadata.pending_plan === "ope_club_annual" ? "Anual" : "Mensal"} no proximo ciclo`
                    : "-"}
                </td>
                <td className="py-3">
                  <div className="flex items-center justify-end gap-1">
                    {s.provider === "abacatepay" && (
                      <button
                        type="button"
                        title="Sincronizar com AbacatePay"
                        disabled={working === `sync-${s.id}`}
                        onClick={() => run(`sync-${s.id}`, () => syncSubscription(s.id))}
                        className="flex size-8 items-center justify-center rounded-[6px] text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)] disabled:opacity-50"
                      >
                        <RefreshCw className={`size-4 ${working === `sync-${s.id}` ? "animate-spin" : ""}`} />
                      </button>
                    )}
                    {s.provider === "abacatepay" && s.status === "active" && (
                      <button
                        type="button"
                        title={s.plan === "ope_club_annual" ? "Downgrade para mensal" : "Upgrade para anual"}
                        disabled={working === `plan-${s.id}`}
                        onClick={() => run(
                          `plan-${s.id}`,
                          () => changeSubscriptionPlan(s.id, s.plan === "ope_club_annual" ? "monthly" : "annual")
                        )}
                        className="flex size-8 items-center justify-center rounded-[6px] text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)] disabled:opacity-50"
                      >
                        <ArrowUpDown className="size-4" />
                      </button>
                    )}
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
        plan: planByUser[profile.id] || "ope_club_monthly",
        status: "active",
        durationDays: durationByUser[profile.id] || 30,
      });
    } catch (err) {
      setError(err?.message || "Nao foi possivel adicionar o plano.");
    } finally {
      setSavingUser(null);
    }
  }

  async function remove(profile) {
    setSavingUser(profile.id);
    setError("");
    try {
      await removeUserSubscription(profile.id);
    } catch (err) {
      setError(err?.message || "Nao foi possivel remover o plano.");
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
    } catch (err) {
      setError(err?.message || "Nao foi possivel alterar os dias.");
    } finally {
      setSavingUser(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">{profiles.length} usuarios cadastrados</p>
        <span className="text-xs text-[var(--text-muted)]">Pagina {page} de {totalPages}</span>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}

      <Table variant="card" className="min-w-[940px]">
        <TableHeader>
          <TableRow>
            <TableHead>Usuario</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Cargo</TableHead>
            <TableHead>Plano</TableHead>
            <TableHead>Expira em</TableHead>
            <TableHead>Plano manual</TableHead>
            <TableHead>Dias</TableHead>
            <TableHead className="w-0 text-right">Acoes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleProfiles.map((profile) => {
              const sub = getSub(profile.id);
              const active = isActiveSubscription(sub);
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
                  <TableCell>{profile.role || "user"}</TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-[var(--accent-mint)]/10 text-[var(--accent-mint)]" : "bg-[var(--hover-overlay)] text-[var(--text-muted)]"}`}>
                      {active ? "Ativo" : sub?.status || "Sem plano"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("pt-BR") : "-"}
                  </TableCell>
                  <TableCell>
                    <select
                      value={planByUser[profile.id] || "ope_club_monthly"}
                      onChange={(e) => setPlanByUser((prev) => ({ ...prev, [profile.id]: e.target.value }))}
                      disabled={sub?.provider === "abacatepay" && active}
                      className="rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-primary)] disabled:opacity-50"
                    >
                      <option value="ope_club_monthly">Mensal</option>
                      <option value="ope_club_annual">Anual</option>
                    </select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                    <select
                      value={durationByUser[profile.id] || 30}
                      onChange={(e) => setDurationByUser((prev) => ({ ...prev, [profile.id]: Number(e.target.value) }))}
                      disabled={sub?.provider === "abacatepay" && active}
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
                        className="rounded-[6px] border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-primary)] disabled:opacity-50"
                      >
                        Definir
                      </button>
                    )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {!(sub?.provider === "abacatepay" && active) && <button
                        onClick={() => activate(profile)}
                        disabled={savingUser === profile.id}
                        className="rounded-full bg-[var(--text-primary)] px-3 py-1.5 text-xs font-medium text-[var(--bg-card)] disabled:opacity-50"
                      >
                        {active ? "Adicionar dias" : "Adicionar plano"}
                      </button>}
                      {active && (
                        <button
                          onClick={() => remove(profile)}
                          disabled={savingUser === profile.id}
                          className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-red-400 disabled:opacity-50"
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
      setError(err?.message || "NÃ£o foi possÃ­vel salvar o lanÃ§amento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Novo lanÃ§amento semanal</h3>
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
          <FormField label="ObservaÃ§Ã£o" value={form.note} onChange={(value) => setForm((prev) => ({ ...prev, note: value }))} placeholder="Ex: estreia de sexta" />
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !form.bookId || !form.releaseDate}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-card)] disabled:opacity-50"
        >
          <Plus className="size-4" /> {saving ? "Salvando..." : "Adicionar lanÃ§amento"}
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
                {release.visible === false ? "Oculto" : "VisÃ­vel"}
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
      setError(err?.message || "PDF invÃ¡lido.");
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
      setError(err?.message || "Imagem invÃ¡lida.");
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
      if (!isSupabaseReady()) throw new Error("Supabase nÃ£o configurado.");

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
      setError(err?.message || "NÃ£o foi possÃ­vel salvar o livro. Confira as permissÃµes no Supabase.");
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
      setError(err?.message || "NÃ£o foi possÃ­vel remover o livro.");
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
            <FormField label="TÃ­tulo" value={form.title} onChange={v => setForm(p => ({ ...p, title: v }))} placeholder="Crime e Castigo" />
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
              <p className="text-[10px] text-[var(--text-muted)] mt-1">O PDF serÃ¡ enviado ao Supabase Storage e aberto dentro do app.</p>
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
      setError(err?.message || "Imagem invÃ¡lida.");
      event.target.value = "";
    }
  }

  async function handleSave() {
    if (!form.name.trim() || saving) return;
    setError("");
    setSaving(true);
    let uploadedImagePath = "";

    try {
      if (!isSupabaseReady()) throw new Error("Supabase nÃ£o configurado.");
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
      setError(err?.message || "NÃ£o foi possÃ­vel salvar o autor. Confira as permissÃµes no Supabase.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(author) {
    const ok = await confirm.ask({
      title: "Remover autor?",
      description: `Remover "${author.name}" do banco? Os livros continuarÃ£o cadastrados sem autor.`,
      confirmLabel: "Remover",
      danger: true,
    });
    if (!ok) return;
    setError("");
    try {
      await deleteAuthor(author.id);
    } catch (err) {
      setError(err?.message || "NÃ£o foi possÃ­vel remover o autor.");
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
            <FormField label="Ã‰poca" value={form.era} onChange={v => setForm(p => ({ ...p, era: v }))} placeholder="sÃ©culo XIX" />
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
              <textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} placeholder="Frase ou biografia curta que aparece na pÃ¡gina do autor..." rows={3}
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
                    <p className="text-xs text-[var(--text-muted)]">{author.theme} Â· {author.era}</p>
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
    if (!nome.trim()) return;
    setErro("");
    try { await addCategory(nome.trim()); setNome(""); }
    catch (err) { setErro(err?.message || "Erro ao criar categoria."); }
  }

  async function handleSalvarEdicao() {
    if (!editNome.trim() || !editando) return;
    setErro("");
    try { await updateCategory(editando.id, { name: editNome.trim() }); setEditando(null); setEditNome(""); }
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
          Apenas administradores podem acessar o painel. Se vocÃª Ã© admin, certifique-se de que sua conta tem a permissÃ£o correta.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">Admin</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Gerencie usuÃ¡rios, assinaturas, posts, livros e autores.</p>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-[var(--border)]" style={{ scrollbarWidth: "none" }}>
        {allowedTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 shrink-0 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                isActive ? "text-[var(--text-primary)] border-[var(--text-primary)]" : "text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]"
              }`}>
              <Icon className="size-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div>
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "users" && <UsersTab />}
        {activeTab === "subscriptions" && <SubscriptionsTab />}
        {activeTab === "posts" && <PostsTab />}
        {activeTab === "releases" && <WeeklyReleasesTab />}
        {activeTab === "categories" && <CategoriesTab />}
        {activeTab === "books" && <BooksTab />}
        {activeTab === "authors" && <AuthorsTab />}
      </div>
    </div>
  );
}
