import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await context.params;
  return NextResponse.redirect(new URL(`/api/postcosecha/administrar-maestros/destinos/${encodeURIComponent(entityId)}`, request.url), 307);
}
