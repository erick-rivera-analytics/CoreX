export type BodegaUnitDimension = "Unidad" | "Peso" | "Volumen" | "Longitud";

export type BodegaUnitRecord = {
  unitId: string;
  code: string;
  name: string;
  symbol: string;
  dimension: BodegaUnitDimension;
  decimalPrecision: number;
  isActive: boolean;
  validFrom: string | null;
  validTo: string | null;
  loadedAt: string | null;
  runId: string | null;
  actorId: string | null;
  changeReason: string | null;
};

export type BodegaUnitInput = {
  code: string;
  name: string;
  symbol: string;
  dimension: BodegaUnitDimension;
  decimalPrecision: number;
  isActive: boolean;
  changeReason?: string | null;
};

export type BodegaCategoryLevel = "family" | "subfamily";

export type BodegaCategoryRecord = {
  categoryId: string;
  code: string;
  name: string;
  level: BodegaCategoryLevel;
  parentCategoryId: string | null;
  parentCategoryName: string | null;
  pathLabel: string;
  sortOrder: number;
  description: string | null;
  isActive: boolean;
  validFrom: string | null;
  validTo: string | null;
  loadedAt: string | null;
  runId: string | null;
  actorId: string | null;
  changeReason: string | null;
};

export type BodegaCategoryInput = {
  code: string;
  name: string;
  level: BodegaCategoryLevel;
  parentCategoryId?: string | null;
  sortOrder: number;
  description?: string | null;
  isActive: boolean;
  changeReason?: string | null;
};

export type BodegaActivityRecord = {
  activityId: string;
  activityName: string;
  costArea: string | null;
  subCostCenter: string | null;
  activityType: string | null;
  unitOfMeasure: string | null;
};

export type BodegaProductAssignmentRecord = {
  activityId: string;
  activityName: string;
  costArea: string | null;
  subCostCenter: string | null;
  activityType: string | null;
  branchOrder: number;
  usageLabel: string;
};

export type BodegaProductAssignmentInput = {
  activityId: string;
  branchOrder?: number;
};

export type BodegaActiveComponentMode = "applies" | "na";

export type BodegaProductRecord = {
  productId: string;
  productCode: string;
  productName: string;
  description: string | null;
  baseUnitId: string;
  baseUnitCode: string;
  baseUnitName: string;
  categoryId: string;
  categoryPathLabel: string;
  categoryLeafName: string;
  activeComponentMode: BodegaActiveComponentMode;
  activeComponentName: string | null;
  isActive: boolean;
  assignments: BodegaProductAssignmentRecord[];
  validFrom: string | null;
  validTo: string | null;
  loadedAt: string | null;
  runId: string | null;
  actorId: string | null;
  changeReason: string | null;
};

export type BodegaProductInput = {
  productCode: string;
  productName: string;
  description?: string | null;
  baseUnitId: string;
  categoryId: string;
  activeComponentMode: BodegaActiveComponentMode;
  activeComponentName?: string | null;
  isActive: boolean;
  assignments: BodegaProductAssignmentInput[];
  changeReason?: string | null;
};

export type BodegaUnitPayload = {
  data: BodegaUnitRecord;
};

export type BodegaCategoryPayload = {
  data: BodegaCategoryRecord;
};

export type BodegaProductPayload = {
  data: BodegaProductRecord;
};

export type BodegaPresentationConversionMode = "auto" | "manual";

export type BodegaPresentationRecord = {
  presentationId: string;
  productId: string;
  productCode: string;
  productName: string;
  commercialName: string | null;
  presentationCode: string;
  presentationName: string;
  packageName: string | null;
  presentationQuantity: number;
  presentationUnitId: string;
  presentationUnitCode: string;
  presentationUnitName: string;
  baseUnitId: string | null;
  baseUnitCode: string | null;
  baseUnitName: string | null;
  equivalentBaseQuantity: number;
  conversionMode: BodegaPresentationConversionMode;
  allowsFractioning: boolean;
  operationalNote: string | null;
  isActive: boolean;
  validFrom: string | null;
  validTo: string | null;
  loadedAt: string | null;
  runId: string | null;
  actorId: string | null;
  changeReason: string | null;
};

export type BodegaPresentationInput = {
  productId: string;
  commercialName?: string | null;
  presentationCode: string;
  presentationName: string;
  packageName?: string | null;
  presentationQuantity: number;
  presentationUnitId: string;
  equivalentBaseQuantity?: number | null;
  allowsFractioning: boolean;
  operationalNote?: string | null;
  isActive: boolean;
  changeReason?: string | null;
};

export type BodegaPresentationPayload = {
  data: BodegaPresentationRecord;
};
