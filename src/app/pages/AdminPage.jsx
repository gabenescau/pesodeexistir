import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../data/AuthContext";
import { useData } from "../data/DataContext";
import { isSupabaseReady, supabase } from "../data/supabase";
import { Plus, Trash2, Edit3, Check, Crown, BookOpen, Users, MessageSquare, ShieldAlert, Sparkles, FolderOpen, RefreshCw, ArrowUpDown, ChartLine, Gift, Truck, Flag, Wallet, Package } from "@/lib/icons";
import { isActiveSubscription, pickCurrentSubscription } from "@/lib/subscription";
import {
  LIBRARY_BUCKETS,
  removeLibraryFile,
  uploadLibraryFile,
  validateLibraryFile,
} from "@/lib/library-media";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DatePicker } from "@/components/ui/date-picker";
import { BarChart, DonutChart, LineChart } from "@/components/ui/chart";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { useRewards } from "@/app/data/RewardsContext";

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
  const { addCredits } = useRewards();
  const [durationByUser, setDurationByUser] = useState({});
  const [planByUser, setPlanByUser] = useState({});
  const [savingUser, setSavingUser] = useState(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(profiles.length / pageSize));
  const visibleProfiles = profiles.slice((page - 1) * pageSize, page * pageSize);

  // Credit management modal state
  const [creditModal, setCreditModal] = useState(null); // { profile }
  const [creditAmount, setCreditAmount] = useState("100");
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditError, setCreditError] = useState("");

  async function handleAddCredits() {
    if (!creditModal) return;
    const amount = parseInt(creditAmount, 10);
    if (isNaN(amount) || amount === 0) { setCreditError("Informe um valor válido."); return; }
    setCreditLoading(true);
    setCreditError("");
    try {
      // Update localStorage for simulated credits
      const key = `ope_credits_${creditModal.profile.id}`;
      const current = parseInt(localStorage.getItem(key) || "0", 10);
      const next = Math.max(0, current + amount);
      localStorage.setItem(key, String(next));
      // If this user is the logged-in user, update context too
      addCredits(amount);
      setCreditModal(null);
    } catch (e) {
      setCreditError(e?.message || "Erro ao adicionar créditos.");
    } finally {
      setCreditLoading(false);
    }
  }

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

      {/* Modal de Créditos */}
      {creditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setCreditModal(null)}>
          <div className="w-full max-w-sm rounded-[16px] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-5">
              <div className="flex items-center gap-3 mb-1">
                <div className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-[var(--hover-overlay)] text-sm font-bold text-[var(--text-primary)]">
                  {creditModal.profile.avatar?.startsWith("http") ? (
                    <img src={creditModal.profile.avatar} className="h-full w-full object-cover" alt="" />
                  ) : (creditModal.profile.name?.charAt(0) || "U").toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{creditModal.profile.name || "Usuário"}</p>
                  <p className="text-xs text-[var(--text-muted)]">{creditModal.profile.email}</p>
                </div>
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)] mt-3">Gerenciar Créditos</h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Use valores positivos para adicionar e negativos para remover créditos.</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCreditAmount(v => String((parseInt(v,10)||0) - 50))}
                  className="size-9 flex items-center justify-center rounded-[8px] border border-[var(--border)] text-lg font-bold text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] transition-colors"
                >-</button>
                <div className="relative flex-1">
                  <input
                    type="number"
                    value={creditAmount}
                    onChange={e => { setCreditAmount(e.target.value); setCreditError(""); }}
                    className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--bg-canvas)] px-4 py-2.5 text-center text-lg font-bold text-[var(--text-primary)] focus:outline-none focus:border-blue-500/60"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] pointer-events-none">créd.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCreditAmount(v => String((parseInt(v,10)||0) + 50))}
                  className="size-9 flex items-center justify-center rounded-[8px] border border-[var(--border)] text-lg font-bold text-[var(--text-primary)] hover:bg-[var(--hover-overlay)] transition-colors"
                >+</button>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {[100, 250, 500, 1000].map(v => (
                  <button key={v} type="button" onClick={() => setCreditAmount(String(v))}
                    className={`rounded-[8px] border py-1.5 text-xs font-semibold transition-colors ${
                      creditAmount === String(v)
                        ? "border-blue-500/60 bg-blue-500/10 text-blue-400"
                        : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]"
                    }`}>
                    +{v}
                  </button>
                ))}
              </div>

              {creditError && <p className="text-xs text-red-400">{creditError}</p>}
            </div>

            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setCreditModal(null)}
                className="flex-1 rounded-[10px] border border-[var(--border)] py-2.5 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] transition-colors">
                Cancelar
              </button>
              <button type="button" onClick={handleAddCredits} disabled={creditLoading}
                className="flex-1 rounded-[10px] bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-50">
                {creditLoading ? "Salvando..." : (parseInt(creditAmount,10) >= 0 ? "Adicionar" : "Remover")}
              </button>
            </div>
          </div>
        </div>
      )}

      <Table variant="card" className="min-w-[940px]">
        <TableHeader>
          <TableRow>
            <TableHead>Usuário</TableHead>
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
                      <button
                        type="button"
                        onClick={() => { setCreditModal({ profile }); setCreditAmount("100"); setCreditError(""); }}
                        className="rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/20 transition-colors"
                      >
                        Créditos
                      </button>
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
      const [redResult, prodResult, profResult] = await Promise.all([
        supabase.from("shop_redemptions").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("shop_products").select("id, name, category, credits_cost"),
        supabase.from("profiles").select("id, name, email, username, avatar"),
      ]);
      if (redResult.error) throw redResult.error;
      if (prodResult.error) throw prodResult.error;
      if (profResult.error) throw profResult.error;
      setRedemptions(redResult.data || []);
      setProductsById(Object.fromEntries((prodResult.data || []).map((p) => [p.id, p])));
      setProfilesById(Object.fromEntries((profResult.data || []).map((p) => [p.id, p])));
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
const PRODUCT_CATEGORIES = ["book", "book_premium", "boxes", "oversized", "hoodie"];

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
    image_url: "",
    images: [],
    external_sku: "",
    active: true,
  };
  const [form, setForm] = useState(INITIAL_FORM);
  const [newImageUrl, setNewImageUrl] = useState("");
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
            credits_cost: 120,
            real_price: 0,
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
            credits_cost: 250,
            real_price: 0,
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
            credits_cost: 300,
            real_price: 0,
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
            credits_cost: 200,
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
            credits_cost: 350,
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
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase.from("shop_products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setProducts(data || []);
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
      image_url: currentImages[0] || null,
      images: currentImages,
      external_sku: form.external_sku.trim() || null,
      active: Boolean(form.active),
    };
    if (!payload.name) { setError("Informe o nome do produto."); return; }

    if (!isSupabaseReady()) {
      let local = [];
      try {
        const stored = localStorage.getItem("ope_shop_products_dev");
        if (stored) local = JSON.parse(stored);
      } catch {}
      if (editingId) {
        local = local.map((p) => p.id === editingId ? { ...p, ...payload } : p);
      } else {
        const newProduct = { ...payload, id: `prod-${Date.now()}`, created_at: new Date().toISOString() };
        local.unshift(newProduct);
      }
      localStorage.setItem("ope_shop_products_dev", JSON.stringify(local));
      setForm(INITIAL_FORM);
      setEditingId(null);
      await load();
      return;
    }

    try {
      if (editingId) {
        const { error } = await supabase.from("shop_products").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("shop_products").insert(payload);
        if (error) throw error;
      }
      setForm(INITIAL_FORM);
      setEditingId(null);
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
      image_url: product.image_url || "",
      images: productImages,
      external_sku: product.external_sku || "",
      active: product.active !== false,
    });
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
            {PRODUCT_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <input className={inputClass} placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input className={inputClass} type="number" min="1" placeholder="Custo em créditos" value={form.credits_cost} onChange={(e) => setForm({ ...form, credits_cost: e.target.value })} />
          <input className={inputClass} type="number" min="0" step="0.01" placeholder="Preço em R$ (opcional, ex: 189.90)" value={form.real_price} onChange={(e) => setForm({ ...form, real_price: e.target.value })} />
          <input className={inputClass} type="number" min="0" step="0.5" placeholder="Mínimo de meses ativo" value={form.min_months_active} onChange={(e) => setForm({ ...form, min_months_active: e.target.value })} />
          <input className={inputClass} placeholder="SKU externo" value={form.external_sku} onChange={(e) => setForm({ ...form, external_sku: e.target.value })} />
        </div>

        {/* Gerenciamento de Multi-imagens */}
        <div className="space-y-2.5 rounded-[8px] border border-[var(--border)] bg-[var(--bg-canvas)] p-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[var(--text-primary)]">
              Imagens do Produto ({form.images?.length || 0})
            </label>
            <span className="text-[11px] text-[var(--text-muted)]">A 1ª imagem será a capa principal</span>
          </div>

          <div className="flex gap-2">
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
          </div>

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

        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Ativo no catálogo
          </label>
          <div className="flex gap-2">
            {editingId && (
              <button type="button" onClick={() => { setEditingId(null); setForm(INITIAL_FORM); }} className="rounded-full border border-[var(--border)] px-4 py-2 text-xs text-[var(--text-secondary)]">
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
                    <td className="py-3 pr-4 text-[var(--text-secondary)]">{p.category}</td>
                    <td className="py-3 pr-4 text-[var(--text-secondary)]">{p.credits_cost}</td>
                    <td className="py-3 pr-4 text-[var(--text-secondary)]">{p.min_months_active}</td>
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
  const [referrals, setReferrals] = useState([
    { id: "ref-1", referrerName: "Gabriel Santos", referrerEmail: "gabriel@ope.club", refereeName: "Lucas Andrade", refereeEmail: "lucas@gmail.com", plan: "Plano Anual", date: "01/08/2026", status: "Em validação" },
    { id: "ref-2", referrerName: "Mariana Costa", referrerEmail: "mariana@gmail.com", refereeName: "Rafael Silveira", refereeEmail: "rafael@gmail.com", plan: "Plano Mensal", date: "05/07/2026", status: "Confirmado" },
    { id: "ref-3", referrerName: "Gabriel Santos", referrerEmail: "gabriel@ope.club", refereeName: "Fernanda Lima", refereeEmail: "fernanda@gmail.com", plan: "Pendente", date: "06/08/2026", status: "Pendente" },
  ]);

  const handleApprove = (id) => {
    setReferrals((prev) => prev.map((r) => (r.id === id ? { ...r, status: "Confirmado" } : r)));
  };

  const handleCancel = (id) => {
    setReferrals((prev) => prev.map((r) => (r.id === id ? { ...r, status: "Cancelado" } : r)));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatCard label="Total de Indicações" value={referrals.length} icon={Users} />
        <StatCard label="Confirmados" value={referrals.filter(r => r.status === "Confirmado").length} icon={Check} />
        <StatCard label="Em Validação" value={referrals.filter(r => r.status === "Em validação").length} icon={RefreshCw} />
        <StatCard label="Pendentes" value={referrals.filter(r => r.status === "Pendente").length} icon={Users} />
      </div>

      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[var(--border)]">
              <TableHead className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">Quem Indicou</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">Quem Entrou</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">Plano</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">Data</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">Status</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-[var(--border)]">
            {referrals.map((r) => (
              <TableRow key={r.id} className="hover:bg-[var(--hover-overlay)] transition-colors">
                <TableCell>
                  <div className="text-sm font-medium text-[var(--text-primary)]">{r.referrerName}</div>
                  <div className="text-xs text-[var(--text-muted)]">{r.referrerEmail}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm font-medium text-[var(--text-primary)]">{r.refereeName}</div>
                  <div className="text-xs text-[var(--text-muted)]">{r.refereeEmail}</div>
                </TableCell>
                <TableCell className="text-sm text-[var(--text-secondary)]">{r.plan}</TableCell>
                <TableCell className="text-xs text-[var(--text-muted)]">{r.date}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-[6px] border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    r.status === "Confirmado"
                      ? "border-[var(--border)] bg-[var(--hover-overlay)] text-[var(--text-primary)]"
                      : "border-[var(--border)] bg-[var(--hover-overlay)] text-[var(--text-muted)]"
                  }`}>
                    {r.status}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {r.status !== "Confirmado" && (
                      <button
                        type="button"
                        onClick={() => handleApprove(r.id)}
                        className="rounded-[8px] bg-[var(--text-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--bg-card)] hover:opacity-90 transition-opacity"
                      >
                        Aprovar
                      </button>
                    )}
                    {r.status !== "Cancelado" && (
                      <button
                        type="button"
                        onClick={() => handleCancel(r.id)}
                        className="rounded-[8px] border border-[var(--border)] bg-[var(--hover-overlay)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SeasonsTab() {
  const [seasons, setSeasons] = useState(() => {
    try {
      const saved = localStorage.getItem("ope_seasons_config");
      return saved ? JSON.parse(saved) : INITIAL_SEASONS_ADMIN;
    } catch {
      return INITIAL_SEASONS_ADMIN;
    }
  });

  const [selectedSeasonId, setSelectedSeasonId] = useState(null);

  const [form, setForm] = useState({
    name: "",
    author: "",
    startDate: "",
    endDate: "",
    coverUrl: "",
    description: "",
  });

  const [prodForm, setProdForm] = useState({
    name: "",
    desc: "",
    credits: "",
    imageUrl: "",
    category: "book",
  });

  const [missionForm, setMissionForm] = useState({
    title: "",
    reward: "+50 XP",
  });

  const saveSeasonsData = (updated) => {
    setSeasons(updated);
    try {
      localStorage.setItem("ope_seasons_config", JSON.stringify(updated));
      window.dispatchEvent(new Event("storage"));
    } catch {}
  };

  const handleToggleStatus = (seasonId) => {
    const updated = seasons.map((s) => {
      if (s.id === seasonId) {
        const nextStatus = s.status === "Ativa" ? "Desativada" : "Ativa";
        return { ...s, status: nextStatus };
      }
      // Se estamos ativando esta, desativar as outras
      return s.status === "Ativa" && seasons.find(x => x.id === seasonId)?.status !== "Ativa"
        ? { ...s, status: "Desativada" }
        : s;
    });
    saveSeasonsData(updated);
  };

  const handleCreateSeason = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const newSeason = {
      id: `season-${Date.now()}`,
      name: form.name.trim(),
      author: form.author.trim() || "Curadoria OPE Club",
      startDate: form.startDate || "01/09/2026",
      endDate: form.endDate || "30/11/2026",
      daysLeft: 30,
      status: "Desativada",
      coverUrl: form.coverUrl.trim() || "https://images.unsplash.com/photo-1519682577862-22b62b24e493?w=1200&q=80",
      description: form.description.trim() || "Nova temporada temática do OPE Club.",
      stats: { xp: "0 XP", credits: "0 Créditos", missions: "0 de 0", position: "-" },
      products: [],
      seasonMissions: [],
      leaderboard: [],
    };
    saveSeasonsData([newSeason, ...seasons]);
    setForm({ name: "", author: "", startDate: "", endDate: "", coverUrl: "", description: "" });
  };

  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId);

  const handleAddProductToSeason = (e) => {
    e.preventDefault();
    if (!selectedSeason || !prodForm.name.trim()) return;
    const newProd = {
      id: `sp-${Date.now()}`,
      name: prodForm.name.trim(),
      desc: prodForm.desc.trim(),
      credits: Number(prodForm.credits) || 100,
      imageUrl: prodForm.imageUrl.trim() || "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&q=80",
      category: prodForm.category,
    };
    const updated = seasons.map((s) =>
      s.id === selectedSeason.id
        ? { ...s, products: [...(s.products || []), newProd] }
        : s
    );
    saveSeasonsData(updated);
    setProdForm({ name: "", desc: "", credits: "", imageUrl: "", category: "book" });
  };

  const handleRemoveProductFromSeason = (prodId) => {
    if (!selectedSeason) return;
    const updated = seasons.map((s) =>
      s.id === selectedSeason.id
        ? { ...s, products: (s.products || []).filter((p) => p.id !== prodId) }
        : s
    );
    saveSeasonsData(updated);
  };

  const handleAddMissionToSeason = (e) => {
    e.preventDefault();
    if (!selectedSeason || !missionForm.title.trim()) return;
    const newMission = {
      id: `sm-${Date.now()}`,
      title: missionForm.title.trim(),
      reward: missionForm.reward.trim() || "+50 XP",
      completed: false,
    };
    const updated = seasons.map((s) =>
      s.id === selectedSeason.id
        ? { ...s, seasonMissions: [...(s.seasonMissions || []), newMission] }
        : s
    );
    saveSeasonsData(updated);
    setMissionForm({ title: "", reward: "+50 XP" });
  };

  const handleRemoveMissionFromSeason = (missionId) => {
    if (!selectedSeason) return;
    const updated = seasons.map((s) =>
      s.id === selectedSeason.id
        ? { ...s, seasonMissions: (s.seasonMissions || []).filter((m) => m.id !== missionId) }
        : s
    );
    saveSeasonsData(updated);
  };

  return (
    <div className="space-y-6">
      {/* Formulário de Criação de Season */}
      <form onSubmit={handleCreateSeason} className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Criar Nova Season</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)]"
            placeholder="Nome da Season (ex: Season 1 Bukowski)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)]"
            placeholder="Autor / Curadoria da Season"
            value={form.author}
            onChange={(e) => setForm({ ...form, author: e.target.value })}
          />
          <input
            type="date"
            className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
          <input
            type="date"
            className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
          />
          <input
            className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)] sm:col-span-2"
            placeholder="URL da Imagem de Banner da Season"
            value={form.coverUrl}
            onChange={(e) => setForm({ ...form, coverUrl: e.target.value })}
          />
          <input
            className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)] sm:col-span-2"
            placeholder="Descrição resumida da Season"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <button
          type="submit"
          className="rounded-[8px] bg-[var(--text-primary)] px-4 py-2 text-xs font-semibold text-[var(--bg-card)] hover:opacity-90 transition-opacity"
        >
          Criar Season
        </button>
      </form>

      {/* Tabela de Seasons */}
      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[var(--border)]">
              <TableHead className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">Season</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">Autor</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">Período</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">Produtos Exclusivos</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">Status</TableHead>
              <TableHead className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-[var(--border)]">
            {seasons.map((s) => {
              const isActive = s.status === "Ativa" || s.status === "active";
              const isSelected = s.id === selectedSeasonId;
              return (
                <TableRow key={s.id} className={`hover:bg-[var(--hover-overlay)] transition-colors ${isSelected ? "bg-[var(--hover-overlay)]" : ""}`}>
                  <TableCell className="text-sm font-medium text-[var(--text-primary)]">{s.name}</TableCell>
                  <TableCell className="text-sm text-[var(--text-secondary)]">{s.author}</TableCell>
                  <TableCell className="text-xs text-[var(--text-muted)]">{s.startDate} até {s.endDate}</TableCell>
                  <TableCell className="text-sm text-[var(--text-secondary)]">{(s.products || []).length} itens</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-[6px] border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      isActive
                        ? "border-[var(--border)] bg-[var(--hover-overlay)] text-[var(--text-primary)] font-bold"
                        : "border-[var(--border)] bg-[var(--hover-overlay)] text-[var(--text-muted)]"
                    }`}>
                      {isActive ? "Ativa" : "Desativada"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(s.id)}
                        className={`rounded-[8px] px-3 py-1.5 text-xs font-semibold transition-opacity ${
                          isActive
                            ? "border border-[var(--border)] bg-[var(--hover-overlay)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            : "bg-[var(--text-primary)] text-[var(--bg-card)] hover:opacity-90"
                        }`}
                      >
                        {isActive ? "Desativar" : "Ativar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedSeasonId(isSelected ? null : s.id)}
                        className="rounded-[8px] border border-[var(--border)] bg-[var(--hover-overlay)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
                      >
                        {isSelected ? "Fechar Edição" : "Gerenciar Produtos"}
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Painel de Gerenciamento da Season Selecionada */}
      {selectedSeason && (
        <div className="space-y-6 rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Gerenciando Evento Especial</p>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">{selectedSeason.name}</h3>
            </div>
            <span className={`inline-flex items-center rounded-[6px] border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              selectedSeason.status === "Ativa" ? "border-[var(--border)] bg-[var(--hover-overlay)] text-[var(--text-primary)]" : "border-[var(--border)] bg-[var(--hover-overlay)] text-[var(--text-muted)]"
            }`}>
              {selectedSeason.status === "Ativa" ? "Exibindo para os Membros" : "Desativada (Oculta)"}
            </span>
          </div>

          {/* Seção 1: Produtos Exclusivos da Season */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">Produtos Exclusivos da Season</h4>
              <span className="text-xs text-[var(--text-muted)]">{(selectedSeason.products || []).length} produtos vinculados</span>
            </div>

            {/* Grid dos produtos com imagem retangular vertical */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(selectedSeason.products || []).map((prod) => (
                <div key={prod.id} className="flex gap-3 rounded-[8px] border border-[var(--border)] bg-[var(--bg-canvas)] p-3 items-center">
                  <div className="w-12 h-16 shrink-0 overflow-hidden rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)]">
                    <img src={prod.imageUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{prod.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{prod.credits} créditos</p>
                    <span className="text-[10px] uppercase text-[var(--text-muted)]">{prod.category}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveProductFromSeason(prod.id)}
                    className="rounded-full border border-[var(--border)] p-1.5 text-[var(--text-muted)] hover:text-red-400 transition-colors shrink-0"
                    title="Remover produto da Season"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
              {(!selectedSeason.products || selectedSeason.products.length === 0) && (
                <p className="col-span-full py-4 text-center text-xs text-[var(--text-muted)]">Nenhum produto cadastrado nesta Season.</p>
              )}
            </div>

            {/* Formulário para adicionar produto à Season */}
            <form onSubmit={handleAddProductToSeason} className="rounded-[8px] border border-[var(--border)] bg-[var(--bg-canvas)] p-3 space-y-3">
              <p className="text-xs font-semibold text-[var(--text-primary)]">Adicionar Produto à Season</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  className="rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)]"
                  placeholder="Nome do produto exclusivo"
                  value={prodForm.name}
                  onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                />
                <input
                  type="number"
                  className="rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)]"
                  placeholder="Custo em créditos (ex: 450)"
                  value={prodForm.credits}
                  onChange={(e) => setProdForm({ ...prodForm, credits: e.target.value })}
                />
                <input
                  className="rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)] sm:col-span-2"
                  placeholder="URL da imagem (imagem em formato retangular vertical)"
                  value={prodForm.imageUrl}
                  onChange={(e) => setProdForm({ ...prodForm, imageUrl: e.target.value })}
                />
                <input
                  className="rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)] sm:col-span-2"
                  placeholder="Descrição breve do item"
                  value={prodForm.desc}
                  onChange={(e) => setProdForm({ ...prodForm, desc: e.target.value })}
                />
              </div>
              <button
                type="submit"
                className="rounded-[6px] bg-[var(--text-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--bg-card)] hover:opacity-90 transition-opacity"
              >
                + Adicionar Produto à Season
              </button>
            </form>
          </div>

          {/* Seção 2: Missões da Season */}
          <div className="space-y-3 border-t border-[var(--border)] pt-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">Missões da Season</h4>
              <span className="text-xs text-[var(--text-muted)]">{(selectedSeason.seasonMissions || []).length} missões</span>
            </div>

            <div className="divide-y divide-[var(--border)] rounded-[8px] border border-[var(--border)] bg-[var(--bg-canvas)]">
              {(selectedSeason.seasonMissions || []).map((m) => (
                <div key={m.id} className="flex items-center justify-between px-3 py-2">
                  <div>
                    <p className="text-xs font-medium text-[var(--text-primary)]">{m.title}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">{m.reward}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMissionFromSeason(m.id)}
                      className="text-[var(--text-muted)] hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddMissionToSeason} className="flex gap-2">
              <input
                className="flex-1 rounded-[6px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)]"
                placeholder="Título da missão da season"
                value={missionForm.title}
                onChange={(e) => setMissionForm({ ...missionForm, title: e.target.value })}
              />
              <input
                className="w-28 rounded-[6px] border border-[var(--border)] bg-[var(--bg-canvas)] px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none focus:border-[var(--border-strong)]"
                placeholder="Recompensa (ex: +50 XP)"
                value={missionForm.reward}
                onChange={(e) => setMissionForm({ ...missionForm, reward: e.target.value })}
              />
              <button
                type="submit"
                className="shrink-0 rounded-[6px] border border-[var(--border)] bg-[var(--hover-overlay)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
              >
                + Adicionar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const INITIAL_SEASONS_ADMIN = [
  {
    id: "season-1",
    name: "Season 1 Charles Bukowski",
    author: "Curadoria OPE Club",
    startDate: "01/06/2026",
    endDate: "31/08/2026",
    daysLeft: 24,
    status: "Ativa",
    coverUrl: "https://images.unsplash.com/photo-1519682577862-22b62b24e493?w=1200&q=80",
    description:
      "Uma imersão completa no universo de Bukowski. Conclua missões exclusivas, suba no ranking da temporada e resgate colecionáveis únicos.",
    stats: {
      xp: "1.250 XP",
      credits: "80 Créditos",
      missions: "1 de 3",
      position: "Posição 8",
    },
    products: [
      {
        id: "sp-1",
        name: "Livro Físico Bukowski Edição Especial",
        desc: "Edição especial com tiragem limitada e ilustrações inéditas.",
        credits: 450,
        imageUrl: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&q=80",
        category: "book",
      },
      {
        id: "sp-2",
        name: "Livro Premium Bukowski Collector Box",
        desc: "Encadernação em capa dura especial com estojo rígido e marcador exclusivo.",
        credits: 900,
        imageUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80",
        category: "book_premium",
      },
      {
        id: "sp-3",
        name: "Moletom Bukowski Street Art",
        desc: "Moletom 100% algodão com bordado minimalista da Season 1.",
        credits: 2800,
        imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=400&q=80",
        category: "hoodie",
      },
    ],
    seasonMissions: [
      { id: "sm-1", title: "Leia uma obra de Bukowski", reward: "+50 XP", completed: true },
      { id: "sm-2", title: "Compartilhe uma frase do autor na comunidade", reward: "+30 XP", completed: false },
      { id: "sm-3", title: "Complete o Quiz Bukowski", reward: "+70 XP", completed: false },
    ],
    leaderboard: [
      { position: 1, name: "Ana Lima", xp: "4.200 XP" },
      { position: 2, name: "Pedro Alves", xp: "3.850 XP" },
      { position: 3, name: "Julia Costa", xp: "3.600 XP" },
      { position: 8, name: "Você", xp: "1.250 XP", isCurrentUser: true },
    ],
  },
  {
    id: "season-2",
    name: "Season 2 Fiódor Dostoiévski",
    author: "Equipe Editorial",
    startDate: "01/09/2026",
    endDate: "30/11/2026",
    daysLeft: 90,
    status: "Desativada",
    coverUrl: "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=1200&q=80",
    description: "Uma jornada pelas obras profundas do autor russo.",
    stats: { xp: "0 XP", credits: "0 Créditos", missions: "0 de 5", position: "-" },
    products: [],
    seasonMissions: [],
    leaderboard: [],
  },
];


// ── Aba Créditos ──────────────────────────────────────────────────────────────
const DAILY_MISSIONS = [
  { title: "Entrar no aplicativo", reward: 1 },
  { title: "Ler 30 minutos", reward: 3 },
  { title: "Publicar 1 reflexão", reward: 1 },
  { title: "Comentar em 2 publicações", reward: 1 },
  { title: "Bônus por concluir as 4 missões", reward: 2, isBonus: true },
];

const MOCK_MEMBER_CREDITS = [
  { id: "mc-1", name: "Lucas Andrade", email: "lucas@gmail.com", credits: 320, streak: 22, daysInClub: 45, totalEarned: 520, totalSpent: 200, plan: "Anual" },
  { id: "mc-2", name: "Mariana Costa", email: "mariana@gmail.com", credits: 150, streak: 7, daysInClub: 90, totalEarned: 900, totalSpent: 750, plan: "Mensal" },
  { id: "mc-3", name: "Rafael Silveira", email: "rafael@gmail.com", credits: 0, streak: 0, daysInClub: 3, totalEarned: 24, totalSpent: 0, plan: "Conta" },
  { id: "mc-4", name: "Gabriel Santos", email: "gabriel@ope.club", credits: 1200, streak: 60, daysInClub: 180, totalEarned: 4800, totalSpent: 3600, plan: "Anual" },
];

function CreditsTab() {
  const { profiles, subscriptions } = useData();
  const { addCredits } = useRewards();

  // Combina profiles reais com mock de créditos (por email) para demonstração
  const memberRows = useMemo(() => {
    return profiles.map((p) => {
      const mock = MOCK_MEMBER_CREDITS.find((m) => m.email === p.email) || {};
      const sub = pickCurrentSubscription(subscriptions, p.id);
      const active = isActiveSubscription(sub);
      const joinedDate = p.created_at ? new Date(p.created_at) : null;
      const daysInClub = joinedDate
        ? Math.floor((Date.now() - joinedDate.getTime()) / (1000 * 60 * 60 * 24))
        : (mock.daysInClub ?? 0);
      return {
        id: p.id,
        name: p.name || "Sem nome",
        email: p.email || "Sem email",
        avatar: p.avatar,
        credits: mock.credits ?? 0,
        streak: mock.streak ?? 0,
        daysInClub,
        totalEarned: mock.totalEarned ?? 0,
        totalSpent: mock.totalSpent ?? 0,
        plan: active ? (sub?.plan === "ope_club_annual" ? "Anual" : "Mensal") : "Sem plano",
        active,
      };
    });
  }, [profiles, subscriptions]);

  // Fallback: se não há profiles, mostrar os mocks
  const rows = memberRows.length > 0 ? memberRows : MOCK_MEMBER_CREDITS.map((m) => ({ ...m, active: m.plan === "Anual" || m.plan === "Mensal" }));

  const totalCreditsInSystem = rows.reduce((s, r) => s + (r.credits || 0), 0);
  const totalEarnedSystem = rows.reduce((s, r) => s + (r.totalEarned || 0), 0);
  const totalSpentSystem = rows.reduce((s, r) => s + (r.totalSpent || 0), 0);
  const activeMembers = rows.filter((r) => r.active).length;

  return (
    <div className="space-y-6">

      {/* Banner de Simulação */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-[12px] border border-blue-500/30 bg-blue-500/10 p-4">
        <div>
          <h4 className="text-sm font-bold text-blue-400">Simulador de Créditos da Loja</h4>
          <p className="text-xs text-[var(--text-muted)]">Adicione créditos à sua conta atual para testar o checkout da loja.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            addCredits(10000);
            alert("✓ 10.000 Créditos adicionados com sucesso à sua conta para teste!");
          }}
          className="shrink-0 rounded-[8px] bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 transition-colors shadow-sm"
        >
          + 10.000 Créditos na minha conta
        </button>
      </div>

      {/* StatCards de Créditos */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Créditos em Circulação</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{totalCreditsInSystem.toLocaleString("pt-BR")}</p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">saldo total dos membros</p>
        </div>
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Total Emitido</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{totalEarnedSystem.toLocaleString("pt-BR")}</p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">créditos ganhos no total</p>
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
            <p className="text-xs text-[var(--text-muted)]">{rows.length} membros • detalhes de engajamento e créditos</p>
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
                <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">Ofensiva</th>
                <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">Saldo Atual</th>
                <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">Total Ganho</th>
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
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{member.streak}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">dias seguidos</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm font-bold text-[var(--text-primary)]">{(member.credits || 0).toLocaleString("pt-BR")}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">créditos</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm text-[var(--text-primary)]">{(member.totalEarned || 0).toLocaleString("pt-BR")}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-sm text-[var(--text-primary)]">{(member.totalSpent || 0).toLocaleString("pt-BR")}</p>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">Nenhum membro cadastrado ainda.</td>
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
  const [rawOrders, setRawOrders] = useState(() => {
    try {
      const saved = localStorage.getItem("ope_orders");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        id: "order-sample-1",
        productName: "Camiseta Oversized OPE Club",
        productCategory: "oversized",
        paymentMethod: "credits",
        creditsCost: 200,
        realPrice: null,
        customer: { name: "Gabriel Santos", email: "gabriel@ope.club", phone: "(71) 99963-6112" },
        address: { street: "Av. Sete de Setembro", number: "1420", neighborhood: "Vitória", city: "Salvador", state: "BA", cep: "40080-002" },
        status: "pending",
        createdAt: new Date().toISOString(),
      },
      {
        id: "order-sample-2",
        productName: "Moletom Street OPE Club",
        productCategory: "hoodie",
        paymentMethod: "credits",
        creditsCost: 350,
        realPrice: null,
        customer: { name: "Bruna Lima", email: "bruna@gmail.com", phone: "(11) 95294-6599" },
        address: { street: "Rua Augusta", number: "500", neighborhood: "Consolação", city: "São Paulo", state: "SP", cep: "01305-000" },
        status: "pending",
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      }
    ];
  });

  // Somente as compras no Crédito OPE vão para o Painel Admin
  const orders = useMemo(
    () => rawOrders.filter((o) => o.paymentMethod === "credits" || (o.creditsCost && o.creditsCost > 0)),
    [rawOrders]
  );

  const updateOrderStatus = (id, newStatus) => {
    const updated = rawOrders.map((o) => (o.id === id ? { ...o, status: newStatus } : o));
    setRawOrders(updated);
    try { localStorage.setItem("ope_orders", JSON.stringify(updated)); } catch {}
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
            {orders.map((o) => (
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
        {activeTab === "subscriptions" && <SubscriptionsTab />}
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
