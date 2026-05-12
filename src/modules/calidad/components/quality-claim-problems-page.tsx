import { ClaimProblemsPage } from "@/modules/domain-masters/components/claim-problems-page";
import type { QualityClaimProblemRecord } from "@/lib/quality-master-types";

export function QualityClaimProblemsPage({
  initialData,
  initialError,
}: {
  initialData: QualityClaimProblemRecord[];
  initialError?: string | null;
}) {
  return <ClaimProblemsPage initialData={initialData} initialError={initialError} />;
}
