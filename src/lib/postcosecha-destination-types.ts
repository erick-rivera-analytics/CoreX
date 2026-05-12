import type {
  SimpleMasterInput,
  SimpleMasterPayload,
  SimpleMasterRecord,
} from "@/lib/quality-master-types";

export type PostharvestDestinationInput = SimpleMasterInput;
export type PostharvestDestinationRecord = SimpleMasterRecord & {
  kind: "postharvest-destination";
};
export type PostharvestDestinationPayload = SimpleMasterPayload<PostharvestDestinationRecord>;
