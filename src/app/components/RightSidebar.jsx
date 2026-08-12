import { Coins } from "@/lib/icons";
import { useRewards } from "@/app/data/RewardsContext";
import { useAuth } from "@/app/data/AuthContext";
import { useData } from "@/app/data/DataContext";
import { hasPlanFeature } from "@/lib/entitlements";
import { MissionsWidget } from "./MissionsWidget";
import { ReferralWidget } from "./ReferralWidget";
import { InstallAppWidget } from "./InstallAppWidget";

export function RightSidebar() {
  const { wallet } = useRewards() || {};
  const { isAdmin } = useAuth();
  const { subscription } = useData() || {};
  const canSeeMissions = hasPlanFeature({ isAdmin, subscription, feature: "missions" });

  return (
    <aside className="hidden w-[260px] shrink-0 space-y-5 xl:block xl:sticky xl:top-20">
      {wallet && (
        <section className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Carteira OPE</p>
          <div className="mt-4 flex items-end justify-between gap-3">
            <span className="flex items-center gap-2 text-2xl font-semibold text-[var(--text-primary)]">
              <Coins className="size-5 text-[#c58b42]" /> {Number(wallet.credits || 0).toLocaleString("pt-BR")}
            </span>
            <span className="text-xs text-[var(--text-muted)]">creditos</span>
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">Ganhe creditos participando e use-os na loja.</p>
        </section>
      )}

      {wallet && canSeeMissions && <MissionsWidget />}

      {wallet && <ReferralWidget />}

      <InstallAppWidget />
    </aside>
  );
}
