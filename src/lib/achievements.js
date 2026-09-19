// Conquistas / titulos — 100% dinamicas.
// Nada e gravado como "conquista" no banco: cada objetivo e recalculado a
// partir dos dados que o app ja carrega (livros lidos, posts, seguidores,
// comentarios, reacoes). Assim nao ha estado para dessincronizar, e um novo
// objetivo entra so adicionando uma linha aqui.
//
// `variant` casa com os estilos de cor/icone do AchievementBadge — varios
// visuais, mesmo padrao.

export const ACHIEVEMENTS = [
  {
    id: "primeiro-passo",
    title: "Primeiros Passos",
    desc: "Publicou na comunidade pela primeira vez",
    variant: "bronze",
    icon: "Sparkles",
    metric: "posts",
    goal: 1,
  },
  {
    id: "voz-ativa",
    title: "Voz Ativa",
    desc: "10 publicações na comunidade",
    variant: "amber",
    icon: "MessageCircle",
    metric: "posts",
    goal: 10,
  },
  {
    id: "pensador",
    title: "Pensador",
    desc: "50 publicações na comunidade",
    variant: "violet",
    icon: "Feather",
    metric: "posts",
    goal: 50,
  },
  {
    id: "leitor-iniciante",
    title: "Leitor Iniciante",
    desc: "Começou a ler o primeiro livro",
    variant: "sky",
    icon: "BookOpen",
    metric: "reading",
    goal: 1,
  },
  {
    id: "devorador",
    title: "Devorador de Livros",
    desc: "Concluiu 5 livros",
    variant: "emerald",
    icon: "Library",
    metric: "completed",
    goal: 5,
  },
  {
    id: "erudito",
    title: "Erudito",
    desc: "Concluiu 15 livros",
    variant: "gold",
    icon: "GraduationCap",
    metric: "completed",
    goal: 15,
  },
  {
    id: "querido",
    title: "Querido pela Comunidade",
    desc: "Alcançou 10 seguidores",
    variant: "rose",
    icon: "Heart",
    metric: "followers",
    goal: 10,
  },
  {
    id: "influente",
    title: "Influente",
    desc: "Alcançou 50 seguidores",
    variant: "fuchsia",
    icon: "Crown",
    metric: "followers",
    goal: 50,
  },
  {
    id: "conectado",
    title: "Conectado",
    desc: "Seguiu 10 leitores",
    variant: "teal",
    icon: "Users",
    metric: "followingCount",
    goal: 10,
  },
  {
    id: "debatedor",
    title: "Debatedor",
    desc: "Escreveu 25 comentários",
    variant: "indigo",
    icon: "MessagesSquare",
    metric: "comments",
    goal: 25,
  },
  {
    id: "entusiasta",
    title: "Entusiasta",
    desc: "Reagiu 30 vezes com emojis",
    variant: "orange",
    icon: "Smile",
    metric: "reactions",
    goal: 30,
  },
  {
    id: "curador",
    title: "Curador",
    desc: "Salvou 10 publicações",
    variant: "slate",
    icon: "Bookmark",
    metric: "saved",
    goal: 10,
  },
];

// Recebe os numeros crus e devolve cada conquista com progresso e se foi
// desbloqueada. `metrics` e um objeto simples: { posts, completed, ... }.
export function computeAchievements(metrics = {}) {
  return ACHIEVEMENTS.map((a) => {
    const valor = Number(metrics[a.metric] || 0);
    const unlocked = valor >= a.goal;
    return {
      ...a,
      value: valor,
      progress: Math.min(100, Math.round((valor / a.goal) * 100)),
      unlocked,
    };
  });
}

export function summarizeAchievements(metrics = {}) {
  const lista = computeAchievements(metrics);
  const desbloqueadas = lista.filter((a) => a.unlocked);
  return {
    all: lista,
    unlocked: desbloqueadas,
    unlockedCount: desbloqueadas.length,
    total: lista.length,
    // O "titulo" atual e a conquista desbloqueada de maior objetivo.
    currentTitle: desbloqueadas.sort((a, b) => b.goal - a.goal)[0] || null,
  };
}
