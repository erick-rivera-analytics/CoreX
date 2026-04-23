import type { BalanzasLaneId, BalanzasNodeData, BalanzasNodeKey } from "@/lib/postcosecha-balanzas";

export type BalanzasProcessSelection = {
  nodeKey: BalanzasNodeKey;
};

export type ProcessLane = {
  id: BalanzasLaneId;
  label: string;
  color: string;
  selection: BalanzasProcessSelection;
  viewportTargetIds: string[];
  elementNameHints: string[];
};

export type SearchableProcessElement = {
  id: string;
  name: string;
};

export const CLEAN_FLOW_ASSET_PATH = "/processes/postcosecha-flow-clean.svg";

export const PROCESS_LANES: ProcessLane[] = [
  {
    id: "pre-gv",
    label: "Preclasificacion / GV sin pelar",
    color: "#2563eb",
    selection: { nodeKey: "b1ab_pre_gv" },
    viewportTargetIds: [
      "Task_B1_Preclasificacion",
      "Task_B1AB_Pre_GV",
      "Task_B2_Pre_GV",
      "Task_B3_Pre_GV_Arcoiris",
      "Task_B3_Pre_GV_Tinturado",
      "Task_B3_Pre_GV_Blanco",
      "Task_General_Pre_GV",
    ],
    elementNameHints: ["B1AB", "B2", "B3", "GENERAL"],
  },
  {
    id: "pre-directo",
    label: "Preclasificacion / Directo",
    color: "#0891b2",
    selection: { nodeKey: "b1ab_pre_directo" },
    viewportTargetIds: [
      "Task_B1_Preclasificacion",
      "Task_B1AB_Pre_Directo",
      "Task_B2_Pre_Directo",
      "Task_B3_Pre_Directo_Arcoiris",
      "Task_B3_Pre_Directo_Tinturado",
      "Task_B3_Pre_Directo_Blanco",
      "Task_General_Pre_Directo",
    ],
    elementNameHints: ["B1AB", "B2", "B3", "GENERAL"],
  },
  {
    id: "apertura-gv-pelado",
    label: "Apertura / GV pelado",
    color: "#16a34a",
    selection: { nodeKey: "b1c_apertura_gv" },
    viewportTargetIds: [
      "Task_B1_Apertura",
      "Task_B1C_Apertura_GV",
      "Task_B2_Apertura_Max10",
      "Task_B2A_Apertura_Max10_Arcoiris",
      "Task_B2A_Apertura_Max10_Tinturado",
      "Task_B2A_Apertura_Max10_Blanco",
      "Task_General_Apertura_Max10",
    ],
    elementNameHints: ["B1C", "B2", "B2A", "GENERAL"],
  },
  {
    id: "apertura-apertura",
    label: "Apertura / Apertura",
    color: "#f97316",
    selection: { nodeKey: "b1c_apertura_directo" },
    viewportTargetIds: [
      "Task_B1_Apertura",
      "Task_B1C_Apertura_Directo",
      "Task_B2_Apertura_Directo",
      "Task_B2A_Apertura_Directo_Arcoiris",
      "Task_B2A_Apertura_Directo_Tinturado",
      "Task_B2A_Apertura_Directo_Blanco",
      "Task_General_Apertura_Directo",
    ],
    elementNameHints: ["B1C", "B2", "B2A", "GENERAL"],
  },
];

const LANE_BY_NODE: Record<BalanzasNodeKey, BalanzasLaneId> = {
  b1_preclasificacion: "pre-gv",
  b1ab_pre_gv: "pre-gv",
  b2_pre_gv: "pre-gv",
  b3_pre_gv_arcoiris: "pre-gv",
  b3_pre_gv_tinturado: "pre-gv",
  b3_pre_gv_blanco: "pre-gv",
  general_pre_gv: "pre-gv",
  b1ab_pre_directo: "pre-directo",
  b2_pre_directo: "pre-directo",
  b3_pre_directo_arcoiris: "pre-directo",
  b3_pre_directo_tinturado: "pre-directo",
  b3_pre_directo_blanco: "pre-directo",
  general_pre_directo: "pre-directo",
  b1_apertura: "apertura-gv-pelado",
  b1c_apertura_gv: "apertura-gv-pelado",
  b2_apertura_max10: "apertura-gv-pelado",
  b2a_apertura_max10_arcoiris: "apertura-gv-pelado",
  b2a_apertura_max10_tinturado: "apertura-gv-pelado",
  b2a_apertura_max10_blanco: "apertura-gv-pelado",
  general_apertura_max10: "apertura-gv-pelado",
  b1c_apertura_directo: "apertura-apertura",
  b2_apertura_directo: "apertura-apertura",
  b2a_apertura_directo_arcoiris: "apertura-apertura",
  b2a_apertura_directo_tinturado: "apertura-apertura",
  b2a_apertura_directo_blanco: "apertura-apertura",
  general_apertura_directo: "apertura-apertura",
};

export function getProcessSelection(nodeKey: BalanzasNodeKey): BalanzasProcessSelection {
  return { nodeKey };
}

export function findLaneByNodeKey(nodeKey: BalanzasNodeKey | null | undefined) {
  if (!nodeKey) {
    return null;
  }

  const laneId = LANE_BY_NODE[nodeKey];
  return PROCESS_LANES.find((lane) => lane.id === laneId) ?? null;
}

export function findLaneBySelection(selection: BalanzasProcessSelection | null) {
  return findLaneByNodeKey(selection?.nodeKey);
}

export function resolveLaneViewportTargetIds(
  lane: ProcessLane,
  elements: SearchableProcessElement[],
) {
  const availableIds = new Set(elements.map((element) => element.id));
  const directMatches = lane.viewportTargetIds.filter((elementId) => availableIds.has(elementId));

  if (directMatches.length) {
    return directMatches;
  }

  const normalizedHints = lane.elementNameHints
    .map((hint) => hint.trim().toLowerCase())
    .filter(Boolean);

  if (!normalizedHints.length) {
    return [] as string[];
  }

  return elements
    .filter((element) => {
      const elementName = element.name.trim().toLowerCase();
      return normalizedHints.some((hint) => elementName.includes(hint));
    })
    .map((element) => element.id);
}

export function resolveAggregateChildren(node: BalanzasNodeData | null, nodes: BalanzasNodeData[]) {
  if (!node || node.kind !== "aggregate" || !node.childrenKeys.length) {
    return [] as BalanzasNodeData[];
  }

  const childrenByKey = new Map(nodes.map((entry) => [entry.key, entry]));
  return node.childrenKeys
    .map((nodeKey) => childrenByKey.get(nodeKey) ?? null)
    .filter((entry): entry is BalanzasNodeData => Boolean(entry));
}
