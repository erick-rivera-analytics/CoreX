export type CommercialAccountExecutiveSourceMode = "personnel" | "manual";

export type CommercialPersonnelCandidate = {
  personCode: string;
  personName: string;
  nationalId: string | null;
  areaId: string | null;
  areaName: string | null;
  areaGeneral: string | null;
  jobTitle: string | null;
  jobClassificationCode: string | null;
  employeeType: string | null;
  email: string | null;
};

export type CommercialAccountExecutiveRecord = {
  entityId: string;
  code: string;
  name: string;
  description: string | null;
  personCode: string | null;
  contactEmail: string | null;
  sourceMode: CommercialAccountExecutiveSourceMode;
  isActive: boolean;
  validFrom: string | null;
  validTo: string | null;
  loadedAt: string | null;
  runId: string | null;
  actorId: string | null;
  changeReason: string | null;
};

export type CommercialAccountExecutiveInput = {
  naPersonalCode: boolean;
  personCode?: string | null;
  executiveName?: string | null;
  contactEmail?: string | null;
  description?: string | null;
  isActive: boolean;
  changeReason?: string | null;
};
