import { query } from "@/lib/db";
import { cachedAsync } from "@/lib/server-cache";
import { toNumber } from "@/shared/lib/number-utils";

type MedicalProfileQueryRow = {
  person_name: string | null;
  national_id: string | null;
};

type MedicalExamQueryRow = {
  exam_id: string | number | null;
  fecha: string | null;
  tipo: string | null;
  tipo_norm: string | null;
  trabajador: string | null;
  sexo: string | null;
  edad: string | number | null;
  rbc: string | number | null;
  hemoglobina: string | number | null;
  hematocrito: string | number | null;
  wbc: string | number | null;
  plaquetas: string | number | null;
  glucosa: string | number | null;
  colesterol: string | number | null;
  trigliceridos: string | number | null;
  creatinina: string | number | null;
  tgo_ast: string | number | null;
  tgp_alt: string | number | null;
  colinesterasa: string | number | null;
};

export type MedicalMarkerColor = "green" | "yellow" | "red" | "gray";

export type MedicalMarkerField =
  | "rbc"
  | "hemoglobina"
  | "hematocrito"
  | "wbc"
  | "plaquetas"
  | "glucosa"
  | "colesterol"
  | "trigliceridos"
  | "creatinina"
  | "tgo_ast"
  | "tgp_alt"
  | "colinesterasa";

export type MedicalExamMarker = {
  field: MedicalMarkerField;
  name: string;
  value: number | null;
  unit: string;
  status: string;
  color: MedicalMarkerColor;
  range: string;
  referenceLow: number | null;
  referenceHigh: number | null;
  referenceNote: string | null;
};

export type MedicalPersonExam = {
  examId: number;
  date: string;
  type: string;
  workerName: string | null;
  sex: string | null;
  age: number | null;
  alertsCount: number;
  alertsBand: string;
  markers: MedicalExamMarker[];
};

export type MedicalPersonPayload = {
  personId: string;
  generatedAt: string;
  profile: {
    fullName: string | null;
    nationalId: string | null;
  } | null;
  summary: {
    examsCount: number;
    lastExamDate: string | null;
    lastExamType: string | null;
    availableMarkerCount: number;
    alertExamCount: number;
  };
  exams: MedicalPersonExam[];
};

const MEDICAL_TTL_MS = 60 * 1000;

function getSafeIdentifier(value: string | undefined, fallback: string) {
  const normalized = (value ?? fallback).trim();

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(normalized)) {
    throw new Error(`Invalid SQL identifier: ${normalized}`);
  }

  return normalized;
}

const MEDICAL_SCHEMA = getSafeIdentifier(process.env.MEDICAL_SCHEMA, "tmp_corex_salud");
const MEDICAL_TABLE = getSafeIdentifier(process.env.MEDICAL_TABLE, "person_medical_exams_tmp");
const MEDICAL_SOURCE = `${MEDICAL_SCHEMA}.${MEDICAL_TABLE}`;

function cleanText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function normalizeNationalId(value: string | null | undefined) {
  const digits = cleanText(value).replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  if (digits.length >= 10) {
    return digits;
  }

  return digits.padStart(10, "0");
}

function normalizeSex(value: string | null | undefined) {
  const normalized = cleanText(value).toLowerCase();

  if (normalized.startsWith("m")) {
    return "Masculino";
  }

  if (normalized.startsWith("f")) {
    return "Femenino";
  }

  return null;
}

function buildRangeText(
  label: string,
  options: {
    low?: number | null;
    high?: number | null;
    unit?: string;
    note?: string | null;
  },
) {
  const { low = null, high = null, unit = "", note = null } = options;

  let text = label;

  if (low !== null && high !== null) {
    text = `${label}: ${low} a ${high} ${unit}`.trim();
  } else if (low !== null) {
    text = `${label}: >= ${low} ${unit}`.trim();
  } else if (high !== null) {
    text = `${label}: <= ${high} ${unit}`.trim();
  }

  if (note) {
    return `${text} | ${note}`;
  }

  return text;
}

function buildMarker(
  field: MedicalMarkerField,
  options: {
    name: string;
    value: number | null;
    unit?: string;
    low?: number | null;
    high?: number | null;
    status: string;
    color: MedicalMarkerColor;
    note?: string | null;
  },
): MedicalExamMarker {
  const {
    name,
    value,
    unit = "",
    low = null,
    high = null,
    status,
    color,
    note = null,
  } = options;

  return {
    field,
    name,
    value,
    unit,
    status,
    color,
    range: buildRangeText("Rango", {
      low,
      high,
      unit,
      note,
    }),
    referenceLow: low,
    referenceHigh: high,
    referenceNote: note,
  };
}

function buildMarkers(row: MedicalExamQueryRow) {
  const sex = normalizeSex(row.sexo);
  const markers: MedicalExamMarker[] = [];

  const rbcValue = toNumber(row.rbc);
  const hemoglobinValue = toNumber(row.hemoglobina);
  const hematocritValue = toNumber(row.hematocrito);
  const wbcValue = toNumber(row.wbc);
  const plateletsValue = toNumber(row.plaquetas);
  const glucoseValue = toNumber(row.glucosa);
  const cholesterolValue = toNumber(row.colesterol);
  const triglyceridesValue = toNumber(row.trigliceridos);
  const creatinineValue = toNumber(row.creatinina);
  const astValue = toNumber(row.tgo_ast);
  const altValue = toNumber(row.tgp_alt);
  const cholinesteraseValue = toNumber(row.colinesterasa);

  const rbcLow = sex === "Masculino" ? 4.6 : 4.2;
  const rbcHigh = sex === "Masculino" ? 6.2 : 5.4;
  const hemoglobinLow = sex === "Masculino" ? 13 : 12;
  const hemoglobinHigh = sex === "Masculino" ? 18 : 16;
  const hematocritLow = sex === "Masculino" ? 40 : 36;
  const hematocritHigh = sex === "Masculino" ? 55 : 48;

  function resolveRangeStatus(value: number | null, low: number, high: number) {
    if (value === null) {
      return { status: "Sin dato", color: "gray" as const };
    }

    if (value >= low && value <= high) {
      return { status: "Normal", color: "green" as const };
    }

    return { status: "Fuera de referencia", color: "red" as const };
  }

  {
    const status = resolveRangeStatus(rbcValue, rbcLow, rbcHigh);
    markers.push(
      buildMarker("rbc", {
        name: "RBC",
        value: rbcValue,
        unit: "M/uL",
        low: rbcLow,
        high: rbcHigh,
        status: status.status,
        color: status.color,
        note: sex,
      }),
    );
  }

  {
    const status = resolveRangeStatus(hemoglobinValue, hemoglobinLow, hemoglobinHigh);
    markers.push(
      buildMarker("hemoglobina", {
        name: "Hemoglobina",
        value: hemoglobinValue,
        unit: "g/dL",
        low: hemoglobinLow,
        high: hemoglobinHigh,
        status: status.status,
        color: status.color,
        note: sex,
      }),
    );
  }

  {
    const status = resolveRangeStatus(hematocritValue, hematocritLow, hematocritHigh);
    markers.push(
      buildMarker("hematocrito", {
        name: "Hematocrito",
        value: hematocritValue,
        unit: "%",
        low: hematocritLow,
        high: hematocritHigh,
        status: status.status,
        color: status.color,
        note: sex,
      }),
    );
  }

  {
    const status = resolveRangeStatus(wbcValue, 4.5, 11);
    markers.push(
      buildMarker("wbc", {
        name: "WBC",
        value: wbcValue,
        unit: "K/uL",
        low: 4.5,
        high: 11,
        status: status.status,
        color: status.color,
      }),
    );
  }

  {
    const status = resolveRangeStatus(plateletsValue, 150, 400);
    markers.push(
      buildMarker("plaquetas", {
        name: "Plaquetas",
        value: plateletsValue,
        unit: "K/uL",
        low: 150,
        high: 400,
        status: status.status,
        color: status.color,
      }),
    );
  }

  if (glucoseValue === null) {
    markers.push(
      buildMarker("glucosa", {
        name: "Glucosa",
        value: glucoseValue,
        unit: "mg/dL",
        low: 70,
        high: 100,
        status: "Sin dato",
        color: "gray",
        note: "interpretar solo si la muestra fue en ayunas",
      }),
    );
  } else if (glucoseValue < 70) {
    markers.push(
      buildMarker("glucosa", {
        name: "Glucosa",
        value: glucoseValue,
        unit: "mg/dL",
        low: 70,
        high: 100,
        status: "Baja",
        color: "red",
        note: "interpretar solo si la muestra fue en ayunas",
      }),
    );
  } else if (glucoseValue <= 100) {
    markers.push(
      buildMarker("glucosa", {
        name: "Glucosa",
        value: glucoseValue,
        unit: "mg/dL",
        low: 70,
        high: 100,
        status: "Normal si fue en ayunas",
        color: "green",
        note: "interpretar solo si la muestra fue en ayunas",
      }),
    );
  } else if (glucoseValue <= 125) {
    markers.push(
      buildMarker("glucosa", {
        name: "Glucosa",
        value: glucoseValue,
        unit: "mg/dL",
        low: 70,
        high: 100,
        status: "100-125 si fue en ayunas",
        color: "yellow",
        note: "interpretar solo si la muestra fue en ayunas",
      }),
    );
  } else {
    markers.push(
      buildMarker("glucosa", {
        name: "Glucosa",
        value: glucoseValue,
        unit: "mg/dL",
        low: 70,
        high: 100,
        status: ">=126 si fue en ayunas",
        color: "red",
        note: "interpretar solo si la muestra fue en ayunas",
      }),
    );
  }

  if (cholesterolValue === null) {
    markers.push(
      buildMarker("colesterol", {
        name: "Colesterol",
        value: cholesterolValue,
        unit: "mg/dL",
        high: 199,
        status: "Sin dato",
        color: "gray",
        note: "colesterol total",
      }),
    );
  } else if (cholesterolValue < 200) {
    markers.push(
      buildMarker("colesterol", {
        name: "Colesterol",
        value: cholesterolValue,
        unit: "mg/dL",
        high: 199,
        status: "Deseable",
        color: "green",
        note: "colesterol total",
      }),
    );
  } else if (cholesterolValue < 240) {
    markers.push(
      buildMarker("colesterol", {
        name: "Colesterol",
        value: cholesterolValue,
        unit: "mg/dL",
        high: 199,
        status: "Limite alto",
        color: "yellow",
        note: "colesterol total",
      }),
    );
  } else {
    markers.push(
      buildMarker("colesterol", {
        name: "Colesterol",
        value: cholesterolValue,
        unit: "mg/dL",
        high: 199,
        status: "Alto",
        color: "red",
        note: "colesterol total",
      }),
    );
  }

  if (triglyceridesValue === null) {
    markers.push(
      buildMarker("trigliceridos", {
        name: "Trigliceridos",
        value: triglyceridesValue,
        unit: "mg/dL",
        high: 149,
        status: "Sin dato",
        color: "gray",
      }),
    );
  } else if (triglyceridesValue < 150) {
    markers.push(
      buildMarker("trigliceridos", {
        name: "Trigliceridos",
        value: triglyceridesValue,
        unit: "mg/dL",
        high: 149,
        status: "Normal",
        color: "green",
      }),
    );
  } else if (triglyceridesValue < 200) {
    markers.push(
      buildMarker("trigliceridos", {
        name: "Trigliceridos",
        value: triglyceridesValue,
        unit: "mg/dL",
        high: 149,
        status: "Limite alto",
        color: "yellow",
      }),
    );
  } else if (triglyceridesValue < 500) {
    markers.push(
      buildMarker("trigliceridos", {
        name: "Trigliceridos",
        value: triglyceridesValue,
        unit: "mg/dL",
        high: 149,
        status: "Alto",
        color: "red",
      }),
    );
  } else {
    markers.push(
      buildMarker("trigliceridos", {
        name: "Trigliceridos",
        value: triglyceridesValue,
        unit: "mg/dL",
        high: 149,
        status: "Muy alto",
        color: "red",
      }),
    );
  }

  {
    const status = resolveRangeStatus(creatinineValue, 0.6, 1.3);
    markers.push(
      buildMarker("creatinina", {
        name: "Creatinina",
        value: creatinineValue,
        unit: "mg/dL",
        low: 0.6,
        high: 1.3,
        status: status.status,
        color: status.color,
      }),
    );
  }

  if (astValue === null) {
    markers.push(
      buildMarker("tgo_ast", {
        name: "TGO (AST)",
        value: astValue,
        unit: "U/L",
        high: 33,
        status: "Sin dato",
        color: "gray",
      }),
    );
  } else if (astValue <= 33) {
    markers.push(
      buildMarker("tgo_ast", {
        name: "TGO (AST)",
        value: astValue,
        unit: "U/L",
        high: 33,
        status: "Normal",
        color: "green",
      }),
    );
  } else if (astValue <= 50) {
    markers.push(
      buildMarker("tgo_ast", {
        name: "TGO (AST)",
        value: astValue,
        unit: "U/L",
        high: 33,
        status: "Elevacion leve",
        color: "yellow",
      }),
    );
  } else {
    markers.push(
      buildMarker("tgo_ast", {
        name: "TGO (AST)",
        value: astValue,
        unit: "U/L",
        high: 33,
        status: "Elevada",
        color: "red",
      }),
    );
  }

  if (altValue === null) {
    markers.push(
      buildMarker("tgp_alt", {
        name: "TGP (ALT)",
        value: altValue,
        unit: "U/L",
        high: 36,
        status: "Sin dato",
        color: "gray",
      }),
    );
  } else if (altValue <= 36) {
    markers.push(
      buildMarker("tgp_alt", {
        name: "TGP (ALT)",
        value: altValue,
        unit: "U/L",
        high: 36,
        status: "Normal",
        color: "green",
      }),
    );
  } else if (altValue <= 55) {
    markers.push(
      buildMarker("tgp_alt", {
        name: "TGP (ALT)",
        value: altValue,
        unit: "U/L",
        high: 36,
        status: "Elevacion leve",
        color: "yellow",
      }),
    );
  } else {
    markers.push(
      buildMarker("tgp_alt", {
        name: "TGP (ALT)",
        value: altValue,
        unit: "U/L",
        high: 36,
        status: "Elevada",
        color: "red",
      }),
    );
  }

  if (cholinesteraseValue === null) {
    markers.push(
      buildMarker("colinesterasa", {
        name: "Colinesterasa",
        value: cholinesteraseValue,
        unit: "U/L",
        low: 4400,
        high: 8200,
        status: "Sin dato",
        color: "gray",
        note: "rango del encabezado MEDILAB; validar si cambia el metodo",
      }),
    );
  } else if (cholinesteraseValue < 4400) {
    markers.push(
      buildMarker("colinesterasa", {
        name: "Colinesterasa",
        value: cholinesteraseValue,
        unit: "U/L",
        low: 4400,
        high: 8200,
        status: "Baja",
        color: "red",
        note: "rango del encabezado MEDILAB; validar si cambia el metodo",
      }),
    );
  } else if (cholinesteraseValue <= 8200) {
    markers.push(
      buildMarker("colinesterasa", {
        name: "Colinesterasa",
        value: cholinesteraseValue,
        unit: "U/L",
        low: 4400,
        high: 8200,
        status: "En rango referencial",
        color: "green",
        note: "rango del encabezado MEDILAB; validar si cambia el metodo",
      }),
    );
  } else {
    markers.push(
      buildMarker("colinesterasa", {
        name: "Colinesterasa",
        value: cholinesteraseValue,
        unit: "U/L",
        low: 4400,
        high: 8200,
        status: "Alta vs rango referencial",
        color: "yellow",
        note: "rango del encabezado MEDILAB; validar si cambia el metodo",
      }),
    );
  }

  return markers;
}

function buildAlertBand(alertsCount: number) {
  if (alertsCount <= 0) {
    return "0 alertas";
  }

  if (alertsCount === 1) {
    return "1 alerta";
  }

  return "2+ alertas";
}

export async function getMedicalPersonDetailByPersonId(personId: string): Promise<MedicalPersonPayload> {
  const normalizedPersonId = personId.trim();

  return cachedAsync(
    `medical:person:${normalizedPersonId}`,
    MEDICAL_TTL_MS,
    async () => {
      const profileResult = await query<MedicalProfileQueryRow>(
        `
          with ranked_profiles as (
            select
              nullif(trim(person_name), '') as person_name,
              nullif(trim(national_id::text), '') as national_id,
              row_number() over (
                order by
                  is_current desc nulls last,
                  valid_from desc nulls last,
                  loaded_at desc nulls last
              ) as rn
            from slv.tthh_dim_person_profile_scd2
            where trim(person_id::text) = $1
          )
          select
            person_name,
            national_id
          from ranked_profiles
          where rn = 1
        `,
        [normalizedPersonId],
      );

      const profileRow = profileResult.rows[0] ?? null;
      const normalizedNationalId = normalizeNationalId(profileRow?.national_id);

      if (!normalizedNationalId) {
        return {
          personId: normalizedPersonId,
          generatedAt: new Date().toISOString(),
          profile: profileRow
            ? {
                fullName: cleanText(profileRow.person_name) || null,
                nationalId: null,
              }
            : null,
          summary: {
            examsCount: 0,
            lastExamDate: null,
            lastExamType: null,
            availableMarkerCount: 0,
            alertExamCount: 0,
          },
          exams: [],
        } satisfies MedicalPersonPayload;
      }

      const examsResult = await query<MedicalExamQueryRow>(
        `
          select
            exam_id,
            to_char(fecha, 'YYYY-MM-DD') as fecha,
            nullif(trim(tipo), '') as tipo,
            nullif(trim(tipo_norm), '') as tipo_norm,
            nullif(trim(trabajador), '') as trabajador,
            nullif(trim(sexo), '') as sexo,
            edad,
            rbc,
            hemoglobina,
            hematocrito,
            wbc,
            plaquetas,
            glucosa,
            colesterol,
            trigliceridos,
            creatinina,
            tgo_ast,
            tgp_alt,
            colinesterasa
          from ${MEDICAL_SOURCE}
          where cedula_norm = $1
          order by fecha desc nulls last, exam_id desc
        `,
        [normalizedNationalId],
      );

      const exams = examsResult.rows.map((row) => {
        const markers = buildMarkers(row);
        const alertsCount = markers.filter((marker) => marker.color === "red" || marker.color === "yellow").length;

        return {
          examId: Number(row.exam_id ?? 0),
          date: cleanText(row.fecha) || "-",
          type: cleanText(row.tipo_norm) || cleanText(row.tipo) || "Sin tipo",
          workerName: cleanText(row.trabajador) || null,
          sex: normalizeSex(row.sexo),
          age: toNumber(row.edad),
          alertsCount,
          alertsBand: buildAlertBand(alertsCount),
          markers,
        } satisfies MedicalPersonExam;
      });

      const latestExam = exams[0] ?? null;
      const availableMarkers = new Set<MedicalMarkerField>();

      for (const exam of exams) {
        for (const marker of exam.markers) {
          if (marker.value !== null) {
            availableMarkers.add(marker.field);
          }
        }
      }

      return {
        personId: normalizedPersonId,
        generatedAt: new Date().toISOString(),
        profile: {
          fullName:
            cleanText(profileRow?.person_name) ||
            latestExam?.workerName ||
            null,
          nationalId: normalizedNationalId,
        },
        summary: {
          examsCount: exams.length,
          lastExamDate: latestExam?.date ?? null,
          lastExamType: latestExam?.type ?? null,
          availableMarkerCount: availableMarkers.size,
          alertExamCount: exams.filter((exam) => exam.alertsCount > 0).length,
        },
        exams,
      } satisfies MedicalPersonPayload;
    },
  );
}
