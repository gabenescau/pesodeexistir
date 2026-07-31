import { memo, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Hash, Lock, Plus, Search as SearchIcon, X } from "@/lib/icons";
import { useAuth } from "../data/AuthContext";
import { useData } from "../data/DataContext";
import { toast } from "@/lib/toast";

const COLORS = [
  "from-amber-500 to-rose-500",
  "from-violet-500 to-fuchsia-500",
  "from-sky-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-rose-500 to-orange-500",
  "from-indigo-500 to-purple-500",
];

function colorFor(id = "") {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

function CoverThumb({ name, image }) {
  if (image) {
    return <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />;
  }
  return (
    <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${colorFor(name)}`}>
      <Hash className="size-10 text-white/80" weight="bold" />
    </div>
  );
}

const CollectionCard = memo(function CollectionCard({ collection, itemCount, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group block w-full overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] text-left transition-colors hover:bg-[var(--hover-overlay)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <CoverThumb name={collection.name} image={collection.cover_path ? null : null} />
      </div>
      <div className="p-2.5">
        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{collection.name}</p>
        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
          {collection.is_public ? null : <Lock className="size-3" weight="bold" />}
          {itemCount} {itemCount === 1 ? "item" : "itens"}
        </p>
      </div>
    </button>
  );
});

// Modal generico (bottom sheet no mobile, centralizado no desktop).
function Sheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[16px] border border-[var(--border)] bg-[var(--bg-card)] shadow-[0_24px_60px_rgba(0,0,0,.5)] sm:max-h-[85vh] sm:max-w-md sm:rounded-[16px]">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
          <button onClick={onClose} className="flex size-8 items-center justify-center rounded-full hover:bg-[var(--hover-overlay)]" aria-label="Fechar">
            <X className="size-4 text-[var(--text-primary)]" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function CreateCollectionSheet({ open, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setName(""); setDescription(""); setIsPublic(true); setSaving(false); }
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const created = await onCreate({ name, description, isPublic });
      onClose(created);
    } catch (err) {
      toast.error(err?.message || "Nao foi possivel criar a colecao.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={() => onClose(null)} title="Nova colecao">
      <form onSubmit={handleSubmit} className="space-y-4 p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Nome</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 60))}
            placeholder="Ex.: Filosofia para ler"
            maxLength={60}
            required
            className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--bg-page)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-mint)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Descricao (opcional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 280))}
            placeholder="Do que se trata a colecao?"
            maxLength={280}
            rows={3}
            className="w-full resize-none rounded-[10px] border border-[var(--border)] bg-[var(--bg-page)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-mint)]"
          />
        </label>
        <label className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-[var(--border)] bg-[var(--bg-page)] p-3">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="size-4 accent-[var(--accent-mint)]"
          />
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Publica</p>
            <p className="text-[11px] text-[var(--text-muted)]">Outros perfis podem ver esta colecao.</p>
          </div>
        </label>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={() => onClose(null)} className="flex-1 rounded-full border border-[var(--border)] py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]">
            Cancelar
          </button>
          <button type="submit" disabled={!name.trim() || saving} className="flex-1 rounded-full bg-[var(--text-primary)] py-2.5 text-sm font-semibold text-[var(--bg-card)] disabled:opacity-40">
            {saving ? "Criando..." : "Criar"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function AddItemSheet({ open, onClose, books, authors, existingItemIds, onAdd }) {
  const [tab, setTab] = useState("book");
  const [query, setQuery] = useState("");
  const [addingId, setAddingId] = useState(null);

  useEffect(() => {
    if (open) { setTab("book"); setQuery(""); setAddingId(null); }
  }, [open]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (tab === "book") {
      return books
        .filter((b) => !existingItemIds.has(`book:${b.id}`))
        .filter((b) => !q || (b.title || "").toLowerCase().includes(q) || (b.authorName || "").toLowerCase().includes(q))
        .slice(0, 60);
    }
    return authors
      .filter((a) => !existingItemIds.has(`author:${a.id}`))
      .filter((a) => !q || (a.name || "").toLowerCase().includes(q))
      .slice(0, 60);
  }, [tab, query, books, authors, existingItemIds]);

  async function handlePick(item) {
    if (addingId) return;
    setAddingId(item.id);
    try {
      await onAdd(tab, item.id);
      onClose();
    } catch (err) {
      toast.error(err?.message || "Nao foi possivel adicionar.");
    } finally {
      setAddingId(null);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Adicionar">
      <div className="space-y-3 p-4">
        <div className="flex gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-page)] p-1">
          {[
            { id: "book", label: "Livros" },
            { id: "author", label: "Autores" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-full py-1.5 text-xs font-medium transition-colors ${
                tab === t.id ? "bg-[var(--text-primary)] text-[var(--bg-card)]" : "text-[var(--text-secondary)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === "book" ? "Buscar livro..." : "Buscar autor..."}
            className="w-full rounded-full border border-[var(--border)] bg-[var(--bg-page)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-mint)]"
          />
        </div>

        {list.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--text-muted)]">Nenhum resultado.</p>
        ) : (
          <ul className="space-y-1.5">
            {list.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={addingId === item.id}
                  onClick={() => handlePick(item)}
                  className="flex w-full items-center gap-3 rounded-[10px] border border-transparent p-2 text-left hover:border-[var(--border)] hover:bg-[var(--hover-overlay)] disabled:opacity-50"
                >
                  <div className="size-10 shrink-0 overflow-hidden rounded-[6px] border border-[var(--border)] bg-[var(--bg-page)]">
                    {tab === "book" ? (
                      item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" loading="lazy" /> : <BookOpen className="m-auto size-5 text-[var(--text-muted)]" />
                    ) : item.image ? (
                      <img src={item.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xs font-bold text-[var(--text-muted)]">{(item.name || "?").charAt(0)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">{item.title || item.name}</p>
                    {tab === "book" && item.authorName ? <p className="truncate text-[11px] text-[var(--text-muted)]">{item.authorName}</p> : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}

function CollectionDetailSheet({ open, onClose, collection, items, books, authors, canEdit, onAdd, onRemove }) {
  const [addOpen, setAddOpen] = useState(false);

  if (!collection) return null;

  const bookMap = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  const authorMap = useMemo(() => new Map(authors.map((a) => [a.id, a])), [authors]);
  const existingItemIds = useMemo(() => new Set(items.map((i) => `${i.item_type}:${i.item_id}`)), [items]);

  return (
    <>
      <Sheet open={open} onClose={onClose} title={collection.name}>
        <div className="p-4">
          {collection.description ? (
            <p className="mb-4 text-sm text-[var(--text-secondary)]">{collection.description}</p>
          ) : null}

          {items.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-[var(--border)] p-8 text-center">
              <Hash className="mx-auto mb-2 size-6 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-muted)]">Colecao vazia por enquanto.</p>
              {canEdit ? (
                <button onClick={() => setAddOpen(true)} className="mt-3 rounded-full border border-[var(--border)] px-4 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]">
                  Adicionar o primeiro item
                </button>
              ) : null}
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => {
                const entity = item.item_type === "book" ? bookMap.get(item.item_id) : authorMap.get(item.item_id);
                const label = entity?.title || entity?.name || "Item";
                const sub = item.item_type === "book" ? (entity?.authorName || "") : (entity?.bio || "");
                return (
                  <li key={item.id} className="flex items-center gap-3 rounded-[10px] border border-[var(--border)] p-2">
                    <div className="size-12 shrink-0 overflow-hidden rounded-[6px] border border-[var(--border)] bg-[var(--bg-page)]">
                      {entity?.image ? (
                        <img src={entity.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-xs font-bold text-[var(--text-muted)]">
                          {label.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--text-primary)]">{label}</p>
                      {sub ? <p className="truncate text-[11px] text-[var(--text-muted)]">{sub}</p> : null}
                      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{item.item_type === "book" ? "Livro" : "Autor"}</p>
                    </div>
                    {canEdit ? (
                      <button
                        onClick={() => onRemove(item.id).catch((err) => toast.error(err?.message || "Erro ao remover."))}
                        className="flex size-8 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-red-400"
                        aria-label="Remover"
                      >
                        <X className="size-4" />
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {canEdit ? (
            <button
              onClick={() => setAddOpen(true)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-[var(--border)] py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"
            >
              <Plus className="size-4" /> Adicionar item
            </button>
          ) : null}
        </div>
      </Sheet>
      <AddItemSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        books={books}
        authors={authors}
        existingItemIds={existingItemIds}
        onAdd={onAdd}
      />
    </>
  );
}

export function CollectionsPanel({ ownerId, ownerName }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    collections, books, authors,
    collectionsByUser, getCollectionItems, collectionItemCount,
    createCollection, addCollectionItem, removeCollectionItem,
  } = useData();

  const [createOpen, setCreateOpen] = useState(false);
  const [openCollectionId, setOpenCollectionId] = useState(null);

  const ownerCollections = useMemo(
    () => collectionsByUser(ownerId).filter((c) => c.is_public || c.user_id === user?.id),
    [collectionsByUser, ownerId, collections, user?.id]
  );

  const openCollection = openCollectionId ? ownerCollections.find((c) => c.id === openCollectionId) : null;
  const openItems = openCollectionId ? getCollectionItems(openCollectionId) : [];
  const canEdit = Boolean(user?.id && openCollection?.user_id === user?.id);

  async function handleCreate({ name, description, isPublic }) {
    const created = await createCollection({ name, description, isPublic });
    toast.success("Colecao criada.");
    return created;
  }

  async function handleAddItem(itemType, itemId) {
    if (!openCollectionId) return;
    await addCollectionItem(openCollectionId, itemType, itemId);
    toast.success("Item adicionado.");
  }

  async function handleRemoveItem(itemId) {
    await removeCollectionItem(itemId);
  }

  if (!user) {
    return (
      <div className="py-12 text-center">
        <Lock className="mx-auto mb-2 size-6 text-[var(--text-muted)]" />
        <p className="text-sm text-[var(--text-muted)]">Entre para ver e criar colecoes.</p>
        <button onClick={() => navigate("/entrar")} className="mt-3 rounded-full bg-[var(--text-primary)] px-5 py-2 text-sm font-semibold text-[var(--bg-card)]">
          Entrar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-xs text-[var(--text-muted)]">
          {ownerCollections.length} {ownerCollections.length === 1 ? "colecao" : "colecoes"} de {ownerName || "este perfil"}
        </p>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--text-primary)] px-3.5 py-1.5 text-xs font-semibold text-[var(--bg-card)]"
        >
          <Plus className="size-3.5" weight="bold" /> Criar colecao
        </button>
      </div>

      {ownerCollections.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-[var(--border)] p-8 text-center">
          <Hash className="mx-auto mb-2 size-6 text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-secondary)]">
            {ownerName ? `${ownerName} ainda nao criou colecoes.` : "Nenhuma colecao por aqui."}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Crie a primeira colecao de livros ou autores.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {ownerCollections.map((c) => (
            <CollectionCard
              key={c.id}
              collection={c}
              itemCount={collectionItemCount(c.id)}
              onOpen={() => setOpenCollectionId(c.id)}
            />
          ))}
        </div>
      )}

      <CreateCollectionSheet
        open={createOpen}
        onClose={(created) => {
          setCreateOpen(false);
          if (created) setOpenCollectionId(created.id);
        }}
        onCreate={handleCreate}
      />

      <CollectionDetailSheet
        open={Boolean(openCollection)}
        onClose={() => setOpenCollectionId(null)}
        collection={openCollection}
        items={openItems}
        books={books}
        authors={authors}
        canEdit={canEdit}
        onAdd={handleAddItem}
        onRemove={handleRemoveItem}
      />
    </div>
  );
}
