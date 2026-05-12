import { type NextRequest } from "next/server";

import { handleCommercialSimpleMasterGet, handleCommercialSimpleMasterPost } from "@/lib/commercial-master-api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleCommercialSimpleMasterGet(request, "customers", "No se pudo cargar el maestro de clientes.");
}

export async function POST(request: NextRequest) {
  return handleCommercialSimpleMasterPost(request, {
    kind: "customers",
    rateKey: "commercial-customers",
    fallbackActorId: "corex_commercial_masters_ui",
    createErrorMessage: "No se pudo crear el cliente.",
  });
}
