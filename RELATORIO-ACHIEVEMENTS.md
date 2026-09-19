# Relatório — Sistema de Conquistas (Achievements)

**Data:** 31/07/2026 · **Escopo:** `src/app/components/AchievementsPanel.jsx` + `src/lib/achievements.js` + dependências (`AchievementBadge`, `icons`).
**Tipo:** revisão estática, sem alteração de produção.

---

## 1. Resumo executivo

O sistema de conquistas é **100% dinâmico e sem estado**: nada é gravado no banco. Cada conquista é recalculada a partir das métricas já carregadas pelo app (`posts`, `completed`, `followers`, etc.). Isso é uma escolha de design sólida — não há estado para dessincronizar, e adicionar um novo objetivo é só uma linha em `ACHIEVEMENTS`.

**Nota geral: 8.5/10.** Implementação limpa, semântica acessível correta, sem riscos de segurança. Há 3 melhorias de UX/performance e 2 sugestões de produto.

---

## 2. Arquitetura

### Fluxo de dados
```
metrics (objeto simples) → computeAchievements() → lista com progresso/unlocked
                         → AchievementsPanel renderiza grade
```

### Componentes envolvidos
| Arquivo | Papel |
|---|---|
| `src/lib/achievements.js` | Catálogo `ACHIEVEMENTS` (12 itens) + `computeAchievements` + `summarizeAchievements` |
| `src/app/components/AchievementsPanel.jsx` | UI: grade colapsável, ordenação, modo compacto |
| `src/components/ui/achievement-badge.jsx` | Badge visual (variantes de cor + ícone) |
| `src/lib/icons.jsx` | `ChevronDown`, `Trophy` |

### Catálogo atual (12 conquistas)
| ID | Métrica | Meta | Variante |
|---|---|---|---|
| primeiro-passo | posts | 1 | bronze |
| voz-ativa | posts | 10 | amber |
| pensador | posts | 50 | violet |
| leitor-iniciante | reading | 1 | sky |
| devorador | completed | 5 | emerald |
| erudito | completed | 15 | gold |
| querido | followers | 10 | rose |
| influente | followers | 50 | fuchsia |
| conectado | followingCount | 10 | teal |
| debatedor | comments | 25 | indigo |
| entusiasta | reactions | 30 | orange |
| curador | saved | 10 | slate |

---

## 3. Pontos fortes

- **Sem estado**: nada a dessincronizar. Conquista aparece instantaneamente quando a métrica cruza a meta.
- **Extensível**: adicionar objetivo = uma entrada no array.
- **Acessível**: `aria-expanded` no botão, `type="button"` (não submete form), ícone com classe de tamanho.
- **Modo compacto**: retorna `null` se não há desbloqueadas — não polui a UI.
- **Ordenação inteligente**: desbloqueadas primeiro; entre travadas, as mais próximas de completar vêm antes (UX boa).
- **Sem XSS**: nada de `dangerouslySetInnerHTML`; texto React puro.
- **Sem dependência de rede**: cálculo client-side puro.

---

## 4. Achados

### A1 — [BAIXO] Recálculo a cada render
- **Onde:** `AchievementsPanel.jsx:13` (`computeAchievements` chamado direto no corpo).
- **Problema:** `computeAchievements` roda em todo render, mesmo quando `metrics` não mudou. Para 12 itens é barato, mas em painéis re-renderizados com frequência (ex.: perfil público com feed ativo) é desperdício.
- **Sugestão:** `useMemo(() => computeAchievements(metrics), [metrics])`. Ganho marginal, mas gratuito.

### A2 — [BAIXO] Sort cria novo array a cada render
- **Onde:** `AchievementsPanel.jsx:14-16`.
- **Problema:** `[...lista].sort(...)` roda sempre. Idem A1.
- **Sugestão:** memoizar junto com `computeAchievements`.

### A3 — [BAIXO] `subtitle` hardcoded "Conquista"
- **Onde:** `AchievementsPanel.jsx:46` (`subtitle="Conquista"`).
- **Problema:** todas as badges mostram "Conquista" como subtítulo — repetitivo e não agrega info. O `desc` já está logo abaixo.
- **Sugestão:** passar `subtitle={a.unlocked ? "Desbloqueada" : "Bloqueada"}` ou remover o subtítulo.

### A4 — [INFO] Sem timestamp de desbloqueio
- **Onde:** `achievements.js`.
- **Observação:** como é stateless, não há "quando" a conquista foi desbloqueada. Para um clube de leitura, mostrar "Desbloqueada há 3 dias" aumenta engajamento.
- **Sugestão (futuro):** se quiser histórico, gravar evento em `achievement_events` (insert idempotente) ao detectar transição `unlocked: false → true`. Opcional — não bloqueia.

### A5 — [INFO] Conquistas não têm níveis intermediários
- **Onde:** `achievements.js`.
- **Observação:** métricas como `posts` têm 3 tiers (1/10/50), mas `reading` e `saved` só têm 1. Usuário avançado pode ficar sem progressão visível.
- **Sugestão (produto):** adicionar tiers em `completed` (5/15/50), `followers` (10/50/200), `comments` (25/100).

### A6 — [INFO] `summarizeAchievements` não é usado no panel
- **Onde:** `achievements.js:67`.
- **Observação:** a função existe e calcula `currentTitle` (maior meta desbloqueada), mas o `AchievementsPanel` não a usa. Provável uso em outro lugar (perfil/badge de título).
- **Ação:** confirmar uso; se órfã, remover.

---

## 5. Scores por área (0–10)

| Área | Score | Comentário |
|---|---|---|
| Correção funcional | 9.0 | Lógica de progresso/unlocked correta |
| Acessibilidade | 8.5 | `aria-expanded` ok; faltam `aria-label` no botão e `role="list"` na grade |
| Performance | 7.5 | Sem memoização (A1, A2) — impacto baixo, mas evitável |
| Extensibilidade | 9.5 | Adicionar conquista = 1 linha |
| UX | 8.0 | Ordenação boa; subtítulo repetitivo (A3) |
| Segurança | 10.0 | Sem entrada de usuário, sem XSS, sem rede |
| **Geral** | **8.5** | Sólido; melhorias são polish |

---

## 6. Plano sugerido

### Imediato (polish, ~30 min)
1. **A1+A2** — `useMemo` para `computeAchievements` + sort.
2. **A3** — subtítulo dinâmico ou removido.
3. Adicionar `aria-label="Alternar painel de conquistas"` no botão e `role="list"`/`listitem` na grade.

### Futuro (produto)
4. **A5** — adicionar tiers em métricas com poucos níveis.
5. **A4** — (opcional) gravar timestamp de desbloqueio para mostrar "há X dias".

---

## 7. Conclusão

O sistema de conquistas é um dos pontos mais limpos do projeto: stateless, extensível, sem riscos de segurança. As melhorias sugeridas são polish de performance e UX — nenhuma é bloqueadora. A arquitetura escolhida (recalcular ao invés de persistir) é a correta para o volume atual e evita toda uma classe de bugs de sincronização.
