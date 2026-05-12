import { type NextRequest } from "next/server";

import { handleQualitySimpleMasterGet, handleQualitySimpleMasterPost } from "@/lib/quality-master-api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleQualitySimpleMasterGet(request, "account-executives", "No se pudo cargar el maestro de ejecutivos de cuenta.");
}

export async function POST(request: NextRequest) {
  return handleQualitySimpleMasterPost(request, {
    kind: "account-executives",
    rateKey: "sales-account-executives",
    fallbackActorId: "corex_sales_masters_ui",
    createErrorMessage: "No se pudo crear el ejecutivo de cuenta.",
  });
}
