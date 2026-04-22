"use client";

import type { KeyboardEvent } from "react";

import type {
  PoscosechaClasificacionAvailabilityRow,
  PoscosechaClasificacionOrderRow,
  PoscosechaClasificacionRecipeInput,
  PoscosechaClasificacionResultOrderRow,
  SolverDateKey,
} from "@/lib/postcosecha-clasificacion-en-blanco-types";
import { SOLVER_DATE_KEYS } from "@/lib/postcosecha-clasificacion-en-blanco-types";

export function toInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(Math.round(parsed), 0) : 0;
}

export function toFloat(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
}

export function orderTotal(row: PoscosechaClasificacionOrderRow) {
  return SOLVER_DATE_KEYS.reduce((accumulator, key) => accumulator + toInteger(row[key]), 0);
}

export function buildRecipeInput(
  row: PoscosechaClasificacionResultOrderRow,
  netStemValues: Record<string, number>,
  availabilityRows: PoscosechaClasificacionAvailabilityRow[],
): PoscosechaClasificacionRecipeInput | null {
  const grades = Object.entries(netStemValues)
    .map(([gradeLabel, value]) => {
      const grade = Number(gradeLabel);
      const tallosNetos = Math.max(Math.round(Number(value) || 0), 0);
      const availabilityRow = availabilityRows.find((item) => item.grado === grade);

      return {
        grado: Number.isFinite(grade) ? grade : 0,
        tallosNetos,
        pesoTalloSeed: availabilityRow?.pesoTalloSeed ?? 0,
      };
    })
    .filter((item) => item.grado > 0 && item.tallosNetos > 0);

  if (!grades.length || row.pedidoResuelto <= 0) {
    return null;
  }

  return {
    sku: row.sku,
    pedidoResuelto: Math.max(Math.round(row.pedidoResuelto), 0),
    pesoIdealBunch: row.pesoIdealBunch,
    pesoMinObjetivo: row.pesoMinObjetivo,
    pesoMaxObjetivo: row.pesoMaxObjetivo,
    tallosMin: row.tallosMin,
    tallosMax: row.tallosMax,
    tallosAsignadosNetos: row.tallosAsignadosNetos,
    tallosPromedioRamo: row.tallosPromedioRamo,
    grados: grades,
  };
}

export type SolverOrderValueUpdater = (skuId: string, dateKey: SolverDateKey, value: string) => void;
export type SolverAvailabilityDateUpdater = (
  grado: number,
  dateKey: SolverDateKey,
  value: string,
) => void;

export function handleCaptureInputTab(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key !== "Tab") {
    return;
  }

  const currentInput = event.currentTarget;
  const captureContainer = currentInput.closest("[data-capture-scope='true']");

  if (!captureContainer) {
    return;
  }

  const inputs = Array.from(
    captureContainer.querySelectorAll<HTMLInputElement>("input[data-capture-input='true']"),
  ).filter((input) => !input.disabled && input.tabIndex !== -1);

  const currentIndex = inputs.indexOf(currentInput);

  if (currentIndex === -1) {
    return;
  }

  const nextIndex = event.shiftKey ? currentIndex - 1 : currentIndex + 1;
  const nextInput = inputs[nextIndex];

  if (!nextInput) {
    return;
  }

  event.preventDefault();
  nextInput.focus();
  nextInput.select();
}
