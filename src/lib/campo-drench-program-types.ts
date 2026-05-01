export type DrenchProgramCycleType = "S" | "P";
export const DRENCH_PROGRAM_ACTIVITY_ID = "FM11";
export type DrenchProductOrigin = "BODEGA" | "LABORATORIO";
export type DrenchDosageBasis = "PER_LITER" | "PER_BED" | "PER_1000_LITERS";

export type DrenchProgramLineRecord = {
  lineId: string;
  lineOrder: number;
  applicationMethod: string | null;
  litersPerBed: number | null;
  dosageBasis: DrenchDosageBasis;
  productOrigin: DrenchProductOrigin;
  productId: string | null;
  productCode: string | null;
  productName: string | null;
  laboratoryProductId: string | null;
  laboratoryProductCode: string | null;
  laboratoryProductName: string | null;
  sourceProductName: string | null;
  sourceProductCode: string | null;
  sourceUnitCode: string | null;
  productQuantityValue: number | null;
  productQuantityReference: string | null;
  notes: string | null;
  isActive: boolean;
  validFrom: string | null;
  validTo: string | null;
  loadedAt: string | null;
  runId: string | null;
  actorId: string | null;
  changeReason: string | null;
};

export type DrenchProgramRuleRecord = {
  ruleId: string;
  ruleCode: string;
  phenologicalWeek: number;
  cycleType: DrenchProgramCycleType;
  varietyCode: string;
  activityId: string;
  isActive: boolean;
  notes: string | null;
  lines: DrenchProgramLineRecord[];
  validFrom: string | null;
  validTo: string | null;
  loadedAt: string | null;
  runId: string | null;
  actorId: string | null;
  changeReason: string | null;
};

export type DrenchProgramLineInput = {
  lineOrder?: number;
  applicationMethod?: string | null;
  litersPerBed?: number | null;
  dosageBasis?: DrenchDosageBasis | null;
  productOrigin?: DrenchProductOrigin | null;
  productId?: string | null;
  laboratoryProductId?: string | null;
  sourceProductName?: string | null;
  sourceProductCode?: string | null;
  sourceUnitCode?: string | null;
  productQuantityValue?: number | null;
  productQuantityReference?: string | null;
  notes?: string | null;
  isActive?: boolean;
};

export type DrenchProgramRuleInput = {
  phenologicalWeek: number;
  cycleType: DrenchProgramCycleType;
  varietyCode: string;
  activityId?: string | null;
  isActive: boolean;
  notes?: string | null;
  lines: DrenchProgramLineInput[];
  changeReason?: string | null;
};

export type DrenchProgramRulePayload = {
  data: DrenchProgramRuleRecord;
};
