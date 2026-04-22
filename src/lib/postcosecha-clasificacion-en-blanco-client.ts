import type { PoscosechaSkuRecord } from "@/lib/postcosecha-sku-types";
import type {
  PoscosechaClasificacionAvailabilityDerivedRow,
  PoscosechaClasificacionAvailabilityRow,
  PoscosechaClasificacionLotSlot,
  PoscosechaClasificacionOrderRow,
  PoscosechaClasificacionOrderSlot,
  PoscosechaClasificacionPrecheck,
  PoscosechaClasificacionRunMode,
  SolverDateKey,
} from "@/lib/postcosecha-clasificacion-en-blanco-types";
import { SOLVER_DATE_KEYS } from "@/lib/postcosecha-clasificacion-en-blanco-types";

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    if (isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toInteger(value: unknown, fallback = 0) {
  return Math.round(toNumber(value, fallback));
}

export function excelRound(value: number, digits = 0) {
  const factor = 10 ** digits;
  const scaled = value * factor;
  const rounded = scaled >= 0 ? Math.floor(scaled + 0.5) : Math.ceil(scaled - 0.5);
  return rounded / factor;
}

function sanitizeDateValue(value: unknown) {
  return Math.max(toInteger(value, 0), 0);
}

function sanitizeAvailabilityRow(
  row: PoscosechaClasificacionAvailabilityRow,
): PoscosechaClasificacionAvailabilityRow {
  return {
    grado: Math.max(toInteger(row.grado, 0), 1),
    pesoTalloSeed: Math.max(toNumber(row.pesoTalloSeed, 0), 0),
    fecha_1: sanitizeDateValue(row.fecha_1),
    fecha_2: sanitizeDateValue(row.fecha_2),
    fecha_3: sanitizeDateValue(row.fecha_3),
    fecha_4: sanitizeDateValue(row.fecha_4),
    fecha_5: sanitizeDateValue(row.fecha_5),
  };
}

export function buildClasificacionAvailabilityDerived(
  rows: PoscosechaClasificacionAvailabilityRow[],
  desperdicio: number,
): PoscosechaClasificacionAvailabilityDerivedRow[] {
  return rows.map((row) => {
    const sanitizedRow = sanitizeAvailabilityRow(row);
    const mallasTotales = SOLVER_DATE_KEYS.reduce(
      (accumulator, key) => accumulator + sanitizedRow[key],
      0,
    );
    const tallosBrutos = mallasTotales * 20;
    const tallosNetos = excelRound(tallosBrutos * (1 - desperdicio), 0);
    const pesoTotalGestionable = tallosNetos * sanitizedRow.pesoTalloSeed;

    return {
      grado: sanitizedRow.grado,
      pesoTalloSeed: sanitizedRow.pesoTalloSeed,
      mallasTotales,
      tallosBrutos,
      tallosNetos,
      pesoTotalGestionable,
    };
  });
}

function slotCanBeSolvedByMode(
  slot: PoscosechaClasificacionOrderSlot | undefined,
  mode: PoscosechaClasificacionRunMode,
): boolean {
  if (!slot?.restriction || slot.restrictionMode !== "STRICT") {
    return true;
  }

  return slot.restriction === mode;
}

function originMatchesMode(
  slot: PoscosechaClasificacionLotSlot | undefined,
  mode: PoscosechaClasificacionRunMode,
) {
  if (!slot) {
    return false;
  }

  return slot.origin === mode;
}

export function buildClasificacionPrecheck(
  orders: PoscosechaClasificacionOrderRow[],
  availability: PoscosechaClasificacionAvailabilityRow[],
  skuMaster: PoscosechaSkuRecord[],
  desperdicio: number,
  orderSlots?: PoscosechaClasificacionOrderSlot[],
  lotSlots?: PoscosechaClasificacionLotSlot[],
  mode?: PoscosechaClasificacionRunMode,
): PoscosechaClasificacionPrecheck {
  const masterBySkuId = new Map(skuMaster.map((record) => [record.skuId, record]));

  const orderEligibleKeys =
    orderSlots && mode
      ? SOLVER_DATE_KEYS.filter((key) => {
          const slot = orderSlots.find((item) => item.key === key);
          return slotCanBeSolvedByMode(slot, mode);
        })
      : [...SOLVER_DATE_KEYS];

  let tallosPedidos = 0;

  for (const row of orders) {
    const masterRecord = masterBySkuId.get(row.skuId);

    if (!masterRecord) {
      continue;
    }

    const totalPedido = orderEligibleKeys.reduce(
      (accumulator, key) => accumulator + sanitizeDateValue(row[key]),
      0,
    );

    tallosPedidos += totalPedido * Math.max(toInteger(masterRecord.tallosMin, 0), 0);
  }

  let tallosDisponibles: number;

  if (lotSlots && lotSlots.length > 0 && mode) {
    const eligibleLotKeys = SOLVER_DATE_KEYS.filter((key) => {
      const slot = lotSlots.find((item) => item.key === key);
      return originMatchesMode(slot, mode);
    });
    tallosDisponibles = availability.reduce((acc, row) => {
      const sanitized = sanitizeAvailabilityRow(row);
      const mallasTotales = eligibleLotKeys.reduce(
        (a, key) => a + sanitized[key],
        0,
      );
      const tallosBrutos = mallasTotales * 20;
      return acc + excelRound(tallosBrutos * (1 - desperdicio), 0);
    }, 0);
  } else {
    tallosDisponibles = buildClasificacionAvailabilityDerived(
      availability,
      desperdicio,
    ).reduce((accumulator, row) => accumulator + row.tallosNetos, 0);
  }

  const diferencia = tallosPedidos - tallosDisponibles;

  if (tallosPedidos <= 0) {
    return {
      isValid: false,
      message: "Debes ingresar pedidos mayores a cero.",
      tallosPedidos,
      tallosDisponibles,
      diferencia,
    };
  }

  if (tallosDisponibles <= 0) {
    return {
      isValid: false,
      message: "Debes ingresar disponibilidad mayor a cero.",
      tallosPedidos,
      tallosDisponibles,
      diferencia,
    };
  }

  return {
    isValid: true,
    message:
      diferencia < 0
        ? "Hay mas tallos disponibles que pedidos minimos; el solver usara lo necesario y dejara saldo."
        : "Validacion previa correcta.",
    tallosPedidos,
    tallosDisponibles,
    diferencia,
  };
}

export function buildClasificacionFlexiblePrecheck(
  orders: PoscosechaClasificacionOrderRow[],
  availability: PoscosechaClasificacionAvailabilityRow[],
  skuMaster: PoscosechaSkuRecord[],
  desperdicio: number,
  orderSlots: PoscosechaClasificacionOrderSlot[],
  lotSlots: PoscosechaClasificacionLotSlot[],
): PoscosechaClasificacionPrecheck {
  const masterBySkuId = new Map(skuMaster.map((record) => [record.skuId, record]));
  const flexibleKeys = new Set(
    orderSlots
      .filter((slot) => !slot.restriction || slot.restrictionMode !== "STRICT")
      .map((slot) => slot.key),
  );
  const lotKeys = new Set(lotSlots.map((slot) => slot.key));

  let tallosPedidos = 0;
  for (const row of orders) {
    const masterRecord = masterBySkuId.get(row.skuId);
    if (!masterRecord) {
      continue;
    }

    const totalPedido = SOLVER_DATE_KEYS.reduce(
      (accumulator, key) => accumulator + (flexibleKeys.has(key) ? sanitizeDateValue(row[key]) : 0),
      0,
    );

    tallosPedidos += totalPedido * Math.max(toInteger(masterRecord.tallosMin, 0), 0);
  }

  const tallosDisponibles = buildClasificacionAvailabilityDerived(
    availability.map((row) => ({
      ...row,
      fecha_1: lotKeys.has("fecha_1") ? row.fecha_1 : 0,
      fecha_2: lotKeys.has("fecha_2") ? row.fecha_2 : 0,
      fecha_3: lotKeys.has("fecha_3") ? row.fecha_3 : 0,
      fecha_4: lotKeys.has("fecha_4") ? row.fecha_4 : 0,
      fecha_5: lotKeys.has("fecha_5") ? row.fecha_5 : 0,
    })),
    desperdicio,
  ).reduce((accumulator, row) => accumulator + row.tallosNetos, 0);

  const diferencia = tallosPedidos - tallosDisponibles;

  if (tallosPedidos <= 0) {
    return {
      isValid: false,
      message: "Debes ingresar pedidos flexibles mayores a cero.",
      tallosPedidos,
      tallosDisponibles,
      diferencia,
    };
  }

  if (tallosDisponibles <= 0) {
    return {
      isValid: false,
      message: "Debes ingresar disponibilidad mayor a cero.",
      tallosPedidos,
      tallosDisponibles,
      diferencia,
    };
  }

  return {
    isValid: true,
    message:
      diferencia < 0
        ? "Las ordenes no estrictas tienen disponibilidad total suficiente y aun queda saldo."
        : "Las ordenes no estrictas consumen toda la disponibilidad y aun queda demanda pendiente.",
    tallosPedidos,
    tallosDisponibles,
    diferencia,
  };
}

export function getDateLabel(dateKey: SolverDateKey) {
  const datePosition = SOLVER_DATE_KEYS.indexOf(dateKey) + 1;
  return `Fecha ${datePosition}`;
}

export function orderSlotTotal(
  orders: PoscosechaClasificacionOrderRow[],
  keys: SolverDateKey[],
): number {
  return orders.reduce(
    (acc, row) => acc + keys.reduce((a, key) => a + sanitizeDateValue(row[key]), 0),
    0,
  );
}

export function orderSlotActiveSkuCount(
  orders: PoscosechaClasificacionOrderRow[],
  keys: SolverDateKey[],
): number {
  return orders.filter((row) =>
    keys.some((key) => sanitizeDateValue(row[key]) > 0),
  ).length;
}

export function lotSlotMallasTotal(
  availability: PoscosechaClasificacionAvailabilityRow[],
  keys: SolverDateKey[],
): number {
  return availability.reduce(
    (acc, row) => acc + keys.reduce((a, key) => a + sanitizeDateValue(row[key]), 0),
    0,
  );
}

export function lotSlotNetStemsTotal(
  availability: PoscosechaClasificacionAvailabilityRow[],
  keys: SolverDateKey[],
  desperdicio: number,
): number {
  const mallasTotales = lotSlotMallasTotal(availability, keys);
  return excelRound(mallasTotales * 20 * (1 - desperdicio), 0);
}
