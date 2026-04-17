"use client";

import { useMemo, useState } from "react";
import useSWRImmutable from "swr/immutable";

import { swrFetcher } from "@/hooks/use-swr-fetcher";
import type {
  BedProfilePayload,
  BlockModalRow,
  CycleProfileBlockPayload,
} from "@/lib/fenograma";

type KeyedCycleState = {
  rowKey: string;
  cycleKey: string;
};

function buildBlockRequestUrl(row: BlockModalRow) {
  const params = new URLSearchParams();
  if (row.cycleKey) {
    params.set("cycleKey", row.cycleKey);
  }
  const query = params.toString();
  return query
    ? `/api/fenograma/block/${encodeURIComponent(row.block)}?${query}`
    : `/api/fenograma/block/${encodeURIComponent(row.block)}`;
}

function buildBlockCacheKey(row: BlockModalRow) {
  return row.cycleKey ? `${row.block}|${row.cycleKey}` : row.block;
}

/**
 * Manages block data loading and bed cycle selection.
 * Extracted from useBlockProfileModal for separation of concerns.
 */
export function useCycleSelection(selectedRow: BlockModalRow | null) {
  const [selectedCycleState, setSelectedCycleState] = useState<KeyedCycleState | null>(null);

  const selectedRowKey = useMemo(
    () => (selectedRow ? buildBlockCacheKey(selectedRow) : null),
    [selectedRow],
  );

  const selectedCycleKey =
    selectedRowKey && selectedCycleState?.rowKey === selectedRowKey
      ? selectedCycleState.cycleKey
      : null;

  // SWR requests
  const blockRequest = selectedRow
    ? ([buildBlockRequestUrl(selectedRow), "No se pudo cargar los ciclos del bloque."] as const)
    : null;
  const bedsRequest = selectedCycleKey
    ? ([`/api/fenograma/cycle/${encodeURIComponent(selectedCycleKey)}/beds`, "No se pudo cargar el detalle de camas."] as const)
    : null;

  const {
    data: blockData,
    error: blockRequestError,
    isLoading: blockLoading,
  } = useSWRImmutable<CycleProfileBlockPayload>(blockRequest, swrFetcher, {
    revalidateOnFocus: false,
  });

  const {
    data: bedData,
    error: bedsRequestError,
    isLoading: bedLoading,
  } = useSWRImmutable<BedProfilePayload>(bedsRequest, swrFetcher, {
    revalidateOnFocus: false,
  });

  function openBeds(cycleKey: string) {
    if (!selectedRowKey) return;
    setSelectedCycleState((current) =>
      current?.rowKey === selectedRowKey && current.cycleKey === cycleKey
        ? null
        : { rowKey: selectedRowKey, cycleKey },
    );
  }

  function closeBeds() {
    setSelectedCycleState(null);
  }

  return {
    selectedRowKey,
    blockData: blockData ?? null,
    blockLoading,
    blockError: blockRequestError?.message ?? null,
    selectedCycleKey,
    bedData: bedData ?? null,
    bedLoading,
    bedError: bedsRequestError?.message ?? null,
    openBeds,
    closeBeds,
  };
}
