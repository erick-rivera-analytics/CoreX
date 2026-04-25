export type CampoDrenchProductRecord = {
  productId: string;
  productName: string;
  productCode: string | null;
  unit: string | null;
  utilization: string | null;
  warehouseAvailability: string | null;
  applicationDay: string | null;
  applicationPh: string | null;
  reentryHours: string | null;
  applicationReason1: string | null;
  applicationReason2: string | null;
  applicationReason3: string | null;
  applicationReason4: string | null;
  activeIngredient: string | null;
  toxicologicalCategory: string | null;
  toxicologicalDescription: string | null;
  agrochemicalOrder: string | null;
  predisposition: string | null;
  referenceDose: string | null;
  withholdingPeriod: string | null;
  validFrom: string | null;
  validTo: string | null;
  loadedAt: string | null;
  runId: string | null;
  actorId: string | null;
  changeReason: string | null;
};

export type CampoDrenchProductInput = {
  productName: string;
  productCode?: string | null;
  unit?: string | null;
  utilization?: string | null;
  warehouseAvailability?: string | null;
  applicationDay?: string | null;
  applicationPh?: string | null;
  reentryHours?: string | null;
  applicationReason1?: string | null;
  applicationReason2?: string | null;
  applicationReason3?: string | null;
  applicationReason4?: string | null;
  activeIngredient?: string | null;
  toxicologicalCategory?: string | null;
  toxicologicalDescription?: string | null;
  agrochemicalOrder?: string | null;
  predisposition?: string | null;
  referenceDose?: string | null;
  withholdingPeriod?: string | null;
  changeReason?: string | null;
};

export type CampoDrenchProductPayload = {
  data: CampoDrenchProductRecord;
};
