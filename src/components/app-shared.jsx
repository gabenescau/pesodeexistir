import { useMemo } from "react";
import {
  BookOpenIcon,
  Bookmark,
  CompassIcon,
  Gift,
  HomeIcon,
  LightbulbIcon,
  ShieldIcon,
  Sparkles,
  Trophy,
  UserIcon,
  Users,
  Truck,
  HelpCircleIcon,
  MagnifyingGlass,
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
    label: "Navegação",
    items: [
      { title: "Comunidade", path: "/app/inicio", icon: <HomeIcon />, match: "/app/inicio" },
      {
        title: "Biblioteca",
        path: "/app/biblioteca",
        icon: <BookOpenIcon />,
        match: "/app/biblioteca",
        subItems: [
          { title: "Livros", path: "/app/biblioteca", icon: <BookOpenIcon />, match: "/app/biblioteca" },
          { title: "Autores", path: "/app/autores", icon: <UserIcon />, match: "/app/autores" },
          { title: "Minha Lista", path: "/app/minha-lista", icon: <Bookmark />, match: "/app/minha-lista" },
        ],
      },
      { title: "Explorar", path: "/app/explorar", icon: <CompassIcon />, match: "/app/explorar" },
      { title: "Ranking Mensal", path: "/app/ranking", icon: <Trophy />, match: "/app/ranking" },
      { title: "Sugestões", path: "/app/sugestoes", icon: <LightbulbIcon />, match: "/app/sugestoes" },
      { title: "Loja", path: "/app/loja", icon: <Gift />, match: "/app/loja" },
      { title: "Missões Diárias", path: "/app/missoes", icon: <Sparkles />, match: "/app/missoes" },
      { title: "Meus Resgates", path: "/app/meus-resgates", icon: <Truck />, match: "/app/meus-resgates" },
      { title: "Indicações", path: "/app/indicacoes", icon: <Users />, match: "/app/indicacoes" },
      { title: "Seasons", path: "/app/seasons", icon: <Sparkles />, match: "/app/seasons" },
      { title: "Suporte", path: "/app/suporte", icon: <HelpCircleIcon />, match: "/app/suporte" },
    ],
  },
  {
    label: "Novidades",
    items: [
      { title: "Lançamentos Semanais", path: "/app/lancamentos", icon: <Sparkles />, match: "/app/lancamentos" },
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
  { label: "Feed", path: "/app/inicio", icon: HomeIcon },
  { label: "Explorar", path: "/app/explorar", icon: MagnifyingGlass },
  { label: "Loja", path: "/app/loja", icon: Gift },
  { label: "Biblioteca", path: "/app/biblioteca", icon: BookOpenIcon },
  { label: "Conta", path: "/app/configuracoes", icon: UserIcon },
];
