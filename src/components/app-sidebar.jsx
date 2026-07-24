import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { footerNavLinks, navGroups, adminGroup } from "@/components/app-shared";
import { NavGroup } from "@/components/nav-group";
import { useAuth } from "@/app/data/AuthContext";

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, logout } = useAuth();

  const groups = isAdmin
    ? [...navGroups, adminGroup]
    : navGroups;

  async function handleLogout() {
    await logout();
    navigate("/entrar", { replace: true });
  }

  return (
    <Sidebar
      className={cn(
        "border-r-transparent! *:data-[slot=sidebar-inner]:bg-[var(--bg-card)]",
        "**:data-[slot=sidebar-menu-button]:[&>span]:text-[var(--text-secondary)]"
      )}
      collapsible="icon"
      variant="sidebar"
    >
      <SidebarHeader className="h-14 justify-center px-2">
        <SidebarMenuButton render={<Link to="/app/inicio" />}>
          <Logo className="text-[20px] text-[var(--text-primary)]!" />
        </SidebarMenuButton>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group, index) => (
          <NavGroup key={`sidebar-group-${index}`} {...group} />
        ))}
      </SidebarContent>
      <SidebarFooter className="gap-0 p-0">
        <SidebarMenu className="p-2">
          {footerNavLinks.map((item) => {
            const isActive = location.pathname === item.match;
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  className="text-muted-foreground"
                  isActive={isActive}
                  size="sm"
                  render={<Link to={item.path} />}
                >
                  {item.icon}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
          <SidebarMenuItem>
            <SidebarMenuButton
              className="text-muted-foreground"
              size="sm"
              onClick={handleLogout}
            >
              <LogOut className="size-4" />
              <span>Sair da conta</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
