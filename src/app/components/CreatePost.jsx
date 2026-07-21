import { useState, useRef } from "react";
import { useAuth } from "@/app/data/AuthContext";
import { useData } from "@/app/data/DataContext";

const TAGS = ["Filosofia", "Literatura", "Ciência", "Política", "Arte", "História", "Poesia", "Romance", "Conto", "Ensaio"];

export function CreatePost() {
  const { user } = useAuth();
  const { addPost } = useData();
  const fileInputRef = useRef(null);
  const [text, setText] = useState("");
  const [tag, setTag] = useState("");
  const [images, setImages] = useState([]);
  const [showTags, setShowTags] = useState(false);

  function handleImageSelect(e) {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImages(prev => [...prev, ev.target.result]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  function removeImage(index) {
    setImages(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!text.trim()) return;
    await addPost({
      userId: user?.id || "anon",
      text: text.trim(),
      tag: tag || null,
      bookId: null,
      images,
    });
    setText("");
    setTag("");
    setImages([]);
  }

  return (
    <div className="create-post-card rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5">
      <div className="flex gap-3">
        <div className="size-10 sm:size-11 shrink-0 rounded-full bg-gradient-to-br from-[var(--text-primary)]/10 to-[var(--text-primary)]/[0.04] flex items-center justify-center text-sm font-bold text-[var(--text-primary)] border border-[var(--text-primary)]/10 mt-1">
          {user?.avatar || "V"}
        </div>
        <div className="flex-1">
          <textarea
            placeholder="No que você está pensando hoje?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="create-post-textarea w-full rounded-[10px] bg-transparent px-3 py-2 text-sm sm:text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none resize-none leading-relaxed"
          />

          {images.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {images.map((src, i) => (
                <div key={i} className="relative group">
                  <img src={src} alt="" className="size-20 sm:size-24 rounded-[8px] object-cover border border-[var(--border)]" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}

          {tag && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--hover-overlay)] text-[var(--text-secondary)] border border-[var(--border)]">
                {tag}
              </span>
              <button onClick={() => setTag("")} className="text-[10px] text-[var(--text-muted)] hover:text-red-400 transition-colors">
                remover
              </button>
            </div>
          )}

          <div className="flex items-center justify-between mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-[var(--border)]">
            <div className="flex gap-1 sm:gap-2">
              <div className="relative">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 sm:px-3 py-1.5 rounded-full hover:bg-[var(--hover-overlay)] transition-all"
                >
                  Imagem
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowTags(!showTags)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 sm:px-3 py-1.5 rounded-full hover:bg-[var(--hover-overlay)] transition-all"
                >
                  {tag || "# Tag"}
                </button>
                {showTags && (
                  <div className="absolute top-full left-0 mt-1 z-50 w-48 rounded-[8px] border border-[var(--border)] bg-[var(--bg-card)] shadow-lg p-2 max-h-48 overflow-y-auto">
                    {TAGS.map(t => (
                      <button
                        key={t}
                        onClick={() => { setTag(t); setShowTags(false); }}
                        className={`block w-full text-left text-xs px-3 py-1.5 rounded-[6px] transition-colors ${
                          tag === t ? "bg-[var(--text-primary)]/10 text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button
              disabled={!text.trim()}
              onClick={handleSubmit}
              className={`px-4 sm:px-5 py-1.5 rounded-full text-sm font-medium transition-all ${
                text.trim()
                  ? "bg-[var(--text-primary)] text-[var(--bg-card)] hover:opacity-90"
                  : "bg-[var(--hover-overlay)] text-[var(--text-placeholder)] cursor-not-allowed"
              }`}
            >
              Publicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
