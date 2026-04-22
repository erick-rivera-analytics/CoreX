import "server-only";

import { existsSync } from "fs";
import { resolve } from "path";
import { spawn } from "child_process";

import { listCurrentPostharvestSkus } from "@/lib/postcosecha-skus";
import type { PoscosechaSkuRecord } from "@/lib/postcosecha-sku-types";
import type {
  PoscosechaClasificacionAvailabilityRow,
  PoscosechaClasificacionLotSlot,
  PoscosechaClasificacionModeResult,
  PoscosechaClasificacionOrderRow,
  PoscosechaClasificacionOrderSlot,
  PoscosechaClasificacionRecipeInput,
  PoscosechaClasificacionRecipeResult,
  PoscosechaClasificacionResult,
  PoscosechaClasificacionRunInput,
  SolverDateKey,
} from "@/lib/postcosecha-clasificacion-en-blanco-types";
import {
  POSCOSECHA_CLASIFICACION_RUN_MODES,
} from "@/lib/postcosecha-clasificacion-en-blanco-types";
import {
  toNumber,
  toInteger,
  sanitizeSettings,
  sanitizeOrderSlots,
  sanitizeLotSlots,
  sanitizeDateValue,
  sanitizeAvailabilityRow,
  buildClasificacionPrecheck,
} from "@/lib/postcosecha-clasificacion-en-blanco-templates";

// ---------------------------------------------------------------------------
// Bridge infrastructure
// ---------------------------------------------------------------------------

const BRIDGE_SCRIPT_PATH = resolve(
  process.cwd(),
  "scripts",
  "solver_clasificacion_en_blanco_bridge.py",
);

const LEGACY_SOLVER_PYTHON = resolve(
  process.cwd(),
  "..",
  "solver_poscosecha",
  "venv",
  "Scripts",
  "python.exe",
);

function ensureSolverEngineAvailable() {
  if (!existsSync(BRIDGE_SCRIPT_PATH)) {
    throw new Error("No se encontro el puente local del solver de clasificacion en blanco.");
  }

  const envPython = process.env.POSTHARVEST_SOLVER_PYTHON?.trim() ?? "";
  const localCandidates = [
    envPython,
    resolve(process.cwd(), ".venv", "Scripts", "python.exe"),
    resolve(process.cwd(), ".venv", "bin", "python"),
    resolve(process.cwd(), "venv", "Scripts", "python.exe"),
    resolve(process.cwd(), "venv", "bin", "python"),
    LEGACY_SOLVER_PYTHON,
    "python",
    "python3",
  ].filter(Boolean);

  for (const candidate of localCandidates) {
    const looksLikePath = candidate.includes("\\") || candidate.includes("/");
    if (!looksLikePath || existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "No se encontro un interprete Python compatible para el solver de postcosecha.",
  );
}

export async function runBridge<T>(
  command: "defaults" | "solve" | "recipe",
  payload?: unknown,
) {
  const solverPython = ensureSolverEngineAvailable();

  return new Promise<T>((resolvePromise, rejectPromise) => {
    const child = spawn(solverPython, [BRIDGE_SCRIPT_PATH, command], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      rejectPromise(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        rejectPromise(new Error(stderr.trim() || "No se pudo ejecutar el solver de clasificacion en blanco."));
        return;
      }

      try {
        const parsed = JSON.parse(stdout) as T;
        resolvePromise(parsed);
      } catch (error) {
        rejectPromise(
          error instanceof Error
            ? error
            : new Error("El solver devolvio una respuesta invalida."),
        );
      }
    });

    if (payload !== undefined) {
      child.stdin.write(JSON.stringify(payload));
    }

    child.stdin.end();
  });
}

// ---------------------------------------------------------------------------
// Bridge mappers (private)
// ---------------------------------------------------------------------------

function mapMasterForBridge(skuMaster: PoscosechaSkuRecord[]) {
  return skuMaster.map((record) => ({
    sku: record.sku,
    peso_ideal_bunch: toNumber(record.pesoIdealBunch, 0),
    tallos_min: Math.max(toInteger(record.tallosMin, 0), 1),
    tallos_max: Math.max(
      toInteger(record.tallosMax, record.tallosMin),
      toInteger(record.tallosMin, 1),
    ),
    peso_min_objetivo: toNumber(record.pesoMinObjetivo, 0),
    peso_max_objetivo: toNumber(record.pesoMaxObjetivo, 0),
    max_grados_objetivo: Math.max(toInteger(record.maxGradosObjetivo, 1), 1),
  }));
}

function mapOrdersForBridge(
  orders: PoscosechaClasificacionOrderRow[],
  skuMaster: PoscosechaSkuRecord[],
) {
  const masterBySkuId = new Map(skuMaster.map((record) => [record.skuId, record]));

  return orders
    .map((row) => {
      const masterRecord = masterBySkuId.get(row.skuId);
      if (!masterRecord) return null;

      return {
        sku: masterRecord.sku,
        fecha_1: sanitizeDateValue(row.fecha_1),
        fecha_2: sanitizeDateValue(row.fecha_2),
        fecha_3: sanitizeDateValue(row.fecha_3),
        fecha_4: sanitizeDateValue(row.fecha_4),
        fecha_5: sanitizeDateValue(row.fecha_5),
      };
    })
    .filter(Boolean);
}

function mapAvailabilityForBridge(
  availability: PoscosechaClasificacionAvailabilityRow[],
) {
  return availability
    .map((row) => {
      const sanitizedRow = sanitizeAvailabilityRow(row);

      return {
        grado: sanitizedRow.grado,
        fecha_1: sanitizedRow.fecha_1,
        fecha_2: sanitizedRow.fecha_2,
        fecha_3: sanitizedRow.fecha_3,
        fecha_4: sanitizedRow.fecha_4,
        fecha_5: sanitizedRow.fecha_5,
        peso_tallo_seed: sanitizedRow.pesoTalloSeed,
      };
    })
    .filter((row) => row.grado > 0);
}

// ---------------------------------------------------------------------------
// Mode helpers (private)
// ---------------------------------------------------------------------------

function getRunLabel(mode: string) {
  return mode;
}

function getRunOriginScope(mode: string) {
  switch (mode) {
    case "GV": return "Solo GV";
    case "APERTURA": return "Solo Apertura";
    case "PRECLASIFICACION": return "Solo Preclasificacion";
    default: return mode;
  }
}

function filterOrdersByMode(
  orders: PoscosechaClasificacionOrderRow[],
  orderSlots: PoscosechaClasificacionOrderSlot[],
  mode: string,
) {
  const slotMeta = new Map(orderSlots.map((slot) => [slot.key, slot]));
  const canUseKey = (key: SolverDateKey) => {
    const slot = slotMeta.get(key);
    if (!slot?.restriction || slot.restrictionMode !== "STRICT") return true;
    return slot.restriction === mode;
  };

  return orders.map((row) => ({
    ...row,
    fecha_1: canUseKey("fecha_1") ? row.fecha_1 : 0,
    fecha_2: canUseKey("fecha_2") ? row.fecha_2 : 0,
    fecha_3: canUseKey("fecha_3") ? row.fecha_3 : 0,
    fecha_4: canUseKey("fecha_4") ? row.fecha_4 : 0,
    fecha_5: canUseKey("fecha_5") ? row.fecha_5 : 0,
  }));
}

function filterAvailabilityByMode(
  availability: PoscosechaClasificacionAvailabilityRow[],
  lotSlots: PoscosechaClasificacionLotSlot[],
  mode: string,
) {
  const slotMeta = new Map(lotSlots.map((slot) => [slot.key, slot]));
  const canUseKey = (key: SolverDateKey) => {
    const slot = slotMeta.get(key);
    return slot ? slot.origin === mode : false;
  };

  return availability.map((row) => ({
    ...row,
    fecha_1: canUseKey("fecha_1") ? row.fecha_1 : 0,
    fecha_2: canUseKey("fecha_2") ? row.fecha_2 : 0,
    fecha_3: canUseKey("fecha_3") ? row.fecha_3 : 0,
    fecha_4: canUseKey("fecha_4") ? row.fecha_4 : 0,
    fecha_5: canUseKey("fecha_5") ? row.fecha_5 : 0,
  }));
}

function subtractSolvedFromRemainingOrders(
  remainingOrders: PoscosechaClasificacionOrderRow[],
  result: PoscosechaClasificacionResult | null,
) {
  if (!result) return remainingOrders;

  const solvedBySku = new Map(
    result.orderRows.map((row) => [row.sku, Math.max(toInteger(row.pedidoResuelto, 0), 0)]),
  );

  return remainingOrders.map((row) => {
    let pendingSolved = solvedBySku.get(row.sku) ?? 0;
    const nextRow = { ...row };

    for (const key of (["fecha_1", "fecha_2", "fecha_3", "fecha_4", "fecha_5"] as SolverDateKey[])) {
      if (pendingSolved <= 0) break;
      const captured = sanitizeDateValue(nextRow[key]);
      const consumed = Math.min(captured, pendingSolved);
      nextRow[key] = captured - consumed;
      pendingSolved -= consumed;
    }

    return nextRow;
  });
}

// ---------------------------------------------------------------------------
// Public runner functions
// ---------------------------------------------------------------------------

export async function runClasificacionEnBlancoSolver(
  input: PoscosechaClasificacionRunInput,
): Promise<{ runs: PoscosechaClasificacionModeResult[] }> {
  const skuMaster = await listCurrentPostharvestSkus();

  if (skuMaster.length === 0) {
    throw new Error("No hay SKU activos para ejecutar Clasificacion en blanco.");
  }

  const settings = sanitizeSettings(input.settings);
  const orderSlots = sanitizeOrderSlots(input.orderSlots ?? input.dateSlots);
  const lotSlots = sanitizeLotSlots(input.lotSlots ?? input.dateSlots);
  let remainingOrders = input.orders.map((row) => ({ ...row }));
  const runs: PoscosechaClasificacionModeResult[] = [];

  for (const mode of POSCOSECHA_CLASIFICACION_RUN_MODES) {
    const filteredOrders = filterOrdersByMode(remainingOrders, orderSlots, mode);
    const filteredAvailability = filterAvailabilityByMode(input.availability, lotSlots, mode);
    const precheck = buildClasificacionPrecheck(
      filteredOrders,
      filteredAvailability,
      skuMaster,
      settings.desperdicio,
      orderSlots,
      lotSlots,
      mode,
    );

    let result: PoscosechaClasificacionResult | null = null;

    if (precheck.isValid) {
      result = await runBridge<PoscosechaClasificacionResult>("solve", {
        master: mapMasterForBridge(skuMaster),
        orders: mapOrdersForBridge(filteredOrders, skuMaster),
        availability: mapAvailabilityForBridge(filteredAvailability),
        settings,
      });
      remainingOrders = subtractSolvedFromRemainingOrders(remainingOrders, result);
    }

    runs.push({
      mode,
      label: getRunLabel(mode),
      originScope: getRunOriginScope(mode),
      precheck,
      result,
    });
  }

  if (runs.every((run) => !run.precheck.isValid)) {
    throw new Error(runs[0]?.precheck.message ?? "No se pudo ejecutar Clasificacion en blanco.");
  }

  return { runs };
}

export async function runClasificacionEnBlancoRecipeSolver(
  input: PoscosechaClasificacionRecipeInput,
): Promise<PoscosechaClasificacionRecipeResult> {
  if (!input.sku.trim()) {
    throw new Error("Debes indicar el SKU para construir la receta.");
  }

  if (toInteger(input.pedidoResuelto, 0) <= 0) {
    throw new Error("El SKU seleccionado no tiene bunches resueltos.");
  }

  if (!input.grados.length) {
    throw new Error("No hay tallos netos por grado para construir la receta.");
  }

  return runBridge<PoscosechaClasificacionRecipeResult>("recipe", {
    sku: input.sku,
    pedidoResuelto: Math.max(toInteger(input.pedidoResuelto, 0), 0),
    pesoIdealBunch: Math.max(toNumber(input.pesoIdealBunch, 0), 0),
    pesoMinObjetivo: Math.max(toNumber(input.pesoMinObjetivo, 0), 0),
    pesoMaxObjetivo: Math.max(toNumber(input.pesoMaxObjetivo, 0), 0),
    tallosMin: Math.max(toInteger(input.tallosMin, 0), 0),
    tallosMax: Math.max(toInteger(input.tallosMax, 0), 0),
    tallosAsignadosNetos: Math.max(toInteger(input.tallosAsignadosNetos, 0), 0),
    tallosPromedioRamo: Math.max(toNumber(input.tallosPromedioRamo, 0), 0),
    grados: input.grados.map((row) => ({
      grado: Math.max(toInteger(row.grado, 0), 0),
      tallosNetos: Math.max(toInteger(row.tallosNetos, 0), 0),
      pesoTalloSeed: Math.max(toNumber(row.pesoTalloSeed, 0), 0),
    })),
  });
}
