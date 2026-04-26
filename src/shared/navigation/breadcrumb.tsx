"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

/**
 * Migas de pan canónicas. Última entrada se renderiza como texto, anteriores como link.
 */
export function Breadcrumb({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <nav aria-label="Migas de pan" className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={item.href ?? item.label} className="inline-flex items-center gap-1">
            {item.href && !isLast ? (
              <Link href={item.href} className="transition-colors hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-foreground" : undefined} aria-current={isLast ? "page" : undefined}>
                {item.label}
              </span>
            )}
            {!isLast ? <ChevronRight className="size-3.5 text-muted-foreground/70" aria-hidden="true" /> : null}
          </span>
        );
      })}
    </nav>
  );
}
