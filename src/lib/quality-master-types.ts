export type SimpleMasterInput = {
  code: string;
  name: string;
  description?: string | null;
  externalRefCode?: string | null;
  contactEmail?: string | null;
  isActive: boolean;
  changeReason?: string | null;
};

export type SimpleMasterRecord = {
  entityId: string;
  code: string;
  name: string;
  description: string | null;
  externalRefCode: string | null;
  contactEmail: string | null;
  isActive: boolean;
  validFrom: string | null;
  validTo: string | null;
  loadedAt: string | null;
  runId: string | null;
  actorId: string | null;
  changeReason: string | null;
};

export type SimpleMasterPayload<TData extends SimpleMasterRecord = SimpleMasterRecord> = {
  data: TData;
};

export type QualitySimpleMasterKind =
  | "account-executives"
  | "customers"
  | "commercializers";

export type QualitySimpleMasterInput = SimpleMasterInput;

export type QualitySimpleMasterRecord = SimpleMasterRecord & {
  kind: QualitySimpleMasterKind;
};

export type QualitySimpleMasterPayload = SimpleMasterPayload<QualitySimpleMasterRecord>;

export type ClaimProblemLevel = "family" | "subfamily";
export type ClaimProblemScope = "quality" | "commercial" | "all";

export type QualityClaimProblemInput = {
  name: string;
  level: ClaimProblemLevel;
  scope: ClaimProblemScope;
  parentProblemIds?: string[] | null;
  description?: string | null;
  isActive: boolean;
  changeReason?: string | null;
};

export type QualityClaimProblemRecord = {
  nodeKey: string;
  problemId: string;
  code: string;
  name: string;
  level: ClaimProblemLevel;
  scope: ClaimProblemScope;
  parentProblemId: string | null;
  parentProblemName: string | null;
  parentProblemIds: string[];
  description: string | null;
  isActive: boolean;
  pathLabel: string;
  validFrom: string | null;
  validTo: string | null;
  loadedAt: string | null;
  runId: string | null;
  actorId: string | null;
  changeReason: string | null;
};

export type QualityClaimProblemPayload = {
  data: QualityClaimProblemRecord;
};
