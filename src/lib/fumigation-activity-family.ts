export const FUMIGATION_LANZA_NORMAL_ACTIVITY_IDS = [
  "FMGYP",
  "FMGYPA1",
  "FMGYPA2",
  "FMGYPM1",
  "FMGYPM2",
  "FMGYPAC2",
] as const;

export const FUMIGATION_LANZAS_EFICIENTES_ACTIVITY_IDS = [
  "FMGYPEF",
] as const;

export const FUMIGATION_DRON_ACTIVITY_IDS = [
  "03VAFIFMG",
  "03VAFIFMGL",
] as const;

export const FUMIGATION_ACTIVITY_FAMILIES = {
  LANZA_NORMAL: FUMIGATION_LANZA_NORMAL_ACTIVITY_IDS,
  LANZAS_EFICIENTES: FUMIGATION_LANZAS_EFICIENTES_ACTIVITY_IDS,
  DRON: FUMIGATION_DRON_ACTIVITY_IDS,
} as const;

export const FUMIGATION_ACTIVITY_IDS = [
  ...FUMIGATION_LANZA_NORMAL_ACTIVITY_IDS,
  ...FUMIGATION_LANZAS_EFICIENTES_ACTIVITY_IDS,
  ...FUMIGATION_DRON_ACTIVITY_IDS,
] as const;

export type FumigationActivityId = (typeof FUMIGATION_ACTIVITY_IDS)[number];
export type FumigationActivityFamily = keyof typeof FUMIGATION_ACTIVITY_FAMILIES;

const FUMIGATION_ACTIVITY_ID_SET = new Set<string>(FUMIGATION_ACTIVITY_IDS);

export function isFumigationActivityId(activityId: string | null | undefined) {
  const normalized = activityId?.trim().toUpperCase() ?? "";
  return FUMIGATION_ACTIVITY_ID_SET.has(normalized);
}

export function getFumigationActivityFamily(activityId: string | null | undefined): FumigationActivityFamily | null {
  const normalized = activityId?.trim().toUpperCase() ?? "";

  if (FUMIGATION_LANZA_NORMAL_ACTIVITY_IDS.includes(normalized as (typeof FUMIGATION_LANZA_NORMAL_ACTIVITY_IDS)[number])) {
    return "LANZA_NORMAL";
  }

  if (FUMIGATION_LANZAS_EFICIENTES_ACTIVITY_IDS.includes(normalized as (typeof FUMIGATION_LANZAS_EFICIENTES_ACTIVITY_IDS)[number])) {
    return "LANZAS_EFICIENTES";
  }

  if (FUMIGATION_DRON_ACTIVITY_IDS.includes(normalized as (typeof FUMIGATION_DRON_ACTIVITY_IDS)[number])) {
    return "DRON";
  }

  return null;
}

export function getFumigationFamilyLabel(family: FumigationActivityFamily) {
  switch (family) {
    case "LANZA_NORMAL":
      return "Lanza normal";
    case "LANZAS_EFICIENTES":
      return "Lanzas eficientes";
    case "DRON":
      return "Dron";
    default:
      return family;
  }
}
