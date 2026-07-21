import { HomeIcon, MessageCircleIcon, BookOpenIcon, CompassIcon, Sparkles, UserIcon, SettingsIcon, ShieldIcon } from "lucide-react";

export const navGroups = [
  {
    label: "Navegação",
    items: [
      { title: "Início", path: "/app/inicio", icon: <HomeIcon />, match: "/app/inicio" },
      { title: "Comunidade", path: "/app/comunidade", icon: <MessageCircleIcon />, match: "/app/comunidade" },
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
  {
    label: "Administração",
    items: [
      { title: "Painel Admin", path: "/app/admin", icon: <ShieldIcon />, match: "/app/admin" },
    ],
  },
];

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
  { label: "Comunidade", path: "/app/comunidade", icon: MessageCircleIcon },
  { label: "Biblioteca", path: "/app/biblioteca", icon: BookOpenIcon },
  { label: "Explorar", path: "/app/explorar", icon: CompassIcon },
  { label: "Perfil", path: "/app/perfil", icon: UserIcon },
];
