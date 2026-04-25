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

  // ── Vars opcionales pero recomendadas en produccion (WARN, no FAIL) ─────
  // Su ausencia no bloquea startup, pero produce fallos silenciosos en
  // endpoints/modulos especificos. Logueamos para que ops detecte rapido.
  const recommendedInProduction = [
    {
      name: "TRUSTED_ORIGINS",
      hint: "Sin esta lista, origin checks dependen solo de APP_ORIGIN; recomendado para multi-host.",
    },
    {
      name: "API_ORIGIN_CHECK_ENABLED",
      hint: "Si no esta en 'true', mutaciones POST/PUT/PATCH/DELETE no validan origin/referer.",
    },
    {
      name: "LOG_LEVEL",
      hint: "Sin esta var el logger usa default; recomendado fijar 'info' o 'warn' en produccion.",
    },
    {
      name: "LOG_FORMAT",
      hint: "Recomendado fijar 'json' en produccion para parseo de logs.",
    },
    {
      name: "POSTHARVEST_DATABASE_NAME",
      hint: "Necesario para los modulos de postcosecha (balanzas, solver, registros).",
    },
    {
      name: "CAMP_DATABASE_NAME",
      hint: "Necesario para el pool db_camp usado por el modulo Campo.",
    },
  ];

  for (const { name, hint } of recommendedInProduction) {
    if (!process.env[name]?.trim()) {
      console.warn(`[ENV] ${name} no esta definido. ${hint}`);
    }
  }

  // Solver Python: solo WARN si POSTHARVEST_AUTO_SEED esta activo o si el
  // modulo solver es alcanzable. No tenemos forma simple de detectar el
  // segundo, asi que avisamos siempre con tono informativo.
  if (!process.env.POSTHARVEST_SOLVER_PYTHON?.trim()) {
    console.warn("[ENV] POSTHARVEST_SOLVER_PYTHON no esta definido; el modulo Solver clasificacion en blanco fallara si se usa.");
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
