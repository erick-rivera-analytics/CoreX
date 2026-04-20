"use client";

import { ChevronDown } from "lucide-react";

import { Label } from "@/shared/ui/label";
import { cn } from "@/lib/utils";

export type SingleSelectFieldProps = {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  emptyLabel?: string;
  emptyValue?: string;
  displayValue?: (option: string) => string;
  className?: string;
};

export function SingleSelectField({
  id,
  label,
  value,
  options,
  onChange,
  emptyLabel = "Todos",
  emptyValue,
  displayValue,
  className,
}: SingleSelectFieldProps) {
  const resolvedEmptyValue = emptyValue ?? (emptyLabel === "Todos" ? "all" : "");
  const getDisplay = (option: string) => displayValue?.(option) ?? option;
  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full appearance-none rounded-[16px] border border-input bg-background px-4 pr-10 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <option value={resolvedEmptyValue}>{emptyLabel}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {getDisplay(option)}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  );
}
