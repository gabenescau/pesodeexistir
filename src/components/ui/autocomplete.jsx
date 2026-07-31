import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, User, Folder, MagnifyingGlass, X } from "@/lib/icons";
import { cn } from "@/lib/utils";

// Autocomplete de busca: recebe items { id, label, kind, href } e renderiza
// um input com dropdown de sugestoes. Substitui o <input> simples da barra
// de pesquisa da Biblioteca/Comunidade sem trazer dependência nova
// (implementado em cima do estado local — nada de base-ui Autocomplete,
// que exigiria outro portal/popover e mais boilerplate).

function normalizar(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const KIND_ICON = {
  book: BookOpen,
  author: User,
  category: Folder,
};

const KIND_LABEL = {
  book: "Livro",
  author: "Autor",
  category: "Categoria",
};

export function AutocompleteSearch({
  placeholder = "Pesquisar...",
  items = [],
  className,
  inputClassName,
  onSelect,
  emptyText = "Nenhum resultado.",
  autoFocus,
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef(null);

  const resultados = useMemo(() => {
    const q = normalizar(query.trim());
    if (q.length < 1) return [];
    const grupos = { book: [], author: [], category: [] };
    for (const item of items) {
      if (!item || !item.label) continue;
      if (normalizar(item.label).includes(q) || normalizar(item.subtitle || "").includes(q)) {
        if (grupos[item.kind]) grupos[item.kind].push(item);
      }
    }
    return [
      ...grupos.book.slice(0, 5),
      ...grupos.author.slice(0, 5),
      ...grupos.category.slice(0, 5),
    ];
  }, [items, query]);

  function selecionar(item) {
    if (!item) return;
    setQuery("");
    setOpen(false);
    setActiveIndex(0);
    if (typeof onSelect === "function") {
      onSelect(item);
      return;
    }
    if (item.href) navigate(item.href);
  }

  function onKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((atual) => Math.min(resultados.length - 1, atual + 1));
      setOpen(true);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((atual) => Math.max(0, atual - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      selecionar(resultados[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  function onFocus() {
    if (resultados.length) setOpen(true);
  }

  function onBlur(event) {
    if (containerRef.current && !containerRef.current.contains(event.relatedTarget)) {
      setOpen(false);
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full", className)}
      onBlur={onBlur}
    >
      <div className="relative">
        <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-placeholder)]" />
        <input
          type="search"
          value={query}
          autoFocus={autoFocus}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={cn(
            "h-10 w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] pl-9 pr-9 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-placeholder)] focus:border-[var(--border-strong)] sm:h-11",
            inputClassName
          )}
        />
        {query && (
          <button
            type="button"
            aria-label="Limpar busca"
            onClick={() => {
              setQuery("");
              setOpen(false);
              setActiveIndex(0);
            }}
            className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {open && query && (
        <div
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[320px] overflow-y-auto rounded-[10px] border border-[var(--border)] bg-[var(--bg-card)] p-1 shadow-[0_18px_45px_rgba(0,0,0,.32)]"
        >
          {resultados.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">
              {emptyText}
            </p>
          ) : (
            <ul>
              {resultados.map((item, index) => {
                const Icon = KIND_ICON[item.kind] || BookOpen;
                const ativo = index === activeIndex;
                return (
                  <li key={`${item.kind}-${item.id}`}>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selecionar(item)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[8px] px-3 py-2 text-left transition-colors",
                        ativo
                          ? "bg-[var(--hover-overlay)]"
                          : "hover:bg-[var(--hover-overlay)]"
                      )}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--hover-overlay)] text-[var(--text-muted)]">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-[var(--text-primary)]">{item.label}</span>
                        {item.subtitle ? (
                          <span className="block truncate text-[11px] text-[var(--text-muted)]">{item.subtitle}</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 rounded-full bg-[var(--hover-overlay)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                        {KIND_LABEL[item.kind] || item.kind}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// Hook util para construir os items a partir de livros/autores/categorias.
export function buildSearchItems({ books, authors, categories }) {
  const items = [];
  for (const book of books || []) {
    const autor = (authors || []).find((a) => a.id === (book.authorId || book.author_id));
    items.push({
      id: `book-${book.id}`,
      kind: "book",
      label: book.title,
      subtitle: autor?.name || book.author || book.category || "",
      href: `/app/livro/${book.id}`,
    });
  }
  for (const autor of authors || []) {
    items.push({
      id: `author-${autor.id}`,
      kind: "author",
      label: autor.name,
      subtitle: autor.theme || autor.era || "Autor",
      href: `/app/autor/${autor.id}`,
    });
  }
  for (const categoria of categories || []) {
    items.push({
      id: `category-${categoria.id || categoria}`,
      kind: "category",
      label: categoria.name || categoria,
      subtitle: "Categoria",
      href: `/app/biblioteca?categoria=${encodeURIComponent(categoria.name || categoria)}`,
    });
  }
  return items;
}
