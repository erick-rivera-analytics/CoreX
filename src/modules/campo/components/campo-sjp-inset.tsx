"use client";

import "leaflet/dist/leaflet.css";

import type { FeatureCollection, GeoJsonObject } from "geojson";
import L from "leaflet";
import { MapPinned } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { GeoJSON, MapContainer, Marker, useMap } from "react-leaflet";

import {
  CampoBaseTiles,
  CampoRasterOverlay,
  type ActiveLayer,
  type RasterBounds,
} from "@/modules/campo/components/campo-map";
import {
  MAP_INSET_ACCENT,
  MAP_INSET_BG,
  MAP_INSET_BORDER,
} from "@/modules/campo/lib/sub-map-palette";
import { cn } from "@/lib/utils";

type Props = {
  viewKey: "campo" | "sjp";
  title: string;
  description: string;
  actionLabel: string;
  geoData: FeatureCollection | null;
  loading: boolean;
  error: string | null;
  activeLayer: ActiveLayer;
  rasterBounds: RasterBounds;
  rasterOpacity: number;
  layerBadge: string;
  onActivate: () => void;
  className?: string;
};

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

    const bounds = getFeatureCollectionBounds(data);

    if (bounds?.isValid()) {
      const minZoom = map.getBoundsZoom(bounds, false, L.point(12, 12));
      map.setMinZoom(minZoom);
      map.fitBounds(bounds, { padding: [12, 12], maxZoom: 17 });
      fitted.current = true;
    }
  }, [data, map]);

  return null;
}

function buildCenter(featureCollection: FeatureCollection) {
  const bounds = getFeatureCollectionBounds(featureCollection);
  return bounds?.isValid() ? bounds.getCenter() : null;
}

function makeLabelIcon(label: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      background: rgba(15,23,42,0.78);
      color: white;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      box-shadow: 0 2px 10px rgba(15,23,42,0.18);
    ">${label}</div>`,
    iconSize: [52, 26],
    iconAnchor: [26, 13],
  });
}

export function CampoMapInset({
  viewKey,
  title,
  description,
  actionLabel,
  geoData,
  loading,
  error,
  activeLayer,
  rasterBounds,
  rasterOpacity,
  layerBadge,
  onActivate,
  className,
}: Props) {
  const center = useMemo(() => (geoData ? buildCenter(geoData) : null), [geoData]);
  const navigationBounds = useMemo(() => getFeatureCollectionBounds(geoData), [geoData]);
  const label = viewKey === "sjp" ? "SJP" : "MH";

  return (
    <div
      className={cn(
        "flex min-h-[220px] sm:min-h-[280px] flex-col rounded-[26px] border border-border/70 bg-background/76 p-4",
        className,
      )}
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="rounded-full bg-slate-900/10 p-3 text-slate-700 dark:bg-slate-900/20 dark:text-white">
          <MapPinned className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Recuadro lateral
          </p>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex h-[220px] sm:h-[280px] items-center justify-center rounded-[22px] bg-muted/40 text-sm text-muted-foreground">
          Cargando geometria...
        </div>
      ) : error ? (
        <div className="flex h-[220px] sm:h-[280px] items-center justify-center rounded-[22px] border border-dashed border-border/70 bg-muted/20 px-4 text-center text-sm text-muted-foreground">
          {error}
        </div>
      ) : !geoData || !geoData.features.length || !center ? (
        <div className="flex h-[220px] sm:h-[280px] items-center justify-center rounded-[22px] border border-dashed border-border/70 bg-muted/20 px-4 text-center text-sm text-muted-foreground">
          No hay datos disponibles para esta vista.
        </div>
      ) : (
        <>
          <div className="relative overflow-hidden rounded-[22px] border border-border/70">
            <MapContainer
              center={center}
              zoom={15}
              zoomControl={false}
              attributionControl={false}
              className="h-[220px] sm:h-[280px] w-full"
              style={{ background: MAP_INSET_BG }}
              dragging={false}
              doubleClickZoom={false}
              boxZoom={false}
              keyboard={false}
              scrollWheelZoom={false}
              touchZoom={false}
              maxBounds={navigationBounds ?? undefined}
              maxBoundsViscosity={1}
            >
              <CampoBaseTiles activeLayer={activeLayer} />
              <CampoRasterOverlay
                activeLayer={activeLayer}
                rasterBounds={rasterBounds}
                rasterOpacity={rasterOpacity}
                paneName={`campo-inset-raster-${viewKey}`}
                paneStyle={{ zIndex: 320, pointerEvents: "none" }}
              />
              <GeoJSON
                data={geoData as GeoJsonObject}
                style={() => ({
                  color: MAP_INSET_BORDER,
                  weight: 1.1,
                  fillColor: MAP_INSET_ACCENT,
                  fillOpacity: activeLayer === "none" ? 0.34 : 0.1,
                })}
              />
              <Marker position={center} icon={makeLabelIcon(label)} interactive={false} />
              <FitBounds data={geoData} />
            </MapContainer>

            <button
              type="button"
              onClick={onActivate}
              className="absolute inset-0 z-[700] rounded-[22px] border-0 bg-transparent"
              aria-label={actionLabel}
              title={actionLabel}
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/74 px-3 py-2 text-xs">
            <span className="font-medium text-foreground">{actionLabel}</span>
            <span className="text-muted-foreground">{layerBadge}</span>
          </div>
        </>
      )}
    </div>
  );
}
