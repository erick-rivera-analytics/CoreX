"use client";

import "leaflet/dist/leaflet.css";

import type { Feature, FeatureCollection, GeoJsonObject } from "geojson";
import L from "leaflet";
import { X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GeoJSON,
  MapContainer,
  Marker,
  Pane,
  Popup,
  useMap,
} from "react-leaflet";

import { CampoCycleSelectorModal } from "@/modules/campo/components/campo-cycle-selector";
import {
  CampoBaseTiles,
  CampoInteractionHint,
  CampoRasterControls,
  CampoRasterLegend,
  CampoRasterOverlay,
  type ActiveLayer,
  type RasterBounds,
} from "@/modules/campo/components/campo-map";
import {
  BED_COLORS,
  DEFAULT_VALVE_FILL,
  FALLBACK_FEATURE_FILL,
  FALLBACK_LEGEND_DOT,
  MAP_INSET_BG,
  VALVE_COLORS,
} from "@/modules/campo/lib/sub-map-palette";
import { Button } from "@/shared/ui/button";

type SubMapMode = "valves" | "beds";

type ValveClickState = {
  latlng: L.LatLng;
  valveId: string;
  valvula: string;
  bloquePad: string;
};

type BedClickState = {
  latlng: L.LatLng;
  bedId: string;
  cama: number;
  valvula: string;
  bloquePad: string;
};

type Props = {
  geoData: FeatureCollection | null;
  rasterBounds: RasterBounds;
  assetsLoading: boolean;
  assetsError: string | null;
  bloquePad: string;
  mode: SubMapMode;
  valveId?: string;
  activeLayer: ActiveLayer;
  rasterOpacity: number;
  onLayerChange: (layer: ActiveLayer) => void;
  onRasterOpacityChange: (opacity: number) => void;
  onValveDetail: (valveId: string, bloquePad: string) => void;
  onBedMap: (valveId: string, bloquePad: string) => void;
  onBedDetail: (bedId: string, bloquePad: string, cycleKey: string) => void;
  onClose: () => void;
};

const SUBMAP_PANES = {
  raster: "campo-sub-raster-pane",
  vectors: "campo-sub-vectors-pane",
  labels: "campo-sub-labels-pane",
} as const;

function makeValveIcon(label: string, color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      background:${color};
      color:white;
      padding:2px 7px;
      border-radius:999px;
      font-size:10px;
      font-weight:800;
      pointer-events:none;
      white-space:nowrap;
      box-shadow:0 1px 5px rgba(15,23,42,0.24);
      border:1px solid rgba(255,255,255,0.4);
      letter-spacing:0.04em;
    ">V-${label}</div>`,
    iconSize: undefined as unknown as L.PointExpression,
    iconAnchor: [0, 0],
  });
}

function makeBedIcon(cama: number) {
  return L.divIcon({
    className: "",
    html: `<div style="
      background:rgba(15,23,42,0.72);
      color:white;
      padding:1px 5px;
      border-radius:999px;
      font-size:9px;
      font-weight:700;
      pointer-events:none;
      white-space:nowrap;
      box-shadow:0 1px 3px rgba(15,23,42,0.22);
    ">${cama}</div>`,
    iconSize: undefined as unknown as L.PointExpression,
    iconAnchor: [0, 0],
  });
}

function featureCentroid(feature: Feature): [number, number] | null {
  try {
    if (feature.geometry.type === "Polygon") {
      const ring = feature.geometry.coordinates[0] as number[][];
      const lat = ring.reduce((sum, coordinate) => sum + coordinate[1], 0) / ring.length;
      const lng = ring.reduce((sum, coordinate) => sum + coordinate[0], 0) / ring.length;
      return [lat, lng];
    }

    if (feature.geometry.type === "MultiPolygon") {
      const ring = feature.geometry.coordinates[0][0] as number[][];
      const lat = ring.reduce((sum, coordinate) => sum + coordinate[1], 0) / ring.length;
      const lng = ring.reduce((sum, coordinate) => sum + coordinate[0], 0) / ring.length;
      return [lat, lng];
    }
  } catch {
    return null;
  }

  return null;
}

function groupCentroids<K extends string>(
  features: Feature[],
  keyFn: (feature: Feature) => K | undefined,
) {
  const accumulators = new Map<K, { sumLat: number; sumLng: number; count: number }>();

  for (const feature of features) {
    const key = keyFn(feature);
    const centroid = featureCentroid(feature);

    if (!key || !centroid) {
      continue;
    }

    const current = accumulators.get(key) ?? { sumLat: 0, sumLng: 0, count: 0 };
    current.sumLat += centroid[0];
    current.sumLng += centroid[1];
    current.count += 1;
    accumulators.set(key, current);
  }

  return new Map(
    Array.from(accumulators.entries()).map(([key, value]) => [
      key,
      [value.sumLat / value.count, value.sumLng / value.count] as [number, number],
    ]),
  );
}

function getFeatureCollectionBounds(data: FeatureCollection | null) {
  if (!data?.features.length) {
    return null;
  }

  try {
    const bounds = L.geoJSON(data as GeoJsonObject).getBounds();
    return bounds.isValid() ? bounds : null;
  } catch {
    return null;
  }
}

function FitBounds({ data }: { data: FeatureCollection }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current || !data.features.length) {
      return;
    }

    try {
      const bounds = getFeatureCollectionBounds(data);

      if (bounds?.isValid()) {
        map.fitBounds(bounds, { padding: [18, 18], maxZoom: 20 });
        fitted.current = true;
      }
    } catch {
      // Keep the initial frame when bounds are not valid.
    }
  }, [data, map]);

  return null;
}

function ValveMap({
  features,
  activeLayer,
  onValveDetail,
  onBedMap,
}: {
  features: Feature[];
  activeLayer: ActiveLayer;
  onValveDetail: (valveId: string, bloquePad: string) => void;
  onBedMap: (valveId: string, bloquePad: string) => void;
}) {
  const [click, setClick] = useState<ValveClickState | null>(null);
  const valveColorMap = useMemo(() => {
    const ids = [...new Set(features.map((feature) => feature.properties?.valveId as string))].sort();
    return new Map(ids.map((id, index) => [id, VALVE_COLORS[index % VALVE_COLORS.length]]));
  }, [features]);
  const featureCollection = useMemo<FeatureCollection>(
    () => ({ type: "FeatureCollection", features }),
    [features],
  );
  const valveCentroids = useMemo(
    () => groupCentroids(features, (feature) => feature.properties?.valveId as string),
    [features],
  );

  const styleFeature = useCallback(
    (feature: Feature | undefined): L.PathOptions => ({
      fillColor: valveColorMap.get(feature?.properties?.valveId ?? "") ?? FALLBACK_FEATURE_FILL,
      color: activeLayer === "none" ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0.78)",
      weight: activeLayer === "none" ? 1.1 : 1.35,
      fillOpacity: activeLayer === "none" ? 0.78 : 0.46,
    }),
    [activeLayer, valveColorMap],
  );

  const onEachFeature = useCallback(
    (feature: Feature, layer: L.Layer) => {
      layer.on({
        click(event: L.LeafletMouseEvent) {
          const properties = feature.properties;

          if (!properties) {
            return;
          }

          L.DomEvent.stopPropagation(event);
          setClick({
            latlng: event.latlng,
            valveId: properties.valveId,
            valvula: properties.valvula,
            bloquePad: properties.bloquePad,
          });
        },
        mouseover(event: L.LeafletMouseEvent) {
          (event.target as L.Path).setStyle({
            weight: activeLayer === "none" ? 2.4 : 2.8,
            fillOpacity: activeLayer === "none" ? 0.94 : 0.62,
          });
        },
        mouseout(event: L.LeafletMouseEvent) {
          (event.target as L.Path).setStyle({
            weight: activeLayer === "none" ? 1.1 : 1.35,
            fillOpacity: activeLayer === "none" ? 0.78 : 0.46,
          });
        },
      });
    },
    [activeLayer],
  );

  return (
    <>
      <Pane name={SUBMAP_PANES.vectors} style={{ zIndex: 420 }}>
        <GeoJSON
          data={featureCollection as GeoJsonObject}
          style={styleFeature}
          onEachFeature={onEachFeature}
        />
      </Pane>

      <Pane name={SUBMAP_PANES.labels} style={{ zIndex: 520, pointerEvents: "none" }}>
        {Array.from(valveCentroids.entries()).map(([valveId, [lat, lng]]) => {
          const letter = valveId.split("-").pop() ?? valveId;
          const color = valveColorMap.get(valveId) ?? DEFAULT_VALVE_FILL;

          return (
            <Marker
              key={`valve-${valveId}`}
              position={[lat, lng]}
              icon={makeValveIcon(letter, color)}
              interactive={false}
              pane={SUBMAP_PANES.labels}
              zIndexOffset={800}
            />
          );
        })}
      </Pane>

      {click && (
        <Popup
          position={click.latlng}
          keepInView
          autoPan
          offset={[0, -16]}
          autoPanPaddingTopLeft={[24, 24]}
          autoPanPaddingBottomRight={[28, 196]}
          minWidth={220}
          maxWidth={240}
          eventHandlers={{ remove: () => setClick(null) }}
        >
          <div className="min-w-[180px] space-y-2.5 p-1">
            <p className="mb-1 text-[13px] font-bold text-slate-900 dark:text-white">Válvula {click.valvula}</p>
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-white">{click.valveId}</p>
            <button
              type="button"
              className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
              onClick={() => {
                onValveDetail(click.valveId, click.bloquePad);
                setClick(null);
              }}
            >
              Ver detalle válvula
            </button>
            <button
              type="button"
              className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
              onClick={() => {
                onBedMap(click.valveId, click.bloquePad);
                setClick(null);
              }}
            >
              Abrir mapa de camas
            </button>
          </div>
        </Popup>
      )}

      <FitBounds data={featureCollection} />
    </>
  );
}

function BedMap({
  features,
  activeLayer,
  onBedCycleSelect,
}: {
  features: Feature[];
  activeLayer: ActiveLayer;
  onBedCycleSelect: (bedId: string, bloquePad: string) => void;
}) {
  const [click, setClick] = useState<BedClickState | null>(null);
  const featureCollection = useMemo<FeatureCollection>(
    () => ({ type: "FeatureCollection", features }),
    [features],
  );
  const bedCentroids = useMemo(
    () => groupCentroids(features, (feature) => String(feature.properties?.cama ?? "")),
    [features],
  );

  const styleFeature = useCallback(
    (feature: Feature | undefined): L.PathOptions => {
      const cama = (feature?.properties?.cama as number) ?? 0;

      return {
        fillColor: BED_COLORS[(cama - 1) % BED_COLORS.length] ?? FALLBACK_FEATURE_FILL,
        color: activeLayer === "none" ? "rgba(255,255,255,0.56)" : "rgba(255,255,255,0.74)",
        weight: activeLayer === "none" ? 1 : 1.25,
        fillOpacity: activeLayer === "none" ? 0.78 : 0.42,
      };
    },
    [activeLayer],
  );

  const onEachFeature = useCallback(
    (feature: Feature, layer: L.Layer) => {
      layer.on({
        click(event: L.LeafletMouseEvent) {
          const properties = feature.properties;

          if (!properties) {
            return;
          }

          L.DomEvent.stopPropagation(event);
          setClick({
            latlng: event.latlng,
            bedId: properties.bedId,
            cama: properties.cama,
            valvula: properties.valvula,
            bloquePad: properties.bloquePad,
          });
        },
        mouseover(event: L.LeafletMouseEvent) {
          (event.target as L.Path).setStyle({
            weight: activeLayer === "none" ? 2.3 : 2.7,
            fillOpacity: activeLayer === "none" ? 0.9 : 0.58,
          });
        },
        mouseout(event: L.LeafletMouseEvent) {
          (event.target as L.Path).setStyle({
            weight: activeLayer === "none" ? 1 : 1.25,
            fillOpacity: activeLayer === "none" ? 0.78 : 0.42,
          });
        },
      });
    },
    [activeLayer],
  );

  return (
    <>
      <Pane name={SUBMAP_PANES.vectors} style={{ zIndex: 420 }}>
        <GeoJSON
          data={featureCollection as GeoJsonObject}
          style={styleFeature}
          onEachFeature={onEachFeature}
        />
      </Pane>

      <Pane name={SUBMAP_PANES.labels} style={{ zIndex: 520, pointerEvents: "none" }}>
        {Array.from(bedCentroids.entries()).map(([cama, [lat, lng]]) => (
          <Marker
            key={`bed-${cama}`}
            position={[lat, lng]}
            icon={makeBedIcon(Number(cama))}
            interactive={false}
            pane={SUBMAP_PANES.labels}
            zIndexOffset={800}
          />
        ))}
      </Pane>

      {click && (
        <Popup
          position={click.latlng}
          keepInView
          autoPan
          offset={[0, -14]}
          autoPanPaddingTopLeft={[24, 24]}
          autoPanPaddingBottomRight={[28, 168]}
          minWidth={212}
          maxWidth={232}
          eventHandlers={{ remove: () => setClick(null) }}
        >
          <div className="min-w-[170px] space-y-2.5 p-1">
            <p className="text-[13px] font-bold text-slate-900 dark:text-white">Cama {click.cama}</p>
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-white">
              Válvula {click.valvula} · Bloque {click.bloquePad}
            </p>
            <button
              type="button"
              className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
              onClick={() => {
                onBedCycleSelect(click.bedId, click.bloquePad);
                setClick(null);
              }}
            >
              Ver ficha / info de cama
            </button>
          </div>
        </Popup>
      )}

      <FitBounds data={featureCollection} />
    </>
  );
}

function ValveLegend({
  valveIds,
  colorMap,
}: {
  valveIds: string[];
  colorMap: Map<string, string>;
}) {
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-[800] flex flex-wrap gap-2 rounded-2xl border border-border/70 bg-background/92 px-3 py-2 shadow-sm backdrop-blur-sm">
      {[...valveIds].sort().map((valveId) => (
        <div key={valveId} className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm" style={{ background: colorMap.get(valveId) ?? FALLBACK_LEGEND_DOT }} />
          <span className="text-xs font-medium">{valveId.split("-").pop()}</span>
        </div>
      ))}
    </div>
  );
}

export function CampoSubMapModal({
  geoData,
  rasterBounds,
  assetsLoading,
  assetsError,
  bloquePad,
  mode,
  valveId,
  activeLayer,
  rasterOpacity,
  onLayerChange,
  onRasterOpacityChange,
  onValveDetail,
  onBedMap,
  onBedDetail,
  onClose,
}: Props) {
  const [bedPending, setBedPending] = useState<{ bedId: string; bloquePad: string } | null>(null);

  const features = useMemo(() => {
    if (!geoData) {
      return [];
    }

    const byBlock = geoData.features.filter(
      (feature) => (feature.properties?.bloquePad as string) === bloquePad,
    );

    if (mode === "beds" && valveId) {
      return byBlock.filter(
        (feature) => (feature.properties?.valveId as string) === valveId,
      );
    }

    return byBlock;
  }, [bloquePad, geoData, mode, valveId]);

  const valveIds = useMemo(
    () => [...new Set(features.map((feature) => feature.properties?.valveId as string))],
    [features],
  );
  const valveColorMap = useMemo(() => {
    const sorted = [...valveIds].sort();
    return new Map(sorted.map((id, index) => [id, VALVE_COLORS[index % VALVE_COLORS.length]]));
  }, [valveIds]);
  const navigationBounds = useMemo(
    () => getFeatureCollectionBounds({ type: "FeatureCollection", features }),
    [features],
  );
  const valveLabel = valveId?.includes("-")
    ? valveId.split("-").pop() ?? valveId
    : null;
  const title = mode === "valves"
    ? `Válvulas · Bloque ${bloquePad}`
    : valveLabel
      ? `Camas · Válvula ${valveLabel} · Bloque ${bloquePad}`
      : `Camas · Bloque ${bloquePad}`;

  return (
    <>
      <div
        className="fixed inset-0 z-[900] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sub-map-title"
      >
        <div
          className="absolute inset-0 bg-black/48 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={onClose}
          aria-hidden="true"
        />

        <div className="relative z-10 flex h-[92dvh] w-full max-w-sm sm:max-w-2xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl flex-col overflow-visible rounded-[28px] border border-border/70 bg-card shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 px-6 py-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {mode === "valves" ? "Mapa de válvulas" : "Mapa de camas"}
              </p>
              <h2 id="sub-map-title" className="mt-0.5 text-lg font-semibold">
                {title}
              </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {mode === "valves"
                    ? "Click en una valvula -> ficha / detalle o mapa de camas."
                    : "Vista filtrada para navegar camas del bloque activo."}
                </p>
            </div>
            <div className="flex items-start gap-3">
              <CampoRasterControls
                active={activeLayer}
                opacity={rasterOpacity}
                onChange={onLayerChange}
                onOpacityChange={onRasterOpacityChange}
                compact
              />
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={onClose}
                aria-label="Cerrar"
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div className="relative flex-1 overflow-visible">
            {assetsLoading ? (
              <div className="flex h-full items-center justify-center">
                <p className="animate-pulse text-sm text-muted-foreground">Cargando geometría…</p>
              </div>
            ) : assetsError ? (
              <div className="flex h-full items-center justify-center px-6 text-center">
                <p className="text-sm text-muted-foreground">{assetsError}</p>
              </div>
            ) : (
              <>
                <MapContainer
                  zoom={18}
                  center={[-2.859, -78.796]}
                  zoomControl
                  className="h-full w-full rounded-[24px]"
                  style={{ background: MAP_INSET_BG }}
                  maxBounds={navigationBounds ?? undefined}
                  maxBoundsViscosity={1}
                >
                  <CampoBaseTiles activeLayer={activeLayer} />
                  <CampoRasterOverlay
                    activeLayer={activeLayer}
                    rasterBounds={rasterBounds}
                    rasterOpacity={rasterOpacity}
                    paneName={SUBMAP_PANES.raster}
                    paneStyle={{ zIndex: 320, pointerEvents: "none" }}
                  />

                  {mode === "valves" ? (
                    <ValveMap
                      features={features}
                      activeLayer={activeLayer}
                      onValveDetail={onValveDetail}
                      onBedMap={onBedMap}
                    />
                  ) : (
                    <BedMap
                      features={features}
                      activeLayer={activeLayer}
                      onBedCycleSelect={(bedId, block) => setBedPending({ bedId, bloquePad: block })}
                    />
                  )}
                </MapContainer>

                {mode === "valves" && valveIds.length > 0 && (
                  <ValveLegend valveIds={valveIds} colorMap={valveColorMap} />
                )}

                <CampoRasterLegend
                  activeLayer={activeLayer}
                  opacity={rasterOpacity}
                  className="absolute bottom-4 right-4 z-[800]"
                />
                <CampoInteractionHint
                  activeLayer={activeLayer}
                  className="absolute left-4 top-4 z-[800]"
                />
              </>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border/70 px-6 py-3">
            <p className="text-xs text-muted-foreground">
              {features.length} camas · {mode === "valves" ? `${valveIds.length} válvulas` : valveLabel ? "1 válvula" : "vista directa por bloque"}
            </p>
            <Button variant="outline" size="sm" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </div>

      {bedPending && (
        <CampoCycleSelectorModal
          bloquePad={bedPending.bloquePad}
          contextLabel={`Cama ${bedPending.bedId.split("-").pop()} · Bloque ${bedPending.bloquePad}`}
          onSelect={(cycleKey) => {
            onBedDetail(bedPending.bedId, bedPending.bloquePad, cycleKey);
            setBedPending(null);
          }}
          onClose={() => setBedPending(null)}
        />
      )}
    </>
  );
}
