"use client";

import { useMemo, useState } from "react";
import { LoaderCircle, RefreshCcw } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { KpiGrid } from "@/shared/layout/filter-panel";
import type { PoscosechaClasificacionBootData } from "@/lib/postcosecha-clasificacion-en-blanco-types";
import { formatInteger, formatPercent } from "@/shared/lib/format";
import { SolverInputsSection, SolverPrecheckSection } from "@/modules/postcosecha/components/solver-capture-sections";
import { SolverExportPdfButton } from "@/modules/postcosecha/components/solver-export-pdf-button";
import { SolverLotSlotOverlay } from "@/modules/postcosecha/components/solver-lot-slot-overlay";
import { SolverMetricTile } from "@/modules/postcosecha/components/solver-feedback-states";
import { SolverModeSelector } from "@/modules/postcosecha/components/solver-mode-selector";
import { SolverOrderSlotOverlay } from "@/modules/postcosecha/components/solver-order-slot-overlay";
import { RecipeOverlayLauncher } from "@/modules/postcosecha/components/recipe-overlay-launcher";
import { SolverResults } from "@/modules/postcosecha/components/solver-results";
import { SolverShell } from "@/modules/postcosecha/components/solver-shell";
import { SolverSkuInfoOverlay } from "@/modules/postcosecha/components/solver-sku-info-overlay";
import { SolverWeightEditorOverlay } from "@/modules/postcosecha/components/solver-weight-editor-overlay";
import { useClasificacionEnBlancoExplorer } from "@/modules/postcosecha/hooks/use-clasificacion-en-blanco-explorer";

type PoscosechaClasificacionEnBlancoExplorerProps = {
  initialData: PoscosechaClasificacionBootData;
  initialError?: string | null;
};

export function PoscosechaClasificacionEnBlancoExplorer({
  initialData,
  initialError,
}: PoscosechaClasificacionEnBlancoExplorerProps) {
  const [isWeightEditorOpen, setIsWeightEditorOpen] = useState(false);
  const [editingOrderSlotKey, setEditingOrderSlotKey] = useState<string | null>(null);
  const [editingLotSlotKey, setEditingLotSlotKey] = useState<string | null>(null);
  const [selectedSkuKey, setSelectedSkuKey] = useState<string | null>(null);

  const {
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
    applySkuRecordUpdate,
    findSkuRecord,
    handleRunSolver,
    handleOpenRecipe,
    closeRecipeOverlay,
  } = useClasificacionEnBlancoExplorer(initialData, initialError);

  const selectedSkuRecord = useMemo(
    () => (selectedSkuKey ? findSkuRecord(selectedSkuKey) : null),
    [selectedSkuKey, findSkuRecord],
  );
  const activeOrderSlot = useMemo(
    () => orderSlots.find((slot) => slot.key === editingOrderSlotKey) ?? null,
    [editingOrderSlotKey, orderSlots],
  );
  const activeLotSlot = useMemo(
    () => lotSlots.find((slot) => slot.key === editingLotSlotKey) ?? null,
    [editingLotSlotKey, lotSlots],
  );

  function openSkuOverlay(skuKey: string) {
    setSelectedSkuKey(skuKey);
  }

  return (
    <div className="space-y-4">
      <SolverShell
        engine={bootData.metadata.engine}
        masterSource={bootData.metadata.masterSource}
        workbookPath={bootData.metadata.workbookPath}
        usedFallbackDefaults={bootData.metadata.usedFallbackDefaults}
        kpis={(
          <KpiGrid>
            <SolverMetricTile
              label="SKU activos"
              value={formatInteger(bootData.skuMaster.length)}
              hint="Maestro vigente disponible para pedidos."
            />
            <SolverMetricTile
              label="SKU con captura"
              value={formatInteger(ordersWithCapture)}
              hint="Pedidos mayores a cero en esta corrida."
              tone={ordersWithCapture > 0 ? "positive" : "default"}
            />
            <SolverMetricTile
              label="Grados base"
              value={formatInteger(availability.length)}
              hint="Semillas iniciales para disponibilidad."
            />
            <SolverMetricTile
              label="Desperdicio"
              value={formatPercent(settings.desperdicio, { input: "ratio" })}
              hint="Parametro global usado por el solver."
            />
          </KpiGrid>
        )}
      >
        <Button
          type="button"
          variant="outline"
          onClick={() => void reloadBase()}
          disabled={isReloading}
        >
          {isReloading ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
          Recargar base
        </Button>
      </SolverShell>

      <SolverInputsSection
        orders={orders}
        availability={availability}
        desperdicio={settings.desperdicio}
        orderSlots={orderSlots}
        lotSlots={lotSlots}
        ordersWithCapture={ordersWithCapture}
        gradesWithCapture={gradesWithCapture}
        onResetOrders={resetOrders}
        onResetAvailability={resetAvailability}
        onAddOrderSlot={addOrderSlot}
        onAddLotSlot={addLotSlot}
        onEditOrderSlot={setEditingOrderSlotKey}
        onEditLotSlot={setEditingLotSlotKey}
        onRemoveOrderSlot={removeOrderSlot}
        onRemoveLotSlot={removeLotSlot}
        onOpenWeightEditor={() => setIsWeightEditorOpen(true)}
      />

      <SolverPrecheckSection
        precheck={precheck}
        precheckModes={precheckModes}
        flexiblePrecheck={flexiblePrecheck}
        hasResult={resultBundle !== null}
        isResultStale={isResultStale}
        isRunning={isRunning}
        exportAction={resultBundle ? <SolverExportPdfButton runs={resultBundle} /> : null}
        onClearResults={clearResults}
        onRun={() => void handleRunSolver()}
      />

      {resultBundle ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SolverModeSelector
              runs={resultBundle}
              activeMode={activeMode}
              onModeChange={setActiveMode}
            />
          </div>
          {activeResult?.result ? (
            <SolverResults
              result={activeResult.result}
              canOpenRecipe={(sku) => (resultOrderRowsBySku.get(sku)?.pedidoResuelto ?? 0) > 0 && netStemValuesBySku.has(sku)}
              onOpenRecipe={(sku) => void handleOpenRecipe(sku)}
              onOpenSkuInfo={openSkuOverlay}
            />
          ) : null}
        </>
      ) : null}

      <SolverOrderSlotOverlay
        open={activeOrderSlot !== null}
        orders={orders}
        filteredOrders={filteredOrders}
        search={search}
        slot={activeOrderSlot}
        onClose={() => setEditingOrderSlotKey(null)}
        onSearchChange={setSearch}
        onOrderChange={updateOrderValue}
        onUpdateSlot={updateOrderSlot}
        onOpenSkuInfo={openSkuOverlay}
      />

      <SolverLotSlotOverlay
        open={activeLotSlot !== null}
        availability={availability}
        desperdicio={settings.desperdicio}
        slot={activeLotSlot}
        onClose={() => setEditingLotSlotKey(null)}
        onUpdateSlot={updateLotSlot}
        onAvailabilityDateChange={updateAvailabilityDate}
      />

      <SolverWeightEditorOverlay
        open={isWeightEditorOpen}
        rows={availability}
        onClose={() => setIsWeightEditorOpen(false)}
        onWeightChange={updateAvailabilityWeight}
      />

      <SolverSkuInfoOverlay
        record={selectedSkuRecord}
        onClose={() => setSelectedSkuKey(null)}
        onSaved={(record) => {
          applySkuRecordUpdate(record);
          setSelectedSkuKey(record.skuId);
        }}
      />

      <RecipeOverlayLauncher
        sku={selectedRecipeSku}
        data={recipeData}
        isLoading={isRecipeLoading}
        error={recipeError}
        onClose={closeRecipeOverlay}
      />
    </div>
  );
}
