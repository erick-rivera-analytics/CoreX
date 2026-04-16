import { randomUUID } from "crypto";

export function createRequestId(): string {
  return randomUUID();
}

export function getRequestId(request?: Request): string {
  return request?.headers.get("x-request-id")?.trim() || createRequestId();
}
