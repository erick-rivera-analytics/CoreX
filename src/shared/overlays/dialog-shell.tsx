"use client";

import { useEffect } from "react";

import { cn } from "@/lib/utils";

/**
 * Tier de z-index canonico del DialogShell.
 *
 * - `primary` (default): `z-[60]` - para modales sobre la pagina.
 * - `secondary`: `z-[70]` - para modales que se abren ENCIMA de otro modal
 *   primary. Caso tipico: la ficha de persona abierta desde dentro de
 *   `HoursCamaOverlay` (que ya es un DialogShell primary).
 *
 * Nota: el tier numerico esta alineado con `--z-modal-primary`/`--z-modal-secondary`
 * en `globals.css`.
 */
export type DialogShellPriority = "primary" | "secondary";

export function DialogShell({
  open = true,
  title,
  description,
  onClose,
  maxWidth = "max-w-4xl",
  children,
  headerActions,
  priority = "primary",
}: {
  open?: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  maxWidth?: string;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  priority?: DialogShellPriority;
}) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center p-4",
        priority === "secondary" ? "z-[70]" : "z-[60]",
      )}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? undefined}
    >
      <button
        type="button"
        aria-label={title ? `Cerrar ${title}` : "Cerrar dialogo"}
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative flex max-h-[min(90dvh,960px)] w-full flex-col overflow-hidden rounded-[20px] border border-border/80 bg-card shadow-[var(--shadow-overlay)]",
          maxWidth,
        )}
      >
        {(title || description || headerActions) ? (
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border/70 bg-card/96 px-5 py-4 backdrop-blur">
            <div className="min-w-0">
              {title ? <h2 className="text-base font-semibold tracking-tight">{title}</h2> : null}
              {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
            </div>
            {headerActions ? <div className="shrink-0">{headerActions}</div> : null}
          </div>
        ) : null}
        <div className="min-h-0 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
