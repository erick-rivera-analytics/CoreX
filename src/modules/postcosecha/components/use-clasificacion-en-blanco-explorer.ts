"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { fetchJson } from "@/lib/fetch-json";
import {
  buildClasificacionAvailabilityDerived,
  buildClasificacionPrecheck,
} from "@/lib/postcosecha-clasificacion-en-blanco-client";
import type {
  PoscosechaClasificacionBootData,
  PoscosechaClasificacionRecipePayload,
  PoscosechaClasificacionRecipeResult,
  PoscosechaClasificacionResult,
  PoscosechaClasificacionRunPayload,
  SolverDateKey,
} from "@/lib/postcosecha-clasificacion-en-blanco-types";
import { buildRecipeInput, orderTotal, toFloat, toInteger } from "@/modules/postcosecha/components/solver-utils";

export function useClasificacionEnBlancoExplorer(
  initialData: PoscosechaClasificacionBootData,
  initialError?: string | null,
) {
  const [bootData, setBootData] = useState(initialData);
  const [orders, setOrders] = useState(initialData.ordersTemplate);
  const [availability, setAvailability] = useState(initialData.availabilityTemplate);
  const [settings, setSettings] = useState(initialData.settings);
  const [result, setResult] = useState<PoscosechaClasificacionResult | null>(null);
  const [search, setSearch] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [selectedRecipeSku, setSelectedRecipeSku] = useState<string | null>(null);
  const [recipeData, setRecipeData] = useState<PoscosechaClasificacionRecipeResult | null>(null);
  const [recipeError, setRecipeError] = useState<string | null>(null);
  const [isRecipeLoading, setIsRecipeLoading] = useState(false);
  const deferredSearch = useDeferredValue(search);

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
    () => buildClasificacionPrecheck(orders, availability, bootData.skuMaster, settings.desperdicio),
    [availability, bootData.skuMaster, orders, settings.desperdicio],
  );

  const ordersWithCapture = useMemo(() => orders.filter((row) => orderTotal(row) > 0).length, [orders]);
  const gradesWithCapture = useMemo(
    () => availabilityDerived.filter((row) => row.mallasTotales > 0).length,
    [availabilityDerived],
  );
  const resultOrderRowsBySku = useMemo(
    () => new Map((result?.orderRows ?? []).map((row) => [row.sku, row])),
    [result],
  );
  const netStemValuesBySku = useMemo(
    () => new Map((result?.netStemMatrix.rows ?? []).map((row) => [row.sku, row.values])),
    [result],
  );

  useEffect(() => {
    if (initialError) {
      toast.error(initialError);
    }
  }, [initialError]);

  useEffect(() => {
    if (!result) {
      setSelectedRecipeSku(null);
      setRecipeData(null);
      setRecipeError(null);
      setIsRecipeLoading(false);
    }
  }, [result]);

  function applyBootData(nextData: PoscosechaClasificacionBootData) {
    setBootData(nextData);
    setOrders(nextData.ordersTemplate);
    setAvailability(nextData.availabilityTemplate);
    setSettings(nextData.settings);
    setResult(null);
  }

  function closeRecipeOverlay() {
    setSelectedRecipeSku(null);
    setRecipeData(null);
    setRecipeError(null);
    setIsRecipeLoading(false);
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
      setResult(null);
    });
  }

  function updateAvailabilityDate(grado: number, dateKey: SolverDateKey, value: string) {
    const nextValue = toInteger(value);
    startTransition(() => {
      setAvailability((current) => current.map((row) => (row.grado === grado ? { ...row, [dateKey]: nextValue } : row)));
      setResult(null);
    });
  }

  function updateAvailabilityWeight(grado: number, value: string) {
    const nextValue = Math.round(toFloat(value) * 100) / 100;
    startTransition(() => {
      setAvailability((current) => current.map((row) => (row.grado === grado ? { ...row, pesoTalloSeed: nextValue } : row)));
      setResult(null);
    });
  }

  function resetOrders() {
    setOrders(bootData.ordersTemplate);
    setResult(null);
  }

  function resetAvailability() {
    setAvailability(bootData.availabilityTemplate);
    setSettings(bootData.settings);
    setResult(null);
  }

  function updateDesperdicio(value: string) {
    setSettings((current) => ({
      ...current,
      desperdicio: Math.min(Math.max(toFloat(value), 0), 0.95),
    }));
    setResult(null);
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
          body: JSON.stringify({ orders, availability, settings }),
        },
      );
      setResult(payload.data);
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

    const payload = buildRecipeInput(orderRow, netStemValues, availability);
    if (!payload) {
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
          body: JSON.stringify(payload),
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
    result,
    search,
    isRunning,
    isReloading,
    selectedRecipeSku,
    recipeData,
    recipeError,
    isRecipeLoading,
    filteredOrders,
    precheck,
    ordersWithCapture,
    gradesWithCapture,
    resultOrderRowsBySku,
    netStemValuesBySku,
    setSearch,
    setResult,
    reloadBase,
    updateOrderValue,
    updateAvailabilityDate,
    updateAvailabilityWeight,
    resetOrders,
    resetAvailability,
    updateDesperdicio,
    handleRunSolver,
    handleOpenRecipe,
    closeRecipeOverlay,
  };
}
