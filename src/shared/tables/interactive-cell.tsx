"use client";

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type InteractiveCellVariant = "link" | "badge" | "underline-text";

export type InteractiveCellProps = {
  /** Texto/contenido principal mostrado dentro del trigger. */
  label: ReactNode;
  /**
   * Acción al activar. Si se pasa, se renderiza `<button type="button">`.
   * Si se pasa también `href`, `onActivate` tiene prioridad.
   */
  onActivate?: () => void;
  /**
   * Si se pasa (y no hay `onActivate`), se renderiza un `<a>`.
   * Preferir cuando es navegación real (deep link).
   */
  href?: string;
  /**
   * Variante visual del affordance.
   * - `link`: default sobrio, underline solo en hover (texto link-like dentro de tabla)
   * - `badge`: chip con borde, soporta `isSelected` (e.g., personId clicable)
   * - `underline-text`: siempre subrayado (uso heredado, p. ej. dentro de filas con `ClickableTableRow`)
   */
  variant?: InteractiveCellVariant;
  /** Estado seleccionado (relevante para `variant="badge"`). */
  isSelected?: boolean;
  /** Estado deshabilitado. */
  disabled?: boolean;
  /** Descripción para screen readers. Cae a `label` si éste es string. */
  ariaLabel?: string;
  /**
   * Tooltip / `title`. Solo cuando el texto está truncado o la acción no es obvia.
   * No usar tooltip para compensar UI ambigua.
   */
  tooltip?: string;
  /** Truncar el contenido con ellipsis (requiere ancho del padre acotado). */
  truncate?: boolean;
  /**
   * Si está dentro de una fila clicable (`ClickableTableRow`), evitar propagación
   * para que el click sobre la celda no dispare también el click de la fila.
   */
  stopPropagation?: boolean;
  /**
   * Modo decorativo: NO renderiza botón/anchor real.
   *
   * Render como `<span>` con el estilo visual de la variante (e.g. underline en hover).
   * Útil cuando la celda vive dentro de `<ClickableTableRow>` y el click lo maneja la fila —
   * el affordance visual queda en la celda, la interacción queda en la fila.
   *
   * Si `decorative` está activo, `onActivate`, `href` y `disabled` se ignoran.
   * El `tooltip` y `ariaLabel` se aplican sobre el `<span>`.
   */
  decorative?: boolean;
  className?: string;
};

/**
 * Trigger canónico para celdas de tabla con affordance clicable.
 *
 * Usar para: abrir ficha desde texto/badge dentro de una celda específica,
 * navegar a una entidad relacionada (bloque, ciclo, persona, válvula).
 *
 * NO usar para:
 * - fila completa clicable → usar `ClickableTableRow`
 * - botones primarios fuera de tablas → usar `Button` de `@/shared/ui/button`
 * - chips de estado/categoría no interactivos → render plano (e.g. `<span class="badge">`)
 *
 * Reglas a11y:
 * - Renderiza `<button>` o `<a>` reales (Enter/Space funcionan automáticamente)
 * - Focus visible con ring
 * - Estados default / hover / active / disabled diferenciados
 * - `aria-pressed` se infiere desde `isSelected` para `variant="badge"`
 * - `title`/tooltip solo si lo pasas explícitamente; no inventarlo
 */
export function InteractiveCell({
  label,
  onActivate,
  href,
  variant = "link",
  isSelected = false,
  disabled = false,
  ariaLabel,
  tooltip,
  truncate = false,
  stopPropagation = false,
  decorative = false,
  className,
}: InteractiveCellProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    if (stopPropagation) event.stopPropagation();
    if (onActivate) onActivate();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    if (stopPropagation && (event.key === "Enter" || event.key === " ")) {
      event.stopPropagation();
    }
  };

  const baseClasses = cn(
    "inline-flex max-w-full items-center gap-1 outline-none transition-colors",
    "focus-visible:rounded-[8px] focus-visible:ring-2 focus-visible:ring-ring/40",
    disabled && "pointer-events-none opacity-50",
    truncate && "max-w-full overflow-hidden",
  );

  const variantClasses = {
    link: cn(
      "font-medium text-foreground",
      !disabled && "hover:text-primary hover:underline underline-offset-2 cursor-pointer",
    ),
    "underline-text": cn(
      "font-medium text-foreground underline-offset-4",
      !disabled && "group-hover:underline hover:underline cursor-pointer",
    ),
    badge: cn(
      "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tabular-nums transition-colors",
      isSelected
        ? "border-primary/40 bg-primary/10 text-primary"
        : "border-border/60 bg-background text-muted-foreground",
      !disabled && !isSelected && "hover:border-slate-700/35 hover:text-slate-700 dark:hover:text-white cursor-pointer",
      !disabled && isSelected && "cursor-pointer",
    ),
  }[variant];

  const labelText = typeof label === "string" ? label : undefined;
  const computedAriaLabel = ariaLabel ?? labelText;

  const content = truncate ? (
    <span className="block truncate">{label}</span>
  ) : (
    label
  );

  if (decorative) {
    return (
      <span
        title={tooltip}
        aria-label={computedAriaLabel}
        className={cn(baseClasses, variantClasses, className)}
      >
        {content}
      </span>
    );
  }

  if (href && !onActivate) {
    return (
      <a
        href={href}
        title={tooltip}
        aria-label={computedAriaLabel}
        aria-disabled={disabled || undefined}
        className={cn(baseClasses, variantClasses, className)}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      title={tooltip}
      aria-label={computedAriaLabel}
      aria-pressed={variant === "badge" ? isSelected : undefined}
      className={cn(baseClasses, variantClasses, className)}
    >
      {content}
    </button>
  );
}
