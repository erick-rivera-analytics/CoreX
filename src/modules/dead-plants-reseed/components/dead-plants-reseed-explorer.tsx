"use client";

import { startTransition, useEffect, useState } from "react";
import { ClipboardList, RefreshCcw } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import { MetricTile } from "@/shared/data-display/metric-tile";
import { DateField } from "@/shared/filters/date-field";
import { SingleSelectField } from "@/shared/filters/single-select-field";
import { DetailSection, FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { fetchJson } from "@/lib/fetch-json";
import { cn } from "@/lib/utils";
import { formatDate, formatDateLocal, formatInteger } from "@/shared/lib/format";
import { CapturePanel } from "./capture-panel";
import { DetailPanel } from "./detail-panel";
import { LoadsListPanel } from "./loads-list-panel";
import type {
  CreateCaptureResult,
  DeadPlantsReseedCaptureRow,
  DeadPlantsReseedInitialData,
  DeadPlantsReseedLoadDetail,
  DeadPlantsReseedLoadSummary,
  DeadPlantsReseedType,
  PatchRecordsResult,
} from "@/lib/dead-plants-reseed";

type ViewMode = "capture" | "detail";

const typeOptions: DeadPlantsReseedType[] = ["dead", "reseed"];
const typeLabel: Record<DeadPlantsReseedType, string> = { dead: "Plantas muertas", reseed: "Resiembras" };
const countLabel: Record<DeadPlantsReseedType, string> = { dead: "plantas muertas", reseed: "plantas resembradas" };

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function buildQuery(params: Record<string, string | null | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) searchParams.set(key, value);
  }
  return searchParams.toString();
}

const initialDate = formatDateLocal(new Date());
const initialDateFrom = formatDateLocal(addDays(new Date(), -30));

const rootFetcher = (url: string) =>
  fetchJson<DeadPlantsReseedInitialData>(url, "No se pudo cargar el modulo.");
const captureFetcher = (url: string) =>
  fetchJson<DeadPlantsReseedCaptureRow[]>(url, "No se pudieron cargar las camas del bloque.");
const loadsFetcher = (url: string) =>
  fetchJson<DeadPlantsReseedLoadSummary[]>(url, "No se pudieron cargar las cargas previas.");
const detailFetcher = (url: string) =>
  fetchJson<DeadPlantsReseedLoadDetail>(url, "No se pudo cargar el detalle de la carga.");

const emptyCaptureRows: DeadPlantsReseedCaptureRow[] = [];
const emptyLoads: DeadPlantsReseedLoadSummary[] = [];

function sumCaptureValues(rows: DeadPlantsReseedCaptureRow[], values: Record<string, number>) {
  return rows.filter((row) => !row.blocked).reduce((total, row) => total + (values[row.bedId] ?? 0), 0);
}

export function DeadPlantsReseedExplorer({
  initialData,
  initialError,
  canWrite,
}: {
  initialData: DeadPlantsReseedInitialData;
  initialError?: string | null;
  canWrite: boolean;
}) {
  const [selectedType, setSelectedType] = useState<DeadPlantsReseedType>("dead");
  const [workDate, setWorkDate] = useState(initialDate);
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDate);
  const [blockId, setBlockId] = useState(initialData.blocks[0]?.blockId ?? "");
  const [viewMode, setViewMode] = useState<ViewMode>("capture");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [captureValues, setCaptureValues] = useState<Record<string, number>>({});
  const [editValues, setEditValues] = useState<Record<string, number>>({});
  const [changeReason, setChangeReason] = useState("");
  const [isSavingCapture, setIsSavingCapture] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const { data: rootData, mutate: mutateRoot, isValidating: isRootValidating } = useSWR(
    "/api/dead-plants-reseed",
    rootFetcher,
    { fallbackData: initialData, revalidateOnFocus: false },
  );

  const blocks = rootData?.blocks ?? initialData.blocks;
  const blockOptions = blocks.map((block) => block.blockId);
  const selectedBlock = blocks.find((block) => block.blockId === blockId) ?? null;

  useEffect(() => {
    if (!blockId && blocks[0]) setBlockId(blocks[0].blockId);
  }, [blockId, blocks]);

  const captureKey = blockId && workDate
    ? `/api/dead-plants-reseed/capture?${buildQuery({ type: selectedType, workDate, blockId })}`
    : null;
  const loadsKey = `/api/dead-plants-reseed/loads?${buildQuery({
    type: selectedType,
    dateFrom,
    dateTo,
    blockId: blockId || "all",
  })}`;
  const detailKey = selectedRunId
    ? `/api/dead-plants-reseed/loads/${encodeURIComponent(selectedRunId)}?${buildQuery({ type: selectedType })}`
    : null;

  const { data: captureData, error: captureError, isLoading: captureLoading, mutate: mutateCapture } = useSWR(
    captureKey,
    captureFetcher,
    { revalidateOnFocus: false },
  );
  const captureRows = captureData ?? emptyCaptureRows;
  const { data: loadsData, error: loadsError, isLoading: loadsLoading, mutate: mutateLoads } = useSWR(
    loadsKey,
    loadsFetcher,
    { fallbackData: rootData?.latestLoads[selectedType] ?? initialData.latestLoads[selectedType], revalidateOnFocus: false },
  );
  const loads = loadsData ?? rootData?.latestLoads[selectedType] ?? emptyLoads;
  const { data: loadDetail, error: detailError, isLoading: detailLoading, mutate: mutateDetail } = useSWR(
    detailKey,
    detailFetcher,
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    setCaptureValues(Object.fromEntries(captureRows.map((row) => [row.bedId, row.value])) as Record<string, number>);
  }, [captureRows]);

  useEffect(() => {
    setEditValues(Object.fromEntries((loadDetail?.rows ?? []).map((row) => [row.eventId, row.value])) as Record<string, number>);
    setChangeReason("");
  }, [loadDetail]);

  function handleTypeChange(nextType: DeadPlantsReseedType) {
    startTransition(() => {
      setSelectedType(nextType);
      setSelectedRunId(null);
      setViewMode("capture");
    });
  }

  async function refreshAll() {
    await Promise.all([
      mutateRoot(),
      mutateCapture(),
      mutateLoads(),
      selectedRunId ? mutateDetail() : Promise.resolve(),
    ]);
  }

  async function handleSaveCapture() {
    if (!canWrite || !blockId) return;
    setIsSavingCapture(true);
    try {
      const response = await fetchJson<{ data: CreateCaptureResult }>("/api/dead-plants-reseed/capture", "No se pudo guardar la captura.", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          workDate,
          blockId,
          rows: captureRows.filter((row) => !row.blocked).map((row) => ({ bedId: row.bedId, value: captureValues[row.bedId] ?? 0 })),
        }),
      });
      toast.success(`Captura guardada: ${formatInteger(response.data.insertedCount)} camas.`);
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la captura.");
    } finally {
      setIsSavingCapture(false);
    }
  }

  async function handleSaveEdit() {
    if (!canWrite || !loadDetail) return;
    const changes = loadDetail.rows
      .filter((row) => editValues[row.eventId] !== undefined && editValues[row.eventId] !== row.value)
      .map((row) => ({ eventId: row.eventId, value: editValues[row.eventId] ?? row.value, changeReason }));

    if (changes.length === 0) {
      toast.info("No hay cambios para guardar.");
      return;
    }

    setIsSavingEdit(true);
    try {
      const response = await fetchJson<{ data: PatchRecordsResult }>("/api/dead-plants-reseed/records", "No se pudieron guardar los cambios.", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: selectedType, changes }),
      });
      toast.success(`Cambios guardados: ${formatInteger(response.data.updatedCount)} camas.`);
      await Promise.all([mutateLoads(), mutateDetail(), mutateRoot()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron guardar los cambios.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  const blockedCount = captureRows.filter((row) => row.blocked).length;
  const editableCaptureRows = captureRows.filter((row) => !row.blocked);
  const captureTotal = sumCaptureValues(captureRows, captureValues);
  const latestByType = rootData?.latestLoads ?? initialData.latestLoads;
  const latestDead = latestByType.dead[0];
  const latestReseed = latestByType.reseed[0];

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Gestión / Campo / Registros"
        title="Plantas muertas y resiembras"
        subtitle="Registro operativo por bloque. Las camas duplicadas o sin ciclo vigente se bloquean individualmente."
        icon={<ClipboardList className="size-6" aria-hidden="true" />}
        actions={(
          <Button variant="outline" onClick={refreshAll} disabled={isRootValidating}>
            <RefreshCcw className={cn("size-4", isRootValidating && "animate-spin")} aria-hidden="true" />
            Recargar
          </Button>
        )}
      >
        <FilterPanel>
          {initialError && rootData?.generatedAt === initialData.generatedAt ? (
            <div className="rounded-[18px] border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
              {initialError}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {typeOptions.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleTypeChange(type)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  selectedType === type
                    ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
              >
                {typeLabel[type]}
              </button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <DateField id="dead-reseed-work-date" label="Fecha captura" value={workDate} onChange={setWorkDate} />
            <SingleSelectField id="dead-reseed-block" label="Bloque" value={blockId} options={blockOptions} onChange={(value) => setBlockId(value === "all" ? "" : value)} emptyLabel="Selecciona bloque" />
            <DateField id="dead-reseed-from" label="Desde consulta" value={dateFrom} onChange={setDateFrom} />
            <DateField id="dead-reseed-to" label="Hasta consulta" value={dateTo} onChange={setDateTo} />
          </div>

          <KpiGrid columns={4}>
            <MetricTile label="Ultimas plantas muertas" value={latestDead ? formatDate(latestDead.workDate) : "-"} hint={latestDead ? `${latestDead.blockId} - ${formatInteger(latestDead.totalValue)}` : "Sin cargas"} />
            <MetricTile label="Ultimas resiembras" value={latestReseed ? formatDate(latestReseed.workDate) : "-"} hint={latestReseed ? `${latestReseed.blockId} - ${formatInteger(latestReseed.totalValue)}` : "Sin cargas"} />
            <MetricTile label="Bloque seleccionado" value={selectedBlock?.blockId ?? "-"} hint={selectedBlock ? `${selectedBlock.areaId} - ${formatInteger(selectedBlock.bedCount)} camas` : "Selecciona un bloque"} />
            <MetricTile label="Permiso" value={canWrite ? "Crear / editar" : "Solo consulta"} hint={canWrite ? "Rol personalizado o superadmin" : "Consulta sin escritura"} accent={canWrite ? "success" : "warning"} />
          </KpiGrid>
        </FilterPanel>
      </SectionPageShell>

      <DetailSection>
        <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
          <LoadsListPanel
            title={typeLabel[selectedType]}
            loads={loads}
            selectedRunId={selectedRunId}
            isLoading={loadsLoading}
            error={loadsError}
            onSelect={(runId) => {
              setSelectedRunId(runId);
              setViewMode("detail");
            }}
          />

          <Card className="bg-card/86">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{viewMode === "detail" ? "Detalle / edicion" : "Nueva captura"}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {viewMode === "detail"
                      ? "La edicion invalida el registro anterior y crea un nuevo registro valido."
                      : "Se insertan tambien los valores en 0. Las camas bloqueadas no se duplican."}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant={viewMode === "capture" ? "default" : "outline"} size="sm" onClick={() => setViewMode("capture")}>
                    Captura
                  </Button>
                  <Button variant={viewMode === "detail" ? "default" : "outline"} size="sm" onClick={() => setViewMode("detail")} disabled={!selectedRunId}>
                    Detalle
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {viewMode === "capture" ? (
                <CapturePanel
                  canWrite={canWrite}
                  countLabel={countLabel[selectedType]}
                  rows={captureRows}
                  values={captureValues}
                  setValues={setCaptureValues}
                  isLoading={captureLoading}
                  error={captureError}
                  blockedCount={blockedCount}
                  editableCount={editableCaptureRows.length}
                  total={captureTotal}
                  onSave={handleSaveCapture}
                  isSaving={isSavingCapture}
                />
              ) : (
                <DetailPanel
                  canWrite={canWrite}
                  countLabel={countLabel[selectedType]}
                  detail={loadDetail}
                  values={editValues}
                  setValues={setEditValues}
                  changeReason={changeReason}
                  setChangeReason={setChangeReason}
                  isLoading={detailLoading}
                  error={detailError}
                  onSave={handleSaveEdit}
                  isSaving={isSavingEdit}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </DetailSection>
    </div>
  );
}
