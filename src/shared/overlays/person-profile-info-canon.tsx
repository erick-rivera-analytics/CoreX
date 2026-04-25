"use client";

import type { ReactNode } from "react";

import type { CycleLaborPersonProfile } from "@/lib/fenograma";
import type { TalentoPersonProfile } from "@/lib/talento-humano";
import { formatDate, formatInteger } from "@/shared/lib/format";

/**
 * Layout canónico ÚNICO para la tab "Información" de la ficha del personal.
 *
 * Esta es la verdad visual: cualquier ficha de persona, abierta desde
 * Productividad / Fenograma / Talento Humano / Composición laboral / Campo,
 * usa este layout. Las diferencias de datos por módulo se resuelven en
 * adaptadores (`mapCyclePayloadToInfoCanon`, `mapTalentoPayloadToInfoCanon`),
 * NO duplicando componentes UI.
 *
 * Estructura:
 * - 3 secciones siempre visibles: Identificación / Empleo / Contacto
 * - 4ª sección "Acceso a la empresa" condicional (solo si hay últimas
 *   entradas/salidas en el payload)
 * - Empty state por campo: "—" en lugar de ocultar el field
 * - Grid responsive: 1 col mobile, 2 cols sm, 3 cols xl
 */
export type PersonProfileInfoCanonProps = {
  // Identificación
  fullName: string | null;
  identification: string | null;
  genero: string | null;
  estadoCivil: string | null;
  fechaNacimiento: string | null;
  lugarNacimiento: string | null;
  nacionalidad: string | null;
  nivelEducativo: string | null;
  hijos: number | null;
  dependientes: number | null;
  discapacidad: boolean | null;

  // Empleo
  cargo: string | null;
  empleador: string | null;
  tipoEmpleado: string | null;
  tipoContrato: string | null;
  clasificacionCargo: string | null;
  codigoFinca: string | null;
  trabajadorAsociado: string | null;
  pagoPorRendimiento: boolean | null;
  ultimaEntrada: string | null;
  ultimaSalida: string | null;

  // Contacto
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  ciudad: string | null;
  parroquia: string | null;
};

const EMPTY = "—";

function val(value: string | null | undefined): string {
  if (!value || value.trim() === "") return EMPTY;
  return value;
}

function valDate(value: string | null | undefined): string {
  if (!value) return EMPTY;
  try {
    return formatDate(value);
  } catch {
    return value;
  }
}

function valInt(value: number | null | undefined): string {
  if (value == null) return EMPTY;
  return formatInteger(value);
}

function valBool(value: boolean | null | undefined): string {
  if (value == null) return EMPTY;
  return value ? "Sí" : "No";
}

export function PersonProfileInfoCanon(props: PersonProfileInfoCanonProps) {
  const showAcceso = props.ultimaEntrada != null || props.ultimaSalida != null;

  return (
    <div className="space-y-5">
      <Section title="Identificación">
        <InfoField label="Nombre completo" value={val(props.fullName)} />
        <InfoField label="Cédula / ID" value={val(props.identification)} />
        <InfoField label="Género" value={val(props.genero)} />
        <InfoField label="Estado civil" value={val(props.estadoCivil)} />
        <InfoField label="Fecha de nacimiento" value={valDate(props.fechaNacimiento)} />
        <InfoField label="Lugar de nacimiento" value={val(props.lugarNacimiento)} />
        <InfoField label="Nacionalidad" value={val(props.nacionalidad)} />
        <InfoField label="Nivel educativo" value={val(props.nivelEducativo)} />
        <InfoField label="Hijos" value={valInt(props.hijos)} />
        <InfoField label="Dependientes" value={valInt(props.dependientes)} />
        <InfoField label="Discapacidad" value={valBool(props.discapacidad)} />
      </Section>

      <Section title="Empleo">
        <InfoField label="Cargo" value={val(props.cargo)} />
        <InfoField label="Empleador" value={val(props.empleador)} />
        <InfoField label="Tipo de empleado" value={val(props.tipoEmpleado)} />
        <InfoField label="Tipo de contrato" value={val(props.tipoContrato)} />
        <InfoField label="Clasificación de cargo" value={val(props.clasificacionCargo)} />
        <InfoField label="Código de finca" value={val(props.codigoFinca)} />
        <InfoField label="Trabajador asociado" value={val(props.trabajadorAsociado)} />
        <InfoField label="Pago por rendimiento" value={valBool(props.pagoPorRendimiento)} />
      </Section>

      <Section title="Contacto">
        <InfoField label="Email" value={val(props.email)} />
        <InfoField label="Teléfono" value={val(props.telefono)} />
        <InfoField label="Dirección" value={val(props.direccion)} />
        <InfoField label="Ciudad" value={val(props.ciudad)} />
        <InfoField label="Parroquia" value={val(props.parroquia)} />
      </Section>

      {showAcceso ? (
        <Section title="Acceso a la empresa">
          <InfoField label="Última entrada" value={valDate(props.ultimaEntrada)} />
          <InfoField label="Última salida" value={valDate(props.ultimaSalida)} />
        </Section>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/14 px-5 py-5">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/65">
        {title}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/18 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/65">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

// ─── Adaptadores por payload ────────────────────────────────────────────────

export function mapCyclePayloadToInfoCanon(profile: CycleLaborPersonProfile | null): PersonProfileInfoCanonProps {
  return {
    fullName: profile?.fullName ?? null,
    identification: profile?.nationalId ?? null,
    genero: profile?.gender ?? null,
    estadoCivil: profile?.maritalStatus ?? null,
    fechaNacimiento: profile?.birthDate ?? null,
    lugarNacimiento: profile?.birthPlace ?? null,
    nacionalidad: profile?.nationality ?? null,
    nivelEducativo: profile?.educationTitle ?? null,
    hijos: profile?.childrenCount ?? null,
    dependientes: profile?.dependentsCount ?? null,
    discapacidad: profile?.disabledFlag ?? null,
    cargo: profile?.jobTitle ?? null,
    empleador: profile?.employerName ?? null,
    tipoEmpleado: profile?.employeeType ?? null,
    tipoContrato: profile?.contractType ?? null,
    clasificacionCargo: profile?.jobClassificationCode ?? null,
    codigoFinca: profile?.farmCode ?? null,
    trabajadorAsociado: profile?.associatedWorkerName ?? null,
    pagoPorRendimiento: profile?.performancePayApplicable ?? null,
    ultimaEntrada: profile?.lastEntryDate ?? null,
    ultimaSalida: profile?.lastExitDate ?? null,
    email: profile?.email ?? null,
    telefono: profile?.phoneNumber ?? null,
    direccion: profile?.address ?? null,
    ciudad: profile?.city ?? null,
    parroquia: profile?.parish ?? null,
  };
}

export function mapTalentoPayloadToInfoCanon(profile: TalentoPersonProfile): PersonProfileInfoCanonProps {
  return {
    fullName: profile.personName ?? null,
    identification: profile.nationalId ?? null,
    genero: profile.gender ?? null,
    estadoCivil: profile.maritalStatus ?? null,
    fechaNacimiento: profile.birthDate ?? null,
    lugarNacimiento: profile.birthPlace ?? null,
    nacionalidad: profile.nationality ?? null,
    nivelEducativo: profile.educationTitle ?? null,
    hijos: profile.childrenCount ?? null,
    dependientes: profile.dependentsCount ?? null,
    discapacidad: profile.disabledFlag ?? null,
    cargo: profile.jobTitle ?? null,
    empleador: profile.employerName ?? null,
    tipoEmpleado: profile.employeeType ?? null,
    tipoContrato: profile.contractType ?? null,
    clasificacionCargo: profile.jobClassificationCode ?? null,
    codigoFinca: profile.farmCode ?? null,
    trabajadorAsociado: profile.associatedWorkerName ?? null,
    pagoPorRendimiento: profile.performancePayApplicable ?? null,
    ultimaEntrada: profile.lastEntryDate ?? null,
    ultimaSalida: profile.lastExitDate ?? null,
    email: profile.email ?? null,
    telefono: profile.phoneNumber ?? null,
    direccion: profile.address ?? null,
    ciudad: profile.city ?? null,
    parroquia: profile.parish ?? null,
  };
}
