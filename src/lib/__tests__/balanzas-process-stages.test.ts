import { describe, expect, it } from "vitest";

import type { BalanzasNodeData } from "@/lib/postcosecha-balanzas";
import {
  findLaneBySelection,
  getProcessSelection,
  PROCESS_LANES,
  resolveAggregateChildren,
  resolveLaneViewportTargetIds,
} from "@/modules/postcosecha/lib/balanzas-process-stages";

describe("balanzas process lanes", () => {
  it("maps the new node selections to the canonical lanes", () => {
    expect(findLaneBySelection(getProcessSelection("b1ab_pre_gv"))?.id).toBe("pre-gv");
    expect(findLaneBySelection(getProcessSelection("b2_pre_directo"))?.id).toBe("pre-directo");
    expect(findLaneBySelection(getProcessSelection("b2_apertura_max10"))?.id).toBe("apertura-gv-pelado");
    expect(findLaneBySelection(getProcessSelection("general_apertura_directo"))?.id).toBe("apertura-apertura");
  });

  it("prefers explicit element ids and falls back to name hints", () => {
    const preLane = PROCESS_LANES.find((lane) => lane.id === "pre-gv");

    expect(preLane).toBeTruthy();
    expect(resolveLaneViewportTargetIds(
      preLane!,
      [
        { id: "Task_B1AB_Pre_GV", name: "B1AB" },
        { id: "fallback", name: "General alterno" },
      ],
    )).toEqual(["Task_B1AB_Pre_GV"]);

    expect(resolveLaneViewportTargetIds(
      { ...preLane!, viewportTargetIds: ["missing-id"], elementNameHints: ["GENERAL"] },
      [{ id: "Task_General_Pre_GV", name: "GENERAL" }],
    )).toEqual(["Task_General_Pre_GV"]);
  });

  it("resolves aggregate children from the explicit node inventory", () => {
    const nodes = [
      {
        key: "general_apertura_directo",
        kind: "aggregate",
        childrenKeys: [
          "b2a_apertura_directo_arcoiris",
          "b2a_apertura_directo_tinturado",
        ],
      },
      {
        key: "b2a_apertura_directo_arcoiris",
        kind: "metric",
        childrenKeys: [],
      },
      {
        key: "b2a_apertura_directo_tinturado",
        kind: "metric",
        childrenKeys: [],
      },
    ] as BalanzasNodeData[];

    expect(resolveAggregateChildren(nodes[0]!, nodes).map((node) => node.key)).toEqual([
      "b2a_apertura_directo_arcoiris",
      "b2a_apertura_directo_tinturado",
    ]);
  });
});
