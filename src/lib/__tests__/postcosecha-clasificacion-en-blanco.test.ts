import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/postcosecha-skus", () => ({
  listCurrentPostharvestSkus: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));

import { spawn } from "child_process";
import { listCurrentPostharvestSkus } from "@/lib/postcosecha-skus";
import {
  getClasificacionEnBlancoBootData,
  runClasificacionEnBlancoSolver,
} from "@/lib/postcosecha-clasificacion-en-blanco";
import type { PoscosechaClasificacionResult } from "@/lib/postcosecha-clasificacion-en-blanco-types";

function createSolveResult(sku: string, pedidoResuelto: number): PoscosechaClasificacionResult {
  return {
    stage1Summary: {
      pedido_bunches_total: pedidoResuelto,
      pedido_bunches_resuelto: pedidoResuelto,
      ajuste_bunches_total: 0,
    },
    stage2Summary: {
      peso_disponible_total: pedidoResuelto * 750,
      peso_ideal_pedido_total: pedidoResuelto * 750,
      peso_ideal_resuelto_total: pedidoResuelto * 750,
      peso_real_total: pedidoResuelto * 760,
      sobrepeso_real_vs_ideal: pedidoResuelto * 10,
      sobrepeso_pct_macro: 0.013,
    },
    solverMeta: {
      status: "Optimal",
    },
    priorityRows: [],
    orderRows: [
      {
        sku,
        estadoPeso: "Dentro de objetivo",
        pedidoTotal: pedidoResuelto,
        pedidoResuelto,
        ajusteBunches: 0,
        cumplimientoBunches: 1,
        pesoIdealBunch: 750,
        pesoIdealPedido: pedidoResuelto * 750,
        pesoIdealResuelto: pedidoResuelto * 750,
        pesoRealTotal: pedidoResuelto * 760,
        pesoRealBunch: 760,
        tallosMin: 20,
        tallosMax: 22,
        tallosPromedioRamo: 20,
        pesoMinObjetivo: 727.5,
        pesoMaxObjetivo: 772.5,
        sobrepesoPct: 0.013,
        sobrepesoBunch: 10,
        sobrepesoTotal: pedidoResuelto * 10,
        tallosAsignadosNetos: pedidoResuelto * 20,
        tallosAsignadosBrutos: pedidoResuelto * 20,
        mallasTotales: pedidoResuelto,
        gradosUsados: 2,
        excesoGradosObjetivo: 0,
      },
    ],
    availabilityRows: [],
    matrix: {
      gradeLabels: [40],
      rows: [{ sku, values: { "40": pedidoResuelto }, total: pedidoResuelto }],
      totals: { "40": pedidoResuelto },
      grandTotal: pedidoResuelto,
    },
    netStemMatrix: {
      gradeLabels: [40],
      rows: [{ sku, values: { "40": pedidoResuelto * 20 }, total: pedidoResuelto * 20 }],
      totals: { "40": pedidoResuelto * 20 },
      grandTotal: pedidoResuelto * 20,
    },
  };
}

function createMockChild(command: string) {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdin: { write: (value: string) => void; end: () => void };
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();

  let buffer = "";
  child.stdin = {
    write(value: string) {
      buffer += value;
    },
    end() {
      queueMicrotask(() => {
        if (command === "defaults") {
          child.stdout.emit(
            "data",
            JSON.stringify({
              settings: { desperdicio: 0.13 },
              availability_template: [{ grado: 40, peso_tallo_seed: 40 }],
              workbook_path: "solver.xlsx",
              master_path: null,
            }),
          );
          child.emit("close", 0);
          return;
        }

        const payload = JSON.parse(buffer || "{}") as {
          orders?: Array<Record<string, number | string>>;
        };
        const firstOrder = payload.orders?.[0] ?? {};
        const pedidoResuelto = ["fecha_1", "fecha_2", "fecha_3", "fecha_4", "fecha_5"].reduce(
          (acc, key) => acc + Number(firstOrder[key] ?? 0),
          0,
        );

        child.stdout.emit("data", JSON.stringify(createSolveResult(String(firstOrder.sku ?? "SKU"), pedidoResuelto)));
        child.emit("close", 0);
      });
    },
  };

  return child;
}

beforeEach(() => {
  vi.clearAllMocks();
  global.__dashboardClasificacionEnBlancoDefaultsPromise = undefined;
  vi.mocked(listCurrentPostharvestSkus).mockResolvedValue([
    {
      skuId: "sku-1",
      sku: "750X20MIN",
      pesoIdealBunch: 750,
      tallosMin: 20,
      tallosMax: 22,
      pesoMinObjetivo: 727.5,
      pesoMaxObjetivo: 772.5,
      maxGradosObjetivo: 3,
      validFrom: null,
      validTo: null,
      loadedAt: null,
      runId: null,
      actorId: null,
      changeReason: null,
    },
  ]);
  vi.mocked(spawn).mockImplementation((_python, args) => createMockChild(String(args?.[1] ?? "")) as never);
});

describe("postcosecha clasificacion server", () => {
  it("incluye templates de slots en el boot data", async () => {
    const bootData = await getClasificacionEnBlancoBootData();

    // Templates default: 1 slot mínimo en order/lot. La UI puede expandir
    // hasta 5 slots dinámicamente; el bootstrap solo provee el primer slot.
    expect(bootData.orderSlots).toHaveLength(1);
    expect(bootData.lotSlots).toHaveLength(1);
    expect(bootData.ordersTemplate).toHaveLength(1);
  });

  it("ejecuta corridas multimodo y consolida runs", async () => {
    const response = await runClasificacionEnBlancoSolver({
      orders: [
        {
          skuId: "sku-1",
          sku: "750X20MIN",
          fecha_1: 4,
          fecha_2: 3,
          fecha_3: 2,
          fecha_4: 0,
          fecha_5: 0,
        },
      ],
      availability: [
        {
          grado: 40,
          pesoTalloSeed: 40,
          fecha_1: 10,
          fecha_2: 10,
          fecha_3: 10,
          fecha_4: 0,
          fecha_5: 0,
        },
      ],
      settings: { desperdicio: 0 },
      orderSlots: [
        { key: "fecha_1", restriction: "GV", restrictionMode: "STRICT" },
        { key: "fecha_2", restriction: "APERTURA", restrictionMode: "STRICT" },
        { key: "fecha_3", restriction: "PRECLASIFICACION", restrictionMode: "STRICT" },
      ],
      lotSlots: [
        { key: "fecha_1", origin: "GV", lotDate: "2026-04-21" },
        { key: "fecha_2", origin: "APERTURA", lotDate: "2026-04-22" },
        { key: "fecha_3", origin: "PRECLASIFICACION", lotDate: "2026-04-23" },
      ],
    });

    expect(response.runs).toHaveLength(3);
    expect(response.runs.map((run) => run.mode)).toEqual(["GV", "APERTURA", "PRECLASIFICACION"]);
    expect(response.runs.every((run) => run.result !== null)).toBe(true);
    expect(vi.mocked(spawn).mock.calls.filter((call) => call[1]?.[1] === "solve")).toHaveLength(3);
  });
});
