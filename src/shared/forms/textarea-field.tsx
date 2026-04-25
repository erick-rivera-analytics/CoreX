"use client";

import type { TextareaHTMLAttributes } from "react";

import { Label } from "@/shared/ui/label";
import { cn } from "@/lib/utils";

export type TextareaFieldProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "id" | "value" | "onChange"
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
 * Campo `textarea` canónico con label + helper/error.
 */
export function TextareaField({
  id,
  label,
  value,
  onChange,
  helperText,
  error,
  rows = 4,
  className,
  ...rest
}: TextareaFieldProps) {
  const describedBy = error ? `${id}-error` : helperText ? `${id}-helper` : undefined;
  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "w-full rounded-[16px] border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
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
