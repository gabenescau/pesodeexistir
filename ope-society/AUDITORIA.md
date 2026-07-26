# Auditoria OPE Club — 23/07/2026

Escopo: `src/`, `supabase/migrations/`, `supabase/functions/`, configuração de deploy.
Estado: as migrations 00009 e 00010 já tinham fechado as duas falhas mais graves
(escalação para admin via `PATCH /profiles` e paywall com bucket público). O que
segue é o que ainda estava aberto.

---

## Corrigido nesta rodada

### 1. Data de lançamento era só enfeite — ALTO
`ReleasesPage` escondia o card, mas nada impedia abrir `/app/ler/<id>` direto e
ler um livro agendado para semanas à frente: o Storage assinava a URL para
qualquer assinante ativo, sem olhar a data.

**Correção:** `public.is_book_released()` + `is_pdf_object_released()` e a policy
`pdfs_select_subscribers` passou a exigir que o livro já tenha sido lançado. O
front (`src/lib/releases.js`) espelha a regra só para não oferecer o botão.
A trava real está no banco. Admin continua com acesso antecipado.

### 2. O e-mail de todo mundo aparecia no feed — MÉDIO
O `@handle` era `email.split("@")[0]`. Publicar era entregar a parte local do
seu e-mail para toda a comunidade — e num domínio conhecido (`@gmail.com`),
isso é o e-mail inteiro.

**Correção:** coluna `profiles.username`, única, editável no perfil, com backfill
dos usuários existentes. O e-mail não vai mais para a tela em lugar nenhum.

### 3. Cabeçalhos de segurança não estavam sendo aplicados — MÉDIO
`public/_headers` é convenção de Netlify/Cloudflare Pages. **A Vercel ignora esse
arquivo.** Na prática o site estava servindo sem CSP, sem `X-Frame-Options`, sem
`nosniff` — todo o arquivo era decorativo.

**Correção:** os headers foram para `vercel.json` (que a Vercel lê), com
`frame-ancestors 'none'`, `form-action 'self'` e HSTS adicionados.
**Vale conferir no deploy:** `curl -I https://pesodeexistir.online` deve mostrar
`content-security-policy`.

### 4. Texto e imagem sem limite nenhum — MÉDIO (custo/abuso)
A anon key está no bundle (por design), então qualquer pessoa logada podia fazer
`POST /rest/v1/posts` com megabytes de texto por linha. Pior: `CreatePost` grava
imagem como data URL base64 **dentro da linha do post**, e o feed baixa tudo isso
para todos os leitores.

**Correção:** CHECKs em `posts.text` (5 000), `post_replies.text` (2 000) e
`posts.images` (máx. 4 imagens / ~3 MB), espelhados no cliente (700 KB por
arquivo). Ver "Pendências" para a correção definitiva.

### 5. Botão "salvar" que não salvava — BAIXO
`PostCard` guardava o estado em `useState`: recarregou a página, perdeu tudo.
Agora existe a tabela `saved_posts`.

### 6. Busca da comunidade não buscava
O campo existia, era bonito e não filtrava nada. Agora filtra texto, autor,
handle, tag e título do livro.

---

## Pendências (recomendo, não fiz)

| # | Item | Severidade | Por quê |
|---|------|-----------|---------|
| 1 | **Imagens de post no Storage, não em base64 no banco** | Alto (custo) | Uma imagem de 500 KB vira ~680 KB de texto na linha do post, replicado para todo leitor do feed. Criar bucket `post-images` com policy por pasta de usuário, igual ao `avatars`, e guardar só a URL. Os CHECKs de agora são um curativo. |
| 2 | **Validar tipo de arquivo no upload de avatar** | Médio | `ProfilePage` aceita qualquer `image/*` e deriva a extensão do nome do arquivo. Um `.svg` no bucket público vira HTML executável no domínio do Supabase. Fixar allowlist (`png/jpg/webp`) e o `contentType` pelo tipo real. |
| 3 | **Sem rate limit em posts/comentários/follows** | Médio | Nada impede um script de criar 10 000 posts. Um trigger contando inserts por usuário na última hora resolve o caso simples. |
| 4 | **`weekly_releases` legível por qualquer autenticado** | Baixo | Quem não assina vê a agenda inteira de lançamentos. Se isso for informação comercial, restringir a policy a assinante. |
| 5 | **Bundle de 1,4 MB (413 KB gzip) num arquivo só** | Médio (UX mobile) | `pdfjs-dist` inteiro entra na primeira tela, inclusive para quem só abre a landing. `React.lazy` no `BookReaderPage` e no `AdminPage` corta boa parte disso. |
| 6 | **`AdminPage` inteiro no bundle de todo usuário** | Baixo | O RLS protege os dados, mas a estrutura do painel é entregue a todo mundo. Resolve junto com o item 5. |
| 7 | **Sem moderação/denúncia** | Médio (produto) | Rede social sem botão de denunciar e sem bloquear usuário não escala. Hoje só admin apaga, e só reativamente. |
| 8 | **Idempotência do webhook Cakto** | Baixo | O `eventId` é montado concatenando campos do payload (`event_order_subscription_status`). Se a Cakto mandar dois eventos distintos com os mesmos campos, um é descartado como duplicata. Preferir o id de evento do provedor, quando existir. |
| 9 | **Sem testes automatizados** | Médio | Não existe um único teste no projeto. As regras de assinatura (`lib/subscription.js`) e de lançamento (`lib/releases.js`) são lógica pura e baratíssima de testar. |

---

## Rodada 2 — avisos do Database Linter + Cakto (migration 00012)

Rodei os avisos que você colou. Resolvidos:

- **`security_definer_view` (ERROR)** — `public_profiles` recriada com
  `security_invoker = true`. Com o email já fora de `profiles` (ver abaixo), a
  view agora respeita o RLS de quem consulta, sem rodar como dono.
- **`function_search_path_mutable`** — `map_cakto_status_to_internal` foi
  removida junto com a Cakto. Todo helper que sobrou tem `set search_path`.
- **`0028/0029 SECURITY DEFINER executável por anon/authenticated`** —
  `is_admin`, `has_active_subscription`, `is_book_released`,
  `is_pdf_object_released`, `handle_new_user`, `prevent_role_change` e
  `rls_auto_enable` saíram do schema `public`. Os que as policies usam foram
  recriados no schema **`private`** (não exposto pelo PostgREST, então somem de
  `/rest/v1/rpc/*`); os obsoletos foram dropados. As policies e triggers foram
  reapontados para `private.*`.
- **`public_bucket_allows_listing` (avatars)** — a policy ampla de SELECT do
  bucket `avatars` foi removida. O objeto continua acessível pela URL pública
  (é assim que o avatar aparece), mas ninguém mais consegue **listar** o bucket.
- **`auth_leaked_password_protection`** — este é um toggle do painel, não dá
  para ligar por SQL/código. **Ação sua:** Authentication → Policies → ativar
  "Leaked password protection" (checa o HaveIBeenPwned). 1 clique.

Além disso, para viabilizar a view `security_invoker` sem vazar email, o
**email saiu da tabela `profiles`** e foi para `public.user_emails`, visível só
para admin. O app foi ajustado: o admin lê os emails dessa tabela; o resto do
app nunca mais toca no email de ninguém.

## Cakto — removida 100%

- Apagados: `supabase/functions/` (webhook + client), `CAKTO_SETUP.md`, as vars
  `CAKTO_*` do `.env.example`.
- No banco (00012): `drop` de `map_cakto_status_to_internal`, `webhook_events`,
  `checkout_sessions` e das colunas `cakto_*` em `subscriptions`.
- `SubscribePage` não cita mais a Cakto nem grava `checkout_sessions`; usa uma
  URL de checkout opcional (`VITE_CHECKOUT_URL`). Sem essa var, o botão avisa
  para falar com a administração — nenhum provedor acoplado ao código.
- As migrations históricas 00003–00007 foram **mantidas de propósito**: já
  rodaram no banco de produção e servem de histórico; a 00012 é quem derruba os
  objetos. Reexecutar tudo do zero cria e depois dropa — sem erro.

> ⚠️ Rode as migrations **00011 e depois 00012** no SQL Editor, nessa ordem.

## Também entregue nesta rodada

- **Conquistas dinâmicas + títulos** — `src/lib/achievements.js` define 12
  objetivos (posts, livros concluídos, seguidores, comentários, reações…),
  recalculados dos dados reais, sem nada gravado como "conquista". Badges
  holográficos coloridos (`achievement-badge.jsx`, adaptado do award-badge para
  JSX) no perfil próprio e público; o título atual vira uma pílula colorida ao
  lado do nome **nos posts, nos comentários do feed e nos comentários dentro dos
  livros**.
- **Sair da conta** — menu no avatar do header (Perfil / Configurações / Sair) e
  botão no rodapé da sidebar.
- **Responsivo** — componentes novos são mobile-first (grid 1→2 colunas, footer
  do leitor com alvos de 44px, reações que quebram linha). O leitor de PDF já
  reajusta ao girar o celular.

## Pontos que já estavam bons

- RLS ligado em todas as tabelas, com policies por dono e `is_admin()`.
- Grant por coluna em `profiles` impedindo auto-promoção a admin (00009).
- Bucket `pdfs` privado + URL assinada de 1 h.
- View `public_profiles` expondo só o que o feed precisa, sem `email`/`role`.
- Comparação do segredo do webhook em tempo constante — detalhe que quase todo
  mundo erra.
- Sessão em `sessionStorage`, com limpeza das sessões antigas do `localStorage`.
