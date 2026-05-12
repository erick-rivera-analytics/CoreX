import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/api/comercial/administrar-maestros/problemas-reclamo", request.url), 307);
}

export async function POST(request: NextRequest) {
  return NextResponse.redirect(new URL("/api/comercial/administrar-maestros/problemas-reclamo", request.url), 307);
}
