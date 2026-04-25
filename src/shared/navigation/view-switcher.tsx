"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type ViewSwitcherOption<T extends string = string> = {
  value: T;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
};

/**
 * Toggle group canónico para alternar modos de vista (tabla / tarjetas / mapa, etc.).
 *
 * Usar siempre que existan ≥ 2 representaciones de los mismos datos. Genérico
 * sobre el tipo de valor.
 */
export function ViewSwitcher<T extends string>({
  options,
  value,
  onChange,
  ariaLabel = "Cambiar vista",
  className,
}: {
  options: ViewSwitcherOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 rounded-[16px] border border-border/70 bg-card p-1",
        className,
      )}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={option.disabled}
            aria-pressed={isActive}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[12px] px-3 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              option.disabled ? "opacity-50 pointer-events-none" : null,
            )}
          >
            {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
