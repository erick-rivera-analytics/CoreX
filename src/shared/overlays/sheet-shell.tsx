"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

export function SheetShell({
  open = true,
  title,
  description,
  onClose,
  children,
  side = "right",
  widthClassName = "max-w-3xl",
  headerActions,
  footer,
}: {
  open?: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  side?: "right" | "left";
  widthClassName?: string;
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
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
    <div className="fixed inset-0 z-[70]" aria-modal="true" role="dialog">
      <button
        type="button"
        aria-label="Cerrar panel"
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "absolute inset-y-0 flex w-full max-w-full px-2 py-2 sm:px-3 sm:py-3",
          side === "right" ? "right-0 justify-end" : "left-0 justify-start",
        )}
      >
        <div
          className={cn(
            "flex h-full w-full flex-col overflow-hidden rounded-[24px] border border-border/80 bg-card shadow-[0_24px_80px_-32px_rgba(15,23,42,0.45)]",
            widthClassName,
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-border/70 bg-card/96 px-5 py-4 backdrop-blur">
            <div className="min-w-0 flex-1">
              {title ? <h2 className="text-base font-semibold tracking-tight">{title}</h2> : null}
              {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {headerActions}
              <button
                type="button"
                onClick={onClose}
                className="flex size-9 items-center justify-center rounded-[12px] border border-transparent text-muted-foreground transition-colors hover:border-border/70 hover:bg-muted/60 hover:text-foreground"
                aria-label="Cerrar"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {children}
          </div>

          {footer ? (
            <div className="sticky bottom-0 z-10 border-t border-border/70 bg-card/96 px-5 py-4 backdrop-blur">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
