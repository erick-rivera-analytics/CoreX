"use client";

import type {
  EmployeeFollowupCatalogMap,
  EmployeeScheduledFollowupRow,
} from "@/modules/talento-humano/seguimientos/server/types";
import { ScheduledFollowupTable } from "@/modules/talento-humano/seguimientos/components/scheduled-followup-table";
import { FollowupRegistrationPanel } from "@/modules/talento-humano/seguimientos/components/followup-registration-panel";

type Permissions = { canWrite: boolean; canSensitive: boolean; canAdmin: boolean };

type Props = {
  rows: EmployeeScheduledFollowupRow[];
  catalogs: EmployeeFollowupCatalogMap;
  permissions: Permissions;
  selectedFollowup: EmployeeScheduledFollowupRow | null;
  onSelectFollowup: (row: EmployeeScheduledFollowupRow | null) => void;
  onFollowupUpdated: () => void;
  isLoading: boolean;
  asOfDate?: string;
};

export function FollowupWorkspace({
  rows,
  catalogs,
  permissions,
  selectedFollowup,
  onSelectFollowup,
  onFollowupUpdated,
  isLoading,
  asOfDate,
}: Props) {
  const hasSelected = Boolean(selectedFollowup);

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* Panel izquierdo: tabla de seguimientos (40%) */}
      <div className={hasSelected ? "lg:w-[40%]" : "w-full"}>
        <ScheduledFollowupTable
          rows={rows}
          selectedFollowup={selectedFollowup}
          onSelect={onSelectFollowup}
          isLoading={isLoading}
        />
      </div>

      {/* Panel derecho: registro (60%) */}
      {hasSelected && selectedFollowup && (
        <div className="lg:w-[60%]">
          <FollowupRegistrationPanel
            followup={selectedFollowup}
            catalogs={catalogs}
            permissions={permissions}
            asOfDate={asOfDate}
            onSaved={onFollowupUpdated}
            onClose={() => onSelectFollowup(null)}
          />
        </div>
      )}
    </div>
  );
}
