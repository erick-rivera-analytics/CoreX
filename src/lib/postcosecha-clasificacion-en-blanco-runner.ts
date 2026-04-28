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

const SOFT_MODE_MIN_COMPLIANCE = 0.97;
const SOFT_SKU_TARGET_MIN_PCT = -0.03;

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

function slotCanBeSolvedByMode(
  slot: PoscosechaClasificacionOrderSlot | undefined,
  mode: PoscosechaClasificacionRunMode,
) {
  if (!slot?.restriction || slot.restrictionMode !== "STRICT") return true;
  return slot.restriction === mode;
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

function pickDateKeysByMode(
  orderSlots: PoscosechaClasificacionOrderSlot[],
  mode: string,
  predicate: (slot: PoscosechaClasificacionOrderSlot | undefined) => boolean,
) {
  const slotMeta = new Map(orderSlots.map((slot) => [slot.key, slot]));
  return (["fecha_1", "fecha_2", "fecha_3", "fecha_4", "fecha_5"] as SolverDateKey[]).filter((key) =>
    predicate(slotMeta.get(key)) && slotCanBeSolvedByMode(slotMeta.get(key), mode as PoscosechaClasificacionRunMode),
  );
}

function buildStrictOrdersByMode(
  orders: PoscosechaClasificacionOrderRow[],
  orderSlots: PoscosechaClasificacionOrderSlot[],
  mode: PoscosechaClasificacionRunMode,
) {
  const strictKeys = new Set(
    pickDateKeysByMode(orderSlots, mode, (slot) => Boolean(slot?.restriction && slot.restrictionMode === "STRICT")),
  );

  return orders.map((row) => ({
    ...row,
    fecha_1: strictKeys.has("fecha_1") ? row.fecha_1 : 0,
    fecha_2: strictKeys.has("fecha_2") ? row.fecha_2 : 0,
    fecha_3: strictKeys.has("fecha_3") ? row.fecha_3 : 0,
    fecha_4: strictKeys.has("fecha_4") ? row.fecha_4 : 0,
    fecha_5: strictKeys.has("fecha_5") ? row.fecha_5 : 0,
  }));
}

function buildSoftOrdersByMode(
  orders: PoscosechaClasificacionOrderRow[],
  orderSlots: PoscosechaClasificacionOrderSlot[],
  mode: PoscosechaClasificacionRunMode,
) {
  const softKeys = new Set(
    pickDateKeysByMode(orderSlots, mode, (slot) => !slot?.restriction || slot.restrictionMode !== "STRICT"),
  );

  return orders.map((row) => ({
    ...row,
    fecha_1: softKeys.has("fecha_1") ? row.fecha_1 : 0,
    fecha_2: softKeys.has("fecha_2") ? row.fecha_2 : 0,
    fecha_3: softKeys.has("fecha_3") ? row.fecha_3 : 0,
    fecha_4: softKeys.has("fecha_4") ? row.fecha_4 : 0,
    fecha_5: softKeys.has("fecha_5") ? row.fecha_5 : 0,
  }));
}

function countOrderDemand(rows: PoscosechaClasificacionOrderRow[]) {
  return rows.reduce(
    (total, row) =>
      total
      + sanitizeDateValue(row.fecha_1)
      + sanitizeDateValue(row.fecha_2)
      + sanitizeDateValue(row.fecha_3)
      + sanitizeDateValue(row.fecha_4)
      + sanitizeDateValue(row.fecha_5),
    0,
  );
}

function mergeOrderDemand(
  strictOrders: PoscosechaClasificacionOrderRow[],
  softOrders: PoscosechaClasificacionOrderRow[],
) {
  return strictOrders.map((row, index) => ({
    ...row,
    fecha_1: sanitizeDateValue(row.fecha_1) + sanitizeDateValue(softOrders[index]?.fecha_1),
    fecha_2: sanitizeDateValue(row.fecha_2) + sanitizeDateValue(softOrders[index]?.fecha_2),
    fecha_3: sanitizeDateValue(row.fecha_3) + sanitizeDateValue(softOrders[index]?.fecha_3),
    fecha_4: sanitizeDateValue(row.fecha_4) + sanitizeDateValue(softOrders[index]?.fecha_4),
    fecha_5: sanitizeDateValue(row.fecha_5) + sanitizeDateValue(softOrders[index]?.fecha_5),
  }));
}

function clampSoftDemand(
  softOrders: PoscosechaClasificacionOrderRow[],
  keepDemand: number,
) {
  const nextRows = softOrders.map((row) => ({ ...row }));
  let excess = Math.max(countOrderDemand(nextRows) - Math.max(keepDemand, 0), 0);

  for (const key of ["fecha_5", "fecha_4", "fecha_3", "fecha_2", "fecha_1"] as SolverDateKey[]) {
    for (let rowIndex = nextRows.length - 1; rowIndex >= 0 && excess > 0; rowIndex -= 1) {
      const captured = sanitizeDateValue(nextRows[rowIndex][key]);
      if (captured <= 0) continue;
      const consumed = Math.min(captured, excess);
      nextRows[rowIndex][key] = captured - consumed;
      excess -= consumed;
    }
  }

  return nextRows;
}

function countRowDemand(row: PoscosechaClasificacionOrderRow) {
  return (
    sanitizeDateValue(row.fecha_1)
    + sanitizeDateValue(row.fecha_2)
    + sanitizeDateValue(row.fecha_3)
    + sanitizeDateValue(row.fecha_4)
    + sanitizeDateValue(row.fecha_5)
  );
}

function reduceOneSoftBunchForSku(
  softOrders: PoscosechaClasificacionOrderRow[],
  sku: string,
) {
  const nextRows = softOrders.map((row) => ({ ...row }));
  const rowIndex = nextRows.findIndex((row) => row.sku === sku);
  if (rowIndex < 0) return null;

  for (const key of ["fecha_5", "fecha_4", "fecha_3", "fecha_2", "fecha_1"] as SolverDateKey[]) {
    const captured = sanitizeDateValue(nextRows[rowIndex][key]);
    if (captured <= 0) continue;
    nextRows[rowIndex][key] = captured - 1;
    return nextRows;
  }

  return null;
}

function reduceSoftDemandForSku(
  softOrders: PoscosechaClasificacionOrderRow[],
  sku: string,
  amount: number,
) {
  let remaining = Math.max(amount, 0);
  if (remaining <= 0) return softOrders.map((row) => ({ ...row }));

  const nextRows = softOrders.map((row) => ({ ...row }));
  const rowIndex = nextRows.findIndex((row) => row.sku === sku);
  if (rowIndex < 0) return null;

  for (const key of ["fecha_5", "fecha_4", "fecha_3", "fecha_2", "fecha_1"] as SolverDateKey[]) {
    if (remaining <= 0) break;
    const captured = sanitizeDateValue(nextRows[rowIndex][key]);
    if (captured <= 0) continue;
    const consumed = Math.min(captured, remaining);
    nextRows[rowIndex][key] = captured - consumed;
    remaining -= consumed;
  }

  return remaining > 0 ? null : nextRows;
}

function getWorstSkuDeviation(result: PoscosechaClasificacionResult | null) {
  if (!result) return null;

  const rows = result.orderRows
    .filter((row) => Number(row.pedidoResuelto ?? 0) > 0)
    .map((row) => ({
      sku: row.sku,
      pct: Number(row.sobrepesoPct ?? 0),
      absPct: Math.abs(Number(row.sobrepesoPct ?? 0)),
    }))
    .sort((left, right) => right.absPct - left.absPct);

  return rows[0] ?? null;
}

function getUnderTargetSkus(result: PoscosechaClasificacionResult | null) {
  if (!result) return [];

  return result.orderRows
    .filter((row) => Number(row.pedidoResuelto ?? 0) > 0 && Number(row.sobrepesoPct ?? 0) < SOFT_SKU_TARGET_MIN_PCT)
    .map((row) => ({
      sku: row.sku,
      pct: Number(row.sobrepesoPct ?? 0),
      pedidoResuelto: Math.max(toInteger(row.pedidoResuelto, 0), 0),
      pesoRealTotal: Math.max(toNumber(row.pesoRealTotal, 0), 0),
      pesoMinObjetivo: Math.max(toNumber(row.pesoMinObjetivo, 0), 0),
    }))
    .sort((left, right) => left.pct - right.pct);
}

function getSkuDeviationScore(result: PoscosechaClasificacionResult | null) {
  if (!result) {
    return {
      maxAbsPct: Number.POSITIVE_INFINITY,
      sumAbsPct: Number.POSITIVE_INFINITY,
    };
  }

  const rows = result.orderRows.filter((row) => Number(row.pedidoResuelto ?? 0) > 0);
  if (rows.length === 0) {
    return { maxAbsPct: 0, sumAbsPct: 0 };
  }

  const deviations = rows.map((row) => Math.abs(Number(row.sobrepesoPct ?? 0)));
  return {
    maxAbsPct: Math.max(...deviations),
    sumAbsPct: deviations.reduce((total, value) => total + value, 0),
  };
}

function getMacroCompliance(result: PoscosechaClasificacionResult | null) {
  const value = Number(result?.stage2Summary?.cumplimiento_peso_macro ?? 1);
  return Number.isFinite(value) ? value : 1;
}

async function solveModeOnce(
  skuMaster: PoscosechaSkuRecord[],
  orders: PoscosechaClasificacionOrderRow[],
  availability: PoscosechaClasificacionAvailabilityRow[],
  settings: ReturnType<typeof sanitizeSettings>,
) {
  return runBridge<PoscosechaClasificacionResult>("solve", {
    master: mapMasterForBridge(skuMaster),
    orders: mapOrdersForBridge(orders, skuMaster),
    availability: mapAvailabilityForBridge(availability),
    settings,
  });
}

async function solveModeWithSoftGuardrails(
  skuMaster: PoscosechaSkuRecord[],
  orders: PoscosechaClasificacionOrderRow[],
  availability: PoscosechaClasificacionAvailabilityRow[],
  settings: ReturnType<typeof sanitizeSettings>,
  orderSlots: PoscosechaClasificacionOrderSlot[],
  mode: PoscosechaClasificacionRunMode,
  hasFutureMode: boolean,
) {
  const fullResult = await solveModeOnce(skuMaster, orders, availability, settings);
  const fullCompliance = getMacroCompliance(fullResult);

  if (!hasFutureMode || fullCompliance >= SOFT_MODE_MIN_COMPLIANCE) {
    return fullResult;
  }

  const strictOrders = buildStrictOrdersByMode(orders, orderSlots, mode);
  const softOrders = buildSoftOrdersByMode(orders, orderSlots, mode);
  const strictDemand = countOrderDemand(strictOrders);
  const totalSoftDemand = countOrderDemand(softOrders);
  if (totalSoftDemand <= 0) {
    return fullResult;
  }

  let bestDemand = 0;
  let bestResult: PoscosechaClasificacionResult | null = null;
  let bestSoftOrders: PoscosechaClasificacionOrderRow[] | null = null;

  if (strictDemand > 0) {
    const strictOnlyResult = await solveModeOnce(skuMaster, strictOrders, availability, settings);
    if (getMacroCompliance(strictOnlyResult) < SOFT_MODE_MIN_COMPLIANCE) {
      return fullResult;
    }
    bestResult = strictOnlyResult;
    bestSoftOrders = softOrders.map((row) => ({ ...row, fecha_1: 0, fecha_2: 0, fecha_3: 0, fecha_4: 0, fecha_5: 0 }));
  }

  let low = 0;
  let high = totalSoftDemand;
  if (strictDemand <= 0) {
    low = 1;
  }

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidateSoft = clampSoftDemand(softOrders, mid);
    const candidateOrders = mergeOrderDemand(strictOrders, candidateSoft);
    const candidateResult = await solveModeOnce(skuMaster, candidateOrders, availability, settings);
    const candidateCompliance = getMacroCompliance(candidateResult);

    if (candidateCompliance >= SOFT_MODE_MIN_COMPLIANCE) {
      bestDemand = mid;
      bestResult = candidateResult;
      bestSoftOrders = candidateSoft;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  let selectedResult = bestResult ?? fullResult;
  let selectedSoftOrders = bestSoftOrders ?? clampSoftDemand(softOrders, bestDemand);
  let selectedDistance = Math.abs(getMacroCompliance(selectedResult) - 1);
  const refinementStart = Math.max(bestDemand - 3, strictDemand > 0 ? 0 : 1);

  for (let demand = refinementStart; demand <= bestDemand; demand += 1) {
    const refinedSoft = clampSoftDemand(softOrders, demand);
    const refinedOrders = mergeOrderDemand(strictOrders, refinedSoft);
    const refinedResult = await solveModeOnce(skuMaster, refinedOrders, availability, settings);
    const refinedCompliance = getMacroCompliance(refinedResult);
    if (refinedCompliance < SOFT_MODE_MIN_COMPLIANCE) continue;

    const refinedDistance = Math.abs(refinedCompliance - 1);
    if (refinedDistance < selectedDistance) {
      selectedResult = refinedResult;
      selectedSoftOrders = refinedSoft;
      selectedDistance = refinedDistance;
    }
  }

  let skuRebalanceIterations = countOrderDemand(selectedSoftOrders);
  while (skuRebalanceIterations > 0) {
    const underTargetSkus = getUnderTargetSkus(selectedResult);
    if (underTargetSkus.length === 0) {
      break;
    }

    let improved = false;

    for (const underTargetSku of underTargetSkus) {
      const currentSoftRow = selectedSoftOrders.find((row) => row.sku === underTargetSku.sku);
      const availableSoftDemand = currentSoftRow ? countRowDemand(currentSoftRow) : 0;
      if (availableSoftDemand <= 0) {
        continue;
      }

      const maxResolvableAtMinWeight = underTargetSku.pesoMinObjetivo > 0
        ? Math.floor(underTargetSku.pesoRealTotal / underTargetSku.pesoMinObjetivo)
        : underTargetSku.pedidoResuelto;
      const requiredReduction = Math.max(underTargetSku.pedidoResuelto - maxResolvableAtMinWeight, 1);
      const reducedSoftOrders = reduceSoftDemandForSku(
        selectedSoftOrders,
        underTargetSku.sku,
        Math.min(requiredReduction, availableSoftDemand),
      );
      if (!reducedSoftOrders) {
        continue;
      }

      const candidateOrders = mergeOrderDemand(strictOrders, reducedSoftOrders);
      if (countOrderDemand(candidateOrders) <= 0) {
        continue;
      }

      const candidateResult = await solveModeOnce(skuMaster, candidateOrders, availability, settings);
      if (getMacroCompliance(candidateResult) < SOFT_MODE_MIN_COMPLIANCE) {
        continue;
      }

      const currentScore = getSkuDeviationScore(selectedResult);
      const candidateScore = getSkuDeviationScore(candidateResult);
      const isBetter =
        candidateScore.maxAbsPct + 1e-9 < currentScore.maxAbsPct
        || (
          Math.abs(candidateScore.maxAbsPct - currentScore.maxAbsPct) <= 1e-9
          && candidateScore.sumAbsPct + 1e-9 < currentScore.sumAbsPct
        );

      if (!isBetter) {
        continue;
      }

      selectedSoftOrders = reducedSoftOrders;
      selectedResult = candidateResult;
      skuRebalanceIterations = Math.max(skuRebalanceIterations - Math.min(requiredReduction, availableSoftDemand), 0);
      improved = true;
      break;
    }

    if (!improved) {
      break;
    }
  }

  return selectedResult;
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
    const hasFutureMode = POSCOSECHA_CLASIFICACION_RUN_MODES.indexOf(mode) < POSCOSECHA_CLASIFICACION_RUN_MODES.length - 1;
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
      result = await solveModeWithSoftGuardrails(
        skuMaster,
        filteredOrders,
        filteredAvailability,
        settings,
        orderSlots,
        mode,
        hasFutureMode,
      );
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
