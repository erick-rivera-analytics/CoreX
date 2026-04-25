"use client";

import type { InputHTMLAttributes } from "react";

import { Label } from "@/shared/ui/label";
import { cn } from "@/lib/utils";

export type TextInputFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "value" | "onChange" | "size"
> & {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  helperText?: string;
  error?: string;
  className?: string;
};

/**
 * Campo de texto canónico con label + helper/error.
 *
 * Usar en formularios para `text|number|email|url|tel|password`. Para textarea,
 * usar `TextareaField`. Para búsqueda con icono, usar `SearchInput`.
 */
export function TextInputField({
  id,
  label,
  value,
  onChange,
  helperText,
  error,
  className,
  type = "text",
  ...rest
}: TextInputFieldProps) {
  const describedBy = error ? `${id}-error` : helperText ? `${id}-helper` : undefined;
  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-11 w-full rounded-[16px] border border-input bg-background px-4 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
          error ? "border-destructive focus-visible:ring-destructive/40" : null,
        )}
        {...rest}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">{error}</p>
      ) : helperText ? (
        <p id={`${id}-helper`} className="text-xs text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}
