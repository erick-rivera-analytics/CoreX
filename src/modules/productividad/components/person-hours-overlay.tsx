"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import useSWRImmutable from "swr/immutable";

import { PersonMedicalPanel } from "@/modules/fenograma/components/person-medical-panel";
import { Badge } from "@/shared/ui/badge";
import { SheetShell } from "@/shared/overlays/sheet-shell";
import { fetchJson } from "@/lib/fetch-json";
import { cn } from "@/lib/utils";
import { useCurrentUserAccess } from "@/hooks/use-current-user-access";
import { canAccessResource } from "@/lib/access-control";
import { PersonHoursInfoSection } from "./person-hours-info-section";
import { PersonHoursPerformanceSection } from "./person-hours-performance-section";
import type { CycleLaborPersonDetailPayload } from "@/lib/fenograma";

function buildCycleHoursPersonRequest(cycleKey: string, personId: string | null) {
  if (!personId) {
    return null;
  }

  return [
    `/api/fenograma/cycle/${encodeURIComponent(cycleKey)}/hours/person/${encodeURIComponent(personId)}`,
    "No se pudo cargar la ficha de horas del personal.",
  ] as const;
}

async function swrPersonHoursFetcher<T>([url, fallbackMessage]: readonly [string, string]) {
  return fetchJson<T>(url, fallbackMessage);
}

export function PersonHoursOverlay({
  cycleKey,
  personId,
  camas30,
  onClose,
}: {
  cycleKey: string;
  personId: string;
  camas30: number | null;
  onClose: () => void;
}) {
  const { data: access } = useCurrentUserAccess();
  const allowedResources = access?.allowedResources ?? [];
  const isSuperadmin = access?.isSuperadmin ?? false;
  const canSeeInfo        = canAccessResource("panel:person-sheet.info",        allowedResources, isSuperadmin);
  const canSeePerformance = canAccessResource("panel:person-sheet.performance", allowedResources, isSuperadmin);
  const canSeeMedical     = canAccessResource("panel:person-sheet.medical",     allowedResources, isSuperadmin);
  const defaultView: "info" | "performance" | "medical" = canSeeInfo ? "info" : canSeePerformance ? "performance" : "medical";
  const [view, setView] = useState<"info" | "performance" | "medical">(defaultView);
  const activeView: "info" | "performance" | "medical" =
    view === "info" && canSeeInfo
      ? "info"
      : view === "performance" && canSeePerformance
        ? "performance"
        : view === "medical" && canSeeMedical
          ? "medical"
          : defaultView;

  const personRequest = buildCycleHoursPersonRequest(cycleKey, personId);
  const {
    data,
    error,
    isLoading,
  } = useSWRImmutable<CycleLaborPersonDetailPayload>(personRequest, swrPersonHoursFetcher, {
    revalidateOnFocus: false,
  });

  const profile = data?.profile ?? null;
  const displayName = profile?.fullName ?? `Personal ${personId}`;
  const requestError = error instanceof Error ? error.message : null;

  return (
    <SheetShell
      title={displayName}
      description={profile?.jobTitle ?? "Personal de campo"}
      onClose={onClose}
      widthClassName="max-w-6xl"
      headerActions={
        <div className="flex flex-wrap justify-end gap-2">
          <Badge variant="outline" className="rounded-full px-3 py-1">
            Ficha del personal
          </Badge>
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            ID {personId}
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1">
            {cycleKey}
          </Badge>
        </div>
      }
    >
      <div className="space-y-8">
        <div className="inline-flex rounded-full border border-border/60 bg-muted/22 p-1">
          <button
            type="button"
            disabled={!canSeeInfo}
            title={canSeeInfo ? undefined : "Sin permiso para este panel"}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              !canSeeInfo
                ? "cursor-not-allowed text-muted-foreground/40"
                : activeView === "info"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => canSeeInfo && setView("info")}
          >
            Informacion
          </button>
          <button
            type="button"
            disabled={!canSeePerformance}
            title={canSeePerformance ? undefined : "Sin permiso para este panel"}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              !canSeePerformance
                ? "cursor-not-allowed text-muted-foreground/40"
                : activeView === "performance"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => canSeePerformance && setView("performance")}
          >
            Rendimiento
          </button>
          <button
            type="button"
            disabled={!canSeeMedical}
            title={canSeeMedical ? undefined : "Sin permiso para este panel"}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              !canSeeMedical
                ? "cursor-not-allowed text-muted-foreground/40"
                : activeView === "medical"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => canSeeMedical && setView("medical")}
          >
            Ficha medica
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Cargando ficha del personal.
          </div>
        ) : requestError ? (
          <div className="py-8 text-sm text-destructive">{requestError}</div>
        ) : data ? (
          activeView === "info" ? (
            <PersonHoursInfoSection profile={profile} />
          ) : activeView === "performance" ? (
            <PersonHoursPerformanceSection data={data} camas30={camas30} />
          ) : (
            <PersonMedicalPanel
              personId={personId}
              fallbackName={displayName}
            />
          )
        ) : (
          <div className="py-8 text-sm text-muted-foreground">
            No se encontro informacion para este personal en el ciclo.
          </div>
        )}
      </div>
    </SheetShell>
  );
}
