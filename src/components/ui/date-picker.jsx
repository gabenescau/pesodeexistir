"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CalendarBlank, CaretLeft, CaretRight } from "@/lib/icons";

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, count) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function buildGrid(monthDate) {
  const first = startOfMonth(monthDate);
  const firstWeekday = first.getDay();
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function Calendar({ selected, onSelect, month, onMonthChange, className }) {
  const [internalMonth, setInternalMonth] = React.useState(() => startOfMonth(selected || new Date()));
  const viewMonth = month || internalMonth;
  const setViewMonth = (next) => {
    if (onMonthChange) onMonthChange(next);
    if (!month) setInternalMonth(next);
  };

  const cells = buildGrid(viewMonth);
  const today = startOfDay(new Date());

  return (
    <div className={cn("w-[280px] rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-3 shadow-[0_18px_45px_rgba(0,0,0,.3)]", className)}>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Mes anterior"
          onClick={() => setViewMonth(addMonths(viewMonth, -1))}
          className="flex size-8 items-center justify-center rounded-[8px] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
        >
          <CaretLeft className="size-4" weight="bold" />
        </button>
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          {MONTH_LABELS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </p>
        <button
          type="button"
          aria-label="Proximo mes"
          onClick={() => setViewMonth(addMonths(viewMonth, 1))}
          className="flex size-8 items-center justify-center rounded-[8px] text-[var(--text-muted)] hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
        >
          <CaretRight className="size-4" weight="bold" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="py-1">{label}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((date, index) => {
          if (!date) return <span key={`empty-${index}`} />;
          const isSelected = isSameDay(date, selected);
          const isToday = isSameDay(date, today);
          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => onSelect?.(date)}
              className={cn(
                "flex size-8 items-center justify-center rounded-[8px] text-xs transition-colors",
                isSelected
                  ? "bg-[var(--accent-mint)] text-white font-semibold"
                  : isToday
                    ? "border border-[var(--accent-mint)] text-[var(--text-primary)]"
                    : "text-[var(--text-primary)] hover:bg-[var(--hover-overlay)]"
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DatePicker({ value, onChange, placeholder = "Selecionar data", className, id }) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef(null);
  const selected = value ? new Date(`${value}T00:00:00`) : null;

  React.useEffect(() => {
    if (!open) return undefined;
    function onClick(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const formatted = selected
    ? selected.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : placeholder;

  function handleSelect(date) {
    if (!date) return;
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    onChange?.(iso);
    setOpen(false);
  }

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <button
        id={id}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--bg-card)] px-3 text-sm transition-colors",
          "hover:border-[var(--border-strong)] focus:border-[var(--border-strong)] focus:outline-none",
          !selected && "text-[var(--text-placeholder)]"
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={cn(selected && "text-[var(--text-primary)]")}>{formatted}</span>
        <CalendarBlank className="size-4 text-[var(--text-muted)]" />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2">
          <Calendar selected={selected} onSelect={handleSelect} />
        </div>
      ) : null}
    </div>
  );
}
