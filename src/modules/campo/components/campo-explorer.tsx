"use client";

import dynamic from "next/dynamic";
import type { FeatureCollection } from "geojson";
import { useEffect, useMemo, useState } from "react";
import { Map as MapIcon } from "lucide-react";
import useSWRImmutable from "swr/immutable";

import { BlockProfileModal } from "@/modules/fenograma/components/block-profile-modal";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { FilterPanel } from "@/shared/layout/filter-panel";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent } from "@/shared/ui/card";
import { EmptyState } from "@/shared/data-display/empty-state";
import { formatInteger } from "@/shared/lib/format";
import { useBlockProfileModal } from "@/hooks/use-block-profile-modal";
import { fetchJson } from "@/lib/fetch-json";
import type { ActiveLayer, RasterBounds } from "@/modules/campo/components/campo-map";
import type { CampoDashboardData, CampoMapFeature } from "@/lib/campo";

const DEFAULT_RASTER_OPACITY = 0.9;

const CampoLeafletMap = dynamic(
  () => import("@/modules/campo/components/campo-map").then((module) => ({ default: module.CampoLeafletMap })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[82dvh] min-h-[640px] w-full animate-pulse rounded-[26px] bg-muted/40" />
    ),
  },
);

const CampoRasterControls = dynamic(
  () => import("@/modules/campo/components/campo-map").then((module) => ({ default: module.CampoRasterControls })),
  { ssr: false },
);

const CampoRasterLegend = dynamic(
  () => import("@/modules/campo/components/campo-map").then((module) => ({ default: module.CampoRasterLegend })),
  { ssr: false },
);

const CampoSubMapModal = dynamic(
  () =>
    import("@/modules/campo/components/campo-sub-map-modal").then((module) => ({
      default: module.CampoSubMapModal,
    })),
  { ssr: false },
);

const CampoMapInset = dynamic(
  () =>
    import("@/modules/campo/components/campo-sjp-inset").then((module) => ({
      default: module.CampoMapInset,
    })),
  {
    ssr: false,
    loading: () => <div className="h-[280px] w-full animate-pulse rounded-[26px] bg-muted/40 xl:min-h-[420px]" />,
  },
);

const CampoCycleSelectorModal = dynamic(
  () =>
    import("@/modules/campo/components/campo-cycle-selector").then((module) => ({
      default: module.CampoCycleSelectorModal,
    })),
  { ssr: false },
);

type CampoMapAssets = {
  geoData: FeatureCollection;
  rasterBounds: RasterBounds;
};

type SubMapState =
  | { mode: "valves"; bloquePad: string }
  | { mode: "beds"; bloquePad: string; valveId: string };

type PendingValveNav = {
  cycleKey: string;
  valveId?: string;
  bedId?: string;
};

type MapViewKey = "campo" | "sjp";

type MapViewModel = {
  key: MapViewKey;
  title: string;
  description: string;
  actionLabel: string;
  geoData: FeatureCollection | null;
  loading: boolean;
  error: string | null;
  secondaryActionLabel: string;
};

async function loadGeoCollection(url: string, errorMessage: string) {
  return fetchJson<FeatureCollection>(url, errorMessage);
}

async function loadCampoMapAssets(
  [geoUrl, boundsUrl]: readonly [string, string],
): Promise<CampoMapAssets> {
  const [geoData, rasterBounds] = await Promise.all([
    fetchJson<FeatureCollection>(geoUrl, "No se pudo cargar la geometria del mapa."),
    fetchJson<RasterBounds>(boundsUrl, "No se pudieron cargar los limites raster.").catch(
      () => ({} as RasterBounds),
    ),
  ]);

  return { geoData, rasterBounds };
}

function normalizeBlockKey(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return "";
  }

  if (!/^\d+$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  return String(Number(trimmed));
}


function buildFeatureLookup(features: CampoMapFeature[]) {
  const lookup = new Map<string, CampoMapFeature>();

  for (const feature of features) {
    const rawKey = feature.block.trim();
    const normalizedKey = normalizeBlockKey(rawKey);

    if (rawKey && !lookup.has(rawKey)) {
      lookup.set(rawKey, feature);
    }

    if (normalizedKey && !lookup.has(normalizedKey)) {
      lookup.set(normalizedKey, feature);
    }
  }

  return lookup;
}

function buildBlockLookupRecord<T>(
  features: CampoMapFeature[],
  getValue: (feature: CampoMapFeature) => T | null,
) {
  const lookup = new Map<string, T>();

  for (const feature of features) {
    const value = getValue(feature);

    if (value === null) {
      continue;
    }

    const rawKey = feature.block.trim();
    const normalizedKey = normalizeBlockKey(rawKey);

    if (rawKey && !lookup.has(rawKey)) {
      lookup.set(rawKey, value);
    }

    if (normalizedKey && !lookup.has(normalizedKey)) {
      lookup.set(normalizedKey, value);
    }
  }

  return Object.fromEntries(lookup);
}

export function CampoExplorer({ initialData }: { initialData: CampoDashboardData }) {
  const [activeLayer, setActiveLayer] = useState<ActiveLayer>("none");
  const [rasterOpacity, setRasterOpacity] = useState(DEFAULT_RASTER_OPACITY);
  const [activeMapView, setActiveMapView] = useState<MapViewKey>("campo");
  const [selectedFeature, setSelectedFeature] = useState<CampoMapFeature | null>(null);
  const [subMap, setSubMap] = useState<SubMapState | null>(null);
  const [cycleSelector, setCycleSelector] = useState<{
    bloquePad: string;
    contextLabel: string;
    valveId?: string;
  } | null>(null);
  const [pendingValveNav, setPendingValveNav] = useState<PendingValveNav | null>(null);
  const [directPanelMode, setDirectPanelMode] = useState(false);

  const {
    data: mapAssets,
    error: mapAssetsError,
    isLoading: mapAssetsLoading,
  } = useSWRImmutable(
    ["/data/campo-geo.json", "/rasters/bounds.json"] as const,
    loadCampoMapAssets,
    { revalidateOnFocus: false },
  );

  const {
    data: sjpGeoData,
    error: sjpGeoError,
    isLoading: sjpGeoLoading,
  } = useSWRImmutable(
    "/data/sjp-geo.json",
    (url: string) => loadGeoCollection(url, "No se pudo cargar el mapa SJP."),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    },
  );

  const blockModal = useBlockProfileModal(selectedFeature?.row ?? null);
  const featureByBlock = useMemo(
    () => buildFeatureLookup(initialData.features),
    [initialData.features],
  );
  const blockDataMap = useMemo(
    () => buildBlockLookupRecord(initialData.features, (feature) => ({
      stemsIntensity: feature.stemsIntensity,
      hasData: feature.hasData,
    })),
    [initialData.features],
  );
  const areaByBlock = useMemo(
    () =>
      buildBlockLookupRecord(
        initialData.features,
        (feature) => feature.row.area?.trim() || null,
      ),
    [initialData.features],
  );

  const mapAssetsErrorMessage = mapAssetsError instanceof Error
    ? mapAssetsError.message
    : mapAssetsError
      ? "No se pudieron cargar los assets del mapa."
      : null;
  const sjpGeoErrorMessage = sjpGeoError instanceof Error
    ? sjpGeoError.message
    : sjpGeoError
      ? "No se pudo cargar el mapa SJP."
      : null;

  const campoGeoData = mapAssets?.geoData ?? null;
  const rasterBounds = mapAssets?.rasterBounds ?? {};
  const viewModels = useMemo<Record<MapViewKey, MapViewModel>>(
    () => ({
      campo: {
        key: "campo",
        title: "Mapa MH",
        description: "Vista principal con bloques y navegacion por valvulas.",
        actionLabel: "Cambiar a MH",
        geoData: campoGeoData,
        loading: mapAssetsLoading,
        error: mapAssetsErrorMessage,
        secondaryActionLabel: "Mapa de valvulas",
      },
      sjp: {
        key: "sjp",
        title: "Mapa SJP",
        description: "Vista SJP con bloques y camas listas para navegar.",
        actionLabel: "Cambiar a SJP",
        geoData: sjpGeoData ?? null,
        loading: sjpGeoLoading || mapAssetsLoading,
        error: sjpGeoErrorMessage ?? mapAssetsErrorMessage,
        secondaryActionLabel: "Mapa de camas",
      },
    }),
    [
      campoGeoData,
      mapAssetsErrorMessage,
      mapAssetsLoading,
      sjpGeoData,
      sjpGeoErrorMessage,
      sjpGeoLoading,
    ],
  );
  const activeViewModel = viewModels[activeMapView];
  const previewViewModel = viewModels[activeMapView === "campo" ? "sjp" : "campo"];

  useEffect(() => {
    if (!pendingValveNav || !selectedFeature) {
      return;
    }

    const { cycleKey, valveId, bedId } = pendingValveNav;
    const timer = window.setTimeout(() => {
      if (bedId) {
        blockModal.openBeds(cycleKey);
      } else if (valveId) {
        blockModal.openValves(cycleKey);
        blockModal.openValve(cycleKey, valveId);
      } else {
        blockModal.openValves(cycleKey);
      }

      setPendingValveNav(null);
    }, 80);

    return () => window.clearTimeout(timer);
  }, [blockModal, pendingValveNav, selectedFeature]);

  function getFeatureByBlock(bloquePad: string) {
    return featureByBlock.get(bloquePad)
      ?? featureByBlock.get(normalizeBlockKey(bloquePad))
      ?? null;
  }

  function handleFicha(bloquePad: string) {
    setDirectPanelMode(false);
    setSelectedFeature(getFeatureByBlock(bloquePad));
  }

  function handleValves(bloquePad: string) {
    setSubMap({ mode: "valves", bloquePad });
  }

  function handleSjpBeds(bloquePad: string) {
    setSubMap({ mode: "beds", bloquePad, valveId: bloquePad });
  }

  function handleMapSecondaryAction(bloquePad: string) {
    if (activeMapView === "sjp") {
      handleSjpBeds(bloquePad);
      return;
    }

    handleValves(bloquePad);
  }

  function handleValveDetail(valveId: string, bloquePad: string) {
    setSubMap(null);
    setCycleSelector({
      bloquePad,
      contextLabel: `Valvula ${valveId.split("-").pop()} · Bloque ${bloquePad}`,
      valveId,
    });
  }

  function handleBedMap(valveId: string, bloquePad: string) {
    setSubMap({ mode: "beds", bloquePad, valveId });
  }

  function handleBedDetail(bedId: string, bloquePad: string, cycleKey: string) {
    setSelectedFeature(getFeatureByBlock(bloquePad));
    setSubMap(null);
    setDirectPanelMode(true);
    setPendingValveNav({ cycleKey, bedId });
  }

  function handleCycleSelected(cycleKey: string) {
    if (!cycleSelector) {
      return;
    }

    const { valveId, bloquePad } = cycleSelector;
    setSelectedFeature(getFeatureByBlock(bloquePad));
    setCycleSelector(null);
    setDirectPanelMode(true);
    setPendingValveNav({ cycleKey, valveId });
  }

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Indicadores / Producción / Campo"
        title="Campo"
        subtitle="Vista espacial de bloques, valvulas y camas con capas agronomicas y navegacion interactiva."
        icon={<MapIcon className="size-6" aria-hidden="true" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-full px-3 py-1">
              {initialData.summary.blockCount} bloques
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              {initialData.summary.matchedBlocks} con match
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              {formatInteger(initialData.summary.totalProducibleArea)} m² producibles
            </Badge>
          </div>
        }
      >
        <FilterPanel>
          <div className="rounded-[28px] border border-border/70 bg-background/72 p-4">
            <div className="flex flex-wrap items-start gap-3">
              {initialData.areaSummaries.length === 0 ? (
                <EmptyState label="No hay areas disponibles." />
              ) : (
                initialData.areaSummaries.map((label) => (
                  <div
                    key={label.area}
                    className="rounded-2xl border border-border/70 bg-card/88 px-4 py-3 shadow-sm"
                  >
                    <p className="text-sm font-semibold">{label.area}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {label.blockCount} bloques · {formatInteger(label.producibleArea)} m² producibles
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </FilterPanel>
      </SectionPageShell>

      <Card className="starter-panel border-border/70 bg-card/82">
        <CardContent className="space-y-4 p-4">
          <div className="rounded-[30px] border border-border/70 bg-background/72 p-3">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3 px-1">
              <CampoRasterControls
                active={activeLayer}
                opacity={rasterOpacity}
                onChange={setActiveLayer}
                onOpacityChange={setRasterOpacity}
              />
              <div className="space-y-1 text-right">
                <p className="text-xs font-medium text-foreground">
                  {activeLayer === "none"
                    ? `Vista activa · ${activeViewModel.title}`
                    : `Modo agronomico · ${activeLayer.toUpperCase()} · ${activeViewModel.title}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {activeMapView === "campo"
                    ? "Click en un bloque -> ficha o mapa de valvulas. En submapa: valvula -> ficha o mapa de camas."
                    : "Click en un bloque SJP -> ficha o mapa de camas. En submapa: cama -> selector de ciclo y detalle."}
                </p>
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
              <CampoLeafletMap
                key={activeMapView}
                viewKey={activeMapView}
                geoData={activeViewModel.geoData}
                rasterBounds={rasterBounds}
                assetsLoading={activeViewModel.loading}
                assetsError={activeViewModel.error}
                blockDataMap={blockDataMap}
                areaByBlock={areaByBlock}
                activeLayer={activeLayer}
                rasterOpacity={rasterOpacity}
                onFicha={handleFicha}
                onSecondaryAction={handleMapSecondaryAction}
                secondaryActionLabel={activeViewModel.secondaryActionLabel}
                showFloatingLegend={false}
                className="h-[82dvh] min-h-[640px] border border-border/70"
              />

              <div className="self-start space-y-3">
                <CampoMapInset
                  key={previewViewModel.key}
                  viewKey={previewViewModel.key}
                  title={previewViewModel.title}
                  description={previewViewModel.description}
                  actionLabel={previewViewModel.actionLabel}
                  geoData={previewViewModel.geoData}
                  loading={previewViewModel.loading}
                  error={previewViewModel.error}
                  activeLayer={activeLayer}
                  rasterBounds={rasterBounds}
                  rasterOpacity={rasterOpacity}
                  layerBadge={activeLayer === "none" ? "Sin capa activa" : `Capa ${activeLayer.toUpperCase()}`}
                  onActivate={() => setActiveMapView(previewViewModel.key)}
                  className="xl:min-h-0"
                />
                <CampoRasterLegend
                  activeLayer={activeLayer}
                  opacity={rasterOpacity}
                  className="w-full max-w-none"
                />
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-border/70 bg-background/72 px-5 py-4 text-sm text-muted-foreground">
            El mapa queda como foco principal. La navegación de vista y las capas se resuelven desde el lateral y la barra superior del canvas.
          </div>
        </CardContent>
      </Card>

      <BlockProfileModal
        row={selectedFeature?.row ?? null}
        data={blockModal.blockData}
        loading={blockModal.blockLoading}
        error={blockModal.blockError}
        selectedCycleKey={blockModal.selectedCycleKey}
        bedData={blockModal.bedData}
        bedLoading={blockModal.bedLoading}
        bedError={blockModal.bedError}
        selectedValveCycleKey={blockModal.selectedValveCycleKey}
        valvesData={blockModal.valvesData}
        valvesLoading={blockModal.valvesLoading}
        valvesError={blockModal.valvesError}
        selectedValve={blockModal.selectedValve}
        valveData={blockModal.valveData}
        valveLoading={blockModal.valveLoading}
        valveError={blockModal.valveError}
        selectedCurveCycleKey={blockModal.selectedCurveCycleKey}
        curveData={blockModal.curveData}
        curveLoading={blockModal.curveLoading}
        curveError={blockModal.curveError}
        selectedMortalityCurve={blockModal.selectedMortalityCurve}
        mortalityCurveData={blockModal.mortalityCurveData}
        mortalityCurveLoading={blockModal.mortalityCurveLoading}
        mortalityCurveError={blockModal.mortalityCurveError}
        onOpenBeds={blockModal.openBeds}
        onCloseBeds={blockModal.closeBeds}
        onOpenValves={blockModal.openValves}
        onCloseValves={blockModal.closeValves}
        onOpenValve={blockModal.openValve}
        onOpenCurve={blockModal.openCurve}
        onCloseCurve={blockModal.closeCurve}
        onOpenCycleMortalityCurve={blockModal.openCycleMortalityCurve}
        onOpenValveMortalityCurve={blockModal.openValveMortalityCurve}
        onOpenBedMortalityCurve={blockModal.openBedMortalityCurve}
        onCloseMortalityCurve={blockModal.closeMortalityCurve}
        directMode={directPanelMode}
        onClose={() => {
          setSelectedFeature(null);
          setDirectPanelMode(false);
        }}
      />

      {subMap && (
        <CampoSubMapModal
          geoData={activeViewModel.geoData}
          rasterBounds={rasterBounds}
          assetsLoading={activeViewModel.loading}
          assetsError={activeViewModel.error}
          bloquePad={subMap.bloquePad}
          mode={subMap.mode}
          valveId={subMap.mode === "beds" ? subMap.valveId : undefined}
          activeLayer={activeLayer}
          rasterOpacity={rasterOpacity}
          onLayerChange={setActiveLayer}
          onRasterOpacityChange={setRasterOpacity}
          onValveDetail={handleValveDetail}
          onBedMap={handleBedMap}
          onBedDetail={handleBedDetail}
          onClose={() => setSubMap(null)}
        />
      )}

      {cycleSelector && (
        <CampoCycleSelectorModal
          bloquePad={cycleSelector.bloquePad}
          contextLabel={cycleSelector.contextLabel}
          onSelect={handleCycleSelected}
          onClose={() => setCycleSelector(null)}
        />
      )}
    </div>
  );
}
