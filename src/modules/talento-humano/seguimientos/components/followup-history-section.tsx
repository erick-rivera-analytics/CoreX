"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, History } from "lucide-react";
import useSWR from "swr";

import { fetchJson } from "@/lib/fetch-json";
import { cn } from "@/lib/utils";
import { formatDate } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import {
  buildHistoryGroups,
  cleanValue,
  type HistoryAnswer,
} from "@/modules/talento-humano/seguimientos/components/followup-history-groups";
import type {
  EmployeeFollowupCatalogMap,
  EmployeeFollowupPersonDetail,
  EmployeeFollowupResponseDetail,
  EmployeeFollowupResponseSummary,
} from "@/modules/talento-humano/seguimientos/server/types";

type Props = {
  personId: string;
  currentUniqueFollowUpCode: string;
  catalogs: EmployeeFollowupCatalogMap;
};

const historyFetcher = (url: string) =>
  fetchJson<{ responses: EmployeeFollowupResponseSummary[] }>(url, "No se pudo cargar el historial.");

const detailFetcher = (url: string) =>
  fetchJson<EmployeeFollowupResponseDetail>(url, "No se pudo cargar el detalle.");

const personFetcher = (url: string) =>
  fetchJson<EmployeeFollowupPersonDetail>(url, "No se pudo cargar la persona.");

function AnswerCard({ answer }: { answer: HistoryAnswer }) {
  const value = cleanValue(answer.value);
  const personUrl = answer.personLookup && value
    ? `/api/talento-humano/seguimientos/person/${encodeURIComponent(value)}?asOfDate=${encodeURIComponent(answer.personLookupAsOfDate?.slice(0, 10) ?? "")}`
    : null;
  const { data: person } = useSWR(personUrl, personFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  if (!value) return null;
  const displayValue = person?.personName ? `${person.personName} · ${value}` : value;

  return (
    <div
      className={cn(
        "rounded-[14px] border border-border/60 bg-background/70 px-3 py-2 shadow-sm",
        (answer.wide || answer.text) && "sm:col-span-2",
      )}
    >
      <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {answer.label}
      </p>
      <p
        className={cn(
          "mt-1 whitespace-pre-wrap break-words text-xs font-medium leading-relaxed text-foreground",
          !answer.text && "max-w-full",
        )}
      >
        {displayValue}
      </p>
    </div>
  );
}

function HistoryItemDetail({ eventId, catalogs }: { eventId: string; catalogs: EmployeeFollowupCatalogMap }) {
  const { data, isLoading, error } = useSWR(
    `/api/talento-humano/seguimientos/responses/${encodeURIComponent(eventId)}`,
    detailFetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);

  if (isLoading) {
    return <p className="mt-2 text-center text-xs text-muted-foreground">Cargando…</p>;
  }
  if (error) {
    return <p className="mt-2 text-center text-xs text-destructive/70">No se pudo cargar el detalle.</p>;
  }
  if (!data) return null;

  const groups = buildHistoryGroups(data, catalogs);
  if (groups.length === 0) {
    return (
      <div className="mt-2 rounded-[16px] border border-dashed border-border/70 bg-background/50 px-3 py-4 text-center text-xs text-muted-foreground">
        Sin respuestas registradas para este seguimiento.
      </div>
    );
  }

  const selectedGroup = groups.find((group) => group.key === selectedGroupKey) ?? groups[0];
  const visibleAnswers = selectedGroup.answers.filter((answer) => cleanValue(answer.value));

  return (
    <div className="mt-3 space-y-3">
      <div className="flex min-w-0 flex-wrap gap-1.5">
        {groups.map((group) => {
          const active = group.key === selectedGroup.key;
          return (
            <button
              key={group.key}
              type="button"
              title={group.title}
              className={cn(
                "max-w-full rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors sm:max-w-[210px]",
                active
                  ? "border-foreground bg-foreground text-background shadow-sm"
                  : "border-border/70 bg-background/70 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
              onClick={() => setSelectedGroupKey(group.key)}
            >
              <span className="block truncate">{group.title}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-[18px] border border-border/60 bg-muted/20 p-3">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">{selectedGroup.title}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              {selectedGroup.description}
            </p>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            {visibleAnswers.length} respuesta{visibleAnswers.length === 1 ? "" : "s"}
          </Badge>
        </div>

        <div className="grid gap-1.5 sm:grid-cols-2">
          {visibleAnswers.map((answer) => (
            <AnswerCard key={`${selectedGroup.key}-${answer.label}`} answer={answer} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function FollowupHistorySection({ personId, currentUniqueFollowUpCode, catalogs }: Props) {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data } = useSWR(
    open ? `/api/talento-humano/seguimientos/responses?personId=${encodeURIComponent(personId)}` : null,
    historyFetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
  );

  const responses = (data?.responses ?? []).filter(
    (response) => response.uniqueFollowUpCode !== currentUniqueFollowUpCode,
  );

  return (
    <div className="rounded-[20px] border border-border/60 bg-muted/30">
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-[20px] px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/40"
        onClick={() => setOpen((value) => !value)}
      >
        <div className="flex items-center gap-2 text-muted-foreground">
          <History className="size-4" />
          <span>Historial de seguimientos</span>
          {open && data ? (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold">
              {responses.length}
            </span>
          ) : null}
        </div>
        {open
          ? <ChevronUp className="size-4 text-muted-foreground" />
          : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>

      {open ? (
        <div className="border-t border-border/50 px-4 pb-4 pt-3">
          {!data ? (
            <p className="text-center text-xs text-muted-foreground">Cargando historial…</p>
          ) : responses.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground">Sin seguimientos previos registrados.</p>
          ) : (
            <div className="space-y-2">
              {responses.map((response) => {
                const isExpanded = expandedId === response.eventId;
                return (
                  <div key={response.eventId} className="rounded-[16px] border border-border/50 bg-card/60 px-3 py-2.5">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between"
                      onClick={() => setExpandedId(isExpanded ? null : response.eventId)}
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-medium text-foreground">
                          {formatDate(response.followUpDate.slice(0, 10))}
                        </span>
                        <Badge variant="outline" className="text-[10px]">{response.followupRouteCode}</Badge>
                        {response.responseVersion > 1
                          ? <Badge variant="secondary" className="text-[10px]">v{response.responseVersion}</Badge>
                          : null}
                      </div>
                      {isExpanded
                        ? <ChevronUp className="size-3.5 shrink-0 text-muted-foreground" />
                        : <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />}
                    </button>
                    {isExpanded ? (
                      <HistoryItemDetail eventId={response.eventId} catalogs={catalogs} />
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
