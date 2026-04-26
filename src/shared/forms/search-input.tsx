"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type SearchInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  /** Debounce in ms before notifying onChange (0 = sync). */
  debounceMs?: number;
  className?: string;
  disabled?: boolean;
};

/**
 * Input de búsqueda canónico con icono leading, botón clear y debounce opcional.
 *
 * Para filtros de tabla, búsqueda en listas, autocomplete simple. Si necesitas
 * tipo dropdown con opciones, usar `MultiSelectField` o `SingleSelectField`.
 */
export function SearchInput({
  id,
  value,
  onChange,
  placeholder = "Buscar…",
  ariaLabel = "Buscar",
  debounceMs = 0,
  className,
  disabled,
}: SearchInputProps) {
  const [internal, setInternal] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sincroniza prop → buffer interno SIN useEffect (anti-pattern derived-state).
  // Patrón oficial React 19 "store-info-from-previous-render":
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  if (prevValue !== value) {
    setPrevValue(value);
    setInternal(value);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = (next: string) => {
    setInternal(next);
    if (debounceMs > 0) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onChange(next), debounceMs);
    } else {
      onChange(next);
    }
  };

  const handleClear = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setInternal("");
    onChange("");
  };

  return (
    <div className={cn("relative min-w-0", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        id={id}
        type="search"
        value={internal}
        onChange={(event) => handleChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        className="h-11 w-full rounded-[16px] border border-input bg-background pl-10 pr-10 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
      />
      {internal ? (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Limpiar búsqueda"
          className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
