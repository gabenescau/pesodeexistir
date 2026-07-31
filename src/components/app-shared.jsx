import { useMemo } from "react";
import {
  BookOpenIcon,
  CompassIcon,
  CreditCardIcon,
  HomeIcon,
  LightbulbIcon,
  SettingsIcon,
  ShieldIcon,
  Sparkles,
  UserIcon,
} from "@/lib/icons";
import { useData } from "@/app/data/DataContext";

function hasActiveReleases(weeklyReleases) {
  if (!weeklyReleases || weeklyReleases.length === 0) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return weeklyReleases.some((release) => release.visible !== false && new Date(release.release_date) > today);
}

export const navGroups = [
  {
    label: "Navegacao",
    items: [
      { title: "Inicio", path: "/app/inicio", icon: <HomeIcon />, match: "/app/inicio" },
      { title: "Biblioteca", path: "/app/biblioteca", icon: <BookOpenIcon />, match: "/app/biblioteca" },
      { title: "Explorar", path: "/app/explorar", icon: <CompassIcon />, match: "/app/explorar" },
      { title: "Sugestoes", path: "/app/sugestoes", icon: <LightbulbIcon />, match: "/app/sugestoes" },
    ],
  },
  {
    label: "Novidades",
    items: [
      { title: "Lancamentos Semanais", path: "/app/lancamentos", icon: <Sparkles />, match: "/app/lancamentos" },
    ],
  },
  {
    label: "Assinatura",
    items: [
      { title: "Planos", path: "/app/planos", icon: <CreditCardIcon />, match: "/app/planos" },
    ],
  },
  {
    label: "Conta",
    items: [
      {
        title: "Configuracoes",
        path: "/app/configuracoes",
        icon: <SettingsIcon />,
        match: "/app/configuracoes",
        subItems: [
          { title: "Geral", path: "/app/configuracoes", icon: <SettingsIcon />, match: "/app/configuracoes" },
          { title: "Perfil", path: "/app/configuracoes?aba=perfil", icon: <UserIcon />, match: "/app/configuracoes?aba=perfil" },
        ],
      },
    ],
  },
];

export function useNavGroups() {
  const { weeklyReleases } = useData();
  return useMemo(() => {
    if (hasActiveReleases(weeklyReleases)) return navGroups;
    return navGroups.filter((group) => group.label !== "Novidades");
  }, [weeklyReleases]);
}

export const adminGroup = {
  label: "Administracao",
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
  { label: "Inicio", path: "/app/inicio", icon: HomeIcon },
  { label: "Biblioteca", path: "/app/biblioteca", icon: BookOpenIcon },
  { label: "Sugestoes", path: "/app/sugestoes", icon: LightbulbIcon },
  { label: "Conta", path: "/app/configuracoes", icon: SettingsIcon },
];
