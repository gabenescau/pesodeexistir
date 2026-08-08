import * as React from "react";
import { cn } from "@/lib/utils";

function Table({ className, variant = "default", ...props }) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        data-variant={variant}
        className={cn(
          "w-full caption-bottom text-sm",
          variant === "card" && "rounded-[12px] border border-[var(--border)]",
          className
        )}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }) {
  return (
    <thead
      data-slot="table-header"
      className={cn("border-b border-[var(--border)] bg-[var(--hover-overlay)]", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }) {
  return (
    <tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  );
}

function TableFooter({ className, ...props }) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t border-[var(--border)] bg-[var(--hover-overlay)] text-sm", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-[var(--border)] transition-colors hover:bg-[var(--hover-overlay)]",
        className
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }) {
  return (
    <th
      data-slot="table-head"
      className={cn("h-10 px-4 text-left align-middle text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]", className)}
      {...props}
    />
  );
}

function TableCell({ className, ...props }) {
  return (
    <td
      data-slot="table-cell"
      className={cn("px-4 py-3 align-middle text-sm text-[var(--text-secondary)]", className)}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-[var(--text-muted)]", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
