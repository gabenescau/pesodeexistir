"use client";

import * as React from "react";
import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { Check, Minus } from "@/lib/icons";
import { cn } from "@/lib/utils";

function Checkbox({ className, indeterminate = false, ...props }) {
  return (
    <BaseCheckbox.Root
      data-slot="checkbox"
      indeterminate={indeterminate}
      className={cn(
        "peer relative flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border border-[var(--border-strong)] bg-[var(--bg-card)]",
        "transition-colors outline-none",
        "hover:border-[var(--accent-mint)]",
        "focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-card)]",
        "data-[checked]:border-[var(--accent-mint)] data-[checked]:bg-[var(--accent-mint)]",
        "data-[indeterminate]:border-[var(--accent-mint)] data-[indeterminate]:bg-[var(--accent-mint)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <BaseCheckbox.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-[#111]"
      >
        {indeterminate ? <Minus className="size-3.5" weight="bold" /> : <Check className="size-3.5" weight="bold" />}
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );
}

export { Checkbox };
