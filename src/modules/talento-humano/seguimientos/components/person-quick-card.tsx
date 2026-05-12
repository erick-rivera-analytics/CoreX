"use client";

import type { ReactNode } from "react";
import useSWR from "swr";
import { BriefcaseBusiness, IdCard, MapPin, UserRound } from "lucide-react";

import { fetchJson } from "@/lib/fetch-json";
import { formatDate, localDateString } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import type { EmployeeFollowupPersonDetail } from "@/modules/talento-humano/seguimientos/server/types";

type Props = { personId: string; asOfDate?: string };

const fetcher = (url: string) =>
  fetchJson<EmployeeFollowupPersonDetail>(url, "No se pudo cargar el perfil.");

export function PersonQuickCard({ personId, asOfDate }: Props) {
  const date = asOfDate ?? localDateString();
  const { data, isLoading } = useSWR(
    `/api/talento-humano/seguimientos/person/${personId}?asOfDate=${date}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  if (isLoading) {
    return (
      <div className="rounded-[20px] border border-border/70 bg-background/80 p-4 text-sm text-muted-foreground animate-pulse">
        Cargando perfil…
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="rounded-[20px] border border-border/70 bg-background/80 p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{data.personName}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1">
              <IdCard className="size-3" />
              {data.personId}
            </Badge>
            {data.jobClassificationCode ? <Badge variant="secondary">{data.jobClassificationCode}</Badge> : null}
          </div>
        </div>
        <div className="rounded-full bg-slate-900/10 p-2 text-slate-700 dark:bg-slate-900/20 dark:text-white">
          <UserRound className="size-4" aria-hidden="true" />
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
        <InfoRow icon={<MapPin className="size-3.5" />} label="Área" value={data.areaName ?? data.areaGeneral} />
        <InfoRow icon={<BriefcaseBusiness className="size-3.5" />} label="Cargo" value={data.jobTitle} />
        <InfoRow icon={<UserRound className="size-3.5" />} label="T. social" value={data.associatedWorkerName} />
        <InfoRow label="Último ingreso" value={data.lastEntryDate ? formatDate(data.lastEntryDate.slice(0, 10)) : null} />
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value?: string | null;
}) {
  if (!value) return null;

  return (
    <div className="min-w-0 rounded-[14px] border border-border/60 bg-card/70 px-3 py-2">
      <p className="flex items-center gap-1.5 text-muted-foreground">
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        {label}
      </p>
      <p className="mt-1 truncate font-medium text-foreground">{value}</p>
    </div>
  );
}
