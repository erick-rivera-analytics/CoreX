"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

export function DialogShell({
  open = true,
  title,
  description,
  onClose,
  maxWidth = "max-w-4xl",
  children,
  headerActions,
}: {
  open?: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  maxWidth?: string;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
      <div
        className={cn(
          "relative flex max-h-[min(90dvh,960px)] w-full flex-col overflow-hidden rounded-[20px] border border-border/80 bg-card shadow-[var(--shadow-overlay)]",
          maxWidth,
        )}
        onClick={(event) => event.stopPropagation()}
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
