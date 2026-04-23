import { describe, expect, it, vi } from "vitest";

import {
  centerProcessOnElementIds,
  scrollProcessToLane,
  type ViewerApi,
} from "@/modules/postcosecha/lib/balanzas-process-engine-helpers";
import { PROCESS_LANES } from "@/modules/postcosecha/lib/balanzas-process-stages";

function createViewer(options?: {
  elements?: Record<string, { id: string; x?: number; y?: number; width?: number; height?: number }>;
  viewbox?: { x: number; y: number; width: number; height: number };
}) {
  const defaultViewbox = options?.viewbox ?? { x: 0, y: 0, width: 500, height: 280 };
  const elements = options?.elements ?? {};
  const zoom = vi.fn(() => 1);
  const viewbox = vi.fn((box?: Partial<typeof defaultViewbox>) => {
    if (!box) {
      return defaultViewbox;
    }

    return { ...defaultViewbox, ...box };
  });
  const viewer = {
    get(service: string) {
      if (service === "canvas") {
        return {
          zoom,
          viewbox,
          addMarker: vi.fn(),
          removeMarker: vi.fn(),
        };
      }

      if (service === "elementRegistry") {
        return {
          get: (id: string) => elements[id],
          forEach: vi.fn(),
        };
      }

      if (service === "eventBus") {
        return { on: vi.fn() };
      }

      return {
        clear: vi.fn(),
        add: vi.fn(),
      };
    },
    destroy: vi.fn(),
    importXML: vi.fn(),
    saveSVG: vi.fn(),
  } as unknown as ViewerApi;

  return { viewer, zoom, viewbox };
}

describe("balanzas process engine helpers", () => {
  it("ignores invalid geometry and does not attempt a non-finite viewbox", () => {
    const { viewer, viewbox } = createViewer({
      elements: {
        SequenceFlow_1: { id: "SequenceFlow_1" },
        BrokenTask: { id: "BrokenTask", x: Number.NaN, y: 20, width: 80, height: 40 },
      },
    });

    expect(centerProcessOnElementIds(viewer, ["SequenceFlow_1", "BrokenTask"])).toBe(false);
    expect(viewbox).toHaveBeenCalledTimes(0);
  });

  it("recenters the canvas when valid bounded elements exist", () => {
    const { viewer, viewbox } = createViewer({
      elements: {
        Task_A: { id: "Task_A", x: 200, y: 120, width: 120, height: 80 },
        Task_B: { id: "Task_B", x: 420, y: 120, width: 120, height: 80 },
      },
    });

    expect(centerProcessOnElementIds(viewer, ["Task_A", "Task_B"])).toBe(true);
    expect(viewbox).toHaveBeenCalledTimes(2);
    expect(viewbox).toHaveBeenLastCalledWith({ x: 120, y: 20, width: 500, height: 280 });
  });

  it("falls back to fit viewport when a lane has no valid targets", () => {
    const { viewer, zoom, viewbox } = createViewer();
    const lane = PROCESS_LANES.find((entry) => entry.id === "apertura-apertura");

    expect(lane).toBeTruthy();
    expect(scrollProcessToLane(
      viewer,
      lane!,
      [{ id: "Unknown", name: "Sin match" }],
    )).toBe(false);
    expect(viewbox).toHaveBeenCalledTimes(0);
    expect(zoom).toHaveBeenCalledWith("fit-viewport", "auto");
  });
});
