"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { fetchJson } from "@/lib/fetch-json";
import type { PoscosechaSkuRecord } from "@/lib/postcosecha-sku-types";
import {
  buildClasificacionAvailabilityDerived,
  buildClasificacionFlexiblePrecheck,
  buildClasificacionPrecheck,
} from "@/lib/postcosecha-clasificacion-en-blanco-client";
import type {
  PoscosechaClasificacionBootData,
  PoscosechaClasificacionLotSlot,
  PoscosechaClasificacionModeResult,
  PoscosechaClasificacionOrderSlot,
  PoscosechaClasificacionRecipePayload,
  PoscosechaClasificacionRecipeResult,
  PoscosechaClasificacionRunMode,
  PoscosechaClasificacionRunPayload,
  SolverDateKey,
} from "@/lib/postcosecha-clasificacion-en-blanco-types";
import {
  POSCOSECHA_CLASIFICACION_RUN_MODES,
  SOLVER_DATE_KEYS,
} from "@/lib/postcosecha-clasificacion-en-blanco-types";
import { buildRecipeInput, orderTotal, toFloat, toInteger } from "@/modules/postcosecha/components/solver-utils";
import {
  buildHydratedDraftState,
  clearSolverDraft,
  writeSolverDraft,
} from "@/modules/postcosecha/hooks/use-solver-draft-storage";

function getNextAvailableKey(usedKeys: SolverDateKey[]) {
  return SOLVER_DATE_KEYS.find((key) => !usedKeys.includes(key)) ?? null;
}

function updateSkuRows(
  rows: PoscosechaClasificacionBootData["ordersTemplate"],
  record: PoscosechaSkuRecord,
) {
  return rows.map((row) => (row.skuId === record.skuId ? { ...row, sku: record.sku } : row));
}

export function useClasificacionEnBlancoExplorer(
  initialData: PoscosechaClasificacionBootData,
  initialError?: string | null,
) {
  const [bootData, setBootData] = useState(initialData);
  const [orders, setOrders] = useState(initialData.ordersTemplate);
  const [availability, setAvailability] = useState(initialData.availabilityTemplate);
  const [settings, setSettings] = useState(initialData.settings);
  const [orderSlots, setOrderSlots] = useState(initialData.orderSlots);
  const [lotSlots, setLotSlots] = useState(initialData.lotSlots);
  const [resultBundle, setResultBundle] = useState<PoscosechaClasificacionModeResult[] | null>(null);
  const [activeMode, setActiveMode] = useState<PoscosechaClasificacionRunMode>(POSCOSECHA_CLASIFICACION_RUN_MODES[0]);
  const [isResultStale, setIsResultStale] = useState(false);
  const [hasHydratedDraft, setHasHydratedDraft] = useState(false);
  const [search, setSearch] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [selectedRecipeSku, setSelectedRecipeSku] = useState<string | null>(null);
  const [recipeData, setRecipeData] = useState<PoscosechaClasificacionRecipeResult | null>(null);
  const [recipeError, setRecipeError] = useState<string | null>(null);
  const [isRecipeLoading, setIsRecipeLoading] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const activeResult = useMemo(
    () => resultBundle?.find((r) => r.mode === activeMode) ?? null,
    [resultBundle, activeMode],
  );

  const filteredOrders = useMemo(() => {
    const normalized = deferredSearch.trim().toLowerCase();
    if (!normalized) return orders;
    return orders.filter((row) => row.sku.toLowerCase().includes(normalized));
  }, [deferredSearch, orders]);

  const availabilityDerived = useMemo(
    () => buildClasificacionAvailabilityDerived(availability, settings.desperdicio),
    [availability, settings.desperdicio],
  );

  const precheck = useMemo(
    () =>
      buildClasificacionPrecheck(
        orders,
        availability,
        bootData.skuMaster,
        settings.desperdicio,
        orderSlots,
        lotSlots,
        activeMode,
      ),
    [availability, bootData.skuMaster, orders, settings.desperdicio, orderSlots, lotSlots, activeMode],
  );
  const precheckModes = useMemo(
    () =>
      POSCOSECHA_CLASIFICACION_RUN_MODES.map((mode) => ({
        mode,
        label: mode,
        precheck: buildClasificacionPrecheck(
          orders,
          availability,
          bootData.skuMaster,
          settings.desperdicio,
          orderSlots,
          lotSlots,
          mode,
        ),
      })),
    [availability, bootData.skuMaster, lotSlots, orderSlots, orders, settings.desperdicio],
  );
  const flexiblePrecheck = useMemo(
    () =>
      buildClasificacionFlexiblePrecheck(
        orders,
        availability,
        bootData.skuMaster,
        settings.desperdicio,
        orderSlots,
        lotSlots,
      ),
    [availability, bootData.skuMaster, lotSlots, orderSlots, orders, settings.desperdicio],
  );

  const ordersWithCapture = useMemo(() => orders.filter((row) => orderTotal(row) > 0).length, [orders]);
  const gradesWithCapture = useMemo(
    () => availabilityDerived.filter((row) => row.mallasTotales > 0).length,
    [availabilityDerived],
  );
  const resultOrderRowsBySku = useMemo(
    () => new Map((activeResult?.result?.orderRows ?? []).map((row) => [row.sku, row])),
    [activeResult],
  );
  const netStemValuesBySku = useMemo(
    () => new Map((activeResult?.result?.netStemMatrix.rows ?? []).map((row) => [row.sku, row.values])),
    [activeResult],
  );

  useEffect(() => {
    if (initialError) {
      toast.error(initialError);
    }
  }, [initialError]);

  useEffect(() => {
    const hydratedDraft = buildHydratedDraftState(initialData);
    if (hydratedDraft) {
      setOrders(hydratedDraft.orders);
      setAvailability(hydratedDraft.availability);
      setSettings(hydratedDraft.settings);
      setOrderSlots(hydratedDraft.orderSlots);
      setLotSlots(hydratedDraft.lotSlots);
      setResultBundle(hydratedDraft.resultBundle);
      setActiveMode(hydratedDraft.activeMode);
      setIsResultStale(hydratedDraft.isResultStale);
    }
    setHasHydratedDraft(true);
  }, [initialData]);

  useEffect(() => {
    if (!hasHydratedDraft) {
      return;
    }

    writeSolverDraft({
      orders,
      availability,
      settings,
      orderSlots,
      lotSlots,
      activeMode,
      resultBundle,
      isResultStale,
    });
  }, [orders, availability, settings, orderSlots, lotSlots, activeMode, resultBundle, isResultStale, hasHydratedDraft]);

  useEffect(() => {
    if (!resultBundle) {
      setSelectedRecipeSku(null);
      setRecipeData(null);
      setRecipeError(null);
      setIsRecipeLoading(false);
      setIsResultStale(false);
    }
  }, [resultBundle]);

  function applyBootData(nextData: PoscosechaClasificacionBootData) {
    setBootData(nextData);
    setOrders(nextData.ordersTemplate);
    setAvailability(nextData.availabilityTemplate);
    setSettings(nextData.settings);
    setOrderSlots(nextData.orderSlots);
    setLotSlots(nextData.lotSlots);
    setResultBundle(null);
    setIsResultStale(false);
    clearSolverDraft();
  }

  function closeRecipeOverlay() {
    setSelectedRecipeSku(null);
    setRecipeData(null);
    setRecipeError(null);
    setIsRecipeLoading(false);
  }

  function markResultStale() {
    if (resultBundle) {
      setIsResultStale(true);
    }
  }

  function clearResults() {
    setResultBundle(null);
    setIsResultStale(false);
  }

  async function reloadBase() {
    setIsReloading(true);
    try {
      const nextData = await fetchJson<PoscosechaClasificacionBootData>(
        "/api/postcosecha/planificacion/solver/clasificacion-en-blanco",
        "No se pudo recargar la base del solver.",
      );
      applyBootData(nextData);
      toast.success("Base del solver recargada correctamente.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo recargar la base del solver.");
    } finally {
      setIsReloading(false);
    }
  }

  function updateOrderValue(skuId: string, dateKey: SolverDateKey, value: string) {
    const nextValue = toInteger(value);
    startTransition(() => {
      setOrders((current) => current.map((row) => (row.skuId === skuId ? { ...row, [dateKey]: nextValue } : row)));
      markResultStale();
    });
  }

  function updateAvailabilityDate(grado: number, dateKey: SolverDateKey, value: string) {
    const nextValue = toInteger(value);
    startTransition(() => {
      setAvailability((current) => current.map((row) => (row.grado === grado ? { ...row, [dateKey]: nextValue } : row)));
      markResultStale();
    });
  }

  function updateAvailabilityWeight(grado: number, value: string) {
    const nextValue = Math.round(toFloat(value) * 100) / 100;
    startTransition(() => {
      setAvailability((current) => current.map((row) => (row.grado === grado ? { ...row, pesoTalloSeed: nextValue } : row)));
      markResultStale();
    });
  }

  function updateOrderSlot(key: SolverDateKey, patch: Partial<PoscosechaClasificacionOrderSlot>) {
    setOrderSlots((current) => current.map((slot) => (slot.key === key ? { ...slot, ...patch } : slot)));
    markResultStale();
  }

  function updateLotSlot(key: SolverDateKey, patch: Partial<PoscosechaClasificacionLotSlot>) {
    setLotSlots((current) => current.map((slot) => (slot.key === key ? { ...slot, ...patch } : slot)));
    markResultStale();
  }

  function addOrderSlot() {
    setOrderSlots((current) => {
      const nextKey = getNextAvailableKey(current.map((slot) => slot.key));
      if (!nextKey) {
        return current;
      }

      return [...current, { key: nextKey, restriction: null, restrictionMode: "SOFT" }];
    });
    markResultStale();
  }

  function addLotSlot() {
    setLotSlots((current) => {
      const nextKey = getNextAvailableKey(current.map((slot) => slot.key));
      if (!nextKey) {
        return current;
      }

      return [...current, { key: nextKey, lotDate: null, origin: "GV" }];
    });
    markResultStale();
  }

  function removeOrderSlot(key: SolverDateKey) {
    setOrderSlots((current) => (current.length > 1 ? current.filter((slot) => slot.key !== key) : current));
    markResultStale();
  }

  function removeLotSlot(key: SolverDateKey) {
    setLotSlots((current) => (current.length > 1 ? current.filter((slot) => slot.key !== key) : current));
    markResultStale();
  }

  function resetOrders() {
    setOrders(bootData.ordersTemplate);
    clearResults();
  }

  function resetAvailability() {
    setAvailability(bootData.availabilityTemplate);
    setSettings(bootData.settings);
    clearResults();
  }

  function updateDesperdicio(value: string) {
    setSettings((current) => ({
      ...current,
      desperdicio: Math.min(Math.max(toFloat(value), 0), 0.95),
    }));
    markResultStale();
  }

  function applySkuRecordUpdate(record: PoscosechaSkuRecord) {
    setBootData((current) => ({
      ...current,
      skuMaster: current.skuMaster.map((item) => (item.skuId === record.skuId ? record : item)),
    }));
    setOrders((current) => updateSkuRows(current, record));
    markResultStale();
  }

  function findSkuRecord(target: string) {
    return (
      bootData.skuMaster.find((item) => item.skuId === target)
      ?? bootData.skuMaster.find((item) => item.sku === target)
      ?? null
    );
  }

  async function handleRunSolver() {
    setIsRunning(true);
    try {
      const payload = await fetchJson<PoscosechaClasificacionRunPayload>(
        "/api/postcosecha/planificacion/solver/clasificacion-en-blanco",
        "No se pudo ejecutar Clasificacion en blanco.",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orders, availability, settings, orderSlots, lotSlots }),
        },
      );
      setResultBundle(payload.data);
      setIsResultStale(false);
      const firstMode = payload.data.find((r) => r.result !== null)?.mode;
      if (firstMode) {
        setActiveMode(firstMode);
      }
      toast.success("Clasificacion en blanco se resolvio correctamente.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo ejecutar Clasificacion en blanco.");
    } finally {
      setIsRunning(false);
    }
  }

  async function handleOpenRecipe(sku: string) {
    const orderRow = resultOrderRowsBySku.get(sku);
    const netStemValues = netStemValuesBySku.get(sku);

    if (!orderRow || !netStemValues) {
      toast.error("No se encontro el detalle del SKU para construir la receta.");
      return;
    }

    const recipePayload = buildRecipeInput(orderRow, netStemValues, availability);
    if (!recipePayload) {
      toast.error("El SKU seleccionado no tiene suficiente informacion para construir la receta.");
      return;
    }

    setSelectedRecipeSku(sku);
    setRecipeData(null);
    setRecipeError(null);
    setIsRecipeLoading(true);

    try {
      const response = await fetchJson<PoscosechaClasificacionRecipePayload>(
        "/api/postcosecha/planificacion/solver/clasificacion-en-blanco/receta",
        "No se pudo construir la receta del SKU.",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(recipePayload),
        },
      );
      setRecipeData(response.data);
    } catch (error) {
      setRecipeError(error instanceof Error ? error.message : "No se pudo construir la receta del SKU.");
    } finally {
      setIsRecipeLoading(false);
    }
  }

  return {
    bootData,
    orders,
    availability,
    settings,
    orderSlots,
    lotSlots,
    resultBundle,
    activeMode,
    activeResult,
    isResultStale,
    search,
    isRunning,
    isReloading,
    selectedRecipeSku,
    recipeData,
    recipeError,
    isRecipeLoading,
    filteredOrders,
    precheck,
    precheckModes,
    flexiblePrecheck,
    ordersWithCapture,
    gradesWithCapture,
    resultOrderRowsBySku,
    netStemValuesBySku,
    setSearch,
    setActiveMode,
    clearResults,
    markResultStale,
    reloadBase,
    updateOrderValue,
    updateAvailabilityDate,
    updateAvailabilityWeight,
    updateOrderSlot,
    updateLotSlot,
    addOrderSlot,
    addLotSlot,
    removeOrderSlot,
    removeLotSlot,
    resetOrders,
    resetAvailability,
    updateDesperdicio,
    applySkuRecordUpdate,
    findSkuRecord,
    handleRunSolver,
    handleOpenRecipe,
    closeRecipeOverlay,
  };
}
