"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { PostharvestProductivityFilters } from "@/lib/postcosecha-productividad-contract";
import { ExportButton } from "@/shared/ui/export-button";

export function PostcosechaProductividadPdfExportButton({
  filters,
}: {
  filters: PostharvestProductivityFilters;
}) {
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  async function handleExportPdf() {
    if (isExportingPdf) return;
    setIsExportingPdf(true);

    try {
      const response = await fetch("/api/postcosecha/productividad/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? "Error al generar el PDF");
      }

      const disposition = response.headers.get("content-disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? `reporte_productividad_postcosecha_${Date.now()}.pdf`;

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al generar el PDF");
    } finally {
      setIsExportingPdf(false);
    }
  }

  return (
    <ExportButton
      formats={["pdf"]}
      disabled={isExportingPdf}
      label={isExportingPdf ? "Exportando..." : "Exportar PDF"}
      ariaLabel="Exportar PDF de productividad de postcosecha"
      onExport={() => handleExportPdf()}
    />
  );
}
