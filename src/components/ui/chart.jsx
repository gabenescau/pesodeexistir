// Graficos SVG minimos para o painel admin: nao puxa biblioteca externa para
// manter o bundle pequeno. Aceitam series simples ({ label, value }) e
// renderizam barras, pizza e linha com a mesma paleta do app.
import * as React from "react";
import { cn } from "@/lib/utils";

const PALETTE = ["#0066cc", "#2997ff", "#0071e3", "#10b981", "#f59e0b", "#ef4444", "#7a7a7a", "#1d1d1f"];

function pickColor(index) {
  return PALETTE[index % PALETTE.length];
}

export function BarChart({ data, height = 180, className, formatValue = (v) => v }) {
  const max = Math.max(1, ...data.map((item) => item.value || 0));
  return (
    <div className={cn("w-full", className)}>
      <div className="flex w-full items-end gap-1.5" style={{ height }}>
        {data.map((item, index) => {
          const ratio = (item.value || 0) / max;
          return (
            <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="text-[10px] font-medium text-[var(--text-muted)]">{formatValue(item.value)}</span>
              <div
                className="w-full rounded-t-[4px]"
                style={{
                  height: `${Math.max(2, ratio * (height - 30))}px`,
                  background: pickColor(index),
                  opacity: 0.85,
                }}
              />
              <span className="line-clamp-1 w-full text-center text-[10px] text-[var(--text-muted)]">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DonutChart({ data, size = 140, className, label }) {
  const total = data.reduce((sum, item) => sum + (item.value || 0), 0) || 1;
  const radius = size / 2 - 14;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth="14"
          />
          {data.map((item, index) => {
            const ratio = (item.value || 0) / total;
            const length = ratio * circumference;
            const segment = (
              <circle
                key={item.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={pickColor(index)}
                strokeWidth="14"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                strokeLinecap="butt"
              />
            );
            offset += length;
            return segment;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold text-[var(--text-primary)]">{total}</span>
          {label ? <span className="text-[10px] text-[var(--text-muted)]">{label}</span> : null}
        </div>
      </div>
      <ul className="flex w-full flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-muted)]">
        {data.map((item, index) => (
          <li key={item.label} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: pickColor(index) }} />
            <span className="truncate">{item.label}</span>
            <span className="text-[var(--text-secondary)]">{item.value || 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LineChart({ data, height = 160, className, color = "#0066cc" }) {
  if (!data?.length) return null;
  const max = Math.max(1, ...data.map((item) => item.value || 0));
  const width = 100;
  const stepX = data.length > 1 ? width / (data.length - 1) : width;
  const points = data.map((item, index) => {
    const x = index * stepX;
    const y = 100 - ((item.value || 0) / max) * 100;
    return [x, y];
  });
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const areaPath = `${path} L100,100 L0,100 Z`;

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <svg
        viewBox={`0 0 100 100`}
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible"
      >
        <path d={areaPath} fill={color} opacity="0.15" />
        <path d={path} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {points.map(([x, y], index) => (
          <circle key={index} cx={x} cy={y} r="1.4" fill={color} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-[var(--text-muted)]">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}
