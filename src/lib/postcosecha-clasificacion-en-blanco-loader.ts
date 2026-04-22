import "server-only";

import { listCurrentPostharvestSkus } from "@/lib/postcosecha-skus";
import type {
  PoscosechaClasificacionAvailabilitySeed,
  PoscosechaClasificacionBootData,
  PoscosechaClasificacionSettings,
} from "@/lib/postcosecha-clasificacion-en-blanco-types";
import {
  toNumber,
  toInteger,
  sanitizeSettings,
  buildClasificacionOrdersTemplate,
  buildClasificacionAvailabilityTemplate,
  buildClasificacionOrderSlotsTemplate,
  buildClasificacionLotSlotsTemplate,
} from "@/lib/postcosecha-clasificacion-en-blanco-templates";
import { runBridge } from "@/lib/postcosecha-clasificacion-en-blanco-runner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SolverBridgeDefaults = {
  settings?: Partial<PoscosechaClasificacionSettings>;
  availability_template?: Array<{
    grado?: number;
    peso_tallo_seed?: number;
  }>;
  workbook_path?: string | null;
  master_path?: string | null;
};

// ---------------------------------------------------------------------------
// Module-level cache
// ---------------------------------------------------------------------------

declare global {
  var __dashboardClasificacionEnBlancoDefaultsPromise:
    | Promise<{
        settings: PoscosechaClasificacionSettings;
        availabilitySeeds: PoscosechaClasificacionAvailabilitySeed[];
        workbookPath: string | null;
        masterPath: string | null;
        usedFallbackDefaults: boolean;
      }>
    | undefined;
}

// ---------------------------------------------------------------------------
// Default seeds (fallback when bridge is unavailable)
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: PoscosechaClasificacionSettings = {
  desperdicio: 0.13,
};

const DEFAULT_AVAILABILITY_SEEDS: PoscosechaClasificacionAvailabilitySeed[] = [
  { grado: 15, pesoTalloSeed: 15 },
  { grado: 20, pesoTalloSeed: 20 },
  { grado: 25, pesoTalloSeed: 28.62 },
  { grado: 30, pesoTalloSeed: 31.15 },
  { grado: 35, pesoTalloSeed: 35.27 },
  { grado: 40, pesoTalloSeed: 40.25 },
  { grado: 45, pesoTalloSeed: 46.91 },
  { grado: 50, pesoTalloSeed: 51.21 },
  { grado: 55, pesoTalloSeed: 56.89 },
  { grado: 60, pesoTalloSeed: 63.08 },
  { grado: 65, pesoTalloSeed: 65.65 },
  { grado: 70, pesoTalloSeed: 71.36 },
  { grado: 75, pesoTalloSeed: 77.38 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeAvailabilitySeeds(seeds: PoscosechaClasificacionAvailabilitySeed[]) {
  return seeds
    .map((seed) => ({
      grado: Math.max(toInteger(seed.grado, 0), 1),
      pesoTalloSeed: Math.max(toNumber(seed.pesoTalloSeed, 0), 0),
    }))
    .filter((seed) => seed.grado > 0)
    .sort((left, right) => left.grado - right.grado);
}

function buildFallbackDefaults() {
  return {
    settings: DEFAULT_SETTINGS,
    availabilitySeeds: normalizeAvailabilitySeeds(DEFAULT_AVAILABILITY_SEEDS),
    workbookPath: null,
    masterPath: null,
    usedFallbackDefaults: true,
  };
}

async function loadSolverDefaults() {
  if (!global.__dashboardClasificacionEnBlancoDefaultsPromise) {
    global.__dashboardClasificacionEnBlancoDefaultsPromise = (async () => {
      try {
        const payload = await runBridge<SolverBridgeDefaults>("defaults");

        const availabilitySeeds = normalizeAvailabilitySeeds(
          (payload.availability_template ?? []).map((row) => ({
            grado: toInteger(row.grado, 0),
            pesoTalloSeed: toNumber(row.peso_tallo_seed, 0),
          })),
        );

        if (availabilitySeeds.length === 0) {
          return buildFallbackDefaults();
        }

        return {
          settings: sanitizeSettings(payload.settings),
          availabilitySeeds,
          workbookPath: payload.workbook_path ?? null,
          masterPath: payload.master_path ?? null,
          usedFallbackDefaults: false,
        };
      } catch {
        return buildFallbackDefaults();
      }
    })();
  }

  return global.__dashboardClasificacionEnBlancoDefaultsPromise;
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export async function getClasificacionEnBlancoBootData(): Promise<PoscosechaClasificacionBootData> {
  const [skuMaster, defaults] = await Promise.all([
    listCurrentPostharvestSkus(),
    loadSolverDefaults(),
  ]);

  return {
    skuMaster,
    ordersTemplate: buildClasificacionOrdersTemplate(skuMaster),
    availabilityTemplate: buildClasificacionAvailabilityTemplate(defaults.availabilitySeeds),
    orderSlots: buildClasificacionOrderSlotsTemplate(),
    lotSlots: buildClasificacionLotSlotsTemplate(),
    settings: defaults.settings,
    metadata: {
      engine: "Python + PuLP",
      masterSource: "PostgreSQL / public.postharvest_dim_sku_profile_scd2",
      workbookPath: defaults.workbookPath,
      masterPath: defaults.masterPath,
      usedFallbackDefaults: defaults.usedFallbackDefaults,
    },
  };
}
