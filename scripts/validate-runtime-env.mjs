const requiredBaseInProduction = ["SESSION_SECRET"];

const requiredSplitDatabaseVars = [
  "DATABASE_HOST",
  "DATABASE_PORT",
  "DATABASE_NAME",
  "DATABASE_USER",
  "DATABASE_PASSWORD",
];

const errors = [];

if (process.env.NODE_ENV === "production") {
  for (const name of requiredBaseInProduction) {
    if (!process.env[name]?.trim()) {
      errors.push(`${name} es obligatorio en produccion.`);
    }
  }

  if (!process.env.DATABASE_URL?.trim()) {
    for (const name of requiredSplitDatabaseVars) {
      if (!process.env[name]?.trim()) {
        errors.push(`${name} es obligatorio en produccion cuando DATABASE_URL no esta definido.`);
      }
    }
  }

  const minSecretLength = Number(process.env.AUTH_MIN_SESSION_SECRET_LENGTH ?? 32);
  if ((process.env.SESSION_SECRET ?? "").trim().length < minSecretLength) {
    errors.push(`SESSION_SECRET debe tener al menos ${minSecretLength} caracteres.`);
  }

  if (!["true", "false"].includes(process.env.COOKIE_SECURE ?? "")) {
    errors.push("COOKIE_SECURE debe ser true o false en produccion.");
  }

  if (!process.env.APP_ORIGIN?.trim()) {
    console.warn("[ENV] APP_ORIGIN no esta definido; origin checks usaran el origin de la solicitud y TRUSTED_ORIGINS.");
  }
}

if (errors.length > 0) {
  console.error("[ENV] Configuracion invalida:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.info("[ENV] Configuracion runtime validada.");
