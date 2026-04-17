"use client";

import { useState } from "react";
import useSWRImmutable from "swr/immutable";

import { swrFetcher } from "@/hooks/use-swr-fetcher";
import type { HarvestCurvePayload } from "@/lib/fenograma";
import type { MortalityCurvePayload } from "@/lib/mortality";

type KeyedCycleState = {
  rowKey: string;
  cycleKey: string;
};

export type SelectedMortalityCurveState =
  | { entityType: "cycle"; cycleKey: string }
  | { entityType: "valve"; cycleKey: string; valveId: string }
  | { entityType: "bed"; cycleKey: string; bedId: string };

type KeyedMortalityCurveState = {
  rowKey: string;
} & SelectedMortalityCurveState;

/**
 * Manages harvest curve and mortality curve data.
 * Extracted from useBlockProfileModal for separation of concerns.
 */
export function useCurveData(selectedRowKey: string | null) {
  const [selectedCurveState, setSelectedCurveState] = useState<KeyedCycleState | null>(null);
  const [selectedMortalityCurveState, setSelectedMortalityCurveState] = useState<KeyedMortalityCurveState | null>(null);

  const selectedCurveCycleKey =
    selectedRowKey && selectedCurveState?.rowKey === selectedRowKey
      ? selectedCurveState.cycleKey
      : null;

  const selectedMortalityCurve =
    selectedRowKey && selectedMortalityCurveState?.rowKey === selectedRowKey
      ? selectedMortalityCurveState
      : null;

  // SWR requests
  const curveRequest = selectedCurveCycleKey
    ? ([`/api/fenograma/cycle/${encodeURIComponent(selectedCurveCycleKey)}/curve`, "No se pudo cargar la curva de cosecha."] as const)
    : null;

  const mortalityCurveRequest = selectedMortalityCurve
    ? ([
        selectedMortalityCurve.entityType === "cycle"
          ? `/api/mortality/cycle/${encodeURIComponent(selectedMortalityCurve.cycleKey)}/curve`
          : selectedMortalityCurve.entityType === "valve"
            ? `/api/mortality/cycle/${encodeURIComponent(selectedMortalityCurve.cycleKey)}/valves/${encodeURIComponent(selectedMortalityCurve.valveId)}/curve`
            : `/api/mortality/cycle/${encodeURIComponent(selectedMortalityCurve.cycleKey)}/beds/${encodeURIComponent(selectedMortalityCurve.bedId)}/curve`,
        "No se pudo cargar la curva de mortandad.",
      ] as const)
    : null;

  const {
    data: curveData,
    error: curveRequestError,
    isLoading: curveLoading,
  } = useSWRImmutable<HarvestCurvePayload>(curveRequest, swrFetcher, {
    revalidateOnFocus: false,
  });

  const {
    data: mortalityCurveData,
    error: mortalityCurveRequestError,
    isLoading: mortalityCurveLoading,
  } = useSWRImmutable<MortalityCurvePayload>(mortalityCurveRequest, swrFetcher, {
    revalidateOnFocus: false,
  });

  function openCurve(cycleKey: string) {
    if (!selectedRowKey) return;
    setSelectedCurveState((current) =>
      current?.rowKey === selectedRowKey && current.cycleKey === cycleKey
        ? null
        : { rowKey: selectedRowKey, cycleKey },
    );
  }

  function closeCurve() {
    setSelectedCurveState(null);
  }

  function openCycleMortalityCurve(cycleKey: string) {
    if (!selectedRowKey) return;
    setSelectedMortalityCurveState((current) =>
      current?.rowKey === selectedRowKey &&
      current.entityType === "cycle" &&
      current.cycleKey === cycleKey
        ? null
        : { rowKey: selectedRowKey, entityType: "cycle", cycleKey },
    );
  }

  function openValveMortalityCurve(cycleKey: string, valveId: string) {
    if (!selectedRowKey) return;
    setSelectedMortalityCurveState((current) =>
      current?.rowKey === selectedRowKey &&
      current.entityType === "valve" &&
      current.cycleKey === cycleKey &&
      current.valveId === valveId
        ? null
        : { rowKey: selectedRowKey, entityType: "valve", cycleKey, valveId },
    );
  }

  function openBedMortalityCurve(cycleKey: string, bedId: string) {
    if (!selectedRowKey) return;
    setSelectedMortalityCurveState((current) =>
      current?.rowKey === selectedRowKey &&
      current.entityType === "bed" &&
      current.cycleKey === cycleKey &&
      current.bedId === bedId
        ? null
        : { rowKey: selectedRowKey, entityType: "bed", cycleKey, bedId },
    );
  }

  function closeMortalityCurve() {
    setSelectedMortalityCurveState(null);
  }

  return {
    selectedCurveCycleKey,
    curveData: curveData ?? null,
    curveLoading,
    curveError: curveRequestError?.message ?? null,
    selectedMortalityCurve,
    mortalityCurveData: mortalityCurveData ?? null,
    mortalityCurveLoading,
    mortalityCurveError: mortalityCurveRequestError?.message ?? null,
    openCurve,
    closeCurve,
    openCycleMortalityCurve,
    openValveMortalityCurve,
    openBedMortalityCurve,
    closeMortalityCurve,
  };
}
