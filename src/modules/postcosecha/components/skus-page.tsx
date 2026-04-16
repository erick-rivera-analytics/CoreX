"use client";

import { PoscosechaSkusExplorer } from "@/modules/postcosecha/components/skus-explorer";
import type { PoscosechaSkuRecord } from "@/lib/postcosecha-sku-types";

export function SkusPage({
  initialData,
  initialError,
}: {
  initialData: PoscosechaSkuRecord[];
  initialError?: string | null;
}) {
  return <PoscosechaSkusExplorer initialData={initialData} initialError={initialError} />;
}
