"use client";

import { useState } from "react";
import useSWRImmutable from "swr/immutable";

import { swrFetcher } from "@/hooks/use-swr-fetcher";
import type {
  ValveProfilePayload,
  ValveProfilesByCyclePayload,
} from "@/lib/fenograma";

type KeyedCycleState = {
  rowKey: string;
  cycleKey: string;
};

type KeyedValveState = {
  rowKey: string;
  cycleKey: string;
  valveId: string;
};

/**
 * Manages valve cycle selection and individual valve detail.
 * Extracted from useBlockProfileModal for separation of concerns.
 */
export function useValveSelection(selectedRowKey: string | null) {
  const [selectedValveCycleState, setSelectedValveCycleState] = useState<KeyedCycleState | null>(null);
  const [selectedValveState, setSelectedValveState] = useState<KeyedValveState | null>(null);

  const selectedValveCycleKey =
    selectedRowKey && selectedValveCycleState?.rowKey === selectedRowKey
      ? selectedValveCycleState.cycleKey
      : null;

  const selectedValve =
    selectedRowKey && selectedValveState?.rowKey === selectedRowKey
      ? { cycleKey: selectedValveState.cycleKey, valveId: selectedValveState.valveId }
      : null;

  // SWR requests
  const valvesRequest = selectedValveCycleKey
    ? ([`/api/fenograma/cycle/${encodeURIComponent(selectedValveCycleKey)}/valves`, "No se pudo cargar el detalle de valvulas."] as const)
    : null;
  const valveRequest = selectedValve
    ? ([
        `/api/fenograma/cycle/${encodeURIComponent(selectedValve.cycleKey)}/valves/${encodeURIComponent(selectedValve.valveId)}`,
        "No se pudo cargar el detalle de la valvula.",
      ] as const)
    : null;

  const {
    data: valvesData,
    error: valvesRequestError,
    isLoading: valvesLoading,
  } = useSWRImmutable<ValveProfilesByCyclePayload>(valvesRequest, swrFetcher, {
    revalidateOnFocus: false,
  });

  const {
    data: valveData,
    error: valveRequestError,
    isLoading: valveLoading,
  } = useSWRImmutable<ValveProfilePayload>(valveRequest, swrFetcher, {
    revalidateOnFocus: false,
  });

  function openValves(cycleKey: string) {
    if (!selectedRowKey) return;
    setSelectedValveCycleState((current) =>
      current?.rowKey === selectedRowKey && current.cycleKey === cycleKey
        ? null
        : { rowKey: selectedRowKey, cycleKey },
    );
    setSelectedValveState(null);
  }

  function closeValves() {
    setSelectedValveCycleState(null);
    setSelectedValveState(null);
  }

  function openValve(cycleKey: string, valveId: string) {
    if (!selectedRowKey) return;
    setSelectedValveState((current) =>
      current?.rowKey === selectedRowKey &&
      current?.cycleKey === cycleKey &&
      current?.valveId === valveId
        ? null
        : { rowKey: selectedRowKey, cycleKey, valveId },
    );
  }

  /** Reset all valve selections (called by parent when beds change). */
  function resetValveDetail() {
    setSelectedValveState(null);
  }

  return {
    selectedValveCycleKey,
    valvesData: valvesData ?? null,
    valvesLoading,
    valvesError: valvesRequestError?.message ?? null,
    selectedValve,
    valveData: valveData ?? null,
    valveLoading,
    valveError: valveRequestError?.message ?? null,
    openValves,
    closeValves,
    openValve,
    resetValveDetail,
  };
}
