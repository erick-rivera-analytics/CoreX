"use client";

import { LoaderCircle, RefreshCcw } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { KpiGrid } from "@/shared/layout/filter-panel";
import type { PoscosechaClasificacionBootData } from "@/lib/postcosecha-clasificacion-en-blanco-types";
import { formatInteger, formatPercent } from "@/shared/lib/format";
import { SolverInputsSection, SolverPrecheckSection } from "@/modules/postcosecha/components/solver-capture-sections";
import { SolverMetricTile } from "@/modules/postcosecha/components/solver-feedback-states";
import { RecipeOverlayLauncher } from "@/modules/postcosecha/components/recipe-overlay-launcher";
import { SolverResults } from "@/modules/postcosecha/components/solver-results";
import { SolverShell } from "@/modules/postcosecha/components/solver-shell";
import { useClasificacionEnBlancoExplorer } from "@/modules/postcosecha/components/use-clasificacion-en-blanco-explorer";

type PoscosechaClasificacionEnBlancoExplorerProps = {
  initialData: PoscosechaClasificacionBootData;
  initialError?: string | null;
};

export function PoscosechaClasificacionEnBlancoExplorer({
  initialData,
  initialError,
}: PoscosechaClasificacionEnBlancoExplorerProps) {
  const {
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
  } = useClasificacionEnBlancoExplorer(initialData, initialError);

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
        filteredOrders={filteredOrders}
        ordersWithCapture={ordersWithCapture}
        search={search}
        availability={availability}
        desperdicio={settings.desperdicio}
        gradesWithCapture={gradesWithCapture}
        onSearchChange={setSearch}
        onResetOrders={resetOrders}
        onOrderChange={updateOrderValue}
        onResetAvailability={resetAvailability}
        onDesperdicioChange={updateDesperdicio}
        onAvailabilityDateChange={updateAvailabilityDate}
        onAvailabilityWeightChange={updateAvailabilityWeight}
      />

      <SolverPrecheckSection
        precheck={precheck}
        result={result}
        isRunning={isRunning}
        onClearResults={() => setResult(null)}
        onRun={() => void handleRunSolver()}
      />

      {result ? (
        <SolverResults
          result={result}
          canOpenRecipe={(sku) => (resultOrderRowsBySku.get(sku)?.pedidoResuelto ?? 0) > 0 && netStemValuesBySku.has(sku)}
          onOpenRecipe={(sku) => void handleOpenRecipe(sku)}
        />
      ) : null}

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
