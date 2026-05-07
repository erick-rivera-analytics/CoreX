"use client";

import { useMemo, useState } from "react";
import { LoaderCircle, Search, UsersRound } from "lucide-react";
import useSWR from "swr";

import { canAccessResource } from "@/lib/access-control";
import { fetchJson } from "@/lib/fetch-json";
import type { CollaboratorDetailPayload, CollaboratorSearchRow } from "@/lib/talento-humano-colaboradores";
import { useCurrentUserAccess } from "@/hooks/use-current-user-access";
import {
  HeaderCard,
  TabContent,
  initials,
  type CollaboratorTabKey,
} from "@/modules/talento-humano/components/colaboradores-sections";
import { EmptyState } from "@/shared/data-display/empty-state";
import { FilterPanel } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { formatInteger } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

const TAB_LABELS: Record<CollaboratorTabKey, string> = {
  basic: "Información básica",
  performance: "Rendimientos",
  medical: "Ficha médica",
  absenteeism: "Ausentismo",
  exits: "Salidas",
  followups: "Seguimientos",
};

const TAB_PERMISSION: Partial<Record<CollaboratorTabKey, string>> = {
  basic: "panel:tthh.collaborators.basic",
  performance: "panel:tthh.collaborators.performance",
  medical: "panel:tthh.collaborators.medical",
  absenteeism: "panel:tthh.collaborators.absenteeism",
  exits: "panel:tthh.collaborators.exits",
  followups: "panel:tthh.collaborators.followups",
};

function searchFetcher(url: string) {
  return fetchJson<{ results: CollaboratorSearchRow[] }>(url, "No se pudo buscar colaboradores.");
}

function detailFetcher(url: string) {
  return fetchJson<CollaboratorDetailPayload>(url, "No se pudo cargar el colaborador.");
}

function hasPermission(resource: string | undefined, allowedResources: string[], isSuperadmin: boolean) {
  return !resource || canAccessResource(resource, allowedResources, isSuperadmin);
}

function buildSearchUrl(query: string) {
  const params = new URLSearchParams();
  params.set("q", query);
  params.set("area", "all");
  params.set("status", "all");
  return `/api/talento-humano/colaboradores/search?${params.toString()}`;
}

export function TalentoColaboradoresPage() {
  const { data: access } = useCurrentUserAccess();
  const allowedResources = access?.allowedResources ?? [];
  const isSuperadmin = access?.isSuperadmin ?? false;

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CollaboratorSearchRow | null>(null);
  const [tab, setTab] = useState<CollaboratorTabKey>("basic");

  const visibleTabs = (Object.keys(TAB_LABELS) as CollaboratorTabKey[]).filter((key) =>
    hasPermission(TAB_PERMISSION[key], allowedResources, isSuperadmin),
  );
  const activeTab = visibleTabs.includes(tab) ? tab : visibleTabs[0] ?? "basic";

  const searchUrl = query.trim().length >= 2 ? buildSearchUrl(query) : null;
  const { data: searchData, isLoading: searching } = useSWR(searchUrl, searchFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
  });
  const rows = useMemo(() => searchData?.results ?? [], [searchData?.results]);

  const detailUrl = selected ? `/api/talento-humano/colaboradores/${encodeURIComponent(selected.personId)}` : null;
  const { data: detail, isLoading: loadingDetail } = useSWR(detailUrl, detailFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Analítica / Talento Humano / Explorador"
        title="Colaboradores"
        subtitle="Explorador integral por colaborador con permisos granulares por sección y dato sensible."
        icon={<UsersRound className="size-6" aria-hidden="true" />}
      >
        <FilterPanel>
          <div className="grid gap-3 lg:grid-cols-[minmax(320px,1fr)_auto]">
            <SearchControl
              query={query}
              rows={rows}
              searching={searching}
              selectedPersonId={selected?.personId}
              onQueryChange={(value) => {
                setQuery(value);
                if (selected && value.trim() !== selected.personName.trim()) {
                  setSelected(null);
                }
              }}
              onSelect={(row) => {
                setSelected(row);
                setQuery(row.personName);
                setTab("basic");
              }}
            />
            <div className="flex items-end">
              <Button type="button" variant="outline" className="h-11 rounded-[16px]" onClick={() => { setQuery(""); setSelected(null); }}>
                Limpiar
              </Button>
            </div>
          </div>
        </FilterPanel>
      </SectionPageShell>

      <div className="min-w-0 space-y-4">
        {!selected ? (
          <EmptyState label="Busque por nombre, código o cédula y seleccione un colaborador." />
        ) : loadingDetail ? (
          <LoadingLine label="Cargando ficha del colaborador." />
        ) : detail ? (
          <>
            <HeaderCard detail={detail} />
            <div className="flex flex-wrap gap-2 rounded-[22px] border border-border/60 bg-card/80 p-2">
              {visibleTabs.map((key) => (
                <Button key={key} type="button" variant={activeTab === key ? "default" : "ghost"} size="sm" className="rounded-full" onClick={() => setTab(key)}>
                  {TAB_LABELS[key]}
                </Button>
              ))}
            </div>
            <TabContent tab={activeTab} detail={detail} />
          </>
        ) : (
          <EmptyState label="No se pudo cargar este colaborador." />
        )}
      </div>
    </div>
  );
}

function SearchControl({
  query,
  rows,
  searching,
  selectedPersonId,
  onQueryChange,
  onSelect,
}: {
  query: string;
  rows: CollaboratorSearchRow[];
  searching: boolean;
  selectedPersonId?: string;
  onQueryChange: (value: string) => void;
  onSelect: (row: CollaboratorSearchRow) => void;
}) {
  const showDropdown = query.trim().length >= 2 && selectedPersonId === undefined;

  return (
    <div className="relative space-y-2">
      <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Buscar colaborador</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Nombre, código o cédula..." className="h-11 pl-9" />
      </div>
      <p className="text-xs text-muted-foreground">Ej.: Rivera Erick, 2816 o 010...</p>
      {showDropdown ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
          <div className="border-b border-border/50 px-4 py-3 text-xs text-muted-foreground">
            {searching ? "Buscando..." : `${formatInteger(rows.length)} coincidencia(s)`}
          </div>
          <div className="max-h-[360px] overflow-y-auto p-2">
            {searching ? <LoadingLine label="Buscando colaboradores." /> : null}
            {!searching && rows.length === 0 ? <EmptyState label="Sin coincidencias." /> : null}
            {rows.map((row) => (
              <ResultOption key={row.personId} row={row} onSelect={onSelect} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ResultOption({ row, onSelect }: { row: CollaboratorSearchRow; onSelect: (row: CollaboratorSearchRow) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(row)}
      className="w-full rounded-[18px] border border-transparent px-4 py-3 text-left transition hover:border-primary/30 hover:bg-muted/40"
    >
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold text-foreground">{initials(row.personName)}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">{row.personName}</p>
            <Badge variant={row.isActive ? "success" : "danger"}>{row.isActive ? "Activo" : "Pasivo"}</Badge>
          </div>
          <p className="mt-1 text-xs opacity-75">ID {row.personId} · {row.nationalId ?? "sin cédula"}</p>
          <p className="mt-1 truncate text-xs opacity-75">{row.areaName ?? row.areaId ?? "Sin área"} · {row.jobTitle ?? "Sin cargo"}</p>
        </div>
      </div>
    </button>
  );
}

function LoadingLine({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] border border-border/60 bg-card/80 px-4 py-4 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}
