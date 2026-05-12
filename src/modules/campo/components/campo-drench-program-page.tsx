"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Beaker,
  CalendarRange,
  ChevronRight,
  FolderTree,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import type { BodegaProductRecord } from "@/lib/bodega-master-types";
import { DRENCH_PROGRAM_ACTIVITY_ID } from "@/lib/campo-drench-program-types";
import type {
  DrenchProgramLineInput,
  DrenchProgramRuleInput,
  DrenchProgramRulePayload,
  DrenchProgramRuleRecord,
  DrenchProductOrigin,
} from "@/lib/campo-drench-program-types";
import { fetchJson } from "@/lib/fetch-json";
import type { LaboratoryProductRecord } from "@/lib/laboratory-master-types";
import { cn } from "@/lib/utils";
import { MetricTile } from "@/shared/data-display/metric-tile";
import { FilterPanel, KpiGrid } from "@/shared/layout/filter-panel";
import { SectionPageShell } from "@/shared/layout/section-page-shell";
import { makeClientId } from "@/shared/lib/client-id";
import { formatDateTime } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

type CampoDrenchProgramPageProps = {
  initialRules: DrenchProgramRuleRecord[];
  initialAssignableProducts: BodegaProductRecord[];
  initialAssignableLaboratoryProducts: LaboratoryProductRecord[];
  initialSummary: { rules: number; lines: number };
  initialError?: string | null;
};

type DrenchProgramSnapshot = {
  rules: DrenchProgramRuleRecord[];
  assignableProducts: BodegaProductRecord[];
  assignableLaboratoryProducts: LaboratoryProductRecord[];
};

type EditorMode = "create" | "edit";
type GroupKey = string;

type GroupedRecipe = {
  key: GroupKey;
  cycleType: DrenchProgramRuleInput["cycleType"];
  varietyCode: string;
  title: string;
  rules: DrenchProgramRuleRecord[];
  totalLines: number;
  unresolvedLines: number;
  latestLoadedAt: string | null;
};

type CreateGroupDraft = {
  cycleType: DrenchProgramRuleInput["cycleType"];
  varietyCode: string;
};

type FormErrors = Partial<Record<Exclude<keyof DrenchProgramRuleInput, "lines">, string>> & {
  lines?: string;
  lineErrors?: Array<{
    sourceProductName?: string;
    productQuantityValue?: string;
  }>;
};

const EMPTY_LINE: DrenchProgramLineInput = {
  applicationMethod: "",
  litersPerBed: 50,
  dosageBasis: "PER_LITER",
  productOrigin: "BODEGA",
  productId: null,
  laboratoryProductId: null,
  sourceProductName: "",
  sourceProductCode: "",
  sourceUnitCode: "",
  productQuantityValue: null,
  productQuantityReference: "",
  notes: "",
  isActive: true,
};

function makeEmptyFormValues(): DrenchProgramRuleInput {
  return {
    phenologicalWeek: 1,
    cycleType: "S",
    varietyCode: "",
    activityId: DRENCH_PROGRAM_ACTIVITY_ID,
    isActive: true,
    notes: "",
    lines: [{ ...EMPTY_LINE, _formKey: makeClientId("drench_line") }],
    changeReason: "",
  };
}

const snapshotFetcher = (url: string) =>
  fetchJson<DrenchProgramSnapshot>(url, "No se pudo cargar la programacion de drench.");

function buildRuleCode(values: Pick<DrenchProgramRuleInput, "phenologicalWeek" | "cycleType" | "varietyCode">) {
  const variety = String(values.varietyCode ?? "").trim().toUpperCase();
  if (!variety) return `${values.phenologicalWeek} ${values.cycleType}`;
  return `${values.phenologicalWeek} ${values.cycleType} ${variety}`;
}

function buildGroupKey(cycleType: DrenchProgramRuleInput["cycleType"], varietyCode: string) {
  return `${cycleType} ${String(varietyCode ?? "").trim().toUpperCase()}`.trim();
}

function formatGroupTitle(cycleType: DrenchProgramRuleInput["cycleType"], varietyCode: string) {
  const variety = String(varietyCode ?? "").trim().toUpperCase() || "---";
  return `${variety} / ${formatCycleTypeLabel(cycleType)}`;
}

function formatCycleTypeLabel(cycleType: DrenchProgramRuleInput["cycleType"]) {
  return cycleType === "P" ? "Poda" : "Siembra";
}

function formatProductOption(product: BodegaProductRecord) {
  return `${product.productCode} - ${product.productName}`;
}

function formatLaboratoryProductOption(product: LaboratoryProductRecord) {
  return `${product.productCode} - ${product.productName}`;
}

function findProductFromSearch(value: string, products: BodegaProductRecord[]) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  return products.find((product) => {
    return [
      product.productCode,
      product.productName,
      formatProductOption(product),
    ].some((candidate) => candidate.trim().toLowerCase() === normalized);
  }) ?? null;
}

function findProductCandidates(value: string, products: BodegaProductRecord[]) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return [];

  return products.filter((product) => {
    return [
      product.productCode,
      product.productName,
      formatProductOption(product),
    ].some((candidate) => candidate.trim().toLowerCase().includes(normalized));
  });
}

function findLaboratoryProductFromSearch(value: string, products: LaboratoryProductRecord[]) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  return products.find((product) => {
    return [
      product.productCode,
      product.productName,
      formatLaboratoryProductOption(product),
    ].some((candidate) => candidate.trim().toLowerCase() === normalized);
  }) ?? null;
}

function findLaboratoryProductCandidates(value: string, products: LaboratoryProductRecord[]) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return [];

  return products.filter((product) => {
    return [
      product.productCode,
      product.productName,
      formatLaboratoryProductOption(product),
    ].some((candidate) => candidate.trim().toLowerCase().includes(normalized));
  });
}

function resolveProductFromLine(
  line: Pick<DrenchProgramLineInput, "productId" | "sourceProductCode" | "sourceProductName">,
  products: BodegaProductRecord[],
) {
  if (line.productId) {
    const byId = products.find((product) => product.productId === line.productId);
    if (byId) return byId;
  }

  const normalizedCode = String(line.sourceProductCode ?? "").trim().toLowerCase();
  if (normalizedCode) {
    const byCode = products.find((product) => product.productCode.trim().toLowerCase() === normalizedCode);
    if (byCode) return byCode;
  }

  const normalizedName = String(line.sourceProductName ?? "").trim().toLowerCase();
  if (normalizedName) {
    const byName = products.find((product) => product.productName.trim().toLowerCase() === normalizedName);
    if (byName) return byName;
  }

  return null;
}

function resolveLaboratoryProductFromLine(
  line: Pick<DrenchProgramLineInput, "laboratoryProductId" | "sourceProductCode" | "sourceProductName">,
  products: LaboratoryProductRecord[],
) {
  if (line.laboratoryProductId) {
    const byId = products.find((product) => product.laboratoryProductId === line.laboratoryProductId);
    if (byId) return byId;
  }

  const normalizedCode = String(line.sourceProductCode ?? "").trim().toLowerCase();
  if (normalizedCode) {
    const byCode = products.find((product) => product.productCode.trim().toLowerCase() === normalizedCode);
    if (byCode) return byCode;
  }

  const normalizedName = String(line.sourceProductName ?? "").trim().toLowerCase();
  if (normalizedName) {
    const byName = products.find((product) => product.productName.trim().toLowerCase() === normalizedName);
    if (byName) return byName;
  }

  return null;
}

function mapRecordToFormValues(record: DrenchProgramRuleRecord): DrenchProgramRuleInput {
  return {
    phenologicalWeek: record.phenologicalWeek,
    cycleType: record.cycleType,
    varietyCode: record.varietyCode,
    activityId: record.activityId,
    isActive: record.isActive,
    notes: record.notes ?? "",
    lines: record.lines.map((line) => ({
      _formKey: makeClientId("drench_line"),
      lineOrder: line.lineOrder,
      applicationMethod: line.applicationMethod ?? "",
      litersPerBed: line.litersPerBed,
      dosageBasis: line.dosageBasis ?? "PER_LITER",
      productOrigin: line.productOrigin ?? "BODEGA",
      productId: line.productId,
      laboratoryProductId: line.laboratoryProductId,
      sourceProductName: line.sourceProductName ?? line.productName ?? "",
      sourceProductCode: line.sourceProductCode ?? line.productCode ?? "",
      sourceUnitCode: line.sourceUnitCode ?? "",
      productQuantityValue: line.productQuantityValue,
      productQuantityReference: line.productQuantityReference ?? "",
      notes: line.notes ?? "",
      isActive: line.isActive,
    })),
    changeReason: "",
  };
}

function buildPayload(values: DrenchProgramRuleInput): DrenchProgramRuleInput {
  return {
    phenologicalWeek: Math.max(Math.trunc(Number(values.phenologicalWeek) || 0), 0),
    cycleType: values.cycleType === "P" ? "P" : "S",
    varietyCode: String(values.varietyCode ?? "").trim().toUpperCase(),
    activityId: DRENCH_PROGRAM_ACTIVITY_ID,
    isActive: values.isActive,
    notes: values.notes?.trim() || null,
    lines: values.lines.map((line, index) => ({
      lineOrder: index + 1,
      applicationMethod: line.applicationMethod?.trim() || null,
      litersPerBed: (line.dosageBasis ?? "PER_LITER") === "PER_BED"
        ? null
        : line.litersPerBed === null || line.litersPerBed === undefined ? null : Number(line.litersPerBed),
      dosageBasis: (line.dosageBasis ?? "PER_LITER"),
      productOrigin: (line.productOrigin ?? "BODEGA") as DrenchProductOrigin,
      productId: (line.productOrigin ?? "BODEGA") === "BODEGA" ? line.productId?.trim() || null : null,
      laboratoryProductId: (line.productOrigin ?? "BODEGA") === "LABORATORIO" ? line.laboratoryProductId?.trim() || null : null,
      sourceProductName: line.sourceProductName?.trim() || null,
      sourceProductCode: line.sourceProductCode?.trim().toUpperCase() || null,
      sourceUnitCode: line.sourceUnitCode?.trim().toUpperCase() || null,
      productQuantityValue: line.productQuantityValue === null || line.productQuantityValue === undefined ? null : Number(line.productQuantityValue),
      productQuantityReference: line.productQuantityReference?.trim() || null,
      notes: line.notes?.trim() || null,
      isActive: line.isActive ?? true,
    })),
    changeReason: values.changeReason?.trim() || null,
  };
}

function validateForm(values: DrenchProgramRuleInput): FormErrors {
  const payload = buildPayload(values);
  const errors: FormErrors = {};
  const lineErrors: NonNullable<FormErrors["lineErrors"]> = [];

  if (!payload.phenologicalWeek || payload.phenologicalWeek <= 0) {
    errors.phenologicalWeek = "La semana fenologica debe ser mayor a cero.";
  }
  if (!payload.varietyCode) {
    errors.varietyCode = "La variedad es obligatoria.";
  }

  payload.lines.forEach((line, index) => {
    const itemErrors: NonNullable<FormErrors["lineErrors"]>[number] = {};
    if (line.productOrigin === "BODEGA" && !line.productId && !line.sourceProductName) {
      itemErrors.sourceProductName = "Debes vincular un producto de Bodega o dejar un nombre fuente.";
    }
    if (line.productOrigin === "LABORATORIO" && !line.laboratoryProductId && !line.sourceProductName) {
      itemErrors.sourceProductName = "Debes vincular un producto de Laboratorio o dejar un nombre fuente.";
    }
    if (line.productQuantityValue === null || Number.isNaN(line.productQuantityValue)) {
      itemErrors.productQuantityValue = "La cantidad de producto es obligatoria.";
    }
    lineErrors[index] = itemErrors;
  });

  if (lineErrors.some((item) => Object.keys(item).length > 0)) {
    errors.lineErrors = lineErrors;
    errors.lines = "Hay lineas con datos incompletos.";
  }

  return errors;
}

function hasDuplicateWeek(group: GroupedRecipe | null, week: number, selectedRuleId: string | null) {
  if (!group || !week) return false;
  return group.rules.some((rule) => rule.phenologicalWeek === week && rule.ruleId !== selectedRuleId);
}

function countUnresolvedLines(rules: DrenchProgramRuleRecord[]) {
  return rules.reduce((accumulator, rule) => accumulator + rule.lines.filter((line) => !line.productId && !line.laboratoryProductId).length, 0);
}

function groupRules(rules: DrenchProgramRuleRecord[]) {
  const grouped = new Map<GroupKey, GroupedRecipe>();

  for (const rule of rules) {
    const key = buildGroupKey(rule.cycleType, rule.varietyCode);
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        key,
        cycleType: rule.cycleType,
        varietyCode: rule.varietyCode,
        title: formatGroupTitle(rule.cycleType, rule.varietyCode),
        rules: [rule],
        totalLines: rule.lines.length,
        unresolvedLines: rule.lines.filter((line) => !line.productId).length,
        latestLoadedAt: rule.loadedAt ?? null,
      });
      continue;
    }

    existing.rules.push(rule);
    existing.totalLines += rule.lines.length;
    existing.unresolvedLines += rule.lines.filter((line) => !line.productId).length;
    if ((rule.loadedAt ?? "") > (existing.latestLoadedAt ?? "")) {
      existing.latestLoadedAt = rule.loadedAt ?? null;
    }
  }

  return [...grouped.values()]
    .map((group) => ({
      ...group,
      rules: [...group.rules].sort((left, right) => left.phenologicalWeek - right.phenologicalWeek),
    }))
    .sort((left, right) => left.title.localeCompare(right.title));
}

function nextWeekForGroup(group: GroupedRecipe | null) {
  if (!group || !group.rules.length) return 1;
  return Math.max(...group.rules.map((rule) => rule.phenologicalWeek)) + 1;
}

function describeWeekBand(group: GroupedRecipe) {
  if (!group.rules.length) return "Sin semanas";
  const first = group.rules[0]?.phenologicalWeek ?? 0;
  const last = group.rules[group.rules.length - 1]?.phenologicalWeek ?? 0;
  return first === last ? `Semana ${first}` : `Semanas ${first} a ${last}`;
}

function buildCreateValues(group: GroupedRecipe | null): DrenchProgramRuleInput {
  const base = makeEmptyFormValues();
  if (!group) return base;
  return {
    ...base,
    cycleType: group.cycleType,
    varietyCode: group.varietyCode,
    phenologicalWeek: nextWeekForGroup(group),
  };
}

export function CampoDrenchProgramPage({
  initialRules,
  initialAssignableProducts,
  initialAssignableLaboratoryProducts,
  initialSummary,
  initialError,
}: CampoDrenchProgramPageProps) {
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [selectedGroupKey, setSelectedGroupKey] = useState<GroupKey | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(initialRules[0]?.ruleId ?? null);
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [formValues, setFormValues] = useState<DrenchProgramRuleInput>(makeEmptyFormValues);
  const [lineProductSearchValues, setLineProductSearchValues] = useState<string[]>([""]);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [createGroupDraft, setCreateGroupDraft] = useState<CreateGroupDraft>({ cycleType: "S", varietyCode: "" });
  const deferredSearch = useDeferredValue(search);

  const { data: snapshot, isValidating, mutate } = useSWR(
    "/api/campo/administrar-maestros/programacion-drench",
    snapshotFetcher,
    {
      fallbackData: {
        rules: initialRules,
        assignableProducts: initialAssignableProducts,
        assignableLaboratoryProducts: initialAssignableLaboratoryProducts,
      },
      revalidateOnFocus: false,
      dedupingInterval: 15000,
      onError: (error) => toast.error(error?.message || "No se pudo cargar la programacion de drench."),
    },
  );

  const rules = snapshot?.rules ?? initialRules;
  const assignableProducts = snapshot?.assignableProducts ?? initialAssignableProducts;
  const assignableLaboratoryProducts = snapshot?.assignableLaboratoryProducts ?? initialAssignableLaboratoryProducts;

  const groupedRecipes = useMemo(() => groupRules(rules), [rules]);

  const filteredGroups = useMemo(() => {
    const normalized = deferredSearch.trim().toLowerCase();
    if (!normalized) return groupedRecipes;

    return groupedRecipes.filter((group) => {
      return [
        group.title,
        group.varietyCode,
        group.cycleType,
        ...group.rules.map((rule) => String(rule.phenologicalWeek)),
      ].some((value) => String(value ?? "").toLowerCase().includes(normalized));
    });
  }, [deferredSearch, groupedRecipes]);

  const selectedGroup = useMemo(
    () => filteredGroups.find((group) => group.key === selectedGroupKey)
      ?? groupedRecipes.find((group) => group.key === selectedGroupKey)
      ?? null,
    [filteredGroups, groupedRecipes, selectedGroupKey],
  );

  const selectedRule = editorMode === "edit"
    ? (selectedGroup?.rules.find((rule) => rule.ruleId === selectedRuleId)
      ?? rules.find((rule) => rule.ruleId === selectedRuleId)
      ?? null)
    : null;

  const baselinePayload = useMemo(
    () => buildPayload(selectedRule ? mapRecordToFormValues(selectedRule) : buildCreateValues(selectedGroup)),
    [selectedGroup, selectedRule],
  );
  const currentPayload = useMemo(() => buildPayload(formValues), [formValues]);
  const isDirty = JSON.stringify(currentPayload) !== JSON.stringify(baselinePayload);

  const summary = useMemo(() => {
    const latest = rules.reduce<(typeof rules)[number] | null>(
      (best, rule) => {
        if (!rule.loadedAt) return best;
        if (!best || String(rule.loadedAt) > String(best.loadedAt)) return rule;
        return best;
      },
      null,
    );

    return {
      rules: rules.length || initialSummary.rules,
      groups: groupedRecipes.length,
      lines: rules.reduce((accumulator, rule) => accumulator + rule.lines.length, 0) || initialSummary.lines,
      bodegaProducts: assignableProducts.length,
      laboratoryProducts: assignableLaboratoryProducts.length,
      unresolvedLines: countUnresolvedLines(rules),
      latest,
    };
  }, [assignableLaboratoryProducts.length, assignableProducts.length, groupedRecipes.length, initialSummary.lines, initialSummary.rules, rules]);

  useEffect(() => {
    if (!groupedRecipes.length) {
      setSelectedGroupKey(null);
      return;
    }

    if (!selectedGroupKey || !groupedRecipes.some((group) => group.key === selectedGroupKey)) {
      setSelectedGroupKey(groupedRecipes[0]?.key ?? null);
    }
  }, [groupedRecipes, selectedGroupKey]);

  useEffect(() => {
    if (editorMode !== "edit") return;
    if (!selectedGroup?.rules.length) return;

    if (!selectedRuleId || !selectedGroup.rules.some((rule) => rule.ruleId === selectedRuleId)) {
      setSelectedRuleId(selectedGroup.rules[0]?.ruleId ?? null);
    }
  }, [editorMode, selectedGroup, selectedRuleId]);

  useEffect(() => {
    const rawForm = selectedRule
      ? mapRecordToFormValues(selectedRule)
      : buildCreateValues(selectedGroup);
    const nextForm = {
      ...rawForm,
      lines: rawForm.lines.map((line) => {
        if ((line.productOrigin ?? "BODEGA") === "LABORATORIO") {
          const matchedLaboratoryProduct = resolveLaboratoryProductFromLine(line, assignableLaboratoryProducts);
          if (!matchedLaboratoryProduct) return line;
          return {
            ...line,
            laboratoryProductId: matchedLaboratoryProduct.laboratoryProductId,
            sourceProductName: matchedLaboratoryProduct.productName,
            sourceProductCode: matchedLaboratoryProduct.productCode,
            sourceUnitCode: matchedLaboratoryProduct.baseUnitCode,
          };
        }

        const matchedProduct = resolveProductFromLine(line, assignableProducts);
        if (!matchedProduct) return line;
        return {
          ...line,
          productId: matchedProduct.productId,
          sourceProductName: matchedProduct.productName,
          sourceProductCode: matchedProduct.productCode,
          sourceUnitCode: matchedProduct.baseUnitCode,
        };
      }),
    };

    setFormValues(nextForm);
    setLineProductSearchValues(
      nextForm.lines.map((line) => {
        if ((line.productOrigin ?? "BODEGA") === "LABORATORIO") {
          const match = resolveLaboratoryProductFromLine(line, assignableLaboratoryProducts);
          if (!match) return line.sourceProductName ?? "";
          return formatLaboratoryProductOption(match);
        }

        const match = resolveProductFromLine(line, assignableProducts);
        if (!match) return line.sourceProductName ?? "";
        return formatProductOption(match);
      }),
    );
    setFormErrors({});
  }, [selectedGroup, selectedRule, assignableProducts, assignableLaboratoryProducts]);

  function updateField<Key extends keyof DrenchProgramRuleInput>(field: Key, value: DrenchProgramRuleInput[Key]) {
    setFormValues((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  }

  function updateLine(index: number, patch: Partial<DrenchProgramLineInput>) {
    setFormValues((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => (
        lineIndex === index ? { ...line, ...patch } : line
      )),
    }));
    setFormErrors((current) => ({ ...current, lines: undefined }));
  }

  function updateLineSearch(index: number, value: string) {
    setLineProductSearchValues((current) => current.map((item, itemIndex) => itemIndex === index ? value : item));
    const lineOrigin = formValues.lines[index]?.productOrigin ?? "BODEGA";

    if (lineOrigin === "LABORATORIO") {
      const match = findLaboratoryProductFromSearch(value, assignableLaboratoryProducts);
      if (match) {
        updateLine(index, {
          laboratoryProductId: match.laboratoryProductId,
          sourceProductName: match.productName,
          sourceProductCode: match.productCode,
          sourceUnitCode: match.baseUnitCode,
        });
        return;
      }

      updateLine(index, {
        laboratoryProductId: null,
        sourceProductName: value,
        sourceProductCode: formValues.lines[index]?.sourceProductCode ?? "",
        sourceUnitCode: formValues.lines[index]?.sourceUnitCode ?? "",
      });
      return;
    }

    const match = findProductFromSearch(value, assignableProducts);
    if (match) {
      updateLine(index, {
        productId: match.productId,
        sourceProductName: match.productName,
        sourceProductCode: match.productCode,
        sourceUnitCode: match.baseUnitCode,
      });
      return;
    }

    updateLine(index, {
      productId: null,
      sourceProductName: value,
      sourceProductCode: formValues.lines[index]?.sourceProductCode ?? "",
      sourceUnitCode: formValues.lines[index]?.sourceUnitCode ?? "",
    });
  }

  function resolveLineSearch(index: number) {
    const currentValue = lineProductSearchValues[index] ?? "";
    const lineOrigin = formValues.lines[index]?.productOrigin ?? "BODEGA";

    if (lineOrigin === "LABORATORIO") {
      const exactMatch = findLaboratoryProductFromSearch(currentValue, assignableLaboratoryProducts);
      if (exactMatch) {
        setLineProductSearchValues((current) => current.map((item, itemIndex) => itemIndex === index ? formatLaboratoryProductOption(exactMatch) : item));
        updateLine(index, {
          laboratoryProductId: exactMatch.laboratoryProductId,
          sourceProductName: exactMatch.productName,
          sourceProductCode: exactMatch.productCode,
          sourceUnitCode: exactMatch.baseUnitCode,
        });
        return;
      }

      const candidates = findLaboratoryProductCandidates(currentValue, assignableLaboratoryProducts);
      if (candidates.length === 1) {
        const candidate = candidates[0];
        setLineProductSearchValues((current) => current.map((item, itemIndex) => itemIndex === index ? formatLaboratoryProductOption(candidate) : item));
        updateLine(index, {
          laboratoryProductId: candidate.laboratoryProductId,
          sourceProductName: candidate.productName,
          sourceProductCode: candidate.productCode,
          sourceUnitCode: candidate.baseUnitCode,
        });
        return;
      }

      updateLine(index, {
        laboratoryProductId: null,
        sourceProductName: currentValue,
      });
      return;
    }

    const exactMatch = findProductFromSearch(currentValue, assignableProducts);
    if (exactMatch) {
      setLineProductSearchValues((current) => current.map((item, itemIndex) => itemIndex === index ? formatProductOption(exactMatch) : item));
      updateLine(index, {
        productId: exactMatch.productId,
        sourceProductName: exactMatch.productName,
        sourceProductCode: exactMatch.productCode,
        sourceUnitCode: exactMatch.baseUnitCode,
      });
      return;
    }

    const candidates = findProductCandidates(currentValue, assignableProducts);
    if (candidates.length === 1) {
      const candidate = candidates[0];
      setLineProductSearchValues((current) => current.map((item, itemIndex) => itemIndex === index ? formatProductOption(candidate) : item));
      updateLine(index, {
        productId: candidate.productId,
        sourceProductName: candidate.productName,
        sourceProductCode: candidate.productCode,
        sourceUnitCode: candidate.baseUnitCode,
      });
      return;
    }

    updateLine(index, {
      productId: null,
      sourceProductName: currentValue,
    });
  }

  function updateLineOrigin(index: number, origin: DrenchProductOrigin) {
    setLineProductSearchValues((current) => current.map((item, itemIndex) => itemIndex === index ? "" : item));
    updateLine(index, {
      productOrigin: origin,
      productId: null,
      laboratoryProductId: null,
      sourceProductName: "",
      sourceProductCode: "",
      sourceUnitCode: "",
    });
  }

  function addLine() {
    setFormValues((current) => ({
      ...current,
      lines: [
        ...current.lines,
        {
          ...EMPTY_LINE,
          _formKey: makeClientId("drench_line"),
          lineOrder: current.lines.length + 1,
          litersPerBed: current.lines[0]?.litersPerBed ?? 50,
          dosageBasis: current.lines[0]?.dosageBasis ?? "PER_LITER",
          applicationMethod: current.lines[0]?.applicationMethod ?? "",
        },
      ],
    }));
    setLineProductSearchValues((current) => [...current, ""]);
  }

  function removeLine(index: number) {
    setFormValues((current) => ({
      ...current,
      lines: current.lines.filter((_, lineIndex) => lineIndex !== index),
    }));
    setLineProductSearchValues((current) => current.filter((_, lineIndex) => lineIndex !== index));
  }

  function openCreateMode(group: GroupedRecipe | null = selectedGroup) {
    startTransition(() => {
      setEditorMode("create");
      setSelectedRuleId(null);
      if (group) {
        setSelectedGroupKey(group.key);
      }
    });
  }

  function openCreateStandalone() {
    setCreateGroupDraft({ cycleType: "S", varietyCode: "" });
    setIsCreateGroupOpen(true);
  }

  function confirmCreateGroup() {
    const normalizedVariety = createGroupDraft.varietyCode.trim().toUpperCase();
    if (!normalizedVariety) {
      toast.error("Debes ingresar la variedad para crear el grupo base.");
      return;
    }

    const nextGroupKey = buildGroupKey(createGroupDraft.cycleType, normalizedVariety);
    const existingGroup = groupedRecipes.find((group) => group.key === nextGroupKey) ?? null;

    startTransition(() => {
      setEditorMode("create");
      setSelectedRuleId(null);
      setSelectedGroupKey(existingGroup?.key ?? null);
      setFormValues({
        ...makeEmptyFormValues(),
        cycleType: createGroupDraft.cycleType,
        varietyCode: normalizedVariety,
        phenologicalWeek: existingGroup ? nextWeekForGroup(existingGroup) : 1,
      });
      setLineProductSearchValues([""]);
      setFormErrors({});
    });

    setIsCreateGroupOpen(false);
  }

  function openEditMode(groupKey: GroupKey, ruleId: string) {
    startTransition(() => {
      setSelectedGroupKey(groupKey);
      setEditorMode("edit");
      setSelectedRuleId(ruleId);
    });
  }

  function resetForm() {
    const rawForm = selectedRule ? mapRecordToFormValues(selectedRule) : buildCreateValues(selectedGroup);
    const nextForm = {
      ...rawForm,
      lines: rawForm.lines.map((line) => {
        const matchedProduct = resolveProductFromLine(line, assignableProducts);
        if (!matchedProduct) return line;
        return {
          ...line,
          productId: matchedProduct.productId,
          sourceProductName: matchedProduct.productName,
          sourceProductCode: matchedProduct.productCode,
          sourceUnitCode: matchedProduct.baseUnitCode,
        };
      }),
    };
    setFormValues(nextForm);
    setLineProductSearchValues(
      nextForm.lines.map((line) => {
        const match = resolveProductFromLine(line, assignableProducts);
        if (!match) return line.sourceProductName ?? "";
        return match ? formatProductOption(match) : (line.sourceProductName ?? "");
      }),
    );
    setFormErrors({});
  }

  async function onDeleteSelectedWeek() {
    if (!selectedRuleId || !selectedRule) return;

    const confirmed = window.confirm(
      `Vas a eliminar la semana ${selectedRule.phenologicalWeek} del grupo ${selectedGroup?.title ?? selectedRule.ruleCode}. Esta accion quitara la semana vigente del maestro.`,
    );

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await fetchJson<{ data: { ruleId: string; deleted: boolean } }>(
        `/api/campo/administrar-maestros/programacion-drench/${encodeURIComponent(selectedRuleId)}`,
        "No se pudo eliminar la semana de drench.",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        },
      );

      toast.success("Semana de drench eliminada.");
      await mutate();
      startTransition(() => {
        setEditorMode("create");
        setSelectedRuleId(null);
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar la semana de drench.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function onDeleteSelectedGroup() {
    if (!selectedGroup) return;

    const confirmed = window.confirm(
      `Vas a eliminar el grupo base ${selectedGroup.title}. Esto dara de baja todas sus semanas vigentes en el maestro de drench, pero conservara el historial en base.`,
    );

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await fetchJson<{ data: { cycleType: string; varietyCode: string; deleted: boolean; rulesAffected: number } }>(
        "/api/campo/administrar-maestros/programacion-drench",
        "No se pudo eliminar el grupo base de drench.",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cycleType: selectedGroup.cycleType,
            varietyCode: selectedGroup.varietyCode,
          }),
        },
      );

      toast.success(`Grupo ${selectedGroup.title} eliminado. Se dieron de baja ${selectedGroup.rules.length} semanas vigentes.`);
      await mutate();
      startTransition(() => {
        setEditorMode("create");
        setSelectedRuleId(null);
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el grupo base de drench.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateForm(formValues);
    if (duplicateWeekInGroup) {
      nextErrors.phenologicalWeek = `La semana ${formValues.phenologicalWeek} ya existe en el grupo ${selectedGroup?.title ?? ""}.`;
    }
    setFormErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Revisa la semana, la variedad y las lineas antes de guardar.");
      return;
    }

    setIsSaving(true);
    try {
      const isEditing = editorMode === "edit" && selectedRuleId;
      const endpoint = isEditing
        ? `/api/campo/administrar-maestros/programacion-drench/${encodeURIComponent(selectedRuleId)}`
        : "/api/campo/administrar-maestros/programacion-drench";
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetchJson<DrenchProgramRulePayload>(
        endpoint,
        "No se pudo guardar la regla de drench.",
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(currentPayload),
        },
      );

      toast.success(isEditing ? "Semana de drench actualizada." : "Semana de drench creada.");
      await mutate();
      startTransition(() => {
        setSelectedGroupKey(buildGroupKey(response.data.cycleType, response.data.varietyCode));
        setEditorMode("edit");
        setSelectedRuleId(response.data.ruleId);
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la regla de drench.");
    } finally {
      setIsSaving(false);
    }
  }

  const selectedWeekCount = selectedGroup?.rules.length ?? 0;
  const selectedMatchedLines = currentPayload.lines.filter((line) => Boolean(line.productId || line.laboratoryProductId)).length;
  const duplicateWeekInGroup = hasDuplicateWeek(
    selectedGroup,
    Number(formValues.phenologicalWeek),
    editorMode === "edit" ? selectedRuleId : null,
  );

  return (
    <div className="space-y-4">
      <SectionPageShell
        eyebrow="Administración / Maestros por dominio / Campo / Programación Drench"
        title="Programación Drench"
        subtitle="La receta se administra por grupo base de ciclo y variedad. Cada linea ahora puede consumir producto desde Bodega o desde Laboratorio, respetando la vinculacion por actividad FM11."
        icon={<Beaker className="size-5" aria-hidden="true" />}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="rounded-full" onClick={() => void mutate()}>
              <RefreshCcw className={cn("size-4", isValidating && "animate-spin")} />
              Recargar
            </Button>
          </div>
        )}
      >
        <FilterPanel>
          <KpiGrid>
            <MetricTile label="Grupos base" value={String(summary.groups)} hint="Combinaciones activas de P/S + variedad." />
            <MetricTile label="Semanas vigentes" value={String(summary.rules)} hint="Semanas fenologicas registradas dentro de cada grupo." />
            <MetricTile label="Lineas vigentes" value={String(summary.lines)} hint="Total de lineas editables en todas las semanas." />
            <MetricTile label="Productos Bodega FM11" value={String(summary.bodegaProducts)} hint="Productos de Bodega disponibles para Drench." />
            <MetricTile label="Productos Laboratorio FM11" value={String(summary.laboratoryProducts)} hint="Productos de Laboratorio disponibles para Drench." />
            <MetricTile label="Pendientes" value={String(summary.unresolvedLines)} hint="Lineas con nombre fuente aun no homologado a Bodega o Laboratorio." />
            <MetricTile label="Ultima carga" value={summary.latest?.loadedAt ? formatDateTime(summary.latest.loadedAt) : "-"} hint="Ultima semana creada o actualizada." />
          </KpiGrid>

          {initialError ? (
            <div className="rounded-[24px] border border-slate-300/60 bg-slate-500/10 px-4 py-3 text-sm text-slate-950 dark:text-slate-100">
              {initialError}
            </div>
          ) : null}
        </FilterPanel>
      </SectionPageShell>

      <div className="grid gap-4 2xl:grid-cols-[0.78fr_0.9fr_1.22fr]">
        <Card className="starter-panel border-border/70 bg-card/84">
          <CardHeader className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-slate-900/10 p-3 text-slate-700 dark:bg-slate-900/20 dark:text-white">
                <FolderTree className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg">Grupos base</CardTitle>
                <CardDescription>Variedad / Tipo SP. Desde aqui nace la receta madre que luego se trabaja por semanas.</CardDescription>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-[18px] border border-border/60 bg-background/70 px-3 py-3">
              <div className="text-xs text-muted-foreground">
                Crea grupos base como <span className="font-medium text-foreground">CLO / Poda</span> o <span className="font-medium text-foreground">XL / Siembra</span>.
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedGroup ? (
                  <Button type="button" variant="outline" className="rounded-full border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800" onClick={onDeleteSelectedGroup} disabled={isDeleting || isSaving}>
                    <Trash2 className="size-4" />
                    {isDeleting ? "Eliminando…" : "Eliminar grupo base"}
                  </Button>
                ) : null}
                <Button type="button" variant="outline" className="rounded-full" onClick={openCreateStandalone}>
                  <Sparkles className="size-4" />
                  Nuevo grupo base
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="drench-group-search">Buscar grupo base</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="drench-group-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Busca por variedad, tipo SP o semana…"
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative overflow-hidden pt-1">
            <div className="max-h-[calc(100dvh-16rem)] space-y-3 overflow-y-auto pr-1 pb-6">
              {filteredGroups.length ? filteredGroups.map((group) => {
                const isSelected = selectedGroupKey === group.key;
                return (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => setSelectedGroupKey(group.key)}
                    className={cn(
                      "w-full rounded-[24px] border px-5 py-4 text-left transition-colors",
                      isSelected
                        ? "border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                        : "border-border/70 bg-background/80 hover:border-slate-300 hover:bg-background",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold">{group.title}</p>
                          <Badge
                            variant={isSelected ? "secondary" : "outline"}
                            className={cn("rounded-full px-3 py-1", isSelected && "border-white/20 bg-white/12 text-white")}
                          >
                            {group.rules.length} semanas
                          </Badge>
                        </div>
                        <p className={cn("text-sm font-medium", isSelected ? "text-white/90" : "text-foreground")}>
                          {formatCycleTypeLabel(group.cycleType)} - Variedad {group.varietyCode}
                        </p>
                        <p className={cn("text-xs", isSelected ? "text-white/75" : "text-muted-foreground")}>
                          {describeWeekBand(group)} - {group.totalLines} lineas - {group.unresolvedLines} pendientes
                        </p>
                      </div>
                      <ChevronRight className={cn("size-4 shrink-0", isSelected ? "text-white" : "text-muted-foreground")} />
                    </div>
                  </button>
                );
              }) : (
                <div className="rounded-[24px] border border-dashed border-border/70 bg-background/80 px-4 py-8 text-center text-sm text-muted-foreground">
                  No hay grupos que coincidan con el filtro actual.
                </div>
              )}
            </div>
            <div className="pointer-events-none absolute inset-x-6 bottom-0 h-12 rounded-b-[24px] bg-gradient-to-t from-card via-card/96 to-transparent" />
          </CardContent>
        </Card>

        <Card className="starter-panel border-border/70 bg-card/84">
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    {selectedGroup?.title ?? "Sin grupo"}
                  </Badge>
                  {selectedGroup ? (
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      {selectedGroup.rules.length} semanas
                    </Badge>
                  ) : null}
                </div>
                <div>
                  <CardTitle className="text-lg">Semanas fenologicas</CardTitle>
                  <CardDescription>Agrega o elimina semanas dentro del grupo actual. Aqui se administra el ciclo vivo de la receta.</CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" className="rounded-full" onClick={() => openCreateMode(selectedGroup)} disabled={!selectedGroup}>
                  <Plus className="size-4" />
                  Agregar semana
                </Button>
                {editorMode === "edit" && selectedRule ? (
                  <Button type="button" variant="outline" className="rounded-full border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800" onClick={onDeleteSelectedWeek} disabled={isSaving || isDeleting}>
                    <Trash2 className="size-4" />
                    {isDeleting ? "Eliminando…" : "Eliminar semana"}
                  </Button>
                ) : null}
                <div className="rounded-full bg-slate-900/10 p-3 text-slate-700 dark:bg-slate-900/20 dark:text-white">
                  <CalendarRange className="size-5" aria-hidden="true" />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative overflow-hidden pt-1">
            <div className="max-h-[calc(100dvh-16rem)] space-y-3 overflow-y-auto pr-1 pb-6">
              {selectedGroup ? selectedGroup.rules.map((rule) => {
                const isSelected = editorMode === "edit" && selectedRuleId === rule.ruleId;
                const unresolved = rule.lines.filter((line) => !line.productId && !line.laboratoryProductId).length;
                const resolved = rule.lines.length - unresolved;
                const resolutionPct = rule.lines.length ? Math.round((resolved / rule.lines.length) * 100) : 0;
                const barClass = resolutionPct === 100
                  ? (isSelected ? "bg-white" : "bg-emerald-600")
                  : (isSelected ? "bg-rose-200" : "bg-rose-500");
                return (
                  <button
                    key={rule.ruleId}
                    type="button"
                    onClick={() => openEditMode(selectedGroup.key, rule.ruleId)}
                    className={cn(
                      "w-full rounded-[24px] border px-5 py-4 text-left transition-colors",
                      isSelected
                        ? "border-emerald-700 bg-emerald-700 text-white shadow-lg shadow-emerald-900/20"
                        : "border-border/70 bg-background/80 hover:border-emerald-300 hover:bg-background",
                    )}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold">Semana {rule.phenologicalWeek}</p>
                          <p className={cn("text-xs", isSelected ? "text-white/75" : "text-muted-foreground")}>
                            {rule.ruleCode}
                          </p>
                        </div>
                        <Badge
                          variant={isSelected ? "secondary" : "outline"}
                          className={cn("rounded-full px-3 py-1", isSelected && "border-white/20 bg-white/12 text-white")}
                        >
                          {rule.lines.length} lineas
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className={cn("rounded-2xl px-3 py-2", isSelected ? "bg-white/10 text-white/85" : "bg-muted/50 text-muted-foreground")}>
                          Homologadas: {rule.lines.length - unresolved}
                        </div>
                        <div className={cn("rounded-2xl px-3 py-2", isSelected ? "bg-white/10 text-white/85" : "bg-muted/50 text-muted-foreground")}>
                          Pendientes: {unresolved}
                        </div>
                      </div>
                      <div className={cn("space-y-2 rounded-2xl px-3 py-3", isSelected ? "bg-white/8" : "bg-muted/35")}>
                        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em]">
                          <span className={isSelected ? "text-white/75" : "text-muted-foreground"}>Homologacion</span>
                          <span className={isSelected ? "text-white" : "text-foreground"}>{resolutionPct}%</span>
                        </div>
                        <div className={cn("h-2 overflow-hidden rounded-full", isSelected ? "bg-white/12" : "bg-border/70")}>
                          <div
                            className={cn("h-full rounded-full", barClass)}
                            style={{ width: `${Math.max(resolutionPct, 6)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              }) : (
                <div className="rounded-[24px] border border-dashed border-border/70 bg-background/80 px-4 py-8 text-center text-sm text-muted-foreground">
                  Primero selecciona un grupo base o crea uno nuevo.
                </div>
              )}
            </div>
            <div className="pointer-events-none absolute inset-x-6 bottom-0 h-12 rounded-b-[24px] bg-gradient-to-t from-card via-card/96 to-transparent" />
          </CardContent>
        </Card>

        <Card className="starter-panel border-border/70 bg-card/84 2xl:sticky 2xl:top-4 2xl:self-start">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    {editorMode === "edit" ? "Editar semana" : "Nueva semana"}
                  </Badge>
                  <Badge variant="secondary" className="rounded-full px-3 py-1">
                    Actividad fija {DRENCH_PROGRAM_ACTIVITY_ID}
                  </Badge>
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {editorMode === "edit" && selectedRule
                      ? `${selectedGroup?.title ?? ""} - Semana ${selectedRule.phenologicalWeek}`
                      : selectedGroup
                        ? `Nueva semana para ${selectedGroup.title}`
                        : "Registrar grupo o semana de drench"}
                  </CardTitle>
                  <CardDescription>
                    Primero defines el grupo base (`Variedad / Tipo SP`) y luego administras sus semanas fenologicas con productos ilimitados. Si una semana no aplica, la eliminas y desaparece tambien de la base vigente.
                  </CardDescription>
                </div>
              </div>
              <div className="rounded-full bg-slate-900/10 p-3 text-slate-700 dark:bg-slate-900/20 dark:text-white">
                <Beaker className="size-5" aria-hidden="true" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={onSubmit}>
              <div className="space-y-4">
                <div>
                  <Label>1. Datos de la semana</Label>
                  <p className="text-xs text-muted-foreground">
                    El grupo base ya define la variedad y el tipo SP. Aqui completas la semana fenologica y su contexto operativo.
                  </p>
                </div>

                <div className="grid gap-5 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Tipo SP</Label>
                  <div className="rounded-[18px] border border-border/70 bg-background/75 px-4 py-3 text-sm">
                    <span className="font-medium">{formatCycleTypeLabel(formValues.cycleType)}</span>
                    <span className="ml-2 text-muted-foreground">({formValues.cycleType})</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Variedad</Label>
                  <div className="rounded-[18px] border border-border/70 bg-background/75 px-4 py-3 text-sm font-medium">
                    {formValues.varietyCode || "---"}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="drench-week">Semana fenologica</Label>
                  <Input
                    id="drench-week"
                    type="number"
                    min={1}
                    className="rounded-xl"
                    value={formValues.phenologicalWeek}
                    onChange={(event) => updateField("phenologicalWeek", Number(event.target.value))}
                  />
                  {formErrors.phenologicalWeek ? <p className="text-xs text-destructive">{formErrors.phenologicalWeek}</p> : null}
                </div>

                <div className="space-y-2 md:col-span-3">
                  <Label>Jerarquia resultante</Label>
                  <div className="rounded-[18px] border border-border/70 bg-background/75 px-4 py-3 text-sm">
                    <span className="font-semibold">{formatGroupTitle(formValues.cycleType, formValues.varietyCode || "...")}</span>
                    <span className="mx-2 text-muted-foreground">-</span>
                    <span>Semana {formValues.phenologicalWeek || "..."}</span>
                    <span className="mx-2 text-muted-foreground">-</span>
                    <span>{buildRuleCode(formValues)}</span>
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="drench-notes">Notas de la semana</Label>
                  <textarea
                    id="drench-notes"
                    rows={3}
                    className="flex min-h-[96px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.notes ?? ""}
                    onChange={(event) => updateField("notes", event.target.value)}
                    placeholder="Opcional. Ej. ajuste de dosis para revision operativa."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="drench-status">Estado</Label>
                  <select
                    id="drench-status"
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={formValues.isActive ? "active" : "inactive"}
                    onChange={(event) => updateField("isActive", event.target.value === "active")}
                  >
                    <option value="active">Activa</option>
                    <option value="inactive">Inactiva</option>
                  </select>

                  <Label htmlFor="drench-reason" className="pt-3">Motivo de cambio</Label>
                  <Input
                    id="drench-reason"
                    className="rounded-xl"
                    value={formValues.changeReason ?? ""}
                    onChange={(event) => updateField("changeReason", event.target.value)}
                    placeholder="Opcional"
                  />
                </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Label>2. Lineas de aplicacion</Label>
                    <p className="text-xs text-muted-foreground">
                      Cada semana puede tener todas las lineas necesarias. Cada linea decide si consume producto desde Bodega o desde Laboratorio.
                    </p>
                  </div>
                  <Button type="button" variant="outline" className="rounded-full" onClick={addLine}>
                    <Plus className="size-4" />
                    Agregar linea
                  </Button>
                </div>

                <div className="space-y-4">
                  {formValues.lines.map((line, index) => {
                    const selectedProduct = (line.productOrigin ?? "BODEGA") === "BODEGA" && line.productId
                      ? assignableProducts.find((product) => product.productId === line.productId) ?? null
                      : null;
                    const selectedLaboratoryProduct = (line.productOrigin ?? "BODEGA") === "LABORATORIO" && line.laboratoryProductId
                      ? assignableLaboratoryProducts.find((product) => product.laboratoryProductId === line.laboratoryProductId) ?? null
                      : null;

                    return (
                      <div
                        key={line._formKey ?? `line-${index}`}
                        className="rounded-[24px] border border-border/70 bg-background/70 p-4 shadow-sm"
                      >
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="rounded-full px-3 py-1">
                              Linea {index + 1}
                            </Badge>
                            {selectedProduct ? (
                              <Badge variant="secondary" className="rounded-full px-3 py-1">
                                {selectedProduct.productCode}
                              </Badge>
                            ) : selectedLaboratoryProduct ? (
                              <Badge variant="secondary" className="rounded-full px-3 py-1">
                                {selectedLaboratoryProduct.productCode}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="rounded-full px-3 py-1">
                                Fuente pendiente
                              </Badge>
                            )}
                          </div>
                          <Button type="button" variant="outline" className="rounded-full" onClick={() => removeLine(index)}>
                            <Trash2 className="size-4" />
                            Quitar
                          </Button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <div className="space-y-2">
                            <Label htmlFor={`line-method-${index}`}>Metodo</Label>
                            <Input
                              id={`line-method-${index}`}
                              className="rounded-xl"
                              value={line.applicationMethod ?? ""}
                              onChange={(event) => updateLine(index, { applicationMethod: event.target.value })}
                              placeholder="Ej. BOMBA"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`line-basis-${index}`}>Base de calculo</Label>
                            <select
                              id={`line-basis-${index}`}
                              className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                              value={line.dosageBasis ?? "PER_LITER"}
                              onChange={(event) =>
                                updateLine(index, {
              dosageBasis: event.target.value as "PER_LITER" | "PER_BED" | "PER_1000_LITERS",
              litersPerBed: event.target.value === "PER_BED" ? null : (line.litersPerBed ?? 50),
            })
          }
        >
          <option value="PER_LITER">Por litro</option>
          <option value="PER_1000_LITERS">Por tanque 1000L</option>
          <option value="PER_BED">Por cama / unidad</option>
        </select>
      </div>

                          <div className="space-y-2">
                            <Label htmlFor={`line-liters-${index}`}>Litros por cama</Label>
        {(line.dosageBasis ?? "PER_LITER") === "PER_BED" ? (
          <div
            id={`line-liters-${index}`}
            className="rounded-[18px] border border-border/70 bg-muted/30 px-4 py-3 text-sm font-medium text-muted-foreground"
          >
            N/A para recetas por cama o unidad
                              </div>
                            ) : (
                              <Input
                                id={`line-liters-${index}`}
                                type="number"
                                step="0.01"
                                className="rounded-xl"
                                value={line.litersPerBed ?? ""}
                                onChange={(event) => updateLine(index, { litersPerBed: event.target.value === "" ? null : Number(event.target.value) })}
                              />
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`line-quantity-${index}`}>Cantidad de producto</Label>
                            <Input
                              id={`line-quantity-${index}`}
                              type="number"
                              step="0.0001"
                              className="rounded-xl"
                              value={line.productQuantityValue ?? ""}
                              onChange={(event) => updateLine(index, { productQuantityValue: event.target.value === "" ? null : Number(event.target.value) })}
                            />
                            {formErrors.lineErrors?.[index]?.productQuantityValue ? (
                              <p className="text-xs text-destructive">{formErrors.lineErrors[index]?.productQuantityValue}</p>
                            ) : null}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`line-origin-${index}`}>Origen</Label>
                            <select
                              id={`line-origin-${index}`}
                              className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                              value={line.productOrigin ?? "BODEGA"}
                              onChange={(event) => updateLineOrigin(index, event.target.value as DrenchProductOrigin)}
                            >
                              <option value="BODEGA">Bodega</option>
                              <option value="LABORATORIO">Laboratorio</option>
                            </select>
                          </div>

                          <div className="space-y-2 md:col-span-2 xl:col-span-2">
                            <Label htmlFor={`line-product-${index}`}>
                              {line.productOrigin === "LABORATORIO" ? "Producto Laboratorio o nombre fuente" : "Producto Bodega o nombre fuente"}
                            </Label>
                            <Input
                              id={`line-product-${index}`}
                              list={`drench-product-options-${index}`}
                              className="rounded-xl"
                              value={lineProductSearchValues[index] ?? ""}
                              onChange={(event) => updateLineSearch(index, event.target.value)}
                              onBlur={() => resolveLineSearch(index)}
                              placeholder={line.productOrigin === "LABORATORIO"
                                ? "Busca por codigo o nombre del producto de laboratorio."
                                : "Busca por codigo o nombre. Si no existe aun, deja el nombre fuente."}
                            />
                            <datalist id={`drench-product-options-${index}`}>
                              {line.productOrigin === "LABORATORIO"
                                ? assignableLaboratoryProducts.map((product) => (
                                  <option key={`${product.laboratoryProductId}-fmt`} value={formatLaboratoryProductOption(product)} />
                                ))
                                : assignableProducts.map((product) => (
                                  <option key={`${product.productId}-fmt`} value={formatProductOption(product)} />
                                ))}
                            </datalist>
                            {formErrors.lineErrors?.[index]?.sourceProductName ? (
                              <p className="text-xs text-destructive">{formErrors.lineErrors[index]?.sourceProductName}</p>
                            ) : null}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`line-unit-${index}`}>Unidad del producto</Label>
                            {selectedProduct || selectedLaboratoryProduct ? (
                              <div
                                id={`line-unit-${index}`}
                                className="rounded-[18px] border border-border/70 bg-background/75 px-4 py-3 text-sm font-medium"
                              >
                                {selectedProduct?.baseUnitCode ?? selectedLaboratoryProduct?.baseUnitCode}
                              </div>
                            ) : (
                              <Input
                                id={`line-unit-${index}`}
                                className="rounded-xl"
                                value={line.sourceUnitCode ?? ""}
                                onChange={(event) => updateLine(index, { sourceUnitCode: event.target.value.toUpperCase() })}
                                placeholder="Solo se edita si la linea aun no esta homologada."
                              />
                            )}
                          </div>

                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor={`line-reference-${index}`}>Referencia de dosis</Label>
                            <Input
                              id={`line-reference-${index}`}
                              className="rounded-xl"
                              value={line.productQuantityReference ?? ""}
                              onChange={(event) => updateLine(index, { productQuantityReference: event.target.value })}
                              placeholder="Ej. referencia de producto por litro, funda o nota operativa."
                            />
                          </div>

                          <div className="space-y-2 md:col-span-2 xl:col-span-3">
                            <Label htmlFor={`line-notes-${index}`}>Notas de linea</Label>
                            <Input
                              id={`line-notes-${index}`}
                              className="rounded-xl"
                              value={line.notes ?? ""}
                              onChange={(event) => updateLine(index, { notes: event.target.value })}
                              placeholder="Opcional. Ej. producto pendiente de homologacion."
                            />
                          </div>
                        </div>

                        <div className="mt-3 rounded-[18px] bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                          {selectedProduct ? (
                            <>Vinculado a Bodega: {selectedProduct.productCode} / {selectedProduct.productName} / {selectedProduct.categoryPathLabel} / Unidad {selectedProduct.baseUnitCode}</>
                          ) : selectedLaboratoryProduct ? (
                            <>Vinculado a Laboratorio: {selectedLaboratoryProduct.productCode} / {selectedLaboratoryProduct.productName} / Unidad {selectedLaboratoryProduct.baseUnitCode}</>
                          ) : (
                            <>Linea aun no homologada a {line.productOrigin === "LABORATORIO" ? "Laboratorio" : "Bodega"}. Se mantiene como fuente pendiente para corregirla luego.</>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {formErrors.lines ? <p className="text-xs text-destructive">{formErrors.lines}</p> : null}
              </div>

              <div className="rounded-[22px] border border-border/70 bg-background/75 px-4 py-4 text-sm">
                <p className="font-semibold">3. Resumen de la semana</p>
                <div className="mt-3 grid gap-2 text-muted-foreground md:grid-cols-2">
                  <p>Grupo base: {formatGroupTitle(formValues.cycleType, formValues.varietyCode || "...")}</p>
                  <p>Semanas en el grupo: {selectedWeekCount}</p>
                  <p>Clave completa: {buildRuleCode(formValues)}</p>
                  <p>Lineas registradas: {formValues.lines.length}</p>
                  <p>Actividad vinculada: {DRENCH_PROGRAM_ACTIVITY_ID}</p>
                  <p>Lineas homologadas: {selectedMatchedLines}</p>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" className="rounded-full" onClick={resetForm} disabled={!isDirty || isSaving}>
                  Restablecer
                </Button>
                <Button type="submit" className="rounded-full" disabled={isSaving || isDeleting}>
                  {isSaving ? (
                    <>Guardando…</>
                  ) : (
                    <>
                      <Save className="size-4" />
                      Guardar semana
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {isCreateGroupOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
          <Card className="w-full max-w-xl border-border/80 bg-background shadow-2xl">
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-slate-900/10 p-3 text-slate-700 dark:bg-slate-900/20 dark:text-white">
                  <Sparkles className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <CardTitle className="text-lg">Nuevo grupo base</CardTitle>
                  <CardDescription>Define la variedad y el tipo SP. Luego crearas las semanas dentro de ese grupo.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="create-group-variety">Variedad</Label>
                  <Input
                    id="create-group-variety"
                    className="rounded-xl"
                    value={createGroupDraft.varietyCode}
                    onChange={(event) => setCreateGroupDraft((current) => ({ ...current, varietyCode: event.target.value.toUpperCase() }))}
                    placeholder="Ej. CLO, XL, ZIN"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-group-cycle">Tipo SP</Label>
                  <select
                    id="create-group-cycle"
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={createGroupDraft.cycleType}
                    onChange={(event) => setCreateGroupDraft((current) => ({ ...current, cycleType: event.target.value as DrenchProgramRuleInput["cycleType"] }))}
                  >
                    <option value="S">Siembra</option>
                    <option value="P">Poda</option>
                  </select>
                </div>
              </div>
              <div className="rounded-[18px] border border-border/70 bg-background/75 px-4 py-3 text-sm">
                <span className="text-muted-foreground">Resultado:</span>{" "}
                <span className="font-semibold">{formatGroupTitle(createGroupDraft.cycleType, createGroupDraft.varietyCode || "---")}</span>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" className="rounded-full" onClick={() => setIsCreateGroupOpen(false)}>
                  Cancelar
                </Button>
                <Button type="button" className="rounded-full" onClick={confirmCreateGroup}>
                  <Plus className="size-4" />
                  Crear grupo base
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
