import { type NextRequest } from "next/server";

import { handleCommercialClaimProblemGet, handleCommercialClaimProblemPost } from "@/lib/commercial-master-api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleCommercialClaimProblemGet(request, "No se pudo cargar el arbol de problemas de reclamo.");
}

export async function POST(request: NextRequest) {
  return handleCommercialClaimProblemPost(request, {
    rateKey: "commercial-claim-problems",
    fallbackActorId: "corex_commercial_masters_ui",
    createErrorMessage: "No se pudo crear el problema de reclamo.",
  });
}
