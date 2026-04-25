"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import { ActionMenu, type ActionMenuItem } from "@/shared/ui/action-menu";
import { Button } from "@/shared/ui/button";
import { cn } from "@/lib/utils";

export type ExportFormat = "csv" | "xlsx" | "pdf";

const FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: "CSV",
  xlsx: "Excel (XLSX)",
  pdf: "PDF",
};

/**
 * Botón canónico de exportación.
 *
 * Si se ofrece más de un formato, expone un dropdown. Si solo hay uno, es un
 * botón directo. La lógica de generación queda en el caller (`onExport(format)`).
 */
export function ExportButton({
  formats = ["csv"],
  onExport,
  label = "Exportar",
  ariaLabel = "Exportar",
  disabled,
  className,
}: {
  formats?: ExportFormat[];
  onExport: (format: ExportFormat) => Promise<void> | void;
  label?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [pending, setPending] = useState<ExportFormat | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setPending(format);
    try {
      await onExport(format);
    } finally {
      setPending(null);
    }
  };

  if (formats.length <= 1) {
    const single = formats[0] ?? "csv";
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => handleExport(single)}
        disabled={disabled || pending !== null}
        aria-label={ariaLabel}
        className={cn(className)}
      >
        <Download className="size-4" />
        {pending === single ? "Exportando…" : label}
      </Button>
    );
  }

  const items: ActionMenuItem[] = formats.map((format) => ({
    label: FORMAT_LABELS[format],
    onSelect: () => void handleExport(format),
    disabled: pending !== null,
  }));

  return (
    <div className={cn("inline-flex", className)}>
      <ActionMenu items={items} ariaLabel={ariaLabel} align="end" triggerClassName="size-11 px-3 w-auto rounded-[16px] border border-border/70 bg-background hover:bg-muted/70" />
    </div>
  );
}
