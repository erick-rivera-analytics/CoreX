import type { SimpleMasterInput, SimpleMasterPayload, SimpleMasterRecord } from "@/lib/quality-master-types";

export type GeneralSimpleMasterKind = "varieties" | "farms";

export type GeneralSimpleMasterInput = SimpleMasterInput;

export type GeneralSimpleMasterRecord = SimpleMasterRecord & {
  kind: GeneralSimpleMasterKind;
};

export type GeneralSimpleMasterPayload = SimpleMasterPayload<GeneralSimpleMasterRecord>;
