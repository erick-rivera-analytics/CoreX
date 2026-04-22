"use client";

import type {
  PoscosechaClasificacionAvailabilityRow,
  PoscosechaClasificacionBootData,
  PoscosechaClasificacionLotSlot,
  PoscosechaClasificacionModeResult,
  PoscosechaClasificacionOrderRow,
  PoscosechaClasificacionOrderSlot,
  PoscosechaClasificacionRunMode,
  PoscosechaClasificacionSettings,
} from "@/lib/postcosecha-clasificacion-en-blanco-types";
import {
  POSCOSECHA_CLASIFICACION_RUN_MODES,
  SOLVER_DATE_KEYS,
} from "@/lib/postcosecha-clasificacion-en-blanco-types";

const SOLVER_DRAFT_STORAGE_KEY = "corex:solver-clasificacion-en-blanco:draft-v1";

export type SolverDraftSnapshot = {
  orders: PoscosechaClasificacionOrderRow[];
  availability: PoscosechaClasificacionAvailabilityRow[];
  settings: PoscosechaClasificacionSettings;
  orderSlots: PoscosechaClasificacionOrderSlot[];
  lotSlots: PoscosechaClasificacionLotSlot[];
  activeMode: PoscosechaClasificacionRunMode;
  resultBundle: PoscosechaClasificacionModeResult[] | null;
  isResultStale: boolean;
};

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function sanitizeInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(Math.round(parsed), 0) : 0;
}

function sanitizeFloat(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
}

function sanitizeOrders(
  template: PoscosechaClasificacionOrderRow[],
  draftRows: unknown,
) {
  if (!Array.isArray(draftRows)) {
    return template;
  }

  const draftBySkuId = new Map(
    draftRows
      .filter((row): row is Partial<PoscosechaClasificacionOrderRow> & { skuId: string } =>
        typeof row === "object" && row !== null && typeof row.skuId === "string",
      )
      .map((row) => [row.skuId, row]),
  );

  return template.map((row) => {
    const draft = draftBySkuId.get(row.skuId);
    if (!draft) {
      return row;
    }

    return {
      ...row,
      sku: typeof draft.sku === "string" && draft.sku.trim() ? draft.sku : row.sku,
      fecha_1: sanitizeInteger(draft.fecha_1),
      fecha_2: sanitizeInteger(draft.fecha_2),
      fecha_3: sanitizeInteger(draft.fecha_3),
      fecha_4: sanitizeInteger(draft.fecha_4),
      fecha_5: sanitizeInteger(draft.fecha_5),
    };
  });
}

function sanitizeAvailability(
  template: PoscosechaClasificacionAvailabilityRow[],
  draftRows: unknown,
) {
  if (!Array.isArray(draftRows)) {
    return template;
  }

  const draftByGrade = new Map(
    draftRows
      .filter((row): row is Partial<PoscosechaClasificacionAvailabilityRow> & { grado: number } =>
        typeof row === "object" && row !== null && Number.isFinite(Number(row.grado)),
      )
      .map((row) => [Number(row.grado), row]),
  );

  return template.map((row) => {
    const draft = draftByGrade.get(row.grado);
    if (!draft) {
      return row;
    }

    return {
      ...row,
      pesoTalloSeed: Math.round(sanitizeFloat(draft.pesoTalloSeed) * 100) / 100,
      fecha_1: sanitizeInteger(draft.fecha_1),
      fecha_2: sanitizeInteger(draft.fecha_2),
      fecha_3: sanitizeInteger(draft.fecha_3),
      fecha_4: sanitizeInteger(draft.fecha_4),
      fecha_5: sanitizeInteger(draft.fecha_5),
    };
  });
}

function sanitizeSettings(settings: unknown, fallback: PoscosechaClasificacionSettings) {
  if (!settings || typeof settings !== "object") {
    return fallback;
  }

  const desperdicio = Math.min(Math.max(sanitizeFloat((settings as { desperdicio?: unknown }).desperdicio), 0), 0.95);
  return { desperdicio };
}

function sanitizeOrderSlots(
  slots: unknown,
  fallback: PoscosechaClasificacionOrderSlot[],
) {
  if (!Array.isArray(slots) || slots.length === 0) {
    return fallback;
  }

  const usedKeys = new Set<string>();

  return slots
    .filter((slot): slot is Partial<PoscosechaClasificacionOrderSlot> =>
      typeof slot === "object" && slot !== null,
    )
    .map((slot): PoscosechaClasificacionOrderSlot => ({
      key: SOLVER_DATE_KEYS.includes(slot.key as (typeof SOLVER_DATE_KEYS)[number])
        ? (slot.key as (typeof SOLVER_DATE_KEYS)[number])
        : SOLVER_DATE_KEYS[0],
      restriction:
        slot.restriction === "GV" || slot.restriction === "APERTURA" || slot.restriction === "PRECLASIFICACION"
          ? slot.restriction
          : null,
      restrictionMode: slot.restrictionMode === "STRICT" ? "STRICT" : "SOFT",
    }))
    .filter((slot) => {
      if (usedKeys.has(slot.key)) {
        return false;
      }
      usedKeys.add(slot.key);
      return true;
    });
}

function sanitizeLotSlots(
  slots: unknown,
  fallback: PoscosechaClasificacionLotSlot[],
) {
  if (!Array.isArray(slots) || slots.length === 0) {
    return fallback;
  }

  const usedKeys = new Set<string>();

  return slots
    .filter((slot): slot is Partial<PoscosechaClasificacionLotSlot> =>
      typeof slot === "object" && slot !== null,
    )
    .map((slot): PoscosechaClasificacionLotSlot => ({
      key: SOLVER_DATE_KEYS.includes(slot.key as (typeof SOLVER_DATE_KEYS)[number])
        ? (slot.key as (typeof SOLVER_DATE_KEYS)[number])
        : SOLVER_DATE_KEYS[0],
      lotDate: typeof slot.lotDate === "string" && slot.lotDate.trim() ? slot.lotDate.trim() : null,
      origin:
        slot.origin === "APERTURA" || slot.origin === "PRECLASIFICACION"
          ? slot.origin
          : "GV",
    }))
    .filter((slot) => {
      if (usedKeys.has(slot.key)) {
        return false;
      }
      usedKeys.add(slot.key);
      return true;
    });
}

function sanitizeActiveMode(mode: unknown, fallback: PoscosechaClasificacionRunMode) {
  return POSCOSECHA_CLASIFICACION_RUN_MODES.includes(mode as PoscosechaClasificacionRunMode)
    ? (mode as PoscosechaClasificacionRunMode)
    : fallback;
}

export function buildHydratedDraftState(
  initialData: PoscosechaClasificacionBootData,
): SolverDraftSnapshot | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(SOLVER_DRAFT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<SolverDraftSnapshot>;

    return {
      orders: sanitizeOrders(initialData.ordersTemplate, parsed.orders),
      availability: sanitizeAvailability(initialData.availabilityTemplate, parsed.availability),
      settings: sanitizeSettings(parsed.settings, initialData.settings),
      orderSlots: sanitizeOrderSlots(parsed.orderSlots, initialData.orderSlots),
      lotSlots: sanitizeLotSlots(parsed.lotSlots, initialData.lotSlots),
      activeMode: sanitizeActiveMode(parsed.activeMode, POSCOSECHA_CLASIFICACION_RUN_MODES[0]),
      resultBundle: Array.isArray(parsed.resultBundle)
        ? (parsed.resultBundle as PoscosechaClasificacionModeResult[])
        : null,
      isResultStale: Boolean(parsed.isResultStale),
    };
  } catch {
    return null;
  }
}

export function writeSolverDraft(snapshot: SolverDraftSnapshot) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(SOLVER_DRAFT_STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearSolverDraft() {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(SOLVER_DRAFT_STORAGE_KEY);
}

export function getSolverDraftStorageKey() {
  return SOLVER_DRAFT_STORAGE_KEY;
}
