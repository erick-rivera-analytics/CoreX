"use client";

import useSWR from "swr";
import { fetchJson } from "@/lib/fetch-json";
import type { EmployeeFollowupPersonDetail } from "@/modules/talento-humano/seguimientos/server/types";

type Props = { personId: string; asOfDate?: string };

const fetcher = (url: string) =>
  fetchJson<EmployeeFollowupPersonDetail>(url, "No se pudo cargar el perfil.");

export function PersonQuickCard({ personId, asOfDate }: Props) {
  const date = asOfDate ?? new Date().toISOString().slice(0, 10);
  const { data, isLoading } = useSWR(
    `/api/talento-humano/seguimientos/person/${personId}?asOfDate=${date}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground animate-pulse">
        Cargando perfil...
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="rounded-lg border bg-card p-4 text-sm space-y-1">
      <p className="font-semibold text-base">{data.personName}</p>
      <p className="text-muted-foreground text-xs">ID: {data.personId}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-2 text-xs">
        {data.areaName && <><span className="text-muted-foreground">Área:</span><span>{data.areaName}</span></>}
        {data.jobTitle && <><span className="text-muted-foreground">Cargo:</span><span>{data.jobTitle}</span></>}
        {data.jobClassificationCode && <><span className="text-muted-foreground">Clasificación:</span><span>{data.jobClassificationCode}</span></>}
        {data.associatedWorkerName && <><span className="text-muted-foreground">T. social:</span><span>{data.associatedWorkerName}</span></>}
        {data.employerName && <><span className="text-muted-foreground">Empresa:</span><span>{data.employerName}</span></>}
        {data.lastEntryDate && <><span className="text-muted-foreground">Último ingreso:</span><span>{data.lastEntryDate}</span></>}
      </div>
    </div>
  );
}
