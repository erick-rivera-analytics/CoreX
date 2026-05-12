import "server-only";

import { query } from "@/lib/db";
import {
  createCommercialSimpleMasterRecord,
  listCurrentCommercialSimpleMasterRecords,
  updateCommercialSimpleMasterRecord,
} from "@/lib/commercial-masters";
import type {
  CommercialAccountExecutiveInput,
  CommercialAccountExecutiveRecord,
} from "@/lib/commercial-account-executives-types";
import type { QualitySimpleMasterInput } from "@/lib/quality-master-types";

function normalizeText(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().replace(/\s+/g, " ");
  return normalized || null;
}

function normalizeCode(value: string | null | undefined) {
  return normalizeText(value)?.toUpperCase() ?? null;
}

function normalizeEmail(value: string | null | undefined) {
  return normalizeText(value)?.toLowerCase() ?? null;
}

function toText(value: unknown) {
  if (value == null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}

function mapSimpleRecord(record: Awaited<ReturnType<typeof listCurrentCommercialSimpleMasterRecords>>[number]): CommercialAccountExecutiveRecord {
  const personCode = record.externalRefCode && record.externalRefCode.toUpperCase() !== "NA"
    ? record.externalRefCode
    : null;

  return {
    entityId: record.entityId,
    code: record.code,
    name: record.name,
    description: record.description,
    personCode,
    contactEmail: record.contactEmail,
    sourceMode: personCode ? "personnel" : "manual",
    isActive: record.isActive,
    validFrom: record.validFrom,
    validTo: record.validTo,
    loadedAt: record.loadedAt,
    runId: record.runId,
    actorId: record.actorId,
    changeReason: record.changeReason,
  };
}

function searchTokens(queryText: string) {
  return queryText.trim().split(/\s+/).filter(Boolean).slice(0, 6);
}

async function queryPersonnelCandidates(whereSql: string, values: unknown[]) {
  const result = await query<{
    person_id: string;
    person_name: string | null;
    national_id: string | null;
    area_id: string | null;
    area_name: string | null;
    area_general: string | null;
    job_title: string | null;
    job_classification_code: string | null;
    employee_type: string | null;
    email: string | null;
  }>(
    `
      with latest_profile as (
        select distinct on (person_id)
          person_id,
          person_name,
          national_id,
          job_title,
          job_classification_code,
          employee_type,
          email
        from slv.tthh_dim_person_profile_scd2
        where is_current = true
          and is_valid = true
        order by person_id, valid_from desc nulls last
      ),
      current_area as (
        select distinct on (event.person_id)
          event.person_id,
          event.area_id,
          area.area_name,
          area.area_general
        from slv.tthh_asgn_person_area_event_scd2 event
        left join slv.camp_dim_area_profile_scd2 area
          on area.area_id = event.area_id
         and area.is_current = true
         and area.is_valid = true
        where event.is_current = true
          and event.is_valid = true
          and event.event_type in ('CA', 'IS')
          and event.area_id <> 'UNKNOWN'
        order by event.person_id, case when event.event_type = 'CA' then 0 else 1 end, event.valid_from desc
      )
      select
        profile.person_id,
        profile.person_name,
        profile.national_id,
        current_area.area_id,
        current_area.area_name,
        current_area.area_general,
        profile.job_title,
        profile.job_classification_code,
        profile.employee_type,
        profile.email
      from latest_profile profile
      left join current_area
        on current_area.person_id = profile.person_id
      where upper(coalesce(profile.job_classification_code, '')) <> 'AGRICOLA'
        and exists (
          select 1
          from slv.tthh_asgn_person_area_event_scd2 active
          where active.person_id = profile.person_id
            and active.event_type = 'IS'
            and active.is_current = true
            and active.is_valid = true
            and active.area_id <> 'UNKNOWN'
            and current_date >= active.valid_from::date
            and current_date < coalesce(active.valid_to::date, date '9999-12-31')
        )
        and ${whereSql}
      order by profile.person_name asc nulls last, profile.person_id asc
      limit 25
    `,
    values,
  );

  return result.rows.map((row) => ({
    personCode: row.person_id,
    personName: toText(row.person_name) ?? row.person_id,
    nationalId: toText(row.national_id),
    areaId: toText(row.area_id),
    areaName: toText(row.area_name),
    areaGeneral: toText(row.area_general),
    jobTitle: toText(row.job_title),
    jobClassificationCode: toText(row.job_classification_code),
    employeeType: toText(row.employee_type),
    email: normalizeEmail(row.email),
  }));
}

export async function searchCommercialPersonnelCandidates(queryText: string) {
  const tokens = searchTokens(queryText);
  if (tokens.length === 0) {
    return [];
  }

  const values: unknown[] = [];
  const tokenWhere = tokens.map((token) => {
    values.push(`%${token.replace(/[%_\\]/g, "\\$&")}%`);
    const parameterIndex = values.length;
    return `
      (
        profile.person_id ilike $${parameterIndex} escape '\\'
        or profile.person_name ilike $${parameterIndex} escape '\\'
        or profile.national_id ilike $${parameterIndex} escape '\\'
      )
    `;
  });

  return queryPersonnelCandidates(tokenWhere.join(" and "), values);
}

async function loadCommercialPersonnelCandidate(personCode: string) {
  const normalizedPersonCode = normalizeCode(personCode);
  if (!normalizedPersonCode) {
    return null;
  }

  const results = await queryPersonnelCandidates("profile.person_id = $1", [normalizedPersonCode]);
  return results[0] ?? null;
}

function sanitizeCommercialAccountExecutiveInput(input: CommercialAccountExecutiveInput) {
  const naPersonalCode = Boolean(input.naPersonalCode);
  const personCode = normalizeCode(input.personCode);
  const executiveName = normalizeText(input.executiveName);
  const contactEmail = normalizeEmail(input.contactEmail);
  const description = normalizeText(input.description);
  const changeReason = normalizeText(input.changeReason);

  if (!contactEmail) {
    throw new Error("El correo del ejecutivo es obligatorio.");
  }

  if (!naPersonalCode && !personCode) {
    throw new Error("Debes seleccionar un colaborador elegible para crear el ejecutivo.");
  }

  if (naPersonalCode && !executiveName) {
    throw new Error("El nombre del ejecutivo es obligatorio cuando cod_personal es NA.");
  }

  return {
    naPersonalCode,
    personCode,
    executiveName,
    contactEmail,
    description,
    isActive: Boolean(input.isActive),
    changeReason,
  };
}

function slugifyNameToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "")
    .toUpperCase();
}

function buildExecutiveCode(name: string) {
  const normalizedName = normalizeText(name) ?? "";
  const parts = normalizedName.split(" ").filter(Boolean);
  const firstInitial = slugifyNameToken(parts[0]?.slice(0, 1) ?? "X") || "X";
  const surname = slugifyNameToken(parts[parts.length - 1] ?? "EXECUTIVE") || "EXECUTIVE";
  return `EXEC_${firstInitial}${surname}`.slice(0, 64);
}

async function resolveExecutiveCode(baseCode: string, currentEntityId?: string) {
  const currentRows = await listCurrentCommercialSimpleMasterRecords("account-executives");
  const normalizedBaseCode = normalizeCode(baseCode) ?? "EXEC_XEXECUTIVE";
  const usedCodes = new Set(
    currentRows
      .filter((row) => row.entityId !== currentEntityId)
      .map((row) => normalizeCode(row.code))
      .filter(Boolean),
  );

  if (!usedCodes.has(normalizedBaseCode)) {
    return normalizedBaseCode;
  }

  let suffix = 2;
  while (suffix < 10_000) {
    const nextCode = `${normalizedBaseCode}_${suffix}`.slice(0, 64);
    if (!usedCodes.has(nextCode)) {
      return nextCode;
    }
    suffix += 1;
  }

  throw new Error("No se pudo generar un codigo unico para el ejecutivo.");
}

async function mapInputToSimpleMasterInput(
  input: CommercialAccountExecutiveInput,
  currentEntityId?: string,
): Promise<QualitySimpleMasterInput> {
  const sanitized = sanitizeCommercialAccountExecutiveInput(input);

  if (!sanitized.naPersonalCode) {
    const candidate = await loadCommercialPersonnelCandidate(sanitized.personCode!);
    if (!candidate) {
      throw new Error("El colaborador seleccionado ya no esta disponible como personal activo elegible.");
    }
    const executiveCode = await resolveExecutiveCode(buildExecutiveCode(candidate.personName), currentEntityId);

    return {
      code: executiveCode,
      name: candidate.personName,
      description: sanitized.description,
      externalRefCode: candidate.personCode,
      contactEmail: sanitized.contactEmail ?? candidate.email,
      isActive: sanitized.isActive,
      changeReason: sanitized.changeReason,
    };
  }

  const executiveCode = await resolveExecutiveCode(buildExecutiveCode(sanitized.executiveName!), currentEntityId);

  return {
    code: executiveCode,
    name: sanitized.executiveName!,
    description: sanitized.description,
    externalRefCode: "NA",
    contactEmail: sanitized.contactEmail,
    isActive: sanitized.isActive,
    changeReason: sanitized.changeReason,
  };
}

export async function listCommercialAccountExecutives() {
  const rows = await listCurrentCommercialSimpleMasterRecords("account-executives");
  return rows.map(mapSimpleRecord);
}

export async function createCommercialAccountExecutive(input: CommercialAccountExecutiveInput, actorId: string) {
  const mappedInput = await mapInputToSimpleMasterInput(input);
  const created = await createCommercialSimpleMasterRecord("account-executives", mappedInput, actorId);
  return created ? mapSimpleRecord(created) : null;
}

export async function updateCommercialAccountExecutive(entityId: string, input: CommercialAccountExecutiveInput, actorId: string) {
  const mappedInput = await mapInputToSimpleMasterInput(input, entityId);
  const updated = await updateCommercialSimpleMasterRecord("account-executives", entityId, mappedInput, actorId);
  return updated ? mapSimpleRecord(updated) : null;
}
