"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type ActionMenuItem = {
  label: string;
  onSelect: () => void;
  icon?: LucideIcon;
  tone?: "neutral" | "danger";
  disabled?: boolean;
  /** Si true, agrega un divider visual antes de este item. */
  divider?: boolean;
};

/**
 * Menú de acciones canónico (botón 3-puntos con dropdown).
 *
 * Para acciones por fila (editar, duplicar, eliminar), por entidad o agrupadas
 * en toolbars. Se cierra con click fuera, Escape o tras seleccionar un item.
 */
export function ActionMenu({
  items,
  ariaLabel = "Más acciones",
  align = "end",
  className,
  triggerClassName,
}: {
  items: ActionMenuItem[];
  ariaLabel?: string;
  align?: "start" | "end";
  className?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex size-9 items-center justify-center rounded-[12px] border border-transparent text-muted-foreground transition-colors hover:border-border/70 hover:bg-muted/60 hover:text-foreground",
          triggerClassName,
        )}
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute z-[80] mt-1 min-w-[180px] overflow-hidden rounded-[14px] border border-border/70 bg-card shadow-[var(--shadow-dropdown)]",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, index) => {
            const Icon = item.icon;
            const danger = item.tone === "danger";
            return (
              <div key={`${item.label}-${index}`}>
                {item.divider && index !== 0 ? (
                  <div role="separator" className="my-1 border-t border-border/60" />
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors",
                    danger
                      ? "text-destructive hover:bg-destructive/10"
                      : "text-foreground hover:bg-muted/60",
                    item.disabled ? "pointer-events-none opacity-60" : null,
                  )}
                >
                  {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
                  <span>{item.label}</span>
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
