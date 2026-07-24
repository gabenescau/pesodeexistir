import * as Icons from "lucide-react";
import { useData } from "../data/DataContext";
import { VARIANTS } from "@/components/ui/achievement-badge";
import { summarizeAchievements } from "@/lib/achievements";

// Versao leve do badge para o feed: uma pilula com a cor e o icone do titulo
// atual do usuario. O badge holografico completo fica no perfil; aqui, em cada
// post e comentario (dentro e fora dos livros), mostramos so o titulo.
export function UserTitlePill({ userId, className = "" }) {
  const { getUserMetrics } = useData();
  if (!userId) return null;

  const { currentTitle } = summarizeAchievements(getUserMetrics(userId));
  if (!currentTitle) return null;

  const [base, border] = VARIANTS[currentTitle.variant] || VARIANTS.gold;
  const Icon = Icons[currentTitle.icon] || Icons.Sparkles;

  // Cor do texto = tom saturado da variante (le bem no tema escuro e claro);
  // fundo = mesmo tom em alfa baixo.
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none ${className}`}
      style={{ backgroundColor: `${base}1f`, borderColor: `${border}66`, color: border }}
      title={currentTitle.desc}
    >
      <Icon className="size-2.5" strokeWidth={2.4} />
      {currentTitle.title}
    </span>
  );
}
