import { readFile } from "node:fs/promises";
import { join } from "node:path";

import mapaBloques from "@/data/campo-blocks-map.json";
import { query } from "@/lib/db";
import type { BlockModalRow } from "@/lib/fenograma";
import { getBlockModalRowsByParentBlocks } from "@/lib/fenograma";
import { cachedAsync } from "@/lib/server-cache";
import { normalizeAreaDisplayName } from "@/shared/lib/area-normalization";
import { roundValue, toNumber } from "@/shared/lib/number-utils";

type CampoMapJsonFeature = {
  block: string;
  area: number | null;
  center: [number, number];
  bbox: [number, number, number, number];
  path: string;
};

type CampoGeoJsonFeature = {
  properties?: {
    bloquePad?: string | null;
  };
};

type CampoGeoJsonCollection = {
  features?: CampoGeoJsonFeature[];
};

export type CampoMapFeature = {
  block: string;
  mapArea: number | null;
  center: [number, number] | null;
  bbox: [number, number, number, number] | null;
  path: string | null;
  hasData: boolean;
  stemsIntensity: number;
  producibleArea: number;
  row: BlockModalRow;
};

export type CampoAreaSummary = {
  area: string;
  blockCount: number;
  producibleArea: number;
};

export type CampoDashboardData = {
  generatedAt: string;
  map: {
    width: number;
    height: number;
    renderableBlockCount: number;
    geometryBlockCount: number;
  };
  summary: {
    blockCount: number;
    matchedBlocks: number;
    unmatchedBlocks: number;
    totalMappedArea: number;
    totalProducibleArea: number;
  };
  features: CampoMapFeature[];
  areaSummaries: CampoAreaSummary[];
};

const CAMPO_DASHBOARD_TTL_MS = 60 * 1000;

function sortBlockIds(a: string, b: string) {
  return a.localeCompare(b, "en-US", {
    numeric: true,
    sensitivity: "base",
  });
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

function buildFallbackRow(block: string): BlockModalRow {
  return {
    block,
    cycleKey: null,
    area: "",
    variety: "",
    spType: "",
    spDate: null,
    harvestStartDate: null,
    harvestEndDate: null,
    totalStems: 0,
  };
}

type ProducibleAreaQueryRow = {
  block: string | null;
  area: string | null;
  producible_area: number | string | null;
};

type ProducibleAreaEntry = {
  area: string;
  producibleArea: number;
};

function buildSummaryFeatureLookup(features: CampoMapJsonFeature[]) {
  const lookup = new Map<string, CampoMapJsonFeature>();

  for (const feature of features) {
    const key = normalizeBlockKey(feature.block);

    if (!key || lookup.has(key)) {
      continue;
    }

    lookup.set(key, feature);
  }

  return lookup;
}

async function loadRenderableBlocksFromGeoJson(fileName: string) {
  const geoPath = join(process.cwd(), "public", "data", fileName);
  const content = await readFile(geoPath, "utf8");
  const geoJson = JSON.parse(content) as CampoGeoJsonCollection;
  const uniqueBlocks = new Set<string>();

  for (const feature of geoJson.features ?? []) {
    const block = feature.properties?.bloquePad?.trim();

    if (block) {
      uniqueBlocks.add(block);
    }
  }

  return Array.from(uniqueBlocks).sort(sortBlockIds);
}

async function getProducibleAreaByBlock(blocks: string[]) {
  if (!blocks.length) {
    return new Map<string, ProducibleAreaEntry>();
  }

  const result = await query<ProducibleAreaQueryRow>(
    `
      with latest_block_profile as (
        select distinct on (coalesce(nullif(cp.parent_block, ''), nullif(cp.block_id, '')))
          coalesce(nullif(cp.parent_block, ''), nullif(cp.block_id, '')) as block,
          nullif(trim(cp.area_id), '') as area,
          coalesce(cp.bed_area, 0) as producible_area
        from slv.camp_dim_cycle_profile_scd2 cp
        where coalesce(nullif(cp.parent_block, ''), nullif(cp.block_id, '')) = any($1::text[])
        order by
          coalesce(nullif(cp.parent_block, ''), nullif(cp.block_id, '')),
          cp.is_current desc,
          cp.valid_from desc nulls last,
          cp.cycle_key desc nulls last
      )
      select
        block,
        area,
        producible_area
      from latest_block_profile
    `,
    [blocks],
  );

  return new Map(
    result.rows
      .map((row) => {
        const normalizedBlock = normalizeBlockKey(row.block);

        if (!normalizedBlock) {
          return null;
        }

        return [
          normalizedBlock,
          {
            area: normalizeAreaDisplayName(row.area),
            producibleArea: toNumber(row.producible_area, 0) ?? 0,
          } satisfies ProducibleAreaEntry,
        ] as const;
      })
      .filter((entry): entry is readonly [string, ProducibleAreaEntry] => Boolean(entry)),
  );
}

export async function getCampoDashboardData(): Promise<CampoDashboardData> {
  return cachedAsync("campo:dashboard:v2", CAMPO_DASHBOARD_TTL_MS, async () => {
    const summaryFeatures = mapaBloques.features as CampoMapJsonFeature[];
    const [campoRenderableBlocks, sjpRenderableBlocks] = await Promise.all([
      loadRenderableBlocksFromGeoJson("campo-geo.json"),
      loadRenderableBlocksFromGeoJson("sjp-geo.json").catch(() => [] as string[]),
    ]);
    const renderableBlocks = Array.from(
      new Set([...campoRenderableBlocks, ...sjpRenderableBlocks]),
    ).sort(sortBlockIds);
    const blocksForQuery = Array.from(
      new Set([
        ...summaryFeatures.map((feature) => feature.block),
        ...renderableBlocks,
      ]),
    ).sort(sortBlockIds);
    const [rowsByBlock, producibleAreaByBlock] = await Promise.all([
      getBlockModalRowsByParentBlocks(blocksForQuery),
      getProducibleAreaByBlock(blocksForQuery),
    ]);
    const rowsByNormalizedBlock = new Map<string, BlockModalRow>();

    for (const row of Object.values(rowsByBlock)) {
      const key = normalizeBlockKey(row.block);

      if (!key || rowsByNormalizedBlock.has(key)) {
        continue;
      }

      rowsByNormalizedBlock.set(key, row);
    }

    const summaryFeatureLookup = buildSummaryFeatureLookup(summaryFeatures);
    const renderableFeatures = renderableBlocks.map((block) => {
      const normalizedKey = normalizeBlockKey(block);
      const row = rowsByNormalizedBlock.get(normalizedKey) ?? buildFallbackRow(block);
      const summaryFeature = summaryFeatureLookup.get(normalizedKey);

      return {
        block,
        mapArea: summaryFeature?.area ?? null,
        center: summaryFeature?.center ?? null,
        bbox: summaryFeature?.bbox ?? null,
        path: summaryFeature?.path ?? null,
        hasData: rowsByNormalizedBlock.has(normalizedKey),
        stemsIntensity: 0,
        producibleArea: producibleAreaByBlock.get(normalizedKey)?.producibleArea ?? 0,
        row,
      } satisfies CampoMapFeature;
    });
    const maxVisibleStems = Math.max(
      ...renderableFeatures.map((feature) => feature.row.totalStems ?? 0),
      0,
    );
    const normalizedRenderableFeatures = renderableFeatures.map((feature) => ({
      ...feature,
      stemsIntensity:
        maxVisibleStems > 0 ? (feature.row.totalStems ?? 0) / maxVisibleStems : 0,
    }));
    const normalizedSummaryFeatures = summaryFeatures.map((feature) => {
      const normalizedKey = normalizeBlockKey(feature.block);
      const row = rowsByNormalizedBlock.get(normalizedKey)
        ?? buildFallbackRow(feature.block);
      const producibleArea = producibleAreaByBlock.get(normalizedKey)?.producibleArea ?? 0;

      return {
        block: feature.block,
        mapArea: feature.area ?? null,
        hasData: rowsByNormalizedBlock.has(normalizedKey),
        producibleArea,
        row,
      };
    });
    const areaSummaryMap = new Map<string, CampoAreaSummary>();

    for (const feature of normalizedRenderableFeatures) {
      const normalizedKey = normalizeBlockKey(feature.block);
      const producibleAreaEntry = producibleAreaByBlock.get(normalizedKey);
      const area = normalizeAreaDisplayName(feature.row.area)
        || normalizeAreaDisplayName(producibleAreaEntry?.area)
        || "";

      if (!area) {
        continue;
      }

      const current = areaSummaryMap.get(area) ?? {
        area,
        blockCount: 0,
        producibleArea: 0,
      };

      current.blockCount += 1;
      current.producibleArea += feature.producibleArea;
      areaSummaryMap.set(area, current);
    }

    const areaSummaries = Array.from(areaSummaryMap.values())
      .map((entry) => ({
        ...entry,
        producibleArea: roundValue(entry.producibleArea),
      }))
      .sort((left, right) => right.producibleArea - left.producibleArea);

    return {
      generatedAt: new Date().toISOString(),
      map: {
        width: mapaBloques.width,
        height: mapaBloques.height,
        renderableBlockCount: normalizedRenderableFeatures.length,
        geometryBlockCount: normalizedRenderableFeatures.length,
      },
      summary: {
        blockCount: normalizedRenderableFeatures.length,
        matchedBlocks: normalizedRenderableFeatures.filter((feature) => feature.hasData).length,
        unmatchedBlocks: normalizedRenderableFeatures.filter((feature) => !feature.hasData).length,
        totalMappedArea: roundValue(
          normalizedSummaryFeatures.reduce(
            (sum, feature) => sum + (feature.mapArea ?? 0),
            0,
          ),
        ),
        totalProducibleArea: roundValue(
          normalizedRenderableFeatures.reduce(
            (sum, feature) => sum + feature.producibleArea,
            0,
          ),
        ),
      },
      features: normalizedRenderableFeatures,
      areaSummaries,
    };
  });
}
