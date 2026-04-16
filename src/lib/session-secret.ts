import crypto from "crypto";

const DEV_SECRET_NAMESPACE = "corex-dev-session-secret";
const DEFAULT_MIN_SECRET_LENGTH = 32;

export function resolveSessionSecret() {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured) {
    const minLength = Number(process.env.AUTH_MIN_SESSION_SECRET_LENGTH ?? DEFAULT_MIN_SECRET_LENGTH);
    if (process.env.NODE_ENV === "production" && configured.length < minLength) {
      throw new Error(`SESSION_SECRET debe tener al menos ${minLength} caracteres en produccion.`);
    }
    return configured;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET es obligatorio en produccion.");
  }

  return crypto
    .createHash("sha256")
    .update(`${DEV_SECRET_NAMESPACE}:${process.cwd()}`)
    .digest("hex");
}

export function resolvePreviousSessionSecret() {
  const configured = process.env.SESSION_SECRET_PREVIOUS?.trim();
  return configured || null;
}
