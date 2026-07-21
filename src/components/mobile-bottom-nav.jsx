import { Link, useLocation } from "react-router-dom";
import { bottomNavItems } from "@/components/app-shared";

export function MobileBottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border)] bg-[#131113]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      <div className="flex min-h-14 items-center justify-around px-1 sm:px-2">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex min-h-12 min-w-14 flex-col items-center justify-center gap-0.5 rounded-[10px] px-2 py-1.5 transition-colors ${
                isActive ? "bg-[var(--accent-mint)]/12 text-[var(--accent-mint)]" : "text-[var(--text-muted)]"
              }`}
            >
              <Icon className="size-5" strokeWidth={isActive ? 2 : 1.5} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
