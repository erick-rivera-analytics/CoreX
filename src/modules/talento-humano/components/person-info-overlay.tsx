"use client";

import { PersonDetailSheet } from "@/modules/talento-humano/components/person-detail-sheet";

export function PersonInfoOverlay({
  personId,
  personName,
  onClose,
}: {
  personId: string;
  personName: string;
  onClose: () => void;
}) {
  return <PersonDetailSheet personId={personId} personName={personName} onClose={onClose} />;
}
