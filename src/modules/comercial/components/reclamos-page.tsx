"use client";

import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Camera, CheckSquare, ClipboardList, RefreshCcw, Save, Search, Square, X } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import useSWR from "swr";

import {
  type CommercialClaimAttachmentRecord,
  type CommercialClaimDetail,
  type CommercialClaimFormInput,
  type CommercialClaimModuleData,
  type CommercialClaimOption,
  type CommercialClaimRecord,
  type CommercialClaimScope,
} from "@/lib/comercial-reclamos";
import { fetchJson } from "@/lib/fetch-json";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { formatDateTime } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const API_ENDPOINT = "/api/comercial/reclamos";

type ModuleTab = "registration" | "approvals" | "applications";
type ClaimFormErrors = Partial<Record<keyof CommercialClaimFormInput, string>>;

type SearchableOption = CommercialClaimOption & {
  scope?: CommercialClaimScope | "all";
  parentProblemId?: string | null;
};

const EMPTY_FORM: CommercialClaimFormInput = {
  claimScope: "quality",
  creditNoteApplicability: "credit-note",
  customerId: "",
  commercializerId: "",
  accountExecutiveId: "",
  farmId: "",
  varietyId: "",
  processDestinationId: "",
  processNotApplicable: false,
  problemFamilyId: null,
  problemId: "",
  referenceOrderNumber: null,
  referenceInvoiceNumber: null,
  eventDate: null,
  subject: "",
  description: null,
};

const TAB_OPTIONS: Array<{ key: ModuleTab; label: string }> = [
  { key: "registration", label: "Registro" },
  { key: "approvals", label: "Aprobaciones" },
  { key: "applications", label: "Aplicaciones" },
];

const claimModuleFetcher = (url: string) =>
  fetchJson<CommercialClaimModuleData>(url, "No se pudo cargar el modulo de reclamos.");

function claimScopeLabel(scope: CommercialClaimScope) {
  return scope === "quality" ? "Calidad" : "Comercial";
}

function statusTone(statusKey: CommercialClaimRecord["statusKey"]) {
  if (statusKey === "pending-approval") return "secondary";
  if (statusKey === "pending-application") return "outline";
  if (statusKey === "applied") return "default";
  if (statusKey === "rejected") return "danger";
  return "outline";
}

function buildOptionLabel(option: CommercialClaimOption) {
  return option.meta ? `${option.label} · ${option.meta}` : option.label;
}

function matchesOption(option: SearchableOption, search: string) {
  const normalized = search.trim().toLowerCase();
  if (!normalized) return true;

  return [option.label, option.meta].some((value) =>
    String(value ?? "").toLowerCase().includes(normalized),
  );
}

function SearchableSelectField({
  fieldId,
  label,
  value,
  options,
  placeholder,
  emptyText,
  helperText,
  onChange,
  onClear,
  showSuggestionsOnFocus = false,
}: {
  fieldId: string;
  label: string;
  value: string | null;
  options: SearchableOption[];
  placeholder: string;
  emptyText: string;
  helperText?: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  showSuggestionsOnFocus?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    return options.filter((option) => matchesOption(option, search)).slice(0, 8);
  }, [options, search]);

  const visibleOptions = useMemo(() => {
    if (search.trim().length > 0) {
      return filteredOptions;
    }

    if (showSuggestionsOnFocus && isFocused) {
      return options.slice(0, 8);
    }

    return [];
  }, [filteredOptions, isFocused, options, search, showSuggestionsOnFocus]);

  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId}>{label}</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={fieldId}
          className="rounded-xl pl-10"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            window.setTimeout(() => setIsFocused(false), 120);
          }}
          placeholder={placeholder}
        />
      </div>

      {selectedOption ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[16px] border border-border/70 bg-background px-3 py-2 text-sm">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {selectedOption.meta ? (
              <Badge variant="outline" className="rounded-full px-3 py-1 font-mono">
                {selectedOption.meta}
              </Badge>
            ) : null}
            <span className="font-medium">{selectedOption.label}</span>
          </div>
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="ml-auto inline-flex items-center rounded-full border border-border/70 p-1 text-muted-foreground transition-colors hover:border-slate-300 hover:text-slate-900"
              aria-label={`Quitar ${label.toLowerCase()} seleccionado`}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
        {visibleOptions.length ? visibleOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              setSearch("");
              onChange(option.value);
            }}
            className="flex w-full items-center justify-between rounded-[16px] border border-border/70 bg-background/80 px-3 py-2 text-left text-sm transition-colors hover:border-slate-300"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{option.label}</p>
              {option.meta ? <p className="truncate text-xs text-muted-foreground">{option.meta}</p> : null}
            </div>
            {value === option.value ? (
              <CheckSquare className="size-4 shrink-0 text-slate-800" />
            ) : (
              <Square className="size-4 shrink-0 text-muted-foreground" />
            )}
          </button>
        )) : (
          search.trim().length >= 1 || (showSuggestionsOnFocus && isFocused) ? (
          <div className="rounded-[16px] border border-dashed border-border/70 bg-background/80 px-3 py-4 text-center text-sm text-muted-foreground">
            {emptyText}
          </div>
          ) : null
        )}
      </div>

      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
    </div>
  );
}

function QueueCard({
  record,
  actions,
  onOpenDetail,
}: {
  record: CommercialClaimRecord;
  actions?: ReactNode;
  onOpenDetail?: () => void;
}) {
  return (
    <div
      role={onOpenDetail ? "button" : undefined}
      tabIndex={onOpenDetail ? 0 : undefined}
      onClick={onOpenDetail}
      onKeyDown={(event) => {
        if (!onOpenDetail) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenDetail();
        }
      }}
      className="w-full rounded-[20px] border border-border/70 bg-background/80 p-4 text-left transition-colors hover:border-slate-300"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full px-3 py-1">
              {record.claimCode}
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">
              {claimScopeLabel(record.claimScope)}
            </Badge>
            <Badge variant={statusTone(record.statusKey)} className="rounded-full px-3 py-1">
              {record.statusLabel}
            </Badge>
            {record.attachmentCount > 0 ? (
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {record.attachmentCount} foto{record.attachmentCount === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </div>
          <div>
            <p className="text-sm font-semibold">{record.subject}</p>
            <p className="text-xs text-muted-foreground">
              {record.customerName ?? "Sin cliente"} · {record.problemName ?? "Sin problema"}
            </p>
          </div>
        </div>
        {actions ? (
          // Wrapper sin rol semántico: los handlers solo paran la propagación
          // del click del card padre. `role="presentation"` le dice al a11y
          // que ignore este nodo (no es un control).
          <div
            role="presentation"
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {actions}
          </div>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div className="rounded-[16px] border border-border/70 bg-background px-3 py-2 text-xs text-muted-foreground">
          Ejecutivo: {record.accountExecutiveName ?? "-"}
        </div>
        <div className="rounded-[16px] border border-border/70 bg-background px-3 py-2 text-xs text-muted-foreground">
          Proceso: {record.processDestinationName ?? "-"}
        </div>
        <div className="rounded-[16px] border border-border/70 bg-background px-3 py-2 text-xs text-muted-foreground">
          Finca: {record.farmName ?? "-"} · Variedad: {record.varietyName ?? "-"}
        </div>
        <div className="rounded-[16px] border border-border/70 bg-background px-3 py-2 text-xs text-muted-foreground">
          Creado: {formatDateTime(record.createdAt)}
        </div>
      </div>

      {record.description ? (
        <div className="mt-3 rounded-[16px] border border-border/70 bg-background px-3 py-2 text-xs text-muted-foreground">
          {record.description}
        </div>
      ) : null}
    </div>
  );
}

export function ComercialReclamosPage({
  initialData,
  initialError,
}: {
  initialData: CommercialClaimModuleData;
  initialError?: string | null;
}) {
  const [activeTab, setActiveTab] = useState<ModuleTab>("registration");
  const [formValues, setFormValues] = useState<CommercialClaimFormInput>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<ClaimFormErrors>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingClaimId, setIsProcessingClaimId] = useState<string | null>(null);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const { data, isValidating, mutate } = useSWR(
    API_ENDPOINT,
    claimModuleFetcher,
    {
      fallbackData: initialData,
      revalidateOnFocus: false,
      dedupingInterval: 10_000,
      onError: (error) => toast.error(error?.message || "No se pudo cargar el modulo de reclamos."),
    },
  );

  const { data: selectedClaimDetail, isLoading: isLoadingClaimDetail } = useSWR(
    selectedClaimId ? `${API_ENDPOINT}/${encodeURIComponent(selectedClaimId)}` : null,
    (url: string) => fetchJson<CommercialClaimDetail>(url, "No se pudo cargar el detalle del reclamo."),
    {
      revalidateOnFocus: false,
      dedupingInterval: 10_000,
    },
  );

  const moduleData = data ?? initialData;
  const selectedExecutive = useMemo(
    () => moduleData.options.accountExecutives.find((item) => item.value === formValues.accountExecutiveId) ?? null,
    [formValues.accountExecutiveId, moduleData.options.accountExecutives],
  );

  const filteredFamilyOptions = useMemo(
    () => moduleData.options.problemFamilies.filter((item) => item.scope === formValues.claimScope || item.scope === "all"),
    [formValues.claimScope, moduleData.options.problemFamilies],
  );

  const filteredProblemOptions = useMemo(() => {
    const scoped = moduleData.options.problems.filter((item) => item.scope === formValues.claimScope || item.scope === "all");
    if (!formValues.problemFamilyId) return scoped;
    const matchingChildren = scoped.filter((item) => item.parentProblemId === formValues.problemFamilyId);
    return matchingChildren.length > 0 ? matchingChildren : scoped;
  }, [formValues.claimScope, formValues.problemFamilyId, moduleData.options.problems]);

  const selectedProblemFamily = useMemo(
    () => moduleData.options.problemFamilies.find((item) => item.value === formValues.problemFamilyId) ?? null,
    [formValues.problemFamilyId, moduleData.options.problemFamilies],
  );

  function updateField<Key extends keyof CommercialClaimFormInput>(
    field: Key,
    value: CommercialClaimFormInput[Key],
  ) {
    setFormErrors((current) => ({
      ...current,
      [field]: undefined,
    }));

    setFormValues((current) => ({
      ...(field === "processNotApplicable"
        ? {
            ...current,
            processNotApplicable: Boolean(value),
            processDestinationId: value ? "" : current.processDestinationId,
          }
        : field === "processDestinationId"
          ? {
              ...current,
              processDestinationId: value as CommercialClaimFormInput["processDestinationId"],
              processNotApplicable: false,
            }
          : {
              ...current,
              [field]: value,
            }),
    } as CommercialClaimFormInput));
  }

  function resetForm() {
    setFormValues(EMPTY_FORM);
    setFormErrors({});
    setPhotoFile(null);
  }

  function validateForm(values: CommercialClaimFormInput): ClaimFormErrors {
    const errors: ClaimFormErrors = {};

    if (!values.customerId.trim()) errors.customerId = "Debes seleccionar un cliente.";
    if (!values.commercializerId.trim()) errors.commercializerId = "Debes seleccionar una comercializadora.";
    if (!values.accountExecutiveId.trim()) errors.accountExecutiveId = "Debes seleccionar un ejecutivo de venta.";
    if (!values.farmId.trim()) errors.farmId = "Debes seleccionar una finca.";
    if (!values.varietyId.trim()) errors.varietyId = "Debes seleccionar una variedad.";
    if (!values.processNotApplicable && !String(values.processDestinationId ?? "").trim()) {
      errors.processDestinationId = "Debes seleccionar un proceso o marcar no aplica.";
    }
    if (!String(values.problemFamilyId ?? "").trim()) errors.problemFamilyId = "Debes seleccionar un tipo de problema.";
    if (!values.problemId.trim()) errors.problemId = "Debes seleccionar un problema.";

    const orderNumber = (values.referenceOrderNumber ?? "").trim();
    const invoiceNumber = (values.referenceInvoiceNumber ?? "").trim();
    const eventDate = (values.eventDate ?? "").trim();

    if (!/^\d{8}$/.test(orderNumber)) {
      errors.referenceOrderNumber = "El número de pedido debe tener exactamente 8 dígitos.";
    }

    if (!/^\d{7}$/.test(invoiceNumber)) {
      errors.referenceInvoiceNumber = "La factura comercializadora debe tener exactamente 7 dígitos.";
    }

    if (!eventDate) {
      errors.eventDate = "Debes registrar la fecha del caso.";
    }

    return errors;
  }

  async function uploadClaimPhoto(claimId: string) {
    if (!photoFile) {
      return null;
    }

    const payload = new FormData();
    payload.append("photo", photoFile);

    return fetchJson<{ data: CommercialClaimAttachmentRecord }>(
      `${API_ENDPOINT}/${encodeURIComponent(claimId)}/photo`,
      "No se pudo guardar la foto del reclamo.",
      {
        method: "POST",
        body: payload,
      },
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateForm(formValues);
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Completa todos los campos obligatorios antes de guardar.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: CommercialClaimFormInput = {
        ...formValues,
        referenceOrderNumber: formValues.referenceOrderNumber?.trim() || null,
        referenceInvoiceNumber: formValues.referenceInvoiceNumber?.trim() || null,
        eventDate: formValues.eventDate?.trim() || null,
        subject: formValues.subject.trim(),
        description: formValues.description?.trim() || null,
      };

      const response = await fetchJson<CommercialClaimModuleData>(
        API_ENDPOINT,
        "No se pudo registrar el reclamo.",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (photoFile && response.lastCreatedClaimId) {
        try {
          await uploadClaimPhoto(response.lastCreatedClaimId);
          await mutate();
          toast.success("Reclamo registrado y foto guardada correctamente.");
        } catch (photoError) {
          await mutate();
          toast.warning(
            photoError instanceof Error
              ? `Reclamo registrado, pero la foto no se pudo guardar: ${photoError.message}`
              : "Reclamo registrado, pero la foto no se pudo guardar.",
          );
        }
      } else {
        await mutate(response, false);
        toast.success("Reclamo registrado correctamente.");
      }

      resetForm();
      setActiveTab("registration");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar el reclamo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function processApproval(claimId: string, decision: "approve" | "reject") {
    setIsProcessingClaimId(claimId);
    try {
      const response = await fetchJson<CommercialClaimModuleData>(
        `${API_ENDPOINT}/${encodeURIComponent(claimId)}/approval`,
        "No se pudo procesar la aprobacion.",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ decision }),
        },
      );

      await mutate(response, false);
      toast.success(decision === "approve" ? "Reclamo aprobado correctamente." : "Reclamo rechazado correctamente.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo procesar la aprobacion.");
    } finally {
      setIsProcessingClaimId(null);
    }
  }

  async function processApplication(claimId: string) {
    setIsProcessingClaimId(claimId);
    try {
      const response = await fetchJson<CommercialClaimModuleData>(
        `${API_ENDPOINT}/${encodeURIComponent(claimId)}/apply`,
        "No se pudo aplicar el reclamo.",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ note: null }),
        },
      );

      await mutate(response, false);
      toast.success("Reclamo aplicado correctamente.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo aplicar el reclamo.");
    } finally {
      setIsProcessingClaimId(null);
    }
  }

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Gestion / Comercial / Reclamos"
        title="Reclamos"
        subtitle="Modulo transaccional para registrar reclamos por Calidad o Comercial, aprobar las notas de credito y aplicar los casos aprobados."
        icon={<ClipboardList className="size-5" aria-hidden="true" />}
        actions={(
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => {
              void mutate();
            }}
          >
            <RefreshCcw className={isValidating ? "size-4 animate-spin" : "size-4"} />
            Recargar
          </Button>
        )}
      >
        <FilterPanel>
          <KpiGrid>
            <MetricTile label="Registros" value={String(moduleData.summary.totalClaims)} hint="Total de reclamos ya cargados en la base transaccional." />
            <MetricTile label="Pendientes aprobacion" value={String(moduleData.summary.pendingApprovals)} hint="Solo reclamos con nota de credito." />
            <MetricTile label="Pendientes aplicacion" value={String(moduleData.summary.pendingApplications)} hint="Aprobados y listos para aplicar." />
            <MetricTile label="Alertas" value={String(moduleData.summary.alertsOnly)} hint="Reclamos sin nota de credito, cerrados como alerta." />
          </KpiGrid>

          {initialError ? (
            <div className="rounded-[24px] border border-slate-300/60 bg-slate-500/10 px-4 py-3 text-sm text-slate-950 dark:text-slate-100">
              {initialError}
            </div>
          ) : null}
        </FilterPanel>
      </SectionPageShell>

      <div className="flex flex-wrap gap-2">
        {TAB_OPTIONS.map((tab) => (
          <Button
            key={tab.key}
            type="button"
            variant={activeTab === tab.key ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "registration" ? (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="starter-panel border-border/70 bg-card/84">
            <CardHeader>
              <CardTitle className="text-lg">Registro de reclamo</CardTitle>
              <CardDescription>
                Aqui defines si el reclamo corresponde a Calidad o Comercial. Si no aplica nota de credito, el registro se conserva como alerta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-6" onSubmit={onSubmit}>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="claim-scope">Reclamo por</Label>
                    <select
                      id="claim-scope"
                      className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                      value={formValues.claimScope}
                      onChange={(event) => {
                        updateField("claimScope", event.target.value as CommercialClaimScope);
                        updateField("problemFamilyId", null);
                        updateField("problemId", "");
                      }}
                    >
                      <option value="quality">Calidad</option>
                      <option value="commercial">Comercial</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Aplica nota de credito</Label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm">
                        <button
                          type="button"
                          onClick={() => updateField("creditNoteApplicability", "credit-note")}
                          className="text-left"
                        >
                          {formValues.creditNoteApplicability === "credit-note" ? (
                            <CheckSquare className="size-4 text-slate-800" />
                          ) : (
                            <Square className="size-4 text-muted-foreground" />
                          )}
                        </button>
                        <span>Si aplica</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <button
                          type="button"
                          onClick={() => updateField("creditNoteApplicability", "not-applicable")}
                          className="text-left"
                        >
                          {formValues.creditNoteApplicability === "not-applicable" ? (
                            <CheckSquare className="size-4 text-slate-800" />
                          ) : (
                            <Square className="size-4 text-muted-foreground" />
                          )}
                        </button>
                        <span>No aplica</span>
                      </label>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <SearchableSelectField
                      fieldId="claim-customer"
                      label="Cliente *"
                      value={formValues.customerId}
                      options={moduleData.options.customers}
                      placeholder="Buscar por nombre o codigo…"
                      emptyText="No hay clientes que coincidan con el filtro."
                      onChange={(value) => updateField("customerId", value)}
                      onClear={() => updateField("customerId", "")}
                      showSuggestionsOnFocus
                    />
                    {formErrors.customerId ? <p className="mt-2 text-xs text-destructive">{formErrors.customerId}</p> : null}
                  </div>

                  <div className="md:col-span-2">
                    <SearchableSelectField
                      fieldId="claim-commercializer"
                      label="Comercializadora *"
                      value={formValues.commercializerId}
                      options={moduleData.options.commercializers}
                      placeholder="Buscar por nombre o codigo…"
                      emptyText="No hay comercializadoras que coincidan con el filtro."
                      onChange={(value) => updateField("commercializerId", value)}
                      onClear={() => updateField("commercializerId", "")}
                      showSuggestionsOnFocus
                    />
                    {formErrors.commercializerId ? <p className="mt-2 text-xs text-destructive">{formErrors.commercializerId}</p> : null}
                  </div>

                  <div className="md:col-span-2">
                    <SearchableSelectField
                      fieldId="claim-executive"
                      label="Ejecutivo de venta *"
                      value={formValues.accountExecutiveId}
                      options={moduleData.options.accountExecutives}
                      placeholder="Buscar por codigo, nombre o correo…"
                      emptyText="No hay ejecutivos que coincidan con el filtro."
                      helperText={selectedExecutive?.meta ? `Codigo seleccionado: ${selectedExecutive.meta}` : undefined}
                      onChange={(value) => updateField("accountExecutiveId", value)}
                      onClear={() => updateField("accountExecutiveId", "")}
                      showSuggestionsOnFocus
                    />
                    {formErrors.accountExecutiveId ? <p className="mt-2 text-xs text-destructive">{formErrors.accountExecutiveId}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="claim-farm">Finca *</Label>
                    <select
                      id="claim-farm"
                      className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                      value={formValues.farmId}
                      onChange={(event) => updateField("farmId", event.target.value)}
                    >
                      <option value="">Selecciona una finca</option>
                      {moduleData.options.farms.map((option) => (
                        <option key={option.value} value={option.value}>{buildOptionLabel(option)}</option>
                      ))}
                    </select>
                    {formErrors.farmId ? <p className="text-xs text-destructive">{formErrors.farmId}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="claim-variety">Variedad *</Label>
                    <select
                      id="claim-variety"
                      className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                      value={formValues.varietyId}
                      onChange={(event) => updateField("varietyId", event.target.value)}
                    >
                      <option value="">Selecciona una variedad</option>
                      {moduleData.options.varieties.map((option) => (
                        <option key={option.value} value={option.value}>{buildOptionLabel(option)}</option>
                      ))}
                    </select>
                    {formErrors.varietyId ? <p className="text-xs text-destructive">{formErrors.varietyId}</p> : null}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="claim-process">Proceso *</Label>
                    <select
                      id="claim-process"
                      className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                      value={formValues.processDestinationId ?? ""}
                      disabled={Boolean(formValues.processNotApplicable)}
                      onChange={(event) => updateField("processDestinationId", event.target.value)}
                    >
                      <option value="">Selecciona un proceso</option>
                      {moduleData.options.destinations.map((option) => (
                        <option key={option.value} value={option.value}>{buildOptionLabel(option)}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-sm">
                      <button
                        type="button"
                        onClick={() => updateField("processNotApplicable", !formValues.processNotApplicable)}
                        className="text-left"
                      >
                        {formValues.processNotApplicable ? (
                          <CheckSquare className="size-4 text-slate-800" />
                        ) : (
                          <Square className="size-4 text-muted-foreground" />
                        )}
                      </button>
                      <span>No aplica</span>
                    </label>
                    {formErrors.processDestinationId ? <p className="text-xs text-destructive">{formErrors.processDestinationId}</p> : null}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="claim-family">Tipo de problema *</Label>
                    <select
                      id="claim-family"
                      className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                      value={formValues.problemFamilyId ?? ""}
                      onChange={(event) => {
                        updateField("problemFamilyId", event.target.value || null);
                        updateField("problemId", "");
                      }}
                    >
                      <option value="">Selecciona un tipo de problema</option>
                      {filteredFamilyOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {formErrors.problemFamilyId ? <p className="text-xs text-destructive">{formErrors.problemFamilyId}</p> : null}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="claim-problem">Problema *</Label>
                    <select
                      id="claim-problem"
                      className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                      value={formValues.problemId}
                      onChange={(event) => updateField("problemId", event.target.value)}
                    >
                      <option value="">Selecciona un problema</option>
                      {filteredProblemOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {formErrors.problemId ? <p className="text-xs text-destructive">{formErrors.problemId}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="claim-order-number">Numero de pedido *</Label>
                    <Input
                      id="claim-order-number"
                      className="rounded-xl"
                      inputMode="numeric"
                      maxLength={8}
                      value={formValues.referenceOrderNumber ?? ""}
                      onChange={(event) => updateField("referenceOrderNumber", event.target.value.replace(/\D/g, "").slice(0, 8))}
                    />
                    <p className="text-xs text-muted-foreground">Debe tener exactamente 8 digitos numericos.</p>
                    {formErrors.referenceOrderNumber ? <p className="text-xs text-destructive">{formErrors.referenceOrderNumber}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="claim-invoice-number">Factura comercializadora *</Label>
                    <Input
                      id="claim-invoice-number"
                      className="rounded-xl"
                      inputMode="numeric"
                      maxLength={7}
                      value={formValues.referenceInvoiceNumber ?? ""}
                      onChange={(event) => updateField("referenceInvoiceNumber", event.target.value.replace(/\D/g, "").slice(0, 7))}
                    />
                    <p className="text-xs text-muted-foreground">Debe tener exactamente 7 digitos numericos.</p>
                    {formErrors.referenceInvoiceNumber ? <p className="text-xs text-destructive">{formErrors.referenceInvoiceNumber}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="claim-event-date">Fecha del caso *</Label>
                    <Input
                      id="claim-event-date"
                      type="date"
                      className="rounded-xl"
                      value={formValues.eventDate ?? ""}
                      onChange={(event) => updateField("eventDate", event.target.value)}
                    />
                    {formErrors.eventDate ? <p className="text-xs text-destructive">{formErrors.eventDate}</p> : null}
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="claim-subject">Asunto</Label>
                    <Input
                      id="claim-subject"
                      className="rounded-xl"
                      value={formValues.subject}
                      onChange={(event) => updateField("subject", event.target.value)}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="claim-description">Descripcion</Label>
                    <textarea
                      id="claim-description"
                      rows={4}
                      className="flex min-h-[112px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                      value={formValues.description ?? ""}
                      onChange={(event) => updateField("description", event.target.value)}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="claim-photo">Foto</Label>
                    <div className="rounded-[20px] border border-dashed border-border/70 bg-background/80 p-4">
                      <input
                        ref={photoInputRef}
                        id="claim-photo"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
                        className="hidden"
                        onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        <label
                          htmlFor="claim-photo"
                          className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                        >
                          <Camera className="size-4" />
                          Seleccionar foto
                        </label>
                        <span className="text-sm text-muted-foreground">
                          {photoFile ? photoFile.name : "Todavia no se ha seleccionado una foto."}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Se comprime y guarda en la ruta NAS de Comercial. Formatos permitidos: JPG, PNG, WEBP, HEIC/HEIF.
                      </p>
                      {photoFile ? (
                        <div className="mt-3 rounded-[16px] border border-border/70 bg-background px-3 py-2 text-sm">
                          {photoFile.name} · {(photoFile.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="rounded-[18px] border border-border/70 bg-background/80 px-4 py-3 text-xs text-muted-foreground">
                  Todos los campos con `*` son obligatorios. Asunto y descripción pueden quedar vacíos.
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" className="rounded-full" onClick={resetForm}>
                    Restablecer
                  </Button>
                  <Button type="submit" className="rounded-full" disabled={isSubmitting}>
                    <Save className="size-4" />
                    {isSubmitting ? "Guardando…" : "Registrar reclamo"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="starter-panel border-border/70 bg-card/84">
              <CardHeader>
                <CardTitle className="text-lg">Registros recientes</CardTitle>
                <CardDescription>Ultimos reclamos registrados en la base transaccional.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {moduleData.registrationFeed.length ? (
                  moduleData.registrationFeed.map((record) => (
                    <QueueCard
                      key={record.claimId}
                      record={record}
                      onOpenDetail={() => setSelectedClaimId(record.claimId)}
                    />
                  ))
                ) : (
                  <div className="rounded-[20px] border border-dashed border-border/70 bg-background/80 px-4 py-8 text-center text-sm text-muted-foreground">
                    Todavia no hay reclamos registrados.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="starter-panel border-border/70 bg-card/84">
              <CardHeader>
                <CardTitle className="text-lg">Notas de diseño</CardTitle>
                <CardDescription>Decisiones operativas ya respetadas por esta estructura.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {moduleData.notes.map((note) => (
                  <div key={note} className="rounded-[16px] border border-border/70 bg-background/80 px-3 py-2 text-sm text-muted-foreground">
                    {note}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {activeTab === "approvals" ? (
        <Card className="starter-panel border-border/70 bg-card/84">
          <CardHeader>
            <CardTitle className="text-lg">Aprobaciones</CardTitle>
            <CardDescription>
              Aqui entran solo los reclamos que si aplican nota de credito y todavia estan pendientes de decision.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {moduleData.approvalQueue.length ? (
              moduleData.approvalQueue.map((record) => (
                <QueueCard
                  key={record.claimId}
                  record={record}
                  onOpenDetail={() => setSelectedClaimId(record.claimId)}
                  actions={(
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        className="rounded-full"
                        disabled={isProcessingClaimId === record.claimId}
                        onClick={() => {
                          void processApproval(record.claimId, "approve");
                        }}
                      >
                        Aprobar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        disabled={isProcessingClaimId === record.claimId}
                        onClick={() => {
                          void processApproval(record.claimId, "reject");
                        }}
                      >
                        Rechazar
                      </Button>
                    </div>
                  )}
                />
              ))
            ) : (
              <div className="rounded-[20px] border border-dashed border-border/70 bg-background/80 px-4 py-8 text-center text-sm text-muted-foreground">
                No hay reclamos pendientes de aprobacion.
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "applications" ? (
        <Card className="starter-panel border-border/70 bg-card/84">
          <CardHeader>
            <CardTitle className="text-lg">Aplicaciones</CardTitle>
            <CardDescription>
              Solo se muestran reclamos ya aprobados y pendientes de aplicar por el siguiente actor del flujo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {moduleData.applicationQueue.length ? (
              moduleData.applicationQueue.map((record) => (
                <QueueCard
                  key={record.claimId}
                  record={record}
                  onOpenDetail={() => setSelectedClaimId(record.claimId)}
                  actions={(
                    <Button
                      type="button"
                      className="rounded-full"
                      disabled={isProcessingClaimId === record.claimId}
                      onClick={() => {
                        void processApplication(record.claimId);
                      }}
                    >
                      Aplicar
                    </Button>
                  )}
                />
              ))
            ) : (
              <div className="rounded-[20px] border border-dashed border-border/70 bg-background/80 px-4 py-8 text-center text-sm text-muted-foreground">
                No hay reclamos pendientes de aplicacion.
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {selectedClaimId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[28px] border border-border/70 bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/70 px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Detalle de reclamo</p>
                <h3 className="text-lg font-semibold">
                  {selectedClaimDetail?.record.claimCode ?? "Cargando detalle…"}
                </h3>
              </div>
              <Button type="button" variant="outline" className="rounded-full" onClick={() => setSelectedClaimId(null)}>
                <X className="size-4" />
                Cerrar
              </Button>
            </div>

            <div className="max-h-[calc(92vh-5rem)] overflow-y-auto px-6 py-5">
              {isLoadingClaimDetail || !selectedClaimDetail ? (
                <div className="rounded-[20px] border border-dashed border-border/70 bg-background/80 px-4 py-10 text-center text-sm text-muted-foreground">
                  Cargando detalle del reclamo...
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="rounded-full px-3 py-1">{selectedClaimDetail.record.claimCode}</Badge>
                    <Badge variant="outline" className="rounded-full px-3 py-1">{claimScopeLabel(selectedClaimDetail.record.claimScope)}</Badge>
                    <Badge variant={statusTone(selectedClaimDetail.record.statusKey)} className="rounded-full px-3 py-1">{selectedClaimDetail.record.statusLabel}</Badge>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-[18px] border border-border/70 bg-background/80 px-4 py-3 text-sm">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Cliente</p>
                      <p className="mt-1 font-medium">{selectedClaimDetail.record.customerName ?? "-"}</p>
                    </div>
                    <div className="rounded-[18px] border border-border/70 bg-background/80 px-4 py-3 text-sm">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Comercializadora</p>
                      <p className="mt-1 font-medium">{selectedClaimDetail.record.commercializerName ?? "-"}</p>
                    </div>
                    <div className="rounded-[18px] border border-border/70 bg-background/80 px-4 py-3 text-sm">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Ejecutivo</p>
                      <p className="mt-1 font-medium">{selectedClaimDetail.record.accountExecutiveName ?? "-"}</p>
                    </div>
                    <div className="rounded-[18px] border border-border/70 bg-background/80 px-4 py-3 text-sm">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Finca</p>
                      <p className="mt-1 font-medium">{selectedClaimDetail.record.farmName ?? "-"}</p>
                    </div>
                    <div className="rounded-[18px] border border-border/70 bg-background/80 px-4 py-3 text-sm">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Variedad</p>
                      <p className="mt-1 font-medium">{selectedClaimDetail.record.varietyName ?? "-"}</p>
                    </div>
                    <div className="rounded-[18px] border border-border/70 bg-background/80 px-4 py-3 text-sm">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Proceso</p>
                      <p className="mt-1 font-medium">{selectedClaimDetail.record.processDestinationName ?? "NO APLICA"}</p>
                    </div>
                    <div className="rounded-[18px] border border-border/70 bg-background/80 px-4 py-3 text-sm">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tipo de problema</p>
                      <p className="mt-1 font-medium">{selectedClaimDetail.record.problemFamilyName ?? "-"}</p>
                    </div>
                    <div className="rounded-[18px] border border-border/70 bg-background/80 px-4 py-3 text-sm">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Problema</p>
                      <p className="mt-1 font-medium">{selectedClaimDetail.record.problemName ?? "-"}</p>
                    </div>
                    <div className="rounded-[18px] border border-border/70 bg-background/80 px-4 py-3 text-sm">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Fecha del caso</p>
                      <p className="mt-1 font-medium">{selectedClaimDetail.record.eventDate ?? "-"}</p>
                    </div>
                    <div className="rounded-[18px] border border-border/70 bg-background/80 px-4 py-3 text-sm">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pedido</p>
                      <p className="mt-1 font-medium">{selectedClaimDetail.record.referenceOrderNumber ?? "-"}</p>
                    </div>
                    <div className="rounded-[18px] border border-border/70 bg-background/80 px-4 py-3 text-sm">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Factura comercializadora</p>
                      <p className="mt-1 font-medium">{selectedClaimDetail.record.referenceInvoiceNumber ?? "-"}</p>
                    </div>
                    <div className="rounded-[18px] border border-border/70 bg-background/80 px-4 py-3 text-sm">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Creado</p>
                      <p className="mt-1 font-medium">{formatDateTime(selectedClaimDetail.record.createdAt)}</p>
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-border/70 bg-background/80 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Asunto</p>
                    <p className="mt-2 text-sm font-medium">{selectedClaimDetail.record.subject}</p>
                    <p className="mt-3 text-sm text-muted-foreground">{selectedClaimDetail.record.description ?? "Sin descripcion adicional."}</p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Imagen cargada</p>
                      <p className="mt-1 text-sm text-muted-foreground">La foto registrada para este reclamo se muestra al final del detalle.</p>
                    </div>
                    {selectedClaimDetail.attachments.length ? (
                      <div className="grid gap-4 lg:grid-cols-2">
                        {selectedClaimDetail.attachments.map((attachment) => (
                          <div key={attachment.attachmentId} className="overflow-hidden rounded-[20px] border border-border/70 bg-background/80">
                            <Image
                              src={attachment.fileUrl}
                              alt={attachment.originalFileName}
                              width={1200}
                              height={720}
                              unoptimized
                              className="h-72 w-full bg-slate-950 object-contain"
                            />
                            <div className="border-t border-border/70 px-4 py-3 text-sm">
                              <p className="font-medium">{attachment.originalFileName}</p>
                              <p className="text-xs text-muted-foreground">
                                {attachment.storedMimeType} · {(attachment.fileSizeBytes / 1024).toFixed(0)} KB
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-[20px] border border-dashed border-border/70 bg-background/80 px-4 py-8 text-center text-sm text-muted-foreground">
                        Este reclamo todavia no tiene imagen adjunta.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
