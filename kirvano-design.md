# Kirvano Design

Referencia visual: https://kirvano.com/ acessado em 2026-07-21.

Este projeto deve manter a copy do OPE Club, mas usar a linguagem visual da hero atual: fundo escuro profundo, secoes em bandas escuras alternadas, CTA cobre, cartoes discretos e produto sempre com cara elegante para leitores.

## Tokens

```css
:root {
  --kvn-bg: #111111;
  --kvn-surface: #17110d;
  --kvn-surface-2: #201711;
  --kvn-surface-3: #2a1a13;
  --kvn-brand: #c78359;
  --kvn-brand-strong: #d89567;
  --kvn-cream: #f3eee6;
  --kvn-cream-soft: #fff7ee;
  --kvn-ink: #111111;
  --kvn-fg: #f5f5f7;
  --kvn-muted: #8a8a94;
  --kvn-dark-muted: rgba(255,255,255,.62);
  --kvn-faint: rgba(255,255,255,.40);
  --kvn-light-ink: #171717;
  --kvn-light-muted: #525252;
  --kvn-border: rgba(255,255,255,.08);
  --kvn-border-strong: rgba(255,255,255,.16);
}
```

## Tipografia

Use `Inter Tight`, `Inter`, `system-ui`, `sans-serif`. A Kirvano usa fontes proprias; neste projeto a aproximacao publica e segura e Inter/Inter Tight.

- Titulos grandes: peso 600, line-height entre 0.92 e 1.05.
- Corpo: peso 400, line-height confortavel, cor secundaria em `--kvn-muted` ou `--kvn-dark-muted`.
- Botoes e navegacao: peso 500, sem caixa alta forçada.
- Letter spacing deve ficar em `0` no app. Na landing, pode usar tracking negativo apenas nos hero headings ja existentes.

## Landing Page

A landing deve parecer uma pagina de vendas Kirvano, mantendo apenas a copy do OPE Club.

- Fundo base: `--kvn-bg`.
- Secoes alternadas: preto `#111111`, marrom escuro `#17110d/#201711`, cobre profundo `#2a1a13`.
- Header: largura maxima ampla, glass escuro elegante, links discretos e CTA cobre.
- CTA principal: fundo cobre ou gradiente cobre escuro, texto `#fff7ee`, borda pill `999px`.
- Cards: `--kvn-surface-2`, borda `--kvn-border`, raio grande entre `20px` e `24px`.
- Secoes creme: texto `--kvn-light-ink`, textos secundarios `--kvn-light-muted`, cards claros translucidos.
- Nao usar linhas brancas fortes como divisores. Separacao deve vir por troca de superficie.

## App Interno

O app tambem segue a Kirvano: painel escuro, denso, com superficies sutis.

- Canvas: `#111111`.
- Sidebar: `#131113` com leve brilho cobre no topo.
- Header interno: translucido, blur, sem border branca.
- Item ativo do menu: `#c78359` com texto `#111111`.
- Cards e modais: `#191919` ou `#202020`, borda `rgba(255,255,255,.08)`.
- Inputs: `#131313`, borda sutil, texto `#f5f5f7`.
- Navegacao mobile: preservar touch target de 44px e safe-area.

## Regras Visuais

- Use contraste de superficies em vez de divisores brancos.
- Nao voltar para a paleta Vercel: sem azul `#0070f3`, sem gradiente multicolor Vercel, sem cards brancos puros fora de secoes creme.
- O cobre da hero e a cor de acao; nao usar verde, azul ou outros acentos concorrentes.
- Secoes devem ser bandas full-width, nao cards gigantes flutuando dentro de cards.
- O layout desktop deve respirar em ate `1280px`, mas o app precisa continuar compacto.
- Mobile primeiro: nada pode exigir zoom do navegador; grids viram coluna, tabs/chips rolam horizontalmente.

## Checklist Antes de Publicar

- Landing alterna preto, marrom escuro e cobre profundo.
- Header da landing e amplo, limpo, elegante, com CTA cobre.
- App nao possui linhas brancas verticais ou horizontais fortes.
- Sidebar ativa usa cobre.
- `npm run build` passa.
- `npm run lint` nao tem erros novos.
