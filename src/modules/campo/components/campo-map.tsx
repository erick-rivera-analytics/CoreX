"use client";

import "leaflet/dist/leaflet.css";

import type { Feature, FeatureCollection, GeoJsonObject } from "geojson";
import L from "leaflet";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import {
  GeoJSON,
  ImageOverlay,
  MapContainer,
  Marker,
  Pane,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

import { cn } from "@/lib/utils";

export type BlockDataEntry = { stemsIntensity: number; hasData: boolean };
export type ActiveLayer = "none" | "ndvi" | "ndre" | "lci";
export type RasterLayerKey = Exclude<ActiveLayer, "none">;
export type RasterBounds = Partial<
  Record<RasterLayerKey, [[number, number], [number, number]]>
>;

type ClickState = { latlng: L.LatLng; bloquePad: string };
type BlockCentroid = { bloquePad: string; area: string; lat: number; lng: number };

type Props = {
  viewKey: "campo" | "sjp";
  geoData: FeatureCollection | null;
  rasterBounds: RasterBounds;
  assetsLoading: boolean;
  assetsError: string | null;
  blockDataMap: Record<string, BlockDataEntry>;
  areaByBlock: Record<string, string>;
  onFicha: (bloquePad: string) => void;
  onSecondaryAction: (bloquePad: string) => void;
  secondaryActionLabel: string;
  activeLayer: ActiveLayer;
  rasterOpacity: number;
  showFloatingLegend?: boolean;
  className?: string;
};

type CampoRasterControlsProps = {
  active: ActiveLayer;
  opacity: number;
  onChange: (layer: ActiveLayer) => void;
  onOpacityChange: (opacity: number) => void;
  compact?: boolean;
  className?: string;
};

type CampoRasterLegendProps = {
  activeLayer: ActiveLayer;
  opacity: number;
  className?: string;
};

type BlockStyleOptions = {
  entry: BlockDataEntry | undefined;
  zoom: number;
  activeLayer: ActiveLayer;
  isHovered: boolean;
  isSelected: boolean;
};

const RASTER_LAYER_OPTIONS = ["none", "ndvi", "ndre", "lci"] as const;
const CAMPO_PANES = {
  raster: "campo-raster-pane",
  vectors: "campo-vectors-pane",
  labels: "campo-labels-pane",
} as const;
const CAMPO_TILE_URLS = {
  operative: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  agronomic: "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
} as const;
const RASTER_SWATCHES = [
  { label: "Menor", color: "#dc2626" },
  { label: "Bajo", color: "#eab308" },
  { label: "Alto", color: "#86efac" },
  { label: "Mayor", color: "#16a34a" },
] as const;
const RASTER_META: Record<RasterLayerKey, { label: string; subtitle: string }> = {
  ndvi: { label: "NDVI", subtitle: "Índice de vegetación" },
  ndre: { label: "NDRE", subtitle: "Respuesta red edge" },
  lci: { label: "LCI", subtitle: "Indicador de clorofila" },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function mixColors(fromHex: string, toHex: string, intensity: number) {
  const safeIntensity = clamp(intensity, 0, 1);
  const from = hexToRgb(fromHex);
  const to = hexToRgb(toHex);
  const r = Math.round(from.r + (to.r - from.r) * safeIntensity);
  const g = Math.round(from.g + (to.g - from.g) * safeIntensity);
  const b = Math.round(from.b + (to.b - from.b) * safeIntensity);

  return `rgb(${r}, ${g}, ${b})`;
}

function stemsToColor(intensity: number, hasData: boolean) {
  if (!hasData) {
    return "#dce4e8";
  }

  return mixColors("#e8f2ec", "#2f6c58", intensity);
}

function getBlockBaseWeight(zoom: number, activeLayer: ActiveLayer) {
  if (activeLayer === "none") {
    if (zoom >= 18) return 1.15;
    if (zoom >= 17) return 0.95;
    if (zoom >= 16) return 0.68;
    return 0.4;
  }

  if (zoom >= 18) return 1;
  if (zoom >= 17) return 0.82;
  return 0.6;
}

function getBlockStyle({
  entry,
  zoom,
  activeLayer,
  isHovered,
  isSelected,
}: BlockStyleOptions): L.PathOptions {
  const baseWeight = getBlockBaseWeight(zoom, activeLayer);

  if (activeLayer === "none") {
    return {
      fillColor: stemsToColor(entry?.stemsIntensity ?? 0, entry?.hasData ?? false),
      fillOpacity: isHovered || isSelected ? 0.96 : zoom >= 17 ? 0.92 : 0.88,
      color:
        isSelected
          ? "rgba(15,23,42,0.8)"
          : isHovered
            ? "rgba(15,23,42,0.65)"
            : zoom >= 16
              ? "rgba(15,23,42,0.24)"
              : "rgba(15,23,42,0.12)",
      weight: isSelected ? baseWeight + 1.2 : isHovered ? baseWeight + 0.8 : baseWeight,
    };
  }

  return {
    fillColor: "#f8fafc",
    fillOpacity: isSelected ? 0.2 : isHovered ? 0.14 : 0.08,
    color:
      isSelected
        ? "rgba(15,23,42,0.82)"
        : isHovered
          ? "rgba(15,23,42,0.58)"
          : "rgba(15,23,42,0.34)",
    weight: isSelected ? baseWeight + 0.95 : isHovered ? baseWeight + 0.65 : baseWeight,
  };
}

function getFeatureBlock(feature: Feature | undefined) {
  return feature?.properties?.bloquePad as string | undefined;
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

function getRasterVisualState(zoom: number) {
  if (zoom <= 15) {
    return {
      opacityMultiplier: 0.82,
      filter: "blur(0.7px) saturate(1.03) contrast(1.07)",
    };
  }

  if (zoom <= 16) {
    return {
      opacityMultiplier: 0.9,
      filter: "blur(0.45px) saturate(1.04) contrast(1.06)",
    };
  }

  if (zoom <= 17) {
    return {
      opacityMultiplier: 0.96,
      filter: "blur(0.18px) saturate(1.05) contrast(1.05)",
    };
  }

  return {
    opacityMultiplier: 1,
    filter: "saturate(1.06) contrast(1.04)",
  };
}

function polygonCentroid(coords: number[][]): [number, number] {
  const lng = coords.reduce((sum, coordinate) => sum + coordinate[0], 0) / coords.length;
  const lat = coords.reduce((sum, coordinate) => sum + coordinate[1], 0) / coords.length;
  return [lat, lng];
}

function computeBlockCentroids(
  features: Feature[],
  areaByBlock: Record<string, string>,
): BlockCentroid[] {
  const accumulators = new Map<string, { sumLat: number; sumLng: number; count: number }>();

  for (const feature of features) {
    const bloquePad = getFeatureBlock(feature);

    if (!bloquePad || !feature.geometry) {
      continue;
    }

    let ring: number[][] = [];

    if (feature.geometry.type === "Polygon") {
      ring = feature.geometry.coordinates[0] as number[][];
    } else if (feature.geometry.type === "MultiPolygon") {
      ring = feature.geometry.coordinates[0][0] as number[][];
    }

    if (!ring.length) {
      continue;
    }

    const [lat, lng] = polygonCentroid(ring);
    const current = accumulators.get(bloquePad) ?? { sumLat: 0, sumLng: 0, count: 0 };
    current.sumLat += lat;
    current.sumLng += lng;
    current.count += 1;
    accumulators.set(bloquePad, current);
  }

  return Array.from(accumulators.entries())
    .map(([bloquePad, value]) => ({
      bloquePad,
      area: areaByBlock[bloquePad] ?? "",
      lat: value.sumLat / value.count,
      lng: value.sumLng / value.count,
    }))
    .sort((first, second) => first.bloquePad.localeCompare(second.bloquePad, "en-US", {
      numeric: true,
      sensitivity: "base",
    }));
}

function makeBlockIcon(label: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      background: rgba(248,250,252,0.94);
      color: rgba(15,23,42,0.82);
      padding: 1px 6px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      white-space: nowrap;
      pointer-events: none;
      box-shadow: 0 1px 4px rgba(15,23,42,0.16);
      border: 1px solid rgba(148,163,184,0.28);
      font-family: ui-monospace, monospace;
      letter-spacing: 0.02em;
    ">${label}</div>`,
    iconSize: undefined as unknown as L.PointExpression,
    iconAnchor: [0, 0],
  });
}

function makeAreaIcon(label: string, activeLayer: ActiveLayer) {
  return L.divIcon({
    className: "",
    html: `<div style="
      background: ${activeLayer === "none" ? "rgba(15,23,42,0.7)" : "rgba(15,23,42,0.52)"};
      color: white;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: ${activeLayer === "none" ? "11px" : "10px"};
      font-weight: 700;
      white-space: nowrap;
      pointer-events: none;
      box-shadow: 0 2px 8px rgba(15,23,42,0.16);
      border: 1px solid rgba(255,255,255,0.14);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    ">${label}</div>`,
    iconSize: undefined as unknown as L.PointExpression,
    iconAnchor: [0, 0],
  });
}

function BlockLabels({
  centroids,
  activeLayer,
  hoveredBlock,
  selectedBlock,
}: {
  centroids: BlockCentroid[];
  activeLayer: ActiveLayer;
  hoveredBlock: string | null;
  selectedBlock: string | null;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useMapEvents({
    zoomend() {
      setZoom(map.getZoom());
    },
  });

  const areaCentroids = useMemo(() => {
    const areaAccumulators = new Map<string, { sumLat: number; sumLng: number; count: number }>();

    for (const { area, lat, lng } of centroids) {
      if (!area) {
        continue;
      }

      const current = areaAccumulators.get(area) ?? { sumLat: 0, sumLng: 0, count: 0 };
      current.sumLat += lat;
      current.sumLng += lng;
      current.count += 1;
      areaAccumulators.set(area, current);
    }

    return Array.from(areaAccumulators.entries()).map(([area, value]) => ({
      area,
      lat: value.sumLat / value.count,
      lng: value.sumLng / value.count,
    }));
  }, [centroids]);
  const focusedBlocks = useMemo(
    () => new Set([hoveredBlock, selectedBlock].filter(Boolean) as string[]),
    [hoveredBlock, selectedBlock],
  );

  const showAreaLabels = activeLayer === "none" ? zoom <= 15 : zoom <= 13;
  const showAllBlockLabels = activeLayer === "none" ? zoom >= 17 : zoom >= 19;
  const showFocusedBlockLabels = focusedBlocks.size > 0 && zoom >= 15;
  const visibleBlockCentroids = showAllBlockLabels
    ? centroids
    : showFocusedBlockLabels
      ? centroids.filter(({ bloquePad }) => focusedBlocks.has(bloquePad))
      : [];

  return (
    <>
      {showAreaLabels && areaCentroids.map(({ area, lat, lng }) => (
        <Marker
          key={`area-${area}`}
          position={[lat, lng]}
          icon={makeAreaIcon(area, activeLayer)}
          interactive={false}
          pane={CAMPO_PANES.labels}
          zIndexOffset={1200}
        />
      ))}

      {visibleBlockCentroids.map(({ bloquePad, lat, lng }) => (
        <Marker
          key={`block-${bloquePad}`}
          position={[lat, lng]}
          icon={makeBlockIcon(bloquePad)}
          interactive={false}
          pane={CAMPO_PANES.labels}
          zIndexOffset={1000}
        />
      ))}
    </>
  );
}

function FeatureStyleUpdater({
  geoJsonRef,
  blockDataMap,
  activeLayer,
  hoveredBlock,
  selectedBlock,
}: {
  geoJsonRef: RefObject<L.GeoJSON | null>;
  blockDataMap: Record<string, BlockDataEntry>;
  activeLayer: ActiveLayer;
  hoveredBlock: string | null;
  selectedBlock: string | null;
}) {
  const map = useMap();

  const applyStyles = useCallback(() => {
    if (!geoJsonRef.current) {
      return;
    }

    const zoom = map.getZoom();

    geoJsonRef.current.eachLayer((layer) => {
      const pathLayer = layer as L.Path & { feature?: Feature };
      const bloquePad = getFeatureBlock(pathLayer.feature);

      if (!bloquePad) {
        return;
      }

      pathLayer.setStyle(
        getBlockStyle({
          entry: getBlockEntry(blockDataMap, bloquePad),
          zoom,
          activeLayer,
          isHovered: bloquePad === hoveredBlock,
          isSelected: bloquePad === selectedBlock,
        }),
      );
    });
  }, [activeLayer, blockDataMap, geoJsonRef, hoveredBlock, map, selectedBlock]);

  useMapEvents({
    zoomend() {
      applyStyles();
    },
  });

  useEffect(() => {
    applyStyles();
  }, [applyStyles]);

  return null;
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
        const minZoom = map.getBoundsZoom(bounds, false, L.point(18, 18));
        map.setMinZoom(minZoom);
        map.fitBounds(bounds, { padding: [18, 18], maxZoom: 18 });
        fitted.current = true;
      }
    } catch {
      // Keep the initial map frame when bounds cannot be derived.
    }
  }, [data, map]);

  return null;
}

export function CampoBaseTiles({ activeLayer }: { activeLayer: ActiveLayer }) {
  return (
    <TileLayer
      url={activeLayer === "none" ? CAMPO_TILE_URLS.operative : CAMPO_TILE_URLS.agronomic}
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
      subdomains="abcd"
      maxZoom={22}
      opacity={activeLayer === "none" ? 1 : 0.5}
    />
  );
}

export function CampoRasterOverlay({
  activeLayer,
  rasterBounds,
  rasterOpacity,
  paneName,
  paneStyle,
}: {
  activeLayer: ActiveLayer;
  rasterBounds: RasterBounds;
  rasterOpacity: number;
  paneName: string;
  paneStyle: CSSProperties;
}) {
  const map = useMap();
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  const [zoom, setZoom] = useState(() => map.getZoom());
  const visualState = useMemo(() => getRasterVisualState(zoom), [zoom]);
  const rasterImageBounds = activeLayer === "none" ? undefined : rasterBounds[activeLayer];

  useMapEvents({
    zoomend() {
      setZoom(map.getZoom());
    },
  });

  useEffect(() => {
    const image = overlayRef.current?.getElement();

    if (!image) {
      return;
    }

    Object.assign(image.style, {
      filter: visualState.filter,
      willChange: "filter, opacity",
      transformOrigin: "center center",
    });
  }, [visualState]);

  if (activeLayer === "none" || !rasterImageBounds) {
    return null;
  }

  return (
    <Pane name={paneName} style={paneStyle}>
      <ImageOverlay
        ref={overlayRef}
        url={`/rasters/${activeLayer}.webp`}
        bounds={rasterImageBounds}
        opacity={clamp(rasterOpacity * visualState.opacityMultiplier, 0.35, 1)}
        interactive={false}
      />
    </Pane>
  );
}

export function CampoRasterControls({
  active,
  opacity,
  onChange,
  onOpacityChange,
  compact = false,
  className,
}: CampoRasterControlsProps) {
  const opacityPercent = Math.round(opacity * 100);

  return (
    <div
      className={cn(
        "rounded-[20px] border border-border/70 bg-background/92 px-3 py-2 shadow-sm backdrop-blur-sm",
        compact ? "min-w-[280px]" : "min-w-[320px]",
        className,
      )}
    >
      <div className={cn("flex flex-wrap items-center gap-2", compact ? "mb-2" : "mb-2.5")}>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {active === "none" ? "Modo operativo" : "Modo agronómico"}
        </span>
        {RASTER_LAYER_OPTIONS.map((layer) => (
          <button
            key={layer}
            type="button"
            onClick={() => onChange(layer)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              active === layer
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/70 bg-background/72 text-muted-foreground hover:text-foreground",
            )}
          >
            {layer === "none" ? "Sin capa" : layer.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <label
          htmlFor={compact ? "campo-raster-opacity-compact" : "campo-raster-opacity"}
          className={cn(
            "shrink-0 text-xs font-medium text-muted-foreground",
            active === "none" && "opacity-60",
          )}
        >
          Opacidad
        </label>
        <input
          id={compact ? "campo-raster-opacity-compact" : "campo-raster-opacity"}
          type="range"
          min={35}
          max={100}
          step={5}
          value={opacityPercent}
          disabled={active === "none"}
          onChange={(event) => onOpacityChange(Number(event.currentTarget.value) / 100)}
          className="h-2 w-full cursor-pointer accent-slate-900 dark:accent-slate-400 disabled:cursor-not-allowed disabled:opacity-45"
        />
        <span
          className={cn(
            "w-11 shrink-0 text-right text-xs font-semibold tabular-nums text-foreground",
            active === "none" && "text-muted-foreground",
          )}
        >
          {opacityPercent}%
        </span>
      </div>
    </div>
  );
}

export function CampoRasterLegend({
  activeLayer,
  opacity,
  className,
}: CampoRasterLegendProps) {
  if (activeLayer === "none") {
    return null;
  }

  const metadata = RASTER_META[activeLayer];

  return (
    <div
      className={cn(
        "pointer-events-none w-[280px] rounded-[24px] border border-border/70 bg-background/96 px-4 py-4 shadow-[var(--shadow-panel)] backdrop-blur-md",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Capa agronomica activa
          </p>
          <p className="mt-1 text-base font-semibold text-foreground">{metadata.label}</p>
          <p className="text-xs text-muted-foreground">{metadata.subtitle}</p>
        </div>
        <div className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-semibold tabular-nums text-foreground">
          {Math.round(opacity * 100)}%
        </div>
      </div>
      <div className="mt-4 rounded-[20px] border border-border/70 bg-muted/20 p-3">
        <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
          <span>Lectura relativa</span>
          <span>Raster activo</span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {RASTER_SWATCHES.map((swatch) => (
            <div key={swatch.label} className="space-y-1 text-center">
              <span
                className="block h-2.5 w-full rounded-full border border-slate-200/60"
                style={{ backgroundColor: swatch.color }}
              />
              <span className="block text-[10px] font-medium text-muted-foreground">
                {swatch.label}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Menor vigor {"->"} mayor vigor.
        </p>
      </div>
      <div className="mt-3 space-y-2 text-[11px] text-muted-foreground">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/70 px-3 py-2">
          <span>Fuente</span>
          <span className="font-medium text-foreground">WebP clasificado</span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/70 px-3 py-2">
          <span>Escala numerica</span>
          <span className="font-medium text-foreground">No disponible</span>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span>Raster clasificado, sin rangos numéricos en frontend.</span>
        <span className="font-semibold tabular-nums text-foreground">
          {Math.round(opacity * 100)}%
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="size-3 rounded-full border border-dashed border-slate-300 bg-transparent" />
        <span>Transparente = sin dato</span>
      </div>
    </div>
  );
}

function getBlockEntry(blockDataMap: Record<string, BlockDataEntry>, bloquePad: string | undefined) {
  if (!bloquePad) {
    return undefined;
  }

  return blockDataMap[bloquePad] ?? blockDataMap[String(Number(bloquePad))];
}

export function CampoInteractionHint({
  activeLayer,
  mode = "campo",
  className,
}: {
  activeLayer: ActiveLayer;
  mode?: "campo" | "sjp";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none rounded-[20px] border border-border/70 bg-background/94 px-4 py-2 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {activeLayer === "none" ? "Modo operativo" : "Modo agronomico"}
      </p>
      <p className="mt-1 text-xs text-foreground">
        {mode === "sjp"
          ? <>Bloque {"->"} ficha o mapa de camas.</>
          : <>Bloque {"->"} ficha o mapa de valvulas.</>}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {mode === "sjp"
          ? <>En submapa: cama {"->"} selector de ciclo y detalle.</>
          : <>En submapa: valvula {"->"} ficha o mapa de camas.</>}
      </p>
    </div>
  );
}

export function CampoLeafletMap({
  viewKey,
  geoData,
  rasterBounds,
  assetsLoading,
  assetsError,
  blockDataMap,
  areaByBlock,
  onFicha,
  onSecondaryAction,
  secondaryActionLabel,
  activeLayer,
  rasterOpacity,
  showFloatingLegend = true,
  className,
}: Props) {
  const [clickState, setClickState] = useState<ClickState | null>(null);
  const [hoveredBlock, setHoveredBlock] = useState<string | null>(null);
  const geoJsonRef = useRef<L.GeoJSON | null>(null);

  const blockCentroids = useMemo(
    () => (geoData ? computeBlockCentroids(geoData.features, areaByBlock) : []),
    [areaByBlock, geoData],
  );
  const navigationBounds = useMemo(() => getFeatureCollectionBounds(geoData), [geoData]);

  // Memoize popup event handlers to prevent infinite loops in react-leaflet
  const popupEventHandlers = useMemo(
    () => ({ remove: () => setClickState(null) }),
    [],
  );

  const styleFeature = useCallback(
    (feature: Feature | undefined) => {
      const bloquePad = getFeatureBlock(feature);

      return getBlockStyle({
        entry: getBlockEntry(blockDataMap, bloquePad),
        zoom: 15,
        activeLayer,
        isHovered: false,
        isSelected: false,
      });
    },
    [activeLayer, blockDataMap],
  );

  const onEachFeature = useCallback(
    (feature: Feature, layer: L.Layer) => {
      layer.on({
        click(event: L.LeafletMouseEvent) {
          const bloquePad = getFeatureBlock(feature);

          if (!bloquePad) {
            return;
          }

          L.DomEvent.stopPropagation(event);
          setClickState({ latlng: event.latlng, bloquePad });
        },
        mouseover() {
          const bloquePad = getFeatureBlock(feature);

          if (bloquePad) {
            setHoveredBlock(bloquePad);
          }
        },
        mouseout() {
          const bloquePad = getFeatureBlock(feature);

          setHoveredBlock((current) => (current === bloquePad ? null : current));
        },
      });
    },
    [],
  );

  if (assetsLoading) {
    return (
      <div className={cn("flex items-center justify-center rounded-[26px] bg-muted/40", className)}>
        <p className="animate-pulse text-sm text-muted-foreground">Cargando mapa…</p>
      </div>
    );
  }

  if (!geoData || assetsError) {
    return (
      <div className={cn("flex items-center justify-center rounded-[26px] bg-muted/40", className)}>
        <p className="text-sm text-muted-foreground">
          {assetsError ?? "No se pudo cargar la geometría del mapa."}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("relative rounded-[26px]", className)}>
      <MapContainer
        zoom={15}
        center={[-2.8589, -78.796]}
        zoomControl
        className="h-full w-full rounded-[26px]"
        style={{ background: "#edf4ef" }}
        maxBounds={navigationBounds ?? undefined}
        maxBoundsViscosity={1}
      >
        <CampoBaseTiles activeLayer={activeLayer} />
        <CampoRasterOverlay
          activeLayer={activeLayer}
          rasterBounds={rasterBounds}
          rasterOpacity={rasterOpacity}
          paneName={CAMPO_PANES.raster}
          paneStyle={{ zIndex: 320, pointerEvents: "none" }}
        />

        <Pane name={CAMPO_PANES.vectors} style={{ zIndex: 420 }}>
          <GeoJSON
            data={geoData as GeoJsonObject}
            style={styleFeature}
            onEachFeature={onEachFeature}
            ref={geoJsonRef}
          />
        </Pane>

        <Pane name={CAMPO_PANES.labels} style={{ zIndex: 520, pointerEvents: "none" }}>
          <BlockLabels
            centroids={blockCentroids}
            activeLayer={activeLayer}
            hoveredBlock={hoveredBlock}
            selectedBlock={clickState?.bloquePad ?? null}
          />
        </Pane>

        <FeatureStyleUpdater
          geoJsonRef={geoJsonRef}
          blockDataMap={blockDataMap}
          activeLayer={activeLayer}
          hoveredBlock={hoveredBlock}
          selectedBlock={clickState?.bloquePad ?? null}
        />

        {clickState && (
          <Popup
            position={clickState.latlng}
            keepInView
            autoPan
            offset={[0, -18]}
            autoPanPaddingTopLeft={[24, 24]}
            autoPanPaddingBottomRight={[32, 220]}
            minWidth={232}
            maxWidth={248}
            eventHandlers={popupEventHandlers}
          >
            <div className="min-w-[210px] space-y-2.5 p-1">
              <p className="text-[13px] font-bold text-slate-900 dark:text-white">
                Bloque {clickState.bloquePad}
              </p>
              <p className="text-[11px] leading-relaxed text-slate-500 dark:text-white">
                {activeLayer === "none"
                  ? `Vista ${viewKey === "sjp" ? "SJP" : "operativa"} del bloque.`
                  : `Vista agronómica con ${RASTER_META[activeLayer].label}.`}
              </p>
              <button
                type="button"
                className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
                onClick={() => {
                  onFicha(clickState.bloquePad);
                  setClickState(null);
                }}
              >
                Ver ficha completa
              </button>
              <button
                type="button"
                className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
                onClick={() => {
                  onSecondaryAction(clickState.bloquePad);
                  setClickState(null);
                }}
              >
                {secondaryActionLabel}
              </button>
            </div>
          </Popup>
        )}

        <FitBounds data={geoData} />
      </MapContainer>

      {showFloatingLegend ? (
        <CampoRasterLegend
          activeLayer={activeLayer}
          opacity={rasterOpacity}
          className="absolute bottom-4 right-4 z-[800]"
        />
      ) : null}
      <CampoInteractionHint
        activeLayer={activeLayer}
        mode={viewKey}
        className="absolute left-4 top-4 z-[800]"
      />
    </div>
  );
}
