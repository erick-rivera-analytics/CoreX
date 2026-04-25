"use client";

import { useMemo, useState, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import useSWRImmutable from "swr/immutable";

import { fetchJson } from "@/lib/fetch-json";
import { cn } from "@/lib/utils";
import type { CycleLaborPersonDetailPayload } from "@/lib/fenograma";
import type { TalentoPersonProfile } from "@/lib/talento-humano";
import { useCurrentUserAccess } from "@/hooks/use-current-user-access";
import { canAccessResource } from "@/lib/access-control";
import { PersonMedicalPanel } from "@/modules/fenograma/components/person-medical-panel";
import { PersonHoursPerformanceSection } from "@/modules/productividad/components/person-hours-performance-section";
import { DialogShell } from "@/shared/overlays/dialog-shell";
import {
  PersonProfileInfoCanon,
  mapCyclePayloadToInfoCanon,
  mapTalentoPayloadToInfoCanon,
} from "@/shared/overlays/person-profile-info-canon";
import { PersonProfileTalentoPerformanceSection } from "@/shared/overlays/person-profile-talento-performance-section";
import { Badge } from "@/shared/ui/badge";

export type PersonProfileSourceContext =
  | { module: "fenograma" | "productividad"; cycleKey: string; camas30?: number | null }
  | { module: "talento" | "campo" | "mortality" };

export type PersonProfileTab = "informacion" | "rendimiento" | "medica";

export type PersonProfileDialogProps = {
  open: boolean;
  /** Identificador único de la persona. */
  personId: string;
  /**
   * Contexto del módulo origen — determina qué endpoint usar y qué tabs mostrar.
   *
   * - `fenograma|productividad` con cycleKey: usa endpoint `/api/fenograma/cycle/[cycleKey]/hours/person/[personId]`
   *   y muestra Rendimiento contextualizado por ciclo (sin filtro de ciclo extra).
   * - `talento|campo|mortality`: usa endpoint `/api/talento-humano/persona/[personId]`. La tab Rendimiento
   *   muestra empty state porque no hay contexto de ciclo.
   */
  sourceContext: PersonProfileSourceContext;
  /** Tab inicial al abrir. Default: primera tab con permiso. */
  defaultTab?: PersonProfileTab;
  onClose: () => void;
};

function fetchCycleHoursPerson([url, fallbackMessage]: readonly [string, string]) {
  return fetchJson<CycleLaborPersonDetailPayload>(url, fallbackMessage);
}

function fetchTalentoProfile(url: string) {
  return fetchJson<TalentoPersonProfile>(url, "No se pudo cargar la ficha del personal.");
}

/**
 * Ficha del personal canónica.
 *
 * Único componente para abrir persona desde Productividad, Talento Humano,
 * Composición laboral, Fenograma, Campo o cualquier tabla. Reemplaza:
 *
 * - `PersonHoursOverlay` interno de `block-profile-modal.tsx` (PH07)
 * - `PersonHoursOverlay` de `productividad/components/person-hours-overlay.tsx` (PH08)
 * - `PersonDetailSheet` de `talento-humano/components/person-detail-sheet.tsx` (PH09)
 *
 * 3 tabs canónicas: Información, Rendimiento, Ficha médica.
 *
 * Gating de permisos vía `panel:person-sheet.{info,performance,medical}` —
 * tabs sin permiso quedan deshabilitadas; tab activa hace fallback a la primera disponible.
 *
 * Accesibilidad heredada de `DialogShell`: focus trap, ESC, scroll-lock, aria-modal.
 *
 * @example
 * <PersonProfileDialog
 *   open={Boolean(selectedPersonId)}
 *   personId={selectedPersonId ?? ""}
 *   sourceContext={{ module: "productividad", cycleKey: "C2026-W14" }}
 *   onClose={() => setSelectedPersonId(null)}
 * />
 */
export function PersonProfileDialog({
  open,
  personId,
  sourceContext,
  defaultTab,
  onClose,
}: PersonProfileDialogProps) {
  const { data: access } = useCurrentUserAccess();
  const allowedResources = access?.allowedResources ?? [];
  const isSuperadmin = access?.isSuperadmin ?? false;
  const canSeeInfo = canAccessResource("panel:person-sheet.info", allowedResources, isSuperadmin);
  const canSeePerformance = canAccessResource("panel:person-sheet.performance", allowedResources, isSuperadmin);
  const canSeeMedical = canAccessResource("panel:person-sheet.medical", allowedResources, isSuperadmin);

  const firstAllowed: PersonProfileTab = canSeeInfo ? "informacion" : canSeePerformance ? "rendimiento" : "medica";
  const initialTab: PersonProfileTab =
    defaultTab && (
      (defaultTab === "informacion" && canSeeInfo) ||
      (defaultTab === "rendimiento" && canSeePerformance) ||
      (defaultTab === "medica" && canSeeMedical)
    )
      ? defaultTab
      : firstAllowed;

  const [tab, setTab] = useState<PersonProfileTab>(initialTab);
  const activeTab: PersonProfileTab =
    tab === "informacion" && canSeeInfo
      ? "informacion"
      : tab === "rendimiento" && canSeePerformance
        ? "rendimiento"
        : tab === "medica" && canSeeMedical
          ? "medica"
          : firstAllowed;

  const isCycleContext = sourceContext.module === "fenograma" || sourceContext.module === "productividad";
  const cycleKey = isCycleContext ? sourceContext.cycleKey : null;
  const camas30 = isCycleContext ? sourceContext.camas30 ?? null : null;

  const cycleRequest = useMemo(() => {
    if (!isCycleContext || !open || !personId || !cycleKey) return null;
    return [
      `/api/fenograma/cycle/${encodeURIComponent(cycleKey)}/hours/person/${encodeURIComponent(personId)}`,
      "No se pudo cargar la ficha de horas del personal.",
    ] as const;
  }, [isCycleContext, open, personId, cycleKey]);

  const talentoRequest = useMemo(() => {
    if (isCycleContext || !open || !personId) return null;
    return `/api/talento-humano/persona/${encodeURIComponent(personId)}`;
  }, [isCycleContext, open, personId]);

  const cycleQuery = useSWRImmutable<CycleLaborPersonDetailPayload>(cycleRequest, fetchCycleHoursPerson, {
    revalidateOnFocus: false,
  });
  const talentoQuery = useSWRImmutable<TalentoPersonProfile>(talentoRequest, fetchTalentoProfile, {
    revalidateOnFocus: false,
  });

  const isLoading = isCycleContext ? cycleQuery.isLoading : talentoQuery.isLoading;
  const error = isCycleContext ? cycleQuery.error : talentoQuery.error;
  const errorMessage = error instanceof Error ? error.message : null;

  const cyclePayload = cycleQuery.data;
  const talentoProfile = talentoQuery.data;

  const displayName = isCycleContext
    ? cyclePayload?.profile?.fullName ?? `Personal ${personId}`
    : talentoProfile?.personName ?? `Personal ${personId}`;
  const jobTitle = isCycleContext
    ? cyclePayload?.profile?.jobTitle ?? "Personal"
    : talentoProfile?.jobTitle ?? "Personal";

  const headerActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Badge variant="outline" className="rounded-full px-3 py-1">Ficha del personal</Badge>
      <Badge variant="secondary" className="rounded-full px-3 py-1">ID {personId}</Badge>
      {isCycleContext ? (
        <Badge variant="outline" className="rounded-full px-3 py-1">{cycleKey}</Badge>
      ) : null}
    </div>
  );

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title={displayName}
      description={jobTitle}
      maxWidth="max-w-7xl"
      headerActions={headerActions}
      priority="secondary"
    >
      <div className="space-y-6">
        <TabBar
          activeTab={activeTab}
          canSeeInfo={canSeeInfo}
          canSeePerformance={canSeePerformance}
          canSeeMedical={canSeeMedical}
          onChange={setTab}
        />

        {isLoading ? (
          <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Cargando ficha del personal.
          </div>
        ) : errorMessage ? (
          <div className="py-8 text-sm text-destructive">{errorMessage}</div>
        ) : (
          <TabPanel activeTab={activeTab}>
            {activeTab === "informacion" ? (
              isCycleContext ? (
                cyclePayload ? (
                  <PersonProfileInfoCanon {...mapCyclePayloadToInfoCanon(cyclePayload.profile)} />
                ) : (
                  <EmptyTab>No se encontró información para este personal en el ciclo.</EmptyTab>
                )
              ) : talentoProfile ? (
                <PersonProfileInfoCanon {...mapTalentoPayloadToInfoCanon(talentoProfile)} />
              ) : (
                <EmptyTab>No se encontró información para este personal.</EmptyTab>
              )
            ) : null}

            {activeTab === "rendimiento" ? (
              isCycleContext && cyclePayload ? (
                <PersonHoursPerformanceSection data={cyclePayload} camas30={camas30} />
              ) : !isCycleContext ? (
                <PersonProfileTalentoPerformanceSection personId={personId} />
              ) : (
                <EmptyTab>Sin datos de rendimiento para mostrar.</EmptyTab>
              )
            ) : null}

            {activeTab === "medica" ? (
              <PersonMedicalPanel personId={personId} fallbackName={displayName} />
            ) : null}
          </TabPanel>
        )}
      </div>
    </DialogShell>
  );
}

// ---------------------------------------------------------------------------
// Internal — TabBar / TabPanel / EmptyTab / TalentoInfoSection
// ---------------------------------------------------------------------------

function TabBar({
  activeTab,
  canSeeInfo,
  canSeePerformance,
  canSeeMedical,
  onChange,
}: {
  activeTab: PersonProfileTab;
  canSeeInfo: boolean;
  canSeePerformance: boolean;
  canSeeMedical: boolean;
  onChange: (tab: PersonProfileTab) => void;
}) {
  return (
    <div role="tablist" aria-label="Secciones de la ficha del personal" className="inline-flex rounded-full border border-border/60 bg-muted/22 p-1">
      <TabButton
        id="informacion"
        label="Información"
        active={activeTab === "informacion"}
        disabled={!canSeeInfo}
        onClick={() => onChange("informacion")}
      />
      <TabButton
        id="rendimiento"
        label="Rendimiento"
        active={activeTab === "rendimiento"}
        disabled={!canSeePerformance}
        onClick={() => onChange("rendimiento")}
      />
      <TabButton
        id="medica"
        label="Ficha médica"
        active={activeTab === "medica"}
        disabled={!canSeeMedical}
        onClick={() => onChange("medica")}
      />
    </div>
  );
}

function TabButton({
  id,
  label,
  active,
  disabled,
  onClick,
}: {
  id: string;
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-controls={`panel-${id}`}
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      disabled={disabled}
      title={disabled ? "Sin permiso para este panel" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        disabled
          ? "cursor-not-allowed text-muted-foreground/40"
          : active
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function TabPanel({ activeTab, children }: { activeTab: PersonProfileTab; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`} className="space-y-5">
      {children}
    </div>
  );
}

function EmptyTab({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{children}</div>;
}
