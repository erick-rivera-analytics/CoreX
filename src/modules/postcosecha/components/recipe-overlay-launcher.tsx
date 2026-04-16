"use client";

import { PoscosechaClasificacionRecipeOverlay } from "@/modules/postcosecha/components/clasificacion-en-blanco-recipe-overlay";
import type { PoscosechaClasificacionRecipeResult } from "@/lib/postcosecha-clasificacion-en-blanco-types";

export function RecipeOverlayLauncher({
  sku,
  data,
  isLoading,
  error,
  onClose,
}: {
  sku: string | null;
  data: PoscosechaClasificacionRecipeResult | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  if (!sku) {
    return null;
  }

  return (
    <PoscosechaClasificacionRecipeOverlay
      sku={sku}
      data={data}
      isLoading={isLoading}
      error={error}
      onClose={onClose}
    />
  );
}
