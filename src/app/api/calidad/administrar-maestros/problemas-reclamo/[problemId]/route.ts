import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ problemId: string }> },
) {
  const { problemId } = await context.params;
  return NextResponse.redirect(new URL(`/api/comercial/administrar-maestros/problemas-reclamo/${encodeURIComponent(problemId)}`, request.url), 307);
}
