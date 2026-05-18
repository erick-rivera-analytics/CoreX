import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import type { PoolClient } from "pg";
import sharp from "sharp";

import { canAccessResource } from "@/lib/access-control";
import { getSessionUser } from "@/lib/auth";
import { listCurrentGeneralSimpleMasterRecords } from "@/lib/general-masters";
import { listCurrentPostharvestDestinations } from "@/lib/postcosecha-destinos";
import {
  listCurrentCommercialClaimProblems,
  listCurrentCommercialSimpleMasterRecords,
} from "@/lib/commercial-masters";
import { queryCommercial, withCommercialTransaction } from "@/lib/commercial-db";

export type CommercialClaimScope = "quality" | "commercial";
export type CommercialClaimCreditApplicability = "credit-note" | "not-applicable";
export type CommercialClaimStatusKey = "registered" | "pending-approval" | "rejected" | "pending-application" | "applied";

export type CommercialClaimOption = {
  value: string;
  label: string;
  meta?: string | null;
};

export type CommercialClaimFormInput = {
  claimScope: CommercialClaimScope;
  creditNoteApplicability: CommercialClaimCreditApplicability;
  customerId: string;
  commercializerId: string;
  accountExecutiveId: string;
  farmId: string;
  varietyId: string;
  skuCode: string;
  processDestinationId: string | null;
  processNotApplicable?: boolean;
  problemFamilyId: string | null;
  problemId: string;
  referenceOrderNumber: string | null;
  referenceInvoiceNumber: string | null;
  customerCreditRequestDate: string | null;
  customerDispatchDate: string | null;
  claimedBunchesQty: string | null;
  claimedAmountUsd: string | null;
  eventDate: string | null;
  subject: string;
  description: string | null;
};

export type CommercialClaimAttachmentRecord = {
  attachmentId: string;
  claimId: string;
  originalFileName: string;
  storedFileName: string;
  mimeType: string;
  storedMimeType: string;
  storageRelativePath: string;
  fileSizeBytes: number;
  createdAt: string;
  createdBy: string;
};

export type CommercialClaimDetail = {
  record: CommercialClaimRecord;
  attachments: Array<CommercialClaimAttachmentRecord & { fileUrl: string }>;
};

export type CommercialClaimRecord = {
  claimId: string;
  claimCode: string;
  claimScope: CommercialClaimScope;
  creditNoteApplicability: CommercialClaimCreditApplicability;
  statusKey: CommercialClaimStatusKey;
  statusLabel: string;
  customerId: string | null;
  customerName: string | null;
  commercializerId: string | null;
  commercializerName: string | null;
  accountExecutiveId: string | null;
  accountExecutiveName: string | null;
  farmId: string | null;
  farmName: string | null;
  varietyId: string | null;
  varietyName: string | null;
  skuCode: string | null;
  skuCodes: string[];
  processDestinationId: string | null;
  processDestinationName: string | null;
  problemFamilyId: string | null;
  problemFamilyName: string | null;
  problemId: string | null;
  problemName: string | null;
  referenceOrderNumber: string | null;
  referenceInvoiceNumber: string | null;
  customerCreditRequestDate: string | null;
  customerDispatchDate: string | null;
  claimedBunchesQty: number | null;
  claimedAmountUsd: number | null;
  eventDate: string | null;
  subject: string;
  description: string | null;
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

export type CommercialClaimModuleData = {
  access: {
    canRegister: boolean;
    canApprove: boolean;
    canApply: boolean;
  };
  readiness: {
    customers: number;
    commercializers: number;
    accountExecutives: number;
    farms: number;
    varieties: number;
    destinations: number;
    claimProblemFamilies: number;
    claimProblems: number;
  };
  options: {
    customers: CommercialClaimOption[];
    commercializers: CommercialClaimOption[];
    accountExecutives: CommercialClaimOption[];
    farms: CommercialClaimOption[];
    varieties: CommercialClaimOption[];
    destinations: CommercialClaimOption[];
    problemFamilies: Array<CommercialClaimOption & { scope: CommercialClaimScope | "all" }>;
    problems: Array<CommercialClaimOption & { scope: CommercialClaimScope | "all"; parentProblemId: string | null }>;
  };
  summary: {
    totalClaims: number;
    pendingApprovals: number;
    pendingApplications: number;
    alertsOnly: number;
  };
  statuses: Array<{ key: CommercialClaimStatusKey; label: string; appliesTo: string }>;
  registrationFeed: CommercialClaimRecord[];
  approvalQueue: CommercialClaimRecord[];
  applicationQueue: CommercialClaimRecord[];
  notes: string[];
  lastCreatedClaimId?: string | null;
};

type SanitizedCommercialClaimInput = CommercialClaimFormInput & {
  primarySkuCode: string;
  skuCodesJson: string;
};

type ClaimRow = {
  claim_id: string;
  claim_code: string;
  claim_scope: CommercialClaimScope;
  credit_note_applicability: CommercialClaimCreditApplicability;
  status_key: CommercialClaimStatusKey;
  customer_id: string | null;
  commercializer_id: string | null;
  account_executive_id: string | null;
  farm_id: string | null;
  variety_id: string | null;
  sku_code: string | null;
  claimed_skus_json: unknown | null;
  process_destination_id: string | null;
  problem_family_id: string | null;
  problem_id: string | null;
  reference_order_number: string | null;
  reference_invoice_number: string | null;
  customer_credit_request_date: string | null;
  customer_dispatch_date: string | null;
  claimed_bunches_qty: number | string | null;
  claimed_amount_usd: number | string | null;
  event_date: string | null;
  subject: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  attachment_count?: number | string | null;
};

type ClaimAttachmentRow = {
  attachment_id: string;
  claim_id: string;
  original_file_name: string;
  stored_file_name: string;
  mime_type: string;
  stored_mime_type: string;
  storage_relative_path: string;
  file_size_bytes: number | string;
  created_at: string;
  created_by: string;
};

const CLAIM_TABLE = "public.sls_claim_case_cur";
const CLAIM_EVENT_TABLE = "public.sls_claim_workflow_event_cur";
const CLAIM_ATTACHMENT_TABLE = "public.sls_claim_attachment_cur";
const CLAIM_PHOTO_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const CLAIM_PHOTO_MAX_BYTES = 15 * 1024 * 1024;

const STATUS_LABELS: Record<CommercialClaimStatusKey, string> = {
  registered: "Registrado",
  "pending-approval": "Pendiente",
  rejected: "Rechazado",
  "pending-application": "Aprobado",
  applied: "Aplicado",
};

const COMMERCIAL_CLAIM_STATUSES = [
  { key: "registered", label: "Registered", appliesTo: "Alertas o reclamos sin nota de credito" },
  { key: "pending-approval", label: "Pending approval", appliesTo: "Solo reclamos con nota de credito" },
  { key: "rejected", label: "Rejected", appliesTo: "Reclamos no aprobados" },
  { key: "pending-application", label: "Pending application", appliesTo: "Reclamos aprobados y listos para aplicar" },
  { key: "applied", label: "Applied", appliesTo: "Reclamos ya aplicados" },
] as const satisfies Array<{ key: CommercialClaimStatusKey; label: string; appliesTo: string }>;

declare global {
  var __dashboardCommercialClaimsSetup: Promise<void> | undefined;
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

async function getCommercialClaimAccess() {
  const user = await getSessionUser();
  const allowedResources = user?.allowedResources ?? [];
  const isSuperadmin = user?.roleCode === "superadmin";

  return {
    canRegister: canAccessResource("panel:commercial.claims.registration", allowedResources, isSuperadmin),
    canApprove: canAccessResource("panel:commercial.claims.approval", allowedResources, isSuperadmin),
    canApply: canAccessResource("panel:commercial.claims.application", allowedResources, isSuperadmin),
  };
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = normalizeText(value ?? "");
  return normalized || null;
}

function parseSkuCodes(rawValue: string | null | undefined) {
  const raw = String(rawValue ?? "")
    .replace(/\r/g, "\n")
    .split(/[\n,;]+/)
    .map((item) => normalizeText(item))
    .filter(Boolean);

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const key = item.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique;
}

function coerceSkuCodesJson(value: unknown, fallbackSkuCode: string | null) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }

  if (fallbackSkuCode) {
    return [fallbackSkuCode];
  }

  return [];
}

function toDateOnly(value: string | null) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function parseOptionalDecimal(value: string | null | undefined, fieldLabel: string) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    return null;
  }

  const sanitized = normalized.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(sanitized)) {
    throw new Error(`${fieldLabel} debe ser numerico.`);
  }

  const numericValue = Number(sanitized);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new Error(`${fieldLabel} debe ser un numero valido mayor o igual a cero.`);
  }

  return numericValue;
}

function parseOptionalInteger(value: string | null | undefined, fieldLabel: string) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    return null;
  }

  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${fieldLabel} debe ser un numero entero.`);
  }

  const numericValue = Number(normalized);
  if (!Number.isInteger(numericValue) || numericValue < 0) {
    throw new Error(`${fieldLabel} debe ser un numero entero valido mayor o igual a cero.`);
  }

  return numericValue;
}

function makeClaimId() {
  return `claim_${crypto.randomUUID()}`;
}

function makeEventId() {
  return `claim_evt_${crypto.randomUUID()}`;
}

function makeAttachmentId() {
  return `claim_att_${crypto.randomUUID()}`;
}

function makeClaimCode() {
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `RCL-${stamp}-${suffix}`;
}

function mapStatusLabel(statusKey: CommercialClaimStatusKey) {
  return STATUS_LABELS[statusKey] ?? statusKey;
}

function readCommercialClaimsNasRoot() {
  const configuredRoot = process.env.COMMERCIAL_CLAIMS_NAS_ROOT?.trim();
  if (!configuredRoot) {
    throw new Error("Configura COMMERCIAL_CLAIMS_NAS_ROOT para guardar fotos de reclamos en el NAS.");
  }
  // Hardening para deploy Linux + Docker:
  //  - `path.normalize` colapsa // duplicados, resuelve . y .., y respeta el
  //    separator del SO (Linux usa /).
  //  - El strip de trailing slash/backslash evita rutas con doble "//" cuando
  //    luego concatenamos con `path.join(nasRoot, relativePath)`.
  // Si el operador puso por error \\10.0.2.15\... (UNC Windows) corriendo
  // en Linux, la ruta sigue siendo inválida — pero al menos los typos de
  // trailing slash dejan de ser un problema.
  return path.normalize(configuredRoot).replace(/[/\\]+$/, "");
}

function sanitizeFileName(fileName: string) {
  const normalized = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "attachment";
}

function buildClaimAttachmentRelativePath(claimCode: string, attachmentId: string) {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return path.join(year, month, day, claimCode, `${attachmentId}.webp`);
}

function buildOptionMap(items: CommercialClaimOption[]) {
  return new Map(items.map((item) => [item.value, item]));
}

async function ensureCommercialClaimTables(client?: PoolClient) {
  const runQuery = (text: string) => (client ? client.query(text) : queryCommercial(text));

  await runQuery(`
    create table if not exists ${CLAIM_TABLE} (
      claim_id text primary key,
      claim_code text not null,
      claim_scope text not null,
      credit_note_applicability text not null,
      status_key text not null,
      customer_id text null,
      commercializer_id text null,
      account_executive_id text null,
      farm_id text null,
      variety_id text null,
      sku_code text null,
      claimed_skus_json jsonb null,
      process_destination_id text null,
      problem_family_id text null,
      problem_id text null,
      reference_order_number text null,
      reference_invoice_number text null,
      customer_credit_request_date date null,
      customer_dispatch_date date null,
      claimed_bunches_qty numeric(18,2) null,
      claimed_amount_usd numeric(18,2) null,
      event_date date null,
      subject text not null,
      description text null,
      is_active boolean not null default true,
      created_at timestamp without time zone not null,
      updated_at timestamp without time zone not null,
      created_by text not null,
      updated_by text not null,
      constraint sls_claim_case_cur_scope_chk check (claim_scope in ('quality', 'commercial')),
      constraint sls_claim_case_cur_credit_chk check (credit_note_applicability in ('credit-note', 'not-applicable')),
      constraint sls_claim_case_cur_status_chk check (status_key in ('registered', 'pending-approval', 'rejected', 'pending-application', 'applied'))
    )
  `);

  await runQuery(`
    create unique index if not exists sls_claim_case_cur_code_unique_idx
      on ${CLAIM_TABLE} (lower(claim_code))
  `);

  await runQuery(`
    alter table ${CLAIM_TABLE}
      add column if not exists sku_code text null,
      add column if not exists claimed_skus_json jsonb null,
      add column if not exists customer_credit_request_date date null,
      add column if not exists customer_dispatch_date date null,
      add column if not exists claimed_bunches_qty numeric(18,2) null,
      add column if not exists claimed_amount_usd numeric(18,2) null
  `);

  await runQuery(`
    alter table ${CLAIM_TABLE}
      alter column claimed_bunches_qty type integer
      using case
        when claimed_bunches_qty is null then null
        else round(claimed_bunches_qty)::integer
      end
  `);

  await runQuery(`
    alter table ${CLAIM_TABLE}
      alter column claimed_amount_usd type numeric(18,2)
      using case
        when claimed_amount_usd is null then null
        else round(claimed_amount_usd::numeric, 2)
      end
  `);

  await runQuery(`
    create index if not exists sls_claim_case_cur_status_idx
      on ${CLAIM_TABLE} (status_key, created_at desc)
  `);

  await runQuery(`
    create index if not exists sls_claim_case_cur_scope_idx
      on ${CLAIM_TABLE} (claim_scope, created_at desc)
  `);

  await runQuery(`
    create table if not exists ${CLAIM_EVENT_TABLE} (
      event_id text primary key,
      claim_id text not null,
      status_key text not null,
      event_type text not null,
      event_note text null,
      created_at timestamp without time zone not null,
      actor_id text not null
    )
  `);

  await runQuery(`
    create index if not exists sls_claim_workflow_event_cur_claim_idx
      on ${CLAIM_EVENT_TABLE} (claim_id, created_at desc)
  `);

  await runQuery(`
    create table if not exists ${CLAIM_ATTACHMENT_TABLE} (
      attachment_id text primary key,
      claim_id text not null,
      original_file_name text not null,
      stored_file_name text not null,
      mime_type text not null,
      stored_mime_type text not null,
      storage_relative_path text not null,
      file_size_bytes integer not null,
      created_at timestamp without time zone not null,
      created_by text not null
    )
  `);

  await runQuery(`
    create index if not exists sls_claim_attachment_cur_claim_idx
      on ${CLAIM_ATTACHMENT_TABLE} (claim_id, created_at desc)
  `);
}

async function initializeCommercialClaims() {
  if (!global.__dashboardCommercialClaimsSetup) {
    global.__dashboardCommercialClaimsSetup = ensureCommercialClaimTables();
  }

  return global.__dashboardCommercialClaimsSetup;
}

function sanitizeClaimInput(input: CommercialClaimFormInput): SanitizedCommercialClaimInput {
  const subject = normalizeOptionalText(input.subject) ?? "SIN ASUNTO";

  const customerId = normalizeOptionalText(input.customerId);
  const commercializerId = normalizeOptionalText(input.commercializerId);
  const accountExecutiveId = normalizeOptionalText(input.accountExecutiveId);
  const farmId = normalizeOptionalText(input.farmId);
  const varietyId = normalizeOptionalText(input.varietyId);
  const skuCodes = parseSkuCodes(input.skuCode);
  const skuCode = skuCodes[0] ?? null;
  const processDestinationId = normalizeOptionalText(input.processDestinationId);
  const problemFamilyId = normalizeOptionalText(input.problemFamilyId);
  const problemId = normalizeOptionalText(input.problemId);

  if (!customerId) throw new Error("Debes seleccionar un cliente.");
  if (!commercializerId) throw new Error("Debes seleccionar una comercializadora.");
  if (!accountExecutiveId) throw new Error("Debes seleccionar un ejecutivo de cuenta.");
  if (!farmId) throw new Error("Debes seleccionar una finca.");
  if (!varietyId) throw new Error("Debes seleccionar una variedad.");
  if (skuCodes.length === 0) throw new Error("Debes registrar al menos un SKU.");
  if (!input.processNotApplicable && !processDestinationId) {
    throw new Error("Debes seleccionar un proceso o marcar que no aplica.");
  }
  if (!problemFamilyId) throw new Error("Debes seleccionar un tipo de problema.");
  if (!problemId) throw new Error("Debes seleccionar un problema.");

  const referenceOrderNumber = normalizeOptionalText(input.referenceOrderNumber);
  const referenceInvoiceNumber = normalizeOptionalText(input.referenceInvoiceNumber);

  if (!referenceInvoiceNumber || !/^\d{7}$/.test(referenceInvoiceNumber)) {
    throw new Error("La factura comercializadora debe tener exactamente 7 digitos numericos.");
  }

  if (!referenceOrderNumber || !/^\d{8}$/.test(referenceOrderNumber)) {
    throw new Error("El numero de pedido debe tener exactamente 8 digitos numericos.");
  }

  const eventDate = normalizeOptionalText(input.eventDate);
  const customerCreditRequestDate = normalizeOptionalText(input.customerCreditRequestDate);
  const customerDispatchDate = normalizeOptionalText(input.customerDispatchDate);
  if (!eventDate) {
    throw new Error("Debes registrar la fecha del caso.");
  }
  if (input.creditNoteApplicability === "credit-note" && !customerCreditRequestDate) {
    throw new Error("Debes registrar la fecha de solicitud de credito por el cliente.");
  }
  if (!customerDispatchDate) {
    throw new Error("Debes registrar la fecha de despacho a cliente.");
  }

  const claimedBunchesQty = parseOptionalInteger(input.claimedBunchesQty, "Cantidad en bunches");
  const claimedAmountUsd = input.creditNoteApplicability === "credit-note"
    ? parseOptionalDecimal(input.claimedAmountUsd, "Cantidad en dolares")
    : null;
  if (claimedBunchesQty === null) {
    throw new Error("Debes registrar la cantidad en bunches.");
  }
  if (input.creditNoteApplicability === "credit-note" && claimedAmountUsd === null) {
    throw new Error("Debes registrar la cantidad en dolares.");
  }

  return {
    claimScope: input.claimScope,
    creditNoteApplicability: input.creditNoteApplicability,
    customerId,
    commercializerId,
    accountExecutiveId,
    farmId,
    varietyId,
    skuCode: skuCodes.join("\n"),
    primarySkuCode: skuCode,
    skuCodesJson: JSON.stringify(skuCodes),
    processDestinationId: input.processNotApplicable ? null : processDestinationId,
    processNotApplicable: Boolean(input.processNotApplicable),
    problemFamilyId,
    problemId,
    referenceOrderNumber,
    referenceInvoiceNumber,
    customerCreditRequestDate: input.creditNoteApplicability === "credit-note" ? customerCreditRequestDate : null,
    customerDispatchDate,
    claimedBunchesQty: String(claimedBunchesQty),
    claimedAmountUsd: claimedAmountUsd === null ? null : String(claimedAmountUsd),
    eventDate,
    subject,
    description: normalizeOptionalText(input.description),
  };
}

function mapClaimRow(
  row: ClaimRow,
  maps: {
    customers: Map<string, CommercialClaimOption>;
    commercializers: Map<string, CommercialClaimOption>;
    executives: Map<string, CommercialClaimOption>;
    farms: Map<string, CommercialClaimOption>;
    varieties: Map<string, CommercialClaimOption>;
    destinations: Map<string, CommercialClaimOption>;
    families: Map<string, CommercialClaimOption>;
    problems: Map<string, CommercialClaimOption>;
  },
): CommercialClaimRecord {
  return {
    claimId: row.claim_id,
    claimCode: row.claim_code,
    claimScope: row.claim_scope,
    creditNoteApplicability: row.credit_note_applicability,
    statusKey: row.status_key,
    statusLabel: mapStatusLabel(row.status_key),
    customerId: row.customer_id,
    customerName: row.customer_id ? maps.customers.get(row.customer_id)?.label ?? null : null,
    commercializerId: row.commercializer_id,
    commercializerName: row.commercializer_id ? maps.commercializers.get(row.commercializer_id)?.label ?? null : null,
    accountExecutiveId: row.account_executive_id,
    accountExecutiveName: row.account_executive_id ? maps.executives.get(row.account_executive_id)?.label ?? null : null,
    farmId: row.farm_id,
    farmName: row.farm_id ? maps.farms.get(row.farm_id)?.label ?? null : null,
    varietyId: row.variety_id,
    varietyName: row.variety_id ? maps.varieties.get(row.variety_id)?.label ?? null : null,
    skuCode: row.sku_code,
    skuCodes: coerceSkuCodesJson(row.claimed_skus_json, row.sku_code),
    processDestinationId: row.process_destination_id,
    processDestinationName: row.process_destination_id ? maps.destinations.get(row.process_destination_id)?.label ?? null : "NO APLICA",
    problemFamilyId: row.problem_family_id,
    problemFamilyName: row.problem_family_id ? maps.families.get(row.problem_family_id)?.label ?? null : null,
    problemId: row.problem_id,
    problemName: row.problem_id ? maps.problems.get(row.problem_id)?.label ?? null : null,
    referenceOrderNumber: row.reference_order_number,
    referenceInvoiceNumber: row.reference_invoice_number,
    customerCreditRequestDate: toDateOnly(row.customer_credit_request_date),
    customerDispatchDate: toDateOnly(row.customer_dispatch_date),
    claimedBunchesQty: row.claimed_bunches_qty === null ? null : Number(row.claimed_bunches_qty),
    claimedAmountUsd: row.claimed_amount_usd === null ? null : Number(row.claimed_amount_usd),
    eventDate: toDateOnly(row.event_date),
    subject: row.subject,
    description: row.description,
    attachmentCount: Number(row.attachment_count ?? 0),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  };
}

async function listCurrentClaimRows() {
  await initializeCommercialClaims();
  const result = await queryCommercial<ClaimRow>(
    `
      select
        claim.claim_id,
        claim.claim_code,
        claim.claim_scope,
        claim.credit_note_applicability,
        claim.status_key,
        claim.customer_id,
        claim.commercializer_id,
        claim.account_executive_id,
        claim.farm_id,
        claim.variety_id,
        claim.sku_code,
        claim.claimed_skus_json,
        claim.process_destination_id,
        claim.problem_family_id,
        claim.problem_id,
        claim.reference_order_number,
        claim.reference_invoice_number,
        claim.customer_credit_request_date,
        claim.customer_dispatch_date,
        claim.claimed_bunches_qty,
        claim.claimed_amount_usd,
        claim.event_date,
        claim.subject,
        claim.description,
        claim.created_at,
        claim.updated_at,
        claim.created_by,
        claim.updated_by,
        coalesce(attachments.attachment_count, 0) as attachment_count
      from ${CLAIM_TABLE} claim
      left join (
        select claim_id, count(*)::int as attachment_count
        from ${CLAIM_ATTACHMENT_TABLE}
        group by claim_id
      ) attachments
        on attachments.claim_id = claim.claim_id
      where claim.is_active = true
      order by claim.created_at desc
      limit 200
    `,
  );

  return result.rows;
}

async function getCommercialClaimRowById(claimId: string) {
  await initializeCommercialClaims();
  const result = await queryCommercial<ClaimRow>(
    `
      select
        claim_id,
        claim_code,
        claim_scope,
        credit_note_applicability,
        status_key,
        customer_id,
        commercializer_id,
        account_executive_id,
        farm_id,
        variety_id,
        sku_code,
        claimed_skus_json,
        process_destination_id,
        problem_family_id,
        problem_id,
        reference_order_number,
        reference_invoice_number,
        customer_credit_request_date,
        customer_dispatch_date,
        claimed_bunches_qty,
        claimed_amount_usd,
        event_date,
        subject,
        description,
        created_at,
        updated_at,
        created_by,
        updated_by
      from ${CLAIM_TABLE}
      where claim_id = $1
        and is_active = true
      limit 1
    `,
    [claimId],
  );

  return result.rows[0] ?? null;
}

async function listClaimAttachmentRows(claimId: string) {
  await initializeCommercialClaims();
  const result = await queryCommercial<ClaimAttachmentRow>(
    `
      select
        attachment_id,
        claim_id,
        original_file_name,
        stored_file_name,
        mime_type,
        stored_mime_type,
        storage_relative_path,
        file_size_bytes,
        created_at,
        created_by
      from ${CLAIM_ATTACHMENT_TABLE}
      where claim_id = $1
      order by created_at asc
    `,
    [claimId],
  );

  return result.rows;
}

function mapAttachmentRow(row: ClaimAttachmentRow): CommercialClaimAttachmentRecord {
  return {
    attachmentId: row.attachment_id,
    claimId: row.claim_id,
    originalFileName: row.original_file_name,
    storedFileName: row.stored_file_name,
    mimeType: row.mime_type,
    storedMimeType: row.stored_mime_type,
    storageRelativePath: row.storage_relative_path,
    fileSizeBytes: Number(row.file_size_bytes),
    createdAt: new Date(row.created_at).toISOString(),
    createdBy: row.created_by,
  };
}

export async function getCommercialClaimModuleData(): Promise<CommercialClaimModuleData> {
  const [
    access,
    customers,
    commercializers,
    accountExecutives,
    farms,
    varieties,
    destinations,
    claimProblems,
    claimRows,
  ] = await Promise.all([
    getCommercialClaimAccess(),
    listCurrentCommercialSimpleMasterRecords("customers"),
    listCurrentCommercialSimpleMasterRecords("commercializers"),
    listCurrentCommercialSimpleMasterRecords("account-executives"),
    listCurrentGeneralSimpleMasterRecords("farms"),
    listCurrentGeneralSimpleMasterRecords("varieties"),
    listCurrentPostharvestDestinations(),
    listCurrentCommercialClaimProblems(),
    listCurrentClaimRows(),
  ]);

  const customerOptions = customers.map((item) => ({ value: item.entityId, label: item.name, meta: item.code }));
  const commercializerOptions = commercializers.map((item) => ({ value: item.entityId, label: item.name, meta: item.code }));
  const executiveOptions = accountExecutives
    .filter((item) => item.isActive)
    .map((item) => ({ value: item.entityId, label: item.name, meta: item.code }));
  const farmOptions = farms.map((item) => ({ value: item.entityId, label: item.name, meta: item.code }));
  const varietyOptions = varieties.map((item) => ({ value: item.entityId, label: item.name, meta: item.code }));
  const destinationOptions = destinations.map((item) => ({ value: item.entityId, label: item.name, meta: item.code }));
  const familyOptions = claimProblems
    .filter((item) => item.level === "family")
    .map((item) => ({ value: item.problemId, label: item.name, meta: item.code, scope: item.scope }));
  const problemOptions = claimProblems
    .filter((item) => item.level === "subfamily")
    .map((item) => ({
      value: item.problemId,
      label: item.name,
      meta: item.code,
      scope: item.scope,
      parentProblemId: item.parentProblemId,
    }));

  const maps = {
    customers: buildOptionMap(customerOptions),
    commercializers: buildOptionMap(commercializerOptions),
    executives: buildOptionMap(executiveOptions),
    farms: buildOptionMap(farmOptions),
    varieties: buildOptionMap(varietyOptions),
    destinations: buildOptionMap(destinationOptions),
    families: buildOptionMap(familyOptions),
    problems: buildOptionMap(problemOptions),
  };

  const claims = claimRows.map((row) => mapClaimRow(row, maps));

  return {
    access,
    readiness: {
      customers: customerOptions.length,
      commercializers: commercializerOptions.length,
      accountExecutives: executiveOptions.length,
      farms: farmOptions.length,
      varieties: varietyOptions.length,
      destinations: destinationOptions.length,
      claimProblemFamilies: familyOptions.length,
      claimProblems: problemOptions.length,
    },
    options: {
      customers: customerOptions,
      commercializers: commercializerOptions,
      accountExecutives: executiveOptions,
      farms: farmOptions,
      varieties: varietyOptions,
      destinations: destinationOptions,
      problemFamilies: familyOptions,
      problems: problemOptions,
    },
    summary: {
      totalClaims: claims.length,
      pendingApprovals: claims.filter((item) => item.statusKey === "pending-approval").length,
      pendingApplications: claims.filter((item) => item.statusKey === "pending-application").length,
      alertsOnly: claims.filter((item) => item.creditNoteApplicability === "not-applicable").length,
    },
    statuses: [...COMMERCIAL_CLAIM_STATUSES],
    registrationFeed: claims.slice(0, 24),
    approvalQueue: claims.filter((item) => item.statusKey === "pending-approval"),
    applicationQueue: claims.filter((item) => item.statusKey === "pending-application"),
    notes: [
      "La ruta Comercial / Reclamos ahora persiste registros reales en db_commercial.public.",
      "Si un reclamo no aplica nota de credito, queda como alerta registrada y no entra a Aprobaciones ni Aplicaciones.",
      "La relacion Tipo de problema -> Problema sigue pendiente; por eso los problemas hoy se mantienen sin parent_problem_id.",
      "El campo visual Proceso consume Postcosecha / Destinos y el no aplica se controla desde la propia vista de reclamos.",
      "Las fotos se guardan en una ruta NAS configurable por COMMERCIAL_CLAIMS_NAS_ROOT y quedan relacionadas al reclamo.",
    ],
    lastCreatedClaimId: null,
  };
}

export async function getCommercialClaimDetail(claimId: string): Promise<CommercialClaimDetail> {
  const moduleData = await getCommercialClaimModuleData();
  const record = moduleData.registrationFeed
    .concat(moduleData.approvalQueue)
    .concat(moduleData.applicationQueue)
    .find((item) => item.claimId === claimId);

  if (!record) {
    const allRows = await listCurrentClaimRows();
    const row = allRows.find((item) => item.claim_id === claimId);
    if (!row) {
      throw new Error("No se encontro el reclamo solicitado.");
    }

    const detailModuleData = await getCommercialClaimModuleData();
    const fallbackRecord = detailModuleData.registrationFeed
      .concat(detailModuleData.approvalQueue)
      .concat(detailModuleData.applicationQueue)
      .find((item) => item.claimId === claimId);

    if (!fallbackRecord) {
      throw new Error("No se pudo reconstruir el detalle del reclamo solicitado.");
    }

    const attachments = (await listClaimAttachmentRows(claimId)).map((attachment) => ({
      ...mapAttachmentRow(attachment),
      fileUrl: `/api/comercial/reclamos/${encodeURIComponent(claimId)}/attachments/${encodeURIComponent(attachment.attachment_id)}`,
    }));

    return {
      record: fallbackRecord,
      attachments,
    };
  }

  const attachments = (await listClaimAttachmentRows(claimId)).map((attachment) => ({
    ...mapAttachmentRow(attachment),
    fileUrl: `/api/comercial/reclamos/${encodeURIComponent(claimId)}/attachments/${encodeURIComponent(attachment.attachment_id)}`,
  }));

  return {
    record,
    attachments,
  };
}

export async function getCommercialClaimAttachmentBinary(claimId: string, attachmentId: string) {
  const attachmentRows = await listClaimAttachmentRows(claimId);
  const attachment = attachmentRows.find((item) => item.attachment_id === attachmentId);

  if (!attachment) {
    throw new Error("No se encontro el adjunto solicitado para este reclamo.");
  }

  const nasRoot = readCommercialClaimsNasRoot();
  const absolutePath = path.join(nasRoot, attachment.storage_relative_path);
  const buffer = await fs.readFile(absolutePath);

  return {
    buffer,
    mimeType: attachment.stored_mime_type,
    fileName: attachment.stored_file_name,
  };
}

export async function createCommercialClaim(input: CommercialClaimFormInput, actorId: string) {
  await initializeCommercialClaims();
  const sanitized = sanitizeClaimInput(input);

  const claimId = makeClaimId();
  const claimCode = makeClaimCode();
  const now = new Date();
  const statusKey: CommercialClaimStatusKey = sanitized.creditNoteApplicability === "credit-note"
    ? "pending-approval"
    : "registered";

  await withCommercialTransaction(async (client) => {
    await ensureCommercialClaimTables(client);
    await client.query(
      `
        insert into ${CLAIM_TABLE} (
          claim_id,
          claim_code,
          claim_scope,
          credit_note_applicability,
          status_key,
          customer_id,
          commercializer_id,
          account_executive_id,
          farm_id,
          variety_id,
          sku_code,
          claimed_skus_json,
          process_destination_id,
          problem_family_id,
          problem_id,
          reference_order_number,
          reference_invoice_number,
          customer_credit_request_date,
          customer_dispatch_date,
          claimed_bunches_qty,
          claimed_amount_usd,
          event_date,
          subject,
          description,
          is_active,
          created_at,
          updated_at,
          created_by,
          updated_by
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $15, $16, $17, $18::date, $19::date, $20::numeric, $21::numeric, $22::date, $23, $24, true, $25, $25, $26, $26
        )
      `,
      [
        claimId,
        claimCode,
        sanitized.claimScope,
        sanitized.creditNoteApplicability,
        statusKey,
        sanitized.customerId,
        sanitized.commercializerId,
        sanitized.accountExecutiveId,
        sanitized.farmId,
        sanitized.varietyId,
        sanitized.primarySkuCode,
        sanitized.skuCodesJson,
        sanitized.processDestinationId,
        sanitized.problemFamilyId,
        sanitized.problemId,
        sanitized.referenceOrderNumber,
        sanitized.referenceInvoiceNumber,
        sanitized.customerCreditRequestDate,
        sanitized.customerDispatchDate,
        sanitized.claimedBunchesQty,
        sanitized.claimedAmountUsd,
        sanitized.eventDate,
        sanitized.subject,
        sanitized.description,
        now,
        actorId,
      ],
    );

    await client.query(
      `
        insert into ${CLAIM_EVENT_TABLE} (
          event_id, claim_id, status_key, event_type, event_note, created_at, actor_id
        ) values ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        makeEventId(),
        claimId,
        statusKey,
        "claim-created",
        sanitized.creditNoteApplicability === "credit-note"
          ? "Reclamo creado y enviado a aprobacion."
          : "Reclamo creado como alerta sin nota de credito.",
        now,
        actorId,
      ],
    );
  });

  const moduleData = await getCommercialClaimModuleData();
  return {
    ...moduleData,
    lastCreatedClaimId: claimId,
  } satisfies CommercialClaimModuleData;
}

export async function decideCommercialClaimApproval(
  claimId: string,
  decision: "approve" | "reject",
  actorId: string,
  note?: string | null,
) {
  await initializeCommercialClaims();
  const now = new Date();
  const nextStatus: CommercialClaimStatusKey = decision === "approve" ? "pending-application" : "rejected";
  const eventType = decision === "approve" ? "claim-approved" : "claim-rejected";

  await withCommercialTransaction(async (client) => {
    await ensureCommercialClaimTables(client);
    const current = await client.query<{ status_key: CommercialClaimStatusKey; credit_note_applicability: CommercialClaimCreditApplicability }>(
      `select status_key, credit_note_applicability from ${CLAIM_TABLE} where claim_id = $1 and is_active = true limit 1`,
      [claimId],
    );

    if (current.rowCount === 0) {
      throw new Error("No se encontro el reclamo que intentas procesar.");
    }

    if (current.rows[0].credit_note_applicability !== "credit-note") {
      throw new Error("Solo los reclamos con nota de credito pueden pasar por Aprobaciones.");
    }

    if (current.rows[0].status_key !== "pending-approval") {
      throw new Error("El reclamo ya no esta pendiente de aprobacion.");
    }

    await client.query(
      `update ${CLAIM_TABLE} set status_key = $2, updated_at = $3, updated_by = $4 where claim_id = $1`,
      [claimId, nextStatus, now, actorId],
    );

    await client.query(
      `
        insert into ${CLAIM_EVENT_TABLE} (
          event_id, claim_id, status_key, event_type, event_note, created_at, actor_id
        ) values ($1, $2, $3, $4, $5, $6, $7)
      `,
      [makeEventId(), claimId, nextStatus, eventType, normalizeOptionalText(note), now, actorId],
    );
  });

  return getCommercialClaimModuleData();
}

export async function applyCommercialClaim(
  claimId: string,
  actorId: string,
  note?: string | null,
) {
  await initializeCommercialClaims();
  const now = new Date();

  await withCommercialTransaction(async (client) => {
    await ensureCommercialClaimTables(client);
    const current = await client.query<{ status_key: CommercialClaimStatusKey }>(
      `select status_key from ${CLAIM_TABLE} where claim_id = $1 and is_active = true limit 1`,
      [claimId],
    );

    if (current.rowCount === 0) {
      throw new Error("No se encontro el reclamo que intentas aplicar.");
    }

    if (current.rows[0].status_key !== "pending-application") {
      throw new Error("Solo los reclamos aprobados pueden aplicarse.");
    }

    await client.query(
      `update ${CLAIM_TABLE} set status_key = 'applied', updated_at = $2, updated_by = $3 where claim_id = $1`,
      [claimId, now, actorId],
    );

    await client.query(
      `
        insert into ${CLAIM_EVENT_TABLE} (
          event_id, claim_id, status_key, event_type, event_note, created_at, actor_id
        ) values ($1, $2, 'applied', 'claim-applied', $3, $4, $5)
      `,
      [makeEventId(), claimId, normalizeOptionalText(note), now, actorId],
    );
  });

  return getCommercialClaimModuleData();
}

export async function attachCommercialClaimPhoto(
  claimId: string,
  file: File,
  actorId: string,
) {
  await initializeCommercialClaims();

  if (!CLAIM_PHOTO_MIME_TYPES.has(file.type)) {
    throw new Error("La foto debe estar en JPG, PNG, WEBP o HEIC/HEIF.");
  }

  if (file.size > CLAIM_PHOTO_MAX_BYTES) {
    throw new Error("La foto supera el maximo permitido de 15 MB.");
  }

  const claim = await getCommercialClaimRowById(claimId);
  if (!claim) {
    throw new Error("No se encontro el reclamo al que intentas adjuntar la foto.");
  }

  const nasRoot = readCommercialClaimsNasRoot();
  const attachmentId = makeAttachmentId();
  const relativePath = buildClaimAttachmentRelativePath(claim.claim_code, attachmentId);
  const absolutePath = path.join(nasRoot, relativePath);
  const originalBuffer = Buffer.from(await file.arrayBuffer());
  const optimizedBuffer = await sharp(originalBuffer)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, optimizedBuffer);

  const now = new Date();
  const row = await withCommercialTransaction(async (client) => {
    await ensureCommercialClaimTables(client);
    const result = await client.query<ClaimAttachmentRow>(
      `
        insert into ${CLAIM_ATTACHMENT_TABLE} (
          attachment_id,
          claim_id,
          original_file_name,
          stored_file_name,
          mime_type,
          stored_mime_type,
          storage_relative_path,
          file_size_bytes,
          created_at,
          created_by
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        )
        returning
          attachment_id,
          claim_id,
          original_file_name,
          stored_file_name,
          mime_type,
          stored_mime_type,
          storage_relative_path,
          file_size_bytes,
          created_at,
          created_by
      `,
      [
        attachmentId,
        claimId,
        sanitizeFileName(file.name),
        path.basename(relativePath),
        file.type || "application/octet-stream",
        "image/webp",
        relativePath,
        optimizedBuffer.byteLength,
        now,
        actorId,
      ],
    );

    return result.rows[0] ?? null;
  });

  if (!row) {
    throw new Error("No se pudo registrar la foto del reclamo.");
  }

  return mapAttachmentRow(row);
}
