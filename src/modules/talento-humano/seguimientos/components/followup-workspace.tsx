"use client";

import { useState } from "react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/button";
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
  exportUrl: string;
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
  exportUrl,
}: Props) {
  const hasSelected = Boolean(selectedFollowup);
  const [agendaCollapsed, setAgendaCollapsed] = useState(false);
  const showExpandedForm = hasSelected && agendaCollapsed;

  return (
    <div className={cn("grid gap-4", showExpandedForm ? "xl:grid-cols-1" : "xl:grid-cols-[0.92fr_1.08fr]")}>
      {hasSelected ? (
        <div className="xl:col-span-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAgendaCollapsed((current) => !current)}
          >
            {agendaCollapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
            {agendaCollapsed ? "Mostrar lista de colaboradores" : "Ocultar lista de colaboradores"}
          </Button>
        </div>
      ) : null}

      <div className={cn(hasSelected ? "min-w-0" : "min-w-0 xl:col-span-2", showExpandedForm && "hidden")}>
        <ScheduledFollowupTable
          rows={rows}
          selectedFollowup={selectedFollowup}
          onSelect={onSelectFollowup}
          isLoading={isLoading}
          exportUrl={exportUrl}
        />
      </div>

      {hasSelected && selectedFollowup && (
        <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
          <FollowupRegistrationPanel
            key={`${selectedFollowup.uniqueFollowUpCode}::${selectedFollowup.personId}::${selectedFollowup.responseEventId ?? "new"}`}
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
