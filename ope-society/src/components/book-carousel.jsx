import { useMemo } from "react";

function splitImages(images) {
  const midpoint = Math.ceil(images.length / 2);
  return [images.slice(0, midpoint), images.slice(midpoint)];
}

export function BookCarousel({ images }) {
  const [firstRow, secondRow] = useMemo(() => splitImages(images), [images]);

  return (
    <div className="book-marquee relative overflow-hidden py-2 md:py-4">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-linear-to-r from-[var(--kvn-bg)] to-transparent md:w-32" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-linear-to-l from-[var(--kvn-bg)] to-transparent md:w-32" />

      <BookRow images={firstRow} direction="left" />
      <BookRow images={secondRow} direction="right" />
    </div>
  );
}

function BookRow({ images, direction }) {
  const repeated = [...images, ...images, ...images];

  return (
    <div className="book-marquee-row overflow-hidden py-2 md:py-3">
      <div
        className={`book-marquee-track flex w-max gap-4 md:gap-6 ${
          direction === "right" ? "book-marquee-reverse" : ""
        }`}
      >
        {repeated.map((src, index) => (
          <button
            aria-label="Ver capa do livro"
            className="book-cover group h-[180px] w-[116px] shrink-0 overflow-hidden rounded-[10px] border border-[var(--kvn-border,rgba(199,131,89,.16))] bg-[var(--kvn-surface-2)] shadow-[0_12px_26px_rgba(0,0,0,.18)] transition-transform duration-300 hover:-translate-y-1 md:h-[250px] md:w-[162px]"
            key={`${src}-${index}`}
            type="button"
          >
            <img
              alt=""
              className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
              draggable={false}
              loading="lazy"
              src={src}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
