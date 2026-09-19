import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "@/lib/icons";

function Pagination({ className, ...props }) {
  return (
    <nav role="navigation" aria-label="pagination" className={cn("mx-auto flex w-full justify-center", className)} {...props} />
  );
}

function PaginationContent({ className, ...props }) {
  return <ul className={cn("flex flex-row flex-wrap items-center justify-center gap-1", className)} {...props} />;
}

function PaginationItem({ className, ...props }) {
  return <li className={cn("", className)} {...props} />;
}

function PaginationLink({ className, isActive, size = "icon", render, ...props }) {
  const Component = render?.type || "a";
  return (
    <Component
      {...(render?.props || {})}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium transition-colors",
        size === "default" && "h-9 min-w-9 px-3",
        size === "icon" && "size-9",
        isActive
          ? "bg-[var(--text-primary)] text-[var(--bg-card)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]",
        "disabled:pointer-events-none disabled:opacity-40",
        className
      )}
      {...props}
    />
  );
}

function PaginationPrevious({ className, ...props }) {
  return (
    <PaginationLink aria-label="Ir para a pagina anterior" size="default" className={cn("gap-1 pl-2.5", className)} {...props}>
      <ChevronLeft className="size-4" />
      <span>Anterior</span>
    </PaginationLink>
  );
}

function PaginationNext({ className, ...props }) {
  return (
    <PaginationLink aria-label="Ir para a proxima pagina" size="default" className={cn("gap-1 pr-2.5", className)} {...props}>
      <span>Proxima</span>
      <ChevronRight className="size-4" />
    </PaginationLink>
  );
}

function PaginationEllipsis({ className, ...props }) {
  return (
    <span aria-hidden className={cn("flex size-9 items-center justify-center", className)} {...props}>
      <MoreHorizontal className="size-4" />
      <span className="sr-only">Mais paginas</span>
    </span>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
};
