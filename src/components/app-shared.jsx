import { useMemo } from "react";
import { HomeIcon, BookOpenIcon, CompassIcon, Sparkles, UserIcon, SettingsIcon, ShieldIcon } from "lucide-react";
import { useData } from "@/app/data/DataContext";

// "Comunidade" foi removido: Início == Comunidade (mesma página,/feed). A rota
// legada /app/comunidade redireciona para /app/inicio no AppShell.
//
// "Lançamentos Semanais" só aparece na navegação quando existem lançamentos
// visíveis (visible=true) ainda não liberados (data futura). Quando a lista
// está vazia ou todos já liberaram, a seção some do menu — nada de prateleira
// vazia.

function hasActiveReleases(weeklyReleases) {
  if (!weeklyReleases || weeklyReleases.length === 0) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return weeklyReleases.some((r) => r.visible !== false && new Date(r.release_date) > hoje);
}

export const navGroups = [
  {
    label: "Navegação",
    items: [
      { title: "Início", path: "/app/inicio", icon: <HomeIcon />, match: "/app/inicio" },
      { title: "Biblioteca", path: "/app/biblioteca", icon: <BookOpenIcon />, match: "/app/biblioteca" },
      { title: "Explorar", path: "/app/explorar", icon: <CompassIcon />, match: "/app/explorar" },
    ],
  },
  {
    label: "Novidades",
    items: [
      { title: "Lançamentos Semanais", path: "/app/lancamentos", icon: <Sparkles />, match: "/app/lancamentos" },
    ],
  },
  {
    label: "Conta",
    items: [
      { title: "Perfil", path: "/app/perfil", icon: <UserIcon />, match: "/app/perfil" },
      { title: "Configurações", path: "/app/configuracoes", icon: <SettingsIcon />, match: "/app/configuracoes" },
    ],
  },
];

// Hook usado pela sidebar real (app-sidebar) e pelo bottom nav. Devolve os
// grupos com Lançamentos ocultos quando não há releases ativos.
export function useNavGroups() {
  const { weeklyReleases } = useData();
  return useMemo(() => {
    if (hasActiveReleases(weeklyReleases)) return navGroups;
    // Sem lançamentos ativos: remove o grupo "Novidades" inteiro.
    return navGroups.filter((g) => g.label !== "Novidades");
  }, [weeklyReleases]);
}

export const adminGroup = {
  label: "Administração",
  items: [
    { title: "Painel Admin", path: "/app/admin", icon: <ShieldIcon />, match: "/app/admin" },
  ],
};

export const footerNavLinks = [];

export const navLinks = [
  ...navGroups.flatMap((group) =>
    group.items.flatMap((item) =>
      item.subItems?.length ? [item, ...item.subItems] : [item]
    )
  ),
  ...footerNavLinks,
];

export const bottomNavItems = [
  { label: "Início", path: "/app/inicio", icon: HomeIcon },
  { label: "Biblioteca", path: "/app/biblioteca", icon: BookOpenIcon },
  { label: "Explorar", path: "/app/explorar", icon: CompassIcon },
  { label: "Perfil", path: "/app/perfil", icon: UserIcon },
];
