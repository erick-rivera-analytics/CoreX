"use client";

import { useState } from "react";
import { toast } from "sonner";

import { ExportButton } from "@/shared/ui/export-button";
import type { PuntoAperturaFilters } from "@/lib/calidad-punto-apertura";

export function PuntoAperturaPdfExportButton({ filters }: { filters: PuntoAperturaFilters }) {
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  async function handleExportPdf() {
    if (isExportingPdf) return;
    setIsExportingPdf(true);

    try {
      const response = await fetch("/api/calidad/punto-apertura/pdf", {
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
      const filename = match?.[1] ?? `reporte_gerencial_punto_apertura_${Date.now()}.pdf`;

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
      ariaLabel="Exportar PDF de punto de apertura"
      onExport={() => handleExportPdf()}
    />
  );
}
