import { type NextRequest } from "next/server";

import { handleQualitySimpleMasterGet, handleQualitySimpleMasterPost } from "@/lib/quality-master-api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleQualitySimpleMasterGet(request, "commercializers", "No se pudo cargar el maestro de comercializadoras.");
}

export async function POST(request: NextRequest) {
  return handleQualitySimpleMasterPost(request, {
    kind: "commercializers",
    rateKey: "sales-commercializers",
    fallbackActorId: "corex_sales_masters_ui",
    createErrorMessage: "No se pudo crear la comercializadora.",
  });
}
