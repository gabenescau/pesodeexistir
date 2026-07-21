import { cn } from "@/lib/utils";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";

export function AppShell({ children }) {
  return (
    <SidebarProvider className="app-kirvano">
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <div className={cn("flex flex-1 flex-col w-full")}>
          <div className="mx-auto w-full min-w-0 max-w-7xl px-4 py-5 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-5 md:px-7 md:py-7 md:pb-8 lg:px-8 lg:py-8">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
