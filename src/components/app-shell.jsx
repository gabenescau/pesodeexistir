import { TopNavbar } from "@/components/top-navbar";

export function AppShell({ children }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopNavbar />
      <div className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-5 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-5 md:px-7 md:py-7 md:pb-8 lg:px-8 lg:py-8">
        {children}
      </div>
    </div>
  );
}
