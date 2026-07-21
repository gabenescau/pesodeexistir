import { Heart, MessageCircle, Bookmark, Share2 } from "lucide-react";

export function PostCard({ post }) {
  const images = post.images || (post.image ? [post.image] : []);
  return (
    <div className="relative flex flex-col gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5 hover:border-[var(--border-strong)] transition-colors duration-200">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 sm:size-11 shrink-0 rounded-full bg-gradient-to-br from-[var(--text-primary)]/10 to-[var(--text-primary)]/[0.04] flex items-center justify-center text-sm font-bold text-[var(--text-primary)] border border-[var(--text-primary)]/10">
            {post.avatar}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
                {post.author}
              </span>
              <span className="size-3.5 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                <svg className="size-2 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484z" />
                </svg>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[var(--text-muted)]">@{post.author?.toLowerCase().replace(/\s/g, "_")}</span>
              <span className="text-[10px] text-[var(--text-placeholder)]">· {post.time}</span>
              {post.tag && (
                <span className="text-[10px] font-medium text-[var(--text-secondary)] px-1.5 py-0.5 rounded-full bg-[var(--hover-overlay)] border border-[var(--border)]">
                  {post.tag}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="text-sm sm:text-[15px] text-[var(--text-secondary)] leading-relaxed tracking-normal">
        {post.text}
      </p>

      {images.length > 0 && (
        <ImageGallery images={images} />
      )}

      {post.book && (
        <div className="flex items-center gap-3 p-3 rounded-[8px] bg-[var(--hover-overlay)] border border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer">
          <div className="w-11 h-15 rounded-[6px] overflow-hidden shrink-0 bg-[var(--bg-surface)] shadow-sm">
            <img src={post.book.image} alt={post.book.title} className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)] truncate">{post.book.title}</p>
            <p className="text-xs text-[var(--text-muted)]">{post.book.author}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-[var(--border)] mt-1">
        <div className="flex items-center gap-1 sm:gap-2">
          <button className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-xs text-[var(--text-muted)] hover:text-[#f91880] hover:bg-[#f91880]/10 transition-all">
            <Heart className="size-[18px]" strokeWidth={1.5} />
            <span className="hidden sm:inline">{post.likes}</span>
          </button>
          <button className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-xs text-[var(--text-muted)] hover:text-[#1d9bf0] hover:bg-[#1d9bf0]/10 transition-all">
            <MessageCircle className="size-[18px]" strokeWidth={1.5} />
            <span className="hidden sm:inline">{post.replies}</span>
          </button>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <button className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-xs text-[var(--text-muted)] hover:text-[#1d9bf0] hover:bg-[#1d9bf0]/10 transition-all">
            <Bookmark className="size-[18px]" strokeWidth={1.5} />
          </button>
          <button className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-xs text-[var(--text-muted)] hover:text-[#1d9bf0] hover:bg-[#1d9bf0]/10 transition-all">
            <Share2 className="size-[18px]" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ImageGallery({ images }) {
  const len = images.length;

  if (len === 1) {
    return (
      <div className="rounded-[8px] overflow-hidden border border-[var(--border)]">
        <img src={images[0]} alt="" className="w-full h-48 sm:h-56 object-cover" />
      </div>
    );
  }

  if (len === 2) {
    return (
      <div className="grid grid-cols-2 gap-1 rounded-[8px] overflow-hidden border border-[var(--border)]">
        {images.map((src, i) => (
          <img key={i} src={src} alt="" className="w-full h-40 sm:h-48 object-cover" />
        ))}
      </div>
    );
  }

  if (len === 3) {
    return (
      <div className="grid grid-cols-2 gap-1 rounded-[8px] overflow-hidden border border-[var(--border)]">
        <img src={images[0]} alt="" className="w-full h-48 sm:h-56 object-cover row-span-2" />
        <div className="flex flex-col gap-1">
          <img src={images[1]} alt="" className="w-full h-[calc(50%-2px)] object-cover" />
          <img src={images[2]} alt="" className="w-full h-[calc(50%-2px)] object-cover" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-1 rounded-[8px] overflow-hidden border border-[var(--border)]">
      {images.slice(0, 4).map((src, i) => (
        <div key={i} className="relative">
          <img src={src} alt="" className="w-full h-36 sm:h-40 object-cover" />
          {i === 3 && images.length > 4 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-lg font-bold">
              +{images.length - 4}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}