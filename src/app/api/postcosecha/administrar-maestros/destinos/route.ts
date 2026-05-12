import { type NextRequest } from "next/server";

import {
  handlePostharvestDestinationGet,
  handlePostharvestDestinationPost,
} from "@/lib/postcosecha-destination-api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handlePostharvestDestinationGet(request, "No se pudo cargar el maestro de destinos.");
}

export async function POST(request: NextRequest) {
  return handlePostharvestDestinationPost(request, {
    rateKey: "postharvest-destinations",
    fallbackActorId: "corex_postharvest_masters_ui",
    createErrorMessage: "No se pudo crear el destino.",
  });
}
