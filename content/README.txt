ESTRUTURA DA PASTA /content/

A pasta /content/ é a fonte de verdade de todo o conteúdo do clube (autores, livros,
arquivos PDF). O conteúdo é carregado automaticamente via import.meta.glob no momento
do build.

ESTRUTURA:

/content/
├── README.txt              <- este arquivo
├── <autor-id>/             <- pasta do autor (URL-safe, sem espaços)
│   ├── index.js            <- metadados do autor (export default { name, image, theme, era })
│   ├── <livro-id>/         <- pasta do livro (URL-safe, sem espaços)
│   │   ├── index.js        <- metadados do livro (export default { title, image })
│   │   └── livro.pdf       <- (opcional) PDF do livro para leitura in-app
│   └── ...mais livros
├── outro-autor/
│   └── index.js
│   └── ...

EXEMPLO:

/content/
├── nietzsche/
│   ├── index.js            -> export default { name: "Friedrich Nietzsche", image: "/autores/friedrich nietzsche.jpg", theme: "Existencialismo", era: "século XIX" }
│   ├── assim-falou-zaratustra/
│   │   ├── index.js        -> export default { title: "Assim Falou Zaratustra", image: "/livros/492dd6edb0d27970532073b4a49676e4.jpg" }
│   │   └── livro.pdf       <- (opcional)
│   └── alem-do-bem-e-do-mal/
│       └── index.js        -> export default { title: "Além do Bem e do Mal", image: "/livros/placeholder.jpg" }

COMO ADICIONAR UM NOVO AUTOR:

1. Crie /content/<autor-id>/index.js seguindo o formato:
     export default {
       name: "Nome do Autor",
       image: "/autores/nome-do-arquivo.jpg",
       theme: "Gênero/Tema",
       era: "século/época"
     }
2. Coloque a foto do autor em /public/autores/ com o mesmo nome usado em "image".
3. Para adicionar livros, crie subpastas /content/<autor-id>/<livro-id>/ com index.js:
     export default {
       title: "Título do Livro",
       image: "/livros/hash.jpg"
     }
4. (Opcional) Coloque /content/<autor-id>/<livro-id>/livro.pdf para leitura in-app.
5. Coloque a capa do livro em /public/livros/ com o mesmo nome usado em "image".

IMPORTANTE:
- Use sempre IDs URL-safe: letras minúsculas, hífens, sem espaços ou acentos.
- As imagens ficam em /public/autores/ e /public/livros/ (não dentro de /content/).
- O campo "image" é o caminho público (ex: "/autores/nietzsche.jpg").
- Arquivos .js devem usar `export default` com um objeto literal.
- Após adicionar/modificar conteúdo, rode `npm run build` para verificar.
