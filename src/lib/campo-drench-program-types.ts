export type DrenchProgramCycleType = "S" | "P";
export const DRENCH_PROGRAM_ACTIVITY_ID = "FM11";

export type DrenchProgramLineRecord = {
  lineId: string;
  lineOrder: number;
  applicationMethod: string | null;
  litersPerBed: number | null;
  productId: string | null;
  productCode: string | null;
  productName: string | null;
  sourceProductName: string | null;
  sourceProductCode: string | null;
  sourceUnitCode: string | null;
  quantityValue: number | null;
  quantityReference: string | null;
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
  productId?: string | null;
  sourceProductName?: string | null;
  sourceProductCode?: string | null;
  sourceUnitCode?: string | null;
  quantityValue?: number | null;
  quantityReference?: string | null;
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
